import { wrapHour } from "./scheduling";

export type TimeQualityBand = "daytime" | "early-morning" | "early-evening" | "overnight";

export interface TimeQuality {
  band: TimeQualityBand;
  /** Sentence-case display string, e.g. "Early morning". */
  label: string;
  /** Tailwind background-color utility for the decorative status dot. */
  dotClassName: string;
}

const TIME_QUALITY: Record<TimeQualityBand, Omit<TimeQuality, "band">> = {
  daytime: { label: "Daytime", dotClassName: "bg-success" },
  "early-morning": { label: "Early morning", dotClassName: "bg-warning" },
  "early-evening": { label: "Early evening", dotClassName: "bg-warning" },
  overnight: { label: "Overnight", dotClassName: "bg-muted" },
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

/**
 * Classifies a time slot by the midpoint of its (possibly midnight-crossing) span —
 * `startHourRaw`/`endHourRaw` are the unwrapped hours from `ZoneTimeSlot`, so a slot
 * like 23:00 -> 01:00 (raw 23 -> 25) correctly midpoints at 00:00, not at the wrapped
 * average of 23 and 1.
 */
export function classifyTimeQuality(startHourRaw: number, endHourRaw: number): TimeQuality {
  const midpoint = (startHourRaw + endHourRaw) / 2;
  const band = classifyHour(midpoint);
  return { band, ...TIME_QUALITY[band] };
}
