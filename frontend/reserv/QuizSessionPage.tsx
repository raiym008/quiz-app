// src/pages/QuizSessionPage.tsx
import { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaArrowRight, FaCheck, FaTimes, FaUndo, FaHome } from "react-icons/fa";
import { API_BASE } from "../api/axiosClient";

type QuizItem = { id: number; question: string; options: string[] };

const API = API_BASE

export default function QuizSessionPage() {
  const { name } = useParams(); // пән slug (қазақша болуы мүмкін)
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { quizzes?: QuizItem[]; subject?: string } | undefined;

  const quizzes: QuizItem[] = Array.isArray(state?.quizzes) ? state!.quizzes : [];
  const subject = state?.subject ?? (name ? decodeURIComponent(name).replace(/-/g, " ") : undefined);

  // Егер state жоқ болса — TopicsPage → "Емтихан" арқылы келмеген
  if (!quizzes.length) {
    return (
      <div className="container py-5 text-center">
        <div className="alert alert-warning mx-auto" style={{ maxWidth: 640 }}>
          Емтиханды бастау үшін алдымен пән бетінде тақырыптарды таңдап,
          <strong> «Емтихан»</strong> батырмасын басыңыз.
        </div>
        <div className="d-flex gap-2 justify-content-center">
          <button className="btn btn-outline-secondary" onClick={() => navigate(-1)}>
            <FaArrowLeft className="me-2" />
            Артқа
          </button>
          <button className="btn btn-primary" onClick={() => navigate(`/${encodeURIComponent(name||"")}/topics`)}>
            Пән бетіне өту
          </button>
        </div>
      </div>
    );
  }

  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [checked, setChecked] = useState<null | { ok: boolean; correct?: string }>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const q = quizzes[idx];

  const progressPct = useMemo(() => Math.round(((idx + 1) / quizzes.length) * 100), [idx, quizzes.length]);

  const onCheck = async () => {
    if (chosen == null) return;
    try {
      const res = await fetch(`${API}/api/quizzes/${q.id}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selected_answer: q.options[chosen] }),
      });
      const data = await res.json(); // { correct: bool, correct_answer?: str }
      const ok = !!data?.correct;
      setChecked({ ok, correct: data?.correct_answer });
      if (ok) setScore((s) => s + 1);
    } catch {
      setChecked({ ok: false });
    }
  };

  const onNext = () => {
    if (idx + 1 < quizzes.length) {
      setIdx((i) => i + 1);
      setChosen(null);
      setChecked(null);
    } else {
      setFinished(true);
    }
  };

  const onRestart = () => {
    setIdx(0);
    setChosen(null);
    setChecked(null);
    setScore(0);
    setFinished(false);
  };

  if (finished) {
    const percent = Math.round((score / quizzes.length) * 100);
    return (
      <div className="container py-5" style={{ maxWidth: 720 }}>
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center">
            <h3 className="mb-2">Емтихан аяқталды</h3>
            {subject && <div className="text-muted mb-3">Пән: {subject}</div>}
            <div className="display-6 mb-1">{score} / {quizzes.length}</div>
            <div className="text-muted mb-4">{percent}% дұрыс</div>

            <div className="d-flex flex-wrap gap-2 justify-content-center">
              <button className="btn btn-outline-secondary" onClick={() => navigate(-1)}>
                <FaArrowLeft className="me-2" />
                Артқа
              </button>
              <button className="btn btn-primary" onClick={() => navigate("/")}>
                <FaHome className="me-2" />
                Басты бет
              </button>
              <button className="btn btn-success" onClick={onRestart}>
                <FaUndo className="me-2" />
                Қайта өту
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4" style={{ maxWidth: 780 }}>
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h4 className="mb-0">Емтихан</h4>
          {subject && <div className="text-muted small">Пән: {subject}</div>}
        </div>
        <div className="text-end">
          <div className="small text-muted">
            Дұрыс жауап: {score}/{quizzes.length}
          </div>
          <div className="progress" style={{ width: 220, height: 6 }}>
            <div className="progress-bar" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </div>

      {/* Question card */}
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <div className="mb-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
              <span className="badge text-bg-secondary me-2">
                {idx + 1}/{quizzes.length}
              </span>
              <strong>{q.question}</strong>
            </div>
          </div>

          <div className="vstack gap-2">
            {q.options.map((opt, i) => {
              const isChosen = chosen === i;
              const isCorrect = checked?.ok && checked.correct === opt;
              const isWrong = checked && isChosen && !checked.ok;

              return (
                <label
                  key={i}
                  className={`form-check d-flex align-items-center gap-2 p-2 rounded ${
                    isCorrect ? "border border-success bg-success-subtle" :
                    isWrong ? "border border-danger bg-danger-subtle" :
                    "border border-light"
                  }`}
                  style={{ cursor: checked ? "default" : "pointer" }}
                >
                  <input
                    className="form-check-input"
                    type="radio"
                    name="opt"
                    disabled={!!checked}
                    checked={isChosen}
                    onChange={() => setChosen(i)}
                  />
                  <span className="flex-grow-1">{opt}</span>
                  {isCorrect && <span className="text-success d-flex align-items-center"><FaCheck className="me-1" /> Дұрыс</span>}
                  {isWrong && <span className="text-danger d-flex align-items-center"><FaTimes className="me-1" /> Қате</span>}
                </label>
              );
            })}
          </div>

          {/* Actions */}
          <div className="d-flex gap-2 mt-3">
            {!checked ? (
              <button
                className="btn btn-outline-primary"
                disabled={chosen == null}
                onClick={onCheck}
              >
                Жауапты тексеру
              </button>
            ) : (
              <button className="btn btn-primary" onClick={onNext}>
                Келесі <FaArrowRight className="ms-1" />
              </button>
            )}

            <button className="btn btn-outline-secondary" onClick={() => navigate(-1)}>
              <FaArrowLeft className="me-2" />
              Артқа
            </button>
          </div>

          {/* Feedback */}
          {checked && (
            <div className={`alert mt-3 ${checked.ok ? "alert-success" : "alert-danger"}`}>
              {checked.ok ? "Дұрыс!" : (
                <>
                  Қате. Дұрыс жауап: <strong>{checked.correct ?? "—"}</strong>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
