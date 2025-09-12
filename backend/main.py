# main.py — FastAPI entry (DOCX → Quiz парсинг, алдын-ала қарау, bulk сақтаумен)
# Жаңа нұсқа: alghoritm.pipeline.process_docx пайдаланады

from __future__ import annotations
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.orm import Session

import os
import re
import json
import shutil
import tempfile
from uuid import uuid4
from typing import Optional, List

# ───────────────────────────────────────────────────────────
# DB (жобаңдағы бар қабатты қолданамыз — өзгеріссіз)
# ───────────────────────────────────────────────────────────
from database import SessionLocal  # Base/engine қажет болса, осында қалдыра бер
from models import Subject, Topic, Quiz

# ───────────────────────────────────────────────────────────
# Біздің гибрид парсер
# ───────────────────────────────────────────────────────────
from alghoritm.pipeline import process_docx  # ← Басты өзгеріс: тек осы қажет

# ───────────────────────────────────────────────────────────
# FastAPI және CORS
# ───────────────────────────────────────────────────────────
app = FastAPI()

origins = [
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
# Көмекші: DB session, slug нормализация
# ───────────────────────────────────────────────────────────
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

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
# Quiz: бір-бірлеп қосу (қалдырдық, қолмен енгізу үшін ыңғайлы)
# ───────────────────────────────────────────────────────────
@app.post("/api/topics/{topic_id}/quizzes")
def add_quiz(topic_id: int, quiz: QuizCreate, db: Session = Depends(get_db)):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Тақырып табылмады")

    new_quiz = Quiz(
        question=quiz.question.strip(),
        options=json.dumps([o.strip() for o in (quiz.options or [])], ensure_ascii=False),
        correct_answer=(quiz.correct_answer or "").strip() if quiz.correct_answer else None,
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
    return [
        {
            "id": q.id,
            "question": q.question,
            "options": json.loads(q.options) if q.options else [],
            # correct_answer әдейі жіберілмейді
        }
        for q in quizzes
    ]

@app.post("/api/quizzes/{quiz_id}/check")
def check_answer(quiz_id: int, answer: AnswerCheck, db: Session = Depends(get_db)):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Сұрақ табылмады")
    is_correct = (quiz.correct_answer or "") == (answer.selected_answer or "")
    return {"correct": is_correct, "correct_answer": quiz.correct_answer}

# ───────────────────────────────────────────────────────────
# DOCX → Quiz парсинг (алдын-ала қарау үшін)
# ───────────────────────────────────────────────────────────
@app.post("/api/parse-docx")
async def parse_docx_endpoint(file: UploadFile = File(...), debug: bool = False):
    """
    DOCX қабылдайды → гибрид парсинг → алдын-ала қарауға арналған тізім.
    Қайтарады: {"quizzes": [{question, options, answer_index?}, ...]}
    """
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext != ".docx":
        raise HTTPException(status_code=400, detail="Тек .docx файл қабылданады.")

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".docx") as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        blocks = process_docx(tmp_path, debug=debug)  # ← біздің pipeline

        # UI-ға жеңіл формат
        quizzes = []
        for b in (blocks or []):
            q = (b.get("question") or "").strip()
            opts = [str(o).strip() for o in (b.get("options") or []) if str(o).strip()]
            if not q or len(opts) < 2:
                continue
            quizzes.append({
                "question": q,
                "options": opts,
                "answer_index": b.get("answer_index"),  # бар болса — алдын-ала толады
                "source": (b.get("meta") or {}).get("source"),
            })

        if not quizzes:
            raise HTTPException(status_code=400, detail="Сұрақ табылмады. Құжат форматын тексеріңіз.")

        return {"quizzes": quizzes}

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
        question = item.question.strip()
        options = [o.strip() for o in (item.options or []) if o and o.strip()]
        if not question or len(options) < 2:
            # нашар блок — өткізіп жібереміз (UI-де алдын-ақ сүзілуі керек)
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
