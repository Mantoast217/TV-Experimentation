import { wrapHour } from "./scheduling";

export type TimeQualityBand = "daytime" | "early-morning" | "early-evening" | "overnight";

interface BandInfo {
  /** Sentence-case display string, e.g. "Early morning". */
  label: string;
  /** CSS color value for the status dot. */
  dotColor: string;
}

const BAND_INFO: Record<TimeQualityBand, BandInfo> = {
  daytime: { label: "Daytime", dotColor: "var(--color-success)" },
  "early-morning": { label: "Early morning", dotColor: "var(--color-warning)" },
  "early-evening": { label: "Early evening", dotColor: "var(--color-warning)" },
  overnight: { label: "Overnight", dotColor: "var(--color-muted)" },
};

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

export interface TimeQuality {
  band: TimeQualityBand;
  label: string;
  dotColor: string;
}

/**
 * Classifies a time slot into exactly one of the four time-of-day bands, using the
 * midpoint of its (possibly midnight-crossing) span to break ties for a slot that
 * straddles a boundary — e.g. a 06:00-07:00 slot midpoints at 06:30 and resolves to the
 * single label "Overnight", never a concatenated "Overnight–Early morning" string.
 * `startHourRaw`/`endHourRaw` are the unwrapped hours from `ZoneTimeSlot`, so a slot like
 * 23:00 -> 01:00 (raw 23 -> 25) correctly midpoints at 00:00, not at the wrapped average
 * of 23 and 1.
 */
export function classifyTimeQuality(startHourRaw: number, endHourRaw: number): TimeQuality {
  const midpoint = (startHourRaw + endHourRaw) / 2;
  const band = classifyHour(midpoint);
  return { band, ...BAND_INFO[band] };
}
