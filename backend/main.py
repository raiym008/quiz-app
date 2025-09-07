from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from database import Base, engine, SessionLocal
from pydantic import BaseModel
from sqlalchemy.orm import Session, sessionmaker
from models import Subject, Topic, Quiz
from sqlalchemy import func
import re
from typing import List
import json
from fastapi.staticfiles import StaticFiles
import os, shutil
from uuid import uuid4


class SubjectCreate(BaseModel):
    name: str


app = FastAPI()


from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()


# Тек React (Vite) адресіне рұқсат
origins = [
    "http://localhost:5173",   # Vite dev server
    # Қаласаң кейін production үшін:
    # "https://senin-site.kz"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,      # тек осы адрестерге рұқсат
    allow_credentials=True,
    allow_methods=["*"],        # GET, POST, DELETE бәріне рұқсат
    allow_headers=["*"],        # барлық header рұқсат
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# =================================
# Routes

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
    return {"message": "Пән өшірілді"}


def normalize_key(s: str) -> str:
    # Бірдей ережемен нормализация: trim → casefold (Unicode үшін) → бос орындар/дефистерді бір "-" қылу
    return re.sub(r'[\s\-]+', '-', s.strip().casefold())

# ── GET: пән аты (URL) бойынша тақырыптарды алу ──────────────────────────────
@app.get("/api/subjects/{name}/topics")
def get_topics(name: str, db: Session = Depends(get_db)):
    target = normalize_key(name)              # URL-дан келген мәнді нормализациялау
    subjects = db.query(Subject).all()        # Бар пәндерді аламыз
    for subj in subjects:
        if normalize_key(subj.name) == target:   # Базадағы атпен Python-да салыстыру
            return db.query(Topic).filter(Topic.subject_id == subj.id).all()
    raise HTTPException(status_code=404, detail=f"Пән табылмады: {name}")

# ── POST: пән аты (URL) бойынша жаңа тақырып қосу ────────────────────────────
class TopicCreate(BaseModel):
    name: str

@app.post("/api/subjects/{name}/topics")
def add_topic(name: str, topic: TopicCreate, db: Session = Depends(get_db)):
    target = normalize_key(name)
    subjects = db.query(Subject).all()
    for subj in subjects:
        if normalize_key(subj.name) == target:
            new_topic = Topic(name=topic.name, subject_id=subj.id)
            db.add(new_topic)
            db.commit()
            db.refresh(new_topic)
            return {"message": "Тақырып қосылды ✅", "id": new_topic.id}
    raise HTTPException(status_code=404, detail=f"Пән табылмады: {name}")


class QuizCreate(BaseModel):
    question: str
    options: list[str]
    correct_answer: str

@app.post("/api/topics/{topic_id}/quizzes")
def add_quiz(topic_id: int, quiz: QuizCreate, db: Session = Depends(get_db)):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Тақырып табылмады")

    new_quiz = Quiz(
        question=quiz.question,
        options=json.dumps(quiz.options, ensure_ascii=False),
        correct_answer=quiz.correct_answer,
        topic_id=topic_id,
    )
    db.add(new_quiz)
    db.commit()
    db.refresh(new_quiz)
    return {"message": "Quiz қосылды ✅", "id": new_quiz.id}



# ---- Статикалық суреттер үшін папка
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ---- Статикалық сервер
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# ---- Сурет жүктеу эндпоинты
@app.post("/api/upload")
async def upload_image(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".png", ".jpg", ".jpeg", ".gif", ".webp"]:
        raise HTTPException(status_code=400, detail="Рұқсат етілмеген формат")

    fname = f"{uuid4().hex}{ext}"
    save_path = os.path.join(UPLOAD_DIR, fname)

    with open(save_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Клиентке қайтатын URL (React осыны қолданады)
    return {"url": f"/uploads/{fname}"}


# Пәнді өшіру
@app.delete("/api/subjects/{subject_id}")
def delete_subject(subject_id: int, db: Session = Depends(get_db)):
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Пән табылмады")
    db.delete(subject)   # ORM каскад жұмыс істейді
    db.commit()
    return {"message": "Пән өшірілді ✅"}

# Тақырыпты өшіру
@app.delete("/api/topics/{topic_id}")
def delete_topic(topic_id: int, db: Session = Depends(get_db)):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Тақырып табылмады")
    db.delete(topic)     # ORM каскад: ішіндегі quiz-дер өшеді
    db.commit()
    return {"message": "Тақырып өшірілді ✅"}


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
            "options": json.loads(q.options),
            "correct_answer": q.correct_answer,
        }
        for q in quizzes
    ]
