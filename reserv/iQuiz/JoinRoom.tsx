// src/app/modes/iQuiz/JoinRoom.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { joinRoom } from "./iquizApi";

export default function JoinRoom() {
  const [roomCode, setRoomCode] = useState("");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!roomCode || !name) return;
    setLoading(true);
    try {
      const data = await joinRoom(roomCode.toUpperCase(), name.trim(), avatar.trim());
      navigate(`/modes/iQuiz/waiting/${data.roomId}`);
    } catch {
      alert("Қосылу сәтсіз. Кодты тексеріңіз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto p-6 mt-10 bg-white/10 rounded-2xl text-white">
      <h1 className="text-3xl font-bold mb-6 text-center">Бөлмеге қосылу</h1>
      <form onSubmit={handleJoin} className="space-y-4">
        <div>
          <label className="block mb-1">Бөлме коды</label>
          <input
            className="w-full rounded-lg px-3 py-2 bg-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="Мысалы: AB12CD"
            maxLength={10}
          />
        </div>
        <div>
          <label className="block mb-1">Атың</label>
          <input
            className="w-full rounded-lg px-3 py-2 bg-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Атыңды енгіз"
          />
        </div>
        <div>
          <label className="block mb-1">Аватар (опционал)</label>
          <input
            className="w-full rounded-lg px-3 py-2 bg-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
            placeholder="https://.../avatar.png"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-yellow-400 text-black py-3 rounded-xl font-semibold hover:bg-yellow-300 transition"
        >
          {loading ? "Қосылып жатыр..." : "Қосылу"}
        </button>
      </form>
    </div>
  );
}
