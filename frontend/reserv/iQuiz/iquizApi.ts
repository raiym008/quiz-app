// src/app/modes/iQuiz/iquizApi.ts
import { API_BASE } from "../../src/app/api/axiosClient";

const WS_BASE = import.meta.env.VITE_WS_BASE || "ws://localhost:8000";

import type { RoomState, JoinResponse } from "./types";

export async function createRoom(hostName?: string, hostAvatar?: string): Promise<RoomState> {
  const res = await fetch(`${API_BASE}/api/iquiz/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ host_name: hostName, host_avatar: hostAvatar }),
  });
  if (!res.ok) throw new Error("Бөлме ашылмады");
  return await res.json();
}

export async function joinRoom(roomCode: string, name: string, avatar: string = ""): Promise<JoinResponse> {
  const res = await fetch(`${API_BASE}/api/iquiz/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ room_code: roomCode, name, avatar }),
  });
  if (!res.ok) throw new Error("Қосылу сәтсіз");
  return await res.json();
}

export async function getRoomState(roomId: string): Promise<RoomState> {
  const res = await fetch(`${API_BASE}/api/iquiz/room/${roomId}/state`);
  if (!res.ok) throw new Error("Бөлме табылмады");
  return await res.json();
}

export function getWebSocketUrl(roomId: string): string {
  return `${WS_BASE}/api/iquiz/ws/${roomId}`;
}