"use client";

import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export interface OverlayBehaviorOptions {
  /** Whether the overlay is currently mounted. */
  open: boolean;
  /** Called when Escape (or a dismissed backdrop) asks to close. */
  onClose: () => void;
  /** The element that contains the dialog/sheet content. */
  panelRef: RefObject<HTMLElement | null>;
  /** Allow Escape to close. Defaults to `true`. */
  dismissible?: boolean;
  /** Element to focus on open; defaults to the first focusable descendant. */
  initialFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * The behaviour every overlay in this kit shares: body scroll lock, focus
 * capture with a Tab loop, Escape to dismiss, and focus restoration to
 * whatever was focused before the overlay opened.
 */
export function useOverlayBehavior({
  open,
  onClose,
  panelRef,
  dismissible = true,
  initialFocusRef,
}: OverlayBehaviorOptions) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow, paddingRight } = document.body.style;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    const frame = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      const target =
        initialFocusRef?.current ??
        panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ??
        panel;
      target?.focus({ preventScroll: true });
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!dismissible) return;
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((node) => node.getAttribute("aria-hidden") !== "true");

      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || active === panel) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, [open, dismissible, panelRef, initialFocusRef]);
}

const noopSubscribe = () => () => {};

/**
 * `false` while server rendering, `true` once hydrated — without an effect, so
 * a portal never has to be rendered during SSR.
 */
function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/** Renders children into `document.body` once hydrated. */
export function OverlayPortal({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();

  if (!hydrated || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
