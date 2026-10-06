/**
 * A relocated KP chart: the same birth instant cast for another place.
 *
 * Planet positions do not change with place; the cusps, and therefore every
 * graha's house and the cuspal sub lords, do. Lines within `radiusKm` of the
 * place are reported with their distance.
 */

import { GRAHA_DISPLAY_ORDER, type Graha } from "../kp/constants";
import { kpLords } from "../kp/lords";
import { houseOf, kpCusps, siderealLongitude, type NodeType } from "../kp/positions";
import { astrocartography, distanceToLineKm, type AngleLine } from "./lines";

export interface RelocatedChart {
  latitude: number;
  longitude: number;
  cusps: Array<{
    house: number;
    longitude: number;
    rasi: string;
    signLord: Graha;
    starLord: Graha;
    subLord: Graha;
  }>;
  houses: Array<{ graha: Graha; house: number }>;
  nearby: Array<{ graha: Graha; angle: AngleLine; km: number }>;
}

export const NEARBY_RADIUS_KM = 600;

export function relocate(
  birthInstant: Date,
  latitude: number,
  longitude: number,
  nodeType: NodeType = "mean",
  radiusKm = NEARBY_RADIUS_KM,
): RelocatedChart {
  const { cusps } = kpCusps(birthInstant, latitude, longitude);
  return {
    latitude,
    longitude,
    cusps: cusps.map((value, i) => {
      const lords = kpLords(value);
      return {
        house: i + 1,
        longitude: value,
        rasi: lords.rasi.sanskrit,
        signLord: lords.signLord,
        starLord: lords.starLord,
        subLord: lords.subLord,
      };
    }),
    houses: GRAHA_DISPLAY_ORDER.map((graha) => ({
      graha,
      house: houseOf(siderealLongitude(graha, birthInstant, nodeType), cusps),
    })),
    nearby: astrocartography(birthInstant, nodeType)
      .map((line) => ({ graha: line.graha, angle: line.angle, km: distanceToLineKm(line, latitude, longitude) }))
      .filter((entry) => entry.km <= radiusKm)
      .sort((a, b) => a.km - b.km)
      .map((entry) => ({ ...entry, km: Math.round(entry.km) })),
  };
}
