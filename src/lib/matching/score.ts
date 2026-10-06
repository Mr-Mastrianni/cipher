/**
 * Cosmic matching score.
 *
 * Three transparent strands, each listed as a human-readable reason:
 * - Shared interests the two members chose.
 * - Human Design: electromagnetic connections (each holds one gate of a
 *   channel the other completes) and companionship (both define the same
 *   channel) — standard Human Design relationship mechanics.
 * - KP resonance: shared signatures in the two KP charts — the same Moon
 *   nakshatra or Moon star lord, the same Lagna rasi, and running the same
 *   mahadasha now. These are resemblances, presented as such; they are not a
 *   classical compatibility verdict.
 *
 * Pure and deterministic, so it is unit-tested and can be cached.
 */

import { CHANNELS, CHANNEL_BY_GATES, channelKey } from "../human-design/constants";
import { GRAHA_LABEL, type Graha } from "../kp/constants";
import { interestLabel } from "./interests";

export interface MatchFeatures {
  userId: string;
  interests: string[];
  hd: {
    type: string;
    profile: string;
    /** Every activated gate. */
    gates: number[];
    /** Defined channels as "a-b" keys. */
    channels: string[];
  } | null;
  kp: {
    moonNakshatra: string;
    moonStarLord: Graha;
    lagnaRasi: string;
    /** Mahadasha running now, if known. */
    mahadasha: Graha | null;
  } | null;
}

export interface MatchReason {
  strand: "interests" | "human-design" | "kp";
  text: string;
  points: number;
}

export interface MatchResult {
  score: number;
  reasons: MatchReason[];
}

const CAP = { interests: 32, electromagnetic: 24, companionship: 12, kp: 32 } as const;

export function scoreMatch(a: MatchFeatures, b: MatchFeatures): MatchResult {
  const reasons: MatchReason[] = [];

  // Interests.
  const shared = a.interests.filter((id) => b.interests.includes(id));
  if (shared.length > 0) {
    reasons.push({
      strand: "interests",
      text: `Shared interests: ${shared.map(interestLabel).join(", ")}`,
      points: Math.min(CAP.interests, shared.length * 8),
    });
  }

  // Human Design.
  if (a.hd && b.hd) {
    const aGates = new Set(a.hd.gates);
    const bGates = new Set(b.hd.gates);
    const electromagnetic: string[] = [];
    for (const channel of CHANNELS) {
      const [g1, g2] = channel.gates;
      const aHas1 = aGates.has(g1);
      const aHas2 = aGates.has(g2);
      const bHas1 = bGates.has(g1);
      const bHas2 = bGates.has(g2);
      // Each holds exactly one side, and neither already defines the channel.
      if ((aHas1 && !aHas2 && bHas2 && !bHas1) || (aHas2 && !aHas1 && bHas1 && !bHas2)) {
        electromagnetic.push(`${channel.name} (${channelKey(g1, g2)})`);
      }
    }
    if (electromagnetic.length > 0) {
      reasons.push({
        strand: "human-design",
        text: `Electromagnetic: together you complete ${electromagnetic.slice(0, 3).join(", ")}${electromagnetic.length > 3 ? ` and ${electromagnetic.length - 3} more` : ""}`,
        points: Math.min(CAP.electromagnetic, electromagnetic.length * 6),
      });
    }
    const companion = a.hd.channels.filter((key) => b.hd?.channels.includes(key));
    if (companion.length > 0) {
      reasons.push({
        strand: "human-design",
        text: `Companionship: you both define ${companion
          .map((key) => {
            const name = CHANNEL_BY_GATES.get(key)?.name;
            return name ? `${name} (${key})` : key;
          })
          .join(", ")}`,
        points: Math.min(CAP.companionship, companion.length * 4),
      });
    }
  }

  // KP resonance.
  if (a.kp && b.kp) {
    let points = 0;
    const notes: string[] = [];
    if (a.kp.moonNakshatra === b.kp.moonNakshatra) {
      points += 12;
      notes.push(`the same Moon nakshatra (${a.kp.moonNakshatra})`);
    } else if (a.kp.moonStarLord === b.kp.moonStarLord) {
      points += 7;
      notes.push(`Moons in ${GRAHA_LABEL[a.kp.moonStarLord].english}'s stars`);
    }
    if (a.kp.lagnaRasi === b.kp.lagnaRasi) {
      points += 8;
      notes.push(`a ${a.kp.lagnaRasi} Lagna`);
    }
    if (a.kp.mahadasha && a.kp.mahadasha === b.kp.mahadasha) {
      points += 12;
      notes.push(`both running ${GRAHA_LABEL[a.kp.mahadasha].english} mahadasha now`);
    }
    if (notes.length > 0) {
      reasons.push({ strand: "kp", text: `KP resonance: ${notes.join("; ")}`, points: Math.min(CAP.kp, points) });
    }
  }

  const score = Math.min(100, reasons.reduce((sum, reason) => sum + reason.points, 0));
  return { score, reasons: reasons.sort((x, y) => y.points - x.points) };
}
