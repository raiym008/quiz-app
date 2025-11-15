// src/app/modes/iQuiz/WaitingRoom.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { getRoomState } from "./iquizApi";
import type { Player, RoomState } from "./types";
import toast from "react-hot-toast"

export default function WaitingRoom() {
  const { roomId = "" } = useParams();
  const [players, setPlayers] = useState<Player[]>([]);
  const [connected, setConnected] = useState(false);
  const [recentId, setRecentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  const wsRef = useRef<WebSocket | null>(null);

  const WS_BASE = import.meta.env.VITE_WS_BASE || "ws://localhost:8000";
  const wsUrl = useMemo(() => `${WS_BASE}/api/iquiz/ws/${roomId}`, [roomId]);

  // Алғашқы күй
  useEffect(() => {
    if (!roomId) return;
    setLoading(true);
    getRoomState(roomId)
      .then((state: RoomState) => setPlayers(state.players || []))
      .finally(() => setLoading(false));
  }, [roomId]);

  // WebSocket
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

      // ТҮЗЕТУДІ БАСТАУ
      // Егер сервер толық Player объектісін (id, name, avatar) жіберсе:
      if (msg.type === "player_joined" && msg.player) {
          const p: Player = msg.player; // Толық Player объектісін тікелей қолданыңыз
          
          setPlayers((prev) => (
              // Қазір, name бойынша емес, id бойынша тексеру дұрыс.
              // Егер msg.player.id бар болса, соны қолданамыз.
              prev.some((x) => x.id === p.id) ? prev : [...prev, p]
          ));
          setRecentId(p.id);
          setTimeout(() => setRecentId(null), 1100);
          return;
      }

      if (msg.type === "player_joined" && msg.id && msg.name) {
          const p: Player = {
              id: msg.id, // ✅ Серверден келген ID-ді қолдану
              name: msg.name,
              avatar: msg.avatar || "",
          };
          setPlayers((prev) => (
              // ID бойынша тексеру
              prev.some((x) => x.id === p.id) ? prev : [...prev, p]
          ));
          setRecentId(p.id);
          setTimeout(() => setRecentId(null), 1100);
      }
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    return () => ws.close();
  }, [wsUrl, roomId]);

  const copyCode = async () => {
    try {
      // roomId енді тек сандардан тұрады
      await navigator.clipboard.writeText(roomId);
      toast.success("Бөлме коды көшірілді");
    } catch {
      toast.error("Кодты көшіру мүмкін болмады");
    }
  };

  const copyInvite = async () => {
    try {
      const origin = window.location.origin;
      const inviteUrl = `${origin}/iquiz/room/${roomId}`;
      
      await navigator.clipboard.writeText(inviteUrl);
      
      toast.success("Шақыру сілтемесі көшірілді!");

    } catch {
      toast.error("Сілтемені көшіру мүмкін болмады.");
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden selection:bg-indigo-200/40 selection:text-slate-900">
      {/* Ашық, өте нәзік қозғалыстағы фон */}
      <div className="ambient absolute inset-0" />
      <Blobs />
      <Noise />

      {/* Үстіңгі жол — екінші планда */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 opacity-90">
        <div className="flex items-center gap-3">
          <LogoBadge />
          <h1 className="text-xl md:text-2xl font-extrabold tracking-wide text-slate-800/80">
            iQuiz — Waiting Room
          </h1>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold shadow-sm ring-1 ${
            connected
              ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
              : "bg-rose-100 text-rose-800 ring-rose-200"
          }`}
          aria-live="polite"
        >
          {connected ? "Online" : "Offline"}
        </span>
      </header>

      {/* HERO — КОД ОРТАДА, ТОЛЫҚ ФОКУС */}
      <section className="relative z-10 grid place-items-center px-6">
        <div
          className="w-full max-w-3xl mt-2 md:mt-4 rounded-3xl bg-white/80 backdrop-blur-xl shadow-lg ring-1 ring-slate-200
                     px-6 py-10 md:px-10 md:py-14 text-center animate-fade-slow focus-shadow"
          aria-label="Room access code area"
        >
          <p className="uppercase tracking-[0.3em] text-slate-500 text-[10px] md:text-xs mb-4">
            Enter this code
          </p>

          {/* ЕН ҮЛКЕН КОД */}
          <RoomCodeBig code={roomId || ""} /> 

          {/* Әрекеттер — код астында */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={copyCode}
              className="px-5 py-3 rounded-2xl bg-slate-900 text-white shadow-sm hover:opacity-90 active:scale-[.99] transition ring-1 ring-slate-900/10"
            >
              Кодты көшіру 📋
            </button>
            <button
              onClick={copyInvite}
              className="px-5 py-3 rounded-2xl bg-white text-slate-900 shadow-sm hover:bg-slate-50 active:scale-[.99] transition ring-1 ring-slate-200"
            >
              Шақыру сілтемесі 🔗
            </button>
            <span className="text-slate-700 text-sm">
              Қатысушылар: <b className="font-semibold">{players.length}</b>
            </span>
          </div>

          {/* Админ батырмасы — осында */}
          <div className="mt-6">
            <button
              onClick={() => alert("Бастау логикасы кейін қосылады")}
              className="inline-flex items-center justify-center rounded-2xl px-6 py-3 font-semibold
                         bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400 text-slate-900
                         shadow-md hover:brightness-[1.03] active:scale-95 transition ring-1 ring-violet-200"
            >
              Бастау 🚀
            </button>
          </div>
        </div>
      </section>

      {/* Қатысушылар */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 pb-16 mt-10">
        <div className="rounded-3xl bg-white/70 backdrop-blur-xl shadow-lg ring-1 ring-slate-200 p-6 md:p-8">
          <h2 className="text-slate-800/80 font-semibold mb-4">Қатысушылар</h2>
          {loading ? (
            <SkeletonGrid />
          ) : players.length === 0 ? (
            <EmptyState />
          ) : (
            <PlayersGrid players={players} recentId={recentId} />
          )}
        </div>
      </main>

      {/* Локал стильдер */}
      <style>{`
        .ambient {
          background: linear-gradient(120deg, #f7faff, #f5f7ff, #f8f7fb, #f7faff);
          background-size: 400% 400%;
          animation: gradientSlide 22s ease-in-out infinite;
        }
        @keyframes gradientSlide {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .focus-shadow {
          box-shadow:
            0 0 0 6px rgba(255,255,255,.6),
            0 10px 30px rgba(15, 23, 42, .08);
          animation: glow 3.6s ease-in-out infinite;
        }
        @keyframes glow {
          0%, 100% { box-shadow:
            0 0 0 6px rgba(255,255,255,.6),
            0 10px 30px rgba(15, 23, 42, .08); }
          50% { box-shadow:
            0 0 0 10px rgba(255,255,255,.7),
            0 20px 50px rgba(15, 23, 42, .12); }
        }

        @keyframes pop {
          0% { transform: scale(.96); filter: brightness(95%); }
          60% { transform: scale(1.03); filter: brightness(102%); }
          100% { transform: scale(1); filter: none; }
        }
        .animate-pop { animation: pop .8s ease-out both; }

        @keyframes float {
          0%, 100% { transform: translateY(0) }
          50% { transform: translateY(-14px) }
        }
        .float-slow { animation: float 14s ease-in-out infinite; }
        .float-mid  { animation: float 11s ease-in-out infinite; }
        .float-fast { animation: float 8s  ease-in-out infinite; }

        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        .animate-fade-slow { animation: fadeIn .6s ease both; }
      `}</style>
    </div>
  );
}

/* ---------- UI компоненттер ---------- */

function LogoBadge() {
  return (
    <div className="h-10 w-10 rounded-xl bg-white shadow-sm ring-1 ring-slate-200 grid place-items-center">
      <span className="text-xl">🎯</span>
    </div>
  );
}

function RoomCodeBig({ code }: { code: string }) {
  // *** НАҚТЫ ӨЗГЕРІС ОСЫНДА ***
  // RoomId енді тек сандардан тұрады. Әріптерді жоямыз.
  const numericCode = code.replace(/\D/g, "");
  const chars = numericCode.slice(0, 6).split(""); 
  
  if (chars.length === 0) {
    return <div className="h-12 flex items-center justify-center text-slate-500">Код анықталмады</div>;
  }
  return (
    <div
      className="inline-flex gap-3 md:gap-4 px-3 py-2 md:px-4 md:py-3 rounded-3xl bg-white/70 ring-1 ring-slate-200
                 shadow-sm mx-auto"
      role="group"
      aria-label="Room code characters"
    >
      {chars.map((ch, idx) => (
        <span
          key={`${ch}-${idx}`}
          className="inline-flex h-16 md:h-24 min-w-12 md:min-w-16 px-3 md:px-4 items-center justify-center rounded-2xl
                     bg-white text-slate-900 font-black text-4xl md:text-6xl tracking-wider
                     shadow-sm ring-1 ring-slate-200"
        >
          {ch}
        </span>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="w-full rounded-2xl ring-1 ring-slate-200 bg-white p-10 text-center">
      <p className="text-slate-800 text-lg">Қатысушыларды күтіп жатырмыз…</p>
      <p className="text-slate-600 text-sm mt-2">Кодты бөлісіп, студенттерді шақырыңыз. ✨</p>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl p-4 bg-white/70 backdrop-blur-md shadow-sm ring-1 ring-slate-200"
        >
          <div className="h-14 w-14 rounded-full bg-slate-200 animate-pulse" />
          <div className="mt-3 h-3 w-24 bg-slate-200 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function PlayersGrid({ players, recentId }: { players: Player[]; recentId: string | null }) {
  const gradients = [
    "from-pink-200 to-rose-300",
    "from-violet-200 to-indigo-300",
    "from-cyan-200 to-teal-300",
    "from-amber-200 to-orange-300",
    "from-lime-200 to-emerald-300",
    "from-sky-200 to-blue-300",
  ];
  const rings = [
    "ring-pink-300/70",
    "ring-violet-300/70",
    "ring-teal-300/70",
    "ring-amber-300/70",
    "ring-emerald-300/70",
    "ring-sky-300/70",
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {players.map((p, i) => {
        const g = gradients[i % gradients.length];
        const r = rings[i % rings.length];
        const pop = recentId === p.id ? "animate-pop" : "";
        const initial = p.name?.trim()?.[0]?.toUpperCase() || "🙂";

        return (
          <div
            key={p.id}
            className={`relative rounded-2xl p-4 bg-white shadow-sm ring-1 ring-slate-200 ${pop} hover:shadow-md transition`}
          >
            <div className="absolute -top-3 -right-3 h-9 px-2 rounded-full bg-white shadow ring-1 ring-slate-200 grid place-items-center rotate-12">
              <span className="text-xs text-slate-700 font-semibold">Ready</span>
            </div>

            <div className="flex items-center gap-3">
              <div
                className={`h-14 w-14 rounded-full overflow-hidden grid place-items-center text-2xl 
                            bg-gradient-to-br ${g} ring-4 ${r}`}
              >
                {p.avatar ? (
                  <img src={p.avatar} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="font-bold text-slate-800">{initial}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-base font-semibold text-slate-800 truncate">{p.name}</p>
                <p className="text-xs text-slate-500">Connected</p>
              </div>
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
      <div className="absolute -top-24 -left-24 h-72 w-72 bg-fuchsia-200 rounded-full blur-3xl opacity-30 float-slow" />
      <div className="absolute top-1/3 -right-24 h-80 w-80 bg-indigo-200 rounded-full blur-3xl opacity-30 float-mid" />
      <div className="absolute bottom-0 left-1/4 h-72 w-72 bg-sky-200 rounded-full blur-3xl opacity-25 float-fast" />
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