/** "HH:MM", 24-hour, in the person's own time zone. `start` is before `end` on the same day. */
export interface WorkingHours {
  start: string;
  end: string;
}

/** Inclusive "YYYY-MM-DD" dates in the person's own time zone. */
export interface DateRange {
  start: string;
  end: string;
}

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  city: string;
  country: string;
  ianaTimeZone: string;
  workingHours: WorkingHours;
  outOfOffice: DateRange[];
  email: string;
}

export type Status = "working" | "outside" | "holiday";

/** A span of real time. `start` is inclusive, `end` exclusive. */
export interface TimeWindow {
  start: Date;
  end: Date;
}
