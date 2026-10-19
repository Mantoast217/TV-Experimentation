import type { Group } from "../lib/team/arrange";
import { fullName } from "../lib/team/arrange";
import { backOnText, dayOffsetText, localHoursText, STATUS_LABEL, STATUS_MARKER, viewerHoursText } from "../lib/team/copy";
import { StatusText } from "./StatusText";
import { secondaryText } from "./styles";

/** The narrow-screen layout: the same groups and order as the table, as lists of cards. */
export function PeopleCards({ groups }: { groups: Group[] }) {
  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section key={group.status} aria-labelledby={`cards-${group.status}`}>
          <h3 id={`cards-${group.status}`} className="m-0 mb-3 flex items-center gap-2 text-base font-medium">
            <span aria-hidden="true">{STATUS_MARKER[group.status]}</span>
            {STATUS_LABEL[group.status]} ({group.people.length})
          </h3>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {group.people.map((view) => {
              const offset = dayOffsetText(view.dayOffset);
              const backOn = backOnText(view);
              return (
                <li
                  key={view.person.id}
                  className="flex flex-col gap-2 rounded-lg border border-[var(--control-border)] bg-[var(--surface)] p-4 text-sm"
                >
                  <h4 className="m-0 text-base font-medium">{fullName(view.person)}</h4>
                  <p className={`m-0 ${secondaryText}`}>
                    {view.person.role}, {view.person.city}, {view.person.country} ({view.utcOffsetLabel})
                  </p>
                  <p className="m-0">
                    <span className="text-lg font-medium tabular-nums">{view.localTime}</span>{" "}
                    {view.weekday}
                    {offset && `, ${offset}`}
                  </p>
                  <p className="m-0 tabular-nums">
                    {localHoursText(view)}
                    <span className={`block ${secondaryText}`}>{viewerHoursText(view)}</span>
                  </p>
                  <p className="m-0">
                    <StatusText status={view.status} />
                    {backOn && <span className={`block ${secondaryText}`}>{backOn}</span>}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
