"use client";

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";
import { Slot } from "./slot";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Mark the control invalid for assistive tech and tint the underline. */
  invalid?: boolean;
}

/** A single-line text input with the kit's signature underline-only field look. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "field w-full px-0 py-2 text-sm text-bone",
        invalid && "border-b-danger",
        className,
      )}
      {...props}
    />
  );
});

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Mark the control invalid for assistive tech and tint the underline. */
  invalid?: boolean;
}

/** A multi-line counterpart to {@link Input}, sharing the underline treatment. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, invalid, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          "field min-h-24 w-full resize-y px-0 py-2 text-sm leading-relaxed text-bone",
          invalid && "border-b-danger",
          className,
        )}
        {...props}
      />
    );
  },
);

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** Render a gold asterisk after the label text. */
  required?: boolean;
}

/** A form label set in the small mono caps used across the app. */
export function Label({ required, className, children, ...props }: LabelProps) {
  return (
    <label
      className={cn(
        "flex items-baseline gap-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted",
        className,
      )}
      {...props}
    >
      {children}
      {required ? (
        <span aria-hidden="true" className="text-gold">
          *
        </span>
      ) : null}
    </label>
  );
}

export interface FieldProps {
  /** Visible label, wired to the control with `htmlFor`. */
  label?: ReactNode;
  /** Persistently visible helper copy, wired via `aria-describedby`. */
  description?: ReactNode;
  /** Error copy; when present the control is marked `aria-invalid`. */
  error?: ReactNode;
  /** Adds the required marker and forwards `required` to the control. */
  required?: boolean;
  className?: string;
  /** Exactly one form control; ids and ARIA wiring are injected into it. */
  children: ReactElement;
}

/**
 * Wraps a single form control with a label, description, and error message,
 * generating the id and `aria-describedby` plumbing so nothing is announced
 * twice or left unlabelled.
 */
export function Field({
  label,
  description,
  error,
  required = false,
  className,
  children,
}: FieldProps) {
  const generatedId = useId();
  const childProps = children.props as {
    id?: string;
    "aria-describedby"?: string;
    required?: boolean;
  };
  const controlId = childProps.id ?? `field-${generatedId}`;
  const descriptionId = `${controlId}-description`;
  const errorId = `${controlId}-error`;

  const describedBy = [
    childProps["aria-describedby"],
    description ? descriptionId : null,
    error ? errorId : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label ? (
        <Label htmlFor={controlId} required={required}>
          {label}
        </Label>
      ) : null}
      <Slot
        id={controlId}
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? true : undefined}
        required={required || childProps.required || undefined}
      >
        {children}
      </Slot>
      {description && !error ? (
        <p id={descriptionId} className="text-xs leading-relaxed text-faint">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs leading-relaxed text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
