import { describe, expect, it } from "vitest";
import { NOTABLE_CITIES, buildNotableCityEntries, mergeWithNotableCities } from "./notableCities.mjs";

const IANA_ZONE_PATTERN = /^[A-Za-z_]+\/[A-Za-z_]+$/;

describe("NOTABLE_CITIES", () => {
  it("has well-formed entries: two-letter uppercase country code, plausible IANA zone id", () => {
    for (const entry of NOTABLE_CITIES) {
      expect(entry.countryCode).toMatch(/^[A-Z]{2}$/);
      expect(entry.timezone).toMatch(IANA_ZONE_PATTERN);
      expect(entry.city.length).toBeGreaterThan(0);
      expect(entry.population).toBeGreaterThan(0);
    }
  });

  it("has no duplicate (city, countryCode) pairs within the list itself", () => {
    const seen = new Set();
    for (const { city, countryCode } of NOTABLE_CITIES) {
      const key = `${countryCode}|${city}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});

describe("buildNotableCityEntries", () => {
  it("resolves each entry's country name from the given countryByCode map", () => {
    const countryByCode = new Map([
      ["US", "United States"],
      ["IT", "Italy"],
    ]);
    const entries = buildNotableCityEntries(countryByCode);
    const venice = entries.find((e) => e.city === "Venice");
    expect(venice?.country).toBe("Italy");
    const boston = entries.find((e) => e.city === "Boston");
    expect(boston?.country).toBe("United States");
  });

  it("skips entries whose country code has no matching row, rather than guessing a name", () => {
    const countryByCode = new Map([["US", "United States"]]); // Missing every other code on purpose.
    const entries = buildNotableCityEntries(countryByCode);
    expect(entries.every((e) => e.countryCode === "US")).toBe(true);
    expect(entries.length).toBeLessThan(NOTABLE_CITIES.length);
  });

  it("gives every entry a stable, unique id distinct from the major-cities and backbone id schemes", () => {
    const countryByCode = new Map(NOTABLE_CITIES.map(({ countryCode }) => [countryCode, countryCode]));
    const entries = buildNotableCityEntries(countryByCode);
    const ids = entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id.endsWith("-notable")).toBe(true);
    }
  });
});

describe("mergeWithNotableCities", () => {
  it("adds a notable city that isn't already present", () => {
    const existing = [{ id: "gb-london-1", city: "London", country: "United Kingdom", countryCode: "GB", timezone: "Europe/London" }];
    const notable = [{ id: "gb-liverpool-notable", city: "Liverpool", country: "United Kingdom", countryCode: "GB", timezone: "Europe/London" }];
    const merged = mergeWithNotableCities(existing, notable);
    expect(merged).toHaveLength(2);
    expect(merged.some((e) => e.city === "Liverpool")).toBe(true);
  });

  it("does not duplicate a city+country pair the catalog already has, even under a different id/timezone spelling", () => {
    const existing = [{ id: "it-venice-123", city: "Venice", country: "Italy", countryCode: "IT", timezone: "Europe/Rome" }];
    const notable = [{ id: "it-venice-notable", city: "Venice", country: "Italy", countryCode: "IT", timezone: "Europe/Rome" }];
    const merged = mergeWithNotableCities(existing, notable);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("it-venice-123"); // The existing, richer entry always wins.
  });

  it("allows the same city name in two different countries", () => {
    const existing = [{ id: "us-florence-1", city: "Florence", country: "United States", countryCode: "US", timezone: "America/New_York" }];
    const notable = [{ id: "it-florence-notable", city: "Florence", country: "Italy", countryCode: "IT", timezone: "Europe/Rome" }];
    const merged = mergeWithNotableCities(existing, notable);
    expect(merged).toHaveLength(2);
  });
});
