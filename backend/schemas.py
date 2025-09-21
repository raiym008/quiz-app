from typing import Optional, List
from pydantic import BaseModel, EmailStr

# ---- Auth in/out ----
class RegisterIn(BaseModel):
    email: EmailStr
    username: str
    password: str

class VerifyIn(BaseModel):
    email: EmailStr
    code: str

class LoginIn(BaseModel):
    username: str
    password: str

class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class UserOut(BaseModel):
    id: int
    email: EmailStr
    username: str
    is_verified: bool

# ---- Activity ----
class ActivityAddIn(BaseModel):
    action: str
    meta: Optional[str] = None

class ActivityOut(BaseModel):
    id: int
    action: str
    meta: Optional[str]
    created_at: str
