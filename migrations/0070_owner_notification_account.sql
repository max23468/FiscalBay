-- L'avviso della cancellazione dell'account conserva email, nome e ragione sociale letti alla
-- richiesta: l'utente esce prima dell'invio, mentre gli altri avvisi li rileggono all'invio. La
-- riga resta al più trenta giorni, come ogni avviso.
DROP TRIGGER account_deletion_owner_notification;
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
        AND (e.ends_at IS NULL OR julianday(e.ends_at) > julianday(NEW.requested_at))),
      'email', (SELECT u."email" FROM "user" u WHERE u."id" = NEW.user_id),
      'name', (SELECT p.first_name || ' ' || p.last_name FROM user_profiles p
        WHERE p.user_id = NEW.user_id),
      'company', (SELECT p.company_name FROM user_profiles p WHERE p.user_id = NEW.user_id)),
    NEW.requested_at);
END;
