import { DateTime } from "luxon";
import type { DateRange, Status } from "../time";
import type { PersonView, SortDirection, SortKey } from "./arrange";

export const STATUS_LABEL: Record<Status, string> = {
  working: "Working now",
  outside: "Outside working hours",
  holiday: "On holiday",
};

/** Shape markers, so status never depends on colour. Always shown next to the text label. */
export const STATUS_MARKER: Record<Status, string> = {
  working: "●",
  outside: "◐",
  holiday: "○",
};

export function summaryItem(status: Status, count: number): string {
  return `${count} ${STATUS_LABEL[status].charAt(0).toLowerCase()}${STATUS_LABEL[status].slice(1)}`;
}

export function dayOffsetText(offset: number): string {
  if (offset === 0) return "";
  const days = Math.abs(offset) === 1 ? "1 day" : `${Math.abs(offset)} days`;
  return offset > 0 ? `${days} ahead` : `${days} behind`;
}

export function localHoursText(view: PersonView): string {
  return `${view.person.workingHours.start}–${view.person.workingHours.end} local`;
}

export function viewerHoursText(view: PersonView): string {
  const { start, end, endsNextDay } = view.hoursInViewerZone;
  return `${start}–${end} your time${endsNextDay ? ", ends next day" : ""}`;
}

export function backOnText(view: PersonView): string | null {
  if (!view.backOn) return null;
  const date = DateTime.fromJSDate(view.backOn, { zone: view.person.ianaTimeZone }).setLocale("en-GB");
  return `Back on ${date.toFormat("cccc d LLLL")}`;
}

export const SORT_LABEL: Record<SortKey, string> = {
  timeZone: "time zone",
  localTime: "local time",
  name: "name",
};

const DIRECTION_TEXT: Record<SortKey, Record<SortDirection, string>> = {
  timeZone: { ascending: "furthest west first", descending: "furthest east first" },
  localTime: { ascending: "earliest first", descending: "latest first" },
  name: { ascending: "A to Z", descending: "Z to A" },
};

export function sortAnnouncement(key: SortKey, direction: SortDirection): string {
  return `Sorted by ${SORT_LABEL[key]}, ${DIRECTION_TEXT[key][direction]}.`;
}

export function resultsText(shown: number, total: number): string {
  return `Showing ${shown} of ${total} ${total === 1 ? "person" : "people"}`;
}

export function emptyStateText(query: string): string {
  const trimmed = query.trim();
  return trimmed ? `No people match “${trimmed}”.` : "No people match the selected status.";
}

/** e.g. "Times are for 14:00 on Friday 16 October 2026 in your time zone (Europe/London)." */
export function asOfText(now: Date, viewerZone: string): string {
  const at = DateTime.fromJSDate(now, { zone: viewerZone }).setLocale("en-GB");
  return `Times are for ${at.toFormat("HH:mm")} on ${at.toFormat("cccc d LLLL yyyy")} in your time zone (${viewerZone}).`;
}

/** e.g. "Working hours: 09:00–18:00 local, 01:00–10:00 your time". */
export function workingHoursSentence(view: PersonView): string {
  return `Working hours: ${localHoursText(view)}, ${viewerHoursText(view)}`;
}

function clock(hour: number): string {
  return `${String(hour % 24).padStart(2, "0")}:00`;
}

/** e.g. "09:00–10:00". */
export function hourRange(hour: number): string {
  return `${clock(hour)}–${clock(hour + 1)}`;
}

function listText(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** The sentence that names the best hours, so the overlap row never has to be read as a graphic. */
export function bestHoursText(best: { hours: number[]; count: number }, available: number): string {
  if (available === 0) return "No one shown is available today.";
  if (best.hours.length === 0) return "No one shown is working for a whole hour today.";
  const hours = best.hours.length === 1 ? "hour" : "hours";
  const verb = best.hours.length === 1 ? "is" : "are";
  const people = available === 1 ? "person is" : "people are";
  return `The best ${hours} to meet ${verb} ${listText(best.hours.map(hourRange))} your time, when ${best.count} of ${available} available ${people} working.`;
}

export function selectionText(count: number): string {
  if (count === 0) return "No one selected";
  return `${count} ${count === 1 ? "person" : "people"} selected`;
}

/** e.g. "Monday 19 October, 09:00–17:00", or "Sunday 18 October 23:00 to Monday 19 October 07:00" across midnight. */
export function windowText(start: Date, end: Date, zone: string): string {
  const from = DateTime.fromJSDate(start, { zone }).setLocale("en-GB");
  const to = DateTime.fromJSDate(end, { zone }).setLocale("en-GB");
  if (from.toISODate() === to.toISODate()) {
    return `${from.toFormat("cccc d LLLL")}, ${from.toFormat("HH:mm")}–${to.toFormat("HH:mm")}`;
  }
  return `${from.toFormat("cccc d LLLL HH:mm")} to ${to.toFormat("cccc d LLLL HH:mm")}`;
}

/** e.g. "2 to 6 November 2026", "30 October to 2 November 2026" or "2 November 2026". */
export function dateRangeText(range: DateRange): string {
  const from = DateTime.fromISO(range.start, { locale: "en-GB" });
  const to = DateTime.fromISO(range.end, { locale: "en-GB" });
  if (range.start === range.end) return to.toFormat("d LLLL yyyy");
  if (from.year !== to.year) return `${from.toFormat("d LLLL yyyy")} to ${to.toFormat("d LLLL yyyy")}`;
  if (from.month !== to.month) return `${from.toFormat("d LLLL")} to ${to.toFormat("d LLLL yyyy")}`;
  return `${from.toFormat("d")} to ${to.toFormat("d LLLL yyyy")}`;
}

export const COPY_SUCCESS = "Email address copied.";
export const COPY_FAILURE = "Could not copy the email address. Select it and copy it yourself.";

/** e.g. "Friday 16 October, 17:00". */
export function momentText(at: Date, zone: string): string {
  return DateTime.fromJSDate(at, { zone }).setLocale("en-GB").toFormat("cccc d LLLL, HH:mm");
}
