/**
 * Encodes/decodes the plan (which zones, which date/time) into URL query params, so a
 * link can be copied and shared without any server-side storage — consistent with the
 * privacy policy's "the tool retains nothing" promise: the state lives only in the URL
 * the user chooses to share, not in a database, cookie, or localStorage anywhere.
 *
 * Deliberately narrow: only the "plan" itself (zones, date, start/end time) round-trips
 * through the link. Secondary UI state — a manually-overridden reference zone, the
 * "Best time" chevron nudge — is left out on purpose; the link is for "here's the meeting
 * I'm proposing," not a pixel-perfect session replay.
 */
export interface ShareableState {
  zoneIds: string[];
  dateStr: string;
  startTime: string;
  endTime: string;
}

const PARAM_ZONES = "zones";
const PARAM_DATE = "date";
const PARAM_START = "start";
const PARAM_END = "end";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function encodeStateToSearchParams(state: ShareableState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.zoneIds.length > 0) params.set(PARAM_ZONES, state.zoneIds.join(","));
  params.set(PARAM_DATE, state.dateStr);
  params.set(PARAM_START, state.startTime);
  params.set(PARAM_END, state.endTime);
  return params;
}

/**
 * Reads back whatever of `ShareableState` is present and valid in `params`. Never throws
 * and never returns a partially-invalid field — each field is independently validated
 * (a malformed date doesn't block a valid zone list, etc.) and simply omitted if it
 * doesn't check out, so the caller's own defaults fill the gap rather than crashing on a
 * hand-edited or corrupted link.
 */
export function decodeStateFromSearchParams(
  params: URLSearchParams,
  isKnownZoneId: (id: string) => boolean,
): Partial<ShareableState> {
  const result: Partial<ShareableState> = {};

  const zonesRaw = params.get(PARAM_ZONES);
  if (zonesRaw) {
    const ids = zonesRaw
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0 && isKnownZoneId(id));
    if (ids.length > 0) result.zoneIds = ids;
  }

  const date = params.get(PARAM_DATE);
  if (date && DATE_PATTERN.test(date)) result.dateStr = date;

  const start = params.get(PARAM_START);
  if (start && TIME_PATTERN.test(start)) result.startTime = start;

  const end = params.get(PARAM_END);
  if (end && TIME_PATTERN.test(end)) result.endTime = end;

  return result;
}
