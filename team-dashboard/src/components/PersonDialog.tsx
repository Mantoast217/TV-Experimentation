import { Button, Modal } from "@heroui/react";
import { useState } from "react";
import { fullName, type PersonView } from "../lib/team/arrange";
import { COPY_FAILURE, COPY_SUCCESS, dateRangeText, dayOffsetText, momentText, selectionText, windowText } from "../lib/team/copy";
import { nextWorkingWindow, upcomingOutOfOffice } from "../lib/time";
import { StatusText } from "./StatusText";
import { focusRing, secondaryText } from "./styles";

interface PersonDialogProps {
  view: PersonView | null;
  now: Date;
  viewerZone: string;
  isSelected: boolean;
  /** How many people are selected in total, for the message after adding or removing. */
  selectedCount: number;
  onToggleSelected: () => void;
  onClose: () => void;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** The person's details. React Aria traps focus inside, closes on Esc and returns focus to the name button. */
export function PersonDialog({ view, now, viewerZone, isSelected, selectedCount, onToggleSelected, onClose }: PersonDialogProps) {
  const [message, setMessage] = useState("");

  const close = () => {
    setMessage("");
    onClose();
  };

  // Everything behind the dialog is hidden from assistive technology while it's open, including
  // the page's own selection message, so the dialog announces the change itself.
  const toggleSelected = () => {
    const count = isSelected ? selectedCount - 1 : selectedCount + 1;
    onToggleSelected();
    setMessage(`${isSelected ? "Removed from" : "Added to"} the meeting. ${selectionText(count)}.`);
  };

  return (
    <Modal isOpen={view !== null} onOpenChange={(open) => !open && close()}>
      <Modal.Backdrop>
        <Modal.Container size="md">
          <Modal.Dialog className="max-h-[90dvh] overflow-y-auto">
            {view && (
              <Details
                view={view}
                now={now}
                viewerZone={viewerZone}
                isSelected={isSelected}
                onToggleSelected={toggleSelected}
                message={message}
                onCopy={async () => setMessage((await copyToClipboard(view.person.email)) ? COPY_SUCCESS : COPY_FAILURE)}
                onClose={close}
              />
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

interface DetailsProps {
  view: PersonView;
  now: Date;
  viewerZone: string;
  isSelected: boolean;
  onToggleSelected: () => void;
  message: string;
  onCopy: () => void;
  onClose: () => void;
}

function Details({ view, now, viewerZone, isSelected, onToggleSelected, message, onCopy, onClose }: DetailsProps) {
  const { person } = view;
  const next = nextWorkingWindow(person, now);
  const timeOff = upcomingOutOfOffice(person, now);
  const offset = dayOffsetText(view.dayOffset);

  return (
    <>
      <Modal.Header>
        <Modal.Heading className="m-0 text-xl font-medium">{fullName(person)}</Modal.Heading>
        <p className={`m-0 text-sm ${secondaryText}`}>
          {person.role}, {person.city}, {person.country}
        </p>
      </Modal.Header>
      {/* HeroUI's body text is its lighter --muted grey; use the main text colour so the secondary lines stay secondary. */}
      <Modal.Body className="flex flex-col gap-4 text-sm text-[var(--foreground)]">
        <dl className="m-0 grid gap-x-4 gap-y-3 sm:grid-cols-[auto_1fr]">
          <dt className="font-medium">Local time</dt>
          <dd className="m-0">
            {view.localTime} {view.weekday}
            {offset && `, ${offset}`} ({view.utcOffsetLabel})
          </dd>
          <dt className="font-medium">Status</dt>
          <dd className="m-0">
            <StatusText status={view.status} />
          </dd>
          <dt className="font-medium">{next?.inProgress ? "Working until" : "Next working time"}</dt>
          <dd className="m-0">
            {next ? (
              <>
                {next.inProgress ? momentText(next.end, person.ianaTimeZone) : windowText(next.start, next.end, person.ianaTimeZone)} local
                <span className={`block ${secondaryText}`}>
                  {next.inProgress ? momentText(next.end, viewerZone) : windowText(next.start, next.end, viewerZone)} your time
                </span>
              </>
            ) : (
              "No working days in the next year"
            )}
          </dd>
          <dt className="font-medium">Out of office</dt>
          <dd className="m-0">
            {timeOff.length === 0 ? (
              "No time off booked"
            ) : (
              <ul className="m-0 list-none p-0">
                {timeOff.map((range) => (
                  <li key={range.start}>{dateRangeText(range)}</li>
                ))}
              </ul>
            )}
          </dd>
          <dt className="font-medium">Email</dt>
          <dd className="m-0 break-all">{person.email}</dd>
        </dl>
        <p role="status" className="m-0 min-h-5">
          {message}
        </p>
      </Modal.Body>
      <Modal.Footer className="flex flex-wrap gap-3">
        <Button className={`min-h-11 bg-[var(--brand-blue)] text-[var(--background)] ${focusRing}`} onPress={onToggleSelected}>
          {isSelected ? "Remove from meeting" : "Add to meeting"}
        </Button>
        <Button variant="outline" className={`min-h-11 border-[var(--control-border)] ${focusRing}`} onPress={onCopy}>
          Copy email
        </Button>
        <Button variant="outline" className={`min-h-11 border-[var(--control-border)] ${focusRing}`} onPress={onClose}>
          Close
        </Button>
      </Modal.Footer>
    </>
  );
}
