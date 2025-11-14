import { useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "../api/authStore";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");

  const login = useAuthStore((s) => s.login);
  const loading = useAuthStore((s) => s.loading);
  const navigate = useNavigate();

  const valid = useMemo(
    () => username.trim().length >= 3 && pw.length >= 4,
    [username, pw]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || loading) return;
    setError("");

    const u = await login(username.trim(), pw);
    if (!u) {
      setError("Логин немесе құпия сөз қате.");
      return;
    }

    navigate(`/u/${u.id}`, { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Easy жүйесіне кіру
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          Тіркелген аккаунтыңыз арқылы жүйеге кіріңіз.
        </p>

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              Пайдаланушы аты (username)
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="easy_user"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">
              Құпия сөз
            </label>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              required
              minLength={4}
              placeholder="••••••••"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
            />
          </div>

          <button
            type="submit"
            disabled={!valid || loading}
            className={`w-full mt-2 py-2.5 rounded-xl text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 transition-colors ${
              loading ? "opacity-70 cursor-wait" : "cursor-pointer"
            }`}
          >
            {loading ? "Кіріп жатыр..." : "Кіру"}
          </button>
        </form>

        <p className="mt-4 text-xs text-gray-500 text-center">
          Аккаунтыңыз жоқ па?{" "}
          <Link
            to="/register"
            className="text-blue-500 hover:text-blue-600"
          >
            Тіркелу
          </Link>
        </p>
      </div>
    </div>
  );
}
