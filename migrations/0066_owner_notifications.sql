-- Avvisi commerciali all'owner sul bot dell'ambiente (D219): una riga per fatto, con una chiave
-- univoca che lo identifica. Webhook Stripe, riconciliazione oraria e trigger possono vedere lo
-- stesso fatto più volte o insieme: la chiave lascia passare soltanto il primo. Le righe nascono
-- dai trigger sulle tabelle che registrano già il fatto, dalla rilettura delle prove concluse e
-- dalla disputa aperta, che non ha una riga propria, e partono nell'ordine di arrivo (`rowid`).
-- `detail` conserva soltanto piano, importi e istanti: mai email, nomi o dati dei buyer. Gli
-- avvisi di uno spazio escono con lo spazio, quelli dell'utente con l'utente; resta soltanto
-- l'avviso della cancellazione dell'account, senza spazio. La pulizia giornaliera elimina le
-- righe dopo trenta giorni.
CREATE TABLE owner_notifications (
  key TEXT PRIMARY KEY CHECK (length(key) BETWEEN 1 AND 300),
  kind TEXT NOT NULL CHECK (kind IN (
    'registered', 'admitted', 'store_linked', 'trial_started', 'trial_ended', 'purchase',
    'cancel_scheduled', 'renewal_unpaid', 'subscription_closed', 'refund', 'dispute_opened',
    'dispute_lost', 'financial_erasure', 'lifetime_seats', 'account_deleted'
  )),
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  detail TEXT NOT NULL CHECK (json_valid(detail)),
  occurred_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  -- Prossimo tentativo; null per il primo, dovuto subito.
  retry_at TEXT,
  claim_token TEXT,
  claimed_at TEXT,
  sent_at TEXT
);

CREATE INDEX owner_notifications_due_idx ON owner_notifications(status, retry_at);
CREATE INDEX owner_notifications_occurred_idx ON owner_notifications(occurred_at);
CREATE INDEX owner_notifications_workspace_idx ON owner_notifications(workspace_id);

-- Come per i passaggi dei KPI, dentro un trigger la risoluzione dei conflitti è quella
-- dell'istruzione esterna: ogni scrittura controlla quindi la chiave invece di usare un
-- `INSERT OR IGNORE`, e un fatto già avvisato non interrompe mai la scrittura che lo registra.

-- Registrazione completata, degli account che non sono admin.
CREATE TRIGGER registration_owner_notification
AFTER INSERT ON user_profiles
WHEN EXISTS (SELECT 1 FROM "user" u WHERE u.id = NEW.user_id AND u."admin" = 0)
  AND NOT EXISTS (SELECT 1 FROM owner_notifications WHERE key = 'registered:' || NEW.user_id)
BEGIN
  INSERT INTO owner_notifications (key, kind, detail, occurred_at)
  VALUES ('registered:' || NEW.user_id, 'registered',
    json_object('waitlisted', NEW.waitlisted_at IS NOT NULL), NEW.updated_at);
END;

-- Ammissione dalla lista d'attesa, dalla console o allo spegnimento della lista.
CREATE TRIGGER admission_owner_notification
AFTER UPDATE OF waitlisted_at ON user_profiles
WHEN OLD.waitlisted_at IS NOT NULL AND NEW.waitlisted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM owner_notifications WHERE key = 'admitted:' || NEW.user_id)
BEGIN
  INSERT INTO owner_notifications (key, kind, detail, occurred_at)
  VALUES ('admitted:' || NEW.user_id, 'admitted', json_object('since', OLD.waitlisted_at),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- Primo negozio dello spazio: il passaggio dei KPI, scritto una volta per spazio.
CREATE TRIGGER store_linked_owner_notification
AFTER INSERT ON workspace_funnel_steps
WHEN NEW.step = 'store_linked'
  AND NOT EXISTS (SELECT 1 FROM owner_notifications WHERE key = 'store_linked:' || NEW.workspace_id)
BEGIN
  INSERT INTO owner_notifications (key, kind, workspace_id, detail, occurred_at)
  VALUES ('store_linked:' || NEW.workspace_id, 'store_linked', NEW.workspace_id, '{}',
    NEW.occurred_at);
END;

CREATE TRIGGER trial_owner_notification
AFTER INSERT ON workspace_entitlements
WHEN NEW.source = 'trial'
  AND NOT EXISTS (SELECT 1 FROM owner_notifications WHERE key = 'trial_started:' || NEW.id)
BEGIN
  INSERT INTO owner_notifications (key, kind, workspace_id, detail, occurred_at)
  VALUES ('trial_started:' || NEW.id, 'trial_started', NEW.workspace_id,
    json_object('ends', NEW.ends_at), NEW.starts_at);
END;

-- Primo acquisto pagato dello spazio per mensile, annuale e lifetime. La periodicità di una
-- copertura Premium si riconosce dalla durata del periodo pagato, che Stripe fissa su un mese o
-- su un anno; i rinnovi e le coperture concesse non avvisano.
CREATE TRIGGER purchase_owner_notification
AFTER INSERT ON workspace_entitlements
WHEN NEW.source IN ('premium', 'lifetime') AND NEW.amount_paid > 0
  AND NOT EXISTS (SELECT 1 FROM workspace_entitlements e
    WHERE e.workspace_id = NEW.workspace_id AND e.id <> NEW.id AND e.source = NEW.source
      AND e.amount_paid > 0 AND (NEW.source = 'lifetime'
        OR (julianday(e.ends_at) - julianday(e.starts_at) > 62)
          = (julianday(NEW.ends_at) - julianday(NEW.starts_at) > 62)))
  AND NOT EXISTS (SELECT 1 FROM owner_notifications WHERE key = 'purchase:' || NEW.id)
BEGIN
  INSERT INTO owner_notifications (key, kind, workspace_id, detail, occurred_at)
  VALUES ('purchase:' || NEW.id, 'purchase', NEW.workspace_id,
    json_object('offer', CASE WHEN NEW.source = 'lifetime' THEN 'lifetime'
        WHEN julianday(NEW.ends_at) - julianday(NEW.starts_at) > 62 THEN 'annual'
        ELSE 'monthly' END,
      'amount', NEW.amount_paid, 'currency', NEW.currency),
    COALESCE(NEW.paid_at, NEW.starts_at));
END;

-- Rimborsi riusciti, parziali o totali: una riga per ogni nuova somma rimborsata.
CREATE TRIGGER refund_owner_notification
AFTER UPDATE OF amount_refunded ON workspace_entitlements
WHEN COALESCE(NEW.amount_refunded, 0) > COALESCE(OLD.amount_refunded, 0)
  AND NOT EXISTS (SELECT 1 FROM owner_notifications
    WHERE key = 'refund:' || NEW.id || ':' || NEW.amount_refunded)
BEGIN
  INSERT INTO owner_notifications (key, kind, workspace_id, detail, occurred_at)
  VALUES ('refund:' || NEW.id || ':' || NEW.amount_refunded, 'refund', NEW.workspace_id,
    json_object('offer', CASE WHEN NEW.source = 'lifetime' THEN 'lifetime'
        WHEN julianday(NEW.ends_at) - julianday(NEW.starts_at) > 62 THEN 'annual'
        ELSE 'monthly' END,
      'refunded', NEW.amount_refunded, 'paid', NEW.amount_paid, 'currency', NEW.currency),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

CREATE TRIGGER dispute_lost_owner_notification
AFTER UPDATE OF revocation ON workspace_entitlements
WHEN NEW.revocation = 'dispute' AND OLD.revocation IS NULL
  AND NOT EXISTS (SELECT 1 FROM owner_notifications WHERE key = 'dispute_lost:' || NEW.id)
BEGIN
  INSERT INTO owner_notifications (key, kind, workspace_id, detail, occurred_at)
  VALUES ('dispute_lost:' || NEW.id, 'dispute_lost', NEW.workspace_id,
    json_object('offer', CASE WHEN NEW.source = 'lifetime' THEN 'lifetime'
        WHEN julianday(NEW.ends_at) - julianday(NEW.starts_at) > 62 THEN 'annual'
        ELSE 'monthly' END,
      'paid', NEW.amount_paid, 'currency', NEW.currency),
    NEW.revoked_at);
END;

-- Disdetta dal portale. La chiusura che FiscalBay programma su un rinnovo non pagato, alla fine
-- della tutela del prezzo, non è una disdetta del cliente.
CREATE TRIGGER cancel_owner_notification
AFTER UPDATE OF cancel_at_period_end ON stripe_subscriptions
WHEN NEW.cancel_at_period_end = 1 AND OLD.cancel_at_period_end = 0
  AND NEW.status NOT IN ('past_due', 'unpaid')
  AND NOT EXISTS (SELECT 1 FROM owner_notifications
    WHERE key = 'cancel_scheduled:' || NEW.id || ':' || NEW.current_period_end)
BEGIN
  INSERT INTO owner_notifications (key, kind, workspace_id, detail, occurred_at)
  VALUES ('cancel_scheduled:' || NEW.id || ':' || NEW.current_period_end, 'cancel_scheduled',
    NEW.workspace_id, json_object('offer', NEW.offer, 'ends', NEW.current_period_end),
    NEW.synced_at);
END;

CREATE TRIGGER unpaid_owner_notification
AFTER UPDATE OF status ON stripe_subscriptions
WHEN NEW.status IN ('past_due', 'unpaid') AND OLD.status NOT IN ('past_due', 'unpaid')
  AND NOT EXISTS (SELECT 1 FROM owner_notifications
    WHERE key = 'renewal_unpaid:' || NEW.id || ':' || NEW.current_period_start)
BEGIN
  INSERT INTO owner_notifications (key, kind, workspace_id, detail, occurred_at)
  VALUES ('renewal_unpaid:' || NEW.id || ':' || NEW.current_period_start, 'renewal_unpaid',
    NEW.workspace_id, json_object('offer', NEW.offer), NEW.synced_at);
END;

-- Chiusura di un abbonamento che aveva incassato: un checkout mai pagato non lo è.
CREATE TRIGGER closed_owner_notification
AFTER UPDATE OF status ON stripe_subscriptions
WHEN NEW.status = 'canceled' AND OLD.status NOT IN ('canceled', 'incomplete', 'incomplete_expired')
  AND NOT EXISTS (SELECT 1 FROM owner_notifications WHERE key = 'subscription_closed:' || NEW.id)
BEGIN
  INSERT INTO owner_notifications (key, kind, workspace_id, detail, occurred_at)
  VALUES ('subscription_closed:' || NEW.id, 'subscription_closed', NEW.workspace_id,
    json_object('offer', NEW.offer, 'unpaid', OLD.status IN ('past_due', 'unpaid')),
    NEW.synced_at);
END;

CREATE TRIGGER erasure_owner_notification
AFTER INSERT ON stripe_customer_erasures
WHEN NOT EXISTS (SELECT 1 FROM owner_notifications
  WHERE key = 'financial_erasure:' || NEW.customer_id)
BEGIN
  INSERT INTO owner_notifications (key, kind, workspace_id, detail, occurred_at)
  VALUES ('financial_erasure:' || NEW.customer_id, 'financial_erasure',
    COALESCE((SELECT workspace_id FROM stripe_subscriptions WHERE customer_id = NEW.customer_id
        AND environment = NEW.environment LIMIT 1),
      (SELECT workspace_id FROM lifetime_allocations WHERE customer_id = NEW.customer_id LIMIT 1)),
    json_object('origin', NEW.source), NEW.received_at);
END;

-- Posti lifetime attivi, venduti o in omaggio: avviso quando ne restano cinque, due e nessuno.
-- Un posto attivo non torna disponibile, quindi ogni soglia si attraversa una volta sola.
CREATE TRIGGER lifetime_sold_owner_notification
AFTER UPDATE OF status ON lifetime_allocations
WHEN NEW.status = 'active' AND OLD.status = 'reserved'
  AND 20 - (SELECT COUNT(*) FROM lifetime_allocations WHERE status = 'active') IN (5, 2, 0)
  AND NOT EXISTS (SELECT 1 FROM owner_notifications WHERE key = 'lifetime_seats:'
    || (20 - (SELECT COUNT(*) FROM lifetime_allocations WHERE status = 'active')))
BEGIN
  INSERT INTO owner_notifications (key, kind, workspace_id, detail, occurred_at)
  SELECT 'lifetime_seats:' || (20 - COUNT(*)), 'lifetime_seats', NULL,
    json_object('left', 20 - COUNT(*), 'total', 20), NEW.activated_at
  FROM lifetime_allocations WHERE status = 'active';
END;

CREATE TRIGGER lifetime_granted_owner_notification
AFTER INSERT ON lifetime_allocations
WHEN NEW.status = 'active'
  AND 20 - (SELECT COUNT(*) FROM lifetime_allocations WHERE status = 'active') IN (5, 2, 0)
  AND NOT EXISTS (SELECT 1 FROM owner_notifications WHERE key = 'lifetime_seats:'
    || (20 - (SELECT COUNT(*) FROM lifetime_allocations WHERE status = 'active')))
BEGIN
  INSERT INTO owner_notifications (key, kind, workspace_id, detail, occurred_at)
  SELECT 'lifetime_seats:' || (20 - COUNT(*)), 'lifetime_seats', NULL,
    json_object('left', 20 - COUNT(*), 'total', 20), NEW.activated_at
  FROM lifetime_allocations WHERE status = 'active';
END;

-- Richiesta di cancellazione dell'account, con la copertura pagata ancora in corso. L'avviso
-- non si lega allo spazio, che sta per uscire con i suoi avvisi.
CREATE TRIGGER account_deletion_owner_notification
AFTER INSERT ON account_deletions
WHEN NOT EXISTS (SELECT 1 FROM owner_notifications WHERE key = 'account_deleted:' || NEW.id)
BEGIN
  INSERT INTO owner_notifications (key, kind, detail, occurred_at)
  VALUES ('account_deleted:' || NEW.id, 'account_deleted',
    json_object('paid', EXISTS (SELECT 1 FROM workspace_entitlements e
      WHERE e.workspace_id = NEW.workspace_id AND e.revoked_at IS NULL
        AND e.source IN ('premium', 'lifetime') AND e.amount_paid > 0
        AND julianday(e.starts_at) <= julianday(NEW.requested_at)
        AND (e.ends_at IS NULL OR julianday(e.ends_at) > julianday(NEW.requested_at)))),
    NEW.requested_at);
END;

-- Con l'utente escono anche gli avvisi la cui chiave porta il suo identificativo.
CREATE TRIGGER user_owner_notifications_cleanup
AFTER DELETE ON "user"
BEGIN
  DELETE FROM owner_notifications WHERE key IN ('registered:' || OLD.id, 'admitted:' || OLD.id);
END;
