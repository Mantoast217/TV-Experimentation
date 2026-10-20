import { Button } from "@heroui/react";
import { forwardRef, useLayoutEffect, useRef } from "react";
import { selectionText } from "../lib/team/copy";

const SPACE_VAR = "--sticky-bottom-space";
/** Gap kept between a focused element and the top of the bar. */
const CLEARANCE_PX = 16;

interface SelectionBarProps {
  count: number;
  onFindTime: () => void;
}

/**
 * Stuck to the bottom of the screen while anyone is selected. It publishes its height as
 * --sticky-bottom-space, which index.css uses for scroll padding, so the browser never scrolls
 * a focused element underneath it (WCAG 2.4.11 Focus Not Obscured).
 */
export const SelectionBar = forwardRef<HTMLButtonElement, SelectionBarProps>(function SelectionBar(
  { count, onFindTime },
  findTimeRef,
) {
  const barRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const root = document.documentElement;
    const update = () => root.style.setProperty(SPACE_VAR, `${bar.offsetHeight + CLEARANCE_PX}px`);
    update();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(bar);
    return () => {
      observer?.disconnect();
      root.style.removeProperty(SPACE_VAR);
    };
  }, []);

  return (
    <div
      ref={barRef}
      role="region"
      aria-label="Selected people"
      className="fixed inset-x-0 bottom-0 z-20 flex justify-center border-t border-[var(--control-border)] bg-[var(--background)] px-6 py-3"
    >
      <div className="flex w-full max-w-[1040px] flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-sm font-medium">{selectionText(count)}</p>
        <Button ref={findTimeRef} className="min-h-11 bg-[var(--brand-blue)] text-[var(--background)]" onPress={onFindTime}>
          Find a meeting time
        </Button>
      </div>
    </div>
  );
});
