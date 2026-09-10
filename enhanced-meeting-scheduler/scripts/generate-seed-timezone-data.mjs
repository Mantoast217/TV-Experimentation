#!/usr/bin/env node
/**
 * ONE-TIME BOOTSTRAP SEED — not the recurring update job.
 *
 * This project's real, ongoing data source is GeoNames (see
 * scripts/update-timezone-data.mjs, run on a schedule by
 * .github/workflows/update-timezone-data.yml). GeoNames' own download server
 * is not reachable from every environment (it's blocked by this sandbox's
 * egress policy, for instance), so this script produces a real, correctly-
 * sourced seed dataset to ship until the first scheduled GeoNames run
 * replaces it — using data that *is* universally reachable and, just as
 * importantly, is the *authoritative source that documents the exact fix*
 * for the recurring Berlin bug.
 *
 * It downloads zone1970.tab from the official IANA tzdb repository (the
 * public-domain reference maintained by tzdb's own maintainer, mirrored on
 * GitHub) and takes advantage of a fact stated in that file's own header:
 *
 *   "If a timezone covers multiple countries, the most-populous city is
 *    used, and that country is listed first in column 1; any other
 *    countries are listed alphabetically by country code."
 *
 * This is precisely the root cause of the Berlin bug: the previous dataset
 * treated EVERY country code listed for a zone as "this city is in this
 * country" (Europe/Berlin's row lists DE,DK,NO,SE,SJ — Germany plus four
 * countries that merely share its DST rules), instead of using only the
 * FIRST code, which tzdb documents as the city's actual home country. This
 * script uses only that first code.
 *
 * One representative city per IANA zone (~310 entries) is coarser than full
 * GeoNames city coverage (no secondary cities like Manchester or Munich),
 * but every entry is a real, atomically-correct (city, country, IANA zone)
 * triple with no possibility of the cross-country mixup this replaces.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ZONE1970_URL = "https://raw.githubusercontent.com/eggert/tz/main/zone1970.tab";
const OUTPUT_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/lib/timezoneData.json");

/** Turns "Los_Angeles" (the last segment of an IANA zone id) into "Los Angeles". */
function cityNameFromZoneId(zoneId) {
  const lastSegment = zoneId.split("/").pop() ?? zoneId;
  return lastSegment.replace(/_/g, " ");
}

const COMBINING_DIACRITICS = new RegExp("[̀-ͯ]", "g");

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseZone1970(raw) {
  const countryNameOf = new Intl.DisplayNames(["en"], { type: "region" });
  const entries = [];

  for (const line of raw.split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue;
    const [countryCodesRaw, , zoneId] = line.split("\t");
    if (!countryCodesRaw || !zoneId) continue;

    // Per the file's own documented convention: the first code is the zone's
    // actual home country; any others merely share its clock rules.
    const primaryCountryCode = countryCodesRaw.split(",")[0];
    let country;
    try {
      country = countryNameOf.of(primaryCountryCode);
    } catch {
      country = null;
    }
    if (!country) continue; // Skip anything Intl can't resolve to a real region.

    entries.push({
      id: `${slugify(primaryCountryCode)}-${slugify(cityNameFromZoneId(zoneId))}`,
      city: cityNameFromZoneId(zoneId),
      country,
      countryCode: primaryCountryCode,
      timezone: zoneId,
    });
  }
  return entries;
}

async function main() {
  const res = await fetch(ZONE1970_URL);
  if (!res.ok) throw new Error(`Failed to fetch zone1970.tab: HTTP ${res.status}`);
  const raw = await res.text();

  const entries = parseZone1970(raw);

  if (entries.length < 300) {
    throw new Error(`Expected 300+ IANA zones, got ${entries.length} — zone1970.tab format may have changed.`);
  }

  // Spot-check the exact bug this seed exists to fix.
  const berlin = entries.find((e) => e.timezone === "Europe/Berlin");
  if (berlin?.country !== "Germany") {
    throw new Error(`Sanity check failed: Europe/Berlin resolved to "${berlin?.country}", expected "Germany".`);
  }
  const london = entries.find((e) => e.timezone === "Europe/London");
  if (london?.country !== "United Kingdom") {
    throw new Error(`Sanity check failed: Europe/London resolved to "${london?.country}", expected "United Kingdom".`);
  }

  entries.sort((a, b) => a.city.localeCompare(b.city));
  writeFileSync(OUTPUT_PATH, JSON.stringify(entries, null, 2) + "\n");
  console.log(`Wrote ${entries.length} entries to ${OUTPUT_PATH}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
