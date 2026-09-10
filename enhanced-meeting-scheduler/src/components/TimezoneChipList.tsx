import { Chip } from "@heroui/react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { zoneDisplayLabel, type TimeZoneCatalogEntry } from "../lib/timezones";

interface TimezoneChipListProps {
  zones: TimeZoneCatalogEntry[];
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

export function TimezoneChipList({ zones, onRemove, addInputRef, dateStr }: TimezoneChipListProps) {
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const prevZonesRef = useRef(zones);
  const [announcement, setAnnouncement] = useState("");
  const pendingFocusRef = useRef<string | "add-input" | null>(null);

  useEffect(() => {
    const prev = prevZonesRef.current;
    if (zones.length > prev.length) {
      const added = zones.find((zone) => !prev.some((p) => p.id === zone.id));
      if (added) setAnnouncement(`${added.city} added`);
    } else if (zones.length < prev.length) {
      const removed = prev.find((zone) => !zones.some((z) => z.id === zone.id));
      if (removed) setAnnouncement(`${removed.city} removed`);
    }
    prevZonesRef.current = zones;

    const focusTarget = pendingFocusRef.current;
    if (focusTarget != null) {
      pendingFocusRef.current = null;
      if (focusTarget === "add-input") {
        addInputRef.current?.focus();
      } else {
        buttonRefs.current.get(focusTarget)?.focus();
      }
    }
  }, [zones, addInputRef]);

  const handleRemove = (id: string) => {
    const index = zones.findIndex((zone) => zone.id === id);
    const remaining = zones.filter((zone) => zone.id !== id);
    pendingFocusRef.current = remaining.length === 0 ? "add-input" : remaining[Math.min(index, remaining.length - 1)].id;
    onRemove(id);
  };

  return (
    <>
      {/* translate="no": chips mount/unmount on every add/remove and their GMT-offset label
          recomputes on every date change — the same high-churn pattern that breaks under a
          browser page-translator once it's replaced these text nodes with its own wrapper
          elements (see ZoneTimeList.tsx for the reproduced failure and full rationale). */}
      <ul role="list" translate="no" className="m-0 flex list-none flex-wrap gap-2.5 p-0">
        {zones.map((zone) => {
          const label = zoneDisplayLabel(zone, dateStr);
          return (
            <li key={zone.id} role="listitem">
              {/* h-10: matches the participant chip's height, which the avatar (32px) plus its
                  own vertical padding drives to 40px — a plain text chip would otherwise sit
                  shorter, since it has no avatar forcing that same height. */}
              <Chip variant="soft" color="default" size="lg" className="h-10 items-center gap-1.5 border border-[#767676]">
                <Chip.Label>{label}</Chip.Label>
                <button
                  ref={(el) => {
                    if (el) buttonRefs.current.set(zone.id, el);
                    else buttonRefs.current.delete(zone.id);
                  }}
                  type="button"
                  onClick={() => handleRemove(zone.id)}
                  aria-label={`Remove ${label}`}
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
