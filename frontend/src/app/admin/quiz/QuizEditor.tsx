import { useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { FaCode, FaBold, FaItalic, FaImage, FaTrash, FaPlus, FaBroom } from "react-icons/fa";

type Props = {
  value: string;
  onChange: (v: string) => void;
  apiBase?: string;          // әдепкі: http://127.0.0.1:8000
  codeLanguage?: string;     // әдепкі: "javascript"
};

type ImgItem = {
  id: string;
  previewUrl: string;        // blob: локал превью
  url?: string;              // сервер қайтарған тұрақты URL
  uploading: boolean;
  error?: string;
};

export default function QuizEditor({
  value,
  onChange,
  apiBase = "http://127.0.0.1:8000",
  codeLanguage = "javascript",
}: Props) {
  type Mode = null | "code" | "image";
  const [mode, setMode] = useState<Mode>(null);

  // ----- CODE
  const [code, setCode] = useState("");

  // ----- IMAGES (бірнеше суретті қолдайды)
  const [images, setImages] = useState<ImgItem[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // helpers
  const makeId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  const absoluteUrl = (u: string) => (u.startsWith("http") ? u : `${apiBase}${u.startsWith("/") ? "" : "/"}${u}`);

  const addBold = () => onChange((value || "") + " **мәтін** ");
  const addItalic = () => onChange((value || "") + " *мәтін* ");

  const clearTemp = () => {
    // тек уақытша баптауларды тазалау (суреттерді де тазалаймыз)
    images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setImages([]);
    setMode(null);
    setCode("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const item = prev.find((x) => x.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
  };

  const onPickImage = async (file: File) => {
    // 1) локал превью
    const item: ImgItem = {
      id: makeId(),
      previewUrl: URL.createObjectURL(file),
      uploading: true,
    };
    setImages((prev) => [item, ...prev]);

    // 2) серверге жүктеу
    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch(`${apiBase}/api/upload`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data?.url) {
        throw new Error(data?.detail || "Сурет жүктеу қатесі");
      }
      const url = absoluteUrl(data.url);

      // 3) нәтиже: осы сурет элементін жаңарту (жоғалмайды!)
      setImages((prev) =>
        prev.map((x) =>
          x.id === item.id ? { ...x, uploading: false, url } : x
        )
      );
      // Назар аудар: textarea-ға ЕШТЕҢЕ енгізбейміз. Тек галереяға сақталды.
    } catch (e: any) {
      setImages((prev) =>
        prev.map((x) =>
          x.id === item.id ? { ...x, uploading: false, error: e?.message || "Қате" } : x
        )
      );
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const insertImageMarkdown = (img: ImgItem) => {
    if (!img.url) return; // әлі жүктелмеген
    onChange((value || "") + `\n![image](${img.url})\n`);
  };

  const insertCodeMarkdown = () => {
    if (!code.trim()) return;
    onChange((value || "") + `\n\`\`\`${codeLanguage}\n${code}\n\`\`\`\n`);
  };

  const hasUploading = useMemo(() => images.some((i) => i.uploading), [images]);

  return (
    <div className="card border-0 shadow-sm">
      {/* Header / Toolbar */}
      <div className="card-header bg-white d-flex justify-content-between align-items-center">
        <span className="fw-semibold">📝 Сұрақ редакторы</span>
        <div className="d-flex gap-2">
          {/* Код */}
          <button
            className={`btn btn-sm ${mode === "code" ? "btn-primary" : "btn-outline-secondary"}`}
            title="Код"
            onClick={() => setMode(mode === "code" ? null : "code")}
          >
            <FaCode />
          </button>

          {/* Сурет */}
          <button
            className={`btn btn-sm ${mode === "image" ? "btn-primary" : "btn-outline-secondary"}`}
            title="Сурет"
            onClick={() => setMode(mode === "image" ? null : "image")}
          >
            <FaImage />
          </button>

          {/* Қалың / Курсив — бірден инъекция */}
          <button className="btn btn-sm btn-outline-secondary" title="Қалың" onClick={addBold}>
            <FaBold />
          </button>
          <button className="btn btn-sm btn-outline-secondary" title="Курсив" onClick={addItalic}>
            <FaItalic />
          </button>

          {/* Барлығын тазалау (уақытша) */}
          <button className="btn btn-sm btn-outline-secondary" title="Барлығын тазалау" onClick={clearTemp}>
            <FaBroom />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="card-body">
        {/* Негізгі textarea (тек өзің жазасың; сурет/файл аты автоматты кірмейді) */}
        <textarea
          className="form-control mb-3"
          placeholder="Сұрақтың мәтіні (Markdown қолдайды)…"
          rows={5}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />

        {/* CODE режимі */}
        {mode === "code" && (
          <div className="border rounded mb-3">
            <Editor
              height="220px"
              theme="vs-dark"
              defaultLanguage={codeLanguage}
              value={code}
              onChange={(v) => setCode(v || "")}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: "on",
                scrollBeyondLastLine: false,
              }}
            />
            <div className="p-2 d-flex justify-content-end gap-2">
              <button className="btn btn-sm btn-outline-secondary" onClick={() => setMode(null)}>
                Жабу
              </button>
              <button className="btn btn-sm btn-primary" onClick={insertCodeMarkdown}>
                Кодты сұраққа қосу
              </button>
            </div>
          </div>
        )}

        {/* IMAGE режимі */}
        {mode === "image" && (
          <div className="p-3 border rounded mb-3">
            <div className="d-flex align-items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                className="form-control"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPickImage(f);
                }}
              />
              <button className="btn btn-outline-secondary" onClick={() => setMode(null)} disabled={hasUploading}>
                Жабу
              </button>
            </div>
            <small className="text-muted d-block mt-2">
              Файл таңдасаң — бірден жүктеледі. Содан кейін төмендегі галереядан “Сұраққа қосу” батырмасымен енгіз.
            </small>
          </div>
        )}

        {/* Галерея: суреттер әрқашан көрінеді, жоғалып кетпейді */}
        {images.length > 0 && (
          <>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="fw-semibold">Суреттер</span>
              <small className="text-muted">{hasUploading ? "Жүктелуде…" : "Дайын"}</small>
            </div>

            <div className="row g-3">
              {images.map((img) => (
                <div className="col-sm-6 col-md-4 col-lg-3" key={img.id}>
                  <div className="border rounded p-2 h-100 d-flex flex-column">
                    <div className="ratio ratio-4x3 mb-2" style={{ backgroundColor: "#f8f9fa" }}>
                      {img.error ? (
                        <div className="d-flex align-items-center justify-content-center text-danger small">
                          {img.error}
                        </div>
                      ) : (
                        <img
                          src={img.url || img.previewUrl}
                          alt="preview"
                          style={{ objectFit: "cover", borderRadius: 6 }}
                        />
                      )}
                    </div>

                    <div className="d-flex gap-2 mt-auto">
                      <button
                        className="btn btn-sm btn-outline-danger"
                        title="Өшіру"
                        onClick={() => removeImage(img.id)}
                        disabled={img.uploading}
                      >
                        <FaTrash />
                      </button>

                      <button
                        className="btn btn-sm btn-outline-primary flex-grow-1"
                        title="Сұраққа қосу (Markdown)"
                        onClick={() => insertImageMarkdown(img)}
                        disabled={img.uploading || !img.url}
                      >
                        <FaPlus className="me-1" /> Сұраққа қосу
                      </button>
                    </div>

                    {img.uploading && (
                      <small className="text-muted mt-2">Жүктелуде…</small>
                    )}
                    {!img.uploading && img.url && (
                      <small className="text-muted mt-2 text-truncate" title={img.url}>
                        {img.url}
                      </small>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
