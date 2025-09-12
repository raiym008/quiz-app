// src/pages/AdminPanel.tsx
import { useEffect, useMemo, useState } from "react";
import QuizEditor from "./quiz/QuizEditor";
import { FaTrash } from "react-icons/fa";
import AutomateQuiz from "./quiz/AutomateQuiz";

// ===== Types =====
type Subject = { id: number; name: string };
type Topic = { id: number; name: string };

type QuizOption = {
  id: number;
  text: string;
};

type QuizQuestion = {
  id: number; // local incremental
  text: string;
  options: QuizOption[];
  correctAnswer?: number; // selected option id
};

// ===== API base =====
const API = "http://127.0.0.1:8000";

// Егер backend-те X-Admin-Token тексеріс қосаң — мынаған мән бер:
const ADMIN_JSON_HEADERS: HeadersInit = {
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

  // Step 3A: Manual (бар болғаны – сенің бастапқы логикаң)
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState<number>(0);

  // Step 3B: File mode (жаңа логика)
  const [mode, setMode] = useState<"manual" | "file">("file");
  const [parsedQuestions, setParsedQuestions] = useState<QuizQuestion[]>([]);
  const [parseLoading, setParseLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [saveProgress, setSaveProgress] = useState<number>(0);

  const canProceedToTopics = useMemo(() => subjects.length > 0, [subjects]);
  const canProceedToQuiz = useMemo(
    () => !!selectedSubjectName && selectedTopicId !== null,
    [selectedSubjectName, selectedTopicId]
  );

  // ===== Load subjects =====
  useEffect(() => {
    fetch(`${API}/api/subjects`)
      .then((r) => r.json())
      .then((data) => setSubjects(Array.isArray(data) ? data : []))
      .catch(() => setSubjects([]));
  }, []);

  // ===== Load topics for selected subject =====
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

  // ===== Add Subject =====
  const addSubject = async () => {
    const name = subjectName.trim();
    if (!name) return;
    const res = await fetch(`${API}/api/subjects`, {
      method: "POST",
      headers: ADMIN_JSON_HEADERS,
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (data?.id) {
      setSubjects((prev) => [
        ...prev,
        { id: data.id, name: data.name ?? name },
      ]);
      setSubjectName("");
      setSelectedSubjectName(data.name ?? name);
    } else {
      alert(data?.detail || "Пән қосылмады");
    }
  };

  // ===== Delete Subject =====
  const deleteSubject = async (id: number) => {
    const target = subjects.find((s) => s.id === id);
    if (!target) return;
    if (
      !confirm(
        `"${target.name}" пәнін өшіреміз бе? Бұл оның тақырыптары мен quiz-дерін де өшіреді.`
      )
    )
      return;

    const res = await fetch(`${API}/api/subjects/${id}`, {
      method: "DELETE",
      headers: ADMIN_JSON_HEADERS,
    });
    if (!res.ok) {
      const msg = await res.json().catch(() => ({}));
      alert(msg?.detail || "Өшіру сәтсіз");
      return;
    }
    setSubjects((prev) => prev.filter((s) => s.id !== id));
    if (selectedSubjectName === target.name) {
      setSelectedSubjectName("");
      setTopics([]);
      setSelectedTopicId(null);
    }
  };

  // ===== Add Topic =====
  const addTopic = async () => {
    const tname = topicName.trim();
    if (!selectedSubjectName || !tname) return;
    const subjectUrl = encodeURIComponent(selectedSubjectName);
    const res = await fetch(`${API}/api/subjects/${subjectUrl}/topics`, {
      method: "POST",
      headers: ADMIN_JSON_HEADERS,
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

  // ===== Delete Topic =====
  const deleteTopic = async (id: number) => {
    const target = topics.find((t) => t.id === id);
    if (!target) return;
    if (
      !confirm(
        `"${target.name}" тақырыбын өшіреміз бе? Бұл оның quiz-дерін де өшіреді.`
      )
    )
      return;

    const res = await fetch(`${API}/api/topics/${id}`, {
      method: "DELETE",
      headers: ADMIN_JSON_HEADERS,
    });
    if (!res.ok) {
      const msg = await res.json().catch(() => ({}));
      alert(msg?.detail || "Өшіру сәтсіз");
      return;
    }
    setTopics((prev) => prev.filter((t) => t.id !== id));
    if (selectedTopicId === id) setSelectedTopicId(null);
  };

  // ===== Save single quiz (manual mode) =====
  const saveQuiz = async () => {
    if (!canProceedToQuiz) return;
    if (!question.trim()) return alert("Сұрақ мәтінін енгізіңіз.");

    const cleanOptions = options.map((o) => o.trim()).filter((o) => o);
    if (cleanOptions.length < 2)
      return alert("Кем дегенде 2 нұсқа болуы керек.");
    if (options.some((o) => !o.trim()))
      return alert("Барлық нұсқаларды толтырыңыз.");

    const correctAnswer = options[correctIndex].trim();
    if (!correctAnswer) return alert("Дұрыс жауапты таңдаңыз.");

    const topicId = selectedTopicId!;
    const payload = {
      question: question.trim(),
      options: options.map((o) => o.trim()),
      correct_answer: correctAnswer,
    };

    const res = await fetch(`${API}/api/topics/${topicId}/quizzes`, {
      method: "POST",
      headers: ADMIN_JSON_HEADERS,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data?.message || res.ok) {
      setQuestion("");
      setOptions(["", "", "", ""]);
      setCorrectIndex(0);
      alert("Quiz қосылды ✅");
    } else {
      alert(data?.detail || "Quiz қосылмады");
      console.error("Quiz қосу қатесі:", data);
    }
  };

  // ===== File mode helpers =====
  function normalizeParsedToLocal(data: any): QuizQuestion[] {
    // Күтілетін формат (икемді): { questions: [{ text: string, options: string[] | {text:string}[] }] }
    const raw = Array.isArray(data?.questions) ? data.questions : [];
    let QID = 1;
    return raw.map((q: any) => {
      const text: string = String(q.text ?? "").trim();
      const optsRaw = Array.isArray(q.options) ? q.options : [];
      let OID = 1;
      const options: QuizOption[] = optsRaw.map((o: any) => {
        const t = typeof o === "string" ? o : String(o?.text ?? "");
        return { id: OID++, text: t };
      });
      return { id: QID++, text, options };
    });
  }

  async function handleDocxFile(file: File) {
    if (!canProceedToQuiz) {
      return alert("Алдымен пән мен тақырыпты таңдаңыз.");
    }
    setParseError(null);
    setParseLoading(true);
    setParsedQuestions([]);
    setSaveProgress(0);

    try {
      const form = new FormData();
      form.append("file", file);
      // Қажет болса, тақырып Id-ін қоса аласың:
      // form.append("topic_id", String(selectedTopicId));

      const res = await fetch(`${API}/api/parse-docx`, {
        method: "POST",
        body: form,
        // FormData-пен "Content-Type" manually қойма!
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail || "Файлды өңдеу мүмкін болмады.");
      }

      const data = await res.json();
      const normalized = normalizeParsedToLocal(data);

      if (!normalized.length) {
        setParseError("Сұрақ табылмады. Құжат форматын тексеріңіз.");
      }
      setParsedQuestions(normalized);
    } catch (e: any) {
      setParseError(e?.message || "Белгісіз қате.");
    } finally {
      setParseLoading(false);
    }
  }

  function handleAnswerSelect(questionId: number, optionId: number) {
    setParsedQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId ? { ...q, correctAnswer: optionId } : q
      )
    );
  }

  async function saveAllParsed() {
    if (!canProceedToQuiz) return;
    if (!parsedQuestions.length) return alert("Сақтайтын сұрақ жоқ.");
    // Барлық сұрақта дұрыс жауап таңдалған ба?
    const notAnswered = parsedQuestions.filter((q) => !q.correctAnswer);
    if (notAnswered.length) {
      return alert(
        `Кем дегенде ${notAnswered.length} сұрақта дұрыс жауап таңдалмаған.`
      );
    }

    setSavingAll(true);
    setSaveProgress(0);

    const topicId = selectedTopicId!;
    let saved = 0;

    try {
      for (const q of parsedQuestions) {
        const correct = q.options.find((o) => o.id === q.correctAnswer)!.text;
        const payload = {
          question: q.text,
          options: q.options.map((o) => o.text),
          correct_answer: correct,
        };

        const res = await fetch(`${API}/api/topics/${topicId}/quizzes`, {
          method: "POST",
          headers: ADMIN_JSON_HEADERS,
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const msg = await res.json().catch(() => ({}));
          throw new Error(msg?.detail || "Сақтау қатесі");
        }

        saved += 1;
        setSaveProgress(Math.round((saved / parsedQuestions.length) * 100));
      }

      alert(`Барлығы ${saved} сұрақ сақталды ✅`);
      // қалауыңа қарай parsedQuestions-ты тазалап тастауға болады:
      // setParsedQuestions([]);
    } catch (e: any) {
      alert(e?.message || "Жаппай сақтау кезінде қате кетті.");
    } finally {
      setSavingAll(false);
    }
  }

  function clearParsed() {
    setParsedQuestions([]);
    setParseError(null);
    setSaveProgress(0);
  }

  // ===== UI helpers =====
  const Step = ({
    n,
    title,
    active,
  }: {
    n: number;
    title: string;
    active: boolean;
  }) => (
    <div className="d-flex align-items-center gap-2">
      <div
        className={`rounded-circle ${active ? "bg-primary" : "bg-light"} text-${
          active ? "white" : "muted"
        } d-flex align-items-center justify-content-center`}
        style={{ width: 28, height: 28, fontSize: 14 }}
      >
        {n}
      </div>
      <span className={`fw-medium ${active ? "" : "text-muted"}`}>{title}</span>
    </div>
  );

  const ManualInstallation = (
    <fieldset className="card border-0 shadow-sm" disabled={!canProceedToQuiz}>
      <div className="card-body">
        <h5 className="mb-3">3) Quiz сұрақ пен нұсқалар (Қолмен)</h5>

        <div className="mb-3">
          <QuizEditor value={question} onChange={setQuestion} />
        </div>

        <div className="row g-2 mb-3">
          {options.map((opt, idx) => (
            <div className="col-md-6" key={idx}>
              <div className="input-group">
                <span className="input-group-text">
                  {String.fromCharCode(65 + idx)}
                </span>
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
              {correctIndex === idx && opt.trim() && (
                <small className="text-success">
                  ✓ Бұл дұрыс жауап: "{opt.trim()}"
                </small>
              )}
            </div>
          ))}
        </div>

        <div className="alert alert-info mb-3">
          <strong>Дұрыс жауап:</strong>{" "}
          {options[correctIndex]?.trim() || "(таңдалмаған)"}
        </div>

        <div className="d-flex justify-content-end">
          <button className="btn btn-primary" onClick={saveQuiz}>
            Сақтау
          </button>
        </div>
      </div>
    </fieldset>
  );

  // ===== Render =====
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
                    <th style={{ width: 120 }} className="text-end">
                      Әрекет
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((s) => (
                    <tr
                      key={s.id}
                      className={
                        selectedSubjectName === s.name ? "table-active" : ""
                      }
                    >
                      <td>#{s.id}</td>
                      <td>{s.name}</td>
                      <td className="text-end">
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => deleteSubject(s.id)}
                        >
                          <FaTrash className="me-1" /> Өшіру
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <small className="text-muted d-block mt-2">
            Пән таңдалмайынша келесі қадам ашылмайды.
          </small>
        </div>
      </div>

      {/* Step 2: Topic */}
      <fieldset
        className="card border-0 shadow-sm mb-4"
        disabled={!selectedSubjectName}
      >
        <div className="card-body">
          <h5 className="mb-3">
            2) {selectedSubjectName || "…"} пәніне тақырып
          </h5>
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
                onChange={(e) =>
                  setSelectedTopicId(
                    e.target.value ? Number(e.target.value) : null
                  )
                }
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
                    <th style={{ width: 120 }} className="text-end">
                      Әрекет
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topics.map((t) => (
                    <tr
                      key={t.id}
                      className={selectedTopicId === t.id ? "table-active" : ""}
                    >
                      <td>#{t.id}</td>
                      <td>{t.name}</td>
                      <td className="text-end">
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => deleteTopic(t.id)}
                        >
                          <FaTrash className="me-1" /> Өшіру
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <small className="text-muted">
            Тақырып таңдалмайынша Quiz бөлімі ашылмайды.
          </small>
        </div>
      </fieldset>

      {/* Step 3: Quiz */}
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h5 className="m-0">3) Quiz</h5>
        <div className="btn-group">
          <button
            className={`btn btn-sm ${
              mode === "file" ? "btn-primary" : "btn-outline-primary"
            }`}
            onClick={() => setMode("file")}
            disabled={!canProceedToQuiz}
          >
            Файл арқылы
          </button>
          <button
            className={`btn btn-sm ${
              mode === "manual" ? "btn-primary" : "btn-outline-primary"
            }`}
            onClick={() => setMode("manual")}
            disabled={!canProceedToQuiz}
          >
            Қолмен
          </button>
        </div>
      </div>

      {mode === "manual" && <div className="mb-4">{ManualInstallation}</div>}

      {mode === "file" && (
        <fieldset
          className="card border-0 shadow-lg mb-4"
          disabled={!canProceedToQuiz}
        >
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="m-0">Файлды импорттау (.docx)</h6>
              <small className="text-muted">
                Тек <code>.docx</code> қабылданады
              </small>
            </div>

            <div className="p-4 mb-3 border rounded bg-light">
              {/* Жүктеу виджеті: AutomateQuiz — тек файлды таңдауға арналған, жіберуді біз істейміз */}
              <AutomateQuiz
                onFileSelect={handleDocxFile} // сенің upload/parse функцияң
                maxSizeMB={20} // керек болса шекті өсір
                accept=".docx" // қажет болса кеңейт .docx,.doc
                title=".docx файл импорттау"
                subtitle="DOCX ішіндегі тесттерді автоматты танимыз"
              />
              {parseLoading && (
                <div className="alert alert-info mt-3">Файл өңделуде…</div>
              )}
              {parseError && (
                <div className="alert alert-danger mt-3">{parseError}</div>
              )}
            </div>

            {parsedQuestions.length > 0 && (
              <>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="m-0">
                    Танылған сұрақтар:{" "}
                    <span className="badge bg-secondary">
                      {parsedQuestions.length}
                    </span>
                  </h6>
                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      onClick={clearParsed}
                    >
                      Тазалау
                    </button>
                    <button
                      className="btn btn-success btn-sm"
                      onClick={saveAllParsed}
                      disabled={savingAll}
                    >
                      {savingAll ? "Сақталуда…" : "Барлығын сақтау"}
                    </button>
                  </div>
                </div>

                {savingAll && (
                  <div
                    className="progress mb-3"
                    role="progressbar"
                    aria-valuenow={saveProgress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="progress-bar"
                      style={{ width: `${saveProgress}%` }}
                    >
                      {saveProgress}%
                    </div>
                  </div>
                )}

                {parsedQuestions.map((q) => (
                  <div
                    key={q.id}
                    className="border rounded p-3 mb-3 bg-white shadow-sm"
                  >
                    <p className="fw-semibold mb-2">
                      {q.text || <em className="text-muted">[Бос сұрақ]</em>}
                    </p>
                    <div className="mt-2">
                      {q.options.map((opt) => (
                        <div key={opt.id} className="form-check mb-1">
                          <input
                            type="radio"
                            name={`question-${q.id}`}
                            className="form-check-input"
                            checked={q.correctAnswer === opt.id}
                            onChange={() => handleAnswerSelect(q.id, opt.id)}
                          />
                          <label className="form-check-label">
                            {opt.text || (
                              <em className="text-muted">[Бос нұсқа]</em>
                            )}
                          </label>
                        </div>
                      ))}
                    </div>
                    {q.correctAnswer ? (
                      <div className="mt-2 alert alert-success py-1 px-2">
                        ✓ Дұрыс жауап таңдалды
                      </div>
                    ) : (
                      <div className="mt-2 alert alert-warning py-1 px-2">
                        Дұрыс жауапты таңдаңыз
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </fieldset>
      )}
    </div>
  );
}
