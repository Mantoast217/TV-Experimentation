#!/usr/bin/env node
/**
 * The real, ongoing data source for this app: GeoNames, plus IANA's tzdb.
 *
 * Downloads cities15000.zip (every city with population >= 15,000, the smallest
 * GeoNames tier — used as the *input*, not what ships) and countryInfo.txt from
 * the same GeoNames export dump, joins each city's own `country code` column to
 * countryInfo's ISO-3166 alpha-2 -> country name mapping — both columns come
 * from the same upstream provider, so a city's country is never assembled from
 * an unrelated second source — validates the result against the full download,
 * then curates it down (see curateMajorCitiesAndCapitals) to a size a "search
 * for a city or country" field can render without freezing.
 *
 * That major-cities layer alone isn't guaranteed to cover every timezone or
 * every country (a country's biggest city only covers one of its timezones if
 * it has several, and some countries — Denmark, Iceland, Vatican City — share
 * a neighbor's zone entirely and might not independently clear the population/
 * capital bar). So it's merged with a second, small, independently-sourced
 * backbone built straight from tzdb's own zone1970.tab and backward files (see
 * timezoneBackbone.mjs) — one entry per canonical zone, guaranteed complete by
 * construction.
 *
 * A third, small, hand-picked layer (see notableCities.mjs) then adds internationally
 * recognizable cities the population/capital threshold alone leaves out (Venice, Boston,
 * Zurich, ...) — variety, not coverage; every one of them already sits inside a
 * zone/country the first two layers cover. Unlike those two, this layer has no official
 * source and needs manual upkeep — kept deliberately short for exactly that reason.
 *
 * Finally, every entry gets its zone's real IANA/tzdb abbreviation attached (see
 * tzPosixFooter.mjs) — read from the build machine's own compiled system tzdata, not a
 * browser's Intl/CLDR (which suppresses abbreviations that collide across zones, like IST
 * for India/Ireland/Israel or CST for China/Cuba/US Central).
 *
 * Run on a schedule by .github/workflows/update-timezone-data.yml, which
 * opens a PR rather than pushing straight to main: this script's own
 * validation is the first gate (it refuses to write anything if a check
 * fails), code review on the resulting PR is the second.
 */
import { unzipSync } from "fflate";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildTimezoneBackbone, mergeWithBackbone } from "./timezoneBackbone.mjs";
import { buildNotableCityEntries, mergeWithNotableCities } from "./notableCities.mjs";
import { attachTzdbAbbreviations } from "./tzPosixFooter.mjs";

const CITIES_URL = "https://download.geonames.org/export/dump/cities15000.zip";
const CITIES_ENTRY_NAME = "cities15000.txt";
const COUNTRY_INFO_URL = "https://download.geonames.org/export/dump/countryInfo.txt";
const ZONE1970_URL = "https://raw.githubusercontent.com/eggert/tz/main/zone1970.tab";
const BACKWARD_URL = "https://raw.githubusercontent.com/eggert/tz/main/backward";
const OUTPUT_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/lib/timezoneData.json");

const MIN_EXPECTED_CITY_ROWS = 20_000;

// Spot-checked by "which country does the most populous city with this name
// belong to", not by exact-string city-name match — robust to minor naming
// variations (e.g. GeoNames may record "New York City" rather than
// "New York") without weakening the actual check.
const KNOWN_CITIES = [
  { nameContains: "london", countryCode: "GB" },
  { nameContains: "berlin", countryCode: "DE" },
  { nameContains: "bangkok", countryCode: "TH" },
  { nameContains: "new york", countryCode: "US" },
  { nameContains: "tokyo", countryCode: "JP" },
  { nameContains: "singapore", countryCode: "SG" },
  { nameContains: "sydney", countryCode: "AU" },
];

function slugify(text) {
  const combiningDiacritics = new RegExp("[̀-ͯ]", "g");
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(combiningDiacritics, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Parses GeoNames' countryInfo.txt into a Map<ISO alpha-2, country name>. */
export function parseCountryInfo(raw) {
  const byCode = new Map();
  for (const line of raw.split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue;
    const columns = line.split("\t");
    const [isoAlpha2, , , , countryName] = columns;
    if (!isoAlpha2 || !countryName) continue;
    byCode.set(isoAlpha2, countryName);
  }
  return byCode;
}

/** GeoNames feature code for "capital of a political entity" (column 8 of the cities dump). */
const CAPITAL_FEATURE_CODE = "PPLC";

/** Parses a GeoNames citiesXXXXX.txt dump, joined against `countryByCode`. */
export function parseCities(raw, countryByCode) {
  const entries = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const columns = line.split("\t");
    const geonameId = columns[0];
    const name = columns[1];
    const featureCode = columns[7];
    const countryCode = columns[8];
    const population = Number(columns[14]) || 0;
    const timezone = columns[17];
    if (!geonameId || !name || !countryCode || !timezone) continue;

    const country = countryByCode.get(countryCode);
    if (!country) continue; // No matching country row — skip rather than guess.

    entries.push({
      id: `${slugify(countryCode)}-${slugify(name)}-${geonameId}`,
      city: name,
      country,
      countryCode,
      timezone,
      population,
      // Transient — used only by curateMajorCitiesAndCapitals below, stripped before the
      // dataset is written. Not part of TimeZoneCatalogEntry; the app has no use for it.
      featureCode,
    });
  }
  return entries;
}

/**
 * Every city with population >= 15,000 worldwide (cities15000's own tier) is far more
 * than a "search for a city or country" field needs, and large enough to freeze the
 * combobox popover it renders into (see MeetingScheduler.tsx's MAX_VISIBLE_ZONE_RESULTS
 * comment for the concrete symptom). Curates down to a size closer to what a world clock
 * app like Apple's own Clock ships (its exact source isn't public, but it's built on the
 * OS's own IANA timezone database, whose canonical zone list — zone1970.tab — has ~430
 * entries) while still guaranteeing every country's capital is present regardless of its
 * population (Bern, Wellington, and Reykjavik are all well under a million people).
 */
const MIN_POPULATION_FOR_INCLUSION = 1_000_000;

export function curateMajorCitiesAndCapitals(entries) {
  return entries
    .filter((entry) => entry.population >= MIN_POPULATION_FOR_INCLUSION || entry.featureCode === CAPITAL_FEATURE_CODE)
    .map(({ featureCode: _featureCode, ...entry }) => entry);
}

/**
 * Throws with a descriptive message if `entries` doesn't look like a real,
 * complete GeoNames cities dump. Never returns a "these are probably fine"
 * partial pass — any failure here must block the write.
 */
export function validateEntries(entries) {
  if (entries.length < MIN_EXPECTED_CITY_ROWS) {
    throw new Error(
      `Only parsed ${entries.length} city rows, expected at least ${MIN_EXPECTED_CITY_ROWS} — the download may be truncated, empty, or in an unexpected format.`,
    );
  }

  for (const { nameContains, countryCode } of KNOWN_CITIES) {
    const matches = entries.filter((e) => e.city.toLowerCase().includes(nameContains));
    if (matches.length === 0) {
      throw new Error(`Sanity check failed: no city matching "${nameContains}" found at all.`);
    }
    const mostPopulous = matches.reduce((a, b) => (b.population > a.population ? b : a));
    if (mostPopulous.countryCode !== countryCode) {
      throw new Error(
        `Sanity check failed: the most populous city matching "${nameContains}" (${mostPopulous.city}) resolved to ` +
          `country "${mostPopulous.countryCode}", expected "${countryCode}". Refusing to deploy this data.`,
      );
    }
  }
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  return res.text();
}

async function fetchAndUnzipEntry(url, entryName) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  const files = unzipSync(buf, { filter: (file) => file.name === entryName });
  const data = files[entryName];
  if (!data) throw new Error(`"${entryName}" not found inside ${url}`);
  return new TextDecoder("utf-8").decode(data);
}

async function main() {
  const [countryInfoRaw, citiesRaw, zone1970Raw, backwardRaw] = await Promise.all([
    fetchText(COUNTRY_INFO_URL),
    fetchAndUnzipEntry(CITIES_URL, CITIES_ENTRY_NAME),
    fetchText(ZONE1970_URL),
    fetchText(BACKWARD_URL),
  ]);

  const countryByCode = parseCountryInfo(countryInfoRaw);
  const entries = parseCities(citiesRaw, countryByCode);

  // Validated against the full, unfiltered download — a truncated or malformed GeoNames
  // export must fail this check regardless of how small curateMajorCitiesAndCapitals
  // will shrink things afterward. Throws (and aborts before any write) on failure.
  validateEntries(entries);

  const curated = curateMajorCitiesAndCapitals(entries);
  const backbone = buildTimezoneBackbone({ zone1970Raw, backwardRaw, countryInfoRaw });
  const withBackbone = mergeWithBackbone(curated, backbone, backwardRaw);
  const notableCityEntries = buildNotableCityEntries(countryByCode);
  const withNotableCities = mergeWithNotableCities(withBackbone, notableCityEntries);
  const merged = attachTzdbAbbreviations(withNotableCities);

  // Alphabetical by city — matches how the app itself sorts and presents this list
  // (MeetingScheduler.tsx's availableZones), so the shipped file's order isn't misleading
  // if anyone reads it directly.
  merged.sort((a, b) => a.city.localeCompare(b.city));
  writeFileSync(OUTPUT_PATH, JSON.stringify(merged, null, 2) + "\n");
  console.log(
    `Wrote ${merged.length} entries to ${OUTPUT_PATH} (${curated.length} major cities/capitals + ` +
      `${withBackbone.length - curated.length} backbone entries + ${merged.length - withBackbone.length} notable-city ` +
      `entries, from ${entries.length} parsed city rows)`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
