// src/pages/TopicsPage.tsx
import { useParams, Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { FaArrowLeft, FaBookOpen, FaSearch, FaLayerGroup, FaPlay } from "react-icons/fa";

interface Topic {
  id: number;
  name: string;
}

export default function TopicsPage() {
  const { name } = useParams();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [hovered, setHovered] = useState<number | null>(null);
  const navigate = useNavigate();

  const displayName = useMemo(
    () => decodeURIComponent(name || "").replace(/-/g, " "),
    [name]
  );

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`http://127.0.0.1:8000/api/subjects/${name}/topics`)
      .then((res) => {
        if (!res.ok) throw new Error("Тақырыптар жүктелмеді");
        return res.json();
      })
      .then((data) => setTopics(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message || "Қате"))
      .finally(() => setLoading(false));
  }, [name]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? topics.filter((t) => t.name.toLowerCase().includes(q)) : topics;
  }, [topics, query]);

  return (
    <div className="container py-4">
      {/* Header */}
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
            <div
              className="d-flex align-items-center justify-content-center"
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background:
                  "linear-gradient(135deg, rgba(99,102,241,.2), rgba(16,185,129,.2))",
                fontWeight: 700,
                fontSize: 22,
              }}
              title={displayName || "Пән"}
            >
              {(displayName || "P")[0]?.toUpperCase()}
            </div>
            <div>
              <h3 className="mb-1">{displayName || "Пән"}</h3>
              <div className="text-muted small d-flex align-items-center gap-3">
                <FaLayerGroup /> Тақырыптар:{" "}
                <span className="badge text-bg-secondary">{topics.length}</span>
              </div>
            </div>
          </div>

          <Link to="/" className="btn btn-outline-secondary">
            <FaArrowLeft className="me-2" />
            Басты бет
          </Link>
        </div>
      </div>

      {/* Іздеу */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <div className="row g-2 align-items-center">
            <div className="col-md-8">
              <div className="input-group">
                <span className="input-group-text">
                  <FaSearch />
                </span>
                <input
                  className="form-control"
                  placeholder="Тақырыпты іздеу…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="col-md-4 text-md-end text-muted small">
              {filtered.length} / {topics.length} көрсетілуде
            </div>
          </div>
        </div>
      </div>

      {/* Контент */}
      {loading ? (
        <div>Жүктелуде…</div>
      ) : error ? (
        <div className="alert alert-danger">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="alert alert-info">Бұл пәнде тақырып табылмады</div>
      ) : (
        <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 g-3">
          {filtered.map((t) => {
            const isHover = hovered === t.id;
            const style: React.CSSProperties = {
              transition: "transform .15s ease, boxShadow .15s ease",
              transform: isHover ? "translateY(-2px)" : "none",
              boxShadow: isHover ? "0 .5rem 1rem rgba(0,0,0,.08)" : undefined,
              cursor: "pointer",
            };
            return (
              <div className="col" key={t.id}>
                <div
                  className="card border-0 shadow-sm h-100"
                  style={style}
                  onMouseEnter={() => setHovered(t.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div className="card-body d-flex flex-column">
                    <h5 className="card-title">{t.name}</h5>
                    <p className="card-text text-muted small mb-4">
                      Quiz тапсыру үшін бастау батырмасын басыңыз.
                    </p>
                    <div className="mt-auto d-flex justify-content-end">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => navigate(`/topics/${t.id}/quizzes`)}
                      >
                        <FaPlay className="me-1" />
                        Quiz бастау
                      </button>
                    </div>
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
