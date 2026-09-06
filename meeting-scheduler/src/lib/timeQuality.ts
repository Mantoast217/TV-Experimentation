import { wrapHour } from "./scheduling";

export type TimeQualityBand = "night" | "early-morning" | "morning" | "afternoon" | "evening" | "late-evening";

interface BandInfo {
  /** Sentence-case display string, e.g. "Early morning". */
  label: string;
  /** CSS color value for the status dot. */
  dotColor: string;
}

const BAND_INFO: Record<TimeQualityBand, BandInfo> = {
  night: { label: "Night", dotColor: "var(--color-muted)" },
  "early-morning": { label: "Early morning", dotColor: "var(--color-warning)" },
  morning: { label: "Morning", dotColor: "var(--color-success)" },
  afternoon: { label: "Afternoon", dotColor: "var(--color-success)" },
  evening: { label: "Evening", dotColor: "var(--color-warning)" },
  "late-evening": { label: "Late evening", dotColor: "var(--color-muted)" },
};

/** Wall-clock hours where one period ends and the next begins. */
const BAND_START_HOURS = [6, 9, 12, 17, 21, 24];

/**
 * Classifies a single wall-clock hour into one of the six time-of-day periods.
 * Boundaries are lower-bound inclusive: a value exactly on a threshold belongs to the
 * period that starts there (e.g. 06:00 is Early morning, 09:00 is Morning, 12:00 is
 * Afternoon, 17:00 is Evening, 21:00 is Late evening, 00:00 is Night).
 */
function classifyHour(hour: number): TimeQualityBand {
  const h = wrapHour(hour);
  if (h >= 6 && h < 9) return "early-morning";
  if (h >= 9 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  if (h >= 21) return "late-evening";
  return "night";
}

/**
 * The distinct periods a slot passes through, in chronological order — length 1 if the
 * whole slot stays within one period. Uses the raw (unwrapped) start/end hours so a slot
 * that crosses midnight, or spans multiple days, is walked correctly.
 *
 * A boundary exactly at the slot's end counts as "touched" (e.g. 05:30-06:00 touches
 * both Night and Early morning, since the slot's last instant reaches 06:00) but a
 * boundary exactly at the slot's start does not (e.g. 06:00-07:00 is Early morning only,
 * even though 06:00 is also Night's end point) — the slot doesn't occupy any time before
 * its own start.
 */
function bandsTouched(startHourRaw: number, endHourRaw: number): TimeQualityBand[] {
  const bands: TimeQualityBand[] = [classifyHour(startHourRaw)];

  const firstCycle = Math.floor(startHourRaw / 24) - 1;
  const lastCycle = Math.floor(endHourRaw / 24) + 1;
  const crossings: number[] = [];
  for (let cycle = firstCycle; cycle <= lastCycle; cycle++) {
    for (const boundary of BAND_START_HOURS) {
      const t = cycle * 24 + boundary;
      if (t > startHourRaw && t <= endHourRaw) crossings.push(t);
    }
  }
  crossings.sort((a, b) => a - b);

  for (const t of crossings) {
    const band = classifyHour(t);
    if (bands[bands.length - 1] !== band) bands.push(band);
  }
  return bands;
}

export interface TimeQuality {
  /**
   * The first and last periods the slot touches, in chronological order. Length 1 for a
   * slot that stays within one period, or that spans 24h+ and wraps back into its own
   * starting period (solid dot either way). Otherwise length 2 — the slot's first and
   * last periods only, even if it passes through others in between (split dot; note the
   * two periods can share a color, e.g. Morning and Afternoon are both green, in which
   * case the split dot renders as two same-colored halves but the label still shows both
   * names).
   */
  bands: TimeQualityBand[];
  /** Sentence-case label(s) joined with " - " for a split dot, e.g. "Afternoon - Evening". */
  label: string;
  /** One CSS color for a solid dot, two (chronological order) for a split dot. */
  dotColors: string[];
}

function soloBand(band: TimeQualityBand): TimeQuality {
  return { bands: [band], label: BAND_INFO[band].label, dotColors: [BAND_INFO[band].dotColor] };
}

export function classifyTimeQuality(startHourRaw: number, endHourRaw: number): TimeQuality {
  const touched = bandsTouched(startHourRaw, endHourRaw);
  const first = touched[0];
  const last = touched[touched.length - 1];

  // bandsTouched walks boundaries in fixed chronological order, so the only way to land
  // back in the starting band (touched.length > 1, not just "never left it") is to have
  // passed through every other band first — Night included, regardless of what band the
  // slot starts/ends in. A single band-name label (e.g. "Morning") would misleadingly
  // imply a comfortable, business-hours-only meeting, so this gets its own distinct
  // label and color rather than collapsing to soloBand like the "never left" case below.
  if (touched.length > 1 && first === last) {
    return { bands: touched, label: "Spans full day", dotColors: ["var(--color-danger)"] };
  }

  if (first === last) return soloBand(first);

  return {
    bands: [first, last],
    label: `${BAND_INFO[first].label} - ${BAND_INFO[last].label}`,
    dotColors: [BAND_INFO[first].dotColor, BAND_INFO[last].dotColor],
  };
}
