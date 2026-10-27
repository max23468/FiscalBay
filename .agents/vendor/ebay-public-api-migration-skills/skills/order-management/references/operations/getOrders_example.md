# GET : getOrders Samples

This file contains sanitized synthetic examples for partner-safe reference use.

## Example Request: Collection Retrieval

```http
GET /sell/fulfillment/v1/order?limit=2&offset=0
Authorization: Bearer <user-oauth-token>
Content-Type: application/json
```

## Example Response: Collection Retrieval

```json
{
  "href": "https://api.ebay.com/sell/fulfillment/v1/order?limit=2&offset=0",
  "limit": 2,
  "offset": 0,
  "total": 2,
  "orders": [
    {
      "orderId": "ORDER-0001",
      "creationDate": "2026-03-12T10:15:00.000Z",
      "lastModifiedDate": "2026-03-12T12:30:00.000Z",
      "orderFulfillmentStatus": "NOT_STARTED",
      "orderPaymentStatus": "PAID",
      "pricingSummary": {
        "priceSubtotal": {
          "value": "116.26",
          "currency": "EUR"
        },
        "deliveryCost": {
          "value": "16.26",
          "currency": "EUR"
        },
        "total": {
          "value": "132.52",
          "currency": "EUR"
        }
      },
      "paymentSummary": {
        "totalDueSeller": {
          "value": "132.52",
          "currency": "EUR"
        },
        "payments": [
          {
            "paymentMethod": "EBAY",
            "paymentReferenceId": "PAY-1001",
            "paymentDate": "2026-03-12T10:16:00.000Z",
            "amount": {
              "value": "132.52",
              "currency": "EUR"
            },
            "paymentStatus": "PAID"
          }
        ]
      },
      "fulfillmentStartInstructions": [
        {
          "fulfillmentInstructionsType": "SHIP_TO",
          "shippingStep": {
            "shipTo": {
              "fullName": "Example Buyer One",
              "contactAddress": {
                "addressLine1": "100 Example Avenue",
                "city": "Example City",
                "stateOrProvince": "BE-BRU",
                "postalCode": "1000",
                "countryCode": "BE"
              },
              "primaryPhone": {
                "phoneNumber": "5550101"
              },
              "email": "buyer-one@example.test"
            },
            "shippingCarrierCode": "HERMES",
            "shippingServiceCode": "STANDARD_INTL"
          }
        }
      ],
      "lineItems": [
        {
          "lineItemId": "LINE-1001",
          "legacyItemId": "123456789001",
          "title": "Example Cross-Border Accessory Bundle",
          "quantity": 1,
          "soldFormat": "FIXED_PRICE",
          "lineItemFulfillmentStatus": "NOT_STARTED",
          "lineItemCost": {
            "value": "100.00",
            "currency": "EUR"
          }
        }
      ]
    },
    {
      "orderId": "ORDER-0002",
      "creationDate": "2026-03-13T09:00:00.000Z",
      "lastModifiedDate": "2026-03-13T09:05:00.000Z",
      "orderFulfillmentStatus": "FULFILLED",
      "orderPaymentStatus": "PAID",
      "pricingSummary": {
        "priceSubtotal": {
          "value": "54.99",
          "currency": "USD"
        },
        "deliveryCost": {
          "value": "0.00",
          "currency": "USD"
        },
        "tax": {
          "value": "4.81",
          "currency": "USD"
        },
        "total": {
          "value": "59.80",
          "currency": "USD"
        }
      },
      "paymentSummary": {
        "totalDueSeller": {
          "value": "59.80",
          "currency": "USD"
        },
        "payments": [
          {
            "paymentMethod": "EBAY",
            "paymentReferenceId": "PAY-1002",
            "paymentDate": "2026-03-13T09:01:00.000Z",
            "amount": {
              "value": "59.80",
              "currency": "USD"
            },
            "paymentStatus": "PAID"
          }
        ]
      },
      "fulfillmentStartInstructions": [
        {
          "fulfillmentInstructionsType": "SHIP_TO",
          "shippingStep": {
            "shipTo": {
              "fullName": "Example Buyer Two",
              "contactAddress": {
                "addressLine1": "200 Sample Road",
                "city": "Sampletown",
                "stateOrProvince": "TX",
                "postalCode": "73301",
                "countryCode": "US"
              },
              "primaryPhone": {
                "phoneNumber": "5550102"
              },
              "email": "buyer-two@example.test"
            },
            "shippingCarrierCode": "USPS",
            "shippingServiceCode": "PRIORITY_MAIL"
          }
        }
      ],
      "lineItems": [
        {
          "lineItemId": "LINE-1002",
          "legacyItemId": "123456789002",
          "title": "Example Priority Mail Item",
          "quantity": 1,
          "soldFormat": "FIXED_PRICE",
          "lineItemFulfillmentStatus": "FULFILLED",
          "lineItemCost": {
            "value": "54.99",
            "currency": "USD"
          }
        }
      ]
    }
  ]
}
```

## Example Request: Targeted Lookup

```http
GET /sell/fulfillment/v1/order?orderIds=ORDER-0001,ORDER-0002
Authorization: Bearer <user-oauth-token>
Content-Type: application/json
```

## Notes

- Values are synthetic placeholders for external-share safety.
- Keep buyer identity fields synthetic or omit them entirely when sharing examples externally.
- Replace identifiers, carrier codes, and currency values with environment-appropriate test data during validation.
