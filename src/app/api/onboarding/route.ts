import type { NextRequest } from "next/server";
import { z } from "zod";

import {
  computeNatalChart,
  resolveBirthInstantDetailed,
  type BirthInput,
  type NatalChart,
} from "@/lib/astrology";
import {
  CHANNEL_BY_GATES,
  computeHumanDesign,
  type CenterKey,
} from "@/lib/human-design";
import {
  computeAuraAvatar,
  type AuraAvatar,
} from "@/lib/cipher/aura-avatar";
import {
  categorizeMember,
  summariseCategory,
  type CategorizationInput,
  type MemberCategory,
} from "@/lib/cipher/categorization";
import { handleAuthError, requireUser } from "@/lib/auth";
import {
  type BirthProfile,
  type Bodygraph as PersistedBodygraph,
  type OnboardingAnswers,
} from "@/lib/db/schema";
import { getStore } from "@/lib/db/store";

/**
 * Onboarding: the server half.
 *
 * The client sends birth data and answers; **nothing computed on the client is
 * trusted**. The whole reading — natal chart, bodygraph, Aura Avatar, cohort
 * placement and the strengths/edges derived from the defined and open centres —
 * is recomputed here from the raw birth fields.
 *
 * `GET` returns the minimum the flow needs to decide which steps to show. It is
 * colocated here rather than in a second route because the two are always read
 * and written together, and it keeps the whole onboarding surface in one file.
 */

const HUMAN_DESIGN_KNOWLEDGE = ["none", "some", "deep"] as const;

/** The collective offerings a member can ask for. Stored verbatim as labels. */
const WANTS = [
  "community",
  "weekly calls",
  "courses",
  "readings",
  "accountability",
  "business",
] as const;

const birthSchema = z.object({
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
  birthTime: z
    .string()
    .regex(/^\d{2}:\d{2}(?::\d{2})?$/, "Expected HH:MM or HH:MM:SS"),
  birthTimeZone: z.string().min(1).max(64),
  birthLatitude: z.number().min(-90).max(90),
  birthLongitude: z.number().min(-180).max(180),
  birthPlaceName: z.string().max(200).optional(),
});

const answersSchema = z.object({
  hereToMake: z.string().min(1).max(2000),
  workDescription: z.string().min(1).max(200),
  humanDesignKnowledge: z.enum(HUMAN_DESIGN_KNOWLEDGE),
  stopDoing: z.string().min(1).max(2000),
  wants: z.array(z.enum(WANTS)).min(1),
  timezone: z.string().min(1).max(64),
  callSlot: z.string().min(1).max(64),
});

const requestSchema = z.object({
  birth: birthSchema.optional(),
  answers: answersSchema,
});

type Answers = z.infer<typeof answersSchema>;
type BirthFields = z.infer<typeof birthSchema>;

/** Everything a completed reading produces, in one serialisable object. */
interface ComputedReading {
  natalChart: NatalChart;
  bodygraph: PersistedBodygraph;
  avatar: AuraAvatar | null;
  category: MemberCategory;
  /** Community channel slugs this member is placed into. */
  channels: string[];
  summary: string;
  warnings: string[];
}

function splitDate(value: string): [number, number, number] {
  const parts = value.split("-").map(Number);
  return [parts[0] ?? 0, parts[1] ?? 1, parts[2] ?? 1];
}

function splitTime(value: string): [number, number, number] {
  const parts = value.split(":").map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function toBirthInput(birth: BirthFields): BirthInput {
  const [year, month, day] = splitDate(birth.birthDate);
  const [hour, minute, second] = splitTime(birth.birthTime);
  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    timeZone: birth.birthTimeZone,
    latitude: birth.birthLatitude,
    longitude: birth.birthLongitude,
  };
}

function fromStoredProfile(profile: BirthProfile): BirthInput {
  const [year, month, day] = splitDate(profile.birthDate);
  const [hour, minute, second] = splitTime(profile.birthTime);
  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    timeZone: profile.birthTimeZone,
    latitude: profile.birthLatitude,
    longitude: profile.birthLongitude,
  };
}

/**
 * Resolve a birth input all the way to a placement.
 *
 * This is the thin wrapper the task allows when `@/lib/cipher/compute-reading`
 * is absent: it wires the astrology engine, the Human Design engine, the Aura
 * Avatar and the categoriser together and nothing more.
 */
function computeReading(input: BirthInput): ComputedReading {
  const { date, warnings: timeWarnings } = resolveBirthInstantDetailed(input);
  const natalChart = computeNatalChart(input);
  const hd = computeHumanDesign(date);

  const centerKeys = Object.keys(hd.centers) as CenterKey[];
  const definedCenters = centerKeys.filter((key) => hd.centers[key].defined);
  const openCenters = centerKeys.filter((key) => !hd.centers[key].defined);

  const personalitySun =
    hd.activations.find(
      (activation) =>
        activation.body === "sun" && activation.source === "personality",
    ) ?? null;
  const designSun =
    hd.activations.find(
      (activation) => activation.body === "sun" && activation.source === "design",
    ) ?? null;

  const avatar = computeAuraAvatar(
    personalitySun,
    hd.activations,
    designSun,
    openCenters,
  );

  const categorizationInput: CategorizationInput = {
    type: hd.type,
    authority: hd.authority,
    profile: hd.profile,
    definition: hd.definition.label,
    centers: hd.centers,
    channels: hd.channels.map((channel) => ({
      gates: channel.gates,
      circuit: CHANNEL_BY_GATES.get(channel.key)?.circuit ?? "collective",
    })),
    gates: hd.gates.map((gate) => gate.gate),
  };

  const category = categorizeMember(categorizationInput, avatar);

  // The persisted bodygraph is the storage-layer projection, not the engine
  // result: the store's shape is deliberately narrower and forward-compatible.
  const bodygraph: PersistedBodygraph = {
    type: hd.type,
    authority: hd.authority,
    profile: hd.profile,
    definition: hd.definition.label,
    definedCenters,
    openCenters,
    channels: hd.channels.map((channel) => ({
      gates: [channel.gates[0], channel.gates[1]] as [number, number],
      name: channel.name,
      circuit: CHANNEL_BY_GATES.get(channel.key)?.circuit,
    })),
    gates: hd.gates.map((gate) => ({
      gate: gate.gate,
      line: gate.strongestLine,
      side: gate.sources[0] ?? "personality",
    })),
    variables: {
      determination: hd.variables.determination?.name,
      environment: hd.variables.environment?.name,
      motivation: hd.variables.motivation?.name,
      perspective: hd.variables.perspective?.name,
    },
  };

  const channels = [
    ...new Set([
      category.cohort.channel,
      category.archetype.channel,
      category.lane.channel,
    ]),
  ];

  return {
    natalChart,
    bodygraph,
    avatar,
    category,
    channels,
    summary: summariseCategory(category, {
      type: hd.type,
      authority: hd.authority,
      profile: hd.profile,
    }),
    warnings: [...timeWarnings, ...hd.warnings, ...natalChart.warnings],
  };
}

/** Shape stored in `birth_profiles.onboarding_answers`. */
function toStoredAnswers(answers: Answers): OnboardingAnswers {
  return {
    hereToMake: answers.hereToMake,
    workDescription: answers.workDescription,
    humanDesignKnowledge: answers.humanDesignKnowledge,
    stopDoing: answers.stopDoing,
    wants: answers.wants,
    timezone: answers.timezone,
    callSlot: answers.callSlot,
  };
}

export const runtime = "nodejs";

/**
 * Bootstrap the onboarding flow for the signed-in member: whether a birth
 * profile already exists, and the fields needed to prefill the birth step.
 */
export async function GET(): Promise<Response> {
  try {
    const user = await requireUser();
    const profile = await getStore().getBirthProfileByUser(user.id);
    return Response.json({
      ok: true,
      onboardingCompleted: Boolean(user.onboardingCompletedAt),
      hasBirthProfile: Boolean(profile),
      timezone: user.timezone,
      birth: profile
        ? {
            birthDate: profile.birthDate,
            birthTime: profile.birthTime,
            birthTimeZone: profile.birthTimeZone,
            birthLatitude: profile.birthLatitude,
            birthLongitude: profile.birthLongitude,
            birthPlaceName: profile.birthPlaceName,
          }
        : null,
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    return Response.json(
      { ok: false, error: "Could not load onboarding state." },
      { status: 500 },
    );
  }
}

/**
 * Complete onboarding: recompute the reading from raw birth data, persist the
 * profile and answers, mark the account onboarded, and return the reveal data.
 */
export async function POST(request: NextRequest): Promise<Response> {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    return Response.json({ ok: false, error: "Unauthorised." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: "Some answers are missing or out of range.",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const { answers } = parsed.data;
  const store = getStore();
  const existingProfile = await store.getBirthProfileByUser(user.id);

  const birthInput = parsed.data.birth
    ? toBirthInput(parsed.data.birth)
    : existingProfile
      ? fromStoredProfile(existingProfile)
      : null;

  if (!birthInput) {
    return Response.json(
      { ok: false, error: "Birth date, time, place and coordinates are required." },
      { status: 400 },
    );
  }

  let reading: ComputedReading;
  try {
    reading = computeReading(birthInput);
  } catch (error) {
    // Bad birth data fails loudly here rather than producing a plausible chart.
    return Response.json(
      {
        ok: false,
        error:
          error instanceof RangeError
            ? error.message
            : "The reading could not be computed from those birth details.",
      },
      { status: 422 },
    );
  }

  const birthDate = parsed.data.birth
    ? parsed.data.birth.birthDate
    : (existingProfile?.birthDate ?? "");
  const birthTime = parsed.data.birth
    ? parsed.data.birth.birthTime
    : (existingProfile?.birthTime ?? "00:00:00");

  await store.upsertBirthProfile({
    userId: user.id,
    birthDate,
    birthTime,
    birthTimeZone: birthInput.timeZone,
    birthLatitude: birthInput.latitude,
    birthLongitude: birthInput.longitude,
    birthPlaceName:
      parsed.data.birth?.birthPlaceName ??
      existingProfile?.birthPlaceName ??
      null,
    natalChart: reading.natalChart,
    bodygraph: reading.bodygraph,
    auraSeat: reading.avatar?.seat ?? "",
    auraFormat: reading.avatar?.format ?? "",
    auraLabel: reading.avatar?.label ?? "",
    strengths: reading.category.strengths,
    weaknesses: reading.category.growthEdges,
    onboardingAnswers: toStoredAnswers(answers),
  });

  await store.updateUser(user.id, {
    onboardingCompletedAt: new Date(),
    timezone: answers.timezone,
    lastSeenAt: new Date(),
  });

  return Response.json({
    ok: true,
    avatar: reading.avatar,
    category: reading.category,
    channels: reading.channels,
    summary: reading.summary,
    strengths: reading.category.strengths,
    weaknesses: reading.category.growthEdges,
    warnings: reading.warnings,
  });
}
