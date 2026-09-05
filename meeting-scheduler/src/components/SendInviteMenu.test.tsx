import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SendInviteMenu } from "./SendInviteMenu";

const START = new Date("2026-09-05T09:00:00Z");
const END = new Date("2026-09-05T10:00:00Z");

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
});
