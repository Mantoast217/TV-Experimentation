/**
 * Builds the guaranteed-complete "backbone" layer of the timezone catalog: one entry per
 * canonical IANA timezone (tzdb's zone1970.tab, ~313 zones) plus one supplementary entry
 * for every country that only ever shares another country's zone and so never gets its
 * own zone1970.tab row (e.g. Denmark shares Germany's Europe/Berlin) — using GeoNames'
 * countryInfo.txt for that country's own capital name, and tzdb's own `backward` alias
 * file to prefer a country-idiomatic zone name (Atlantic/Reykjavik for Iceland) over the
 * bare shared canonical name (Africa/Abidjan) wherever one exists.
 *
 * Every file this reads is small, stable, and officially maintained (the IANA/tzdb
 * project itself, or GeoNames' own small country-level reference — not the large,
 * population-thresholded city dump update-timezone-data.mjs otherwise uses), so
 * refreshing this layer means re-fetching three small text files, not re-tuning
 * population thresholds or patching mistagged rows.
 *
 * This backbone is meant to be merged with (not replace) a richer major-cities dataset —
 * see mergeWithBackbone — so it deliberately covers completeness, not city variety: one
 * representative per zone/country, nothing more.
 */
const COMBINING_DIACRITICS = new RegExp("[̀-ͯ]", "g");

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Turns "Los_Angeles" (the last segment of an IANA zone id) into "Los Angeles". */
function cityNameFromZoneId(zoneId) {
  const lastSegment = zoneId.split("/").pop() ?? zoneId;
  return lastSegment.replace(/_/g, " ");
}

/**
 * One row per canonical zone from tzdb's zone1970.tab: the full comma-separated country
 * code list (not just the primary one), needed here to find which zone a *secondary*
 * country like Denmark actually observes.
 */
export function parseZone1970Rows(raw) {
  const rows = [];
  for (const line of raw.split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue;
    const [countryCodesRaw, , zoneId] = line.split("\t");
    if (!countryCodesRaw || !zoneId) continue;
    rows.push({ countryCodes: countryCodesRaw.split(","), zoneId });
  }
  return rows;
}

/** tzdb's backward-compatibility Link aliases, e.g. "Link Africa/Abidjan Atlantic/Reykjavik". */
export function parseBackwardLinks(raw) {
  const aliasesByCanonical = new Map();
  for (const line of raw.split("\n")) {
    const match = line.match(/^Link\s+(\S+)\s+(\S+)/);
    if (!match) continue;
    const [, canonical, alias] = match;
    if (!aliasesByCanonical.has(canonical)) aliasesByCanonical.set(canonical, []);
    aliasesByCanonical.get(canonical).push(alias);
  }
  return aliasesByCanonical;
}

/**
 * The reverse of parseBackwardLinks: alias zone id -> its canonical zone id. Needed
 * because different data sources name the same underlying civil-time rule differently —
 * e.g. GeoNames tags Dodoma, Tanzania as Africa/Dar_es_Salaam, while this backbone (built
 * independently from zone1970.tab's own secondary-country listing) resolves Tanzania to
 * Africa/Nairobi — both are Link aliases of the exact same rule set, so a merge that
 * compares raw zone id strings would treat them as different zones and duplicate the city.
 */
export function parseCanonicalByAlias(raw) {
  const canonicalByAlias = new Map();
  for (const line of raw.split("\n")) {
    const match = line.match(/^Link\s+(\S+)\s+(\S+)/);
    if (!match) continue;
    const [, canonical, alias] = match;
    canonicalByAlias.set(alias, canonical);
  }
  return canonicalByAlias;
}

/** ISO alpha-2 -> { countryName, capitalName }, from GeoNames' countryInfo.txt (Country/Capital columns). */
export function parseCountryCapitals(raw) {
  const byCode = new Map();
  for (const line of raw.split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue;
    const columns = line.split("\t");
    const [isoAlpha2, , , , countryName, capitalName] = columns;
    if (!isoAlpha2 || !countryName) continue;
    byCode.set(isoAlpha2, { countryName, capitalName: capitalName || null });
  }
  return byCode;
}

/**
 * For a country whose civil clock rules are really just another country's canonical zone
 * (Denmark -> Europe/Berlin), finds the `backward` alias whose own city name matches this
 * country's capital, if one exists (Europe/Copenhagen) — otherwise falls back to the bare
 * canonical zone id. Strips a trailing "City" from the capital before comparing (Vatican
 * City, Kuwait City) since tzdb's own alias names are typically just "Vatican"/"Kuwait".
 */
function idiomaticZoneFor(canonicalZoneId, capitalName, aliasesByCanonical) {
  if (!capitalName) return canonicalZoneId;
  const aliases = aliasesByCanonical.get(canonicalZoneId) ?? [];
  const capitalSlug = slugify(capitalName.replace(/\s+city$/i, ""));
  const match = aliases.find((alias) => slugify(cityNameFromZoneId(alias)) === capitalSlug);
  return match ?? canonicalZoneId;
}

/**
 * Builds the backbone: one entry per canonical zone, attributed to that zone's primary
 * (first-listed) country per zone1970.tab's own documented convention — the same rule
 * that fixed the Europe/Berlin cross-country bug earlier in this project — plus one
 * supplementary entry for every country that never appears as a zone's primary country.
 */
export function buildTimezoneBackbone({ zone1970Raw, backwardRaw, countryInfoRaw }) {
  const zones = parseZone1970Rows(zone1970Raw);
  const aliasesByCanonical = parseBackwardLinks(backwardRaw);
  const countryByCode = parseCountryCapitals(countryInfoRaw);

  const entries = [];
  const primaryCountryCodes = new Set();

  for (const { countryCodes, zoneId } of zones) {
    const primaryCode = countryCodes[0];
    primaryCountryCodes.add(primaryCode);
    const country = countryByCode.get(primaryCode);
    if (!country) continue; // No matching country row — skip rather than guess.

    entries.push({
      id: `${slugify(primaryCode)}-${slugify(cityNameFromZoneId(zoneId))}-zone`,
      city: cityNameFromZoneId(zoneId),
      country: country.countryName,
      countryCode: primaryCode,
      timezone: zoneId,
    });
  }

  // Every country that only ever shares another country's zone (so never appears above)
  // still needs its own entry — e.g. Denmark, Iceland, Vatican City, San Marino.
  for (const [code, { countryName, capitalName }] of countryByCode) {
    if (primaryCountryCodes.has(code)) continue;
    if (!capitalName) continue; // No known capital to name the entry after — skip rather than guess.

    const sharedZone = zones.find(({ countryCodes }) => countryCodes.includes(code));
    if (!sharedZone) continue; // Not in zone1970.tab at all — e.g. Bouvet Island, Heard & McDonald Islands: uninhabited, no civil time to represent.

    const zoneId = idiomaticZoneFor(sharedZone.zoneId, capitalName, aliasesByCanonical);
    entries.push({
      id: `${slugify(code)}-${slugify(capitalName)}-zone`,
      city: capitalName,
      country: countryName,
      countryCode: code,
      timezone: zoneId,
    });
  }

  return entries;
}

/**
 * Merges the guaranteed-complete backbone into a richer major-cities/capitals layer: a
 * backbone entry is only added when no existing entry already covers that exact
 * (countryCode, timezone) pair. The major-cities layer's own entry for that same
 * country+zone — usually the very same real city, just with real population data and a
 * more precise name (e.g. "New York City" instead of the zone id's bare "New York") —
 * always wins, so nothing is duplicated.
 *
 * Dedup compares *canonical* zone identity (via backwardRaw), not raw zone id strings:
 * GeoNames and this backbone can each legitimately land on a different alias for the
 * exact same underlying civil-time rule (GeoNames tags Dodoma, Tanzania as
 * Africa/Dar_es_Salaam; this backbone independently resolves Tanzania to Africa/Nairobi —
 * both Link aliases of the same rule set), and comparing the bare strings would treat
 * those as different zones and duplicate the city.
 */
export function mergeWithBackbone(majorCities, backbone, backwardRaw) {
  const canonicalByAlias = parseCanonicalByAlias(backwardRaw);
  const canonicalKey = (entry) => `${entry.countryCode}|${canonicalByAlias.get(entry.timezone) ?? entry.timezone}`;

  const covered = new Set(majorCities.map(canonicalKey));
  const merged = [...majorCities];
  for (const entry of backbone) {
    const key = canonicalKey(entry);
    if (covered.has(key)) continue;
    covered.add(key);
    merged.push(entry);
  }
  return merged;
}
