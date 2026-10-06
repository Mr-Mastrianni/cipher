/**
 * The Cipher — repository layer.
 *
 * One `Store` interface, two implementations:
 *
 *  - `PostgresStore` — Drizzle-backed, constructed only when `DATABASE_URL` is
 *    present (see `./client.ts`). This is the production implementation.
 *  - `MemoryStore` — process-local, Map-backed. It is the fallback used when no
 *    database is configured so the app still runs end-to-end (local dev,
 *    `next build`, preview demos).
 *
 * `getStore()` picks the implementation once per process and returns it.
 *
 * ⚠️ MemoryStore is NOT durable and NOT shared: it lives in a single Node/Vercel
 * instance's memory, is reset on every cold start, and two concurrent requests
 * landing on different instances see different data. It exists only so the site
 * demonstrates every feature without secrets. Never treat it as a database.
 */

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";


import { db, isDatabaseConfigured, type Database } from "./client";
import {
  agentMessages,
  agentSessions,
  auditLog,
  birthProfiles,
  callRsvps,
  channels,
  courses,
  directMessages,
  directThreads,
  flashcardDecks,
  flashcardReviews,
  flashcards,
  lessonProgress,
  lessons,
  liveCalls,
  membershipApplications,
  messages,
  notifications,
  savedLocations,
  TIER_SEED,
  tiers,
  users,
  type AgentMessage,
  type AgentMessageRole,
  type AgentSession,
  type AgentToolCall,
  type ApplicationAnswers,
  type ApplicationStatus,
  type AuditLogEntry,
  type BirthProfile,
  type Bodygraph,
  type CallRsvp,
  type Channel,
  type ChannelKind,
  type Course,
  type DirectMessage,
  type DirectThread,
  type Flashcard,
  type FlashcardDeck,
  type FlashcardReview,
  type FlashcardState,
  type Lesson,
  type LessonProgress,
  type LiveCall,
  type MembershipApplication,
  type MembershipStatus,
  type Message,
  type MessageAttachment,
  type Notification as NotificationRow,
  type SavedLocation,
  type NotificationMetadata,
  type NotificationType,
  type OnboardingAnswers,
  type RsvpStatus,
  type Tier,
  type TierKey,
  type User,
  type UserRole,
} from "./schema";

/* ────────────────────────────────────────────────────────────────────────────
 * Query / write shapes
 * ──────────────────────────────────────────────────────────────────────────── */

/** Offset pagination request. */
export interface Pagination {
  /** 1-based page number. Defaults to 1. */
  page?: number;
  /** Rows per page. Defaults to 20. */
  pageSize?: number;
}

/** Offset pagination result. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Cursor pagination request for append-only message streams. */
export interface CursorQuery {
  /** Opaque cursor from a previous page's `nextCursor`. */
  cursor?: string;
  /** Max rows to return. Defaults to 50. */
  limit?: number;
}

/** Cursor pagination result. `nextCursor` is null on the last page. */
export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

/** Filters accepted by `Store.listUsers`. */
export interface ListUsersFilters extends Pagination {
  role?: UserRole;
  membershipStatus?: MembershipStatus;
  tier?: TierKey;
  /** Case-insensitive match against name and email. */
  search?: string;
}

/** Writable `users` columns (everything except identity and timestamps). */
export interface UserWritableFields {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  imageUrl?: string | null;
  bio?: string | null;
  pronouns?: string | null;
  location?: string | null;
  timezone?: string | null;
  role?: UserRole;
  membershipStatus?: MembershipStatus;
  tier?: TierKey;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  subscriptionStatus?: string | null;
  currentPeriodEnd?: Date | null;
  onboardingCompletedAt?: Date | null;
  lastSeenAt?: Date | null;
  /** Clerk `updated_at`; used to ignore out-of-order webhook deliveries. */
  clerkUpdatedAt?: Date | null;
}

/** Input for `Store.upsertUser` (Clerk webhook projection). */
export type UpsertUserInput = UserWritableFields & { clerkUserId: string };

/** Input for `Store.updateUser`. */
export type UpdateUserInput = UserWritableFields & { deletedAt?: Date | null };

/** Input for `Store.createApplication`. */
export interface CreateApplicationInput {
  userId: string;
  answers: ApplicationAnswers;
}

/** Input for `Store.upsertBirthProfile`. */
export interface UpsertBirthProfileInput {
  userId: string;
  birthDate: string;
  birthTime: string;
  birthTimeZone: string;
  birthLatitude: number;
  birthLongitude: number;
  birthPlaceName?: string | null;
  kpChart?: Record<string, unknown> | null;
  bodygraph?: Bodygraph | null;
  auraSeat?: string;
  auraFormat?: string;
  auraLabel?: string;
  strengths?: string[];
  weaknesses?: string[];
  onboardingAnswers?: OnboardingAnswers | null;
}

/** Input for `Store.createChannel`. */
export interface CreateChannelInput {
  slug: string;
  name: string;
  description?: string | null;
  kind?: ChannelKind;
  tierRequired?: TierKey | null;
}

/** Input for `Store.createMessage`. */
export interface CreateMessageInput {
  channelId: string;
  authorId: string;
  body: string;
  attachments?: MessageAttachment[];
  replyToId?: string | null;
}

/** Input for `Store.createDirectMessage`. */
export interface CreateDirectMessageInput {
  threadId: string;
  authorId: string;
  body: string;
  attachments?: MessageAttachment[];
  replyToId?: string | null;
}

/** Input for `Store.createCall`. */
export interface CreateCallInput {
  title: string;
  slug?: string;
  description?: string | null;
  startsAt: Date;
  durationMinutes?: number;
  roomUrl?: string | null;
  hostId?: string | null;
  tierRequired?: TierKey | null;
  recurring?: boolean;
  recurrenceDay?: number | null;
  recurrenceTime?: string | null;
  recurrenceTz?: string | null;
  recurrenceRule?: string | null;
}

/** Input for `Store.createCourse` (course plus optional nested lessons). */
export interface CreateCourseInput {
  slug: string;
  title: string;
  summary?: string | null;
  description?: string | null;
  coverImageUrl?: string | null;
  tierRequired?: TierKey;
  sortOrder?: number;
  publishedAt?: Date | null;
  lessons?: CreateLessonInput[];
}

/** Input for a single lesson nested inside `CreateCourseInput`. */
export interface CreateLessonInput {
  slug: string;
  title: string;
  summary?: string | null;
  contentMdx?: string | null;
  contentJson?: Record<string, unknown> | null;
  videoUrl?: string | null;
  durationSeconds?: number;
  sortOrder?: number;
  tierRequired?: TierKey;
  publishedAt?: Date | null;
}

/** Input for `Store.createFlashcardDeck`. */
export interface CreateFlashcardDeckInput {
  slug: string;
  title: string;
  description?: string | null;
  ownerUserId?: string | null;
  tierRequired?: TierKey;
  cards?: CreateFlashcardInput[];
}

/** Input for a single card nested inside `CreateFlashcardDeckInput`. */
export interface CreateFlashcardInput {
  front: string;
  back: string;
  tags?: string[];
  sortOrder?: number;
  createdById?: string | null;
}

/** Input for `Store.upsertFlashcardReview` (FSRS memory state). */
export interface UpsertFlashcardReviewInput {
  userId: string;
  cardId: string;
  state: FlashcardState;
  due: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  lastReview: Date;
}

/** A card in the study queue, paired with the user's FSRS state (or null if new). */
export interface DueFlashcard {
  card: Flashcard;
  review: FlashcardReview | null;
}

/** Input for `Store.appendAgentMessage`. */
export interface AppendAgentMessageInput {
  sessionId: string;
  role: AgentMessageRole;
  content: string;
  toolCalls?: AgentToolCall[] | null;
  toolCallId?: string | null;
  toolName?: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
}

/** Input for `Store.createSavedLocation`. */
export interface CreateSavedLocationInput {
  userId: string;
  name: string;
  latitude: number;
  longitude: number;
  note?: string | null;
  snapshot?: Record<string, unknown> | null;
}

/** Input for `Store.createNotification`. */
export interface CreateNotificationInput {
  userId: string;
  title: string;
  type?: NotificationType;
  body?: string | null;
  url?: string | null;
  metadata?: NotificationMetadata | null;
}

/** Input for `Store.recordAuditLog`. */
export interface RecordAuditLogInput {
  actorUserId?: string | null;
  actorIp?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

/** A course with its lessons attached. */
export type CourseWithLessons = Course & { lessons: Lesson[] };

/** A deck with its cards attached. */
export type FlashcardDeckWithCards = FlashcardDeck & { cards: Flashcard[] };

/* ────────────────────────────────────────────────────────────────────────────
 * The interface
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * The single repository interface every backing store implements.
 *
 * Both `MemoryStore` and `PostgresStore` are declared `implements Store`, so the
 * compiler proves parity: a method added here will not typecheck until both
 * implementations provide it.
 */
export interface Store {
  // ── Tiers ────────────────────────────────────────────────────────────────
  /** The billing tiers in display order (the `tiers` reference table). */
  listTiers(): Promise<Tier[]>;

  // ── Users ────────────────────────────────────────────────────────────────
  /** Look up a user by their Clerk id (`user_…`). */
  getUserByClerkId(clerkUserId: string): Promise<User | null>;
  /** Look up a user by the local uuid. */
  getUserById(id: string): Promise<User | null>;
  /** Look up a user by Stripe customer id (billing webhooks). */
  getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | null>;
  /**
   * Insert or update the local projection of a Clerk user. Late/out-of-order
   * webhook deliveries are ignored by comparing `clerkUpdatedAt`.
   */
  upsertUser(input: UpsertUserInput): Promise<User>;
  /** Patch a user's role / membership status / tier / profile fields. */
  updateUser(id: string, patch: UpdateUserInput): Promise<User | null>;
  /** Filtered, offset-paginated user list (admin members table). */
  listUsers(filters?: ListUsersFilters): Promise<Paginated<User>>;

  // ── Membership applications ──────────────────────────────────────────────
  /** Submit a new membership application. */
  createApplication(
    input: CreateApplicationInput,
  ): Promise<MembershipApplication>;
  /** The most recent application for a user, if any. */
  getApplicationByUser(userId: string): Promise<MembershipApplication | null>;
  /** List applications, newest first, optionally filtered by status. */
  listApplications(
    status?: ApplicationStatus,
  ): Promise<MembershipApplication[]>;
  /** Approve an application and mirror `approved` onto the user. */
  approveApplication(
    id: string,
    reviewerId: string,
    decisionNote?: string | null,
  ): Promise<MembershipApplication | null>;
  /** Deny an application and mirror `denied` onto the user. */
  denyApplication(
    id: string,
    reviewerId: string,
    decisionNote?: string | null,
  ): Promise<MembershipApplication | null>;

  // ── Birth profiles ───────────────────────────────────────────────────────
  /** Insert or replace a user's birth profile, chart, bodygraph, and avatar. */
  upsertBirthProfile(input: UpsertBirthProfileInput): Promise<BirthProfile>;
  /** A user's birth profile, if onboarding has produced one. */
  getBirthProfileByUser(userId: string): Promise<BirthProfile | null>;

  // ── Channels & messages ──────────────────────────────────────────────────
  /** All channels, oldest first. */
  listChannels(): Promise<Channel[]>;
  /** A channel by uuid. */
  getChannelById(id: string): Promise<Channel | null>;
  /** A channel by URL slug. */
  getChannelBySlug(slug: string): Promise<Channel | null>;
  /** Create a channel. */
  createChannel(input: CreateChannelInput): Promise<Channel>;
  /** Newest-first cursor page of a channel's messages. */
  listMessages(channelId: string, query?: CursorQuery): Promise<CursorPage<Message>>;
  /** Post a message to a channel. */
  createMessage(input: CreateMessageInput): Promise<Message>;
  /**
   * Edit a message body. When `editorId` is supplied, only the author may edit
   * and a non-author edit resolves to `null`.
   */
  editMessage(
    messageId: string,
    body: string,
    editorId?: string,
  ): Promise<Message | null>;
  /** Soft-delete a message (keeps the row, sets `deletedAt`). */
  softDeleteMessage(messageId: string): Promise<boolean>;

  // ── Direct messages ──────────────────────────────────────────────────────
  /** Find the canonical DM thread between two users, creating it if needed. */
  findOrCreateDirectThread(
    userIdA: string,
    userIdB: string,
  ): Promise<DirectThread>;
  /** A thread by uuid. */
  getDirectThreadById(id: string): Promise<DirectThread | null>;
  /** Every DM thread a user participates in, most recently active first. */
  listDirectThreadsForUser(userId: string): Promise<DirectThread[]>;
  /** Newest-first cursor page of a thread's messages. */
  listDirectMessages(
    threadId: string,
    query?: CursorQuery,
  ): Promise<CursorPage<DirectMessage>>;
  /** Send a DM (also bumps the thread's `lastMessageAt`). */
  createDirectMessage(input: CreateDirectMessageInput): Promise<DirectMessage>;
  /** Edit a DM body; non-author edits resolve to `null`. */
  editDirectMessage(
    messageId: string,
    body: string,
    editorId?: string,
  ): Promise<DirectMessage | null>;
  /** Soft-delete a DM. */
  softDeleteDirectMessage(messageId: string): Promise<boolean>;

  // ── Live calls ───────────────────────────────────────────────────────────
  /** Scheduled (non-canceled) calls starting now or later, soonest first. */
  listUpcomingCalls(limit?: number): Promise<LiveCall[]>;
  /** Ended/past calls, most recent first. */
  listPastCalls(limit?: number): Promise<LiveCall[]>;
  /** A call by uuid. */
  getCallById(id: string): Promise<LiveCall | null>;
  /** A call by slug. */
  getCallBySlug(slug: string): Promise<LiveCall | null>;
  /** Schedule a call. */
  createCall(input: CreateCallInput): Promise<LiveCall>;
  /** Create or update a user's RSVP to a call. */
  rsvpCall(
    callId: string,
    userId: string,
    status: RsvpStatus,
  ): Promise<CallRsvp>;
  /** All RSVPs for a call. */
  listRsvps(callId: string): Promise<CallRsvp[]>;

  // ── Courses & lessons ────────────────────────────────────────────────────
  /** All courses in display order. */
  listCourses(): Promise<Course[]>;
  /** A course (by uuid or slug) with its lessons in order. */
  getCourseWithLessons(idOrSlug: string): Promise<CourseWithLessons | null>;
  /** Create a course, optionally with nested lessons. */
  createCourse(input: CreateCourseInput): Promise<CourseWithLessons>;
  /** A user's lesson progress rows. */
  getLessonProgressForUser(userId: string): Promise<LessonProgress[]>;
  /** Mark a lesson complete (or partially complete) for a user. */
  markLessonComplete(
    userId: string,
    lessonId: string,
    progressPct?: number,
  ): Promise<LessonProgress>;

  // ── Flashcards ───────────────────────────────────────────────────────────
  /** All decks. */
  listFlashcardDecks(): Promise<FlashcardDeck[]>;
  /** A deck (by uuid or slug) with its cards in order. */
  getDeckWithCards(idOrSlug: string): Promise<FlashcardDeckWithCards | null>;
  /** Cards due for review now, earliest due first (new cards have no state). */
  getDueFlashcards(
    userId: string,
    deckId?: string,
    limit?: number,
  ): Promise<DueFlashcard[]>;
  /** Insert or replace the FSRS memory state for a (user, card) pair. */
  upsertFlashcardReview(
    input: UpsertFlashcardReviewInput,
  ): Promise<FlashcardReview>;
  /** Create a deck, optionally with nested cards. */
  createFlashcardDeck(
    input: CreateFlashcardDeckInput,
  ): Promise<FlashcardDeckWithCards>;

  // ── Admin AI agent ───────────────────────────────────────────────────────
  /** Open a new agent session. */
  createAgentSession(input: {
    userId: string;
    title?: string;
    model?: string | null;
  }): Promise<AgentSession>;
  /** A session by uuid. */
  getAgentSession(id: string): Promise<AgentSession | null>;
  /** A user's sessions, newest first. */
  listAgentSessions(userId: string): Promise<AgentSession[]>;
  /** Append a turn (user, assistant, tool) to a session. */
  appendAgentMessage(input: AppendAgentMessageInput): Promise<AgentMessage>;
  /** A session's messages in order. */
  listAgentMessages(sessionId: string, limit?: number): Promise<AgentMessage[]>;

  // ── Saved locations ──────────────────────────────────────────────────────
  /** A member's saved places, newest first. */
  listSavedLocations(userId: string): Promise<SavedLocation[]>;
  /** Save a place. */
  createSavedLocation(input: CreateSavedLocationInput): Promise<SavedLocation>;
  /** Delete a saved place; only the owner's row is touched. Returns false when absent. */
  deleteSavedLocation(id: string, userId: string): Promise<boolean>;

  // ── Notifications ────────────────────────────────────────────────────────
  /** A user's notifications, newest first. */
  listNotifications(userId: string, limit?: number): Promise<NotificationRow[]>;
  /** Create a notification. */
  createNotification(
    input: CreateNotificationInput,
  ): Promise<NotificationRow>;
  /** Mark one notification read. */
  markNotificationRead(id: string): Promise<NotificationRow | null>;

  // ── Audit ────────────────────────────────────────────────────────────────
  /** Record a privileged action (including every agent tool call). */
  recordAuditLog(input: RecordAuditLogInput): Promise<AuditLogEntry>;
  /** Recent audit entries, newest first. */
  listAuditLog(limit?: number): Promise<AuditLogEntry[]>;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────────────────────── */

/** Generate a v4 uuid using the platform crypto API. */
function newId(): string {
  return crypto.randomUUID();
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether a string is a uuid (so it is safe to compare against a uuid column). */
function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Slugify a free-text title, appending a short random suffix for uniqueness. */
function toSlug(value: string): string {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const suffix = newId().slice(0, 8);
  return base.length > 0 ? `${base}-${suffix}` : suffix;
}

/** Encode the `(createdAt, id)` keyset cursor used by message streams. */
function encodeCursor(row: { createdAt: Date; id: string }): string {
  return `${row.createdAt.toISOString()}|${row.id}`;
}

/** Decode a cursor produced by `encodeCursor`. */
function decodeCursor(
  cursor?: string,
): { createdAt: Date; id: string } | null {
  if (!cursor) return null;
  const [at, id] = cursor.split("|");
  if (!at || !id) return null;
  const createdAt = new Date(at);
  if (Number.isNaN(createdAt.getTime())) return null;
  return { createdAt, id };
}

/** In-memory offset pagination helper. */
function paginate<T>(items: T[], page = 1, pageSize = 20): Paginated<T> {
  const safePage = Math.max(1, Math.floor(page));
  const safeSize = Math.max(1, Math.floor(pageSize));
  const total = items.length;
  const start = (safePage - 1) * safeSize;
  return {
    items: items.slice(start, start + safeSize),
    total,
    page: safePage,
    pageSize: safeSize,
    totalPages: Math.max(1, Math.ceil(total / safeSize)),
  };
}

/** Newest-first keyset filter, shared by both message stores. */
function isAfterCursor(
  row: { createdAt: Date; id: string },
  cursor: { createdAt: Date; id: string },
): boolean {
  const rowTime = row.createdAt.getTime();
  const cursorTime = cursor.createdAt.getTime();
  if (rowTime !== cursorTime) return rowTime < cursorTime;
  return row.id < cursor.id;
}

/** A date `days` in the past. */
function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

/** A date `days` in the future. */
function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}

/** The next occurrence of a weekday (0–6) at a UTC hour. */
function nextWeekdayAt(weekday: number, hourUtc: number): Date {
  const date = new Date();
  date.setUTCHours(hourUtc, 0, 0, 0);
  const delta = (weekday - date.getUTCDay() + 7) % 7;
  date.setUTCDate(date.getUTCDate() + delta);
  if (date.getTime() <= Date.now()) {
    date.setUTCDate(date.getUTCDate() + 7);
  }
  return date;
}

/* ────────────────────────────────────────────────────────────────────────────
 * MemoryStore
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * ⚠️ DEVELOPMENT / DEMO FALLBACK ONLY — NOT A DATABASE.
 *
 * Process-local and non-durable: data lives in Maps inside a single Node
 * instance. It disappears on cold start, is not shared between serverless
 * instances or between `next dev` workers, and has no concurrency control.
 *
 * It is seeded with a demo admin, a demo member with an approved application,
 * a pending applicant, two public channels with messages, three courses with
 * lessons, a flashcard deck with a due review, and an upcoming weekly call so
 * the deployed site can demonstrate every feature with no secrets.
 */
export class MemoryStore implements Store {
  private readonly users = new Map<string, User>();
  private readonly userIdByClerkId = new Map<string, string>();
  private readonly profiles = new Map<string, BirthProfile>();
  private readonly applications = new Map<string, MembershipApplication>();
  private readonly tiers = new Map<TierKey, Tier>();
  private readonly channels = new Map<string, Channel>();
  private readonly messages = new Map<string, Message>();
  private readonly threads = new Map<string, DirectThread>();
  private readonly dms = new Map<string, DirectMessage>();
  private readonly calls = new Map<string, LiveCall>();
  private readonly rsvps = new Map<string, CallRsvp>();
  private readonly courses = new Map<string, Course>();
  private readonly lessons = new Map<string, Lesson>();
  private readonly progress = new Map<string, LessonProgress>();
  private readonly decks = new Map<string, FlashcardDeck>();
  private readonly cards = new Map<string, Flashcard>();
  private readonly reviews = new Map<string, FlashcardReview>();
  private readonly sessions = new Map<string, AgentSession>();
  private readonly agentMsgs = new Map<string, AgentMessage>();
  private readonly notifications = new Map<string, NotificationRow>();
  private readonly savedLocations = new Map<string, SavedLocation>();
  private readonly auditEntries: AuditLogEntry[] = [];

  constructor() {
    this.seed();
  }

  /* ── Tiers ──────────────────────────────────────────────────────────────── */

  /** {@inheritDoc Store.listTiers} */
  async listTiers(): Promise<Tier[]> {
    return [...this.tiers.values()].sort(
      (a, b) => a.displayOrder - b.displayOrder,
    );
  }

  /* ── Users ──────────────────────────────────────────────────────────────── */

  /** {@inheritDoc Store.getUserByClerkId} */
  async getUserByClerkId(clerkUserId: string): Promise<User | null> {
    const id = this.userIdByClerkId.get(clerkUserId);
    return id ? (this.users.get(id) ?? null) : null;
  }

  /** {@inheritDoc Store.getUserById} */
  async getUserById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  /** {@inheritDoc Store.getUserByStripeCustomerId} */
  async getUserByStripeCustomerId(
    stripeCustomerId: string,
  ): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.stripeCustomerId === stripeCustomerId) return user;
    }
    return null;
  }

  /** {@inheritDoc Store.upsertUser} */
  async upsertUser(input: UpsertUserInput): Promise<User> {
    const existing = await this.getUserByClerkId(input.clerkUserId);
    if (existing) {
      // Ignore a stale Clerk delivery: an older `updated_at` must not win.
      if (
        input.clerkUpdatedAt &&
        existing.clerkUpdatedAt &&
        input.clerkUpdatedAt.getTime() < existing.clerkUpdatedAt.getTime()
      ) {
        return existing;
      }
      const updated = this.applyUserPatch(existing, input);
      return updated;
    }
    const now = new Date();
    const user: User = {
      id: newId(),
      clerkUserId: input.clerkUserId,
      email: null,
      firstName: null,
      lastName: null,
      displayName: null,
      imageUrl: null,
      bio: null,
      pronouns: null,
      location: null,
      timezone: null,
      role: "member",
      membershipStatus: "none",
      tier: "free",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      subscriptionStatus: null,
      currentPeriodEnd: null,
      onboardingCompletedAt: null,
      lastSeenAt: null,
      clerkUpdatedAt: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    Object.assign(user, this.userPatchValues(input));
    this.users.set(user.id, user);
    this.userIdByClerkId.set(user.clerkUserId, user.id);
    return user;
  }

  /** {@inheritDoc Store.updateUser} */
  async updateUser(id: string, patch: UpdateUserInput): Promise<User | null> {
    const existing = this.users.get(id);
    if (!existing) return null;
    return this.applyUserPatch(existing, patch);
  }

  /** {@inheritDoc Store.listUsers} */
  async listUsers(filters: ListUsersFilters = {}): Promise<Paginated<User>> {
    const search = filters.search?.trim().toLowerCase();
    const rows = [...this.users.values()]
      .filter((u) => (filters.role ? u.role === filters.role : true))
      .filter((u) =>
        filters.membershipStatus
          ? u.membershipStatus === filters.membershipStatus
          : true,
      )
      .filter((u) => (filters.tier ? u.tier === filters.tier : true))
      .filter((u) => {
        if (!search) return true;
        return [u.email, u.firstName, u.lastName, u.displayName]
          .filter((v): v is string => typeof v === "string")
          .some((v) => v.toLowerCase().includes(search));
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return paginate(rows, filters.page, filters.pageSize);
  }

  /* ── Applications ───────────────────────────────────────────────────────── */

  /** {@inheritDoc Store.createApplication} */
  async createApplication(
    input: CreateApplicationInput,
  ): Promise<MembershipApplication> {
    const now = new Date();
    const application: MembershipApplication = {
      id: newId(),
      userId: input.userId,
      status: "pending",
      answers: input.answers,
      reviewedById: null,
      reviewedAt: null,
      decisionNote: null,
      createdAt: now,
      updatedAt: now,
    };
    this.applications.set(application.id, application);
    const user = this.users.get(input.userId);
    if (user) this.applyUserPatch(user, { membershipStatus: "pending" });
    return application;
  }

  /** {@inheritDoc Store.getApplicationByUser} */
  async getApplicationByUser(
    userId: string,
  ): Promise<MembershipApplication | null> {
    const rows = [...this.applications.values()]
      .filter((a) => a.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return rows[0] ?? null;
  }

  /** {@inheritDoc Store.listApplications} */
  async listApplications(
    status?: ApplicationStatus,
  ): Promise<MembershipApplication[]> {
    return [...this.applications.values()]
      .filter((a) => (status ? a.status === status : true))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /** {@inheritDoc Store.approveApplication} */
  async approveApplication(
    id: string,
    reviewerId: string,
    decisionNote?: string | null,
  ): Promise<MembershipApplication | null> {
    return this.decideApplication(id, "approved", reviewerId, decisionNote);
  }

  /** {@inheritDoc Store.denyApplication} */
  async denyApplication(
    id: string,
    reviewerId: string,
    decisionNote?: string | null,
  ): Promise<MembershipApplication | null> {
    return this.decideApplication(id, "denied", reviewerId, decisionNote);
  }

  private decideApplication(
    id: string,
    decision: "approved" | "denied",
    reviewerId: string,
    decisionNote?: string | null,
  ): MembershipApplication | null {
    const application = this.applications.get(id);
    if (!application) return null;
    application.status = decision;
    application.reviewedById = reviewerId;
    application.reviewedAt = new Date();
    application.decisionNote = decisionNote ?? null;
    application.updatedAt = new Date();
    const user = this.users.get(application.userId);
    if (user) this.applyUserPatch(user, { membershipStatus: decision });
    return application;
  }

  /* ── Birth profiles ─────────────────────────────────────────────────────── */

  /** {@inheritDoc Store.upsertBirthProfile} */
  async upsertBirthProfile(
    input: UpsertBirthProfileInput,
  ): Promise<BirthProfile> {
    const existing = this.profiles.get(input.userId);
    const now = new Date();
    const profile: BirthProfile = {
      id: existing?.id ?? newId(),
      userId: input.userId,
      birthDate: input.birthDate,
      birthTime: input.birthTime,
      birthTimeZone: input.birthTimeZone,
      birthLatitude: input.birthLatitude,
      birthLongitude: input.birthLongitude,
      birthPlaceName: input.birthPlaceName ?? null,
      kpChart: input.kpChart ?? null,
      bodygraph: input.bodygraph ?? null,
      auraSeat: input.auraSeat ?? "",
      auraFormat: input.auraFormat ?? "",
      auraLabel: input.auraLabel ?? "",
      auraAvatar: null,
      strengths: input.strengths ?? [],
      weaknesses: input.weaknesses ?? [],
      onboardingAnswers: input.onboardingAnswers ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.profiles.set(input.userId, profile);
    return profile;
  }

  /** {@inheritDoc Store.getBirthProfileByUser} */
  async getBirthProfileByUser(userId: string): Promise<BirthProfile | null> {
    return this.profiles.get(userId) ?? null;
  }

  /* ── Channels & messages ────────────────────────────────────────────────── */

  /** {@inheritDoc Store.listChannels} */
  async listChannels(): Promise<Channel[]> {
    return [...this.channels.values()].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
  }

  /** {@inheritDoc Store.getChannelById} */
  async getChannelById(id: string): Promise<Channel | null> {
    return this.channels.get(id) ?? null;
  }

  /** {@inheritDoc Store.getChannelBySlug} */
  async getChannelBySlug(slug: string): Promise<Channel | null> {
    for (const channel of this.channels.values()) {
      if (channel.slug === slug) return channel;
    }
    return null;
  }

  /** {@inheritDoc Store.createChannel} */
  async createChannel(input: CreateChannelInput): Promise<Channel> {
    const now = new Date();
    const channel: Channel = {
      id: newId(),
      slug: input.slug,
      name: input.name,
      description: input.description ?? null,
      kind: input.kind ?? "public",
      tierRequired: input.tierRequired ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.channels.set(channel.id, channel);
    return channel;
  }

  /** {@inheritDoc Store.listMessages} */
  async listMessages(
    channelId: string,
    query: CursorQuery = {},
  ): Promise<CursorPage<Message>> {
    const limit = clampLimit(query.limit);
    const cursor = decodeCursor(query.cursor);
    const rows = [...this.messages.values()]
      .filter((m) => m.channelId === channelId)
      .filter((m) => (cursor ? isAfterCursor(m, cursor) : true))
      .sort(
        (a, b) =>
          b.createdAt.getTime() - a.createdAt.getTime() ||
          (a.id < b.id ? 1 : -1),
      )
      .slice(0, limit);
    const last = rows[rows.length - 1];
    return {
      items: rows,
      nextCursor: rows.length === limit && last ? encodeCursor(last) : null,
    };
  }

  /** {@inheritDoc Store.createMessage} */
  async createMessage(input: CreateMessageInput): Promise<Message> {
    const now = new Date();
    const message: Message = {
      id: newId(),
      channelId: input.channelId,
      authorId: input.authorId,
      body: input.body,
      attachments: input.attachments ?? [],
      replyToId: input.replyToId ?? null,
      editedAt: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.messages.set(message.id, message);
    return message;
  }

  /** {@inheritDoc Store.editMessage} */
  async editMessage(
    messageId: string,
    body: string,
    editorId?: string,
  ): Promise<Message | null> {
    const message = this.messages.get(messageId);
    if (!message || message.deletedAt) return null;
    if (editorId && message.authorId !== editorId) return null;
    message.body = body;
    message.editedAt = new Date();
    message.updatedAt = new Date();
    return message;
  }

  /** {@inheritDoc Store.softDeleteMessage} */
  async softDeleteMessage(messageId: string): Promise<boolean> {
    const message = this.messages.get(messageId);
    if (!message) return false;
    const now = new Date();
    message.deletedAt = now;
    message.updatedAt = now;
    return true;
  }

  /* ── Direct messages ────────────────────────────────────────────────────── */

  /** {@inheritDoc Store.findOrCreateDirectThread} */
  async findOrCreateDirectThread(
    userIdA: string,
    userIdB: string,
  ): Promise<DirectThread> {
    const [a, b] =
      userIdA < userIdB ? [userIdA, userIdB] : [userIdB, userIdA];
    for (const thread of this.threads.values()) {
      if (thread.userAId === a && thread.userBId === b) return thread;
    }
    const now = new Date();
    const thread: DirectThread = {
      id: newId(),
      userAId: a,
      userBId: b,
      lastMessageAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.threads.set(thread.id, thread);
    return thread;
  }

  /** {@inheritDoc Store.getDirectThreadById} */
  async getDirectThreadById(id: string): Promise<DirectThread | null> {
    return this.threads.get(id) ?? null;
  }

  /** {@inheritDoc Store.listDirectThreadsForUser} */
  async listDirectThreadsForUser(userId: string): Promise<DirectThread[]> {
    return [...this.threads.values()]
      .filter((t) => t.userAId === userId || t.userBId === userId)
      .sort(
        (a, b) =>
          (b.lastMessageAt ?? b.createdAt).getTime() -
          (a.lastMessageAt ?? a.createdAt).getTime(),
      );
  }

  /** {@inheritDoc Store.listDirectMessages} */
  async listDirectMessages(
    threadId: string,
    query: CursorQuery = {},
  ): Promise<CursorPage<DirectMessage>> {
    const limit = clampLimit(query.limit);
    const cursor = decodeCursor(query.cursor);
    const rows = [...this.dms.values()]
      .filter((m) => m.threadId === threadId)
      .filter((m) => (cursor ? isAfterCursor(m, cursor) : true))
      .sort(
        (a, b) =>
          b.createdAt.getTime() - a.createdAt.getTime() ||
          (a.id < b.id ? 1 : -1),
      )
      .slice(0, limit);
    const last = rows[rows.length - 1];
    return {
      items: rows,
      nextCursor: rows.length === limit && last ? encodeCursor(last) : null,
    };
  }

  /** {@inheritDoc Store.createDirectMessage} */
  async createDirectMessage(
    input: CreateDirectMessageInput,
  ): Promise<DirectMessage> {
    const now = new Date();
    const message: DirectMessage = {
      id: newId(),
      threadId: input.threadId,
      authorId: input.authorId,
      body: input.body,
      attachments: input.attachments ?? [],
      replyToId: input.replyToId ?? null,
      editedAt: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.dms.set(message.id, message);
    const thread = this.threads.get(input.threadId);
    if (thread) {
      thread.lastMessageAt = now;
      thread.updatedAt = now;
    }
    return message;
  }

  /** {@inheritDoc Store.editDirectMessage} */
  async editDirectMessage(
    messageId: string,
    body: string,
    editorId?: string,
  ): Promise<DirectMessage | null> {
    const message = this.dms.get(messageId);
    if (!message || message.deletedAt) return null;
    if (editorId && message.authorId !== editorId) return null;
    message.body = body;
    message.editedAt = new Date();
    message.updatedAt = new Date();
    return message;
  }

  /** {@inheritDoc Store.softDeleteDirectMessage} */
  async softDeleteDirectMessage(messageId: string): Promise<boolean> {
    const message = this.dms.get(messageId);
    if (!message) return false;
    const now = new Date();
    message.deletedAt = now;
    message.updatedAt = now;
    return true;
  }

  /* ── Live calls ─────────────────────────────────────────────────────────── */

  /** {@inheritDoc Store.listUpcomingCalls} */
  async listUpcomingCalls(limit = 20): Promise<LiveCall[]> {
    const now = Date.now();
    return [...this.calls.values()]
      .filter((c) => c.status !== "canceled" && c.startsAt.getTime() >= now)
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
      .slice(0, limit);
  }

  /** {@inheritDoc Store.listPastCalls} */
  async listPastCalls(limit = 20): Promise<LiveCall[]> {
    const now = Date.now();
    return [...this.calls.values()]
      .filter((c) => c.startsAt.getTime() < now)
      .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
      .slice(0, limit);
  }

  /** {@inheritDoc Store.getCallById} */
  async getCallById(id: string): Promise<LiveCall | null> {
    return this.calls.get(id) ?? null;
  }

  /** {@inheritDoc Store.getCallBySlug} */
  async getCallBySlug(slug: string): Promise<LiveCall | null> {
    for (const call of this.calls.values()) {
      if (call.slug === slug) return call;
    }
    return null;
  }

  /** {@inheritDoc Store.createCall} */
  async createCall(input: CreateCallInput): Promise<LiveCall> {
    const now = new Date();
    const call: LiveCall = {
      id: newId(),
      slug: input.slug ?? toSlug(input.title),
      title: input.title,
      description: input.description ?? null,
      hostId: input.hostId ?? null,
      startsAt: input.startsAt,
      durationMinutes: input.durationMinutes ?? 60,
      roomUrl: input.roomUrl ?? null,
      provider: "daily",
      providerRoomName: null,
      recordingUrl: null,
      status: "scheduled",
      tierRequired: input.tierRequired ?? null,
      recurring: input.recurring ?? false,
      recurrenceDay: input.recurrenceDay ?? null,
      recurrenceTime: input.recurrenceTime ?? null,
      recurrenceTz: input.recurrenceTz ?? null,
      recurrenceRule: input.recurrenceRule ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.calls.set(call.id, call);
    return call;
  }

  /** {@inheritDoc Store.rsvpCall} */
  async rsvpCall(
    callId: string,
    userId: string,
    status: RsvpStatus,
  ): Promise<CallRsvp> {
    const key = `${callId}:${userId}`;
    const existing = this.rsvps.get(key);
    const now = new Date();
    const rsvp: CallRsvp = {
      callId,
      userId,
      status,
      note: existing?.note ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.rsvps.set(key, rsvp);
    return rsvp;
  }

  /** {@inheritDoc Store.listRsvps} */
  async listRsvps(callId: string): Promise<CallRsvp[]> {
    return [...this.rsvps.values()].filter((r) => r.callId === callId);
  }

  /* ── Courses & lessons ──────────────────────────────────────────────────── */

  /** {@inheritDoc Store.listCourses} */
  async listCourses(): Promise<Course[]> {
    return [...this.courses.values()].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
  }

  /** {@inheritDoc Store.getCourseWithLessons} */
  async getCourseWithLessons(
    idOrSlug: string,
  ): Promise<CourseWithLessons | null> {
    const course =
      this.courses.get(idOrSlug) ??
      [...this.courses.values()].find((c) => c.slug === idOrSlug) ??
      null;
    if (!course) return null;
    const courseLessons = [...this.lessons.values()]
      .filter((l) => l.courseId === course.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return { ...course, lessons: courseLessons };
  }

  /** {@inheritDoc Store.createCourse} */
  async createCourse(input: CreateCourseInput): Promise<CourseWithLessons> {
    const now = new Date();
    const course: Course = {
      id: newId(),
      slug: input.slug,
      title: input.title,
      summary: input.summary ?? null,
      description: input.description ?? null,
      coverImageUrl: input.coverImageUrl ?? null,
      tierRequired: input.tierRequired ?? "free",
      sortOrder: input.sortOrder ?? this.courses.size,
      publishedAt: input.publishedAt ?? now,
      createdAt: now,
      updatedAt: now,
    };
    this.courses.set(course.id, course);
    const createdLessons = (input.lessons ?? []).map((lesson, index) =>
      this.insertLesson(course.id, lesson, index),
    );
    return { ...course, lessons: createdLessons };
  }

  private insertLesson(
    courseId: string,
    input: CreateLessonInput,
    index: number,
  ): Lesson {
    const now = new Date();
    const lesson: Lesson = {
      id: newId(),
      courseId,
      slug: input.slug,
      title: input.title,
      summary: input.summary ?? null,
      contentMdx: input.contentMdx ?? null,
      contentJson: input.contentJson ?? null,
      videoUrl: input.videoUrl ?? null,
      durationSeconds: input.durationSeconds ?? 0,
      sortOrder: input.sortOrder ?? index,
      tierRequired: input.tierRequired ?? "free",
      publishedAt: input.publishedAt ?? now,
      createdAt: now,
      updatedAt: now,
    };
    this.lessons.set(lesson.id, lesson);
    return lesson;
  }

  /** {@inheritDoc Store.getLessonProgressForUser} */
  async getLessonProgressForUser(userId: string): Promise<LessonProgress[]> {
    return [...this.progress.values()].filter((p) => p.userId === userId);
  }

  /** {@inheritDoc Store.markLessonComplete} */
  async markLessonComplete(
    userId: string,
    lessonId: string,
    progressPct = 100,
  ): Promise<LessonProgress> {
    const key = `${userId}:${lessonId}`;
    const existing = this.progress.get(key);
    const now = new Date();
    const pct = Math.max(0, Math.min(100, Math.round(progressPct)));
    const row: LessonProgress = {
      userId,
      lessonId,
      status: pct >= 100 ? "complete" : "in_progress",
      progressPct: pct,
      lastPositionSeconds: existing?.lastPositionSeconds ?? 0,
      completedAt: pct >= 100 ? (existing?.completedAt ?? now) : null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.progress.set(key, row);
    return row;
  }

  /* ── Flashcards ─────────────────────────────────────────────────────────── */

  /** {@inheritDoc Store.listFlashcardDecks} */
  async listFlashcardDecks(): Promise<FlashcardDeck[]> {
    return [...this.decks.values()].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
  }

  /** {@inheritDoc Store.getDeckWithCards} */
  async getDeckWithCards(
    idOrSlug: string,
  ): Promise<FlashcardDeckWithCards | null> {
    const deck =
      this.decks.get(idOrSlug) ??
      [...this.decks.values()].find((d) => d.slug === idOrSlug) ??
      null;
    if (!deck) return null;
    const deckCards = [...this.cards.values()]
      .filter((c) => c.deckId === deck.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return { ...deck, cards: deckCards };
  }

  /** {@inheritDoc Store.getDueFlashcards} */
  async getDueFlashcards(
    userId: string,
    deckId?: string,
    limit = 50,
  ): Promise<DueFlashcard[]> {
    const now = Date.now();
    return [...this.cards.values()]
      .filter((c) => (deckId ? c.deckId === deckId : true))
      .map((card) => ({
        card,
        review: this.reviews.get(`${userId}:${card.id}`) ?? null,
      }))
      .filter((row) => !row.review || row.review.due.getTime() <= now)
      .sort((a, b) => {
        const aDue = a.review ? a.review.due.getTime() : 0;
        const bDue = b.review ? b.review.due.getTime() : 0;
        return aDue - bDue || a.card.sortOrder - b.card.sortOrder;
      })
      .slice(0, limit);
  }

  /** {@inheritDoc Store.upsertFlashcardReview} */
  async upsertFlashcardReview(
    input: UpsertFlashcardReviewInput,
  ): Promise<FlashcardReview> {
    const key = `${input.userId}:${input.cardId}`;
    const existing = this.reviews.get(key);
    const now = new Date();
    const row: FlashcardReview = {
      userId: input.userId,
      cardId: input.cardId,
      state: input.state,
      due: input.due,
      stability: input.stability,
      difficulty: input.difficulty,
      elapsedDays: input.elapsedDays,
      scheduledDays: input.scheduledDays,
      reps: input.reps,
      lapses: input.lapses,
      lastReview: input.lastReview,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.reviews.set(key, row);
    return row;
  }

  /** {@inheritDoc Store.createFlashcardDeck} */
  async createFlashcardDeck(
    input: CreateFlashcardDeckInput,
  ): Promise<FlashcardDeckWithCards> {
    const now = new Date();
    const deck: FlashcardDeck = {
      id: newId(),
      slug: input.slug,
      title: input.title,
      description: input.description ?? null,
      ownerUserId: input.ownerUserId ?? null,
      tierRequired: input.tierRequired ?? "free",
      createdAt: now,
      updatedAt: now,
    };
    this.decks.set(deck.id, deck);
    const deckCards = (input.cards ?? []).map((card, index) => {
      const row: Flashcard = {
        id: newId(),
        deckId: deck.id,
        front: card.front,
        back: card.back,
        tags: card.tags ?? [],
        sortOrder: card.sortOrder ?? index,
        createdById: card.createdById ?? null,
        createdAt: now,
        updatedAt: now,
      };
      this.cards.set(row.id, row);
      return row;
    });
    return { ...deck, cards: deckCards };
  }

  /* ── Admin AI agent ─────────────────────────────────────────────────────── */

  /** {@inheritDoc Store.createAgentSession} */
  async createAgentSession(input: {
    userId: string;
    title?: string;
    model?: string | null;
  }): Promise<AgentSession> {
    const now = new Date();
    const session: AgentSession = {
      id: newId(),
      userId: input.userId,
      title: input.title ?? "New session",
      status: "active",
      model: input.model ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  /** {@inheritDoc Store.getAgentSession} */
  async getAgentSession(id: string): Promise<AgentSession | null> {
    return this.sessions.get(id) ?? null;
  }

  /** {@inheritDoc Store.listAgentSessions} */
  async listAgentSessions(userId: string): Promise<AgentSession[]> {
    return [...this.sessions.values()]
      .filter((s) => s.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /** {@inheritDoc Store.appendAgentMessage} */
  async appendAgentMessage(
    input: AppendAgentMessageInput,
  ): Promise<AgentMessage> {
    const now = new Date();
    const message: AgentMessage = {
      id: newId(),
      sessionId: input.sessionId,
      role: input.role,
      content: input.content,
      toolCalls: input.toolCalls ?? null,
      toolCallId: input.toolCallId ?? null,
      toolName: input.toolName ?? null,
      tokensIn: input.tokensIn ?? null,
      tokensOut: input.tokensOut ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.agentMsgs.set(message.id, message);
    const session = this.sessions.get(input.sessionId);
    if (session) session.updatedAt = now;
    return message;
  }

  /** {@inheritDoc Store.listAgentMessages} */
  async listAgentMessages(
    sessionId: string,
    limit = 200,
  ): Promise<AgentMessage[]> {
    return [...this.agentMsgs.values()]
      .filter((m) => m.sessionId === sessionId)
      .sort(
        (a, b) =>
          a.createdAt.getTime() - b.createdAt.getTime() ||
          (a.id < b.id ? -1 : 1),
      )
      .slice(0, limit);
  }

  /* ── Saved locations ────────────────────────────────────────────────────── */

  /** {@inheritDoc Store.listSavedLocations} */
  async listSavedLocations(userId: string): Promise<SavedLocation[]> {
    return [...this.savedLocations.values()]
      .filter((row) => row.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /** {@inheritDoc Store.createSavedLocation} */
  async createSavedLocation(input: CreateSavedLocationInput): Promise<SavedLocation> {
    const now = new Date();
    const row: SavedLocation = {
      id: newId(),
      userId: input.userId,
      name: input.name,
      latitude: input.latitude,
      longitude: input.longitude,
      note: input.note ?? null,
      snapshot: input.snapshot ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.savedLocations.set(row.id, row);
    return row;
  }

  /** {@inheritDoc Store.deleteSavedLocation} */
  async deleteSavedLocation(id: string, userId: string): Promise<boolean> {
    const row = this.savedLocations.get(id);
    if (!row || row.userId !== userId) return false;
    return this.savedLocations.delete(id);
  }

  /* ── Notifications ──────────────────────────────────────────────────────── */

  /** {@inheritDoc Store.listNotifications} */
  async listNotifications(
    userId: string,
    limit = 50,
  ): Promise<NotificationRow[]> {
    return [...this.notifications.values()]
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /** {@inheritDoc Store.createNotification} */
  async createNotification(
    input: CreateNotificationInput,
  ): Promise<NotificationRow> {
    const now = new Date();
    const notification: NotificationRow = {
      id: newId(),
      userId: input.userId,
      type: input.type ?? "system",
      title: input.title,
      body: input.body ?? null,
      url: input.url ?? null,
      metadata: input.metadata ?? null,
      readAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.notifications.set(notification.id, notification);
    return notification;
  }

  /** {@inheritDoc Store.markNotificationRead} */
  async markNotificationRead(id: string): Promise<NotificationRow | null> {
    const notification = this.notifications.get(id);
    if (!notification) return null;
    const now = new Date();
    notification.readAt = now;
    notification.updatedAt = now;
    return notification;
  }

  /* ── Audit ──────────────────────────────────────────────────────────────── */

  /** {@inheritDoc Store.recordAuditLog} */
  async recordAuditLog(input: RecordAuditLogInput): Promise<AuditLogEntry> {
    const entry: AuditLogEntry = {
      id: newId(),
      actorUserId: input.actorUserId ?? null,
      actorIp: input.actorIp ?? null,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      before: input.before ?? null,
      after: input.after ?? null,
      metadata: input.metadata ?? null,
      createdAt: new Date(),
    };
    this.auditEntries.push(entry);
    return entry;
  }

  /** {@inheritDoc Store.listAuditLog} */
  async listAuditLog(limit = 100): Promise<AuditLogEntry[]> {
    return [...this.auditEntries]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /* ── Private helpers ────────────────────────────────────────────────────── */

  private userPatchValues(fields: UserWritableFields): Partial<User> {
    const patch: Partial<User> = {};
    if (fields.email !== undefined) patch.email = fields.email;
    if (fields.firstName !== undefined) patch.firstName = fields.firstName;
    if (fields.lastName !== undefined) patch.lastName = fields.lastName;
    if (fields.displayName !== undefined) patch.displayName = fields.displayName;
    if (fields.imageUrl !== undefined) patch.imageUrl = fields.imageUrl;
    if (fields.bio !== undefined) patch.bio = fields.bio;
    if (fields.pronouns !== undefined) patch.pronouns = fields.pronouns;
    if (fields.location !== undefined) patch.location = fields.location;
    if (fields.timezone !== undefined) patch.timezone = fields.timezone;
    if (fields.role !== undefined) patch.role = fields.role;
    if (fields.membershipStatus !== undefined) {
      patch.membershipStatus = fields.membershipStatus;
    }
    if (fields.tier !== undefined) patch.tier = fields.tier;
    if (fields.stripeCustomerId !== undefined) {
      patch.stripeCustomerId = fields.stripeCustomerId;
    }
    if (fields.stripeSubscriptionId !== undefined) {
      patch.stripeSubscriptionId = fields.stripeSubscriptionId;
    }
    if (fields.subscriptionStatus !== undefined) {
      patch.subscriptionStatus = fields.subscriptionStatus;
    }
    if (fields.currentPeriodEnd !== undefined) {
      patch.currentPeriodEnd = fields.currentPeriodEnd;
    }
    if (fields.onboardingCompletedAt !== undefined) {
      patch.onboardingCompletedAt = fields.onboardingCompletedAt;
    }
    if (fields.lastSeenAt !== undefined) patch.lastSeenAt = fields.lastSeenAt;
    if (fields.clerkUpdatedAt !== undefined) {
      patch.clerkUpdatedAt = fields.clerkUpdatedAt;
    }
    return patch;
  }

  private applyUserPatch(
    user: User,
    patch: UpdateUserInput | UpsertUserInput,
  ): User {
    Object.assign(user, this.userPatchValues(patch));
    const deletedAt = "deletedAt" in patch ? patch.deletedAt : undefined;
    if (deletedAt !== undefined) user.deletedAt = deletedAt;
    user.updatedAt = new Date();
    return user;
  }

  /* ── Seed ───────────────────────────────────────────────────────────────── */

  /**
   * Populate the demo dataset. Idempotent by construction: the constructor runs
   * it once per instance on empty Maps.
   */
  private seed(): void {
    const now = new Date();

    for (const seed of TIER_SEED) {
      this.tiers.set(seed.key, {
        key: seed.key,
        name: seed.name,
        description: seed.description ?? null,
        monthlyPriceCents: seed.monthlyPriceCents ?? 0,
        annualPriceCents: seed.annualPriceCents ?? null,
        currency: seed.currency ?? "usd",
        stripeProductId: seed.stripeProductId ?? null,
        stripePriceId: seed.stripePriceId ?? null,
        features: seed.features ?? [],
        displayOrder: seed.displayOrder ?? 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    const admin = this.seedUser({
      clerkUserId: "user_demo_admin",
      email: "admin@thecipher.test",
      firstName: "Ada",
      lastName: "Cipher",
      displayName: "Ada Cipher",
      role: "admin",
      membershipStatus: "approved",
      tier: "oracle",
      bio: "Founder and guide at The Cipher.",
      onboardingCompletedAt: daysAgo(120),
    });

    const member = this.seedUser({
      clerkUserId: "user_demo_member",
      email: "member@thecipher.test",
      firstName: "Mira",
      lastName: "Solis",
      displayName: "Mira Solis",
      role: "member",
      membershipStatus: "approved",
      tier: "initiate",
      bio: "Here to follow the emotional wave, slowly.",
      timezone: "America/New_York",
      onboardingCompletedAt: daysAgo(45),
    });

    const applicant = this.seedUser({
      clerkUserId: "user_demo_applicant",
      email: "applicant@thecipher.test",
      firstName: "Jonas",
      lastName: "Vega",
      displayName: "Jonas Vega",
      role: "member",
      membershipStatus: "pending",
      tier: "free",
    });

    this.applications.set(
      "app_demo_member",
      {
        id: "app_demo_member",
        userId: member.id,
        status: "approved",
        answers: {
          why: "I want a place to test what I am learning against real people.",
          whatYouMake: "Ceramics and a small newsletter about design cycles.",
          experienceLevel: "Intermediate — two years with my own chart.",
          referral: "Found you through the newsletter.",
        },
        reviewedById: admin.id,
        reviewedAt: daysAgo(46),
        decisionNote: "Welcome in.",
        createdAt: daysAgo(50),
        updatedAt: daysAgo(46),
      },
    );

    this.applications.set(
      "app_demo_applicant",
      {
        id: "app_demo_applicant",
        userId: applicant.id,
        status: "pending",
        answers: {
          why: "I have been studying alone and need the mirror of a community.",
          whatYouMake: "Sound design for documentary film.",
          experienceLevel: "Beginner.",
          referral: "A friend sent me a reading.",
        },
        reviewedById: null,
        reviewedAt: null,
        decisionNote: null,
        createdAt: daysAgo(3),
        updatedAt: daysAgo(3),
      },
    );

    const general = this.seedChannel({
      slug: "general",
      name: "General",
      description: "Introductions, questions, and everyday chatter.",
    });
    const experiments = this.seedChannel({
      slug: "experiments",
      name: "Experiments",
      description: "Try the thing, report what happened.",
    });

    this.seedMessage(
      general.id,
      admin.id,
      "Welcome to The Cipher. Start with today's transit note, then say hello.",
      daysAgo(6),
    );
    this.seedMessage(
      general.id,
      member.id,
      "Hello — 6/2 Generator here, currently riding out a very slow sacral no.",
      daysAgo(5),
    );
    this.seedMessage(
      general.id,
      admin.id,
      "The sacral no is the whole practice. Sit with it.",
      daysAgo(4),
    );
    this.seedMessage(
      experiments.id,
      member.id,
      "Ran my chart through the new engine — the true node fixed my profile.",
      daysAgo(2),
    );
    this.seedMessage(
      experiments.id,
      admin.id,
      "That is the bug we spent a week on. Thank you for confirming.",
      daysAgo(2),
    );

    this.seedCourse({
      slug: "foundations",
      title: "Foundations of Human Design",
      summary: "Type, strategy, authority — the four decisions that change everything.",
      tierRequired: "free",
      lessons: [
        {
          slug: "the-four-types",
          title: "The Four Types",
          summary: "Aura mechanics and what each type is here to do.",
          durationSeconds: 1140,
        },
        {
          slug: "strategy-and-authority",
          title: "Strategy and Authority",
          summary: "How to make a decision you can actually stand behind.",
          durationSeconds: 1500,
        },
        {
          slug: "reading-your-bodygraph",
          title: "Reading Your Bodygraph",
          summary: "Defined, open, and the pressure to be consistent.",
          durationSeconds: 1320,
        },
      ],
    });

    this.seedCourse({
      slug: "the-nine-centres",
      title: "The Nine Centres",
      summary: "Each centre as a biological and psychological theme.",
      tierRequired: "initiate",
      lessons: [
        {
          slug: "head-and-ajna",
          title: "Head and Ajna",
          durationSeconds: 1620,
        },
        {
          slug: "throat-and-g",
          title: "Throat and G",
          durationSeconds: 1440,
        },
        {
          slug: "motors-and-spleen",
          title: "Motors, Spleen, and Root",
          durationSeconds: 1800,
        },
        {
          slug: "open-centres",
          title: "Living With Open Centres",
          durationSeconds: 1560,
        },
      ],
    });

    this.seedCourse({
      slug: "cycles-and-timing",
      title: "Cycles and Timing",
      summary: "Saturn returns, nodal seasons, and the emotional wave as a calendar.",
      tierRequired: "adept",
      lessons: [
        {
          slug: "the-lunar-cycle",
          title: "The Lunar Cycle",
          durationSeconds: 1260,
        },
        {
          slug: "saturn-and-nodes",
          title: "Saturn and the Nodes",
          durationSeconds: 1740,
        },
      ],
    });

    const deck = this.seedDeck({
      slug: "gate-flashcards",
      title: "The 64 Gates",
      description: "Gate number to centre and keynote.",
      cards: [
        { front: "Gate 41", back: "Root — Fantasy, the pressure that starts a new cycle.", tags: ["root", "initiation"] },
        { front: "Gate 1", back: "G Center — Self-expression, creativity as a direction.", tags: ["g", "knowing"] },
        { front: "Gate 34", back: "Sacral — Power, raw vital force in response.", tags: ["sacral", "motor"] },
        { front: "Gate 57", back: "Spleen — Intuitive clarity, the quiet once-only knowing.", tags: ["spleen", "awareness"] },
      ],
    });

    // one card carries prior FSRS state and is due now; the rest are new.
    const dueCard = deck.cards[0];
    if (dueCard) {
      this.reviews.set(`${member.id}:${dueCard.id}`, {
        userId: member.id,
        cardId: dueCard.id,
        state: "review",
        due: daysAgo(1),
        stability: 12.4,
        difficulty: 5.1,
        elapsedDays: 11,
        scheduledDays: 12,
        reps: 4,
        lapses: 0,
        lastReview: daysAgo(12),
        createdAt: daysAgo(40),
        updatedAt: daysAgo(12),
      });
    }

    this.seedCall({
      title: "Weekly Chart Circle",
      description:
        "Bring one chart question. We read live and take the group's reflections.",
      hostId: admin.id,
      startsAt: nextWeekdayAt(3, 19),
      durationMinutes: 60,
      recurring: true,
      recurrenceDay: 3,
      recurrenceTime: "19:00",
      recurrenceTz: "America/New_York",
      recurrenceRule: "FREQ=WEEKLY;BYDAY=WE;BYHOUR=19;BYMINUTE=0",
      tierRequired: "initiate",
    });

    this.seedCall({
      title: "New Moon Transit Clinic",
      description: "A one-off session on the incoming lunation.",
      hostId: admin.id,
      startsAt: daysFromNow(-9),
      durationMinutes: 75,
      tierRequired: "initiate",
    });

    this.createNotification({
      userId: member.id,
      title: "Your application was approved",
      body: "Welcome to The Cipher. Finish your birth profile to unlock your chart.",
      type: "application",
      url: "/onboarding",
    });
    this.createNotification({
      userId: admin.id,
      title: "New membership application",
      body: "Jonas Vega applied to join.",
      type: "application",
      url: "/admin/applications",
    });
  }

  private seedUser(
    input: Partial<User> & {
      clerkUserId: string;
      role: UserRole;
      membershipStatus: MembershipStatus;
      tier: TierKey;
    },
  ): User {
    const now = new Date();
    const user: User = {
      id: input.id ?? newId(),
      clerkUserId: input.clerkUserId,
      email: input.email ?? null,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      displayName: input.displayName ?? null,
      imageUrl: input.imageUrl ?? null,
      bio: input.bio ?? null,
      pronouns: input.pronouns ?? null,
      location: input.location ?? null,
      timezone: input.timezone ?? null,
      role: input.role,
      membershipStatus: input.membershipStatus,
      tier: input.tier,
      stripeCustomerId: input.stripeCustomerId ?? null,
      stripeSubscriptionId: input.stripeSubscriptionId ?? null,
      subscriptionStatus: input.subscriptionStatus ?? null,
      currentPeriodEnd: input.currentPeriodEnd ?? null,
      onboardingCompletedAt: input.onboardingCompletedAt ?? null,
      lastSeenAt: input.lastSeenAt ?? null,
      clerkUpdatedAt: input.clerkUpdatedAt ?? now,
      deletedAt: input.deletedAt ?? null,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    };
    this.users.set(user.id, user);
    this.userIdByClerkId.set(user.clerkUserId, user.id);
    return user;
  }

  private seedChannel(input: {
    slug: string;
    name: string;
    description?: string;
  }): Channel {
    const now = new Date();
    const channel: Channel = {
      id: newId(),
      slug: input.slug,
      name: input.name,
      description: input.description ?? null,
      kind: "public",
      tierRequired: null,
      createdAt: now,
      updatedAt: now,
    };
    this.channels.set(channel.id, channel);
    return channel;
  }

  private seedMessage(
    channelId: string,
    authorId: string,
    body: string,
    createdAt: Date,
  ): Message {
    const message: Message = {
      id: newId(),
      channelId,
      authorId,
      body,
      attachments: [],
      replyToId: null,
      editedAt: null,
      deletedAt: null,
      createdAt,
      updatedAt: createdAt,
    };
    this.messages.set(message.id, message);
    return message;
  }

  private seedCourse(input: {
    slug: string;
    title: string;
    summary: string;
    tierRequired: TierKey;
    lessons: CreateLessonInput[];
  }): void {
    const now = new Date();
    const course: Course = {
      id: newId(),
      slug: input.slug,
      title: input.title,
      summary: input.summary,
      description: input.summary,
      coverImageUrl: null,
      tierRequired: input.tierRequired,
      sortOrder: this.courses.size,
      publishedAt: daysAgo(90),
      createdAt: daysAgo(90),
      updatedAt: now,
    };
    this.courses.set(course.id, course);
    input.lessons.forEach((lesson, index) => {
      this.insertLesson(course.id, lesson, index);
    });
  }

  private seedDeck(input: CreateFlashcardDeckInput): FlashcardDeckWithCards {
    const now = new Date();
    const deck: FlashcardDeck = {
      id: newId(),
      slug: input.slug,
      title: input.title,
      description: input.description ?? null,
      ownerUserId: input.ownerUserId ?? null,
      tierRequired: input.tierRequired ?? "free",
      createdAt: daysAgo(30),
      updatedAt: now,
    };
    this.decks.set(deck.id, deck);
    const cards = (input.cards ?? []).map((card, index) => {
      const row: Flashcard = {
        id: newId(),
        deckId: deck.id,
        front: card.front,
        back: card.back,
        tags: card.tags ?? [],
        sortOrder: index,
        createdById: null,
        createdAt: daysAgo(30),
        updatedAt: now,
      };
      this.cards.set(row.id, row);
      return row;
    });
    return { ...deck, cards };
  }

  private seedCall(input: {
    title: string;
    description: string;
    hostId: string;
    startsAt: Date;
    durationMinutes: number;
    recurring?: boolean;
    recurrenceDay?: number;
    recurrenceTime?: string;
    recurrenceTz?: string;
    recurrenceRule?: string;
    tierRequired?: TierKey;
  }): LiveCall {
    const now = new Date();
    const call: LiveCall = {
      id: newId(),
      slug: toSlug(input.title),
      title: input.title,
      description: input.description,
      hostId: input.hostId,
      startsAt: input.startsAt,
      durationMinutes: input.durationMinutes,
      roomUrl: "https://thecipher.daily.co/weekly-chart-circle",
      provider: "daily",
      providerRoomName: "weekly-chart-circle",
      recordingUrl: null,
      status: input.startsAt.getTime() < now.getTime() ? "ended" : "scheduled",
      tierRequired: input.tierRequired ?? null,
      recurring: input.recurring ?? false,
      recurrenceDay: input.recurrenceDay ?? null,
      recurrenceTime: input.recurrenceTime ?? null,
      recurrenceTz: input.recurrenceTz ?? null,
      recurrenceRule: input.recurrenceRule ?? null,
      createdAt: daysAgo(60),
      updatedAt: now,
    };
    this.calls.set(call.id, call);
    return call;
  }
}

/** Clamp a cursor-page limit into a safe range. */
function clampLimit(limit?: number): number {
  if (!limit || !Number.isFinite(limit)) return 50;
  return Math.max(1, Math.min(200, Math.floor(limit)));
}

/* ────────────────────────────────────────────────────────────────────────────
 * PostgresStore
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Drizzle/Neon-backed repository. Only constructed when `DATABASE_URL` is set;
 * see `getStore()`.
 */
export class PostgresStore implements Store {
  constructor(private readonly db: Database) {}

  /* ── Tiers ──────────────────────────────────────────────────────────────── */

  /** {@inheritDoc Store.listTiers} */
  async listTiers(): Promise<Tier[]> {
    return this.db.select().from(tiers).orderBy(asc(tiers.displayOrder));
  }

  /* ── Users ──────────────────────────────────────────────────────────────── */

  /** {@inheritDoc Store.getUserByClerkId} */
  async getUserByClerkId(clerkUserId: string): Promise<User | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId))
      .limit(1);
    return row ?? null;
  }

  /** {@inheritDoc Store.getUserById} */
  async getUserById(id: string): Promise<User | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return row ?? null;
  }

  /** {@inheritDoc Store.getUserByStripeCustomerId} */
  async getUserByStripeCustomerId(
    stripeCustomerId: string,
  ): Promise<User | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.stripeCustomerId, stripeCustomerId))
      .limit(1);
    return row ?? null;
  }

  /** {@inheritDoc Store.upsertUser} */
  async upsertUser(input: UpsertUserInput): Promise<User> {
    const existing = await this.getUserByClerkId(input.clerkUserId);
    if (existing) {
      if (
        input.clerkUpdatedAt &&
        existing.clerkUpdatedAt &&
        input.clerkUpdatedAt.getTime() < existing.clerkUpdatedAt.getTime()
      ) {
        return existing;
      }
      const updated = await this.updateUser(existing.id, input);
      return updated ?? existing;
    }
    const patch = userInsertPatch(input);
    const [row] = await this.db
      .insert(users)
      .values({ clerkUserId: input.clerkUserId, ...patch })
      .onConflictDoUpdate({
        target: users.clerkUserId,
        set: { ...patch, updatedAt: new Date() },
      })
      .returning();
    if (!row) throw new Error("Failed to upsert user");
    return row;
  }

  /** {@inheritDoc Store.updateUser} */
  async updateUser(id: string, patch: UpdateUserInput): Promise<User | null> {
    const set: Partial<typeof users.$inferInsert> = {
      ...userInsertPatch(patch),
      updatedAt: new Date(),
    };
    if (patch.deletedAt !== undefined) set.deletedAt = patch.deletedAt;
    const [row] = await this.db
      .update(users)
      .set(set)
      .where(eq(users.id, id))
      .returning();
    return row ?? null;
  }

  /** {@inheritDoc Store.listUsers} */
  async listUsers(filters: ListUsersFilters = {}): Promise<Paginated<User>> {
    const conditions: SQL[] = [];
    if (filters.role) conditions.push(eq(users.role, filters.role));
    if (filters.membershipStatus) {
      conditions.push(eq(users.membershipStatus, filters.membershipStatus));
    }
    if (filters.tier) conditions.push(eq(users.tier, filters.tier));
    if (filters.search?.trim()) {
      const term = `%${filters.search.trim()}%`;
      const search = or(
        ilike(users.email, term),
        ilike(users.firstName, term),
        ilike(users.lastName, term),
        ilike(users.displayName, term),
      );
      if (search) conditions.push(search);
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRow] = await this.db
      .select({ value: count() })
      .from(users)
      .where(where);
    const page = Math.max(1, Math.floor(filters.page ?? 1));
    const pageSize = Math.max(1, Math.floor(filters.pageSize ?? 20));
    const rows = await this.db
      .select()
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    const total = Number(totalRow?.value ?? 0);
    return {
      items: rows,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  /* ── Applications ───────────────────────────────────────────────────────── */

  /** {@inheritDoc Store.createApplication} */
  async createApplication(
    input: CreateApplicationInput,
  ): Promise<MembershipApplication> {
    const [row] = await this.db
      .insert(membershipApplications)
      .values({ userId: input.userId, answers: input.answers })
      .returning();
    if (!row) throw new Error("Failed to create membership application");
    await this.db
      .update(users)
      .set({ membershipStatus: "pending", updatedAt: new Date() })
      .where(eq(users.id, input.userId));
    return row;
  }

  /** {@inheritDoc Store.getApplicationByUser} */
  async getApplicationByUser(
    userId: string,
  ): Promise<MembershipApplication | null> {
    const [row] = await this.db
      .select()
      .from(membershipApplications)
      .where(eq(membershipApplications.userId, userId))
      .orderBy(desc(membershipApplications.createdAt))
      .limit(1);
    return row ?? null;
  }

  /** {@inheritDoc Store.listApplications} */
  async listApplications(
    status?: ApplicationStatus,
  ): Promise<MembershipApplication[]> {
    return this.db
      .select()
      .from(membershipApplications)
      .where(
        status ? eq(membershipApplications.status, status) : undefined,
      )
      .orderBy(desc(membershipApplications.createdAt));
  }

  /** {@inheritDoc Store.approveApplication} */
  async approveApplication(
    id: string,
    reviewerId: string,
    decisionNote?: string | null,
  ): Promise<MembershipApplication | null> {
    return this.decideApplication(id, "approved", reviewerId, decisionNote);
  }

  /** {@inheritDoc Store.denyApplication} */
  async denyApplication(
    id: string,
    reviewerId: string,
    decisionNote?: string | null,
  ): Promise<MembershipApplication | null> {
    return this.decideApplication(id, "denied", reviewerId, decisionNote);
  }

  private async decideApplication(
    id: string,
    decision: "approved" | "denied",
    reviewerId: string,
    decisionNote?: string | null,
  ): Promise<MembershipApplication | null> {
    const now = new Date();
    const [row] = await this.db
      .update(membershipApplications)
      .set({
        status: decision,
        reviewedById: reviewerId,
        reviewedAt: now,
        decisionNote: decisionNote ?? null,
        updatedAt: now,
      })
      .where(eq(membershipApplications.id, id))
      .returning();
    if (!row) return null;
    await this.db
      .update(users)
      .set({ membershipStatus: decision, updatedAt: now })
      .where(eq(users.id, row.userId));
    return row;
  }

  /* ── Birth profiles ─────────────────────────────────────────────────────── */

  /** {@inheritDoc Store.upsertBirthProfile} */
  async upsertBirthProfile(
    input: UpsertBirthProfileInput,
  ): Promise<BirthProfile> {
    const values: typeof birthProfiles.$inferInsert = {
      userId: input.userId,
      birthDate: input.birthDate,
      birthTime: input.birthTime,
      birthTimeZone: input.birthTimeZone,
      birthLatitude: input.birthLatitude,
      birthLongitude: input.birthLongitude,
    };
    if (input.birthPlaceName !== undefined) {
      values.birthPlaceName = input.birthPlaceName;
    }
    if (input.kpChart !== undefined) values.kpChart = input.kpChart;
    if (input.bodygraph !== undefined) values.bodygraph = input.bodygraph;
    if (input.auraSeat !== undefined) values.auraSeat = input.auraSeat;
    if (input.auraFormat !== undefined) values.auraFormat = input.auraFormat;
    if (input.auraLabel !== undefined) values.auraLabel = input.auraLabel;
    if (input.strengths !== undefined) values.strengths = input.strengths;
    if (input.weaknesses !== undefined) values.weaknesses = input.weaknesses;
    if (input.onboardingAnswers !== undefined) {
      values.onboardingAnswers = input.onboardingAnswers;
    }
    const [row] = await this.db
      .insert(birthProfiles)
      .values(values)
      .onConflictDoUpdate({
        target: birthProfiles.userId,
        set: { ...values, updatedAt: new Date() },
      })
      .returning();
    if (!row) throw new Error("Failed to upsert birth profile");
    return row;
  }

  /** {@inheritDoc Store.getBirthProfileByUser} */
  async getBirthProfileByUser(userId: string): Promise<BirthProfile | null> {
    const [row] = await this.db
      .select()
      .from(birthProfiles)
      .where(eq(birthProfiles.userId, userId))
      .limit(1);
    return row ?? null;
  }

  /* ── Channels & messages ────────────────────────────────────────────────── */

  /** {@inheritDoc Store.listChannels} */
  async listChannels(): Promise<Channel[]> {
    return this.db.select().from(channels).orderBy(asc(channels.createdAt));
  }

  /** {@inheritDoc Store.getChannelById} */
  async getChannelById(id: string): Promise<Channel | null> {
    const [row] = await this.db
      .select()
      .from(channels)
      .where(eq(channels.id, id))
      .limit(1);
    return row ?? null;
  }

  /** {@inheritDoc Store.getChannelBySlug} */
  async getChannelBySlug(slug: string): Promise<Channel | null> {
    const [row] = await this.db
      .select()
      .from(channels)
      .where(eq(channels.slug, slug))
      .limit(1);
    return row ?? null;
  }

  /** {@inheritDoc Store.createChannel} */
  async createChannel(input: CreateChannelInput): Promise<Channel> {
    const [row] = await this.db
      .insert(channels)
      .values({
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
        kind: input.kind ?? "public",
        tierRequired: input.tierRequired ?? null,
      })
      .returning();
    if (!row) throw new Error("Failed to create channel");
    return row;
  }

  /** {@inheritDoc Store.listMessages} */
  async listMessages(
    channelId: string,
    query: CursorQuery = {},
  ): Promise<CursorPage<Message>> {
    const limit = clampLimit(query.limit);
    const cursor = decodeCursor(query.cursor);
    const conditions: SQL[] = [eq(messages.channelId, channelId)];
    if (cursor) {
      const keyset = or(
        lt(messages.createdAt, cursor.createdAt),
        and(
          eq(messages.createdAt, cursor.createdAt),
          lt(messages.id, cursor.id),
        ),
      );
      if (keyset) conditions.push(keyset);
    }
    const rows = await this.db
      .select()
      .from(messages)
      .where(and(...conditions))
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(limit);
    const last = rows[rows.length - 1];
    return {
      items: rows,
      nextCursor: rows.length === limit && last ? encodeCursor(last) : null,
    };
  }

  /** {@inheritDoc Store.createMessage} */
  async createMessage(input: CreateMessageInput): Promise<Message> {
    const [row] = await this.db
      .insert(messages)
      .values({
        channelId: input.channelId,
        authorId: input.authorId,
        body: input.body,
        attachments: input.attachments ?? [],
        replyToId: input.replyToId ?? null,
      })
      .returning();
    if (!row) throw new Error("Failed to create message");
    return row;
  }

  /** {@inheritDoc Store.editMessage} */
  async editMessage(
    messageId: string,
    body: string,
    editorId?: string,
  ): Promise<Message | null> {
    const conditions: SQL[] = [eq(messages.id, messageId)];
    if (editorId) conditions.push(eq(messages.authorId, editorId));
    const now = new Date();
    const [row] = await this.db
      .update(messages)
      .set({ body, editedAt: now, updatedAt: now })
      .where(and(...conditions, isNull(messages.deletedAt)))
      .returning();
    return row ?? null;
  }

  /** {@inheritDoc Store.softDeleteMessage} */
  async softDeleteMessage(messageId: string): Promise<boolean> {
    const now = new Date();
    const rows = await this.db
      .update(messages)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(messages.id, messageId), isNull(messages.deletedAt)))
      .returning({ id: messages.id });
    return rows.length > 0;
  }

  /* ── Direct messages ────────────────────────────────────────────────────── */

  /** {@inheritDoc Store.findOrCreateDirectThread} */
  async findOrCreateDirectThread(
    userIdA: string,
    userIdB: string,
  ): Promise<DirectThread> {
    const [a, b] =
      userIdA < userIdB ? [userIdA, userIdB] : [userIdB, userIdA];
    const [created] = await this.db
      .insert(directThreads)
      .values({ userAId: a, userBId: b })
      .onConflictDoNothing({ target: [directThreads.userAId, directThreads.userBId] })
      .returning();
    if (created) return created;
    const [existing] = await this.db
      .select()
      .from(directThreads)
      .where(and(eq(directThreads.userAId, a), eq(directThreads.userBId, b)))
      .limit(1);
    if (!existing) throw new Error("Failed to resolve direct thread");
    return existing;
  }

  /** {@inheritDoc Store.getDirectThreadById} */
  async getDirectThreadById(id: string): Promise<DirectThread | null> {
    const [row] = await this.db
      .select()
      .from(directThreads)
      .where(eq(directThreads.id, id))
      .limit(1);
    return row ?? null;
  }

  /** {@inheritDoc Store.listDirectThreadsForUser} */
  async listDirectThreadsForUser(userId: string): Promise<DirectThread[]> {
    const match = or(
      eq(directThreads.userAId, userId),
      eq(directThreads.userBId, userId),
    );
    const rows = await this.db
      .select()
      .from(directThreads)
      .where(match)
      .orderBy(sql`${directThreads.lastMessageAt} desc nulls last`);
    return rows;
  }

  /** {@inheritDoc Store.listDirectMessages} */
  async listDirectMessages(
    threadId: string,
    query: CursorQuery = {},
  ): Promise<CursorPage<DirectMessage>> {
    const limit = clampLimit(query.limit);
    const cursor = decodeCursor(query.cursor);
    const conditions: SQL[] = [eq(directMessages.threadId, threadId)];
    if (cursor) {
      const keyset = or(
        lt(directMessages.createdAt, cursor.createdAt),
        and(
          eq(directMessages.createdAt, cursor.createdAt),
          lt(directMessages.id, cursor.id),
        ),
      );
      if (keyset) conditions.push(keyset);
    }
    const rows = await this.db
      .select()
      .from(directMessages)
      .where(and(...conditions))
      .orderBy(desc(directMessages.createdAt), desc(directMessages.id))
      .limit(limit);
    const last = rows[rows.length - 1];
    return {
      items: rows,
      nextCursor: rows.length === limit && last ? encodeCursor(last) : null,
    };
  }

  /** {@inheritDoc Store.createDirectMessage} */
  async createDirectMessage(
    input: CreateDirectMessageInput,
  ): Promise<DirectMessage> {
    const [row] = await this.db
      .insert(directMessages)
      .values({
        threadId: input.threadId,
        authorId: input.authorId,
        body: input.body,
        attachments: input.attachments ?? [],
        replyToId: input.replyToId ?? null,
      })
      .returning();
    if (!row) throw new Error("Failed to create direct message");
    await this.db
      .update(directThreads)
      .set({ lastMessageAt: row.createdAt, updatedAt: new Date() })
      .where(eq(directThreads.id, input.threadId));
    return row;
  }

  /** {@inheritDoc Store.editDirectMessage} */
  async editDirectMessage(
    messageId: string,
    body: string,
    editorId?: string,
  ): Promise<DirectMessage | null> {
    const conditions: SQL[] = [eq(directMessages.id, messageId)];
    if (editorId) conditions.push(eq(directMessages.authorId, editorId));
    const now = new Date();
    const [row] = await this.db
      .update(directMessages)
      .set({ body, editedAt: now, updatedAt: now })
      .where(and(...conditions, isNull(directMessages.deletedAt)))
      .returning();
    return row ?? null;
  }

  /** {@inheritDoc Store.softDeleteDirectMessage} */
  async softDeleteDirectMessage(messageId: string): Promise<boolean> {
    const now = new Date();
    const rows = await this.db
      .update(directMessages)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(eq(directMessages.id, messageId), isNull(directMessages.deletedAt)),
      )
      .returning({ id: directMessages.id });
    return rows.length > 0;
  }

  /* ── Live calls ─────────────────────────────────────────────────────────── */

  /** {@inheritDoc Store.listUpcomingCalls} */
  async listUpcomingCalls(limit = 20): Promise<LiveCall[]> {
    return this.db
      .select()
      .from(liveCalls)
      .where(
        and(
          gte(liveCalls.startsAt, new Date()),
          ne(liveCalls.status, "canceled"),
        ),
      )
      .orderBy(asc(liveCalls.startsAt))
      .limit(limit);
  }

  /** {@inheritDoc Store.listPastCalls} */
  async listPastCalls(limit = 20): Promise<LiveCall[]> {
    return this.db
      .select()
      .from(liveCalls)
      .where(lt(liveCalls.startsAt, new Date()))
      .orderBy(desc(liveCalls.startsAt))
      .limit(limit);
  }

  /** {@inheritDoc Store.getCallById} */
  async getCallById(id: string): Promise<LiveCall | null> {
    const [row] = await this.db
      .select()
      .from(liveCalls)
      .where(eq(liveCalls.id, id))
      .limit(1);
    return row ?? null;
  }

  /** {@inheritDoc Store.getCallBySlug} */
  async getCallBySlug(slug: string): Promise<LiveCall | null> {
    const [row] = await this.db
      .select()
      .from(liveCalls)
      .where(eq(liveCalls.slug, slug))
      .limit(1);
    return row ?? null;
  }

  /** {@inheritDoc Store.createCall} */
  async createCall(input: CreateCallInput): Promise<LiveCall> {
    const [row] = await this.db
      .insert(liveCalls)
      .values({
        slug: input.slug ?? toSlug(input.title),
        title: input.title,
        description: input.description ?? null,
        hostId: input.hostId ?? null,
        startsAt: input.startsAt,
        durationMinutes: input.durationMinutes ?? 60,
        roomUrl: input.roomUrl ?? null,
        tierRequired: input.tierRequired ?? null,
        recurring: input.recurring ?? false,
        recurrenceDay: input.recurrenceDay ?? null,
        recurrenceTime: input.recurrenceTime ?? null,
        recurrenceTz: input.recurrenceTz ?? null,
        recurrenceRule: input.recurrenceRule ?? null,
      })
      .returning();
    if (!row) throw new Error("Failed to create call");
    return row;
  }

  /** {@inheritDoc Store.rsvpCall} */
  async rsvpCall(
    callId: string,
    userId: string,
    status: RsvpStatus,
  ): Promise<CallRsvp> {
    const [row] = await this.db
      .insert(callRsvps)
      .values({ callId, userId, status })
      .onConflictDoUpdate({
        target: [callRsvps.callId, callRsvps.userId],
        set: { status, updatedAt: new Date() },
      })
      .returning();
    if (!row) throw new Error("Failed to record RSVP");
    return row;
  }

  /** {@inheritDoc Store.listRsvps} */
  async listRsvps(callId: string): Promise<CallRsvp[]> {
    return this.db
      .select()
      .from(callRsvps)
      .where(eq(callRsvps.callId, callId));
  }

  /* ── Courses & lessons ──────────────────────────────────────────────────── */

  /** {@inheritDoc Store.listCourses} */
  async listCourses(): Promise<Course[]> {
    return this.db.select().from(courses).orderBy(asc(courses.sortOrder));
  }

  /** {@inheritDoc Store.getCourseWithLessons} */
  async getCourseWithLessons(
    idOrSlug: string,
  ): Promise<CourseWithLessons | null> {
    const match = isUuid(idOrSlug)
      ? or(eq(courses.id, idOrSlug), eq(courses.slug, idOrSlug))
      : eq(courses.slug, idOrSlug);
    const [course] = await this.db
      .select()
      .from(courses)
      .where(match)
      .limit(1);
    if (!course) return null;
    const courseLessons = await this.db
      .select()
      .from(lessons)
      .where(eq(lessons.courseId, course.id))
      .orderBy(asc(lessons.sortOrder));
    return { ...course, lessons: courseLessons };
  }

  /** {@inheritDoc Store.createCourse} */
  async createCourse(input: CreateCourseInput): Promise<CourseWithLessons> {
    const [course] = await this.db
      .insert(courses)
      .values({
        slug: input.slug,
        title: input.title,
        summary: input.summary ?? null,
        description: input.description ?? null,
        coverImageUrl: input.coverImageUrl ?? null,
        tierRequired: input.tierRequired ?? "free",
        sortOrder: input.sortOrder ?? 0,
        publishedAt: input.publishedAt ?? new Date(),
      })
      .returning();
    if (!course) throw new Error("Failed to create course");
    const createdLessons: Lesson[] = [];
    const inputs = input.lessons ?? [];
    for (let index = 0; index < inputs.length; index += 1) {
      const lesson = inputs[index];
      const [row] = await this.db
        .insert(lessons)
        .values({
          courseId: course.id,
          slug: lesson.slug,
          title: lesson.title,
          summary: lesson.summary ?? null,
          contentMdx: lesson.contentMdx ?? null,
          contentJson: lesson.contentJson ?? null,
          videoUrl: lesson.videoUrl ?? null,
          durationSeconds: lesson.durationSeconds ?? 0,
          sortOrder: lesson.sortOrder ?? index,
          tierRequired: lesson.tierRequired ?? "free",
          publishedAt: lesson.publishedAt ?? new Date(),
        })
        .returning();
      if (row) createdLessons.push(row);
    }
    return { ...course, lessons: createdLessons };
  }

  /** {@inheritDoc Store.getLessonProgressForUser} */
  async getLessonProgressForUser(userId: string): Promise<LessonProgress[]> {
    return this.db
      .select()
      .from(lessonProgress)
      .where(eq(lessonProgress.userId, userId));
  }

  /** {@inheritDoc Store.markLessonComplete} */
  async markLessonComplete(
    userId: string,
    lessonId: string,
    progressPct = 100,
  ): Promise<LessonProgress> {
    const pct = Math.max(0, Math.min(100, Math.round(progressPct)));
    const now = new Date();
    const [row] = await this.db
      .insert(lessonProgress)
      .values({
        userId,
        lessonId,
        status: pct >= 100 ? "complete" : "in_progress",
        progressPct: pct,
        completedAt: pct >= 100 ? now : null,
      })
      .onConflictDoUpdate({
        target: [lessonProgress.userId, lessonProgress.lessonId],
        set: {
          status: pct >= 100 ? "complete" : "in_progress",
          progressPct: pct,
          completedAt: pct >= 100 ? now : null,
          updatedAt: now,
        },
      })
      .returning();
    if (!row) throw new Error("Failed to update lesson progress");
    return row;
  }

  /* ── Flashcards ─────────────────────────────────────────────────────────── */

  /** {@inheritDoc Store.listFlashcardDecks} */
  async listFlashcardDecks(): Promise<FlashcardDeck[]> {
    return this.db
      .select()
      .from(flashcardDecks)
      .orderBy(asc(flashcardDecks.createdAt));
  }

  /** {@inheritDoc Store.getDeckWithCards} */
  async getDeckWithCards(
    idOrSlug: string,
  ): Promise<FlashcardDeckWithCards | null> {
    const match = isUuid(idOrSlug)
      ? or(eq(flashcardDecks.id, idOrSlug), eq(flashcardDecks.slug, idOrSlug))
      : eq(flashcardDecks.slug, idOrSlug);
    const [deck] = await this.db
      .select()
      .from(flashcardDecks)
      .where(match)
      .limit(1);
    if (!deck) return null;
    const deckCards = await this.db
      .select()
      .from(flashcards)
      .where(eq(flashcards.deckId, deck.id))
      .orderBy(asc(flashcards.sortOrder));
    return { ...deck, cards: deckCards };
  }

  /** {@inheritDoc Store.getDueFlashcards} */
  async getDueFlashcards(
    userId: string,
    deckId?: string,
    limit = 50,
  ): Promise<DueFlashcard[]> {
    const conditions: SQL[] = [
      or(
        isNull(flashcardReviews.due),
        lte(flashcardReviews.due, new Date()),
      ) as SQL,
    ];
    if (deckId) conditions.push(eq(flashcards.deckId, deckId));
    return this.db
      .select({ card: flashcards, review: flashcardReviews })
      .from(flashcards)
      .leftJoin(
        flashcardReviews,
        and(
          eq(flashcardReviews.cardId, flashcards.id),
          eq(flashcardReviews.userId, userId),
        ),
      )
      .where(and(...conditions))
      .orderBy(sql`${flashcardReviews.due} asc nulls first`, asc(flashcards.sortOrder))
      .limit(clampLimit(limit));
  }

  /** {@inheritDoc Store.upsertFlashcardReview} */
  async upsertFlashcardReview(
    input: UpsertFlashcardReviewInput,
  ): Promise<FlashcardReview> {
    const state = {
      state: input.state,
      due: input.due,
      stability: input.stability,
      difficulty: input.difficulty,
      elapsedDays: input.elapsedDays,
      scheduledDays: input.scheduledDays,
      reps: input.reps,
      lapses: input.lapses,
      lastReview: input.lastReview,
    };
    const [row] = await this.db
      .insert(flashcardReviews)
      .values({ userId: input.userId, cardId: input.cardId, ...state })
      .onConflictDoUpdate({
        target: [flashcardReviews.userId, flashcardReviews.cardId],
        set: { ...state, updatedAt: new Date() },
      })
      .returning();
    if (!row) throw new Error("Failed to upsert flashcard review");
    return row;
  }

  /** {@inheritDoc Store.createFlashcardDeck} */
  async createFlashcardDeck(
    input: CreateFlashcardDeckInput,
  ): Promise<FlashcardDeckWithCards> {
    const [deck] = await this.db
      .insert(flashcardDecks)
      .values({
        slug: input.slug,
        title: input.title,
        description: input.description ?? null,
        ownerUserId: input.ownerUserId ?? null,
        tierRequired: input.tierRequired ?? "free",
      })
      .returning();
    if (!deck) throw new Error("Failed to create flashcard deck");
    const createdCards: Flashcard[] = [];
    const inputs = input.cards ?? [];
    for (let index = 0; index < inputs.length; index += 1) {
      const card = inputs[index];
      const [row] = await this.db
        .insert(flashcards)
        .values({
          deckId: deck.id,
          front: card.front,
          back: card.back,
          tags: card.tags ?? [],
          sortOrder: card.sortOrder ?? index,
          createdById: card.createdById ?? null,
        })
        .returning();
      if (row) createdCards.push(row);
    }
    return { ...deck, cards: createdCards };
  }

  /* ── Admin AI agent ─────────────────────────────────────────────────────── */

  /** {@inheritDoc Store.createAgentSession} */
  async createAgentSession(input: {
    userId: string;
    title?: string;
    model?: string | null;
  }): Promise<AgentSession> {
    const [row] = await this.db
      .insert(agentSessions)
      .values({
        userId: input.userId,
        title: input.title ?? "New session",
        model: input.model ?? null,
      })
      .returning();
    if (!row) throw new Error("Failed to create agent session");
    return row;
  }

  /** {@inheritDoc Store.getAgentSession} */
  async getAgentSession(id: string): Promise<AgentSession | null> {
    const [row] = await this.db
      .select()
      .from(agentSessions)
      .where(eq(agentSessions.id, id))
      .limit(1);
    return row ?? null;
  }

  /** {@inheritDoc Store.listAgentSessions} */
  async listAgentSessions(userId: string): Promise<AgentSession[]> {
    return this.db
      .select()
      .from(agentSessions)
      .where(eq(agentSessions.userId, userId))
      .orderBy(desc(agentSessions.createdAt));
  }

  /** {@inheritDoc Store.appendAgentMessage} */
  async appendAgentMessage(
    input: AppendAgentMessageInput,
  ): Promise<AgentMessage> {
    const [row] = await this.db
      .insert(agentMessages)
      .values({
        sessionId: input.sessionId,
        role: input.role,
        content: input.content,
        toolCalls: input.toolCalls ?? null,
        toolCallId: input.toolCallId ?? null,
        toolName: input.toolName ?? null,
        tokensIn: input.tokensIn ?? null,
        tokensOut: input.tokensOut ?? null,
      })
      .returning();
    if (!row) throw new Error("Failed to append agent message");
    return row;
  }

  /** {@inheritDoc Store.listAgentMessages} */
  async listAgentMessages(
    sessionId: string,
    limit = 200,
  ): Promise<AgentMessage[]> {
    return this.db
      .select()
      .from(agentMessages)
      .where(eq(agentMessages.sessionId, sessionId))
      .orderBy(asc(agentMessages.createdAt), asc(agentMessages.id))
      .limit(clampLimit(limit));
  }

  /* ── Notifications ──────────────────────────────────────────────────────── */

  /** {@inheritDoc Store.listSavedLocations} */
  async listSavedLocations(userId: string): Promise<SavedLocation[]> {
    return this.db
      .select()
      .from(savedLocations)
      .where(eq(savedLocations.userId, userId))
      .orderBy(desc(savedLocations.createdAt))
      .limit(200);
  }

  /** {@inheritDoc Store.createSavedLocation} */
  async createSavedLocation(input: CreateSavedLocationInput): Promise<SavedLocation> {
    const [row] = await this.db
      .insert(savedLocations)
      .values({
        userId: input.userId,
        name: input.name,
        latitude: input.latitude,
        longitude: input.longitude,
        note: input.note ?? null,
        snapshot: input.snapshot ?? null,
      })
      .returning();
    if (!row) throw new Error("Failed to save location");
    return row;
  }

  /** {@inheritDoc Store.deleteSavedLocation} */
  async deleteSavedLocation(id: string, userId: string): Promise<boolean> {
    const rows = await this.db
      .delete(savedLocations)
      .where(and(eq(savedLocations.id, id), eq(savedLocations.userId, userId)))
      .returning({ id: savedLocations.id });
    return rows.length > 0;
  }

  /** {@inheritDoc Store.listNotifications} */
  async listNotifications(
    userId: string,
    limit = 50,
  ): Promise<NotificationRow[]> {
    return this.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(clampLimit(limit));
  }

  /** {@inheritDoc Store.createNotification} */
  async createNotification(
    input: CreateNotificationInput,
  ): Promise<NotificationRow> {
    const [row] = await this.db
      .insert(notifications)
      .values({
        userId: input.userId,
        type: input.type ?? "system",
        title: input.title,
        body: input.body ?? null,
        url: input.url ?? null,
        metadata: input.metadata ?? null,
      })
      .returning();
    if (!row) throw new Error("Failed to create notification");
    return row;
  }

  /** {@inheritDoc Store.markNotificationRead} */
  async markNotificationRead(id: string): Promise<NotificationRow | null> {
    const now = new Date();
    const [row] = await this.db
      .update(notifications)
      .set({ readAt: now, updatedAt: now })
      .where(eq(notifications.id, id))
      .returning();
    return row ?? null;
  }

  /* ── Audit ──────────────────────────────────────────────────────────────── */

  /** {@inheritDoc Store.recordAuditLog} */
  async recordAuditLog(input: RecordAuditLogInput): Promise<AuditLogEntry> {
    const [row] = await this.db
      .insert(auditLog)
      .values({
        actorUserId: input.actorUserId ?? null,
        actorIp: input.actorIp ?? null,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        before: input.before ?? null,
        after: input.after ?? null,
        metadata: input.metadata ?? null,
      })
      .returning();
    if (!row) throw new Error("Failed to record audit log entry");
    return row;
  }

  /** {@inheritDoc Store.listAuditLog} */
  async listAuditLog(limit = 100): Promise<AuditLogEntry[]> {
    return this.db
      .select()
      .from(auditLog)
      .orderBy(desc(auditLog.createdAt))
      .limit(clampLimit(limit));
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Shared write helpers
 * ──────────────────────────────────────────────────────────────────────────── */

/** Build a Drizzle update/insert patch from the writable user fields. */
function userInsertPatch(
  fields: UserWritableFields,
): Partial<typeof users.$inferInsert> {
  const patch: Partial<typeof users.$inferInsert> = {};
  if (fields.email !== undefined) patch.email = fields.email;
  if (fields.firstName !== undefined) patch.firstName = fields.firstName;
  if (fields.lastName !== undefined) patch.lastName = fields.lastName;
  if (fields.displayName !== undefined) patch.displayName = fields.displayName;
  if (fields.imageUrl !== undefined) patch.imageUrl = fields.imageUrl;
  if (fields.bio !== undefined) patch.bio = fields.bio;
  if (fields.pronouns !== undefined) patch.pronouns = fields.pronouns;
  if (fields.location !== undefined) patch.location = fields.location;
  if (fields.timezone !== undefined) patch.timezone = fields.timezone;
  if (fields.role !== undefined) patch.role = fields.role;
  if (fields.membershipStatus !== undefined) {
    patch.membershipStatus = fields.membershipStatus;
  }
  if (fields.tier !== undefined) patch.tier = fields.tier;
  if (fields.stripeCustomerId !== undefined) {
    patch.stripeCustomerId = fields.stripeCustomerId;
  }
  if (fields.stripeSubscriptionId !== undefined) {
    patch.stripeSubscriptionId = fields.stripeSubscriptionId;
  }
  if (fields.subscriptionStatus !== undefined) {
    patch.subscriptionStatus = fields.subscriptionStatus;
  }
  if (fields.currentPeriodEnd !== undefined) {
    patch.currentPeriodEnd = fields.currentPeriodEnd;
  }
  if (fields.onboardingCompletedAt !== undefined) {
    patch.onboardingCompletedAt = fields.onboardingCompletedAt;
  }
  if (fields.lastSeenAt !== undefined) patch.lastSeenAt = fields.lastSeenAt;
  if (fields.clerkUpdatedAt !== undefined) {
    patch.clerkUpdatedAt = fields.clerkUpdatedAt;
  }
  return patch;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Selection
 * ──────────────────────────────────────────────────────────────────────────── */

let storeSingleton: Store | null = null;

/**
 * Return the process-wide store: `PostgresStore` when `DATABASE_URL` is set,
 * otherwise the seeded `MemoryStore` demo fallback.
 *
 * The choice is made once per process and cached. `client.ts` reads the env var
 * at import time and never throws, so this is safe to call during `next build`.
 */
export function getStore(): Store {
  if (!storeSingleton) {
    storeSingleton =
      isDatabaseConfigured() && db !== null
        ? new PostgresStore(db)
        : new MemoryStore();
  }
  return storeSingleton;
}
