# Messaging Conversation Model

## Rule

Traditional message flows migrate to conversation resources, not standalone inbox-message records.

## What Changes

- Use `sendMessage` to create a new conversation or append to an existing conversation.
- Use `getConversations` to list matching conversations and obtain conversation identifiers.
- Use `getConversation` when the workflow already knows the target `conversationId`.
- Use `updateConversation` or `bulkUpdateConversation` to change conversation state.

## Migration Impact

- Folder-oriented behavior from traditional inbox APIs does not carry forward.
- State changes are limited to conversation status and read-state style updates.
- Any migration plan that depends on message-folder organization or custom Ask Seller Question subjects must be rewritten around conversation filters and statuses instead.

## Verified Public Guidance

- The sell communications guide states that messaging is grouped into a conversation object even when only one message exists.
- The guide also states that `ReviseMyMessages` changes become conversation-status updates and that folder-management behavior is not preserved.
- The Message API schema shows the modern resources `/send_message`, `/conversation`, `/conversation/{conversation_id}`, `/conversation/update_conversation`, and `/bulk_update_conversation`.