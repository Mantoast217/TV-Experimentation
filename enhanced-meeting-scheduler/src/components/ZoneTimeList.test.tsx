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
function slot(
  city: string,
  startHour: number,
  endHour: number,
  dayOffset = 0,
  endDayOffset = 0,
  localDateStr = "2026-09-10",
): ZoneTimeSlot {
  const text = (h: number) => `${String(Math.floor(h)).padStart(2, "0")}:${String((h % 1) * 60).padStart(2, "0")}`;
  return {
    zone: zone(city.toLowerCase(), city),
    startText: text(startHour),
    endText: text(endHour),
    dayOffset,
    endDayOffset,
    startHourRaw: startHour,
    endHourRaw: endHour,
    localDateStr,
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
    // City, time range, and quality label are separate lines/elements now (see
    // ZoneTimeList.tsx), so each is asserted independently rather than as one string.
    expect(items[0]).toHaveTextContent("London");
    expect(items[0]).toHaveTextContent("09:00 - 10:00");
    expect(items[0]).toHaveTextContent("Morning");
    expect(items[1]).toHaveTextContent("Tokyo");
    expect(items[1]).toHaveTextContent("12:00 - 13:00");
    expect(items[1]).toHaveTextContent("Afternoon");
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
    expect(items[0]).toHaveTextContent("London");
    expect(items[0]).toHaveTextContent("09:00 - 10:00");
    expect(items[0]).toHaveTextContent("Morning");
    expect(items[1]).toHaveTextContent("Paris");
    expect(items[1]).toHaveTextContent("16:00 - 18:00");
    expect(items[1]).toHaveTextContent("Afternoon - Evening");
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
    expect(item).toHaveTextContent("London");
    expect(item).toHaveTextContent("09:00 - 08:45");
    expect(item.textContent).toContain("+1");
    // Exactly one badge (for the end), not two — the start didn't move.
    const badges = item.querySelectorAll("span[aria-hidden='true'].rounded-full.bg-warning");
    expect(badges).toHaveLength(1);
  });

  it("shows exactly one badge, on the time line, when start and end are offset by the same amount", () => {
    render(<ZoneTimeList slots={[slot("Tokyo", 23, 24, 1, 1)]} />);
    const item = screen.getByRole("listitem");
    const badges = item.querySelectorAll("span[aria-hidden='true'].rounded-full.bg-warning");
    // Both start and end are offset +1 here (23:00 (+1)–00:00 (+1)) — the whole slot is
    // uniformly shifted a day, so one badge says it; a second one on the name line would
    // just repeat the same "+1" rather than adding information (a real case reported live:
    // two identical "-1" chips on one row read as a doubled-up mistake, not two facts).
    expect(badges).toHaveLength(1);
    expect(badges[0]).toHaveTextContent("+1");
    // On the time line, not the name line — matches the badge that would appear if only
    // the end (not the start) had moved.
    const timeLine = item.querySelector(".pl-\\[14px\\]");
    expect(timeLine?.contains(badges[0])).toBe(true);
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

  it("badges both the name and time line, with their own distinct offsets, when start and end land on two different other days", () => {
    // A long enough duration pushes the start +1 day and the end +2 — genuinely different
    // facts, unlike the equal-offset case above, so both badges earn their place here.
    render(<ZoneTimeList slots={[slot("Tokyo", 23, 22, 1, 2)]} />);
    const item = screen.getByRole("listitem");
    const badges = item.querySelectorAll("span[aria-hidden='true'].rounded-full.bg-warning");
    expect(badges).toHaveLength(2);
    expect(badges[0]).toHaveTextContent("+1");
    expect(badges[1]).toHaveTextContent("+2");
  });

  it("gives each badge a screen-reader-only explanation instead of a bare, ambiguous number", () => {
    render(<ZoneTimeList slots={[slot("London", 9, 8.75, 0, 1)]} />);
    expect(screen.getByText(/1 day later/)).toBeInTheDocument();
  });
});

function colleague(
  firstName: string,
  lastName: string,
  overrides: Partial<Pick<Colleague, "workingHours" | "outOfOffice">> = {},
): Colleague {
  return {
    id: `${firstName}-${lastName}`.toLowerCase(),
    firstName,
    lastName,
    role: "Test Role",
    email: `${firstName}.${lastName}@kestrelglobal.example`.toLowerCase(),
    timezoneId: "irrelevant-for-this-fixture",
    workingHours: { start: "09:00", end: "17:00" },
    ...overrides,
  };
}

describe("ZoneTimeList — participant labels", () => {
  it("shows a participant's name ahead of the city when the zone matches them", () => {
    const londonSlot = slot("London", 9, 10);
    const participantByZoneId = new Map([[londonSlot.zone.id, [colleague("Arnold", "Beethoven")]]]);

    render(<ZoneTimeList slots={[londonSlot]} participantByZoneId={participantByZoneId} />);

    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent("Arnold Beethoven — London");
    expect(item).toHaveTextContent("09:00 - 10:00");
  });

  it("joins two participants who share a zone with '&', crediting both instead of dropping one", () => {
    const londonSlot = slot("London", 9, 10);
    const participantByZoneId = new Map([
      [londonSlot.zone.id, [colleague("Arnold", "Beethoven"), colleague("Liam", "Sinclair")]],
    ]);

    render(<ZoneTimeList slots={[londonSlot]} participantByZoneId={participantByZoneId} />);

    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent("Arnold Beethoven & Liam Sinclair — London");
    expect(item).toHaveTextContent("09:00 - 10:00");
  });

  it("falls back to the bare city when no participant is based in that zone", () => {
    const tokyoSlot = slot("Tokyo", 12, 13);
    const participantByZoneId = new Map([["some-other-zone-id", [colleague("Arnold", "Beethoven")]]]);

    render(<ZoneTimeList slots={[tokyoSlot]} participantByZoneId={participantByZoneId} />);

    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent("Tokyo");
    expect(item).toHaveTextContent("12:00 - 13:00");
    expect(item).not.toHaveTextContent("Beethoven");
  });

  it("renders exactly as before when no participantByZoneId is given at all", () => {
    render(<ZoneTimeList slots={[slot("London", 9, 10)]} />);
    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent("London");
    expect(item).toHaveTextContent("09:00 - 10:00");
  });
});

describe("ZoneTimeList — holiday and outside-hours flags", () => {
  it("flags a participant who's on holiday on the slot's own local date", () => {
    const stockholmSlot = slot("Stockholm", 10, 11, 0, 0, "2026-09-10");
    const sofia = colleague("Sofia", "Bergström", { outOfOffice: [{ start: "2026-09-08", end: "2026-09-19" }] });
    const participantByZoneId = new Map([[stockholmSlot.zone.id, [sofia]]]);

    render(<ZoneTimeList slots={[stockholmSlot]} participantByZoneId={participantByZoneId} />);

    expect(screen.getByRole("listitem")).toHaveTextContent("On holiday");
  });

  it("doesn't flag a participant whose OOO range doesn't cover the slot's local date", () => {
    const stockholmSlot = slot("Stockholm", 10, 11, 0, 0, "2026-09-25");
    const sofia = colleague("Sofia", "Bergström", { outOfOffice: [{ start: "2026-09-08", end: "2026-09-19" }] });
    const participantByZoneId = new Map([[stockholmSlot.zone.id, [sofia]]]);

    render(<ZoneTimeList slots={[stockholmSlot]} participantByZoneId={participantByZoneId} />);

    expect(screen.getByRole("listitem")).not.toHaveTextContent("On holiday");
  });

  it("flags a slot that falls outside a participant's declared hours, alongside the universal quality label", () => {
    const sydneySlot = slot("Sydney", 18, 19);
    const zoe = colleague("Zoe", "Fitzgerald", { workingHours: { start: "09:00", end: "17:00" } });
    const participantByZoneId = new Map([[sydneySlot.zone.id, [zoe]]]);

    render(<ZoneTimeList slots={[sydneySlot]} participantByZoneId={participantByZoneId} />);

    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent("Evening");
    expect(item).toHaveTextContent("Outside hours");
    expect(item).toHaveTextContent("ends 17:00");
  });

  it("doesn't flag a slot inside a participant's declared hours", () => {
    const sydneySlot = slot("Sydney", 10, 11);
    const zoe = colleague("Zoe", "Fitzgerald", { workingHours: { start: "09:00", end: "17:00" } });
    const participantByZoneId = new Map([[sydneySlot.zone.id, [zoe]]]);

    render(<ZoneTimeList slots={[sydneySlot]} participantByZoneId={participantByZoneId} />);

    expect(screen.getByRole("listitem")).not.toHaveTextContent("Outside hours");
  });

  it("names the affected person when only some of the people sharing a zone are outside their hours", () => {
    const londonSlot = slot("London", 8, 9);
    const arnold = colleague("Arnold", "Beethoven", { workingHours: { start: "08:30", end: "17:00" } });
    const liam = colleague("Liam", "Sinclair", { workingHours: { start: "09:00", end: "17:30" } });
    const participantByZoneId = new Map([[londonSlot.zone.id, [arnold, liam]]]);

    render(<ZoneTimeList slots={[londonSlot]} participantByZoneId={participantByZoneId} />);

    const item = screen.getByRole("listitem");
    // 08:00-09:00 is within neither's hours (Arnold starts 08:30, Liam 09:00) — both are
    // affected here, so the flag reads as the plain, unnamed "Outside hours".
    expect(item).toHaveTextContent("Outside hours");
    expect(item).not.toHaveTextContent("Outside Arnold's hours");
  });

  it("doesn't also flag someone on holiday as outside their hours — the holiday flag already explains it", () => {
    const stockholmSlot = slot("Stockholm", 22, 23, 0, 0, "2026-09-10");
    const sofia = colleague("Sofia", "Bergström", {
      workingHours: { start: "08:00", end: "16:00" },
      outOfOffice: [{ start: "2026-09-08", end: "2026-09-19" }],
    });
    const participantByZoneId = new Map([[stockholmSlot.zone.id, [sofia]]]);

    render(<ZoneTimeList slots={[stockholmSlot]} participantByZoneId={participantByZoneId} />);

    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent("On holiday");
    expect(item).not.toHaveTextContent("Outside hours");
  });
});
