/**
 * Reads the TRUE, un-filtered timezone abbreviation IANA's own tzdb assigns to a zone —
 * not what a browser's Intl/CLDR chooses to display (see timezones.ts's zoneAbbreviation,
 * which deliberately suppresses ambiguous abbreviations like IST/CST for exactly this
 * reason). This reads the POSIX TZ footer string every v2+ TZif binary file ends with
 * (RFC 8536 §3.3) — e.g. "EST5EDT,M3.2.0,M11.1.0" for America/New_York, or "IST-5:30" for
 * Asia/Kolkata (no DST) — which is IANA's own authoritative encoding of a zone's current
 * standard/daylight abbreviations, straight from the compiled release, with no ambiguity
 * filtering applied. Deliberately not parsed from the human-readable source text (asia,
 * europe, ...): those use a Rule/Zone DSL with historical transitions going back over a
 * century, and resolving "what's the abbreviation *right now*" from that would mean
 * re-implementing most of zic (the real tzdb compiler) — the compiled binary already did
 * that work and states the answer in one line.
 *
 * Requires the build environment's own system tzdata (present on effectively every Linux
 * distribution, including GitHub Actions' ubuntu-latest runners, via the near-universal
 * `tzdata` package) — this is a build-time-only read, never shipped to the browser.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const DEFAULT_ZONEINFO_DIR = "/usr/share/zoneinfo";

/**
 * Extracts the POSIX TZ footer string from a compiled TZif file, or null if the file is
 * missing, isn't a v2+ TZif file (no footer), or has an unexpected shape. The footer sits
 * between the last two newline bytes in the file — no need to parse the binary transition
 * data that precedes it.
 */
export function readPosixTzFooter(zoneId, zoneinfoDir = DEFAULT_ZONEINFO_DIR) {
  let buf;
  try {
    buf = readFileSync(path.join(zoneinfoDir, zoneId));
  } catch {
    return null; // No system tzdata entry for this zone id.
  }
  if (buf.length < 4 || buf.toString("ascii", 0, 4) !== "TZif") return null;
  const lastNewline = buf.lastIndexOf(0x0a);
  if (lastNewline < 1) return null;
  const secondLastNewline = buf.lastIndexOf(0x0a, lastNewline - 1);
  if (secondLastNewline < 0) return null; // v1-only file (rare/ancient) — no footer.
  const footer = buf.toString("ascii", secondLastNewline + 1, lastNewline).trim();
  return footer || null;
}

// A POSIX TZ name is either 3+ letters (EST, IST, ...) or a bracketed <...> form used
// when no traditional letter abbreviation exists (numeric fallbacks like "<+1245>", or
// names containing digits/signs). Matches greedily up to the next offset-looking token.
const TZ_NAME = /(?:<[^>]+>|[A-Za-z]+)/;
const TZ_OFFSET = /[+-]?\d{1,3}(?::\d{2}){0,2}/;
const POSIX_TZ_PATTERN = new RegExp(`^(${TZ_NAME.source})(${TZ_OFFSET.source})(?:(${TZ_NAME.source})(${TZ_OFFSET.source})?)?`);

/**
 * Parses a POSIX TZ footer into { std, dst } abbreviations. `dst` is null for a zone that
 * doesn't currently observe daylight saving. Either field is also null if tzdb had no
 * traditional letter name to assign and fell back to a bracketed numeric-offset form (e.g.
 * Pacific/Chatham's "<+1245>") — that's not a real abbreviation, just the offset spelled
 * differently, so it's treated the same as "none" rather than shown as one.
 */
export function parsePosixTzAbbreviations(footer) {
  if (!footer) return { std: null, dst: null };
  const match = footer.match(POSIX_TZ_PATTERN);
  if (!match) return { std: null, dst: null };
  const [, stdRaw, , dstRaw] = match;
  const clean = (name) => {
    if (!name) return null;
    const unbracketed = name.startsWith("<") ? name.slice(1, -1) : name;
    // A bracketed numeric/sign fallback (e.g. "+1245", "-05") isn't a real abbreviation.
    return /^[+-]?\d/.test(unbracketed) ? null : unbracketed;
  };
  return { std: clean(stdRaw), dst: clean(dstRaw) };
}

/** Convenience: reads and parses in one step. { std: null, dst: null } if unavailable. */
export function tzdbAbbreviations(zoneId, zoneinfoDir = DEFAULT_ZONEINFO_DIR) {
  return parsePosixTzAbbreviations(readPosixTzFooter(zoneId, zoneinfoDir));
}

/**
 * Adds stdAbbreviation/dstAbbreviation to every catalog entry, looked up once per unique
 * timezone (hundreds of catalog entries share the same handful of zones, so this avoids
 * re-reading + re-parsing the same TZif file hundreds of times). Fields are omitted
 * entirely (not set to null) when tzdb has no abbreviation for that zone/period — keeps
 * the shipped JSON free of `"stdAbbreviation": null` clutter across the ~40% of zones
 * that only have a numeric-offset fallback.
 */
export function attachTzdbAbbreviations(entries, zoneinfoDir = DEFAULT_ZONEINFO_DIR) {
  const cache = new Map();
  const lookup = (timezone) => {
    if (!cache.has(timezone)) cache.set(timezone, tzdbAbbreviations(timezone, zoneinfoDir));
    return cache.get(timezone);
  };
  return entries.map((entry) => {
    const { std, dst } = lookup(entry.timezone);
    return {
      ...entry,
      ...(std ? { stdAbbreviation: std } : {}),
      ...(dst ? { dstAbbreviation: dst } : {}),
    };
  });
}
