/**
 * KP ruling planets for a moment and place.
 *
 * Day lord (the weekday lord, where the Vedic day runs sunrise to sunrise),
 * the Ascendant's sign, star and sub lords, and the Moon's sign, star and sub
 * lords. Ruling planets are used to confirm birth time and in KP horary.
 */

import * as Astronomy from "astronomy-engine";
import { DateTime } from "luxon";
import { WEEKDAY_LORDS, type Graha } from "./constants";
import { kpLords } from "./lords";
import { kpCusps, siderealLongitude, type NodeType } from "./positions";

export interface RulingPlanets {
  dayLord: Graha;
  /** Local sunrise that began the Vedic day, ISO; `null` where the Sun does not rise. */
  sunrise: string | null;
  lagnaSignLord: Graha;
  lagnaStarLord: Graha;
  lagnaSubLord: Graha;
  moonSignLord: Graha;
  moonStarLord: Graha;
  moonSubLord: Graha;
  /** Distinct ruling planets in classical order of strength. */
  set: Graha[];
}

/** Weekday lord at a moment, with the day beginning at local sunrise. */
export function vedicDayLord(
  at: Date,
  latitude: number,
  longitude: number,
  timeZone: string,
): { lord: Graha; sunrise: string | null } {
  const local = DateTime.fromJSDate(at, { zone: timeZone });
  const midnight = local.startOf("day");
  const observer = new Astronomy.Observer(latitude, longitude, 0);
  const rise = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, +1, midnight.toJSDate(), 1);
  // Luxon weekday: 1 = Monday … 7 = Sunday. WEEKDAY_LORDS is Sunday-first.
  const weekdayIndex = local.weekday % 7;
  if (!rise) return { lord: WEEKDAY_LORDS[weekdayIndex], sunrise: null };
  const sunrise = rise.date;
  const beforeSunrise = at.getTime() < sunrise.getTime();
  const index = beforeSunrise ? (weekdayIndex + 6) % 7 : weekdayIndex;
  return {
    lord: WEEKDAY_LORDS[index],
    sunrise: DateTime.fromJSDate(sunrise, { zone: timeZone }).toISO(),
  };
}

export function rulingPlanets(
  at: Date,
  latitude: number,
  longitude: number,
  timeZone: string,
  nodeType: NodeType = "mean",
): RulingPlanets {
  const day = vedicDayLord(at, latitude, longitude, timeZone);
  const lagna = kpLords(kpCusps(at, latitude, longitude).ascendant);
  const moon = kpLords(siderealLongitude("moon", at, nodeType));
  const ordered: Graha[] = [
    lagna.subLord,
    lagna.starLord,
    lagna.signLord,
    moon.subLord,
    moon.starLord,
    moon.signLord,
    day.lord,
  ];
  return {
    dayLord: day.lord,
    sunrise: day.sunrise,
    lagnaSignLord: lagna.signLord,
    lagnaStarLord: lagna.starLord,
    lagnaSubLord: lagna.subLord,
    moonSignLord: moon.signLord,
    moonStarLord: moon.starLord,
    moonSubLord: moon.subLord,
    set: [...new Set(ordered)],
  };
}
