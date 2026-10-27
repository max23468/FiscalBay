# GET : getOrder Samples

This file contains a sanitized synthetic example for partner-safe reference use.

## Example Request

```http
GET /sell/fulfillment/v1/order/ORDER-0001
Authorization: Bearer <user-oauth-token>
Content-Type: application/json
```

## Example Response

```json
{
  "orderId": "ORDER-0001",
  "creationDate": "2026-03-12T10:15:00.000Z",
  "lastModifiedDate": "2026-03-12T12:30:00.000Z",
  "orderFulfillmentStatus": "NOT_STARTED",
  "orderPaymentStatus": "PAID",
  "buyerCheckoutNotes": "Leave package at front desk.",
  "pricingSummary": {
    "priceSubtotal": {
      "value": "263.00",
      "currency": "USD"
    },
    "deliveryCost": {
      "value": "10.00",
      "currency": "USD"
    },
    "tax": {
      "value": "21.04",
      "currency": "USD"
    },
    "total": {
      "value": "294.04",
      "currency": "USD"
    }
  },
  "paymentSummary": {
    "totalDueSeller": {
      "value": "294.04",
      "currency": "USD"
    },
    "payments": [
      {
        "paymentMethod": "EBAY",
        "paymentReferenceId": "PAY-0001",
        "paymentDate": "2026-03-12T10:16:00.000Z",
        "amount": {
          "value": "294.04",
          "currency": "USD"
        },
        "paymentStatus": "PAID"
      }
    ],
    "refunds": []
  },
  "fulfillmentStartInstructions": [
    {
      "fulfillmentInstructionsType": "SHIP_TO",
      "minEstimatedDeliveryDate": "2026-03-15T00:00:00.000Z",
      "maxEstimatedDeliveryDate": "2026-03-18T00:00:00.000Z",
      "ebaySupportedFulfillment": false,
      "shippingStep": {
        "shipTo": {
          "fullName": "Example Buyer",
          "contactAddress": {
            "addressLine1": "123 Example Street",
            "city": "Example City",
            "stateOrProvince": "CA",
            "postalCode": "94000",
            "countryCode": "US"
          },
          "primaryPhone": {
            "phoneNumber": "5550100"
          },
          "email": "buyer@example.test"
        },
        "shippingCarrierCode": "UPS",
        "shippingServiceCode": "UPS_GROUND"
      }
    }
  ],
  "lineItems": [
    {
      "lineItemId": "LINE-0001",
      "legacyItemId": "123456789012",
      "title": "Example 43 inch 4K Television",
      "quantity": 1,
      "soldFormat": "FIXED_PRICE",
      "listingMarketplaceId": "EBAY_US",
      "purchaseMarketplaceId": "EBAY_US",
      "lineItemFulfillmentStatus": "NOT_STARTED",
      "lineItemCost": {
        "value": "263.00",
        "currency": "USD"
      },
      "deliveryCost": {
        "value": "10.00",
        "currency": "USD"
      },
      "tax": {
        "value": "21.04",
        "currency": "USD"
      },
      "total": {
        "value": "294.04",
        "currency": "USD"
      }
    }
  ]
}
```

## Notes

- Values are synthetic placeholders for external-share safety.
- Replace the order identifier, OAuth token, and carrier values with your own test data when validating the API call.
