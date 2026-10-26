"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared furniture for the world's panels.
 *
 * Deliberately small and plain: the panels sit over a running landscape, so they
 * are dark glass with one accent and no second layer of chrome. The world's own
 * colours live in `world.css`; these primitives never read the site theme, so a
 * member on the light 2D theme still gets a legible night interface.
 */

export function Panel({
  open,
  title,
  kicker,
  onClose,
  children,
  wide = false,
  footer,
}: {
  open: boolean;
  title: string;
  kicker?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="world-panel-wrap" role="presentation" onPointerDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn("world-panel", wide ? "world-panel-wide" : "world-panel-narrow")}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="world-panel-head">
          <div className="min-w-0">
            {kicker ? <p className="world-kicker">{kicker}</p> : null}
            <h2 className="world-panel-title">{title}</h2>
          </div>
          <button type="button" className="world-icon-btn" onClick={onClose} aria-label="Close panel">
            <X aria-hidden="true" className="h-4 w-4" strokeWidth={1.6} />
          </button>
        </header>
        <div className="world-panel-body">{children}</div>
        {footer ? <footer className="world-panel-foot">{footer}</footer> : null}
      </section>
    </div>
  );
}

export function Section({
  title,
  hint,
  children,
  className,
}: {
  title?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("world-section", className)}>
      {title ? (
        <div className="world-section-head">
          <h3>{title}</h3>
          {hint ? <p>{hint}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Btn({
  children,
  onClick,
  variant = "ghost",
  size = "md",
  disabled,
  type = "button",
  className,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "quiet" | "danger";
  size?: "sm" | "md";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
  title?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn("world-btn", `world-btn-${variant}`, size === "sm" && "world-btn-sm", className)}
    >
      {children}
    </button>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: readonly { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="world-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn("world-tab", value === tab.id && "is-active")}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="world-field">
      <span className="world-field-label">{label}</span>
      {hint ? <span className="world-field-hint">{hint}</span> : null}
      {children}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  maxLength = 40,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  ariaLabel?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      aria-label={ariaLabel ?? placeholder}
      className="world-input"
    />
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("world-toggle", checked && "is-on")}
    >
      <span className="world-toggle-knob" />
    </button>
  );
}

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  label,
  format,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  label: string;
  format?: (value: number) => string;
}) {
  return (
    <label className="world-slider">
      <span className="world-slider-top">
        <span>{label}</span>
        <span className="world-slider-value">{format ? format(value) : value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function KeyCap({ children }: { children: ReactNode }) {
  return <kbd className="world-key">{children}</kbd>;
}

export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="world-empty">
      <p className="world-empty-title">{title}</p>
      <p className="world-empty-body">{children}</p>
    </div>
  );
}
