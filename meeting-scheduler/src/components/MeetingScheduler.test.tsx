import { render, screen } from "@testing-library/react";
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
