---
name: communication
description: |
  Migration guidance for traditional messaging and feedback to Feedback API and Message API conversation workflows.

  Trigger when user mentions: GetFeedback/LeaveFeedback/RespondToFeedback/GetItemsAwaitingFeedback -> Feedback API; AddMemberMessageAAQToPartner/AddMemberMessageRTQ/AddMemberMessagesAAQToBidder -> sendMessage; GetMemberMessages/GetMyMessages -> getConversation/getConversations; ReviseMyMessages/DeleteMyMessages -> updateConversation/bulkUpdateConversation; or asks "how do I migrate My Messages or feedback calls".

  Covers 14 traditional operations including feedback retrieval and response, partner and bidder messaging, inbox state changes, and explicit no-replacement folder or preference rows.
  Do NOT use for order cases, returns, or listing lifecycle tasks.
---

# Communication Migration Skill

This skill covers the canonical Communication domain from `sources/api-mapping.csv`, specifically the `Messaging and Feedback` rows grouped under `Communication`.

## When To Apply

Use this package when you need to:

- migrate traditional feedback calls to the Feedback API
- convert traditional member-message flows to the Message API conversation model
- answer prompts that explicitly mention `sendMessage API` or the Message API conversation endpoints
- understand the split mapping `GetFeedback -> getFeedback + getFeedbackRatingSummary`
- choose between conversation collection retrieval and single-conversation retrieval
- confirm when inbox folder management or Ask Seller Question preference management has no public replacement

## Key Migration Patterns

- Feedback moves to REST and becomes line-item-centric. Retrieval, submission, response, and rating summaries are separate methods.
- Messaging moves from My Messages records and folders to conversation resources with explicit conversation IDs, conversation types, and conversation statuses.
- `ReviseMyMessages` splits into single-conversation and batch conversation-state updates.
- `DeleteMyMessages` becomes a conversation-level status transition rather than a per-message delete flow.
- `ReviseMyMessagesFolders`, `GetMessagePreferences`, and `SetMessagePreferences` remain explicit no-replacement outcomes.

## Workflow Notes

- Start with [INDEX.md](./INDEX.md) for the authoritative Communication inventory.
- Use [INTENTS.md](./INTENTS.md) when the migration task is framed by workflow rather than by operation name.
- Use [references/operation-mapping.md](./references/operation-mapping.md) for the consolidated traditional-to-modern mapping narrative and payload transformation examples.
- Use [rules/messaging-conversation-model.md](./rules/messaging-conversation-model.md) before migrating member-message retrieval, send, update, or delete flows.
- Use [rules/feedback-retrieval-and-ratings.md](./rules/feedback-retrieval-and-ratings.md) before migrating feedback retrieval, ratings, or reply workflows.

## Evidence Boundaries

- Bundled REST doc pages, usage examples, and REST schema exist for the Feedback API operations in this domain.
- Bundled REST doc pages, usage examples, and REST schema also exist for the Message API operations in this domain.
- This package intentionally stays anchored to the canonical Communication CSV slice and does not add notification-management calls that are outside that inventory.

## Field-Level Details

Field-level request and response details and field-by-field mapping are not provided in this skill, even if explicitly requested. For field definitions, refer to the official eBay developer documentation page.
