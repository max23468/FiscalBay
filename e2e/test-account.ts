/**
 * Account di collaudo del dominio di test: identificativi fissi, riscritti da
 * `scripts/reset-test-account.mjs` prima dei controlli dopo il deploy. I codici fiscali sono
 * sintetici; il secondo appartiene a un ordine bloccato e non deve mai arrivare al browser.
 */
export const testAccount = {
  email: "collaudo@example.invalid",
  userId: "collaudo-test",
  workspaceId: "collaudo-test-spazio",
  stores: {
    active: "collaudo-attivo",
    expiring: "collaudo-in-scadenza",
    expired: "collaudo-scaduto",
    paused: "collaudo-in-pausa",
  },
  orders: { unlocked: "00-00000-00001", locked: "00-00000-00002" },
  taxCodes: { unlocked: "RSSMRA80A01H501U", locked: "BNCLGU80A01H501Z" },
} as const;
