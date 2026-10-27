# GET : getClassifiedLeadsByItemId Samples

**API:** Leads API
**Type:** REST GET
**Endpoint:** `https://apiz.ebay.com/sell/leads/v1/classified_lead/2**********5?startTime=2024-07-13T15:54:00Z&endTime=2025-01-17T06:41:06Z&includeMessages=true`
**Method:** GET
**Operation Name:** `getClassifiedLeadsByItemId`

---

## Description

This sample retrieves all leads between the start and end time, with all buyer details and includes the messages exchanged between seller and buyer for the specified lead (**itemId**).

---

## Response Sample

```json
{
    "itemId": "2**********5",
    "itemTitle": "1947 Pontiac Streamliner ",
    "responses": [
        {
            "additionalInformation": "Test lead",
            "contactInformation": {
                "phone": "8********0",
                "postalCode": "8***1",
                "firstName": "L**a",
                "lastName": "L****r"
            },
            "email": "--",
            "submittedTime": "2025-01-06T18:00:12Z",
            "memberMessage": {
                "memberMessageExchange": [
                    {
                        "question": {
                            "body": "Test lead",
                            "messageID": "5*******19"
                        },
                        "creationDate": "2025-01-06T18:00:13Z"
                    },
                    {
                        "response": "Testing response from seller",
                        "creationDate": "2025-01-17T06:38:16Z"
                    }
                ]
            },
            "leadStatus": "RESPONDED",
            "leadFee": {
                "amount": {
                    "currency": "USD",
                    "value": "0.0"
                },
                "description": "Lead fee."
            },
            "externalEmail": "l********r@g*******m",
            "financingAnswer": false
        }
    ]
}
```
