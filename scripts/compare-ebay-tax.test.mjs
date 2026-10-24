import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { compareEbayTax } from "./compare-ebay-tax.mjs";

describe("confronto fiscale eBay senza dati privati", () => {
  const tax = { type: "CODICE_FISCALE", value: "VALORE-PRIVATO-SINTETICO", issuingCountry: "IT" };
  function fixture({
    marketplaces = ["EBAY_IT"],
    fulfillment = [tax],
    trading = [tax],
    orderFound = true,
    failure,
    change = false,
  } = {}) {
    const access = {
      configuration: { apiOrigin: "https://api.ebay.com" },
      accessToken: "TOKEN-PRIVATO",
      fetcher: async () => {},
    };
    const client = {
      async readFulfillmentOrder(measured, id, options) {
        await measured.fetcher(`https://api.ebay.com/sell/fulfillment/v1/order/${id}`);
        if (failure) throw { failure, message: tax.value };
        return {
          orderId: id,
          creationDate: "2026-09-01T00:00:00Z",
          lastModifiedDate:
            options.marketplaceId && change ? "2026-09-02T00:00:00Z" : "2026-09-01T00:00:00Z",
          lineItems: marketplaces.map((listingMarketplaceId) => ({ listingMarketplaceId })),
          tax: options.marketplaceId ? fulfillment : [],
        };
      },
      fulfillmentTaxIdentifiers: (payload) => payload.tax,
      async readTradingTaxObservation(measured) {
        await measured.fetcher("https://api.ebay.com/ws/api.dll");
        return { orderFound, values: trading };
      },
    };
    return (ids = ["ORDINE-PRIVATO"]) =>
      compareEbayTax(
        { environment: "production", orderIds: ids },
        access,
        client,
        Date.parse("2026-10-09T00:00:00Z"),
      );
  }

  it("confronta tipo, valore e Paese, deduplica e misura le chiamate senza riportare valori o ID", async () => {
    const report = await fixture({ trading: [tax, tax] })();
    assert.deepEqual(report.calls, { fulfillment: 2, trading: 1 });
    assert.deepEqual(report.rows, [
      {
        sample: 1,
        marketplace: "EBAY_IT",
        age: "15-90",
        outcome: "equal",
        withoutHeader: 0,
        fulfillment: 1,
        trading: 1,
        countryComplete: true,
      },
    ]);
    assert.equal(report.supportsReview, true);
    for (const secret of [tax.value, "ORDINE-PRIVATO", "TOKEN-PRIVATO"])
      assert.ok(!JSON.stringify(report).includes(secret));
    for (const other of [
      { ...tax, value: "ALTRO" },
      { ...tax, type: "VAT_ID" },
      { ...tax, issuingCountry: "ES" },
    ]) {
      assert.equal((await fixture({ trading: [other] })()).rows[0].outcome, "different");
    }
    const unknownCountry = await fixture({ trading: [{ ...tax, issuingCountry: null }] })();
    assert.equal(unknownCountry.rows[0].countryComplete, false);
    const officialType = await fixture({
      trading: [{ ...tax, type: "CodiceFiscale", issuingCountry: null }],
    })();
    assert.equal(officialType.rows[0].outcome, "equal");
    assert.equal(officialType.rows[0].countryComplete, false);
    assert.equal(officialType.supportsReview, true);
    for (const type of ["codice_fiscale", "CODICEFISCALE", "VATIN"])
      assert.equal((await fixture({ trading: [{ ...tax, type }] })()).rows[0].outcome, "different");
  });

  it("non dichiara equivalenza da assenze, ordini non restituiti o marketplace ambigui", async () => {
    for (const [options, outcome] of [
      [{ fulfillment: [], trading: [] }, "both_absent"],
      [{ fulfillment: [], orderFound: false }, "trading_order_unavailable"],
      [{ marketplaces: [] }, "marketplace_unresolved"],
      [{ marketplaces: [null] }, "marketplace_unresolved"],
      [{ marketplaces: ["EBAY_IT", null] }, "marketplace_unresolved"],
      [{ marketplaces: ["EBAY_IT", "EBAY_ES"] }, "marketplace_unresolved"],
      [{ fulfillment: [] }, "different"],
    ]) {
      const report = await fixture(options)();
      assert.equal(report.rows[0].outcome, outcome);
      assert.equal(report.supportsReview, false);
      if (outcome === "marketplace_unresolved")
        assert.deepEqual(report.calls, { fulfillment: 1, trading: 0 });
    }
  });

  it("ferma il campione per errori globali e non espone il messaggio del provider", async () => {
    for (const failure of [
      "credentials",
      "rate_limited",
      "unavailable",
      "invalid_response",
      "rejected",
      "INATTESO-PRIVATO",
    ]) {
      const report = await fixture({ failure })(["uno", "due"]);
      const stops = ["credentials", "rate_limited", "unavailable"].includes(failure);
      assert.equal(report.rows[1].outcome, stops ? "not_read" : "error");
      assert.equal(report.calls.fulfillment, stops ? 1 : 2);
      assert.ok(!JSON.stringify(report).includes(tax.value));
      assert.ok(!JSON.stringify(report).includes("INATTESO-PRIVATO"));
    }
    assert.equal((await fixture({ change: true })()).rows[0].outcome, "error");
  });

  it("rifiuta campioni vuoti, duplicati, troppo grandi e ambiente discordante prima della rete", async () => {
    for (const ids of [[], ["uno", "uno"], Array.from({ length: 51 }, (_, i) => String(i))])
      await assert.rejects(fixture()(ids));
    await assert.rejects(
      compareEbayTax(
        { environment: "sandbox", orderIds: ["uno"] },
        { configuration: { apiOrigin: "https://api.ebay.com" } },
        {},
      ),
    );
  });

  it("esegue la CLI e gli adapter reali con rete sintetica, senza persistenza né dati nell'output", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "fiscalbay-tax-"));
    try {
      const preload = path.join(dir, "fetch.mjs");
      writeFileSync(
        preload,
        `globalThis.fetch = async (url, init) => {
        if (String(url).endsWith('/ws/api.dll')) return new Response('<GetOrdersResponse><Ack>Success</Ack><Order><OrderID>ordine-privato</OrderID><BuyerTaxIdentifier><ID>valore-privato</ID><Type>CODICE_FISCALE</Type></BuyerTaxIdentifier></Order></GetOrdersResponse>');
        const header = new Headers(init.headers).get('X-EBAY-C-MARKETPLACE-ID');
        if (new URL(url).search !== '?fieldGroups=TAX_BREAKDOWN') throw Error('campo mancante');
        return Response.json({ orderId: 'ordine-privato', creationDate: '2026-09-01T00:00:00Z', lastModifiedDate: '2026-09-01T00:00:00Z', lineItems: [{ listingMarketplaceId: 'EBAY_IT' }], buyer: header === 'EBAY_IT' ? { taxIdentifier: { taxpayerId: 'valore-privato', taxIdentifierType: 'CODICE_FISCALE' } } : {} });
      };`,
      );
      const result = spawnSync(
        process.execPath,
        ["--import", preload, "scripts/compare-ebay-tax.mjs"],
        {
          input: JSON.stringify({ environment: "production", orderIds: ["ordine-privato"] }),
          env: { ...process.env, EBAY_ACCESS_TOKEN: "token-privato" },
          encoding: "utf8",
          timeout: 30_000,
        },
      );
      assert.equal(result.status, 0, result.stderr);
      assert.equal(JSON.parse(result.stdout).rows[0].outcome, "equal");
      for (const value of ["ordine-privato", "valore-privato", "token-privato"])
        assert.ok(!(result.stdout + result.stderr).includes(value));
      const invalid = spawnSync(process.execPath, ["scripts/compare-ebay-tax.mjs"], {
        input: '{"ordine":"privato"}',
        encoding: "utf8",
        timeout: 10_000,
      });
      assert.equal(invalid.status, 1);
      assert.ok(!invalid.stderr.includes('"ordine"'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
