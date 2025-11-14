# database.py

import os
from dotenv import load_dotenv
from supabase import create_client, Client
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
DATABASE_URL = os.getenv("SUPABASE_DB_URL")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise RuntimeError(
        "Supabase URL немесе SERVICE KEY табылмады. "
        ".env файлын тексер: SUPABASE_URL, SUPABASE_SERVICE_KEY."
    )

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

__all__ = ["supabase"]

Base = declarative_base()

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()