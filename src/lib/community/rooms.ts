/**
 * The Starseed Collective — the community's rooms.
 *
 * One catalogue, used to seed the demo store, to create any missing rooms in a
 * real database on first visit (`ensureCollectiveRooms`), and to connect rooms
 * to the interests members choose for matching and recommendations.
 */

import type { Store } from "../db/store";
import type { TierKey } from "../db/schema";

export interface CollectiveRoom {
  slug: string;
  name: string;
  description: string;
  /** Interest ids (from `MATCH_INTERESTS`) this room serves. */
  interests: string[];
  /** Minimum tier to read and post; null = any approved member. */
  tierRequired: TierKey | null;
}

export const COLLECTIVE_ROOMS: readonly CollectiveRoom[] = [
  {
    slug: "general",
    name: "Arrivals",
    description: "Arrivals, introductions and everyday conversation across the whole Collective.",
    interests: [],
    tierRequired: null,
  },
  {
    slug: "starseed-origins",
    name: "Starseed Origins",
    description: "Where you feel you come from and what you came here to do. Story and memory, held without doctrine.",
    interests: ["starseed"],
    tierRequired: null,
  },
  {
    slug: "dasha-circle",
    name: "Dasha Circle",
    description: "Compare running mahadashas and bhuktis, and what each period has actually brought.",
    interests: ["kp-timing"],
    tierRequired: null,
  },
  {
    slug: "prashna-room",
    name: "Prashna Room",
    description: "KP horary: post a question and the moment you asked it; judge it together with ruling planets.",
    interests: ["kp-horary"],
    tierRequired: "initiate",
  },
  {
    slug: "lines-and-places",
    name: "Lines & Places",
    description: "Astrocartography travel notes: the places on your lines and what happened there.",
    interests: ["astrocartography"],
    tierRequired: null,
  },
  {
    slug: "experiments",
    name: "Design Experiments",
    description: "Human Design in practice: try the strategy, report what happened.",
    interests: ["human-design", "research"],
    tierRequired: null,
  },
  {
    slug: "signal-studio",
    name: "Signal Studio",
    description: "Creative work, craft and business — making things from your chart, and showing them.",
    interests: ["creative", "business", "teaching"],
    tierRequired: "initiate",
  },
  {
    slug: "sanctuary",
    name: "Sanctuary",
    description: "Meditation, breath, relationships and the healing arts. Slower, quieter, kind.",
    interests: ["meditation", "healing", "relationships"],
    tierRequired: null,
  },
] as const;

export const ROOM_BY_SLUG: ReadonlyMap<string, CollectiveRoom> = new Map(
  COLLECTIVE_ROOMS.map((room) => [room.slug, room]),
);

/**
 * Create any Collective room missing from the store. Idempotent; existing
 * rooms (including renamed ones) are left exactly as they are.
 */
export async function ensureCollectiveRooms(store: Store): Promise<void> {
  for (const room of COLLECTIVE_ROOMS) {
    if (await store.getChannelBySlug(room.slug)) continue;
    try {
      await store.createChannel({
        slug: room.slug,
        name: room.name,
        description: room.description,
        tierRequired: room.tierRequired,
      });
    } catch {
      // A concurrent request may have created it first.
    }
  }
}
