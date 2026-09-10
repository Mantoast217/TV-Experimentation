import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { MeetingScheduler } from "./MeetingScheduler";

describe("MeetingScheduler — copy", () => {
  it("shows the updated subheading under the H1", () => {
    render(<MeetingScheduler />);
    expect(
      screen.getByText(
        "Add everyone's time zone, pick a date and find the time that fits. Whether you are coordinating a team meeting or just checking what time it is for someone.",
      ),
    ).toBeInTheDocument();
  });

  it("labels the Duration field without a format-code suffix", () => {
    render(<MeetingScheduler />);
    expect(screen.getByText("Duration", { selector: "span" })).toBeInTheDocument();
    expect(screen.queryByText("Duration (HH:MM)")).not.toBeInTheDocument();
  });

  it("renames the Recommended time heading to Best time for everyone", () => {
    render(<MeetingScheduler />);
    expect(screen.getByText("Best time for everyone")).toBeInTheDocument();
    expect(screen.queryByText("Recommended time")).not.toBeInTheDocument();
  });
});

describe("MeetingScheduler — add a time zone search", () => {
  it("matches a timezone abbreviation, not just city/country — and surfaces every zone that shares it", async () => {
    // IST is a real, current abbreviation for India, Ireland, AND Israel (see
    // scripts/tzPosixFooter.mjs) — searching it is expected to return all three,
    // disambiguated by the city/country already in each option's own label, not just
    // whichever one the app happens to pick. Matching itself isn't date-sensitive (it
    // checks the zone's stored std/dst abbreviations directly), so this doesn't assert
    // which specific abbreviation is showing in the parenthetical today — that's covered
    // by timezones.test.ts's dedicated zoneAbbreviation/zoneDisplayLabel tests.
    const user = userEvent.setup();
    render(<MeetingScheduler />);

    const combo = screen.getByRole("combobox", { name: "Add a time zone" });
    await user.click(combo);
    await user.type(combo, "IST");

    // Longer than findByRole's 1s default: filtering the ~800-entry catalog and
    // re-rendering the popover on every keystroke can occasionally take longer than that
    // under CPU contention (e.g. a full parallel test-suite run) even though it's fast in
    // isolation — this widens the wait rather than tightening what's actually asserted.
    const findOptions = { timeout: 5000 };
    expect(await screen.findByRole("option", { name: /^Mumbai — India/ }, findOptions)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /^Dublin — Ireland/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /^Jerusalem — Israel/ })).toBeInTheDocument();
  });

  it("matches a daylight-saving abbreviation too, not just the standard one", async () => {
    // Birmingham, not London: London is already in the default zone list, so it wouldn't
    // appear among the *addable* search results regardless of whether the query matched.
    const user = userEvent.setup();
    render(<MeetingScheduler />);

    const combo = screen.getByRole("combobox", { name: "Add a time zone" });
    await user.click(combo);
    await user.type(combo, "BST");

    expect(await screen.findByRole("option", { name: /^Birmingham — United Kingdom/ }, { timeout: 5000 })).toBeInTheDocument();
  });

  it("still matches by city and country as before", async () => {
    const user = userEvent.setup();
    render(<MeetingScheduler />);

    const combo = screen.getByRole("combobox", { name: "Add a time zone" });
    await user.click(combo);
    await user.type(combo, "Japan");

    expect(await screen.findByRole("option", { name: /^Tokyo — Japan/ }, { timeout: 5000 })).toBeInTheDocument();
  });
});

describe("MeetingScheduler — accessibility punch list", () => {
  it("gives the Start time, End time, and Duration labels the AAA-contrast secondary-text color", () => {
    // --secondary-text (index.css) replaces the old fixed #515158: that value measured
    // 7.22:1 in light mode (WCAG AAA's 7:1 minimum for normal text) but only 2.57:1 once
    // dark mode was added, since it never adapted (verified live). --secondary-text is a
    // theme-reactive pair verified to clear 7:1 in both themes.
    render(<MeetingScheduler />);
    expect(screen.getByText("Start time")).toHaveClass("text-[var(--secondary-text)]");
    expect(screen.getByText("End time")).toHaveClass("text-[var(--secondary-text)]");
    expect(screen.getByText("Duration", { selector: "span" })).toHaveClass("text-[var(--secondary-text)]");
  });

  it("gives the Date field a real accessible name reflecting the current selection", () => {
    render(<MeetingScheduler />);
    expect(screen.getByRole("button", { name: /^Choose date, currently/ })).toBeInTheDocument();
  });

  it("marks the Date field's calendar icon as decorative", () => {
    render(<MeetingScheduler />);
    const dateButton = screen.getByRole("button", { name: /^Choose date, currently/ });
    const icon = dateButton.querySelector("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("gives the two Set up invite buttons distinct accessible names, even in the default state where their times coincide", () => {
    render(<MeetingScheduler />);
    // Deliberately NOT nudging the start time: the default Start time (09:00) coincides
    // with the default Best-time suggestion for a single, host-only zone, so this is
    // exactly the case that used to produce two identically-named buttons. The labels
    // must differ by card context (selected vs. best-for-everyone) regardless of times.
    const inviteButtons = screen.getAllByRole("button", { name: /^Set up invite for/ });
    expect(inviteButtons).toHaveLength(2);
    expect(inviteButtons[0]).toHaveAccessibleName(inviteButtons[0].getAttribute("aria-label") ?? "");
    expect(inviteButtons[0].getAttribute("aria-label")).not.toBe(inviteButtons[1].getAttribute("aria-label"));
    expect(inviteButtons[0]).toHaveAccessibleName(/your selected time/);
    expect(inviteButtons[1]).toHaveAccessibleName(/best time for everyone/);
  });
});

describe("MeetingScheduler — invite action redesign", () => {
  it("renders the shared invite note exactly once, not per card", () => {
    render(<MeetingScheduler />);
    expect(screen.getAllByText("Invites are set up through your own calendar/meeting app.")).toHaveLength(1);
  });

  it("no longer renders the old per-card caption", () => {
    render(<MeetingScheduler />);
    expect(screen.queryByText("Choose a calendar app, then send it from there")).not.toBeInTheDocument();
  });

  it("associates both invite buttons with the shared note via aria-describedby", () => {
    render(<MeetingScheduler />);
    const note = screen.getByText("Invites are set up through your own calendar/meeting app.");
    const noteId = note.getAttribute("id");
    expect(noteId).toBeTruthy();

    const inviteButtons = screen.getAllByRole("button", { name: /^Set up invite for/ });
    inviteButtons.forEach((button) => expect(button).toHaveAttribute("aria-describedby", noteId));
  });

  it("gives each invite button a decorative external-link icon that doesn't affect its accessible name", () => {
    render(<MeetingScheduler />);
    const inviteButtons = screen.getAllByRole("button", { name: /^Set up invite for/ });
    inviteButtons.forEach((button) => {
      const icon = button.querySelector("svg");
      expect(icon).toHaveAttribute("aria-hidden", "true");
      // The aria-label (asserted elsewhere to be distinct/descriptive) is unaffected by
      // the icon's presence — accessible name computation skips aria-hidden content.
      expect(button).toHaveAccessibleName(button.getAttribute("aria-label") ?? "");
    });
  });

  it("keeps the invite button's position anchor fixed regardless of attendee count", async () => {
    // jsdom has no layout engine, so this asserts the structural CSS contract that
    // guarantees position-independence from content instead of measuring pixels
    // (verified live, with real pixel measurements showing zero drift, in the browser):
    // the card is the positioning root and the button wrapper is anchored within it,
    // rather than being laid out inline with (and therefore shifted by) the attendee list.
    //
    // Three real type-search-select round trips against the full timezone catalog are
    // slow enough (especially under full-suite CPU contention) to need more than
    // vitest's default 5s test timeout.
    const user = userEvent.setup();
    render(<MeetingScheduler />);

    const getAnchorClasses = () => {
      const button = screen.getAllByRole("button", { name: /^Set up invite for/ })[0];
      const anchorWrapper = button.closest("[class*='absolute']");
      const card = anchorWrapper?.closest("[class*='relative']");
      return { anchorClass: anchorWrapper?.className, cardClass: card?.className };
    };

    const withOneAttendee = getAnchorClasses();
    expect(withOneAttendee.anchorClass).toMatch(/\babsolute\b/);
    expect(withOneAttendee.cardClass).toMatch(/\brelative\b/);

    // Anchored to the option label's full "City — Country" so a same-named city in a
    // different country (Sydney, Nova Scotia; Nishi-Tokyo-shi alongside Tokyo) — real
    // entries now that the catalog is ~26,000 GeoNames cities, not the old ~300-entry
    // one-city-per-zone seed — can't also match a loose substring search.
    const combo = screen.getByRole("combobox", { name: "Add a time zone" });
    for (const { city, country } of [
      { city: "Tokyo", country: "Japan" },
      { city: "Sydney", country: "Australia" },
      { city: "New York City", country: "United States" },
    ]) {
      await user.click(combo);
      await user.clear(combo);
      await user.type(combo, city);
      const option = await screen.findByRole("option", { name: new RegExp(`^${city} — ${country}`) });
      await user.click(option);
      await user.keyboard("{Escape}");
    }
    expect(await screen.findAllByText("Tokyo", { exact: false })).not.toHaveLength(0);

    const withFourAttendees = getAnchorClasses();
    expect(withFourAttendees).toEqual(withOneAttendee);
  }, 20_000);
});

describe("MeetingScheduler — footer", () => {
  it("links to the Privacy Policy and Terms of Use pages", () => {
    render(<MeetingScheduler />);
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy.html");
    expect(screen.getByRole("link", { name: "Terms of Use" })).toHaveAttribute("href", "/terms.html");
  });

  it("links Feedback to the feedback form, opened in a new tab", () => {
    render(<MeetingScheduler />);
    const feedback = screen.getByRole("link", { name: "Feedback" });
    expect(feedback).toHaveAttribute("href", "https://forms.gle/ouHxxGzu4Sjz2Jdi7");
    expect(feedback).toHaveAttribute("target", "_blank");
    expect(feedback).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("links back to the Standalone Meeting Scheduler", () => {
    render(<MeetingScheduler />);
    expect(screen.getByRole("link", { name: "Standalone Meeting Scheduler" })).toHaveAttribute("href", "/");
  });
});

describe("MeetingScheduler — 24-hour duration clarification", () => {
  const NOTE_TEXT = /full 24-hour meeting ending the next day/;

  it("does not show the note for the default (non-24h) start/end times", () => {
    render(<MeetingScheduler />);
    expect(screen.queryByText(NOTE_TEXT)).not.toBeInTheDocument();
  });

  it("shows the note, and enriches the Duration field's label, once end time is nudged back down to equal start time", async () => {
    // Start time defaults to 09:00, End time to 10:00. Decreasing End time by 15 minutes
    // four times brings it back to 09:00 — equal to Start — which is the only input that
    // produces a 24h duration (computeDurationHours wraps a zero diff to +24). Without this
    // note, the Duration field's "00:00" reads as a broken/zero-length meeting rather than
    // the valid full-day one it actually is.
    const user = userEvent.setup();
    render(<MeetingScheduler />);

    const decreaseEnd = screen.getByRole("button", { name: /Decrease end time by 15 minutes/ });
    for (let i = 0; i < 4; i++) {
      await user.click(decreaseEnd);
    }

    expect(screen.getByText(NOTE_TEXT)).toBeInTheDocument();
    // react-aria's TimeField nests an outer and inner group sharing the same aria-label,
    // so more than one element legitimately carries it — assert presence, not uniqueness.
    expect(screen.getAllByLabelText("Duration, 24 hours, ending the next day").length).toBeGreaterThan(0);
  });

  it("hides the note again once end time no longer equals start time", async () => {
    const user = userEvent.setup();
    render(<MeetingScheduler />);

    const decreaseEnd = screen.getByRole("button", { name: /Decrease end time by 15 minutes/ });
    for (let i = 0; i < 4; i++) {
      await user.click(decreaseEnd);
    }
    expect(screen.getByText(NOTE_TEXT)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Increase end time by 15 minutes/ }));
    expect(screen.queryByText(NOTE_TEXT)).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("Duration").length).toBeGreaterThan(0);
  });
});

describe("MeetingScheduler — light/dark mode toggle", () => {
  beforeEach(() => {
    // These are real global browser state (not component-scoped), so tests must reset
    // them explicitly rather than relying on render() to start clean each time.
    delete document.documentElement.dataset.theme;
    localStorage.clear();
  });

  it("defaults to light mode and offers to switch to dark", () => {
    render(<MeetingScheduler />);
    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("switches the theme, the button's own label, and persists the choice on click", async () => {
    const user = userEvent.setup();
    render(<MeetingScheduler />);

    await user.click(screen.getByRole("button", { name: "Switch to dark mode" }));

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeInTheDocument();
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("toggles back to light on a second click", async () => {
    const user = userEvent.setup();
    render(<MeetingScheduler />);

    const button = screen.getByRole("button", { name: "Switch to dark mode" });
    await user.click(button);
    await user.click(screen.getByRole("button", { name: "Switch to light mode" }));

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeInTheDocument();
    expect(localStorage.getItem("theme")).toBe("light");
  });

  it("starts in dark mode if [data-theme=\"dark\"] is already set (e.g. by the bootstrap script) when the component mounts", () => {
    document.documentElement.dataset.theme = "dark";
    render(<MeetingScheduler />);
    expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeInTheDocument();
  });
});

describe("MeetingScheduler — Best time for everyone, manual adjustment", () => {
  const backButton = () => screen.getByRole("button", { name: /Move best time back 15 minutes/ });
  const forwardButton = () => screen.getByRole("button", { name: /Move best time forward 15 minutes/ });

  it("shows 'Adjust time' before any nudge", () => {
    render(<MeetingScheduler />);
    expect(screen.getByText("Adjust time")).toBeInTheDocument();
  });

  it("switches to a signed, zero-padded HH:MM offset after a single nudge", async () => {
    const user = userEvent.setup();
    render(<MeetingScheduler />);

    await user.click(backButton());

    expect(screen.getByText("Adjusted -00:15")).toBeInTheDocument();
    expect(screen.queryByText("Adjust time")).not.toBeInTheDocument();
  });

  it("accumulates across repeated clicks and rolls the offset into the hour digit", async () => {
    const user = userEvent.setup();
    render(<MeetingScheduler />);

    for (let i = 0; i < 5; i++) await user.click(backButton());

    expect(screen.getByText("Adjusted -01:15")).toBeInTheDocument();
  });

  it("supports the forward direction with a '+' sign", async () => {
    const user = userEvent.setup();
    render(<MeetingScheduler />);

    await user.click(forwardButton());

    expect(screen.getByText("Adjusted +00:15")).toBeInTheDocument();
  });

  it("announces the adjustment via a polite live region", async () => {
    const user = userEvent.setup();
    render(<MeetingScheduler />);

    await user.click(backButton());

    expect(screen.getByText(/^Best time adjusted to/)).toBeInTheDocument();
  });

  it("resets to 'Adjust time' when a timezone is added", async () => {
    const user = userEvent.setup();
    render(<MeetingScheduler />);

    await user.click(backButton());
    expect(screen.getByText("Adjusted -00:15")).toBeInTheDocument();

    const combo = screen.getByRole("combobox", { name: "Add a time zone" });
    await user.click(combo);
    await user.type(combo, "Tokyo");
    const option = await screen.findByRole("option", { name: /^Tokyo — Japan/ });
    await user.click(option);

    expect(screen.getByText("Adjust time")).toBeInTheDocument();
    expect(screen.queryByText(/^Adjusted/)).not.toBeInTheDocument();
  });

  it("resets when only the start time moves — duration (and so the computed best time) doesn't change, since the end time shifts to match it, but this is still an edit to the original settings", async () => {
    const user = userEvent.setup();
    render(<MeetingScheduler />);

    await user.click(backButton());
    expect(screen.getByText("Adjusted -00:15")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Increase start time by 15 minutes/ }));

    expect(screen.getByText("Adjust time")).toBeInTheDocument();
  });

  it("resets when the end time (duration) changes", async () => {
    const user = userEvent.setup();
    render(<MeetingScheduler />);

    await user.click(backButton());
    expect(screen.getByText("Adjusted -00:15")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Increase end time by 15 minutes/ }));

    expect(screen.getByText("Adjust time")).toBeInTheDocument();
  });
});
