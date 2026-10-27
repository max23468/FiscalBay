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

### sendMessage

#### POST /send_message
**Description:** This method can be used to start a conversation with another user or send a message in an existing conversation with another user based on the information provided in the request.  
  
To send a message, one of the **conversationId** or **otherPartyUsername** request fields is required. The **conversationId** must be used when sending a message in an existing conversation and specifies the conversation for which to send the message. For a new conversation, the **otherPartyUsername** field must be used to send the message to a specific user. In addition, the **messageText** field is required as it contains the body text of the message.  
  
Optionally, media (such as images or documents) can be attached to the message using the **messageMedia** container. The **reference** container can also be used to associate a message with a listing.
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
