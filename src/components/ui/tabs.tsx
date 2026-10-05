"use client";

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { motion, useReducedMotion } from "motion/react";
import { cue } from "@/lib/audio/sound-engine";
import { cn } from "@/lib/utils";

/** Layout direction of a tab set. */
export type TabsOrientation = "horizontal" | "vertical";

interface TabsContextValue {
  value: string;
  setValue: (value: string) => void;
  baseId: string;
  orientation: TabsOrientation;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(component: string) {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error(`${component} must be rendered inside <Tabs>`);
  }
  return context;
}

const tabId = (baseId: string, value: string) => `${baseId}-tab-${value}`;
const panelId = (baseId: string, value: string) => `${baseId}-panel-${value}`;

export interface TabsProps {
  /** Controlled selection. */
  value?: string;
  /** Initial selection when uncontrolled. */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  orientation?: TabsOrientation;
  className?: string;
  children?: ReactNode;
}

/** Root of an accessible tab set; owns selection and wires up ARIA ids. */
export function Tabs({
  value: controlledValue,
  defaultValue = "",
  onValueChange,
  orientation = "horizontal",
  className,
  children,
}: TabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const baseId = useId();
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolledValue;

  const setValue = useCallback(
    (next: string) => {
      if (!isControlled) setUncontrolledValue(next);
      onValueChange?.(next);
    },
    [isControlled, onValueChange],
  );

  const context = useMemo(
    () => ({ value, setValue, baseId, orientation }),
    [value, setValue, baseId, orientation],
  );

  return (
    <TabsContext.Provider value={context}>
      <div
        className={cn(
          "flex flex-col gap-4",
          orientation === "vertical" && "flex-row gap-6",
          className,
        )}
      >
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export interface TabsListProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

/**
 * The tab strip. Arrow keys, Home, and End move focus and selection, matching
 * the WAI-ARIA tabs pattern with automatic activation.
 */
export function TabsList({ className, children, onKeyDown, ...props }: TabsListProps) {
  const { orientation, setValue } = useTabsContext("TabsList");
  const listRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;

    const list = listRef.current;
    if (!list) return;
    const tabs = Array.from(
      list.querySelectorAll<HTMLElement>('[role="tab"]:not([disabled])'),
    );
    const index = tabs.findIndex((tab) => tab === document.activeElement);
    if (index === -1) return;

    const forward = orientation === "vertical" ? "ArrowDown" : "ArrowRight";
    const backward = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";

    let next = -1;
    if (event.key === forward) next = (index + 1) % tabs.length;
    else if (event.key === backward) next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    if (next === -1) return;

    event.preventDefault();
    const target = tabs[next];
    target.focus();
    const nextValue = target.dataset.value;
    if (nextValue) {
      setValue(nextValue);
      cue("tick");
    }
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-orientation={orientation}
      onKeyDown={handleKeyDown}
      className={cn(
        "no-scrollbar relative flex items-center gap-1 overflow-x-auto border-b border-hairline",
        orientation === "vertical" &&
          "flex-col items-stretch overflow-visible border-b-0 border-r",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface TabsTriggerProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "value"> {
  /** Matches the `value` of its panel. */
  value: string;
  children?: ReactNode;
}

/** A single tab; the active one carries a spring-animated gold indicator. */
export function TabsTrigger({
  value,
  className,
  children,
  onClick,
  ...props
}: TabsTriggerProps) {
  const { value: selectedValue, setValue, baseId, orientation } =
    useTabsContext("TabsTrigger");
  const reduced = useReducedMotion();
  const selected = selectedValue === value;

  const indicator = cn(
    "absolute rounded-full bg-gold",
    orientation === "vertical"
      ? "inset-y-2 -right-px w-0.5"
      : "inset-x-2 -bottom-px h-0.5",
  );

  return (
    <button
      type="button"
      role="tab"
      id={tabId(baseId, value)}
      data-value={value}
      aria-selected={selected}
      aria-controls={panelId(baseId, value)}
      tabIndex={selected ? 0 : -1}
      onClick={(event) => {
        onClick?.(event);
        setValue(value);
        cue("select");
      }}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap px-3.5 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-void",
        selected ? "text-gold" : "text-muted hover:text-bone",
        className,
      )}
      {...props}
    >
      {children}
      {selected ? (
        reduced ? (
          <span aria-hidden="true" className={indicator} />
        ) : (
          <motion.span
            aria-hidden="true"
            layoutId={`${baseId}-indicator`}
            transition={{ type: "spring", stiffness: 480, damping: 38, mass: 0.6 }}
            className={indicator}
          />
        )
      ) : null}
    </button>
  );
}

export interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  /** Matches the `value` of its trigger. */
  value: string;
  children?: ReactNode;
}

/** The panel for a tab; hidden rather than unmounted so state survives. */
export function TabsContent({
  value,
  className,
  children,
  ...props
}: TabsContentProps) {
  const { value: selectedValue, baseId } = useTabsContext("TabsContent");
  const selected = selectedValue === value;

  return (
    <div
      role="tabpanel"
      id={panelId(baseId, value)}
      aria-labelledby={tabId(baseId, value)}
      hidden={!selected}
      tabIndex={0}
      className={cn("focus-visible:outline-none", className)}
      {...props}
    >
      {children}
    </div>
  );
}
