# main.py — FastAPI entry (DOCX → Quiz парсинг, алдын-ала қарау, bulk сақтаумен)
# Бұл нұсқада algorithm/… импорты жоқ.
# Парсер learn.py логикасына негізделіп, осы файлдың ішінде жүзеге асырылды.
# /api/parse-docx → { "questions": [{ "text", "options" }] } түрде қайтарады.

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
from typing import Optional, List, Any
import random
from datetime import datetime, timedelta

# DB қабаты
from database import SessionLocal, get_db
from models import Subject, Topic, Quiz, User

# БӨЛЕК ПАРСЕР МОДУЛІ
from quiz_parser import process_docx

# бар жолды толықтыр
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
    "http://localhost:5173"
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
# Көмекші: DB session, slug нормализация
# ───────────────────────────────────────────────────────────

def normalize_key(s: str) -> str:
    return re.sub(r"[\s\-]+", "-", (s or "").strip().casefold())

# ───────────────────────────────────────────────────────────
# Pydantic схемалар (пән/тақырып/квиз және парсингке арналған)
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
    fname = f"{uuid4().hex}{ext}..."
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
    db.delete(subject)   # ORM каскад бар деп есептейміз
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
    db.delete(topic)   # ORM каскад: ішіндегі quiz-дер де кетеді
    db.commit()
    return {"message": "Тақырып өшірілді ✅"}

# ───────────────────────────────────────────────────────────
# Quiz: бір-бірлеп қосу (қолмен енгізуге ыңғайлы)
# ───────────────────────────────────────────────────────────
@app.post("/api/topics/{topic_id}/quizzes")
def add_quiz(topic_id: int, quiz: QuizCreate, db: Session = Depends(get_db)):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Тақырып табылмады")

    # options-ты циклмен тазалау (list comprehension ЖОҚ)
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
        opts = []
        try:
            opts = json.loads(q.options) if q.options else []
        except Exception:
            # егер бұрынғы форматта болса (мыс: "A;B;C;D"), fallback:
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
            # correct_answer әдейі жіберілмейді
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
# DOCX → FRONT PREVIEW (ЕҢ МАҢЫЗДЫ: /api/parse-docx → { "questions": [...] })
# ───────────────────────────────────────────────────────────
@app.post("/api/parse-docx")
async def parse_docx_endpoint(file: UploadFile = File(...), debug: bool = False):
    """
    DOCX қабылдайды → сыртқы regex-парсинг → алдын-ала қарауға арналған тізім.
    Қайтарады: {"questions": [{text, options}]}
    """
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext != ".docx":
        raise HTTPException(status_code=400, detail="Тек .docx файл қабылданады.")

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".docx") as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        # СЫРТҚЫ ПАРСЕР ҚОЛДАНЫЛАДЫ
        blocks = process_docx(tmp_path, debug=debug)

        # FRONT-ке ыңғайлы формат (list comp ЖОҚ)
        questions: List[dict] = []
        for b in (blocks or []):
            q = (b.get("question") or "").strip()

            raw_opts = b.get("options") or []
            opts: List[str] = []
            for o in raw_opts:
                s = str(o).strip()
                if s:
                    opts.append(s)

            if not q or len(opts) < 2:
                continue

            questions.append({
                "text": q,
                "options": opts
            })

        if not questions:
            raise HTTPException(
                status_code=400,
                detail="Сұрақ табылмады. Құжатта нөмірден басталатын жолдар (мысалы, '1.' немесе '1)') "
                       "және төменде 'a) ...' түріндегі нұсқалар барын тексеріңіз."
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
# Bulk сақтау: тек «Сақтау» басылғанда ғана
# ───────────────────────────────────────────────────────────
@app.post("/api/topics/{topic_id}/quizzes/bulk")
def save_quizzes_bulk(topic_id: int, payload: BulkSaveRequest, db: Session = Depends(get_db)):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Тақырып табылмады")

    created_ids: List[int] = []

    for item in payload.quizzes:
        question = (item.question or "").strip()

        # options-ты циклмен тазалау
        options: List[str] = []
        raw = item.options or []
        for o in raw:
            s = (o or "").strip()
            if s:
                options.append(s)

        if not question or len(options) < 2:
            # нашар блок — өткізіп жібереміз (UI-де алдын-ақ сүзілуі тиіс)
            continue

        # Егер answer_index берілсе — сол арқылы дұрыс жауапты аламыз
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
        db.flush()   # id алу үшін
        created_ids.append(q.id)

    db.commit()
    return {"message": f"{len(created_ids)} сұрақ сақталды ✅", "ids": created_ids}

# ───────────────────────────────────────────────────────────
# Пайдалы модель: бірнеше тақырыптан емтихан үшін квиздер жиыны
# ───────────────────────────────────────────────────────────
class QuizByTopicsRequest(BaseModel):
    topic_ids: List[int]
    shuffle: bool = True
    limit: Optional[int] = None

@app.post("/api/topics/{topic_id}/exam")
def get_quizzes_by_topics(payload: QuizByTopicsRequest, db: Session = Depends(get_db)):
    if not payload.topic_ids:
        raise HTTPException(status_code=400, detail="Тақырып таңдалмады")

    # Барлық таңдалған тақырыптардан сұрақтарды аламыз
    quizzes = (
        db.query(Quiz)
        .filter(Quiz.topic_id.in_(payload.topic_ids))
        .all()
    )

    if not quizzes:
        raise HTTPException(status_code=404, detail="Таңдалған тақырыптарда quiz табылмады")

    # Shuffle
    if payload.shuffle:
        random.shuffle(quizzes)

    # Limit қолдану
    if payload.limit:
        quizzes = quizzes[: payload.limit]

    # options: JSON → List[str]
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

        result.append(
            {
                "id": q.id,
                "question": q.question,
                "options": opts,
            }
        )

    return {"count": len(result), "quizzes": result}


# ================== AUTH ENDPOINTS ==================
@app.post("/api/register")
def api_register(payload: RegisterIn, db: Session = Depends(get_db)):
    return register_user(payload, db)

@app.post("/api/verify")
def api_verify(payload: VerifyIn, db: Session = Depends(get_db)):
    return verify_user(payload, db)

@app.post("/api/login")
def api_login(payload: LoginIn, request: Request, db: Session = Depends(get_db)):
    # Қолданушыны тексереміз
    user = db.query(User).filter(User.username == payload.username).first()
    if not user:
        raise HTTPException(status_code=401, detail="Қолданушы табылмады")

    from auth import verify_pw
    if not verify_pw(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Құпия сөз қате")

    # Токендер жасау
    access_token = create_token({"sub": user.email})
    refresh_token = create_token({"sub": user.email, "type": "refresh"}, minutes=60*24*30)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email, "username": user.username}
    }

@app.post("/api/resend-code")
def api_resend_code(payload: ResendIn, db: Session = Depends(get_db)):
    return resend_verification_code(payload, db)

# ================== PROFILE ENDPOINTS ==================
@app.get("/api/me")
def get_profile_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.username,
        "name": getattr(current_user, "name", None),
        "bio": getattr(current_user, "bio", None),
        "avatar_url": getattr(current_user, "avatar_url", None)
    }

class ProfileUpdate(BaseModel):
    name: str | None = None
    bio: str | None = None
    avatar_url: str | None = None

@app.put("/api/profile")
def update_profile(data: ProfileUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
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
        await iquiz_manager.join_room(room.id, req.host_name, req.host_avatar)
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

