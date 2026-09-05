import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ZoneTimeSlot } from "../lib/scheduling";
import type { TimeZoneCatalogEntry } from "../lib/timezones";
import { ZoneTimeList } from "./ZoneTimeList";

function zone(id: string, city: string): TimeZoneCatalogEntry {
  return { id, country: "Testland", city, abbr: "TST", offsetHours: 0 };
}

/** A slot for `city`, given as start/end wall-clock hours (no midnight crossing). */
function slot(city: string, startHour: number, endHour: number, dayOffset = 0): ZoneTimeSlot {
  const text = (h: number) => `${String(Math.floor(h)).padStart(2, "0")}:${String((h % 1) * 60).padStart(2, "0")}`;
  return {
    zone: zone(city.toLowerCase(), city),
    startText: text(startHour),
    endText: text(endHour),
    dayOffset,
    startHourRaw: startHour,
    endHourRaw: endHour,
  };
}

describe("ZoneTimeList", () => {
  it("renders attendees as a semantic list, one per item", () => {
    render(<ZoneTimeList slots={[slot("London", 9, 10), slot("Tokyo", 12, 13)]} />);

    expect(screen.getByRole("list")).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    // Explicit role attributes, not just implicit <ul>/<li> semantics: the list-none
    // utility strips the implicit list/listitem role in real browsers (Chromium/WebKit),
    // a gap jsdom's role inference alone wouldn't catch.
    items.forEach((item) => expect(item).toHaveAttribute("role", "listitem"));
    expect(items[0]).toHaveTextContent("London 09:00–10:00 (Morning)");
    expect(items[1]).toHaveTextContent("Tokyo 12:00–13:00 (Afternoon)");
  });

  it("does not join attendees with a slash separator", () => {
    const { container } = render(<ZoneTimeList slots={[slot("London", 9, 10), slot("Tokyo", 12, 13)]} />);
    expect(container.textContent).not.toContain("/");
  });

  it("scales to 6 timezones without losing any attendee or reintroducing a separator", () => {
    const cities = ["London", "Tokyo", "New York", "Sydney", "Paris", "Nairobi"];
    render(<ZoneTimeList slots={cities.map((city) => slot(city, 9, 10))} />);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(6);
    cities.forEach((city, i) => expect(items[i]).toHaveTextContent(city));
  });

  it("resolves each attendee's label independently, including a split-dot label for one of them", () => {
    // London sits entirely in Morning; Paris straddles the Afternoon/Evening boundary
    // and should show a compound label, entirely independently of London's.
    render(<ZoneTimeList slots={[slot("London", 9, 10), slot("Paris", 16, 18)]} />);
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("London 09:00–10:00 (Morning)");
    expect(items[1]).toHaveTextContent("Paris 16:00–18:00 (Afternoon - Evening)");
  });

  it("renders a split dot as a two-color gradient for a slot spanning two bands", () => {
    render(<ZoneTimeList slots={[slot("Paris", 16, 18)]} />);
    const dot = screen.getByRole("listitem").querySelector("[aria-hidden='true']");
    expect(dot?.getAttribute("style")).toContain("linear-gradient");
    expect(dot?.getAttribute("style")).toContain("var(--color-success)");
    expect(dot?.getAttribute("style")).toContain("var(--color-warning)");
  });

  it("renders the status dot as a solid color (no gradient) for a slot within one band", () => {
    render(<ZoneTimeList slots={[slot("London", 9, 10)]} />);
    const dot = screen.getByRole("listitem").querySelector("[aria-hidden='true']");
    expect(dot).toHaveStyle({ backgroundColor: "var(--color-success)" });
    expect(dot?.getAttribute("style")).not.toContain("gradient");
  });

  it("shows the placeholder message instead of a list when there are no slots", () => {
    render(<ZoneTimeList slots={[]} />);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.getByText("Add a timezone to see local times")).toBeInTheDocument();
  });
});
