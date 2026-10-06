import type { KpBirthInput } from "@/lib/kp/chart";
import type { NodeType } from "@/lib/kp/positions";

/**
 * Shareable chart codes.
 *
 * The reading is the acquisition hook, so it must be viewable without an
 * account. Rather than storing every anonymous chart in the database, the
 * birth data is packed into a short URL-safe code. That makes every reading
 * shareable, permanent, and free to serve — and it means a visitor can send
 * someone their chart without either of them signing up.
 *
 * Format (little-endian, then base64url):
 *
 *   byte 0        version (2; version 1 is still decoded)
 *   bytes 1–2     year, uint16 (version 1 stored year − 1900, which could
 *                 not represent births before 1900 and clamped them to 1900)
 *   byte 3        month 1–12
 *   byte 4        day 1–31
 *   byte 5        hour 0–23
 *   byte 6        minute 0–59
 *   byte 7        second 0–59
 *   bytes 8–11    latitude  × 100000, int32
 *   bytes 12–15   longitude × 100000, int32
 *   byte 16       KP flags: bits 0–1 DST fold (0 none, 1 earlier, 2 later),
 *                 bit 2 node type (0 mean, 1 true). Always 0 in version 1.
 *   bytes 17–19   reserved, 0
 *   byte 20       timezone name length (UTF-8 bytes)
 *   bytes 21..    timezone name (IANA), UTF-8
 *   last byte     FNV-1a checksum of everything before it, truncated to 8 bits
 *
 * The checksum means a mistyped or truncated link fails loudly instead of
 * silently computing a chart for the wrong moment.
 */

const VERSION = 2;
/** Year offset by format version. Version 1 links remain decodable. */
const YEAR_OFFSET_BY_VERSION: Readonly<Record<number, number>> = { 1: 1900, 2: 0 };

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(code: string): Uint8Array | null {
  try {
    const padded =
      code.replace(/-/g, "+").replace(/_/g, "/") +
      "=".repeat((4 - (code.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/** FNV-1a, truncated to one byte. */
function checksum(bytes: Uint8Array): number {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash & 0xff;
}

/** Everything a shared link must reproduce: the verified birth moment and the node choice. */
export interface ShareableBirth extends KpBirthInput {
  nodeType?: NodeType;
}

export function encodeBirthInput(input: ShareableBirth): string {
  const tzBytes = new TextEncoder().encode(input.timeZone);
  if (tzBytes.length > 64) {
    throw new Error("Timezone name is unreasonably long");
  }

  const buffer = new Uint8Array(21 + tzBytes.length + 1);
  const view = new DataView(buffer.buffer);
  let offset = 0;

  buffer[offset++] = VERSION;
  if (!Number.isInteger(input.year) || input.year < 1 || input.year > 0xffff) {
    throw new RangeError(`Birth year ${input.year} cannot be encoded.`);
  }
  view.setUint16(offset, input.year, true);
  offset += 2;
  buffer[offset++] = input.month;
  buffer[offset++] = input.day;
  buffer[offset++] = input.hour;
  buffer[offset++] = input.minute;
  buffer[offset++] = input.second ?? 0;
  view.setInt32(offset, Math.round(input.latitude * 100000), true);
  offset += 4;
  view.setInt32(offset, Math.round(input.longitude * 100000), true);
  offset += 4;
  const foldBits = input.fold === "earlier" ? 1 : input.fold === "later" ? 2 : 0;
  view.setUint32(offset, foldBits | (input.nodeType === "true" ? 4 : 0), true);
  offset += 4;
  buffer[offset++] = tzBytes.length;
  buffer.set(tzBytes, offset);
  offset += tzBytes.length;
  buffer[offset] = checksum(buffer.subarray(0, offset));

  return toBase64Url(buffer);
}

export interface DecodedBirth {
  input: ShareableBirth;
  /** The place name is not carried in the code; callers may re-geocode. */
  ok: true;
}

export function decodeBirthInput(code: string): DecodedBirth | null {
  const bytes = fromBase64Url(code);
  if (!bytes || bytes.length < 22) return null;

  const expected = bytes[bytes.length - 1];
  if (checksum(bytes.subarray(0, bytes.length - 1)) !== expected) return null;
  const yearOffset = YEAR_OFFSET_BY_VERSION[bytes[0]];
  if (yearOffset === undefined) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 1;
  const year = view.getUint16(offset, true) + yearOffset;
  offset += 2;
  const month = bytes[offset++];
  const day = bytes[offset++];
  const hour = bytes[offset++];
  const minute = bytes[offset++];
  const second = bytes[offset++];
  const latitude = view.getInt32(offset, true) / 100000;
  offset += 4;
  const longitude = view.getInt32(offset, true) / 100000;
  offset += 4;
  const flags = bytes[offset];
  offset += 4;
  const fold: KpBirthInput["fold"] = (flags & 3) === 1 ? "earlier" : (flags & 3) === 2 ? "later" : undefined;
  const nodeType: NodeType = flags & 4 ? "true" : "mean";

  const tzLength = bytes[offset++];
  if (offset + tzLength > bytes.length - 1) return null;
  const timeZone = new TextDecoder().decode(
    bytes.subarray(offset, offset + tzLength),
  );
  offset += tzLength;

  const valid =
    year >= 1 &&
    year <= 9999 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= 31 &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59 &&
    second >= 0 &&
    second <= 59 &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    timeZone.length > 0;

  if (!valid) return null;

  return {
    ok: true,
    input: { year, month, day, hour, minute, second, timeZone, latitude, longitude, fold, nodeType },
  };
}

/** Human-readable label for a chart code, used in headings and share text. */
export function describeBirth(input: ShareableBirth): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const date = `${input.day} ${months[input.month - 1]} ${input.year}`;
  const time = `${pad(input.hour)}:${pad(input.minute)}:${pad(input.second ?? 0)}`;
  const lat = `${Math.abs(input.latitude).toFixed(2)}°${input.latitude >= 0 ? "N" : "S"}`;
  const lon = `${Math.abs(input.longitude).toFixed(2)}°${input.longitude >= 0 ? "E" : "W"}`;
  return `${date} · ${time} ${input.timeZone} · ${lat} ${lon}`;
}
