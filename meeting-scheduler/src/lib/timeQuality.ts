import { wrapHour } from "./scheduling";

export type TimeQualityBand = "daytime" | "early-morning" | "early-evening" | "overnight";

interface BandInfo {
  /** Sentence-case display string, e.g. "Early morning". */
  label: string;
  /** CSS color value for the status dot. */
  color: string;
}

const BAND_INFO: Record<TimeQualityBand, BandInfo> = {
  daytime: { label: "Daytime", color: "var(--color-success)" },
  "early-morning": { label: "Early morning", color: "var(--color-warning)" },
  "early-evening": { label: "Early evening", color: "var(--color-warning)" },
  overnight: { label: "Overnight", color: "var(--color-muted)" },
};

/** Wall-clock hours where one band ends and the next begins. */
const BAND_START_HOURS = [7, 9, 17, 19];

/**
 * Classifies a single wall-clock hour into one of the four time-of-day bands.
 * Boundaries are lower-bound inclusive: a value exactly on a threshold belongs to the
 * band that starts there (e.g. 09:00 is Daytime, 17:00 is Early evening, 07:00 is Early
 * morning, 19:00 is Overnight).
 */
function classifyHour(hour: number): TimeQualityBand {
  const h = wrapHour(hour);
  if (h >= 9 && h < 17) return "daytime";
  if (h >= 7 && h < 9) return "early-morning";
  if (h >= 17 && h < 19) return "early-evening";
  return "overnight";
}

/**
 * The distinct bands a slot passes through, in chronological order — length 1 if the
 * whole slot stays within one band. Uses the raw (unwrapped) start/end hours so a slot
 * that crosses midnight, or spans multiple days, is walked correctly.
 *
 * A boundary exactly at the slot's end counts as "touched" (e.g. 05:30-07:00 touches
 * both Overnight and Early morning, since the slot's last instant reaches 07:00) but a
 * boundary exactly at the slot's start does not (e.g. 09:00-10:00 is Daytime only, even
 * though 09:00 is also Early morning's end point) — the slot doesn't occupy any time
 * before its own start.
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
   * Bands the slot touches, in chronological order. Length 1 for a slot that stays
   * within one band (solid dot). Length 2 for a slot spanning exactly two adjacent
   * bands (split dot). A slot touching 3+ bands has no agreed visual treatment yet
   * (see the product-decision note where this is computed) and collapses to a single
   * representative band by midpoint, same as a length-1 result.
   */
  bands: TimeQualityBand[];
  /** Sentence-case label(s) joined with "–" for a split dot, e.g. "Overnight–Early morning". */
  label: string;
  /** One CSS color for a solid dot, two (chronological order) for a split dot. */
  dotColors: string[];
}

export function classifyTimeQuality(startHourRaw: number, endHourRaw: number): TimeQuality {
  const touched = bandsTouched(startHourRaw, endHourRaw);

  if (touched.length === 2) {
    return {
      bands: touched,
      label: touched.map((band) => BAND_INFO[band].label).join("–"),
      dotColors: touched.map((band) => BAND_INFO[band].color),
    };
  }

  // 0 crossings (touched already has exactly the 1 band the whole slot sits in) and 3+
  // crossings (no visual spec yet for a 3-or-more-band split — flagged separately,
  // not decided here) both fall back to one representative band via the midpoint.
  const band = classifyHour((startHourRaw + endHourRaw) / 2);
  return { bands: [band], label: BAND_INFO[band].label, dotColors: [BAND_INFO[band].color] };
}
