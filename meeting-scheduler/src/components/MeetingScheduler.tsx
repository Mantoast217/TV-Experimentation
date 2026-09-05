import { CalendarDate, Time, today, getLocalTimeZone } from "@internationalized/date";
import { Button, Calendar, Card, ComboBox, Input, ListBox, Popover, Separator, TimeField } from "@heroui/react";
import { useMemo, useRef, useState, type CSSProperties } from "react";
import { asItems } from "../lib/collection";
import { useAnchorZone } from "../lib/useAnchorZone";
import { AnchorZoneCallout } from "./AnchorZoneCallout";
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
  const [startTime, setStartTime] = useState("16:00");
  const [endTime, setEndTime] = useState("17:00");
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

  const orderedZones = useMemo(
    () => (anchorZone ? [anchorZone, ...zones.filter((zone) => zone.id !== anchorZone.id)] : zones),
    [zones, anchorZone],
  );
  const hostOffset = anchorZone?.offsetHours ?? 0;

  const selectedSlots = useMemo(
    () => computeZoneTimes(orderedZones, startHour, durationHours),
    [orderedZones, startHour, durationHours],
  );
  const selectedDateLabel = longDateLabel(dateStr);
  const selectedStartUtc = useMemo(
    () => wallClockToUtcDate(dateStr, startHour, hostOffset),
    [dateStr, startHour, hostOffset],
  );
  const selectedEndUtc = useMemo(
    () => wallClockToUtcDate(dateStr, startHour + durationHours, hostOffset),
    [dateStr, startHour, durationHours, hostOffset],
  );

  const optimalHour = useMemo(
    () => findOptimalStartHour(orderedZones, durationHours),
    [orderedZones, durationHours],
  );
  const optimalSlots = useMemo(
    () => computeZoneTimes(orderedZones, optimalHour, durationHours),
    [orderedZones, optimalHour, durationHours],
  );
  const optimalStartUtc = useMemo(
    () => wallClockToUtcDate(dateStr, optimalHour, hostOffset),
    [dateStr, optimalHour, hostOffset],
  );
  const optimalEndUtc = useMemo(
    () => wallClockToUtcDate(dateStr, optimalHour + durationHours, hostOffset),
    [dateStr, optimalHour, durationHours, hostOffset],
  );

  return (
    <div className="flex min-h-screen justify-center px-6 py-12">
      <div className="flex w-full max-w-[640px] flex-col gap-7">
        <div>
          <h1 className="m-0 mb-1 text-xl font-medium text-foreground">
            Schedule a meeting across time zones for everyone, everywhere
          </h1>
          <p className="m-0 text-sm text-[#515158]">
            Add everyone's time zone, pick a date and find the time that fits. Whether you are coordinating a
            team meeting or just checking what time it is for someone.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="text-base font-medium text-foreground">Add timezone</div>
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
            <ComboBox.Popover>
              <ListBox<TimeZoneCatalogEntry> items={asItems(availableZones)}>
                {(zone) => (
                  <ListBox.Item id={zone.id} textValue={zoneDisplayLabel(zone)}>
                    {zoneDisplayLabel(zone)}
                  </ListBox.Item>
                )}
              </ListBox>
            </ComboBox.Popover>
          </ComboBox.Root>
          <TimezoneChipList zones={zones} onRemove={removeZone} addInputRef={addZoneInputRef} />
        </div>

        <Separator />

        <div className="flex flex-col gap-5">
          {zones.length > 0 && anchorZone && (
            <AnchorZoneCallout
              zones={zones}
              anchorZone={anchorZone}
              isAutoAnchor={isAutoAnchor}
              onSelectAnchor={selectAnchor}
            />
          )}

          <div className="flex flex-1 flex-col gap-3">
            <div className="text-base font-medium text-foreground">Date</div>
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
            <div className="text-base font-medium text-foreground">Meeting time</div>
            <div className="@container">
              <div className="grid grid-cols-2 gap-2.5 @min-[480px]:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-[#515158]">Start time</span>
                  <TimePickerField value={startTime} onChange={handleStartTimeChange} aria-label="Start time" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-[#515158]">End time</span>
                  <TimePickerField
                    value={endTime}
                    onChange={setEndTime}
                    options={endTimeOptions}
                    aria-label="End time"
                  />
                </div>
                <div className="col-span-2 flex flex-col gap-1.5 @min-[480px]:col-span-1">
                  <span className="text-xs text-[#515158]">Duration</span>
                  <TimeField hourCycle={24} isReadOnly value={durationTime} aria-label="Duration" fullWidth>
                    <TimeField.Group fullWidth className="h-auto border border-[#767676]">
                      <TimeField.Input>{(segment) => <TimeField.Segment segment={segment} />}</TimeField.Input>
                    </TimeField.Group>
                  </TimeField>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-3">
          <div className="text-base font-medium text-foreground">Selected time</div>
          <Card.Root
            variant="default"
            className="flex-col gap-3 bg-zinc-800 p-0 text-zinc-50 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <Card.Content className="flex flex-col gap-1 p-4 px-5 text-sm">
              <span className="font-bold">{selectedDateLabel}</span>
              <ZoneTimeList slots={selectedSlots} />
            </Card.Content>
            <div className="px-5 pb-4 sm:px-0 sm:pb-0 sm:pr-5">
              <SendInviteMenu
                title="Meeting"
                description={formatZoneTimesText(selectedSlots)}
                start={selectedStartUtc}
                end={selectedEndUtc}
                variant="secondary"
                buttonStyle={{ "--button-fg": "#0D3F9C" } as CSSProperties}
                ariaLabel={`Create invite for ${selectedDateLabel}, ${startTime}–${endTime}`}
              />
            </div>
          </Card.Root>

          <div className="text-base font-medium text-foreground">Best time for everyone</div>
          <Card.Root
            variant="default"
            className="flex-col gap-3 border border-[#0D3F9C] bg-accent/10 p-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <Card.Content className="flex flex-col gap-1 p-4 px-5 text-sm">
              <span className="font-bold">{selectedDateLabel}</span>
              <ZoneTimeList slots={optimalSlots} />
            </Card.Content>
            <div className="px-5 pb-4 sm:px-0 sm:pb-0 sm:pr-5">
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
                ariaLabel={`Create invite for ${selectedDateLabel}, ${optimalSlots[0]?.startText ?? ""}–${optimalSlots[0]?.endText ?? ""}`}
              />
            </div>
          </Card.Root>
        </div>
      </div>
    </div>
  );
}
