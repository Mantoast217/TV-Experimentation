import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
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
    await user.type(screen.getByRole("searchbox", { name: "Search by name, role or city" }), "tokyo");
    expect(screen.getByText("Showing 1 of 11 people")).toBeInTheDocument();
    expect(rowNames()).toEqual(["Hana Kobayashi"]);
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
    const search = screen.getByRole("searchbox", { name: "Search by name, role or city" });
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
    await user.type(screen.getByRole("searchbox", { name: "Search by name, role or city" }), "zzz");
    expect(await axe(container)).toHaveNoViolations();
  });
});
