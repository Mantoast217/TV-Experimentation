import { describe, expect, it } from "vitest";
import { KESTREL_GLOBAL } from "../../data/kestrelGlobal";
import { arrange, describePeople, fullName, matchesSearch, type ArrangeOptions } from "./arrange";
import { backOnText, dayOffsetText, emptyStateText, resultsText, sortAnnouncement, summaryItem, viewerHoursText } from "./copy";

const NOW = new Date("2026-10-16T13:00:00Z");
const views = describePeople(KESTREL_GLOBAL, NOW, "Europe/London");
const defaults: ArrangeOptions = { query: "", status: "all", sortKey: "timeZone", direction: "ascending" };
const names = (options: Partial<ArrangeOptions>) =>
  arrange(views, { ...defaults, ...options }).groups.map((g) => [g.status, g.people.map((v) => v.person.firstName)]);

describe("arrange", () => {
  it("groups by status in a fixed order, sorted by time zone west to east within each group", () => {
    expect(names({})).toEqual([
      ["working", ["Ethan", "Diego", "Arnold", "Amara", "Sofia"]],
      ["outside", ["Noah", "Carlos", "Priya", "Hana", "Zoe"]],
      ["holiday", ["Liam"]],
    ]);
  });

  it("sorts by local time of day within each group", () => {
    expect(names({ sortKey: "localTime" })[1]).toEqual(["outside", ["Zoe", "Noah", "Carlos", "Priya", "Hana"]]);
  });

  it("sorts by name, and reverses when descending", () => {
    expect(names({ sortKey: "name" })[0]).toEqual(["working", ["Amara", "Arnold", "Diego", "Ethan", "Sofia"]]);
    expect(names({ sortKey: "name", direction: "descending" })[0]).toEqual([
      "working",
      ["Sofia", "Ethan", "Diego", "Arnold", "Amara"],
    ]);
  });

  it("filters by status and leaves out empty groups", () => {
    expect(names({ status: "holiday" })).toEqual([["holiday", ["Liam"]]]);
    expect(arrange(views, { ...defaults, status: "holiday" }).shown).toBe(1);
  });

  it("searches name, role and city, ignoring case and accents", () => {
    expect(matchesSearch(KESTREL_GLOBAL[5], "bergstrom")).toBe(true);
    expect(arrange(views, { ...defaults, query: "designer" }).shown).toBe(2);
    expect(arrange(views, { ...defaults, query: "LONDON" }).shown).toBe(2);
    expect(arrange(views, { ...defaults, query: "  " }).shown).toBe(11);
    expect(arrange(views, { ...defaults, query: "nobody" })).toEqual({ groups: [], shown: 0 });
  });
});

describe("copy", () => {
  const view = (id: string) => views.find((v) => v.person.id === id)!;

  it("describes counts, offsets and hours in plain English", () => {
    expect(summaryItem("outside", 5)).toBe("5 outside working hours");
    expect(dayOffsetText(1)).toBe("1 day ahead");
    expect(dayOffsetText(-2)).toBe("2 days behind");
    expect(dayOffsetText(0)).toBe("");
    expect(viewerHoursText(view("noah-bergman"))).toBe("16:00–01:00 your time, ends next day");
    expect(backOnText(view("liam-sinclair"))).toBe("Back on Monday 26 October");
    expect(backOnText(view("arnold-beethoven"))).toBeNull();
  });

  it("describes sorting, results and empty searches", () => {
    expect(sortAnnouncement("localTime", "descending")).toBe("Sorted by local time, latest first.");
    expect(resultsText(3, 11)).toBe("Showing 3 of 11 people");
    expect(emptyStateText("  zed ")).toBe("No people match “zed”.");
    expect(emptyStateText("")).toBe("No people match the selected status.");
  });

  it("uses each person's full name", () => {
    expect(fullName(KESTREL_GLOBAL[0])).toBe("Amara Okafor");
    expect(view("priya-nair").utcOffsetLabel).toBe("UTC+5:30");
    expect(view("noah-bergman").utcOffsetLabel).toBe("UTC-7");
  });
});
