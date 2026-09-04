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

/** Opens Teams' "schedule a meeting" dialog pre-filled — creates a real Teams meeting link once saved. */
export function teamsMeetingUrl({ title, description, start, end }: MeetingDetails): string {
  const params = new URLSearchParams({
    subject: title,
    content: description,
    startTime: isoSeconds(start),
    endTime: isoSeconds(end),
  });
  return `https://teams.microsoft.com/l/meeting/new?${params.toString()}`;
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

/**
 * Zoom has no public, unauthenticated way to pre-fill a new meeting's details via URL —
 * creating one requires the Zoom API with OAuth. This just opens Zoom's own scheduler;
 * pair it with `meetingSummaryText` copied to the clipboard so the details can be pasted in.
 */
export function zoomScheduleUrl(): string {
  return "https://zoom.us/meeting/schedule";
}

/** Human-readable summary for platforms (Zoom) that can't be pre-filled via URL. */
export function meetingSummaryText({ title, description, start, end }: MeetingDetails): string {
  const range = `${start.toLocaleString()} – ${end.toLocaleString()}`;
  return [title, range, description].filter(Boolean).join("\n");
}
