import { describe, expect, it } from "vitest";
import { KESTREL_GLOBAL } from "../../data/kestrelGlobal";
import { arrange, describePeople, fullName, matchesSearch, type ArrangeOptions } from "./arrange";
import {
  backOnText,
  bestHoursText,
  dateRangeText,
  dayOffsetText,
  emptyStateText,
  hourRange,
  momentText,
  resultsText,
  selectionText,
  sortAnnouncement,
  summaryItem,
  viewerHoursText,
  windowText,
  workingHoursSentence,
} from "./copy";

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

  it("describes working hours and the best hours for the timeline", () => {
    expect(workingHoursSentence(view("hana-kobayashi"))).toBe("Working hours: 09:00–18:00 local, 01:00–10:00 your time");
    expect(workingHoursSentence(view("noah-bergman"))).toBe(
      "Working hours: 08:00–17:00 local, 16:00–01:00 your time, ends next day",
    );
    expect(hourRange(23)).toBe("23:00–00:00");
    expect(bestHoursText({ hours: [9, 14, 16], count: 5 }, 10)).toBe(
      "The best hours to meet are 09:00–10:00, 14:00–15:00 and 16:00–17:00 your time, when 5 of 10 available people are working.",
    );
    expect(bestHoursText({ hours: [9], count: 1 }, 1)).toBe(
      "The best hour to meet is 09:00–10:00 your time, when 1 of 1 available person is working.",
    );
    expect(bestHoursText({ hours: [], count: 0 }, 3)).toBe("No one shown is working for a whole hour today.");
    expect(bestHoursText({ hours: [], count: 0 }, 0)).toBe("No one shown is available today.");
  });

  it("describes selection, working windows and out-of-office dates", () => {
    expect(selectionText(0)).toBe("No one selected");
    expect(selectionText(1)).toBe("1 person selected");
    expect(selectionText(3)).toBe("3 people selected");
    // Zoe's Monday in Sydney, shown in Sydney and then in London.
    const start = new Date("2026-10-18T22:00:00Z");
    const end = new Date("2026-10-19T06:00:00Z");
    expect(windowText(start, end, "Australia/Sydney")).toBe("Monday 19 October, 09:00–17:00");
    expect(windowText(start, end, "Europe/London")).toBe("Sunday 18 October 23:00 to Monday 19 October 07:00");
    expect(dateRangeText({ start: "2026-11-02", end: "2026-11-06" })).toBe("2 to 6 November 2026");
    expect(dateRangeText({ start: "2026-10-30", end: "2026-11-02" })).toBe("30 October to 2 November 2026");
    expect(dateRangeText({ start: "2026-12-28", end: "2027-01-04" })).toBe("28 December 2026 to 4 January 2027");
    expect(dateRangeText({ start: "2026-11-02", end: "2026-11-02" })).toBe("2 November 2026");
    expect(momentText(new Date("2026-10-16T16:00:00Z"), "Europe/London")).toBe("Friday 16 October, 17:00");
  });
});
