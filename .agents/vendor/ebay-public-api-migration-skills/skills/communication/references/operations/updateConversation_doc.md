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
# Message API

## API Methods

### updateConversation

#### POST /update_conversation
**Description:** This method can be used to update the **conversationStatus** or the **read** status of a specified conversation.  
  
**Note:** Only one of these statuses can be updated at a time using this method. If both fields are included, only the **read** status of the specified conversation will be updated and the **conversationStatus** field will be ignored.  
Both the **conversationId** of the conversation to modify and the existing **conversationType** of the specified conversation are required as part of the request payload.  
  

**Important!** Although it cannot be updated, the existing **conversationType** of the specified conversation to be updated is required in the request payload. If this value is not provided, an error will occur.

  
To update a conversation's status (e.g., updating an `ACTIVE` conversation to `ARCHIVE`), include the **conversationStatus** field in the request with the updated value. To update a conversation's read status (e.g., updating an `UNREAD` conversation to `READ`), include the **read** boolean in the request with the updated value.
**Parameters:**
- **Content-Type** (string) *required*
  - This header indicates the format of the request body provided by the client. Its value should be set to **application/json**.
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope/commerce.message`

## Error Codes

The following error codes may be returned by this API:

## Shared Types

Shared API-level schema and common type definitions live in [Message API_shared.md](Message API_shared.md).
