import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { TimeZoneCatalogEntry } from "../lib/timezones";
import { TimezoneChipList } from "./TimezoneChipList";

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

const NEW_YORK: TimeZoneCatalogEntry = {
  id: "united-states-new-york",
  country: "United States",
  city: "New York",
  abbr: "EDT",
  offsetHours: -4,
};

/** Mirrors how MeetingScheduler wires zones/removeZone/the add-timezone input. */
function Harness({ initialZones }: { initialZones: TimeZoneCatalogEntry[] }) {
  const [zones, setZones] = useState(initialZones);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <input ref={inputRef} aria-label="Add timezone" />
      <TimezoneChipList
        zones={zones}
        onRemove={(id) => setZones((prev) => prev.filter((z) => z.id !== id))}
        addInputRef={inputRef}
      />
    </div>
  );
}

function removeButton(label: string) {
  return screen.getByRole("button", { name: `Remove ${label}` });
}

describe("TimezoneChipList", () => {
  it("renders the chips as a semantic list", () => {
    render(<Harness initialZones={[LONDON, TOKYO]} />);
    expect(screen.getByRole("list")).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    // Explicit role attributes, not just implicit <ul>/<li> semantics: the list-none
    // utility strips the implicit list/listitem role in real browsers (Chromium/WebKit),
    // a gap jsdom's role inference alone wouldn't catch.
    items.forEach((item) => expect(item).toHaveAttribute("role", "listitem"));
  });

  it("gives each remove control a real <button> with an accessible name naming its own chip", () => {
    render(<Harness initialZones={[LONDON, TOKYO]} />);

    const londonRemove = removeButton("London — United Kingdom (GMT+1)");
    const tokyoRemove = removeButton("Tokyo — Japan (GMT+9)");

    expect(londonRemove.tagName).toBe("BUTTON");
    expect(tokyoRemove.tagName).toBe("BUTTON");
    expect(londonRemove).not.toBe(tokyoRemove);
  });

  it("gives the remove button a hit area of at least 24x24 CSS px", () => {
    render(<Harness initialZones={[LONDON]} />);
    const button = removeButton("London — United Kingdom (GMT+1)");

    expect(button).toHaveStyle({ minWidth: "24px", minHeight: "24px" });
  });

  it("is operable end-to-end via keyboard: Tab reaches it, Enter and Space activate it", async () => {
    const user = userEvent.setup();
    render(<Harness initialZones={[LONDON, TOKYO, NEW_YORK]} />);

    await user.tab(); // Add timezone input
    await user.tab(); // London remove button
    expect(removeButton("London — United Kingdom (GMT+1)")).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(screen.queryByRole("button", { name: /Remove London/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);

    await user.keyboard(" ");
    expect(screen.queryByRole("button", { name: /Remove Tokyo/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("moves focus to the next remaining chip's remove button after a removal", async () => {
    const user = userEvent.setup();
    render(<Harness initialZones={[LONDON, TOKYO, NEW_YORK]} />);

    removeButton("London — United Kingdom (GMT+1)").focus();
    await user.keyboard("{Enter}");

    expect(await screen.findByRole("button", { name: "Remove Tokyo — Japan (GMT+9)" })).toHaveFocus();
  });

  it("moves focus to the previous chip's remove button when the last chip is removed", async () => {
    const user = userEvent.setup();
    render(<Harness initialZones={[LONDON, TOKYO]} />);

    removeButton("Tokyo — Japan (GMT+9)").focus();
    await user.keyboard("{Enter}");

    expect(await screen.findByRole("button", { name: "Remove London — United Kingdom (GMT+1)" })).toHaveFocus();
  });

  it("returns focus to the Add timezone input when the only chip is removed", async () => {
    const user = userEvent.setup();
    render(<Harness initialZones={[LONDON]} />);

    removeButton("London — United Kingdom (GMT+1)").focus();
    await user.keyboard("{Enter}");

    expect(await screen.findByRole("textbox", { name: "Add timezone" })).toHaveFocus();
  });

  it("announces additions and removals via a polite live region", async () => {
    const onRemove = vi.fn();
    const inputRef = { current: null } as { current: HTMLInputElement | null };
    const { rerender } = render(
      <TimezoneChipList zones={[LONDON]} onRemove={onRemove} addInputRef={inputRef} />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("");

    rerender(<TimezoneChipList zones={[LONDON, TOKYO]} onRemove={onRemove} addInputRef={inputRef} />);
    expect(await screen.findByRole("status")).toHaveTextContent("Tokyo added");

    rerender(<TimezoneChipList zones={[TOKYO]} onRemove={onRemove} addInputRef={inputRef} />);
    expect(await screen.findByRole("status")).toHaveTextContent("London removed");
  });

  it("has no axe-detectable accessibility violations", async () => {
    const { container } = render(<Harness initialZones={[LONDON, TOKYO]} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
