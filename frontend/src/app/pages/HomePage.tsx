// src/pages/HomePage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaSearch, FaArrowRight, FaBookOpen } from "react-icons/fa";

interface Subject {
  id: number;
  name: string;
}

export default function HomePage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [hovered, setHovered] = useState<number | null>(null);
  const navigate = useNavigate();

  // URL-ға ыңғайлы кілт
  const toKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "-");

  // Кішкентай эмоциялық акцент: пәнге байланысты эмодзи
  const subjectEmoji = (name: string) => {
    const n = name.toLowerCase();
    if (/(информатика|informat)/i.test(n)) return "💻";
    if (/(математик|math)/i.test(n)) return "📐";
    if (/(тарих|history)/i.test(n)) return "🏛️";
    if (/(физик|physics)/i.test(n)) return "🔭";
    if (/(химия|chem)/i.test(n)) return "⚗️";
    if (/(биолог|bio)/i.test(n)) return "🧬";
    return "📘";
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch("http://127.0.0.1:8000/api/subjects")
      .then((res) => {
        if (!res.ok) throw new Error("Пәндер жүктелмеді");
        return res.json();
      })
      .then((data) => setSubjects(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message || "Қате"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? subjects.filter((s) => s.name.toLowerCase().includes(q)) : subjects;
  }, [subjects, query]);

  return (
    <div className="container py-4">
      {/* Профайл-стиль Header */}
      <div className="card border-0 shadow-sm overflow-hidden mb-4">
        <div
          className="w-100"
          style={{
            height: 120,
            background:
              "linear-gradient(135deg, rgba(99,102,241,.12), rgba(16,185,129,.12))",
          }}
          aria-hidden
        />
        <div className="card-body d-flex align-items-center justify-content-between flex-wrap gap-3">
          <div className="d-flex align-items-center gap-3">
            {/* Пәндер «аватары» */}
            <div
              className="d-flex align-items-center justify-content-center"
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background:
                  "linear-gradient(135deg, rgba(99,102,241,.2), rgba(16,185,129,.2))",
                boxShadow: "inset 0 0 0 2px rgba(0,0,0,.04)",
                fontWeight: 700,
                fontSize: 22,
              }}
              title="Пәндер"
            >
              📚
            </div>
            <div>
              <h3 className="mb-1">Пәндер</h3>
              <div className="text-muted small d-flex align-items-center gap-3">
                <span className="d-inline-flex align-items-center gap-2">
                  <FaBookOpen /> Барлығы:{" "}
                  <span className="badge text-bg-secondary">
                    {subjects.length}
                  </span>
                </span>
                <span className="d-none d-sm-inline">Оқығыңыз келетін пәнді таңдаңыз</span>
              </div>
            </div>
          </div>
          <div className="text-muted small">Қош келдіңіз!</div>
        </div>
      </div>

      {/* Іздеу + санау (пайдаланушыға түсінікті feedback) */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <div className="row g-2 align-items-center">
            <div className="col-md-8">
              <label className="form-label d-none">Пәнді іздеу</label>
              <div className="input-group">
                <span className="input-group-text" aria-hidden>
                  <FaSearch />
                </span>
                <input
                  className="form-control"
                  placeholder="Пәнді іздеу…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Пәнді іздеу"
                />
              </div>
              <small className="text-muted">
                Жазып көріңіз: “информатика”, “математика”, “қазақстан тарихы”
              </small>
            </div>
            <div className="col-md-4 text-md-end text-muted small">
              {filtered.length} / {subjects.length} көрсетілуде
            </div>
          </div>
        </div>
      </div>

      {/* Контент күйлері: жүктелу / қате / бос / карточкалар */}
      {loading ? (
        // Loading skeleton — когнитив жүктемені азайтады, күтуді түсіндіреді
        <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 g-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div className="col" key={i}>
              <div className="card border-0 shadow-sm p-3">
                <div className="placeholder-glow">
                  <div className="d-flex align-items-center gap-3 mb-3">
                    <span className="placeholder rounded-circle" style={{ width: 44, height: 44 }}></span>
                    <span className="placeholder col-6"></span>
                  </div>
                  <span className="placeholder col-8 mb-1"></span>
                  <span className="placeholder col-5"></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        // Error state — нақты түсінікті хабарлама
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        // Empty state — эмоция қосу, нені істеу керегін көрсету
        <div className="card border-0 shadow-sm p-4 text-center text-muted">
          <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 12 }}>🔎</div>
          Іздеуіңізге сәйкес пән табылмады.
          <div className="mt-2 small">Бас әріпсіз жазып көріңіз немесе қысқаша атауын енгізіңіз.</div>
        </div>
      ) : (
        // Пән карточкалары — профайлге ұқсас, толық кликабельді, hover-friendly
        <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 g-3">
          {filtered.map((s) => {
            const slug = encodeURIComponent(toKey(s.name));
            const initial = s.name?.[0]?.toUpperCase() || "S";
            const emoji = subjectEmoji(s.name);

            const isHover = hovered === s.id;
            const cardStyle: React.CSSProperties = {
              transition: "transform .15s ease, box-shadow .15s ease",
              transform: isHover ? "translateY(-2px)" : "none",
              boxShadow: isHover ? "0 .5rem 1rem rgba(0,0,0,.08)" : undefined,
              cursor: "pointer",
            };

            return (
              <div className="col" key={s.id}>
                <div
                  className="card border-0 shadow-sm h-100 position-relative"
                  style={cardStyle}
                  onMouseEnter={() => setHovered(s.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => navigate(`/subjects/${slug}/topics`)}
                >
                  <div className="card-body d-flex flex-column">
                    <div className="d-flex align-items-center gap-3 mb-3">
                      <div
                        className="d-flex align-items-center justify-content-center"
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: "50%",
                          background: "#f3f5f7",
                          fontWeight: 700,
                          fontSize: 18,
                        }}
                        aria-hidden
                      >
                        {emoji || initial}
                      </div>
                      <h5 className="card-title mb-0">{s.name}</h5>
                    </div>

                    <p className="card-text text-muted small mb-4">
                      Тақырыптарға өту үшін басыңыз.
                    </p>

                    {/* Ілгерілеу сезімін беру үшін кішкентай прогресс жолақ (болашақта нақты мәнге ауыстырасыз) */}
                    <div className="progress mb-3" style={{ height: 6 }}>
                      <div
                        className="progress-bar"
                        role="progressbar"
                        style={{ width: "100%" }}
                        aria-valuenow={100}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      />
                    </div>

                    <div className="mt-auto d-flex justify-content-end">
                      <span className="btn btn-outline-primary btn-sm">
                        Ашу <FaArrowRight className="ms-1" />
                      </span>
                    </div>

                    {/* Толық карточканы кликабельді ететін “stretched-link” */}
                    <a
                      className="stretched-link"
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(`/subjects/${slug}/topics`);
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
