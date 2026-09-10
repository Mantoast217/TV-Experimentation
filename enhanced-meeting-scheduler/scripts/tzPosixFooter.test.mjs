import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { attachTzdbAbbreviations, parsePosixTzAbbreviations, readPosixTzFooter, tzdbAbbreviations } from "./tzPosixFooter.mjs";

describe("parsePosixTzAbbreviations", () => {
  // Real footer strings, captured live from this machine's own /usr/share/zoneinfo — not
  // hand-invented, so they exercise the actual grammar tzdb emits.
  const cases = [
    ["IST-5:30", { std: "IST", dst: null }], // Asia/Kolkata — no DST, ever.
    ["CST-8", { std: "CST", dst: null }], // Asia/Shanghai.
    ["GMT0BST,M3.5.0/1,M10.5.0", { std: "GMT", dst: "BST" }], // Europe/London.
    ["EST5EDT,M3.2.0,M11.1.0", { std: "EST", dst: "EDT" }], // America/New_York.
    ["GMT0IST,M3.5.0/1,M10.5.0", { std: "GMT", dst: "IST" }], // Europe/Dublin — a DIFFERENT real "IST" than India's.
    ["IST-2IDT,M3.4.4/26,M10.5.0", { std: "IST", dst: "IDT" }], // Asia/Jerusalem — a THIRD real "IST".
    ["CST5CDT,M3.2.0/0,M11.1.0/1", { std: "CST", dst: "CDT" }], // America/Havana — collides with China's CST.
    ["AEST-10AEDT,M10.1.0,M4.1.0/3", { std: "AEST", dst: "AEDT" }], // Australia/Sydney.
    ["UTC0", { std: "UTC", dst: null }],
    ["EAT-3", { std: "EAT", dst: null }], // Africa/Nairobi.
    // Bracketed numeric fallback — tzdb has no traditional letters for these, so both
    // count as "no real abbreviation", not a disguised offset.
    ["<+1245>-12:45<+1345>,M9.5.0/2:45,M4.1.0/3:45", { std: null, dst: null }], // Pacific/Chatham.
    ["<+0545>-5:45", { std: null, dst: null }], // Asia/Kathmandu.
  ];

  for (const [footer, expected] of cases) {
    it(`parses "${footer}" -> ${JSON.stringify(expected)}`, () => {
      expect(parsePosixTzAbbreviations(footer)).toEqual(expected);
    });
  }

  it("returns { std: null, dst: null } for a null/empty footer", () => {
    expect(parsePosixTzAbbreviations(null)).toEqual({ std: null, dst: null });
    expect(parsePosixTzAbbreviations("")).toEqual({ std: null, dst: null });
  });
});

describe("readPosixTzFooter", () => {
  it("returns null for a zone id with no file in the given zoneinfo dir", () => {
    expect(readPosixTzFooter("Not/A_Real_Zone", "/nonexistent-dir")).toBeNull();
  });

  it("extracts the footer from a minimal synthetic v2 TZif file", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "tzif-test-"));
    try {
      // A real TZif file is far more structured than this, but readPosixTzFooter only
      // cares about the "TZif" magic and the text between the last two newlines — this
      // minimal synthetic file exercises exactly that, without needing a real v1+v2
      // binary body.
      mkdirSync(path.join(dir, "Fake"));
      const content = Buffer.concat([
        Buffer.from("TZif2"),
        Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), // padding, irrelevant to the footer read
        Buffer.from("\nEST5EDT,M3.2.0,M11.1.0\n"),
      ]);
      writeFileSync(path.join(dir, "Fake/Zone"), content);
      expect(readPosixTzFooter("Fake/Zone", dir)).toBe("EST5EDT,M3.2.0,M11.1.0");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns null for a file that isn't a TZif file at all", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "tzif-test-"));
    try {
      writeFileSync(path.join(dir, "NotAZone"), "not a tzif file");
      expect(readPosixTzFooter("NotAZone", dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("tzdbAbbreviations (against this machine's real system tzdata)", () => {
  // Skipped automatically (via a runtime check) if the sandbox has no /usr/share/zoneinfo —
  // CI's ubuntu-latest runners always do (the tzdata package is a near-universal base
  // package), but this guards local runs on an unusual environment from failing here.
  const hasSystemZoneinfo = readPosixTzFooter("UTC") != null;
  const maybeIt = hasSystemZoneinfo ? it : it.skip;

  maybeIt("gives India (Asia/Kolkata) its real IST abbreviation", () => {
    expect(tzdbAbbreviations("Asia/Kolkata")).toEqual({ std: "IST", dst: null });
  });

  maybeIt("gives China (Asia/Shanghai) its real CST abbreviation", () => {
    expect(tzdbAbbreviations("Asia/Shanghai")).toEqual({ std: "CST", dst: null });
  });

  maybeIt("gives London both its standard (GMT) and daylight (BST) abbreviations", () => {
    expect(tzdbAbbreviations("Europe/London")).toEqual({ std: "GMT", dst: "BST" });
  });

  maybeIt("attachTzdbAbbreviations adds fields onto entries, omitting them entirely (not null) when absent", () => {
    const entries = [
      { id: "gb-london", city: "London", country: "United Kingdom", countryCode: "GB", timezone: "Europe/London" },
      { id: "in-mumbai", city: "Mumbai", country: "India", countryCode: "IN", timezone: "Asia/Kolkata" },
      { id: "nz-chatham", city: "Chatham", country: "New Zealand", countryCode: "NZ", timezone: "Pacific/Chatham" },
    ];
    const result = attachTzdbAbbreviations(entries);
    expect(result[0]).toEqual({ ...entries[0], stdAbbreviation: "GMT", dstAbbreviation: "BST" });
    expect(result[1]).toEqual({ ...entries[1], stdAbbreviation: "IST" });
    expect(result[1]).not.toHaveProperty("dstAbbreviation");
    expect(result[2]).toEqual(entries[2]); // No abbreviation at all — no keys added.
    expect(result[2]).not.toHaveProperty("stdAbbreviation");
  });
});
