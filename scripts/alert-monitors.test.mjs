import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { checkReadback, d1StopBytes, desiredMonitors, targetOf } from "./alert-monitors.mjs";
import { alertEmail } from "./zone-protection.mjs";

describe("monitor degli avvisi", () => {
  const live = targetOf("live");
  const desired = desiredMonitors(live, "coda-falliti");

  it("legge Worker, coda dei falliti e database dell'ambiente", () => {
    assert.equal(live.worker, "fiscalbay");
    assert.equal(live.failedQueue, "fiscalbay-webhooks-failed");
    assert.equal(targetOf("test").worker, "fiscalbay-test");
    assert.notEqual(targetOf("test").database, live.database);
  });

  it("restano nelle cinque policy dell'account, con l'avviso all'owner", () => {
    assert.equal(desired.length, 5);
    for (const policy of desired) {
      assert.equal(policy.alert_type, "custom_analytics");
      assert.deepEqual(policy.mechanisms.email, [{ id: alertEmail }]);
      // Ogni query filtra l'account, come chiede il provider.
      assert.match(policy.filters.selectors[0], new RegExp(`accountTag = '${live.account}'`, "u"));
    }
    const [cron, , failed, storage, email] = desired.map(({ filters }) => filters);
    assert.match(cron.selectors[0], /scriptName = 'fiscalbay' .*invocationType = 'scheduled'/u);
    assert.match(failed.selectors[0], /queueId = 'coda-falliti'/u);
    assert.deepEqual(storage.alert_trigger_preferences_value, [String(d1StopBytes)]);
    assert.deepEqual(storage.execution_interval, ["1h"]);
    assert.match(email.selectors[0], /NOT LIKE '%\.invalid'/u);
  });

  it("segnala un monitor assente, doppio o diverso da quello previsto", () => {
    const read = () => desired.map((policy) => ({ ...structuredClone(policy), id: policy.name }));
    assert.equal(checkReadback(desired, read()).ok, true);
    const missing = read().slice(1);
    assert.equal(checkReadback(desired, missing).checks["fiscalbay cron fermo"], false);
    const doubled = [...read(), read()[1]];
    assert.equal(checkReadback(desired, doubled).checks["fiscalbay eccezioni"], false);
    const changed = read();
    changed[2].filters.alert_trigger_preferences_value = ["5"];
    assert.equal(checkReadback(desired, changed).checks["fiscalbay coda dei falliti"], false);
    const disabled = read();
    disabled[3].enabled = false;
    assert.equal(checkReadback(desired, disabled).ok, false);
  });
});
