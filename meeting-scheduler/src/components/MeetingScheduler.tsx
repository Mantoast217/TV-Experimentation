import { CalendarDate, Time, today, getLocalTimeZone } from "@internationalized/date";
import { Button, Calendar, Card, ComboBox, Input, ListBox, Popover, Separator, TimeField } from "@heroui/react";
import { useMemo, useRef, useState, type CSSProperties } from "react";
import { asItems } from "../lib/collection";
import { useAnchorZone } from "../lib/useAnchorZone";
import { useTheme } from "../lib/useTheme";
import { AnchorZoneCallout } from "./AnchorZoneCallout";
import { MoonIcon, SunIcon } from "./icons";
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
  return zone.country.toLowerCase().includes(q) || zone.city.toLowerCase().includes(q);
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

  const availableZones = useMemo(
    () =>
      TIMEZONE_CATALOG.filter((z) => !zones.some((added) => added.id === z.id) && matchesQuery(z, tzQuery)).sort(
        (a, b) => a.city.localeCompare(b.city),
      ),
    [zones, tzQuery],
  );

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
  const optimalSlots = useMemo(
    () => computeZoneTimes(orderedZones, dateStr, optimalHour, durationHours),
    [orderedZones, dateStr, optimalHour, durationHours],
  );
  const optimalStartUtc = useMemo(
    () => wallClockToUtcDate(dateStr, optimalHour, hostZone),
    [dateStr, optimalHour, hostZone],
  );
  const optimalEndUtc = useMemo(
    () => wallClockToUtcDate(dateStr, optimalHour + durationHours, hostZone),
    [dateStr, optimalHour, durationHours, hostZone],
  );

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
          <h2 className="m-0 text-base font-medium text-foreground">Add timezone</h2>
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
            aria-label="Add timezone"
          >
            <ComboBox.InputGroup>
              <Input
                ref={addZoneInputRef}
                placeholder="Search for a city or country"
                className="border border-[#767676]"
              />
              <ComboBox.Trigger />
            </ComboBox.InputGroup>
            {/* max-h-72: the unfiltered catalog is ~400 entries — without a cap the popover
                renders full-height (measured ~12,460px), which can open upward and cover the
                page header on a short viewport. The popover already has overflow-y-auto built
                in (combo-box.css), so this just gives it something to actually scroll within. */}
            <ComboBox.Popover className="max-h-72">
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
                  <TimeField hourCycle={24} isReadOnly value={durationTime} aria-label="Duration" fullWidth>
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
          <Card.Root variant="default" className="relative flex-col gap-3 bg-zinc-800 p-0 text-zinc-50">
            {/* pr-40: reserves enough space for the invite button, whose ~131px width is fixed
                regardless of viewport. The old pr-32/sm:pr-36 split under-reserved at every
                breakpoint (worst case: 131px button + 20px right-inset at sm+ needs ~151px), which
                is what let the button overlap the date heading on a real phone. */}
            <Card.Content className="flex flex-col gap-1 p-4 px-5 pr-40 text-sm">
              <span className="font-bold">{selectedDateLabel}</span>
              <ZoneTimeList slots={selectedSlots} />
            </Card.Content>
            <div className="absolute top-4 right-4 sm:right-5">
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
          </Card.Root>

          <h2 className="m-0 text-base font-medium text-foreground">Best time for everyone</h2>
          <Card.Root variant="default" className="relative flex-col gap-3 border border-[var(--brand-blue)] bg-accent/10 p-0">
            {/* pr-40: reserves enough space for the invite button, whose ~131px width is fixed
                regardless of viewport. The old pr-32/sm:pr-36 split under-reserved at every
                breakpoint (worst case: 131px button + 20px right-inset at sm+ needs ~151px), which
                is what let the button overlap the date heading on a real phone. */}
            <Card.Content className="flex flex-col gap-1 p-4 px-5 pr-40 text-sm">
              <span className="font-bold">{selectedDateLabel}</span>
              <ZoneTimeList slots={optimalSlots} />
            </Card.Content>
            <div className="absolute top-4 right-4 sm:right-5">
              <SendInviteMenu
                title="Meeting"
                description={formatZoneTimesText(optimalSlots)}
                start={optimalStartUtc}
                end={optimalEndUtc}
                variant="primary"
                buttonStyle={
                  {
                    "--button-bg": "#0D3F9C",
                    "--button-bg-hover": "#0D3F9C",
                    "--button-bg-pressed": "#0D3F9C",
                  } as CSSProperties
                }
                ariaLabel={`Set up invite for the best time for everyone, ${selectedDateLabel}, ${optimalSlots[0]?.startText ?? ""}–${optimalSlots[0]?.endText ?? ""}`}
                describedById="invite-note"
              />
            </div>
          </Card.Root>
        </div>
        </div>
      </main>
      <footer className="flex justify-center px-6 pb-8">
        <div className="flex w-full max-w-[640px] flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--secondary-text)]">
          <a
            href="/privacy.html"
            className="hover:underline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-blue)]"
          >
            Privacy Policy
          </a>
          <a
            href="/terms.html"
            className="hover:underline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-blue)]"
          >
            Terms of Use
          </a>
          <a
            href="https://forms.gle/ouHxxGzu4Sjz2Jdi7"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-blue)]"
          >
            Feedback
          </a>
        </div>
      </footer>
    </div>
  );
}
