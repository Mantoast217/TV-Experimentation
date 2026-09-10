import "@testing-library/jest-dom/vitest";
import { toHaveNoViolations } from "jest-axe";
import { beforeEach, expect } from "vitest";

expect.extend(toHaveNoViolations);

// jsdom doesn't implement scrollIntoView; components that call it (e.g. to bring a
// selected dropdown option into view on open) would otherwise throw in tests.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom's window.location/history persists across tests within the same file (there's no
// real navigation between them to reset it). Any component that syncs state into the URL
// (see MeetingScheduler's share-link effect) would otherwise leak query params from one
// test's renders into the next test's initial read of window.location.search.
beforeEach(() => {
  window.history.replaceState(null, "", "/");
});
