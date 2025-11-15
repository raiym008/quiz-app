// src/app/modes/iQuiz/types.ts
export interface Player {
  id: string;
  name: string;
  avatar: string;
}

export interface JoinResponse {
  playerId: string;
  roomId: string;
  name: string;
  avatar: string;
}

export interface RoomState {
  exists: boolean;
  roomId: string;
  players: Player[];
}