# models.py
from datetime import datetime, timedelta
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from database import Base

# ───────────────────────────────────────────────────────────
# Тіркелу және құрылғы
# ───────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "public"}  # Supabase-те public schema

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    codes = relationship("VerificationCode", back_populates="user", cascade="all, delete-orphan")
    activities = relationship("UserActivity", back_populates="user", cascade="all, delete-orphan")


class VerificationCode(Base):
    __tablename__ = "verification_codes"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("public.users.id", ondelete="CASCADE"))
    code = Column(String, nullable=False)
    expires_at = Column(DateTime, default=lambda: datetime.utcnow() + timedelta(minutes=10))
    user = relationship("User", back_populates="codes")


class UserActivity(Base):
    __tablename__ = "user_activities"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("public.users.id", ondelete="CASCADE"))
    action = Column(String, nullable=False)
    meta = Column(Text, nullable=True)  # user-agent, ip
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    user = relationship("User", back_populates="activities")


# ───────────────────────────────────────────────────────────
# Quiz жүйесі
# ───────────────────────────────────────────────────────────

class Subject(Base):
    __tablename__ = "subjects"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    topics = relationship("Topic", back_populates="subject", cascade="all, delete-orphan")


class Topic(Base):
    __tablename__ = "topics"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    subject_id = Column(Integer, ForeignKey("public.subjects.id", ondelete="CASCADE"))
    subject = relationship("Subject", back_populates="topics")
    quizzes = relationship("Quiz", back_populates="topic", cascade="all, delete-orphan")


class Quiz(Base):
    __tablename__ = "quizzes"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, index=True)
    question = Column(Text, nullable=False)  # ұзын сұрақтарға
    options = Column(JSONB, nullable=False)  # PostgreSQL JSONB – жылдам, индекстеледі
    correct_answer = Column(String, nullable=True)
    topic_id = Column(Integer, ForeignKey("public.topics.id", ondelete="CASCADE"))
    topic = relationship("Topic", back_populates="quizzes")
