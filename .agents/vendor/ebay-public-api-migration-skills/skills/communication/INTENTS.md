# Intent Navigation Guide

Answer rule:

- When the selected `references/operation-mapping.md` entry includes guide-derived `Migration Guide:` bullets such as `Key changes`, `Key things to know`, prerequisites, sequencing, or caveats, include those points in the answer instead of returning only the replacement name.

## Intent: Migrate feedback retrieval

Use this when the traditional task mentions `GetFeedback` or feedback browsing.

Recommended workflow:

1. Start with [references/operation-mapping.md](./references/operation-mapping.md#feedback-retrieval-and-response).
2. Check [rules/feedback-retrieval-and-ratings.md](./rules/feedback-retrieval-and-ratings.md) for the split between detailed entries and aggregate metrics.
3. Use [references/operations/GetFeedback_doc.md](./references/operations/GetFeedback_doc.md) for the traditional SOAP extract.
4. Use [references/operations/getFeedback_doc.md](./references/operations/getFeedback_doc.md) and [references/operations/getFeedbackRatingSummary_doc.md](./references/operations/getFeedbackRatingSummary_doc.md) for the modern side.

## Intent: Leave or reply to feedback

Use this when the task is about `LeaveFeedback` or `RespondToFeedback`.

Recommended workflow:

1. Start with the matching entry in [references/operation-mapping.md](./references/operation-mapping.md#feedback-retrieval-and-response).
2. Use [references/operations/leaveFeedback_example.md](./references/operations/leaveFeedback_example.md) or [references/operations/respondToFeedback_example.md](./references/operations/respondToFeedback_example.md) for concrete REST payloads.
3. Keep line-item identifiers, comment content, and seller-rating semantics aligned with the Feedback API examples.

## Intent: Send a buyer or seller message

Use this for `AddMemberMessageAAQToPartner`, `AddMemberMessageRTQ`, or `AddMemberMessagesAAQToBidder`.
Use it also when the user directly asks about the `sendMessage` API or how to migrate to the modern message-send endpoint.

Recommended workflow:

1. Read [rules/messaging-conversation-model.md](./rules/messaging-conversation-model.md) first.
2. Use the relevant entry in [references/operation-mapping.md](./references/operation-mapping.md#message-send-operations).
3. Use [references/operations/sendMessage_example.md](./references/operations/sendMessage_example.md) for a concrete modern request.
4. Use [references/operations/sendMessage_doc.md](./references/operations/sendMessage_doc.md) for the bundled modern operation extract.

## Intent: Migrate to the sendMessage API

Use this when the prompt names `sendMessage`, `send_message`, or asks how to migrate a traditional member-message flow into the Message API send method.

Recommended workflow:

1. Start with [references/operation-mapping.md](./references/operation-mapping.md#message-send-operations).
2. Read [rules/messaging-conversation-model.md](./rules/messaging-conversation-model.md) to confirm the conversation-centric model.
3. Use [references/operations/sendMessage_example.md](./references/operations/sendMessage_example.md) for modern request and response payloads, including message attachments.
4. Use [references/operations/sendMessage_doc.md](./references/operations/sendMessage_doc.md) for the bundled public operation notes.

## Intent: Retrieve messages or inbox conversations

Use this for `GetMemberMessages` or `GetMyMessages`.

Recommended workflow:

1. Start with [references/operation-mapping.md](./references/operation-mapping.md#conversation-retrieval-operations).
2. Use [references/operations/getConversations_example.md](./references/operations/getConversations_example.md) to understand collection retrieval.
3. Use [references/operations/getConversation_example.md](./references/operations/getConversation_example.md) when the workflow already knows the conversation ID.
4. Keep in mind that the modern API is conversation-centric rather than folder- or message-centric.

## Intent: Update read, archive, or delete state

Use this for `ReviseMyMessages` or `DeleteMyMessages`.

Recommended workflow:

1. Start with [rules/messaging-conversation-model.md](./rules/messaging-conversation-model.md).
2. Read the matching entry in [references/operation-mapping.md](./references/operation-mapping.md#conversation-state-operations).
3. Use [references/operations/updateConversation_example.md](./references/operations/updateConversation_example.md) for single-conversation changes.
4. Use [references/operations/bulkUpdateConversation_example.md](./references/operations/bulkUpdateConversation_example.md) for batch state changes.

## Intent: Confirm an unsupported inbox feature

Use this for `ReviseMyMessagesFolders`, `GetMessagePreferences`, or `SetMessagePreferences`.

Recommended workflow:

1. Start with [references/operation-mapping.md](./references/operation-mapping.md#unsupported-or-decommissioned-communication-features).
2. Confirm whether the status is `Decommission` or `No replacement` in [INDEX.md](./INDEX.md).
3. Use the traditional support file only for contextual purpose; do not invent a modern payload or replacement operation.