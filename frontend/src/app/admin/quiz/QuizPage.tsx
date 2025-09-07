// src/pages/QuizPage.tsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";

interface Quiz {
  id: number;
  question: string;
  options: string[];
  correct_answer: string;
}

export default function QuizPage() {
  const { id } = useParams(); // topic_id
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`http://127.0.0.1:8000/api/topics/${id}/quizzes`)
      .then((res) => {
        if (!res.ok) throw new Error("Quiz жүктелмеді");
        return res.json();
      })
      .then((data) => setQuizzes(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSelect = (option: string) => {
    if (selected) return; // бір рет қана таңдайды
    setSelected(option);
    if (option === quizzes[current].correct_answer) {
      setScore((s) => s + 1);
    }
  };

  const nextQuestion = () => {
    if (current + 1 < quizzes.length) {
      setCurrent((c) => c + 1);
      setSelected(null);
    } else {
      setFinished(true);
    }
  };

  if (loading) return <div className="container py-4">Жүктелуде…</div>;
  if (error) return <div className="container py-4 text-danger">{error}</div>;
  if (quizzes.length === 0)
    return (
      <div className="container py-4">
        <div className="alert alert-info">Бұл тақырыпта Quiz жоқ.</div>
      </div>
    );

  if (finished) {
    const percent = Math.round((score / quizzes.length) * 100);
    return (
      <div className="container py-5 text-center">
        <h2 className="mb-3">
          {percent >= 70 ? "🎉 Жарайсың!" : "😕 Әлі де дайындалу керек"}
        </h2>
        <p>
          Дұрыс жауаптар: {score} / {quizzes.length} ({percent}%)
        </p>
        <Link to={`/topics/${id}/quizzes`} className="btn btn-primary mt-3">
          Қайта тапсыру
        </Link>
        <Link to="/" className="btn btn-outline-secondary mt-3 ms-2">
          Басты бетке
        </Link>
      </div>
    );
  }

  const q = quizzes[current];
  const progress = Math.round(((current + 1) / quizzes.length) * 100);

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <Link to={`/subjects`} className="btn btn-outline-secondary">
          <FaArrowLeft className="me-2" />
          Артқа
        </Link>
        <div className="text-muted small">
          Сұрақ {current + 1} / {quizzes.length}
        </div>
      </div>

      <div className="progress mb-4" style={{ height: 8 }}>
        <div
          className="progress-bar"
          role="progressbar"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <h5 className="mb-4">{q.question}</h5>
          <div className="d-grid gap-2">
            {q.options.map((opt, i) => {
              const isSelected = selected === opt;
              const isCorrect = q.correct_answer === opt;
              const btnClass =
                selected == null
                  ? "btn btn-outline-primary"
                  : isSelected
                  ? isCorrect
                    ? "btn btn-success"
                    : "btn btn-danger"
                  : isCorrect
                  ? "btn btn-success"
                  : "btn btn-outline-secondary";

              return (
                <button
                  key={i}
                  className={btnClass}
                  onClick={() => handleSelect(opt)}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {selected && (
        <div className="d-flex justify-content-end">
          <button className="btn btn-primary" onClick={nextQuestion}>
            {current + 1 < quizzes.length ? "Келесі" : "Аяқтау"}
          </button>
        </div>
      )}
    </div>
  );
}
