/**
 * The Cipher — Drizzle Postgres schema.
 *
 * This is the complete persistence model for the membership platform:
 * identity + membership, birth/chart profiles, billing, community chat and
 * DMs, weekly live calls, courses, FSRS flashcards, the admin AI agent, and
 * the audit trail.
 *
 * Conventions:
 *  - UUID primary keys (`defaultRandom()`) except append-only log tables where
 *    a bigserial would be used — we stay on UUIDs for a single consistent shape.
 *  - `timestamptz` everywhere, surfaced to TypeScript as `Date`.
 *  - `jsonb` columns are `$type<...>()`-tagged so the application gets real
 *    types instead of `unknown`.
 *  - Clerk owns identity; `users.clerkUserId` is the local projection key.
 *
 * The schema is intentionally dialect-plain Postgres so it works identically
 * on Neon (HTTP driver), a pooled `pg` connection, or local Docker.
 */

import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  date,
  doublePrecision,
  index,
  inet,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

import type {
  Authority,
  CenterKey,
  HumanDesignType,
} from "@/lib/human-design/constants";

/* ────────────────────────────────────────────────────────────────────────────
 * Enums
 * ──────────────────────────────────────────────────────────────────────────── */

export const userRoleEnum = pgEnum("user_role", [
  "member",
  "admin",
  "moderator",
]);

export const membershipStatusEnum = pgEnum("membership_status", [
  "none",
  "pending",
  "approved",
  "denied",
  "suspended",
]);

/** Billing tiers: a free tier plus the three paid tiers. */
export const tierEnum = pgEnum("tier", ["free", "initiate", "adept", "oracle"]);

export const applicationStatusEnum = pgEnum("application_status", [
  "pending",
  "approved",
  "denied",
  "withdrawn",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "paused",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "open",
  "paid",
  "void",
  "uncollectible",
]);

export const channelKindEnum = pgEnum("channel_kind", ["public", "private"]);

export const channelMemberRoleEnum = pgEnum("channel_member_role", [
  "owner",
  "moderator",
  "member",
]);

export const threadParticipantRoleEnum = pgEnum("thread_participant_role", [
  "member",
  "owner",
]);

export const liveCallStatusEnum = pgEnum("live_call_status", [
  "scheduled",
  "live",
  "ended",
  "canceled",
]);

export const rsvpStatusEnum = pgEnum("rsvp_status", [
  "going",
  "maybe",
  "declined",
]);

export const lessonProgressStatusEnum = pgEnum("lesson_progress_status", [
  "not_started",
  "in_progress",
  "complete",
]);

/** Mirrors `ts-fsrs` `State` (FSRS v6). */
export const flashcardStateEnum = pgEnum("flashcard_state", [
  "new",
  "learning",
  "review",
  "relearning",
]);

export const agentSessionStatusEnum = pgEnum("agent_session_status", [
  "active",
  "archived",
]);

export const agentMessageRoleEnum = pgEnum("agent_message_role", [
  "user",
  "assistant",
  "system",
  "tool",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "system",
  "application",
  "message",
  "call",
  "course",
  "billing",
  "agent",
]);

export const webhookProviderEnum = pgEnum("webhook_provider", [
  "clerk",
  "stripe",
]);

/* ────────────────────────────────────────────────────────────────────────────
 * Shared JSON payload types
 * ──────────────────────────────────────────────────────────────────────────── */

/** A single stored attachment on a message. */
export interface MessageAttachment {
  url: string;
  name?: string;
  mimeType?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
}

/**
 * The persisted projection of a computed Human Design bodygraph.
 *
 * The calculator is free to produce a richer object; only these fields are
 * guaranteed by the storage layer. The index signature keeps forward
 * compatibility with calculator revisions without a migration.
 */
export interface Bodygraph {
  type: HumanDesignType;
  authority: Authority;
  /** e.g. "1/3" (personality/design Sun line). */
  profile: string;
  /** e.g. "Single", "Split", "Triple Split". */
  definition: string;
  definedCenters: CenterKey[];
  openCenters: CenterKey[];
  /** Defined channels, each identified by its two gates. */
  channels: Array<{
    gates: [number, number];
    name?: string;
    circuit?: string;
  }>;
  /** Activated gates with their line/color/tone/base detail. */
  gates: Array<{
    gate: number;
    line: number;
    color?: number;
    tone?: number;
    base?: number;
    side: "design" | "personality";
    planet?: string;
  }>;
  /** The four variable arrows, when computed. */
  variables?: {
    determination?: string;
    environment?: string;
    motivation?: string;
    perspective?: string;
  };
  [key: string]: unknown;
}

/** The derived aura avatar rendered for a member. */
export interface AuraAvatar {
  /** Which "seat" of the aura the avatar sits in. */
  seat: string;
  /** Rendering format, e.g. "gif" | "webm" | "svg". */
  format: string;
  /** The generated human-readable label. */
  label: string;
  palette?: string[];
  assetUrl?: string;
}

/** Free-form onboarding answers captured alongside the birth profile. */
export interface OnboardingAnswers {
  whyJoin?: string;
  experienceLevel?: string;
  focusAreas?: string[];
  referralSource?: string;
  birthTimeKnown?: boolean;
  goals?: string[];
  [key: string]: unknown;
}

/** The membership application form payload. */
export interface ApplicationAnswers {
  /** Why they want in. */
  why: string;
  /** What they make / do. */
  whatYouMake: string;
  /** Self-reported Human Design / astrology experience. */
  experienceLevel: string;
  /** Who referred them, if anyone. */
  referral?: string;
  [key: string]: unknown;
}

/** A single AI-agent tool invocation persisted with an assistant message. */
export interface AgentToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  status: "pending" | "success" | "error";
  error?: string;
}

/** Arbitrary structured metadata stored on notifications. */
export type NotificationMetadata = Record<string, unknown>;

/** Arbitrary structured metadata stored on audit log entries. */
export type AuditMetadata = Record<string, unknown>;

/* ────────────────────────────────────────────────────────────────────────────
 * Identity & membership
 * ──────────────────────────────────────────────────────────────────────────── */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    email: text("email"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    /** Preferred display name, falling back to first + last. */
    displayName: text("display_name"),
    imageUrl: text("image_url"),
    bio: text("bio"),
    pronouns: text("pronouns"),
    location: text("location"),
    /** IANA zone the member reads the schedule in. */
    timezone: text("timezone"),
    role: userRoleEnum("role").notNull().default("member"),
    membershipStatus: membershipStatusEnum("membership_status")
      .notNull()
      .default("none"),
    tier: tierEnum("tier").notNull().default("free"),

    // Billing mirrors (source of truth is the `subscriptions` table / Stripe).
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    subscriptionStatus: text("subscription_status"),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),

    onboardingCompletedAt: timestamp("onboarding_completed_at", {
      withTimezone: true,
    }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    /** Timestamp of the last Clerk webhook that wrote this row (stale-event guard). */
    clerkUpdatedAt: timestamp("clerk_updated_at", { withTimezone: true }),
    /** Soft delete: a late Clerk event must never resurrect a deleted user. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("users_clerk_user_id_idx").on(t.clerkUserId),
    uniqueIndex("users_email_idx").on(t.email),
    index("users_role_idx").on(t.role),
    index("users_membership_status_idx").on(t.membershipStatus),
    index("users_tier_idx").on(t.tier),
  ],
);

export const birthProfiles = pgTable(
  "birth_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Birth data.
    birthDate: date("birth_date", { mode: "string" }).notNull(),
    /** Local clock time at the place of birth, "HH:MM:SS". */
    birthTime: time("birth_time").notNull(),
    birthTimeZone: text("birth_time_zone").notNull(),
    birthLatitude: doublePrecision("birth_latitude").notNull(),
    birthLongitude: doublePrecision("birth_longitude").notNull(),
    birthPlaceName: text("birth_place_name"),

    // Computed KP chart snapshot (JSON-serialised `KpChart`) + bodygraph.
    // Null until the engine has run. Pages recompute the KP chart from the
    // birth data, so the snapshot is a record of what was shown, not a cache.
    kpChart: jsonb("kp_chart").$type<Record<string, unknown>>(),
    bodygraph: jsonb("bodygraph").$type<Bodygraph>(),

    // Derived aura avatar.
    auraSeat: text("aura_seat").notNull().default(""),
    auraFormat: text("aura_format").notNull().default(""),
    auraLabel: text("aura_label").notNull().default(""),
    auraAvatar: jsonb("aura_avatar").$type<AuraAvatar>(),

    strengths: text("strengths")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    weaknesses: text("weaknesses")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),

    onboardingAnswers: jsonb("onboarding_answers").$type<OnboardingAnswers>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("birth_profiles_user_id_idx").on(t.userId)],
);

export const membershipApplications = pgTable(
  "membership_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: applicationStatusEnum("status").notNull().default("pending"),
    answers: jsonb("answers").$type<ApplicationAnswers>().notNull(),
    reviewedById: uuid("reviewed_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    decisionNote: text("decision_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("membership_applications_status_created_idx").on(
      t.status,
      t.createdAt,
    ),
    index("membership_applications_user_idx").on(t.userId),
  ],
);

/* ────────────────────────────────────────────────────────────────────────────
 * Billing
 * ──────────────────────────────────────────────────────────────────────────── */

export const tiers = pgTable(
  "tiers",
  {
    /** Tier key doubles as the primary key: 'free' | 'initiate' | … */
    key: tierEnum("key").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    monthlyPriceCents: integer("monthly_price_cents").notNull().default(0),
    annualPriceCents: integer("annual_price_cents"),
    currency: text("currency").notNull().default("usd"),
    stripeProductId: text("stripe_product_id"),
    stripePriceId: text("stripe_price_id"),
    /** Capability list, e.g. ['community.post', 'livecalls.access']. */
    features: jsonb("features")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("tiers_display_order_idx").on(t.displayOrder)],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    stripeSubscriptionId: text("stripe_subscription_id").notNull(),
    stripePriceId: text("stripe_price_id"),
    tier: tierEnum("tier")
      .notNull()
      .default("free")
      .references(() => tiers.key, { onDelete: "restrict" }),
    status: subscriptionStatusEnum("status").notNull().default("incomplete"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    currentPeriodStart: timestamp("current_period_start", {
      withTimezone: true,
    }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("subscriptions_stripe_subscription_id_idx").on(
      t.stripeSubscriptionId,
    ),
    index("subscriptions_user_idx").on(t.userId),
    index("subscriptions_status_idx").on(t.status),
    index("subscriptions_stripe_customer_idx").on(t.stripeCustomerId),
  ],
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    stripeInvoiceId: text("stripe_invoice_id").notNull(),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    status: invoiceStatusEnum("status").notNull().default("draft"),
    amountDueCents: integer("amount_due_cents").notNull().default(0),
    amountPaidCents: integer("amount_paid_cents").notNull().default(0),
    currency: text("currency").notNull().default("usd"),
    hostedInvoiceUrl: text("hosted_invoice_url"),
    periodStart: timestamp("period_start", { withTimezone: true }),
    periodEnd: timestamp("period_end", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("invoices_stripe_invoice_id_idx").on(t.stripeInvoiceId),
    index("invoices_user_idx").on(t.userId),
    index("invoices_status_idx").on(t.status),
  ],
);

/**
 * Webhook idempotency ledger. Both Clerk (svix-id) and Stripe (event.id)
 * deliver at-least-once, so every handler records the provider event id here
 * before acting.
 */
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: text("id").primaryKey(),
    provider: webhookProviderEnum("provider").notNull(),
    type: text("type").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
  },
  (t) => [index("webhook_events_provider_idx").on(t.provider, t.type)],
);

/* ────────────────────────────────────────────────────────────────────────────
 * Community: channels, messages, DMs
 * ──────────────────────────────────────────────────────────────────────────── */

export const channels = pgTable(
  "channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    kind: channelKindEnum("kind").notNull().default("public"),
    /** Minimum tier required to read/post; null = any approved member. */
    tierRequired: tierEnum("tier_required").references(() => tiers.key, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("channels_slug_idx").on(t.slug),
    index("channels_kind_idx").on(t.kind),
  ],
);

export const channelMembers = pgTable(
  "channel_members",
  {
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: channelMemberRoleEnum("role").notNull().default("member"),
    /** Last message the member has read; no FK to avoid a cycle. */
    lastReadMessageId: uuid("last_read_message_id"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    mutedAt: timestamp("muted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.channelId, t.userId] }),
    index("channel_members_user_idx").on(t.userId),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    attachments: jsonb("attachments")
      .$type<MessageAttachment[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    replyToId: uuid("reply_to_id").references((): AnyPgColumn => messages.id, {
      onDelete: "set null",
    }),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Cursor pagination key: (channel_id, created_at DESC).
    index("messages_channel_created_idx").on(t.channelId, t.createdAt),
    index("messages_author_idx").on(t.authorId),
  ],
);

export const directThreads = pgTable(
  "direct_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Stored canonically with userAId < userBId (enforced by a check). */
    userAId: uuid("user_a_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userBId: uuid("user_b_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("direct_threads_pair_idx").on(t.userAId, t.userBId),
    index("direct_threads_user_a_idx").on(t.userAId),
    index("direct_threads_user_b_idx").on(t.userBId),
    check("direct_threads_user_order", sql`${t.userAId} < ${t.userBId}`),
  ],
);

/**
 * Explicit participant rows for a DM thread. `directThreads` alone is enough
 * to query a pair, but participant rows give per-user read state and room for
 * group-DM evolution without a schema rewrite.
 */
export const directThreadParticipants = pgTable(
  "direct_thread_participants",
  {
    threadId: uuid("thread_id")
      .notNull()
      .references(() => directThreads.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: threadParticipantRoleEnum("role").notNull().default("member"),
    lastReadMessageId: uuid("last_read_message_id"),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.threadId, t.userId] }),
    index("direct_thread_participants_user_idx").on(t.userId),
  ],
);

export const directMessages = pgTable(
  "direct_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => directThreads.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    attachments: jsonb("attachments")
      .$type<MessageAttachment[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    replyToId: uuid("reply_to_id").references(
      (): AnyPgColumn => directMessages.id,
      { onDelete: "set null" },
    ),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("direct_messages_thread_created_idx").on(t.threadId, t.createdAt),
    index("direct_messages_author_idx").on(t.authorId),
  ],
);

/* ────────────────────────────────────────────────────────────────────────────
 * Live calls
 * ──────────────────────────────────────────────────────────────────────────── */

export const liveCalls = pgTable(
  "live_calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    hostId: uuid("host_id").references(() => users.id, {
      onDelete: "set null",
    }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(60),
    roomUrl: text("room_url"),
    provider: text("provider").notNull().default("daily"),
    providerRoomName: text("provider_room_name"),
    recordingUrl: text("recording_url"),
    status: liveCallStatusEnum("status").notNull().default("scheduled"),
    tierRequired: tierEnum("tier_required").references(() => tiers.key, {
      onDelete: "set null",
    }),

    // Weekly recurrence. `recurrenceRule` holds the full RFC 5545 RRULE when
    // present; the three fields below are the ergonomic UI-friendly projection.
    recurring: boolean("recurring").notNull().default(false),
    /** 0 = Sunday … 6 = Saturday. */
    recurrenceDay: smallint("recurrence_day"),
    /** Local "HH:MM" in `recurrenceTz`. */
    recurrenceTime: text("recurrence_time"),
    recurrenceTz: text("recurrence_tz"),
    recurrenceRule: text("recurrence_rule"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("live_calls_slug_idx").on(t.slug),
    index("live_calls_starts_at_idx").on(t.startsAt),
    index("live_calls_status_idx").on(t.status),
  ],
);

export const callRsvps = pgTable(
  "call_rsvps",
  {
    callId: uuid("call_id")
      .notNull()
      .references(() => liveCalls.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: rsvpStatusEnum("status").notNull().default("going"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.callId, t.userId] }),
    index("call_rsvps_user_idx").on(t.userId),
  ],
);

/* ────────────────────────────────────────────────────────────────────────────
 * Courses & lessons
 * ──────────────────────────────────────────────────────────────────────────── */

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    description: text("description"),
    coverImageUrl: text("cover_image_url"),
    tierRequired: tierEnum("tier_required")
      .notNull()
      .default("free")
      .references(() => tiers.key, { onDelete: "restrict" }),
    sortOrder: integer("sort_order").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("courses_slug_idx").on(t.slug),
    index("courses_published_idx").on(t.publishedAt),
  ],
);

export const lessons = pgTable(
  "lessons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    /** Developer-authored MDX. */
    contentMdx: text("content_mdx"),
    /** Admin-authored Tiptap document. */
    contentJson: jsonb("content_json").$type<Record<string, unknown>>(),
    videoUrl: text("video_url"),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    tierRequired: tierEnum("tier_required")
      .notNull()
      .default("free")
      .references(() => tiers.key, { onDelete: "restrict" }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("lessons_course_slug_idx").on(t.courseId, t.slug),
    index("lessons_course_order_idx").on(t.courseId, t.sortOrder),
  ],
);

export const lessonProgress = pgTable(
  "lesson_progress",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    status: lessonProgressStatusEnum("status").notNull().default("not_started"),
    progressPct: integer("progress_pct").notNull().default(0),
    lastPositionSeconds: integer("last_position_seconds").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.lessonId] }),
    index("lesson_progress_lesson_idx").on(t.lessonId),
  ],
);

/* ────────────────────────────────────────────────────────────────────────────
 * Flashcards & FSRS
 * ──────────────────────────────────────────────────────────────────────────── */

export const flashcardDecks = pgTable(
  "flashcard_decks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    /** Null owner = a shared, platform-authored deck. */
    ownerUserId: uuid("owner_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    tierRequired: tierEnum("tier_required")
      .notNull()
      .default("free")
      .references(() => tiers.key, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("flashcard_decks_slug_idx").on(t.slug)],
);

export const flashcards = pgTable(
  "flashcards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deckId: uuid("deck_id")
      .notNull()
      .references(() => flashcardDecks.id, { onDelete: "cascade" }),
    front: text("front").notNull(),
    back: text("back").notNull(),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    sortOrder: integer("sort_order").notNull().default(0),
    createdById: uuid("created_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("flashcards_deck_idx").on(t.deckId),
    index("flashcards_tags_idx").using("gin", t.tags),
  ],
);

/**
 * One row per (user, card): the FSRS memory state. `due` is the study-queue
 * key, hence the composite index below.
 */
export const flashcardReviews = pgTable(
  "flashcard_reviews",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    cardId: uuid("card_id")
      .notNull()
      .references(() => flashcards.id, { onDelete: "cascade" }),
    state: flashcardStateEnum("state").notNull().default("new"),
    due: timestamp("due", { withTimezone: true }).notNull().defaultNow(),
    /** FSRS stability (days) and difficulty (1–10). */
    stability: real("stability").notNull().default(0),
    difficulty: real("difficulty").notNull().default(0),
    elapsedDays: integer("elapsed_days").notNull().default(0),
    scheduledDays: integer("scheduled_days").notNull().default(0),
    reps: integer("reps").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    lastReview: timestamp("last_review", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.cardId] }),
    index("flashcard_reviews_user_due_idx").on(t.userId, t.due),
  ],
);

/**
 * Append-only review log. Enables reschedule/rollback and analytics without
 * touching the current-state row.
 */
export const flashcardReviewLogs = pgTable(
  "flashcard_review_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    cardId: uuid("card_id")
      .notNull()
      .references(() => flashcards.id, { onDelete: "cascade" }),
    /** ts-fsrs Rating: 1=Again 2=Hard 3=Good 4=Easy. */
    rating: smallint("rating").notNull(),
    state: flashcardStateEnum("state").notNull(),
    due: timestamp("due", { withTimezone: true }).notNull(),
    stability: real("stability").notNull().default(0),
    difficulty: real("difficulty").notNull().default(0),
    elapsedDays: integer("elapsed_days").notNull().default(0),
    lastElapsedDays: integer("last_elapsed_days").notNull().default(0),
    scheduledDays: integer("scheduled_days").notNull().default(0),
    durationMs: integer("duration_ms"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("flashcard_review_logs_user_reviewed_idx").on(t.userId, t.reviewedAt)],
);

/* ────────────────────────────────────────────────────────────────────────────
 * Admin AI agent
 * ──────────────────────────────────────────────────────────────────────────── */

export const agentSessions = pgTable(
  "agent_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New session"),
    status: agentSessionStatusEnum("status").notNull().default("active"),
    model: text("model"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("agent_sessions_user_idx").on(t.userId, t.createdAt)],
);

export const agentMessages = pgTable(
  "agent_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => agentSessions.id, { onDelete: "cascade" }),
    role: agentMessageRoleEnum("role").notNull(),
    content: text("content").notNull().default(""),
    toolCalls: jsonb("tool_calls").$type<AgentToolCall[]>(),
    toolCallId: text("tool_call_id"),
    toolName: text("tool_name"),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("agent_messages_session_idx").on(t.sessionId, t.createdAt)],
);

/* ────────────────────────────────────────────────────────────────────────────
 * Notifications & audit
 * ──────────────────────────────────────────────────────────────────────────── */

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull().default("system"),
    title: text("title").notNull(),
    body: text("body"),
    url: text("url"),
    metadata: jsonb("metadata").$type<NotificationMetadata>(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("notifications_user_created_idx").on(t.userId, t.createdAt)],
);

/** Every privileged action, including every agent tool call. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Null actor = the system. */
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorIp: inet("actor_ip"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    before: jsonb("before").$type<Record<string, unknown>>(),
    after: jsonb("after").$type<Record<string, unknown>>(),
    metadata: jsonb("metadata").$type<AuditMetadata>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("audit_log_actor_created_idx").on(t.actorUserId, t.createdAt),
    index("audit_log_action_created_idx").on(t.action, t.createdAt),
    index("audit_log_target_idx").on(t.targetType, t.targetId),
  ],
);

/* ────────────────────────────────────────────────────────────────────────────
 * Inferred types
 * ──────────────────────────────────────────────────────────────────────────── */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type BirthProfile = typeof birthProfiles.$inferSelect;
export type NewBirthProfile = typeof birthProfiles.$inferInsert;

export type MembershipApplication = typeof membershipApplications.$inferSelect;
export type NewMembershipApplication =
  typeof membershipApplications.$inferInsert;

export type Tier = typeof tiers.$inferSelect;
export type NewTier = typeof tiers.$inferInsert;

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;

export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;

export type Channel = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;

export type ChannelMember = typeof channelMembers.$inferSelect;
export type NewChannelMember = typeof channelMembers.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export type DirectThread = typeof directThreads.$inferSelect;
export type NewDirectThread = typeof directThreads.$inferInsert;

export type DirectThreadParticipant =
  typeof directThreadParticipants.$inferSelect;
export type NewDirectThreadParticipant =
  typeof directThreadParticipants.$inferInsert;

export type DirectMessage = typeof directMessages.$inferSelect;
export type NewDirectMessage = typeof directMessages.$inferInsert;

export type LiveCall = typeof liveCalls.$inferSelect;
export type NewLiveCall = typeof liveCalls.$inferInsert;

export type CallRsvp = typeof callRsvps.$inferSelect;
export type NewCallRsvp = typeof callRsvps.$inferInsert;

export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;

export type Lesson = typeof lessons.$inferSelect;
export type NewLesson = typeof lessons.$inferInsert;

export type LessonProgress = typeof lessonProgress.$inferSelect;
export type NewLessonProgress = typeof lessonProgress.$inferInsert;

export type FlashcardDeck = typeof flashcardDecks.$inferSelect;
export type NewFlashcardDeck = typeof flashcardDecks.$inferInsert;

export type Flashcard = typeof flashcards.$inferSelect;
export type NewFlashcard = typeof flashcards.$inferInsert;

export type FlashcardReview = typeof flashcardReviews.$inferSelect;
export type NewFlashcardReview = typeof flashcardReviews.$inferInsert;

export type FlashcardReviewLog = typeof flashcardReviewLogs.$inferSelect;
export type NewFlashcardReviewLog = typeof flashcardReviewLogs.$inferInsert;

export type AgentSession = typeof agentSessions.$inferSelect;
export type NewAgentSession = typeof agentSessions.$inferInsert;

export type AgentMessage = typeof agentMessages.$inferSelect;
export type NewAgentMessage = typeof agentMessages.$inferInsert;

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;

/** Literal unions derived from the enums, for use in application code. */
export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type MembershipStatus = (typeof membershipStatusEnum.enumValues)[number];
export type TierKey = (typeof tierEnum.enumValues)[number];
export type ApplicationStatus = (typeof applicationStatusEnum.enumValues)[number];
export type SubscriptionStatus =
  (typeof subscriptionStatusEnum.enumValues)[number];
export type InvoiceStatus = (typeof invoiceStatusEnum.enumValues)[number];
export type ChannelKind = (typeof channelKindEnum.enumValues)[number];
export type LiveCallStatus = (typeof liveCallStatusEnum.enumValues)[number];
export type RsvpStatus = (typeof rsvpStatusEnum.enumValues)[number];
export type LessonProgressStatus =
  (typeof lessonProgressStatusEnum.enumValues)[number];
export type FlashcardState = (typeof flashcardStateEnum.enumValues)[number];
export type AgentSessionStatus =
  (typeof agentSessionStatusEnum.enumValues)[number];
export type AgentMessageRole = (typeof agentMessageRoleEnum.enumValues)[number];
export type NotificationType = (typeof notificationTypeEnum.enumValues)[number];

/* ────────────────────────────────────────────────────────────────────────────
 * Seed data
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * The canonical four tiers. Kept as data (not just an enum) so the MemoryStore
 * fallback and any SQL seed script agree, and so prices live in one place.
 * `stripePriceId` is filled in from the environment / Stripe dashboard — never
 * hard-code a price in application code.
 */
export const TIER_SEED: readonly NewTier[] = [
  {
    key: "free",
    name: "Threshold",
    description:
      "The door, open. Your full chart and bodygraph, your Aura Avatar, and one foundation course.",
    monthlyPriceCents: 0,
    currency: "usd",
    features: ["community.read", "flashcards.limit", "courses.free"],
    displayOrder: 0,
  },
  {
    key: "initiate",
    name: "Initiate",
    description:
      "The base membership at $15/month: the experiment track, the collective, the weekly call.",
    monthlyPriceCents: 1500,
    currency: "usd",
    features: [
      "community.post",
      "dm.access",
      "livecalls.access",
      "courses.all",
      "flashcards.unlimited",
    ],
    displayOrder: 1,
  },
  {
    key: "adept",
    name: "Adept",
    description:
      "Everything in Initiate, plus the transmission track, synastry and transit tracking.",
    monthlyPriceCents: 2900,
    currency: "usd",
    features: [
      "community.post",
      "dm.access",
      "livecalls.access",
      "livecalls.recordings",
      "courses.all",
      "flashcards.unlimited",
      "readings.extended",
    ],
    displayOrder: 2,
  },
  {
    key: "oracle",
    name: "Oracle",
    description:
      "The room where it is built: reading circles, a direct studio line, early access.",
    monthlyPriceCents: 5900,
    currency: "usd",
    features: [
      "community.post",
      "dm.access",
      "livecalls.access",
      "livecalls.recordings",
      "courses.all",
      "flashcards.unlimited",
      "readings.extended",
      "coaching.1on1",
      "earlyaccess.all",
    ],
    displayOrder: 3,
  },
];
