import { describe, expect, it } from "vitest";
import { curateMajorCitiesAndCapitals, parseCities, parseCountryInfo, validateEntries } from "./update-timezone-data.mjs";

const COUNTRY_INFO_FIXTURE = [
  "#ISO\tISO3\tISO-Numeric\tfips\tCountry\tCapital\tArea\tPopulation\tContinent",
  "GB\tGBR\t826\tUK\tUnited Kingdom\tLondon\t244820\t66488991\tEU",
  "DE\tDEU\t276\tGM\tGermany\tBerlin\t357021\t83019200\tEU",
  "TH\tTHA\t764\tTH\tThailand\tBangkok\t514000\t69625582\tAS",
  "US\tUSA\t840\tUS\tUnited States\tWashington\t9629091\t327167434\tNA",
  "JP\tJPN\t392\tJA\tJapan\tTokyo\t377835\t126529100\tAS",
  "SG\tSGP\t702\tSN\tSingapore\tSingapore\t692\t5638700\tAS",
  "AU\tAUS\t36\tAS\tAustralia\tCanberra\t7686850\t24992369\tOC",
].join("\n");

/** Builds one tab-separated GeoNames citiesXXXXX.txt row for the given fields. */
function cityRow({ geonameId, name, countryCode, population, timezone, featureCode = "PPL" }) {
  const columns = new Array(19).fill("");
  columns[0] = geonameId;
  columns[1] = name;
  columns[7] = featureCode;
  columns[8] = countryCode;
  columns[14] = String(population);
  columns[17] = timezone;
  return columns.join("\t");
}

function buildFullFixture() {
  const rows = [
    cityRow({ geonameId: "2643743", name: "London", countryCode: "GB", population: 8961989, timezone: "Europe/London" }),
    cityRow({ geonameId: "6058560", name: "London", countryCode: "CA", population: 383822, timezone: "America/Toronto" }),
    cityRow({ geonameId: "2950159", name: "Berlin", countryCode: "DE", population: 3426354, timezone: "Europe/Berlin" }),
    cityRow({ geonameId: "1609350", name: "Bangkok", countryCode: "TH", population: 5104476, timezone: "Asia/Bangkok" }),
    cityRow({ geonameId: "5128581", name: "New York City", countryCode: "US", population: 8804190, timezone: "America/New_York" }),
    cityRow({ geonameId: "1850147", name: "Tokyo", countryCode: "JP", population: 8336599, timezone: "Asia/Tokyo" }),
    cityRow({ geonameId: "1880252", name: "Singapore", countryCode: "SG", population: 5638700, timezone: "Asia/Singapore" }),
    cityRow({ geonameId: "2147714", name: "Sydney", countryCode: "AU", population: 4627345, timezone: "Australia/Sydney" }),
  ];
  // Pad past the row-count sanity threshold with plausible filler rows.
  for (let i = 0; i < 20_000; i++) {
    rows.push(cityRow({ geonameId: `9${i}`, name: `Filler City ${i}`, countryCode: "GB", population: 1000, timezone: "Europe/London" }));
  }
  return rows.join("\n");
}

describe("parseCountryInfo", () => {
  it("maps ISO alpha-2 codes to country names, skipping comments", () => {
    const map = parseCountryInfo(COUNTRY_INFO_FIXTURE);
    expect(map.get("GB")).toBe("United Kingdom");
    expect(map.get("DE")).toBe("Germany");
    expect(map.has("#ISO")).toBe(false);
  });
});

describe("parseCities", () => {
  it("joins each city to its country via the shared country-code column", () => {
    const countryByCode = parseCountryInfo(COUNTRY_INFO_FIXTURE);
    const raw = cityRow({ geonameId: "2950159", name: "Berlin", countryCode: "DE", population: 3426354, timezone: "Europe/Berlin" });
    const [entry] = parseCities(raw, countryByCode);
    expect(entry).toMatchObject({ city: "Berlin", country: "Germany", countryCode: "DE", timezone: "Europe/Berlin" });
  });

  it("skips a city row whose country code has no matching country entry", () => {
    const countryByCode = parseCountryInfo(COUNTRY_INFO_FIXTURE);
    const raw = cityRow({ geonameId: "1", name: "Nowhereville", countryCode: "ZZ", population: 100, timezone: "Etc/UTC" });
    expect(parseCities(raw, countryByCode)).toHaveLength(0);
  });
});

describe("validateEntries — rejects bad data rather than deploying it", () => {
  it("accepts a well-formed, adequately-sized dataset with correct known-city pairings", () => {
    const countryByCode = parseCountryInfo(COUNTRY_INFO_FIXTURE);
    const entries = parseCities(buildFullFixture(), countryByCode);
    expect(() => validateEntries(entries)).not.toThrow();
  });

  it("rejects a truncated/incomplete download (too few rows)", () => {
    const countryByCode = parseCountryInfo(COUNTRY_INFO_FIXTURE);
    const tinyRaw = cityRow({ geonameId: "2643743", name: "London", countryCode: "GB", population: 8961989, timezone: "Europe/London" });
    const entries = parseCities(tinyRaw, countryByCode);
    expect(() => validateEntries(entries)).toThrow(/expected at least/);
  });

  it("rejects data where a known city resolves to the wrong country (the exact Berlin bug class)", () => {
    const countryByCode = parseCountryInfo(COUNTRY_INFO_FIXTURE);
    const rows = buildFullFixture()
      .split("\n")
      .map((row) => (row.includes("\tBerlin\t") ? cityRow({ geonameId: "2950159", name: "Berlin", countryCode: "GB", population: 3426354, timezone: "Europe/Berlin" }) : row));
    const entries = parseCities(rows.join("\n"), countryByCode);
    expect(() => validateEntries(entries)).toThrow(/Berlin/);
  });

  it("rejects a corrupted download that parses to zero usable rows", () => {
    const countryByCode = parseCountryInfo(COUNTRY_INFO_FIXTURE);
    const entries = parseCities("not\ta\tvalid\tgeonames\tfile\nat\tall", countryByCode);
    expect(() => validateEntries(entries)).toThrow();
  });
});

describe("curateMajorCitiesAndCapitals", () => {
  const countryByCode = parseCountryInfo(COUNTRY_INFO_FIXTURE);

  it("keeps a city with population >= 1,000,000", () => {
    const raw = cityRow({ geonameId: "1", name: "Big City", countryCode: "GB", population: 1_500_000, timezone: "Europe/London" });
    const curated = curateMajorCitiesAndCapitals(parseCities(raw, countryByCode));
    expect(curated.map((e) => e.city)).toEqual(["Big City"]);
  });

  it("keeps a national capital regardless of population — real capitals like Bern or Reykjavik are well under a million people", () => {
    const raw = cityRow({
      geonameId: "2",
      name: "Tiny Capital",
      countryCode: "GB",
      population: 50_000,
      timezone: "Europe/London",
      featureCode: "PPLC",
    });
    const curated = curateMajorCitiesAndCapitals(parseCities(raw, countryByCode));
    expect(curated.map((e) => e.city)).toEqual(["Tiny Capital"]);
  });

  it("drops a small city that is neither populous nor a capital — the exact Manchester case (population ~395,000, not a capital)", () => {
    const raw = cityRow({
      geonameId: "3",
      name: "Manchester",
      countryCode: "GB",
      population: 395_515,
      timezone: "Europe/London",
      featureCode: "PPLA2",
    });
    const curated = curateMajorCitiesAndCapitals(parseCities(raw, countryByCode));
    expect(curated).toHaveLength(0);
  });

  it("strips the transient featureCode field from what it keeps — not part of the app's TimeZoneCatalogEntry shape", () => {
    const raw = cityRow({ geonameId: "4", name: "Big City", countryCode: "GB", population: 1_500_000, timezone: "Europe/London" });
    const [curated] = curateMajorCitiesAndCapitals(parseCities(raw, countryByCode));
    expect(curated).not.toHaveProperty("featureCode");
    expect(curated).toEqual({ id: expect.any(String), city: "Big City", country: "United Kingdom", countryCode: "GB", timezone: "Europe/London", population: 1_500_000 });
  });
});
