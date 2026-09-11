import type { Colleague } from "../lib/colleagues";
import { isColleagueOutOfOffice, isOutsideDeclaredHours } from "../lib/availability";
import type { ZoneTimeSlot } from "../lib/scheduling";
import { classifyTimeQuality } from "../lib/timeQuality";

interface ZoneTimeListProps {
  slots: ZoneTimeSlot[];
  className?: string;
  chipClassName?: string;
  /** Keyed by TimeZoneCatalogEntry.id — a slot whose zone matches one or more selected
   * participants shows their name(s) ahead of the city instead of just the bare city. */
  participantByZoneId?: Map<string, Colleague[]>;
  /**
   * Color class for text that would otherwise use the theme-reactive --secondary-text
   * token: the quality label ("Morning", ...) and OutsideHoursFlag's text/border (which
   * tracks it via border-current). --secondary-text is only verified against the page
   * background — wrong on a card with its own fixed (non-theme-reactive) background, e.g.
   * "Selected time"'s bg-zinc-800: in light mode that pairs --secondary-text's dark-grey
   * light-theme value with an always-dark card background, measuring ~1.7:1 (fails WCAG
   * AA's 4.5:1 badly). Callers on a fixed-background card should pass a fixed color
   * verified against that specific background instead — see MeetingScheduler.tsx's
   * "Selected time" card, and the same problem already solved for its invite button.
   */
  mutedTextClassName?: string;
}

/** A "+1"/"-1"-style pill marking a time as landing on a different day than the card's displayed date. */
function DayOffsetBadge({ offset, className }: { offset: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-[18px] items-center justify-center rounded-full bg-warning px-1.5 text-[11px] font-medium text-warning-foreground ${className ?? ""}`}
    >
      {offset > 0 ? `+${offset}` : offset}
    </span>
  );
}

/** The screen-reader-only equivalent of a DayOffsetBadge, read inline with the time it follows. */
function dayOffsetAnnouncement(offset: number): string {
  return offset > 0 ? `, ${offset} day${offset === 1 ? "" : "s"} later` : `, ${Math.abs(offset)} day${offset === -1 ? "" : "s"} earlier`;
}

function namesLabel(people: Colleague[]): string {
  return people.map((p) => p.firstName).join(" & ");
}

/** Solid pill for a hard conflict (someone's out of office) — visually louder than
 * OutsideHoursFlag below, matching how being away reads as more serious than a slot that
 * merely falls outside someone's declared hours. */
function HolidayFlag({ people, ofTotal, className }: { people: Colleague[]; ofTotal: number; className?: string }) {
  const text = people.length === ofTotal ? "On holiday" : `${namesLabel(people)} on holiday`;
  return (
    <span
      className={`inline-flex items-center rounded-full bg-warning px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-warning-foreground ${className ?? ""}`}
    >
      {text}
    </span>
  );
}

function outsideHoursDetail(colleague: Colleague, startText: string): string {
  return startText < colleague.workingHours.start ? `starts ${colleague.workingHours.start}` : `ends ${colleague.workingHours.end}`;
}

/** Dashed, muted pill — a softer signal than HolidayFlag: the meeting can still happen,
 * it's just outside what this person declared as their normal hours. Layered next to the
 * existing time-of-day dot, not instead of it: the dot still says what the hour generally
 * looks like, this says what it looks like for them specifically — the exact gap a slot
 * that reads as a plain "Evening" can otherwise hide. */
function OutsideHoursFlag({
  people,
  ofTotal,
  startText,
  mutedTextClassName,
  className,
}: {
  people: Colleague[];
  ofTotal: number;
  startText: string;
  mutedTextClassName: string;
  className?: string;
}) {
  const text =
    people.length === 1
      ? `Outside ${people.length === ofTotal ? "hours" : `${people[0].firstName}'s hours`} · ${outsideHoursDetail(people[0], startText)}`
      : people.length === ofTotal
        ? "Outside hours"
        : `Outside ${namesLabel(people)}'s hours`;
  return (
    <span
      className={`inline-flex items-center rounded-full border border-dashed border-current/50 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${mutedTextClassName} ${className ?? ""}`}
    >
      {text}
    </span>
  );
}

export function ZoneTimeList({ slots, className, chipClassName, participantByZoneId, mutedTextClassName }: ZoneTimeListProps) {
  if (slots.length === 0) {
    return <p className={className}>Add a timezone to see local times</p>;
  }
  const mutedText = mutedTextClassName ?? "text-[var(--secondary-text)]";

  return (
    // translate="no": these times re-render on every chevron nudge/settings edit. A
    // browser page-translator (Chrome's built-in translate) replaces each translated text
    // node with its own wrapper element, so React's reference to the original text node
    // goes stale — the next update then silently no-ops instead of showing the new time
    // (reproduced live: the chevron correctly updates React state, but the visible time
    // range stays frozen once the page has been translated). Opting this high-churn region
    // out of translation keeps it under React's control; the surrounding static copy
    // (headings, labels, footer) still translates normally.
    <ul role="list" translate="no" className={`m-0 flex list-none flex-col gap-2 p-0 ${className ?? ""}`}>
      {slots.map((slot) => {
        const quality = classifyTimeQuality(slot.startHourRaw, slot.endHourRaw);
        const dotStyle =
          quality.dotColors.length === 2
            ? { background: `linear-gradient(90deg, ${quality.dotColors[0]} 50%, ${quality.dotColors[1]} 50%)` }
            : { backgroundColor: quality.dotColors[0] };
        const people = participantByZoneId?.get(slot.zone.id) ?? [];
        const label =
          people.length > 0 ? `${people.map((p) => `${p.firstName} ${p.lastName}`).join(" & ")} — ${slot.zone.city}` : slot.zone.city;

        // Holiday takes precedence per person: someone away doesn't also need an "outside
        // hours" flag on top — that's moot once they're not working at all that day.
        const onHoliday = people.filter((p) => isColleagueOutOfOffice(p, slot.localDateStr));
        const outsideHours = people
          .filter((p) => !onHoliday.includes(p))
          .filter((p) => isOutsideDeclaredHours(p, slot.startText, slot.endText));

        // A meeting that's uniformly shifted — start and end both land on the same other
        // day — only needs saying once. Badging both the name line and the time line with
        // the same "-1" is redundant; reserve the name-line badge for when the start
        // genuinely lands on a *different* day than the end (a long duration pushing only
        // the end further out), which is the one case where two distinct badges carry two
        // distinct pieces of information.
        const startNeedsOwnBadge = slot.dayOffset !== 0 && slot.dayOffset !== slot.endDayOffset;

        return (
          // Name/city, time range, and quality label (plus any holiday/outside-hours
          // flags) each get their own line, rather than packed onto one row, so a long
          // participant name or compound label like "Afternoon - Evening" can't force an
          // awkward mid-row wrap on a narrow phone — see MeetingScheduler.tsx's
          // card-heading fix for the related, but distinct, bug where the invite button
          // was narrowing this list's available width to begin with.
          <li key={slot.zone.id} role="listitem" className="flex flex-col gap-0.5">
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={dotStyle} />
              <span>
                {label}
                {startNeedsOwnBadge && <span className="sr-only">{dayOffsetAnnouncement(slot.dayOffset)}</span>}
              </span>
              {startNeedsOwnBadge && <DayOffsetBadge offset={slot.dayOffset} className={chipClassName} />}
            </span>
            {/* pl-[14px]: aligns with the name/city text above (past the 8px dot + 6px gap), not the dot itself. */}
            <span className="flex flex-wrap items-center gap-1.5 pl-[14px]">
              <span>
                {slot.startText} - {slot.endText}
                {slot.endDayOffset !== 0 && <span className="sr-only">{dayOffsetAnnouncement(slot.endDayOffset)}</span>}
              </span>
              {slot.endDayOffset !== 0 && <DayOffsetBadge offset={slot.endDayOffset} className={chipClassName} />}
            </span>
            <span className="flex flex-wrap items-center gap-1.5 pl-[14px]">
              <span className={mutedText}>{quality.label}</span>
              {onHoliday.length > 0 && <HolidayFlag people={onHoliday} ofTotal={people.length} className={chipClassName} />}
              {outsideHours.length > 0 && (
                <OutsideHoursFlag
                  people={outsideHours}
                  ofTotal={people.length}
                  startText={slot.startText}
                  mutedTextClassName={mutedText}
                  className={chipClassName}
                />
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
