import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SendInviteMenu } from "./SendInviteMenu";

const START = new Date("2026-09-05T09:00:00Z");
const END = new Date("2026-09-05T10:00:00Z");
const ATTENDEE_EMAILS = ["priya.nair@kestrelglobal.example", "arnold.beethoven@kestrelglobal.example"];

describe("SendInviteMenu", () => {
  it("uses the given ariaLabel as the trigger's accessible name", () => {
    render(
      <SendInviteMenu
        title="Meeting"
        description=""
        start={START}
        end={END}
        ariaLabel="Set up invite for Saturday 5 September, 09:00–10:00"
      />,
    );

    expect(
      screen.getByRole("button", { name: "Set up invite for Saturday 5 September, 09:00–10:00" }),
    ).toBeInTheDocument();
  });

  it("falls back to the visible 'Set up invite' text when no ariaLabel is given", () => {
    render(<SendInviteMenu title="Meeting" description="" start={START} end={END} />);
    expect(screen.getByRole("button", { name: "Set up invite" })).toBeInTheDocument();
  });

  it("gives two invite buttons on the same screen distinct accessible names", () => {
    render(
      <div>
        <SendInviteMenu
          title="Meeting"
          description=""
          start={START}
          end={END}
          ariaLabel="Set up invite for Saturday 5 September, 09:00–10:00"
        />
        <SendInviteMenu
          title="Meeting"
          description=""
          start={START}
          end={END}
          ariaLabel="Set up invite for Saturday 5 September, 11:00–12:00"
        />
      </div>,
    );

    expect(screen.getByRole("button", { name: "Set up invite for Saturday 5 September, 09:00–10:00" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set up invite for Saturday 5 September, 11:00–12:00" })).toBeInTheDocument();
  });

  it("enables every platform option, Microsoft Teams included", async () => {
    const user = userEvent.setup();
    render(<SendInviteMenu title="Meeting" description="" start={START} end={END} />);
    await user.click(screen.getByRole("button", { name: "Set up invite" }));

    for (const name of ["Microsoft Outlook", "Microsoft Teams", "Google Meet", "Download .ics"]) {
      expect(screen.getByRole("menuitem", { name })).not.toHaveAttribute("aria-disabled");
    }
  });
});

describe("SendInviteMenu — attendee emails", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fills attendeeEmails into Outlook's 'to' param when 'Microsoft Outlook' is chosen", async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<SendInviteMenu title="Meeting" description="" start={START} end={END} attendeeEmails={ATTENDEE_EMAILS} />);

    await user.click(screen.getByRole("button", { name: "Set up invite" }));
    await user.click(screen.getByRole("menuitem", { name: "Microsoft Outlook" }));

    const url = new URL(openSpy.mock.calls[0][0] as string);
    expect(url.searchParams.get("to")).toBe(ATTENDEE_EMAILS.join(";"));
  });

  it("fills attendeeEmails into Teams' 'attendees' param when 'Microsoft Teams' is chosen", async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<SendInviteMenu title="Meeting" description="" start={START} end={END} attendeeEmails={ATTENDEE_EMAILS} />);

    await user.click(screen.getByRole("button", { name: "Set up invite" }));
    await user.click(screen.getByRole("menuitem", { name: "Microsoft Teams" }));

    const url = new URL(openSpy.mock.calls[0][0] as string);
    expect(url.searchParams.get("attendees")).toBe(ATTENDEE_EMAILS.join(","));
  });

  it("fills attendeeEmails into Google Calendar's 'add' param when 'Google Meet' is chosen", async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<SendInviteMenu title="Meeting" description="" start={START} end={END} attendeeEmails={ATTENDEE_EMAILS} />);

    await user.click(screen.getByRole("button", { name: "Set up invite" }));
    await user.click(screen.getByRole("menuitem", { name: "Google Meet" }));

    const url = new URL(openSpy.mock.calls[0][0] as string);
    expect(url.searchParams.get("add")).toBe(ATTENDEE_EMAILS.join(","));
  });

  it("gives the downloaded .ics an ATTENDEE line per email when 'Download .ics' is chosen", async () => {
    const user = userEvent.setup();
    let downloadedBlob: Blob | undefined;
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      downloadedBlob = blob as Blob;
      return "blob:mock";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    render(<SendInviteMenu title="Meeting" description="" start={START} end={END} attendeeEmails={ATTENDEE_EMAILS} />);

    await user.click(screen.getByRole("button", { name: "Set up invite" }));
    await user.click(screen.getByRole("menuitem", { name: "Download .ics" }));

    const text = await downloadedBlob!.text();
    for (const email of ATTENDEE_EMAILS) {
      expect(text).toContain(`ATTENDEE:mailto:${email}`);
    }
  });

  it("doesn't add any attendee field when attendeeEmails is omitted", async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<SendInviteMenu title="Meeting" description="" start={START} end={END} />);

    await user.click(screen.getByRole("button", { name: "Set up invite" }));
    await user.click(screen.getByRole("menuitem", { name: "Microsoft Outlook" }));

    const url = new URL(openSpy.mock.calls[0][0] as string);
    expect(url.searchParams.has("to")).toBe(false);
  });
});
