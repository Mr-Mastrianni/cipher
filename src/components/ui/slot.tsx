"use client";

import {
  cloneElement,
  forwardRef,
  isValidElement,
  useCallback,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import { cn } from "@/lib/utils";

/** Loosely-typed prop bag used while merging slot props onto a child element. */
type UnknownProps = Record<string, unknown>;

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  if (ref && typeof ref === "object") {
    (ref as { current: T | null }).current = value;
  }
}

/**
 * Props for {@link Slot}. Everything other than `children` is merged onto the
 * single child element, so the bag stays open on purpose.
 */
export interface SlotProps {
  children?: ReactNode;
  [prop: string]: unknown;
}

/**
 * Renders exactly one child element with the given props merged onto it — the
 * primitive behind every `asChild` prop in this kit. Class names are combined,
 * `style` objects are merged, and event handlers run the child's handler first
 * and then the slot's.
 */
export const Slot = forwardRef<HTMLElement, SlotProps>(function Slot(
  { children, ...slotProps },
  forwardedRef,
) {
  const child = isValidElement(children)
    ? (children as ReactElement<UnknownProps>)
    : null;
  const childProps = child?.props;
  const childRef = childProps?.ref as Ref<unknown> | undefined;

  const mergedRef = useCallback(
    (node: unknown) => {
      assignRef(childRef, node);
      assignRef(forwardedRef as Ref<unknown> | undefined, node);
    },
    [childRef, forwardedRef],
  );

  if (!child || !childProps) return null;

  const merged: UnknownProps = { ...childProps };

  for (const [key, value] of Object.entries(slotProps)) {
    const existing = childProps[key];
    if (key === "className") {
      merged[key] = cn(
        existing as string | undefined,
        value as string | undefined,
      );
    } else if (key === "style") {
      merged[key] = {
        ...(existing as CSSProperties | undefined),
        ...(value as CSSProperties | undefined),
      };
    } else if (
      key.startsWith("on") &&
      typeof value === "function" &&
      typeof existing === "function"
    ) {
      const childHandler = existing as (...args: unknown[]) => unknown;
      const slotHandler = value as (...args: unknown[]) => unknown;
      merged[key] = (...args: unknown[]) => {
        childHandler(...args);
        slotHandler(...args);
      };
    } else {
      merged[key] = value;
    }
  }

  merged.ref = mergedRef;

  return cloneElement(
    child,
    merged as Partial<UnknownProps> & React.Attributes,
  );
});
