# auth.py
"""
Supabase-only авторизация логикасы + email_sender арқылы код жіберу.

Күтілетін кестелер (Supabase):

1) users
   - id              : bigint, primary key
   - email           : text, unique
   - username        : text, unique
   - hashed_password : text
   - is_verified     : boolean, default false
   - created_at      : timestamptz, default now()
   - (қаласаң name, bio, avatar_url қосуға болады)

2) verification_codes
   - id         : bigint, primary key
   - user_id    : bigint, references users(id) ON DELETE CASCADE
   - code       : text
   - expires_at : timestamptz

Email жіберу үшін email_sender.py файлы қолданылады:
   - generate_code() -> "123456"
   - send_verification_email(email, code)
"""

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from database import supabase
from email_sender import generate_code, send_verification_email


# ===================== Көмекші =====================

def _hash_pw(password: str) -> str:
    """
    Қарапайым SHA256-хеш.
    Прод үшін bcrypt/argon2 қолданған дұрыс.
    """
    import hashlib
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def _verify_pw(password: str, hashed: str) -> bool:
    return _hash_pw(password) == hashed


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _exec(query, ctx: str = ""):
    """
    Supabase сұранысын қауіпсіз орындау.
    supabase-py v2 форматына сай:
    - Қате болса → Exception тастайды (try/except ұстаймыз)
    - Сәтті болса → res.data қайтарамыз
    """
    try:
        res = query.execute()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Supabase error{f' ({ctx})' if ctx else ''}: {e}",
        )

    data = getattr(res, "data", None)
    if data is None and isinstance(res, dict):
        data = res.get("data")

    return data


def _send_code(email: str, code: str, ctx: str):
    """
    Email жіберуді бөлек ұстап аламыз.
    Егер email жіберілмей қалса да, жүйе құламасын:
    тек print арқылы логтаймыз.
    """
    try:
        send_verification_email(email, code)
    except Exception as e:
        # Мұнда production-да logging қолданған дұрыс
        print(f"❌ Email send error ({ctx}): {e}")


# ===================== Тіркелу =====================

def register_user(payload):
    """
    Тіркелу:

    1) email/username бос емес
    2) Егер fully verified user бар → 400
    3) Егер user бар, бірақ is_verified = False → кодты жаңарту + email жіберу
    4) Егер user жоқ → жаңа user + верификация коды + email жіберу
    """

    email = (payload.email or "").strip().lower()
    username = (payload.username or "").strip()
    password = (payload.password or "").strip()

    if not email or not username or not password:
        raise HTTPException(status_code=400, detail="Деректер толық емес.")

    # 1) Осындай email/username бар ма?
    existing = _exec(
        supabase.table("users")
        .select("id,is_verified")
        .or_(f"email.eq.{email},username.eq.{username}"),
        ctx="check existing user",
    )


    # ── Егер бар болса
    if existing:
        user = existing[0]

        # Толық расталған қолданушы → қайта тіркеуге болмайды
        if user.get("is_verified"):
            raise HTTPException(
                status_code=400,
                detail="Бұл email немесе username бұрын қолданылған.",
            )

        # Расталмаған қолданушы → ескі кодтарды өшіріп, жаңасын жібереміз
        user_id = user["id"]

        _exec(
            supabase.table("verification_codes")
            .delete()
            .eq("user_id", user_id),
            ctx="cleanup old codes (register existing)",
        )

        code = generate_code()
        exp = _now_utc() + timedelta(minutes=10)

        _exec(
            supabase.table("verification_codes").insert(
                {
                    "user_id": user_id,
                    "code": code,
                    "expires_at": exp.isoformat(),
                }
            ),
            ctx="insert new code (register existing)",
        )

        _send_code(email, code, ctx="register existing user")

        return {
            "message": (
                "Бұл email бұрын тіркелген, бірақ расталмаған. "
                "Жаңа растау коды email-ге жіберілді."
            )
        }

    # ── Жаңа қолданушы ────────────────────────────────
    hashed = _hash_pw(password)

    ins = _exec(
        supabase.table("users").insert(
            {
                "email": email,
                "username": username,
                "hashed_password": hashed,
                "is_verified": False,
                "created_at": _now_utc().isoformat(),
            }
        ),
        ctx="insert new user",
    )

    if not ins:
        raise HTTPException(
            status_code=500,
            detail="Қолданушыны тіркеу мүмкін болмады.",
        )

    user_id = ins[0]["id"]

    # Растау коды
    code = generate_code()
    exp = _now_utc() + timedelta(minutes=10)

    _exec(
        supabase.table("verification_codes").insert(
            {
                "user_id": user_id,
                "code": code,
                "expires_at": exp.isoformat(),
            }
        ),
        ctx="insert verify code (new user)",
    )

    _send_code(email, code, ctx="register new user")

    return {
        "message": "Тіркелу сәтті өтті. Растау коды email-ге жіберілді.",
        "user": {
            "id": user_id,
            "email": email,
            "username": username,
        },
    }


# ===================== Email растау =====================

def verify_user(payload):
    """
    Email + код арқылы аккаунтты растау.
    """

    email = (payload.email or "").strip().lower()
    code = (payload.code or "").strip()

    if not email or not code:
        raise HTTPException(status_code=400, detail="Email немесе код бос.")

    # Қолданушыны табу
    users = _exec(
        supabase.table("users")
        .select("id,is_verified")
        .eq("email", email),
        ctx="find user (verify)",
    )

    if not users:
        raise HTTPException(status_code=404, detail="Қолданушы табылмады.")

    user = users[0]
    user_id = user["id"]

    # Кодты табу
    records = _exec(
        supabase.table("verification_codes")
        .select("*")
        .eq("user_id", user_id)
        .eq("code", code)
        .order("id", desc=True)
        .limit(1),
        ctx="find verify code",
    )

    if not records:
        raise HTTPException(status_code=400, detail="Қате код.")

    rec = records[0]

    raw_expires = rec.get("expires_at")
    if not raw_expires:
        raise HTTPException(status_code=400, detail="Код уақыты дұрыс емес.")

    try:
        expires_at = datetime.fromisoformat(str(raw_expires).replace("Z", "+00:00"))
    except Exception:
        raise HTTPException(status_code=400, detail="Код уақыты дұрыс емес.")

    if expires_at < _now_utc():
        raise HTTPException(status_code=400, detail="Кодтың уақыты өтіп кеткен.")

    # User-ді verified қыламыз
    _exec(
        supabase.table("users")
        .update({"is_verified": True})
        .eq("id", user_id),
        ctx="set user verified",
    )

    # Қаласаң, қолданылған кодтарды өшіруге болады:
    # _exec(
    #     supabase.table("verification_codes").delete().eq("user_id", user_id),
    #     ctx="cleanup codes after verify",
    # )

    return {"message": "Аккаунт сәтті расталды ✅"}


# ===================== Растау кодын қайта жіберу =====================

def resend_verification_code(payload):
    """
    Расталмаған аккаунтқа жаңа код жіберу.
    """

    email = (payload.email or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email бос.")

    users = _exec(
        supabase.table("users")
        .select("id,is_verified")
        .eq("email", email),
        ctx="find user (resend)",
    )

    if not users:
        raise HTTPException(status_code=404, detail="Қолданушы табылмады.")

    user = users[0]
    user_id = user["id"]

    if user.get("is_verified"):
        raise HTTPException(
            status_code=400,
            detail="Бұл аккаунт бұрыннан расталған.",
        )

    # Ескі кодтарды өшіру
    _exec(
        supabase.table("verification_codes")
        .delete()
        .eq("user_id", user_id),
        ctx="cleanup old codes (resend)",
    )

    # Жаңа код
    code = generate_code()
    exp = _now_utc() + timedelta(minutes=10)

    _exec(
        supabase.table("verification_codes").insert(
            {
                "user_id": user_id,
                "code": code,
                "expires_at": exp.isoformat(),
            }
        ),
        ctx="insert new code (resend)",
    )

    _send_code(email, code, ctx="resend verify code")

    return {"message": "Жаңа растау коды email-ге жіберілді."}


# ===================== Логин =====================

def login_user(payload):
    """
    Логин:
    - username + password
    - is_verified == True
    - Дұрыс болса → {"user": {...}}
    JWT токен main.py ішінде жасалады.
    """

    username = (payload.username or "").strip()
    password = (payload.password or "").strip()

    if not username or not password:
        raise HTTPException(status_code=400, detail="Логин немесе пароль бос.")

    users = _exec(
        supabase.table("users")
        .select("id,email,username,hashed_password,is_verified")
        .eq("username", username)
        .limit(1),
        ctx="login find user",
    )

    if not users:
        raise HTTPException(
            status_code=401,
            detail="Қате логин немесе құпия сөз.",
        )

    user = users[0]

    if not _verify_pw(password, user["hashed_password"]):
        raise HTTPException(
            status_code=401,
            detail="Қате логин немесе құпия сөз.",
        )

    if not user.get("is_verified"):
        raise HTTPException(
            status_code=403,
            detail="Алдымен email-ді растаңыз.",
        )

    return {
        "user": {
            "id": user["id"],
            "email": user["email"],
            "username": user["username"],
        }
    }
