// src/pages/QuizPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { FiCheckCircle, FiXCircle } from "react-icons/fi";

interface Quiz {
  id: number;
  question: string;
  options: string[];
}

interface CheckResult {
  correct: boolean;
  correct_answer?: string;
}

interface UserAnswer {
  quiz_id: number;
  selected_answer: string;
  is_correct: boolean;
  correct_answer?: string;
  question?: string; // финалдық есеп үшін
}

const API = "http://127.0.0.1:8000";

export default function QuizPage() {
  const { id } = useParams(); // topic_id
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [showResult, setShowResult] = useState(false);

  // Quiz-дарды жүктеу
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${API}/api/topics/${id}/quizzes`)
      .then((res) => {
        if (!res.ok) throw new Error("Quiz жүктелмеді");
        return res.json();
      })
      .then((data) => setQuizzes(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  // Жауапты тексеру
  const checkAnswer = async (quizId: number, selectedAnswer: string): Promise<CheckResult> => {
    try {
      const response = await fetch(`${API}/api/quizzes/${quizId}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selected_answer: selectedAnswer }),
      });
      if (!response.ok) throw new Error("Жауапты тексеру мүмкін болмады");
      const result = (await response.json()) as CheckResult;
      return { correct: !!result.correct, correct_answer: result.correct_answer };
    } catch (error) {
      console.error("Жауапты тексеру қатесі:", error);
      return { correct: false };
    }
  };

  // Таңдау: ЕНДІ «Тексеру» басқанға дейін еркін өзгереді (toggle)
  const handleSelect = (option: string) => {
    if (showResult || isChecking) return;
    setSelected((prev) => (prev === option ? null : option));
  };

  // Тексеру
  const submitAnswer = async () => {
    if (!selected || isChecking) return;

    setIsChecking(true);
    const q = quizzes[current];
    const { correct, correct_answer } = await checkAnswer(q.id, selected);

    const ua: UserAnswer = {
      quiz_id: q.id,
      selected_answer: selected,
      is_correct: correct,
      correct_answer,
      question: q.question,
    };
    setUserAnswers((prev) => [...prev, ua]);
    if (correct) setScore((s) => s + 1);

    setShowResult(true);
    setIsChecking(false);
  };

  // Келесі сұрақ
  const nextQuestion = () => {
    if (current + 1 < quizzes.length) {
      setCurrent((c) => c + 1);
      setSelected(null);
      setShowResult(false);
    } else {
      setFinished(true);
    }
  };

  const restartQuiz = () => {
    setCurrent(0);
    setSelected(null);
    setUserAnswers([]);
    setScore(0);
    setFinished(false);
    setShowResult(false);
    setIsChecking(false);
  };

  const progress = useMemo(
    () => (quizzes.length ? Math.round(((current + 1) / quizzes.length) * 100) : 0),
    [current, quizzes.length]
  );

  if (loading) return <div className="container py-5 text-center">Жүктелуде...</div>;
  if (error) return <div className="container py-5 text-danger text-center">{error}</div>;
  if (quizzes.length === 0)
    return (
      <div className="container py-5">
        <div className="alert alert-info">Бұл тақырыпта Quiz жоқ.</div>
      </div>
    );

  // Аяқталды → толық есеп көрінісі
  if (finished) {
    const percent = Math.round((score / quizzes.length) * 100);
    return (
      <div className="container py-4">
        {/* Градиентті hero */}
        <div
          className="rounded-4 p-4 mb-4 text-white"
          style={{
            background: "linear-gradient(135deg, #0d6efd, #20c997)",
            boxShadow: "0 14px 36px rgba(13,110,253,.28)",
          }}
        >
          <h2 className="m-0">{percent >= 70 ? "🎉 Жарайсың!" : "😕 Әлі де дайындалу керек"}</h2>
          <p className="opacity-75 mb-3">Дұрыс жауаптар: <strong>{score} / {quizzes.length}</strong></p>
          <div className="progress" style={{ height: 10, background: "rgba(255,255,255,.25)" }}>
            <div
              className="progress-bar"
              style={{
                width: `${percent}%`,
                background: "linear-gradient(90deg,#fff,#ffe5a3)",
                color: "#000",
              }}
            >
              {percent}%
            </div>
          </div>
        </div>

        {/* Толық есеп: сұрақтар тізімі */}
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body">
            <h5 className="mb-3">Толық есеп</h5>
            <ul className="list-group list-group-flush">
              {userAnswers.map((a, idx) => {
                const ok = a.is_correct;
                return (
                  <li key={a.quiz_id} className="list-group-item d-flex align-items-start gap-3">
                    <div
                      className={`rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 ${ok ? "bg-success" : "bg-danger"}`}
                      style={{ width: 34, height: 34, color: "white", boxShadow: `0 6px 16px rgba(${ok ? "25,135,84" : "220,53,69"},.35)` }}
                    >
                      {ok ? <FiCheckCircle /> : <FiXCircle />}
                    </div>
                    <div className="flex-grow-1">
                      <div className="fw-semibold mb-1">
                        {idx + 1}. {a.question}
                      </div>
                      <div className="small">
                        Сіздің жауабыңыз:{" "}
                        <span className={`fw-semibold ${ok ? "text-success" : "text-danger"}`}>
                          {a.selected_answer}
                        </span>
                        {!ok && a.correct_answer && (
                          <>
                            {" "}· Дұрысы: <span className="fw-semibold text-success">{a.correct_answer}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 d-flex gap-2">
              <button onClick={restartQuiz} className="btn btn-primary">Қайта тапсыру</button>
              <Link to="/" className="btn btn-outline-secondary">Басты бетке</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Ағымдағы сұрақ көрінісі
  const q = quizzes[current];
  const currentAnswer = userAnswers.find((ans) => ans.quiz_id === q.id);

  return (
    <div className="container py-4">
      {/* Градиентті hero */}
      <div
        className="rounded-4 p-3 p-md-4 mb-4 text-white"
        style={{
          background: "linear-gradient(135deg, #6f42c1, #0d6efd)",
          boxShadow: "0 12px 30px rgba(13,110,253,.35)",
        }}
      >
        <div className="d-flex justify-content-between align-items-center">
          <Link to={`/subjects`} className="btn btn-light btn-sm">
            <FaArrowLeft className="me-2" />
            Артқа
          </Link>
          <div className="small">Сұрақ {current + 1} / {quizzes.length}</div>
        </div>
        <div className="progress mt-3" style={{ height: 8, background: "rgba(255,255,255,.25)" }}>
          <div
            className="progress-bar"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg,#ffe484,#ffffff)",
              color: "#000",
            }}
          />
        </div>
      </div>

      {/* Сұрақ карточкасы */}
      <div className="card border-0 shadow-sm mb-3 rounded-4">
        <div className="card-body">
          <h5 className="mb-4">{q.question}</h5>

          <div className="d-grid gap-2">
            {q.options.map((opt, i) => {
              const isSelected = selected === opt;

              // Әдепкі стиль
              let btnClass = "btn btn-outline-primary";

              // Нәтиже сәті: тек таңдалған нұсқа боялады (жасыл/қызыл), қалғандары сұр
              if (showResult && currentAnswer) {
                if (isSelected) {
                  btnClass = currentAnswer.is_correct ? "btn btn-success" : "btn btn-danger";
                } else {
                  btnClass = "btn btn-outline-secondary";
                }
              } else if (isSelected) {
                // Таңдалған, бірақ тексерілмеген — градиентті primary
                btnClass = "btn btn-primary";
              }

              // Жұмсақ көлеңке
              const softStyle: React.CSSProperties =
                showResult && isSelected
                  ? {
                      boxShadow: currentAnswer?.is_correct
                        ? "0 0 0 0.18rem rgba(25,135,84,.25)"
                        : "0 0 0 0.18rem rgba(220,53,69,.25)",
                      opacity: 0.98,
                    }
                  : isSelected
                  ? { boxShadow: "0 8px 20px rgba(13,110,253,.25)" }
                  : {};

              return (
                <button
                  key={i}
                  className={`${btnClass} rounded-pill py-2`}
                  style={softStyle}
                  onClick={() => handleSelect(opt)}
                  // ЕНДІ тексерілгеннен кейін ғана бұғатталады — дейін еркін ауыстырады
                  disabled={showResult || isChecking}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Нәтиже көрсету */}
      {showResult && currentAnswer && (
        <div className={`alert ${currentAnswer.is_correct ? "alert-success" : "alert-danger"} rounded-4`}>
          <div className="d-flex justify-content-between align-items-center">
            <strong>{currentAnswer.is_correct ? "🎉 Дұрыс жауап!" : "😔 Қате жауап!"}</strong>
            {!currentAnswer.is_correct && currentAnswer.correct_answer && (
              <small className="text-muted">
                Дұрыс жауабы: <strong>{currentAnswer.correct_answer}</strong>
              </small>
            )}
          </div>
        </div>
      )}

      {/* Басқару батырмалары */}
      <div className="d-flex justify-content-end gap-2">
        {!showResult ? (
          <button
            className="btn btn-primary btn-lg rounded-pill px-4"
            onClick={submitAnswer}
            disabled={!selected || isChecking}
          >
            {isChecking && <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />}
            Тексеру
          </button>
        ) : (
          <button className="btn btn-success btn-lg rounded-pill px-4" onClick={nextQuestion}>
            {current + 1 < quizzes.length ? "Келесі" : "Аяқтау"}
          </button>
        )}
      </div>
    </div>
  );
}
