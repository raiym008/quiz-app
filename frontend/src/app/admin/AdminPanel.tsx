// src/app/admin/AdminPanel.tsx

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import QuizEditor from "./quiz/QuizEditor";
import AutomateQuiz from "./quiz/AutomateQuiz";
import api from "../api/axiosClient";
import { useAuthStore } from "../api/authStore";

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

type ToastKind = "success" | "error" | "info" | "warning";
type Toast = { id: number; text: string; kind: ToastKind };

type ConfirmConfig = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
};

/* =========================
   Icons
========================= */
const TrashIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
    <path
      d="M3 6h18M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <path
      d="M10 11v6M14 11v6"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const FileIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
    <path
      d="M6 3h7l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path d="M13 3v5h5" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const Check = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
    <path
      d="M20 6 9 17l-5-5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PlusIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
    <path
      d="M12 5v14M5 12h14"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

/* =========================
   Cupertino Radio
========================= */
function CupertinoRadio({ checked }: { checked: boolean }) {
  return (
    <span
      className={[
        "relative grid place-items-center",
        "w-5 h-5 rounded-full border",
        checked ? "border-blue-600" : "border-slate-300",
        "bg-white shadow-[0_1px_0_rgba(0,0,0,0.05)]",
        "transition-colors",
      ].join(" ")}
      aria-hidden
    >
      <span
        className={[
          "w-2.5 h-2.5 rounded-full transition-transform",
          checked ? "bg-blue-600 scale-100" : "bg-transparent scale-0",
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
        "group flex items-center gap-2 select-none",
        "rounded-xl px-3 py-1.5 cursor-pointer text-sm",
        "border transition-colors transition-shadow",
        checked
          ? "bg-sky-100/80 border-sky-300 shadow-[0_1px_3px_rgba(15,23,42,0.12)]"
          : "bg-white/90 border-slate-200 hover:bg-slate-50 hover:border-slate-300",
      ].join(" ")}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <CupertinoRadio checked={checked} />
      <span className={checked ? "text-slate-900" : "text-slate-800"}>
        {label}
      </span>
    </label>
  );
}

/* =========================
   Stepper
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
                "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ring-1",
                isActive
                  ? "bg-slate-900 text-white ring-slate-900"
                  : "bg-white text-slate-700 ring-slate-200",
              ].join(" ")}
            >
              <span
                className={[
                  "grid place-items-center w-5 h-5 rounded-full",
                  isActive ? "bg-white/20" : "bg-slate-100",
                ].join(" ")}
              >
                {isActive ? (
                  <Check className="text-white" />
                ) : (
                  <span className="text-[11px] text-slate-700">{s.id}</span>
                )}
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
   Toast
========================= */
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
   Confirm Modal
========================= */
type ConfirmModalProps = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

function ConfirmModal({
  title,
  message,
  confirmLabel = "Иә",
  cancelLabel = "Жоқ",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
        onClick={onCancel}
      />
      <div
        className="
          relative z-[81]
          w-full max-w-sm
          bg-white
          rounded-2xl
          shadow-2xl
          ring-1 ring-slate-200
          px-5 py-5
        "
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-slate-900 mb-2">
          {title}
        </h2>
        <p className="text-sm text-slate-600 mb-5 whitespace-pre-line">
          {message}
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 rounded-2xl text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-2xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 shadow-sm"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Мүмкіндік (credit) UI helpers
========================= */
function CreditBadge({
  balance,
  loading,
  onRefresh,
}: {
  balance: number | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRefresh}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-blue-50 text-blue-800 ring-1 ring-blue-200 hover:bg-blue-100 text-xs font-medium"
    >
      <span className="text-[11px] uppercase tracking-wide text-blue-600">
        Мүмкіндік
      </span>
      <span className="text-sm font-semibold">
        {loading ? "…" : balance ?? "—"}
      </span>
    </button>
  );
}

function LowCreditWarning({ balance }: { balance: number | null }) {
  if (balance === null) return null;
  if (balance !== 1) return null; // тек 1 мүмкіндік қалғанда ғана ескерту

  return (
    <div className="mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-amber-50 text-amber-800 ring-1 ring-amber-200 text-xs">
      ⚠️ Сізде мүмкіндік аз. DOCX-парсерге 1 мүмкіндік қажет.
    </div>
  );
}

function NoCreditPopup({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative z-[86] w-full max-w-sm bg-white rounded-2xl shadow-2xl ring-1 ring-slate-200 px-5 py-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900 mb-1">
          Мүмкіндік біткен
        </h2>
        <p className="text-sm text-slate-600 mb-4">
          DOCX файл жүктеу үшін кемінде <b>1 мүмкіндік</b> қажет.{" "}
          Сізде мүмкіндік қалмады. Қазір тек{" "}
          <b>қолмен енгізу</b> режимі қолжетімді.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="w-full px-3 py-2 rounded-2xl bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200"
        >
          Жабу
        </button>
      </div>
    </div>
  );
}

/* =========================
   Main
========================= */
export default function AdminPanel() {
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.user);

  // Step 1: Subject
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectName, setSubjectName] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] =
    useState<number | null>(null);

  // Step 2: Topic
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicName, setTopicName] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);

  // Step 3A: Manual Quiz
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState<number>(0);

  // Step 3B: File Mode
  const [mode, setMode] = useState<"manual" | "file">("file");
  const [parsedQuestions, setParsedQuestions] = useState<QuizQuestion[]>([]);
  const [parseLoading, setParseLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [saveProgress, setSaveProgress] = useState<number>(0);

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);
  const pushToast = (
    text: string,
    kind: ToastKind = "info",
    ms: number = 2600
  ) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text, kind }]);
    window.setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      ms
    );
  };

  // Мүмкіндік (credits)
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [creditsError, setCreditsError] = useState<string | null>(null);
  const [noCreditPopup, setNoCreditPopup] = useState(false);

  const loadCredits = async () => {
    if (!authUser) return;
    try {
      setCreditsLoading(true);
      const res = await api.get("/credits");
      const bal =
        typeof res.data?.balance === "number" ? res.data.balance : 0;
      setCreditBalance(bal);
      setCreditsError(null);
    } catch (e: any) {
      const msg =
        e?.response?.data?.detail || "Мүмкіндіктерді жүктеу сәтсіз.";
      setCreditsError(msg);
      pushToast(msg, "error");
    } finally {
      setCreditsLoading(false);
    }
  };

  // Confirm
  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig | null>(
    null
  );
  const openConfirm = (config: ConfirmConfig) => setConfirmConfig(config);
  const closeConfirm = () => setConfirmConfig(null);

  const selectedSubject = useMemo(
    () => subjects.find((s) => s.id === selectedSubjectId) || null,
    [subjects, selectedSubjectId]
  );

  const canProceedToQuiz =
    !!selectedSubjectId && selectedTopicId !== null && selectedTopicId > 0;

  const activeStep = (!selectedSubjectId
    ? 1
    : !selectedTopicId
    ? 2
    : 3) as 1 | 2 | 3;

  /* ========= Load credits ========= */
  useEffect(() => {
    if (!authUser?.id) return;
    loadCredits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id]);

  /* ========= Load subjects ========= */
  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const res = await api.get("/subjects");
        setSubjects(Array.isArray(res.data) ? res.data : []);
      } catch (e: any) {
        pushToast(
          e?.response?.data?.detail || "Пәндерді жүктеу сәтсіз.",
          "error"
        );
      }
    };
    loadSubjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ========= Load topics when subject changes ========= */
  useEffect(() => {
    if (!selectedSubjectId) {
      setTopics([]);
      setSelectedTopicId(null);
      return;
    }

    const loadTopics = async () => {
      try {
        const res = await api.get(`/subjects/${selectedSubjectId}/topics`);
        setTopics(Array.isArray(res.data) ? res.data : []);
      } catch (e: any) {
        pushToast(
          e?.response?.data?.detail || "Тақырыптарды жүктеу сәтсіз.",
          "error"
        );
        setTopics([]);
      }
    };

    loadTopics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubjectId]);

  /* =========================
     Subject actions
  ========================= */
  const addSubject = async () => {
    const name = subjectName.trim();
    if (!name) {
      pushToast("Пән атауын енгіз.", "warning");
      return;
    }

    try {
      const res = await api.post("/subjects", { name });
      const data = res.data;
      if (data?.id) {
        setSubjects((prev) => [...prev, data]);
        setSubjectName("");
        setSelectedSubjectId(data.id);
        pushToast("Пән қосылды ✅", "success");
      } else {
        throw new Error();
      }
    } catch (e: any) {
      pushToast(
        e?.response?.data?.detail || "Пән қосу сәтсіз болды.",
        "error"
      );
    }
  };

  const doDeleteSubject = async (id: number) => {
    const target = subjects.find((s) => s.id === id);
    if (!target) return;

    try {
      await api.delete(`/subjects/${id}`);
      setSubjects((prev) => prev.filter((s) => s.id !== id));
      if (selectedSubjectId === id) {
        setSelectedSubjectId(null);
        setTopics([]);
        setSelectedTopicId(null);
      }
      pushToast("Пән өшірілді ✅", "success");
    } catch (e: any) {
      pushToast(
        e?.response?.data?.detail || "Пәнді өшіру сәтсіз болды.",
        "error"
      );
    }
  };

  const deleteSubject = (id: number) => {
    const target = subjects.find((s) => s.id === id);
    if (!target) return;

    openConfirm({
      title: "Пәнді өшіру",
      message: `"${target.name}" пәнін өшіру. Барлық тақырыптары мен quiz-дері жойылады.`,
      confirmLabel: "Иә, өшіру",
      cancelLabel: "Жоқ",
      onConfirm: () => doDeleteSubject(id),
    });
  };

  /* =========================
     Topic actions
  ========================= */
  const addTopic = async () => {
    const name = topicName.trim();
    if (!selectedSubjectId) {
      pushToast("Алдымен пән таңда.", "warning");
      return;
    }
    if (!name) {
      pushToast("Тақырып атауын енгіз.", "warning");
      return;
    }

    try {
      const res = await api.post(`/subjects/${selectedSubjectId}/topics`, {
        name,
      });
      const data = res.data;
      if (data?.id) {
        const newTopic: Topic = {
          id: data.id,
          name: data.name ?? name,
        };
        setTopics((prev) => [...prev, newTopic]);
        setTopicName("");
        setSelectedTopicId(newTopic.id);
        pushToast("Тақырып қосылды ✅", "success");
      } else {
        throw new Error();
      }
    } catch (e: any) {
      pushToast(
        e?.response?.data?.detail || "Тақырып қосу сәтсіз болды.",
        "error"
      );
    }
  };

  const doDeleteTopic = async (id: number) => {
    const target = topics.find((t) => t.id === id);
    if (!target) return;

    try {
      await api.delete(`/topics/${id}`);
      setTopics((prev) => prev.filter((t) => t.id !== id));
      if (selectedTopicId === id) {
        setSelectedTopicId(null);
      }
      pushToast("Тақырып өшірілді ✅", "success");
    } catch (e: any) {
      pushToast(
        e?.response?.data?.detail || "Тақырыпты өшіру сәтсіз болды.",
        "error"
      );
    }
  };

  const deleteTopic = (id: number) => {
    const target = topics.find((t) => t.id === id);
    if (!target) return;

    openConfirm({
      title: "Тақырыпты өшіру",
      message: `"${target.name}" тақырыбын өшіру. Барлық quiz-дері жойылады.`,
      confirmLabel: "Иә, өшіру",
      cancelLabel: "Жоқ",
      onConfirm: () => doDeleteTopic(id),
    });
  };

  /* =========================
     Manual Quiz actions
  ========================= */
  const addOption = () => setOptions((prev) => [...prev, ""]);

  const removeOption = (idx: number) => {
    setOptions((prev) => {
      if (prev.length <= 2) return prev;
      const next = [...prev];
      next.splice(idx, 1);

      if (correctIndex === idx) {
        setCorrectIndex(Math.max(0, next.length - 1));
      } else if (correctIndex > idx) {
        setCorrectIndex(correctIndex - 1);
      }
      return next;
    });
  };

  const saveQuiz = async () => {
    if (!canProceedToQuiz || !selectedTopicId) {
      pushToast("Алдымен пән мен тақырыпты таңда.", "warning");
      return;
    }

    if (!question.trim()) {
      pushToast("Сұрақ мәтінін енгіз.", "warning");
      return;
    }

    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (cleanOptions.length < 2) {
      pushToast("Кем дегенде 2 нұсқа керек.", "warning");
      return;
    }

    if (cleanOptions.some((o) => !o)) {
      pushToast("Барлық нұсқаларды толтыр.", "warning");
      return;
    }

    const safeIndex = Math.min(
      Math.max(0, correctIndex),
      cleanOptions.length - 1
    );
    const correctAnswer = cleanOptions[safeIndex];

    try {
      await api.post(`/topics/${selectedTopicId}/quizzes`, {
        question: question.trim(),
        options: cleanOptions,
        correct_answer: correctAnswer,
      });

      setQuestion("");
      setOptions(["", "", "", ""]);
      setCorrectIndex(0);
      pushToast("Quiz сақталды ✅", "success");
    } catch (e: any) {
      pushToast(
        e?.response?.data?.detail || "Quiz сақталмады.",
        "error"
      );
    }
  };

  /* =========================
     File Mode + auto answers
  ========================= */
  function normalizeParsedToLocal(data: any): QuizQuestion[] {
    const raw = Array.isArray(data?.questions) ? data.questions : [];
    let QID = 1;

    return raw.map((q: any) => {
      const text: string = String(q.text ?? q.question ?? "").trim();
      const optsRaw = Array.isArray(q.options) ? q.options : [];

      let OID = 1;
      const options: QuizOption[] = optsRaw.map((o: any) => {
        const t =
          typeof o === "string"
            ? o
            : typeof o?.text === "string"
            ? o.text
            : String(o ?? "");
        return { id: OID++, text: t };
      });

      let correctAnswer: number | undefined = undefined;
      if (
        typeof q.answer_index === "number" &&
        q.answer_index >= 0 &&
        q.answer_index < options.length
      ) {
        correctAnswer = options[q.answer_index].id;
      }

      return { id: QID++, text, options, correctAnswer };
    });
  }

  async function handleDocxFile(file: File) {
    if (!canProceedToQuiz || !selectedTopicId) {
      pushToast("Алдымен пән мен тақырыпты таңда.", "warning");
      return;
    }

    if (creditBalance !== null && creditBalance <= 0) {
      // Мүмкіндік жоқ → хабарлама шығарамыз
      setNoCreditPopup(true);
      return;
    }

    setParseError(null);
    setParseLoading(true);
    setParsedQuestions([]);
    setSaveProgress(0);

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await api.post("/parse-docx", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const normalized = normalizeParsedToLocal(res.data);

      if (!normalized.length) {
        setParseError(
          "Сұрақ табылмады. DOCX форматын және жауап кестесін тексер."
        );
      }

      setParsedQuestions(normalized);

      if (typeof res.data?.credit_balance === "number") {
        setCreditBalance(res.data.credit_balance);
      } else if (creditBalance !== null) {
        setCreditBalance(Math.max(0, creditBalance - 1));
      } else {
        loadCredits();
      }

      const autoCount = normalized.filter((q) => q.correctAnswer).length;

      if (autoCount) {
        pushToast(
          `Кестеден ${autoCount} сұрақтың жауабы автоматты табылды ✅`,
          "success"
        );
      } else if (normalized.length) {
        pushToast(
          "Сұрақтар танылды. Дұрыс жауаптарды төменнен таңда.",
          "info"
        );
      }
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Файлды өңдеу қатесі.";
      setParseError(detail);

      if (e?.response?.status === 403) {
        loadCredits();
      }
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
    if (!canProceedToQuiz || !selectedTopicId) {
      pushToast("Алдымен пән мен тақырыпты таңда.", "warning");
      return;
    }
    if (!parsedQuestions.length) {
      pushToast("Сақтайтын сұрақ жоқ.", "warning");
      return;
    }

    const notAnswered = parsedQuestions.filter(
      (q) => q.correctAnswer === undefined
    );
    if (notAnswered.length) {
      pushToast(
        `${notAnswered.length} сұрақта дұрыс жауап таңдалмаған.`,
        "warning"
      );
      return;
    }

    setSavingAll(true);
    setSaveProgress(10);

    try {
      const quizzes = parsedQuestions.map((q) => {
        const optionsTexts = q.options.map((o) => o.text);
        const idx = q.options.findIndex((o) => o.id === q.correctAnswer);
        return {
          question: q.text,
          options: optionsTexts,
          answer_index: idx >= 0 ? idx : null,
        };
      });

      const res = await api.post(
        `/topics/${selectedTopicId}/quizzes/bulk`,
        { quizzes }
      );

      const savedCount = Array.isArray(res.data?.ids)
        ? res.data.ids.length
        : quizzes.length;

      setSaveProgress(100);
      pushToast(
        `Автоматты түрде ${savedCount} сұрақ сақталды ✅`,
        "success"
      );

      setParsedQuestions([]);
      setParseError(null);
      setTimeout(() => setSaveProgress(0), 400);

      const userId = authUser?.id;
      if (userId) {
        setTimeout(() => navigate(`/u/${userId}`), 1200);
      }
    } catch (e: any) {
      pushToast(
        e?.response?.data?.detail ||
          e?.message ||
          "Жаппай сақтау кезінде қате.",
        "error"
      );
    } finally {
      setSavingAll(false);
    }
  }

  function clearParsed() {
    setParsedQuestions([]);
    setParseError(null);
    setSaveProgress(0);
  }

  /* =========================
      UI
  ========================= */
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc,white)] py-8 px-4">
      <div className="mx-auto max-w-6xl">
        {/* Header + Мүмкіндік */} 
        <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight text-slate-900">
              Easy Admin
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Пәндер, тақырыптар және тесттерді бір жерден басқару.
            </p>
          </div>
          <div className="flex flex-col items-start md:items-end gap-1">
            <CreditBadge
              balance={creditBalance}
              loading={creditsLoading}
              onRefresh={loadCredits}
            />
            {creditsError && (
              <span className="text-[11px] text-rose-600 max-w-xs text-right">
                {creditsError}
              </span>
            )}
          </div>
        </header>

        {/* Stepper */}
        <Stepper active={activeStep} />

        {/* SUBJECT */}
        <section className="rounded-2xl bg-white/90 backdrop-blur ring-1 ring-slate-200 shadow-sm p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-900">Пән</h2>
            <span className="text-xs text-slate-500">
              Пәнді таңдаңыз немесе жаңа пән қосыңыз
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <input
              className="w-full rounded-lg ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-600 outline-none px-3 py-2 text-sm"
              placeholder="Жаңа пән атауы"
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
            />
            <button
              type="button"
              className="rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-2 text-sm"
              onClick={addSubject}
            >
              Қосу
            </button>
            <select
              className="w-full rounded-lg ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-600 outline-none px-3 py-2 bg-white text-sm"
              value={selectedSubjectId ?? ""}
              onChange={(e) =>
                setSelectedSubjectId(
                  e.target.value ? Number(e.target.value) : null
                )
              }
            >
              <option value="">Пәнді таңдаңыз</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {subjects.length > 0 && (
            <div className="overflow-hidden rounded-xl ring-1 ring-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="text-left font-medium px-4 py-2 w-16">
                      ID
                    </th>
                    <th className="text-left font-medium px-4 py-2">Пән</th>
                    <th className="text-right font-medium px-4 py-2 w-32">
                      Әрекет
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {subjects.map((s) => (
                    <tr
                      key={s.id}
                      className={
                        selectedSubjectId === s.id ? "bg-blue-50/40" : ""
                      }
                    >
                      <td className="px-4 py-2">#{s.id}</td>
                      <td className="px-4 py-2">{s.name}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => deleteSubject(s.id)}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl ring-1 ring-rose-300 text-rose-700 hover:bg-rose-50 text-xs"
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
        <section
          className={`rounded-2xl bg-white/90 backdrop-blur ring-1 ring-slate-200 shadow-sm p-5 mb-6 ${
            !selectedSubjectId ? "opacity-60 pointer-events-none" : ""
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-900">Тақырып</h2>
            <span className="text-xs text-slate-500">
              {selectedSubject
                ? `${selectedSubject.name} пәнінің тақырыптары`
                : "Алдымен пәнді таңдаңыз"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <input
              className="w-full rounded-lg ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-600 outline-none px-3 py-2 text-sm"
              placeholder="Жаңа тақырып атауы"
              value={topicName}
              onChange={(e) => setTopicName(e.target.value)}
            />
            <button
              type="button"
              className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-2 text-sm"
              onClick={addTopic}
            >
              Қосу
            </button>
            <select
              className="w-full rounded-lg ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-600 outline-none px-3 py-2 bg-white text-sm"
              value={selectedTopicId ?? ""}
              onChange={(e) =>
                setSelectedTopicId(
                  e.target.value ? Number(e.target.value) : null
                )
              }
            >
              <option value="">Тақырыпты таңдаңыз</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {topics.length > 0 && (
            <div className="overflow-hidden rounded-xl ring-1 ring-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="text-left font-medium px-4 py-2 w-16">
                      ID
                    </th>
                    <th className="text-left font-medium px-4 py-2">
                      Тақырып
                    </th>
                    <th className="text-right font-medium px-4 py-2 w-32">
                      Әрекет
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {topics.map((t) => (
                    <tr
                      key={t.id}
                      className={
                        selectedTopicId === t.id ? "bg-blue-50/40" : ""
                      }
                    >
                      <td className="px-4 py-2">#{t.id}</td>
                      <td className="px-4 py-2">{t.name}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => deleteTopic(t.id)}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl ring-1 ring-rose-300 text-rose-700 hover:bg-rose-50 text-xs"
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
        <section
          className={`rounded-2xl bg-white/90 backdrop-blur ring-1 ring-slate-200 shadow-sm p-5 ${
            !canProceedToQuiz ? "opacity-60 pointer-events-none" : ""
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-900">Quiz</h2>
            <div className="inline-flex rounded-2xl ring-1 ring-slate-300 overflow-hidden">
              <button
                type="button"
                className={`px-3 py-1.5 text-xs font-medium ${
                  mode === "file"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-700 hover:bg-slate-50"
                }`}
                onClick={() => setMode("file")}
              >
                Файл
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 text-xs font-medium ${
                  mode === "manual"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-700 hover:bg-slate-50"
                }`}
                onClick={() => setMode("manual")}
              >
                Қолмен
              </button>
            </div>
          </div>

          {/* Manual */}
          {mode === "manual" && (
            <div className="space-y-4">
              <div className="rounded-xl ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-blue-600">
                <QuizEditor value={question} onChange={setQuestion} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Нұсқалар
                  </label>
                  <button
                    type="button"
                    onClick={addOption}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl ring-1 ring-slate-300 hover:bg-slate-50 text-slate-700 text-xs"
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
                          className="flex-1 rounded-xl ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-600 outline-none px-3 py-2 bg-white text-sm"
                          placeholder={`Жауап (${letter})`}
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
                          className="shrink-0 inline-flex items-center justify-center px-3 rounded-2xl ring-1 ring-rose-300 text-rose-700 hover:bg-rose-50"
                          title="Нұсқаны өшіру"
                          disabled={options.length <= 2}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="text-xs text-slate-700">
                <strong>Дұрыс жауап:</strong>{" "}
                <span className="font-semibold text-emerald-700">
                  {`Нұсқа ${String.fromCharCode(
                    65 +
                      Math.min(
                        correctIndex,
                        Math.max(0, options.length - 1)
                      )
                  )}`}
                </span>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={saveQuiz}
                  className="px-4 py-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
                >
                  Сақтау
                </button>
              </div>
            </div>
          )}

          {/* File */}
          {mode === "file" && (
            <div className="space-y-4">
              <div className="rounded-2xl ring-1 ring-slate-200 bg-white p-4">
                <div className="flex items-center gap-2">
                  <span className="grid place-items-center w-8 h-8 rounded-xl bg-slate-100 ring-1 ring-slate-200">
                    <FileIcon className="w-4 h-4 text-slate-600" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      DOCX импорт
                    </h3>
                    <div className="mt-1 text-[11px]">
                      <span className="text-slate-500">
                        DOCX-парсерді қолданған сайын 1 мүмкіндік жұмсалады.
                      </span>
                      {creditBalance !== null && (
                        <span
                          className={
                            "ml-2 font-semibold " +
                            (creditBalance > 0
                              ? "text-emerald-700"
                              : "text-rose-700")
                          }
                        >
                          Қалған мүмкіндік: {creditBalance}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <AutomateQuiz
                    disabled={creditBalance !== null && creditBalance <= 0}
                    onFileSelect={(file) => {
                      if (creditBalance !== null && creditBalance <= 0) {
                        setNoCreditPopup(true);
                        return;
                      }
                      handleDocxFile(file);
                    }}
                    maxSizeMB={20}
                    accept=".docx"
                    title={
                      creditBalance !== null && creditBalance > 0
                        ? "Файлды таңдаңыз"
                        : "Мүмкіндік қажет"
                    }
                    subtitle="A) B) C) D) форматындағы тесттер"
                  />
                </div>

                {parseLoading && (
                  <div className="mt-3 text-xs text-blue-700 bg-blue-50 ring-1 ring-blue-200 rounded-lg px-3 py-2">
                    Файл өңделуде…
                  </div>
                )}
                {parseError && (
                  <div className="mt-3 text-xs text-rose-700 bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2">
                    {parseError}
                  </div>
                )}

                <LowCreditWarning balance={creditBalance} />
              </div>

              {parsedQuestions.length > 0 && (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-slate-800">
                      Танылған сұрақтар
                      <span className="inline-flex items-center justify-center ml-2 px-2 py-0.5 rounded-lg bg-slate-100 ring-1 ring-slate-200 text-[10px]">
                        {parsedQuestions.length}
                      </span>
                    </h4>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={clearParsed}
                        className="px-3 py-1.5 rounded-2xl ring-1 ring-slate-300 hover:bg-slate-50 text-slate-700 text-[10px]"
                      >
                        Тазалау
                      </button>
                      <button
                        type="button"
                        onClick={saveAllParsed}
                        disabled={savingAll}
                        className={`px-3 py-1.5 rounded-2xl text-white text-[10px] ${
                          savingAll
                            ? "bg-emerald-500/70 cursor-wait"
                            : "bg-emerald-600 hover:bg-emerald-700"
                        }`}
                      >
                        {savingAll ? "Сақталуда…" : "Барлығын сақтау"}
                      </button>
                    </div>
                  </div>

                  {savingAll && (
                    <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden mb-2">
                      <div
                        className="h-full bg-emerald-600 transition-all"
                        style={{ width: `${saveProgress}%` }}
                      />
                    </div>
                  )}

                  <ul className="space-y-3">
                    {parsedQuestions.map((q) => (
                      <li
                        key={q.id}
                        className="rounded-xl p-4 bg-sky-50/70 border border-sky-100 shadow-sm"
                      >
                        <p className="font-medium text-slate-900 mb-2 text-sm">
                          {q.text || (
                            <em className="text-slate-500">
                              [Сұрақ мәтіні бос]
                            </em>
                          )}
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {q.options.map((opt) => (
                            <RadioRow
                              key={opt.id}
                              name={`question-${q.id}`}
                              checked={q.correctAnswer === opt.id}
                              label={opt.text}
                              onChange={() =>
                                handleAnswerSelect(q.id, opt.id)
                              }
                            />
                          ))}
                        </div>

                        <div
                          className={[
                            "mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] border",
                            q.correctAnswer !== undefined
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-amber-50 text-amber-700 border-amber-200",
                          ].join(" ")}
                        >
                          <Check
                            className={
                              q.correctAnswer !== undefined
                                ? "w-3.5 h-3.5 text-emerald-600"
                                : "w-3.5 h-3.5 text-amber-600"
                            }
                          />
                          {q.correctAnswer !== undefined
                            ? "Дұрыс жауап таңдалды"
                            : "Дұрыс жауапты таңдаңыз"}
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

      {/* Toast container */}
      <div
        aria-live="polite"
        className="fixed top-4 right-4 z-50 flex flex-col gap-2"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} t={t} />
        ))}
      </div>

      {/* Confirm modal */}
      {confirmConfig && (
        <ConfirmModal
          title={confirmConfig.title}
          message={confirmConfig.message}
          confirmLabel={confirmConfig.confirmLabel}
          cancelLabel={confirmConfig.cancelLabel}
          onCancel={closeConfirm}
          onConfirm={async () => {
            await confirmConfig.onConfirm();
            closeConfirm();
          }}
        />
      )}

      {/* No-opportunity popup */}
      {noCreditPopup && (
        <NoCreditPopup onClose={() => setNoCreditPopup(false)} />
      )}
    </div>
  );
}
