import type { Status } from "../lib/time";
import { STATUS_LABEL, STATUS_MARKER } from "../lib/team/copy";

/** A shape plus words, so status never depends on colour. */
export function StatusText({ status }: { status: Status }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true">{STATUS_MARKER[status]}</span>
      {STATUS_LABEL[status]}
    </span>
  );
}
