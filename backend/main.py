from __future__ import annotations

import os
import re
import json
import shutil
import tempfile
from typing import Optional, List, Any, Dict
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from jose import jwt, JWTError
from docx2python import docx2python

from database import supabase
from auth import (
    register_user,
    verify_user,
    resend_verification_code,
    login_user,
)
from schemas import (
    RegisterIn,
    VerifyIn,
    LoginIn,
    ResendIn,
    SubjectCreate,
    TopicCreate,
    QuizCreate,
)
from errors import map_error

# Опционалды ескі парсер (болса қолданамыз, болмаса елемейміз)
try:
    from quiz_parser import process_docx as legacy_process_docx
except ImportError:
    legacy_process_docx = None


# ───────────────────────────────────────────────────────────
# CONFIG & AUTH HELPERS
# ───────────────────────────────────────────────────────────

SECRET_KEY = os.getenv("EASY_SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("EASY_SECRET_KEY environment variable is not set")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("EASY_ACCESS_EXPIRE_MIN", "1440"))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")


def create_token(data: dict, minutes: int = ACCESS_TOKEN_EXPIRE_MINUTES) -> str:
    """JWT токен жасау."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def supabase_exec(query, ctx: str):
    """
    Барлық Supabase сұраныстарын орындайтын көмекші.
    query.execute() шақырып, data / error өңдейді.
    Еш жерде .insert().select() сияқты Python-ға тән емес тізбектер жоқ.
    """
    try:
        res = query.execute()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Supabase error ({ctx}): {e}",
        )

    data = getattr(res, "data", None)
    error = getattr(res, "error", None)

    if error:
        msg = getattr(error, "message", str(error))
        raise HTTPException(
            status_code=500,
            detail=f"Supabase error ({ctx}): {msg}",
        )

    if data is None and isinstance(res, dict):
        data = res.get("data")

    return data or []


def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """
    JWT ішіндегі sub → users.id.
    users: id, email, username, hashed_password, is_verified, created_at, credit_balance
    """
    credentials_exception = HTTPException(
        status_code=401,
        detail="Токен жарамсыз немесе ескірген.",
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            raise credentials_exception
        user_id = int(sub)
    except (JWTError, ValueError):
        raise credentials_exception

    rows = supabase_exec(
        supabase.table("users")
        .select("id,email,username,is_verified,created_at,credit_balance")
        .eq("id", user_id)
        .limit(1),
        ctx="get_current_user",
    )

    if not rows:
        raise HTTPException(status_code=404, detail="Қолданушы табылмады.")

    return rows[0]


# ───────────────────────────────────────────────────────────
# APP & CORS
# ───────────────────────────────────────────────────────────

app = FastAPI(title="Easy API (Supabase)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        # продта өз домен(дер)іңді осында қоса саласың
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ───────────────────────────────────────────────────────────
# LOCAL SCHEMAS
# ───────────────────────────────────────────────────────────

class ParsedBlock(BaseModel):
    question: str
    options: List[str]
    answer_index: Optional[int] = None


class BulkSaveRequest(BaseModel):
    quizzes: List[ParsedBlock]


class AnswerCheck(BaseModel):
    selected_answer: str


class ProfileUpdate(BaseModel):
    # users кестесінде бар жалғыз өзгеретін өріс
    username: Optional[str] = None

class FeedbackCreate(BaseModel):
    text: str = Field(..., min_length=3, max_length=2000)
    page: Optional[str] = None
    rating: Optional[int] = Field(None, ge=1, le=5)

# ───────────────────────────────────────────────────────────
# DOCX PARSER HELPERS
# ───────────────────────────────────────────────────────────

QUESTION_LINE_RE = re.compile(r"^\s*(\d+)\)\s*(.+)$")
OPTION_LINE_RE = re.compile(r"^\s*([A-D])\)\s*(.+)$")
ANSWER_PAIR_RE = re.compile(r"(\d{1,3})\)\s*([A-D])", re.I)
ANSWER_LINE_RE = re.compile(r"^\s*(\d{1,3})\)\s*([A-D])\s*$")


def _extract_lines_from_body(doc) -> List[str]:
    lines: List[str] = []
    for first in doc.body:
        for second in first:
            for third in second:
                for cell in third:
                    if cell is None:
                        continue
                    text = str(cell)
                    parts = re.split(r"[\n\r\t]+", text)
                    for p in parts:
                        s = p.strip()
                        if s:
                            lines.append(s)
    return lines


def _detect_answer_start_index(lines: List[str]) -> int:
    n = len(lines)

    # Бір жолда бірнеше "1)A 2)B" бар болса
    for i, line in enumerate(lines):
        if len(ANSWER_PAIR_RE.findall(line)) >= 2:
            return i

    # Қатарынан бірнеше "1)A" т.с.с.
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

    return n  # жауаптар блогы табылмаса


def _parse_questions_from_lines(lines: List[str], end: int) -> List[Dict[str, Any]]:
    questions: List[Dict[str, Any]] = []
    current: Optional[Dict[str, Any]] = None

    for line in lines[:end]:
        mq = QUESTION_LINE_RE.match(line)
        mo = OPTION_LINE_RE.match(line)

        if mq:
            num = int(mq.group(1))
            rest = mq.group(2).strip()

            # "1) A" сияқты шумды өткізіп жібереміз
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
            if current["options"]:
                current["options"][-1] += " " + extra
            else:
                current["question"] += " " + extra

    if current:
        questions.append(current)

    cleaned: List[Dict[str, Any]] = []
    for q in questions:
        opts = [o for o in q["options"] if o.strip()]
        if q["question"] and len(opts) >= 2:
            q["options"] = opts
            cleaned.append(q)

    return cleaned


def _parse_answers_from_lines(lines: List[str], start: int, max_q: int) -> Dict[int, str]:
    answers: Dict[int, str] = {}
    for line in lines[start:]:
        for num_str, letter in ANSWER_PAIR_RE.findall(line):
            num = int(num_str)
            if 1 <= num <= max_q:
                answers[num] = letter.upper()
    return answers


def parse_docx_with_answers(path: str, debug: bool = False) -> List[Dict[str, Any]]:
    doc = docx2python(path)
    lines = _extract_lines_from_body(doc)

    ans_start = _detect_answer_start_index(lines)
    questions = _parse_questions_from_lines(lines, ans_start)

    if not questions:
        if debug:
            print("[parse_docx_with_answers] No questions parsed.")
        return []

    max_q = max(q["number"] for q in questions)
    answers = (
        _parse_answers_from_lines(lines, ans_start, max_q)
        if ans_start < len(lines)
        else {}
    )

    out: List[Dict[str, Any]] = []
    for q in questions:
        letter = answers.get(q["number"])
        answer_index = None
        if letter:
            for i, opt in enumerate(q["options"]):
                if opt.lstrip().upper().startswith(f"{letter})"):
                    answer_index = i
                    break

        out.append(
            {
                "question": q["question"],
                "options": q["options"],
                "answer_index": answer_index,
            }
        )

    return out


# ───────────────────────────────────────────────────────────
# BASIC / HEALTH
# ───────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "app": "Easy", "version": "1.0.0"}


# ───────────────────────────────────────────────────────────
# AUTH ENDPOINTS
# ───────────────────────────────────────────────────────────

@app.post("/api/register")
def api_register(payload: RegisterIn):
    res = register_user(payload)

    # Жаңа қолданушыға 3 кредит берілгенін логқа жазамыз (balance өзі default=3)
    try:
        user_id: Optional[int] = None

        if isinstance(res, dict):
            # login_user сияқты, register_user да "user" кілтімен немесе өзі user болуы мүмкін
            user_obj = res.get("user") if "user" in res else res
            if isinstance(user_obj, dict) and "id" in user_obj:
                user_id = int(user_obj["id"])

        if user_id is not None:
            add_credit_log(user_id, amount=3, reason=CreditReason.REGISTRATION)
    except Exception:
        # Лог жазуда қате болса да, тіркелу сәтті болуы керек
        pass

    return res



@app.post("/api/verify")
def api_verify(payload: VerifyIn):
    return verify_user(payload)


@app.post("/api/resend-code")
def api_resend_code(payload: ResendIn):
    return resend_verification_code(payload)


@app.post("/api/login")
def api_login(payload: LoginIn):
    """
    login_user Supabase-та тексеріп,
    осында Easy JWT шығарамыз.
    """
    res = login_user(payload)
    user = res["user"]

    access_token = create_token({"sub": str(user["id"])})
    refresh_token = create_token(
        {"sub": str(user["id"]), "type": "refresh"},
        minutes=60 * 24 * 30,
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user,
    }


@app.get("/api/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return current_user


@app.put("/api/profile")
def update_profile(
    data: ProfileUpdate,
    current_user: dict = Depends(get_current_user),
):
    updates: Dict[str, Any] = {}

    if data.username is not None:
        username = data.username.strip()
        if username:
            updates["username"] = username

    if not updates:
        return current_user

    rows = supabase_exec(
        supabase.table("users")
        .update(updates)
        .eq("id", current_user["id"]),
        ctx="update_profile",
    )

    return rows[0] if rows else {**current_user, **updates}


# ───────────────────────────────────────────────────────────
# SUBJECTS
# subjects(id, user_id, name, created_at)
# ───────────────────────────────────────────────────────────

@app.get("/api/subjects")
def list_subjects(current_user: dict = Depends(get_current_user)):
    rows = supabase_exec(
        supabase.table("subjects")
        .select("id,name,created_at")
        .eq("user_id", current_user["id"])
        .order("created_at", desc=False)
        .order("id", desc=False),
        ctx="list_subjects",
    )
    return rows


@app.post("/api/subjects")
def create_subject(
    payload: SubjectCreate,
    current_user: dict = Depends(get_current_user),
):
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Пән атауы бос болмауы керек.")

    existing = supabase_exec(
        supabase.table("subjects")
        .select("id")
        .eq("user_id", current_user["id"])
        .eq("name", name),
        ctx="check_subject_exists",
    )
    if existing:
        raise HTTPException(status_code=400, detail="Бұл пән сізде бұрыннан бар.")

    # insert → execute (supabase-py default returning='representation')
    rows = supabase_exec(
        supabase.table("subjects")
        .insert({"name": name, "user_id": current_user["id"]}),
        ctx="insert_subject",
    )

    # Егер жоба returning=minimal болса — fallback: қайта оқимыз
    if not rows:
        rows = supabase_exec(
            supabase.table("subjects")
            .select("id,name,created_at")
            .eq("user_id", current_user["id"])
            .eq("name", name)
            .order("id", desc=True)
            .limit(1),
            ctx="select_subject_after_insert",
        )

    if not rows:
        raise HTTPException(status_code=500, detail="Пән қосу сәтсіз аяқталды.")

    return rows[0]


@app.delete("/api/subjects/{subject_id}")
def delete_subject(
    subject_id: int,
    current_user: dict = Depends(get_current_user),
):
    exists = supabase_exec(
        supabase.table("subjects")
        .select("id")
        .eq("id", subject_id)
        .eq("user_id", current_user["id"])
        .limit(1),
        ctx="check_subject_owner",
    )
    if not exists:
        raise HTTPException(
            status_code=404,
            detail="Пән табылмады немесе сізге тиесілі емес.",
        )

    supabase_exec(
        supabase.table("subjects")
        .delete()
        .eq("id", subject_id)
        .eq("user_id", current_user["id"]),
        ctx="delete_subject",
    )

    return {"deleted": True}


# ───────────────────────────────────────────────────────────
# TOPICS
# topics(id, name, subject_id, user_id, created_at, attempt_count)
# ───────────────────────────────────────────────────────────

@app.get("/api/subjects/{subject_id}/topics")
def list_topics(
    subject_id: int,
    current_user: dict = Depends(get_current_user),
):
    # Пән user-ге тиесілі ме?
    subject = supabase_exec(
        supabase.table("subjects")
        .select("id")
        .eq("id", subject_id)
        .eq("user_id", current_user["id"])
        .limit(1),
        ctx="check_subject_owner(list_topics)",
    )
    if not subject:
        raise HTTPException(
            status_code=404,
            detail="Пән табылмады немесе сізге тиесілі емес.",
        )

    topics = supabase_exec(
        supabase.table("topics")
        .select("id,name,attempt_count,created_at")
        .eq("subject_id", subject_id)
        .eq("user_id", current_user["id"])
        .order("created_at", desc=False)
        .order("id", desc=False),
        ctx="list_topics",
    )
    return topics


@app.post("/api/subjects/{subject_id}/topics")
def create_topic(
    subject_id: int,
    payload: TopicCreate,
    current_user: dict = Depends(get_current_user),
):
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Тақырып атауы бос болмауы керек.")

    subject = supabase_exec(
        supabase.table("subjects")
        .select("id")
        .eq("id", subject_id)
        .eq("user_id", current_user["id"])
        .limit(1),
        ctx="check_subject_owner(create_topic)",
    )
    if not subject:
        raise HTTPException(
            status_code=404,
            detail="Пән табылмады немесе сізге тиесілі емес.",
        )

    existing = supabase_exec(
        supabase.table("topics")
        .select("id")
        .eq("subject_id", subject_id)
        .eq("user_id", current_user["id"])
        .eq("name", name),
        ctx="check_topic_exists",
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Бұл тақырып осы пәнде бұрын қосылған.",
        )

    rows = supabase_exec(
        supabase.table("topics").insert(
            {
                "name": name,
                "subject_id": subject_id,
                "user_id": current_user["id"],
                "attempt_count": 0,
            }
        ),
        ctx="insert_topic",
    )

    if not rows:
        rows = supabase_exec(
            supabase.table("topics")
            .select("id,name,attempt_count,created_at")
            .eq("subject_id", subject_id)
            .eq("user_id", current_user["id"])
            .eq("name", name)
            .order("id", desc=True)
            .limit(1),
            ctx="select_topic_after_insert",
        )

    if not rows:
        raise HTTPException(status_code=500, detail="Тақырып қосу сәтсіз аяқталды.")

    return rows[0]


@app.delete("/api/topics/{topic_id}")
def delete_topic(
    topic_id: int,
    current_user: dict = Depends(get_current_user),
):
    exists = supabase_exec(
        supabase.table("topics")
        .select("id")
        .eq("id", topic_id)
        .eq("user_id", current_user["id"])
        .limit(1),
        ctx="check_topic_owner(delete_topic)",
    )
    if not exists:
        raise HTTPException(
            status_code=404,
            detail="Тақырып табылмады немесе сізге тиесілі емес.",
        )

    supabase_exec(
        supabase.table("topics")
        .delete()
        .eq("id", topic_id)
        .eq("user_id", current_user["id"]),
        ctx="delete_topic",
    )

    return {"deleted": True}


# ───────────────────────────────────────────────────────────
# QUIZZES
# quizzes(id,question,options,correct_answer,topic_id,user_id,created_at,is_active)
# ───────────────────────────────────────────────────────────

@app.get("/api/topics/{topic_id}/quizzes")
def list_quizzes(
    topic_id: int,
    current_user: dict = Depends(get_current_user),
):
    topic = supabase_exec(
        supabase.table("topics")
        .select("id")
        .eq("id", topic_id)
        .eq("user_id", current_user["id"])
        .limit(1),
        ctx="check_topic_owner(list_quizzes)",
    )
    if not topic:
        raise HTTPException(
            status_code=404,
            detail="Тақырып табылмады немесе сізге тиесілі емес.",
        )

    rows = supabase_exec(
        supabase.table("quizzes")
        .select("id,question,options,correct_answer,created_at,is_active")
        .eq("topic_id", topic_id)
        .eq("user_id", current_user["id"])
        .order("created_at", desc=False)
        .order("id", desc=False),
        ctx="list_quizzes",
    )

    result: List[dict] = []
    for q in rows:
        opts = q.get("options") or []
        if isinstance(opts, str):
            try:
                parsed = json.loads(opts)
                if isinstance(parsed, list):
                    opts = parsed
                else:
                    opts = [str(parsed)]
            except Exception:
                opts = [x.strip() for x in opts.split(";") if x.strip()]
        result.append(
            {
                "id": q["id"],
                "question": q["question"],
                "options": opts,
                "correct_answer": q.get("correct_answer"),
                "created_at": q.get("created_at"),
                "is_active": q.get("is_active", True),
            }
        )

    return result


@app.post("/api/topics/{topic_id}/quizzes")
def add_quiz(
    topic_id: int,
    quiz: QuizCreate,
    current_user: dict = Depends(get_current_user),
):
    topic = supabase_exec(
        supabase.table("topics")
        .select("id")
        .eq("id", topic_id)
        .eq("user_id", current_user["id"])
        .limit(1),
        ctx="check_topic_owner(add_quiz)",
    )
    if not topic:
        raise HTTPException(
            status_code=404,
            detail="Тақырып табылмады немесе сізге тиесілі емес.",
        )

    question = (quiz.question or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="Сұрақ бос болмауы керек.")

    options = [
        (o or "").strip()
        for o in (quiz.options or [])
        if (o or "").strip()
    ]
    if len(options) < 2:
        raise HTTPException(
            status_code=400,
            detail="Кем дегенде 2 жауап нұсқасы болуы керек.",
        )

    correct = (quiz.correct_answer or "").strip() if quiz.correct_answer else None
    if correct and correct not in options:
        raise HTTPException(
            status_code=400,
            detail="Дұрыс жауап нұсқалар тізімінде болуы керек.",
        )

    row = {
        "question": question,
        "options": options,
        "correct_answer": correct,
        "topic_id": topic_id,
        "user_id": current_user["id"],
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    rows = supabase_exec(
        supabase.table("quizzes").insert(row),
        ctx="insert_quiz",
    )

    if not rows:
        # returning=minimal болса, жуырдағы дәл осы сұрақты қайта оқимыз
        rows = supabase_exec(
            supabase.table("quizzes")
            .select("id,question,options,correct_answer,topic_id,user_id,created_at,is_active")
            .eq("topic_id", topic_id)
            .eq("user_id", current_user["id"])
            .eq("question", question)
            .order("id", desc=True)
            .limit(1),
            ctx="select_quiz_after_insert",
        )

    if not rows:
        raise HTTPException(status_code=500, detail="Quiz қосу сәтсіз аяқталды.")

    q = rows[0]
    opts = q.get("options") or []
    if isinstance(opts, str):
        try:
            parsed = json.loads(opts)
            if isinstance(parsed, list):
                opts = parsed
            else:
                opts = [str(parsed)]
        except Exception:
            opts = [x.strip() for x in opts.split(";") if x.strip()]
    q["options"] = opts

    return q


@app.post("/api/quizzes/{quiz_id}/check")
def check_answer(
    quiz_id: int,
    payload: AnswerCheck,
    current_user: dict = Depends(get_current_user),
):
    rows = supabase_exec(
        supabase.table("quizzes")
        .select("id,correct_answer,user_id")
        .eq("id", quiz_id)
        .limit(1),
        ctx="get_quiz_for_check",
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Сұрақ табылмады.")

    quiz = rows[0]

    if quiz.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Бұл сұрақ сізге тиесілі емес.")

    correct_answer = (quiz.get("correct_answer") or "").strip()
    selected = (payload.selected_answer or "").strip()
    is_correct = bool(correct_answer) and (correct_answer == selected)

    return {
        "correct": is_correct,
        "correct_answer": correct_answer or None,
    }


# ───────────────────────────────────────────────────────────
# DOCX → QUIZ PREVIEW
# ───────────────────────────────────────────────────────────

@app.post("/api/parse-docx")
async def parse_docx_endpoint(
    file: UploadFile = File(...),
    debug: bool = False,
    current_user: dict = Depends(get_current_user),
):
    """
    .docx файлын оқып, frontend-ке алдын ала қарау үшін сұрақтарды қайтарады.
    DOCX-парсерді сәтті қолдану әр жолы 1 кредит жұмсайды.
    """
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext != ".docx":
        raise HTTPException(status_code=400, detail="Тек .docx файл қабылданады.")

    # Алдымен кредит жеткілікті ме, соны тексереміз
    require_credits(current_user["id"], 1)

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".docx") as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        blocks = parse_docx_with_answers(tmp_path, debug=debug)

        if (not blocks) and legacy_process_docx:
            try:
                legacy = legacy_process_docx(tmp_path, debug=debug)
            except TypeError:
                legacy = legacy_process_docx(tmp_path)
            blocks = [
                {
                    "question": (b.get("question") or "").strip(),
                    "options": b.get("options") or [],
                    "answer_index": b.get("answer_index"),
                }
                for b in (legacy or [])
            ]

        questions: List[dict] = []
        for b in (blocks or []):
            q_text = (b.get("question") or b.get("text") or "").strip()
            raw_opts = b.get("options") or []
            opts = [str(o).strip() for o in raw_opts if str(o).strip()]

            if not q_text or len(opts) < 2:
                continue

            item: Dict[str, Any] = {"text": q_text, "options": opts}
            ai = b.get("answer_index")
            if isinstance(ai, int) and 0 <= ai < len(opts):
                item["answer_index"] = ai

            questions.append(item)

        if not questions:
            raise HTTPException(
                status_code=400,
                detail="Сұрақ табылмады. DOCX форматты тексер.",
            )

        # Сәтті парс жасалғаннан кейін ғана 1 кредит шегереміз
        new_balance = change_credit_balance(
            current_user["id"],
            delta=-1,
            reason=CreditReason.DOCX_PARSE,
            meta={"filename": file.filename, "questions": len(questions)},
        )

        return {"questions": questions, "credit_balance": new_balance}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Құжатты оқу мүмкін болмады: {e}",
        )
    finally:
        try:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)
        except Exception:
            pass

# ───────────────────────────────────────────────────────────
# DOCX/BULK → QUIZZES SAVE
# ───────────────────────────────────────────────────────────

@app.post("/api/topics/{topic_id}/quizzes/bulk")
def save_quizzes_bulk(
    topic_id: int,
    payload: BulkSaveRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    DOCX-тен алынған бірнеше сұрақты бірден берілген topic-ке сақтау.
    """
    topic = supabase_exec(
        supabase.table("topics")
        .select("id")
        .eq("id", topic_id)
        .eq("user_id", current_user["id"])
        .limit(1),
        ctx="check_topic_owner(bulk)",
    )
    if not topic:
        raise HTTPException(
            status_code=404,
            detail="Тақырып табылмады немесе сізге тиесілі емес.",
        )

    if not payload.quizzes:
        raise HTTPException(status_code=400, detail="Сақтайтын сұрақтар тізімі бос.")

    rows_to_insert: List[dict] = []

    for item in payload.quizzes:
        question = (item.question or "").strip()
        options = [
            (o or "").strip()
            for o in (item.options or [])
            if (o or "").strip()
        ]
        if not question or len(options) < 2:
            continue

        correct_answer: Optional[str] = None
        if (
            item.answer_index is not None
            and isinstance(item.answer_index, int)
            and 0 <= item.answer_index < len(options)
        ):
            correct_answer = options[item.answer_index]

        rows_to_insert.append(
            {
                "question": question,
                "options": options,
                "correct_answer": correct_answer,
                "topic_id": topic_id,
                "user_id": current_user["id"],
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )

    if not rows_to_insert:
        raise HTTPException(
            status_code=400,
            detail="Жарамды сұрақ табылмады.",
        )

    rows = supabase_exec(
        supabase.table("quizzes").insert(rows_to_insert),
        ctx="bulk_insert_quizzes",
    )

    # Егер returning=minimal болса — жуырда қосылғандарды оқып аламыз
    if not rows:
        rows = supabase_exec(
            supabase.table("quizzes")
            .select("id,question,options,correct_answer,topic_id,user_id,created_at,is_active")
            .eq("topic_id", topic_id)
            .eq("user_id", current_user["id"])
            .order("id", desc=True)
            .limit(len(rows_to_insert)),
            ctx="select_bulk_quizzes_after_insert",
        )

    cleaned: List[dict] = []
    ids: List[int] = []

    for q in rows or []:
        opts = q.get("options") or []
        if isinstance(opts, str):
            try:
                parsed = json.loads(opts)
                if isinstance(parsed, list):
                    opts = parsed
                else:
                    opts = [str(parsed)]
            except Exception:
                opts = [x.strip() for x in opts.split(";") if x.strip()]
        q["options"] = opts
        cleaned.append(q)
        if "id" in q:
            ids.append(q["id"])

    return {
        "count": len(rows_to_insert),
        "ids": ids,
        "quizzes": cleaned,
    }

# =================================================
# FeedBack
# =================================================

@app.post("/api/feedback")
def add_feedback(
    payload: FeedbackCreate,
    current_user: dict = Depends(get_current_user),
):
    """Қолданушының пікірін сақтау."""
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Пікір мәтіні бос болмауы керек.")

    row = {
        "user_id": current_user["id"],
        "text": text,
        "page": payload.page or None,
        "rating": payload.rating or None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    rows = supabase_exec(
        supabase.table("feedback").insert(row),
        ctx="insert_feedback",
    )

    if not rows:
        # returning=minimal болса, соңғы feedback-ті оқимыз
        rows = supabase_exec(
            supabase.table("feedback")
            .select("id,user_id,text,page,rating,created_at")
            .eq("user_id", current_user["id"])
            .order("id", desc=True)
            .limit(1),
            ctx="select_feedback_after_insert",
        )

    if not rows:
        raise HTTPException(status_code=500, detail="Пікір сақтау сәтсіз аяқталды.")

    feedback_row = rows[0]

    # Пікір қалдырғаны үшін 1 кредит сыйлыққа береміз
    try:
        new_balance = change_credit_balance(
            current_user["id"],
            delta=1,
            reason=CreditReason.FEEDBACK,
            meta={"page": payload.page, "rating": payload.rating},
        )
        feedback_row["credit_balance"] = new_balance
    except Exception:
        # Егер кредит логикасында қате болса да, пікір сәтті сақталды
        pass

    return feedback_row


@app.get("/api/feedback")
def list_feedback(current_user: dict = Depends(get_current_user)):
    """Тек осы қолданушы қалдырған пікірлер тізімін қайтарады."""
    rows = supabase_exec(
        supabase.table("feedback")
        .select("id,text,page,rating,created_at")
        .eq("user_id", current_user["id"])
        .order("created_at", desc=True)
        .order("id", desc=True),
        ctx="list_feedback",
    )
    return rows

# ───────────────────────────────────────────────────────────
# CREDITS API
# ───────────────────────────────────────────────────────────

class CreditReason:
    REGISTRATION = "registration"
    DOCX_PARSE = "docx_parse"
    FEEDBACK = "feedback"
    PURCHASE = "purchase"


def get_credit_balance(user_id: int) -> int:
    """users.credit_balance өрісін қауіпсіз оқу."""
    rows = supabase_exec(
        supabase.table("users")
        .select("credit_balance")
        .eq("id", user_id)
        .limit(1),
        ctx="get_credit_balance",
    )
    if not rows:
        return 0
    value = rows[0].get("credit_balance")
    try:
        return int(value) if value is not None else 0
    except (TypeError, ValueError):
        return 0


def add_credit_log(
    user_id: int,
    amount: int,
    reason: str,
    meta: Optional[Dict[str, Any]] = None,
) -> None:
    """Кредит өзгерістерінің журналын credit_logs кестесіне жазу."""
    payload = {
        "user_id": user_id,
        "amount": amount,
        "reason": reason,
        "meta": meta or None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    # Журналдағы қате негізгі логиканы тоқтатпауы үшін soft-fail логикасы:
    try:
        supabase_exec(
            supabase.table("credit_logs").insert(payload),
            ctx="add_credit_log",
        )
    except HTTPException:
        # лог жазылмаса да, негізгі операция жалғасады
        pass


def change_credit_balance(
    user_id: int,
    delta: int,
    reason: str,
    meta: Optional[Dict[str, Any]] = None,
) -> int:
    """Кредит балансын delta-ға өзгертіп, журналға жазу."""
    current = get_credit_balance(user_id)
    new_balance = current + delta
    if new_balance < 0:
        raise HTTPException(
            status_code=403,
            detail="Кредит жеткіліксіз.",
        )

    supabase_exec(
        supabase.table("users")
        .update({"credit_balance": new_balance})
        .eq("id", user_id),
        ctx="change_credit_balance",
    )

    add_credit_log(user_id, delta, reason, meta)
    return new_balance


def require_credits(user_id: int, amount: int = 1) -> None:
    """Егер кредит жеткіліксіз болса, 403 қатесін тастайды."""
    if amount <= 0:
        return
    current = get_credit_balance(user_id)
    if current < amount:
        raise HTTPException(
            status_code=403,
            detail="Кредит жеткіліксіз. DOCX-парсерді қолдану үшін кредит сатып алу керек.",
        )


def add_purchase_credits(user_id: int, amount: int, source: str = CreditReason.PURCHASE) -> int:
    """Болашақ Kaspi/Stripe төлемдері осы функцияны қолдана алады."""
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Кредит саны 0-ден үлкен болуы керек.")
    return change_credit_balance(user_id, amount, source)

@app.get("/api/credits")
def get_credits(current_user: dict = Depends(get_current_user)):
    """
    Ағымдағы кредит балансын, қысқаша summary-н және соңғы логтарды қайтарады.
    """
    user_id = current_user["id"]
    balance = get_credit_balance(user_id)

    rows = supabase_exec(
        supabase.table("credit_logs")
        .select("id,amount,reason,meta,created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .order("id", desc=True)
        .limit(200),
        ctx="list_credit_logs",
    )

    summary: Dict[str, int] = {}
    total_earned = 0
    total_spent = 0

    for row in rows or []:
        amount = int(row.get("amount") or 0)
        reason = row.get("reason") or "unknown"
        summary[reason] = summary.get(reason, 0) + amount
        if amount > 0:
            total_earned += amount
        elif amount < 0:
            total_spent += amount

    return {
        "balance": balance,
        "summary": summary,        # мысалы: {"registration": 3, "feedback": 2, "docx_parse": -4}
        "total_earned": total_earned,
        "total_spent": total_spent,
        "logs": rows,              # соңғы 200 жазба
    }


# ───────────────────────────────────────────────────────────
# GLOBAL ERROR HANDLER (қазақша аударма)
# ───────────────────────────────────────────────────────────

@app.middleware("http")
async def global_error_mapper(request, call_next):
    try:
        return await call_next(request)

    except HTTPException as e:
        # Егер detail — жүйелік қате, оны қазақшаға аударамыз
        detail = e.detail
        if isinstance(detail, str):
            translated = map_error(detail)
        else:
            translated = "Күтпеген қате пайда болды."

        return JSONResponse(
            status_code=e.status_code,
            content={"detail": translated}
        )

    except Exception as e:
        # Кез келген күтпеген қате → қазақша стандарт хабар
        translated = map_error(str(e))
        return JSONResponse(
            status_code=500,
            content={"detail": translated}
        )
