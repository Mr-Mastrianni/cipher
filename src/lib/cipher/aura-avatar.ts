import { GATE_TO_CENTER, CENTER_MAP, type CenterKey } from "@/lib/human-design/constants";

/**
 * The Aura Avatar — two words drawn from the twenty-six activations.
 *
 * THE RULE
 * --------
 * **The seat** comes from the gate you carry in the load-bearing sense: the
 * Personality Sun, which the system treats as the conscious purpose of the
 * incarnation. That gate names *what you are for*.
 *
 * **The format** comes from the line you carry most across all twenty-six
 * activations — the statistical mode of the lines, which names *how you
 * deliver it*. Ties break toward the Personality Sun's line, because the
 * conscious side is the side the person can actually work with on purpose.
 *
 * Together they give 64 × 6 = 384 possible avatars, and the pair is stable:
 * changing a birth time by ten minutes almost never changes the Sun gate, so
 * the avatar is one of the few outputs that survives an uncertain birth time.
 *
 * Positioning note: this is the same *concept* the reference platform uses
 * (a seat from a gate, a format from the dominant line) but the vocabulary
 * here is our own and is defined for all 64 gates and all 6 lines rather than
 * only the handful of worked examples.
 */

/** One word per gate, naming what carrying it makes you. Index 0 = gate 1. */
export const SEAT_BY_GATE: readonly string[] = [
  "Originator", // 1
  "Navigator", // 2
  "Starter", // 3
  "Answerer", // 4
  "Timekeeper", // 5
  "Diplomat", // 6
  "Leader", // 7
  "Contributor", // 8
  "Detailer", // 9
  "Natural", // 10
  "Dreamer", // 11
  "Articulator", // 12
  "Historian", // 13
  "Steward", // 14
  "Humanist", // 15
  "Enthusiast", // 16
  "Analyst", // 17
  "Corrector", // 18
  "Provider", // 19
  "Presence", // 20
  "Hunter", // 21
  "Charmer", // 22
  "Translator", // 23
  "Thinker", // 24
  "Original", // 25
  "Persuader", // 26
  "Caretaker", // 27
  "Seeker", // 28
  "Committer", // 29
  "Visionary", // 30
  "Voice", // 31
  "Preserver", // 32
  "Recounter", // 33
  "Vitalist", // 34
  "Explorer", // 35
  "Empath", // 36
  "Host", // 37
  "Fighter", // 38
  "Provocateur", // 39
  "Restorer", // 40
  "Seed", // 41
  "Completer", // 42
  "Breakthrough", // 43
  "Instinct", // 44
  "Gatherer", // 45
  "Embodier", // 46
  "Realizer", // 47
  "Craftsman", // 48
  "Revolutionary", // 49
  "Guardian", // 50
  "Awakener", // 51
  "Stabilizer", // 52
  "Initiator", // 53
  "Climber", // 54
  "Spirit", // 55
  "Storyteller", // 56
  "Clear-Hearer", // 57
  "Improver", // 58
  "Unifier", // 59
  "Realist", // 60
  "Mystic", // 61
  "Exact", // 62
  "Skeptic", // 63
  "Pattern-Seeker", // 64
] as const;

/** One word per line, naming how you deliver. Index 0 = line 1. */
export const FORMAT_BY_LINE: readonly string[] = [
  "Investigator", // 1 — foundations first
  "Influencer", // 2 — the natural gift, called out
  "Tester", // 3 — discovers by trying
  "Connector", // 4 — moves through relationship
  "Fixer", // 5 — the practical, universal answer
  "Exemplar", // 6 — becomes the demonstration
] as const;

/** The line's own description, so the UI can explain the choice. */
export const FORMAT_NOTE_BY_LINE: readonly string[] = [
  "You will not move until the ground is solid, and that caution is the product.",
  "Your gift works when you stop explaining it and let the room name it back.",
  "You find the shape of things by walking into them and correcting.",
  "Nothing reaches you except through the people who already trust you.",
  "You are handed the problem everyone else has given up on, and you solve it plainly.",
  "You are not here to do it first. You are here to do it in a way others can copy.",
] as const;

export interface ShieldActivation {
  gate: number;
  line: number;
  source: "personality" | "design";
  body?: string;
}

export interface AuraAvatar {
  /** e.g. "Originator" */
  seat: string;
  /** e.g. "Investigator" */
  format: string;
  /** e.g. "The Originator Investigator" */
  label: string;
  /** The gate the seat came from. */
  seatGate: number;
  /** Which centre that gate lives in. */
  seatCentre: CenterKey;
  /** The centre's display name, for the coordinate line. */
  seatCentreName: string;
  /** True when the seat's centre is undefined — the gate reads differently. */
  seatCentreOpen: boolean;
  /** The line the format came from (1–6). */
  formatLine: number;
  /** One-line explanation of the format. */
  formatNote: string;
  /** How many of the 26 activations carry that line. */
  formatCount: number;
  /**
   * The coordinate string, in the reference platform's idiom:
   * `LINE 1 · 10 OF 26 · SEAT · GATE 23, THE THROAT`
   */
  coordinate: string;
  /** True when the format was a near tie and the reading is less settled. */
  contested: boolean;
}

/**
 * Compute the Aura Avatar from the Personality Sun and the full activation set.
 *
 * @param personalitySun - the Personality Sun's gate and line.
 * @param activations - all 26 activations. Only `gate`, `line` and `source`
 *   are read.
 * @param designSunFallback - used only if no Personality Sun is supplied, e.g.
 *   when a chart was computed without a birth time.
 */
export function computeAuraAvatar(
  personalitySun: { gate: number; line: number } | null | undefined,
  activations: readonly ShieldActivation[],
  designSunFallback?: { gate: number; line: number } | null,
  openCentres?: readonly CenterKey[],
): AuraAvatar | null {
  const sun = personalitySun ?? designSunFallback ?? null;
  if (!sun || !Number.isFinite(sun.gate)) return null;

  const seatGate = sun.gate;
  const seat = SEAT_BY_GATE[seatGate - 1] ?? "Unnamed";
  const seatCentre = GATE_TO_CENTER[seatGate] ?? "throat";
  const seatCentreName = CENTER_MAP[seatCentre]?.name ?? "Throat";
  // The reference platform labels the seat's centre "OPEN" when that centre is
  // undefined, because an open centre changes how the gate is experienced.
  const seatOpen = openCentres?.includes(seatCentre) ?? false;
  const centreLabel = seatOpen
    ? `THE OPEN ${seatCentreName.toUpperCase()}`
    : `THE ${seatCentreName.toUpperCase()}`;

  // The line carried most across all 26 activations.
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const activation of activations) {
    if (activation.line >= 1 && activation.line <= 6) counts[activation.line]++;
  }

  let formatLine = sun.line;
  let best = -1;
  for (let line = 1; line <= 6; line++) {
    if (counts[line] > best) {
      best = counts[line];
      formatLine = line;
    }
  }

  // A tie means the format is genuinely unsettled — the person should be told.
  const runnersUp = counts.filter((count, line) => line >= 1 && count === best).length;
  const contested = runnersUp > 1;

  const format = FORMAT_BY_LINE[formatLine - 1] ?? "Investigator";
  const formatNote = FORMAT_NOTE_BY_LINE[formatLine - 1] ?? "";
  const total = activations.length || 26;

  return {
    seat,
    format,
    label: `The ${seat} ${format}`,
    seatGate,
    seatCentre,
    seatCentreName,
    seatCentreOpen: seatOpen,
    formatLine,
    formatNote,
    formatCount: best,
    coordinate: `LINE ${formatLine} · ${best} OF ${total} · SEAT · GATE ${seatGate}, ${centreLabel}`,
    contested,
  };
}

/**
 * The avatar's "initials" — used for the avatar chip when no image exists.
 * Falls back to the first two letters of the label.
 */
export function avatarInitials(avatar: Pick<AuraAvatar, "seat" | "format">) {
  return `${avatar.seat.charAt(0)}${avatar.format.charAt(0)}`.toUpperCase();
}
