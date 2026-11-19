import { describe, expect, it } from "vitest";

import { appCopy } from "../app/app-copy";
import features from "../app/components/orders/motion-features";
import { areaSection, shellMenu } from "../app/components/shell-links";
import { installSystem } from "../app/installed-app";
import {
  exportHref,
  exportOrderHref,
  exportReturnHref,
  exportScope,
} from "../app/orders/export-scope";

describe("animazioni della lista ordini", () => {
  it("caricano dopo la pagina anche il riordino delle schede", () => {
    // `layout="position"` sulle schede richiede le funzioni di layout, assenti nel set minimo.
    expect(features).toHaveProperty("layout");
    expect(features).toHaveProperty("animation");
  });
});

describe("ambito dell'esportazione dagli Ordini", () => {
  it("porta la selezione o l'elenco filtrato e torna allo stesso elenco", () => {
    const list = new URLSearchParams("fiscale=locked&ricerca=cifrata&mostra=2&vista=abc");
    const selected = exportHref("/app/impostazioni/esportazione", list, ["o-1", "o-2"]);
    expect(selected).toBe(
      "/app/impostazioni/esportazione?fiscale=locked&ricerca=cifrata&mostra=2&vista=abc&ordini=o-1%2Co-2",
    );
    const query = new URL(selected, "https://esempio.invalid").searchParams;
    expect(exportScope(query)).toEqual({ kind: "orders", ids: ["o-1", "o-2"] });
    expect(exportReturnHref("/app/ordini", query)).toBe(
      "/app/ordini?fiscale=locked&ricerca=cifrata&mostra=2&vista=abc",
    );
    // Senza selezione valgono filtri, ricerca e istantanea; le pagine caricate non contano.
    const filtered = exportScope(new URLSearchParams(exportHref("/x", list).split("?")[1]));
    expect(filtered?.kind).toBe("filtered");
    expect(filtered?.kind === "filtered" && filtered.criteria.toString()).toBe(
      "fiscale=locked&ricerca=cifrata&vista=abc",
    );
    expect(exportHref("/x", new URLSearchParams("ordini=vecchi"))).toBe("/x");
    expect(exportScope(new URLSearchParams())).toBeNull();
    expect(exportScope(new URLSearchParams("mostra=3"))).toBeNull();
    expect(exportReturnHref("/app/ordini", new URLSearchParams("ordini=o-1"))).toBe("/app/ordini");
  });

  it("dal dettaglio porta il solo ordine, con l'elenco soltanto per tornarvi", () => {
    const list = new URLSearchParams("fiscale=locked&vista=abc&ordini=vecchi");
    const href = exportOrderHref("/app/impostazioni/esportazione", list, "o-1");
    expect(href).toBe("/app/impostazioni/esportazione?fiscale=locked&vista=abc&ordine=o-1");
    const query = new URL(href, "https://esempio.invalid").searchParams;
    expect(exportScope(query)).toEqual({ kind: "orders", ids: ["o-1"], detail: true });
    expect(exportReturnHref("/app/ordini", query)).toBe("/app/ordini?fiscale=locked&vista=abc");
    // Dall'elenco la selezione sostituisce l'ordine del dettaglio.
    expect(exportHref("/x", query, ["o-2"])).toBe("/x?fiscale=locked&vista=abc&ordini=o-2");
    expect(exportScope(new URLSearchParams("ordine="))).toEqual({
      kind: "orders",
      ids: [],
      detail: true,
    });
    expect(exportScope(new URLSearchParams({ ordine: "x".repeat(129) }))).toEqual({
      kind: "orders",
      ids: [],
      detail: true,
    });
    expect(exportScope(new URLSearchParams({ ordine: "x".repeat(128) }))).toEqual({
      kind: "orders",
      ids: ["x".repeat(128)],
      detail: true,
    });
  });

  it("non trasforma una selezione vuota o fuori misura in tutti gli ordini", () => {
    expect(exportScope(new URLSearchParams("ordini=&fiscale=locked"))).toEqual({
      kind: "orders",
      ids: [],
    });
    const ids = [
      "o-1",
      "o-1",
      "x".repeat(129),
      "",
      ...Array.from({ length: 400 }, (_, i) => `n-${i}`),
    ];
    const scope = exportScope(new URLSearchParams({ ordini: ids.join(",") }));
    expect(scope?.kind === "orders" && scope.ids.length).toBe(300);
    expect(scope?.kind === "orders" && scope.ids.slice(0, 2)).toEqual(["o-1", "n-0"]);
  });
});

describe("sistema dell'installazione", () => {
  const target = (userAgent: string, { touch = 0, installed = false } = {}) => ({
    navigator: { userAgent, maxTouchPoints: touch },
    matchMedia: () => ({ matches: installed }) as MediaQueryList,
  });
  const mac = (browser: string) =>
    `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) ${browser}`;

  it("Store su Windows, istruzioni su iPhone, iPad e Safari 17 per Mac, altrove il browser", () => {
    const iphone =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1";
    const windows = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36";
    expect(installSystem(target(iphone))).toBe("ios");
    // Un iPad si presenta come Mac, ma con il tocco.
    expect(installSystem(target(mac("Version/18.0 Safari/605.1.15"), { touch: 5 }))).toBe("ios");
    expect(installSystem(target(mac("Version/18.0 Safari/605.1.15")))).toBe("mac");
    expect(installSystem(target(mac("Version/16.6 Safari/605.1.15")))).toBeNull();
    expect(installSystem(target(mac("Chrome/130.0 Safari/537.36")))).toBeNull();
    expect(installSystem(target(mac("Version/18.0 Safari/605.1.15 Edg/130.0")))).toBeNull();
    expect(installSystem(target(windows))).toBe("windows");
    expect(installSystem(target(`${windows} Edg/130.0`))).toBe("windows");
    expect(
      installSystem(target("Mozilla/5.0 (Windows NT 10.0; Win64; x64; Xbox; Xbox One) Edge/44")),
    ).toBeNull();
    expect(
      installSystem(target("Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0 Safari/537.36")),
    ).toBeNull();
    // Già installata non serve nulla, nemmeno lo Store.
    expect(installSystem(target(iphone, { installed: true }))).toBeNull();
    expect(installSystem(target(windows, { installed: true }))).toBeNull();
    expect(
      installSystem({
        ...target(iphone),
        navigator: { ...target(iphone).navigator, standalone: true },
      }),
    ).toBeNull();
  });
});

describe("menu dell'avatar", () => {
  const labels = (admin: boolean, verified = true) =>
    shellMenu({ language: "it", base: "/app" }, appCopy.it, {
      verified,
      admin,
      language: { href: "/accesso", onSelect: () => {} },
    }).map((group) => group.map(({ label, href }) => `${label} ${href}`));

  it("porta l'admin alla console, fuori dalle route dell'app, e soltanto lui", () => {
    expect(labels(true)[1]).toEqual(["Console /admin"]);
    expect(labels(false).flat()).not.toContain("Console /admin");
    // Prima della conferma dell'email il menu ha soltanto lingua e sito, anche per un admin.
    expect(labels(true, false).flat()).not.toContain("Console /admin");
    const consoleItem = shellMenu({ language: "it", base: "/app" }, appCopy.it, {
      verified: true,
      admin: true,
      language: { href: "/accesso", onSelect: () => {} },
    })[1]![0]!;
    expect(consoleItem.reloadDocument).toBe(true);
  });
});

describe("sezione dell'area", () => {
  it("è la parte dopo app o anteprima, in entrambe le lingue", () => {
    expect(areaSection("/app/ordini/o-1")).toBe("ordini");
    expect(areaSection("/en/app/settings/sicurezza")).toBe("impostazioni");
    expect(areaSection("/en/preview/stores")).toBe("negozi");
    expect(areaSection("/app/profilo")).toBe("profilo");
    expect(areaSection("/accesso")).toBe("");
  });
});
