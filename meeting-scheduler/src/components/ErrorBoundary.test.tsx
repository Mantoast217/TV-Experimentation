import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function Bomb(): never {
  throw new Error("boom");
}

describe("ErrorBoundary", () => {
  it("renders children normally when nothing throws", () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("All good")).toBeInTheDocument();
  });

  it("shows a fallback instead of a blank page when a descendant throws", () => {
    // React (and this component's own componentDidCatch) both log to console.error for
    // an uncaught render error — expected noise for this specific test, not a real failure.
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.getByRole("button", { name: "Reload page" })).toBeInTheDocument();

    vi.restoreAllMocks();
  });

  it("reloads the page when the Reload button is clicked", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });

    const user = userEvent.setup();
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    await user.click(screen.getByRole("button", { name: "Reload page" }));

    expect(reload).toHaveBeenCalledOnce();

    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
});
