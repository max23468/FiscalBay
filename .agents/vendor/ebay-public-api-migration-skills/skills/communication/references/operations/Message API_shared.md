---
title: Message API
description: "The **Message API** provides resources for managing user conversations on the eBay platform, allowing developers to send, retrieve, and update the status of messages and conversations. Key functionalities include sending messages in new or existing threads (**sendMessage**), retrieving filtered lists of conversations (**getConversations**), fetching all messages within a specific conversation (**getConversation**), and modifying the status (e.g., active, deleted, archived, read, unread) of single or multiple conversations (**updateConversation**, **bulkUpdateConversation**)."
api_version: 1.0.0
api_name: message_api
api_type: REST
api_group: message/api
source_url:
  html: https://developer.ebay.com/develop/api/message/api
  md: https://developer.ebay.com/develop/api/message/api.md
---
# Message API API


## Types

### BulkConversation
**Description:** This type specifies the conversations to be updated.
**Type:** object

**Properties:**
- **conversationId** (string)
  - This field indicates the unique identifier of the conversation that is to be updated.  
  
Use the [getConversations](/develop/api/sell/message_api#sell-message_api-conversation-getconversations) method to retrieve conversation ID values.
- **conversationStatus** (string)
  - This field indicates the status for which to update the associated conversation.  
  
**Valid values:**

*   `ACTIVE`
*   `ARCHIVE`
*   `DELETE`
*   `READ`
*   `UNREAD`
- **conversationType** (string)
  - This field specifies the existing type of the conversation that is to be updated.  
  

**Important!** This value **cannot** be updated using this method but is required for each conversation being updated.

  
**Valid values:**

*   `FROM_MEMBERS`
*   `FROM_EBAY`

### BulkUpdateConversationsRequest
**Description:** This type defines the request body of the **bulkUpdateConversation** method.
**Type:** object

**Properties:**
- **conversations** (array)
  - This array specifies the list of conversations to update and the updated **conversationStatus** for each.

### BulkUpdateConversationsResponse
**Description:** This type defines the response payload of the **bulkUpdateConversation** method.
**Type:** object

**Properties:**
- **conversationsMetadata** (ConversationsMetadata)
  - This container returns metadata from the call, such as how many conversations were updated, how many succeeded, and how many failed.
- **conversationsResponse** (array)
  - This array returns a list of each conversation specified in the request and if the requested update was successful or failed.

### ConversationDetail
**Description:** This type defines the details of a conversation, such as its ID, status, type, and latest message.
**Type:** object

**Properties:**
- **conversationId** (string)
  - The unique identifier of the conversation.
- **conversationStatus** (string)
  - This value indicates the current status of the conversation, such as `ACTIVE` or `ARCHIVED`.
- **conversationTitle** (string)
  - This value indicates the title of the conversation.
- **conversationType** (string)
  - This value indicates the type of the conversation, such as `FROM_EBAY` or `FROM_MEMBERS`.
- **createdDate** (string)
  - This value indicates the date the conversation was created in ISO 8601 format.
- **latestMessage** (MessageDetail)
  - This container returns the latest message in the conversation and its details.
- **referenceId** (string)
  - This value indicates the reference ID associated with the corresponding **referenceType** value.  
  
In the case of a `LISTING` **referenceType**, this value will be the item ID value of the associated listing.
- **referenceType** (string)
  - This value indicates the reference type, if applicable, associated with the conversation.  
  
The reference type is used to specify what the conversation is in reference to. For example, a value of `LISTING` specifies that the conversation is associated with a specific listing. The item ID associated with this listing will then be returned in the **referenceId** field.  
  
Currently, only the `LISTING` reference type is supported.
- **unreadCount** (integer)
  - This value indicates the number of unread messages in the conversation.

### ConversationsMetadata
**Description:** This type defines the metadata, such as successes and failures, associated with a bulk conversation status update.
**Type:** object

**Properties:**
- **totalConversationsCount** (integer)
  - The total number of conversations being updated.
- **updateFailureCount** (integer)
  - The number of conversations in which the specified update failed.
- **updateSuccessCount** (integer)
  - The number of conversations in which the specified update succeeded.

### ConversationsResponse
**Description:** This type provides the updated information for a conversation that has been modified.
**Type:** object

**Properties:**
- **conversationId** (string)
  - The unique identifier of the conversation.
- **updateStatus** (string)
  - The update status of the conversation, such as `SUCCESS` or `FAILURE`.

### GetAllMyConversationsResponse
**Description:** This type defines the response payload of the **getConversations** method.
**Type:** object

**Properties:**
- **conversations** (array)
  - This array returns the conversations that match the filter criteria.  
  
Each conversation is returned with information such as its ID, status, title, type, and creation date, as well as the latest message in the conversation.
- **href** (string)
  - The URI to the current page of results.
- **limit** (integer)
  - The value of the **limit** parameter submitted in the request.
- **next** (string)
  - The URI for the next page of results.  
  
This value is returned if there is an additional page of results in the result set.
- **offset** (integer)
  - The value of the **offset** parameter submitted in the request.
- **prev** (string)
  - The URI for the previous page of results.  
  
This value is only returned if there is a previous page of results in the result set.
- **total** (integer)
  - The total number of entries returned in the result set.

### GetMessagesByConversationIdResponse
**Description:** This type defines the response payload of the **getConversation** method.
**Type:** object

**Properties:**
- **conversationStatus** (string)
  - The current status of the conversation, such as `ACTIVE` or `ARCHIVE`.
- **conversationTitle** (string)
  - The title of the conversation.
- **conversationType** (string)
  - The type of the conversation, such as `FROM_EBAY` or `FROM_MEMBERS`.
- **href** (string)
  - The URI to the current page of results.
- **limit** (integer)
  - The value of the **limit** parameter submitted in the request.
- **messages** (array)
  - This array returns a list of messages from the specified conversation.
- **next** (string)
  - The URI for the next page of results.  
  
This value is only returned if there is an additional page of results in the result set.
- **offset** (integer)
  - The value of the **offset** parameter submitted in the request.
- **prev** (string)
  - The URI for the previous page of results.  
  
This value is only returned if there is a previous page of results in the result set.
- **total** (integer)
  - The total number of entries returned in the result set.

### MessageDetail
**Description:** This type defines the message details for a conversation.
**Type:** object

**Properties:**
- **createdDate** (string)
  - The date, in ISO 8601 format, the message was received.
- **messageBody** (string)
  - The message text.
- **messageId** (string)
  - The unique identifier of the message.
- **messageMedia** (array)
  - This array returns a list, if applicable, of media attached to the message.
- **readStatus** (boolean)
  - This boolean indicates if the message has been viewed by the recipient.  
  
If this boolean is returned as `true`, the message has been read. If this boolean is returned as `false`, the message has not been read.
- **recipientUsername** (string)
  - The eBay username of the message recipient.  
  
**Note:** Effective September 26, 2025, select developers will no longer receive username data for U.S. users through this field. Instead, an immutable user ID will be returned in its place. For more information, please refer to [Data Handling Compliance](/api-docs/static/data-handling-update.html).
- **senderUsername** (string)
  - The eBay username of the message sender.  
  
**Note:** Effective September 26, 2025, select developers will no longer receive username data for U.S. users through this field. Instead, an immutable user ID will be returned in its place. For more information, please refer to [Data Handling Compliance](/api-docs/static/data-handling-update.html).
- **subject** (string)
  - The subject line of the message.

### MessageMedia
**Description:** This type specifies the format of media that was included when sending a message.
**Type:** object

**Properties:**
- **mediaName** (string)
  - The name of the media attached to the message.
- **mediaType** (string)
  - The type of media attached to the message.  
  
**Valid values:**

*   `IMAGE`
*   `PDF`
*   `DOC`
*   `TXT`
- **mediaUrl** (string)
  - The URL of the self-hosted media attached to the message. URLs must use the "HTTPS" protocol.

### Reference
**Description:** This type specifies the reference type and associated reference ID associated with a message.
**Type:** object

**Properties:**
- **referenceId** (string)
  - This value indicates the reference ID associated with the corresponding **referenceType** value.  
  
For example, in the case of a `LISTING` reference type, this value will be the item ID value of the listing.
- **referenceType** (string)
  - This value indicates the reference type to associate with the conversation.  
  
The reference type is used to specify what the conversation is in reference to. For example, a value of `LISTING` specifies that the conversation is associated with a specific listing. The item ID associated with this listing will then be returned in the **referenceId** field.  
  
Currently, only the `LISTING` reference type is supported.

### SendMessageRequest
**Description:** This type defines the request payload of the **sendMessage** method.
**Type:** object

**Properties:**
- **conversationId** (string)
  - This field specifies the unique identifier of the conversation in which to send the message.  
  
Use the [getConversations](/develop/api/sell/message_api#sell-message_api-conversation-getconversations) method to retrieve conversation ID values.  
  
This field is required if sending a message in an existing conversation.
- **emailCopyToSender** (boolean)
  - This boolean indicates whether a copy of the message should be emailed to the sender.  
  
If this boolean is input as `true`, a copy of the message will be emailed to the sender.
- **messageMedia** (array)
  - This array lists the individual forms of media, if any, to be attached to the message.  
  
Up to five individual forms of media may be sent per message. If more than five are specified in this array, an error will occur and the call will fail.
- **messageText** (string)
  - The text of the message.  
  
**Maximum length:** 2000 characters
- **otherPartyUsername** (string)
  - This field specifies the eBay username of the entity to whom to send the message.  
  
This field is required if starting a new conversation with another eBay user.  
  
**Note:** Effective September 26, 2025, select developers will no longer receive username data for U.S. users through this field. Instead, an immutable user ID will be returned in its place. For more information, please refer to [Data Handling Compliance](/api-docs/static/data-handling-update.html).
- **reference** (Reference)
  - This container should be used if the new or existing conversation is related to a specific eBay listing.  
  
For example, a **referenceType** of `LISTING` and an associated **referenceId** will specify the item ID value of the listing associated with the message.

### SendMessageResponse
**Description:** This type defines the response payload of the **sendMessage** method.
**Type:** object

**Properties:**
- **createdDate** (string)
  - The date the message was sent in ISO 8601 format.
- **messageBody** (string)
  - The message text.
- **messageId** (string)
  - The unique identifier of the message.
- **messageMedia** (array)
  - This array will be returned if the user attached one or more images or documents to the message.
- **readStatus** (boolean)
  - The read status of the message.  
  
If returned as `true`, the message has been read. If returned as `false`, the message has not been read.
- **recipientUserName** (string)
  - The eBay username of the recipient.  
  
**Note:** Effective September 26, 2025, select developers will no longer receive username data for U.S. users through this field. Instead, an immutable user ID will be returned in its place. For more information, please refer to [Data Handling Compliance](/api-docs/static/data-handling-update.html).
- **senderUserName** (string)
  - The eBay username of the sender.  
  
**Note:** Effective September 26, 2025, select developers will no longer receive username data for U.S. users through this field. Instead, an immutable user ID will be returned in its place. For more information, please refer to [Data Handling Compliance](/api-docs/static/data-handling-update.html).
- **subject** (string)
  - The subject line of the message.

### UpdateConversationRequest
**Description:** This type defines the request payload of the **updateConversation** method.
**Type:** object

**Properties:**
- **conversationId** (string)
  - This field specifies the unique identifier of the conversation that is to be updated.  
  
Use the [getConversations](/develop/api/sell/message_api#sell-message_api-conversation-getconversations) method to retrieve conversation ID values.
- **conversationStatus** (string)
  - This field specifies the status for which to update the specified conversation.  
  
**Valid values:**

*   `ACTIVE`
*   `ARCHIVE`
*   `DELETE`

**Note:** This field should not be used in conjunction with the **read** field. If both fields are input in the request, only the **read** status will be updated for the specified conversation and the **conversationStatus** field will be ignored.
- **conversationType** (string)
  - This field specifies the existing type of the conversation being updated.  
  

**Important!** This value **cannot** be updated using this method but is required as part of the request payload.

  
**Valid values:**

*   `FROM_MEMBERS`
*   `FROM_EBAY`
- **read** (boolean)
  - This boolean specifies the read status for which to update the conversation.  
  
If set to `true`, the conversation will update to 'read', and if set to `false`, the conversation will update to 'unread'.  
  
**Note:** This field should not be used in conjunction with the **conversationStatus** field. If both fields are input in the request, only the **read** status will be updated for the specified conversation and the **conversationStatus** field will be ignored.

## Rate Limits

See [API Call Limits](https://developer.ebay.com/develop/get-started/api-call-limits) on the eBay Developer Program.

## Resources

### Documentation

- [eBay Developer Program](https://developer.ebay.com/)
- [API Documentation](https://developer.ebay.com/develop/api/)
- [SDKs and Widgets](https://developer.ebay.com/develop/sdks-and-widgets)
- [Developer Community Forum](https://community.ebay.com/t5/Developer-Groups/ct-p/developergroup)

### Tools

- [API Explorer](https://developer.ebay.com/my/api_test_tool)
- [GraphQL Explorer](https://developer.ebay.com/my/graphql_explorer)

### Support

- [Developer Support](https://developer.ebay.com/support/)
- [API Status](https://developer.ebay.com/support/api-status)
- [Release Notes](https://developer.ebay.com/develop/api/release_notes/)

---
*Generated on 2026-04-29T11:16:23.476Z*
