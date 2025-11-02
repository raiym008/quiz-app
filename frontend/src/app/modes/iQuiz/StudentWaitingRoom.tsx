// src/app/modes/iQuiz/StudentWaitingRoom.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { getRoomState } from "./iquizApi";
import type { Player, RoomState } from "./types";
import { WS_BASE } from "../../api/axiosClient";

export default function StudentWaitingRoom() {
  const { roomId = "" } = useParams();
  const [players, setPlayers] = useState<Player[]>([]);
  const [connected, setConnected] = useState(false);
  const [recentId, setRecentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);

  const wsUrl = useMemo(() => `${WS_BASE}/api/iquiz/ws/${roomId}`, [roomId]);

  // Алғашқы күй
  useEffect(() => {
    if (!roomId) return;
    setLoading(true);
    getRoomState(roomId)
      .then((state: RoomState) => setPlayers(state.players || []))
      .finally(() => setLoading(false));
  }, [roomId]);

  // WebSocket байланыс
  useEffect(() => {
    if (!roomId) return;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: "ping" }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "pong") return;

      if (Array.isArray(msg.players)) {
        setPlayers(msg.players);
        return;
      }

      if (msg.type === "player_joined" && msg.name) {
        const p: Player = {
          id: crypto.randomUUID(),
          name: msg.name,
          avatar: msg.avatar || "",
        };
        setPlayers((prev) => (prev.some((x) => x.name === p.name) ? prev : [...prev, p]));
        setRecentId(p.id);
        setTimeout(() => setRecentId(null), 1100);
      }
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    return () => ws.close();
  }, [wsUrl, roomId]);

  return (
    <div className="relative min-h-screen overflow-hidden text-slate-900 selection:bg-indigo-200/30">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-100 via-violet-100 to-pink-100" />
      <Blobs />
      <Noise />

      {/* Жоғарғы жол */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white shadow-sm ring-1 ring-slate-200 grid place-items-center">
            <span className="text-xl">🎯</span>
          </div>
          <h1 className="text-lg md:text-xl font-bold tracking-wide text-slate-700">
            Күту бөлмесі
          </h1>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold ring-1 ${
            connected
              ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
              : "bg-rose-100 text-rose-800 ring-rose-200"
          }`}
        >
          {connected ? "Online" : "Offline"}
        </span>
      </header>

      {/* Контент */}
      <main className="relative z-10 flex flex-col items-center justify-center px-6 pb-16">
        <div className="max-w-3xl w-full rounded-3xl bg-white/70 backdrop-blur-lg shadow-lg ring-1 ring-slate-200 p-8 text-center">
          <h2 className="text-2xl font-extrabold text-slate-800">Тест басталғанша күтіңіз 🚀</h2>
          <p className="text-slate-600 mt-2">Мұғалім тестті бастағанша осы бетте болыңыз.</p>

          {/* Қатысушылар */}
          <div className="mt-8">
            <h3 className="text-slate-700 font-semibold mb-4">
              Қатысушылар: {players.length}
            </h3>

            {loading ? (
              <SkeletonGrid />
            ) : players.length === 0 ? (
              <EmptyState />
            ) : (
              <PlayersGrid players={players} recentId={recentId} />
            )}
          </div>
        </div>
      </main>

      <style>{`
        @keyframes pop {
          0% { transform: scale(.96); filter: brightness(95%); }
          60% { transform: scale(1.04); filter: brightness(105%); }
          100% { transform: scale(1); filter: none; }
        }
        .animate-pop { animation: pop .8s ease-out both; }
        @keyframes float {
          0%, 100% { transform: translateY(0) }
          50% { transform: translateY(-10px) }
        }
        .float-slow { animation: float 12s ease-in-out infinite; }
        .float-fast { animation: float 7s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

/* ---------- Көмекші компоненттер ---------- */
function EmptyState() {
  return (
    <div className="w-full rounded-2xl ring-1 ring-slate-200 bg-white p-8 text-center">
      <p className="text-slate-700 text-lg">Әзірге ешкім қосылмады 😴</p>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl p-4 bg-white/70 backdrop-blur-md shadow ring-1 ring-slate-200"
        >
          <div className="h-14 w-14 rounded-full bg-slate-200 animate-pulse" />
          <div className="mt-3 h-3 w-20 bg-slate-200 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function PlayersGrid({ players, recentId }: { players: Player[]; recentId: string | null }) {
  const colors = ["from-indigo-200", "from-pink-200", "from-amber-200", "from-cyan-200"];
  const rings = ["ring-indigo-300/60", "ring-pink-300/60", "ring-amber-300/60", "ring-cyan-300/60"];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {players.map((p, i) => {
        const color = colors[i % colors.length];
        const ring = rings[i % rings.length];
        const pop = recentId === p.id ? "animate-pop" : "";
        const initial = p.name?.trim()?.[0]?.toUpperCase() || "🙂";

        return (
          <div
            key={p.id}
            className={`rounded-2xl p-4 bg-gradient-to-br ${color} shadow ${ring} ${pop} hover:scale-[1.01] transition`}
          >
            <div className="flex flex-col items-center gap-2">
              <div className={`h-14 w-14 rounded-full grid place-items-center text-xl bg-white/60 ring-4 ${ring}`}>
                {p.avatar ? (
                  <img src={p.avatar} alt={p.name} className="h-full w-full object-cover rounded-full" />
                ) : (
                  <span className="font-bold text-slate-800">{initial}</span>
                )}
              </div>
              <p className="font-semibold text-slate-800 truncate">{p.name}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Blobs() {
  return (
    <>
      <div className="absolute -top-24 -left-24 h-72 w-72 bg-fuchsia-200 rounded-full blur-3xl opacity-40 float-slow" />
      <div className="absolute bottom-0 right-1/4 h-72 w-72 bg-indigo-200 rounded-full blur-3xl opacity-40 float-fast" />
    </>
  );
}

function Noise() {
  return (
    <div
      className="absolute inset-0 pointer-events-none opacity-[.06] mix-blend-overlay"
      style={{
        backgroundImage:
          "url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22 viewBox=%220 0 40 40%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.7%22 numOctaves=%222%22 stitchTiles=%22stitch%22/></filter><rect width=%2240%22 height=%2240%22 filter=%22url(%23n)%22 opacity=%220.28%22/></svg>')",
      }}
    />
  );
}
