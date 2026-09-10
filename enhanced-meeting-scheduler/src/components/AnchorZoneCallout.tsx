import { ListBox, Select } from "@heroui/react";
import { asItems } from "../lib/collection";
import { gmtOffsetLabel, zoneDisplayLabel, type TimeZoneCatalogEntry } from "../lib/timezones";

interface AnchorZoneCalloutProps {
  /** All added zones, in add-order, for the "Change" picker. */
  zones: TimeZoneCatalogEntry[];
  anchorZone: TimeZoneCatalogEntry;
  isAutoAnchor: boolean;
  onSelectAnchor: (id: string) => void;
  /** Reference date ("YYYY-MM-DD") the GMT qualifier and picker offsets are computed against. */
  dateStr: string;
}

/**
 * Hit area is set via inline style (rather than relying solely on the Tailwind
 * classes) so the 24x24 minimum (WCAG 2.5.8) holds even where the utility CSS
 * isn't loaded, e.g. in unit tests. Mirrors the same pattern used for the
 * timezone-chip remove buttons in TimezoneChipList.
 */
const changeTriggerHitArea = { minHeight: 24, minWidth: 24 };

export function AnchorZoneCallout({ zones, anchorZone, isAutoAnchor, onSelectAnchor, dateStr }: AnchorZoneCalloutProps) {
  const qualifier = isAutoAnchor ? `first added, ${gmtOffsetLabel(anchorZone.timezone, dateStr)}` : "selected";

  return (
    // min-h (not a fixed height) matches the invite-note box further down the page (same
    // 35px floor) so both same-style callout boxes read as one consistent component at
    // their common size — but this text is longer and can wrap on a narrow phone, so a
    // fixed height would clip it; min-height lets it grow instead. py-1 (rather than that
    // box's py-2) keeps the *unwrapped* height at exactly 35px while still leaving room
    // for the Change trigger's own 24px hit area, set via changeTriggerHitArea below.
    <div className="flex min-h-[35px] w-full items-center justify-between gap-3 rounded-lg border border-[#767676] bg-default-soft px-3 py-1 text-default-soft-foreground">
      <p aria-live="polite" className="m-0 text-xs leading-snug">
        Times below are shown in <strong>{anchorZone.city}</strong>'s time (<strong>{qualifier}</strong>).
      </p>

      <Select.Root<TimeZoneCatalogEntry>
        items={asItems(zones)}
        selectedKey={anchorZone.id}
        onSelectionChange={(key) => key != null && onSelectAnchor(String(key))}
        aria-label={`Change reference timezone, currently ${anchorZone.city}`}
      >
        <Select.Trigger
          style={changeTriggerHitArea}
          className="h-auto min-h-0 shrink-0 items-center justify-center border-0 bg-transparent p-0 text-xs font-normal text-default-soft-foreground underline underline-offset-2 shadow-none hover:bg-transparent"
        >
          Change
        </Select.Trigger>
        <Select.Popover placement="bottom end">
          <ListBox<TimeZoneCatalogEntry> items={asItems(zones)} aria-label="Reference timezone options">
            {(zone) => (
              <ListBox.Item id={zone.id} textValue={zoneDisplayLabel(zone, dateStr)}>
                {zoneDisplayLabel(zone, dateStr)}
              </ListBox.Item>
            )}
          </ListBox>
        </Select.Popover>
      </Select.Root>
    </div>
  );
}
