import { describe, expect, it } from "vitest";
import { decodeStateFromSearchParams, encodeStateToSearchParams } from "./shareLink";

const KNOWN_IDS = new Set(["gb-london", "jp-tokyo", "us-new-york-city"]);
const isKnownZoneId = (id: string) => KNOWN_IDS.has(id);

describe("encodeStateToSearchParams / decodeStateFromSearchParams", () => {
  it("round-trips a full state through the URL", () => {
    const state = { zoneIds: ["gb-london", "jp-tokyo"], dateStr: "2026-09-08", startTime: "09:00", endTime: "10:00" };
    const params = encodeStateToSearchParams(state);
    const decoded = decodeStateFromSearchParams(params, isKnownZoneId);
    expect(decoded).toEqual(state);
  });

  it("omits the zones param entirely when there are no zones", () => {
    const params = encodeStateToSearchParams({ zoneIds: [], dateStr: "2026-09-08", startTime: "09:00", endTime: "10:00" });
    expect(params.has("zones")).toBe(false);
  });

  it("drops unknown zone ids but keeps the known ones", () => {
    const params = new URLSearchParams("zones=gb-london,made-up-id,jp-tokyo&date=2026-09-08&start=09:00&end=10:00");
    const decoded = decodeStateFromSearchParams(params, isKnownZoneId);
    expect(decoded.zoneIds).toEqual(["gb-london", "jp-tokyo"]);
  });

  it("omits zoneIds entirely when every id is unknown, rather than returning an empty array", () => {
    const params = new URLSearchParams("zones=bogus-1,bogus-2&date=2026-09-08&start=09:00&end=10:00");
    const decoded = decodeStateFromSearchParams(params, isKnownZoneId);
    expect(decoded.zoneIds).toBeUndefined();
  });

  it("rejects a malformed date but still reads the other valid fields", () => {
    const params = new URLSearchParams("zones=gb-london&date=not-a-date&start=09:00&end=10:00");
    const decoded = decodeStateFromSearchParams(params, isKnownZoneId);
    expect(decoded.dateStr).toBeUndefined();
    expect(decoded.zoneIds).toEqual(["gb-london"]);
    expect(decoded.startTime).toBe("09:00");
  });

  it("rejects a malformed time", () => {
    const params = new URLSearchParams("date=2026-09-08&start=25:99&end=10:00");
    const decoded = decodeStateFromSearchParams(params, isKnownZoneId);
    expect(decoded.startTime).toBeUndefined();
    expect(decoded.endTime).toBe("10:00");
  });

  it("returns an empty object for a completely empty query string", () => {
    const decoded = decodeStateFromSearchParams(new URLSearchParams(""), isKnownZoneId);
    expect(decoded).toEqual({});
  });

  it("never throws on garbage input", () => {
    const params = new URLSearchParams("zones=&date=&start=&end=<script>");
    expect(() => decodeStateFromSearchParams(params, isKnownZoneId)).not.toThrow();
  });
});
