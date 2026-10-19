import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const appRoot = path.resolve(__dirname, "..");
const csp = readFileSync(path.join(appRoot, "public/_headers"), "utf8")
  .split("\n")
  .find((line) => line.trim().startsWith("Content-Security-Policy:"));
const htmlFiles = readdirSync(appRoot).filter((file) => file.endsWith(".html"));

describe("Content-Security-Policy", () => {
  it("is set", () => {
    expect(csp).toBeDefined();
  });

  it.each(htmlFiles)("allows every inline script in %s by hash (update public/_headers after editing one)", (file) => {
    const html = readFileSync(path.join(appRoot, file), "utf8");
    const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    for (const script of inlineScripts) {
      const hash = `'sha256-${createHash("sha256").update(script).digest("base64")}'`;
      expect(csp).toContain(hash);
    }
  });
});
