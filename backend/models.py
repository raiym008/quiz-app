from database import Base, engine
# models (main.py ішінде)
from sqlalchemy.orm import relationship
from sqlalchemy import Column, Integer, String, ForeignKey

class Subject(Base):
    __tablename__ = "subjects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)

    # пән өшсе → ішіндегі тақырыптар да өшсін
    topics = relationship("Topic", back_populates="subject",
                          cascade="all, delete-orphan")

class Topic(Base):
    __tablename__ = "topics"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)

    subject_id = Column(Integer, ForeignKey("subjects.id"))
    subject = relationship("Subject", back_populates="topics")

    # тақырып өшсе → ішіндегі quiz-дер де өшсін
    quizzes = relationship("Quiz", back_populates="topic",
                           cascade="all, delete-orphan")

class Quiz(Base):
    __tablename__ = "quizzes"
    id = Column(Integer, primary_key=True, index=True)
    question = Column(String, nullable=False)
    options = Column(String, nullable=False)        # JSON string
    correct_answer = Column(String, nullable=False)

    topic_id = Column(Integer, ForeignKey("topics.id"))
    topic = relationship("Topic", back_populates="quizzes")


Base.metadata.create_all(bind=engine) 