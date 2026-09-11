import { Avatar, Chip } from "@heroui/react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { colleagueTimeZone, type Colleague } from "../lib/colleagues";
import { zoneTimeLabel } from "../lib/timezones";

interface ParticipantChipListProps {
  participants: Colleague[];
  onRemove: (id: string) => void;
  /** Focus target when the last chip is removed. */
  addInputRef: RefObject<HTMLInputElement | null>;
  /** Reference date ("YYYY-MM-DD") each chip's GMT offset is computed against. */
  dateStr: string;
}

/**
 * Hit area is set via inline style (rather than relying solely on the Tailwind
 * classes) so the 24x24 minimum (WCAG 2.5.8) holds even where the utility CSS
 * isn't loaded, e.g. in unit tests.
 */
const removeButtonHitArea = { minWidth: 24, minHeight: 24 };

function colleagueInitials(colleague: Colleague): string {
  return `${colleague.firstName[0]}${colleague.lastName[0]}`;
}

/** Mirrors TimezoneChipList's own add/remove announcement and focus-management pattern —
 * a person chip should behave exactly like a time zone chip, not a lesser copy of one. */
export function ParticipantChipList({ participants, onRemove, addInputRef, dateStr }: ParticipantChipListProps) {
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const prevParticipantsRef = useRef(participants);
  const [announcement, setAnnouncement] = useState("");
  const pendingFocusRef = useRef<string | "add-input" | null>(null);

  useEffect(() => {
    const prev = prevParticipantsRef.current;
    if (participants.length > prev.length) {
      const added = participants.find((p) => !prev.some((prevP) => prevP.id === p.id));
      if (added) setAnnouncement(`${added.firstName} ${added.lastName} added`);
    } else if (participants.length < prev.length) {
      const removed = prev.find((p) => !participants.some((cur) => cur.id === p.id));
      if (removed) setAnnouncement(`${removed.firstName} ${removed.lastName} removed`);
    }
    prevParticipantsRef.current = participants;

    const focusTarget = pendingFocusRef.current;
    if (focusTarget != null) {
      pendingFocusRef.current = null;
      if (focusTarget === "add-input") {
        addInputRef.current?.focus();
      } else {
        buttonRefs.current.get(focusTarget)?.focus();
      }
    }
  }, [participants, addInputRef]);

  const handleRemove = (id: string) => {
    const index = participants.findIndex((p) => p.id === id);
    const remaining = participants.filter((p) => p.id !== id);
    pendingFocusRef.current = remaining.length === 0 ? "add-input" : remaining[Math.min(index, remaining.length - 1)].id;
    onRemove(id);
  };

  if (participants.length === 0) return null;

  return (
    <>
      <ul role="list" translate="no" className="m-0 flex list-none flex-wrap gap-2.5 p-0">
        {participants.map((colleague) => {
          const zone = colleagueTimeZone(colleague);
          const timeLabel = zoneTimeLabel(zone, dateStr);
          const fullName = `${colleague.firstName} ${colleague.lastName}`;
          return (
            <li key={colleague.id} role="listitem">
              {/* h-10, explicit rather than left to the avatar to drive: TimezoneChipList's
                  plain chip matches this same fixed height so the two chip kinds sit flush
                  in a mixed row regardless of which one has an avatar. */}
              <Chip variant="soft" color="default" size="lg" className="h-10 items-center gap-1.5 border border-[#767676] pl-1">
                <Avatar.Root size="sm">
                  <Avatar.Fallback>{colleagueInitials(colleague)}</Avatar.Fallback>
                </Avatar.Root>
                {/* City, Country (not the "City — Country" em-dash pairing the colleague
                    search list uses) — that dash is already spoken for here, separating
                    the name from the location. */}
                <Chip.Label>
                  {fullName} — {zone.city}, {zone.country} ({timeLabel})
                </Chip.Label>
                <button
                  ref={(el) => {
                    if (el) buttonRefs.current.set(colleague.id, el);
                    else buttonRefs.current.delete(colleague.id);
                  }}
                  type="button"
                  onClick={() => handleRemove(colleague.id)}
                  aria-label={`Remove ${fullName}`}
                  style={removeButtonHitArea}
                  className="ml-1 inline-flex shrink-0 items-center justify-center rounded-full text-current/70 hover:text-current focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-blue)]"
                >
                  <span aria-hidden="true">×</span>
                </button>
              </Chip>
            </li>
          );
        })}
      </ul>
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </>
  );
}
