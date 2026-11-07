import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { indexNowKey, payload, publishedKey, sitemapUrls } from "./indexnow.mjs";

describe("IndexNow", () => {
  it("pubblica con il sito il file della chiave", () => {
    assert.equal(publishedKey(), indexNowKey);
  });

  it("invia le pagine della sitemap con la chiave dell'host", () => {
    // Forma della sitemap servita: `<loc>` per pagina e lingua, alternate in `xhtml:link`.
    const alternates =
      '<xhtml:link rel="alternate" hreflang="it" href="https://fiscalbay.it/"/>' +
      '<xhtml:link rel="alternate" hreflang="en" href="https://fiscalbay.it/en"/>';
    const urls = sitemapUrls(
      `<urlset><url><loc>https://fiscalbay.it/</loc>${alternates}</url>` +
        `<url><loc>https://fiscalbay.it/en</loc>${alternates}</url></urlset>`,
    );
    // Le alternate delle lingue non sono `<loc>` e non si ripetono.
    assert.deepEqual(urls, ["https://fiscalbay.it/", "https://fiscalbay.it/en"]);
    assert.equal(payload(urls).keyLocation, `https://fiscalbay.it/${indexNowKey}.txt`);
    assert.equal(payload(urls).host, "fiscalbay.it");
  });

  it("rifiuta indirizzi di un altro host", () => {
    assert.throws(() => payload(["https://test.fiscalbay.it/"]), /fuori da fiscalbay\.it/u);
  });
});
