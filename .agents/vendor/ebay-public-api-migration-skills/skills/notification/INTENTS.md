# Intent Navigation Guide

Answer rule:

- When the selected `references/operation-mapping.md` entry includes guide-
  derived caveats, fallback notes, or payload-activity values, include those
  points in the answer instead of returning only the replacement name.
- Do not mention internal package file names or paths in the final answer.
   Use them only as lookup aids while composing partner-facing guidance.
- Do not answer a migration question with only an internal reference such as
   `INDEX.md` or `operation-mapping.md`; summarize the migration result
   directly.
- Unless the user explicitly asks for a brief summary, include at least one
   concrete example in the final answer when a matching `_example.md` file is
   available for the legacy operation, legacy event, or modern replacement.
- If the modern replacement is a topic and no modern `_example.md` file is
  available, still include a concrete fallback example using the bundled
  legacy example plus the documented modern topic name and payload
  discriminator fields or values.

## Intent: Migrate legacy notification preferences

Use this for `GetNotificationPreferences` or `SetNotificationPreferences`.

Recommended workflow:

1. Start with [references/operation-mapping.md](./references/operation-mapping.md#notification-api-operations).
2. Read [rules/notification-subscription-model.md](./rules/notification-subscription-model.md).
3. Use the bundled legacy Notification API doc file.
4. For the modern side, use the matching operation-specific modern method doc
   under `references/operations/`.
5. Use the matching legacy or modern `_example.md` file and include a short
   request, response, or payload illustration in the answer by default.

## Intent: Migrate one legacy platform event

Use this when the prompt names a specific event such as `BestOffer`,
`FeedbackReceived`, `BidPlaced`, or `EndOfAuction`.

Recommended workflow:

1. Start with the matching event entry in [references/operation-mapping.md](./references/operation-mapping.md#platform-event-mappings).
2. Read [rules/topic-consolidation-and-fallbacks.md](./rules/topic-consolidation-and-fallbacks.md) if the replacement is a grouped topic.
3. Use the matching legacy event doc file under `references/operations/`.
4. For the modern side, use the mapped topic doc under `references/operations/`.
5. When the replacement is a grouped topic, include the payload activity or
   reason value that identifies the legacy event inside the modern topic.
6. Include a short concrete example from the matching `_example.md` file when
   one exists so the answer shows what the migrated event looks like in
   practice.
7. If no modern topic example exists, use the legacy event example to show the
   old payload shape, then explain which modern topic and activity, status, or
   reason value the user should look for after migration.

## Intent: Explain grouped modern topics

Use this for `OFFER_ACTIVITY`, `AUCTION_ACTIVITY`, `NEW_MESSAGE`, or `LISTING`.

Recommended workflow:

1. Start with [rules/topic-consolidation-and-fallbacks.md](./rules/topic-consolidation-and-fallbacks.md).
2. Use the corresponding modern doc file under `references/operations/`.
3. Return the activity or reason value that distinguishes the legacy event in
   the modern payload.
4. Include a short payload example when a matching `_example.md` file exists.
5. If no modern topic example exists, provide a short fallback example built
   from the matching legacy example plus the documented modern discriminator
   fields, and make clear where the modern payload detail is still only
   doc-backed.

## Intent: Handle unresolved or conflicting status rows

Use this for `No Replacement`, `migration plan yet to be decided`, guide-only
fallbacks, or the `TokenRevocation` conflict.

Recommended workflow:

1. Confirm the status in [INDEX.md](./INDEX.md).
2. Read [rules/unresolved-event-statuses.md](./rules/unresolved-event-statuses.md).
3. If the row is guide-backed only, say so explicitly instead of promoting it
   to a confirmed mapping.

## Intent: Compare legacy and modern delivery models

Use this when the user asks how destination URLs, alert email, SOAP delivery,
or HTTP acknowledgements change in the modern flow.

Recommended workflow:

1. Start with [rules/notification-subscription-model.md](./rules/notification-subscription-model.md).
2. Use the relevant migration guide in [references/operation-mapping.md](./references/operation-mapping.md)
   for SOAP delivery, URL, and `200 OK` requirements.
3. Use the modern destination, config, or subscription method doc under
   `references/operations/` for the target-side split model.
4. Use the matching modern example file and include a short concrete request or
   response illustration by default so the delivery-model change is explicit.