import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { TimeZoneCatalogEntry } from "../lib/timezones";
import { useAnchorZone } from "../lib/useAnchorZone";
import { AnchorZoneCallout } from "./AnchorZoneCallout";

const LONDON: TimeZoneCatalogEntry = {
  id: "united-kingdom-london",
  country: "United Kingdom",
  city: "London",
  abbr: "BST",
  offsetHours: 1,
};

const TOKYO: TimeZoneCatalogEntry = {
  id: "japan-tokyo",
  country: "Japan",
  city: "Tokyo",
  abbr: "JST",
  offsetHours: 9,
};

/** Wires the callout to the real hook, mirroring how MeetingScheduler uses it. */
function Harness({ initialZones }: { initialZones: TimeZoneCatalogEntry[] }) {
  const [zones] = useState(initialZones);
  const { anchorZone, isAutoAnchor, selectAnchor } = useAnchorZone(zones);
  if (!anchorZone) return null;
  return (
    <AnchorZoneCallout zones={zones} anchorZone={anchorZone} isAutoAnchor={isAutoAnchor} onSelectAnchor={selectAnchor} />
  );
}

function changeTrigger(name: RegExp | string = /Change reference timezone/) {
  return screen.getByRole("button", { name });
}

describe("AnchorZoneCallout", () => {
  it("shows the auto-anchor sentence with the GMT qualifier for the first-added zone", () => {
    render(<Harness initialZones={[LONDON, TOKYO]} />);
    const text = screen.getByText(/Times below are shown relative to/);
    expect(text).toHaveTextContent("Times below are shown relative to London (first added, GMT+1).");
  });

  it("puts the sentence in a polite live region", () => {
    render(<Harness initialZones={[LONDON, TOKYO]} />);
    const text = screen.getByText(/Times below are shown relative to/);
    expect(text).toHaveAttribute("aria-live", "polite");
  });

  it("gives the Change control a real button with context in its accessible name", () => {
    render(<Harness initialZones={[LONDON, TOKYO]} />);
    const trigger = changeTrigger();
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger).toHaveAccessibleName("Change reference timezone, currently London");
  });

  it("lists only the currently-added zones in the picker, keyboard-navigable, and updates the sentence on selection", async () => {
    const user = userEvent.setup();
    render(<Harness initialZones={[LONDON, TOKYO]} />);

    await user.click(changeTrigger());

    const listbox = await screen.findByRole("listbox");
    const options = within(listbox).getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options.map((o) => o.textContent)).toEqual([
      "London — United Kingdom (GMT+1)",
      "Tokyo — Japan (GMT+9)",
    ]);

    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");

    const text = await screen.findByText(/Times below are shown relative to/);
    expect(text).toHaveTextContent("Times below are shown relative to Tokyo (selected).");
  });

  it("swaps the qualifier to \"(selected)\" once a manual pick is made", async () => {
    const user = userEvent.setup();
    render(<Harness initialZones={[LONDON, TOKYO]} />);

    await user.click(changeTrigger());
    await user.keyboard("{ArrowDown}{Enter}");

    await waitFor(() => {
      expect(screen.getByText(/Times below are shown relative to/)).toHaveTextContent(
        "Times below are shown relative to Tokyo (selected).",
      );
    });
  });

  it("is dismissible with Escape and returns focus to the Change trigger", async () => {
    const user = userEvent.setup();
    render(<Harness initialZones={[LONDON, TOKYO]} />);

    await user.click(changeTrigger());
    await screen.findByRole("listbox");

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await waitFor(() => expect(changeTrigger()).toHaveFocus());
  });

  it("returns focus to the Change trigger after picking an option", async () => {
    const user = userEvent.setup();
    render(<Harness initialZones={[LONDON, TOKYO]} />);

    await user.click(changeTrigger());
    await user.keyboard("{ArrowDown}{Enter}");

    expect(await screen.findByRole("button", { name: /currently Tokyo/ })).toHaveFocus();
  });

  it("has no axe-detectable accessibility violations", async () => {
    const { container } = render(<Harness initialZones={[LONDON, TOKYO]} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("AnchorZoneCallout visibility", () => {
  it("is not rendered by the parent when there are zero zones", () => {
    function ZeroZoneHarness() {
      const zones: TimeZoneCatalogEntry[] = [];
      const { anchorZone, isAutoAnchor, selectAnchor } = useAnchorZone(zones);
      return (
        <div>
          {zones.length > 0 && anchorZone && (
            <AnchorZoneCallout zones={zones} anchorZone={anchorZone} isAutoAnchor={isAutoAnchor} onSelectAnchor={selectAnchor} />
          )}
        </div>
      );
    }
    render(<ZeroZoneHarness />);
    expect(screen.queryByText(/Times below are shown relative to/)).not.toBeInTheDocument();
  });

  it("is still shown with exactly one zone added", () => {
    render(<Harness initialZones={[LONDON]} />);
    expect(screen.getByText(/Times below are shown relative to/)).toHaveTextContent(
      "Times below are shown relative to London (first added, GMT+1).",
    );
  });
});

describe("AnchorZoneCallout onSelectAnchor contract", () => {
  it("calls onSelectAnchor with the picked zone's id", async () => {
    const user = userEvent.setup();
    const onSelectAnchor = vi.fn();
    render(
      <AnchorZoneCallout zones={[LONDON, TOKYO]} anchorZone={LONDON} isAutoAnchor onSelectAnchor={onSelectAnchor} />,
    );

    await user.click(changeTrigger());
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onSelectAnchor).toHaveBeenCalledWith(TOKYO.id);
  });
});
