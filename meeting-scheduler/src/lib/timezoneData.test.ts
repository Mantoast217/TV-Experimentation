import { describe, expect, it } from "vitest";
import { TIMEZONE_CATALOG } from "./timezoneData";

// Regression guard for the recurring bug where the same city (Berlin) resolved to two
// different incorrect countries across sessions. Each of these must come from a single
// atomic source record — see scripts/generate-seed-timezone-data.mjs and
// scripts/update-timezone-data.mjs — so a city can never be paired with the wrong country.
const KNOWN_CITIES: { city: string; country: string; timezone: string }[] = [
  { city: "London", country: "United Kingdom", timezone: "Europe/London" },
  { city: "Berlin", country: "Germany", timezone: "Europe/Berlin" },
  { city: "Bangkok", country: "Thailand", timezone: "Asia/Bangkok" },
  { city: "New York", country: "United States", timezone: "America/New_York" },
  { city: "Tokyo", country: "Japan", timezone: "Asia/Tokyo" },
  { city: "Singapore", country: "Singapore", timezone: "Asia/Singapore" },
  { city: "Sydney", country: "Australia", timezone: "Australia/Sydney" },
];

describe("TIMEZONE_CATALOG — known-city regression guard", () => {
  for (const { city, country, timezone } of KNOWN_CITIES) {
    it(`resolves ${city} to ${country} (${timezone})`, () => {
      const matches = TIMEZONE_CATALOG.filter((entry) => entry.city.toLowerCase().includes(city.toLowerCase()));
      expect(matches.length).toBeGreaterThan(0);

      // Every matching entry for this city name must carry its own correct timezone —
      // never require picking "the most populous" to paper over a wrong pairing existing
      // alongside a right one for this specific, previously-broken city.
      const correct = matches.find((entry) => entry.timezone === timezone);
      expect(correct).toBeDefined();
      expect(correct?.country).toBe(country);

      // No entry for this exact timezone may claim a different country — this is the
      // literal shape of the recurring bug (Europe/Berlin paired with Denmark, Norway,
      // Sweden, and Svalbard & Jan Mayen in earlier datasets).
      const sameTimezone = TIMEZONE_CATALOG.filter((entry) => entry.timezone === timezone);
      sameTimezone.forEach((entry) => expect(entry.country).toBe(country));
    });
  }

  it("never pairs a single IANA zone with more than one country", () => {
    const countryByZone = new Map<string, string>();
    for (const entry of TIMEZONE_CATALOG) {
      const existing = countryByZone.get(entry.timezone);
      if (existing === undefined) {
        countryByZone.set(entry.timezone, entry.country);
      } else {
        expect(existing).toBe(entry.country);
      }
    }
  });
});
