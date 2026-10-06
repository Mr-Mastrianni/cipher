import Link from "next/link";
import type { Metadata } from "next";
import { Hash, Lock, MessagesSquare, Sparkles } from "lucide-react";
import { clerkConfigured, getCurrentUser } from "@/lib/auth";
import { ensureCollectiveRooms } from "@/lib/community/rooms";
import { getStore } from "@/lib/db/store";
import { getCompleteProfile } from "@/lib/cipher/profile-snapshot";
import type { BirthProfile, Channel, User } from "@/lib/db/schema";
import type { AuraAvatar } from "@/lib/cipher/aura-avatar";
import { categorizeMember, type MemberCategory } from "@/lib/cipher/categorization";
import { CHANNEL_BY_GATES, channelKey, type CenterKey } from "@/lib/human-design";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, PageShell } from "@/components/chrome/page-shell";
import { Section } from "@/components/chrome/section";
import { timeAgo } from "@/lib/utils";

/**
 * The community index.
 *
 * Channels are grouped by the room they belong to: the four type cohorts, the
 * three circuit archetypes, the six lanes, and general. The member's own
 * placement — derived from their stored bodygraph — is shown first and used to
 * badge the rooms they are being pointed at, so the categorisation is visible
 * rather than implied.
 */

export const metadata: Metadata = {
  title: "Community",
  robots: { index: false, follow: false },
};

const DEMO_MEMBER_CLERK_ID = "user_demo_member";

/** Ascending tier order for lock labels. */
const TIER_RANK: Readonly<Record<string, number>> = {
  free: 0,
  initiate: 1,
  adept: 2,
  oracle: 3,
};

/** The four groups a channel can belong to. */
type ChannelGroup = "cohort" | "archetype" | "lane" | "general";

const GROUP_LABEL: Readonly<Record<ChannelGroup, string>> = {
  cohort: "Type cohorts",
  archetype: "Archetypes",
  lane: "Lanes",
  general: "General",
};

const GROUP_ORDER: readonly ChannelGroup[] = ["cohort", "archetype", "lane", "general"];

/**
 * Classify a channel by its slug.
 *
 * The schema stores only public/private, because visibility and placement are
 * different axes. Placement is encoded in the slug convention the categoriser
 * emits: `the-*` for type cohorts, `archetype-*` for circuitry, `lane-*` for
 * aura-format lanes, everything else general.
 *
 * @param slug - The channel slug.
 * @returns The group the channel belongs to.
 */
function groupOf(slug: string): ChannelGroup {
  if (slug.startsWith("the-") || slug.startsWith("cohort-")) return "cohort";
  if (slug.startsWith("archetype-")) return "archetype";
  if (slug.startsWith("lane-")) return "lane";
  return "general";
}

/**
 * Resolve the member, falling back to the seeded demo member without Clerk.
 *
 * @returns The member, or `null`.
 */
async function currentMember(): Promise<User | null> {
  const signedIn = await getCurrentUser();
  if (signedIn) return signedIn;
  if (!clerkConfigured) return getStore().getUserByClerkId(DEMO_MEMBER_CLERK_ID);
  return null;
}

/**
 * Rebuild the chip-scale avatar the categoriser reads for the member's lane.
 *
 * @param profile - The member's birth profile.
 * @returns An avatar whose `format` is the stored format, or `null`.
 */
function laneAvatar(profile: BirthProfile | null): AuraAvatar | null {
  if (!profile || !profile.auraFormat) return null;
  return {
    seat: profile.auraSeat || "Seat",
    format: profile.auraFormat,
    label: profile.auraLabel || profile.auraFormat,
    seatGate: 0,
    seatCentre: "throat",
    seatCentreName: "Throat",
    seatCentreOpen: false,
    formatLine: 0,
    formatNote: "",
    formatCount: 0,
    coordinate: "",
    contested: false,
  };
}

/** Build the categoriser's centre map from the stored defined-centre list. */
function centersFrom(defined: readonly CenterKey[]): Record<CenterKey, { defined: boolean }> {
  const has = (key: CenterKey) => ({ defined: defined.includes(key) });
  return {
    head: has("head"),
    ajna: has("ajna"),
    throat: has("throat"),
    g: has("g"),
    heart: has("heart"),
    spleen: has("spleen"),
    solar: has("solar"),
    sacral: has("sacral"),
    root: has("root"),
  };
}

/**
 * Derive the member's cohort, archetype and lane from their stored bodygraph.
 *
 * @param profile - The member's birth profile.
 * @returns The placement, or `null` when no bodygraph is stored.
 */
function placementFor(profile: BirthProfile | null): MemberCategory | null {
  const graph = profile?.bodygraph;
  if (!graph) return null;
  return categorizeMember(
    {
      type: graph.type,
      authority: graph.authority,
      profile: graph.profile,
      definition: graph.definition,
      centers: centersFrom(graph.definedCenters),
      channels: graph.channels.map((channel) => ({
        gates: channel.gates,
        circuit:
          CHANNEL_BY_GATES.get(channelKey(channel.gates[0], channel.gates[1]))?.circuit ??
          "collective",
      })),
      gates: graph.gates.map((gate) => gate.gate),
    },
    laneAvatar(profile),
  );
}

/** The latest-message summary shown on each channel card. */
interface ChannelPreview {
  body: string;
  author: string;
  createdAt: Date;
}

/**
 * The community page.
 *
 * @returns The grouped channel list with the member's placement.
 */
export default async function CommunityPage() {
  const user = await currentMember();
  if (!user) return null;

  const store = getStore();
  // Create any Starseed Collective room a real database does not have yet.
  await ensureCollectiveRooms(store);
  const [channels, profile] = await Promise.all([
    store.listChannels(),
    getCompleteProfile(user.id),
  ]);
  const placement = placementFor(profile);

  const recommended = new Set(
    placement ? [placement.cohort.channel, placement.archetype.channel, placement.lane.channel] : [],
  );

  const previews = new Map<string, ChannelPreview>();
  for (const channel of channels) {
    const page = await store.listMessages(channel.id, { limit: 1 });
    const latest = page.items[0];
    if (!latest || latest.deletedAt) continue;
    const author = await store.getUserById(latest.authorId);
    previews.set(channel.id, {
      body: latest.body,
      author:
        author?.displayName ??
        ([author?.firstName, author?.lastName].filter(Boolean).join(" ") || "Member"),
      createdAt: latest.createdAt,
    });
  }

  const grouped = new Map<ChannelGroup, Channel[]>();
  for (const channel of channels) {
    const group = groupOf(channel.slug);
    const list = grouped.get(group) ?? [];
    list.push(channel);
    grouped.set(group, list);
  }

  return (
    <PageShell width="lg">
      <PageHeader
        eyebrow="The Starseed Collective"
        title="The rooms"
        description="A community space for starseeds, KP students and Human Design experimenters. Every room has a purpose: start in the one you were placed in, find your people through cosmic matching, and read before you post."
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href="/dashboard/messages">
              Direct messages
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-12">
        {placement ? (
          <Section
            eyebrow="Your placement"
            title="Where you were put, and why"
            description="Placement is derived from your own chart: the type cohort from your Type, the archetype from your dominant circuitry, the lane from your Aura Avatar format."
          >
            <ul className="grid gap-4 sm:grid-cols-3">
              {(
                [
                  ["Cohort", placement.cohort],
                  ["Archetype", placement.archetype],
                  ["Lane", placement.lane],
                ] as const
              ).map(([label, entry]) => (
                <li key={entry.id} className="surface flex flex-col gap-2 rounded-lg p-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-faint">
                    {label}
                  </p>
                  <p className="font-display text-lg text-bone">{entry.name}</p>
                  <p className="text-xs leading-relaxed text-muted">{entry.description}</p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold">
                    #{entry.channel}
                  </p>
                </li>
              ))}
            </ul>
          </Section>
        ) : (
          <EmptyState
            icon={<Sparkles className="h-5 w-5" />}
            title="No placement yet"
            description="Your cohort, archetype and lane are read from your bodygraph. Add your birth data and the rooms organise themselves."
            action={
              <Button asChild variant="primary" size="sm">
                <Link href="/onboarding">Complete onboarding</Link>
              </Button>
            }
          />
        )}

        {channels.length === 0 ? (
          <EmptyState
            icon={<MessagesSquare className="h-5 w-5" />}
            title="No channels yet"
            description="The first cohort opens the rooms. Nothing to read until then."
          />
        ) : (
          GROUP_ORDER.filter((group) => (grouped.get(group)?.length ?? 0) > 0).map((group) => (
            <Section
              key={group}
              eyebrow="Channels"
              title={GROUP_LABEL[group]}
              description={
                group === "general"
                  ? "Open to every approved member."
                  : "Rooms tied to a placement. You can read any of them; the highlighted one is yours."
              }
            >
              <ul className="grid gap-4 sm:grid-cols-2">
                {(grouped.get(group) ?? []).map((channel) => {
                  const preview = previews.get(channel.id);
                  const isRecommended = recommended.has(channel.slug);
                  const locked =
                    channel.tierRequired !== null &&
                    (TIER_RANK[user.tier] ?? 0) < (TIER_RANK[channel.tierRequired] ?? 0) &&
                    user.role !== "admin";
                  return (
                    <li key={channel.id}>
                      <Link
                        href={`/dashboard/community/${channel.slug}`}
                        className={`surface flex h-full flex-col gap-3 rounded-lg p-5 transition-colors ${
                          isRecommended
                            ? "border-gold/50 hover:border-gold"
                            : "hover:border-gold/40"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            {channel.kind === "private" ? (
                              <Lock aria-hidden="true" className="h-4 w-4 text-faint" />
                            ) : (
                              <Hash aria-hidden="true" className="h-4 w-4 text-gold" />
                            )}
                            <span className="font-display text-lg text-bone">
                              {channel.name}
                            </span>
                          </div>
                          {isRecommended ? (
                            <Badge tone="gold" size="sm">
                              Your room
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-sm leading-relaxed text-muted">
                          {channel.description ?? "No description yet."}
                        </p>
                        {preview ? (
                          <p className="text-xs leading-relaxed text-faint">
                            <span className="text-muted">{preview.author}</span>:{" "}
                            <span className="line-clamp-2">{preview.body}</span>
                            <span className="ml-1">· {timeAgo(preview.createdAt)}</span>
                          </p>
                        ) : (
                          <p className="text-xs text-faint">No messages yet.</p>
                        )}
                        {locked ? (
                          <Badge tone="warn" size="sm">
                            Unlocks at {channel.tierRequired}
                          </Badge>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Section>
          ))
        )}
      </div>
    </PageShell>
  );
}
