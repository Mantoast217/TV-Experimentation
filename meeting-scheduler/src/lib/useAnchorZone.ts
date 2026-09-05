import { useState } from "react";
import type { TimeZoneCatalogEntry } from "./timezones";

export interface AnchorZoneState {
  anchorZone: TimeZoneCatalogEntry | null;
  /** True while the anchor is the default (first-added) zone rather than a manual pick. */
  isAutoAnchor: boolean;
  selectAnchor: (id: string) => void;
}

/**
 * Tracks which added timezone acts as the "reference" zone for display/ordering.
 * Defaults to the first-added zone and follows it as chips are added/removed; a
 * manual pick (via `selectAnchor`) overrides that until the picked zone is itself
 * removed, at which point it reverts to the first-added default automatically.
 */
export function useAnchorZone(zones: TimeZoneCatalogEntry[]): AnchorZoneState {
  const [manualAnchorId, setManualAnchorId] = useState<string | null>(null);
  // Adjust state during render (not in an effect) when the manual anchor's zone
  // disappears, so a later re-add of the same id can't silently resurrect it.
  const [prevZones, setPrevZones] = useState(zones);
  if (zones !== prevZones) {
    setPrevZones(zones);
    if (manualAnchorId != null && !zones.some((zone) => zone.id === manualAnchorId)) {
      setManualAnchorId(null);
    }
  }

  const autoAnchorZone = zones[0] ?? null;
  const manualAnchorZone =
    manualAnchorId != null ? (zones.find((zone) => zone.id === manualAnchorId) ?? null) : null;
  const anchorZone = manualAnchorZone ?? autoAnchorZone;

  const selectAnchor = (id: string) => {
    setManualAnchorId(id === autoAnchorZone?.id ? null : id);
  };

  return { anchorZone, isAutoAnchor: manualAnchorZone == null, selectAnchor };
}
