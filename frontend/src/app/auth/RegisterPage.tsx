import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "../api/axiosClient";

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    username: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const email = form.email.trim();
    const username = form.username.trim();
    const password = form.password;

    if (!email || !username || !password) {
      setError("Барлық өрісті толтырыңыз.");
      setLoading(false);
      return;
    }

    try {
      const res = await axios.post(
        `${API_BASE}/register`,
        { email, username, password },
        { headers: { "Content-Type": "application/json" } }
      );

      // Егер backend сәтті тіркесе — бірден VerifyPage бетіне жібереміз
      // Email-ді state арқылы жібереміз
      const msg =
        res.data?.message ||
        "Тіркелу сәтті өтті. Растау коды email-ге жіберілді.";
      console.log(msg);

      navigate("/verify", {
        state: { email },
      });
    } catch (err: any) {
      const detail =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        "Тіркелу сәтсіз. Email немесе username дұрыс екенін тексеріңіз.";
      setError(
        typeof detail === "string" ? detail : JSON.stringify(detail)
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Easy тіркелу
        </h1>

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={onChange}
              required
              placeholder="easy@gmail.com"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">
              Пайдаланушы аты (username)
            </label>
            <input
              type="text"
              name="username"
              value={form.username}
              onChange={onChange}
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
              name="password"
              value={form.password}
              onChange={onChange}
              required
              minLength={6}
              placeholder="••••••••"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full mt-2 py-2.5 rounded-xl text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 transition-colors ${
              loading ? "opacity-70 cursor-wait" : "cursor-pointer"
            }`}
          >
            {loading ? "Тіркеліп жатыр..." : "Тіркелу"}
          </button>
        </form>

        <p className="mt-4 text-xs text-gray-500 text-center">
          Аккаунтың бар ма?{" "}
          <a
            href="/login"
            className="text-blue-500 hover:text-blue-600"
          >
            Кіру
          </a>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
