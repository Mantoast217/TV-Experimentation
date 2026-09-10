export interface MeetingDetails {
  title: string;
  description: string;
  start: Date;
  end: Date;
}

/** "YYYY-MM-DDTHH:MM:SSZ" — what Outlook/Teams expect for a UTC instant. */
function isoSeconds(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** "YYYYMMDDTHHMMSSZ" — what Google Calendar's `dates` param expects. */
function googleDateStamp(date: Date): string {
  return isoSeconds(date).replace(/[-:]/g, "");
}

/** Opens Outlook's web calendar with a new event pre-filled. Works for outlook.com and Microsoft 365. */
export function outlookComposeUrl({ title, description, start, end }: MeetingDetails): string {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    startdt: isoSeconds(start),
    enddt: isoSeconds(end),
    subject: title,
    body: description,
  });
  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/**
 * Opens Teams' "schedule a meeting" dialog pre-filled — creates a real Teams meeting link
 * once saved.
 *
 * Teams' deep-link parser doesn't accept `+` for spaces the way most query strings do —
 * Microsoft's own docs are explicit that `+` breaks parsing and `%20` is required
 * (https://github.com/MicrosoftDocs/msteams-docs/blob/master/msteams-platform/concepts/build-and-test/deep-links.md).
 * `URLSearchParams` always serializes spaces as `+` (a real literal `+` in the input is
 * itself escaped to `%2B`, so this replace can't misfire on genuine `+` characters), so
 * that has to be patched afterward — this is the one calendar link of the four that needs
 * it, since Outlook/Google/`.ics` don't share this restriction.
 */
export function teamsMeetingUrl({ title, description, start, end }: MeetingDetails): string {
  const params = new URLSearchParams({
    subject: title,
    content: description,
    startTime: isoSeconds(start),
    endTime: isoSeconds(end),
  });
  return `https://teams.microsoft.com/l/meeting/new?${params.toString().replace(/\+/g, "%20")}`;
}

/**
 * Opens Google Calendar with a new event pre-filled; Calendar itself offers a one-click
 * "Add Google Meet video conferencing" button on that event once created.
 */
export function googleMeetUrl({ title, description, start, end }: MeetingDetails): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${googleDateStamp(start)}/${googleDateStamp(end)}`,
    details: description,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** "YYYYMMDDTHHMMSSZ" — what the iCalendar (RFC 5545) DTSTART/DTEND/DTSTAMP fields expect. */
function icsDateStamp(date: Date): string {
  return googleDateStamp(date);
}

/** Escapes text per RFC 5545 §3.3.11 (backslash, semicolon, comma, then literal newlines). */
function escapeIcsText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Builds a single-event .ics file, importable into Outlook, Apple Calendar, Google Calendar, etc. */
export function icsContent({ title, description, start, end }: MeetingDetails): string {
  const uid = `${crypto.randomUUID()}@meeting-scheduler`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Meeting Scheduler//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${icsDateStamp(new Date())}`,
    `DTSTART:${icsDateStamp(start)}`,
    `DTEND:${icsDateStamp(end)}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}

/** Triggers a browser download of the meeting as a .ics file. */
export function downloadIcsFile(details: MeetingDetails, filename = "meeting.ics"): void {
  const blob = new Blob([icsContent(details)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
