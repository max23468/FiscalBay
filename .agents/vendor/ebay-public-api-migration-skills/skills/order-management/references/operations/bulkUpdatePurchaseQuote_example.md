# bulkUpdatePurchaseQuote
**API:** Purchase Quote
**Type:** GraphQL Mutation
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Mutation
**Operation Name:** `bulkUpdatePurchaseQuote`
---

## Description

This sample **bulkUpdatePurchaseQuotes** mutation allows a seller to update purchase quotes.

---

## Request Payload

```graphql
{
	"query" : "mutation BulkUpdatePurchaseQuotes($input: BulkUpdatePurchaseQuotesInput!) {
	bulkUpdatePurchaseQuotes(input: $input) {
		__typename
		... on BulkUpdatePurchaseQuotesSuccess {
			updatedPurchaseQuotes {
				purchaseQuoteId
			}
		}
		... on BulkUpdatePurchaseQuotesPartialFailure {
			errorCode
			errorMessage
			updatedPurchaseQuotes {
				purchaseQuoteId
			}
			failures {
				inputPurchaseQuoteId
				errorCode
				displayMessage
				retryable
			}
		}
		... on BulkUpdatePurchaseQuotesCompleteFailure {
			errorCode
			errorMessage
			failures {
				inputPurchaseQuoteId
				errorCode
				displayMessage
				retryable
			}
		}
	}
}
",
	"variables" : {
		"input" : {
			"updates" : [ {
				"purchaseQuoteId" : "02-**-11****07",
				"messageToBuyer" : "update shipping discount to 3.0",
				"lineItems" : [ {
					"itemCommitmentId" : "10-***-65***57"
				} ],
				"total" : {
					"shippingDiscount" : {
						"value" : 3.0,
						"currency" : "USD"
					}
				},
				"emailCopyToSeller" : false
			} ]
		}
	}
}
```

---

## Response Sample

```json
{
		"data": {
				"bulkUpdatePurchaseQuotes": {
						"__typename": "BulkUpdatePurchaseQuotesSuccess",
						"updatedPurchaseQuotes": [
								{
										"purchaseQuoteId": "02-**-11****07"
								}
						]
				}
		}
}
```

