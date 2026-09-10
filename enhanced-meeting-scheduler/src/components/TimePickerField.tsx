import { ComboBox, Input, ListBox } from "@heroui/react";
import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { asItems } from "../lib/collection";
import { buildTimeOptions, parseTimeInput, shiftTimeValue, type TimeOption } from "../lib/scheduling";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

interface TimePickerFieldProps {
  /** Canonical value, "HH:MM" 24-hour. */
  value: string;
  onChange: (value: string) => void;
  /** Minutes moved per step-button click and per row in the dropdown. Defaults to 15. */
  stepMinutes?: number;
  /** Dropdown options, defaults to a full 24h list at `stepMinutes` increments. */
  options?: TimeOption[];
  "aria-label": string;
  className?: string;
}

/**
 * A Google Maps "Depart at"-style time field: step chevrons, direct typing of any
 * exact time, and a dropdown of preset options, all reading and writing one value.
 */
export function TimePickerField({
  value,
  onChange,
  stepMinutes = 15,
  options,
  "aria-label": ariaLabel,
  className,
}: TimePickerFieldProps) {
  const [inputValue, setInputValue] = useState(value);
  const [stepAnnouncement, setStepAnnouncement] = useState("");
  // Adjust state during render (not in an effect) when the committed value changes
  // from outside (step click, dropdown pick, or a parent-driven update).
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setInputValue(value);
  }

  // Surfaced when a typed value can't be parsed as a time at all, rather than silently
  // reverting with no feedback — role="alert" below announces it immediately (unlike the
  // step chevrons' role="status", this needs assertive: it's telling the user something
  // they just did *didn't* take effect, not confirming one that did).
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  const defaultOptions = useMemo(() => buildTimeOptions(stepMinutes), [stepMinutes]);
  const timeOptions = options ?? defaultOptions;

  const commitTyped = (raw: string) => {
    const parsed = parseTimeInput(raw);
    if (parsed) {
      setError(null);
      setInputValue(parsed);
      if (parsed !== value) onChange(parsed);
    } else if (raw.trim() === "") {
      // An emptied field isn't a typo to flag — just revert quietly, same as before.
      setError(null);
      setInputValue(value);
    } else {
      setError(`"${raw}" isn't a time we recognize — kept ${value}.`);
      setInputValue(value);
    }
  };

  const step = (direction: 1 | -1) => {
    const next = shiftTimeValue(value, (direction * stepMinutes) / 60);
    onChange(next);
    setError(null);
    // The step buttons keep focus on themselves, so the field's own value-change
    // feedback (relied on for typing/dropdown picks) never reaches the user here —
    // this is the one path that needs its own announcement.
    setStepAnnouncement(`Time set to ${next}`);
  };

  const selectedKey = timeOptions.some((option) => option.id === inputValue) ? inputValue : null;

  const popoverRef = useRef<HTMLDivElement>(null);
  const scrollSelectedIntoView = () => {
    requestAnimationFrame(() => {
      popoverRef.current
        ?.querySelector('[aria-selected="true"]')
        ?.scrollIntoView({ block: "center" });
    });
  };

  return (
    <>
    <div
      className={`flex h-[38px] items-center gap-0.5 rounded-field border border-[#767676] bg-field shadow-field pl-3 pr-0.5 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--brand-blue)] ${className ?? ""}`}
    >
      <ComboBox.Root<TimeOption>
        items={asItems(timeOptions)}
        inputValue={inputValue}
        onInputChange={(next) => {
          setInputValue(next);
          if (error) setError(null);
        }}
        selectedKey={selectedKey}
        onSelectionChange={(key) => {
          if (key == null) return;
          const id = String(key);
          setError(null);
          setInputValue(id);
          if (id !== value) onChange(id);
        }}
        allowsCustomValue
        aria-label={ariaLabel}
        fullWidth
        className="min-w-0 flex-1"
        onOpenChange={(isOpen) => {
          if (isOpen) scrollSelectedIntoView();
        }}
      >
        <ComboBox.InputGroup className="border-0 bg-transparent p-0 shadow-none">
          <Input
            className="border-0 bg-transparent p-0 text-left shadow-none"
            onBlur={(e) => commitTyped(e.target.value)}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter") commitTyped(e.currentTarget.value);
            }}
            aria-invalid={error != null || undefined}
            aria-describedby={error != null ? errorId : undefined}
          />
          {/*
            HeroUI's InputGroup only renders its wrapping element via the Trigger it
            injects props into — without a real Trigger present, the group box (and the
            Input inside it) never mounts. We don't want a visible chevron button (this
            field opens on focus), so the trigger is kept but hidden from view and AT.
          */}
          <ComboBox.Trigger aria-hidden="true" excludeFromTabOrder className="hidden" />
        </ComboBox.InputGroup>
        {/* max-h-72: the 96-option (24h at 15min steps) list renders full-height without a cap
            (measured ~3,850px), which can extend far off-screen when the popover opens upward
            on a short viewport. The popover already has overflow-y-auto built in (combo-box.css),
            so this just gives it something to actually scroll within. */}
        <ComboBox.Popover ref={popoverRef} placement="bottom" className="max-h-72">
          <ListBox<TimeOption> items={asItems(timeOptions)}>
            {(item) => (
              <ListBox.Item
                id={item.id}
                textValue={item.label}
                className="data-[selected=true]:bg-accent-soft data-[selected=true]:text-accent-soft-foreground"
              >
                {item.label}
              </ListBox.Item>
            )}
          </ListBox>
        </ComboBox.Popover>
      </ComboBox.Root>

      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label={`Decrease ${ariaLabel.toLowerCase()} by ${stepMinutes} minutes, currently ${value}`}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-blue)]"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label={`Increase ${ariaLabel.toLowerCase()} by ${stepMinutes} minutes, currently ${value}`}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-blue)]"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>

      <div role="status" aria-live="polite" className="sr-only">
        {stepAnnouncement}
      </div>
    </div>
    {error && (
      // text-[var(--danger-text)], not HeroUI's own text-danger: measured only 3.27:1
      // (light) / 4.54:1 (dark) against this app's actual page background — well under
      // the 7:1 AAA floor this app holds elsewhere (see index.css for the verified
      // replacement pair and the live-measured numbers).
      <p id={errorId} role="alert" className="m-0 mt-1 text-xs text-[var(--danger-text)]">
        {error}
      </p>
    )}
    </>
  );
}
