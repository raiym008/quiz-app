// src/pages/AdminPanel.tsx
import { useEffect, useMemo, useState } from "react";
import QuizEditor from "./quiz/QuizEditor";
import { FaTrash } from "react-icons/fa";

type Subject = { id: number; name: string };
type Topic = { id: number; name: string };

const API = "http://127.0.0.1:8000";

// Егер backend-те X-Admin-Token тексеріс қоссаң – мынаған мән бер:
const ADMIN_HEADERS: HeadersInit = {
  "Content-Type": "application/json",
  // "X-Admin-Token": "supersecret",
};

export default function AdminPanel() {
  // Step 1: Subject
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectName, setSubjectName] = useState("");
  const [selectedSubjectName, setSelectedSubjectName] = useState("");

  // Step 2: Topic
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicName, setTopicName] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);

  // Step 3: Quiz
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState<number>(0);

  const canProceedToTopics = useMemo(() => subjects.length > 0, [subjects]);
  const canProceedToQuiz = useMemo(
    () => !!selectedSubjectName && selectedTopicId !== null,
    [selectedSubjectName, selectedTopicId]
  );

  // Load subjects
  useEffect(() => {
    fetch(`${API}/api/subjects`)
      .then((r) => r.json())
      .then((data) => setSubjects(Array.isArray(data) ? data : []))
      .catch(() => setSubjects([]));
  }, []);

  // Load topics for selected subject
  useEffect(() => {
    if (!selectedSubjectName) {
      setTopics([]);
      setSelectedTopicId(null);
      return;
    }
    const subjectUrl = encodeURIComponent(
      selectedSubjectName.toLowerCase().replace(/\s+/g, "-")
    );
    fetch(`${API}/api/subjects/${subjectUrl}/topics`)
      .then((r) => r.json())
      .then((data) => setTopics(Array.isArray(data) ? data : []))
      .catch(() => setTopics([]));
  }, [selectedSubjectName]);

  // Add Subject
  const addSubject = async () => {
    const name = subjectName.trim();
    if (!name) return;
    const res = await fetch(`${API}/api/subjects`, {
      method: "POST",
      headers: ADMIN_HEADERS,
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (data?.id) {
      setSubjects((prev) => [...prev, { id: data.id, name: data.name ?? name }]);
      setSubjectName("");
      setSelectedSubjectName(data.name ?? name);
    } else {
      alert(data?.detail || "Пән қосылмады");
    }
  };

  // Delete Subject
  const deleteSubject = async (id: number) => {
    const target = subjects.find((s) => s.id === id);
    if (!target) return;
    if (!confirm(`"${target.name}" пәнін өшіреміз бе? Бұл оның тақырыптары мен quiz-дерін де өшіреді.`)) return;

    const res = await fetch(`${API}/api/subjects/${id}`, {
      method: "DELETE",
      headers: ADMIN_HEADERS,
    });
    if (!res.ok) {
      const msg = await res.json().catch(() => ({}));
      alert(msg?.detail || "Өшіру сәтсіз");
      return;
    }
    // UI state жаңарту
    setSubjects((prev) => prev.filter((s) => s.id !== id));
    if (selectedSubjectName === target.name) {
      setSelectedSubjectName("");
      setTopics([]);
      setSelectedTopicId(null);
    }
  };

  // Add Topic
  const addTopic = async () => {
    const tname = topicName.trim();
    if (!selectedSubjectName || !tname) return;
    const subjectUrl = encodeURIComponent(selectedSubjectName);
    const res = await fetch(`${API}/api/subjects/${subjectUrl}/topics`, {
      method: "POST",
      headers: ADMIN_HEADERS,
      body: JSON.stringify({ name: tname }),
    });
    const data = await res.json();
    if (data?.id) {
      const newTopic: Topic = { id: data.id, name: tname };
      setTopics((prev) => [...prev, newTopic]);
      setTopicName("");
      setSelectedTopicId(newTopic.id);
    } else {
      alert(data?.detail || "Тақырып қосылмады");
    }
  };

  // Delete Topic
  const deleteTopic = async (id: number) => {
    const target = topics.find((t) => t.id === id);
    if (!target) return;
    if (!confirm(`"${target.name}" тақырыбын өшіреміз бе? Бұл оның quiz-дерін де өшіреді.`)) return;

    const res = await fetch(`${API}/api/topics/${id}`, {
      method: "DELETE",
      headers: ADMIN_HEADERS,
    });
    if (!res.ok) {
      const msg = await res.json().catch(() => ({}));
      alert(msg?.detail || "Өшіру сәтсіз");
      return;
    }
    // UI state жаңарту
    setTopics((prev) => prev.filter((t) => t.id !== id));
    if (selectedTopicId === id) setSelectedTopicId(null);
  };

  // Save Quiz
  const saveQuiz = async () => {
    if (!canProceedToQuiz) return;
    if (!question.trim()) return alert("Сұрақ мәтінін енгізіңіз.");
    if (options.some((o) => !o.trim())) return alert("Барлық нұсқаларды толтырыңыз.");

    const topicId = selectedTopicId!;
    const payload = {
      question: question.trim(),
      options: options.map((o) => o.trim()),
      correct_answer: options[correctIndex].trim(),
    };

    const res = await fetch(`${API}/api/topics/${topicId}/quizzes`, {
      method: "POST",
      headers: ADMIN_HEADERS,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data?.message) {
      setQuestion("");
      setOptions(["", "", "", ""]);
      setCorrectIndex(0);
      alert("Quiz қосылды ✅");
    } else {
      alert(data?.detail || "Quiz қосылмады");
    }
  };

  const Step = ({ n, title, active }: { n: number; title: string; active: boolean }) => (
    <div className="d-flex align-items-center gap-2">
      <div
        className={`rounded-circle ${active ? "bg-primary" : "bg-light"} text-${active ? "white" : "muted"} d-flex align-items-center justify-content-center`}
        style={{ width: 28, height: 28, fontSize: 14 }}
      >
        {n}
      </div>
      <span className={`fw-medium ${active ? "" : "text-muted"}`}>{title}</span>
    </div>
  );

  return (
    <div className="container py-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h2 className="m-0">Админ Панель</h2>
      </div>

      <div className="d-flex gap-4 mb-4">
        <Step n={1} title="Пән" active />
        <Step n={2} title="Тақырып" active={canProceedToTopics} />
        <Step n={3} title="Quiz" active={canProceedToQuiz} />
      </div>

      {/* Step 1: Subject */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <h5 className="mb-3">1) Пән қосу / таңдау</h5>

          <div className="row g-2 align-items-center mb-3">
            <div className="col-md-6">
              <input
                className="form-control"
                placeholder="Пән атауы (мыс: Информатика)"
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <button className="btn btn-primary w-100" onClick={addSubject}>
                Қосу
              </button>
            </div>
            <div className="col-md-3">
              <select
                className="form-select"
                value={selectedSubjectName}
                onChange={(e) => setSelectedSubjectName(e.target.value)}
              >
                <option value="">— Пәнді таңда —</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Пәндер тізімі + Delete */}
          {subjects.length > 0 && (
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 80 }}>ID</th>
                    <th>Пән</th>
                    <th style={{ width: 120 }} className="text-end">Әрекет</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((s) => (
                    <tr key={s.id} className={selectedSubjectName === s.name ? "table-active" : ""}>
                      <td>#{s.id}</td>
                      <td>{s.name}</td>
                      <td className="text-end">
                        <button className="btn btn-sm btn-outline-danger" onClick={() => deleteSubject(s.id)}>
                          <FaTrash className="me-1" /> Өшіру
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <small className="text-muted d-block mt-2">Пән таңдалмайынша келесі қадам ашылмайды.</small>
        </div>
      </div>

      {/* Step 2: Topic */}
      <fieldset className="card border-0 shadow-sm mb-4" disabled={!selectedSubjectName}>
        <div className="card-body">
          <h5 className="mb-3">2) {selectedSubjectName || "…"} пәніне тақырып</h5>
          <div className="row g-2 align-items-center mb-3">
            <div className="col-md-6">
              <input
                className="form-control"
                placeholder="Тақырып атауы"
                value={topicName}
                onChange={(e) => setTopicName(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <button className="btn btn-success w-100" onClick={addTopic}>
                Қосу
              </button>
            </div>
            <div className="col-md-3">
              <select
                className="form-select"
                value={selectedTopicId ?? ""}
                onChange={(e) => setSelectedTopicId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">— Тақырыпты таңда —</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Тақырыптар тізімі + Delete */}
          {topics.length > 0 && (
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 80 }}>ID</th>
                    <th>Тақырып</th>
                    <th style={{ width: 120 }} className="text-end">Әрекет</th>
                  </tr>
                </thead>
                <tbody>
                  {topics.map((t) => (
                    <tr key={t.id} className={selectedTopicId === t.id ? "table-active" : ""}>
                      <td>#{t.id}</td>
                      <td>{t.name}</td>
                      <td className="text-end">
                        <button className="btn btn-sm btn-outline-danger" onClick={() => deleteTopic(t.id)}>
                          <FaTrash className="me-1" /> Өшіру
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <small className="text-muted">Тақырып таңдалмайынша Quiz бөлімі ашылмайды.</small>
        </div>
      </fieldset>

      {/* Step 3: Quiz */}
      <fieldset className="card border-0 shadow-sm" disabled={!canProceedToQuiz}>
        <div className="card-body">
          <h5 className="mb-3">3) Quiz сұрақ пен нұсқалар</h5>

          <div className="mb-3">
            <QuizEditor value={question} onChange={setQuestion} />
          </div>

          <div className="row g-2 mb-3">
            {options.map((opt, idx) => (
              <div className="col-md-6" key={idx}>
                <div className="input-group">
                  <span className="input-group-text">{String.fromCharCode(65 + idx)}</span>
                  <input
                    className="form-control"
                    placeholder={`Нұсқа ${String.fromCharCode(65 + idx)}`}
                    value={opt}
                    onChange={(e) => {
                      const next = [...options];
                      next[idx] = e.target.value;
                      setOptions(next);
                    }}
                  />
                  <span className="input-group-text">
                    <input
                      type="radio"
                      name="correct"
                      checked={correctIndex === idx}
                      onChange={() => setCorrectIndex(idx)}
                      title="Дұрыс жауап"
                    />
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="d-flex justify-content-end">
            <button className="btn btn-primary" onClick={saveQuiz}>
              Сақтау
            </button>
          </div>
        </div>
      </fieldset>
    </div>
  );
}
