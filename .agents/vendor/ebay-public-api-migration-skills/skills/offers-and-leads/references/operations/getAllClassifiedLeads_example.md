# GET : getAllClassifiedLeads Samples

**API:** Leads API
**Type:** REST GET
**Endpoint:** `https://apiz.ebay.com/sell/leads/v1/classified_lead?startTime=2024-07-13T15:54:00Z&endTime=2025-01-17T06:41:06Z&includeMessages=true`
**Method:** GET
**Operation Name:** `getAllClassifiedLeads`

---

## Description

This sample retrieves all leads for all classified ad listings between the start and end time, with all buyer details and includes the messages exchanged between seller and buyer.

---

## Response Sample

```json
{
    "totalItems": 6,
    "totalLeads": 7,
    "classifiedLeads": [
        {
            "itemId": "2*********55",
            "itemTitle": "2016 Chevrolet Traverse LT Sport Utility 4D",
            "responses": [
                {
                    "additionalInformation": "test contact seller",
                    "contactInformation": {
                        "phone": "4********0",
                        "postalCode": "9***9",
                        "firstName": "A********d",
                        "lastName": "B**r"
                    },
                    "email": "t*******************@g*******m",
                    "submittedTime": "2024-12-26T18:36:30Z",
                    "userId": "t******************2",
                    "memberMessage": {
                        "memberMessageExchange": [
                            {
                                "question": {
                                    "body": "test contact seller",
                                    "messageID": "5*******19"
                                },
                                "creationDate": "2024-12-26T18:36:30Z"
                            },
                            {
                                "question": {
                                    "body": "test contact seller",
                                    "messageID": "5*******29"
                                },
                                "creationDate": "2024-12-26T18:36:30Z"
                            }
                        ]
                    },
                    "leadStatus": "NEW",
                    "tradeInMake": "Honda",
                    "tradeInModel": "Civic",
                    "tradeInYear": "2008",
                    "leadFee": {
                        "amount": {
                            "currency": "USD",
                            "value": "0.0"
                        },
                        "description": "Lead fee."
                    },
                    "externalEmail": "t*******************@g*******m",
                    "financingAnswer": false
                }
            ]
        },
        {
            "itemId": "2**********6",
            "itemTitle": "1947 Pontiac Streamliner ",
            "responses": [
                {
                    "additionalInformation": "test contact seller",
                    "address": {
                        "phone": "4********0",
                        "postalCode": "9***9",
                        "firstName": "A********d",
                        "lastName": "B**r"
                    },
                    "email": "t*******************@g*******m",
                    "submittedTime": "2024-12-26T20:27:59Z",
                    "userId": "t******************2",
                    "memberMessage": {
                        "memberMessageExchange": [
                            {
                                "question": {
                                    "body": "test contact seller",
                                    "messageID": "5*******19"
                                },
                                "creationDate": "2024-12-26T20:27:59Z"
                            },
                            {
                                "question": {
                                    "body": "test contact seller",
                                    "messageID": "5*******29"
                                },
                                "creationDate": "2024-12-26T20:17:26Z"
                            }
                        ]
                    },
                    "leadStatus": "NEW",
                    "leadFee": {
                        "amount": {
                            "currency": "USD",
                            "value": "0.0"
                        },
                        "description": "Lead fee."
                    },
                    "externalEmail": "t*******************@g*******m",
                    "financingAnswer": true
                }
            ]
        },
        {
            "itemId": "2*********95",
            "itemTitle": "1947 Pontiac Streamliner ",
            "responses": [
                {
                    "additionalInformation": "Test lead",
                    "contactInformation": {
                        "phone": "8********0",
                        "postalCode": "84061",
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
                    "externalEmail": "L*********@g*******m",
                    "financingAnswer": false
                }
            ]
        },
        {
            "itemId": "2*********50",
            "itemTitle": "2002 Ford Thunderbird ",
            "responses": [
                {
                    "additionalInformation": "test swu 2",
                    "contactInformation": {
                        "phone": "1********0",
                        "postalCode": "91604",
                        "firstName": "E***k",
                        "lastName": "N****o"
                    },
                    "email": "--",
                    "submittedTime": "2025-01-13T19:33:10Z",
                    "memberMessage": {
                        "memberMessageExchange": [
                            {
                                "question": {
                                    "body": "test swu 2",
                                    "messageID": "5*******19"
                                },
                                "creationDate": "2025-01-13T19:33:10Z"
                            }
                        ]
                    },
                    "leadStatus": "NEW",
                    "leadFee": {
                        "amount": {
                            "currency": "USD",
                            "value": "0.0"
                        },
                        "description": "Lead fee."
                    },
                    "externalEmail": "e******@ebay.com",
                    "financingAnswer": false
                },
                {
                    "additionalInformation": "SWU Test",
                    "contactInformation": {
                        "phone": "1********0",
                        "postalCode": "91604",
                        "firstName": "E***k",
                        "lastName": "N****o"
                    },
                    "email": "--",
                    "submittedTime": "2025-01-13T19:18:32Z",
                    "memberMessage": {
                        "memberMessageExchange": [
                            {
                                "question": {
                                    "body": "SWU Test",
                                    "messageID": "5*******19"
                                },
                                "creationDate": "2025-01-13T19:18:33Z"
                            }
                        ]
                    },
                    "leadStatus": "NEW",
                    "leadFee": {
                        "amount": {
                            "currency": "USD",
                            "value": "0.0"
                        },
                        "description": "Lead fee."
                    },
                    "externalEmail": "e******@e******m",
                    "financingAnswer": false
                }
            ]
        },
        {
            "itemId": "2*********01",
            "itemTitle": "1938 Plymouth Sedan Delivery",
            "responses": [
                {
                    "additionalInformation": "adadas",
                    "contactInformation": {
                        "phone": "4********0",
                        "postalCode": "9***9",
                        "firstName": "A********d",
                        "lastName": "B**r"
                    },
                    "email": "t*******************@g*******m",
                    "submittedTime": "2024-12-26T18:48:41Z",
                    "userId": "t******************2",
                    "memberMessage": {
                        "memberMessageExchange": [
                            {
                                "question": {
                                    "body": "adadas",
                                    "messageID": "5*******19"
                                },
                                "creationDate": "2024-12-26T18:48:41Z"
                            }
                        ]
                    },
                    "leadStatus": "NEW",
                    "leadFee": {
                        "amount": {
                            "currency": "USD",
                            "value": "0.0"
                        },
                        "description": "Lead fee."
                    },
                    "externalEmail": "t*******************@g*******m",
                    "financingAnswer": true
                }
            ]
        },
        {
            "itemId": "2*********63",
            "itemTitle": "2012 Ford F-550 Super Duty XL 12' stakebed w liftgate(1600 LB)",
            "responses": [
                {
                    "additionalInformation": "i want to test this",
                    "contactInformation": {
                        "phone": "3********0",
                        "postalCode": "2***2",
                        "firstName": "test",
                        "lastName": "man"
                    },
                    "email": "--",
                    "submittedTime": "2025-01-14T12:14:18Z",
                    "memberMessage": {
                        "memberMessageExchange": [
                            {
                                "question": {
                                    "body": "i want to test this",
                                    "messageID": "5*******19"
                                },
                                "creationDate": "2025-01-14T12:14:19Z"
                            },
                            {
                                "response": "Response from seller",
                                "creationDate": "2025-01-15T06:01:09Z"
                            }
                        ]
                    },
                    "leadStatus": "RESPONDED",
                    "tradeInYear": "Any",
                    "leadFee": {
                        "amount": {
                            "currency": "USD",
                            "value": "0.0"
                        },
                        "description": "Lead fee."
                    },
                    "externalEmail": "t***@**********m",
                    "financingAnswer": true
                }
            ]
        }
    ]
}
```
