import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TimeZoneCatalogEntry } from "./timezones";
import { useAnchorZone } from "./useAnchorZone";

const LONDON: TimeZoneCatalogEntry = {
  id: "united-kingdom-london",
  country: "United Kingdom",
  city: "London",
  abbr: "BST",
  offsetHours: 1,
};

const TOKYO: TimeZoneCatalogEntry = {
  id: "japan-tokyo",
  country: "Japan",
  city: "Tokyo",
  abbr: "JST",
  offsetHours: 9,
};

const NEW_YORK: TimeZoneCatalogEntry = {
  id: "united-states-new-york",
  country: "United States",
  city: "New York",
  abbr: "EDT",
  offsetHours: -4,
};

describe("useAnchorZone", () => {
  it("defaults to the first zone when no manual pick has been made", () => {
    const { result } = renderHook(({ zones }) => useAnchorZone(zones), {
      initialProps: { zones: [LONDON, TOKYO] },
    });

    expect(result.current.anchorZone).toBe(LONDON);
    expect(result.current.isAutoAnchor).toBe(true);
  });

  it("returns null when there are no zones", () => {
    const { result } = renderHook(({ zones }) => useAnchorZone(zones), { initialProps: { zones: [] } });
    expect(result.current.anchorZone).toBeNull();
  });

  it("follows the first zone automatically as chips are removed", () => {
    const { result, rerender } = renderHook(({ zones }) => useAnchorZone(zones), {
      initialProps: { zones: [LONDON, TOKYO, NEW_YORK] },
    });

    expect(result.current.anchorZone).toBe(LONDON);

    rerender({ zones: [TOKYO, NEW_YORK] });
    expect(result.current.anchorZone).toBe(TOKYO);
    expect(result.current.isAutoAnchor).toBe(true);
  });

  it("switches to a manually selected anchor and marks it non-auto", () => {
    const { result } = renderHook(({ zones }) => useAnchorZone(zones), {
      initialProps: { zones: [LONDON, TOKYO] },
    });

    act(() => result.current.selectAnchor(TOKYO.id));

    expect(result.current.anchorZone).toBe(TOKYO);
    expect(result.current.isAutoAnchor).toBe(false);
  });

  it("reverts to the auto default if the manually picked anchor is removed", () => {
    const { result, rerender } = renderHook(({ zones }) => useAnchorZone(zones), {
      initialProps: { zones: [LONDON, TOKYO] },
    });

    act(() => result.current.selectAnchor(TOKYO.id));
    expect(result.current.anchorZone).toBe(TOKYO);

    rerender({ zones: [LONDON] });
    expect(result.current.anchorZone).toBe(LONDON);
    expect(result.current.isAutoAnchor).toBe(true);
  });

  it("does not resurrect a manual pick if its zone is removed and later re-added", () => {
    const { result, rerender } = renderHook(({ zones }) => useAnchorZone(zones), {
      initialProps: { zones: [LONDON, TOKYO] },
    });

    act(() => result.current.selectAnchor(TOKYO.id));
    expect(result.current.anchorZone).toBe(TOKYO);

    rerender({ zones: [LONDON] });
    expect(result.current.anchorZone).toBe(LONDON);

    rerender({ zones: [LONDON, TOKYO] });
    expect(result.current.anchorZone).toBe(LONDON);
    expect(result.current.isAutoAnchor).toBe(true);
  });

  it("treats re-selecting the current first-added zone as staying on the auto default", () => {
    const { result } = renderHook(({ zones }) => useAnchorZone(zones), {
      initialProps: { zones: [LONDON, TOKYO] },
    });

    act(() => result.current.selectAnchor(LONDON.id));

    expect(result.current.anchorZone).toBe(LONDON);
    expect(result.current.isAutoAnchor).toBe(true);
  });
});
