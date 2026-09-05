#!/usr/bin/env node
/**
 * The real, ongoing data source for this app: GeoNames.
 *
 * Downloads cities15000.zip (every city with population >= 15,000 — the
 * smallest GeoNames tier that still comfortably covers what a meeting
 * scheduler's "search for a city" field needs, without bundling the much
 * larger cities5000/cities1000 tiers) and countryInfo.txt from the same
 * GeoNames export dump, joins each city's own `country code` column to
 * countryInfo's ISO-3166 alpha-2 -> country name mapping — both columns
 * come from the same upstream provider, so a city's country is never
 * assembled from an unrelated second source — validates the result, and
 * only then overwrites the committed dataset.
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

const CITIES_URL = "https://download.geonames.org/export/dump/cities15000.zip";
const CITIES_ENTRY_NAME = "cities15000.txt";
const COUNTRY_INFO_URL = "https://download.geonames.org/export/dump/countryInfo.txt";
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

/** Parses a GeoNames citiesXXXXX.txt dump, joined against `countryByCode`. */
export function parseCities(raw, countryByCode) {
  const entries = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const columns = line.split("\t");
    const geonameId = columns[0];
    const name = columns[1];
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
    });
  }
  return entries;
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
  const [countryInfoRaw, citiesRaw] = await Promise.all([
    fetchText(COUNTRY_INFO_URL),
    fetchAndUnzipEntry(CITIES_URL, CITIES_ENTRY_NAME),
  ]);

  const countryByCode = parseCountryInfo(countryInfoRaw);
  const entries = parseCities(citiesRaw, countryByCode);

  validateEntries(entries); // Throws (and aborts before any write) on failure.

  entries.sort((a, b) => b.population - a.population || a.city.localeCompare(b.city));
  writeFileSync(OUTPUT_PATH, JSON.stringify(entries, null, 2) + "\n");
  console.log(`Wrote ${entries.length} entries to ${OUTPUT_PATH}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
