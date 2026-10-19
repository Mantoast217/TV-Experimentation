import { describe, it } from "vitest";
import fc from "fast-check";
import { instant, NUM_RUNS, person, scaledTimeout, timeZone } from "../../test/arbitraries";
import { DAY_MINUTES, hourlyOverlap, positionInDay, statusAt, timelineSegments, viewerDay } from ".";
import { inZone, wallTimeToInstant } from "./zone";

const options = { numRuns: NUM_RUNS };

describe("time library properties", () => {
  it(
    "round-trips local time to UTC and back to the same local time",
    () => {
      fc.assert(
        fc.property(instant(), timeZone(), (at, zone) => {
          const local = inZone(at, zone);
          const back = inZone(wallTimeToInstant(local.toISODate()!, local.toFormat("HH:mm"), zone), zone);
          return back.toFormat("yyyy-MM-dd HH:mm") === local.toFormat("yyyy-MM-dd HH:mm");
        }),
        options,
      );
    },
    scaledTimeout(2),
  );

  it(
    "keeps every timeline segment within 0 to 1440 minutes, in order and not empty",
    () => {
      fc.assert(
        fc.property(person(), instant(), timeZone(), (p, now, zone) => {
          const segments = timelineSegments(p, viewerDay(now, zone));
          return segments.every(
            (s, i) =>
              s.startMinute >= 0 &&
              s.endMinute <= DAY_MINUTES &&
              s.startMinute < s.endMinute &&
              (i === 0 || segments[i - 1].endMinute <= s.startMinute),
          );
        }),
        options,
      );
    },
    scaledTimeout(5),
  );

  it(
    "says someone is working exactly when the current time falls inside one of their segments",
    () => {
      fc.assert(
        fc.property(person(), instant(), timeZone(), (p, now, zone) => {
          const day = viewerDay(now, zone);
          const position = positionInDay(now, day);
          const inSegment = timelineSegments(p, day).some((s) => s.startMinute <= position && position < s.endMinute);
          return (statusAt(p, now) === "working") === inSegment;
        }),
        options,
      );
    },
    scaledTimeout(5),
  );

  it(
    "never counts more people in an hour than are available",
    () => {
      fc.assert(
        fc.property(fc.array(person(), { maxLength: 8 }), instant(), timeZone(), (people, now, zone) => {
          const overlap = hourlyOverlap(people, now, zone);
          return (
            overlap.hours.length === 24 &&
            overlap.available <= people.length &&
            overlap.hours.every((h) => h.count >= 0 && h.count <= overlap.available)
          );
        }),
        options,
      );
    },
    scaledTimeout(20),
  );
});
