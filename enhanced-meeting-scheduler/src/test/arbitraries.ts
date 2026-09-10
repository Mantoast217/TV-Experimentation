/**
 * Shared fast-check generators for the property-based ("fuzz") test suite. Import from
 * here rather than redefining a generator per test file.
 *
 * Iteration count: read from FC_NUM_RUNS so CI can run a low count on every PR and a much
 * higher count on a scheduled/nightly job without editing test files — see
 * package.json's "test:property" script and .github/workflows/ci.yml /
 * fuzz-nightly.yml. fast-check's default failure output already includes the failing
 * seed and a minimal shrunk counterexample, so a CI failure is reproducible locally by
 * copying that seed into a local run — no extra logging config needed.
 */
import { DateTime } from "luxon";
import fc from "fast-check";

export const NUM_RUNS = Number(process.env.FC_NUM_RUNS) || 1000;

/**
 * Scales a vitest test timeout to NUM_RUNS so the nightly high-iteration run
 * (FC_NUM_RUNS=50000) doesn't trip vitest's default 5s limit just because a test was
 * only sized for the every-PR default of 1000. Pass as the third argument to `it(...)`.
 * `msPerIteration` should reflect the real per-iteration cost (pure-logic property tests
 * are cheap; tests that mount React components need a much larger budget — see
 * ZoneTimeList.property.test.tsx).
 */
export function scaledTimeout(msPerIteration: number): number {
  return Math.max(60_000, NUM_RUNS * msPerIteration);
}

/** The runtime's real, full list of IANA zone identifiers — not a hardcoded subset. */
export const ALL_IANA_TIMEZONES: readonly string[] = Intl.supportedValuesOf("timeZone");

/**
 * A valid IANA timezone identifier, drawn from the actual runtime-supported list. This
 * naturally includes unusual offsets (Pacific/Kiritimati at UTC+14, Pacific/Midway-style
 * negative extremes, half-hour offsets like Asia/Kathmandu, and the 45-minute offset at
 * Australia/Eucla) simply because they're real entries in the real list.
 */
export function ianaTimezone(): fc.Arbitrary<string> {
  return fc.constantFrom(...ALL_IANA_TIMEZONES);
}

/** A UTC-safe "YYYY-MM-DD" string for a given JS Date, independent of host TZ. */
function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * A random calendar date as "YYYY-MM-DD", weighted toward a wide 2020-2035 range but
 * regularly hitting known edge dates (a leap-year Feb 29, year boundaries).
 */
export function isoDateInRange(): fc.Arbitrary<string> {
  const wide = fc
    .date({ min: new Date(Date.UTC(2020, 0, 1)), max: new Date(Date.UTC(2035, 11, 31)), noInvalidDate: true })
    .map(toDateStr);
  const edgeCases = fc.constantFrom(
    "2020-02-29", // leap year
    "2024-02-29", // leap year
    "2032-02-29", // leap year
    "2020-12-31",
    "2020-01-01",
    "2035-12-31",
    "2021-02-28", // non-leap year end of Feb
  );
  return fc.oneof({ weight: 4, arbitrary: wide }, { weight: 1, arbitrary: edgeCases });
}

export interface StartAndDuration {
  startHour: number;
  startMinute: number;
  durationMinutes: number;
}

/**
 * A random start time and duration. Duration ranges up to 2 days so that, combined with
 * isoDateInRange()'s edge dates, generated slots regularly push the end time past
 * midnight, past month-end, and past year-end.
 */
export function startAndDuration(): fc.Arbitrary<StartAndDuration> {
  return fc.record({
    startHour: fc.integer({ min: 0, max: 23 }),
    startMinute: fc.integer({ min: 0, max: 59 }),
    durationMinutes: fc.integer({ min: 1, max: 60 * 24 * 2 }),
  });
}

/** 1-10 IANA zones, simulating a varying attendee count. May contain repeats. */
export function zoneList(): fc.Arbitrary<string[]> {
  return fc.array(ianaTimezone(), { minLength: 1, maxLength: 10 });
}

export interface DstTransition {
  zone: string;
  /** "YYYY-MM-DD" the transition falls on, in `zone`'s own calendar. */
  date: string;
  kind: "spring-forward" | "fall-back";
  /** UTC offset in minutes just before vs. just after the transition instant. */
  offsetBeforeMinutes: number;
  offsetAfterMinutes: number;
  /**
   * Minute-of-day (0-1439, in `zone`'s local clock on `date`) where the nonexistent
   * (spring-forward) or repeated (fall-back) wall-clock window starts.
   */
  windowStartMinuteOfDay: number;
  /** Width of that window in minutes — usually 60, but not assumed (e.g. Lord Howe Island uses 30). */
  windowSizeMinutes: number;
}

/**
 * Binary-searches (to sub-second precision) for the exact UTC instant `zone`'s offset
 * changes, within [prevMidnightMs, currentMidnightMs) — the local calendar day the
 * transition actually falls within — then derives the local wall-clock window that's
 * either skipped (spring-forward) or repeated (fall-back), without assuming a
 * transition happens at 2am or shifts by exactly one hour, since neither is universal.
 */
function findTransitionWindow(
  zone: string,
  prevMidnightMs: number,
  currentMidnightMs: number,
): { startMinuteOfDay: number; sizeMinutes: number } {
  let lo = prevMidnightMs;
  let hi = currentMidnightMs;
  const loOffset = DateTime.fromMillis(lo, { zone }).offset;
  while (hi - lo > 1000) {
    const mid = Math.floor((lo + hi) / 2);
    const midOffset = DateTime.fromMillis(mid, { zone }).offset;
    if (midOffset === loOffset) lo = mid;
    else hi = mid;
  }
  const justBefore = DateTime.fromMillis(lo, { zone });
  const justAfter = DateTime.fromMillis(hi, { zone });
  const beforeMinuteOfDay = justBefore.hour * 60 + justBefore.minute;
  const afterMinuteOfDay = justAfter.hour * 60 + justAfter.minute;

  if (justAfter.offset > justBefore.offset) {
    // Spring-forward: the gap runs from just after the last real reading to the first
    // reading under the new offset.
    return { startMinuteOfDay: beforeMinuteOfDay + 1, sizeMinutes: justAfter.offset - justBefore.offset };
  }
  // Fall-back: the repeated window starts where the clock lands after the rewind, and
  // runs back up to (but not including) the reading that was about to repeat.
  return { startMinuteOfDay: afterMinuteOfDay, sizeMinutes: justBefore.offset - justAfter.offset };
}

const DST_SAMPLE_ZONES = ["America/New_York", "Europe/London", "Australia/Sydney"] as const;
const DST_SEARCH_YEARS = [2020, 2023, 2026, 2029, 2032, 2035] as const;

/**
 * Finds every DST transition for `zone` in `year` by scanning day-by-day for an offset
 * change (a real zone has at most a handful of transitions a year, so this is cheap) —
 * computed from the runtime's own tz rules rather than hardcoded calendar dates, so it
 * stays correct even if a zone's rules change within the tested year range.
 */
function findDstTransitionsInYear(zone: string, year: number): DstTransition[] {
  const transitions: DstTransition[] = [];
  let prev = DateTime.fromObject({ year, month: 1, day: 1, hour: 0 }, { zone });
  for (let day = 2; day <= 366; day++) {
    const current = DateTime.fromObject({ year, month: 1, day: 1, hour: 0 }, { zone }).plus({ days: day - 1 });
    if (!current.isValid || current.year !== year) break;
    if (current.offset !== prev.offset) {
      // The transition instant falls within [prev's midnight, current's midnight) —
      // i.e. during prev's calendar date, not current's (current's midnight is simply
      // the first midnight that already reflects the new offset).
      const window = findTransitionWindow(zone, prev.toMillis(), current.toMillis());
      transitions.push({
        zone,
        date: prev.toISODate()!,
        kind: current.offset > prev.offset ? "spring-forward" : "fall-back",
        offsetBeforeMinutes: prev.offset,
        offsetAfterMinutes: current.offset,
        windowStartMinuteOfDay: window.startMinuteOfDay,
        windowSizeMinutes: window.sizeMinutes,
      });
    }
    prev = current;
  }
  return transitions;
}

const ALL_DST_TRANSITIONS: DstTransition[] = DST_SAMPLE_ZONES.flatMap((zone) =>
  DST_SEARCH_YEARS.flatMap((year) => findDstTransitionsInYear(zone, year)),
);

/** Every discovered spring-forward transition for the sample DST-observing zones. */
export function dstSpringForwardTransition(): fc.Arbitrary<DstTransition> {
  const springForwards = ALL_DST_TRANSITIONS.filter((t) => t.kind === "spring-forward");
  return fc.constantFrom(...springForwards);
}

/** Every discovered fall-back transition for the sample DST-observing zones. */
export function dstFallBackTransition(): fc.Arbitrary<DstTransition> {
  const fallBacks = ALL_DST_TRANSITIONS.filter((t) => t.kind === "fall-back");
  return fc.constantFrom(...fallBacks);
}

/** A {transition, hour, minute} triple where hour:minute falls inside that transition's window. */
export function dstTransitionWithMinuteInWindow(
  transitionArb: fc.Arbitrary<DstTransition>,
): fc.Arbitrary<{ transition: DstTransition; hour: number; minute: number }> {
  return transitionArb.chain((transition) =>
    fc.integer({ min: 0, max: transition.windowSizeMinutes - 1 }).map((offset) => {
      const minuteOfDay = transition.windowStartMinuteOfDay + offset;
      return { transition, hour: Math.floor(minuteOfDay / 60), minute: minuteOfDay % 60 };
    }),
  );
}
