import type { Person, TimeWindow } from "./types";
import { workingWindowOn } from "./status";
import { addDays, formatTime, inZone, wallTimeToInstant } from "./zone";

/** How far ahead to look for the next working day, so a very long holiday can't loop forever. */
const SEARCH_DAYS = 400;

export interface ConvertedHours {
  start: string;
  end: string;
  /** The range finishes on the viewer's next calendar day, e.g. "16:00–01:00". */
  endsNextDay: boolean;
}

/** The person's working hours on their current date, shown in the viewer's zone. */
export function workingHoursInZone(person: Person, now: Date, viewerZone: string): ConvertedHours {
  const isoDate = inZone(now, person.ianaTimeZone).toISODate()!;
  const start = inZone(wallTimeToInstant(isoDate, person.workingHours.start, person.ianaTimeZone), viewerZone);
  const end = inZone(wallTimeToInstant(isoDate, person.workingHours.end, person.ianaTimeZone), viewerZone);
  return {
    start: formatTime(start),
    end: formatTime(end),
    endsNextDay: end.toISODate()! > start.toISODate()!,
  };
}

export interface NextWindow extends TimeWindow {
  /** True when `now` is already inside this window. */
  inProgress: boolean;
}

/** The current working window if they're working now, otherwise the next one. Null if none within 400 days. */
export function nextWorkingWindow(person: Person, now: Date): NextWindow | null {
  const today = inZone(now, person.ianaTimeZone).toISODate()!;
  for (let i = 0; i < SEARCH_DAYS; i++) {
    const window = workingWindowOn(person, addDays(today, i));
    if (window && window.end > now) return { ...window, inProgress: window.start <= now };
  }
  return null;
}
