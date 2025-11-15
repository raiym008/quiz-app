// src/app/feedback/FeedbackManager.tsx

"use client";

import { useEffect, useState, useRef } from "react";
import FeedbackModal from "./FeedbackModal";
import {
  registerFeedbackListener,
  triggerFeedback as triggerFeedbackBus,
} from "./feedbackBus";
import type { FeedbackTriggerPayload } from "./feedbackBus";

const LS_LAST_FEEDBACK = "easy_fb_last_any";
const COOLDOWN_DAYS = 7;

function isCooldownActive(): boolean {
  try {
    const raw = localStorage.getItem(LS_LAST_FEEDBACK);
    if (!raw) return false;
    const ts = Date.parse(raw);
    if (Number.isNaN(ts)) return false;
    const diffDays = (Date.now() - ts) / (1000 * 60 * 60 * 24);
    return diffDays < COOLDOWN_DAYS;
  } catch {
    return false;
  }
}

function markFeedbackNow() {
  try {
    localStorage.setItem(LS_LAST_FEEDBACK, new Date().toISOString());
  } catch {
    // nothing
  }
}

export default function FeedbackManager() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPage, setModalPage] = useState<string | undefined>();
  const [modalReason, setModalReason] = useState<string | undefined>();
  const [hidden, setHidden] = useState(false); // батырманы толық жасыру үшін
  const [cooldown, setCooldown] = useState(false); // 7 күндік шектеу

  // Бір сессия ішінде bus-тен тек 1 рет қана ашылсын
  const openedFromBusRef = useRef(false);

  // Алғашқы жүктелгенде cooldown мәнін оқу
  useEffect(() => {
    setCooldown(isCooldownActive());
  }, []);

  // Bus-тен келетін сыртқы триггерді тыңдау
  useEffect(() => {
    const unsub = registerFeedbackListener(
      (payload?: FeedbackTriggerPayload) => {
        if (hidden) return;
        if (openedFromBusRef.current) return;

        const cooldownNow = isCooldownActive();
        const allow = payload?.force || !cooldownNow;
        if (!allow) return;

        setModalPage(payload?.page || window.location.pathname);
        setModalReason(payload?.reason);
        setModalOpen(true);

        openedFromBusRef.current = true;
      }
    );

    return unsub;
  }, [hidden]);

  const handleOpenButton = () => {
    // Егер 7 күндік cooldown белсенді болса — батырманы жасырып қоямыз
    if (isCooldownActive()) {
      setHidden(true);
      setCooldown(true);
      return;
    }

    setModalPage(window.location.pathname);
    setModalReason("manual_click");
    setModalOpen(true);
  };

  const handleClose = () => {
    setModalOpen(false);
  };

  const handleSubmitted = () => {
    // Пікір сәтті жіберілген кезде 7 күндік cooldown басталады
    markFeedbackNow();
    setModalOpen(false);
    setHidden(true);
    setCooldown(true);
  };

  return (
    <>
      {/* Floating feedback button */}
      {!hidden && !cooldown && (
        <button
          type="button"
          onClick={handleOpenButton}
          className="
            fixed
            bottom-4 right-4
            z-[70]
            inline-flex items-center gap-2
            px-3.5 py-2.5
            rounded-full
            bg-sky-600
            text-white text-xs font-medium
            shadow-lg shadow-sky-500/25
            hover:bg-sky-700
            active:scale-[0.97]
            transition
          "
        >
          <span className="w-5 h-5 rounded-full bg-white/15 grid place-items-center text-[11px]">
            📝
          </span>
          <span>Пікір қалдыру</span>
        </button>
      )}

      {/* Modal */}
      <FeedbackModal
        open={modalOpen}
        onClose={handleClose}
        page={modalPage}
        reason={modalReason}
        onSubmitted={handleSubmitted}
      />
    </>
  );
}

// Басқа файлдардан қолдану үшін:
export function triggerFeedback(payload?: FeedbackTriggerPayload) {
  triggerFeedbackBus(payload);
}
