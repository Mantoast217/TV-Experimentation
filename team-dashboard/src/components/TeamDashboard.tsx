import { Button, Input } from "@heroui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  arrange,
  describePeople,
  STATUS_ORDER,
  type SortDirection,
  type SortKey,
  type StatusFilter,
} from "../lib/team/arrange";
import {
  asOfText,
  emptyStateText,
  resultsText,
  selectionText,
  sortAnnouncement,
  STATUS_LABEL,
  STATUS_MARKER,
  summaryItem,
} from "../lib/team/copy";
import { countByStatus, type Person } from "../lib/time";
import { HAND_OFF_TITLE, HandOff } from "./HandOff";
import { PeopleCards } from "./PeopleCards";
import { PeopleTable } from "./PeopleTable";
import { PersonDialog } from "./PersonDialog";
import type { RowActions } from "./rowActions";
import { SelectionBar } from "./SelectionBar";
import { TimelineView } from "./TimelineView";
import { focusRing, secondaryText, selectClass } from "./styles";

const PAGE_TITLE = "Team dashboard";

type View = "list" | "timeline";

const VIEW_OPTIONS: { value: View; label: string }[] = [
  { value: "list", label: "List" },
  { value: "timeline", label: "Timeline" },
];

interface Sort {
  key: SortKey;
  direction: SortDirection;
}

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "timeZone:ascending", label: "Time zone, west to east" },
  { value: "timeZone:descending", label: "Time zone, east to west" },
  { value: "localTime:ascending", label: "Local time, earliest first" },
  { value: "localTime:descending", label: "Local time, latest first" },
  { value: "name:ascending", label: "Name, A to Z" },
  { value: "name:descending", label: "Name, Z to A" },
];

interface TeamDashboardProps {
  people: readonly Person[];
  /** Read once by the caller. The page never updates by itself. */
  now: Date;
  viewerZone: string;
  /** Called with the selected people, in team order, when someone chooses "Find a meeting time". */
  onFindTime?: (selectedPeople: Person[]) => void;
}

export function TeamDashboard({ people, now, viewerZone, onFindTime }: TeamDashboardProps) {
  const views = useMemo(() => describePeople(people, now, viewerZone), [people, now, viewerZone]);
  const counts = useMemo(() => countByStatus(people, now), [people, now]);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<Sort>({ key: "timeZone", direction: "ascending" });
  const [sortMessage, setSortMessage] = useState("");
  const [view, setView] = useState<View>("list");
  const searchRef = useRef<HTMLInputElement>(null);

  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [selectionMessage, setSelectionMessage] = useState("");
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [step, setStep] = useState<"dashboard" | "handOff">("dashboard");
  const findTimeRef = useRef<HTMLButtonElement>(null);
  const returnFocusToFindTime = useRef(false);

  const selectedPeople = people.filter((person) => selected.has(person.id));

  const toggleSelected = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    setSelectionMessage(selectionText(next.size));
  };

  const actions: RowActions = {
    isSelected: (id) => selected.has(id),
    toggleSelected,
    openDetails: (person) => setDetailsId(person.id),
  };

  const findTime = () => {
    setStep("handOff");
    onFindTime?.(selectedPeople);
  };

  const backToDashboard = () => {
    returnFocusToFindTime.current = true;
    setStep("dashboard");
  };

  useEffect(() => {
    document.title = step === "handOff" ? HAND_OFF_TITLE : PAGE_TITLE;
    if (step === "dashboard" && returnFocusToFindTime.current) {
      returnFocusToFindTime.current = false;
      findTimeRef.current?.focus();
    }
  }, [step]);

  const { groups, shown } = arrange(views, { query, status, sortKey: sort.key, direction: sort.direction });

  const changeSort = (next: Sort) => {
    setSort(next);
    setSortMessage(sortAnnouncement(next.key, next.direction));
  };

  const sortByColumn = (key: SortKey) =>
    changeSort({
      key,
      direction: sort.key === key && sort.direction === "ascending" ? "descending" : "ascending",
    });

  // The button that called this disappears once results return, so focus goes back to the search box.
  const clearSearchAndFilters = () => {
    setQuery("");
    setStatus("all");
    searchRef.current?.focus();
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className={`sr-only rounded-md bg-[var(--background)] px-4 py-3 font-medium focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 ${focusRing}`}
      >
        Skip to main content
      </a>
      <header className="flex justify-center px-6 pt-8">
        <div className="w-full max-w-[1040px]">
          <a href="/enhanced-meeting-scheduler/" className={`inline-flex min-h-6 items-center text-sm ${secondaryText} hover:underline ${focusRing}`}>
            ← Back to Enhanced Meeting Scheduler
          </a>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="flex flex-1 justify-center px-6 pt-6 pb-12 outline-none">
        <div className="flex w-full max-w-[1040px] flex-col gap-8">
          {step === "handOff" ? (
            <HandOff people={selectedPeople} onBack={backToDashboard} />
          ) : (
          <>
          <div className="flex flex-col gap-2">
            <h1 className="m-0 text-xl font-medium">Team dashboard</h1>
            <p className={`m-0 text-sm ${secondaryText}`}>
              {asOfText(now, viewerZone)} Reload the page to update them.
            </p>
          </div>

          <section aria-labelledby="summary-heading" className="flex flex-col gap-3">
            <h2 id="summary-heading" className="m-0 text-base font-medium">
              Summary
            </h2>
            <ul className="m-0 flex list-none flex-wrap gap-3 p-0 text-sm">
              {STATUS_ORDER.map((s) => (
                <li key={s} className="flex items-center gap-2 rounded-lg border border-[var(--control-border)] px-4 py-3">
                  <span aria-hidden="true">{STATUS_MARKER[s]}</span>
                  {summaryItem(s, counts[s])}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="team-heading" className="flex flex-col gap-4">
            <h2 id="team-heading" className="m-0 text-base font-medium">
              Kestrel Global team
            </h2>

            <form role="search" aria-label="Filter and sort the team" onSubmit={(e) => e.preventDefault()} className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col justify-end gap-1.5">
                <label htmlFor="team-search" className="text-sm font-medium">
                  Search by name, role, city, country or time zone
                </label>
                <p id="team-search-hint" className={`m-0 text-sm ${secondaryText}`}>
                  For example, Tokyo, Japan, JST or UTC+9
                </p>
                <Input
                  ref={searchRef}
                  id="team-search"
                  type="search"
                  aria-describedby="team-search-hint"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className={`min-h-11 border border-[var(--control-border)] ${focusRing}`}
                />
              </div>
              <div className="flex flex-col justify-end gap-1.5">
                <label htmlFor="team-status" className="text-sm font-medium">
                  Status
                </label>
                <select
                  id="team-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as StatusFilter)}
                  className={selectClass}
                >
                  <option value="all">All statuses</option>
                  {STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col justify-end gap-1.5">
                <label htmlFor="team-sort" className="text-sm font-medium">
                  Sort by
                </label>
                <select
                  id="team-sort"
                  value={`${sort.key}:${sort.direction}`}
                  onChange={(e) => {
                    const [key, direction] = e.target.value.split(":") as [SortKey, SortDirection];
                    changeSort({ key, direction });
                  }}
                  className={selectClass}
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </form>

            <fieldset className="m-0 flex flex-wrap items-center gap-3 border-0 p-0">
              <legend className="mb-1.5 p-0 text-sm font-medium">View</legend>
              {VIEW_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-[var(--control-border)] px-4 text-sm has-[:checked]:font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--brand-blue)] has-[:focus-visible]:outline-solid"
                >
                  <input
                    type="radio"
                    name="team-view"
                    value={option.value}
                    checked={view === option.value}
                    onChange={() => setView(option.value)}
                    className="h-4 w-4 accent-[var(--brand-blue)] outline-none"
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>

            <p role="status" className={`m-0 text-sm ${secondaryText}`}>
              {resultsText(shown, people.length)}
            </p>
            <p role="status" className="sr-only">
              {sortMessage}
            </p>

            {shown === 0 ? (
              <div className="flex flex-col items-start gap-3 rounded-lg border border-[var(--control-border)] p-6">
                <p className="m-0">{emptyStateText(query)}</p>
                <Button variant="outline" className={`min-h-11 border-[var(--control-border)] ${focusRing}`} onPress={clearSearchAndFilters}>
                  Clear search and filters
                </Button>
              </div>
            ) : view === "timeline" ? (
              <TimelineView groups={groups} now={now} viewerZone={viewerZone} actions={actions} />
            ) : (
              <>
                <div className="max-[760px]:hidden">
                  <PeopleTable groups={groups} sort={sort} onSort={sortByColumn} actions={actions} />
                </div>
                <div className="min-[761px]:hidden">
                  <PeopleCards groups={groups} actions={actions} />
                </div>
              </>
            )}
          </section>
          </>
          )}
          <p role="status" className="sr-only">
            {selectionMessage}
          </p>
        </div>
      </main>

      {step === "dashboard" && selected.size > 0 && (
        <SelectionBar ref={findTimeRef} count={selected.size} onFindTime={findTime} />
      )}
      <PersonDialog
        view={views.find((v) => v.person.id === detailsId) ?? null}
        now={now}
        viewerZone={viewerZone}
        isSelected={detailsId !== null && selected.has(detailsId)}
        selectedCount={selected.size}
        onToggleSelected={() => detailsId && toggleSelected(detailsId)}
        onClose={() => setDetailsId(null)}
      />

      <footer className="flex justify-center px-6 pb-[calc(2rem+var(--sticky-bottom-space,0px))]">
        <p className={`m-0 w-full max-w-[1040px] text-xs ${secondaryText}`}>
          Kestrel Global is a fictional company. Everyone shown here is sample data.
        </p>
      </footer>
    </div>
  );
}
