# main.py — FastAPI entry (DOCX → Quiz парсинг, алдын-ала қарау, bulk сақтаумен)
# Бұл нұсқада algorithm/… импорты жоқ.
# Парсер логикасы осы файлдың ішінде және quiz_parser.process_docx fallback ретінде қолданылады.

from __future__ import annotations
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.orm import Session
from jose import jwt, JWTError

import os
import re
import json
import shutil
import tempfile
from uuid import uuid4
from typing import Optional, List, Any, Dict
import random
from datetime import datetime, timedelta

from docx2python import docx2python

# DB қабаты
from database import SessionLocal, get_db
from models import Subject, Topic, Quiz, User

# БӨЛЕК ПАРСЕР МОДУЛІ (fallback ретінде)
from quiz_parser import process_docx

# auth, schemas, iquiz
from auth import register_user, verify_user, resend_verification_code
from schemas import RegisterIn, VerifyIn, LoginIn, ResendIn, CreateRoomRequest, JoinRequest, RoomState, JoinResponse
from modes.iquiz.iquiz_manager import iquiz_manager

SECRET_KEY = "easy_super_secret_key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")


def create_token(data: dict, minutes: int = ACCESS_TOKEN_EXPIRE_MINUTES):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(status_code=401, detail="Токен жарамсыз немесе ескі")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise credentials_exception
    return user


# ───────────────────────────────────────────────────────────
# FastAPI және CORS
# ───────────────────────────────────────────────────────────

app = FastAPI()

origins = [
    "http://10.147.31.99:5173",
    "http://localhost:5173",
    # "https://senin-prod-domen.kz",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ───────────────────────────────────────────────────────────
# Көмекші: slug нормализация
# ───────────────────────────────────────────────────────────

def normalize_key(s: str) -> str:
    return re.sub(r"[\s\-]+", "-", (s or "").strip().casefold())


# ───────────────────────────────────────────────────────────
# Pydantic схемалар
# ───────────────────────────────────────────────────────────

class SubjectCreate(BaseModel):
    name: str


class TopicCreate(BaseModel):
    name: str


class QuizCreate(BaseModel):
    question: str
    options: List[str]
    correct_answer: Optional[str] = None  # бос қалдыруға болады


class ParsedBlock(BaseModel):
    question: str
    options: List[str]
    answer_index: Optional[int] = None  # парсер тапса — алдын-ала толады


class BulkSaveRequest(BaseModel):
    quizzes: List[ParsedBlock]


class AnswerCheck(BaseModel):
    selected_answer: str


# ───────────────────────────────────────────────────────────
# DOCX ПАРСЕР КӨМЕКШІ ФУНКЦИЯЛАР (осы файлда)
# ───────────────────────────────────────────────────────────

# "1) Сұрақ..." үлгісі
QUESTION_LINE_RE = re.compile(r'^\s*(\d+)\)\s*(.+)$')

# "A) Нұсқа..." үлгісі
OPTION_LINE_RE = re.compile(r'^\s*([A-D])\)\s*(.+)$')

# "1)A" немесе "10) B" сияқты жауап жұптары
ANSWER_PAIR_RE = re.compile(r'(\d{1,3})\)\s*([A-D])', re.IGNORECASE)

# Таза жауап жолы: "1)A"
ANSWER_LINE_RE = re.compile(r'^\s*(\d{1,3})\)\s*([A-D])\s*$')


def _extract_lines_from_body(doc) -> List[str]:
    """
    doc.body ішіндегі барлық мәтінді бір өлшемді тізімге жинау.
    Кесте де, жай мәтін де → ретін сақтап шығарамыз.
    """
    lines: List[str] = []
    # doc.body құрылымы: [page][table][row][cell]
    for first in doc.body:
        for second in first:
            for third in second:
                for cell in third:
                    if cell is None:
                        continue
                    text = str(cell)
                    parts = re.split(r'[\n\r\t]+', text)
                    for p in parts:
                        s = p.strip()
                        if s:
                            lines.append(s)
    return lines


def _detect_answer_start_index(lines: List[str]) -> int:
    """
    Жауаптар блокы басталатын индексті табу.
    Ереже:
      1) Бір жолда 2+ "N)A" жұбы болса → жауаптар осы жерден.
      2) Немесе қатарынан кемі 2 "N)A" стилді жол → жауаптар блогы.
      Болмаса: жауап бөлек көрсетілмеген деп санаймыз.
    """
    n = len(lines)

    # 1) Бір жолда 2+ жұп
    for i, line in enumerate(lines):
        if len(ANSWER_PAIR_RE.findall(line)) >= 2:
            return i

    # 2) Вертикалды N)A тізімі
    run_start = None
    for i, line in enumerate(lines):
        if ANSWER_LINE_RE.match(line):
            if run_start is None:
                run_start = i
        else:
            if run_start is not None:
                if i - run_start >= 2:
                    return run_start
                run_start = None

    if run_start is not None and n - run_start >= 2:
        return run_start

    return n  # жауап блокы табылмады


def _parse_questions_from_lines(lines: List[str], end: int) -> List[Dict[str, Any]]:
    """
    0..end-1 аралығынан сұрақтар мен нұсқаларды шығарамыз.
    Жауап аймағына тимейміз → кестедегі 1)A т.б. сұрақ болмайды.
    """
    questions: List[Dict[str, Any]] = []
    current: Optional[Dict[str, Any]] = None

    for line in lines[:end]:
        mq = QUESTION_LINE_RE.match(line)
        mo = OPTION_LINE_RE.match(line)

        if mq:
            num = int(mq.group(1))
            rest = mq.group(2).strip()

            # Таза "1)A" болса — бұл жауапқа ұқсайды, сұрақ емес → өткізіп жібереміз
            if len(rest) == 1 and rest.upper() in "ABCD":
                continue

            if current:
                questions.append(current)

            current = {
                "number": num,
                "question": rest,
                "options": [],
                "answer_index": None,
            }

        elif current and mo:
            letter, txt = mo.groups()
            current["options"].append(f"{letter}) {txt.strip()}")

        elif current:
            extra = line.strip()
            if not extra:
                continue
            # Егер опциялар бар болса — соңғы опцияның жалғасы
            if current["options"]:
                current["options"][-1] += " " + extra
            else:
                # Әйтпесе сұрақтың жалғасы
                current["question"] += " " + extra

    if current:
        questions.append(current)

    # Кемінде 2 опциясы бар сұрақтарды қалдырамыз
    cleaned: List[Dict[str, Any]] = []
    for q in questions:
        opts = [o for o in q["options"] if o.strip()]
        if q["question"] and len(opts) >= 2:
            q["options"] = opts
            cleaned.append(q)

    return cleaned


def _parse_answers_from_lines(lines: List[str], start: int, max_q: int) -> Dict[int, str]:
    """
    start..соңына дейін "N)A" жұптарын оқимыз.
    Тек 1..max_q диапазонына түсетіндерін аламыз.
    """
    answers: Dict[int, str] = {}
    for line in lines[start:]:
        for num_str, letter in ANSWER_PAIR_RE.findall(line):
            num = int(num_str)
            if 1 <= num <= max_q:
                answers[num] = letter.upper()
    return answers


def parse_docx_with_answers(path: str, debug: bool = False) -> List[Dict[str, Any]]:
    """
    Бір DOCX файлы:
      - body арқылы сұрақтар мен нұсқаларды оқиды;
      - соңындағы кесте/блоктан N)A стиліндегі жауаптарды оқиды;
      - answer_index-ті автоматты толтырады.

    Қайтарады: [{question, options, answer_index}, ...]
    """
    doc = docx2python(path)
    lines = _extract_lines_from_body(doc)

    if debug:
        print("---- DOCX BODY LINES ----")
        for i, ln in enumerate(lines):
            print(f"{i:03}: {ln}")
        print("---- END LINES ----")

    ans_start = _detect_answer_start_index(lines)
    questions = _parse_questions_from_lines(lines, ans_start)

    if not questions:
        if debug:
            print("[parse_docx_with_answers] Сұрақ табылмады (body).")
        return []

    max_q = max(q["number"] for q in questions)
    answers = _parse_answers_from_lines(lines, ans_start, max_q) if ans_start < len(lines) else {}

    for q in questions:
        num = q["number"]
        letter = answers.get(num)
        if not letter:
            q["answer_index"] = None
            continue

        idx = None
        for i, opt in enumerate(q["options"]):
            if opt.lstrip().upper().startswith(f"{letter})"):
                idx = i
                break
        q["answer_index"] = idx

    if debug:
        print(f"[parse_docx_with_answers] {len(questions)} сұрақ табылды.")
        for q in questions:
            print(q)

    # Сыртқа number қажет емес — тек question, options, answer_index
    out: List[Dict[str, Any]] = []
    for q in questions:
        out.append({
            "question": q["question"],
            "options": q["options"],
            "answer_index": q["answer_index"],
        })

    return out


# ───────────────────────────────────────────────────────────
# Статикалық медиа (сурет/файл)
# ───────────────────────────────────────────────────────────

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.post("/api/upload")
async def upload_image(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in [".png", ".jpg", ".jpeg", ".gif", ".webp"]:
        raise HTTPException(status_code=400, detail="Рұқсат етілмеген формат")
    fname = f"{uuid4().hex}{ext}"
    save_path = os.path.join(UPLOAD_DIR, fname)
    with open(save_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"url": f"/uploads/{fname}"}


# ───────────────────────────────────────────────────────────
# Subjects
# ───────────────────────────────────────────────────────────

@app.get("/api/subjects")
def get_subjects(db: Session = Depends(get_db)):
    return db.query(Subject).all()


@app.post("/api/subjects")
def add_subject(subject: SubjectCreate, db: Session = Depends(get_db)):
    new_subject = Subject(name=subject.name)
    db.add(new_subject)
    db.commit()
    db.refresh(new_subject)
    return {"id": new_subject.id, "name": new_subject.name, "message": "Пән қосылды ✅"}


@app.delete("/api/subjects/{subject_id}")
def delete_subject(subject_id: int, db: Session = Depends(get_db)):
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Пән табылмады")
    db.delete(subject)
    db.commit()
    return {"message": "Пән өшірілді ✅"}


# ───────────────────────────────────────────────────────────
# Topics
# ───────────────────────────────────────────────────────────

@app.get("/api/subjects/{name}/topics")
def get_topics(name: str, db: Session = Depends(get_db)):
    target = normalize_key(name)
    for subj in db.query(Subject).all():
        if normalize_key(subj.name) == target:
            return db.query(Topic).filter(Topic.subject_id == subj.id).all()
    raise HTTPException(status_code=404, detail=f"Пән табылмады: {name}")


@app.post("/api/subjects/{name}/topics")
def add_topic(name: str, topic: TopicCreate, db: Session = Depends(get_db)):
    target = normalize_key(name)
    for subj in db.query(Subject).all():
        if normalize_key(subj.name) == target:
            new_topic = Topic(name=topic.name, subject_id=subj.id)
            db.add(new_topic)
            db.commit()
            db.refresh(new_topic)
            return {"message": "Тақырып қосылды ✅", "id": new_topic.id}
    raise HTTPException(status_code=404, detail=f"Пән табылмады: {name}")


@app.delete("/api/topics/{topic_id}")
def delete_topic(topic_id: int, db: Session = Depends(get_db)):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Тақырып табылмады")
    db.delete(topic)
    db.commit()
    return {"message": "Тақырып өшірілді ✅"}


# ───────────────────────────────────────────────────────────
# Quiz: бір-бірлеп қосу
# ───────────────────────────────────────────────────────────

@app.post("/api/topics/{topic_id}/quizzes")
def add_quiz(topic_id: int, quiz: QuizCreate, db: Session = Depends(get_db)):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Тақырып табылмады")

    cleaned_opts: List[str] = []
    if quiz.options:
        for o in quiz.options:
            s = (o or "").strip()
            if s:
                cleaned_opts.append(s)

    new_quiz = Quiz(
        question=(quiz.question or "").strip(),
        options=json.dumps(cleaned_opts, ensure_ascii=False),
        correct_answer=((quiz.correct_answer or "").strip() if quiz.correct_answer else None),
        topic_id=topic_id,
    )
    db.add(new_quiz)
    db.commit()
    db.refresh(new_quiz)
    return {"message": "Quiz қосылды ✅", "id": new_quiz.id}


@app.get("/api/topics/{topic_id}/quizzes")
def get_quizzes(topic_id: int, db: Session = Depends(get_db)):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Тақырып табылмады")

    quizzes = db.query(Quiz).filter(Quiz.topic_id == topic_id).all()
    out: List[dict] = []
    for q in quizzes:
        opts: List[str] = []
        try:
            opts = json.loads(q.options) if q.options else []
        except Exception:
            tmp = (q.options or "")
            parts = tmp.split(";")
            for p in parts:
                sp = (p or "").strip()
                if sp:
                    opts.append(sp)

        out.append({
            "id": q.id,
            "question": q.question,
            "options": opts,
        })
    return out


@app.post("/api/quizzes/{quiz_id}/check")
def check_answer(quiz_id: int, answer: AnswerCheck, db: Session = Depends(get_db)):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Сұрақ табылмады")
    is_correct = (quiz.correct_answer or "") == (answer.selected_answer or "")
    return {"correct": is_correct, "correct_answer": quiz.correct_answer}


# ───────────────────────────────────────────────────────────
# DOCX → FRONT PREVIEW: /api/parse-docx
# ───────────────────────────────────────────────────────────

@app.post("/api/parse-docx")
async def parse_docx_endpoint(file: UploadFile = File(...), debug: bool = False):
    """
    DOCX қабылдайды → сұрақтар мен нұсқаларды, соңындағы жауап кестесін бірге парсинг.
    Қайтарады: {"questions": [{text, options, answer_index?}]}
    """
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext != ".docx":
        raise HTTPException(status_code=400, detail="Тек .docx файл қабылданады.")

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".docx") as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        # 1) Алдымен осы файл ішіндегі парсерді қолданамыз
        blocks = parse_docx_with_answers(tmp_path, debug=debug)

        # 2) Егер ештеңе таппаса — quiz_parser.process_docx fallback
        if not blocks:
            try:
                legacy = process_docx(tmp_path, debug=debug)
            except TypeError:
                legacy = process_docx(tmp_path)
            blocks = []
            for b in (legacy or []):
                blocks.append({
                    "question": b.get("question") or "",
                    "options": b.get("options") or [],
                    "answer_index": b.get("answer_index"),
                })

        # FRONT-ке ыңғайлы формат
        questions: List[dict] = []
        for b in (blocks or []):
            q = (b.get("question") or b.get("text") or "").strip()
            raw_opts = b.get("options") or []
            opts: List[str] = []
            for o in raw_opts:
                s = str(o).strip()
                if s:
                    opts.append(s)

            if not q or len(opts) < 2:
                continue

            item = {
                "text": q,
                "options": opts,
            }

            ai = b.get("answer_index")
            if isinstance(ai, int) and 0 <= ai < len(opts):
                item["answer_index"] = ai

            questions.append(item)

        if not questions:
            raise HTTPException(
                status_code=400,
                detail="Сұрақ табылмады. Құжатта '1) ...' сұрақтар мен 'A) ...' нұсқалар барын тексеріңіз."
            )

        return {"questions": questions}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Құжатты оқу мүмкін болмады: {e}")
    finally:
        try:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)
        except Exception:
            pass


# ───────────────────────────────────────────────────────────
# Bulk сақтау
# ───────────────────────────────────────────────────────────

@app.post("/api/topics/{topic_id}/quizzes/bulk")
def save_quizzes_bulk(topic_id: int, payload: BulkSaveRequest, db: Session = Depends(get_db)):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Тақырып табылмады")

    created_ids: List[int] = []

    for item in payload.quizzes:
        question = (item.question or "").strip()

        options: List[str] = []
        raw = item.options or []
        for o in raw:
            s = (o or "").strip()
            if s:
                options.append(s)

        if not question or len(options) < 2:
            continue

        correct_answer: Optional[str] = None
        if item.answer_index is not None:
            try:
                if 0 <= item.answer_index < len(options):
                    correct_answer = options[item.answer_index]
            except Exception:
                correct_answer = None

        q = Quiz(
            question=question,
            options=json.dumps(options, ensure_ascii=False),
            correct_answer=correct_answer,
            topic_id=topic_id,
        )
        db.add(q)
        db.flush()
        created_ids.append(q.id)

    db.commit()
    return {"message": f"{len(created_ids)} сұрақ сақталды ✅", "ids": created_ids}


# ───────────────────────────────────────────────────────────
# Exam: бірнеше тақырыптан квиздер жиыны
# ───────────────────────────────────────────────────────────

class QuizByTopicsRequest(BaseModel):
    topic_ids: List[int]
    shuffle: bool = True
    limit: Optional[int] = None


@app.post("/api/topics/{topic_id}/exam")
def get_quizzes_by_topics(payload: QuizByTopicsRequest, db: Session = Depends(get_db)):
    if not payload.topic_ids:
        raise HTTPException(status_code=400, detail="Тақырып таңдалмады")

    quizzes = (
        db.query(Quiz)
        .filter(Quiz.topic_id.in_(payload.topic_ids))
        .all()
    )

    if not quizzes:
        raise HTTPException(status_code=404, detail="Таңдалған тақырыптарда quiz табылмады")

    if payload.shuffle:
        random.shuffle(quizzes)

    if payload.limit:
        quizzes = quizzes[: payload.limit]

    result: List[dict] = []
    for q in quizzes:
        opts: List[str] = []
        try:
            opts = json.loads(q.options) if q.options else []
        except Exception:
            tmp = (q.options or "")
            parts = tmp.split(";")
            for p in parts:
                sp = (p or "").strip()
                if sp:
                    opts.append(sp)

        result.append({
            "id": q.id,
            "question": q.question,
            "options": opts,
        })

    return {"count": len(result), "quizzes": result}


# ───────────────────────────────────────────────────────────
# AUTH ENDPOINTS
# ───────────────────────────────────────────────────────────

@app.post("/api/register")
def api_register(payload: RegisterIn, db: Session = Depends(get_db)):
    return register_user(payload, db)


@app.post("/api/verify")
def api_verify(payload: VerifyIn, db: Session = Depends(get_db)):
    return verify_user(payload, db)


@app.post("/api/login")
def api_login(payload: LoginIn, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username).first()
    if not user:
        raise HTTPException(status_code=401, detail="Қолданушы табылмады")

    from auth import verify_pw
    if not verify_pw(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Құпия сөз қате")

    access_token = create_token({"sub": user.email})
    refresh_token = create_token({"sub": user.email, "type": "refresh"}, minutes=60 * 24 * 30)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email, "username": user.username},
    }


@app.post("/api/resend-code")
def api_resend_code(payload: ResendIn, db: Session = Depends(get_db)):
    return resend_verification_code(payload, db)


# ───────────────────────────────────────────────────────────
# PROFILE ENDPOINTS
# ───────────────────────────────────────────────────────────

@app.get("/api/me")
def get_profile_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.username,
        "name": getattr(current_user, "name", None),
        "bio": getattr(current_user, "bio", None),
        "avatar_url": getattr(current_user, "avatar_url", None),
    }


class ProfileUpdate(BaseModel):
    name: str | None = None
    bio: str | None = None
    avatar_url: str | None = None


@app.put("/api/profile")
def update_profile(
    data: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.name is not None:
        current_user.name = data.name
    if data.bio is not None:
        current_user.bio = data.bio
    if data.avatar_url is not None:
        current_user.avatar_url = data.avatar_url
    db.commit()
    db.refresh(current_user)
    return current_user


# ───────────────────────────────────────────────────────────
# iQuiz ROUTES
# ───────────────────────────────────────────────────────────

@app.post("/api/iquiz/create", response_model=RoomState)
async def iquiz_create(req: CreateRoomRequest):
    if req.room_code:
        room_code = req.room_code.upper()
    else:
        room_code = "".join(random.choices("0123456789", k=6))

    room = await iquiz_manager.create_room(room_code)
    if req.host_name and req.host_avatar:
        await iquiz_manager.join_room(room.id, req.host_avatar, req.host_name)
    return await iquiz_manager.get_state(room.id)


@app.post("/api/iquiz/join", response_model=JoinResponse)
async def iquiz_join(req: JoinRequest):
    player = await iquiz_manager.join_room(req.room_code, req.name, req.avatar)
    return JoinResponse(
        playerId=player.id,
        roomId=req.room_code,
        name=player.name,
        avatar=player.avatar,
    )


@app.get("/api/iquiz/room/{room_id}/state", response_model=RoomState)
async def iquiz_room_state(room_id: str):
    state = await iquiz_manager.get_state(room_id.upper())
    if not state.get("exists", True):
        raise HTTPException(status_code=404, detail="Бөлме табылмады")
    return state


@app.websocket("/api/iquiz/ws/{room_id}")
async def iquiz_ws(ws: WebSocket, room_id: str):
    await ws.accept()
    await iquiz_manager.attach_ws(room_id.upper(), ws)
    try:
        while True:
            msg = await ws.receive_json()
            if msg.get("type") == "ping":
                await ws.send_json({"type": "pong"})
    except WebSocketDisconnect:
        await iquiz_manager.detach_ws(room_id.upper(), ws)
    except Exception:
        await iquiz_manager.detach_ws(room_id.upper(), ws)
