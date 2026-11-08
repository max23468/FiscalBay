import { describe, expect, it } from "vitest";

import {
  arrivalSource,
  carrySource,
  channelFromHost,
  formatSource,
  labelledChannels,
  parseSource,
  signupChannels,
  withoutSource,
  withSource,
} from "../app/signup-source";

const origin = "https://fiscalbay.it";

/** Referer di un sito esterno: soltanto l'origine, come la manda il browser. */
const from = (host: string) => `https://${host}/`;

const page = (path: string, headers: Record<string, string> = {}) =>
  arrivalSource(new Request(`${origin}${path}`, { headers }), origin);

describe("provenienza dal Referer", () => {
  it.each([
    ["www.google.com", "google"],
    ["www.google.it", "google"],
    ["www.google.co.uk", "google"],
    ["www.bing.com", "bing"],
    ["duckduckgo.com", "other_search"],
    ["search.yahoo.com", "other_search"],
    ["www.ecosia.org", "other_search"],
    ["chatgpt.com", "ai_assistant"],
    ["gemini.google.com", "ai_assistant"],
    ["www.perplexity.ai", "ai_assistant"],
    ["community.ebay.it", "ebay_community"],
    ["community.ebay.com", "ebay_community"],
    ["www.ebay.it", "ebay_other"],
    ["pages.ebay.co.uk", "ebay_other"],
    ["github.com", "github"],
    ["m.youtube.com", "youtube"],
    ["youtu.be", "youtube"],
    ["old.reddit.com", "reddit"],
    ["t.me", "telegram"],
    ["mail.google.com", "email"],
    ["outlook.live.com", "email"],
    ["www.example.com", "other_site"],
    ["notgoogle.com", "other_site"],
    ["ebay.example.com", "other_site"],
    ["GITHUB.COM.", "github"],
  ])("%s è %s", (host, channel) => {
    expect(channelFromHost(host)).toBe(channel);
  });

  it("usa la sola origine esterna e annota la prima pagina senza query", () => {
    expect(page("/prezzi?utm_source=x", { referer: from("www.google.com") })).toEqual({
      channel: "google",
      firstPage: "/prezzi",
    });
    expect(page("/en/faq", { referer: from("community.ebay.it") })).toEqual({
      channel: "ebay_community",
      firstPage: "/en/faq",
    });
  });

  it("da un altro sito ignora il valore propagato e tiene l'etichetta pubblicata", () => {
    const referer = from("www.google.com");
    expect(page("/en/faq?via=direct%3A%2F", { referer })).toEqual({
      channel: "google",
      firstPage: "/en/faq",
    });
    expect(page("/prezzi?via=telegram", { referer })).toEqual({
      channel: "telegram",
      firstPage: "/prezzi",
    });
    expect(page("/prezzi?via=direct%3A%2Fguide", { referer: `${origin}/guide` })).toEqual({
      channel: "direct",
      firstPage: "/guide",
    });
    expect(page("/prezzi?via=direct%3A%2Fguide")).toEqual({
      channel: "direct",
      firstPage: "/guide",
    });
  });

  it("senza Referer è diretto, dalla stessa origine non è un nuovo arrivo", () => {
    expect(page("/")).toEqual({ channel: "direct", firstPage: "/" });
    expect(page("/funzionalita", { referer: `${origin}/prezzi` })).toBeNull();
    expect(page("/", { referer: "android-app://com.example.app/" })).toEqual({
      channel: "other_site",
      firstPage: "/",
    });
    expect(page("/", { referer: "non è un indirizzo" })).toEqual({
      channel: "direct",
      firstPage: "/",
    });
  });
});

describe("etichetta del canale nell'indirizzo", () => {
  it("accetta soltanto l'elenco chiuso e ignora il resto", () => {
    for (const channel of labelledChannels) {
      expect(parseSource(channel)).toEqual({ channel, firstPage: null });
    }
    for (const value of [
      "google",
      "direct",
      "unknown",
      "newsletter",
      "GitHub",
      "github ",
      "",
      null,
      undefined,
      42,
      ["github"],
      { channel: "github" },
      "unknown:/prezzi",
      "google:prezzi",
      "google:/prezzi?x=1",
      "google:/PREZZI",
      "google:/../admin",
      `google:/${"a".repeat(200)}`,
    ]) {
      expect(parseSource(value), String(value)).toBeNull();
    }
  });

  it("vale più del Referer e prende la pagina corrente come prima pagina", () => {
    expect(page("/prezzi?via=reddit", { referer: from("www.google.com") })).toEqual({
      channel: "reddit",
      firstPage: "/prezzi",
    });
    // Un valore non ammesso è ignorato: decide il Referer.
    expect(page("/prezzi?via=newsletter", { referer: from("www.bing.com") })).toEqual({
      channel: "bing",
      firstPage: "/prezzi",
    });
  });

  it("conserva categoria e prima pagina propagate fra le pagine", () => {
    const value = formatSource({ channel: "google", firstPage: "/prezzi" });
    expect(value).toBe("google:/prezzi");
    expect(parseSource(value)).toEqual({ channel: "google", firstPage: "/prezzi" });
    expect(
      page(`/accesso?registrati&via=${encodeURIComponent(value)}`, { referer: `${origin}/prezzi` }),
    ).toEqual({ channel: "google", firstPage: "/prezzi" });
    for (const channel of signupChannels.filter((channel) => channel !== "unknown")) {
      expect(parseSource(`${channel}:/`)).toEqual({ channel, firstPage: "/" });
    }
  });
});

describe("propagazione nei link interni", () => {
  const value = "google:/prezzi";
  const encoded = encodeURIComponent(value);

  it("aggiunge il parametro alle pagine del sito e dell'accesso, query e frammento intatti", () => {
    expect(withSource("/funzionalita", value, origin)).toBe(`/funzionalita?via=${encoded}`);
    expect(withSource("/en", value, origin)).toBe(`/en?via=${encoded}`);
    expect(withSource("/en/sign-in?register", value, origin)).toBe(
      `/en/sign-in?register&via=${encoded}`,
    );
    expect(withSource("/accesso?registrati", value, origin)).toBe(
      `/accesso?registrati&via=${encoded}`,
    );
    expect(withSource("/faq#prezzi", value, origin)).toBe(`/faq?via=${encoded}#prezzi`);
    expect(withSource(`/prezzi?via=reddit&x=1`, value, origin)).toBe(`/prezzi?x=1&via=${encoded}`);
    expect(withSource(`${origin}/sicurezza`, value, origin)).toBe(
      `${origin}/sicurezza?via=${encoded}`,
    );
  });

  it("lascia invariati area, console, anteprima, API, file e altri siti", () => {
    for (const href of [
      "/app/ordini",
      "/en/app/settings",
      "/en/app/orders",
      "/en/preview/orders",
      "/admin",
      "/anteprima/ordini",
      "/api/auth/sign-out",
      "/og/fiscalbay-it.png",
      "/sitemap.xml",
      "/llms.txt",
      "https://altro-sito.invalid/",
      "mailto:assistenza@example.invalid",
      "#contenuto",
      "//example.com/prezzi",
      "?registrati",
    ]) {
      expect(withSource(href, value, origin), href).toBe(href);
    }
  });

  it("ripulisce l'indirizzo dal solo parametro", () => {
    expect(withoutSource(`${origin}/prezzi?via=${encoded}`)).toBe(`${origin}/prezzi`);
    expect(withoutSource(`${origin}/accesso?registrati&via=${encoded}#x`)).toBe(
      `${origin}/accesso?registrati#x`,
    );
    expect(withoutSource(`${origin}/faq`)).toBe(`${origin}/faq`);
  });
});

describe("applicazione nella pagina", () => {
  /** Finestra minima: ogni accesso a cookie o archivi del browser fa fallire la prova. */
  function view(href: string, links: string[]) {
    const anchors = links.map((value) => {
      let current = value;
      return {
        getAttribute: () => current,
        setAttribute: (_: string, next: string) => {
          current = next;
        },
        get href() {
          return current;
        },
      };
    });
    const listeners = new Map<string, (event: Event) => void>();
    const replaced: string[] = [];
    const forbidden = (name: string) => () => {
      throw new Error(`accesso a ${name}`);
    };
    const document = {
      querySelectorAll: () => anchors,
      addEventListener: (type: string, listener: (event: Event) => void) =>
        listeners.set(type, listener),
      removeEventListener: (type: string) => listeners.delete(type),
      get cookie(): string {
        return forbidden("document.cookie")();
      },
      set cookie(_: string) {
        forbidden("document.cookie")();
      },
    };
    const url = new URL(href);
    const target = {
      document,
      location: { origin: url.origin, href },
      history: {
        state: { key: "chiave" },
        replaceState: (_: unknown, __: string, next: string) => replaced.push(next),
      },
    };
    for (const name of ["localStorage", "sessionStorage", "indexedDB"])
      Object.defineProperty(target, name, { get: forbidden(name) });
    return { target, anchors, listeners, replaced };
  }

  it("riscrive i link, ripulisce l'indirizzo e non tocca cookie né archivi", () => {
    const { target, anchors, listeners, replaced } = view(
      `${origin}/prezzi?via=google%3A%2Fprezzi`,
      ["/accesso?registrati", "/app/ordini", "https://altro-sito.invalid/"],
    );
    const stop = carrySource("google:/prezzi", target as never);
    expect(anchors.map((anchor) => anchor.href)).toEqual([
      "/accesso?registrati&via=google%3A%2Fprezzi",
      "/app/ordini",
      "https://altro-sito.invalid/",
    ]);
    expect(replaced).toEqual([`${origin}/prezzi`]);
    expect([...listeners.keys()]).toEqual(["click", "auxclick"]);
    stop();
    expect(listeners.size).toBe(0);
  });
});
