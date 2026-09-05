import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { TimePickerField } from "./TimePickerField";

/** Mirrors how MeetingScheduler wires the field: controlled value + onChange. */
function Harness({ initialValue, stepMinutes }: { initialValue: string; stepMinutes?: number }) {
  const [value, setValue] = useState(initialValue);
  return (
    <div>
      <input aria-label="Somewhere else" />
      <TimePickerField value={value} onChange={setValue} stepMinutes={stepMinutes} aria-label="Start time" />
    </div>
  );
}

function field() {
  return screen.getByRole("combobox", { name: "Start time" });
}

function decreaseButton() {
  return screen.getByRole("button", { name: /^Decrease time by/ });
}

function increaseButton() {
  return screen.getByRole("button", { name: /^Increase time by/ });
}

describe("TimePickerField", () => {
  it("steps the value down and up by the configured increment", async () => {
    const user = userEvent.setup();
    render(<Harness initialValue="16:00" />);

    await user.click(decreaseButton());
    expect(field()).toHaveValue("15:45");

    await user.click(decreaseButton());
    await user.click(decreaseButton());
    expect(field()).toHaveValue("15:15");

    await user.click(increaseButton());
    expect(field()).toHaveValue("15:30");
  });

  it("wraps past midnight in both directions", async () => {
    const user = userEvent.setup();
    render(<Harness initialValue="00:00" />);

    await user.click(decreaseButton());
    expect(field()).toHaveValue("23:45");

    await user.click(increaseButton());
    expect(field()).toHaveValue("00:00");
  });

  it("respects a custom step size", async () => {
    const user = userEvent.setup();
    render(<Harness initialValue="09:00" stepMinutes={30} />);

    await user.click(increaseButton());
    expect(field()).toHaveValue("09:30");
  });

  it("accepts a typed exact time that doesn't fall on a step boundary, committing on blur", async () => {
    const user = userEvent.setup();
    render(<Harness initialValue="16:00" />);

    await user.clear(field());
    await user.type(field(), "17:22");
    await user.click(screen.getByLabelText("Somewhere else"));

    expect(field()).toHaveValue("17:22");
  });

  it("accepts a typed exact time on Enter without needing blur", async () => {
    const user = userEvent.setup();
    render(<Harness initialValue="16:00" />);

    await user.clear(field());
    await user.type(field(), "9:05");
    await user.keyboard("{Enter}");

    expect(field()).toHaveValue("09:05");
  });

  it("reverts to the last committed value when the typed text isn't a valid time", async () => {
    const user = userEvent.setup();
    render(<Harness initialValue="16:00" />);

    await user.clear(field());
    await user.type(field(), "not a time");
    await user.click(screen.getByLabelText("Somewhere else"));

    expect(field()).toHaveValue("16:00");
  });

  it("selects a preset from the dropdown, highlighted and matching the current value on open", async () => {
    const user = userEvent.setup();
    render(<Harness initialValue="16:00" />);

    await user.click(field());
    const options = await screen.findAllByRole("option");
    expect(options.length).toBeGreaterThan(1);

    const current = options.find((o) => o.getAttribute("aria-selected") === "true");
    expect(current).toHaveTextContent("16:00");

    await user.click(screen.getByRole("option", { name: "16:30" }));

    await waitFor(() => expect(field()).toHaveValue("16:30"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("supports keyboard-only end-to-end operation: reach it via Tab, open with ArrowDown, navigate, and commit with Enter", async () => {
    const user = userEvent.setup();
    render(<Harness initialValue="16:00" />);

    await user.tab(); // "Somewhere else" input
    await user.tab(); // the field itself (visually first, left-aligned, ahead of the grouped arrows)
    expect(field()).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    await screen.findByRole("listbox");

    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");

    // ArrowDown-to-open also moves focus onto an item, so both key presses above
    // navigate — the committed value ends up two steps on from the initial 16:00.
    await waitFor(() => expect(field()).toHaveValue("16:30"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(field()).toHaveFocus();

    await user.tab(); // decrease button (arrows are grouped together after the field)
    expect(decreaseButton()).toHaveFocus();

    await user.tab(); // increase button
    expect(increaseButton()).toHaveFocus();
  });

  it("closes the dropdown on Escape and returns focus to the field", async () => {
    const user = userEvent.setup();
    render(<Harness initialValue="16:00" />);

    field().focus();
    await user.keyboard("{ArrowDown}");
    await screen.findByRole("listbox");

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(field()).toHaveFocus();
  });

  it("gives the step buttons a 24x24 minimum hit area and a value-describing accessible name", () => {
    render(<Harness initialValue="16:00" />);

    expect(decreaseButton()).toHaveAccessibleName("Decrease time by 15 minutes, currently 16:00");
    expect(increaseButton()).toHaveAccessibleName("Increase time by 15 minutes, currently 16:00");
    expect(decreaseButton()).toHaveClass("h-6", "w-6");
    expect(increaseButton()).toHaveClass("h-6", "w-6");
  });

  it("has no axe-detectable accessibility violations", async () => {
    const { container } = render(<Harness initialValue="16:00" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
