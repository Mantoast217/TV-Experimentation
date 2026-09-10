import { describe, expect, it } from "vitest";
import { googleMeetUrl, outlookComposeUrl, teamsMeetingUrl, type MeetingDetails } from "./calendarLinks";

const details: MeetingDetails = {
  title: "Meeting",
  description: "London 16:00–17:00 / Tokyo 00:00–01:00 (+1)",
  start: new Date("2026-01-15T16:00:00.000Z"),
  end: new Date("2026-01-15T17:00:00.000Z"),
};

describe("teamsMeetingUrl", () => {
  // Regression test: Teams' deep-link parser doesn't accept `+` for spaces (Microsoft's
  // own docs call this out explicitly — `+` breaks the "New meeting" dialog routing,
  // %20 is required), but URLSearchParams always serializes spaces as `+`. The app's
  // description text always contains spaces (city names, times), so every Teams invite
  // link was malformed before this was fixed.
  it("never encodes a space as '+' — Teams' deep-link parser rejects that", () => {
    const url = teamsMeetingUrl(details);
    expect(url).not.toContain("+");
  });

  it("encodes spaces as %20 in the content and subject params", () => {
    const url = teamsMeetingUrl(details);
    expect(url).toContain("content=London%20");
    expect(url).toContain("startTime=2026-01-15T16%3A00%3A00Z");
  });

  it("still round-trips to the original text once decoded", () => {
    const url = teamsMeetingUrl(details);
    const parsed = new URL(url);
    expect(parsed.searchParams.get("subject")).toBe(details.title);
    expect(parsed.searchParams.get("content")).toBe(details.description);
  });

  it("preserves a literal '+' in the input instead of colliding with the space encoding", () => {
    const url = teamsMeetingUrl({ ...details, description: "1 + 1" });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("content")).toBe("1 + 1");
  });
});

describe("outlookComposeUrl / googleMeetUrl — unaffected by the Teams-only fix", () => {
  it("still builds valid Outlook and Google Calendar URLs for the same input", () => {
    expect(new URL(outlookComposeUrl(details)).searchParams.get("subject")).toBe(details.title);
    expect(new URL(googleMeetUrl(details)).searchParams.get("text")).toBe(details.title);
  });
});
