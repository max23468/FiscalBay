# GET : getTransactions Samples

**API:** Finances
**Type:** REST GET
**Endpoint:** `https://apiz.ebay.com/sell/finances/v1/transaction`
**Method:** GET
**Operation Name:** `getTransactions`

---

## Description

This call sample retrieves information on all recent monetary transactions. No filters, no sorting, and no pagination parameters are used.

---

**Note:** This operation has 8 sample variations.

---

## Sample 1

### Response Sample

```json
{
    "href": "https://apiz.ebay.com/sell/finances/v1/transaction?limit=20&offset=0",
    "next": "https://apiz.ebay.com/sell/finances/v1/transaction?limit=20&offset=20",
    "limit": 20,
    "offset": 0,
    "transactions": [
        {
            "transactionId": "R********2",
            "orderId": "0********1",
            "salesRecordReference": "4********1",
            "buyer": {
                "username": "r********2"
            },
            "transactionType": "TRANSFER",
            "amount": {
                "value": "25.9",
                "currency": "USD"
            },
            "bookingEntry": "DEBIT",
            "transactionDate": "2024-11-09T02:42:14.000Z",
            "transactionStatus": "COMPLETED",
            "paymentsEntity": "eBay Commerce Inc."
        },
        {
            "transactionId": "2********0",
            "orderId": "0********2",
            "salesRecordReference": "4********0",
            "buyer": {
                "username": "r********2"
            },
            "transactionType": "SALE",
            "amount": {
                "value": "207",
                "currency": "USD"
            },
            "bookingEntry": "CREDIT",
            "transactionDate": "2024-11-09T02:38:40.000Z",
            "transactionStatus": "FUNDS_ON_HOLD",
            "transactionMemo": "Awaiting delivery",
            "paymentsEntity": "eBay Commerce Inc."
        },
        {
            "transactionId": "5********2",
            "orderId": "5********2",
            "payoutId": "5********6",
            "salesRecordReference": "0",
            "transactionType": "CREDIT",
            "amount": {
                "value": "10.0",
                "currency": "USD"
            },
            "bookingEntry": "CREDIT",
            "transactionDate": "2024-10-15T23:39:32.000Z",
            "transactionStatus": "PAYOUT",
            "references": [
                {
                    "referenceId": "5********2",
                    "referenceType": "PAYOUT_ID"
                }
            ]
        },
        {
            "transactionId": "2********5",
            "orderId": "0********3",
            "payoutId": "5*****8",
            "salesRecordReference": "4********5",
            "buyer": {
                "username": "r********2"
            },
            "transactionType": "REFUND",
            "amount": {
                "value": "76.5",
                "currency": "USD"
            },
            "bookingEntry": "DEBIT",
            "transactionDate": "2024-10-31T11:27:19.000Z",
            "transactionStatus": "PAYOUT",
            "paymentsEntity": "eBay Commerce Inc."
        },
        {
            "transactionId": "2********6",
            "orderId": "0********6",
            "payoutId": "5*****8",
            "salesRecordReference": "4********6",
            "buyer": {
                "username": "r********2"
            },
            "transactionType": "REFUND",
            "amount": {
                "value": "103.5",
                "currency": "USD"
            },
            "bookingEntry": "DEBIT",
            "transactionDate": "2024-10-31T11:21:37.000Z",
            "transactionStatus": "PAYOUT",
            "paymentsEntity": "eBay Commerce Inc."
        },
        {
            "transactionId": "2********9",
            "orderId": "0********4",
            "payoutId": "5*****8",
            "salesRecordReference": "4********6",
            "buyer": {
                "username": "r********2"
            },
            "transactionType": "SALE",
            "amount": {
                "value": "207",
                "currency": "USD"
            },
            "bookingEntry": "CREDIT",
            "transactionDate": "2024-10-31T10:43:11.000Z",
            "transactionStatus": "PAYOUT",
            "paymentsEntity": "eBay Commerce Inc."
        },
        {
            "transactionId": "2********4",
            "orderId": "0********8",
            "payoutId": "5*****8",
            "salesRecordReference": "4********5",
            "buyer": {
                "username": "r********2"
            },
            "transactionType": "SALE",
            "amount": {
                "value": "207",
                "currency": "USD"
            },
            "bookingEntry": "CREDIT",
            "transactionDate": "2024-10-31T10:41:03.000Z",
            "transactionStatus": "PAYOUT",
            "paymentsEntity": "eBay Commerce Inc."
        },
        {
            "transactionId": "2********6",
            "orderId": "0********7",
            "salesRecordReference": "4********3",
            "buyer": {
                "username": "r********2"
            },
            "transactionType": "REFUND",
            "amount": {
                "value": "101.5",
                "currency": "USD"
            },
            "bookingEntry": "DEBIT",
            "transactionDate": "2024-10-31T10:27:27.000Z",
            "transactionStatus": "FUNDS_PROCESSING",
            "paymentsEntity": "eBay Commerce Inc."
        },
        {
            "transactionId": "2********7",
            "orderId": "0********7",
            "salesRecordReference": "4********2",
            "buyer": {
                "username": "r********2"
            },
            "transactionType": "REFUND",
            "amount": {
                "value": "103.5",
                "currency": "USD"
            },
            "bookingEntry": "DEBIT",
            "transactionDate": "2024-10-31T10:21:59.000Z",
            "transactionStatus": "FUNDS_PROCESSING",
            "paymentsEntity": "eBay Commerce Inc."
        },
        {
            "transactionId": "2********8",
            "orderId": "0********1",
            "salesRecordReference": "4********3",
            "buyer": {
                "username": "r********2"
            },
            "transactionType": "SALE",
            "amount": {
                "value": "207",
                "currency": "USD"
            },
            "bookingEntry": "CREDIT",
            "transactionDate": "2024-10-27T03:32:08.000Z",
            "transactionStatus": "FUNDS_PROCESSING",
            "paymentsEntity": "eBay Commerce Inc."
        },
        {
            "transactionId": "2********7",
            "orderId": "0********1",
            "salesRecordReference": "4********2",
            "buyer": {
                "username": "r********2"
            },
            "transactionType": "SALE",
            "amount": {
                "value": "207",
                "currency": "USD"
            },
            "bookingEntry": "CREDIT",
            "transactionDate": "2024-10-26T06:26:45.000Z",
            "transactionStatus": "FUNDS_PROCESSING",
            "paymentsEntity": "eBay Commerce Inc."
        },
        {
            "transactionId": "2********7",
            "orderId": "0********8",
            "salesRecordReference": "4********1",
            "buyer": {
                "username": "r********2"
            },
            "transactionType": "SALE",
            "amount": {
                "value": "207",
                "currency": "USD"
            },
            "bookingEntry": "CREDIT",
            "transactionDate": "2024-10-26T06:24:47.000Z",
            "transactionStatus": "FUNDS_PROCESSING",
            "paymentsEntity": "eBay Commerce Inc."
        },
        {
            "transactionId": "2********8",
            "orderId": "0********1",
            "payoutId": "5*****4",
            "salesRecordReference": "4********0",
            "buyer": {
                "username": "r********2"
            },
            "transactionType": "SALE",
            "amount": {
                "value": "207",
                "currency": "USD"
            },
            "bookingEntry": "CREDIT",
            "transactionDate": "2024-10-26T06:20:17.000Z",
            "transactionStatus": "PAYOUT",
            "paymentsEntity": "eBay Commerce Inc."
        },
        {
            "transactionId": "2********9",
            "orderId": "0********4",
            "payoutId": "5*****8",
            "salesRecordReference": "4********9",
            "buyer": {
                "username": "r********2"
            },
            "transactionType": "SALE",
            "amount": {
                "value": "207",
                "currency": "USD"
            },
            "bookingEntry": "CREDIT",
            "transactionDate": "2024-10-24T13:35:24.000Z",
            "transactionStatus": "PAYOUT",
            "paymentsEntity": "eBay Commerce Inc."
        },
        {
            "transactionId": "2********4",
            "orderId": "0********4",
            "payoutId": "5*****8",
            "salesRecordReference": "4********8",
            "buyer": {
                "username": "r********2"
            },
            "transactionType": "SALE",
            "amount": {
                "value": "207",
                "currency": "USD"
            },
            "bookingEntry": "CREDIT",
            "transactionDate": "2024-10-24T13:34:21.000Z",
            "transactionStatus": "PAYOUT",
            "paymentsEntity": "eBay Commerce Inc."
        },
        {
            "transactionId": "9********2",
            "orderId": "0********3",
            "payoutId": "5*****4",
            "salesRecordReference": "4********7",
            "buyer": {
                "username": "e********2"
            },
            "transactionType": "SALE",
            "amount": {
                "value": "6.74",
                "currency": "USD"
            },
            "bookingEntry": "CREDIT",
            "transactionDate": "2024-10-23T18:34:46.000Z",
            "transactionStatus": "PAYOUT",
            "paymentsEntity": "eBay Commerce Inc."
        },
        {
            "transactionId": "9********8",
            "orderId": "0********2",
            "salesRecordReference": "4********6",
            "buyer": {
                "username": "e********2"
            },
            "transactionType": "SALE",
            "amount": {
                "value": "6.74",
                "currency": "USD"
            },
            "bookingEntry": "CREDIT",
            "transactionDate": "2024-10-23T18:32:35.000Z",
            "transactionStatus": "FUNDS_PROCESSING",
            "paymentsEntity": "eBay Commerce Inc."
        },
        {
            "transactionId": "9********4",
            "orderId": "0********6",
            "salesRecordReference": "4********5",
            "buyer": {
                "username": "e********2"
            },
            "transactionType": "SALE",
            "amount": {
                "value": "6.74",
                "currency": "USD"
            },
            "bookingEntry": "CREDIT",
            "transactionDate": "2024-10-23T18:30:02.000Z",
            "transactionStatus": "FUNDS_PROCESSING",
            "paymentsEntity": "eBay Commerce Inc."
        },
        {
            "transactionId": "9********7",
            "orderId": "0********8",
            "salesRecordReference": "4********4",
            "buyer": {
                "username": "e********2"
            },
            "transactionType": "SALE",
            "amount": {
                "value": "6.74",
                "currency": "USD"
            },
            "bookingEntry": "CREDIT",
            "transactionDate": "2024-10-23T18:27:11.000Z",
            "transactionStatus": "FUNDS_PROCESSING",
            "paymentsEntity": "eBay Commerce Inc."
        },
        {
            "transactionId": "9********7",
            "orderId": "0********3",
            "salesRecordReference": "4********3",
            "buyer": {
                "username": "e********2"
            },
            "transactionType": "SALE",
            "amount": {
                "value": "6.74",
                "currency": "USD"
            },
            "bookingEntry": "CREDIT",
            "transactionDate": "2024-10-23T18:25:00.000Z",
            "transactionStatus": "FUNDS_PROCESSING",
            "paymentsEntity": "eBay Commerce Inc."
        }
    ],
    "total": 20
}
```

---


## Sample 2

### Response Sample

```json
{
    "transactionId": "0********3",
    "orderId": "0********3",
    "payoutId": "5*****1",
    "salesRecordReference": "0",
    "buyer": {
        "username": "f********1"
    },
    "transactionType": "SALE",
    "amount": {
        "value": "500.9",
        "currency": "USD"
    },
    "totalFeeBasisAmount": {
        "value": "610.71",
        "currency": "USD"
    },
    "totalFeeAmount": {
        "value": "58.1",
        "currency": "USD"
    },
    "orderLineItems": [
        {
            "lineItemId": "1********3",
            "feeBasisAmount": {
                "value": "610.71",
                "currency": "USD"
            },
            "marketplaceFees": [
                {
                    "feeType": "FINAL_VALUE_FEE_FIXED_PER_ORDER",
                    "amount": {
                        "value": "2.2",
                        "currency": "USD"
                    }
                },
                {
                    "feeType": "FINAL_VALUE_FEE",
                    "amount": {
                        "value": "55.9",
                        "currency": "USD"
                    }
                }
            ]
        }
    ],
    "bookingEntry": "CREDIT",
    "transactionDate": "2024-06-01T10:16:35.000Z",
    "transactionStatus": "PAYOUT",
    "paymentsEntity": "eBay Commerce Inc."
}
```

---


## Sample 3

### Response Sample

```json
{
    "href": "null/sell/finances/v1/transaction?limit=50&offset=0",
    "limit": 50,
    "offset": 0,
    "transactions": [
        {
            "transactionId": "2********8",
            "orderId": "2********8",
            "payoutId": "5********6",
            "payoutDetails": {
                "payoutReference": "5********5",
                "payoutIds": [
                    "5********6",
                    "5********7"
                ]
            },
            "salesRecordReference": "0",
            "buyer": {
                "username": "d********t"
            },
            "transactionType": "SALE",
            "amount": {
                "value": "14.66",
                "currency": "USD"
            },
            "totalFeeBasisAmount": {
                "value": "16.24",
                "currency": "USD"
            },
            "totalFeeAmount": {
                "value": "1.58",
                "currency": "USD"
            },
            "orderLineItems": [
                {
                    "lineItemId": "1********1",
                    "feeBasisAmount": {
                        "value": "16.24",
                        "currency": "USD"
                    },
                    "marketplaceFees": [
                        {
                            "feeType": "FINAL_VALUE_FEE_FIXED_PER_ORDER",
                            "amount": {
                                "value": "0.42",
                                "currency": "USD"
                            }
                        },
                        {
                            "feeType": "FINAL_VALUE_FEE",
                            "amount": {
                                "value": "1.16",
                                "currency": "USD"
                            }
                        }
                    ]
                }
            ],
            "bookingEntry": "CREDIT",
            "transactionDate": "2023-04-23T20:47:39.360Z",
            "transactionStatus": "PAYOUT",
            "paymentsEntity": "eBay Commerce Inc."
        }
    ],
    "total": 1
}
```

---


## Sample 4

### Response Sample

```json
{
    "href": "https://apiz.ebay.com/sell/finances/v1/transaction?filter=transactionStatus%3A%7BFUNDS_ON_HOLD%7D&limit=20&offset=0",
    "limit": 20,
    "offset": 0,
    "transactions": [
        {
            "transactionId": "2********2",
            "orderId": "0********1",
            "salesRecordReference": "4********1",
            "buyer": {
                "username": "r********2"
            },
            "transactionType": "SALE",
            "amount": {
                "value": "207",
                "currency": "USD"
            },
            "bookingEntry": "CREDIT",
            "transactionDate": "2024-11-09T02:42:14.000Z",
            "transactionStatus": "FUNDS_ON_HOLD",
            "transactionMemo": "Awaiting delivery",
            "paymentsEntity": "eBay Commerce Inc."
        },
        {
            "transactionId": "2********0",
            "orderId": "0********2",
            "salesRecordReference": "4********0",
            "buyer": {
                "username": "r********2"
            },
            "transactionType": "SALE",
            "amount": {
                "value": "207",
                "currency": "USD"
            },
            "bookingEntry": "CREDIT",
            "transactionDate": "2024-11-09T02:38:40.000Z",
            "transactionStatus": "FUNDS_ON_HOLD",
            "transactionMemo": "Awaiting delivery",
            "paymentsEntity": "eBay Commerce Inc."
        }
    ],
    "total": 2
}
```

---


## Sample 5

### Response Sample

```json
{
    "href": "https://apiz.ebay.com/sell/finances/v1/transaction?filter=transactionType%3A%7BREFUND%7D%2CbuyerUsername%3A%7Br********2%7D&limit=20&offset=0",
    "limit": 20,
    "offset": 0,
    "transactions": [
        {
            "transactionId": "2********5",
            "orderId": "0********3",
            "payoutId": "5*****8",
            "salesRecordReference": "4********5",
            "buyer": {
                "username": "r********2"
            },
            "transactionType": "REFUND",
            "amount": {
                "value": "76.5",
                "currency": "USD"
            },
            "bookingEntry": "DEBIT",
            "transactionDate": "2024-10-31T11:27:19.000Z",
            "transactionStatus": "PAYOUT",
            "paymentsEntity": "eBay Commerce Inc."
        },
        {
            "transactionId": "2********6",
            "orderId": "0********6",
            "payoutId": "5*****8",
            "salesRecordReference": "4********6",
            "buyer": {
                "username": "r********2"
            },
            "transactionType": "REFUND",
            "amount": {
                "value": "103.5",
                "currency": "USD"
            },
            "bookingEntry": "DEBIT",
            "transactionDate": "2024-10-31T11:21:37.000Z",
            "transactionStatus": "PAYOUT",
            "paymentsEntity": "eBay Commerce Inc."
        },
        {
            "transactionId": "2********6",
            "orderId": "0********7",
            "salesRecordReference": "4********3",
            "buyer": {
                "username": "r********2"
            },
            "transactionType": "REFUND",
            "amount": {
                "value": "101.5",
                "currency": "USD"
            },
            "bookingEntry": "DEBIT",
            "transactionDate": "2024-10-31T10:27:27.000Z",
            "transactionStatus": "FUNDS_PROCESSING",
            "paymentsEntity": "eBay Commerce Inc."
        },
        {
            "transactionId": "2********7",
            "orderId": "0********7",
            "salesRecordReference": "4********2",
            "buyer": {
                "username": "r********2"
            },
            "transactionType": "REFUND",
            "amount": {
                "value": "103.5",
                "currency": "USD"
            },
            "bookingEntry": "DEBIT",
            "transactionDate": "2024-10-31T10:21:59.000Z",
            "transactionStatus": "FUNDS_PROCESSING",
            "paymentsEntity": "eBay Commerce Inc."
        }
    ],
    "total": 4
}
```

---


## Sample 6

### Response Sample

```json
{
    "href": "https://apiz.ebay.com/sell/finances/v1/transaction?filter=transactionType%3A%7BSHIPPING_LABEL%7D&limit=20&offset=0",
    "limit": 20,
    "offset": 0,
    "transactions": [
        {
            "transactionId": "2********0",
            "orderId": "0********3",
            "payoutId": "5*****3",
            "salesRecordReference": "0",
            "buyer": {
                "username": "r********1"
            },
            "transactionType": "SHIPPING_LABEL",
            "amount": {
                "value": "1.87",
                "currency": "USD"
            },
            "bookingEntry": "CREDIT",
            "transactionDate": "2025-02-10T07:51:10.000Z",
            "transactionStatus": "PAYOUT",
            "transactionMemo": "Refund - underpaid postage dispute accepted"
        },
        {
            "transactionId": "2********9",
            "orderId": "0********3",
            "payoutId": "5*****3",
            "salesRecordReference": "0",
            "buyer": {
                "username": "r********1"
            },
            "transactionType": "SHIPPING_LABEL",
            "amount": {
                "value": "3.08",
                "currency": "USD"
            },
            "bookingEntry": "DEBIT",
            "transactionDate": "2025-02-10T07:49:28.000Z",
            "transactionStatus": "PAYOUT",
            "transactionMemo": "Charge - underpaid postage"
        },
        {
            "transactionId": "2********9",
            "orderId": "0********3",
            "payoutId": "5*****3",
            "salesRecordReference": "0",
            "buyer": {
                "username": "r********1"
            },
            "transactionType": "SHIPPING_LABEL",
            "amount": {
                "value": "7.02",
                "currency": "USD"
            },
            "bookingEntry": "DEBIT",
            "transactionDate": "2025-02-08T00:25:26.000Z",
            "transactionStatus": "PAYOUT",
            "transactionMemo": "Shipping label purchased"
        },
        {
            "transactionId": "0********3",
            "payoutId": "5*****3",
            "salesRecordReference": "0",
            "buyer": {
                "username": "E********Y"
            },
            "transactionType": "SHIPPING_LABEL",
            "amount": {
                "value": "1.01",
                "currency": "USD"
            },
            "bookingEntry": "DEBIT",
            "transactionDate": "2025-02-07T09:04:12.000Z",
            "transactionStatus": "PAYOUT",
            "transactionMemo": "Charge - underpaid postage"
        },
        {
            "transactionId": "0********3",
            "payoutId": "5*****3",
            "salesRecordReference": "0",
            "buyer": {
                "username": "E********Y"
            },
            "transactionType": "SHIPPING_LABEL",
            "amount": {
                "value": "7.0",
                "currency": "USD"
            },
            "bookingEntry": "DEBIT",
            "transactionDate": "2025-02-07T09:03:16.000Z",
            "transactionStatus": "PAYOUT",
            "transactionMemo": "Shipping label purchased"
        }
    ],
    "total": 5
}
```

---


## Sample 7

### Response Sample

```json
{
    "transactionId": "0******3",
    "orderId": "0******3",
    "payoutId": "5******3",
    "salesRecordReference": "0",
    "buyer": {
        "username": "t******3"
    },
    "transactionType": "SALE",
    "amount": {
        "value": "85.0",
        "currency": "USD"
    },
    "totalFeeBasisAmount": {
        "value": "100.0",
        "currency": "USD"
    },
    "totalFeeAmount": {
        "value": "15.0",
        "currency": "USD"
    },
    "orderLineItems": [
        {
            "lineItemId": "1******4",
            "feeBasisAmount": {
                "value": "100.0",
                "currency": "USD"
            },
            "marketplaceFees": [
                {
                    "feeType": "FINAL_VALUE_FEE_FIXED_PER_ORDER",
                    "amount": {
                        "value": "0.5",
                        "currency": "USD"
                    }
                },
                {
                    "feeType": "FINAL_VALUE_FEE",
                    "amount": {
                        "value": "4.5",
                        "currency": "USD"
                    }
                }
            ],
            "donations": [
                {
                    "feeType": "CHARITY_DONATION",
                    "amount": {
                        "value": "10.0",
                        "currency": "USD"
                    }
                }
            ]
        }
    ],
    "bookingEntry": "CREDIT",
    "transactionDate": "2023-09-01T10:16:35.000Z",
    "transactionStatus": "PAYOUT",
    "paymentsEntity": "eBay Commerce Inc."
}
```

---


## Sample 8

### Response Sample

```json
[
    {
        "transactionId": "1*-1***9-0***8",
        "orderId": "1*-1***9-0***8",
        "payoutId": "6********5",
        "salesRecordReference": "0",
        "buyer": {
            "username": "b******7"
        },
        "transactionType": "SALE",
        "amount": {
            "value": "1365.87",
            "currency": "USD"
        },
        "bookingEntry": "CREDIT",
        "transactionDate": "2025-01-06T14:18:03.129Z",
        "transactionStatus": "PAYOUT",
        "paymentsEntity": "eBay Commerce Inc."
    },
    {
        "transactionId": "FEE-6*********211_*1",
        "payoutId": "6********7",
        "salesRecordReference": "0",
        "transactionType": "NON_SALE_CHARGE",
        "amount": {
            "value": "0.72",
            "currency": "USD"
        },
        "bookingEntry": "DEBIT",
        "transactionDate": "2025-01-06T14:22:01.394Z",
        "transactionStatus": "PAYOUT",
        "paymentsEntity": "eBay Commerce Inc.",
        "references": [
            {
                "referenceId": "3********772",
                "referenceType": "ITEM_ID"
            },
            {
                "referenceId": "1*-1***9-0***8",
                "referenceType": "ORDER_ID"
            }
        ],
        "feeType": "FINAL_VALUE_FEE"
    },
    {
        "transactionId": "FEE-6*********911_11",
        "payoutId": "6******727",
        "salesRecordReference": "0",
        "transactionType": "NON_SALE_CHARGE",
        "amount": {
            "value": "0.3",
            "currency": "USD"
        },
        "bookingEntry": "DEBIT",
        "transactionDate": "2025-01-06T14:21:36.807Z",
        "transactionStatus": "PAYOUT",
        "paymentsEntity": "eBay Commerce Inc.",
        "references": [
            {
                "referenceId": "3********997",
                "referenceType": "ITEM_ID"
            },
            {
                "referenceId": "1*-1***9-0***8",
                "referenceType": "ORDER_ID"
            }
        ],
        "feeType": "FINAL_VALUE_FEE_FIXED_PER_ORDER"
    }
]
```

---

