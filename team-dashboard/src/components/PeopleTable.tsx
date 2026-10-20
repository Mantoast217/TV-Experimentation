import type { Group, SortDirection, SortKey } from "../lib/team/arrange";
import { backOnText, dayOffsetText, localHoursText, STATUS_LABEL, STATUS_MARKER, viewerHoursText } from "../lib/team/copy";
import { NameButton, SelectCheckbox } from "./RowControls";
import type { RowActions } from "./rowActions";
import { StatusText } from "./StatusText";
import { focusRing, secondaryText } from "./styles";

const COLUMN_COUNT = 7;

interface SortableHeaderProps {
  label: string;
  sortKey: SortKey;
  current: { key: SortKey; direction: SortDirection };
  onSort: (key: SortKey) => void;
}

function SortableHeader({ label, sortKey, current, onSort }: SortableHeaderProps) {
  const active = current.key === sortKey;
  return (
    <th scope="col" aria-sort={active ? current.direction : "none"} className="p-0 text-left font-medium">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex min-h-11 w-full items-center gap-1.5 px-3 text-left hover:underline ${focusRing}`}
      >
        {label}
        <span aria-hidden="true" className={active ? "" : "opacity-0"}>
          {active && current.direction === "descending" ? "▼" : "▲"}
        </span>
      </button>
    </th>
  );
}

interface PeopleTableProps {
  groups: Group[];
  sort: { key: SortKey; direction: SortDirection };
  onSort: (key: SortKey) => void;
  actions: RowActions;
}

export function PeopleTable({ groups, sort, onSort, actions }: PeopleTableProps) {
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">Kestrel Global team, grouped by status</caption>
      <thead>
        <tr className="border-b border-[var(--control-border)]">
          <th scope="col" className="w-12 px-1">
            <span className="sr-only">Select</span>
          </th>
          <SortableHeader label="Name" sortKey="name" current={sort} onSort={onSort} />
          <th scope="col" className="px-3 text-left font-medium">
            Role
          </th>
          <SortableHeader label="Time zone" sortKey="timeZone" current={sort} onSort={onSort} />
          <SortableHeader label="Local time" sortKey="localTime" current={sort} onSort={onSort} />
          <th scope="col" className="px-3 text-left font-medium">
            Working hours
          </th>
          <th scope="col" className="px-3 text-left font-medium">
            Status
          </th>
        </tr>
      </thead>
      {groups.map((group) => (
        <tbody key={group.status}>
          <tr>
            <th scope="rowgroup" colSpan={COLUMN_COUNT} className="px-3 pt-6 pb-2 text-left">
              <h3 className="m-0 flex items-center gap-2 text-base font-medium">
                <span aria-hidden="true">{STATUS_MARKER[group.status]}</span>
                {STATUS_LABEL[group.status]} ({group.people.length})
              </h3>
            </th>
          </tr>
          {group.people.map((view) => {
            const offset = dayOffsetText(view.dayOffset);
            const backOn = backOnText(view);
            return (
              <tr key={view.person.id} className="border-t border-[var(--separator)] align-top">
                <td className="px-1 py-1">
                  <SelectCheckbox person={view.person} actions={actions} />
                </td>
                <th scope="row" className="px-3 py-3 text-left">
                  <NameButton person={view.person} actions={actions} />
                </th>
                <td className="px-3 py-3">{view.person.role}</td>
                <td className="px-3 py-3">
                  {view.person.city}, {view.person.country}
                  <span className={`block ${secondaryText}`}>{view.utcOffsetLabel}</span>
                </td>
                <td className="px-3 py-3">
                  <span className="font-medium tabular-nums">{view.localTime}</span>
                  <span className={`block ${secondaryText}`}>
                    {view.weekday}
                    {offset && `, ${offset}`}
                  </span>
                </td>
                <td className="px-3 py-3 tabular-nums">
                  {localHoursText(view)}
                  <span className={`block ${secondaryText}`}>{viewerHoursText(view)}</span>
                </td>
                <td className="px-3 py-3">
                  <StatusText status={view.status} />
                  {backOn && <span className={`block ${secondaryText}`}>{backOn}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      ))}
    </table>
  );
}
