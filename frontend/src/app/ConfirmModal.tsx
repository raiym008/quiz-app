// src/components/ConfirmModal.tsx
import { useState, useEffect, useRef, useId } from "react";
import { createPortal } from "react-dom";

type ConfirmState = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  // Қосымша опция: қауіпті әрекеттерге қызыл батырма
  destructive?: boolean;
};

export function useConfirmModal() {
  const [state, setState] = useState<ConfirmState | null>(null);

  // API артқа үйлесімді:
  // open("Title", "Message", fn, { confirmLabel: "Иә", cancelLabel: "Жоқ", destructive: true })
  const open = (
    title: string,
    message: string,
    onConfirm: () => void,
    options?: { confirmLabel?: string; cancelLabel?: string; destructive?: boolean }
  ) => {
    setState({
      open: true,
      title,
      message,
      onConfirm,
      confirmLabel: options?.confirmLabel,
      cancelLabel: options?.cancelLabel,
      destructive: options?.destructive,
    });
  };

  const hardClose = () => setState(null);

  const softClose = () => {
    if (!state) return;
    setState(null);
  };

  // ---------- Accessibility / Focus trap ----------
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);
  const prevFocusRef = useRef<Element | null>(null);
  const headingId = useId();
  const descId = useId();

  useEffect(() => {
    if (!state?.open) return;

    // Алдыңғы фокусты сақтау
    prevFocusRef.current = document.activeElement;

    // Карточкаға фокус
    const toFocus = confirmBtnRef.current || cancelBtnRef.current || cardRef.current;
    toFocus?.focus();

    const handleKey = (e: KeyboardEvent) => {
      // ESC — жабу
      if (e.key === "Escape") {
        e.preventDefault();
        softClose();
        return;
      }
      // TAB — фокус-трап
      if (e.key === "Tab") {
        const focusables = cardRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables || focusables.length === 0) return;

        const list = Array.from(focusables).filter(el => !el.hasAttribute("disabled"));
        const first = list[0];
        const last = list[list.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      // Алдыңғы фокусты қайтару
      const prev = prevFocusRef.current as HTMLElement | null;
      prev?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.open]);

  if (!state?.open) {
    return { open, Modal: null };
  }

  const { title, message, onConfirm, destructive } = state;
  const confirmLabel = state.confirmLabel || "Иә";
  const cancelLabel = state.cancelLabel || "Жоқ";

  const confirmBtnClasses = destructive
    ? "bg-red-600 hover:bg-red-500 active:bg-red-600 text-white"
    : "bg-slate-900 hover:bg-slate-800 active:bg-slate-900 text-white";

  const Modal = createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      aria-hidden={false}
    >
      {/* Жұмсақ фон: аздап күңгірт, аздап blur, басқанда жабылады */}
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-slate-900/25 backdrop-blur-[2px] transition-opacity"
        onClick={softClose}
      />

      {/* Карточка — минимализм */}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={descId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="
          relative z-10 w-full max-w-md mx-4
          rounded-2xl bg-white
          ring-1 ring-black/5 shadow-[0_12px_30px_rgba(15,23,42,0.12)]
          px-6 py-5
          outline-none
          transition
          data-[show=true]:opacity-100
        "
        data-show="true"
      >
        {/* Тақырып + мәтін */}
        <div className="flex flex-col gap-2">
          <h2 id={headingId} className="text-base font-semibold text-slate-900">
            {title}
          </h2>
          <p id={descId} className="text-[15px] leading-relaxed text-slate-600">
            {message}
          </p>
        </div>

        {/* Батырмалар — оң жаққа, мобайлда да ыңғайлы */}
        <div className="mt-4 flex items-center justify-end gap-3">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={softClose}
            className="
              h-10 px-3.5 rounded-xl
              text-sm font-medium
              text-slate-600 hover:text-slate-800
              hover:bg-slate-50 active:bg-slate-100
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/50
              transition-colors
            "
          >
            {cancelLabel}
          </button>

          <button
            ref={confirmBtnRef}
            type="button"
            onClick={() => {
              onConfirm?.();
              hardClose();
            }}
            className={`
              h-10 px-4 rounded-xl
              text-sm font-semibold
              ${confirmBtnClasses}
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/50
              transition-colors
            `}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );

  return { open, Modal };
}
