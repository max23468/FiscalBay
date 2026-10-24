// @ts-nocheck
// Diagnostica temporanea, da rimuovere: storia interna di `networkidle` per frame in CI.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const store = "node_modules/.pnpm";
const core = readdirSync(store).find((name) => name.startsWith("playwright-core@"));
const file = `${store}/${core}/node_modules/playwright-core/lib/coreBundle.js`;
let s = readFileSync(file, "utf8");
if (!s.includes("__idleTrace")) {
  const rep = (a, b) => {
    if (!s.includes(a)) throw new Error(`networkidle-trace: missing ${a.slice(0, 60)}`);
    s = s.replace(a, b);
  };
  const H = (frame, msg) =>
    `((${frame}).__h ??= [], (${frame}).__last = Date.now(), (${frame}).__dumped = false, (${frame}).__h.push(Date.now()%1000000+" "+${msg}), (${frame}).__h.length>200 && (${frame}).__h.shift());`;
  rep(
    `        this._inflightRequests = /* @__PURE__ */ new Set();`,
    `        this._inflightRequests = /* @__PURE__ */ new Set();
        if (!globalThis.__idleTrace) {
          globalThis.__idleTrace = new Set();
          setInterval(() => {
            for (const f of globalThis.__idleTrace) {
              if (f.__dumped || !f.__clearedAt || f._detachedScope.isClosed() || f._page.isClosed()) continue;
              if (!f._firedLifecycleEvents.has("load") || f._firedLifecycleEvents.has("networkidle")) continue;
              if (Date.now() - (f.__last ?? 0) < 8000) continue;
              f.__dumped = true;
              process.stderr.write("IDLE-TRACE stuck " + f._url + " inflight=[" + [...f._inflightRequests].map((r) => r.url() + "|" + r.resourceType() + "|doc=" + r._documentId) + "] fired=[" + [...f._firedLifecycleEvents] + "] timer=" + !!f._networkIdleTimer + " self=" + f._firedNetworkIdleSelf + " children=" + f._childFrames.size + "\\n" + (f.__h ?? []).map((l) => "IDLE-TRACE   " + l).join("\\n") + "\\n");
            }
          }, 2000).unref();
        }
        globalThis.__idleTrace.add(this);`,
  );
  rep(
    `        frame._inflightRequests.add(request2);
        if (frame._inflightRequests.size === 1)`,
    `        frame._inflightRequests.add(request2);
        ${H("frame", '"INF+ "+request2.url()+" "+request2.resourceType()+" doc="+request2._documentId+" n="+frame._inflightRequests.size')}
        if (frame._inflightRequests.size === 1)`,
  );
  rep(
    `        if (!frame._inflightRequests.has(request2))
          return;
        frame._inflightRequests.delete(request2);`,
    `        if (!frame._inflightRequests.has(request2)) {
          ${H("frame", '"INF-skip "+request2.url()')}
          return;
        }
        frame._inflightRequests.delete(request2);
        ${H("frame", '"INF- "+request2.url()+" n="+frame._inflightRequests.size')}`,
  );
  rep(
    `        this._inflightRequests = new Set(Array.from(this._inflightRequests).filter((request2) => request2 === this._currentDocument.request));`,
    `        this.__clearedAt = Date.now(); this.__dumped = false;
        ${H("this", '"CLEAR url="+this._url+" doc="+this._currentDocument.documentId+" before=["+Array.from(this._inflightRequests).map(r=>r.url())+"] cur="+(this._currentDocument.request&&this._currentDocument.request.url())')}
        this._inflightRequests = new Set(Array.from(this._inflightRequests).filter((request2) => request2 === this._currentDocument.request));`,
  );
  rep(
    `        assert(!this._networkIdleTimer);
        if (this._firedLifecycleEvents.has("networkidle") || this._detachedScope.isClosed())
          return;
        this._networkIdleTimer = setTimeout(() => {
          this._firedNetworkIdleSelf = true;`,
    `        ${H("this", '"START timer="+!!this._networkIdleTimer+" fired="+[...this._firedLifecycleEvents]')}
        assert(!this._networkIdleTimer);
        if (this._firedLifecycleEvents.has("networkidle") || this._detachedScope.isClosed())
          return;
        this._networkIdleTimer = setTimeout(() => {
          ${H("this", '"IDLE-SELF"')}
          this._firedNetworkIdleSelf = true;`,
  );
  rep(
    `      _stopNetworkIdleTimer() {
        if (this._networkIdleTimer)`,
    `      _stopNetworkIdleTimer() {
        ${H("this", '"STOP timer="+!!this._networkIdleTimer')}
        if (this._networkIdleTimer)`,
  );
  rep(
    `      onLifecycleEvent(event) {
        if (this._firedLifecycleEvents.has(event))
          return;`,
    `      onLifecycleEvent(event) {
        ${H("this", '"LIFE "+event')}
        if (this._firedLifecycleEvents.has(event))
          return;`,
  );
  rep(
    `          this._firedLifecycleEvents.add("networkidle");`,
    `          this._firedLifecycleEvents.add("networkidle");
          ${H("this", '"NETWORKIDLE-FIRED"')}`,
  );
  rep(
    `          this._firedLifecycleEvents.delete("networkidle");`,
    `          this._firedLifecycleEvents.delete("networkidle");
          ${H("this", '"NETWORKIDLE-REMOVED"')}`,
  );
  rep(
    `      _onDetached() {
        this._stopNetworkIdleTimer();`,
    `      _onDetached() {
        globalThis.__idleTrace?.delete(this);
        this._stopNetworkIdleTimer();`,
  );
  writeFileSync(file, s);
  console.log(`networkidle-trace: ${file}`);
}
