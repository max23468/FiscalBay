import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";
import { serverCommand, serverPackage } from "./ebay-mcp.mjs";

describe("server MCP eBay per gli agenti", () => {
  const keyset = { clientId: " id \n", clientSecret: "segreto\n" };

  it("avvia la versione fissata in modalità applicazione Production", () => {
    const { command, args, options } = serverCommand(keyset, { PATH: "/bin" });
    assert.equal(command, "npx");
    assert.deepEqual(args, ["--yes", serverPackage]);
    assert.match(serverPackage, /@\d+\.\d+\.\d+$/u);
    assert.equal(options.env.EBAY_TOKEN_TYPE, "application");
    assert.equal(options.env.EBAY_API_ENV, "production");
    assert.equal(options.env.EBAY_CLIENT_ID, "id");
    assert.equal(options.env.EBAY_CLIENT_SECRET, "segreto");
    assert.equal(options.env.npm_config_ignore_scripts, "true");
    assert.equal(options.env.PATH, "/bin");
  });

  it("non eredita token utente né configurazioni eBay e non parte dal checkout", () => {
    const { options } = serverCommand(keyset, {
      EBAY_TOKEN_TYPE: "user",
      EBAY_REFRESH_TOKEN: "refresh",
      EBAY_API_DOC_URL_FILE: "/tmp/spec",
    });
    assert.equal(options.env.EBAY_REFRESH_TOKEN, undefined);
    assert.equal(options.env.EBAY_API_DOC_URL_FILE, undefined);
    assert.equal(options.env.EBAY_TOKEN_TYPE, "application");
    assert.equal(options.cwd, tmpdir());
  });

  it("rifiuta un keyset incompleto", () => {
    assert.throws(() => serverCommand({ clientId: "id", clientSecret: " " }), /missing_keyset/u);
    assert.throws(
      () => serverCommand({ clientId: undefined, clientSecret: "x" }),
      /missing_keyset/u,
    );
  });
});
