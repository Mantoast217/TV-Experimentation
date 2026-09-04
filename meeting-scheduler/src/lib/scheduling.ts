import {
  daysBetween,
  formatHm,
  utcToWallTime,
  wallTimeToUtc,
  type TimeZoneCatalogEntry,
} from "./timezones";

export interface ZoneTimeSlot {
  zone: TimeZoneCatalogEntry;
  startText: string;
  endText: string;
  /** Day offset relative to the host's selected date: -1, 0, or +1 (rarely more). */
  dayOffset: number;
}

/**
 * Computes each zone's local start/end time and day offset for a meeting that starts
 * at `startHour` (decimal, in the host zone's wall clock) on `dateStr` and runs `durationHours`.
 * `zones[0]` is the host/reference zone.
 */
export function computeZoneTimes(
  zones: TimeZoneCatalogEntry[],
  dateStr: string,
  startHour: number,
  durationHours: number,
): ZoneTimeSlot[] {
  if (zones.length === 0) return [];
  const hostZone = zones[0];
  const startUtc = wallTimeToUtc(hostZone.iana, dateStr, startHour);
  const endUtc = startUtc + durationHours * 3600000;

  return zones.map((zone) => {
    const startWall = utcToWallTime(zone.iana, startUtc);
    const endWall = utcToWallTime(zone.iana, endUtc);
    return {
      zone,
      startText: formatHm(startWall.hour, startWall.minute),
      endText: formatHm(endWall.hour, endWall.minute),
      dayOffset: daysBetween(dateStr, startWall),
    };
  });
}

/**
 * Scans candidate start hours (in the host zone) across `dateStr` and returns the one that
 * keeps every zone's meeting time as close as possible to typical working hours (9-18),
 * with staying within awake hours (6-24) weighted far more heavily so it always wins
 * when the two constraints conflict.
 */
export function findOptimalStartHour(
  zones: TimeZoneCatalogEntry[],
  dateStr: string,
  durationHours: number,
): number {
  if (zones.length === 0) return 9;
  const hostZone = zones[0];

  let bestHour = 9;
  let bestScore = Infinity;
  for (let h = 0; h < 24; h += 0.25) {
    const startUtc = wallTimeToUtc(hostZone.iana, dateStr, h);
    const score = zones.reduce((sum, zone) => {
      const wall = utcToWallTime(zone.iana, startUtc);
      const localHour = wall.hour + wall.minute / 60;
      const workingPenalty = Math.max(0, 9 - localHour) + Math.max(0, localHour + durationHours - 18);
      const awakePenalty = (Math.max(0, 6 - localHour) + Math.max(0, localHour + durationHours - 24)) * 10;
      return sum + workingPenalty + awakePenalty;
    }, 0);
    if (score < bestScore) {
      bestScore = score;
      bestHour = h;
    }
  }
  return bestHour;
}

export function parseHourValue(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h + (m || 0) / 60;
}

export interface TimeOption {
  id: string;
  label: string;
}

export const TIME_OPTIONS: TimeOption[] = (() => {
  const options: TimeOption[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const label = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      options.push({ id: label, label });
    }
  }
  return options;
})();
