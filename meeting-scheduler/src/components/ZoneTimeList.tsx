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
  /**
   * Renders each slot as a single instant ("09:00") rather than a start–end range
   * ("09:00 - 10:00") — for callers with no end time/duration (e.g. the "What time
   * zone" page), where start and end are always identical and printing them both would
   * just repeat the same time.
   */
  instantOnly?: boolean;
  /**
   * Lays slots out as wrapping tiles in a row (each its own bordered box) instead of one
   * per line — for callers like the "What time zone" page where several short, equally-
   * weighted entries read better side by side than stacked. Off by default: the vertical
   * list is deliberately kept elsewhere (see the per-slot comment below) so a long city
   * name or compound quality label can't force an awkward mid-row wrap.
   */
  tileLayout?: boolean;
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

export function ZoneTimeList({
  slots,
  className,
  chipClassName,
  qualityLabelClassName,
  instantOnly,
  tileLayout,
}: ZoneTimeListProps) {
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
    <ul
      role="list"
      translate="no"
      className={`m-0 flex list-none p-0 ${tileLayout ? "flex-row flex-wrap gap-2" : "flex-col gap-2"} ${className ?? ""}`}
    >
      {slots.map((slot) => {
        const quality = classifyTimeQuality(slot.startHourRaw, slot.endHourRaw);
        const dotStyle =
          quality.dotColors.length === 2
            ? { background: `linear-gradient(90deg, ${quality.dotColors[0]} 50%, ${quality.dotColors[1]} 50%)` }
            : { backgroundColor: quality.dotColors[0] };
        // A meeting that's uniformly shifted — start and end both land on the same other
        // day — only needs saying once. Badging both the city line and the time line with
        // the same "-1" is redundant; reserve the city-line badge for when the start
        // genuinely lands on a *different* day than the end (a long duration pushing only
        // the end further out), which is the one case where two distinct badges carry two
        // distinct pieces of information. In instantOnly mode there's no separate end to
        // differ from, so this case can never apply — the single time-line badge below
        // always carries the fact instead.
        const startNeedsOwnBadge = !instantOnly && slot.dayOffset !== 0 && slot.dayOffset !== slot.endDayOffset;

        return (
          // City, time range, and time-of-day label each get their own line within a
          // slot (rather than packed onto one row) so a long city name or a compound
          // label like "Afternoon - Evening" can't force an awkward mid-row wrap on a
          // narrow phone — see MeetingScheduler.tsx's card-heading fix for the related,
          // but distinct, bug where the invite button was narrowing this list's
          // available width to begin with. In tileLayout, each slot additionally gets a
          // border and its own min-width so tiles wrap as a row instead of stacking.
          <li
            key={slot.zone.id}
            role="listitem"
            className={
              tileLayout
                ? "flex min-w-[140px] flex-1 flex-col gap-0.5 rounded-md border border-white/15 px-3 py-2"
                : "flex flex-col gap-0.5"
            }
          >
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={dotStyle} />
              <span>
                {slot.zone.city}
                {startNeedsOwnBadge && <span className="sr-only">{dayOffsetAnnouncement(slot.dayOffset)}</span>}
              </span>
              {startNeedsOwnBadge && <DayOffsetBadge offset={slot.dayOffset} className={chipClassName} />}
            </span>
            {/* pl-[14px]: aligns with the city text above (past the 8px dot + 6px gap), not the dot itself. */}
            <span className="flex flex-wrap items-center gap-1.5 pl-[14px]">
              {instantOnly ? (
                <>
                  <span>
                    {slot.startText}
                    {slot.dayOffset !== 0 && <span className="sr-only">{dayOffsetAnnouncement(slot.dayOffset)}</span>}
                  </span>
                  {slot.dayOffset !== 0 && <DayOffsetBadge offset={slot.dayOffset} className={chipClassName} />}
                </>
              ) : (
                <>
                  <span>
                    {slot.startText} - {slot.endText}
                    {slot.endDayOffset !== 0 && <span className="sr-only">{dayOffsetAnnouncement(slot.endDayOffset)}</span>}
                  </span>
                  {slot.endDayOffset !== 0 && <DayOffsetBadge offset={slot.endDayOffset} className={chipClassName} />}
                </>
              )}
            </span>
            <span className={`pl-[14px] ${qualityLabelClassName ?? "text-[var(--secondary-text)]"}`}>{quality.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
