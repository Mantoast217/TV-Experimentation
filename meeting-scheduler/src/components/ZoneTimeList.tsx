import type { ZoneTimeSlot } from "../lib/scheduling";

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
    <p className={`flex flex-wrap items-center gap-1 ${className ?? ""}`}>
      {slots.map((slot, i) => (
        <span key={slot.zone.id} className="flex items-center gap-1">
          {i > 0 && <span className="text-muted">/</span>}
          <span>
            {slot.zone.name} {slot.startText}–{slot.endText}
          </span>
          {slot.dayOffset !== 0 && (
            <span
              className={`inline-flex h-[18px] items-center justify-center rounded-full bg-warning px-1.5 text-[11px] font-medium text-warning-foreground ${chipClassName ?? ""}`}
            >
              {slot.dayOffset > 0 ? `+${slot.dayOffset}` : slot.dayOffset}
            </span>
          )}
        </span>
      ))}
    </p>
  );
}
