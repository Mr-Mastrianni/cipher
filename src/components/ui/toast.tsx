"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { cue } from "@/lib/audio/sound-engine";
import { cn, uid } from "@/lib/utils";

/** Toast severity. */
export type ToastTone = "success" | "error" | "info";

export interface ToastOptions {
  title: ReactNode;
  description?: ReactNode;
  /** Defaults to `info`. */
  tone?: ToastTone;
  /** Auto-dismiss delay in ms. `0` keeps the toast until dismissed. */
  duration?: number;
}

export interface ToastRecord {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  tone: ToastTone;
  duration: number;
}

interface ToastContextValue {
  toasts: ToastRecord[];
  /** Enqueue a toast; returns its id. */
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
  success: (title: ReactNode, description?: ReactNode) => string;
  error: (title: ReactNode, description?: ReactNode) => string;
  info: (title: ReactNode, description?: ReactNode) => string;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION: Record<ToastTone, number> = {
  success: 5000,
  info: 5000,
  error: 8000,
};

const TONE_ICON: Record<ToastTone, typeof Info> = {
  success: CircleCheck,
  error: CircleAlert,
  info: Info,
};

const TONE_TEXT: Record<ToastTone, string> = {
  success: "text-ok",
  error: "text-danger",
  info: "text-info",
};

const CUE_FOR_TONE = {
  success: "success",
  error: "error",
  info: "message",
} as const;

/** Holds the toast queue and renders the bottom-right viewport. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    const id = uid("toast");
    const tone = options.tone ?? "info";
    const duration = options.duration ?? DEFAULT_DURATION[tone];
    setToasts((current) => [
      ...current.slice(-3),
      {
        id,
        title: options.title,
        description: options.description,
        tone,
        duration,
      },
    ]);
    cue(CUE_FOR_TONE[tone]);
    return id;
  }, []);

  const success = useCallback(
    (title: ReactNode, description?: ReactNode) =>
      toast({ title, description, tone: "success" }),
    [toast],
  );

  const error = useCallback(
    (title: ReactNode, description?: ReactNode) =>
      toast({ title, description, tone: "error" }),
    [toast],
  );

  const info = useCallback(
    (title: ReactNode, description?: ReactNode) =>
      toast({ title, description, tone: "info" }),
    [toast],
  );

  const value = useMemo(
    () => ({ toasts, toast, dismiss, success, error, info }),
    [toasts, toast, dismiss, success, error, info],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ol
        aria-label="Notifications"
        className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[min(22rem,calc(100vw-2rem))] list-none flex-col gap-2 p-0"
      >
        <AnimatePresence initial={false}>
          {toasts.map((item) => (
            <ToastItem key={item.id} toast={item} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </ol>
    </ToastContext.Provider>
  );
}

/** Access the toast queue. Must be used inside a {@link ToastProvider}. */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return context;
}

interface ToastItemProps {
  toast: ToastRecord;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const remaining = useRef(toast.duration);
  const Icon = TONE_ICON[toast.tone];

  // The countdown pauses on hover/focus and resumes with the time left over.
  useEffect(() => {
    if (toast.duration <= 0) return;
    const startedAt = Date.now();
    const timer = window.setTimeout(() => onDismiss(toast.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(
        0,
        remaining.current - (Date.now() - startedAt),
      );
    };
  }, [paused, toast.duration, toast.id, onDismiss]);

  return (
    <motion.li
      layout={!reduced}
      initial={reduced ? { opacity: 0 } : { opacity: 0, x: 24, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, x: 24, scale: 0.98 }}
      transition={{
        duration: reduced ? 0 : 0.22,
        ease: [0.22, 1, 0.36, 1],
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      role={toast.tone === "error" ? "alert" : "status"}
      aria-live={toast.tone === "error" ? "assertive" : "polite"}
      className="surface pointer-events-auto flex items-start gap-3 p-4 shadow-md"
    >
      <Icon
        aria-hidden="true"
        strokeWidth={1.5}
        className={cn("mt-0.5 h-4 w-4 shrink-0", TONE_TEXT[toast.tone])}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-sm font-medium leading-snug text-bone text-pretty">
          {toast.title}
        </p>
        {toast.description ? (
          <p className="text-xs leading-relaxed text-muted text-pretty">
            {toast.description}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="-mr-1 -mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-faint transition-colors hover:text-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-void"
      >
        <X aria-hidden="true" strokeWidth={1.5} className="h-3.5 w-3.5" />
      </button>
    </motion.li>
  );
}
