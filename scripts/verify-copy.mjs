#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, lstatSync } from "node:fs";

const files = new Set(
  execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean),
);
const character = String.fromCodePoint(0x2014);
const encoded = new RegExp(
  [
    "&md" + "ash;",
    "&#0*" + character.codePointAt(0) + ";",
    "&#x0*201" + "4;",
    "\\\\u(?:201" + "4|\\{0*201" + "4\\})",
  ].join("|"),
  "i",
);
let failures = 0;
for (const file of files) {
  let contents;
  try {
    if (!lstatSync(file).isFile()) continue;
    contents = readFileSync(file);
  } catch (error) {
    if (error.code === "ENOENT") continue;
    throw error;
  }
  if (contents.includes(0)) continue;
  for (const [index, line] of contents.toString("utf8").split("\n").entries()) {
    if (line.includes(character) || encoded.test(line)) {
      console.error(`${file}:${index + 1}: em dash non consentito (U+2014).`);
      failures++;
    }
  }
}
if (failures) process.exitCode = 1;
else console.log("Copy: nessun em dash nei file della repository.");
