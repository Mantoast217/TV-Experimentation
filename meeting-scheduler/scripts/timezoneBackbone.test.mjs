import { describe, expect, it } from "vitest";
import { buildTimezoneBackbone, mergeWithBackbone, parseBackwardLinks, parseCountryCapitals, parseZone1970Rows } from "./timezoneBackbone.mjs";

const ZONE1970_FIXTURE = [
  "#codes\tcoordinates\tTZ\tcomments",
  "GB\t+513030-0000731\tEurope/London",
  "DE,DK,NO,SE\t+5230+01322\tEurope/Berlin",
  "TH,VN\t+1345+10031\tAsia/Bangkok\tnorth Vietnam",
  "US\t+404251-0740023\tAmerica/New_York",
  "IT,SM,VA\t+4154+01229\tEurope/Rome",
].join("\n");

const BACKWARD_FIXTURE = [
  "# comment line, ignored",
  "Link\tEurope/Berlin\tEurope/Copenhagen",
  "Link\tEurope/Berlin\tEurope/Oslo",
  "Link\tEurope/Berlin\tEurope/Stockholm",
  "Link\tEurope/Rome\tEurope/Vatican",
].join("\n");

const COUNTRY_INFO_FIXTURE = [
  "#ISO\tISO3\tISO-Numeric\tfips\tCountry\tCapital\tArea\tPopulation\tContinent",
  "GB\tGBR\t826\tUK\tUnited Kingdom\tLondon\t244820\t66488991\tEU",
  "DE\tDEU\t276\tGM\tGermany\tBerlin\t357021\t83019200\tEU",
  "DK\tDNK\t208\tDA\tDenmark\tCopenhagen\t43094\t5809502\tEU",
  "NO\tNOR\t578\tNO\tNorway\tOslo\t324220\t5314336\tEU",
  "SE\tSWE\t752\tSW\tSweden\tStockholm\t449964\t10183175\tEU",
  "TH\tTHA\t764\tTH\tThailand\tBangkok\t514000\t69625582\tAS",
  "VN\tVNM\t704\tVM\tVietnam\tHanoi\t331210\t95540800\tAS",
  "US\tUSA\t840\tUS\tUnited States\tWashington\t9629091\t327167434\tNA",
  "AQ\tATA\t010\tAY\tAntarctica\t\t14000000\t0\tAN",
  "IT\tITA\t380\tIT\tItaly\tRome\t301230\t60550075\tEU",
  "VA\tVAT\t336\tVT\tVatican\tVatican City\t0.44\t921\tEU",
].join("\n");

describe("parseZone1970Rows", () => {
  it("keeps the full country-code list per zone, not just the primary one", () => {
    const rows = parseZone1970Rows(ZONE1970_FIXTURE);
    const berlin = rows.find((r) => r.zoneId === "Europe/Berlin");
    expect(berlin.countryCodes).toEqual(["DE", "DK", "NO", "SE"]);
  });

  it("skips comment and blank lines", () => {
    const rows = parseZone1970Rows(ZONE1970_FIXTURE);
    expect(rows).toHaveLength(5);
  });
});

describe("parseBackwardLinks", () => {
  it("maps a canonical zone to all of its aliases", () => {
    const aliases = parseBackwardLinks(BACKWARD_FIXTURE);
    expect(aliases.get("Europe/Berlin")).toEqual(["Europe/Copenhagen", "Europe/Oslo", "Europe/Stockholm"]);
  });
});

describe("parseCountryCapitals", () => {
  it("maps a country code to its name and capital", () => {
    const map = parseCountryCapitals(COUNTRY_INFO_FIXTURE);
    expect(map.get("DK")).toEqual({ countryName: "Denmark", capitalName: "Copenhagen" });
  });

  it("keeps a null capital rather than guessing, for a country with none (Antarctica)", () => {
    const map = parseCountryCapitals(COUNTRY_INFO_FIXTURE);
    expect(map.get("AQ")).toEqual({ countryName: "Antarctica", capitalName: null });
  });
});

describe("buildTimezoneBackbone", () => {
  const backbone = buildTimezoneBackbone({
    zone1970Raw: ZONE1970_FIXTURE,
    backwardRaw: BACKWARD_FIXTURE,
    countryInfoRaw: COUNTRY_INFO_FIXTURE,
  });

  it("gives every canonical zone a primary-country entry", () => {
    expect(backbone).toContainEqual(expect.objectContaining({ city: "London", country: "United Kingdom", countryCode: "GB", timezone: "Europe/London" }));
    expect(backbone).toContainEqual(expect.objectContaining({ city: "New York", country: "United States", countryCode: "US", timezone: "America/New_York" }));
  });

  it("attributes a shared zone only to its primary (first-listed) country, not the secondary ones", () => {
    const berlinEntries = backbone.filter((e) => e.timezone === "Europe/Berlin" && e.city === "Berlin");
    expect(berlinEntries).toEqual([expect.objectContaining({ country: "Germany", countryCode: "DE" })]);
  });

  it("gives every secondary-only country its own entry, using its capital and the idiomatic backward alias", () => {
    // Denmark, Norway, and Sweden all secondarily share Europe/Berlin — each should get
    // its own entry named after its own capital, resolved to its own backward alias
    // (Europe/Copenhagen) rather than the bare shared zone id (Europe/Berlin).
    expect(backbone).toContainEqual({ id: "dk-copenhagen-zone", city: "Copenhagen", country: "Denmark", countryCode: "DK", timezone: "Europe/Copenhagen" });
    expect(backbone).toContainEqual({ id: "no-oslo-zone", city: "Oslo", country: "Norway", countryCode: "NO", timezone: "Europe/Oslo" });
    expect(backbone).toContainEqual({ id: "se-stockholm-zone", city: "Stockholm", country: "Sweden", countryCode: "SE", timezone: "Europe/Stockholm" });
  });

  it("covers the legitimate multi-country zone case (Vietnam sharing Thailand's Asia/Bangkok) via its own capital, not a duplicate Bangkok row", () => {
    const vietnam = backbone.find((e) => e.countryCode === "VN");
    // Hanoi (Vietnam's capital) is nowhere near Bangkok/Thailand — falls back to the bare
    // shared canonical zone id since no backward alias exists for it in this fixture.
    expect(vietnam).toEqual({ id: "vn-hanoi-zone", city: "Hanoi", country: "Vietnam", countryCode: "VN", timezone: "Asia/Bangkok" });
  });

  it("skips a country with no known capital rather than guessing (Antarctica)", () => {
    expect(backbone.find((e) => e.countryCode === "AQ")).toBeUndefined();
  });

  it("matches a 'X City' capital against tzdb's bare 'X' alias (Vatican City -> Europe/Vatican)", () => {
    expect(backbone).toContainEqual({ id: "va-vatican-city-zone", city: "Vatican City", country: "Vatican", countryCode: "VA", timezone: "Europe/Vatican" });
  });
});

describe("mergeWithBackbone", () => {
  it("keeps a major-cities entry and does not add a duplicate backbone entry for the same country+zone", () => {
    const majorCities = [{ id: "gb-london-123", city: "London", country: "United Kingdom", countryCode: "GB", timezone: "Europe/London", population: 8_900_000 }];
    const backbone = [{ id: "gb-london-zone", city: "London", country: "United Kingdom", countryCode: "GB", timezone: "Europe/London" }];

    const merged = mergeWithBackbone(majorCities, backbone, "");

    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual(majorCities[0]); // The richer (population-bearing) entry wins.
  });

  it("adds a backbone entry when the major-cities layer has no coverage for that country+zone", () => {
    const majorCities = [{ id: "gb-london-123", city: "London", country: "United Kingdom", countryCode: "GB", timezone: "Europe/London", population: 8_900_000 }];
    const backbone = [{ id: "dk-copenhagen-zone", city: "Copenhagen", country: "Denmark", countryCode: "DK", timezone: "Europe/Copenhagen" }];

    const merged = mergeWithBackbone(majorCities, backbone, "");

    expect(merged).toHaveLength(2);
    expect(merged).toContainEqual(backbone[0]);
  });

  it("never produces two entries sharing the same (countryCode, timezone) pair", () => {
    const majorCities = [
      { id: "us-new-york-city-1", city: "New York City", country: "United States", countryCode: "US", timezone: "America/New_York", population: 8_800_000 },
      { id: "us-los-angeles-2", city: "Los Angeles", country: "United States", countryCode: "US", timezone: "America/Los_Angeles", population: 3_900_000 },
    ];
    const backbone = [
      { id: "us-new-york-zone", city: "New York", country: "United States", countryCode: "US", timezone: "America/New_York" },
      { id: "us-denver-zone", city: "Denver", country: "United States", countryCode: "US", timezone: "America/Denver" },
    ];

    const merged = mergeWithBackbone(majorCities, backbone, "");
    const keys = merged.map((e) => `${e.countryCode}|${e.timezone}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(merged).toHaveLength(3); // NYC (major cities) + LA (major cities) + Denver (backbone fills the gap).
  });

  it("treats two different aliases of the same underlying zone as a duplicate, not two zones", () => {
    // The exact real-world case that surfaced this: GeoNames tags Dodoma, Tanzania as
    // Africa/Dar_es_Salaam; independently resolving Tanzania via zone1970.tab's own
    // secondary-country listing lands on Africa/Nairobi — both are backward Link aliases
    // of the identical rule set, so comparing raw strings would wrongly keep both.
    const majorCities = [
      { id: "tz-dodoma-1", city: "Dodoma", country: "Tanzania", countryCode: "TZ", timezone: "Africa/Dar_es_Salaam", population: 180_541 },
    ];
    const backbone = [{ id: "tz-dodoma-zone", city: "Dodoma", country: "Tanzania", countryCode: "TZ", timezone: "Africa/Nairobi" }];
    const backwardRaw = "Link\tAfrica/Nairobi\tAfrica/Dar_es_Salaam";

    const merged = mergeWithBackbone(majorCities, backbone, backwardRaw);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual(majorCities[0]);
  });
});
