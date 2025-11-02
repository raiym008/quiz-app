// src/app/admin/quiz/QuizPage.tsx
import { useEffect, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { API_BASE } from "../../api/axiosClient";

type Quiz = {
  id: number;
  question: string;   // Markdown
  options: string[];  // Markdown болуы мүмкін
};

type CheckResult = {
  correct: boolean;
  correct_answer?: string;
  correct_index?: number; // егер сервер жіберсе
};

type FinalRow = {
  quiz_id: number;
  question: string;
  options: string[];
  selected_index: number | null;
  selected_answer?: string;
  is_correct: boolean;
  correct_answer?: string;
  correct_index?: number;
};

const API = API_BASE;

/* Markdown safety */
function safeMarkdown(md: string): string {
  let s = md ?? "";

  // ``` codeblocks
  const blocks: string[] = [];
  s = s.replace(/```[\s\S]*?```/g, (m) => {
    const i = blocks.push(m) - 1;
    return `\u0000BLOCK${i}\u0000`;
  });

  // **strong**
  const strong: string[] = [];
  s = s.replace(/\*\*([^*]+)\*\*/g, (m) => {
    const i = strong.push(m) - 1;
    return `\u0000STR${i}\u0000`;
  });

  // *em*
  const em: string[] = [];
  s = s.replace(/\*([^*\n]+)\*/g, (m) => {
    const i = em.push(m) - 1;
    return `\u0000EM${i}\u0000`;
  });

  // басқа жұлдызшаларды эскейптейміз
  s = s.replace(/\*/g, "\\*");

  // restore
  s = s
    .replace(/\u0000EM(\d+)\u0000/g, (_m, i) => em[Number(i)])
    .replace(/\u0000STR(\d+)\u0000/g, (_m, i) => strong[Number(i)])
    .replace(/\u0000BLOCK(\d+)\u0000/g, (_m, i) => blocks[Number(i)]);

  return s.trim();
}

/* Пернетақтада мәтін енгізіп жатқан элемент пе? */
function isEditableTarget(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  if (!node) return false;
  if (node.isContentEditable) return true;
  const tag = (node.tagName || "").toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
}

export default function QuizPage() {
  const { id } = useParams(); // topic_id
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Навигация/жауап күйі
  const [current, setCurrent] = useState(0);
  const [selections, setSelections] = useState<(number|null)[]>([]); // әр сұрақтың таңдауы
  const selectedIndex = selections[current] ?? null;

  // Финал
  const [finished, setFinished]   = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [checked, setChecked]     = useState(false);
  const [rows, setRows]           = useState<FinalRow[]>([]);
  const [score, setScore]         = useState(0);

  /* ---------------- Quizzes load */
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${API}/topics/${id}/quizzes`)
      .then((r) => {
        if (!r.ok) throw new Error("Сұрақтар жүктелмеді");
        return r.json();
      })
      .then((data) => setQuizzes(Array.isArray(data) ? data : []))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Белгісіз қате"))
      .finally(() => setLoading(false));
  }, [id]);

  // Сұрақтар келгенде selections-ті дайындау
  useEffect(() => {
    if (quizzes.length) {
      setSelections(new Array(quizzes.length).fill(null));
      setCurrent(0);
      setFinished(false);
      setChecked(false);
      setRows([]);
      setScore(0);
    }
  }, [quizzes.length]);

  /* ---------------- Helpers */
  const goTo = useCallback((idx: number) => {
    if (idx < 0 || idx >= quizzes.length) return;
    setCurrent(idx);
  }, [quizzes.length]);

  // ✅ Стандартты мінез: қайта басса — таңдаудан алынады (toggle)
  const choose = (idx: number) => {
    setSelections((prev) => {
      const next = [...prev];
      next[current] = (next[current] === idx ? null : idx);
      return next;
    });
  };

  const next = useCallback(() => {
    if (current + 1 < quizzes.length) goTo(current + 1);
    else setFinished(true); // соңғы сұрақтан кейін аяқтау
  }, [current, quizzes.length, goTo]);

  const back = useCallback(() => {
    if (current > 0) goTo(current - 1);
  }, [current, goTo]);

  /* ---------------- Пернетақтамен басқару (←/→) */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (finished) return; // нәтижеде стрелка өшіріледі
      if (isEditableTarget(e.target)) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        back();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [back, next, finished]);

  /* ---------------- API: single check (index-пен бірге) */
  const checkAnswer = async (
    quizId: number,
    selected_index: number | null,
    selected_answer?: string
  ): Promise<CheckResult> => {
    try {
      const r = await fetch(`${API}/api/quizzes/${quizId}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selected_index, selected_answer }),
      });
      if (!r.ok) throw new Error("Жауапты тексеру мүмкін болмады");
      const data = (await r.json()) as CheckResult;
      return {
        correct: !!data.correct,
        correct_answer: data.correct_answer,
        correct_index: typeof data.correct_index === "number" ? data.correct_index : undefined,
      };
    } catch {
      return { correct: false };
    }
  };

  /* ---------------- Final verify once */
  useEffect(() => {
    const run = async () => {
      if (!finished || checked || quizzes.length === 0) return;
      setVerifying(true);
      try {
        // базалық кесте
        const base: FinalRow[] = quizzes.map((q, i) => {
          const selIdx = selections[i];
          const selAns = selIdx !== null ? q.options[selIdx] : undefined;
          return {
            quiz_id: q.id,
            question: q.question,
            options: q.options,
            selected_index: selIdx,
            selected_answer: selAns,
            is_correct: false,
          };
        });

        // тек жауап берілгендерге тексеріс
        const checkedRows = await Promise.all(
          base.map(async (row) => {
            if (row.selected_index === null || !row.selected_answer) return row;
            const { correct, correct_answer, correct_index } = await checkAnswer(
              row.quiz_id,
              row.selected_index,
              row.selected_answer
            );

            const resolvedCorrectIndex =
              typeof correct_index === "number" && correct_index >= 0
                ? correct_index
                : (row.options?.findIndex((o) => o === (correct_answer ?? "__NA__")) ?? -1);

            return {
              ...row,
              is_correct: correct,
              correct_answer,
              correct_index: resolvedCorrectIndex,
            };
          })
        );

        setRows(checkedRows);
        setScore(checkedRows.filter((r) => r.is_correct).length);
        setChecked(true);
      } finally {
        setVerifying(false);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, checked]);

  const restart = () => {
    setCurrent(0);
    setSelections(new Array(quizzes.length).fill(null));
    setFinished(false);
    setChecked(false);
    setRows([]);
    setScore(0);
  };

  /* ---------------- Render states */
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-b from-slate-50 to-sky-50 text-slate-600">
        Жүктелуде…
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-b from-rose-50 to-orange-50/30">
        <div className="text-rose-700 bg-white/80 border border-rose-200 rounded-2xl px-6 py-4 shadow">
          {error}
        </div>
      </div>
    );
  }
  if (quizzes.length === 0) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50 text-slate-600">
        Бұл тақырыпта Quiz жоқ.
      </div>
    );
  }

  /* ---------------- Finished page */
  if (finished) {
    const total   = quizzes.length;
    const percent = Math.round((score / total) * 100);

    return (
      <div className="min-h-screen bg-[linear-gradient(135deg,_#fafafa,_#f0f9ff_40%,_#f0fdf4)] py-10 px-4">
        <div className="mx-auto max-w-5xl">
          {/* Summary */}
          <div className="relative overflow-hidden rounded-3xl p-6 md:p-8 shadow-xl bg-gradient-to-r from-sky-500 to-emerald-500 text-white">
            <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-white/15 blur-2xl" />
            <div className="flex flex-wrap items-center justify-between gap-6 relative z-10">
              <div>
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Нәтиже</h1>
                <p className="opacity-90 mt-1">Тақырып бойынша қорытынды</p>
              </div>
              <div className="grid place-items-center">
                <div className="w-28 h-28 md:w-32 md:h-32 rounded-full bg-white/20 ring-2 ring-white/50 shadow-inner grid place-items-center">
                  <div className="text-center">
                    <div className="text-3xl md:text-4xl font-black leading-none">{percent}%</div>
                    <div className="text-xs opacity-90 mt-1">дәлдік</div>
                  </div>
                </div>
                <div className="mt-3 text-sm">
                  ✅ {score} / {total}
                </div>
              </div>
            </div>
          </div>

          {verifying && (
            <div className="mt-4 text-sm text-sky-900 bg-sky-50 border border-sky-200 rounded-xl px-4 py-3">
              Нәтижелер есептелуде…
            </div>
          )}

          {/* Questions list */}
          <div className="mt-6 space-y-4">
            {rows.map((r, idx) => {
              const ok = r.is_correct;
              return (
                <div
                  key={`${r.quiz_id}-${idx}`}
                  className={`rounded-2xl shadow-sm border p-5 md:p-6 bg-white/90 backdrop-blur
                              ${ok ? "border-emerald-200" : "border-rose-200"}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-2 rounded-full mt-0.5 self-stretch ${ok ? "bg-emerald-500" : "bg-rose-500"}`} aria-hidden />
                    <div className="flex-1">
                      {/* Question */}
                      <div className="prose prose-slate max-w-none">
                        <div className="text-slate-900 font-semibold text-base md:text-lg">
                          {idx + 1}.{" "}
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({children}) => <span>{children}</span> }}>
                            {safeMarkdown(r.question)}
                          </ReactMarkdown>
                        </div>
                      </div>

                      {/* Correct answer */}
                      <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-1.5 ring-1 ring-emerald-200">
                        <span className="text-emerald-700 text-sm font-medium">Дұрыс жауап:</span>
                        <span className="text-emerald-700 text-sm font-semibold prose prose-slate max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({children}) => <span>{children}</span> }}>
                            {r.correct_answer ?? "—"}
                          </ReactMarkdown>
                        </span>
                      </div>

                      {/* Your answer */}
                      <div className="mt-2 text-sm text-slate-700">
                        Сіздің жауабыңыз:{" "}
                        <span className={`${ok ? "text-emerald-600" : "text-rose-600"} font-semibold prose prose-slate max-w-none`}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({children}) => <span>{children}</span> }}>
                            {r.selected_index !== null ? (r.selected_answer ?? "—") : "— Жауап берілмеген"}
                          </ReactMarkdown>
                        </span>
                        {r.selected_index !== null && !ok && <span className="text-rose-600 font-semibold ms-2">— Қате</span>}
                      </div>

                      {/* Option chips */}
                      {Array.isArray(r.options) && r.options.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {r.options.map((opt, optIdx) => {
                            const isUser    = optIdx === r.selected_index;
                            const isCorrect = optIdx === (r.correct_index ?? -1);

                            let cls = "px-3 py-1 rounded-full text-xs font-medium border border-slate-200 bg-slate-50 text-slate-700";
                            if (isCorrect) {
                              cls = "px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border-emerald-200";
                            }
                            if (!isCorrect && isUser && !ok) {
                              cls = "px-3 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-700 border-rose-200";
                            }
                            if (isUser && ok) {
                              cls = "px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border-emerald-200";
                            }

                            return (
                              <span key={`${r.quiz_id}-opt-${optIdx}`} className={cls}>
                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({children}) => <span>{children}</span> }}>
                                  {safeMarkdown(opt)}
                                </ReactMarkdown>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex justify-center gap-3 mt-8">
            <button
              onClick={restart}
              className="px-5 py-2.5 rounded-xl bg-sky-600 text-white font-medium shadow hover:opacity-95 transition"
            >
              Қайта тапсыру
            </button>
            <Link
              to="/"
              className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium shadow-sm hover:bg-slate-50 transition"
            >
              Басты бетке
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- Quiz in progress (main page) */
  const q = quizzes[current];

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,_#fafafa,_#f7fbff_45%,_#f4fff7)] py-10 px-4">
      <div className="mx-auto max-w-4xl bg-white/95 backdrop-blur border border-slate-100 rounded-3xl shadow-md p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <Link to="/home" className="text-slate-600 hover:text-sky-600 inline-flex items-center gap-2">
            <span aria-hidden>←</span>
            Артқа
          </Link>
          <span className="text-sm text-slate-500">
            Сұрақ {current + 1} / {quizzes.length}
          </span>
        </div>

        {/* Numbered navigator — жеңіл стиль, «жауап берілді» үшін ✓ бейдж */}
        <nav aria-label="Сұрақтар тізімі" className="mb-5 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {quizzes.map((_, i) => {
              const answered = selections[i] !== null;
              const isCurrent = i === current;

              let cls =
                "relative inline-flex items-center justify-center w-9 h-9 rounded-full text-[13px] font-medium transition-all duration-200";
              if (isCurrent) {
                cls += " bg-sky-500 text-white shadow ring-4 ring-sky-200";
              } else {
                cls += " bg-white text-slate-700 border border-slate-200 hover:bg-slate-50";
              }

              return (
                <button
                  key={`nav-${i}`}
                  className={cls}
                  onClick={() => goTo(i)}
                  aria-current={isCurrent ? "page" : undefined}
                  title={`Сұрақ ${i + 1}`}
                >
                  {i + 1}
                  {answered && (
                    <span
                      aria-hidden
                      className="absolute -right-0.5 -top-0.5 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-emerald-500 text-white text-[10px] ring-2 ring-white"
                    >
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Прогресс сызығы жоқ */}

        {/* Question */}
        <h2 className="text-lg md:text-xl font-semibold text-slate-900 mb-5 prose prose-slate max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({children}) => <span>{children}</span> }}>
            {safeMarkdown(q.question)}
          </ReactMarkdown>
        </h2>

        {/* Options — radio-like with toggle off */}
        <div role="radiogroup" aria-label="Жауап нұсқалары" className="grid gap-3">
          {q.options.map((opt, i) => {
            const isSelected = selectedIndex === i;

            return (
              <button
                key={`${q.id}-opt-${i}`}
                onClick={() => choose(i)}
                className={`w-full text-left px-4 py-3 rounded-2xl transition ring-1
                  ${isSelected
                    ? "bg-sky-500 text-white ring-sky-400 shadow"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-800 ring-slate-200"}`}
                aria-pressed={isSelected}
                aria-checked={isSelected}
                role="radio"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center justify-center shrink-0 w-5 h-5 rounded-full ring-1
                      ${isSelected ? "bg-white text-sky-600 ring-sky-300" : "bg-white ring-slate-300"}`}
                    aria-hidden
                  >
                    <span className={`block w-2.5 h-2.5 rounded-full ${isSelected ? "bg-sky-600" : "bg-transparent"}`} />
                  </span>

                  <div className="prose prose-slate max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({children}) => <span>{children}</span> }}>
                      {safeMarkdown(opt)}
                    </ReactMarkdown>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Controls: Back / Next or Finish */}
        <div className="mt-8 flex items-center justify-between gap-3">
          <button
            onClick={back}
            disabled={current === 0}
            className={`px-4 py-2.5 rounded-xl font-medium ring-1 transition ${
              current === 0
                ? "ring-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                : "ring-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
            title="Алдыңғы сұрақ (←)"
          >
            ← Қайтару
          </button>

          <button
            onClick={next}
            className={`px-6 py-2.5 rounded-xl font-semibold text-white transition ${
              current + 1 < quizzes.length
                ? "bg-sky-500 hover:bg-sky-600 shadow"
                : "bg-emerald-600 hover:bg-emerald-700 shadow"
            }`}
            title={current + 1 < quizzes.length ? "Келесі сұрақ (→)" : "Тестті аяқтау"}
          >
            {current + 1 < quizzes.length ? "Келесі" : "Аяқтау ✅"}
          </button>
        </div>
      </div>
    </div>
  );
}
