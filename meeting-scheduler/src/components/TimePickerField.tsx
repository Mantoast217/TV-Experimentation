import { ComboBox, Input, ListBox } from "@heroui/react";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
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

  const defaultOptions = useMemo(() => buildTimeOptions(stepMinutes), [stepMinutes]);
  const timeOptions = options ?? defaultOptions;

  const commitTyped = (raw: string) => {
    const parsed = parseTimeInput(raw);
    if (parsed) {
      setInputValue(parsed);
      if (parsed !== value) onChange(parsed);
    } else {
      // Not a recognizable time — revert to the last committed value.
      setInputValue(value);
    }
  };

  const step = (direction: 1 | -1) => {
    const next = shiftTimeValue(value, (direction * stepMinutes) / 60);
    onChange(next);
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
    <div
      className={`flex h-[38px] items-center gap-0.5 rounded-field border border-[#767676] bg-field shadow-field pl-3 pr-0.5 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#0D3F9C] ${className ?? ""}`}
    >
      <ComboBox.Root<TimeOption>
        items={asItems(timeOptions)}
        inputValue={inputValue}
        onInputChange={setInputValue}
        selectedKey={selectedKey}
        onSelectionChange={(key) => {
          if (key == null) return;
          const id = String(key);
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
          />
          {/*
            HeroUI's InputGroup only renders its wrapping element via the Trigger it
            injects props into — without a real Trigger present, the group box (and the
            Input inside it) never mounts. We don't want a visible chevron button (this
            field opens on focus), so the trigger is kept but hidden from view and AT.
          */}
          <ComboBox.Trigger aria-hidden="true" excludeFromTabOrder className="hidden" />
        </ComboBox.InputGroup>
        <ComboBox.Popover ref={popoverRef} placement="bottom">
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
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D3F9C]"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label={`Increase ${ariaLabel.toLowerCase()} by ${stepMinutes} minutes, currently ${value}`}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D3F9C]"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>

      <div role="status" aria-live="polite" className="sr-only">
        {stepAnnouncement}
      </div>
    </div>
  );
}
