from typing import Optional, List
from pydantic import BaseModel, EmailStr

# ---- Auth input/output ----
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

class UserRegister(BaseModel):
    email: EmailStr
    username: str
    password: str

class ResendIn(BaseModel):
    email: EmailStr

# ---- Quiz / Activity ----
class SubjectCreate(BaseModel):
    name: str

class TopicCreate(BaseModel):
    name: str


class QuizCreate(BaseModel):
    question: str
    options: List[str]
    correct_answer: Optional[str] = None

# ===================================
class CreateRoomRequest(BaseModel):
    room_code: Optional[str] = None
    host_name: Optional[str] = None
    host_avatar: Optional[str] = None

class JoinRequest(BaseModel):
    room_code: str
    name: str
    avatar: str

class JoinResponse(BaseModel):
    playerId: str
    roomId: str
    name: str
    avatar: str

class RoomState(BaseModel):
    roomId: str
    players: List[dict]