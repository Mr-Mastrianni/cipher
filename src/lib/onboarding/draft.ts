/**
 * Onboarding draft persistence.
 *
 * The flow asks for six screens of answers after the birth moment, and a
 * refresh, a dropped phone or a trip to find a birth certificate should not
 * cost the whole thing. The draft lives in `localStorage` only — never on the
 * server — because the half-finished answers are not yet something the member
 * has chosen to submit, and a birth time is personal data worth keeping local
 * until they do.
 *
 * The stored payload is versioned. A draft written by a different version of
 * the flow is discarded rather than migrated: a stale step index pointing at a
 * screen whose meaning has changed is worse than starting again.
 */

/** The storage key. Namespaced so it can never collide with another app. */
export const DRAFT_STORAGE_KEY = "cipher:onboarding-draft";

/** Bump when the shape of `birth` or `answers` changes incompatibly. */
const DRAFT_VERSION = 1;

/** Drafts older than this are ignored, and removed on the next read. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface OnboardingDraft<TBirth, TAnswers> {
  version: typeof DRAFT_VERSION;
  /** Epoch milliseconds, used to expire stale drafts. */
  savedAt: number;
  /** Which screen the member was on. */
  stepIndex: number;
  /** Whether the birth moment was already on file when the draft was made. */
  hasBirthProfile: boolean;
  birth: TBirth;
  answers: TAnswers;
}

/** `true` when the browser exposes a usable localStorage. */
function storageAvailable(): boolean {
  try {
    const probe = "__cipher_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read the stored draft, if there is a usable one.
 *
 * @returns The draft, or `null` when there is none, it is from an incompatible
 *   version, it is malformed, or it has expired. Expired and malformed drafts
 *   are deleted so they cannot be read again.
 */
export function readDraft<TBirth, TAnswers>(): OnboardingDraft<TBirth, TAnswers> | null {
  if (typeof window === "undefined" || !storageAvailable()) return null;

  let raw: string | null;
  try {
    raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    removeDraft();
    return null;
  }

  if (!parsed || typeof parsed !== "object") {
    removeDraft();
    return null;
  }

  const candidate = parsed as Partial<OnboardingDraft<TBirth, TAnswers>>;
  if (
    candidate.version !== DRAFT_VERSION ||
    typeof candidate.savedAt !== "number" ||
    typeof candidate.stepIndex !== "number" ||
    typeof candidate.hasBirthProfile !== "boolean" ||
    candidate.birth === undefined ||
    candidate.answers === undefined
  ) {
    removeDraft();
    return null;
  }

  if (Date.now() - candidate.savedAt > MAX_AGE_MS) {
    removeDraft();
    return null;
  }

  return candidate as OnboardingDraft<TBirth, TAnswers>;
}

/**
 * Write a draft.
 *
 * @returns `true` when it was stored. A quota error or a privacy mode that
 *   blocks storage returns `false` rather than throwing, so the caller can say
 *   honestly that nothing was saved.
 */
export function writeDraft<TBirth, TAnswers>(
  draft: Omit<OnboardingDraft<TBirth, TAnswers>, "version" | "savedAt">,
): boolean {
  if (typeof window === "undefined" || !storageAvailable()) return false;
  try {
    window.localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({ ...draft, version: DRAFT_VERSION, savedAt: Date.now() }),
    );
    return true;
  } catch {
    return false;
  }
}

/** Delete the stored draft. Safe to call when there is none. */
export function removeDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    /* A blocked storage API has nothing to remove. */
  }
}
