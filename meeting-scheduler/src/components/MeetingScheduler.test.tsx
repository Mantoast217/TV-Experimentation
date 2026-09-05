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

  it("gives the two Create invite buttons distinct accessible names including their date/time", async () => {
    const user = userEvent.setup();
    render(<MeetingScheduler />);
    // Default Start time (09:00) coincides with the default Best-time suggestion for a
    // single, host-only zone, so nudge Start time away from it to exercise the general
    // case where the Selected time and Best time differ.
    await user.click(screen.getByRole("button", { name: /^Increase start time by/ }));

    const inviteButtons = screen.getAllByRole("button", { name: /^Create invite for/ });
    expect(inviteButtons).toHaveLength(2);
    expect(inviteButtons[0]).toHaveAccessibleName(inviteButtons[0].getAttribute("aria-label") ?? "");
    expect(inviteButtons[0].getAttribute("aria-label")).not.toBe(inviteButtons[1].getAttribute("aria-label"));
  });
});
