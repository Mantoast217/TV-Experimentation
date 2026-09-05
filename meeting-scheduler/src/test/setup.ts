import "@testing-library/jest-dom/vitest";
import { toHaveNoViolations } from "jest-axe";
import { expect } from "vitest";

expect.extend(toHaveNoViolations);

// jsdom doesn't implement scrollIntoView; components that call it (e.g. to bring a
// selected dropdown option into view on open) would otherwise throw in tests.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
