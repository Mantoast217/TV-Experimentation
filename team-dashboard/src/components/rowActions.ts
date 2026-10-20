import type { Person } from "../lib/time";

/** What every view's rows can do: select a person, or open their details. */
export interface RowActions {
  isSelected: (id: string) => boolean;
  toggleSelected: (id: string) => void;
  openDetails: (person: Person) => void;
}
