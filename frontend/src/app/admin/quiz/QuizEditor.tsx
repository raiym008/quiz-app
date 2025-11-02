// src/pages/quiz/QuizEditor.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { API_BASE } from "../../api/axiosClient";

type Props = {
  value: string;                 // сыртқа берілетін Markdown
  onChange: (markdown: string) => void;
  apiBase?: string;              // әдепкі: http://127.0.0.1:8000
  codeLanguage?: string;         // әдепкі: "javascript"
};

type Mode = null | "code" | "image";

type ImgItem = {
  id: string;
  previewUrl: string;
  url?: string;
  uploading: boolean;
  error?: string;
};

/** ===== Стандартқа жақын, түсінікті иконкалар (≈24px) ===== */
const Icon = {
  Bold: ({ className = "w-6 h-6" }) => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false">
      <path d="M7 4h6a4 4 0 1 1 0 8H7V4zm0 8h7a4 4 0 1 1 0 8H7v-8z" fill="currentColor"/>
    </svg>
  ),
  Italic: ({ className = "w-6 h-6" }) => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false">
      <path d="M10 5h10M4 19h10M14 5l-4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  Code: ({ className = "w-6 h-6" }) => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false">
      <path d="M8 8 4 12l4 4M16 8l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Image: ({ className = "w-6 h-6" }) => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false">
      <rect x="3" y="4" width="18" height="16" rx="2" ry="2" stroke="currentColor" strokeWidth="1.8" fill="none"/>
      <circle cx="9" cy="9" r="2" fill="currentColor"/>
      <path d="M5 18l5.5-5 3.5 3.5L18 12l3 4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
    </svg>
  ),
  Trash: ({ className = "w-6 h-6" }) => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false">
      <path d="M3 6h18M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
  Plus: ({ className = "w-6 h-6" }) => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
};

/** ===== Түйме + белсенді индикатор (tooltip + aria-pressed) ===== */
function ToolButton({
  label,
  onClick,
  children,
  active = false,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()} // selection сақталсын
      onClick={onClick}
      aria-pressed={active}
      className={[
        "group relative px-3 py-2 rounded-xl text-sm ring-1 transition",
        active
          ? "bg-blue-600 text-white ring-blue-600"
          : "bg-white text-slate-800 hover:bg-slate-50 ring-slate-300",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
      ].join(" ")}
      title={label}
    >
      {/* белсенді нүкте-индикатор */}
      <span
        className={[
          "absolute -top-1 -right-1 w-2 h-2 rounded-full",
          active ? "bg-blue-600" : "bg-transparent ring-1 ring-slate-300"
        ].join(" ")}
        aria-hidden
      />
      {children}
      {/* custom tooltip */}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-[calc(100%+8px)]
                   whitespace-nowrap rounded-md bg-slate-900/95 text-white text-[11px] px-2 py-1
                   shadow-lg opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        {label}
      </span>
    </button>
  );
}

/** ===== HTML <-> Markdown (минимал, тұрақты) ===== */
function htmlToMarkdown(html: string, codeLang = "javascript"): string {
  let s = html;

  // editor-only wrappers
  s = s.replace(/<div[^>]*data-qe-block[^>]*>([\s\S]*?)<\/div>/g, "$1");

  // line breaks
  s = s.replace(/<br\s*\/?>/gi, "\n");

  // images
  s = s.replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi, (_m, src) => `![image](${src})`);

  // code blocks
  s = s.replace(/<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi, (_m, code) => {
    const txt = decodeHTMLEntities(code);
    return `\n\`\`\`${codeLang}\n${txt}\n\`\`\`\n`;
  });

  // inline code
  s = s.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_m, code) => `\`${decodeHTMLEntities(code)}\``);

  // strong & em
  s = s.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, (_m, t) => `**${stripTags(t)}**`);
  s = s.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, (_m, t) => `**${stripTags(t)}**`);
  s = s.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, (_m, t) => `*${stripTags(t)}*`);
  s = s.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, (_m, t) => `*${stripTags(t)}*`);

  // paragraphs/divs -> newlines
  s = s.replace(/<\/(p|div|h[1-6])>/gi, "\n\n");
  s = s.replace(/<(p|div|h[1-6])[^>]*>/gi, "");

  // remove leftover tags
  s = s.replace(/<\/?span[^>]*>/gi, "");
  s = s.replace(/<[^>]+>/g, "");

  return s.replace(/\u00A0/g, " ").replace(/[ \t]+\n/g, "\n").trim();
}

function markdownToHtml(md: string): string {
  let s = md;

  // code block ```
  s = s.replace(/```([\w-]*)\n([\s\S]*?)```/g, (_m, _lang, code) => {
    return `<pre class="qe-pre"><code>${encodeHTMLEntities(code)}</code></pre>`;
  });

  // images
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, src) => `<img src="${src}" alt="${alt || "image"}" />`);

  // bold & italic
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  // paragraphs
  const parts = s.split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, "<br/>")}</p>`);
  return parts.join("");
}

function stripTags(s: string) { return s.replace(/<[^>]+>/g, ""); }
function encodeHTMLEntities(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function decodeHTMLEntities(s: string) {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

export default function QuizEditor({
  value,
  onChange,
  apiBase = API_BASE,
  codeLanguage = "javascript",
}: Props) {
  const [mode, setMode] = useState<Mode>(null);
  const [code, setCode] = useState("");
  const [images, setImages] = useState<ImgItem[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const ceRef = useRef<HTMLDivElement | null>(null);
  const lastAppliedMarkdownRef = useRef<string>("");

  // Формат индикаторлары (B/I) — queryCommandState арқылы
  const [fmt, setFmt] = useState<{ bold: boolean; italic: boolean }>({ bold: false, italic: false });

  // сыртқы value өзгерсе ғана DOM-ға жазамыз — caret секірмейді
  useEffect(() => {
    const el = ceRef.current;
    if (!el) return;
    if (value === lastAppliedMarkdownRef.current) return;
    const nextHtml = markdownToHtml(value || "");
    el.innerHTML = nextHtml;
    lastAppliedMarkdownRef.current = value || "";
  }, [value]);

  // selection ішкі редакторда болса ғана күйді жаңарту
  useEffect(() => {
    const handler = () => {
      const el = ceRef.current;
      const sel = window.getSelection();
      if (!el || !sel || !sel.anchorNode) return;
      const inside = el.contains(sel.anchorNode);
      if (!inside) return;
      // execCommand күйін оқу (кең қолдау бар)
      const b = document.queryCommandState("bold");
      const i = document.queryCommandState("italic");
      setFmt({ bold: !!b, italic: !!i });
    };
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, []);

  /* ---------- helpers ---------- */
  const makeId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  const absoluteUrl = (u: string) => (u.startsWith("http") ? u : `${apiBase}${u.startsWith("/") ? "" : "/"}${u}`);

  const syncMarkdown = () => {
    const el = ceRef.current;
    if (!el) return;
    const newHtml = el.innerHTML;
    const md = htmlToMarkdown(newHtml, codeLanguage);
    lastAppliedMarkdownRef.current = md;
    onChange(md);
  };

  // execCommand helper
  const applyCommand = (cmd: "bold" | "italic") => {
    const el = ceRef.current;
    if (!el) return;
    el.focus();
    document.execCommand(cmd);
    syncMarkdown();
    // батырма индикаторын да бірден жаңартамыз
    const b = document.queryCommandState("bold");
    const i = document.queryCommandState("italic");
    setFmt({ bold: !!b, italic: !!i });
  };

  const addBold = () => applyCommand("bold");
  const addItalic = () => applyCommand("italic");

  const onInput = () => syncMarkdown();

  const onKeyDownCE = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    const k = e.key.toLowerCase();
    if (k === "b") { e.preventDefault(); addBold(); }
    if (k === "i") { e.preventDefault(); addItalic(); }
  };

  // paste — жалаң мәтін
  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    syncMarkdown();
  };

  const clearTemp = () => {
    images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setImages([]);
    setMode(null);
    setCode("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const it = prev.find((x) => x.id === id);
      if (it) URL.revokeObjectURL(it.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
  };

  const onPickImage = async (file: File) => {
    const item: ImgItem = { id: makeId(), previewUrl: URL.createObjectURL(file), uploading: true };
    setImages((prev) => [item, ...prev]);

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch(`${apiBase}/api/upload`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data?.url) throw new Error(data?.detail || "Сурет жүктеу қатесі");
      const url = absoluteUrl(data.url);
      setImages((prev) => prev.map((x) => (x.id === item.id ? { ...x, uploading: false, url } : x)));
    } catch (e: any) {
      setImages((prev) => prev.map((x) => (x.id === item.id ? { ...x, uploading: false, error: e?.message || "Қате" } : x)));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const insertImageAtCaret = (url: string) => {
    const el = ceRef.current;
    if (!el) return;
    el.focus();
    document.execCommand("insertHTML", false, `<img src="${url}" alt="image" />`);
    syncMarkdown();
  };
  const insertImageMarkdown = (img: ImgItem) => {
    if (!img.url) return;
    insertImageAtCaret(img.url);
  };

  const insertCodeBlock = () => {
    if (!code.trim()) return;
    const el = ceRef.current;
    if (!el) return;
    const block = `<pre class="qe-pre" data-qe-block="code"><code>${encodeHTMLEntities(code)}</code></pre>`;
    el.focus();
    document.execCommand("insertHTML", false, block);
    syncMarkdown();
  };

  const hasUploading = useMemo(() => images.some((i) => i.uploading), [images]);

  useEffect(() => {
    return () => { images.forEach((img) => URL.revokeObjectURL(img.previewUrl)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- UI ---------- */
  return (
    <div className="rounded-2xl ring-1 ring-slate-200 bg-white">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-2 bg-white/85 backdrop-blur rounded-t-2xl border-b border-slate-200">
        <span className="text-sm font-semibold text-slate-800">Сұрақ редакторы</span>
        <div className="flex items-center gap-1.5">
          <ToolButton label="Код (қосу/жабу)" onClick={() => setMode(mode === "code" ? null : "code")}>
            <Icon.Code />
          </ToolButton>
          <ToolButton label="Сурет (қосу/жабу)" onClick={() => setMode(mode === "image" ? null : "image")}>
            <Icon.Image />
          </ToolButton>
          <ToolButton label="Қалың (Ctrl/Cmd + B)" onClick={addBold} active={fmt.bold}>
            <Icon.Bold />
          </ToolButton>
          <ToolButton label="Курсив (Ctrl/Cmd + I)" onClick={addItalic} active={fmt.italic}>
            <Icon.Italic />
          </ToolButton>
          <ToolButton label="Тазалау (уақытша)" onClick={clearTemp}>
            <Icon.Trash />
          </ToolButton>
        </div>
      </div>

      {/* Body */}
      <div className="p-3">
        {/* WYSIWYG contenteditable — uncontrolled */}
        <div
          ref={ceRef}
          className="w-full min-h-[140px] rounded-xl ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-blue-600
                     outline-none px-3 py-2 text-[15px] leading-7 bg-white mb-3
                     prose prose-sm max-w-none selection:bg-blue-100
                     [&_.qe-pre]:bg-slate-900 [&_.qe-pre]:text-slate-50 [&_.qe-pre]:rounded-lg [&_.qe-pre]:p-3
                     [&_img]:max-w-full [&_img]:rounded-lg"
          contentEditable
          suppressContentEditableWarning
          onInput={onInput}
          onKeyDown={onKeyDownCE}
          onPaste={onPaste}
          data-gramm_editor="false"
          aria-label="Сұрақ мәтіні"
        />

        {/* CODE mode */}
        {mode === "code" && (
          <div className="rounded-xl ring-1 ring-slate-200 overflow-hidden mb-3">
            <Editor
              height="220px"
              theme="vs-dark"
              defaultLanguage={codeLanguage}
              value={code}
              onChange={(v) => setCode(v || "")}
              options={{ minimap: { enabled: false }, fontSize: 13, lineNumbers: "on", scrollBeyondLastLine: false }}
            />
            <div className="p-2 flex justify-end gap-2 bg-white">
              <button className="px-3 py-1.5 rounded-lg ring-1 ring-slate-300 hover:bg-slate-50 text-slate-700 text-sm" onClick={() => setMode(null)}>
                Жабу
              </button>
              <button className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm" onClick={insertCodeBlock}>
                Кодты сұраққа қосу
              </button>
            </div>
          </div>
        )}

        {/* IMAGE mode */}
        {mode === "image" && (
          <div className="p-3 rounded-xl ring-1 ring-slate-200 bg-white mb-3">
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                className="block w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0
                           file:bg-slate-900 file:text-white file:text-sm file:cursor-pointer
                           ring-1 ring-slate-200 rounded-lg px-2 py-1.5"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPickImage(f);
                }}
              />
              <button
                className="px-3 py-1.5 rounded-lg ring-1 ring-slate-300 hover:bg-slate-50 text-slate-700 text-sm disabled:opacity-60"
                onClick={() => setMode(null)}
                disabled={hasUploading}
              >
                Жабу
              </button>
            </div>
            <small className="text-slate-500 block mt-2 text-xs">
              Файл таңдасаң — бірден жүктеледі. Төмендегі галереядан “Сұраққа қосу” арқылы бірден редакторға енгізіледі.
            </small>
          </div>
        )}

        {/* Gallery */}
        {images.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-800">Суреттер</span>
              <small className="text-slate-500">{hasUploading ? "Жүктелуде…" : "Дайын"}</small>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {images.map((img) => (
                <div key={img.id} className="rounded-xl ring-1 ring-slate-200 p-2 bg-white flex flex-col">
                  <div className="aspect-[4/3] rounded-md overflow-hidden mb-2 bg-slate-50 grid place-items-center">
                    {img.error ? (
                      <div className="text-rose-600 text-sm">{img.error}</div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img.url || img.previewUrl} alt="preview" className="w-full h-full object-cover" />
                    )}
                  </div>

                  <div className="flex gap-2 mt-auto">
                    <button
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg ring-1 ring-rose-300 text-rose-700 hover:bg-rose-50 text-sm disabled:opacity-60"
                      title="Өшіру"
                      onClick={() => removeImage(img.id)}
                      disabled={img.uploading}
                    >
                      <Icon.Trash /> Өшіру
                    </button>

                    <button
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg ring-1 ring-blue-300 text-blue-700 hover:bg-blue-50 text-sm flex-1 disabled:opacity-60"
                      title="Сұраққа қосу"
                      onClick={() => insertImageMarkdown(img)}
                      disabled={img.uploading || !img.url}
                    >
                      <Icon.Plus /> Сұраққа қосу
                    </button>
                  </div>

                  {!img.uploading && img.url && (
                    <small className="text-slate-500 mt-2 text-xs truncate" title={img.url}>
                      {img.url}
                    </small>
                  )}
                  {img.uploading && (
                    <small className="text-slate-500 mt-2 text-xs">Жүктелуде…</small>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
