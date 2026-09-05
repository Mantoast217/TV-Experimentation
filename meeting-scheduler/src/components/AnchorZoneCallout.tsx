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

const NAVY = "#33406b";

export function AnchorZoneCallout({ zones, anchorZone, isAutoAnchor, onSelectAnchor }: AnchorZoneCalloutProps) {
  const qualifier = isAutoAnchor ? `first added, ${gmtOffsetLabel(anchorZone.offsetHours)}` : "selected";

  return (
    <div
      className="flex min-h-[34px] w-full items-center justify-between gap-3 rounded-lg border px-3 py-2"
      style={{ backgroundColor: "#eef1fb", borderColor: "#a9b6e6" }}
    >
      <p aria-live="polite" className="m-0 text-xs leading-snug" style={{ color: NAVY }}>
        Times below are shown relative to <strong>{anchorZone.city}</strong> (<strong>{qualifier}</strong>).
      </p>

      <Select.Root<TimeZoneCatalogEntry>
        items={asItems(zones)}
        selectedKey={anchorZone.id}
        onSelectionChange={(key) => key != null && onSelectAnchor(String(key))}
        aria-label={`Change reference timezone, currently ${anchorZone.city}`}
      >
        <Select.Trigger
          className="h-auto min-h-0 shrink-0 border-0 bg-transparent p-0 text-xs font-normal underline underline-offset-2 shadow-none hover:bg-transparent"
          style={{ color: NAVY }}
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
