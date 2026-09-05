// Generated data: see scripts/generate-seed-timezone-data.mjs (interim bootstrap seed,
// sourced from the IANA tzdb's own zone1970.tab) and scripts/update-timezone-data.mjs
// (the real, ongoing GeoNames-sourced update job — see .github/workflows/update-timezone-data.yml).
// Each record is a single atomic source row: city, country, and IANA timezone always come
// from the same upstream entry, so a city can never be paired with the wrong country.
import rawCatalog from "./timezoneData.json";

export interface TimeZoneCatalogEntry {
  /** Stable, unique slug — safe to use as a React key and combobox selection key. */
  id: string;
  city: string;
  country: string;
  /** ISO 3166-1 alpha-2 country code. */
  countryCode: string;
  /** IANA timezone identifier, e.g. "Europe/London" — the canonical, DST-aware value. */
  timezone: string;
  /** Present once the GeoNames-sourced dataset replaces the interim seed. */
  population?: number;
}

export const TIMEZONE_CATALOG: TimeZoneCatalogEntry[] = rawCatalog as TimeZoneCatalogEntry[];

export const DEFAULT_TIMEZONE_ID = "gb-london";
