import { describe, expect, it } from "vitest";
import { gmtOffsetLabel, zoneAbbreviation, zoneDisplayLabel } from "./timezones";
import type { TimeZoneCatalogEntry } from "./timezoneData";

// July: London/New York/Dublin are in their daylight period. January: back to standard.
const JULY = "2026-07-15";
const JANUARY = "2026-01-15";

function zone(overrides: Partial<TimeZoneCatalogEntry>): TimeZoneCatalogEntry {
  return { id: "test", city: "Test City", country: "Testland", countryCode: "TL", timezone: "UTC", ...overrides };
}

describe("zoneAbbreviation", () => {
  it("returns the standard abbreviation outside DST", () => {
    const london = zone({ timezone: "Europe/London", stdAbbreviation: "GMT", dstAbbreviation: "BST" });
    expect(zoneAbbreviation(london, JANUARY)).toBe("GMT");
  });

  it("returns the daylight abbreviation when the date falls in DST", () => {
    const london = zone({ timezone: "Europe/London", stdAbbreviation: "GMT", dstAbbreviation: "BST" });
    expect(zoneAbbreviation(london, JULY)).toBe("BST");
  });

  it("returns the standard abbreviation for a zone with no DST at all (India)", () => {
    const mumbai = zone({ timezone: "Asia/Kolkata", stdAbbreviation: "IST" });
    expect(zoneAbbreviation(mumbai, JULY)).toBe("IST");
    expect(zoneAbbreviation(mumbai, JANUARY)).toBe("IST");
  });

  it("returns the SAME 'IST' for a completely different zone/country — collisions are allowed, not deduplicated", () => {
    const mumbai = zone({ timezone: "Asia/Kolkata", countryCode: "IN", stdAbbreviation: "IST" });
    const jerusalem = zone({ timezone: "Asia/Jerusalem", countryCode: "IL", stdAbbreviation: "IST", dstAbbreviation: "IDT" });
    expect(zoneAbbreviation(mumbai, JANUARY)).toBe("IST");
    expect(zoneAbbreviation(jerusalem, JANUARY)).toBe("IST");
  });

  it("returns null when tzdb has no traditional abbreviation at all (numeric-offset-only zones)", () => {
    const chatham = zone({ timezone: "Pacific/Chatham" }); // No stdAbbreviation/dstAbbreviation set.
    expect(zoneAbbreviation(chatham, JULY)).toBeNull();
  });

  it("falls back to the standard abbreviation if isInDST is true but no dst abbreviation was stored (defensive)", () => {
    const london = zone({ timezone: "Europe/London", stdAbbreviation: "GMT" }); // dstAbbreviation omitted.
    expect(zoneAbbreviation(london, JULY)).toBe("GMT");
  });
});

describe("zoneDisplayLabel", () => {
  const london = zone({ city: "London", country: "United Kingdom", countryCode: "GB", timezone: "Europe/London", stdAbbreviation: "GMT", dstAbbreviation: "BST" });
  const tokyo = zone({ city: "Tokyo", country: "Japan", countryCode: "JP", timezone: "Asia/Tokyo", stdAbbreviation: "JST" });
  const chatham = zone({ city: "Chatham", country: "New Zealand", countryCode: "NZ", timezone: "Pacific/Chatham" });

  it("includes the abbreviation before the GMT offset when one exists", () => {
    expect(zoneDisplayLabel(london, JULY)).toBe(`London — United Kingdom (BST / ${gmtOffsetLabel("Europe/London", JULY)})`);
  });

  it("switches to the standard abbreviation once DST ends", () => {
    expect(zoneDisplayLabel(london, JANUARY)).toBe(`London — United Kingdom (GMT / ${gmtOffsetLabel("Europe/London", JANUARY)})`);
  });

  it("shows a single, non-DST abbreviation for a zone that never observes DST (Japan)", () => {
    expect(zoneDisplayLabel(tokyo, JULY)).toBe(`Tokyo — Japan (JST / ${gmtOffsetLabel("Asia/Tokyo", JULY)})`);
  });

  it("falls back to the plain GMT offset alone when tzdb has no abbreviation at all", () => {
    expect(zoneDisplayLabel(chatham, JULY)).toBe(`Chatham — New Zealand (${gmtOffsetLabel("Pacific/Chatham", JULY)})`);
  });
});
