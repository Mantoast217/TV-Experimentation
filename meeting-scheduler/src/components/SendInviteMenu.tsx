import { Button, Dropdown, type ButtonVariants } from "@heroui/react";
import type { Key } from "react-aria-components";
import {
  googleMeetUrl,
  meetingSummaryText,
  outlookComposeUrl,
  teamsMeetingUrl,
  zoomScheduleUrl,
  type MeetingDetails,
} from "../lib/calendarLinks";

const PLATFORMS = [
  { id: "outlook", label: "Outlook", icon: "📧" },
  { id: "teams", label: "Microsoft Teams", icon: "💬" },
  { id: "google-meet", label: "Google Meet", icon: "📹" },
  { id: "zoom", label: "Zoom", icon: "🎥" },
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
      case "zoom":
        // Zoom has no unauthenticated pre-fill URL — copy the details so they can be
        // pasted into Zoom's own scheduler, which we still open for convenience.
        navigator.clipboard?.writeText(meetingSummaryText(details)).catch(() => {});
        openInNewTab(zoomScheduleUrl());
        break;
    }
  };

  return (
    <Dropdown.Root>
      <Button variant={variant} size="md" className="shrink-0">
        Send invite
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
