import { describe, expect, it } from "vitest";
import features from "../app/components/orders/motion-features";
import { appCopy } from "../app/app-copy";
import { areaSection, shellMenu } from "../app/components/shell-links";
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
    expect(areaSection("/en/app/impostazioni/sicurezza")).toBe("impostazioni");
    expect(areaSection("/en/anteprima/negozi")).toBe("negozi");
    expect(areaSection("/app/profilo")).toBe("profilo");
    expect(areaSection("/accesso")).toBe("");
  });
});
