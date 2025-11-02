from datetime import datetime, timedelta
from fastapi import HTTPException, Request
from sqlalchemy.orm import Session
from passlib.context import CryptContext

from models import User, VerificationCode, UserActivity
from email_sender import generate_code, send_verification_email

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_pw(pw: str) -> str:
    return pwd_ctx.hash(pw)

def verify_pw(pw: str, hashed: str) -> bool:
    return pwd_ctx.verify(pw, hashed)

# ---- ішкі көмекші: код шығару/жазу (commit етпейді!)
def _issue_verification_code(db: Session, user_id: int) -> str:
    code = generate_code()
    rec = VerificationCode(
        user_id=user_id,
        code=code,
        expires_at=datetime.utcnow() + timedelta(minutes=10),
    )
    db.add(rec)
    return code

def register_user(payload, db: Session):
    """Жартылай тіркелуді болдырмайтын, бірақ double transaction қателігін тудырмайтын нұсқа."""
    try:
        # Duplicate check
        existing = db.query(User).filter(
            (User.email == payload.email) | (User.username == payload.username)
        ).first()

        if existing and existing.is_verified:
            raise HTTPException(status_code=400, detail="User already exists")

        # Егер бұрын тіркеліп, бірақ верификацияланбаған болса — қайта код жібереміз
        if existing and not existing.is_verified:
            code = generate_code()
            db.query(VerificationCode).filter(VerificationCode.user_id == existing.id).delete()
            db.add(VerificationCode(
                user_id=existing.id,
                code=code,
                expires_at=datetime.utcnow() + timedelta(minutes=10),
            ))
            db.commit()
            try:
                send_verification_email(existing.email, code)
            except Exception as e:
                print("❌ Email жіберу қатесі:", e)
            return {"message": "User exists but not verified. New code sent."}

        # Жаңа user тіркеу
        new_user = User(
            email=payload.email,
            username=payload.username,
            hashed_password=hash_pw(payload.password),
            is_verified=False,
            created_at=datetime.utcnow(),
        )
        db.add(new_user)
        db.flush()  # id алу үшін commit етпей

        code = generate_code()
        db.add(VerificationCode(
            user_id=new_user.id,
            code=code,
            expires_at=datetime.utcnow() + timedelta(minutes=10),
        ))

        try:
            send_verification_email(new_user.email, code)
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Email send failed: {e}")

        db.commit()
        return {"message": "User registered successfully. Verification email sent."}

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))



def verify_user(payload, db: Session):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    rec = (
        db.query(VerificationCode)
        .filter(VerificationCode.user_id == user.id, VerificationCode.code == payload.code)
        .order_by(VerificationCode.id.desc())
        .first()
    )
    if not rec:
        raise HTTPException(status_code=400, detail="Invalid code")
    if rec.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Code expired")

    user.is_verified = True
    db.commit()
    return {"message": "Email verified successfully ✅"}


def login_user(payload, request: Request, db: Session, create_token_fn):
    """
    Бұрынғыдай login логикасы (қысқаша):
    - username/password тексеру
    - құрылғы лимитін сақтау (UserActivity)
    - access/refresh токен жасау (create_token_fn қолданамыз)
    """
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_pw(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # құрылғы лимиті: 3
    sessions = db.query(UserActivity).filter(
        UserActivity.user_id == user.id, UserActivity.action == "LOGIN"
    ).all()
    if len(sessions) >= 3:
        oldest = sorted(sessions, key=lambda s: s.created_at)[0]
        db.delete(oldest)
        db.commit()

    db.add(UserActivity(
        user_id=user.id,
        action="LOGIN",
        meta=request.headers.get("user-agent")
    ))
    db.commit()

    access = create_token_fn({"sub": user.email}, minutes=15)
    refresh = create_token_fn({"sub": user.email, "type": "refresh"}, minutes=43200)
    return {"access_token": access, "refresh_token": refresh, "token_type": "bearer"}


# === 🆕 ҚАЙТА ЖІБЕРУ КОДЫ: logic/атауларды өзгертпей, бөлек функция ретінде
def resend_verification_code(payload, db: Session):
    """
    Email-ға жаңа растау кодын қайта жібереді.
    - Бар user-ді email бойынша табу
    - Егер верификацияланып қойған болса — қате
    - Бұрынғы кодтарды өшіру, жаңасын беру (10 минут)
    - Commit -> email жіберу
    """
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_verified:
        raise HTTPException(status_code=400, detail="User already verified")

    # ескі кодтарды тазалау және жаңасын шығару
    db.query(VerificationCode).filter(VerificationCode.user_id == user.id).delete()
    code = _issue_verification_code(db, user.id)
    db.commit()  # register_user-дағы "existing not verified" бранчына ұқсас тәртіп

    try:
        send_verification_email(user.email, code)
    except Exception as e:
        # Мұнда да бұрынғы үлгіге сай: қатені логқа жазып, жалпы ағынды үзбей қоямыз
        print("❌ Email жіберу қатесі:", e)

    return {"message": "Verification code resent."}
