import fc from "fast-check";
import type { Person } from "../lib/time";

/** Runs per property. CI can raise it with FC_NUM_RUNS. */
export const NUM_RUNS = Number(process.env.FC_NUM_RUNS) || 300;

export function scaledTimeout(msPerRun: number): number {
  return Math.max(30_000, NUM_RUNS * msPerRun);
}

/** Every zone the runtime knows, including half-hour and 45-minute offsets. */
const ALL_ZONES: readonly string[] = Intl.supportedValuesOf("timeZone");

export const timeZone = () => fc.constantFrom(...ALL_ZONES);

/** Any instant from 2020 to 2035. */
export const instant = () =>
  fc.date({ min: new Date("2020-01-01T00:00:00Z"), max: new Date("2035-12-31T23:59:59Z"), noInvalidDate: true });

const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

const isoDate = () =>
  fc
    .date({ min: new Date("2020-01-01T00:00:00Z"), max: new Date("2035-12-31T00:00:00Z"), noInvalidDate: true })
    .map((d) => d.toISOString().slice(0, 10));

/** Working hours on whole minutes, start before end, within one day. */
const workingHours = () =>
  fc
    .tuple(fc.integer({ min: 0, max: 1438 }), fc.integer({ min: 1, max: 1439 }))
    .filter(([a, b]) => a < b)
    .map(([a, b]) => ({ start: hhmm(a), end: hhmm(b) }));

const dateRange = () => fc.tuple(isoDate(), fc.integer({ min: 0, max: 30 })).map(([start, length]) => {
  const end = new Date(`${start}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + length);
  return { start, end: end.toISOString().slice(0, 10) };
});

export const person = () =>
  fc.record<Person>({
    id: fc.uuid(),
    firstName: fc.constantFrom("Ada", "Bo", "Chen", "Dev"),
    lastName: fc.constantFrom("Ng", "Okoro", "Silva"),
    role: fc.constant("Engineer"),
    city: fc.constant("Test city"),
    country: fc.constant("Test country"),
    ianaTimeZone: timeZone(),
    workingHours: workingHours(),
    outOfOffice: fc.array(dateRange(), { maxLength: 3 }),
    email: fc.constant("test@example.com"),
  });
