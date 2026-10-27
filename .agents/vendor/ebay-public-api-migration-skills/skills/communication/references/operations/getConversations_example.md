# GET : getConversations Samples

**API:** Message API
**Type:** REST GET
**Endpoint:** `https://api.ebay.com/commerce/message/v1/conversation?conversation_type=FROM_MEMBERS&offset=0&limit=3&conversation_status=ACTIVE`
**Method:** GET
**Operation Name:** `getConversations`

---

## Description

This sample retrieves messages from all active conversations that are from members.

---

## Response Sample

```json
{
    "limit": 3,
    "offset": 0,
    "total": 3,
    "href": "https://api.ebay.com/commerce/message/v1/conversation?conversationType=FROM_MEMBERS&offset=0&limit=3",
    "next": "https://api.ebay.com/commerce/message/v1/conversation?conversationType=FROM_MEMBERS&offset=5&limit=3",
    "conversations": [
        {
            "conversationId": "5********2",
            "conversationStatus": "ACTIVE",
            "conversationType": "FROM_MEMBERS",
            "createdDate": "2025-10-07T21:15:04.000Z",
            "referenceId": "1********2",
            "referenceType": "LISTING",
            "unreadCount": 1,
            "latestMessage": {
                "messageId": "5********2",
                "messageBody": "Hi Seller, This is the start of the conversation!",
                "senderUsername": "p********2",
                "recipientUsername": "m********r",
                "readStatus": false,
                "createdDate": "2025-10-07T21:15:04.000Z"
            }
        },
        {
            "conversationId": "5********2",
            "conversationStatus": "ACTIVE",
            "conversationType": "FROM_MEMBERS",
            "createdDate": "2025-10-07T19:34:41.000Z",
            "referenceId": "1********9",
            "referenceType": "LISTING",
            "unreadCount": 0,
            "latestMessage": {
                "messageId": "5********2",
                "messageBody": "Hello, thank you for your message. Checking the new line fix. Things are looking good so far! Could you please give your car VIN number?",
                "senderUsername": "m********r",
                "recipientUsername": "p********2",
                "readStatus": true,
                "createdDate": "2025-10-07T19:34:41.000Z"
            }
        },
        {
            "conversationId": "5********2",
            "conversationStatus": "ACTIVE",
            "conversationType": "FROM_MEMBERS",
            "createdDate": "2025-10-09T12:20:55.000Z",
            "referenceId": "1********2",
            "referenceType": "LISTING",
            "unreadCount": 0,
            "latestMessage": {
                "messageId": "5********2",
                "senderUsername": "m********r",
                "recipientUsername": "p********2",
                "readStatus": true,
                "createdDate": "2025-10-09T12:20:55.000Z",
                "messageMedia": [
                    {
                        "mediaName": "Screenshot 2025-03-25 at 5.37.58\u202fPM.png",
                        "mediaUrl": "https://i.ebayimg.com/00/s/MTExMFgxNjAw/z/B2cAAeSwy7Fo56ii/$_1.PNG?set_id=880000500F",
                        "mediaType": "IMAGE"
                    }
                ]
            }
        }
    ]
}
```
