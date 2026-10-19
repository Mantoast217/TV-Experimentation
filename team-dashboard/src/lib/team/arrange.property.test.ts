import { describe, it } from "vitest";
import fc from "fast-check";
import { instant, NUM_RUNS, person, scaledTimeout, timeZone } from "../../test/arbitraries";
import { arrange, describePeople, STATUS_ORDER, type SortKey } from "./arrange";

const sortKey = () => fc.constantFrom<SortKey>("timeZone", "localTime", "name");
const direction = () => fc.constantFrom<"ascending" | "descending">("ascending", "descending");
const statusFilter = () => fc.constantFrom("all" as const, ...STATUS_ORDER);
const query = () => fc.constantFrom("", "a", "Ng", "engineer", "zzz");

describe("arrange properties", () => {
  it(
    "puts every matching person in exactly one group, the one for their status",
    () => {
      fc.assert(
        fc.property(fc.array(person(), { maxLength: 12 }), instant(), timeZone(), sortKey(), direction(), statusFilter(), query(),
          (people, now, zone, key, dir, status, q) => {
            const views = describePeople(people, now, zone);
            const { groups, shown } = arrange(views, { query: q, status, sortKey: key, direction: dir });
            const placed = groups.flatMap((g) => g.people.map((v) => ({ id: v.person.id, group: g.status, status: v.status })));
            return (
              placed.length === shown &&
              new Set(placed.map((p) => p.id)).size === placed.length &&
              placed.every((p) => p.group === p.status && (status === "all" || p.status === status)) &&
              groups.every((g) => g.people.length > 0) &&
              groups.map((g) => g.status).join() === STATUS_ORDER.filter((s) => groups.some((g) => g.status === s)).join()
            );
          }),
        { numRuns: NUM_RUNS },
      );
    },
    scaledTimeout(10),
  );

  it(
    "keeps the original order of people who tie on the sort key",
    () => {
      // Few zones and names, so ties are common.
      const tied = fc.array(person().map((p) => ({ ...p, ianaTimeZone: p.ianaTimeZone.length % 2 ? "Europe/London" : "Asia/Tokyo" })), { maxLength: 12 });
      fc.assert(
        fc.property(tied, instant(), sortKey(), direction(), (people, now, key, dir) => {
          const unique = people.map((p, i) => ({ ...p, id: `p${i}` }));
          const views = describePeople(unique, now, "UTC");
          const original = new Map(unique.map((p, i) => [p.id, i]));
          const keyOf = (v: (typeof views)[number]) =>
            key === "timeZone" ? v.utcOffsetMinutes : key === "localTime" ? v.localMinutes : `${v.person.firstName} ${v.person.lastName}`;
          const { groups } = arrange(views, { query: "", status: "all", sortKey: key, direction: dir });
          return groups.every((g) =>
            g.people.every((v, i) => i === 0 || keyOf(g.people[i - 1]) !== keyOf(v) || original.get(g.people[i - 1].person.id)! < original.get(v.person.id)!),
          );
        }),
        { numRuns: NUM_RUNS },
      );
    },
    scaledTimeout(10),
  );
});
