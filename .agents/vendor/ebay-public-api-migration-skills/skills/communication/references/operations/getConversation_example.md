# GET : getConversation Samples

**API:** Message API
**Type:** REST GET
**Endpoint:** `https://api.ebay.com/commerce/message/v1/conversation/4********d?conversation_type=FROM_MEMBERS&limit=3`
**Method:** GET
**Operation Name:** `getConversation`

---

## Description

This sample retrieves three messages and their details from the included conversation ID.

---

## Response Sample

```json
{
    "limit": 3,
    "offset": 0,
    "total": 8,
    "href": "https://api.ebay.com/commerce/message/v1/conversation/5007903602?conversationType=FROM_MEMBERS&offset=0&limit=3",
    "next": "https://api.ebay.com/commerce/message/v1/conversation/5007903602?conversationType=FROM_MEMBERS&offset=5&limit=3",
    "conversationTitle": "Attachment",
    "conversationStatus": "ACTIVE",
    "conversationType": "FROM_MEMBERS",
    "messages": [
        {
            "messageId": "5********2",
            "messageBody": "Please send image attachment of issue.",
            "senderUsername": "m********r",
            "recipientUsername": "p********2",
            "readStatus": true,
            "createdDate": "2025-10-09T11:41:46.000Z"
        },
        {
            "messageId": "5********2",
            "senderUsername": "m********r",
            "recipientUsername": "p********2",
            "readStatus": true,
            "createdDate": "2025-10-09T11:19:58.000Z",
            "messageMedia": [
                {
                    "mediaName": "Screenshot 2025-03-25 at 5.37.58\u202fPM.png",
                    "mediaUrl": "https://i.ebayimg.com/00/s/MTExMFgxNjAw/z/AlUAAeSwy7Fo55pY/$_1.PNG?set_id=880000500F",
                    "mediaType": "IMAGE"
                }
            ]
        },
        {
            "messageId": "5********2",
            "senderUsername": "m********r",
            "recipientUsername": "p********2",
            "readStatus": true,
            "createdDate": "2025-10-09T11:19:45.000Z",
            "messageMedia": [
                {
                    "mediaName": "Screenshot 2025-07-18 at 1.36.19\u202fPM.png",
                    "mediaUrl": "https://i.ebayimg.com/00/s/MTI4NFgxNDA0/z/mRgAAeSw4rho55ot/$_1.PNG?set_id=880000500F",
                    "mediaType": "IMAGE"
                }
            ]
        }
    ]
}
```
