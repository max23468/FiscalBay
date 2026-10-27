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

### bulkUpdateConversation

#### POST /bulk_update_conversation
**Description:** This method can be used to update the **conversationStatus** of up to 10 conversations.  
  
The **conversationId**, existing **conversationType**, and updated **conversationStatus** for each conversation to modify are required in the **conversations** array.  
  

**Important!** Although it cannot be updated, the **conversationType** field is required for each conversation being updated.

  
If the updates were successful, the **conversationId** of each conversation will be returned with an associated **updateStatus** value of `SUCCESSFUL`.
**Parameters:**
- **Content-Type** (string) *required*
  - This header indicates the format of the request body provided by the client. Its value should be set to **application/json**.
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope/commerce.message`

## Shared Types

Shared API-level schema and common type definitions live in [Message API_shared.md](Message API_shared.md).
