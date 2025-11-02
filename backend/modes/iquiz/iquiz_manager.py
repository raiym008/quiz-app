# modes/iquiz/iquiz_manager.py
from fastapi import WebSocket
from typing import Dict, List
from uuid import uuid4

class Player:
    def __init__(self, name: str, avatar: str = ""):
        self.id = uuid4().hex
        self.name = name
        self.avatar = avatar
        self.score = 0

class Room:
    def __init__(self, room_id: str):
        self.id = room_id.upper()
        self.players: List[Player] = []
        self.websockets: List[WebSocket] = []

class IQuizManager:
    def __init__(self):
        self.rooms: Dict[str, Room] = {}

    async def create_room(self, room_code: str | None = None) -> Room:
        code = (room_code or uuid4().hex[:6]).upper()
        room = Room(code)
        self.rooms[code] = room
        return room

    async def join_room(self, room_code: str, name: str, avatar: str = "") -> Player:
        room_code = room_code.upper()
        if room_code not in self.rooms:
            self.rooms[room_code] = Room(room_code)
        player = Player(name, avatar)
        self.rooms[room_code].players.append(player)
        await self.broadcast(room_code, {
            "type": "player_joined",
            "name": name,
            "avatar": avatar
        })
        return player

    async def get_state(self, room_id: str) -> dict:
        room_id = room_id.upper()
        room = self.rooms.get(room_id)
        if not room:
            return {"exists": False, "players": []}
        return {
            "exists": True,
            "roomId": room.id,
            "players": [
                {"id": p.id, "name": p.name, "avatar": p.avatar}
                for p in room.players
            ],
        }

    async def attach_ws(self, room_id: str, ws: WebSocket):
        room_id = room_id.upper()
        if room_id not in self.rooms:
            self.rooms[room_id] = Room(room_id)
        self.rooms[room_id].websockets.append(ws)
        await self.broadcast(room_id, {"type": "connected", "count": len(self.rooms[room_id].players)})

    async def detach_ws(self, room_id: str, ws: WebSocket):
        room_id = room_id.upper()
        room = self.rooms.get(room_id)
        if not room:
            return
        if ws in room.websockets:
            room.websockets.remove(ws)
        if not room.websockets and not room.players:
            self.rooms.pop(room_id, None)

    async def broadcast(self, room_id: str, message: dict):
        room_id = room_id.upper()
        room = self.rooms.get(room_id)
        if not room:
            return
        dead_ws = []
        for ws in room.websockets:
            try:
                await ws.send_json(message)
            except:
                dead_ws.append(ws)
        for ws in dead_ws:
            room.websockets.remove(ws)

iquiz_manager = IQuizManager()