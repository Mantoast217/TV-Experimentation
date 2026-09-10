import type { ZoneTimeSlot } from "../lib/scheduling";
import { classifyTimeQuality } from "../lib/timeQuality";

interface ZoneTimeListProps {
  slots: ZoneTimeSlot[];
  className?: string;
  chipClassName?: string;
  /**
   * Color class for the time-of-day label ("Morning", "Afternoon - Evening", ...).
   * Defaults to the theme-reactive --secondary-text token, which is only verified against
   * the page background — wrong on a card with its own fixed (non-theme-reactive)
   * background, e.g. "Selected time"'s bg-zinc-800: in light mode that pairs
   * --secondary-text's dark-grey light-theme value with an always-dark card background,
   * measuring ~1.7:1 (fails WCAG AA's 4.5:1 badly). Callers on a fixed-background card
   * should pass a fixed color verified against that specific background instead — see
   * MeetingScheduler.tsx's "Selected time" card, and the same problem already solved for
   * its invite button's colors.
   */
  qualityLabelClassName?: string;
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

export function ZoneTimeList({ slots, className, chipClassName, qualityLabelClassName }: ZoneTimeListProps) {
  if (slots.length === 0) {
    return <p className={className}>Add a timezone to see local times</p>;
  }

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
        return (
          // City, time range, and time-of-day label each get their own line (rather than
          // packed onto one row) so a long city name or a compound label like "Afternoon -
          // Evening" can't force an awkward mid-row wrap on a narrow phone — see
          // MeetingScheduler.tsx's card-heading fix for the related, but distinct, bug
          // where the invite button was narrowing this list's available width to begin with.
          <li key={slot.zone.id} role="listitem" className="flex flex-col gap-0.5">
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={dotStyle} />
              <span>
                {slot.zone.city}
                {slot.dayOffset !== 0 && <span className="sr-only">{dayOffsetAnnouncement(slot.dayOffset)}</span>}
              </span>
              {slot.dayOffset !== 0 && <DayOffsetBadge offset={slot.dayOffset} className={chipClassName} />}
            </span>
            {/* pl-[14px]: aligns with the city text above (past the 8px dot + 6px gap), not the dot itself. */}
            <span className="flex flex-wrap items-center gap-1.5 pl-[14px]">
              <span>
                {slot.startText} - {slot.endText}
                {slot.endDayOffset !== 0 && <span className="sr-only">{dayOffsetAnnouncement(slot.endDayOffset)}</span>}
              </span>
              {slot.endDayOffset !== 0 && <DayOffsetBadge offset={slot.endDayOffset} className={chipClassName} />}
            </span>
            <span className={`pl-[14px] ${qualityLabelClassName ?? "text-[var(--secondary-text)]"}`}>{quality.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
