import { describe, expect, it } from "vitest";
import { KESTREL_GLOBAL } from "../../data/kestrelGlobal";
import {
  bestHours,
  countByStatus,
  dayOffset,
  hourlyOverlap,
  localTime,
  nextWorkingWindow,
  statusAt,
  timelineSegments,
  viewerDay,
  workingHoursInZone,
  type Person,
} from ".";

const LONDON = "Europe/London";
/** Friday 16 October 2026, 14:00 in London (BST, UTC+1). */
const ACCEPTANCE_NOW = new Date("2026-10-16T13:00:00Z");

function person(id: string): Person {
  const found = KESTREL_GLOBAL.find((p) => p.id === id);
  if (!found) throw new Error(`No sample person ${id}`);
  return found;
}

describe("acceptance: Friday 16 October 2026, 14:00 London", () => {
  it("counts 5 working, 5 outside working hours and 1 on holiday", () => {
    expect(countByStatus(KESTREL_GLOBAL, ACCEPTANCE_NOW)).toEqual({ working: 5, outside: 5, holiday: 1 });
  });

  it("puts each person in the expected status", () => {
    const byStatus = (status: string) =>
      KESTREL_GLOBAL.filter((p) => statusAt(p, ACCEPTANCE_NOW) === status).map((p) => p.firstName);
    expect(byStatus("working")).toEqual(["Amara", "Sofia", "Ethan", "Diego", "Arnold"]);
    expect(byStatus("outside")).toEqual(["Priya", "Carlos", "Hana", "Zoe", "Noah"]);
    expect(byStatus("holiday")).toEqual(["Liam"]);
  });

  it("shows Zoe Fitzgerald at 00:00 on Saturday, one day ahead", () => {
    const zoe = person("zoe-fitzgerald");
    expect(localTime(zoe, ACCEPTANCE_NOW)).toEqual({ time: "00:00", weekday: "Saturday", isoDate: "2026-10-17" });
    expect(dayOffset(zoe, ACCEPTANCE_NOW, LONDON)).toBe(1);
  });

  it("finds the best overlap hours: 09:00, 14:00 and 16:00 with 5 of 10 available people", () => {
    const overlap = hourlyOverlap(KESTREL_GLOBAL, ACCEPTANCE_NOW, LONDON);
    expect(overlap.available).toBe(10);
    expect(bestHours(overlap)).toEqual({ hours: [9, 14, 16], count: 5 });
  });

  it("converts Hana Kobayashi's hours to 01:00–10:00 London time", () => {
    expect(workingHoursInZone(person("hana-kobayashi"), ACCEPTANCE_NOW, LONDON)).toEqual({
      start: "01:00",
      end: "10:00",
      endsNextDay: false,
    });
  });

  it("converts Noah Bergman's hours to 16:00–01:00 London time, ending the next day", () => {
    expect(workingHoursInZone(person("noah-bergman"), ACCEPTANCE_NOW, LONDON)).toEqual({
      start: "16:00",
      end: "01:00",
      endsNextDay: true,
    });
  });
});

describe("local time and day offset", () => {
  it("handles Kolkata's half-hour offset", () => {
    const priya = person("priya-nair");
    expect(localTime(priya, ACCEPTANCE_NOW).time).toBe("18:30");
    expect(workingHoursInZone(priya, ACCEPTANCE_NOW, LONDON)).toEqual({ start: "05:00", end: "13:30", endsNextDay: false });
  });

  it("gives a negative offset when the person is a day behind", () => {
    // 00:30 Saturday in London is still Friday in Los Angeles.
    expect(dayOffset(person("noah-bergman"), new Date("2026-10-16T23:30:00Z"), LONDON)).toBe(-1);
  });

  it("uses the viewer's zone, not London, when given another one", () => {
    expect(dayOffset(person("zoe-fitzgerald"), ACCEPTANCE_NOW, "Australia/Sydney")).toBe(0);
    expect(workingHoursInZone(person("arnold-beethoven"), ACCEPTANCE_NOW, "Asia/Tokyo")).toEqual({
      start: "16:30",
      end: "01:00",
      endsNextDay: true,
    });
  });
});

describe("status", () => {
  it("counts weekends as outside working hours", () => {
    // Saturday 17 October, 11:00 in London.
    expect(statusAt(person("arnold-beethoven"), new Date("2026-10-17T10:00:00Z"))).toBe("outside");
  });

  it("includes the start time and excludes the end time", () => {
    const arnold = person("arnold-beethoven");
    expect(statusAt(arnold, new Date("2026-10-16T07:30:00Z"))).toBe("working");
    expect(statusAt(arnold, new Date("2026-10-16T07:29:59Z"))).toBe("outside");
    expect(statusAt(arnold, new Date("2026-10-16T16:00:00Z"))).toBe("outside");
  });

  it("reads holiday dates in the person's own zone", () => {
    const liam = person("liam-sinclair");
    // 23:30 on 23 October in London is the last half hour of his holiday...
    expect(statusAt(liam, new Date("2026-10-23T22:30:00Z"))).toBe("holiday");
    // ...and 00:30 on 24 October is not.
    expect(statusAt(liam, new Date("2026-10-23T23:30:00Z"))).toBe("outside");
  });
});

describe("next working window", () => {
  it("returns the current window when the person is working", () => {
    const window = nextWorkingWindow(person("arnold-beethoven"), ACCEPTANCE_NOW);
    expect(window).toEqual({
      start: new Date("2026-10-16T07:30:00Z"),
      end: new Date("2026-10-16T16:00:00Z"),
      inProgress: true,
    });
  });

  it("skips the weekend", () => {
    // Zoe's Saturday has started, so her next window is Monday 19 October in Sydney.
    const window = nextWorkingWindow(person("zoe-fitzgerald"), ACCEPTANCE_NOW);
    expect(window?.start).toEqual(new Date("2026-10-18T22:00:00Z"));
    expect(window?.inProgress).toBe(false);
  });

  it("skips the rest of a holiday", () => {
    // Liam is back on Monday 26 October, after London's clocks go back to GMT.
    const window = nextWorkingWindow(person("liam-sinclair"), ACCEPTANCE_NOW);
    expect(window?.start).toEqual(new Date("2026-10-26T09:00:00Z"));
  });

  it("returns null when there is no working day within 400 days", () => {
    const away = { ...person("arnold-beethoven"), outOfOffice: [{ start: "2026-01-01", end: "2028-12-31" }] };
    expect(nextWorkingWindow(away, ACCEPTANCE_NOW)).toBeNull();
  });
});

describe("timeline segments", () => {
  const day = viewerDay(ACCEPTANCE_NOW, LONDON);

  it("places Arnold Beethoven at 08:30–17:00", () => {
    expect(timelineSegments(person("arnold-beethoven"), day)).toEqual([{ startMinute: 510, endMinute: 1020 }]);
  });

  it("splits Noah Bergman's shifts at the viewer's midnights", () => {
    // Thursday's shift ends at 01:00 Friday London time; Friday's runs from 16:00 past midnight.
    expect(timelineSegments(person("noah-bergman"), day)).toEqual([
      { startMinute: 0, endMinute: 60 },
      { startMinute: 960, endMinute: 1440 },
    ]);
  });

  it("keeps Zoe Fitzgerald's Friday window that started on the viewer's Thursday", () => {
    // Friday 09:00–17:00 in Sydney is Thursday 23:00 to Friday 07:00 in London.
    expect(timelineSegments(person("zoe-fitzgerald"), day)).toEqual([{ startMinute: 0, endMinute: 420 }]);
  });

  it("gives no segments to someone on holiday", () => {
    expect(timelineSegments(person("liam-sinclair"), day)).toEqual([]);
  });
});

describe("clock changes", () => {
  const zoe = person("zoe-fitzgerald");

  it("follows Sydney moving to daylight saving time on 4 October 2026", () => {
    // Before: Sydney UTC+10, London UTC+1.
    expect(workingHoursInZone(zoe, new Date("2026-10-02T09:00:00Z"), LONDON)).toEqual({
      start: "00:00",
      end: "08:00",
      endsNextDay: false,
    });
    // After: Sydney UTC+11, London UTC+1.
    expect(workingHoursInZone(zoe, new Date("2026-10-07T09:00:00Z"), LONDON)).toEqual({
      start: "23:00",
      end: "07:00",
      endsNextDay: true,
    });
  });

  it("follows London leaving summer time on 25 October 2026", () => {
    // After: Sydney UTC+11, London UTC+0.
    expect(workingHoursInZone(zoe, new Date("2026-10-28T09:00:00Z"), LONDON)).toEqual({
      start: "22:00",
      end: "06:00",
      endsNextDay: true,
    });
  });

  it("treats London's 25-hour day on 25 October 2026 as one day on a 24-hour scale", () => {
    const day = viewerDay(new Date("2026-10-25T12:00:00Z"), LONDON);
    expect(day.end.getTime() - day.start.getTime()).toBe(25 * 60 * 60 * 1000);
    for (const p of KESTREL_GLOBAL) {
      for (const segment of timelineSegments(p, day)) {
        expect(segment.startMinute).toBeGreaterThanOrEqual(0);
        expect(segment.endMinute).toBeLessThanOrEqual(1440);
      }
    }
    expect(hourlyOverlap(KESTREL_GLOBAL, new Date("2026-10-25T12:00:00Z"), LONDON).hours).toHaveLength(24);
  });

  it("counts nobody in London's skipped hour on 29 March 2026", () => {
    const overlap = hourlyOverlap(KESTREL_GLOBAL, new Date("2026-03-29T12:00:00Z"), LONDON);
    expect(overlap.hours).toHaveLength(24);
    expect(overlap.hours[1]).toEqual({ hour: 1, count: 0 });
  });
});
