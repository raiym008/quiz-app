// src/app/feedback/feedbackBus.ts

export type FeedbackTriggerPayload = {
  page?: string;
  reason?: string; // "docx_import", "bulk_quiz", "manual_quiz" т.б.
  force?: boolean; // true болса — cooldown елемейді
};

type Listener = (payload?: FeedbackTriggerPayload) => void;

let listener: Listener | null = null;

// Бір SPA-сессияда автоматты feedback шақыруды шектеу үшін
let sessionTriggered = false;

// FeedbackManager модалі тіркеледі
export function registerFeedbackListener(fn: Listener) {
  listener = fn;

  // Жаңа listener тіркелсе — сессиялық флагты қайта бастаймыз
  sessionTriggered = false;

  return () => {
    if (listener === fn) {
      listener = null;
    }
  };
}

// Кез келген жерден модаль шақыру үшін
export function triggerFeedback(payload?: FeedbackTriggerPayload) {
  if (!listener) return;

  // force = true болса — шектеулерді елемейміз
  if (!payload?.force) {
    // Бір сессияда 1 реттен артық автоматты триггер болмауы керек
    if (sessionTriggered) return;
    sessionTriggered = true;
  }

  listener(payload);
}
