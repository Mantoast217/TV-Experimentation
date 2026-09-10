#!/usr/bin/env node
// Combined build for Cloudflare Pages (or any static host): builds both apps and
// nests enhanced-meeting-scheduler's output inside meeting-scheduler's, so one
// deployed output directory serves both at their intended paths — meeting-scheduler
// at "/" (see its vite.config.ts, which has no base override) and
// enhanced-meeting-scheduler at "/enhanced-meeting-scheduler/" (see its vite.config.ts's
// base: '/enhanced-meeting-scheduler/'). The footer links in each app's
// MeetingScheduler.tsx assume exactly this layout.
//
// Usage: node build.mjs
// Output: meeting-scheduler/dist/ (point the host's output directory here)

import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const smsDir = path.join(repoRoot, "meeting-scheduler");
const emsDir = path.join(repoRoot, "enhanced-meeting-scheduler");
const smsDist = path.join(smsDir, "dist");
const emsDist = path.join(emsDir, "dist");
const nestedEmsDist = path.join(smsDist, "enhanced-meeting-scheduler");

function run(command, cwd) {
  console.log(`\n> (${path.relative(repoRoot, cwd) || "."}) ${command}`);
  execSync(command, { cwd, stdio: "inherit" });
}

run("npm ci", smsDir);
run("npm run build", smsDir);

run("npm ci", emsDir);
run("npm run build", emsDir);

if (!existsSync(smsDist)) {
  throw new Error(`Expected build output at ${smsDist}, but it doesn't exist.`);
}
if (!existsSync(emsDist)) {
  throw new Error(`Expected build output at ${emsDist}, but it doesn't exist.`);
}

rmSync(nestedEmsDist, { recursive: true, force: true });
mkdirSync(nestedEmsDist, { recursive: true });
cpSync(emsDist, nestedEmsDist, { recursive: true });

console.log(`\nCombined build ready at ${smsDist}`);
console.log(`  - meeting-scheduler (SMS) at /`);
console.log(`  - enhanced-meeting-scheduler (EMS) at /enhanced-meeting-scheduler/`);
