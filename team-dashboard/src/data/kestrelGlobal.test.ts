import { describe, expect, it } from "vitest";
import { isValidTimeZone } from "../lib/time";
import { KESTREL_GLOBAL } from "./kestrelGlobal";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

describe("Kestrel Global sample team", () => {
  it("has 11 people with unique ids and emails", () => {
    expect(KESTREL_GLOBAL).toHaveLength(11);
    expect(new Set(KESTREL_GLOBAL.map((p) => p.id)).size).toBe(11);
    expect(new Set(KESTREL_GLOBAL.map((p) => p.email)).size).toBe(11);
  });

  it.each(KESTREL_GLOBAL)("$firstName $lastName has a real IANA zone, valid hours and valid holidays", (p) => {
    expect(isValidTimeZone(p.ianaTimeZone)).toBe(true);
    expect(p.ianaTimeZone).toMatch(/^[A-Z][a-z]+\/[A-Za-z_]+$/);
    expect(p.workingHours.start).toMatch(TIME);
    expect(p.workingHours.end).toMatch(TIME);
    expect(p.workingHours.start < p.workingHours.end).toBe(true);
    for (const range of p.outOfOffice) {
      expect(range.start).toMatch(DATE);
      expect(range.end).toMatch(DATE);
      expect(range.start <= range.end).toBe(true);
    }
  });
});
