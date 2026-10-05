#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    grep: { type: "string", default: "." },
    browsers: { type: "string", default: "chromium" },
    pages: { type: "boolean", default: false },
  },
});
const browsers = values.browsers.split(",");
if (browsers.some((browser) => !["chromium", "webkit", "firefox"].includes(browser)))
  throw new Error("Browser non supportato.");
execFileSync(
  "pnpm",
  [
    "exec",
    "playwright",
    "test",
    ...(values.pages ? ["e2e/pages.spec.ts"] : []),
    "--grep",
    values.grep,
    ...browsers.flatMap((browser) => ["--project", browser]),
  ],
  { stdio: "inherit" },
);
