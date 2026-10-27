# Unresolved Event Statuses

- Preserve `No Replacement` exactly when the bundled migration mapping says
  `No Replacement`.
- Preserve `migration plan yet to be decided` exactly when the bundled
  migration mapping says so.
- When answering about unresolved rows, state the status directly in the
  response instead of pointing the user to internal lookup files.
- Do not generalize a grouped no-migration heading into the reason for every
  event in that group. Prefer row-specific comments, notes, payload text, or
  guide row text when present; otherwise preserve only the unresolved status
  and event name.
- Treat blank replacement rows as unresolved unless a bundled guide gives a
  fallback or grouped-topic note, and label those rows guide-backed rather than
  confirmed replacements.
- For `TokenRevocation`, the bundled migration mapping lists `authorization
  revocation` while the bundled migration guide still lists the event as
  pending. Prefer `authorization_revocation` as the replacement name, but call
  out the conflict and mark it `Requires confirmation` when precision matters.
- Do not invent a modern topic, endpoint, or payload for unresolved rows.
- If the prompt asks about multiple unresolved events, list each event with the
  same unresolved status instead of collapsing them into one generic answer.