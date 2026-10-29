import type { Transit } from "@/components/cipher/sky/bodies";
import { GRAHA_LABEL, RASIS } from "@/lib/kp/constants";
import { siderealPositions } from "@/lib/kp/positions";

/**
 * Today's sky, cast on the server by the KP engine — sidereal, KP ayanamsa,
 * mean node, as the world's Sky Wheel does. Marketing pages render per
 * request (the auth proxy makes them dynamic), so the cast is kept for half
 * an hour: about the time the Moon, the fastest of the grahas, takes to cross
 * a quarter of a degree.
 */
const SKY_TTL_MS = 30 * 60 * 1000;
let cached: { at: number; sky: Transit[] } | null = null;

export function todaysSky(): Transit[] {
  const now = Date.now();
  if (cached && now - cached.at < SKY_TTL_MS) return cached.sky;
  const sky = castSky(new Date(now));
  cached = { at: now, sky };
  return sky;
}

function castSky(date: Date): Transit[] {
  return siderealPositions(date, "mean").map((position) => {
    const rasi = RASIS[Math.min(11, Math.floor(position.longitude / 30))];
    return {
      graha: position.graha,
      longitude: position.longitude,
      latitude: position.latitude,
      retrograde: position.retrograde,
      name: GRAHA_LABEL[position.graha].english,
      place: `${rasi.sanskrit} ${Math.floor(position.longitude % 30)}°`,
    };
  });
}
