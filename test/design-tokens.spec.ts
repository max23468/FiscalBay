import { describe, expect, it } from "vitest";

import css from "../app/app.css?raw";

function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`missing ${selector}`);
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/giu)].map(([, name, value]) => [
      name!,
      value!,
    ]),
  );
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((index) => {
    const channel = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

const light = tokens(":root {");
const themes = { light, dark: { ...light, ...tokens("@utility dark-tokens {") } };

const tones = ["success", "info", "warning", "danger", "premium", "neutral"];
// Testo 4,5:1; bordi dei campi e indicatore di focus 3:1.
const pairs: Array<[string, string, number]> = [
  ...["background", "card", "popover", "muted"].map((surface): [string, string, number] => [
    "foreground",
    surface,
    4.5,
  ]),
  ...["background", "card", "muted"].map((surface): [string, string, number] => [
    "muted-foreground",
    surface,
    4.5,
  ]),
  ["primary-foreground", "primary", 4.5],
  ["primary-foreground", "primary-hover", 4.5],
  ["danger-foreground", "danger", 4.5],
  ["secondary-foreground", "secondary", 4.5],
  ["primary", "card", 4.5],
  ["destructive", "card", 4.5],
  ...tones.flatMap((tone): Array<[string, string, number]> => [
    [tone, `${tone}-surface`, 4.5],
    [tone, "card", 4.5],
    ["foreground", `${tone}-surface`, 4.5],
  ]),
  ...["background", "card"].flatMap((surface): Array<[string, string, number]> => [
    ["ring", surface, 3],
    ["input", surface, 3],
  ]),
];

describe("design tokens", () => {
  for (const [theme, values] of Object.entries(themes)) {
    it.each(pairs)(`${theme}: %s on %s reaches %d:1`, (foreground, background, minimum) => {
      expect(values[foreground], foreground).toMatch(/^#/u);
      expect(values[background], background).toMatch(/^#/u);
      expect(contrast(values[foreground]!, values[background]!)).toBeGreaterThanOrEqual(minimum);
    });
  }
});
