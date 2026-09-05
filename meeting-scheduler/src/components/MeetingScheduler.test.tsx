import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
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

describe("MeetingScheduler — accessibility punch list", () => {
  it("gives the Start time, End time, and Duration labels the 4.5:1-contrast grey", () => {
    render(<MeetingScheduler />);
    expect(screen.getByText("Start time")).toHaveClass("text-[#515158]");
    expect(screen.getByText("End time")).toHaveClass("text-[#515158]");
    expect(screen.getByText("Duration", { selector: "span" })).toHaveClass("text-[#515158]");
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
    expect(screen.getAllByText("Invites are set up through your own calendar app.")).toHaveLength(1);
  });

  it("no longer renders the old per-card caption", () => {
    render(<MeetingScheduler />);
    expect(screen.queryByText("Choose a calendar app, then send it from there")).not.toBeInTheDocument();
  });

  it("associates both invite buttons with the shared note via aria-describedby", () => {
    render(<MeetingScheduler />);
    const note = screen.getByText("Invites are set up through your own calendar app.");
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

    const combo = screen.getByRole("combobox", { name: "Add timezone" });
    for (const city of ["Tokyo", "Sydney", "New York"]) {
      await user.click(combo);
      await user.clear(combo);
      await user.type(combo, city);
      const option = await screen.findByRole("option", { name: new RegExp(city) });
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

  it("has a Feedback link (placeholder — no destination set yet)", () => {
    // Queried by tag/text rather than role="link": jsdom's accessibility-tree
    // computation doesn't expose an empty-string href as a link (real browsers do —
    // confirmed live in Chromium), the same category of jsdom/real-browser divergence
    // as the list-none role-stripping issue found earlier in this project.
    render(<MeetingScheduler />);
    const feedback = screen.getByText("Feedback");
    expect(feedback.tagName).toBe("A");
    expect(feedback).toHaveAttribute("href");
  });
});
