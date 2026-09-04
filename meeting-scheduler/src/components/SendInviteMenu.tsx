import { Button, Dropdown, type ButtonVariants } from "@heroui/react";

const PLATFORMS = [
  { id: "outlook", label: "Outlook", icon: "📧" },
  { id: "teams", label: "Microsoft Teams", icon: "💬" },
  { id: "zoom", label: "Zoom", icon: "🎥" },
] as const;

interface SendInviteMenuProps {
  meetingLabel: string;
  variant?: ButtonVariants["variant"];
}

export function SendInviteMenu({ meetingLabel, variant = "secondary" }: SendInviteMenuProps) {
  return (
    <Dropdown.Root>
      <Button variant={variant} size="md" className="shrink-0">
        Send invite
      </Button>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu
          onAction={(key) => {
            const platform = PLATFORMS.find((p) => p.id === key);
            // eslint-disable-next-line no-console
            console.log(`Send invite via ${platform?.label ?? key}:`, meetingLabel);
          }}
        >
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
