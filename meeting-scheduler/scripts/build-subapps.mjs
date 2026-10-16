#!/usr/bin/env node
// Runs as part of `npm run build` in this app (see package.json), so the one command that
// builds and deploys meeting-scheduler also builds the sibling apps and nests each one in
// this app's dist/ under its own subpath. Each app's vite.config.ts sets a matching `base`
// (e.g. '/enhanced-meeting-scheduler/'). No separate build command or host configuration
// is needed for them.

import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SUBAPPS = ["enhanced-meeting-scheduler", "team-dashboard"];

const smsDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function run(command, cwd) {
  console.log(`\n> (${path.relative(smsDir, cwd) || "."}) ${command}`);
  execSync(command, { cwd, stdio: "inherit" });
}

for (const name of SUBAPPS) {
  const appDir = path.join(smsDir, "..", name);
  const appDist = path.join(appDir, "dist");
  const target = path.join(smsDir, "dist", name);

  if (!existsSync(appDir)) {
    throw new Error(`Expected a sibling ${name}/ directory at ${appDir}, but it doesn't exist.`);
  }

  run("npm ci", appDir);
  run("npm run build", appDir);

  if (!existsSync(appDist)) {
    throw new Error(`Expected build output at ${appDist}, but it doesn't exist.`);
  }

  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  cpSync(appDist, target, { recursive: true });

  console.log(`\nCopied ${name} build into ${target}`);
}
