import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { KESTREL_GLOBAL } from "../data/kestrelGlobal";
import { TeamDashboard } from "./TeamDashboard";

const NOW = new Date("2026-10-16T13:00:00Z");

function renderDashboard() {
  return render(<TeamDashboard people={KESTREL_GLOBAL} now={NOW} viewerZone="Europe/London" />);
}

const table = () => screen.getByRole("table", { name: "Kestrel Global team, grouped by status" });
const columnHeader = (name: string) => within(table()).getByRole("columnheader", { name: new RegExp(`^${name}`) });
// Group headings are row headers too (scope="rowgroup"), so only take the per-person ones.
const rowNames = () => [...table().querySelectorAll('th[scope="row"]')].map((cell) => cell.textContent);

describe("TeamDashboard list view", () => {
  it("shows the page heading, the time it was read and whole-team counts", () => {
    renderDashboard();
    expect(screen.getByRole("heading", { level: 1, name: "Team dashboard" })).toBeInTheDocument();
    expect(screen.getByText(/Times are for 14:00 on Friday 16 October 2026 in your time zone \(Europe\/London\)/)).toBeInTheDocument();
    const summary = screen.getByRole("region", { name: "Summary" });
    expect(within(summary).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "●5 working now",
      "◐5 outside working hours",
      "○1 on holiday",
    ]);
  });

  it("groups the table into one row group per status, each starting with a heading", () => {
    renderDashboard();
    const groupHeadings = within(table()).getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(groupHeadings).toEqual(["●Working now (5)", "◐Outside working hours (5)", "○On holiday (1)"]);
    expect(table().querySelectorAll("tbody")).toHaveLength(3);
  });

  it("uses names as row headers and keeps status as text on every row", () => {
    renderDashboard();
    expect(rowNames()).toHaveLength(11);
    const zoe = within(table()).getByRole("rowheader", { name: "Zoe Fitzgerald" }).closest("tr")!;
    expect(zoe).toHaveTextContent("00:00");
    expect(zoe).toHaveTextContent("Saturday, 1 day ahead");
    expect(zoe).toHaveTextContent("23:00–07:00 your time, ends next day");
    expect(zoe).toHaveTextContent("Outside working hours");
    const liam = within(table()).getByRole("rowheader", { name: "Liam Sinclair" }).closest("tr")!;
    expect(liam).toHaveTextContent("On holiday");
    expect(liam).toHaveTextContent("Back on Monday 26 October");
  });

  it("sorts within each group from the column headers and announces the result", async () => {
    const user = userEvent.setup();
    renderDashboard();
    expect(columnHeader("Time zone")).toHaveAttribute("aria-sort", "ascending");
    expect(columnHeader("Name")).toHaveAttribute("aria-sort", "none");

    await user.click(within(columnHeader("Name")).getByRole("button"));
    expect(columnHeader("Name")).toHaveAttribute("aria-sort", "ascending");
    expect(columnHeader("Time zone")).toHaveAttribute("aria-sort", "none");
    expect(rowNames().slice(0, 5)).toEqual(["Amara Okafor", "Arnold Beethoven", "Diego Fernández", "Ethan Walker", "Sofia Bergström"]);
    expect(screen.getByText("Sorted by name, A to Z.")).toHaveAttribute("role", "status");

    await user.click(within(columnHeader("Name")).getByRole("button"));
    expect(columnHeader("Name")).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByText("Sorted by name, Z to A.")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Sort by" })).toHaveValue("name:descending");
  });

  it("sorts from the Sort by menu, which also works on narrow screens", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.selectOptions(screen.getByRole("combobox", { name: "Sort by" }), "localTime:ascending");
    expect(columnHeader("Local time")).toHaveAttribute("aria-sort", "ascending");
    expect(screen.getByText("Sorted by local time, earliest first.")).toBeInTheDocument();
  });

  it("searches by name, role or city and says how many are shown", async () => {
    const user = userEvent.setup();
    renderDashboard();
    expect(screen.getByText("Showing 11 of 11 people")).toHaveAttribute("role", "status");
    await user.type(screen.getByRole("searchbox", { name: "Search by name, role, city, country or time zone" }), "tokyo");
    expect(screen.getByText("Showing 1 of 11 people")).toBeInTheDocument();
    expect(rowNames()).toEqual(["Hana Kobayashi"]);
  });

  it("searches by country and time zone too, and explains how in a hint", async () => {
    const user = userEvent.setup();
    renderDashboard();
    const search = screen.getByRole("searchbox", { name: "Search by name, role, city, country or time zone" });
    expect(search).toHaveAccessibleDescription("For example, Tokyo, Japan, JST or UTC+9");
    await user.type(search, "united states");
    expect(rowNames()).toEqual(["Ethan Walker", "Noah Bergman"]);
    await user.clear(search);
    await user.type(search, "aedt");
    expect(rowNames()).toEqual(["Zoe Fitzgerald"]);
    await user.clear(search);
    await user.type(search, "UTC+5:30");
    expect(rowNames()).toEqual(["Priya Nair"]);
  });

  it("filters by status", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.selectOptions(screen.getByRole("combobox", { name: "Status" }), "holiday");
    expect(rowNames()).toEqual(["Liam Sinclair"]);
    expect(screen.getByText("Showing 1 of 11 people")).toBeInTheDocument();
  });

  it("shows grouped cards for narrow screens with the same people and order", () => {
    renderDashboard();
    const cards = screen.getAllByRole("listitem").filter((li) => li.closest("ul")?.closest("section")?.getAttribute("aria-labelledby")?.startsWith("cards-"));
    expect(cards.map((card) => within(card).getByRole("heading", { level: 4 }).textContent)).toEqual(rowNames());
  });

  it("has no axe violations", async () => {
    const { container } = renderDashboard();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("TeamDashboard empty state", () => {
  it("names the search, offers to clear it and returns focus to the search box", async () => {
    const user = userEvent.setup();
    renderDashboard();
    const search = screen.getByRole("searchbox", { name: "Search by name, role, city, country or time zone" });
    await user.type(search, "zzz");
    await user.selectOptions(screen.getByRole("combobox", { name: "Status" }), "working");

    expect(screen.getByText("No people match “zzz”.")).toBeInTheDocument();
    expect(screen.getByText("Showing 0 of 11 people")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear search and filters" }));
    expect(search).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Status" })).toHaveValue("all");
    expect(search).toHaveFocus();
    expect(screen.getByText("Showing 11 of 11 people")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const user = userEvent.setup();
    const { container } = renderDashboard();
    await user.type(screen.getByRole("searchbox", { name: "Search by name, role, city, country or time zone" }), "zzz");
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("TeamDashboard timeline view", () => {
  async function renderTimeline() {
    const user = userEvent.setup();
    const result = renderDashboard();
    await user.click(screen.getByRole("radio", { name: "Timeline" }));
    return { user, ...result };
  }

  it("switches views with radio buttons in a fieldset with a legend", async () => {
    await renderTimeline();
    expect(screen.getByRole("group", { name: "View" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Timeline" })).toBeChecked();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: /^Timeline/ })).toHaveAttribute("tabindex", "0");
  });

  it("names the best hours in a sentence", async () => {
    await renderTimeline();
    expect(
      screen.getByText(
        "The best hours to meet are 09:00–10:00, 14:00–15:00 and 16:00–17:00 your time, when 5 of 10 available people are working.",
      ),
    ).toBeInTheDocument();
  });

  it("prints each person's working hours as text and hides the chart from screen readers", async () => {
    await renderTimeline();
    const timeline = screen.getByRole("region", { name: /^Timeline/ });
    const hana = within(timeline).getByRole("heading", { level: 4, name: "Hana Kobayashi" }).closest("li")!;
    expect(hana).toHaveTextContent("Working hours: 09:00–18:00 local, 01:00–10:00 your time");
    expect(hana).toHaveTextContent("Outside working hours");
    // Everything in the row apart from the text column is the chart.
    const [, chart] = [...hana.children];
    expect(chart).toHaveAttribute("aria-hidden", "true");
    expect(within(timeline).getAllByRole("heading", { level: 4 })).toHaveLength(11);
  });

  it("applies the same search, filter and sort, and recounts the overlap for the people shown", async () => {
    const { user } = await renderTimeline();
    await user.selectOptions(screen.getByRole("combobox", { name: "Status" }), "holiday");
    const timeline = screen.getByRole("region", { name: /^Timeline/ });
    expect(within(timeline).getAllByRole("heading", { level: 4 }).map((h) => h.textContent)).toEqual(["Liam Sinclair"]);
    expect(screen.getByText("No one shown is available today.")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = await renderTimeline();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("TeamDashboard selection and hand-off", () => {
  const checkbox = (name: string) => within(table()).getByRole("checkbox", { name: `Select ${name}` });

  it("shows a sticky bar with the count once someone is selected, and announces each change", async () => {
    const user = userEvent.setup();
    renderDashboard();
    expect(screen.queryByRole("region", { name: "Selected people" })).not.toBeInTheDocument();

    await user.click(checkbox("Hana Kobayashi"));
    await user.click(checkbox("Arnold Beethoven"));
    const bar = screen.getByRole("region", { name: "Selected people" });
    expect(bar).toHaveTextContent("2 people selected");
    expect(within(bar).getByRole("button", { name: "Find a meeting time" })).toBeInTheDocument();
    expect(screen.getAllByText("2 people selected").some((el) => el.getAttribute("role") === "status")).toBe(true);

    await user.click(checkbox("Hana Kobayashi"));
    await user.click(checkbox("Arnold Beethoven"));
    expect(screen.queryByRole("region", { name: "Selected people" })).not.toBeInTheDocument();
    expect(screen.getByText("No one selected")).toHaveAttribute("role", "status");
  });

  it("keeps selections while searching, and in the timeline", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.click(checkbox("Zoe Fitzgerald"));
    await user.type(screen.getByRole("searchbox", { name: "Search by name, role, city, country or time zone" }), "tokyo");
    expect(screen.getByRole("region", { name: "Selected people" })).toHaveTextContent("1 person selected");
    await user.clear(screen.getByRole("searchbox", { name: "Search by name, role, city, country or time zone" }));
    await user.click(screen.getByRole("radio", { name: "Timeline" }));
    const timeline = screen.getByRole("region", { name: /^Timeline/ });
    expect(within(timeline).getByRole("checkbox", { name: "Select Zoe Fitzgerald" })).toBeChecked();
  });

  it("hands the selected people to onFindTime, moves focus to the heading and back again", async () => {
    const user = userEvent.setup();
    const onFindTime = vi.fn();
    render(<TeamDashboard people={KESTREL_GLOBAL} now={NOW} viewerZone="Europe/London" onFindTime={onFindTime} />);
    // Selected out of team order; the hand-off lists them in team order.
    await user.click(checkbox("Zoe Fitzgerald"));
    await user.click(checkbox("Amara Okafor"));
    await user.click(screen.getByRole("button", { name: "Find a meeting time" }));

    expect(onFindTime).toHaveBeenCalledWith([KESTREL_GLOBAL[0], KESTREL_GLOBAL[7]]);
    const heading = screen.getByRole("heading", { level: 1, name: "Find a meeting time" });
    expect(heading).toHaveFocus();
    expect(document.title).toBe("Find a meeting time – Team dashboard");
    expect(screen.getByText("Amara Okafor")).toBeInTheDocument();
    expect(screen.getByText("Zoe Fitzgerald")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(document.title).toBe("Team dashboard");
    expect(screen.getByRole("button", { name: "Find a meeting time" })).toHaveFocus();
    expect(checkbox("Zoe Fitzgerald")).toBeChecked();
  });

  it("has no axe violations on the hand-off step", async () => {
    const user = userEvent.setup();
    const { container } = renderDashboard();
    await user.click(checkbox("Hana Kobayashi"));
    await user.click(screen.getByRole("button", { name: "Find a meeting time" }));
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("TeamDashboard person details", () => {
  async function openDetails(name: string) {
    const user = userEvent.setup();
    renderDashboard();
    const trigger = within(table()).getByRole("button", { name });
    await user.click(trigger);
    return { user, trigger, dialog: await screen.findByRole("dialog", { name }) };
  }

  it("shows the next working time, time off and email", async () => {
    const { dialog } = await openDetails("Zoe Fitzgerald");
    expect(dialog).toHaveTextContent("00:00 Saturday, 1 day ahead (UTC+11)");
    expect(dialog).toHaveTextContent("Next working time");
    expect(dialog).toHaveTextContent("Monday 19 October, 09:00–17:00 local");
    expect(dialog).toHaveTextContent("Sunday 18 October 23:00 to Monday 19 October 07:00 your time");
    expect(dialog).toHaveTextContent("No time off booked");
    expect(dialog).toHaveTextContent("zoe.fitzgerald@kestrelglobal.example");
  });

  it("says how long someone working now is working for, and lists their upcoming time off", async () => {
    const { dialog } = await openDetails("Sofia Bergström");
    expect(dialog).toHaveTextContent("Working until");
    expect(dialog).toHaveTextContent("Friday 16 October, 16:00 local");
    expect(dialog).toHaveTextContent("Friday 16 October, 15:00 your time");
    expect(dialog).toHaveTextContent("2 to 6 November 2026");
  });

  it("closes with Esc and returns focus to the name button", async () => {
    const { user, trigger } = await openDetails("Hana Kobayashi");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // React Aria restores focus on the next animation frame.
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("adds the person to the meeting", async () => {
    const { user, dialog } = await openDetails("Hana Kobayashi");
    await user.click(within(dialog).getByRole("button", { name: "Add to meeting" }));
    expect(within(dialog).getByRole("button", { name: "Remove from meeting" })).toBeInTheDocument();
    // The page behind is hidden from assistive technology, so the dialog announces it.
    expect(within(dialog).getByRole("status")).toHaveTextContent("Added to the meeting. 1 person selected.");

    await user.click(within(dialog).getByRole("button", { name: "Remove from meeting" }));
    expect(within(dialog).getByRole("status")).toHaveTextContent("Removed from the meeting. No one selected.");
    await user.click(within(dialog).getByRole("button", { name: "Add to meeting" }));
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.getByRole("region", { name: "Selected people" })).toHaveTextContent("1 person selected");
  });

  it("says when the email address was copied", async () => {
    const { user, dialog } = await openDetails("Hana Kobayashi");
    await user.click(within(dialog).getByRole("button", { name: "Copy email" }));
    expect(within(dialog).getByRole("status")).toHaveTextContent("Email address copied.");
    expect(await navigator.clipboard.readText()).toBe("hana.kobayashi@kestrelglobal.example");
  });

  it("says when copying fails, without throwing", async () => {
    const { user, dialog } = await openDetails("Hana Kobayashi");
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("Denied"));
    await user.click(within(dialog).getByRole("button", { name: "Copy email" }));
    expect(within(dialog).getByRole("status")).toHaveTextContent(
      "Could not copy the email address. Select it and copy it yourself.",
    );
  });

  it("has no axe violations with the dialog open", async () => {
    await openDetails("Liam Sinclair");
    expect(await axe(document.body)).toHaveNoViolations();
  });
});
