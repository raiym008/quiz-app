// src/pages/TopicsPage.tsx
import { useParams, Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { FaArrowLeft, FaLayerGroup, FaSearch, FaPlay, FaTimes } from "react-icons/fa";

interface Topic {
  id: number;
  name: string;
}

const API =
  (import.meta as any).env?.VITE_API_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:8000";

export default function TopicsPage() {
  const { name } = useParams(); // пән slug (қазақша болуы мүмкін)
  const navigate = useNavigate();

  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [hovered, setHovered] = useState<number | null>(null);

  // Емтихан үшін «таңдау режимі»
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState<number | "">("");

  const subjectDisplay = useMemo(
    () => decodeURIComponent(name || "").replace(/-/g, " "),
    [name]
  );

  // Тақырыптарды жүктеу
  useEffect(() => {
    setLoading(true);
    setError(null);
    setSelected([]);
    setSelectMode(false);
    fetch(`${API}/api/subjects/${encodeURIComponent(name || "")}/topics`)
      .then((res) => {
        if (!res.ok) throw new Error("Тақырыптар жүктелмеді");
        return res.json();
      })
      .then((data) => setTopics(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message || "Қате"))
      .finally(() => setLoading(false));
  }, [name]);

  // Іздеу
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? topics.filter((t) => t.name.toLowerCase().includes(q)) : topics;
  }, [topics, query]);

  // Таңдау логикасы (тек selectMode=true кезінде маңызды)
  const allChecked =
    filtered.length > 0 && filtered.every((t) => selected.includes(t.id));

  const toggleAll = () => {
    if (!selectMode) return;
    if (allChecked) {
      const toRemove = new Set(filtered.map((t) => t.id));
      setSelected((prev) => prev.filter((id) => !toRemove.has(id)));
    } else {
      const merged = new Set(selected);
      filtered.forEach((t) => merged.add(t.id));
      setSelected(Array.from(merged));
    }
  };

  const toggleOne = (id: number) => {
    if (!selectMode) return; // таңдау режимі болмаса, карточка click-і жұмыс істейді
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Карточканың үстінен басқанда — жеке тақырыптан quiz басталады (selectMode=false кезде)
  const openSingleTopicQuiz = (topicId: number) => {
    if (selectMode) {
      toggleOne(topicId);
      return;
    }
    navigate(`/topics/${topicId}/quizzes`);
  };

  // Емтихан батырмасы: 1-рет басса — тек таңдау режимін қосады
  const onExamClick = () => {
    if (!selectMode) {
      setSelectMode(true);
      setSelected([]);
      return;
    }
    // selectMode=true болса, ештеңе істемейміз — «Емтиханды бастау» батырмасы бөлек
  };

  // Емтиханды бастау (тек selectMode=true кезінде қолжетімді)
  const startCombinedExam = async () => {
    if (!selectMode || selected.length === 0) return;
    setBusy(true);
    try {
      const body: any = { topic_ids: selected, shuffle: true };
      if (typeof limit === "number" && limit > 0) body.limit = limit;

      const res = await fetch(`${API}/api/topics/${encodeURIComponent(name || "")}/exam`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json(); // { count, quizzes }
      if (!res.ok || !data?.quizzes?.length) {
        throw new Error(
          data?.detail || "Таңдалған тақырыптардан quiz табылмады"
        );
      }

      // Қазақша slug-қа сай емтихан бетіне апарамыз
      navigate(`/${encodeURIComponent(name || "")}/topics/emtihan`, {
        state: { quizzes: data.quizzes, subject: subjectDisplay },
      });
    } catch (e: any) {
      setError(e?.message || "Жүктеу сәтсіз");
    } finally {
      setBusy(false);
    }
  };

  const cancelSelectMode = () => {
    setSelectMode(false);
    setSelected([]);
    setLimit("");
  };

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
              title={subjectDisplay || "Пән"}
            >
              {(subjectDisplay || "P")[0]?.toUpperCase()}
            </div>
            <div>
              <h3 className="mb-1">{subjectDisplay || "Пән"}</h3>
              <div className="text-muted small d-flex align-items-center gap-3">
                <FaLayerGroup /> Тақырыптар:{" "}
                <span className="badge text-bg-secondary">{topics.length}</span>
              </div>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            {!selectMode ? (
              <button className="btn btn-primary" onClick={onExamClick} title="Емтихан режимін қосу">
                <FaPlay className="me-1" />
                Емтихан
              </button>
            ) : (
              <>
                <button
                  className="btn btn-success"
                  disabled={busy || selected.length === 0}
                  onClick={startCombinedExam}
                  title={selected.length === 0 ? "Алдымен тақырып таңдаңыз" : "Емтиханды бастау"}
                >
                  <FaPlay className="me-1" />
                  {busy ? "Жүктелуде..." : `Емтиханды бастау (${selected.length})`}
                </button>
                <button className="btn btn-outline-secondary" onClick={cancelSelectMode} title="Таңдау режимінен шығу">
                  <FaTimes className="me-1" />
                  Бас тарту
                </button>
              </>
            )}

            <Link to="/" className="btn btn-outline-secondary">
              <FaArrowLeft className="me-2" />
              Басты бет
            </Link>
          </div>
        </div>
      </div>

      {/* Іздеу + (таңдау режимінде — топтық басқару) */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <div className="row g-2 align-items-center">
            <div className="col-lg-6">
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
              <small className="text-muted">
                Көрсетіліп тұрғандар: {filtered.length} / {topics.length}
              </small>
            </div>

            {selectMode && (
              <div className="col-lg-6 d-flex flex-wrap gap-2 justify-content-lg-end">
                <div className="form-check d-flex align-items-center">
                  <input
                    id="checkAll"
                    className="form-check-input me-2"
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                  />
                  <label htmlFor="checkAll" className="form-check-label">
                    Барлығын таңдау
                  </label>
                </div>

                <div className="input-group" style={{ width: 160 }}>
                  <span className="input-group-text">Лимит</span>
                  <input
                    type="number"
                    min={1}
                    className="form-control"
                    value={limit}
                    onChange={(e) => {
                      const v = e.target.value;
                      setLimit(v === "" ? "" : Math.max(1, Number(v)));
                    }}
                    placeholder="(опц.)"
                  />
                </div>
              </div>
            )}
          </div>

          {selectMode && (
            <div className="text-muted small mt-2">
              Таңдау режимі қосулы. Қажетті тақырыптардың карточкасын белгілеңіз (карточканы да басуға болады).
            </div>
          )}
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
            const isChecked = selected.includes(t.id);

            const style: React.CSSProperties = {
              transition: "transform .15s ease, boxShadow .15s ease",
              transform: isHover ? "translateY(-2px)" : "none",
              boxShadow: isHover ? "0 .5rem 1rem rgba(0,0,0,.08)" : undefined,
              cursor: "pointer",
              border: selectMode && isChecked ? "1px solid var(--bs-primary)" : undefined,
            };

            return (
              <div className="col" key={t.id}>
                <div
                  className="card border-0 shadow-sm h-100"
                  style={style}
                  onMouseEnter={() => setHovered(t.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => openSingleTopicQuiz(t.id)} // selectMode=false → бірден quiz; true → toggle select
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openSingleTopicQuiz(t.id);
                    }
                  }}
                  aria-label={
                    selectMode
                      ? `${t.name} таңдау/тазалау`
                      : `${t.name} тақырыбынан quiz бастау`
                  }
                >
                  <div className="card-body d-flex flex-column">
                    <div className="d-flex align-items-center gap-2 mb-2">
                      {/* Чекбокс тек selectMode=true кезінде көрсетіледі */}
                      {selectMode && (
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={isChecked}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleOne(t.id)}
                          id={`t-${t.id}`}
                          aria-label={`${t.name} таңдау`}
                        />
                      )}
                      <h5 className="card-title mb-0">
                        <span
                          // Чекбоксты басқанда ғана toggleOne, ал атауға басса — карточка click (жоғарыда) жүреді
                          onClick={(e) => {
                            if (selectMode) e.preventDefault();
                          }}
                          style={{ cursor: "inherit" }}
                        >
                          {t.name}
                        </span>
                      </h5>
                    </div>

                    <p className="card-text text-muted small mb-0">
                      {!selectMode
                        ? "Карточканы бассаң — осы тақырыптан quiz басталады."
                        : "Белгілі бір тақырыпты тізімге қосу/алып тастау үшін карточканы немесе чекбоксты бас."}
                    </p>
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
