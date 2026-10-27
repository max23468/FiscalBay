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

### getConversation

#### GET /conversation/{conversation_id}
**Description:** This method can be used to retrieve messages within a specific conversation.  
  
The **conversation\_id** of the conversation for which to retrieve messages is required as a path parameter and the **conversation\_type** of the conversation is required as a query parameter.
**Parameters:**
- **conversation_id** (string) *required*
  - This path parameters specify the unique identifier of the conversation that is to be retrieved.  
  
Use the [getConversations](/develop/api/sell/message_api#sell-message_api-conversation-getconversations) method to retrieve conversation ID values.
- **conversation_type** (string) *required*
  - This query parameter specifies the type of the conversation being retrieved.  
  
This parameter is always required when using this method.  
  
**Valid values:**

*   `FROM_EBAY`
*   `FROM_MEMBERS`
- **limit** (string)
  - The maximum number of entries that can be returned on each page of the paginated response.  
  
Use this parameter in conjunction with the **offset** parameter to control the pagination of the output. For example, if **offset** is set to `10` and **limit** is set to `10`, the call retrieves entries 11 through 20 from the result set.  
  
**Note:** This feature employs a zero-based list, where the first item in the list has an offset of `0`.  
If this parameter is omitted, the default value is used.  
  
**Default:** 25  
  
**Maximum:** 50
- **offset** (string)
  - The number of reports to skip in the result set before returning the first entry in the paginated response.  
  
Use this parameter in conjunction with the **limit** parameter to control the pagination of the output. For example, if **offset** is set to `0` and **limit** is set to `10`, the first page of the response will contain the first 10 entries from the complete list retrieved by the call.  
  
**Note:** This feature employs a zero-based list, where the first item in the list has an offset of `0`.  
If this parameter is omitted, the default value is used.  
  
**Default:** 0
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope/commerce.message`

## Shared Types

Shared API-level schema and common type definitions live in [Message API_shared.md](Message API_shared.md).
