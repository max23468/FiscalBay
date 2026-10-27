# Communication Operation Mapping

## Feedback Retrieval And Response

### GetItemsAwaitingFeedback -> getItemsAwaitingFeedback
Purpose:
- Retrieve line items for which the current user still owes feedback as buyer, seller, or both.

Modern API:
- Feedback API: GET /commerce/feedback/v1/awaiting_feedback
- Full traditional doc extract: operations/GetItemsAwaitingFeedback_doc.md
- Full modern doc extract: operations/getItemsAwaitingFeedback_doc.md
- Full modern example: operations/getItemsAwaitingFeedback_example.md

Key Differences:
- The modern API returns pending-feedback work at the line-item level.
- Buyer and seller pending counts are explicit in the response.
- Rating templates are returned with the work items so clients can render allowed scoring inputs.

Request Payload Transformation:

- Traditional: [GetItemsAwaitingFeedback_example.md](operations/GetItemsAwaitingFeedback_example.md)
- Modern: [getItemsAwaitingFeedback_example.md](operations/getItemsAwaitingFeedback_example.md)



Response Payload Transformation:

- Traditional: [GetItemsAwaitingFeedback_example.md](operations/GetItemsAwaitingFeedback_example.md)
- Modern: [getItemsAwaitingFeedback_example.md](operations/getItemsAwaitingFeedback_example.md)



Migration Guide:
- getItemsAwaitingFeedback method of Feedback API
- Key behaviors/changes:
  - The filter query parameter allows a user to retrieve items awaiting feedback for a specific listing or from a specific order partner
  - The filter query parameter also allows a user to set their userRole as SELLER or BUYER to only retrieve items awaiting feedback from either of those roles
  - Items can only be sorted by transaction/commitment time
  - A new ratingTemplates is returned to assist buyer in leaving detailed seller ratings for sellers

### GetFeedback -> getFeedback / getFeedbackRatingSummary
Purpose:
- Retrieve either detailed feedback entries or aggregated seller feedback metrics.

Modern API:
- Feedback API: GET /commerce/feedback/v1/feedback
- Feedback API: GET /commerce/feedback/v1/feedback_rating_summary
- Full traditional doc extract: operations/GetFeedback_doc.md
- Full modern doc extract: operations/getFeedback_doc.md
- Full modern doc extract: operations/getFeedbackRatingSummary_doc.md
- Full modern examples: operations/getFeedback_example.md, operations/getFeedbackRatingSummary_example.md

Key Differences:
- One traditional call splits into detailed-entry retrieval and aggregate-summary retrieval.
- Modern filtering is more explicit for roles, comment types, AI topics, listing IDs, and order line item IDs.
- Rating summaries are separate from detailed feedback entries.

Request Payload Transformation:

- Traditional: [GetFeedback_example.md](operations/GetFeedback_example.md)
- Modern: [getFeedbackRatingSummary_example.md](operations/getFeedbackRatingSummary_example.md), [getFeedback_example.md](operations/getFeedback_example.md)



Response Payload Transformation:

- Traditional: [GetFeedback_example.md](operations/GetFeedback_example.md)
- Modern: [getFeedbackRatingSummary_example.md](operations/getFeedbackRatingSummary_example.md), [getFeedback_example.md](operations/getFeedback_example.md)



Migration Guide:
- getFeedback method of Feedback API (for user feedback entries):
  - The user to retrieve feedback for is specified through the user_id query parameter
  - The feedback_type is also required and is set to either FEEDBACK_RECEIVED or FEEDBACK_SENT
  - The same request filters available through the traditional API are also available through the REST API
  - Additionally, the filter query parameter can be used to retrieve feedback based on certain topics, feedback with associated images, and automated feedback left by eBay
  - Pagination control supported
- getFeedbackRatingSummary method of Feedback API (for user feedback metrics):
  - The user to retrieve feedback metrics for is specified through the user_id query parameter
  - Multiple filters and filter values are available through the filter query parameter, but the ratingType filter must be used, and the supported rating types are defined in the FeedbackRatingTypeEnum type
  - The response of this method will vary based on the ratingType that is used

### LeaveFeedback -> leaveFeedback
Purpose:
- Submit buyer or seller feedback for a completed order line item.

Modern API:
- Feedback API: POST /commerce/feedback/v1/feedback
- Full traditional doc extract: operations/LeaveFeedback_doc.md
- Full modern doc extract: operations/leaveFeedback_doc.md
- Full modern example: operations/leaveFeedback_example.md

Key Differences:
- The modern request is JSON and centered on listing and transaction identifiers.
- Buyers can provide seller ratings in addition to the overall comment.
- A successful response returns a modern feedbackId value.

Request Payload Transformation:

- Traditional: [LeaveFeedback_example.md](operations/LeaveFeedback_example.md)
- Modern: [leaveFeedback_example.md](operations/leaveFeedback_example.md)



Response Payload Transformation:

- Traditional: [LeaveFeedback_example.md](operations/LeaveFeedback_example.md)
- Modern: [leaveFeedback_example.md](operations/leaveFeedback_example.md)



Migration Guide:
- leaveFeedback method of Feedback API
- Key behaviors/changes:
  - New method can associate up to five images with the feedback comment by passing in URL to images
  - Detailed seller ratings are provided through key-value pairs in the sellerRatings array
  - When providing ratings in the sellerRatings array, the getItemsAwaitingFeedback method can be used to see the supported values for detailed seller ratings by looking at the ratingTemplates array in the response

### RespondToFeedback -> respondToFeedback
Purpose:
- Reply to feedback previously left by the order partner.

Modern API:
- Feedback API: POST /commerce/feedback/v1/respond_to_feedback
- Full traditional doc extract: operations/RespondToFeedback_doc.md
- Full modern doc extract: operations/respondToFeedback_doc.md
- Full modern example: operations/respondToFeedback_example.md

Key Differences:
- The modern API is a dedicated response method rather than an overloaded feedback retrieval or mutation flow.
- The capability only applies when partner feedback already exists and no reply has yet been submitted.

Request Payload Transformation:

- Traditional: [RespondToFeedback_example.md](operations/RespondToFeedback_example.md)
- Modern: [respondToFeedback_example.md](operations/respondToFeedback_example.md)



Response Payload Transformation:

- Traditional: [RespondToFeedback_example.md](operations/RespondToFeedback_example.md)
- Modern: [respondToFeedback_example.md](operations/respondToFeedback_example.md)


HTTP 200 Success (no response body returned on success)

Migration Guide:
- respondToFeedback method of Feedback API
- Key behaviors/changes:
  - The feedbackId, recipientUserId, responseText, and responseType are all specified in the request and are required

## Message Send Operations

### AddMemberMessageAAQToPartner -> sendMessage
Purpose:
- Let buyer and seller order partners exchange a message through the modern conversation model.

Modern API:
- Message API: POST /commerce/message/v1/send_message
- Full traditional doc extract: operations/AddMemberMessageAAQToPartner_doc.md
- Full modern doc extract: operations/sendMessage_doc.md
- Full modern example: operations/sendMessage_example.md

Key Differences:
- The modern API uses a conversation resource instead of the traditional My Messages shape.
- Either conversationId or otherPartyUsername determines whether the request appends to an existing conversation or starts a new one.
- Media attachments are part of the modern request and response examples; use the bundled `sendMessage_example.md` file when the migration needs image or document evidence.
- Custom Ask Seller Question subjects are no longer supported.

Request Payload Transformation:

- Traditional: [AddMemberMessageAAQToPartner_example.md](operations/AddMemberMessageAAQToPartner_example.md)
- Modern: [sendMessage_example.md](operations/sendMessage_example.md)



Response Payload Transformation:

- Traditional: [AddMemberMessageAAQToPartner_example.md](operations/AddMemberMessageAAQToPartner_example.md)
- Modern: [sendMessage_example.md](operations/sendMessage_example.md)



Migration Guide:
- sendMessage method of Message API
- Key behaviors/changes:
  - Ask Seller Question topics can no longer be customized
  - If a conversation already exists between the two eBay users, the conversationId value is needed
  - The reference container replaces the ItemID in the traditional call

### AddMemberMessageRTQ -> sendMessage
Purpose:
- Reply to a buyer question about an active listing.

Modern API:
- Message API: POST /commerce/message/v1/send_message
- Full traditional doc extract: operations/AddMemberMessageRTQ_doc.md
- Full modern doc extract: operations/sendMessage_doc.md
- Full modern example: operations/sendMessage_example.md

Key Differences:
- Listing-question replies now use the same conversation send method as other member messages.
- The conversation or counterparty determines the thread rather than a traditional-specific reply call.
- Media attachments are handled through the same bundled modern `sendMessage` example when the migrated flow needs them.

Request Payload Transformation:

- Traditional: [AddMemberMessageRTQ_example.md](operations/AddMemberMessageRTQ_example.md)
- Modern: [sendMessage_example.md](operations/sendMessage_example.md)



Response Payload Transformation:

- Traditional: [AddMemberMessageRTQ_example.md](operations/AddMemberMessageRTQ_example.md)
- Modern: [sendMessage_example.md](operations/sendMessage_example.md)



Migration Guide:
- sendMessage method of Message API.

### AddMemberMessagesAAQToBidder -> sendMessage
Purpose:
- Send bidder-oriented outreach that now uses the same modern message-send capability.

Modern API:
- Message API: POST /commerce/message/v1/send_message
- Full traditional doc extract: operations/AddMemberMessagesAAQToBidder_doc.md
- Full modern doc extract: operations/sendMessage_doc.md
- Full modern example: operations/sendMessage_example.md

Key Differences:
- The traditional specialized bidder-message flow collapses into the same generic sendMessage method.
- The modern API is conversation-based and does not preserve traditional's specialized message-call taxonomy.
- Media attachments are handled through the same bundled modern `sendMessage` example when the migrated flow needs them.

Request Payload Transformation:

- Traditional: [AddMemberMessagesAAQToBidder_example.md](operations/AddMemberMessagesAAQToBidder_example.md)
- Modern: [sendMessage_example.md](operations/sendMessage_example.md)



Response Payload Transformation:

- Traditional: [AddMemberMessagesAAQToBidder_example.md](operations/AddMemberMessagesAAQToBidder_example.md)
- Modern: [sendMessage_example.md](operations/sendMessage_example.md)



Migration Guide:
- sendMessage method of Message API.

## Conversation Retrieval Operations

### GetMemberMessages -> getConversation / getConversations
Purpose:
- Retrieve messages tied to listing-related conversations from members.

Modern API:
- Message API: GET /commerce/message/v1/conversation/{conversation_id}
- Message API: GET /commerce/message/v1/conversation
- Full traditional doc extract: operations/GetMemberMessages_doc.md
- Full modern doc extracts: operations/getConversation_doc.md, operations/getConversations_doc.md
- Full modern examples: operations/getConversation_example.md, operations/getConversations_example.md

Key Differences:
- Message retrieval is conversation-centric.
- The collection method is used to discover conversation IDs and filter by status, type, reference, time range, or other party.
- The single-conversation method is used once a specific conversation ID is known.

Request Payload Transformation:

- Traditional: [GetMemberMessages_example.md](operations/GetMemberMessages_example.md)
- Modern: [getConversation_example.md](operations/getConversation_example.md), [getConversations_example.md](operations/getConversations_example.md)



Response Payload Transformation:

- Traditional: [GetMemberMessages_example.md](operations/GetMemberMessages_example.md)
- Modern: [getConversation_example.md](operations/getConversation_example.md), [getConversations_example.md](operations/getConversations_example.md)



Migration Guide:
- getConversations method of Message API
- Key behaviors/changes:
  - GetMemberMessages retrieves only messages from other eBay members, so the conversation_type query parameter value should be set to FROM_EBAY
  - See additional notes for this method in the GetMyMessages row above
- getConversation method of Message API
- Key behaviors/changes:
  - See additional notes for this method in the GetMyMessages row above

### GetMyMessages -> getConversation / getConversations
Purpose:
- Retrieve inbox conversations for the authenticated user, including member or eBay-originated threads.

Modern API:
- Message API: GET /commerce/message/v1/conversation/{conversation_id}
- Message API: GET /commerce/message/v1/conversation
- Full traditional doc extract: operations/GetMyMessages_doc.md
- Full modern doc extracts: operations/getConversation_doc.md, operations/getConversations_doc.md
- Full modern examples: operations/getConversation_example.md, operations/getConversations_example.md

Key Differences:
- traditional inbox retrieval becomes conversation retrieval with query filters.
- The modern API exposes conversation type and status explicitly.
- Folder IDs from the traditional inbox model do not map directly.

Request Payload Transformation:

- Traditional: [GetMyMessages_example.md](operations/GetMyMessages_example.md)
- Modern: [getConversation_example.md](operations/getConversation_example.md), [getConversations_example.md](operations/getConversations_example.md)



Response Payload Transformation:

- Traditional: [GetMyMessages_example.md](operations/GetMyMessages_example.md)
- Modern: [getConversation_example.md](operations/getConversation_example.md), [getConversations_example.md](operations/getConversations_example.md)



Migration Guide:
- getConversations method of Message API
- Key behaviors/changes:
  - This method has a required conversation_type query parameter used to retrieve one or more conversations from either eBay or from other eBay members
  - The retrieved conversation(s) can be filtered by date range and/or by conversation_status
  - There are also filters to retrieve conversation(s) between the user and another specific eBay user and a filter combination to retrieve all conversations concerning a specific eBay listing
  - Pagination control is available
  - External messages and the IncludeHighPriorityMessageOnly boolean are not carried over
  - Custom folder names are still available in eBay InBox, but will not have API support
- getConversation method of Message API
- Key behaviors/changes:
  - This method retrieves a specific conversation between the authenticated user and either eBay or another eBay user
  - The conversation_id is passed in as a path parameter

### ReviseMyMessages -> updateConversation / bulkUpdateConversation
Purpose:
- Change read or archival state for one or more conversations.

Modern API:
- Message API: POST /commerce/message/v1/conversation/update_conversation
- Message API: POST /commerce/message/v1/bulk_update_conversation
- Full traditional doc extract: operations/ReviseMyMessages_doc.md
- Full modern doc extracts: operations/updateConversation_doc.md, operations/bulkUpdateConversation_doc.md
- Full modern examples: operations/updateConversation_example.md, operations/bulkUpdateConversation_example.md

Key Differences:
- The traditional call splits into single- and multi-conversation state updates.
- Folder moves and message flagging are not preserved.
- Modern statuses include ACTIVE, ARCHIVE, DELETE, READ, and UNREAD.

Request Payload Transformation:

- Traditional: [ReviseMyMessages_example.md](operations/ReviseMyMessages_example.md)
- Modern: [updateConversation_example.md](operations/updateConversation_example.md), [bulkUpdateConversation_example.md](operations/bulkUpdateConversation_example.md)



Response Payload Transformation:

- Traditional: [ReviseMyMessages_example.md](operations/ReviseMyMessages_example.md)
- Modern: [updateConversation_example.md](operations/updateConversation_example.md), [bulkUpdateConversation_example.md](operations/bulkUpdateConversation_example.md)



Migration Guide:
- bulkUpdateConversation method of Message API
- Key behaviors/changes:
  - This bulk method updates the status of all messages within multiple conversations (up to 10)
  - The conversationType field is required and specifies whether the conversations to update are from eBay or from other eBay members
  - The supported conversationStatus values include ACTIVE, ARCHIVED, DELETED, READ, UNREAD
  - Only conversations can be acted upon and not specific folders or specific messages
- updateConversation method of Message API
- Key behaviors/changes:
  - This method updates the status of all messages within one conversation
  - The conversationId and conversation_type fields are both required, with the former identifying the conversation and the latter specifying whether the conversation to update is from eBay or from another eBay member
  - The supported conversationStatus values include ACTIVE, ARCHIVE, and DELETE
  - The read boolean field is included and set to true to mark all messages within the conversation as read or false to mark all messages within the conversation as unread
  - Only conversations can be acted upon and not specific folders or specific messages

### DeleteMyMessages -> updateConversation
Purpose:
- Remove or archive message threads by changing the modern conversation status.

Modern API:
- Message API: POST /commerce/message/v1/conversation/update_conversation
- Full traditional doc extract: operations/DeleteMyMessages_doc.md
- Full modern doc extract: operations/updateConversation_doc.md
- Full modern example: operations/updateConversation_example.md

Key Differences:
- The modern API deletes or archives at the conversation level.
- The pilot guide recommends conversationStatus=DELETE for deletion and ARCHIVE as the softer alternative.

Request Payload Transformation:

- Traditional: [DeleteMyMessages_example.md](operations/DeleteMyMessages_example.md)
- Modern: [updateConversation_example.md](operations/updateConversation_example.md)



Response Payload Transformation:

- Traditional: [DeleteMyMessages_example.md](operations/DeleteMyMessages_example.md)
- Modern: [updateConversation_example.md](operations/updateConversation_example.md)



Migration Guide:
- bulkUpdateConversation method of Message API
- Key behaviors/changes:
  - Set the conversationStatus value to DELETE, and the conversations (up to 10) and all messages within each specified conversation will be deleted from the user's InBox
  - Conversations and all messages can also be archived instead of deleted by setting the conversationStatus value to ARCHIVE
  - See additional notes for this method in the ReviseMyMessages row above
- updateConversation method of Message API
- Key behaviors/changes:
  - Set the conversationStatus value to DELETE, and the conversation and all messages within the conversation will be deleted from the user's InBox
  - Conversations and all messages can also be archived instead of deleted by setting the conversationStatus value to ARCHIVE
  - See additional notes for this method in the ReviseMyMessages row above

## Unsupported Or Decommissioned Communication Features

### ReviseMyMessagesFolders -> No replacement
Purpose:
- Create, rename, or delete inbox folders in the traditional My Messages model.

Modern API:
- None.
- Full traditional doc extract: operations/ReviseMyMessagesFolders_doc.md

Key Differences:
- Folder-management capabilities are not available through the modern public Message API.

Migration Guide:
- None; to be decommissioned
- eBay InBox folder management will not be available through modern APIs

### GetMessagePreferences -> No replacement
Purpose:
- Retrieve Ask Seller Question subject preferences in the traditional model.

Modern API:
- None.
- Full traditional doc extract: operations/GetMessagePreferences_doc.md

Key Differences:
- Custom Ask Seller Question topics are no longer supported.

Migration Guide:
- None; to be decommissioned
- Custom Ask Seller Question topics are no longer supported by eBay, so these two methods will be decommissioned with no alternatives

### SetMessagePreferences -> No replacement
Purpose:
- Add, remove, or modify custom Ask Seller Question subjects in the traditional model.

Modern API:
- None.
- Full traditional doc extract: operations/SetMessagePreferences_doc.md

Key Differences:
- The modern public API surface does not expose a replacement for custom Ask Seller Question subject management.

Migration Guide:
- None; to be decommissioned
- Custom Ask Seller Question topics are no longer supported by eBay, so these two methods will be decommissioned with no alternatives