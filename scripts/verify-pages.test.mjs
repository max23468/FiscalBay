import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { missingPages, missingSections, routePatterns } from "./verify-pages.mjs";
import { expectedPageError, knownPagePath } from "../e2e/page-cases.ts";

describe("catalogo delle pagine", () => {
  it("ignora errori HTTP attesi solo del documento corrente o dei suoi dati", () => {
    const page = new URL("https://test.example.invalid/non-esiste?x=1");
    const message = "Failed to load resource: the server responded with a status of 404";
    for (const resource of [page.href, `${page.origin}/non-esiste.data?x=2`])
      assert.equal(expectedPageError(message, resource, 404, page), true);
    for (const [text, resource, status] of [
      [message, page.href, 200],
      [message, "https://external.example.invalid/non-esiste", 404],
      [message, `${page.origin}/non-esiste.data-other`, 404],
      [message, "", 404],
      [message, "not a URL", 404],
      ["Failed to load resource: status of 500", page.href, 404],
      [message, page.href, 500],
    ])
      assert.equal(expectedPageError(text, resource, status, page), false);
  });

  it("rifiuta collegamenti a route assenti ma ammette parametri opzionali e endpoint", () => {
    for (const pathname of [
      "/",
      "/en",
      "/anteprima/ordini",
      "/en/anteprima/ordini/ord-02",
      "/api/auth/get-session",
    ])
      assert.ok(knownPagePath(pathname), pathname);
    assert.equal(knownPagePath("/pagina-che-non-esiste"), false);
    assert.equal(knownPagePath("/anteprima/ordini/ord-02/extra"), false);
  });
  it("segnala anche nuove sezioni e una lingua dimenticata", () => {
    assert.deepEqual(
      missingSections(["aspetto", "nuova"], [{ path: "/anteprima/impostazioni/aspetto" }]),
      [
        "/en/anteprima/impostazioni/aspetto",
        "/anteprima/impostazioni/nuova",
        "/en/anteprima/impostazioni/nuova",
      ],
    );
  });
  it("richiede scenari anche per route annidate e nuove route", () => {
    const patterns = routePatterns([{ path: "app", children: [{ path: "orders/:id" }] }]);
    assert.deepEqual(patterns, ["/app", "/app/orders/:id"]);
    assert.deepEqual(missingPages(patterns, [{ pattern: "/app" }]), ["/app/orders/:id"]);
  });
});
