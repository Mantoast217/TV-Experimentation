import { TIMEZONE_CATALOG, type TimeZoneCatalogEntry } from "./timezoneData";

export interface Colleague {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  email: string;
  /** A TimeZoneCatalogEntry.id in TIMEZONE_CATALOG — selecting this colleague adds that entry. */
  timezoneId: string;
  /** Declared working hours, "HH:MM"-"HH:MM" (zero-padded 24h), local to timezoneId's zone. */
  workingHours: { start: string; end: string };
  /** Out-of-office date ranges, ISO "YYYY-MM-DD", inclusive, local to timezoneId's zone. */
  outOfOffice?: { start: string; end: string }[];
}

/** The catalog entry a colleague is based in — their city, country, and current offset. */
export function colleagueTimeZone(colleague: Colleague): TimeZoneCatalogEntry {
  const zone = TIMEZONE_CATALOG.find((z) => z.id === colleague.timezoneId);
  if (!zone) throw new Error(`No timezone catalog entry "${colleague.timezoneId}" for colleague "${colleague.id}"`);
  return zone;
}

/**
 * Fixture directory for the "Add a participant" search — eleven people at a fictional
 * company (Kestrel Global) standing in for a real account directory, which doesn't exist
 * yet: EMS has no accounts or backend of its own. Static and bundled, the same way the
 * city catalog in timezoneData.json is, rather than fetched from anywhere.
 */
export const COLLEAGUES: Colleague[] = [
  {
    id: "amara-okafor",
    firstName: "Amara",
    lastName: "Okafor",
    role: "Product Manager",
    email: "amara.okafor@kestrelglobal.example",
    timezoneId: "za-johannesburg-993800",
    workingHours: { start: "08:00", end: "16:30" },
  },
  {
    id: "liam-sinclair",
    firstName: "Liam",
    lastName: "Sinclair",
    role: "Senior Engineer",
    email: "liam.sinclair@kestrelglobal.example",
    timezoneId: "gb-london-2643743",
    workingHours: { start: "09:00", end: "17:30" },
    outOfOffice: [{ start: "2026-09-15", end: "2026-09-26" }],
  },
  {
    id: "priya-nair",
    firstName: "Priya",
    lastName: "Nair",
    role: "Product Designer",
    email: "priya.nair@kestrelglobal.example",
    timezoneId: "in-kolkata-1275004",
    workingHours: { start: "09:30", end: "18:00" },
  },
  {
    id: "carlos-mendoza",
    firstName: "Carlos",
    lastName: "Mendoza",
    role: "Customer Success Lead",
    email: "carlos.mendoza@kestrelglobal.example",
    timezoneId: "mx-mexico-city-3530597",
    workingHours: { start: "08:30", end: "17:00" },
  },
  {
    id: "hana-kobayashi",
    firstName: "Hana",
    lastName: "Kobayashi",
    role: "Data Analyst",
    email: "hana.kobayashi@kestrelglobal.example",
    timezoneId: "jp-tokyo-1850147",
    workingHours: { start: "09:00", end: "18:00" },
  },
  {
    id: "sofia-bergstrom",
    firstName: "Sofia",
    lastName: "Bergström",
    role: "Marketing Manager",
    email: "sofia.bergstrom@kestrelglobal.example",
    timezoneId: "se-stockholm-2673730",
    workingHours: { start: "08:00", end: "16:00" },
    outOfOffice: [{ start: "2026-09-08", end: "2026-09-19" }],
  },
  {
    id: "ethan-walker",
    firstName: "Ethan",
    lastName: "Walker",
    role: "Sales Director",
    email: "ethan.walker@kestrelglobal.example",
    timezoneId: "us-new-york-city-5128581",
    workingHours: { start: "08:30", end: "17:30" },
  },
  {
    id: "zoe-fitzgerald",
    firstName: "Zoe",
    lastName: "Fitzgerald",
    role: "HR Business Partner",
    email: "zoe.fitzgerald@kestrelglobal.example",
    timezoneId: "au-sydney-2147714",
    workingHours: { start: "09:00", end: "17:00" },
  },
  {
    id: "diego-fernandez",
    firstName: "Diego",
    lastName: "Fernández",
    role: "Finance Analyst",
    email: "diego.fernandez@kestrelglobal.example",
    timezoneId: "br-sao-paulo-3448439",
    workingHours: { start: "09:00", end: "18:00" },
  },
  {
    id: "noah-bergman",
    firstName: "Noah",
    lastName: "Bergman",
    role: "VP Engineering",
    email: "noah.bergman@kestrelglobal.example",
    timezoneId: "us-los-angeles-5368361",
    workingHours: { start: "08:00", end: "17:00" },
  },
  {
    id: "arnold-beethoven",
    firstName: "Arnold",
    lastName: "Beethoven",
    role: "Lead Experience Designer",
    email: "arnold.beethoven@kestrelglobal.example",
    // Shares London with Liam Sinclair above — the fixture's one deliberate same-city
    // pair, exercising the case where two participants map to a single zone chip (and,
    // with slightly different declared hours, the case where they don't agree on
    // whether a given slot counts as "in hours" either).
    timezoneId: "gb-london-2643743",
    workingHours: { start: "08:30", end: "17:00" },
  },
];
