import { describe, expect, it } from "vitest";
import { gmtOffsetLabel, zoneAbbreviation, zoneDisplayLabel } from "./timezones";
import type { TimeZoneCatalogEntry } from "./timezones";

// July: London is on BST (a real, distinct abbreviation); Tokyo/India have no letter
// abbreviation in either en-GB or en-US Intl data, so fall back to null.
const JULY = "2026-07-15";
// January: London reverts to plain "GMT" (Intl gives "GMT", correctly treated as no
// distinct abbreviation, not a real one to show).
const JANUARY = "2026-01-15";

describe("zoneAbbreviation", () => {
  it("returns a real abbreviation when one exists and differs from the GMT offset (London, BST)", () => {
    expect(zoneAbbreviation("Europe/London", JULY)).toBe("BST");
  });

  it("returns a real abbreviation for a US zone (New York, EDT in July)", () => {
    expect(zoneAbbreviation("America/New_York", JULY)).toBe("EDT");
  });

  it("returns null rather than a redundant 'GMT+X' duplicate when Intl has no real abbreviation (Tokyo)", () => {
    expect(zoneAbbreviation("Asia/Tokyo", JULY)).toBeNull();
  });

  it("returns null for a half-hour-offset zone with no letter abbreviation (India)", () => {
    expect(zoneAbbreviation("Asia/Kolkata", JULY)).toBeNull();
  });

  it("returns null rather than the bare word 'GMT' (London in January, no DST)", () => {
    expect(zoneAbbreviation("Europe/London", JANUARY)).toBeNull();
  });

  it("returns null for UTC itself rather than the redundant word 'UTC'", () => {
    expect(zoneAbbreviation("UTC", JULY)).toBeNull();
  });

  it("returns null rather than throwing for an unresolvable zone id", () => {
    expect(zoneAbbreviation("Not/A_Real_Zone", JULY)).toBeNull();
  });
});

describe("zoneDisplayLabel", () => {
  const london: TimeZoneCatalogEntry = { id: "gb-london", city: "London", country: "United Kingdom", countryCode: "GB", timezone: "Europe/London" };
  const tokyo: TimeZoneCatalogEntry = { id: "jp-tokyo", city: "Tokyo", country: "Japan", countryCode: "JP", timezone: "Asia/Tokyo" };

  it("includes the abbreviation before the GMT offset when one exists", () => {
    expect(zoneDisplayLabel(london, JULY)).toBe(`London — United Kingdom (BST / ${gmtOffsetLabel("Europe/London", JULY)})`);
  });

  it("falls back to the plain GMT offset alone when there's no real abbreviation", () => {
    expect(zoneDisplayLabel(tokyo, JULY)).toBe(`Tokyo — Japan (${gmtOffsetLabel("Asia/Tokyo", JULY)})`);
  });

  it("drops the abbreviation (not just leaves it blank) once DST ends and Intl only offers the bare word 'GMT'", () => {
    expect(zoneDisplayLabel(london, JANUARY)).toBe(`London — United Kingdom (${gmtOffsetLabel("Europe/London", JANUARY)})`);
  });
});
