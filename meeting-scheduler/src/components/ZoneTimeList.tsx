import type { ZoneTimeSlot } from "../lib/scheduling";
import { classifyTimeQuality } from "../lib/timeQuality";

interface ZoneTimeListProps {
  slots: ZoneTimeSlot[];
  className?: string;
  chipClassName?: string;
}

export function ZoneTimeList({ slots, className, chipClassName }: ZoneTimeListProps) {
  if (slots.length === 0) {
    return <p className={className}>Add a timezone to see local times</p>;
  }

  return (
    <ul role="list" className={`m-0 flex list-none flex-col gap-1 p-0 ${className ?? ""}`}>
      {slots.map((slot) => {
        const quality = classifyTimeQuality(slot.startHourRaw, slot.endHourRaw);
        const dotStyle =
          quality.dotColors.length === 2
            ? { background: `linear-gradient(90deg, ${quality.dotColors[0]} 50%, ${quality.dotColors[1]} 50%)` }
            : { backgroundColor: quality.dotColors[0] };
        return (
          <li key={slot.zone.id} role="listitem" className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={dotStyle} />
            <span>
              {slot.zone.city} {slot.startText}–{slot.endText} ({quality.label})
            </span>
            {slot.dayOffset !== 0 && (
              <span
                className={`inline-flex h-[18px] items-center justify-center rounded-full bg-warning px-1.5 text-[11px] font-medium text-warning-foreground ${chipClassName ?? ""}`}
              >
                {slot.dayOffset > 0 ? `+${slot.dayOffset}` : slot.dayOffset}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
