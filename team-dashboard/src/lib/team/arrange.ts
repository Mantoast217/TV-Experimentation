import {
  dayOffset,
  localTime,
  nextWorkingWindow,
  statusAt,
  workingHoursInZone,
  type ConvertedHours,
  type Person,
  type Status,
} from "../time";
import { inZone } from "../time/zone";

export const STATUS_ORDER: readonly Status[] = ["working", "outside", "holiday"];

export type SortKey = "timeZone" | "localTime" | "name";
export type SortDirection = "ascending" | "descending";
export type StatusFilter = "all" | Status;

/** Everything the list needs about one person at one moment, worked out once. */
export interface PersonView {
  person: Person;
  status: Status;
  localTime: string;
  weekday: string;
  dayOffset: number;
  /** Minutes ahead of UTC right now, for sorting by time zone. */
  utcOffsetMinutes: number;
  /** e.g. "UTC+5:30". */
  utcOffsetLabel: string;
  /** Minutes since the person's local midnight, for sorting by local time. */
  localMinutes: number;
  hoursInViewerZone: ConvertedHours;
  /** For someone on holiday, the date their next working window starts in their own zone. */
  backOn: Date | null;
}

export function describePeople(people: readonly Person[], now: Date, viewerZone: string): PersonView[] {
  return people.map((person) => {
    const local = localTime(person, now);
    const zoned = inZone(now, person.ianaTimeZone);
    const status = statusAt(person, now);
    return {
      person,
      status,
      localTime: local.time,
      weekday: local.weekday,
      dayOffset: dayOffset(person, now, viewerZone),
      utcOffsetMinutes: zoned.offset,
      utcOffsetLabel: `UTC${zoned.toFormat("Z")}`,
      localMinutes: zoned.hour * 60 + zoned.minute,
      hoursInViewerZone: workingHoursInZone(person, now, viewerZone),
      backOn: status === "holiday" ? (nextWorkingWindow(person, now)?.start ?? null) : null,
    };
  });
}

export function fullName(person: Person): string {
  return `${person.firstName} ${person.lastName}`;
}

/** Lower case with accents removed, so "bergstrom" finds "Bergström". */
function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Matches name, role or city. An empty query matches everyone. */
export function matchesSearch(person: Person, query: string): boolean {
  const needle = fold(query.trim());
  if (!needle) return true;
  return [fullName(person), person.role, person.city].some((field) => fold(field).includes(needle));
}

const collator = new Intl.Collator("en-GB");

function compare(a: PersonView, b: PersonView, key: SortKey): number {
  switch (key) {
    case "timeZone":
      return a.utcOffsetMinutes - b.utcOffsetMinutes;
    case "localTime":
      return a.localMinutes - b.localMinutes;
    case "name":
      return collator.compare(fullName(a.person), fullName(b.person));
  }
}

export interface ArrangeOptions {
  query: string;
  status: StatusFilter;
  sortKey: SortKey;
  direction: SortDirection;
}

export interface Group {
  status: Status;
  people: PersonView[];
}

/**
 * Filters, then sorts within each status group. Groups keep a fixed order and empty ones are left
 * out. Ties keep the original order in both directions.
 */
export function arrange(views: readonly PersonView[], options: ArrangeOptions): { groups: Group[]; shown: number } {
  const sign = options.direction === "ascending" ? 1 : -1;
  const matching = views.filter(
    (view) => (options.status === "all" || view.status === options.status) && matchesSearch(view.person, options.query),
  );
  const sorted = [...matching].sort((a, b) => sign * compare(a, b, options.sortKey));
  const groups = STATUS_ORDER.map((status) => ({ status, people: sorted.filter((view) => view.status === status) })).filter(
    (group) => group.people.length > 0,
  );
  return { groups, shown: matching.length };
}
