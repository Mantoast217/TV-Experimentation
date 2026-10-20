import { useMemo } from "react";
import type { Group } from "../lib/team/arrange";
import { fullName } from "../lib/team/arrange";
import { backOnText, bestHoursText, STATUS_LABEL, STATUS_MARKER, workingHoursSentence } from "../lib/team/copy";
import { bestHours, DAY_MINUTES, hourlyOverlap, positionInDay, timelineSegments, viewerDay } from "../lib/time";
import { StatusText } from "./StatusText";
import { focusRing, secondaryText } from "./styles";

/**
 * Text column beside a 24-hour track that never gets narrower than 28px an hour. On narrow
 * screens the text sits above the track instead, so the bars get the whole width to scroll in.
 */
const ROW_GRID = "grid grid-cols-[15rem_minmax(42rem,1fr)] gap-x-4 gap-y-2 max-[760px]:grid-cols-[42rem]";
/**
 * Keeps the text in view while the bars scroll sideways. On narrow screens it's exactly as wide
 * as the visible part of the timeline (100cqw), so text never needs scrolling to read.
 */
const STICKY_TEXT = "sticky left-0 z-10 bg-[var(--background)] max-[760px]:w-[100cqw]";
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

function percent(minute: number): string {
  return `${(minute / DAY_MINUTES) * 100}%`;
}

interface TimelineViewProps {
  groups: Group[];
  now: Date;
  viewerZone: string;
}

export function TimelineView({ groups, now, viewerZone }: TimelineViewProps) {
  const day = useMemo(() => viewerDay(now, viewerZone), [now, viewerZone]);
  const nowLeft = percent(positionInDay(now, day));
  const shown = groups.flatMap((group) => group.people.map((view) => view.person));
  const overlap = hourlyOverlap(shown, now, viewerZone);
  const best = bestHours(overlap);

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-sm">{bestHoursText(best, overlap.available)}</p>

      <div
        role="region"
        aria-label="Timeline. Scroll sideways to see all 24 hours."
        tabIndex={0}
        className={`@container overflow-x-auto pb-2 ${focusRing}`}
      >
        <div className="flex min-w-max flex-col">
          {/* Hour scale and "now" marker: part of the picture, so hidden from screen readers. */}
          <div aria-hidden="true" className={`${ROW_GRID} border-b border-[var(--control-border)] pb-2 text-xs`}>
            <span className={`${STICKY_TEXT} ${secondaryText} self-end`}>Your time ({viewerZone})</span>
            <div className="relative h-10">
              {HOURS.filter((hour) => hour % 3 === 0).map((hour) => (
                <span
                  key={hour}
                  className={`absolute bottom-0 -translate-x-1/2 tabular-nums ${secondaryText} first:translate-x-0`}
                  style={{ left: percent(hour * 60) }}
                >
                  {String(hour).padStart(2, "0")}:00
                </span>
              ))}
              <span className="absolute top-0 -translate-x-1/2 font-medium" style={{ left: nowLeft }}>
                Now
              </span>
            </div>
          </div>

          {groups.map((group) => (
            <section key={group.status} aria-labelledby={`timeline-${group.status}`}>
              <h3
                id={`timeline-${group.status}`}
                className={`${STICKY_TEXT} m-0 flex items-center gap-2 pt-6 pb-2 text-base font-medium min-[761px]:w-max`}
              >
                <span aria-hidden="true">{STATUS_MARKER[group.status]}</span>
                {STATUS_LABEL[group.status]} ({group.people.length})
              </h3>
              <ul className="m-0 list-none p-0">
                {group.people.map((view) => {
                  const backOn = backOnText(view);
                  return (
                    <li key={view.person.id} className={`${ROW_GRID} border-t border-[var(--separator)] py-3 text-sm`}>
                      <div className={`${STICKY_TEXT} flex flex-col gap-1`}>
                        <h4 className="m-0 text-sm font-medium">{fullName(view.person)}</h4>
                        <p className="m-0">
                          <StatusText status={view.status} />
                          {backOn && <span className={`block ${secondaryText}`}>{backOn}</span>}
                        </p>
                        <p className={`m-0 tabular-nums ${secondaryText}`}>{workingHoursSentence(view)}</p>
                      </div>
                      <div aria-hidden="true" className="relative min-h-8 self-center">
                        {HOURS.slice(1).map((hour) => (
                          <span
                            key={hour}
                            className="absolute inset-y-0 w-px bg-[var(--separator)]"
                            style={{ left: percent(hour * 60) }}
                          />
                        ))}
                        {timelineSegments(view.person, day).map((segment) => (
                          <span
                            key={segment.startMinute}
                            className="absolute inset-y-1 rounded border-[3px] border-[var(--timeline-bar-outline)] bg-[var(--timeline-bar-fill)]"
                            style={{ left: percent(segment.startMinute), width: percent(segment.endMinute - segment.startMinute) }}
                          />
                        ))}
                        <span className="absolute -inset-y-3 w-0.5 bg-[var(--timeline-now)]" style={{ left: nowLeft }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          {/* Overlap counts: the sentence above says the same thing in words. */}
          <div aria-hidden="true" className={`${ROW_GRID} mt-4 border-t border-[var(--control-border)] pt-3 text-xs`}>
            <span className={`${STICKY_TEXT} ${secondaryText}`}>People working the whole hour</span>
            <div className="grid grid-cols-24">
              {overlap.hours.map(({ hour, count }) => {
                const isBest = best.hours.includes(hour);
                return (
                  <span
                    key={hour}
                    className={`flex h-7 items-center justify-center tabular-nums ${
                      isBest ? "rounded border-2 border-[var(--foreground)] font-bold" : secondaryText
                    }`}
                  >
                    {count}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
