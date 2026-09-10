import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Colleague } from "../lib/colleagues";
import type { ZoneTimeSlot } from "../lib/scheduling";
import type { TimeZoneCatalogEntry } from "../lib/timezones";
import { ZoneTimeList } from "./ZoneTimeList";

function zone(id: string, city: string): TimeZoneCatalogEntry {
  return { id, country: "Testland", city, countryCode: "TL", timezone: "UTC" };
}

/** A slot for `city`, given as start/end wall-clock hours (no midnight crossing). */
function slot(city: string, startHour: number, endHour: number, dayOffset = 0, endDayOffset = 0): ZoneTimeSlot {
  const text = (h: number) => `${String(Math.floor(h)).padStart(2, "0")}:${String((h % 1) * 60).padStart(2, "0")}`;
  return {
    zone: zone(city.toLowerCase(), city),
    startText: text(startHour),
    endText: text(endHour),
    dayOffset,
    endDayOffset,
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
    // Two checks rather than one concatenated string: the visible " - " gap between start
    // and end time comes from the row's flex `gap`, not a text-node space character (jsdom
    // has no layout, so it can't see that CSS-driven gap) — see ZoneTimeList.tsx.
    expect(items[0]).toHaveTextContent("London 09:00");
    expect(items[0]).toHaveTextContent("- 10:00 (Morning)");
    expect(items[1]).toHaveTextContent("Tokyo 12:00");
    expect(items[1]).toHaveTextContent("- 13:00 (Afternoon)");
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
    expect(items[0]).toHaveTextContent("London 09:00");
    expect(items[0]).toHaveTextContent("- 10:00 (Morning)");
    expect(items[1]).toHaveTextContent("Paris 16:00");
    expect(items[1]).toHaveTextContent("- 18:00 (Afternoon - Evening)");
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

describe("ZoneTimeList — day-offset badges", () => {
  it("shows no badge at all when neither the start nor the end lands on a different day", () => {
    render(<ZoneTimeList slots={[slot("London", 9, 10)]} />);
    expect(screen.getByRole("listitem").textContent).not.toMatch(/[+-]\d/);
  });

  it("badges the end time — not the start — when a long duration alone pushes the end into the next day", () => {
    // The reported bug: nudging End before Start (e.g. via the step chevrons) wraps the
    // meeting to a ~24h duration, so the end lands on the next calendar day even though
    // the start (still the host's own zone, same date) doesn't move at all.
    render(<ZoneTimeList slots={[slot("London", 9, 8.75, 0, 1)]} />);
    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent("London 09:00");
    expect(item).toHaveTextContent("- 08:45");
    expect(item.textContent).toContain("+1");
    // Exactly one badge (for the end), not two — the start didn't move.
    const badges = item.querySelectorAll("span[aria-hidden='true'].rounded-full.bg-warning");
    expect(badges).toHaveLength(1);
  });

  it("badges the start time when only the start (not the end) lands on a different day", () => {
    render(<ZoneTimeList slots={[slot("Tokyo", 23, 24, 1, 1)]} />);
    const item = screen.getByRole("listitem");
    const badges = item.querySelectorAll("span[aria-hidden='true'].rounded-full.bg-warning");
    // Both start and end are offset +1 here (23:00 (+1)–00:00 (+1)), so both get badged —
    // this is the "attendee's whole day is shifted" case, distinct from the "duration
    // alone pushes the end past midnight" case above.
    expect(badges).toHaveLength(2);
  });

  it("badges start and end independently when they land on different days from each other", () => {
    // e.g. a zone whose local start is already the day before the host's date, but a
    // long-enough duration brings the end back onto the host's own date (offset 0) —
    // only the start should be badged, not a nonexistent "0" for the end.
    render(<ZoneTimeList slots={[slot("Honolulu", 22, 20, -1, 0)]} />);
    const item = screen.getByRole("listitem");
    const badges = item.querySelectorAll("span[aria-hidden='true'].rounded-full.bg-warning");
    expect(badges).toHaveLength(1);
    expect(badges[0]).toHaveTextContent("-1");
  });

  it("gives each badge a screen-reader-only explanation instead of a bare, ambiguous number", () => {
    render(<ZoneTimeList slots={[slot("London", 9, 8.75, 0, 1)]} />);
    expect(screen.getByText(/1 day later/)).toBeInTheDocument();
  });
});

function colleague(firstName: string, lastName: string): Colleague {
  return {
    id: `${firstName}-${lastName}`.toLowerCase(),
    firstName,
    lastName,
    role: "Test Role",
    email: `${firstName}.${lastName}@kestrelglobal.example`.toLowerCase(),
    timezoneId: "irrelevant-for-this-fixture",
  };
}

describe("ZoneTimeList — participant labels", () => {
  it("shows a participant's name ahead of the city when the zone matches them", () => {
    const londonSlot = slot("London", 9, 10);
    const participantByZoneId = new Map([[londonSlot.zone.id, [colleague("Arnold", "Beethoven")]]]);

    render(<ZoneTimeList slots={[londonSlot]} participantByZoneId={participantByZoneId} />);

    expect(screen.getByRole("listitem")).toHaveTextContent("Arnold Beethoven — London 09:00");
  });

  it("joins two participants who share a zone with '&', crediting both instead of dropping one", () => {
    const londonSlot = slot("London", 9, 10);
    const participantByZoneId = new Map([
      [londonSlot.zone.id, [colleague("Arnold", "Beethoven"), colleague("Liam", "Sinclair")]],
    ]);

    render(<ZoneTimeList slots={[londonSlot]} participantByZoneId={participantByZoneId} />);

    expect(screen.getByRole("listitem")).toHaveTextContent("Arnold Beethoven & Liam Sinclair — London 09:00");
  });

  it("falls back to the bare city when no participant is based in that zone", () => {
    const tokyoSlot = slot("Tokyo", 12, 13);
    const participantByZoneId = new Map([["some-other-zone-id", [colleague("Arnold", "Beethoven")]]]);

    render(<ZoneTimeList slots={[tokyoSlot]} participantByZoneId={participantByZoneId} />);

    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent("Tokyo 12:00");
    expect(item).not.toHaveTextContent("Beethoven");
  });

  it("renders exactly as before when no participantByZoneId is given at all", () => {
    render(<ZoneTimeList slots={[slot("London", 9, 10)]} />);
    expect(screen.getByRole("listitem")).toHaveTextContent("London 09:00");
  });
});
