// src/pages/TopicsPage.tsx
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../api/axiosClient";

interface Topic {
  id: number;
  name: string;
}

const API = API_BASE

/* ======== Helpers ======== */
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

/* ======== Icons ======== */
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

/* ======== Page ======== */
export default function TopicsPage() {
  const { name } = useParams();
  const navigate = useNavigate();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const subjectSlug = encodeURIComponent(name || "");

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${API}/subjects/${subjectSlug}/topics`)
      .then((res) => {
        if (!res.ok) throw new Error("Тақырыптар жүктелмеді");
        return res.json();
      })
      .then((data) => setTopics(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message || "Қате"))
      .finally(() => setLoading(false));
  }, [subjectSlug]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? topics.filter((t) => t.name.toLowerCase().includes(q)) : topics;
  }, [topics, query]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (filtered.length > 0) navigate(`/topics/${filtered[0].id}/quizzes`);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 truncate">
            Тақырыптар
          </h1>

          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">
              Тақырыптар: <b>{topics.length}</b>
            </span>

            {/* NEW: Емтихан батырмасы */}
            <button
              type="button"
              onClick={() => navigate("/iquiz/start")}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all"
            >
              Емтихан
            </button>

            <button
              type="button"
              onClick={() => navigate("/home")}
              className="px-3 py-1.5 rounded-lg text-sm font-medium ring-1 ring-slate-300 text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 transition-colors"
            >
              Басты бет
            </button>
            {/* Профиль кнопкасы (логотип) АЛЫП ТАСТАЛДЫ */}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-4 py-6">
        {/* Search */}
        <form onSubmit={onSubmit} className="mb-6">
          <label htmlFor="q" className="sr-only">
            Тақырыпты іздеу
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <SearchIcon />
            </div>
            <input
              id="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Тақырыпты іздеу…"
              autoComplete="off"
              className="w-full pl-11 pr-28 py-3 rounded-xl ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 placeholder:text-slate-400 bg-white"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              Ашу
            </button>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Көрсетіліп тұрғандар: {filtered.length} / {topics.length}
          </div>
        </form>

        {/* States */}
        {loading && (
          <ul className="space-y-3" aria-hidden>
            {Array.from({ length: 8 }).map((_, i) => (
              <li
                key={i}
                className="h-16 rounded-xl bg-slate-100 animate-pulse ring-1 ring-slate-200"
              />
            ))}
          </ul>
        )}

        {!loading && error && (
          <div className="rounded-xl bg-rose-50 ring-1 ring-rose-200 text-rose-700 px-4 py-3">
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200 px-6 py-10 text-center text-slate-600">
            <div className="text-5xl mb-2">📄</div>
            Бұл пәнде тақырып табылмады.
            <div className="text-sm mt-1">Кілт сөзді қысқартып көріңіз.</div>
          </div>
        )}

        {/* Full-width list */}
        {!loading && !error && filtered.length > 0 && (
          <nav
            aria-label="Тақырыптар тізімі"
            className="divide-y divide-slate-200/70 rounded-xl ring-1 ring-slate-200 bg-white"
          >
            {filtered.map((t) => {
              const color = colorFor(t.name);
              return (
                <button
                  key={t.id}
                  onClick={() => navigate(`/topics/${t.id}/quizzes`)}
                  className="w-full text-left px-4 py-4 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 transition flex items-center gap-4"
                >
                  <div
                    className={`w-12 h-12 grid place-items-center rounded-xl ring ${color} text-lg font-bold`}
                  >
                    {initial(t.name)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-slate-900 text-lg font-semibold truncate">
                      {t.name}
                    </div>
                    <div className="text-slate-500 text-sm">
                      Басу арқылы осы тақырыптан quiz басталады
                    </div>
                  </div>

                  <div className="text-slate-300 group-hover:text-slate-500">
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
