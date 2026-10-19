import { DateTime } from "luxon";
import type { Status } from "../time";
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
