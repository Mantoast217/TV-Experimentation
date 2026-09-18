import { ComboBox, Input, ListBox, Separator } from "@heroui/react";
import { useMemo, useRef, useState } from "react";
import { asItems } from "../lib/collection";
import { computeZoneTimes, parseHourValue } from "../lib/scheduling";
import {
  DEFAULT_TIMEZONE_ID,
  TIMEZONE_CATALOG,
  longDateLabel,
  zoneDisplayLabel,
  type TimeZoneCatalogEntry,
} from "../lib/timezones";
import { TimePickerField } from "./TimePickerField";
import { TimezoneChipList } from "./TimezoneChipList";
import { ZoneTimeList } from "./ZoneTimeList";

function matchesQuery(zone: TimeZoneCatalogEntry, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  return (
    zone.country.toLowerCase().includes(q) ||
    zone.city.toLowerCase().includes(q) ||
    (zone.stdAbbreviation?.toLowerCase().includes(q) ?? false) ||
    (zone.dstAbbreviation?.toLowerCase().includes(q) ?? false)
  );
}

/** "YYYY-MM-DD" for the viewer's own local today — this page has no date picker, so
 * "today" is fixed once per visit rather than re-derived on every render. */
function todayDateStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** "HH:MM" for the viewer's own current wall-clock time. */
function nowTimeStr(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

/**
 * A trimmed-down companion to MeetingScheduler: add time zones, pick one instant (no
 * duration/end time), and see what that instant looks like in each added zone. Starts
 * on the viewer's own current time rather than a fixed default, matching the "what time
 * zone is it right now" framing.
 */
export function WhatTimeZone() {
  const [zones, setZones] = useState<TimeZoneCatalogEntry[]>(() => {
    const uk = TIMEZONE_CATALOG.find((z) => z.id === DEFAULT_TIMEZONE_ID)!;
    return [uk];
  });
  const [startTime, setStartTime] = useState(nowTimeStr);
  const [tzQuery, setTzQuery] = useState("");
  const [setToNowAnnouncement, setSetToNowAnnouncement] = useState("");
  const addZoneInputRef = useRef<HTMLInputElement>(null);

  const dateStr = useMemo(() => todayDateStr(), []);

  const addZone = (id: string) => {
    const found = TIMEZONE_CATALOG.find((z) => z.id === id);
    if (!found) return;
    setZones((prev) => (prev.some((z) => z.id === id) ? prev : [...prev, found]));
  };

  const removeZone = (id: string) => {
    setZones((prev) => prev.filter((z) => z.id !== id));
  };

  const availableZones = useMemo(() => {
    const matches = TIMEZONE_CATALOG.filter((z) => !zones.some((added) => added.id === z.id) && matchesQuery(z, tzQuery));
    matches.sort((a, b) => a.city.localeCompare(b.city));
    return matches;
  }, [zones, tzQuery]);

  const startHour = parseHourValue(startTime);
  // durationHours 0: there's no end time on this page, so every slot's start and end
  // are the same instant — classifyTimeQuality(x, x) already resolves that to a single,
  // solid-dot band with no special-casing needed (see timeQuality.ts), and
  // ZoneTimeList's instantOnly prop skips printing the (identical) end time.
  const selectedSlots = useMemo(() => computeZoneTimes(zones, dateStr, startHour, 0), [zones, dateStr, startHour]);
  const selectedDateLabel = longDateLabel(dateStr);

  const setStartTimeToNow = () => {
    const value = nowTimeStr();
    setStartTime(value);
    setSetToNowAnnouncement(`Start time set to ${value}`);
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex flex-1 justify-center px-6 pt-12 pb-6">
        <div className="flex w-full max-w-[640px] flex-col gap-7">
          <div>
            <a
              href="./"
              className="mb-3 inline-block text-xs text-[var(--secondary-text)] hover:underline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-blue)]"
            >
              ← Back to Enhanced Meeting Scheduler
            </a>
            <h1 className="m-0 text-xl font-medium text-foreground">What time zone</h1>
          </div>

          {/* Every function of this page lives in one card — search, the start-time
              control, and the live readout — rather than three separate page sections,
              so the whole tool reads as a single self-contained instrument. A plain
              bordered box (no fill), not HeroUI's own Card surface: Card's default
              background is a lighter shade than the page in dark mode (#18181b vs
              #060607, measured live), which drops this app's AAA-verified
              --secondary-text/--brand-blue text pairs (tuned to just clear 7:1 against
              the *page*) to ~6.5-6.8:1 — under AAA, though still comfortably AA. A
              fill-less box keeps every color pairing exactly as already verified. */}
          <div className="flex flex-col gap-4 rounded-lg border border-[#767676] p-5 text-sm">
            <div className="flex flex-col gap-3">
              <h2 className="m-0 text-base font-medium text-foreground">Add a time zone</h2>
              <ComboBox.Root<TimeZoneCatalogEntry>
                items={asItems(availableZones)}
                inputValue={tzQuery}
                onInputChange={setTzQuery}
                selectedKey={null}
                onSelectionChange={(key) => {
                  if (key == null) return;
                  addZone(String(key));
                  setTzQuery("");
                }}
                fullWidth
                aria-label="Add a time zone"
              >
                <ComboBox.InputGroup>
                  <Input
                    ref={addZoneInputRef}
                    placeholder="Search for a city, country or time zone"
                    className="border border-[#767676]"
                  />
                  <ComboBox.Trigger />
                </ComboBox.InputGroup>
                <ComboBox.Popover className="max-h-72" translate="no">
                  <ListBox<TimeZoneCatalogEntry> items={asItems(availableZones)}>
                    {(zone) => (
                      <ListBox.Item id={zone.id} textValue={zoneDisplayLabel(zone, dateStr)}>
                        {zoneDisplayLabel(zone, dateStr)}
                      </ListBox.Item>
                    )}
                  </ListBox>
                </ComboBox.Popover>
              </ComboBox.Root>
              <TimezoneChipList zones={zones} onRemove={removeZone} addInputRef={addZoneInputRef} dateStr={dateStr} />
            </div>

            <Separator />

            <div className="flex flex-col gap-3">
              <h2 className="m-0 text-base font-medium text-foreground">Time</h2>
              <div className="flex max-w-[220px] flex-col gap-1.5">
                {/* items-center (not items-baseline): the button is itself a flex
                    container, and a flex container's baseline is computed from its
                    align-items-centered content rather than plain text metrics — with
                    items-baseline that put the button's text a few pixels off from the
                    label's true text baseline. Centering the row instead lines up both
                    visually regardless of the button's taller (min-h-6) hit-area box. */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[var(--secondary-text)]">Start time</span>
                  {/* min-h-6 (24px, WCAG 2.5.8): matches every other small button in this
                      app's own floor — see MeetingScheduler.tsx's chip/trigger buttons.
                      font-normal (not font-medium): matches the "Start time" label's own
                      weight exactly, so the two read as the same size at a glance. */}
                  <button
                    type="button"
                    onClick={setStartTimeToNow}
                    className="inline-flex min-h-6 items-center gap-1 text-xs font-normal text-[var(--brand-blue)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-blue)]"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      className="h-3 w-3"
                    >
                      <circle cx="12" cy="12" r="9" />
                      <polyline points="12 7 12 12 15 14" />
                    </svg>
                    Set to now
                  </button>
                </div>
                <TimePickerField value={startTime} onChange={setStartTime} aria-label="Start time" />
              </div>
              <div role="status" aria-live="polite" className="sr-only">
                {setToNowAnnouncement}
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-3">
              <h2 className="m-0 text-base font-medium text-foreground">Selected time</h2>
              {/* Nested panel: keeps the fixed-dark, AAA-verified readout treatment
                  MeetingScheduler's own "Selected time" card uses. */}
              <div className="flex flex-col gap-1 rounded-lg bg-zinc-800 p-4 text-zinc-50">
                <span className="font-bold">{selectedDateLabel}</span>
                {/* mutedTextClassName: this panel's bg-zinc-800 is fixed-dark regardless of
                    app theme — see ZoneTimeList.tsx / MeetingScheduler.tsx's own "Selected
                    time" card for the AAA-contrast rationale this reuses unchanged. */}
                <ZoneTimeList slots={selectedSlots} instantOnly tileLayout mutedTextClassName="text-[#b3b3bb]" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
