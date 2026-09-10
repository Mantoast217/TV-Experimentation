#!/usr/bin/env node
// Runs as part of `npm run build` in this app (see package.json) so that whatever already
// builds and deploys meeting-scheduler — the same command that makes privacy.html/terms.html
// show up, since they're just extra entries in this app's own vite.config.ts — also produces
// enhanced-meeting-scheduler and nests it into this app's own dist/. No separate build
// command or host configuration for EMS is needed as a result.
//
// EMS is deployed as a subpath of this app (see enhanced-meeting-scheduler/vite.config.ts's
// base: '/enhanced-meeting-scheduler/'), which is why its build output belongs inside this
// app's dist/ rather than being built and hosted on its own.

import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const smsDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const emsDir = path.join(smsDir, "..", "enhanced-meeting-scheduler");
const emsDist = path.join(emsDir, "dist");
const target = path.join(smsDir, "dist", "enhanced-meeting-scheduler");

function run(command, cwd) {
  console.log(`\n> (${path.relative(smsDir, cwd) || "."}) ${command}`);
  execSync(command, { cwd, stdio: "inherit" });
}

if (!existsSync(emsDir)) {
  throw new Error(`Expected a sibling enhanced-meeting-scheduler/ directory at ${emsDir}, but it doesn't exist.`);
}

run("npm ci", emsDir);
run("npm run build", emsDir);

if (!existsSync(emsDist)) {
  throw new Error(`Expected build output at ${emsDist}, but it doesn't exist.`);
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(emsDist, target, { recursive: true });

console.log(`\nCopied enhanced-meeting-scheduler build into ${target}`);
