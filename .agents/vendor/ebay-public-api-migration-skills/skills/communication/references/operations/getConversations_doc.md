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

### getConversations

#### GET /conversation
**Description:** This method can be used to retrieve one or more conversations associated with a user.  
  
The **conversation\_type** query parameter is required when using this method to specify if the retrieved conversations are from eBay or from members.  
  
The result set can also optionally be filtered by conversation status, reference, username, and/or time range. The **limit** and **offset** path parameters can be used to paginate the result set and control how many conversations are returned in the response.
**Parameters:**
- **conversation_status** (string)
  - This query parameter specifies the status of the conversations being retrieved. Only conversations with the specified status will be returned.  
  
**Valid values:**

*   `ACTIVE`
*   `ARCHIVED`
*   `DELETED`
*   `READ`
*   `UNREAD`
- **conversation_type** (string) *required*
  - This query parameter specifies the type of the conversations being retrieved. Only conversations of the specified type will be returned.  
  
This parameter is required when using this method.  
  
**Valid values:**

*   `FROM_EBAY`
*   `FROM_MEMBERS`
- **end_time** (string)
  - This query parameter specifies the end time (in ISO 8601 format) for which to stop retrieving conversations.  
  
For example, if set to `2024-11-06T10:00:00.000Z`, only messages sent before this time will be retrieved.  
  
**Format:** yyyy-MM-ddThh:mm.ss.sssZ  
  
**Note:** Currently, this parameter is only available if the **conversation\_type** of the conversation is `FROM_MEMBERS`.
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
- **other_party_username** (string)
  - This query parameter specifies the username (login name) of an eBay user for which to retrieve conversations.  
  
If this filter is used, only conversation(s) from the other eBay user specified through this parameter will be returned.  
  
**Note:** Effective September 26, 2025, select developers will no longer receive username data for U.S. users through this field. Instead, an immutable user ID will be returned in its place. For more information, please refer to [Data Handling Compliance](/api-docs/static/data-handling-update.html).
- **reference_id** (string)
  - This query parameter specifies the unique identifier of the reference (specified by the corresponding **reference\_type** value) associated with the conversation. Only conversations associated with the specified reference ID will be returned.  
  
For example, in the case of a `LISTING` reference, this value will be the item ID value of the listing.  
  
**Note:** If this query parameter is used, the **reference\_type** parameter must also be used to specify the type of reference this ID is associated with.
- **reference_type** (string)
  - This query parameter specifies the type of reference associated with a conversation.  
  
The reference type is used to specify what the conversation is in reference to. For example, a value of `LISTING` specifies that the conversation is associated with a specific listing. The item ID associated with this listing can then be specified through the **reference\_id** query parameter.  
  
Currently, only the `LISTING` reference type is supported.
- **start_time** (string)
  - This query parameter specifies the start time (in ISO 8601 format) for which to start retrieving conversations.  
  
For example, if set to `2024-11-06T10:00:00.000Z`, only messages sent after this time will be retrieved.  
  
**Format:** yyyy-MM-ddThh:mm.ss.sssZ  
  
**Note:** Currently, this parameter is only available if the **conversation\_type** of the conversation is `FROM_MEMBERS`.
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope/commerce.message`

## Shared Types

Shared API-level schema and common type definitions live in [Message API_shared.md](Message API_shared.md).
