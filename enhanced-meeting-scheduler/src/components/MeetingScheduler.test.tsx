import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MeetingScheduler } from "./MeetingScheduler";

/** The time zone section is now behind an "Add a time zone" reveal button, off by
 * default in favor of the colleague search — tests that need the time zone combobox
 * have to open it first. */
async function revealTimezoneSearch(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Add a time zone" }));
}

/** There's no default zone anymore (see MeetingScheduler — empty state) — tests that
 * need a lone, host-only zone to exercise the schedule/invite UI add one explicitly. */
async function addOneZone(user: ReturnType<typeof userEvent.setup>, city = "London") {
  await revealTimezoneSearch(user);
  const combo = screen.getByRole("combobox", { name: "Add a time zone" });
  await user.click(combo);
  await user.type(combo, city);
  await user.click(await screen.findByRole("option", { name: new RegExp(`^${city} —`) }, { timeout: 5000 }));
  await user.keyboard("{Escape}");
}

/** Adds a colleague by (partial) name through the participant search, matching the same
 * combobox-then-Escape pattern the individual colleague tests already use. */
async function addColleague(user: ReturnType<typeof userEvent.setup>, name: string) {
  const combo = screen.getByRole("combobox", { name: "Search for colleagues" });
  await user.click(combo);
  await user.type(combo, name);
  await user.click(await screen.findByRole("option", { name: new RegExp(name) }, { timeout: 5000 }));
  await user.keyboard("{Escape}");
}

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

describe("MeetingScheduler — add a participant", () => {
  it("titles the section 'Add a participant', not 'Add a time zone'", () => {
    render(<MeetingScheduler />);
    expect(screen.getByRole("heading", { name: "Add a participant" })).toBeInTheDocument();
    // The old heading text still exists once the time zone section is revealed (see the
    // reveal-button test below) — but nothing should show it before that click.
    expect(screen.queryByRole("heading", { name: "Add a time zone" })).not.toBeInTheDocument();
  });

  it("searches colleagues by name and shows their avatar, name, role, city, country, and timezone", async () => {
    const user = userEvent.setup();
    render(<MeetingScheduler />);

    const combo = screen.getByRole("combobox", { name: "Search for colleagues" });
    await user.click(combo);
    await user.type(combo, "Priya");

    // No comma in the match: the option's accessible name comes from its rendered text
    // nodes (name, role, and location, no separator between them), not from a hand-written
    // string — "Priya Nair" alone is enough to disambiguate it from the other nine.
    const option = await screen.findByRole("option", { name: /Priya Nair/ }, { timeout: 5000 });
    expect(option).toBeInTheDocument();
    expect(option).toHaveTextContent("PN");
    expect(option).toHaveTextContent("Priya Nair");
    expect(option).toHaveTextContent("Product Designer");
    // City — Country (timezone), the same format the "Add a time zone" search uses.
    expect(option).toHaveTextContent("Kolkata — India (IST / GMT+5:30)");
  });

  it("includes Arnold Beethoven, based in London, United Kingdom, in the colleague directory", async () => {
    const user = userEvent.setup();
    render(<MeetingScheduler />);

    const combo = screen.getByRole("combobox", { name: "Search for colleagues" });
    await user.click(combo);
    await user.type(combo, "Arnold");

    const option = await screen.findByRole("option", { name: /Arnold Beethoven/ }, { timeout: 5000 });
    expect(option).toHaveTextContent("AB");
    expect(option).toHaveTextContent("Lead Experience Designer");
    expect(option).toHaveTextContent("London — United Kingdom");
  });

  it("adds a participant chip with the colleague's avatar, name, city, country, and time", async () => {
    const user = userEvent.setup();
    render(<MeetingScheduler />);

    const combo = screen.getByRole("combobox", { name: "Search for colleagues" });
    await user.click(combo);
    await user.type(combo, "Priya");
    await user.click(await screen.findByRole("option", { name: /Priya Nair/ }, { timeout: 5000 }));
    // The open popover marks the rest of the page aria-hidden until dismissed — needed
    // before the next getByRole lookup can see the chip's remove button at all.
    await user.keyboard("{Escape}");

    const removeButton = await screen.findByRole("button", { name: "Remove Priya Nair" });
    const chip = removeButton.closest("li");
    expect(chip).toHaveTextContent("PN");
    expect(chip).toHaveTextContent("Priya Nair");
    // Includes the city, country, and current offset/abbreviation.
    expect(chip).toHaveTextContent(/Kolkata, India \(IST \/ GMT\+5:30\)/);
  });

  it("adds the selected colleague's time zone to the schedule", async () => {
    const user = userEvent.setup();
    render(<MeetingScheduler />);

    const combo = screen.getByRole("combobox", { name: "Search for colleagues" });
    await user.click(combo);
    await user.type(combo, "Priya");
    await user.click(await screen.findByRole("option", { name: /Priya Nair/ }, { timeout: 5000 }));

    // Kolkata now shows up as part of the schedule (e.g. the anchor-zone picker and the
    // time list below), just not as its own plain city chip — see the no-duplication test.
    expect((await screen.findAllByText(/Kolkata/)).length).toBeGreaterThan(0);
  });

  it("features the participant's name alongside their city and local time in the schedule cards", async () => {
    const user = userEvent.setup();
    render(<MeetingScheduler />);

    const combo = screen.getByRole("combobox", { name: "Search for colleagues" });
    await user.click(combo);
    await user.type(combo, "Priya");
    await user.click(await screen.findByRole("option", { name: /Priya Nair/ }, { timeout: 5000 }));

    // Matches only the schedule cards' "Priya Nair — Kolkata" name/city line, not the
    // participant chip's own similarly-prefixed "Priya Nair — Kolkata, India (IST / GMT+5:30)"
    // label — "Selected time" and "Best time for everyone" both render a ZoneTimeList,
    // so this is expected to show up exactly twice, in her own name, not as a bare city.
    // Name/city and the time range are separate lines now (see ZoneTimeList.tsx), so the
    // time is asserted on the enclosing list item rather than the same text node.
    const entries = await screen.findAllByText("Priya Nair — Kolkata");
    expect(entries).toHaveLength(2);
    entries.forEach((entry) => {
      expect(entry.closest("li")).toHaveTextContent(/\d\d:\d\d - \d\d:\d\d/);
    });
  });

  it("fills each participant's email into both invite buttons' platform links, not just the schedule cards", async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<MeetingScheduler />);

    await addColleague(user, "Priya");
    await addColleague(user, "Arnold");

    const inviteButtons = screen.getAllByRole("button", { name: /^Set up invite for/ });
    expect(inviteButtons).toHaveLength(2); // "Selected time" and "Best time for everyone"

    for (const button of inviteButtons) {
      await user.click(button);
      await user.click(await screen.findByRole("menuitem", { name: "Microsoft Outlook" }));
    }

    expect(openSpy).toHaveBeenCalledTimes(2);
    for (const call of openSpy.mock.calls) {
      const url = new URL(call[0] as string);
      const to = url.searchParams.get("to")!.split(";");
      expect(to).toContain("priya.nair@kestrelglobal.example");
      expect(to).toContain("arnold.beethoven@kestrelglobal.example");
    }
    openSpy.mockRestore();
  });

  it("doesn't also show a participant's city as a separate plain time zone chip", async () => {
    const user = userEvent.setup();
    render(<MeetingScheduler />);

    const combo = screen.getByRole("combobox", { name: "Search for colleagues" });
    await user.click(combo);
    await user.type(combo, "Priya");
    await user.click(await screen.findByRole("option", { name: /Priya Nair/ }, { timeout: 5000 }));
    await user.keyboard("{Escape}");
    await screen.findByRole("button", { name: "Remove Priya Nair" });

    expect(screen.queryByRole("button", { name: /^Remove Kolkata/ })).not.toBeInTheDocument();
  });

  it(
    "removes the participant and their time zone together",
    async () => {
      const user = userEvent.setup();
      render(<MeetingScheduler />);

      const combo = screen.getByRole("combobox", { name: "Search for colleagues" });
      await user.click(combo);
      await user.type(combo, "Priya");
      await user.click(await screen.findByRole("option", { name: /Priya Nair/ }, { timeout: 5000 }));
      await user.keyboard("{Escape}");
      await screen.findByRole("button", { name: "Remove Priya Nair" });

      await user.click(screen.getByRole("button", { name: "Remove Priya Nair" }));
      await user.keyboard("{Escape}");

      expect(screen.queryByRole("button", { name: "Remove Priya Nair" })).not.toBeInTheDocument();

      // Confirms the zone itself came out of the schedule, not just the chip: Kolkata is
      // only excluded from the time zone search's own results while it's still in `zones`
      // (see availableZones), so it reappearing there proves it's gone.
      await revealTimezoneSearch(user);
      const tzCombo = screen.getByRole("combobox", { name: "Add a time zone" });
      await user.click(tzCombo);
      await user.type(tzCombo, "Kolkata");
      expect(await screen.findByRole("option", { name: /^Kolkata — India/ }, { timeout: 5000 })).toBeInTheDocument();
    },
    10_000,
  );

  it("keeps the time zone search hidden behind an 'Add a time zone' button until clicked", async () => {
    const user = userEvent.setup();
    render(<MeetingScheduler />);

    expect(screen.queryByRole("combobox", { name: "Add a time zone" })).not.toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Add a time zone" });

    await user.click(button);

    expect(screen.getByRole("combobox", { name: "Add a time zone" })).toBeInTheDocument();
    // The reveal button did its job — no reason for it to still be sitting there once the
    // section it opens is already on screen.
    expect(screen.queryByRole("button", { name: "Add a time zone" })).not.toBeInTheDocument();
  });

  it("gives a plain time zone chip and a participant chip the same fixed height", async () => {
    // jsdom has no layout engine, so this asserts the structural CSS contract (both chips
    // share the same h-10) rather than measuring real pixels — verified live, with real
    // pixel measurements showing both chips at exactly 40px, in the browser.
    const user = userEvent.setup();
    render(<MeetingScheduler />);

    const combo = screen.getByRole("combobox", { name: "Search for colleagues" });
    await user.click(combo);
    await user.type(combo, "Priya");
    await user.click(await screen.findByRole("option", { name: /Priya Nair/ }, { timeout: 5000 }));
    await user.keyboard("{Escape}");

    await revealTimezoneSearch(user);
    const tzCombo = screen.getByRole("combobox", { name: "Add a time zone" });
    await user.click(tzCombo);
    await user.type(tzCombo, "Tokyo");
    await user.click(await screen.findByRole("option", { name: /^Tokyo — Japan/ }, { timeout: 5000 }));
    await user.keyboard("{Escape}");

    const participantChip = (await screen.findByRole("button", { name: "Remove Priya Nair" })).closest("li")
      ?.firstElementChild;
    const zoneChip = (await screen.findByRole("button", { name: /^Remove Tokyo/ })).closest("li")?.firstElementChild;
    expect(participantChip).toHaveClass("h-10");
    expect(zoneChip).toHaveClass("h-10");
  }, 10_000);
});

describe("MeetingScheduler — empty state", () => {
  it("shows no time zone chips by default, including no seeded default city", () => {
    render(<MeetingScheduler />);
    // No chip means no remove button for one — the only reliable signal a chip list is
    // actually empty, since an empty <ul> renders no visible text to query for.
    expect(screen.queryByRole("button", { name: /^Remove /i })).not.toBeInTheDocument();
    expect(screen.queryByText(/^London/)).not.toBeInTheDocument();
  });

  it("hides the invite buttons and shows a placeholder until a time zone is added", () => {
    render(<MeetingScheduler />);
    expect(screen.queryByRole("button", { name: /^Set up invite for/ })).not.toBeInTheDocument();
    expect(screen.getAllByText("Add a timezone to see local times").length).toBeGreaterThan(0);
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

    await revealTimezoneSearch(user);
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
    const user = userEvent.setup();
    render(<MeetingScheduler />);

    await revealTimezoneSearch(user);
    const combo = screen.getByRole("combobox", { name: "Add a time zone" });
    await user.click(combo);
    await user.type(combo, "BST");

    expect(await screen.findByRole("option", { name: /^Birmingham — United Kingdom/ }, { timeout: 5000 })).toBeInTheDocument();
  });

  it("still matches by city and country as before", async () => {
    const user = userEvent.setup();
    render(<MeetingScheduler />);

    await revealTimezoneSearch(user);
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

  it("gives the two Set up invite buttons distinct accessible names, even when their times coincide", async () => {
    const user = userEvent.setup();
    render(<MeetingScheduler />);
    // Deliberately NOT nudging the start time: the default Start time (09:00) coincides
    // with the Best-time suggestion for a single, host-only zone, so this is exactly the
    // case that used to produce two identically-named buttons. The labels must differ by
    // card context (selected vs. best-for-everyone) regardless of times.
    await addOneZone(user);

    const inviteButtons = screen.getAllByRole("button", { name: /^Set up invite for/ });
    expect(inviteButtons).toHaveLength(2);
    expect(inviteButtons[0]).toHaveAccessibleName(inviteButtons[0].getAttribute("aria-label") ?? "");
    expect(inviteButtons[0].getAttribute("aria-label")).not.toBe(inviteButtons[1].getAttribute("aria-label"));
    expect(inviteButtons[0]).toHaveAccessibleName(/your selected time/);
    expect(inviteButtons[1]).toHaveAccessibleName(/best time for everyone/);
  }, 10_000);
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

  it("associates both invite buttons with the shared note via aria-describedby", async () => {
    const user = userEvent.setup();
    render(<MeetingScheduler />);
    await addOneZone(user);

    const note = screen.getByText("Invites are set up through your own calendar/meeting app.");
    const noteId = note.getAttribute("id");
    expect(noteId).toBeTruthy();

    const inviteButtons = screen.getAllByRole("button", { name: /^Set up invite for/ });
    inviteButtons.forEach((button) => expect(button).toHaveAttribute("aria-describedby", noteId));
  }, 10_000);

  it("gives each invite button a decorative external-link icon that doesn't affect its accessible name", async () => {
    const user = userEvent.setup();
    render(<MeetingScheduler />);
    await addOneZone(user);

    const inviteButtons = screen.getAllByRole("button", { name: /^Set up invite for/ });
    inviteButtons.forEach((button) => {
      const icon = button.querySelector("svg");
      expect(icon).toHaveAttribute("aria-hidden", "true");
      // The aria-label (asserted elsewhere to be distinct/descriptive) is unaffected by
      // the icon's presence — accessible name computation skips aria-hidden content.
      expect(button).toHaveAccessibleName(button.getAttribute("aria-label") ?? "");
    });
  }, 10_000);

  it("keeps the invite button's position anchor fixed regardless of attendee count", async () => {
    // jsdom has no layout engine, so this asserts the structural CSS contract that
    // guarantees position-independence from content instead of measuring pixels
    // (verified live, with real pixel measurements showing zero drift, in the browser):
    // the button shares a flex row with the date heading, and that row is always the
    // first child of the card's content — laid out above the attendee list, not
    // shifted by (or narrowing) it, regardless of how many attendees are added.
    //
    // Three real type-search-select round trips against the full timezone catalog are
    // slow enough (especially under full-suite CPU contention) to need more than
    // vitest's default 5s test timeout.
    const user = userEvent.setup();
    render(<MeetingScheduler />);
    await addOneZone(user);

    const getAnchorClasses = () => {
      const button = screen.getAllByRole("button", { name: /^Set up invite for/ })[0];
      const headingRow = button.closest("[class*='justify-between']");
      const cardContent = headingRow?.parentElement;
      return {
        headingRowClass: headingRow?.className,
        isFirstChildOfCardContent: cardContent != null && cardContent.firstElementChild === headingRow,
      };
    };

    const withOneAttendee = getAnchorClasses();
    expect(withOneAttendee.headingRowClass).toMatch(/\bjustify-between\b/);
    expect(withOneAttendee.isFirstChildOfCardContent).toBe(true);

    // Anchored to the option label's full "City — Country" so a same-named city in a
    // different country (Sydney, Nova Scotia; Nishi-Tokyo-shi alongside Tokyo) — real
    // entries now that the catalog is ~26,000 GeoNames cities, not the old ~300-entry
    // one-city-per-zone seed — can't also match a loose substring search. The time zone
    // search is already revealed from addOneZone above, adding London as attendee #1.
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
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "privacy.html");
    expect(screen.getByRole("link", { name: "Terms of Use" })).toHaveAttribute("href", "terms.html");
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

  it(
    "shows 'Adjust time' before any nudge",
    async () => {
      const user = userEvent.setup();
      render(<MeetingScheduler />);
      await addOneZone(user);

      expect(screen.getByText("Adjust time")).toBeInTheDocument();
    },
    10_000,
  );

  it(
    "switches to a signed, zero-padded HH:MM offset after a single nudge",
    async () => {
      const user = userEvent.setup();
      render(<MeetingScheduler />);
      await addOneZone(user);

      await user.click(backButton());

      expect(screen.getByText("Adjusted -00:15")).toBeInTheDocument();
      expect(screen.queryByText("Adjust time")).not.toBeInTheDocument();
    },
    10_000,
  );

  it(
    "accumulates across repeated clicks and rolls the offset into the hour digit",
    async () => {
      const user = userEvent.setup();
      render(<MeetingScheduler />);
      await addOneZone(user);

      for (let i = 0; i < 5; i++) await user.click(backButton());

      expect(screen.getByText("Adjusted -01:15")).toBeInTheDocument();
    },
    10_000,
  );

  it(
    "supports the forward direction with a '+' sign",
    async () => {
      const user = userEvent.setup();
      render(<MeetingScheduler />);
      await addOneZone(user);

      await user.click(forwardButton());

      expect(screen.getByText("Adjusted +00:15")).toBeInTheDocument();
    },
    10_000,
  );

  it(
    "announces the adjustment via a polite live region",
    async () => {
      const user = userEvent.setup();
      render(<MeetingScheduler />);
      await addOneZone(user);

      await user.click(backButton());

      expect(screen.getByText(/^Best time adjusted to/)).toBeInTheDocument();
    },
    10_000,
  );

  it(
    "resets to 'Adjust time' when a timezone is added",
    async () => {
      const user = userEvent.setup();
      render(<MeetingScheduler />);
      await addOneZone(user);

      await user.click(backButton());
      expect(screen.getByText("Adjusted -00:15")).toBeInTheDocument();

      // Time zone search is already revealed from addOneZone above.
      const combo = screen.getByRole("combobox", { name: "Add a time zone" });
      await user.click(combo);
      await user.type(combo, "Tokyo");
      const option = await screen.findByRole("option", { name: /^Tokyo — Japan/ });
      await user.click(option);

      expect(screen.getByText("Adjust time")).toBeInTheDocument();
      expect(screen.queryByText(/^Adjusted/)).not.toBeInTheDocument();
    },
    10_000,
  );

  it(
    "resets when only the start time moves — duration (and so the computed best time) doesn't change, since the end time shifts to match it, but this is still an edit to the original settings",
    async () => {
      const user = userEvent.setup();
      render(<MeetingScheduler />);
      await addOneZone(user);

      await user.click(backButton());
      expect(screen.getByText("Adjusted -00:15")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /Increase start time by 15 minutes/ }));

      expect(screen.getByText("Adjust time")).toBeInTheDocument();
    },
    10_000,
  );

  it(
    "resets when the end time (duration) changes",
    async () => {
      const user = userEvent.setup();
      render(<MeetingScheduler />);
      await addOneZone(user);

      await user.click(backButton());
      expect(screen.getByText("Adjusted -00:15")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /Increase end time by 15 minutes/ }));

      expect(screen.getByText("Adjust time")).toBeInTheDocument();
    },
    10_000,
  );
});

describe("MeetingScheduler — holiday and outside-hours in the schedule cards", () => {
  it(
    "flags a participant on holiday today in Selected time, and moves Best time for everyone off that date",
    async () => {
      const user = userEvent.setup();
      render(<MeetingScheduler />);
      await addColleague(user, "Sofia Bergström");

      // Exactly one holiday flag: "Selected time" stays pinned to today (Sofia's really
      // away that day), while "Best time for everyone" has already moved off it — so her
      // holiday only needs explaining in the first card, not the second.
      expect(await screen.findAllByText("On holiday")).toHaveLength(1);
      expect(screen.getByText(/^Suggested — Sofia's back/)).toBeInTheDocument();
    },
    10_000,
  );

  it(
    "doesn't show a Suggested label or move the date when nobody's on holiday",
    async () => {
      const user = userEvent.setup();
      const { container } = render(<MeetingScheduler />);
      await addColleague(user, "Arnold Beethoven");

      await screen.findAllByText(/Arnold Beethoven/);
      expect(screen.queryByText(/^Suggested/)).not.toBeInTheDocument();

      // The two schedule cards' own date headings specifically — distinct from the Date
      // field button above them, which shows the same-looking text for a different
      // reason. Both read identically when nothing forces Best time to move off Selected.
      const dateHeadings = Array.from(container.querySelectorAll("span.font-bold"));
      expect(dateHeadings).toHaveLength(2);
      expect(dateHeadings[0].textContent).toBe(dateHeadings[1].textContent);
    },
    10_000,
  );

  it(
    "flags a schedule-card slot that falls outside a real colleague's declared hours",
    async () => {
      const user = userEvent.setup();
      render(<MeetingScheduler />);
      await addColleague(user, "Arnold Beethoven");
      await addColleague(user, "Zoe Fitzgerald");

      // London and Sydney are 9-10 hours apart — wide enough that no single slot fits
      // both people's declared hours, so at least one "Outside hours" flag has to show up
      // somewhere on the page (Selected time, Best time for everyone, or both).
      expect((await screen.findAllByText(/Outside/, {}, { timeout: 5000 })).length).toBeGreaterThan(0);
    },
    10_000,
  );
});
