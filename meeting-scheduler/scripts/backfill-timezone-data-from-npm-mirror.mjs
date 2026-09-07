#!/usr/bin/env node
/**
 * ONE-TIME BRIDGE — not the recurring update job, and not run by any workflow.
 *
 * scripts/update-timezone-data.mjs (the real, ongoing pipeline, run monthly by
 * .github/workflows/update-timezone-data.yml) can't reach GeoNames' own download
 * server from this environment — download.geonames.org is blocked by this
 * sandbox's outbound network policy — and this session's GitHub API token lacks
 * the `actions:write` scope needed to trigger that workflow remotely instead.
 *
 * This script gets real GeoNames cities15000 coverage into the app now, from a
 * place that *is* reachable: the npm registry, via a community package
 * (cities-15000-structured, MIT licensed) that bundles the same cities15000.txt
 * GeoNames publishes, unmodified — same tab-separated columns, so it feeds
 * straight into update-timezone-data.mjs's own parseCities()/validateEntries().
 * Country names come from Intl.DisplayNames rather than GeoNames' own
 * countryInfo.txt (also unreachable here) — the same technique
 * generate-seed-timezone-data.mjs already uses for the same reason.
 *
 * Caveat: that npm package was last published 2023-03-10, so this dataset is
 * that old, not current as of today. It still gives curateMajorCitiesAndCapitals
 * (see update-timezone-data.mjs) a real, current-shape GeoNames export to curate
 * down from — real population figures and capital flags the 313-entry
 * one-city-per-zone seed this replaces had neither. It will be superseded
 * automatically the next time scripts/update-timezone-data.mjs actually runs
 * against the live, current GeoNames export (scheduled monthly, or triggered
 * manually) — that job's own validation and PR-review gate are untouched by
 * this bridge.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { curateMajorCitiesAndCapitals, parseCities, validateEntries } from "./update-timezone-data.mjs";

const PACKAGE_TARBALL_URL = "https://registry.npmjs.org/cities-15000-structured/-/cities-15000-structured-1.0.1.tgz";
const BUNDLED_ENTRY_PATH = "package/dist/cities15000.txt";
const OUTPUT_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/lib/timezoneData.json");

/** No network dependency, unlike GeoNames' own countryInfo.txt — ISO alpha-2 -> English country name. */
function buildCountryByCode(codes) {
  const countryNameOf = new Intl.DisplayNames(["en"], { type: "region" });
  const byCode = new Map();
  for (const code of codes) {
    try {
      const name = countryNameOf.of(code);
      if (name && name !== code) byCode.set(code, name);
    } catch {
      // Not a resolvable region code — left unset; parseCities already skips these.
    }
  }
  return byCode;
}

/**
 * This mirror's cities15000.txt mistags a handful of individual cities with a
 * neighboring country's IANA zone instead of their own — verified against tzdb's own
 * zone1970.tab (the same authoritative source generate-seed-timezone-data.mjs uses),
 * not guessed. Two are functionally wrong (different UTC offset or DST rules from the
 * city's real zone, so the app would compute the wrong local time for that one city);
 * the third is cosmetic (Africa/Addis_Ababa and Africa/Mogadishu are both tzdb Link
 * aliases for the exact same underlying rule set as Africa/Nairobi, so this affects no
 * one's computed time, just the label). This is NOT the same situation as e.g.
 * Asia/Bangkok legitimately covering Vietnam's own "north Vietnam" cities, or
 * Europe/Belgrade legitimately covering Kosovo (which has no distinct tzdb zone at
 * all) — those are left untouched; zone1970.tab documents both as real, intentional
 * multi-country zones, not mistagged rows.
 */
function applyKnownTimezoneCorrections(entries) {
  const corrections = [
    // zone1970.tab: "SY" -> Asia/Damascus. Syria has no historical link to Turkey's zone,
    // and the two have diverged on DST in various years — a real, not just cosmetic, error.
    { city: "Kabbasin", countryCode: "SY", from: "Europe/Istanbul", to: "Asia/Damascus" },
    // zone1970.tab: "UZ" -> Asia/Tashkent, a full UTC hour away from Asia/Bishkek (Kyrgyzstan
    // only) — a real error, not a cosmetic one.
    { city: "Quvasoy", countryCode: "UZ", from: "Asia/Bishkek", to: "Asia/Tashkent" },
    // backward (tzdb's alias file): Africa/Mogadishu is Somalia's own alias for the same
    // Africa/Nairobi rule set Africa/Addis_Ababa also aliases — purely a label fix.
    { city: "Cabudwaaq", countryCode: "SO", from: "Africa/Addis_Ababa", to: "Africa/Mogadishu" },
    { city: "Balanbale", countryCode: "SO", from: "Africa/Addis_Ababa", to: "Africa/Mogadishu" },
  ];

  for (const { city, countryCode, from, to } of corrections) {
    const entry = entries.find((e) => e.city === city && e.countryCode === countryCode && e.timezone === from);
    if (!entry) throw new Error(`Expected correction target ${city} (${countryCode}, ${from}) not found — mirror data may have changed.`);
    entry.timezone = to;
  }
}

async function main() {
  const res = await fetch(PACKAGE_TARBALL_URL);
  if (!res.ok) throw new Error(`Failed to fetch ${PACKAGE_TARBALL_URL}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());

  const tmpDir = mkdtempSync(path.join(tmpdir(), "cities15000-"));
  try {
    const tarballPath = path.join(tmpDir, "package.tgz");
    writeFileSync(tarballPath, buf);
    execFileSync("tar", ["-xzf", tarballPath, "-C", tmpDir, BUNDLED_ENTRY_PATH]);
    const citiesRaw = readFileSync(path.join(tmpDir, BUNDLED_ENTRY_PATH), "utf-8");

    // parseCities needs a country code -> name map; build it from the codes actually
    // present in the file rather than a fixed list, so nothing is silently dropped.
    const candidateCodes = new Set();
    for (const line of citiesRaw.split("\n")) {
      const code = line.split("\t")[8];
      if (code) candidateCodes.add(code);
    }
    const countryByCode = buildCountryByCode(candidateCodes);

    const entries = parseCities(citiesRaw, countryByCode);
    applyKnownTimezoneCorrections(entries);
    validateEntries(entries); // Throws (and aborts before any write) on failure.

    const curated = curateMajorCitiesAndCapitals(entries);
    curated.sort((a, b) => a.city.localeCompare(b.city)); // Matches the app's own display order.
    writeFileSync(OUTPUT_PATH, JSON.stringify(curated, null, 2) + "\n");
    console.log(`Wrote ${curated.length} entries to ${OUTPUT_PATH} (curated from ${entries.length} parsed rows)`);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
