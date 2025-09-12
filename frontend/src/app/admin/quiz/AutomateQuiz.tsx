// src/pages/quiz/AutomateQuiz.tsx
import { useRef, useState } from "react";
import { FiUploadCloud, FiFileText, FiXCircle, FiCheckCircle } from "react-icons/fi";

type AutomateQuizProps = {
  onFileSelect: (file: File) => void;      // Валид файл таңдағанда шақырылады
  maxSizeMB?: number;                       // Макс өлшем (әдепкі 15MB)
  accept?: string;                          // Қабылдайтын типтер (әдепкі ".docx")
  title?: string;                           // Тақырып
  subtitle?: string;                        // Қосымша түсіндірме
};

export default function AutomateQuiz({
  onFileSelect,
  maxSizeMB = 15,
  accept = ".docx",
  title = ".docx файлды импорттау",
  subtitle = "Файлды осында сүйреп тастаңыз немесе «Файл таңдау» батырмасын қолданыңыз.",
}: AutomateQuizProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const maxBytes = maxSizeMB * 1024 * 1024;

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  }

  function isAcceptedType(f: File) {
    const lower = f.name.toLowerCase();
    // accept=".docx" (әдепкі) — қажет болса accept-ті кеңейтесің: ".docx,.doc"
    const allowed = accept.split(",").map((s) => s.trim().toLowerCase());
    return allowed.some((ext) => lower.endsWith(ext));
  }

  function validateFile(f: File): string | null {
    if (!isAcceptedType(f)) return "Тек .docx файл қабылданады.";
    if (f.size > maxBytes) return `Файл тым үлкен (${formatBytes(f.size)}). Шекті өлшем: ${maxSizeMB} MB.`;
    return null;
  }

  function handleChosen(files: FileList | null) {
    if (!files || files.length === 0) return;
    const f = files[0];
    const err = validateFile(f);
    if (err) {
      setError(err);
      setFile(null);
      return;
    }
    setError(null);
    setFile(f);
    onFileSelect(f); // Валид файл → parent-ке жіберу
  }

  return (
    <div className="w-100">
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div>
          <h6 className="m-0">{title}</h6>
          <small className="text-muted">{subtitle}</small>
        </div>
        <small className="text-muted">
          Қабылдайды: <code>{accept}</code> · ≤ {maxSizeMB}MB
        </small>
      </div>

      {/* Dropzone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="DOCX dropzone"
        className="position-relative rounded-4 p-4 border border-2 text-center"
        style={{
          borderStyle: "dashed",
          background: dragOver ? "rgba(13,110,253,.06)" : "rgba(248,249,250,1)",
          transition: "background .2s ease, transform .1s ease",
          boxShadow: dragOver ? "0 10px 24px rgba(13,110,253,.15)" : "0 6px 16px rgba(0,0,0,.06)",
          transform: dragOver ? "scale(1.01)" : "scale(1.0)",
          outline: "none",
        }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleChosen(e.dataTransfer.files);
        }}
      >
        <FiUploadCloud size={46} className="mb-2" />
        <div className="mb-1 fw-semibold">Файлды осы аймаққа тастаңыз</div>
        <div className="text-muted small mb-3">немесе</div>
        <button
          type="button"
          className="btn btn-primary btn-sm px-3 rounded-pill"
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
        >
          Файл таңдау
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="d-none"
          onChange={(e) => handleChosen(e.target.files)}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert-danger d-flex align-items-center gap-2 mt-3 mb-0 py-2">
          <FiXCircle />
          <div>{error}</div>
        </div>
      )}

      {/* Selected file pill */}
      {file && !error && (
        <div className="d-flex align-items-center justify-content-between mt-3 p-2 rounded-3 bg-white border shadow-sm">
          <div className="d-flex align-items-center gap-2">
            <div
              className="d-inline-flex align-items-center justify-content-center rounded-circle"
              style={{
                width: 36,
                height: 36,
                background: "rgba(13,110,253,.08)",
              }}
            >
              <FiFileText />
            </div>
            <div>
              <div className="fw-medium">{file.name}</div>
              <small className="text-muted">{formatBytes(file.size)}</small>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="text-success d-flex align-items-center gap-1">
              <FiCheckCircle /> Дайын
            </span>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm rounded-pill"
              onClick={() => {
                setFile(null);
                setError(null);
                inputRef.current && (inputRef.current.value = "");
              }}
            >
              Басқа файл
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
