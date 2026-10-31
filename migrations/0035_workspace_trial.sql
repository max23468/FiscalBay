-- Una sola prova per spazio, anche dopo la scadenza o una revoca: non riparte e non si ripete.
CREATE UNIQUE INDEX workspace_entitlements_trial_idx ON workspace_entitlements(workspace_id)
  WHERE source = 'trial';
