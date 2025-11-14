// src/app/feedback/FeedbackModal.tsx

"use client";

import { useEffect, useState } from "react";
import api from "../api/axiosClient";

type Props = {
  open: boolean;
  onClose: () => void;
  page?: string;
  reason?: string;
  onSubmitted?: () => void;
};

const RATINGS = [1, 2, 3, 4, 5];
const MIN_LEN = 20; // кредит жүйесіне лайық: тым қысқа feedback саналмайды

export default function FeedbackModal({
  open,
  onClose,
  page,
  reason,
  onSubmitted,
}: Props) {
  const [text, setText] = useState("");
  const [rating, setRating] = useState<number | null>(5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  // Модаль жабылған сайын reset
  useEffect(() => {
    if (!open) {
      setText("");
      setRating(5);
      setSubmitting(false);
      setError("");
      setOk(false);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const value = text.trim();
    if (value.length < MIN_LEN) {
      setError(
        `Пікір тым қысқа. Ең аз дегенде ${MIN_LEN} таңба жазыңыз.`
      );
      return;
    }

    setSubmitting(true);
    setError("");
    setOk(false);

    try {
      const finalText = reason ? `[${reason}] ${value}` : value;

      await api.post("/feedback", {
        text: finalText,
        page: page || window.location.pathname || null,
        rating: rating ?? null,
      });

      setOk(true);
      setText("");

      if (onSubmitted) onSubmitted();
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        "Пікір жіберу кезінде қате болды.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) onClose();
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center">
      {/* Артқы фон */}
      <div
        className="absolute inset-0 bg-black/35 backdrop-blur-[3px]"
        onClick={handleClose}
      />
      {/* Карточка */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="
          relative z-[91]
          w-full max-w-md
          bg-white/98
          rounded-2xl
          shadow-2xl
          ring-1 ring-slate-200
          px-5 py-5
        "
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Easy туралы пікір
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Платформаны жақсартуға көмектесетін нақты, мазмұнды ойыңызды
              жазыңыз. Осындай пікірлер үшін сізге кредит беріледі.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            aria-label="Жабу"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Rating */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-700">
                Жалпы бағалау
              </span>
              {rating && (
                <span className="text-[10px] text-slate-500">
                  {rating} / 5
                </span>
              )}
            </div>
            <div className="flex gap-1.5">
              {RATINGS.map((r) => {
                const active = rating === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRating(r)}
                    className={`w-7 h-7 rounded-full text-[11px] font-semibold flex items-center justify-center transition
                      ${
                        active
                          ? "bg-amber-400 text-slate-900 shadow-sm"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Textarea */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Пікір мәтіні
            </label>
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setError("");
                setOk(false);
              }}
              placeholder="Не ұнады, не түсініксіз, қандай функция қажет? Қысқаша, бірақ мазмұнды етіп жазыңыз."
              maxLength={2000}
              className="
                w-full min-h-[90px]
                px-3 py-2
                text-sm text-slate-800
                rounded-xl
                border border-slate-200
                outline-none
                focus:border-sky-500 focus:ring-2 focus:ring-sky-200
                placeholder:text-slate-400
                resize-vertical
              "
            />
            <div className="mt-0.5 text-[9px] text-slate-400 text-right">
              {text.length} / 2000
            </div>
          </div>

          {error && (
            <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-1.5">
              {error}
            </div>
          )}
          {ok && !error && (
            <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
              Рахмет! Пікіріңіз сәтті жіберілді ✅
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="
                px-3.5 py-2
                rounded-xl
                text-xs font-medium
                text-slate-700
                bg-slate-100
                hover:bg-slate-200
                disabled:opacity-60
              "
            >
              Болдырмау
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="
                px-4 py-2
                rounded-xl
                text-xs font-semibold
                text-white
                bg-sky-600
                hover:bg-sky-700
                shadow-sm
                disabled:opacity-70 disabled:cursor-wait
              "
            >
              {submitting ? "Жіберілуде..." : "Пікір жіберу"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
