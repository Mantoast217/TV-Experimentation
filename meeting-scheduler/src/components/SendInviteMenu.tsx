import { Button, Dropdown, type ButtonVariants } from "@heroui/react";
import type { Key } from "react-aria-components";
import {
  downloadIcsFile,
  googleMeetUrl,
  outlookComposeUrl,
  teamsMeetingUrl,
  type MeetingDetails,
} from "../lib/calendarLinks";

const PLATFORMS = [
  { id: "outlook", label: "Outlook", icon: "📧" },
  { id: "teams", label: "Microsoft Teams", icon: "💬" },
  { id: "google-meet", label: "Google Meet", icon: "📹" },
  { id: "ical", label: "Download .ics", icon: "📅" },
] as const;

function openInNewTab(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

interface SendInviteMenuProps extends MeetingDetails {
  variant?: ButtonVariants["variant"];
}

export function SendInviteMenu({ title, description, start, end, variant = "secondary" }: SendInviteMenuProps) {
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
      <Button variant={variant} size="md" className="shrink-0">
        Create invite
      </Button>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu onAction={handleAction}>
          {PLATFORMS.map((platform) => (
            <Dropdown.Item key={platform.id} id={platform.id} textValue={platform.label}>
              <span aria-hidden="true">{platform.icon}</span>
              {platform.label}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
}
