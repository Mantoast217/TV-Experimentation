import { fullName } from "../lib/team/arrange";
import type { Person } from "../lib/time";
import type { RowActions } from "./rowActions";
import { focusRing } from "./styles";

/** A native checkbox with a 44px target. Its name says who it selects. */
export function SelectCheckbox({ person, actions }: { person: Person; actions: RowActions }) {
  return (
    <label className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-md has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--brand-blue)] has-[:focus-visible]:outline-solid">
      <input
        type="checkbox"
        checked={actions.isSelected(person.id)}
        onChange={() => actions.toggleSelected(person.id)}
        className="h-5 w-5 accent-[var(--brand-blue)] outline-none"
      />
      <span className="sr-only">Select {fullName(person)}</span>
    </label>
  );
}

/** The person's name as a button that opens their details. */
export function NameButton({ person, actions }: { person: Person; actions: RowActions }) {
  return (
    <button
      type="button"
      onClick={() => actions.openDetails(person)}
      className={`min-h-6 cursor-pointer text-left font-medium text-[var(--brand-blue)] underline underline-offset-2 hover:decoration-2 ${focusRing}`}
    >
      {fullName(person)}
    </button>
  );
}
