// src/app/pages/HomePage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axiosClient from "../api/axiosClient";

type Subject = { id: number; name: string };

export default function HomePage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const uid = localStorage.getItem("user_id");

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
  const colorFor = (name: string) => {
    const sum = Array.from(name).reduce((a, c) => a + c.charCodeAt(0), 0);
    return colorPool[sum % colorPool.length];
  };
  const initial = (name: string) =>
    name.trim().charAt(0).toUpperCase() || "∎";

  const MarkMatch = ({ text, q }: { text: string; q: string }) => {
    if (!q) return <>{text}</>;
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i === -1) return <>{text}</>;
    return (
      <>
        {text.slice(0, i)}
        <mark className="bg-yellow-200 text-slate-900 rounded px-0.5">
          {text.slice(i, i + q.length)}
        </mark>
        {text.slice(i + q.length)}
      </>
    );
  };

  // 🔥 НАЗАР: axiosClient қолданамыз, fetch емес
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await axiosClient.get("/subjects");
        setSubjects(Array.isArray(res.data) ? res.data : []);
      } catch (e: any) {
        if (e?.response?.status === 401) {
          setError("Сессия аяқталды. Қайта кіріңіз.");
        } else {
          setError("Пәндер жүктелмеді.");
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const arr = q
      ? subjects.filter((s) => s.name.toLowerCase().includes(q))
      : subjects.slice();
    return arr.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
  }, [subjects, query]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid || filtered.length === 0) return;
    const first = filtered[0];
    // ✅ ID арқылы барамыз
    navigate(`/u/${uid}/subjects/${first.id}/topics`);
  };

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

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Пәндер
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">
              Барлығы: <b>{subjects.length}</b>
            </span>
            <button
              type="button"
              onClick={() => uid && navigate(`/u/${uid}/quiz-jasau`)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium ring-1 ring-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Құру
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <form onSubmit={onSubmit} className="mb-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
              <SearchIcon />
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Пәнді іздеу…"
              className="w-full pl-11 pr-28 py-3 rounded-xl ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-600 bg-white text-slate-900"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700"
            >
              Ашу
            </button>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Нәтиже: {filtered.length} / {subjects.length}
          </div>
        </form>

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
            <div className="text-5xl mb-2">🔎</div>
            Сәйкес пән табылмады.
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <nav className="divide-y divide-slate-200/70 rounded-xl ring-1 ring-slate-200 bg-white">
            {filtered.map((s) => {
              const color = colorFor(s.name);
              return (
                <button
                  key={s.id}
                  onClick={() =>
                    uid && navigate(`/u/${uid}/subjects/${s.id}/topics`)
                  }
                  className="w-full text-left px-4 py-4 hover:bg-slate-50 flex items-center gap-4"
                >
                  <div
                    className={`w-12 h-12 grid place-items-center rounded-xl ring ${color} text-lg font-bold`}
                  >
                    {initial(s.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-slate-900 text-lg font-semibold truncate">
                      <MarkMatch text={s.name} q={query} />
                    </div>
                    <div className="text-slate-500 text-sm">
                      Басу арқылы тақырыптарға өтіңіз
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
