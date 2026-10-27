# POST : bulkUpdateConversation Samples

**API:** Message API
**Type:** REST POST
**Endpoint:** `https://api.ebay.com/commerce/message/v1/bulk_update_conversation`
**Method:** POST
**Operation Name:** `bulkUpdateConversation`

---

## Description

This sample updates the status of three conversations. If the call is successful, a response payload detailing the results of the call is returned.

---

## Request Payload

```json
{
    "conversations": [
        {
            "conversationId": "5********7",
            "conversationType": "FROM_MEMBERS",
            "conversationStatus": "ACTIVE"
        },
        {
            "conversationId": "5********5",
            "conversationType": "FROM_MEMBERS",
            "conversationStatus": "ACTIVE"
        },
        {
            "conversationId": "2********0",
            "conversationType": "FROM_EBAY",
            "conversationStatus": "DELETED"
        }
    ]
}
```

---

## Response Sample

```json
{
    "conversationsResponse": [
        {
            "conversationId": "5********7",
            "updateStatus": "SUCCESS"
        },
        {
            "conversationId": "5********5",
            "updateStatus": "SUCCESS"
        },
        {
            "conversationId": "2********0",
            "updateStatus": "SUCCESS"
        }
    ],
    "conversationsMetadata": {
        "updateFailureCount": 0,
        "updateSuccessCount": 3,
        "totalConversationsCount": 3
    }
}
```
