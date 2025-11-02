// src/pages/AdminPanel.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import QuizEditor from "./quiz/QuizEditor";
import AutomateQuiz from "./quiz/AutomateQuiz";
import { API_BASE } from "../api/axiosClient";

/* =========================
   Types
========================= */
type Subject = { id: number; name: string };
type Topic = { id: number; name: string };

type QuizOption = { id: number; text: string };
type QuizQuestion = {
  id: number;
  text: string;
  options: QuizOption[];
  correctAnswer?: number;
};

/* =========================
   API
========================= */
const API = API_BASE
const JSON_HEADERS: HeadersInit = { "Content-Type": "application/json" };

/* =========================
   Minimal Icons
========================= */
const TrashIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
    <path d="M3 6h18M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const FileIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
    <path d="M6 3h7l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M13 3v5h5" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);
const Check = ({ className="w-3.5 h-3.5" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
    <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const PlusIcon = ({ className="w-4 h-4" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);

/* =========================
   Cupertino Radio (minimal)
========================= */
function CupertinoRadio({ checked }: { checked: boolean }) {
  return (
    <span
      className={[
        "relative grid place-items-center",
        "w-5 h-5 rounded-full border",
        checked ? "border-blue-600" : "border-slate-300",
        "bg-white shadow-[0_1px_0_rgba(0,0,0,0.05)]",
        "transition-colors"
      ].join(" ")}
      aria-hidden
    >
      <span
        className={[
          "w-2.5 h-2.5 rounded-full transition-transform",
          checked ? "bg-blue-600 scale-100" : "bg-transparent scale-0"
        ].join(" ")}
      />
    </span>
  );
}

type RadioRowProps = {
  name: string;
  checked: boolean;
  label: string;
  onChange: () => void;
};

function RadioRow({ name, checked, label, onChange }: RadioRowProps) {
  return (
    <label
      className={[
        "group relative flex items-center gap-3 select-none",
        "rounded-xl px-3 py-2",
        "ring-1 ring-slate-200 bg-white/90 backdrop-blur",
        "hover:bg-slate-50 hover:ring-slate-300",
        "transition"
      ].join(" ")}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="peer sr-only" />
      <CupertinoRadio checked={checked} />
      <span className={["text-sm", checked ? "text-slate-900" : "text-slate-800"].join(" ")}>
        {label}
      </span>
      <span className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-blue-600/0 peer-focus-visible:ring-blue-600/60" />
    </label>
  );
}

/* =========================
   Clean Stepper
========================= */
function Stepper({ active }: { active: 1 | 2 | 3 }) {
  const steps = [
    { id: 1, title: "Пән" },
    { id: 2, title: "Тақырып" },
    { id: 3, title: "Quiz" },
  ] as const;

  return (
    <div className="flex items-center gap-3 mb-6">
      {steps.map((s, i) => {
        const isActive = s.id <= active;
        const last = i === steps.length - 1;
        return (
          <div key={s.id} className="flex items-center gap-3">
            <div
              className={[
                "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium",
                "ring-1",
                isActive
                  ? "bg-slate-900 text-white ring-slate-900"
                  : "bg-white text-slate-700 ring-slate-200"
              ].join(" ")}
            >
              <span className={[
                "grid place-items-center w-5 h-5 rounded-full",
                isActive ? "bg-white/20" : "bg-slate-100"
              ].join(" ")}>
                {isActive ? <Check className="text-white" /> : <span className="text-[11px] text-slate-700">{s.id}</span>}
              </span>
              <span>{s.title}</span>
            </div>
            {!last && <div className="w-10 h-px bg-slate-200" />}
          </div>
        );
      })}
    </div>
  );
}

/* =========================
   Tiny Toast (non-blocking)
========================= */
type ToastKind = "success" | "error" | "info" | "warning";
type Toast = { id: number; text: string; kind: ToastKind };

function ToastItem({ t }: { t: Toast }) {
  const base =
    "flex items-center gap-2 px-3 py-2 rounded-lg ring-1 shadow-sm text-sm";
  const map: Record<ToastKind, string> = {
    success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    error: "bg-rose-50 text-rose-800 ring-rose-200",
    info: "bg-slate-50 text-slate-800 ring-slate-200",
    warning: "bg-amber-50 text-amber-900 ring-amber-200",
  };
  return <div className={`${base} ${map[t.kind]}`}>{t.text}</div>;
}

/* =========================
   Main
========================= */
export default function AdminPanel() {
  const navigate = useNavigate();

  // Step 1: Subject
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectName, setSubjectName] = useState("");
  const [selectedSubjectName, setSelectedSubjectName] = useState("");

  // Step 2: Topic
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicName, setTopicName] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);

  // Step 3A: Manual
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState<number>(0);

  // Step 3B: File
  const [mode, setMode] = useState<"manual" | "file">("file");
  const [parsedQuestions, setParsedQuestions] = useState<QuizQuestion[]>([]);
  const [parseLoading, setParseLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [saveProgress, setSaveProgress] = useState<number>(0);

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);
  const pushToast = (text: string, kind: ToastKind = "info", ms = 2600) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text, kind }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, ms);
  };
  
  const canProceedToQuiz = useMemo(
    () => !!selectedSubjectName && selectedTopicId !== null,
    [selectedSubjectName, selectedTopicId]
  );

  /* -------- Load Subjects -------- */
  useEffect(() => {
    fetch(`${API}/api/subjects`)
      .then((r) => r.json())
      .then((data) => setSubjects(Array.isArray(data) ? data : []))
      .catch(() => setSubjects([]));
  }, []);

  /* -------- Load Topics by Subject -------- */
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

  /* -------- Subject actions -------- */
  const addSubject = async () => {
    const name = subjectName.trim();
    if (!name) return;
    const res = await fetch(`${API}/api/subjects`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (data?.id) {
      setSubjects((prev) => [...prev, { id: data.id, name: data.name ?? name }]);
      setSubjectName("");
      setSelectedSubjectName(data.name ?? name);
      pushToast("Пән қосылды ✅", "success");
    } else {
      pushToast(data?.detail || "Пән қосылмады", "error");
    }
  };

  const deleteSubject = async (id: number) => {
    const target = subjects.find((s) => s.id === id);
    if (!target) return;
    if (!confirm(`"${target.name}" пәнін өшіреміз бе? Барлық тақырыптары мен quiz-дері де өшеді.`)) return;

    const res = await fetch(`${API}/api/subjects/${id}`, { method: "DELETE", headers: JSON_HEADERS });
    if (!res.ok) {
      const msg = await res.json().catch(() => ({}));
      pushToast(msg?.detail || "Өшіру сәтсіз", "error");
      return;
    }
    setSubjects((prev) => prev.filter((s) => s.id !== id));
    if (selectedSubjectName === target.name) {
      setSelectedSubjectName("");
      setTopics([]);
      setSelectedTopicId(null);
    }
    pushToast("Пән өшірілді", "success");
  };

  /* -------- Topic actions -------- */
  const addTopic = async () => {
    const tname = topicName.trim();
    if (!selectedSubjectName || !tname) return;
    const subjectUrl = encodeURIComponent(selectedSubjectName);
    const res = await fetch(`${API}/api/subjects/${subjectUrl}/topics`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ name: tname }),
    });
    const data = await res.json();
    if (data?.id) {
      const newTopic: Topic = { id: data.id, name: tname };
      setTopics((prev) => [...prev, newTopic]);
      setTopicName("");
      setSelectedTopicId(newTopic.id);
      pushToast("Тақырып қосылды ✅", "success");
    } else {
      pushToast(data?.detail || "Тақырып қосылмады", "error");
    }
  };

  const deleteTopic = async (id: number) => {
    const target = topics.find((t) => t.id === id);
    if (!target) return;
    if (!confirm(`"${target.name}" тақырыбын өшіреміз бе? Оның quiz-дері де өшеді.`)) return;

    const res = await fetch(`${API}/api/topics/${id}`, { method: "DELETE", headers: JSON_HEADERS });
    if (!res.ok) {
      const msg = await res.json().catch(() => ({}));
      pushToast(msg?.detail || "Өшіру сәтсіз", "error");
      return;
    }
    setTopics((prev) => prev.filter((t) => t.id !== id));
    if (selectedTopicId === id) setSelectedTopicId(null);
    pushToast("Тақырып өшірілді", "success");
  };

  /* -------- Manual: add/remove options -------- */
  const addOption = () => {
    setOptions((prev) => [...prev, ""]);
  };

  const removeOption = (idx: number) => {
    setOptions((prev) => {
      if (prev.length <= 2) return prev;
      const next = [...prev];
      next.splice(idx, 1);
      if (correctIndex === idx) {
        setCorrectIndex(Math.max(0, next.length - 1));
        return next;
      }
      if (correctIndex > idx) {
        setCorrectIndex(correctIndex - 1);
        return next;
      }
      return next;
    });
  };

  /* -------- Manual save -------- */
  const saveQuiz = async () => {
    if (!canProceedToQuiz) return;
    if (!question.trim()) {
      pushToast("Сұрақ мәтінін енгізіңіз.", "warning");
      return;
    }

    const cleanOptions = options.map((o) => o.trim()).filter((o) => o);
    if (cleanOptions.length < 2) {
      pushToast("Кем дегенде 2 нұсқа болуы керек.", "warning");
      return;
    }
    if (options.some((o) => !o.trim())) {
      pushToast("Барлық нұсқаларды толтырыңыз.", "warning");
      return;
    }

    const safeIndex = Math.min(Math.max(0, correctIndex), cleanOptions.length - 1);
    const correctAnswer = cleanOptions[safeIndex];
    if (!correctAnswer) {
      pushToast("Дұрыс жауапты таңдаңыз.", "warning");
      return;
    }

    const topicId = selectedTopicId!;
    const payload = { question: question.trim(), options: cleanOptions, correct_answer: correctAnswer };

    const res = await fetch(`${API}/api/topics/${topicId}/quizzes`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data?.message || res.ok) {
      setQuestion("");
      setOptions(["", "", "", ""]);
      setCorrectIndex(0);
      pushToast("Quiz қосылды ✅", "success");
    } else {
      pushToast(data?.detail || "Quiz қосылмады", "error");
      console.error("Quiz қосу қатесі:", data);
    }
  };

  /* -------- File mode -------- */
  function normalizeParsedToLocal(data: any): QuizQuestion[] {
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
      pushToast("Алдымен пән мен тақырыпты таңдаңыз.", "warning");
      return;
    }
    setParseError(null); setParseLoading(true);
    setParsedQuestions([]); setSaveProgress(0);
    try {
      const form = new FormData(); form.append("file", file);
      const res = await fetch(`${API}/api/parse-docx`, { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail || "Файлды өңдеу мүмкін болмады.");
      }
      const data = await res.json();
      const normalized = normalizeParsedToLocal(data);
      if (!normalized.length) setParseError("Сұрақ табылмады. Құжат форматын тексеріңіз.");
      setParsedQuestions(normalized);
    } catch (e: any) {
      setParseError(e?.message || "Белгісіз қате.");
    } finally {
      setParseLoading(false);
    }
  }

  function handleAnswerSelect(questionId: number, optionId: number) {
    setParsedQuestions((prev) =>
      prev.map((q) => (q.id === questionId ? { ...q, correctAnswer: optionId } : q))
    );
  }

  async function saveAllParsed() {
    if (!canProceedToQuiz) return;
    if (!parsedQuestions.length) {
      pushToast("Сақтайтын сұрақ жоқ.", "warning");
      return;
    }

    const notAnswered = parsedQuestions.filter((q) => !q.correctAnswer);
    if (notAnswered.length) {
      pushToast(`Кем дегенде ${notAnswered.length} сұрақта дұрыс жауап таңдалмаған.`, "warning");
      return;
    }

    setSavingAll(true); setSaveProgress(0);
    const topicId = selectedTopicId!; let saved = 0;

    try {
      for (const q of parsedQuestions) {
        const correct = q.options.find((o) => o.id === q.correctAnswer)!.text;
        const payload = { question: q.text, options: q.options.map((o) => o.text), correct_answer: correct };

        const res = await fetch(`${API}/api/topics/${topicId}/quizzes`, {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const msg = await res.json().catch(() => ({}));
          throw new Error(msg?.detail || "Сақтау қатесі");
        }
        saved += 1;
        setSaveProgress(Math.round((saved / parsedQuestions.length) * 100));
      }
      pushToast(`Барлығы ${saved} сұрақ сақталды ✅`, "success");
      // Автоматты түрде /home бетіне өту
      navigate("/home");
    } catch (e: any) {
      pushToast(e?.message || "Жаппай сақтау кезінде қате кетті.", "error");
    } finally {
      setSavingAll(false);
    }
  }

  function clearParsed() {
    setParsedQuestions([]); setParseError(null); setSaveProgress(0);
  }

  /* =========================
     UI
  ========================= */
  const activeStep = (!selectedSubjectName ? 1 : selectedTopicId ? 3 : 2) as 1 | 2 | 3;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc,white)] py-8 px-4">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <header className="mb-6">
          <h1 className="text-[28px] font-semibold tracking-tight text-slate-900">Easy Admin</h1>
          <p className="text-sm text-slate-600">Минимал және таза панель. Бірнеше қадаммен Quiz жаса.</p>
        </header>

        {/* Stepper */}
        <Stepper active={activeStep} />

        {/* SUBJECT */}
        <section className="rounded-2xl bg-white/90 backdrop-blur ring-1 ring-slate-200 shadow-sm p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium text-slate-900">Пән</h2>
            <span className="text-xs text-slate-500">Алдымен пәнді таңда/қос</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <input
              className="w-full rounded-lg ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-600 outline-none px-3 py-2"
              placeholder="Жаңа пән атауы"
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
            />
            <button className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-2" onClick={addSubject}>
              Қосу
            </button>
            <select
              className="w-full rounded-lg ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-600 outline-none px-3 py-2 bg-white"
              value={selectedSubjectName}
              onChange={(e) => setSelectedSubjectName(e.target.value)}
            >
              <option value="">— Пәнді таңда —</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>

          {subjects.length > 0 && (
            <div className="overflow-hidden rounded-xl ring-1 ring-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="text-left font-medium px-4 py-2 w-24">ID</th>
                    <th className="text-left font-medium px-4 py-2">Пән</th>
                    <th className="text-right font-medium px-4 py-2 w-28">Әрекет</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {subjects.map((s) => (
                    <tr key={s.id} className={selectedSubjectName === s.name ? "bg-blue-50/50" : ""}>
                      <td className="px-4 py-2">#{s.id}</td>
                      <td className="px-4 py-2">{s.name}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => deleteSubject(s.id)}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ring-1 ring-rose-300 text-rose-700 hover:bg-rose-50"
                          title="Өшіру"
                        >
                          <TrashIcon /> Өшіру
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* TOPIC */}
        <section className={`rounded-2xl bg-white/90 backdrop-blur ring-1 ring-slate-200 shadow-sm p-5 mb-6 ${!selectedSubjectName ? "opacity-60 pointer-events-none" : ""}`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium text-slate-900">Тақырып</h2>
            <span className="text-xs text-slate-500">{selectedSubjectName ? `${selectedSubjectName} пәні` : "Алдымен пәнді таңдаңыз"}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <input
              className="w-full rounded-lg ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-600 outline-none px-3 py-2"
              placeholder="Жаңа тақырып атауы"
              value={topicName}
              onChange={(e) => setTopicName(e.target.value)}
            />
            <button className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-2" onClick={addTopic}>
              Қосу
            </button>
            <select
              className="w-full rounded-lg ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-600 outline-none px-3 py-2 bg-white"
              value={selectedTopicId ?? ""}
              onChange={(e) => setSelectedTopicId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">— Тақырыпты таңда —</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {topics.length > 0 && (
            <div className="overflow-hidden rounded-xl ring-1 ring-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="text-left font-medium px-4 py-2 w-24">ID</th>
                    <th className="text-left font-medium px-4 py-2">Тақырып</th>
                    <th className="text-right font-medium px-4 py-2 w-28">Әрекет</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {topics.map((t) => (
                    <tr key={t.id} className={selectedTopicId === t.id ? "bg-blue-50/50" : ""}>
                      <td className="px-4 py-2">#{t.id}</td>
                      <td className="px-4 py-2">{t.name}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => deleteTopic(t.id)}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ring-1 ring-rose-300 text-rose-700 hover:bg-rose-50"
                          title="Өшіру"
                        >
                          <TrashIcon /> Өшіру
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* QUIZ */}
        <section className={`rounded-2xl bg-white/90 backdrop-blur ring-1 ring-slate-200 shadow-sm p-5 ${!canProceedToQuiz ? "opacity-60 pointer-events-none" : ""}`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium text-slate-900">Quiz</h2>
            <div className="inline-flex rounded-lg ring-1 ring-slate-300 overflow-hidden">
              <button
                className={`px-3 py-1.5 text-sm font-medium ${mode === "file" ? "bg-blue-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}
                onClick={() => setMode("file")}
              >
                Файл
              </button>
              <button
                className={`px-3 py-1.5 text-sm font-medium ${mode === "manual" ? "bg-blue-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}
                onClick={() => setMode("manual")}
              >
                Қолмен
              </button>
            </div>
          </div>

          {/* Manual */}
          {mode === "manual" && (
            <div className="space-y-4">
              <div>
                <div className="rounded-xl ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-blue-600">
                  <QuizEditor value={question} onChange={setQuestion} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-700">Нұсқалар</label>
                  <button
                    type="button"
                    onClick={addOption}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg ring-1 ring-slate-300 hover:bg-slate-50 text-slate-700 text-sm"
                  >
                    <PlusIcon /> Нұсқа қосу
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {options.map((opt, idx) => {
                    const letter = String.fromCharCode(65 + idx);
                    return (
                      <div key={idx} className="flex items-stretch gap-2">
                        <RadioRow
                          name="manual-correct"
                          checked={correctIndex === idx}
                          label={`Нұсқа ${letter}`}
                          onChange={() => setCorrectIndex(idx)}
                        />
                        <input
                          className="flex-1 rounded-xl ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-600 outline-none px-3 py-2 bg-white"
                          placeholder={`Жауап мәтіні (${letter})`}
                          value={opt}
                          onChange={(e) => {
                            const next = [...options];
                            next[idx] = e.target.value;
                            setOptions(next);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => removeOption(idx)}
                          className="shrink-0 inline-flex items-center justify-center px-3 rounded-xl ring-1 ring-rose-300 text-rose-700 hover:bg-rose-50"
                          title="Бұл нұсқаны өшіру"
                          disabled={options.length <= 2}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="text-sm text-slate-700">
                <strong>Дұрыс жауап:</strong>{" "}
                <span className="font-semibold text-emerald-700">
                  {`Нұсқа ${String.fromCharCode(65 + Math.min(correctIndex, Math.max(0, options.length - 1)))}`}
                </span>
              </div>

              <div className="flex justify-end">
                <button onClick={saveQuiz} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                  Сақтау
                </button>
              </div>
            </div>
          )}

          {/* File */}
          {mode === "file" && (
            <div className="space-y-4">
              <div className="rounded-2xl ring-1 ring-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="grid place-items-center w-8 h-8 rounded-lg bg-slate-100 ring-1 ring-slate-200">
                      <FileIcon className="w-4 h-4 text-slate-600" />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">DOCX импорт</h3>
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <AutomateQuiz
                    onFileSelect={handleDocxFile}
                    maxSizeMB={20}
                    accept=".docx"
                    title="Файлды таңдаңыз"
                    subtitle="Тесттер автоматты түрде танылады"
                  />
                </div>

                {parseLoading && <div className="mt-3 text-sm text-blue-700 bg-blue-50 ring-1 ring-blue-200 rounded-lg px-3 py-2">Файл өңделуде…</div>}
                {parseError && <div className="mt-3 text-sm text-rose-700 bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2">{parseError}</div>}
              </div>

              {parsedQuestions.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-800">
                      Танылған сұрақтар:
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-lg bg-slate-100 ring-1 ring-slate-200 ml-1">
                        {parsedQuestions.length}
                      </span>
                    </h4>
                    <div className="flex gap-2">
                      <button onClick={clearParsed} className="px-3 py-1.5 rounded-lg ring-1 ring-slate-300 hover:bg-slate-50 text-slate-700">
                        Тазалау
                      </button>
                      <button onClick={saveAllParsed} disabled={savingAll} className={`px-3 py-1.5 rounded-lg text-white ${savingAll ? "bg-emerald-500/70 cursor-wait" : "bg-emerald-600 hover:bg-emerald-700"}`}>
                        {savingAll ? "Сақталуда…" : "Барлығын сақтау"}
                      </button>
                    </div>
                  </div>

                  {savingAll && (
                    <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div className="h-full bg-emerald-600 transition-all" style={{ width: `${saveProgress}%` }} />
                    </div>
                  )}

                  <ul className="space-y-3">
                    {parsedQuestions.map((q) => (
                      <li key={q.id} className="rounded-xl ring-1 ring-slate-200 bg-white/90 backdrop-blur p-4">
                        <p className="font-medium text-slate-900 mb-3">{q.text || <em className="text-slate-500">[Бос сұрақ]</em>}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {q.options.map((opt) => (
                            <RadioRow
                              key={opt.id}
                              name={`question-${q.id}`}
                              checked={q.correctAnswer === opt.id}
                              label={opt.text}
                              onChange={() => handleAnswerSelect(q.id, opt.id)}
                            />
                          ))}
                        </div>
                        <div className={`mt-2 text-xs inline-flex items-center gap-1 px-2 py-1 rounded-lg ring-1 ${q.correctAnswer ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-amber-200"}`}>
                          <Check className={`w-3.5 h-3.5 ${q.correctAnswer ? "text-emerald-600" : "text-amber-600"}`} />
                          {q.correctAnswer ? "Дұрыс жауап таңдалды" : "Дұрыс жауапты таңдаңыз"}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Toast container (overlay) */}
      <div
        aria-live="polite"
        className="fixed top-4 right-4 z-50 flex flex-col gap-2"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} t={t} />
        ))}
      </div>
    </div>
  );
}
