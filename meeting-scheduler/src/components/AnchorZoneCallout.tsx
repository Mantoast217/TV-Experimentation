import { ListBox, Select } from "@heroui/react";
import { asItems } from "../lib/collection";
import { gmtOffsetLabel, zoneDisplayLabel, type TimeZoneCatalogEntry } from "../lib/timezones";

interface AnchorZoneCalloutProps {
  /** All added zones, in add-order, for the "Change" picker. */
  zones: TimeZoneCatalogEntry[];
  anchorZone: TimeZoneCatalogEntry;
  isAutoAnchor: boolean;
  onSelectAnchor: (id: string) => void;
}

/**
 * Hit area is set via inline style (rather than relying solely on the Tailwind
 * classes) so the 24x24 minimum (WCAG 2.5.8) holds even where the utility CSS
 * isn't loaded, e.g. in unit tests. Mirrors the same pattern used for the
 * timezone-chip remove buttons in TimezoneChipList.
 */
const changeTriggerHitArea = { minHeight: 24, minWidth: 24 };

export function AnchorZoneCallout({ zones, anchorZone, isAutoAnchor, onSelectAnchor }: AnchorZoneCalloutProps) {
  const qualifier = isAutoAnchor ? `first added, ${gmtOffsetLabel(anchorZone.offsetHours)}` : "selected";

  return (
    <div className="flex min-h-[34px] w-full items-center justify-between gap-3 rounded-lg border border-[#767676] bg-default-soft px-3 py-2 text-default-soft-foreground">
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
          className="h-auto min-h-0 shrink-0 justify-center border-0 bg-transparent p-0 text-xs font-normal text-default-soft-foreground underline underline-offset-2 shadow-none hover:bg-transparent"
        >
          Change
        </Select.Trigger>
        <Select.Popover placement="bottom end">
          <ListBox<TimeZoneCatalogEntry> items={asItems(zones)} aria-label="Reference timezone options">
            {(zone) => (
              <ListBox.Item id={zone.id} textValue={zoneDisplayLabel(zone)}>
                {zoneDisplayLabel(zone)}
              </ListBox.Item>
            )}
          </ListBox>
        </Select.Popover>
      </Select.Root>
    </div>
  );
}
