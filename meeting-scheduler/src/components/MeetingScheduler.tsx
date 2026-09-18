import { CalendarDate, Time, today, getLocalTimeZone } from "@internationalized/date";
import { Button, Calendar, Card, ComboBox, Input, ListBox, Popover, Separator, TimeField } from "@heroui/react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { asItems } from "../lib/collection";
import { useAnchorZone } from "../lib/useAnchorZone";
import { useTheme } from "../lib/useTheme";
import { AnchorZoneCallout } from "./AnchorZoneCallout";
import { ChevronLeftIcon, ChevronRightIcon, MoonIcon, SunIcon, TriangleAlertIcon } from "./icons";

/** Signed "+HH:MM"/"-HH:MM", zero-padded — matches the Duration field's own HH:MM styling. */
function formatSignedOffset(totalMinutes: number): string {
  const sign = totalMinutes < 0 ? "-" : "+";
  const absMinutes = Math.abs(totalMinutes);
  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;
  return `${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
import { SendInviteMenu } from "./SendInviteMenu";
import { TimePickerField } from "./TimePickerField";
import { TimezoneChipList } from "./TimezoneChipList";
import { ZoneTimeList } from "./ZoneTimeList";
import {
  buildEndTimeOptions,
  computeDurationHours,
  computeZoneTimes,
  findOptimalStartHour,
  formatZoneTimesText,
  parseHourValue,
  shiftTimeValue,
} from "../lib/scheduling";
import {
  DEFAULT_TIMEZONE_ID,
  TIMEZONE_CATALOG,
  longDateLabel,
  wallClockToUtcDate,
  zoneDisplayLabel,
  type TimeZoneCatalogEntry,
} from "../lib/timezones";

function toDateStr(date: CalendarDate): string {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function matchesQuery(zone: TimeZoneCatalogEntry, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  return (
    zone.country.toLowerCase().includes(q) ||
    zone.city.toLowerCase().includes(q) ||
    // Deliberately matches even though the same abbreviation can belong to several zones
    // (IST is India, Ireland, and Israel) — collisions are allowed, not deduplicated, same
    // as the display label itself; searching "IST" is expected to surface all of them so
    // the user can pick the one they mean by its city/country.
    (zone.stdAbbreviation?.toLowerCase().includes(q) ?? false) ||
    (zone.dstAbbreviation?.toLowerCase().includes(q) ?? false)
  );
}

export function MeetingScheduler() {
  const [zones, setZones] = useState<TimeZoneCatalogEntry[]>(() => {
    const uk = TIMEZONE_CATALOG.find((z) => z.id === DEFAULT_TIMEZONE_ID)!;
    return [uk];
  });
  const [selectedDate, setSelectedDate] = useState<CalendarDate>(() => today(getLocalTimeZone()));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [isDateOpen, setIsDateOpen] = useState(false);
  const [tzQuery, setTzQuery] = useState("");
  const addZoneInputRef = useRef<HTMLInputElement>(null);

  const dateStr = useMemo(() => toDateStr(selectedDate), [selectedDate]);

  const addZone = (id: string) => {
    const found = TIMEZONE_CATALOG.find((z) => z.id === id);
    if (!found) return;
    setZones((prev) => (prev.some((z) => z.id === id) ? prev : [...prev, found]));
  };

  const removeZone = (id: string) => {
    setZones((prev) => prev.filter((z) => z.id !== id));
  };

  // The catalog is curated to ~650 major cities/capitals (see
  // scripts/update-timezone-data.mjs's curateMajorCitiesAndCapitals) specifically so it's
  // small enough to render in full without a population-based cap or ranking — so results
  // sort alphabetically by city, the more predictable order for scanning/browsing a list
  // this size.
  const availableZones = useMemo(() => {
    const matches = TIMEZONE_CATALOG.filter((z) => !zones.some((added) => added.id === z.id) && matchesQuery(z, tzQuery));
    matches.sort((a, b) => a.city.localeCompare(b.city));
    return matches;
  }, [zones, tzQuery]);

  const startHour = parseHourValue(startTime);
  const endHour = parseHourValue(endTime);
  const durationHours = computeDurationHours(startHour, endHour);

  const endTimeOptions = useMemo(() => buildEndTimeOptions(startTime), [startTime]);

  const durationTime = useMemo(() => {
    const totalMinutes = Math.round(durationHours * 60) % (24 * 60);
    return new Time(Math.floor(totalMinutes / 60), totalMinutes % 60);
  }, [durationHours]);

  const handleStartTimeChange = (value: string) => {
    setStartTime(value);
    setEndTime(shiftTimeValue(value, durationHours));
  };

  const { anchorZone, isAutoAnchor, selectAnchor } = useAnchorZone(zones);
  const { theme, toggleTheme } = useTheme();

  const orderedZones = useMemo(
    () => (anchorZone ? [anchorZone, ...zones.filter((zone) => zone.id !== anchorZone.id)] : zones),
    [zones, anchorZone],
  );
  const hostZone = anchorZone?.timezone ?? "UTC";

  const selectedSlots = useMemo(
    () => computeZoneTimes(orderedZones, dateStr, startHour, durationHours),
    [orderedZones, dateStr, startHour, durationHours],
  );
  const selectedDateLabel = longDateLabel(dateStr);
  const selectedStartUtc = useMemo(
    () => wallClockToUtcDate(dateStr, startHour, hostZone),
    [dateStr, startHour, hostZone],
  );
  const selectedEndUtc = useMemo(
    () => wallClockToUtcDate(dateStr, startHour + durationHours, hostZone),
    [dateStr, startHour, durationHours, hostZone],
  );

  const optimalHour = useMemo(
    () => findOptimalStartHour(orderedZones, dateStr, durationHours),
    [orderedZones, dateStr, durationHours],
  );

  // Manual 15-min nudge on top of the computed "best time". Resets on any edit to the
  // original settings — zones, the date, the start time, or the duration — tracked via
  // those raw inputs directly rather than the derived optimalHour: a zone or duration
  // edit doesn't always move the algorithm's answer (e.g. the default single-host,
  // 09:00-10:00 case has a wide zero-penalty plateau that absorbs small changes without
  // shifting bestHour), so resetting only when optimalHour's *value* actually differs
  // would silently fail to reset on a real edit whenever the recomputed value happens to
  // coincide with the old one.
  const NUDGE_STEP_MINUTES = 15;
  const [manualOffsetMinutes, setManualOffsetMinutes] = useState(0);
  useEffect(() => {
    setManualOffsetMinutes(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones, dateStr, startHour, durationHours]);
  const isManuallyAdjusted = manualOffsetMinutes !== 0;
  const adjustedOptimalHour = optimalHour + manualOffsetMinutes / 60;
  const adjustedOptimalSlots = useMemo(
    () => computeZoneTimes(orderedZones, dateStr, adjustedOptimalHour, durationHours),
    [orderedZones, dateStr, adjustedOptimalHour, durationHours],
  );
  const adjustedOptimalStartUtc = useMemo(
    () => wallClockToUtcDate(dateStr, adjustedOptimalHour, hostZone),
    [dateStr, adjustedOptimalHour, hostZone],
  );
  const adjustedOptimalEndUtc = useMemo(
    () => wallClockToUtcDate(dateStr, adjustedOptimalHour + durationHours, hostZone),
    [dateStr, adjustedOptimalHour, durationHours, hostZone],
  );
  const nudgeOptimalTime = (direction: 1 | -1) => setManualOffsetMinutes((prev) => prev + direction * NUDGE_STEP_MINUTES);

  // min-h-dvh (not min-h-screen/100vh): mobile browsers size 100vh against the browser chrome
  // being fully collapsed, so on first load (address bar visible) 100vh overshoots the
  // actually-visible area and can jump as the chrome shows/hides on scroll. 100dvh tracks the
  // real visible viewport; desktop browsers don't have collapsing chrome, so this renders
  // identically to 100vh there.
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex flex-1 justify-center px-6 pt-12 pb-6">
        <div className="flex w-full max-w-[640px] flex-col gap-7">
        <div className="flex items-start justify-between gap-3">
          <div>
          <h1 className="m-0 mb-1 text-xl font-medium text-foreground">
            Schedule a meeting across time zones for everyone, everywhere
          </h1>
          <p className="m-0 text-sm text-[var(--secondary-text)]">
            Add everyone's time zone, pick a date and find the time that fits. Whether you are coordinating a
            team meeting or just checking what time it is for someone.
          </p>
          </div>
          {/* Placed in normal (not visually-reordered) DOM order, right after the heading
              text: reading/tab order matches what's on screen (heading+subheading, then the
              button), and — since headings/paragraphs aren't focusable — this still lands as
              the very first Tab stop on the page, ahead of the timezone search input. Moved
              here from the footer specifically for that: a user who needs dark mode
              immediately (e.g. light sensitivity) previously had to tab through the entire
              form, or scroll past it, to reach the toggle. */}
          {/* No outline-offset (unlike this app's other focus-visible controls): the floating
              detached-ring look is what read as too heavy on a small round button. The
              outline itself stays — removing it outright would fail WCAG 2.4.7 Focus Visible
              for keyboard users, which isn't optional at any conformance level (this app
              already holds itself to AAA elsewhere). Tightening it to hug the button directly
              keeps a clearly visible indicator without the halo. */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--secondary-text)] hover:text-foreground focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-[var(--brand-blue)]"
          >
            {theme === "dark" ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
          </button>
        </div>

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
            {/* max-h-72: without a max-height the popover renders full-height (measured
                ~12,460px against an earlier, much larger catalog), which can open upward
                and cover the page header on a short viewport. The popover already has
                overflow-y-auto built in (combo-box.css), so this just gives it something
                to actually scroll within — the ~800-entry catalog itself renders in full,
                unpaginated (verified live: render time is flat regardless of result count
                at this scale, see MeetingScheduler.test.tsx). */}
            {/* translate="no": this list re-renders on every keystroke as the query
                filters it — a browser page-translator replacing these text nodes with its
                own wrapper elements on that cadence is the same failure reproduced and
                fixed in ZoneTimeList.tsx. */}
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

        <div className="flex flex-col gap-5">
          {zones.length > 0 && anchorZone && (
            <AnchorZoneCallout
              zones={zones}
              anchorZone={anchorZone}
              isAutoAnchor={isAutoAnchor}
              onSelectAnchor={selectAnchor}
              dateStr={dateStr}
            />
          )}

          <div className="flex flex-1 flex-col gap-3">
            <h2 className="m-0 text-base font-medium text-foreground">Date</h2>
            <Popover.Root isOpen={isDateOpen} onOpenChange={setIsDateOpen}>
              <Button
                variant="outline"
                className="w-full justify-between border-[#767676] font-normal"
                aria-label={`Choose date, currently ${selectedDateLabel}`}
              >
                <span>{selectedDateLabel}</span>
                <svg
                  aria-hidden="true"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </Button>
              <Popover.Content placement="bottom start">
                <Popover.Dialog>
                  <Calendar
                    aria-label="Meeting date"
                    value={selectedDate}
                    // A meeting can't be scheduled for a day that's already passed —
                    // disables every date before today (in the viewer's own local
                    // calendar) rather than letting one through and computing a "best
                    // time" for a meeting that already happened.
                    minValue={today(getLocalTimeZone())}
                    onChange={(value) => {
                      if (!value) return;
                      setSelectedDate(value as CalendarDate);
                      setIsDateOpen(false);
                    }}
                  >
                    <Calendar.Header>
                      <Calendar.YearPickerTrigger>
                        <Calendar.YearPickerTriggerHeading />
                        <Calendar.YearPickerTriggerIndicator />
                      </Calendar.YearPickerTrigger>
                      <Calendar.NavButton slot="previous" />
                      <Calendar.NavButton slot="next" />
                    </Calendar.Header>
                    <Calendar.Grid>
                      <Calendar.GridHeader>
                        {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                      </Calendar.GridHeader>
                      <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
                    </Calendar.Grid>
                    <Calendar.YearPickerGrid>
                      <Calendar.YearPickerGridBody>
                        {({ year }) => <Calendar.YearPickerCell year={year} />}
                      </Calendar.YearPickerGridBody>
                    </Calendar.YearPickerGrid>
                  </Calendar>
                </Popover.Dialog>
              </Popover.Content>
            </Popover.Root>
          </div>

          <div className="flex flex-1 flex-col gap-3">
            <h2 className="m-0 text-base font-medium text-foreground">Meeting time</h2>
            <div className="@container">
              <div className="grid grid-cols-2 gap-2.5 @min-[480px]:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-[var(--secondary-text)]">Start time</span>
                  <TimePickerField value={startTime} onChange={handleStartTimeChange} aria-label="Start time" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-[var(--secondary-text)]">End time</span>
                  <TimePickerField
                    value={endTime}
                    onChange={setEndTime}
                    options={endTimeOptions}
                    aria-label="End time"
                  />
                </div>
                <div className="col-span-2 flex flex-col gap-1.5 @min-[480px]:col-span-1">
                  <span className="text-xs text-[var(--secondary-text)]">Duration</span>
                  <TimeField
                    hourCycle={24}
                    isReadOnly
                    value={durationTime}
                    aria-label={durationHours === 24 ? "Duration, 24 hours, ending the next day" : "Duration"}
                    fullWidth
                  >
                    <TimeField.Group fullWidth className="h-auto border border-[#767676]">
                      <TimeField.Input>
                      {(segment) => (
                        <TimeField.Segment
                          segment={segment}
                          className="rounded-sm focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--brand-blue)]"
                        />
                      )}
                    </TimeField.Input>
                    </TimeField.Group>
                  </TimeField>
                </div>
              </div>
            </div>
            {/* durationTime necessarily reads 00:00 here: Time (a wall-clock type, hour 0-23)
                can't represent a 24h *duration* directly, and start===end is the only input
                that produces exactly 24h (computeDurationHours wraps a zero diff to +24).
                Left unexplained, 00:00 reads as a broken/zero-length meeting rather than the
                valid full-day one it actually is (the "Selected time"/"Best time" cards already
                show this correctly via their own +1 day-offset chips). */}
            {durationHours === 24 && (
              <div
                role="status"
                className="flex items-start gap-2 rounded-lg border border-[#767676] bg-default-soft px-3 py-1.5 text-default-soft-foreground"
              >
                <TriangleAlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="m-0 text-xs leading-snug">
                  Start and end time are the same, so this is a full 24-hour meeting ending the next day — not a
                  0-minute one.
                </p>
              </div>
            )}
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-3">
          {/* min-h (not a fixed height): matches AnchorZoneCallout's box at their common
              35px size, but still lets this grow instead of clipping if the text ever
              wraps (e.g. a narrower viewport than tested, or a future wording change). */}
          <div className="flex min-h-[35px] w-full items-center rounded-lg border border-[#767676] bg-default-soft px-3 py-2 text-default-soft-foreground">
            <p id="invite-note" className="m-0 text-xs leading-snug">
              Invites are set up through your own calendar/meeting app.
            </p>
          </div>

          <h2 className="m-0 text-base font-medium text-foreground">Selected time</h2>
          <Card.Root variant="default" className="flex-col gap-3 bg-zinc-800 p-0 text-zinc-50">
            <Card.Content className="flex flex-col gap-1 p-4 px-5 text-sm">
              {/* Heading and invite button share a row (rather than the button being
                  absolutely positioned over a padding-reserved column) so the date label
                  and every ZoneTimeList row below it can each use the card's full width —
                  a fixed pr-* reservation on the whole column narrowed every attendee row,
                  not just the one row the button actually sits beside, which is what forced
                  city/time/period onto two lines on a real phone. */}
              <div className="flex items-start justify-between gap-3">
                <span className="font-bold">{selectedDateLabel}</span>
                {/* No invite for a meeting with no attendees: with zero zones added there's
                    nothing to invite anyone to (or to compute a timezone-aware time for) —
                    see ZoneTimeList's own "Add a timezone..." placeholder just above this. */}
                {zones.length > 0 && (
                  <div className="shrink-0">
                    <SendInviteMenu
                      title="Meeting"
                      description={formatZoneTimesText(selectedSlots)}
                      start={selectedStartUtc}
                      end={selectedEndUtc}
                      variant="secondary"
                      // Fixed (not theme-reactive): this button always sits on the "Selected time"
                      // card's own fixed dark background (bg-zinc-800, unaffected by dark mode below),
                      // so it needs to stay a fixed light pill regardless of theme. The default
                      // "secondary" variant's --button-bg comes from HeroUI's --default token, which
                      // goes dark in dark mode (verified live: that drops this to a 1.57:1 button-text
                      // contrast, failing badly) — overriding it here keeps the pairing at 7.98:1 in
                      // both themes, since neither color it's built from ever changes.
                      buttonStyle={{ "--button-fg": "#0D3F9C", "--button-bg": "#ebebec" } as CSSProperties}
                      ariaLabel={`Set up invite for your selected time, ${selectedDateLabel}, ${startTime}–${endTime}`}
                      describedById="invite-note"
                    />
                  </div>
                )}
              </div>
              {/* qualityLabelClassName: this card's bg-zinc-800 is fixed-dark regardless of
                  app theme (like the invite button just above), so the label needs a fixed
                  color verified against that exact background, not the theme-reactive
                  --secondary-text default (which measures ~1.7:1 here in light mode) —
                  see ZoneTimeList.tsx. #b3b3bb clears 7.15:1 against #27272a. */}
              <ZoneTimeList slots={selectedSlots} qualityLabelClassName="text-[#b3b3bb]" />
            </Card.Content>
          </Card.Root>

          <h2 className="m-0 text-base font-medium text-foreground">Best time for everyone</h2>
          <div role="status" aria-live="polite" className="sr-only">
            {isManuallyAdjusted ? `Best time adjusted to ${adjustedOptimalSlots[0]?.startText ?? ""}` : ""}
          </div>
          <Card.Root variant="default" className="flex-col gap-3 border border-[var(--brand-blue)] bg-accent/10 p-0">
            <Card.Content className="flex flex-col gap-1 p-4 px-5 text-sm">
              {/* Heading and invite button share a row — see the matching comment on the
                  "Selected time" card above for why this replaced the old pr-40 reservation. */}
              <div className="flex items-start justify-between gap-3">
                <span className="font-bold">{selectedDateLabel}</span>
                {zones.length > 0 && (
                  <div className="shrink-0">
                    <SendInviteMenu
                      title="Meeting"
                      description={formatZoneTimesText(adjustedOptimalSlots)}
                      start={adjustedOptimalStartUtc}
                      end={adjustedOptimalEndUtc}
                      variant="primary"
                      buttonStyle={
                        {
                          "--button-bg": "#0D3F9C",
                          "--button-bg-hover": "#0D3F9C",
                          "--button-bg-pressed": "#0D3F9C",
                        } as CSSProperties
                      }
                      ariaLabel={`Set up invite for the best time for everyone, ${selectedDateLabel}, ${adjustedOptimalSlots[0]?.startText ?? ""}–${adjustedOptimalSlots[0]?.endText ?? ""}`}
                      describedById="invite-note"
                    />
                  </div>
                )}
              </div>
              <ZoneTimeList slots={adjustedOptimalSlots} />
              {/* Adjusting or inviting to a "best time" computed from zero attendees isn't
                  meaningful — hidden along with the invite button below until at least one
                  zone is added (see the matching guard on "Selected time" above). */}
              {zones.length > 0 && (
                <div className="mt-2 flex items-center gap-2 border-t border-[var(--brand-blue)]/25 pt-2">
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => nudgeOptimalTime(-1)}
                      aria-label={`Move best time back 15 minutes, currently ${adjustedOptimalSlots[0]?.startText ?? ""}`}
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-blue)]"
                    >
                      <ChevronLeftIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => nudgeOptimalTime(1)}
                      aria-label={`Move best time forward 15 minutes, currently ${adjustedOptimalSlots[0]?.startText ?? ""}`}
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-blue)]"
                    >
                      <ChevronRightIcon className="h-4 w-4" />
                    </button>
                  </div>
                  <span className="text-xs text-[var(--secondary-text)]">
                    {isManuallyAdjusted ? `Adjusted ${formatSignedOffset(manualOffsetMinutes)}` : "Adjust time"}
                  </span>
                </div>
              )}
            </Card.Content>
          </Card.Root>
        </div>
        </div>
      </main>
      <footer className="flex justify-center px-6 pb-8">
        <div className="flex w-full max-w-[640px] flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--secondary-text)]">
          <a
            href="privacy.html"
            className="hover:underline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-blue)]"
          >
            Privacy Policy
          </a>
          <a
            href="terms.html"
            className="hover:underline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-blue)]"
          >
            Terms of Use
          </a>
          <a
            href="what-time-zone.html"
            className="hover:underline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-blue)]"
          >
            What time zone
          </a>
          <a
            href="https://forms.gle/ouHxxGzu4Sjz2Jdi7"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-blue)]"
          >
            Feedback
          </a>
          {/* Absolute, unlike the privacy/terms links above: this points at a sibling app
              served from its own subpath (see enhanced-meeting-scheduler/vite.config.ts's
              base), not a page within this app. */}
          <a
            href="/enhanced-meeting-scheduler/"
            className="hover:underline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-blue)]"
          >
            Enhanced Meeting Scheduler
          </a>
        </div>
      </footer>
    </div>
  );
}
