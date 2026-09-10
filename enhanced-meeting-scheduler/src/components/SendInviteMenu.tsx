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
import { CalendarIcon, ExternalLinkIcon, GoogleMeetIcon, OutlookIcon, TeamsIcon } from "./icons";

// Teams re-enabled despite a known, unfixed issue: the "new Teams" client currently
// drops the deep link's meeting details, dead-ending on a generic calendar view instead
// of the compose dialog — a client-side bug outside anything this URL can control.
// Deliberately shipped anyway (rather than left disabled) so the option is available;
// a user hitting the blank calendar view can still fill in details manually there.
const PLATFORMS = [
  { id: "outlook", label: "Microsoft Outlook", Icon: OutlookIcon, disabled: false },
  { id: "teams", label: "Microsoft Teams", Icon: TeamsIcon, disabled: false },
  { id: "google-meet", label: "Google Meet", Icon: GoogleMeetIcon, disabled: false },
  { id: "ical", label: "Download .ics", Icon: CalendarIcon, disabled: false },
] as const;

function openInNewTab(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

interface SendInviteMenuProps extends MeetingDetails {
  variant?: ButtonVariants["variant"];
  buttonStyle?: CSSProperties;
  /** Accessible name for the trigger button; falls back to the visible "Set up invite" text. */
  ariaLabel?: string;
  /** id of an element (e.g. the shared "invites open your calendar app" note) to expose as this button's accessible description. */
  describedById?: string;
}

export function SendInviteMenu({
  title,
  description,
  start,
  end,
  variant = "secondary",
  buttonStyle,
  ariaLabel,
  describedById,
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
      <Button
        variant={variant}
        size="md"
        className="shrink-0"
        style={buttonStyle}
        aria-label={ariaLabel}
        aria-describedby={describedById}
      >
        <span className="inline-flex items-center gap-1.5">
          Set up invite
          <ExternalLinkIcon className="h-3.5 w-3.5" />
        </span>
      </Button>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu onAction={handleAction}>
          {PLATFORMS.map(({ id, label, Icon, disabled }) => (
            <Dropdown.Item
              key={id}
              id={id}
              textValue={label}
              isDisabled={disabled}
              className="data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
            >
              <Icon className="h-4 w-4 shrink-0" />
              {/* translate="no": these are brand names (Microsoft Outlook, Microsoft
                  Teams, Google Meet), not ordinary copy — a browser page-translator
                  swapping in a translated word for "Outlook" (reproduced live) makes the
                  option unrecognizable, so opt the label itself out the same way the
                  high-churn regions were opted out earlier (see ZoneTimeList.tsx). */}
              <span translate="no">{label}</span>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
}
