# GET : getBillingActivities Samples

**API:** Finances
**Type:** REST GET
**Endpoint:** `https://api.ebay.com/sell/finances/v1/billing_activity?limit=10&sort=transactionDate&filter=transactionDate:[2025-08-27T21:54:01.174Z..2025-08-27T21:59:07.532Z]&offset=30`
**Method:** GET
**Operation Name:** `getBillingActivities`

---

## Description

This sample retrieves detailed billing activities that occurred within a specified date range sorted by oldest transactions first. The input provides the following query parameters (no input payload). Retrieves billing transactions within a specific date range: filter=transactionDate [*start*..*end*] Sorts response returning oldest transactions first: sort=transactionDate

---

## Response Sample

```json
{
    "billingActivities": [
        {
            "billingTransactionId": "**********16_11",
            "bookingEntry": "DEBIT",
            "feeType": "FinalValueFeeFixedFeePerOrder",
            "feeTypeDescription": "Final Value Fee",
            "billingTransactionDate": "2025-08-27T21:54:01.174Z",
            "amount": {
                "value": "0.75",
                "currency": "USD"
            },
            "listingId": "**********12",
            "orderId": "23-*****-***23"
        },
        {
            "billingTransactionId": "**********18_11",
            "bookingEntry": "DEBIT",
            "feeType": "FinalValueFee20",
            "feeTypeDescription": "Final Value Fee",
            "billingTransactionDate": "2025-08-27T21:54:01.174Z",
            "amount": {
                "value": "10.84",
                "currency": "USD"
            },
            "listingId": "**********12",
            "orderId": "23-*****-***23"
        },
        {
            "billingTransactionId": "**********19_11",
            "bookingEntry": "DEBIT",
            "feeType": "FinalValueFeeFixedFeePerOrder",
            "feeTypeDescription": "Final Value Fee",
            "billingTransactionDate": "2025-08-27T21:56:51.366Z",
            "amount": {
                "value": "0.75",
                "currency": "USD"
            },
            "listingId": "**********72",
            "orderId": "11-*****-***86"
        },
        {
            "billingTransactionId": "**********20_11",
            "bookingEntry": "DEBIT",
            "feeType": "FinalValueFee20",
            "feeTypeDescription": "Final Value Fee",
            "billingTransactionDate": "2025-08-27T21:56:51.366Z",
            "amount": {
                "value": "10.84",
                "currency": "USD"
            },
            "listingId": "**********72",
            "orderId": "11-*****-***86"
        },
        {
            "billingTransactionId": "**********23_11",
            "bookingEntry": "DEBIT",
            "feeType": "FinalValueFee20",
            "feeTypeDescription": "Final Value Fee",
            "billingTransactionDate": "2025-08-27T21:56:51.366Z",
            "amount": {
                "value": "10.84",
                "currency": "USD"
            },
            "listingId": "**********67",
            "orderId": "01-*****-***53"
        },
        {
            "billingTransactionId": "**********05_11",
            "bookingEntry": "DEBIT",
            "feeType": "FinalValueFeeFixedFeePerOrder",
            "feeTypeDescription": "Final Value Fee",
            "billingTransactionDate": "2025-08-27T21:56:51.366Z",
            "amount": {
                "value": "0.75",
                "currency": "USD"
            },
            "listingId": "**********67",
            "orderId": "01-*****-***53"
        },
        {
            "billingTransactionId": "**********22_11",
            "bookingEntry": "DEBIT",
            "feeType": "FinalValueFeeFixedFeePerOrder",
            "feeTypeDescription": "Final Value Fee",
            "billingTransactionDate": "2025-08-27T21:59:07.532Z",
            "amount": {
                "value": "0.75",
                "currency": "USD"
            },
            "listingId": "**********64",
            "orderId": "06-*****-***22"
        },
        {
            "billingTransactionId": "*********52_11",
            "bookingEntry": "DEBIT",
            "feeType": "FinalValueFee20",
            "feeTypeDescription": "Final Value Fee",
            "billingTransactionDate": "2025-08-27T21:59:07.532Z",
            "amount": {
                "value": "10.84",
                "currency": "USD"
            },
            "listingId": "**********01",
            "orderId": "18-*****-***45"
        },
        {
            "billingTransactionId": "*********16_11",
            "bookingEntry": "DEBIT",
            "feeType": "FinalValueFee20",
            "feeTypeDescription": "Final Value Fee",
            "billingTransactionDate": "2025-08-27T21:59:07.532Z",
            "amount": {
                "value": "10.84",
                "currency": "USD"
            },
            "listingId": "**********64",
            "orderId": "06-*****-***22"
        },
        {
            "billingTransactionId": "*********17_11",
            "bookingEntry": "DEBIT",
            "feeType": "FinalValueFeeFixedFeePerOrder",
            "feeTypeDescription": "Final Value Fee",
            "billingTransactionDate": "2025-08-27T21:59:07.532Z",
            "amount": {
                "value": "0.75",
                "currency": "USD"
            },
            "listingId": "**********01",
            "orderId": "18-*****-***45"
        }
    ],
    "prev": "https://api.ebay.com/sell/finances/v1/billing_activity?limit=7&sort=transactionDate&filter=transactionDate:[2025-08-27T21:54:01.174Z..2025-08-27T21:54:01.174Z]&offset=20",
    "next": "https://api.ebay.com/sell/finances/v1/billing_activity?limit=7&sort=transactionDate&filter=transactionDate:[2025-08-27T23:06:55.861Z..2025-08-28T00:00:01Z]&offset=40",
    "limit": 10,
    "offset": 30,
    "count": 10,
    "total": 100
}
```
