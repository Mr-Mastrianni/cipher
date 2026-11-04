"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { MapPin, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** One resolved place, as `/api/geocode` returns it. */
export interface PlaceSuggestion {
  /** The short name, e.g. "Leeds". */
  name: string;
  /** The full postal label, used for disambiguation. */
  displayName: string;
  latitude: number;
  longitude: number;
  /** IANA zone, or `null` when it could not be resolved. Never guessed. */
  timeZone: string | null;
  country: string | null;
  admin1: string | null;
}

type Status = "idle" | "searching" | "ready" | "empty" | "error";

/** How long typing must settle before a lookup is spent. */
const DEBOUNCE_MS = 380;
/** Below this many characters there is nothing worth searching for. */
const MIN_QUERY = 2;

/** Format a signed decimal degree as `51.5074°N`. */
function formatDegree(value: number, positive: string, negative: string): string {
  return `${Math.abs(value).toFixed(4)}°${value >= 0 ? positive : negative}`;
}

/**
 * A birthplace field that resolves to coordinates and a time zone.
 *
 * The chart is cast from the exact place, so asking someone to type a latitude
 * by hand is the single most error-prone part of intake. This searches
 * OpenStreetMap as they type, and picking a result fills the coordinates and —
 * only when the server could resolve one — the IANA zone. A zone is never
 * guessed from the country: that is wrong for every multi-zone country, and a
 * wrong zone moves the Ascendant.
 *
 * It is a proper combobox: arrow keys move the active option, Enter chooses it,
 * Escape closes the list, and the active option is announced through
 * `aria-activedescendant`. Searching is debounced and aborted, so a fast typist
 * never spends a rate-limited lookup on a half-typed town.
 */
export function PlaceAutocomplete({
  value,
  onValueChange,
  onPlacePicked,
  invalid = false,
  disabled = false,
  inputRef,
  inputId,
  describedBy,
}: {
  value: string;
  onValueChange: (next: string) => void;
  onPlacePicked: (place: PlaceSuggestion) => void;
  invalid?: boolean;
  disabled?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  inputId?: string;
  /** Ids of the helper or error text, wired through `aria-describedby`. */
  describedBy?: string;
}) {
  const generatedId = useId();
  const listId = `${inputId ?? generatedId}-listbox`;

  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [active, setActive] = useState(-1);
  const [message, setMessage] = useState<string | null>(null);

  const debounceRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  /** Stop any pending debounce and any in-flight request. */
  const cancelPending = useCallback(() => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  useEffect(() => cancelPending, [cancelPending]);

  /** Close the list when focus or a click leaves the field. */
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const runSearch = useCallback(async (query: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus("searching");
    setMessage(null);

    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
        headers: { accept: "application/json" },
      });
      const data = (await response.json().catch(() => null)) as
        | { results?: PlaceSuggestion[]; error?: string }
        | null;

      if (!response.ok) {
        setStatus("error");
        setResults([]);
        setOpen(true);
        setMessage(
          data?.error ??
            "The place lookup is unavailable. Enter your coordinates by hand below.",
        );
        return;
      }

      const found = data?.results ?? [];
      setResults(found);
      setActive(found.length > 0 ? 0 : -1);
      setStatus(found.length > 0 ? "ready" : "empty");
      setOpen(true);
      if (found.length === 0) {
        setMessage("No place matched. Try a nearby larger town.");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setStatus("error");
      setResults([]);
      setOpen(true);
      setMessage("The place lookup is unavailable. Enter your coordinates by hand below.");
    }
  }, []);

  const handleChange = useCallback(
    (next: string) => {
      onValueChange(next);
      cancelPending();

      const query = next.trim();
      if (query.length < MIN_QUERY) {
        setResults([]);
        setOpen(false);
        setStatus("idle");
        setMessage(null);
        return;
      }

      setStatus("searching");
      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null;
        void runSearch(query);
      }, DEBOUNCE_MS);
    },
    [cancelPending, onValueChange, runSearch],
  );

  const choose = useCallback(
    (place: PlaceSuggestion) => {
      cancelPending();
      onPlacePicked(place);
      setOpen(false);
      setResults([]);
      setActive(-1);
      setStatus("idle");
      setMessage(null);
    },
    [cancelPending, onPlacePicked],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      if (results.length > 0) {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (!open) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => (current + 1) % Math.max(results.length, 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => (current - 1 + results.length) % Math.max(results.length, 1));
    } else if (event.key === "Enter") {
      if (active >= 0 && results[active]) {
        // Only swallow Enter when it is choosing a place; otherwise the form's
        // own Enter handling (continue to the next step) must still fire.
        event.preventDefault();
        choose(results[active]);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  };

  const showList = open && (status === "ready" || status === "empty" || status === "error");
  const activeId = active >= 0 && results[active] ? `${listId}-option-${active}` : undefined;

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={inputId}
        ref={inputRef}
        value={value}
        disabled={disabled}
        invalid={invalid}
        onChange={(event) => handleChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (results.length > 0 || message) setOpen(true);
        }}
        placeholder="Leeds, England"
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        aria-describedby={describedBy}
      />

      {/* The trailing affordance: a spinner while a lookup is spending, a clear
          button once there is something to clear. */}
      <span className="pointer-events-none absolute right-0 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {status === "searching" ? (
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-hairline border-t-gold"
          />
        ) : value.length > 0 && !disabled ? (
          <button
            type="button"
            className="pointer-events-auto grid h-6 w-6 place-items-center rounded-full text-faint transition-colors hover:text-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            aria-label="Clear the birthplace"
            onClick={() => {
              handleChange("");
            }}
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.6} />
          </button>
        ) : (
          <Search aria-hidden="true" className="h-4 w-4 text-faint" strokeWidth={1.5} />
        )}
      </span>

      <p role="status" aria-live="polite" className="sr-only">
        {status === "searching"
          ? "Searching for places."
          : status === "ready"
            ? `${results.length} place${results.length === 1 ? "" : "s"} found.`
            : status === "empty"
              ? "No place matched."
              : status === "error"
                ? (message ?? "The place lookup is unavailable.")
                : ""}
      </p>

      {showList ? (
        <div
          id={listId}
          role="listbox"
          aria-label="Matching places"
          className="surface absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg bg-ink p-0 shadow-lg"
        >
          {status === "ready"
            ? results.map((place, index) => (
                <div
                  key={`${place.latitude},${place.longitude},${place.displayName}`}
                  id={`${listId}-option-${index}`}
                  role="option"
                  aria-selected={index === active}
                  // `onMouseDown` rather than `onClick`: the field's blur fires
                  // first on some browsers and would close the list underneath.
                  onMouseDown={(event) => {
                    event.preventDefault();
                    choose(place);
                  }}
                  onMouseEnter={() => setActive(index)}
                  className={cn(
                    "cursor-pointer border-b border-hairline/60 px-4 py-3 last:border-b-0",
                    index === active ? "bg-raised" : "bg-transparent",
                  )}
                >
                  <p className="text-sm leading-snug text-bone">{place.displayName}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
                    <MapPin aria-hidden="true" className="h-3 w-3" strokeWidth={1.5} />
                    <span className="tabular-nums">
                      {formatDegree(place.latitude, "N", "S")}{" "}
                      {formatDegree(place.longitude, "E", "W")}
                    </span>
                    {place.timeZone ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-gold">{place.timeZone}</span>
                      </>
                    ) : (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-warn">zone unresolved</span>
                      </>
                    )}
                  </p>
                </div>
              ))
            : null}

          {status !== "ready" && message ? (
            <p className="px-4 py-3 text-xs leading-relaxed text-muted">{message}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
