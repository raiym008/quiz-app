// src/app/modes/iQuiz/ExamSetup.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../../api/axiosClient";

type Subject = { id: number | string; name: string; slug?: string };
type Topic = { id: number; name: string };

export default function ExamSetup() {
  const navigate = useNavigate();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [loadingSubjects, setLoadingSubjects] = useState(true);

  const [topics, setTopics] = useState<Topic[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);

  const [selectedTopicIds, setSelectedTopicIds] = useState<number[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  // Load subjects
  useEffect(() => {
    setLoadingSubjects(true);
    fetch(`${API_BASE}/subjects`)
      .then((r) => (r.ok ? r.json() : Promise.reject("Пән жүктелмеді")))
      .then((list) => {
        const data: Subject[] =
          Array.isArray(list) && list.length
            ? list
            : [
                { id: 1, name: "English" },
                { id: 2, name: "Math" },
                { id: 3, name: "Science" },
              ];
        setSubjects(data);
        setSelectedSubject(data[0]);
      })
      .catch((e) => setError(typeof e === "string" ? e : e?.message || "Қате"))
      .finally(() => setLoadingSubjects(false));
  }, []);

  // Load topics
  useEffect(() => {
    if (!selectedSubject?.name) return;
    setLoadingTopics(true);
    setSelectedTopicIds([]);
    setError("");

    const subjName = encodeURIComponent(selectedSubject.name);
    fetch(`${API_BASE.replace(/\/$/, "")}/subjects/${subjName}/topics`)
      .then((r) => (r.ok ? r.json() : Promise.reject("Тақырыптар жүктелмеді")))
      .then((list) => setTopics(Array.isArray(list) ? list : []))
      .catch((e) => setError(typeof e === "string" ? e : e?.message || "Қате"))
      .finally(() => setLoadingTopics(false));
  }, [selectedSubject]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return query ? topics.filter((t) => t.name.toLowerCase().includes(query)) : topics;
  }, [topics, q]);

  const toggle = (id: number) => {
    setSelectedTopicIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => setSelectedTopicIds(filtered.map((t) => t.id));
  const clearAll = () => setSelectedTopicIds([]);

  const handleStart = async () => {
    if (selectedTopicIds.length === 0) return alert("Кемінде бір тақырып таңдаңыз.");
    try {
      const r = await fetch(`${API_BASE.replace(/\/$/, "")}/iquiz/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selected_topic_ids: selectedTopicIds }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      if (!data?.roomId) throw new Error("roomId келмеді");
      navigate(`/iquiz/waiting/${data.roomId}`);
    } catch (e: any) {
      alert(e?.message || "Бөлме ашу кезінде қате болды");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 text-gray-800 font-[Inter]">
      {/* Header */}
      <header className="w-full border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-5 py-6 text-center">
          <h1 className="text-2xl font-semibold">Тест дайындау</h1>
          <p className="text-gray-500 text-sm mt-1">
            Пән мен тақырыптарды таңдаңыз
          </p>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-3xl mx-auto px-5 py-10 space-y-8">
        {/* Subject selection */}
        <section>
          <h2 className="text-lg font-medium mb-3">Пән</h2>
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            {loadingSubjects ? (
              <div className="grid grid-cols-3 gap-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-10 bg-gray-200 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {subjects.map((s) => {
                  const selected = selectedSubject?.name === s.name;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSubject(s)}
                      className={`px-4 py-2 rounded-lg border text-sm transition
                        ${
                          selected
                            ? "bg-blue-500 text-white border-blue-500"
                            : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-blue-50"
                        }`}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Topics */}
        <section>
          <h2 className="text-lg font-medium mb-3">Тақырыптар</h2>
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            {/* Search + buttons */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mb-4">
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Іздеу..."
                className="w-full sm:w-1/2 px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-400 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="px-3 py-2 text-sm bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100"
                >
                  Бәрін таңдау
                </button>
                <button
                  onClick={clearAll}
                  className="px-3 py-2 text-sm bg-gray-50 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100"
                >
                  Тазалау
                </button>
              </div>
            </div>

            {/* Topic list */}
            {loadingTopics ? (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-10 bg-gray-200 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-gray-500 py-10">Тақырып табылмады</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {filtered.map((t) => {
                  const selected = selectedTopicIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggle(t.id)}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition
                        ${
                          selected
                            ? "bg-blue-50 border-blue-400 text-blue-700"
                            : "bg-white border-gray-200 hover:bg-gray-50"
                        }`}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            )}

            {selectedTopicIds.length > 0 && (
              <div className="mt-4 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm">
                {selectedTopicIds.length} тақырып таңдалды
              </div>
            )}

            {error && (
              <div className="mt-4 px-4 py-2 bg-red-50 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Bottom Bar */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {selectedTopicIds.length === 0
              ? "Тақырып таңдаңыз"
              : `${selectedTopicIds.length} тақырып дайын`}
          </p>
          <button
            onClick={handleStart}
            disabled={selectedTopicIds.length === 0}
            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition
              ${
                selectedTopicIds.length === 0
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-blue-500 text-white hover:bg-blue-600"
              }`}
          >
            Бастау
          </button>
        </div>
      </footer>
    </div>
  );
}
