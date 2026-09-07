import { describe, expect, it } from "vitest";
import { TIMEZONE_CATALOG } from "./timezoneData";

// Regression guard for the recurring bug where the same city (Berlin) resolved to two
// different incorrect countries across sessions. Each of these must come from a single
// atomic source record — see scripts/generate-seed-timezone-data.mjs and
// scripts/update-timezone-data.mjs — so a city can never be paired with the wrong country.
const KNOWN_CITIES: { city: string; country: string; timezone: string }[] = [
  { city: "London", country: "United Kingdom", timezone: "Europe/London" },
  { city: "Berlin", country: "Germany", timezone: "Europe/Berlin" },
  { city: "New York", country: "United States", timezone: "America/New_York" },
  { city: "Tokyo", country: "Japan", timezone: "Asia/Tokyo" },
  { city: "Singapore", country: "Singapore", timezone: "Asia/Singapore" },
  { city: "Sydney", country: "Australia", timezone: "Australia/Sydney" },
];

/**
 * The only two zones tzdb's own zone1970.tab documents as legitimately covering more
 * than one country — not data errors, so exempted from the single-country-per-zone
 * check below. Asia/Bangkok's row lists "TH,CX,KH,LA,VN" (comment: "north Vietnam" —
 * a pre-reunification split tzdb still preserves; southern Vietnam has its own
 * Asia/Ho_Chi_Minh). Europe/Belgrade's row lists "RS,XK": Kosovo has no distinct tzdb
 * zone of its own at all. Every other zone in this catalog maps to exactly one country;
 * anything else here would be the Berlin-bug pattern this suite guards against.
 */
const LEGITIMATE_MULTI_COUNTRY_ZONES: Record<string, string[]> = {
  "Asia/Bangkok": ["TH", "VN"],
  "Europe/Belgrade": ["RS", "XK"],
};

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

      // No entry for this exact timezone may claim a different country than expected —
      // unless this zone is one of the documented exceptions above — this is the literal
      // shape of the recurring bug (Europe/Berlin paired with Denmark, Norway, Sweden, and
      // Svalbard & Jan Mayen in earlier datasets).
      const sameTimezone = TIMEZONE_CATALOG.filter((entry) => entry.timezone === timezone);
      const allowedZoneCountries = LEGITIMATE_MULTI_COUNTRY_ZONES[timezone];
      sameTimezone.forEach((entry) =>
        allowedZoneCountries ? expect(allowedZoneCountries).toContain(entry.countryCode) : expect(entry.country).toBe(country),
      );
    });
  }

  it("resolves Bangkok itself to Thailand, even though Asia/Bangkok also legitimately covers northern Vietnam", () => {
    const bangkok = TIMEZONE_CATALOG.find((entry) => entry.city === "Bangkok" && entry.timezone === "Asia/Bangkok");
    expect(bangkok?.country).toBe("Thailand");
  });

  it("never pairs a single IANA zone with a country outside its documented set", () => {
    const countryCodeByZone = new Map<string, string>();
    for (const entry of TIMEZONE_CATALOG) {
      const allowed = LEGITIMATE_MULTI_COUNTRY_ZONES[entry.timezone];
      if (allowed) {
        expect(allowed).toContain(entry.countryCode);
        continue;
      }

      const existing = countryCodeByZone.get(entry.timezone);
      if (existing === undefined) {
        countryCodeByZone.set(entry.timezone, entry.countryCode);
      } else {
        expect(existing).toBe(entry.countryCode);
      }
    }
  });
});
