/**
 * `GET /api/geocode` — birthplace search.
 *
 * Coordinates come from OpenStreetMap's Nominatim. Nominatim does **not**
 * reliably return an IANA timezone, and guessing one from a country would be
 * wrong for every multi-zone country (the United States, Russia, Australia,
 * Brazil…), so the zone is looked up from the coordinates against timeapi.io
 * and returned as `null` when that lookup fails. A null zone is a first-class
 * answer: the intake then asks the person to choose, because a silently guessed
 * zone moves the Ascendant and can move the whole bodygraph.
 *
 * Operational limits, stated plainly:
 * - The rate limiter and the response cache are in-memory and therefore
 *   per-instance. A serverless deployment with several instances allows the
 *   configured rate per instance, and the cache is not shared or persisted. It
 *   is a courtesy guard against a runaway client, not a security control.
 * - Nominatim's usage policy requires a descriptive `User-Agent` and asks that
 *   results be cached; both are honoured here.
 */

import type { NextRequest } from "next/server";
import { clientIp } from "@/lib/http/client-ip";

/** One place suggestion, shaped for the intake's type-ahead. */
export interface GeocodeResult {
  /** The short place name, e.g. "Montreal". */
  name: string;
  /** The full postal-style label, for disambiguation. */
  displayName: string;
  latitude: number;
  longitude: number;
  /** IANA zone, or `null` when it could not be resolved. Never guessed. */
  timeZone: string | null;
  country: string | null;
  /** State, province, or region, when Nominatim supplies one. */
  admin1: string | null;
}

interface GeocodePayload {
  results: GeocodeResult[];
}

interface CachedResponse {
  expiresAt: number;
  payload: GeocodePayload;
}

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const TIMEZONE_ENDPOINT = "https://timeapi.io/api/TimeZone/coordinate";

/** Nominatim's policy requires a real identifier; the URL is the contact. */
const USER_AGENT = "TheCipher/1.0 (+https://cipher.vercel.app)";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_MS = 1000;
const MAX_RESULTS = 6;
const FETCH_TIMEOUT_MS = 7000;
const MAX_CACHE_ENTRIES = 500;
const MAX_RATE_ENTRIES = 5000;

const responseCache = new Map<string, CachedResponse>();
const timeZoneCache = new Map<string, string | null>();
const lastRequestAt = new Map<string, number>();

/**
 * Apply the per-IP rate limit.
 *
 * @returns `true` when the request may proceed.
 */
function allowRequest(ip: string): boolean {
  const now = Date.now();
  if (lastRequestAt.size > MAX_RATE_ENTRIES) {
    for (const [key, at] of lastRequestAt) {
      if (now - at > RATE_LIMIT_MS * 60) lastRequestAt.delete(key);
    }
  }
  const previous = lastRequestAt.get(ip);
  if (previous !== undefined && now - previous < RATE_LIMIT_MS) return false;
  lastRequestAt.set(ip, now);
  return true;
}

function pruneCache(now: number): void {
  if (responseCache.size <= MAX_CACHE_ENTRIES) return;
  for (const [key, entry] of responseCache) {
    if (entry.expiresAt <= now) responseCache.delete(key);
  }
}

interface NominatimPlace {
  display_name?: unknown;
  name?: unknown;
  lat?: unknown;
  lon?: unknown;
  address?: Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/**
 * Resolve an IANA zone from coordinates.
 *
 * @returns The zone, or `null` when the service is unavailable, over quota, or
 *   returns something that is not a zone string. Never a default.
 */
async function timeZoneFor(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  const key = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
  const cached = timeZoneCache.get(key);
  if (cached !== undefined) return cached;

  let zone: string | null = null;
  try {
    const url = `${TIMEZONE_ENDPOINT}?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    });
    if (response.ok) {
      const data: unknown = await response.json();
      if (data && typeof data === "object") {
        const record = data as Record<string, unknown>;
        zone = asString(record.timeZone) ?? asString(record.timeZoneName);
      }
    }
  } catch {
    // Any failure degrades to `null`. The UI asks the person to choose rather
    // than being handed a plausible-looking wrong zone.
    zone = null;
  }

  timeZoneCache.set(key, zone);
  return zone;
}

async function searchNominatim(query: string): Promise<GeocodeResult[] | null> {
  const url = `${NOMINATIM_ENDPOINT}?format=jsonv2&limit=${MAX_RESULTS}&addressdetails=1&q=${encodeURIComponent(query)}`;
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en",
        "User-Agent": USER_AGENT,
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (!Array.isArray(data)) return null;

    const places = data.slice(0, MAX_RESULTS) as NominatimPlace[];
    const zones = await Promise.all(
      places.map((place) => {
        const latitude = asFiniteNumber(place.lat) ?? 0;
        const longitude = asFiniteNumber(place.lon) ?? 0;
        return timeZoneFor(latitude, longitude);
      }),
    );

    return places.flatMap((place, index) => {
      const latitude = asFiniteNumber(place.lat);
      const longitude = asFiniteNumber(place.lon);
      if (latitude === null || longitude === null) return [];
      const displayName = asString(place.display_name) ?? `${latitude}, ${longitude}`;
      const address = place.address ?? {};
      return [
        {
          name:
            asString(place.name) ??
            asString(address.city) ??
            asString(address.town) ??
            asString(address.village) ??
            displayName.split(",")[0]?.trim() ??
            displayName,
          displayName,
          latitude,
          longitude,
          timeZone: zones[index] ?? null,
          country: asString(address.country),
          admin1:
            asString(address.state) ??
            asString(address.region) ??
            asString(address.county),
        },
      ];
    });
  } catch {
    return null;
  }
}

/**
 * Search a birthplace and resolve each candidate's IANA timezone.
 *
 * @param request - `?q=` is the free-text place query.
 * @returns `{ results }` on success, and `{ error, results: [] }` with a 4xx/5xx
 *   status on failure. The shape is stable so the client never has to guess.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return Response.json(
      { error: "Enter at least two characters to search.", results: [] },
      { status: 400 },
    );
  }
  if (query.length > 120) {
    return Response.json(
      { error: "That search is too long. Try a town or city name.", results: [] },
      { status: 400 },
    );
  }

  const ip = clientIp(request);
  if (!allowRequest(ip)) {
    return Response.json(
      { error: "One lookup per second, please. Try again in a moment.", results: [] },
      { status: 429, headers: { "Retry-After": "1" } },
    );
  }

  const now = Date.now();
  pruneCache(now);
  const cacheKey = query.toLowerCase();
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return Response.json(cached.payload);
  }

  const results = await searchNominatim(query);
  if (results === null) {
    return Response.json(
      {
        error:
          "The place lookup service is unavailable right now. Enter your coordinates and timezone by hand below.",
        results: [],
      },
      { status: 502 },
    );
  }

  const payload: GeocodePayload = { results };
  responseCache.set(cacheKey, { expiresAt: now + CACHE_TTL_MS, payload });
  return Response.json(payload);
}
