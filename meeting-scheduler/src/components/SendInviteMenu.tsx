import { Button, Dropdown, type ButtonVariants } from "@heroui/react";
import type { CSSProperties } from "react";
import type { Key } from "react-aria-components";
import {
  downloadIcsFile,
  googleMeetUrl,
  outlookComposeUrl,
  teamsMeetingUrl,
  type MeetingDetails,
} from "../lib/calendarLinks";
import { CalendarIcon, GoogleMeetIcon, OutlookIcon, TeamsIcon } from "./icons";

const PLATFORMS = [
  { id: "outlook", label: "Outlook", Icon: OutlookIcon },
  { id: "teams", label: "Microsoft Teams", Icon: TeamsIcon },
  { id: "google-meet", label: "Google Meet", Icon: GoogleMeetIcon },
  { id: "ical", label: "Download .ics", Icon: CalendarIcon },
] as const;

function openInNewTab(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

interface SendInviteMenuProps extends MeetingDetails {
  variant?: ButtonVariants["variant"];
  buttonStyle?: CSSProperties;
  /** Accessible name for the trigger button; falls back to the visible "Create invite" text. */
  ariaLabel?: string;
}

export function SendInviteMenu({
  title,
  description,
  start,
  end,
  variant = "secondary",
  buttonStyle,
  ariaLabel,
}: SendInviteMenuProps) {
  const details: MeetingDetails = { title, description, start, end };

  const handleAction = (key: Key) => {
    switch (key) {
      case "outlook":
        openInNewTab(outlookComposeUrl(details));
        break;
      case "teams":
        openInNewTab(teamsMeetingUrl(details));
        break;
      case "google-meet":
        openInNewTab(googleMeetUrl(details));
        break;
      case "ical":
        // A universal fallback — importable into Outlook, Apple Calendar, Google Calendar,
        // Zoom's desktop client, or anything else that reads .ics files.
        downloadIcsFile(details);
        break;
    }
  };

  return (
    <Dropdown.Root>
      <Button variant={variant} size="md" className="shrink-0" style={buttonStyle} aria-label={ariaLabel}>
        Create invite
      </Button>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu onAction={handleAction}>
          {PLATFORMS.map(({ id, label, Icon }) => (
            <Dropdown.Item key={id} id={id} textValue={label}>
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
}
