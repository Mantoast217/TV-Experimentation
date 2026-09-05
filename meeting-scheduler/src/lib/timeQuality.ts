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
   * Periods the slot touches, in chronological order. Length 1 for a slot that stays
   * within one period (solid dot). Length 2 for a slot spanning exactly two adjacent
   * periods (split dot — note two adjacent periods can share a color, e.g. Morning and
   * Afternoon are both green, or Late evening and Night are both grey, in which case the
   * split dot renders as two same-colored halves but the label still shows both names).
   * A slot touching 3+ periods has no agreed visual treatment and collapses to a single
   * representative period by midpoint, same as a length-1 result.
   */
  bands: TimeQualityBand[];
  /** Sentence-case label(s) joined with " - " for a split dot, e.g. "Afternoon - Evening". */
  label: string;
  /** One CSS color for a solid dot, two (chronological order) for a split dot. */
  dotColors: string[];
}

export function classifyTimeQuality(startHourRaw: number, endHourRaw: number): TimeQuality {
  const touched = bandsTouched(startHourRaw, endHourRaw);

  if (touched.length === 2) {
    return {
      bands: touched,
      label: touched.map((band) => BAND_INFO[band].label).join(" - "),
      dotColors: touched.map((band) => BAND_INFO[band].dotColor),
    };
  }

  // 0 crossings (touched already has exactly the 1 band the whole slot sits in) and 3+
  // crossings (no visual spec yet for a 3-or-more-period split) both fall back to one
  // representative band via the midpoint.
  const band = classifyHour((startHourRaw + endHourRaw) / 2);
  return { bands: [band], label: BAND_INFO[band].label, dotColors: [BAND_INFO[band].dotColor] };
}
