import type { Language } from "./i18n";

const browsers: Array<[RegExp, string]> = [
  [/Edg(A|iOS)?\//u, "Edge"],
  [/SamsungBrowser\//u, "Samsung Internet"],
  [/(Firefox|FxiOS)\//u, "Firefox"],
  [/(Chrome|CriOS)\//u, "Chrome"],
  [/Safari\//u, "Safari"],
];
const systems: Array<[RegExp, string]> = [
  [/iPhone/u, "iPhone"],
  [/iPad/u, "iPad"],
  [/Android/u, "Android"],
  [/Windows/u, "Windows"],
  [/Mac OS X|Macintosh/u, "macOS"],
  [/CrOS/u, "ChromeOS"],
  [/Linux/u, "Linux"],
];

/**
 * Browser e sistema dallo user agent, nessun altro dato del dispositivo: nomina le sessioni in
 * Sicurezza e le nuove passkey.
 */
export function deviceName(userAgent: string | null, language: Language): string {
  const browser = browsers.find(([pattern]) => pattern.test(userAgent ?? ""))?.[1];
  const system = systems.find(([pattern]) => pattern.test(userAgent ?? ""))?.[1];
  const on = language === "en" ? "on" : "su";
  if (browser && system) return `${browser} ${on} ${system}`;
  return browser ?? system ?? (language === "en" ? "Unknown device" : "Dispositivo sconosciuto");
}
