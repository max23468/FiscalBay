# POST : sendMessage Samples

**API:** Message API
**Type:** REST POST
**Endpoint:** `https://api.ebay.com/commerce/message/v1/conversation/send_message`
**Method:** POST
**Operation Name:** `sendMessage`

---

## Description

This sample sends a message to a user in an existing conversation. When sending a message to an existing conversation, the **conversationId** request field is required.

---

**Note:** This operation has 2 sample variations.

---

## Sample 1

### Request Payload

```json
{
    "conversationId": "5********5",
    "messageText": "messageText0611-2",
    "messageMedias": [
        {
            "mediaName": "nike.jpg",
            "mediaUrl": "https://i.ebayimg.com/00/s/MTQwMFgxNDAw/z/n0QAAOSwkSBhedrG/$_1.JPG",
            "mediaType": "IMAGE"
        }
    ],
    "reference": {
        "referenceId": "2********0",
        "referenceType": "LISTING"
    },
    "emailCopyToSender": true
}
```

### Response Sample

```json
{
    "messageId": "5********9",
    "messageBody": "messageText0611-2",
    "senderUserName": "chat_usr1",
    "recipientUserName": "chat_usr3",
    "readStatus": true,
    "createdDate": "2025-06-18T03:51:37.000Z",
    "messageMedias": [
        {
            "mediaName": "nike.jpg",
            "mediaUrl": "https://i.ebayimg.com/00/s/MTQwMFgxNDAw/z/n0QAAOSwkSBhedrG/$_1.JPG",
            "mediaType": "IMAGE"
        }
    ]
}
```

---


## Sample 2

### Request Payload

```json
{
    "otherPartyUsername": "chat_usr3",
    "messageText": "messageText0611-2",
    "messageMedias": [
        {
            "mediaName": "nike.jpg",
            "mediaUrl": "https://i.ebayimg.com/00/s/MTQwMFgxNDAw/z/n0QAAOSwkSBhedrG/$_1.JPG",
            "mediaType": "IMAGE"
        }
    ],
    "reference": {
        "referenceId": "2********0",
        "referenceType": "LISTING"
    },
    "emailCopyToSender": true
}
```

### Response Sample

```json
{
    "messageId": "5********9",
    "messageBody": "messageText0611-2",
    "senderUserName": "chat_usr1",
    "recipientUserName": "chat_usr3",
    "readStatus": true,
    "createdDate": "2025-06-18T03:51:37.000Z",
    "messageMedias": [
        {
            "mediaName": "nike.jpg",
            "mediaUrl": "https://i.ebayimg.com/00/s/MTQwMFgxNDAw/z/n0QAAOSwkSBhedrG/$_1.JPG",
            "mediaType": "IMAGE"
        }
    ]
}
```

---

