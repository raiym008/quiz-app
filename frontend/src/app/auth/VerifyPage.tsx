import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "../api/axiosClient";

export default function VerifyPage() {
  const location = useLocation() as any;
  const initialEmail = location?.state?.email ?? "";

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  const navigate = useNavigate();

  const [timer, setTimer] = useState(0);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Таймер
  useEffect(() => {
    if (timer <= 0) return;
    const id = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [timer]);

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60)
      .toString()
      .padStart(2, "0");
    const s = (t % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // OTP енгізу
  const handleChange = (value: string, index: number) => {
    // Бір ұяшыққа бірнеше сан келсе — таратып жібереді
    if (/^\d{2,}$/.test(value)) {
      const chars = value.slice(0, 6 - index).split("");
      const newCode = [...code];
      chars.forEach((ch, off) => (newCode[index + off] = ch));
      setCode(newCode);
      const next = Math.min(index + chars.length, 5);
      inputs.current[next]?.focus();
      return;
    }

    if (!/^[0-9]?$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    if (value && index < 5) inputs.current[index + 1]?.focus();
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number
  ) => {
    if (e.key === "Backspace") {
      if (code[index]) {
        const newCode = [...code];
        newCode[index] = "";
        setCode(newCode);
        return;
      }
      if (index > 0) inputs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0)
      inputs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < 5)
      inputs.current[index + 1]?.focus();
  };

  const handlePaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    index: number
  ) => {
    const t = e.clipboardData.getData("text").trim();
    const digits = t.replace(/\D/g, "");
    if (digits.length >= 2) {
      e.preventDefault();
      const newCode = [...code];
      for (
        let i = 0;
        i < Math.min(6 - index, digits.length);
        i++
      ) {
        newCode[index + i] = digits[i];
      }
      setCode(newCode);
      const next = Math.min(
        index + digits.length,
        5
      );
      inputs.current[next]?.focus();
    }
  };

  // Кодты қайта жіберу (RegisterPage-тегі handleResend логикасы)
  const onResend = async () => {
    const emailTrimmed = email.trim();
    if (!emailTrimmed || timer > 0 || sending) return;

    setSending(true);
    setError(null);
    setMessage(null);

    try {
      const res = await axios.post(
        `${API_BASE}/resend-code`,
        { email: emailTrimmed },
        { headers: { "Content-Type": "application/json" } }
      );

      const msg =
        res.data?.message ||
        "Жаңа растау коды email-ге жіберілді.";
      setMessage(msg);
      setTimer(60);
    } catch (err: any) {
      const detail =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        "Кодты қайта жіберу сәтсіз.";
      setError(
        typeof detail === "string"
          ? detail
          : JSON.stringify(detail)
      );
    } finally {
      setSending(false);
    }
  };

  // Растау (RegisterPage-тегі handleVerify логикасы)
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const emailTrimmed = email.trim();
    const codeValue = code.join("").trim();

    if (!emailTrimmed) {
      setError("Email енгізіңіз.");
      return;
    }

    if (codeValue.length !== 6) {
      setError("6 таңбалы кодты толық енгізіңіз.");
      return;
    }

    setVerifying(true);

    try {
      const res = await axios.post(
        `${API_BASE}/verify`,
        {
          email: emailTrimmed,
          code: codeValue,
        },
        { headers: { "Content-Type": "application/json" } }
      );

      const msg =
        res.data?.message ||
        "Аккаунт сәтті расталды. Енді жүйеге кіре аласыз ✅";
      setMessage(msg);

      // Сәл кідірістен кейін login бетіне жібереміз:
      setTimeout(() => {
        navigate("/login");
      }, 800);
    } catch (err: any) {
      const detail =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        "Код қате немесе уақыты өтіп кеткен. Қайта көріңіз.";
      setError(
        typeof detail === "string"
          ? detail
          : JSON.stringify(detail)
      );
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 via-white to-gray-200">
      <div className="w-[420px] p-8 rounded-3xl bg-white shadow-xl border border-gray-200">
        <h2 className="text-3xl font-semibold text-center text-gray-800 mb-8">
          Email растау
        </h2>

        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-6"
        >
          <div>
            <label className="block text-sm text-gray-600 mb-2">
              Email
            </label>
            <input
              type="email"
              placeholder="Мекенжайыңызды енгізіңіз"
              value={email}
              onChange={(e) =>
                setEmail(e.currentTarget.value)
              }
              required
              className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-300 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-3">
              Растау коды
            </label>
            <div className="flex justify-between">
              {code.map((digit, i) => (
                <input
                  key={i}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) =>
                    handleChange(
                      e.target.value,
                      i
                    )
                  }
                  onKeyDown={(e) =>
                    handleKeyDown(e, i)
                  }
                  onPaste={(e) =>
                    handlePaste(e, i)
                  }
                  ref={(el) =>
                    (inputs.current[i] = el)
                  }
                  className="w-12 h-12 text-center text-xl font-semibold rounded-xl border border-gray-300 bg-gray-50 text-gray-800 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition-all"
                />
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-gray-500 text-sm">
                Код келмеді ме?{" "}
                <span className="text-gray-700">
                  Спам қалтасын тексеріңіз.
                </span>
              </p>
              <button
                type="button"
                onClick={onResend}
                disabled={
                  !email.trim() ||
                  timer > 0 ||
                  sending
                }
                className={`text-sm font-medium transition-colors ${
                  !email.trim() ||
                  timer > 0 ||
                  sending
                    ? "text-gray-400 cursor-not-allowed"
                    : "text-blue-500 hover:text-blue-600"
                }`}
                title={
                  !email
                    ? "Алдымен email енгізіңіз"
                    : undefined
                }
              >
                {timer > 0
                  ? `Қайта жіберу: ${formatTime(
                      timer
                    )}`
                  : sending
                  ? "Жіберілуде..."
                  : "Кодты қайта жіберу 🔁"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={verifying}
            className={`mt-2 bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 rounded-xl shadow-md transition-all ${
              verifying
                ? "opacity-70 cursor-wait"
                : ""
            }`}
          >
            {verifying
              ? "Тексерілуде..."
              : "Растау"}
          </button>
        </form>

        {message && (
          <p className="mt-4 text-sm text-green-600 text-center">
            {message}
          </p>
        )}
        {error && (
          <p className="mt-2 text-sm text-red-500 text-center">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
