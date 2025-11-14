import { useEffect, useState } from "react";

export default function NetworkGuard() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-white/90 backdrop-blur-sm">
      <div className="w-full max-w-xs bg-white rounded-2xl shadow-xl ring-1 ring-slate-200 p-5 text-center">
        <div className="text-3xl mb-2">⚠️</div>
        <h2 className="text-lg font-semibold text-slate-900">
          Интернет байланысы үзілді
        </h2>
        <p className="text-sm text-slate-600 mt-1 mb-4">
          Желіні тексеріңіз. Байланыс қалпына келгенше күтіңіз.
        </p>

        <div className="mt-3 text-xs text-slate-500 animate-pulse">
          Қайта қосылуын күтіп жатыр…
        </div>
      </div>
    </div>
  );
}
