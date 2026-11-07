import { Button } from "@heroui/react";
import { useEffect, useRef } from "react";
import { fullName } from "../lib/team/arrange";
import { selectionText } from "../lib/team/copy";
import type { Person } from "../lib/time";
import { focusRing, secondaryText } from "./styles";

export const HAND_OFF_TITLE = "Find a meeting time – Team dashboard";

interface HandOffProps {
  people: Person[];
  onBack: () => void;
}

/** The step after "Find a meeting time". A stub: the people are handed to onFindTime and nothing is scheduled here. */
export function HandOff({ people, onBack }: HandOffProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <h1 ref={headingRef} tabIndex={-1} className="m-0 text-xl font-medium outline-none">
        Find a meeting time
      </h1>
      <p className="m-0">{selectionText(people.length)}:</p>
      <ul className="m-0 flex flex-col gap-2 pl-5">
        {people.map((person) => (
          <li key={person.id}>
            {fullName(person)}
            <span className={secondaryText}>
              , {person.city}, {person.country}
            </span>
          </li>
        ))}
      </ul>
      <p className={`m-0 text-sm ${secondaryText}`}>Finding a time for them is not available in the dashboard yet.</p>
      <Button variant="outline" className={`min-h-11 self-start border-[var(--control-border)] ${focusRing}`} onPress={onBack}>
        Back
      </Button>
    </div>
  );
}
