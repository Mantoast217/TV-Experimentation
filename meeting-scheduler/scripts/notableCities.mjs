/**
 * A small, hand-picked layer of internationally recognizable cities that the
 * population/capital threshold in update-timezone-data.mjs (curateMajorCitiesAndCapitals)
 * leaves out — famous cities whose *city-proper* population (the only figure GeoNames
 * reports) falls under the 1,000,000 bar and which aren't a national capital either, so
 * curateMajorCitiesAndCapitals has no way to know they're notable. Venice is the extreme
 * case: GeoNames counts only its historic-center population (~51,000), so no realistic
 * population threshold could ever include it without also flooding in thousands of
 * similarly-sized towns worldwide (see the "Add the 31 cities" chat thread for the
 * full population data behind every entry below).
 *
 * Deliberately NOT a fix for timezone/country completeness — that's what
 * timezoneBackbone.mjs already guarantees. Every city below sits in a country and
 * IANA zone the catalog already covers via curateMajorCitiesAndCapitals or the backbone;
 * this layer only adds city variety, never new coverage.
 *
 * Unlike the major-cities and backbone layers, this list has no official, self-updating
 * source — it's a subjective, manually maintained judgment call, and it has no natural
 * stopping point (there is always another "obviously famous" city someone will notice is
 * missing). Keep it deliberately short.
 */
export const NOTABLE_CITIES = [
  { city: "San Francisco", countryCode: "US", timezone: "America/Los_Angeles", population: 864_816 },
  { city: "Seattle", countryCode: "US", timezone: "America/Los_Angeles", population: 737_015 },
  { city: "Boston", countryCode: "US", timezone: "America/New_York", population: 675_647 },
  { city: "Las Vegas", countryCode: "US", timezone: "America/Los_Angeles", population: 623_747 },
  { city: "Atlanta", countryCode: "US", timezone: "America/New_York", population: 463_878 },
  { city: "Miami", countryCode: "US", timezone: "America/New_York", population: 441_003 },
  { city: "New Orleans", countryCode: "US", timezone: "America/Chicago", population: 389_617 },
  { city: "Nashville", countryCode: "US", timezone: "America/Chicago", population: 689_447 },
  { city: "Orlando", countryCode: "US", timezone: "America/New_York", population: 307_573 },

  { city: "Cologne", countryCode: "DE", timezone: "Europe/Berlin", population: 963_395 },
  { city: "Naples", countryCode: "IT", timezone: "Europe/Rome", population: 909_048 },
  { city: "Turin", countryCode: "IT", timezone: "Europe/Rome", population: 847_287 },
  { city: "Liverpool", countryCode: "GB", timezone: "Europe/London", population: 864_122 },
  { city: "Marseille", countryCode: "FR", timezone: "Europe/Paris", population: 870_731 },
  { city: "Frankfurt am Main", countryCode: "DE", timezone: "Europe/Berlin", population: 650_000 },
  { city: "Rotterdam", countryCode: "NL", timezone: "Europe/Amsterdam", population: 598_199 },
  { city: "Edinburgh", countryCode: "GB", timezone: "Europe/London", population: 506_520 },
  { city: "Manchester", countryCode: "GB", timezone: "Europe/London", population: 395_515 },
  { city: "Nice", countryCode: "FR", timezone: "Europe/Paris", population: 342_669 },
  { city: "Zurich", countryCode: "CH", timezone: "Europe/Zurich", population: 341_730 },
  { city: "Florence", countryCode: "IT", timezone: "Europe/Rome", population: 367_150 },
  { city: "Geneva", countryCode: "CH", timezone: "Europe/Zurich", population: 183_981 },
  { city: "Venice", countryCode: "IT", timezone: "Europe/Rome", population: 51_298 },

  { city: "Auckland", countryCode: "NZ", timezone: "Pacific/Auckland", population: 417_910 },
  { city: "Marrakesh", countryCode: "MA", timezone: "Africa/Casablanca", population: 839_296 },
  { city: "Denpasar", countryCode: "ID", timezone: "Asia/Makassar", population: 725_314 },
  { city: "Zanzibar City", countryCode: "TZ", timezone: "Africa/Dar_es_Salaam", population: 403_658 },
  { city: "Cusco", countryCode: "PE", timezone: "America/Lima", population: 428_450 },
  { city: "Salzburg", countryCode: "AT", timezone: "Europe/Vienna", population: 157_245 },
  { city: "Siem Reap", countryCode: "KH", timezone: "Asia/Phnom_Penh", population: 139_458 },
  { city: "Chiang Mai", countryCode: "TH", timezone: "Asia/Bangkok", population: 127_240 },
  { city: "Bruges", countryCode: "BE", timezone: "Europe/Brussels", population: 118_509 },
  { city: "Phuket", countryCode: "TH", timezone: "Asia/Bangkok", population: 79_308 },
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

/**
 * Turns NOTABLE_CITIES into full catalog entries, naming each country from the same
 * `countryByCode` map (Map<ISO alpha-2, name>) the caller's own major-cities layer
 * already used — so a country never shows up under two different name spellings
 * depending on which layer produced its entries.
 */
export function buildNotableCityEntries(countryByCode) {
  const entries = [];
  for (const { city, countryCode, timezone, population } of NOTABLE_CITIES) {
    const country = countryByCode.get(countryCode);
    if (!country) continue; // No matching country row — skip rather than guess.
    entries.push({
      id: `${slugify(countryCode)}-${slugify(city)}-notable`,
      city,
      country,
      countryCode,
      timezone,
      population,
    });
  }
  return entries;
}

/**
 * Merges notable-city entries into the catalog: only added when no existing entry
 * already covers that exact (countryCode, city) pair — this layer is about adding
 * city *variety* within zones/countries the catalog already covers, so (unlike
 * mergeWithBackbone's zone-level dedup) the key here is city+country, not zone+country;
 * multiple cities sharing a country and zone is the entire point.
 */
export function mergeWithNotableCities(entries, notableCityEntries) {
  const covered = new Set(entries.map((entry) => `${entry.countryCode}|${entry.city}`));
  const merged = [...entries];
  for (const entry of notableCityEntries) {
    const key = `${entry.countryCode}|${entry.city}`;
    if (covered.has(key)) continue;
    covered.add(key);
    merged.push(entry);
  }
  return merged;
}
