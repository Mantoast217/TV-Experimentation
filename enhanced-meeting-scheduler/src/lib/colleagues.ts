import { TIMEZONE_CATALOG, type TimeZoneCatalogEntry } from "./timezoneData";

export interface Colleague {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  email: string;
  /** A TimeZoneCatalogEntry.id in TIMEZONE_CATALOG — selecting this colleague adds that entry. */
  timezoneId: string;
}

/** The catalog entry a colleague is based in — their city, country, and current offset. */
export function colleagueTimeZone(colleague: Colleague): TimeZoneCatalogEntry {
  const zone = TIMEZONE_CATALOG.find((z) => z.id === colleague.timezoneId);
  if (!zone) throw new Error(`No timezone catalog entry "${colleague.timezoneId}" for colleague "${colleague.id}"`);
  return zone;
}

/**
 * Fixture directory for the "Add a participant" search — ten people at a fictional company
 * (Kestrel Global) standing in for a real account directory, which doesn't exist yet: EMS
 * has no accounts or backend of its own. Static and bundled, the same way the city catalog
 * in timezoneData.json is, rather than fetched from anywhere.
 */
export const COLLEAGUES: Colleague[] = [
  {
    id: "amara-okafor",
    firstName: "Amara",
    lastName: "Okafor",
    role: "Product Manager",
    email: "amara.okafor@kestrelglobal.example",
    timezoneId: "za-johannesburg-993800",
  },
  {
    id: "liam-sinclair",
    firstName: "Liam",
    lastName: "Sinclair",
    role: "Senior Engineer",
    email: "liam.sinclair@kestrelglobal.example",
    timezoneId: "gb-london-2643743",
  },
  {
    id: "priya-nair",
    firstName: "Priya",
    lastName: "Nair",
    role: "Product Designer",
    email: "priya.nair@kestrelglobal.example",
    timezoneId: "in-kolkata-1275004",
  },
  {
    id: "carlos-mendoza",
    firstName: "Carlos",
    lastName: "Mendoza",
    role: "Customer Success Lead",
    email: "carlos.mendoza@kestrelglobal.example",
    timezoneId: "mx-mexico-city-3530597",
  },
  {
    id: "hana-kobayashi",
    firstName: "Hana",
    lastName: "Kobayashi",
    role: "Data Analyst",
    email: "hana.kobayashi@kestrelglobal.example",
    timezoneId: "jp-tokyo-1850147",
  },
  {
    id: "sofia-bergstrom",
    firstName: "Sofia",
    lastName: "Bergström",
    role: "Marketing Manager",
    email: "sofia.bergstrom@kestrelglobal.example",
    timezoneId: "se-stockholm-2673730",
  },
  {
    id: "ethan-walker",
    firstName: "Ethan",
    lastName: "Walker",
    role: "Sales Director",
    email: "ethan.walker@kestrelglobal.example",
    timezoneId: "us-new-york-city-5128581",
  },
  {
    id: "zoe-fitzgerald",
    firstName: "Zoe",
    lastName: "Fitzgerald",
    role: "HR Business Partner",
    email: "zoe.fitzgerald@kestrelglobal.example",
    timezoneId: "au-sydney-2147714",
  },
  {
    id: "diego-fernandez",
    firstName: "Diego",
    lastName: "Fernández",
    role: "Finance Analyst",
    email: "diego.fernandez@kestrelglobal.example",
    timezoneId: "br-sao-paulo-3448439",
  },
  {
    id: "noah-bergman",
    firstName: "Noah",
    lastName: "Bergman",
    role: "VP Engineering",
    email: "noah.bergman@kestrelglobal.example",
    timezoneId: "us-los-angeles-5368361",
  },
  {
    id: "arnold-beethoven",
    firstName: "Arnold",
    lastName: "Beethoven",
    role: "Lead Experience Designer",
    email: "arnold.beethoven@kestrelglobal.example",
    // Shares London with Liam Sinclair above — the fixture's one deliberate same-city
    // pair, exercising the case where two participants map to a single zone chip.
    timezoneId: "gb-london-2643743",
  },
];
