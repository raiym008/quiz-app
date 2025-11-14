// src/app/pages/TopicsPage.tsx
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import axiosClient from "../api/axiosClient";

interface Topic {
  id: number;
  name: string;
  created_at?: string;
}

const colorPool = [
  "bg-blue-100 text-blue-700 ring-blue-200",
  "bg-emerald-100 text-emerald-700 ring-emerald-200",
  "bg-amber-100 text-amber-800 ring-amber-200",
  "bg-fuchsia-100 text-fuchsia-700 ring-fuchsia-200",
  "bg-sky-100 text-sky-700 ring-sky-200",
  "bg-rose-100 text-rose-700 ring-rose-200",
  "bg-violet-100 text-violet-700 ring-violet-200",
  "bg-cyan-100 text-cyan-700 ring-cyan-200",
];

function colorFor(name: string) {
  const sum = Array.from(name).reduce((a, c) => a + c.charCodeAt(0), 0);
  return colorPool[sum % colorPool.length];
}

function initial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "∎";
}

const SearchIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
    <path
      d="M21 21l-4.3-4.3M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

const ChevronRight = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
    <path
      d="M9 5l7 7-7 7"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function TopicsPage() {
  const { userId, subjectId } = useParams();
  const navigate = useNavigate();

  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!subjectId) {
      setError("Пән анықталмады.");
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        // 🔥 axiosClient → токен автомат келеді
        const res = await axiosClient.get(`/subjects/${subjectId}/topics`);
        setTopics(Array.isArray(res.data) ? res.data : []);
      } catch (e: any) {
        if (e?.response?.status === 401) {
          setError("Сессия аяқталды. Қайта кіріңіз.");
        } else if (e?.response?.data?.detail) {
          setError(e.response.data.detail);
        } else {
          setError("Тақырыптар жүктелмеді.");
        }
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [subjectId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? topics.filter((t) => t.name.toLowerCase().includes(q))
      : topics;
  }, [topics, query]);

  const goHome = () => {
    if (!userId) return;
    navigate(`/u/${userId}`);
  };

  const openFirstFiltered = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || filtered.length === 0) return;
    navigate(`/u/${userId}/topics/${filtered[0].id}/quizzes`);
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Тақырыптар
            </h1>
            <p className="text-xs text-slate-500">
              Таңдалған пән бойынша құрылған тақырыптар тізімі.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">
              Барлығы: <b>{topics.length}</b>
            </span>
            <button
              type="button"
              onClick={goHome}
              className="px-3 py-1.5 rounded-lg text-sm font-medium ring-1 ring-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Басты бет
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <form onSubmit={openFirstFiltered} className="mb-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
              <SearchIcon />
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Тақырып атауы бойынша іздеу…"
              className="w-full pl-11 pr-28 py-3 rounded-xl ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-600 bg-white text-slate-900"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700"
            >
              Ашу
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Көрсетіліп тұрғаны: {filtered.length} / {topics.length}
          </p>
        </form>

        {loading && (
          <ul className="space-y-3" aria-hidden>
            {Array.from({ length: 6 }).map((_, i) => (
              <li
                key={i}
                className="h-14 rounded-xl bg-slate-100 animate-pulse ring-1 ring-slate-200"
              />
            ))}
          </ul>
        )}

        {!loading && error && (
          <div className="rounded-xl bg-rose-50 ring-1 ring-rose-200 text-rose-700 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200 px-6 py-10 text-center text-slate-600 text-sm">
            <div className="text-4xl mb-2">📄</div>
            Бұл пәнде тақырып тіркелмеген.
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <nav className="divide-y divide-slate-200/70 rounded-xl ring-1 ring-slate-200 bg-white">
            {filtered.map((topic) => {
              const color = colorFor(topic.name);
              return (
                <button
                  key={topic.id}
                  onClick={() =>
                    userId &&
                    navigate(`/u/${userId}/topics/${topic.id}/quizzes`)
                  }
                  className="w-full text-left px-4 py-4 hover:bg-slate-50 flex items-center gap-4"
                >
                  <div
                    className={`w-10 h-10 grid place-items-center rounded-xl ring ${color} text-base font-semibold`}
                  >
                    {initial(topic.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-slate-900 text-sm font-semibold truncate">
                      {topic.name}
                    </div>
                  </div>
                  <div className="text-slate-300">
                    <ChevronRight />
                  </div>
                </button>
              );
            })}
          </nav>
        )}
      </main>
    </div>
  );
}
