import { describe, expect, it } from "vitest";
import { googleMeetUrl, icsContent, outlookComposeUrl, teamsMeetingUrl, type MeetingDetails } from "./calendarLinks";

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

const attendeeEmails = ["priya.nair@kestrelglobal.example", "arnold.beethoven@kestrelglobal.example"];

describe("attendee emails — filled into each platform's own recipient field, not the description", () => {
  it("joins attendeeEmails with ';' into Outlook's 'to' field", () => {
    const url = new URL(outlookComposeUrl(details, attendeeEmails));
    expect(url.searchParams.get("to")).toBe(attendeeEmails.join(";"));
    expect(url.searchParams.get("body")).toBe(details.description);
  });

  it("omits Outlook's 'to' param entirely when there are no attendees", () => {
    const url = new URL(outlookComposeUrl(details, []));
    expect(url.searchParams.has("to")).toBe(false);
  });

  it("joins attendeeEmails with ',' into Teams' 'attendees' field", () => {
    const url = teamsMeetingUrl(details, attendeeEmails);
    const parsed = new URL(url);
    expect(parsed.searchParams.get("attendees")).toBe(attendeeEmails.join(","));
    // Teams' deep-link parser rejects '+' for spaces (see the describe block above) — the
    // comma-joined attendees param doesn't contain spaces, but the fix-up regex applies to
    // the whole query string, so this guards against a future param reintroducing one.
    expect(url).not.toContain("+");
  });

  it("joins attendeeEmails with ',' into Google Calendar's 'add' field", () => {
    const url = new URL(googleMeetUrl(details, attendeeEmails));
    expect(url.searchParams.get("add")).toBe(attendeeEmails.join(","));
  });

  it("gives the .ics file one ATTENDEE line per email", () => {
    const ics = icsContent(details, attendeeEmails);
    for (const email of attendeeEmails) {
      expect(ics).toContain(`ATTENDEE:mailto:${email}`);
    }
    // One line per address, not a combined list on a single ATTENDEE line (RFC 5545 §3.8.4.1).
    expect(ics.match(/^ATTENDEE:/gm)).toHaveLength(attendeeEmails.length);
  });

  it("omits ATTENDEE lines entirely when there are no attendees", () => {
    expect(icsContent(details, [])).not.toContain("ATTENDEE");
    expect(icsContent(details)).not.toContain("ATTENDEE");
  });
});
