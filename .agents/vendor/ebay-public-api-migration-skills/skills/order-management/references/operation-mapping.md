# Order Management Operation Mapping

This file is the authoritative operation-level mapping reference for the full Order Management domain.

## Order creation and invoicing

### AddOrder -> createPurchaseQuote
Purpose:

- Create a combined unpaid order or invoiceable quote for one buyer.

Modern API:

- GraphQL mutation `createPurchaseQuote` in Purchase Quote API.

Key Differences:

- Traditional combined-invoice behavior becomes explicit purchase-quote creation rather than a traditional order mutation.
- Keep this on the unpaid purchase-quote surface, not the paid-order surface.

Request Payload Transformation:

- Traditional: [AddOrder_example.md](operations/AddOrder_example.md)
- Modern: [createPurchaseQuoteCancellation_example.md](operations/createPurchaseQuoteCancellation_example.md), [createPurchaseQuote_example.md](operations/createPurchaseQuote_example.md)




- Traditional `TransactionArray.Transaction.ItemID` and `TransactionID` identify the unpaid line items to combine; modern `lineItems[].itemCommitmentId` identifies the unpaid commitments to include in the purchase quote.
- Traditional `Total` and `ShippingDetails` become purchase-quote totals and logistics options instead of a direct traditional order payload.
- The modern request creates a pre-payment purchase quote, not a paid order.

Response Payload Transformation:

- Traditional: [AddOrder_example.md](operations/AddOrder_example.md)
- Modern: [createPurchaseQuoteCancellation_example.md](operations/createPurchaseQuoteCancellation_example.md), [createPurchaseQuote_example.md](operations/createPurchaseQuote_example.md)



- Traditional `OrderID` identifies the newly created combined-invoice order record.
- Modern `purchaseQuoteId` identifies the newly created purchase quote before final payment.
- The object lifecycle changes here: the traditional response returns an order identifier, while the modern response returns a purchase-quote identifier that may later lead to an order.

Related Patterns:

- Full traditional doc extract: references/operations/AddOrder_doc.md
- Full modern doc extract: references/operations/createPurchaseQuote_doc.md
- Full modern example: references/operations/createPurchaseQuote_example.md

Migration Guide:

- createPurchaseQuote mutation of Purchase Quote API

### SendInvoice -> createPurchaseQuote + bulkUpdatePurchaseQuote
Purpose:

- Send, resend, or refresh invoice-like information for unpaid order lines before payment.

Modern API:

- GraphQL mutations `createPurchaseQuote` and `bulkUpdatePurchaseQuote` in Purchase Quote API.

Key Differences:

- The traditional email-style invoice reminder becomes purchase-quote creation or update on the unpaid surface.
- The canonical CSV uses `bulkUpdatePurchaseQuote`, while bundled docs use the plural `bulkUpdatePurchaseQuotes`.
- Purchase Quote is also used when the seller sends a reminder for payment or updates invoice-like costs before the buyer pays.
- The bundled modern example now includes a concrete request and response for the plural `bulkUpdatePurchaseQuotes` mutation, so use that shape for payload guidance even though the CSV row name is singular.

Request Payload Transformation:

- Traditional: [SendInvoice_example.md](operations/SendInvoice_example.md)
- Modern: [createPurchaseQuoteCancellation_example.md](operations/createPurchaseQuoteCancellation_example.md), [createPurchaseQuote_example.md](operations/createPurchaseQuote_example.md), [bulkUpdatePurchaseQuote_example.md](operations/bulkUpdatePurchaseQuote_example.md)




- Traditional `ItemID` and `TransactionID` or `OrderID` identify the unpaid order context to invoice.
- Traditional `TransactionID` does not survive as a modern identifier; use `orderLineItemId` when the migration still needs transaction-level identity.
- Use `createPurchaseQuote` for the first invoice and `bulkUpdatePurchaseQuotes` when the quote already exists and only invoice details need to be refreshed.
- Traditional shipping, tax, adjustment, and checkout-instruction fields become purchase-quote updates, totals, line-item references, and seller message fields.

Response Payload Transformation:

- Traditional: [SendInvoice_example.md](operations/SendInvoice_example.md)
- Modern: [createPurchaseQuoteCancellation_example.md](operations/createPurchaseQuoteCancellation_example.md), [createPurchaseQuote_example.md](operations/createPurchaseQuote_example.md), [bulkUpdatePurchaseQuote_example.md](operations/bulkUpdatePurchaseQuote_example.md)



- The traditional response is mostly a SOAP acknowledgement with no call-specific invoice business payload.
- The modern update flow returns `updatedPurchaseQuotes` for the updated unpaid quote and can also surface partial-failure details.
- This remains an invoice-or-quote response, not a paid-order fulfillment response.

Related Patterns:

- Full traditional doc extract: references/operations/SendInvoice_doc.md
- Full modern doc extract: references/operations/createPurchaseQuote_doc.md
- Full modern example: references/operations/createPurchaseQuote_example.md
- Full modern doc extract: references/operations/bulkUpdatePurchaseQuote_doc.md
- Full modern example: references/operations/bulkUpdatePurchaseQuote_example.md

Migration Guide:

- createPurchaseQuote mutation of Purchase Quote API
- bulkupdatepurchasequotes mutation of Purchase Quote API

## Paid and unpaid order retrieval

### GetItemTransactions -> orders + itemCommitments
Purpose:

- Retrieve transactions for one listing, split by paid and unpaid state.

Modern API:

- GraphQL queries `orders` in Order API and `itemCommitments` in Item Commitment API.

Key Differences:

- The modern replacement is not one query; you must split paid orders from unpaid commitments.
- The CSV explicitly keeps both query surfaces visible for the same traditional row.

Request Payload Transformation:

- Traditional: [GetItemTransactions_example.md](operations/GetItemTransactions_example.md)
- Modern: [ordersByIds_example.md](operations/ordersByIds_example.md), [orders_example.md](operations/orders_example.md), [itemCommitmentsByIds_example.md](operations/itemCommitmentsByIds_example.md), [itemCommitments_example.md](operations/itemCommitments_example.md)




- Traditional `ItemID` lookup becomes a state split: use `orders` for paid orders and `itemCommitments` for unpaid commitments tied to the listing.
- The modern request shape is seller-scoped and filter-based instead of a single traditional call that implicitly covered both paid and unpaid transactions.
- Use the corresponding `itemCommitments` query when the transaction is still pre-payment.

Response Payload Transformation:

- Traditional: [GetItemTransactions_example.md](operations/GetItemTransactions_example.md)
- Modern: [ordersByIds_example.md](operations/ordersByIds_example.md), [orders_example.md](operations/orders_example.md), [itemCommitmentsByIds_example.md](operations/itemCommitmentsByIds_example.md), [itemCommitments_example.md](operations/itemCommitments_example.md)



- Traditional response aggregates transactions for one listing in one traditional response.
- Modern responses are split across paid-order and unpaid-commitment collections, so one query no longer covers the full traditional surface.
- Use the `itemCommitments` example alongside `orders` when unpaid commitments must be shown.

Related Patterns:

- Full traditional doc extract: references/operations/GetItemTransactions_doc.md
- Full modern doc extract: references/operations/orders_doc.md
- Full modern example: references/operations/orders_example.md
- Full modern doc extract: references/operations/itemCommitments_doc.md
- Full modern example: references/operations/itemCommitments_example.md

Migration Guide:

- orders query of Order API, specifying the listing through the listingId field and including the includeConfirmed field and setting value to “true”
- itemCommitments query of Item Commitment API, specifying the listing through the listingId field and including the includeCompleted field and setting value to “true”
- itemCommitments query of Item Commitment API, specifying the listing through the listingId field

### GetOrders -> orders + ordersByIds + orderLineItemsByIds + itemCommitments + itemCommitmentsByIds + getOrders + getOrder
Purpose:

- Retrieve paid and unpaid seller orders and order line items, split by payment state.

Modern API:

- GraphQL queries `orders`, `ordersByIds`, and `orderLineItemsByIds` in Order API for paid orders.
- GraphQL queries `itemCommitments` and `itemCommitmentsByIds` in Item Commitment API for unpaid commitments.
- REST methods `getOrders` and `getOrder` in Fulfillment API for paid-order retrieval.

Key Differences:

- The modern replacement forces a state split: use GraphQL or REST paid-order queries for confirmed orders and item-commitment queries for unpaid commitments.
- The original call did not make this paid/unpaid distinction explicit; you must now use two query surfaces.

Request Payload Transformation:

- Traditional: [GetOrders_example.md](operations/GetOrders_example.md)
- Modern: [ordersByIds_example.md](operations/ordersByIds_example.md), [orders_example.md](operations/orders_example.md), [orderLineItemsByIds_example.md](operations/orderLineItemsByIds_example.md), [itemCommitmentsByIds_example.md](operations/itemCommitmentsByIds_example.md), [itemCommitments_example.md](operations/itemCommitments_example.md), [getOrders_example.md](operations/getOrders_example.md), [getOrder_example.md](operations/getOrder_example.md)

The request transformation depends on whether you are querying paid orders or unpaid commitments. See the following qualified entries for specific request examples:

- `GetOrders (paid orders/line items)` for paid-order request transformation.
- `GetOrders (unpaid orders/line items)` for unpaid-commitment request transformation.

Response Payload Transformation:

- Traditional: [GetOrders_example.md](operations/GetOrders_example.md)
- Modern: [ordersByIds_example.md](operations/ordersByIds_example.md), [orders_example.md](operations/orders_example.md), [orderLineItemsByIds_example.md](operations/orderLineItemsByIds_example.md), [itemCommitmentsByIds_example.md](operations/itemCommitmentsByIds_example.md), [itemCommitments_example.md](operations/itemCommitments_example.md), [getOrders_example.md](operations/getOrders_example.md), [getOrder_example.md](operations/getOrder_example.md)

The response transformation depends on whether you are querying paid orders or unpaid commitments. See the following qualified entries for specific response examples:

- `GetOrders (paid orders/line items)` for paid-order response transformation.
- `GetOrders (unpaid orders/line items)` for unpaid-commitment response transformation.

Related Patterns:

- Full traditional doc extract: references/operations/GetOrders_doc.md
- Full modern doc extract: references/operations/orders_doc.md
- Full modern example: references/operations/orders_example.md
- Full modern doc extract: references/operations/getOrders_doc.md
- Full modern example: references/operations/getOrders_example.md
- Full modern doc extract: references/operations/itemCommitments_doc.md
- Full modern example: references/operations/itemCommitments_example.md

Migration Guide:

- getOrders and getOrder methods of Fulfillment API

### GetOrders (paid orders/line items) -> orders + ordersByIds + orderLineItemsByIds + getOrders + getOrder
Purpose:

- Retrieve paid seller orders and paid order line items.

Modern API:

- GraphQL queries `orders`, `ordersByIds`, and `orderLineItemsByIds` in Order API.
- REST methods `getOrders` and `getOrder` in Fulfillment API.

Key Differences:

- This paid-order path is separate from unpaid item commitments.
- Use GraphQL when you want seller-side query shaping and REST when you need Fulfillment API order resources or fulfillment-status semantics.

Request Payload Transformation:

- Traditional: [GetOrders_example.md](operations/GetOrders_example.md)
- Modern: [ordersByIds_example.md](operations/ordersByIds_example.md), [orders_example.md](operations/orders_example.md), [orderLineItemsByIds_example.md](operations/orderLineItemsByIds_example.md), [getOrders_example.md](operations/getOrders_example.md), [getOrder_example.md](operations/getOrder_example.md)




- Use GraphQL `orders` or REST `getOrders` for paid-order collection retrieval.
- Use REST `getOrder` or GraphQL `ordersByIds` and `orderLineItemsByIds` for explicit paid-order and line-item lookup.

Response Payload Transformation:

- Traditional: [GetOrders_example.md](operations/GetOrders_example.md)
- Modern: [ordersByIds_example.md](operations/ordersByIds_example.md), [orders_example.md](operations/orders_example.md), [orderLineItemsByIds_example.md](operations/orderLineItemsByIds_example.md), [getOrders_example.md](operations/getOrders_example.md), [getOrder_example.md](operations/getOrder_example.md)



- Traditional `OrderArray.Order` becomes paid-order collection or paid-order-by-id retrieval on the modern order surfaces.
- The REST `getOrders` response is the other paid-order shape when fulfillment-centric resources are needed.

Related Patterns:

- Full traditional doc extract: references/operations/GetOrders_doc.md
- Full modern doc extract: references/operations/orders_doc.md
- Full modern example: references/operations/orders_example.md
- Full modern doc extract: references/operations/ordersByIds_doc.md
- Full modern example: references/operations/ordersByIds_example.md
- Full modern doc extract: references/operations/orderLineItemsByIds_doc.md
- Full modern example: references/operations/orderLineItemsByIds_example.md
- Full modern doc extract: references/operations/getOrders_doc.md
- Full modern example: references/operations/getOrders_example.md
- Full modern doc extract: references/operations/getOrder_doc.md
- Full modern example: references/operations/getOrder_example.md

Migration Guide:

- orders query of Order API
- ordersByIds query of Order API
- orderLineItemsByIds query of Order API
- getOrders and getOrder methods of Fulfillment API

### GetOrders (unpaid orders/line items) -> itemCommitments + itemCommitmentsByIds
Purpose:

- Retrieve unpaid item commitments and unpaid line-item commitments.

Modern API:

- GraphQL queries `itemCommitments` and `itemCommitmentsByIds` in Item Commitment API.

Key Differences:

- This unpaid path is separate from paid orders.
- Unpaid `GetOrders` results are now represented as item commitments rather than order records.

Request Payload Transformation:

- Traditional: [GetOrders_example.md](operations/GetOrders_example.md)
- Modern: [itemCommitmentsByIds_example.md](operations/itemCommitmentsByIds_example.md), [itemCommitments_example.md](operations/itemCommitments_example.md)


- Use `itemCommitments` for unpaid commitment collection retrieval.
- Use `itemCommitmentsByIds` for explicit unpaid commitment lookup by distinct item commitment identifiers.
- The bundled Item Commitment examples in this package show the modern request shapes for both queries.

Response Payload Transformation:

- Traditional: [GetOrders_example.md](operations/GetOrders_example.md)
- Modern: [itemCommitmentsByIds_example.md](operations/itemCommitmentsByIds_example.md), [itemCommitments_example.md](operations/itemCommitments_example.md)


- Unpaid results are returned as item commitment collections or item commitment-by-id results instead of order records.
- Item commitment responses expose unpaid state, associated purchase quote or order linkage when present, and commitment lifecycle details on the commitment object.

Related Patterns:

- Full traditional doc extract: references/operations/GetOrders_doc.md
- Full modern doc extract: references/operations/itemCommitments_doc.md
- Full modern example: references/operations/itemCommitments_example.md
- Full modern doc extract: references/operations/itemCommitmentsByIds_doc.md
- Full modern example: references/operations/itemCommitmentsByIds_example.md

Migration Guide:

- itemCommitments query of Item Commitment API
- itemCommitmentsByIds query of Item Commitment API

### GetSellerTransactions (paid orders/line items) -> orders + ordersByIds + orderLineItemsByIds + getOrders + getOrder
Purpose:

- Retrieve paid seller transaction details for paid orders and paid order line items.

Modern API:

- GraphQL queries `orders`, `ordersByIds`, and `orderLineItemsByIds` in Order API.
- REST methods `getOrders` and `getOrder` in Fulfillment API.

Key Differences:

- This paid path is separate from unpaid seller-side item commitments.
- Choose GraphQL or REST based on whether seller query shaping or fulfillment-oriented order resources are needed.

Request Payload Transformation:

- Traditional: [GetSellerTransactions_example.md](operations/GetSellerTransactions_example.md)
- Modern: [ordersByIds_example.md](operations/ordersByIds_example.md), [orders_example.md](operations/orders_example.md), [orderLineItemsByIds_example.md](operations/orderLineItemsByIds_example.md), [getOrders_example.md](operations/getOrders_example.md), [getOrder_example.md](operations/getOrder_example.md)




- Use `orders` or REST `getOrders` for paid seller transaction collections.
- Use `ordersByIds`, `orderLineItemsByIds`, or REST `getOrder` for explicit paid-order and line-item lookup.

Response Payload Transformation:

- Traditional: [GetSellerTransactions_example.md](operations/GetSellerTransactions_example.md)
- Modern: [ordersByIds_example.md](operations/ordersByIds_example.md), [orders_example.md](operations/orders_example.md), [orderLineItemsByIds_example.md](operations/orderLineItemsByIds_example.md), [getOrders_example.md](operations/getOrders_example.md), [getOrder_example.md](operations/getOrder_example.md)

### GetSellerTransactions -> orders + ordersByIds + orderLineItemsByIds + itemCommitments + itemCommitmentsByIds
Purpose:

- Retrieve paid seller transactions and unpaid seller-side commitments, split by payment state.

Modern API:

- GraphQL queries `orders`, `ordersByIds`, and `orderLineItemsByIds` in Order API for paid transactions.
- GraphQL queries `itemCommitments` and `itemCommitmentsByIds` in Item Commitment API for unpaid commitments.

Key Differences:

- The modern replacement forces a state split: use GraphQL paid-order queries for confirmed orders and item-commitment queries for unpaid commitments.
- The original `GetSellerTransactions` covered both states without explicit separation.

Request Payload Transformation:

- Traditional: [GetSellerTransactions_example.md](operations/GetSellerTransactions_example.md)
- Modern: [ordersByIds_example.md](operations/ordersByIds_example.md), [orders_example.md](operations/orders_example.md), [orderLineItemsByIds_example.md](operations/orderLineItemsByIds_example.md), [itemCommitmentsByIds_example.md](operations/itemCommitmentsByIds_example.md), [itemCommitments_example.md](operations/itemCommitments_example.md)

The request transformation depends on whether you are querying paid transactions or unpaid commitments. See the following qualified entries for specific request examples:

- `GetSellerTransactions (paid orders/line items)` for paid-transaction request transformation.
- `GetSellerTransactions (unpaid orders/line items)` for unpaid-commitment request transformation.

Response Payload Transformation:

- Traditional: [GetSellerTransactions_example.md](operations/GetSellerTransactions_example.md)
- Modern: [ordersByIds_example.md](operations/ordersByIds_example.md), [orders_example.md](operations/orders_example.md), [orderLineItemsByIds_example.md](operations/orderLineItemsByIds_example.md), [itemCommitmentsByIds_example.md](operations/itemCommitmentsByIds_example.md), [itemCommitments_example.md](operations/itemCommitments_example.md)

The response transformation depends on whether you are querying paid transactions or unpaid commitments. See the following qualified entries for specific response examples:

- `GetSellerTransactions (paid orders/line items)` for paid-transaction response transformation.
- `GetSellerTransactions (unpaid orders/line items)` for unpaid-commitment response transformation.

Related Patterns:

- Full traditional doc extract: references/operations/GetSellerTransactions_doc.md
- Full modern doc extract: references/operations/orders_doc.md
- Full modern example: references/operations/orders_example.md
- Full modern doc extract: references/operations/itemCommitments_doc.md
- Full modern example: references/operations/itemCommitments_example.md

Migration Guide:

- getOrders and getOrder methods of Fulfillment API

### GetSellerTransactions (paid orders/line items) -> orders + ordersByIds + orderLineItemsByIds + getOrders + getOrder

SOAP (before):

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetSellerTransactionsResponse xmlns="urn:ebay:apis:eBLBaseComponents">
	<TransactionArray>
		<Transaction>
			<OrderLineItemID>1234567890-0</OrderLineItemID>
		</Transaction>
	</TransactionArray>
</GetSellerTransactionsResponse>
```

GraphQL (after):

```json
{
	"data": {
		"orders": {
			"sellerOrders": {
				"orders": [
					{
						"orderId": "EXAMPLE-ORDER-0006",
						"buyer": {
							"legacyUserId": "EXAMPLE-LEGACY-USER-0001"
						}
					}
				],
				"pagination": {
					"previousCursor": null,
					"nextCursor": "EXAMPLE-CURSOR-0001"
				}
			}
		}
	}
}
```

- Traditional seller transaction data is now split across seller order and item commitment surfaces.
- Paid-order responses can also be shaped through REST `getOrders` when fulfillment resources or REST semantics are required.
- The modern response must be selected from object state first, then from transport.

Related Patterns:

- Full traditional doc extract: references/operations/GetSellerTransactions_doc.md
- Full modern doc extract: references/operations/orders_doc.md
- Full modern example: references/operations/orders_example.md
- Full modern doc extract: references/operations/ordersByIds_doc.md
- Full modern example: references/operations/ordersByIds_example.md
- Full modern doc extract: references/operations/orderLineItemsByIds_doc.md
- Full modern example: references/operations/orderLineItemsByIds_example.md
- Full modern doc extract: references/operations/getOrders_doc.md
- Full modern example: references/operations/getOrders_example.md
- Full modern doc extract: references/operations/getOrder_doc.md
- Full modern example: references/operations/getOrder_example.md

Migration Guide:

- orders query of Order API
- ordersByIds query of Order API
- orderLineItemsByIds query of Order API
- getOrders and getOrder methods of Fulfillment API

### GetSellerTransactions (unpaid orders/line items) -> itemCommitments + itemCommitmentsByIds
Purpose:

- Retrieve unpaid seller-side transaction details represented as item commitments.

Modern API:

- GraphQL queries `itemCommitments` and `itemCommitmentsByIds` in Item Commitment API.

Key Differences:

- Unpaid seller transactions are now item commitments rather than paid-order records.
- This unpaid path is separate from the paid-order retrieval path.

Request Payload Transformation:

- Traditional: [GetSellerTransactions_example.md](operations/GetSellerTransactions_example.md)
- Modern: [itemCommitmentsByIds_example.md](operations/itemCommitmentsByIds_example.md), [itemCommitments_example.md](operations/itemCommitments_example.md)


- Use `itemCommitments` for unpaid seller transaction collection retrieval.
- Use `itemCommitmentsByIds` for explicit unpaid seller transaction lookup by distinct item commitment identifiers.
- The bundled Item Commitment examples in this package show the modern request shapes for both queries.

Response Payload Transformation:

- Traditional: [GetSellerTransactions_example.md](operations/GetSellerTransactions_example.md)
- Modern: [itemCommitmentsByIds_example.md](operations/itemCommitmentsByIds_example.md), [itemCommitments_example.md](operations/itemCommitments_example.md)


- Unpaid seller transaction results are returned as item commitment collections or item commitment-by-id results.
- Item commitment responses expose unpaid state, associated purchase quote or order linkage when present, and commitment lifecycle details on the commitment object.

Related Patterns:

- Full traditional doc extract: references/operations/GetSellerTransactions_doc.md
- Full modern doc extract: references/operations/itemCommitments_doc.md
- Full modern example: references/operations/itemCommitments_example.md
- Full modern doc extract: references/operations/itemCommitmentsByIds_doc.md
- Full modern example: references/operations/itemCommitmentsByIds_example.md

Migration Guide:

- itemCommitments query of Item Commitment API
- itemCommitmentsByIds query of Item Commitment API

### GetOrderTransactions (Decommissioned) -> orders + ordersByIds + orderLineItemsByIds + itemCommitments + itemCommitmentsByIds + getOrders + getOrder
Purpose:

- Traditional transaction retrieval now covered by newer order and commitment surfaces.

Modern API:

- GraphQL queries `orders`, `ordersByIds`, and `orderLineItemsByIds` in Order API for paid orders.
- GraphQL queries `itemCommitments` and `itemCommitmentsByIds` in Item Commitment API for unpaid commitments.
- REST methods `getOrders` and `getOrder` in Fulfillment API for paid-order retrieval.

Key Differences:

- The canonical CSV marks this row decommissioned.
- Use the state-aware retrieval guidance from `GetOrders` and `GetSellerTransactions` instead of claiming direct parity.
- Replace traditional `TransactionID` handling with `orderLineItemId` when the old integration depended on transaction-level identity.

Request Payload Transformation:

- Traditional: [GetOrderTransactions_doc.md](operations/GetOrderTransactions_doc.md)
- Modern: [ordersByIds_example.md](operations/ordersByIds_example.md), [orders_example.md](operations/orders_example.md), [orderLineItemsByIds_example.md](operations/orderLineItemsByIds_example.md), [itemCommitmentsByIds_example.md](operations/itemCommitmentsByIds_example.md), [itemCommitments_example.md](operations/itemCommitments_example.md), [getOrders_example.md](operations/getOrders_example.md), [getOrder_example.md](operations/getOrder_example.md)

- Split the request path by object state: use paid-order queries for confirmed orders and item-commitment queries for unpaid commitments.
- Use REST `getOrder` or GraphQL `ordersByIds` and `orderLineItemsByIds` when the migration requires explicit order-level or line-item-level lookup.

Response Payload Transformation:

- Traditional: [GetOrderTransactions_doc.md](operations/GetOrderTransactions_doc.md)
- Modern: [ordersByIds_example.md](operations/ordersByIds_example.md), [orders_example.md](operations/orders_example.md), [orderLineItemsByIds_example.md](operations/orderLineItemsByIds_example.md), [itemCommitmentsByIds_example.md](operations/itemCommitmentsByIds_example.md), [itemCommitments_example.md](operations/itemCommitments_example.md), [getOrders_example.md](operations/getOrders_example.md), [getOrder_example.md](operations/getOrder_example.md)

- The traditional response no longer maps to one generic transaction envelope; the modern response is selected from paid-order versus unpaid-commitment state first.
- Use `orderLineItemId` or item-commitment identity instead of preserving the old transaction envelope as a single transport shape.

Related Patterns:

- Full traditional doc extract: references/operations/GetOrderTransactions_doc.md

Migration Guide:

- orders query of Order API
- ordersByIds query of Order API
- orderLineItemsByIds query of Order API
- getOrders and getOrder methods of Fulfillment API

Migration Guide:



## Fulfillment, payment, and feedback tasks

### CompleteSale -> markItemCommitmentsPaid + markOrdersPaid + leaveFeedback + createShippingFulfillment + provideShipmentInfoForItemNotReceivedInquiry
Purpose:

- Complete multiple order-related tasks including marking orders as paid, providing feedback, providing shipment tracking, and creating shipping fulfillments.

Modern API:

- GraphQL mutation `markItemCommitmentsPaid` in Item Commitment API for marking unpaid item commitments as paid.
- GraphQL mutation `markOrdersPaid` in Order API for marking offline orders as paid.
- REST method `leaveFeedback` in Feedback API for providing feedback.
- REST method `createShippingFulfillment` in Fulfillment API for providing shipment tracking information.
- GraphQL mutation `provideShipmentInfoForItemNotReceivedInquiry` in Order Inquiry API for providing shipment tracking for INR inquiries.

Key Differences:

- The original `CompleteSale` call grouped multiple unrelated tasks into one traditional call; the modern surfaces are dedicated to each task.
- Callers must now invoke the specific modern operation that corresponds to the intended `CompleteSale` usage pattern.

Request Payload Transformation:

- Traditional: [CompleteSale_example.md](operations/CompleteSale_example.md)
- Modern: [markItemCommitmentsPaid_example.md](operations/markItemCommitmentsPaid_example.md), [markOrdersPaid_example.md](operations/markOrdersPaid_example.md), [leaveFeedback_example.md](operations/leaveFeedback_example.md), [createShippingFulfillment_example.md](operations/createShippingFulfillment_example.md), [provideShipmentInfoForItemNotReceivedInquiry_example.md](operations/provideShipmentInfoForItemNotReceivedInquiry_example.md)

The request transformation depends on the specific usage pattern. See the following qualified entries for specific request examples:

- `CompleteSale (mark item commitments as paid)` for marking unpaid item commitments as paid.
- `CompleteSale (mark offline orders as paid)` for marking offline orders as paid.
- `CompleteSale (provide feedback for an order partner)` for providing feedback.
- `CompleteSale (provide shipment tracking information)` for providing shipment tracking.
- `CompleteSale (provide shipment tracking information for INR inquiry)` for providing shipment tracking for INR inquiries.

Response Payload Transformation:

- Traditional: [CompleteSale_example.md](operations/CompleteSale_example.md)
- Modern: [markItemCommitmentsPaid_example.md](operations/markItemCommitmentsPaid_example.md), [markOrdersPaid_example.md](operations/markOrdersPaid_example.md), [leaveFeedback_example.md](operations/leaveFeedback_example.md), [createShippingFulfillment_example.md](operations/createShippingFulfillment_example.md), [provideShipmentInfoForItemNotReceivedInquiry_example.md](operations/provideShipmentInfoForItemNotReceivedInquiry_example.md)

The response transformation depends on the specific usage pattern. See the following qualified entries for specific response examples:

- `CompleteSale (mark item commitments as paid)` for completed-commitment response.
- `CompleteSale (mark offline orders as paid)` for paid-order response.
- `CompleteSale (provide feedback for an order partner)` for feedback response.
- `CompleteSale (provide shipment tracking information)` for shipping-fulfillment response.
- `CompleteSale (provide shipment tracking information for INR inquiry)` for inquiry-response.

Related Patterns:

- Full traditional doc extract: references/operations/CompleteSale_doc.md
- Full modern doc extract: references/operations/markItemCommitmentsPaid_doc.md
- Full modern example: references/operations/markItemCommitmentsPaid_example.md
- Full modern doc extract: references/operations/markOrdersPaid_doc.md
- Full modern example: references/operations/markOrdersPaid_example.md
- Full modern doc extract: references/operations/leaveFeedback_doc.md
- Full modern example: references/operations/leaveFeedback_example.md
- Full modern doc extract: references/operations/createShippingFulfillment_doc.md
- Full modern example: references/operations/createShippingFulfillment_example.md
- Full modern doc extract: references/operations/provideShipmentInfoForItemNotReceivedInquiry_doc.md
- Full modern example: references/operations/provideShipmentInfoForItemNotReceivedInquiry_example.md

Migration Guide:

- markItemCommitmentsPaid of Item Commitment API (for marking item commitments as paid)
- markOrdersPaid mutation of Order API (for marking offline orders as paid)
- leaveFeedback method of Feedback API (for providing feedback)
- createShippingFulfillment method of Fulfillment API (for providing shipment tracking)
- provideShipmentInfoForItemNotReceivedInquiry mutation of Order Inquiry API (for INR inquiry shipment info)

### CompleteSale (mark item commitments as paid) -> markItemCommitmentsPaid
Purpose:

- Mark unpaid item commitments as paid.

Modern API:

- GraphQL mutation `markItemCommitmentsPaid` in Item Commitment API.

Key Differences:

- This branch applies only when `CompleteSale` is being used to mark unpaid item commitments as paid.

Request Payload Transformation:

- Traditional: [CompleteSale_example.md](operations/CompleteSale_example.md)
- Modern: [markItemCommitmentsPaid_example.md](operations/markItemCommitmentsPaid_example.md)


- Route the traditional request to `markItemCommitmentsPaid` when the target object is still an unpaid item commitment.
- The modern mutation updates commitment payment state instead of operating on a paid order.

Response Payload Transformation:

- Traditional: [CompleteSale_example.md](operations/CompleteSale_example.md)
- Modern: [markItemCommitmentsPaid_example.md](operations/markItemCommitmentsPaid_example.md)


- The modern response returns updated item-commitment payment state rather than a generic traditional acknowledgement.

Related Patterns:

- Full traditional doc extract: references/operations/CompleteSale_doc.md
- Full modern doc extract: references/operations/markItemCommitmentsPaid_doc.md
- Full modern example: references/operations/markItemCommitmentsPaid_example.md

Migration Guide:

- markItemCommitmentsPaid of Item Commitment API

### CompleteSale (mark offline orders as paid) -> markOrdersPaid
Purpose:

- Mark offline paid orders as paid.

Modern API:

- GraphQL mutation `markOrdersPaid` in Order API.

Key Differences:

- This branch applies only when `CompleteSale` is being used to mark offline paid orders as paid.

Request Payload Transformation:

- Traditional: [CompleteSale_example.md](operations/CompleteSale_example.md)
- Modern: [markOrdersPaid_example.md](operations/markOrdersPaid_example.md)




- Route the traditional request to `markOrdersPaid` when the target object is already a paid order.

Response Payload Transformation:

- Traditional: [CompleteSale_example.md](operations/CompleteSale_example.md)
- Modern: [markOrdersPaid_example.md](operations/markOrdersPaid_example.md)



- The modern response returns updated paid-order state rather than a generic traditional acknowledgement.

Related Patterns:

- Full traditional doc extract: references/operations/CompleteSale_doc.md
- Full modern doc extract: references/operations/markOrdersPaid_doc.md
- Full modern example: references/operations/markOrdersPaid_example.md

Migration Guide:

- markOrdersPaid mutation of Order API.

### CompleteSale (provide feedback for an order partner) -> leaveFeedback
Purpose:

- Leave feedback for the order partner.

Modern API:

- REST method `leaveFeedback` in Feedback API.

Key Differences:

- Feedback is now a dedicated feedback operation instead of one branch of a broad traditional call.

Request Payload Transformation:

- Traditional: [CompleteSale_example.md](operations/CompleteSale_example.md)
- Modern: [leaveFeedback_example.md](operations/leaveFeedback_example.md)


- Route the traditional feedback branch to `leaveFeedback`.
- Traditional `FeedbackInfo` fields become the modern feedback request fields handled by Feedback API.

Response Payload Transformation:

- Traditional: [CompleteSale_example.md](operations/CompleteSale_example.md)
- Modern: [leaveFeedback_example.md](operations/leaveFeedback_example.md)


- The feedback response is specific to Feedback API instead of the generic traditional acknowledgement.

Related Patterns:

- Full traditional doc extract: references/operations/CompleteSale_doc.md
- Full modern doc extract: references/operations/leaveFeedback_doc.md
- Full modern example: references/operations/leaveFeedback_example.md

Migration Guide:

- leaveFeedback method of Feedback API

### CompleteSale (provide shipment tracking information) -> createShippingFulfillment
Purpose:

- Provide shipment tracking information for a fulfilled order.

Modern API:

- REST method `createShippingFulfillment` in Fulfillment API.

Key Differences:

- Shipment tracking is now handled by the fulfillment surface instead of the generic traditional completion call.

Request Payload Transformation:

- Traditional: [CompleteSale_example.md](operations/CompleteSale_example.md)
- Modern: [createShippingFulfillment_example.md](operations/createShippingFulfillment_example.md)


Representative REST fulfillment request (after):

```http
POST https://api.ebay.com/sell/fulfillment/v1/order/6********5!2********1/shipping_fulfillment
{
	"lineItems": [
		{
			"lineItemId": "EXAMPLE-LINE-ITEM-0001",
			"quantity": 1
		}
	],
	"shippedDate": "2016-07-20T00:00:00.000Z",
	"shippingCarrierCode": "USPS",
	"trackingNumber": "EXAMPLE-TRACKING-0002"
}
```

- Route the traditional shipment-tracking branch to `createShippingFulfillment` for standard fulfilled orders.

Response Payload Transformation:

- Traditional: [CompleteSale_example.md](operations/CompleteSale_example.md)
- Modern: [createShippingFulfillment_example.md](operations/createShippingFulfillment_example.md)


Representative REST fulfillment response (after):

```http
HTTP/1.1 201 Created
Location: /sell/fulfillment/v1/order/6********5!2********1/shipping_fulfillment/1********6
```

- Fulfillment now returns a fulfillment-specific `201 Created` response instead of the generic traditional acknowledgement.

Related Patterns:

- Full traditional doc extract: references/operations/CompleteSale_doc.md
- Full modern doc extract: references/operations/createShippingFulfillment_doc.md
- Full modern example: references/operations/createShippingFulfillment_example.md

Migration Guide:

- createShippingFulfillment method of Fulfillment API

### CompleteSale (provide shipment tracking information for INR inquiry) -> provideShipmentInfoForItemNotReceivedInquiry
Purpose:

- Provide shipment tracking information for an INR inquiry.

Modern API:

- GraphQL mutation `provideShipmentInfoForItemNotReceivedInquiry` in Order Inquiry API.

Key Differences:

- This branch applies only when `CompleteSale` is being used to remediate an item-not-received inquiry.

Request Payload Transformation:

- Traditional: [CompleteSale_example.md](operations/CompleteSale_example.md)
- Modern: [provideShipmentInfoForItemNotReceivedInquiry_example.md](operations/provideShipmentInfoForItemNotReceivedInquiry_example.md)


- Route the traditional INR shipment-tracking branch to `provideShipmentInfoForItemNotReceivedInquiry`.
- The modern mutation records shipment evidence on the inquiry object instead of the generic traditional order-completion surface.

Response Payload Transformation:

- Traditional: [CompleteSale_example.md](operations/CompleteSale_example.md)
- Modern: [provideShipmentInfoForItemNotReceivedInquiry_example.md](operations/provideShipmentInfoForItemNotReceivedInquiry_example.md)


- The modern response is inquiry-specific and returns updated inquiry state instead of the generic traditional acknowledgement.

Related Patterns:

- Full traditional doc extract: references/operations/CompleteSale_doc.md
- Full modern doc extract: references/operations/provideShipmentInfoForItemNotReceivedInquiry_doc.md
- Full modern example: references/operations/provideShipmentInfoForItemNotReceivedInquiry_example.md

Migration Guide:

- provideShipmentInfoForItemNotReceivedInquiry mutation of Order Inquiry API

### ReviseCheckoutStatus (Decommissioned) -> No replacement
Purpose:

- Traditional checkout-status updates are removed from the modern surface.

Modern API:

- Mentioned operation/endpoint either could be decommed or already migrated and available in REST(GQL) apis.

Key Differences:

- The canonical CSV marks this row decommissioned with no replacement.

Related Patterns:

- Full traditional doc extract: references/operations/ReviseCheckoutStatus_doc.md

Migration Guide:



## Cancellation workflows

### SearchCancellations -> sellerContractCancellations
Purpose:

- Search seller-side contract cancellations.

Modern API:

- GraphQL query `sellerContractCancellations` in Cancellation API.

Key Differences:

- Traditional search moves to a GraphQL collection query.

Request Payload Transformation:

- Traditional: [SearchCancellations_example.md](operations/SearchCancellations_example.md)
- Modern: [sellerContractCancellations_example.md](operations/sellerContractCancellations_example.md)



- Use seller-scoped cancellation filters and cursor pagination instead of a traditional search call with page-number semantics.
- The modern search is already on the seller cancellation surface and does not need a separate fallback query.

Response Payload Transformation:

- Traditional: [SearchCancellations_example.md](operations/SearchCancellations_example.md)
- Modern: [sellerContractCancellations_example.md](operations/sellerContractCancellations_example.md)


- The response is a cancellation collection with cursor pagination instead of a flat traditional list.
- Modern cancellation status and requester details are returned directly on each cancellation object.

Related Patterns:

- Full traditional doc extract: references/operations/SearchCancellations_doc.md
- Full modern doc extract: references/operations/sellerContractCancellations_doc.md
- Full modern example: references/operations/sellerContractCancellations_example.md

Migration Guide:

- sellerContractCancellations query of Cancellation API

### ApproveCancellation -> approveContractCancellation
Purpose:

- Approve a seller-visible cancellation request.

Modern API:

- GraphQL mutation `approveContractCancellation` in Cancellation API.

Key Differences:

- Approval is now an explicit mutation rather than a Post-Order action endpoint.
- Digital-signature-sensitive rules may apply for in-scope sellers.

Request Payload Transformation:

- Traditional: [ApproveCancellation_example.md](operations/ApproveCancellation_example.md)
- Modern: [approveContractCancellation_example.md](operations/approveContractCancellation_example.md)



- The modern approval flow is a direct mutation keyed by `cancellationId`.
- Relist behavior is explicit in modern input instead of being implied by surrounding workflow state.

Response Payload Transformation:

- Traditional: [ApproveCancellation_example.md](operations/ApproveCancellation_example.md)
- Modern: [approveContractCancellation_example.md](operations/approveContractCancellation_example.md)


- Approval returns the updated cancellation object instead of a SOAP acknowledgement.
- The completed cancellation state is the main modern confirmation signal.

Related Patterns:

- Full traditional doc extract: references/operations/ApproveCancellation_doc.md
- Full modern doc extract: references/operations/approveContractCancellation_doc.md
- Full modern example: references/operations/approveContractCancellation_example.md

Migration Guide:

- approveContractCancellation mutation of the Cancellation API

### GetCancellation -> contractCancellation
Purpose:

- Retrieve one seller-side contract cancellation.

Modern API:

- GraphQL query `contractCancellation` in Cancellation API.

Key Differences:

- The generated support file uses the seller-scoped GraphQL doc extract for this shared operation name.

Request Payload Transformation:

- Traditional: [GetCancellation_example.md](operations/GetCancellation_example.md)
- Modern: [contractCancellation_example.md](operations/contractCancellation_example.md)



- Traditional direct lookup becomes a query by `cancellationId`.
- The response is nested under a success union instead of a flat SOAP payload.

Response Payload Transformation:

- Traditional: [GetCancellation_example.md](operations/GetCancellation_example.md)
- Modern: [contractCancellation_example.md](operations/contractCancellation_example.md)


- The modern lookup returns the full cancellation object with nested line items, refunds, and actions when requested.
- Status and requester fields replace the simpler traditional cancellation summary fields.

Related Patterns:

- Full traditional doc extract: references/operations/GetCancellation_doc.md
- Full modern doc extract: references/operations/contractCancellation_doc.md
- Full modern example: references/operations/contractCancellation_example.md

Migration Guide:

- contractCancellation query of the Cancellation API

### CreateCancellationRequest -> createOrderCancellation + createItemCommitmentCancellation + createPurchaseQuoteCancellation
Purpose:

- Create a seller-initiated cancellation on the correct paid or unpaid object surface.

Modern API:

- GraphQL mutations `createOrderCancellation`, `createItemCommitmentCancellation`, and `createPurchaseQuoteCancellation`.

Key Differences:

- The traditional one-call action is split by paid order, unpaid commitment, or purchase quote.
- Digital-signature-sensitive rules may apply for in-scope sellers.

Request Payload Transformation:

- Traditional: [CreateCancellationRequest_example.md](operations/CreateCancellationRequest_example.md)
- Modern: [createOrderCancellation_example.md](operations/createOrderCancellation_example.md), [createItemCommitmentCancellation_example.md](operations/createItemCommitmentCancellation_example.md), [createPurchaseQuoteCancellation_example.md](operations/createPurchaseQuoteCancellation_example.md)


- Map traditional `legacyOrderId` to `orderId`, `itemCommitmentId`, or `purchaseQuoteId` based on whether the cancellation is for a paid order, unpaid item commitment, or purchase quote.
- Map traditional `cancelReason` to `contractCancellationReason` on the selected modern mutation.
- Traditional `relistLineItem` details become the modern relist flags on the selected surface, using `relistAllItems` or `relistItem` instead of a line-item array.

Response Payload Transformation:

- Traditional: [CreateCancellationRequest_example.md](operations/CreateCancellationRequest_example.md)
- Modern: [createOrderCancellation_example.md](operations/createOrderCancellation_example.md), [createItemCommitmentCancellation_example.md](operations/createItemCommitmentCancellation_example.md), [createPurchaseQuoteCancellation_example.md](operations/createPurchaseQuoteCancellation_example.md)


- The modern response returns a typed cancellation object with nested status rather than the traditional `CreateCancelResponse` shape.
- Eligibility failures move into mutation-specific GraphQL error unions instead of the traditional `orderEligibilityResult` container.

Related Patterns:

- Full traditional doc extract: references/operations/CreateCancellationRequest_doc.md
- Full modern doc extract: references/operations/createOrderCancellation_doc.md
- Full modern example: references/operations/createOrderCancellation_example.md
- Full modern doc extract: references/operations/createItemCommitmentCancellation_doc.md
- Full modern example: references/operations/createItemCommitmentCancellation_example.md
- Full modern doc extract: references/operations/createPurchaseQuoteCancellation_doc.md
- Full modern example: references/operations/createPurchaseQuoteCancellation_example.md

Migration Guide:

- createItemCommitmentCancellation mutation of Cancellation API
- createOrderCancellation mutation of Cancellation API
- createPurchaseQuoteCancellation mutation of Cancellation API

### RejectCancellation -> declineContractCancellation
Purpose:

- Reject a seller-visible cancellation request.

Modern API:

- GraphQL mutation `declineContractCancellation` in Cancellation API.

Key Differences:

- Rejection is now an explicit mutation rather than a Post-Order action endpoint.

Request Payload Transformation:

- Traditional: [RejectCancellation_example.md](operations/RejectCancellation_example.md)
- Modern: [declineContractCancellation_example.md](operations/declineContractCancellation_example.md)



- The modern rejection path can carry fulfillment details alongside the cancellation ID.
- This is a dedicated mutation rather than a Post-Order action endpoint.

Response Payload Transformation:

- Traditional: [RejectCancellation_example.md](operations/RejectCancellation_example.md)
- Modern: [declineContractCancellation_example.md](operations/declineContractCancellation_example.md)


- Modern rejection returns the updated cancellation state directly.
- Fulfillment-related validation errors are part of the mutation union instead of SOAP warnings.

Related Patterns:

- Full traditional doc extract: references/operations/RejectCancellation_doc.md
- Full modern doc extract: references/operations/declineContractCancellation_doc.md
- Full modern example: references/operations/declineContractCancellation_example.md

Migration Guide:

- declineContractCancellation mutation of Cancellation API

### CheckCancellationEligibility -> No replacement
Purpose:

- Check whether a traditional cancellation workflow can proceed.

Modern API:

- Status is blank in the canonical CSV, with note that the flow is simplified via the GraphQL APIs.

Key Differences:

- The old eligibility-check ceremony is removed rather than replaced.
- If an item is not eligible for a cancellation, a business error occurs when the user attempts to create a cancellation request through a modern GraphQL cancellation mutation.

Related Patterns:

- Full traditional doc extract: references/operations/CheckCancellationEligibility_doc.md

Migration Guide:

- None. If an item is not eligible for a cancellation, a business error will occur when the user attempts to create a cancellation request through any of the new GraphQL cancellation mutations.

### ConfirmCancellationRefund (Decommissioned) -> No replacement
Purpose:

- This traditional capability remains visible for migration planning even though no direct seller-side replacement is validated.

Modern API:

- Mentioned operation/endpoint either could be decommed or already migrated and available in REST(GQL) apis.

Key Differences:

- This traditional flow is not preserved in the modern migration package.
- Do not invent a direct replacement or payload parity claim.

Related Patterns:

- Full traditional doc extract: references/operations/ConfirmCancellationRefund_doc.md

Migration Guide:


## Inquiry and case workflows

### GetCase -> orderInquiry + orderReturn
Purpose:

- Retrieve one traditional case and understand whether it belongs to an INR inquiry or a return.

Modern API:

- GraphQL queries `orderInquiry` in Order Inquiry API and `orderReturn` in Return API.

Key Differences:

- The traditional case object is split by underlying business domain.
- The package prefers seller-scoped GraphQL docs for both modern queries.

Request Payload Transformation:

- Traditional: [GetCase_example.md](operations/GetCase_example.md)
- Modern: [orderInquiry_example.md](operations/orderInquiry_example.md), [orderReturn_example.md](operations/orderReturn_example.md)


Representative alternate GraphQL (after):

```graphql
query GetFullOrderReturn($input: OrderReturnInput!) {
	orderReturn(input: $input) {
		__typename
		... on OrderReturn {
			returnId
			status {
				code
				displayText
			}
		}
	}
}
```

- Traditional case lookup must be routed first: INR cases map to `orderInquiry`, while return-driven cases map to `orderReturn`.
- There is no single modern query that directly preserves the old case abstraction.

Response Payload Transformation:

- Traditional: [GetCase_example.md](operations/GetCase_example.md)
- Modern: [orderInquiry_example.md](operations/orderInquiry_example.md), [orderReturn_example.md](operations/orderReturn_example.md)


Representative alternate GraphQL (after):

```json
{
	"data": {
		"orderReturn": {
			"returnId": "EXAMPLE-RETURN-0001",
			"status": {
				"code": "RETURN_REQUESTED",
				"displayText": "Return Requested"
			}
		}
	}
}
```

- Modern responses are domain-specific and no longer share one generic case envelope.
- Choose the return or inquiry shape after the traditional case type has been classified.

Related Patterns:

- Full traditional doc extract: references/operations/GetCase_doc.md
- Full modern doc extract: references/operations/orderInquiry_doc.md
- Full modern example: references/operations/orderInquiry_example.md
- Full modern doc extract: references/operations/orderReturn_doc.md
- Full modern example: references/operations/orderReturn_example.md

Migration Guide:
- orderInquiry query of Order Inquiry API. Case information is returned if there is a case filed against the inquiry
- orderReturn query of Return API. Case information is returned if there is a case filed against the return

### IssueCaseRefund (Decommissioned) -> processReturnRefund + processOrderInquiryRefund
Purpose:

- Refund a traditional case after classifying it as return-driven or inquiry-driven.

Modern API:

- GraphQL mutations `processReturnRefund` and `processOrderInquiryRefund`.

Key Differences:

- The canonical inventory marks this traditional operation as decommissioned even though concrete modern refund mutations exist.
- The traditional case refund action now depends on the underlying domain.
- Digital-signature-sensitive refund rules may apply for in-scope sellers.

Request Payload Transformation:

- Traditional: [IssueCaseRefund_doc.md](operations/IssueCaseRefund_doc.md), [IssueCaseRefund_example.md](operations/IssueCaseRefund_example.md)
- Modern: [processReturnRefund_example.md](operations/processReturnRefund_example.md), [processOrderInquiryRefund_example.md](operations/processOrderInquiryRefund_example.md)


Representative alternate GraphQL (after):

```graphql
mutation ProcessReturnRefund($input: ProcessReturnRefundInput!) {
	processReturnRefund(input: $input) {
		... on OrderReturn {
			returnId
			status {
				code
				displayText
			}
		}
	}
}
```

- Refund routing depends on whether the traditional case is actually an inquiry or a return.
- There is no one modern refund mutation for all case types.

Response Payload Transformation:

- Traditional: [IssueCaseRefund_doc.md](operations/IssueCaseRefund_doc.md), [IssueCaseRefund_example.md](operations/IssueCaseRefund_example.md)
- Modern: [processReturnRefund_example.md](operations/processReturnRefund_example.md), [processOrderInquiryRefund_example.md](operations/processOrderInquiryRefund_example.md)


Representative alternate GraphQL (after):

```json
{
	"data": {
		"processReturnRefund": {
			"returnId": "EXAMPLE-RETURN-0001",
			"status": {
				"code": "CLOSED",
				"displayText": "Closed"
			}
		}
	}
}
```

- Inquiry refunds and return refunds produce different object shapes and lifecycle results.
- Preserve the split instead of presenting a generic case refund acknowledgement.

Related Patterns:

- Full traditional doc extract: references/operations/IssueCaseRefund_doc.md
- Full traditional example stub: references/operations/IssueCaseRefund_example.md
- Full modern doc extract: references/operations/processReturnRefund_doc.md
- Full modern example: references/operations/processReturnRefund_example.md
- Full modern doc extract: references/operations/processOrderInquiryRefund_doc.md
- Full modern example: references/operations/processOrderInquiryRefund_example.md

Migration Guide:

- processOrderInquiryRefund mutation of Order Inquiry API
- processReturnRefund mutation of Return API

### AppealCaseDecision -> submitReturnReferral + submitOrderInquiryReferral
Purpose:

- Escalate or appeal a case decision through the correct modern referral flow.

Modern API:

- GraphQL mutations `submitReturnReferral` and `submitOrderInquiryReferral`.

Key Differences:

- The traditional appeal action is split by return versus inquiry domain.

Request Payload Transformation:

- Traditional: [AppealCaseDecision_example.md](operations/AppealCaseDecision_example.md)
- Modern: [submitReturnReferral_example.md](operations/submitReturnReferral_example.md), [submitOrderInquiryReferral_example.md](operations/submitOrderInquiryReferral_example.md)


Representative alternate GraphQL (after):

```graphql
mutation SubmitReturnReferral($input: SubmitReturnReferralInput!) {
	submitReturnReferral(input: $input) {
		... on OrderReturn {
			returnId
			status {
				code
				displayText
			}
		}
	}
}
```

- Appeal routing depends on whether the underlying traditional case is an inquiry or a return.
- Modern escalation is expressed as a referral flow, not as a separate appeal endpoint.

Response Payload Transformation:

- Traditional: [AppealCaseDecision_example.md](operations/AppealCaseDecision_example.md)
- Modern: [submitReturnReferral_example.md](operations/submitReturnReferral_example.md), [submitOrderInquiryReferral_example.md](operations/submitOrderInquiryReferral_example.md)


Representative alternate GraphQL (after):

```json
{
	"data": {
		"submitReturnReferral": {
			"returnId": "EXAMPLE-RETURN-0001",
			"status": {
				"code": "OPEN",
				"displayText": "Open"
			}
		}
	}
}
```

- Inquiry referrals can surface a formal case identifier, while return referrals keep the return object as the response anchor.
- Preserve the domain split instead of flattening both outcomes into one response shape.

Related Patterns:

- Full traditional doc extract: references/operations/AppealCaseDecision_doc.md
- Full modern doc extract: references/operations/submitReturnReferral_doc.md
- Full modern example: references/operations/submitReturnReferral_example.md
- Full modern doc extract: references/operations/submitOrderInquiryReferral_doc.md
- Full modern example: references/operations/submitOrderInquiryReferral_example.md

Migration Guide:

- submitOrderInquiryReferral mutation of Order Inquiry API.
- submitReturnReferral mutation of Return API

### ProvideCaseShipmentInfo (Decommissioned) -> provideShipmentInfoForItemNotReceivedInquiry
Purpose:

- Provide shipment tracking to resolve a case that is actually an INR flow.

Modern API:

- GraphQL mutation `provideShipmentInfoForItemNotReceivedInquiry` in Order Inquiry API.

Key Differences:

- The canonical inventory marks this traditional operation as decommissioned even though a concrete inquiry shipment mutation exists.
- Traditional case shipment info becomes inquiry shipment info, not a generic case API.

Request Payload Transformation:

- Traditional: [ProvideCaseShipmentInfo_doc.md](operations/ProvideCaseShipmentInfo_doc.md), [ProvideCaseShipmentInfo_example.md](operations/ProvideCaseShipmentInfo_example.md)
- Modern: [provideShipmentInfoForItemNotReceivedInquiry_example.md](operations/provideShipmentInfoForItemNotReceivedInquiry_example.md)


- This modern mapping is specific to INR inquiry remediation, not a generic case-management transport.
- Supply inquiry shipment tracking on the inquiry object after first classifying the traditional case as INR.

Response Payload Transformation:

- Traditional: [ProvideCaseShipmentInfo_doc.md](operations/ProvideCaseShipmentInfo_doc.md), [ProvideCaseShipmentInfo_example.md](operations/ProvideCaseShipmentInfo_example.md)
- Modern: [provideShipmentInfoForItemNotReceivedInquiry_example.md](operations/provideShipmentInfoForItemNotReceivedInquiry_example.md)


- The response is inquiry-centric and shows the submitted shipment evidence on the inquiry object.
- This is only the right response shape when the traditional case is an INR inquiry.

Related Patterns:

- Full traditional doc extract: references/operations/ProvideCaseShipmentInfo_doc.md
- Full traditional example stub: references/operations/ProvideCaseShipmentInfo_example.md
- Full modern doc extract: references/operations/provideShipmentInfoForItemNotReceivedInquiry_doc.md
- Full modern example: references/operations/provideShipmentInfoForItemNotReceivedInquiry_example.md

Migration Guide:

- provideShipmentInfoForItemNotReceivedInquiry mutation of Order Inquiry API

### SearchCases -> sellerOrderInquiries + sellerOrderReturns
Purpose:

- Search open seller-side cases by routing to the correct underlying inquiry or return collection.

Modern API:

- GraphQL queries `sellerOrderInquiries` and `sellerOrderReturns`.

Key Differences:

- There is no standalone seller case-search API in the bundled modern surface.
- Route based on whether the case is an inquiry or return matter.

Request Payload Transformation:

- Traditional: [SearchCases_example.md](operations/SearchCases_example.md)
- Modern: [sellerOrderInquiries_example.md](operations/sellerOrderInquiries_example.md), [sellerOrderReturns_example.md](operations/sellerOrderReturns_example.md)


Representative alternate GraphQL (after):

```graphql
query SellerOrderReturns($input: SellerOrderReturnsInput!) {
	sellerOrderReturns(input: $input) {
		... on SellerOrderReturnsSuccess {
			orderReturns {
				returnId
				status {
					code
					displayText
				}
			}
		}
	}
}
```

- Search routing depends on whether the traditional case belongs to inquiry or return workflow.
- There is no standalone modern seller case-search query.

Response Payload Transformation:

- Traditional: [SearchCases_example.md](operations/SearchCases_example.md)
- Modern: [sellerOrderInquiries_example.md](operations/sellerOrderInquiries_example.md), [sellerOrderReturns_example.md](operations/sellerOrderReturns_example.md)


Representative alternate GraphQL (after):

```json
{
	"data": {
		"sellerOrderReturns": {
			"orderReturns": [
				{
					"returnId": "EXAMPLE-RETURN-0001",
					"status": {
						"code": "RETURN_REQUESTED",
						"displayText": "Return Requested"
					}
				}
			]
		}
	}
}
```

- Modern search results are domain-specific collections instead of one unified case list.
- Aggregate inquiry and return searches client-side only when the old integration needs a combined view.

Related Patterns:

- Full traditional doc extract: references/operations/SearchCases_doc.md
- Full modern doc extract: references/operations/sellerOrderInquiries_doc.md
- Full modern example: references/operations/sellerOrderInquiries_example.md
- Full modern doc extract: references/operations/sellerOrderReturns_doc.md
- Full modern example: references/operations/sellerOrderReturns_example.md

Migration Guide:

- sellerOrderInquiries query of Order Inquiry API. Case information is returned if there is a case filed against the inquiry
- sellerOrderReturns query of Return API. Case information is returned if there is a case filed against the return

### GetInquiry -> orderInquiry
Purpose:

- Retrieve one seller-side INR inquiry.

Modern API:

- GraphQL query `orderInquiry` in Order Inquiry API.

Key Differences:

- The generated support file uses the seller-scoped GraphQL doc extract for this shared operation name.

Request Payload Transformation:

- Traditional: [GetInquiry_example.md](operations/GetInquiry_example.md)
- Modern: [orderInquiry_example.md](operations/orderInquiry_example.md)


- Modern inquiry lookup is a direct query by inquiry identifier.
- Use this only for INR inquiry flows, not for returns or generic traditional cases.

Response Payload Transformation:

- Traditional: [GetInquiry_example.md](operations/GetInquiry_example.md)
- Modern: [orderInquiry_example.md](operations/orderInquiry_example.md)


- The response is the seller inquiry object with nested inquiry lifecycle fields.
- Inquiry-specific shipment, referral, and refund details are exposed on this object instead of in a generic case payload.

Related Patterns:

- Full traditional doc extract: references/operations/GetInquiry_doc.md
- Full modern doc extract: references/operations/orderInquiry_doc.md
- Full modern example: references/operations/orderInquiry_example.md

Migration Guide:

- orderInquiry query of Order Inquiry API.

### IssueInquiryRefund -> processOrderInquiryRefund
Purpose:

- Refund an INR inquiry from the seller side.

Modern API:

- GraphQL mutation `processOrderInquiryRefund` in Order Inquiry API.

Key Differences:

- The refund action is a dedicated mutation rather than a generic case or inquiry update.
- Digital-signature-sensitive rules may apply for in-scope sellers.

Request Payload Transformation:

- Traditional: [IssueInquiryRefund_example.md](operations/IssueInquiryRefund_example.md)
- Modern: [processOrderInquiryRefund_example.md](operations/processOrderInquiryRefund_example.md)



- The modern refund flow is a dedicated inquiry mutation keyed by `inquiryId`.
- This remains separate from return refunds and closes the inquiry-side refund path explicitly.

Response Payload Transformation:

- Traditional: [IssueInquiryRefund_example.md](operations/IssueInquiryRefund_example.md)
- Modern: [processOrderInquiryRefund_example.md](operations/processOrderInquiryRefund_example.md)


- The modern response returns the updated inquiry object and refund identifiers instead of a generic acknowledgement.
- Inquiry closure and refund evidence now live on the inquiry resource.

Related Patterns:

- Full traditional doc extract: references/operations/IssueInquiryRefund_doc.md
- Full modern doc extract: references/operations/processOrderInquiryRefund_doc.md
- Full modern example: references/operations/processOrderInquiryRefund_example.md

Migration Guide:

- processOrderInquiryRefund method of Order Inquiry API.

### ProvideInquiryShipmentInfo -> provideShipmentInfoForItemNotReceivedInquiry
Purpose:

- Provide shipment tracking to resolve an INR inquiry.

Modern API:

- GraphQL mutation `provideShipmentInfoForItemNotReceivedInquiry` in Order Inquiry API.

Key Differences:

- The modern flow is inquiry-specific and no longer uses generic case-management transport.

Request Payload Transformation:

- Traditional: [ProvideInquiryShipmentInfo_example.md](operations/ProvideInquiryShipmentInfo_example.md)
- Modern: [provideShipmentInfoForItemNotReceivedInquiry_example.md](operations/provideShipmentInfoForItemNotReceivedInquiry_example.md)



- The modern mutation supports one or more tracking objects instead of a generic case shipment update payload.
- This is inquiry-specific and should only be used for INR flows.

Response Payload Transformation:

- Traditional: [ProvideInquiryShipmentInfo_example.md](operations/ProvideInquiryShipmentInfo_example.md)
- Modern: [provideShipmentInfoForItemNotReceivedInquiry_example.md](operations/provideShipmentInfoForItemNotReceivedInquiry_example.md)


- The response confirms shipment evidence on the inquiry object itself.
- Tracking and carrier details are exposed through `providedInformation` instead of a separate traditional case status surface.

Related Patterns:

- Full traditional doc extract: references/operations/ProvideInquiryShipmentInfo_doc.md
- Full modern doc extract: references/operations/provideShipmentInfoForItemNotReceivedInquiry_doc.md
- Full modern example: references/operations/provideShipmentInfoForItemNotReceivedInquiry_example.md

Migration Guide:

- provideShipmentInfoForItemNotReceivedInquiry mutation of Order Inquiry API.

### SearchInquiries -> sellerOrderInquiries
Purpose:

- Search seller-side INR inquiries.

Modern API:

- GraphQL query `sellerOrderInquiries` in Order Inquiry API.

Key Differences:

- Traditional search becomes a GraphQL collection query.

Request Payload Transformation:

- Traditional: [SearchInquiries_example.md](operations/SearchInquiries_example.md)
- Modern: [sellerOrderInquiries_example.md](operations/sellerOrderInquiries_example.md)



- Inquiry search is a collection query with filter presets and cursor pagination.
- This stays on the inquiry surface and should not be mixed with return search results.

Response Payload Transformation:

- Traditional: [SearchInquiries_example.md](operations/SearchInquiries_example.md)
- Modern: [sellerOrderInquiries_example.md](operations/sellerOrderInquiries_example.md)


- Modern inquiry search returns a typed inquiry collection with pagination cursors.
- Status and action metadata are attached to each inquiry instead of being flattened into a traditional search summary.

Related Patterns:

- Full traditional doc extract: references/operations/SearchInquiries_doc.md
- Full modern doc extract: references/operations/sellerOrderInquiries_doc.md
- Full modern example: references/operations/sellerOrderInquiries_example.md

Migration Guide:

- sellerOrderInquiries query of Order Inquiry API.

### SendInquiryMessage -> sendOrderInquiryMessage
Purpose:

- Send a message about an INR inquiry.

Modern API:

- GraphQL mutation `sendOrderInquiryMessage` in Order Inquiry API.

Key Differences:

- Messaging is now a dedicated inquiry mutation.

Request Payload Transformation:

- Traditional: [SendInquiryMessage_example.md](operations/SendInquiryMessage_example.md)
- Modern: [sendOrderInquiryMessage_example.md](operations/sendOrderInquiryMessage_example.md)



- Inquiry messaging is a dedicated mutation scoped to an existing inquiry.
- Use this for communication only, not for refund or shipment actions.

Response Payload Transformation:

- Traditional: [SendInquiryMessage_example.md](operations/SendInquiryMessage_example.md)
- Modern: [sendOrderInquiryMessage_example.md](operations/sendOrderInquiryMessage_example.md)


- The response returns the updated inquiry context rather than a SOAP acknowledgement.
- Follow-up actions remain available on the inquiry object after message submission.

Related Patterns:

- Full traditional doc extract: references/operations/SendInquiryMessage_doc.md
- Full modern doc extract: references/operations/sendOrderInquiryMessage_doc.md
- Full modern example: references/operations/sendOrderInquiryMessage_example.md

Migration Guide:

- sendOrderInquiryMessage mutation of Order Inquiry API.

### CreateInquiry (Decommissioned) -> No replacement
Purpose:

- This traditional capability remains visible for migration planning even though no direct seller-side replacement is validated.

Modern API:

- Mentioned operation/endpoint either could be decommed or already migrated and available in REST(GQL) apis.

Key Differences:

- This traditional flow is not preserved in the modern migration package.
- Do not invent a direct replacement or payload parity claim.

Related Patterns:

- Full traditional doc extract: references/operations/CreateInquiry_doc.md

Migration Guide:


### CheckInquiryEligibility (Decommissioned) -> No replacement
Purpose:

- This traditional capability remains visible for migration planning even though no direct seller-side replacement is validated.

Modern API:

- Mentioned operation/endpoint either could be decommed or already migrated and available in REST(GQL) apis.

Key Differences:

- This traditional helper flow is not preserved in this package.
- Do not invent a direct replacement or payload parity claim.

Related Patterns:

- Full traditional doc extract: references/operations/CheckInquiryEligibility_doc.md

Migration Guide:


### CloseInquiry (Decommissioned) -> No replacement
Purpose:

- This traditional capability remains visible for migration planning even though no direct seller-side replacement is validated.

Modern API:

- Mentioned operation/endpoint either could be decommed or already migrated and available in REST(GQL) apis.

Key Differences:

- Do not invent a direct replacement or payload parity claim.

Related Patterns:

- Full traditional doc extract: references/operations/CloseInquiry_doc.md

Migration Guide:


### ConfirmInquiryRefund (Decommissioned) -> No replacement
Purpose:

- This traditional capability remains visible for migration planning even though no direct seller-side replacement is validated.

Modern API:

- Mentioned operation/endpoint either could be decommed or already migrated and available in REST(GQL) apis.

Key Differences:

- Do not invent a direct replacement or payload parity claim.

Related Patterns:

- Full traditional doc extract: references/operations/ConfirmInquiryRefund_doc.md

Migration Guide:


### EscalateInquiry -> submitOrderInquiryReferral
Purpose:

- Escalate a seller-side INR inquiry.

Modern API:

- GraphQL mutation `submitOrderInquiryReferral` in Order Inquiry API.

Key Differences:

- Escalation becomes a dedicated referral mutation and is seller-scoped in the canonical notes.

Request Payload Transformation:

- Traditional: [EscalateInquiry_example.md](operations/EscalateInquiry_example.md)
- Modern: [submitOrderInquiryReferral_example.md](operations/submitOrderInquiryReferral_example.md)



- Inquiry escalation is a referral mutation with an explicit referral reason.
- This is seller-scoped and distinct from ordinary inquiry messaging.

Response Payload Transformation:

- Traditional: [EscalateInquiry_example.md](operations/EscalateInquiry_example.md)
- Modern: [submitOrderInquiryReferral_example.md](operations/submitOrderInquiryReferral_example.md)


- The modern response can surface a formal case identifier after referral.
- Referral status now belongs to the inquiry object and associated case data.

Related Patterns:

- Full traditional doc extract: references/operations/EscalateInquiry_doc.md
- Full modern doc extract: references/operations/submitOrderInquiryReferral_doc.md
- Full modern example: references/operations/submitOrderInquiryReferral_example.md

Migration Guide:

- submitOrderInquiryReferral mutation of Order Inquiry API.

### ProvideInquiryRefundInfo -> sendOrderInquiryMessage
Purpose:

- Provide additional refund context for an inquiry when no direct replacement exists.

Modern API:

- GraphQL mutation `sendOrderInquiryMessage` in Order Inquiry API as the documented alternative.

Key Differences:

- The CSV explicitly says there is no direct replacement and points to inquiry messaging as the alternative path.

Request Payload Transformation:

- Traditional: [ProvideInquiryRefundInfo_example.md](operations/ProvideInquiryRefundInfo_example.md)
- Modern: [sendOrderInquiryMessage_example.md](operations/sendOrderInquiryMessage_example.md)


- There is still no direct refund-info mutation parity; the supported alternative is to carry the traditional refund explanation as the modern inquiry `message` string.
- Traditional `message.content` becomes the GraphQL `message` field on `sendOrderInquiryMessage`.

Response Payload Transformation:

- Traditional: [ProvideInquiryRefundInfo_example.md](operations/ProvideInquiryRefundInfo_example.md)
- Modern: [sendOrderInquiryMessage_example.md](operations/sendOrderInquiryMessage_example.md)


- The alternative modern flow returns the updated inquiry object and status rather than an empty REST `200` response.
- Keep this as message-based migration guidance, not exact refund-processing parity.

Related Patterns:

- Full traditional doc extract: references/operations/ProvideInquiryRefundInfo_doc.md
- Full modern doc extract: references/operations/sendOrderInquiryMessage_doc.md
- Full modern example: references/operations/sendOrderInquiryMessage_example.md

Migration Guide:

- No direct equivalent for this method, but seller can use the sendOrderInquiryMessage mutation of Order Inquiry API.to update buyer that a refund has been issued


## Returns and return preferences

### EscalateReturn -> submitReturnReferral
Purpose:

- Escalate a seller-side return into a referral flow.

Modern API:

- GraphQL mutation `submitReturnReferral` in Return API.

Key Differences:

- Escalation becomes a dedicated referral mutation instead of a generic Post-Order action endpoint.

Request Payload Transformation:

- Traditional: [EscalateReturn_example.md](operations/EscalateReturn_example.md)
- Modern: [submitReturnReferral_example.md](operations/submitReturnReferral_example.md)


Response Payload Transformation:

- Traditional: [EscalateReturn_example.md](operations/EscalateReturn_example.md)
- Modern: [submitReturnReferral_example.md](operations/submitReturnReferral_example.md), [orderReturn_example.md](operations/orderReturn_example.md)


- The modern response exposes return status, requester, negotiation, and line-item context directly on the return object.
- This query also carries return-document visibility when those documents are part of the return object.

Related Patterns:

- Full traditional doc extract: references/operations/GetReturn_doc.md
- Full modern doc extract: references/operations/orderReturn_doc.md
- Full modern example: references/operations/orderReturn_example.md

Migration Guide:

- submitReturnReferral method of Return API

### GetReturnPreferences -> sellerReturnPreference
Purpose:

- Retrieve seller return preferences such as RMA behavior.

Modern API:

- GraphQL query `sellerReturnPreference` in Return API.

Key Differences:

- Preferences become a dedicated seller query instead of a Post-Order preference endpoint.

Request Payload Transformation:

- Traditional: [GetReturnPreferences_example.md](operations/GetReturnPreferences_example.md)
- Modern: [sellerReturnPreference_example.md](operations/sellerReturnPreference_example.md)



- Return preferences are marketplace-scoped in the modern API.
- Traditional boolean-style preference fields become structured preference objects.

Response Payload Transformation:

- Traditional: [GetReturnPreferences_example.md](operations/GetReturnPreferences_example.md)
- Modern: [sellerReturnPreference_example.md](operations/sellerReturnPreference_example.md)


- The modern response returns marketplace-scoped preference state instead of a flat Post-Order preference payload.
- Preference objects make the enabled or disabled state explicit.

Related Patterns:

- Full traditional doc extract: references/operations/GetReturnPreferences_doc.md
- Full modern doc extract: references/operations/sellerReturnPreference_doc.md
- Full modern example: references/operations/sellerReturnPreference_example.md

Migration Guide:

- sellerReturnPreference query of Return API

### SetReturnPreferences -> updateSellerRMAPreference
Purpose:

- Update seller RMA preference and related return-preference state.

Modern API:

- GraphQL mutation `updateSellerRMAPreference` in Return API.

Key Differences:

- The CSV uses `updateSellerRMAPreference`, while bundled docs use `updateSellerRmaPreference`.
- Treat the naming mismatch as explicit evidence, not as a silent override.

Request Payload Transformation:

- Traditional: [SetReturnPreferences_example.md](operations/SetReturnPreferences_example.md)
- Modern: [updateSellerRMAPreference_example.md](operations/updateSellerRMAPreference_example.md)



- The bundled example uses `updateSellerRmaPreference`, while the mapping keeps the CSV spelling `updateSellerRMAPreference` explicit.
- Preference updates are marketplace-scoped and object-based rather than a flat settings toggle.

Response Payload Transformation:

- Traditional: [SetReturnPreferences_example.md](operations/SetReturnPreferences_example.md)
- Modern: [updateSellerRMAPreference_example.md](operations/updateSellerRMAPreference_example.md)


- The update response returns the updated seller return preferences object.
- Keep the naming mismatch explicit when referring to the doc and example files.

Related Patterns:

- Full traditional doc extract: references/operations/SetReturnPreferences_doc.md
- Full modern doc extract: references/operations/updateSellerRMAPreference_doc.md
- Full modern example: references/operations/updateSellerRMAPreference_example.md

Migration Guide:

- updateSellerRmaPreference mutation of the Return API

### AddShippingLabelInfo -> attachReturnShipmentLabel + recordReturnLabelSentOffline
Purpose:

- Attach or record return-shipping-label information for a seller-side return workflow.

Modern API:

- GraphQL mutations `attachReturnShipmentLabel` and `recordReturnLabelSentOffline` in Return API.

Key Differences:

- The canonical CSV row uses descriptive text instead of a normalized single operation name.
- This is an explicit split migration, not one direct replacement.

Request Payload Transformation:

- Traditional: [AddShippingLabelInfo_example.md](operations/AddShippingLabelInfo_example.md)
- Modern: [attachReturnShipmentLabel_example.md](operations/attachReturnShipmentLabel_example.md), [recordReturnLabelSentOffline_example.md](operations/recordReturnLabelSentOffline_example.md)


- Use `attachReturnShipmentLabel` when the traditional flow is publishing an uploaded label, mapping traditional label file or label reference data to a modern `documentId`, carrier, and tracking number inside `returnShipmentLabels`.
- Use `recordReturnLabelSentOffline` when the traditional flow is only recording that a label was communicated outside the API, mapping label-sent timing and tracking details into `offlineReturnLabelChannel` and `trackings`.
- Traditional `labelAction` determines which modern mutation branch to use; the old single REST action is now split by attached-label versus offline-label workflows.

Response Payload Transformation:

- Traditional: [AddShippingLabelInfo_example.md](operations/AddShippingLabelInfo_example.md)
- Modern: [attachReturnShipmentLabel_example.md](operations/attachReturnShipmentLabel_example.md), [recordReturnLabelSentOffline_example.md](operations/recordReturnLabelSentOffline_example.md)


- Both modern label mutations acknowledge the change through an updated `OrderReturn` object instead of returning traditional `labelData`, `labelURL`, or `labelId` fields.
- Carrier and tracking validation errors are surfaced through mutation-specific GraphQL input validation errors.

Related Patterns:

- Full traditional doc extract: references/operations/AddShippingLabelInfo_doc.md
- Full modern doc extract: references/operations/attachReturnShipmentLabel_doc.md
- Full modern example: references/operations/attachReturnShipmentLabel_example.md
- Full modern doc extract: references/operations/recordReturnLabelSentOffline_doc.md
- Full modern example: references/operations/recordReturnLabelSentOffline_example.md

Migration Guide:

- The recordReturnLabelSentOffline method of the Return API can be used to provide shipment tracking information to eBay and the buyer.
- The attachReturnShipmentLabel mutation of the Return API can also be used and this mutation can actually be used to provide a downloadable return shipping label to the buyer

### SendReturnShippingLabel (Decommissioned) -> attachReturnShipmentLabel
Purpose:

- Send a return shipping label as part of a seller-managed return.

Modern API:

- Status is Decommission in the canonical CSV, with `attachReturnShipmentLabel` preserved as the fallback modern target.

Key Differences:

- Keep the row visible as decommissioned even though a return-label mutation is documented nearby.

Request Payload Transformation:

- Traditional: [SendReturnShippingLabel_doc.md](operations/SendReturnShippingLabel_doc.md), [SendReturnShippingLabel_example.md](operations/SendReturnShippingLabel_example.md)
- Modern: [attachReturnShipmentLabel_example.md](operations/attachReturnShipmentLabel_example.md)


- This traditional downloadable-label flow now becomes a two-step modern workflow: upload the label document with Media API `uploadPostOrderDocument`, then pass the returned document identifier into `returnShipmentLabels[].documentId` on `attachReturnShipmentLabel`.
- Carrier and tracking details move into the nested GraphQL `returnShipmentLabels` input instead of a standalone Post-Order label-send request.

Response Payload Transformation:

- Traditional: [SendReturnShippingLabel_doc.md](operations/SendReturnShippingLabel_doc.md), [SendReturnShippingLabel_example.md](operations/SendReturnShippingLabel_example.md)
- Modern: [attachReturnShipmentLabel_example.md](operations/attachReturnShipmentLabel_example.md)


- The modern response is the updated `OrderReturn` object rather than a traditional label-send acknowledgement.
- Document upload is acknowledged by the Media API step, while label attachment is confirmed on the Return API side through return status.

Related Patterns:

- Full traditional doc extract: references/operations/SendReturnShippingLabel_doc.md
- Full traditional example stub: references/operations/SendReturnShippingLabel_example.md
- Full modern doc extract: references/operations/attachReturnShipmentLabel_doc.md
- Full modern example: references/operations/attachReturnShipmentLabel_example.md

Migration Guide:



### IssueReturnRefund -> processReturnRefund
Purpose:

- Refund a return from the seller side.

Modern API:

- GraphQL mutation `processReturnRefund` in Return API.

Key Differences:

- Return refund is now a dedicated mutation rather than a generic Post-Order action.
- Digital-signature-sensitive rules may apply for in-scope sellers.

Request Payload Transformation:

- Traditional: [IssueReturnRefund_example.md](operations/IssueReturnRefund_example.md)
- Modern: [processReturnRefund_example.md](operations/processReturnRefund_example.md)


- Return refund is a dedicated mutation on the return object.
- Modern refund validation is handled through the mutation union rather than a generic Post-Order action response.

Response Payload Transformation:

- Traditional: [IssueReturnRefund_example.md](operations/IssueReturnRefund_example.md)
- Modern: [processReturnRefund_example.md](operations/processReturnRefund_example.md)


- The response returns the updated return lifecycle state rather than a SOAP acknowledgement.
- Full refund completion can close the return in the modern flow.

Related Patterns:

- Full traditional doc extract: references/operations/IssueReturnRefund_doc.md
- Full modern doc extract: references/operations/processReturnRefund_doc.md
- Full modern example: references/operations/processReturnRefund_example.md

Migration Guide:

- processReturnRefund mutation of Return API

### MarkReturnReceived -> recordReturnReceived
Purpose:

- Record that the returned item was physically received back.

Modern API:

- GraphQL mutation `recordReturnReceived` in Return API.

Key Differences:

- Receipt confirmation is now a dedicated mutation.

Request Payload Transformation:

- Traditional: [MarkReturnReceived_example.md](operations/MarkReturnReceived_example.md)
- Modern: [recordReturnReceived_example.md](operations/recordReturnReceived_example.md)


- Traditional `POST /mark_as_received` becomes a GraphQL mutation with the `returnId` supplied in an input object.
- The bundled modern example does not carry forward the optional traditional comments field.

Response Payload Transformation:

- Traditional: [MarkReturnReceived_example.md](operations/MarkReturnReceived_example.md)
- Modern: [recordReturnReceived_example.md](operations/recordReturnReceived_example.md)


- The modern flow returns the updated return object rather than an empty HTTP `200` acknowledgement.
- Receipt recording is now explicit state mutation on the return object.

Related Patterns:

- Full traditional doc extract: references/operations/MarkReturnReceived_doc.md
- Full modern doc extract: references/operations/recordReturnReceived_doc.md
- Full modern example: references/operations/recordReturnReceived_example.md

Migration Guide:

- recordReturnReceived mutation of Return API

### ProcessReturnRequest -> approveReturn + declineReturn + proposeKeepItemWithPartialRefund + provideRmaNumber
Purpose:

- Decide how to handle a seller-side return request.

Modern API:

- GraphQL mutations `approveReturn`, `declineReturn`, `proposeKeepItemWithPartialRefund`, and `provideRmaNumber` in Return API.

Key Differences:

- One traditional decision endpoint becomes several explicit outcome mutations.
- Choose the mutation from the seller action, not from the traditional endpoint name alone.

Request Payload Transformation:

- Traditional: [ProcessReturnRequest_example.md](operations/ProcessReturnRequest_example.md)
- Modern: [approveReturn_example.md](operations/approveReturn_example.md), [declineReturn_example.md](operations/declineReturn_example.md), [proposeKeepItemWithPartialRefund_example.md](operations/proposeKeepItemWithPartialRefund_example.md), [provideRmaNumber_example.md](operations/provideRmaNumber_example.md)

- Map traditional `decision=APPROVE` to `approveReturn(input: { returnId, approvalNote })`.
- Map traditional `decision=DECLINE` to `declineReturn(input: { returnId, declinationNote })`.
- Map traditional `decision=OFFER_PARTIAL_REFUND` to `proposeKeepItemWithPartialRefund(input: { returnId, keepItemPartialRefundTerms: [...] })`.
- Map traditional `decision=PROVIDE_RMA` to `provideRmaNumber(input: { returnId, rmaNumber, rmaRequirementWaived })`.
- Traditional `comments.content` becomes the note field for the chosen mutation, while conditional fields such as `partialRefundAmount` and `RMANumber` move into mutation-specific input shapes.

Response Payload Transformation:

- Traditional: [ProcessReturnRequest_example.md](operations/ProcessReturnRequest_example.md)
- Modern: [approveReturn_example.md](operations/approveReturn_example.md), [declineReturn_example.md](operations/declineReturn_example.md), [proposeKeepItemWithPartialRefund_example.md](operations/proposeKeepItemWithPartialRefund_example.md), [provideRmaNumber_example.md](operations/provideRmaNumber_example.md)

- `approveReturn`, `declineReturn`, and `provideRmaNumber` return an updated `OrderReturn` with the new lifecycle `status`.
- `proposeKeepItemWithPartialRefund` also returns `returnNegotiation.latestReturnOffer`, because the modern partial-refund path is modeled as a negotiated offer rather than a generic decision response.
- The traditional generic `DecideReturnResponse` and optional `refundStatus` field are replaced by mutation-specific return state or negotiation data.

Related Patterns:

- Full traditional doc extract: references/operations/ProcessReturnRequest_doc.md
- Full modern doc extract: references/operations/approveReturn_doc.md
- Full modern example: references/operations/approveReturn_example.md
- Full modern doc extract: references/operations/declineReturn_doc.md
- Full modern example: references/operations/declineReturn_example.md
- Full modern doc extract: references/operations/proposeKeepItemWithPartialRefund_doc.md
- Full modern example: references/operations/proposeKeepItemWithPartialRefund_example.md
- Full modern doc extract: references/operations/provideRmaNumber_doc.md
- Full modern example: references/operations/provideRmaNumber_example.md

Migration Guide:

- APPROVE action: approveReturn mutation of Return API DECLINE action: declineReturn mutation of Return API OFFER_PARTIAL_REFUND action: proposeKeepItemWithPartialRefund mutation of Return API PROVIDE_RMA action: provideRmaNumber mutation of Return API Traditional decisions without preserved mappings are not migrated

### SearchReturns -> sellerOrderReturns
Purpose:

- Search seller-side returns.

Modern API:

- GraphQL query `sellerOrderReturns` in Return API.

Key Differences:

- Traditional search becomes a GraphQL collection query.

Request Payload Transformation:

- Traditional: [SearchReturns_example.md](operations/SearchReturns_example.md)
- Modern: [sellerOrderReturns_example.md](operations/sellerOrderReturns_example.md)


- Traditional flat query parameters such as `return_state`, date ranges, `limit`, and `offset` become structured GraphQL filter, sort, and pagination input objects.
- Search is now a seller-scoped GraphQL query rather than a REST endpoint returning a summary container.

Response Payload Transformation:

- Traditional: [SearchReturns_example.md](operations/SearchReturns_example.md)
- Modern: [sellerOrderReturns_example.md](operations/sellerOrderReturns_example.md)


- Modern search returns `orderReturns` objects with nested status, line items, and actions instead of the traditional `members[]` plus `countSummary` response shape.
- Pagination and filtering are controlled by GraphQL input and cursor/page semantics rather than REST `offset` and summary metadata alone.

Related Patterns:

- Full traditional doc extract: references/operations/SearchReturns_doc.md
- Full modern doc extract: references/operations/sellerOrderReturns_doc.md
- Full modern example: references/operations/sellerOrderReturns_example.md

Migration Guide:

- sellerOrderReturns query of the Return API

### SendReturnMessage -> sendReturnMessage
Purpose:

- Send a message to a buyer regarding a return.

Modern API:

- GraphQL mutation `sendReturnMessage` in Return API.

Key Differences:

- Messaging is now a dedicated return mutation.

Request Payload Transformation:

- Traditional: [SendReturnMessage_example.md](operations/SendReturnMessage_example.md)
- Modern: [sendReturnMessage_example.md](operations/sendReturnMessage_example.md)


- Traditional `message.content` becomes the plain GraphQL `message` string on `sendReturnMessage`.
- The return identifier moves from the REST path parameter to the GraphQL `input.returnId` field.

Response Payload Transformation:

- Traditional: [SendReturnMessage_example.md](operations/SendReturnMessage_example.md)
- Modern: [sendReturnMessage_example.md](operations/sendReturnMessage_example.md)


- The modern response returns the updated return object rather than an empty HTTP `200` acknowledgement.
- Conversation state is now attached to the return object instead of a standalone REST send-message result.

Related Patterns:

- Full traditional doc extract: references/operations/SendReturnMessage_doc.md
- Full modern doc extract: references/operations/sendReturnMessage_doc.md
- Full modern example: references/operations/sendReturnMessage_example.md

Migration Guide:

- sendReturnMessage mutation of the Return API

### UploadReturnFile -> uploadPostOrderDocument
Purpose:

- Upload a post-order document associated with a return flow.

Modern API:

- REST target `uploadPostOrderDocument` in Media API.

Key Differences:

- The bundled local source set now includes a modern Media API doc page for `uploadPostOrderDocument`.
- The bundled local source set now also includes a modern REST usage example for this specific operation.

Request Payload Transformation:

- Traditional: [UploadReturnFile_example.md](operations/UploadReturnFile_example.md)
- Modern: [uploadPostOrderDocument_example.md](operations/uploadPostOrderDocument_example.md)


- The traditional JSON body with base64 file content is replaced by a Media API form-data upload.
- The upload step requires a pre-created document ID as a URI parameter; only `file` is required in the form body.
- This upload step produces the document identifier later consumed by `attachReturnShipmentLabel` when the migrated flow needs a downloadable return label.

Response Payload Transformation:

- Traditional: [UploadReturnFile_example.md](operations/UploadReturnFile_example.md)
- Modern: [uploadPostOrderDocument_example.md](operations/uploadPostOrderDocument_example.md)


- A successful call returns HTTP 200 with a JSON body containing the document ID, type, status, and file metadata.
- Use the returned `documentId` as the handoff artifact for downstream return-label attachment workflows.

Related Patterns:

- Full traditional doc extract: references/operations/UploadReturnFile_doc.md
- Full modern doc extract: references/operations/uploadPostOrderDocument_doc.md
- Full modern example: references/operations/uploadPostOrderDocument_example.md

Migration Guide:

- uploadPostOrderDocument method of the Media API

### GetReturn -> orderReturn
Purpose:

- Retrieve detailed information about a specific return request.

Modern API:

- GraphQL `orderReturn` query in Return API.

Key Differences:

- The standalone return retrieval endpoint is now a GraphQL query on the return object itself.
- The canonical inventory points to `orderReturn`, which consolidates return information including status, items, negotiation history, and available actions.

Request Payload Transformation:

- Traditional: [GetReturn_example.md](operations/GetReturn_example.md)
- Modern: [orderReturn_example.md](operations/orderReturn_example.md)


- Traditional `GET /return/{returnId}` becomes `orderReturn(input: {returnId: "..."})`.
- Query fields specify exactly which return details to retrieve.

Response Payload Transformation:

- Traditional: [GetReturn_example.md](operations/GetReturn_example.md)
- Modern: [orderReturn_example.md](operations/orderReturn_example.md)

REST (before):

```http
GET /post-order/v2/return/5********2?fieldgroups=FULL
Authorization: Bearer <access-token>
```

Response:

```json
{
  "summary": {
    "returnId": "5********2",
    "currentType": "MONEY_BACK",
    "state": "CLOSED",
    "buyerLoginName": "b********4",
    "sellerLoginName": "s*********5",
    "buyeTotalRefund": {
      "actualRefundAmount": {
        "value": 43.5,
        "currency": "USD"
      }
    },
    "creationInfo": {
      "creationDate": {"value": "2015-07-27T10:35:24.000Z"},
      "item": {
        "itemId": "1**********7",
        "transactionId": "8********9",
        "returnQuantity": 1
      },
      "reason": "ORDERED_ACCIDENTALLY",
      "type": "MONEY_BACK"
    }
  }
}
```


- Return status and state structures are renamed in GraphQL.
- Summary/detail dichotomy is simplified into a single return object with controlled fields.
- Monetary amounts use number type with ISO currency codes rather than traditional Amount objects.

Related Patterns:

- Full traditional doc extract: references/operations/GetReturn_doc.md
- Full modern doc extract: references/operations/orderReturn_doc.md
- Full modern example: references/operations/orderReturn_example.md

Migration Guide:

- orderReturn query of Return API

### GetReturnFiles -> orderReturn
Purpose:

- Retrieve files associated with a return through the return object.

Modern API:

- GraphQL query `orderReturn` in Return API.

Key Differences:

- The old standalone file-retrieval endpoint is absorbed into the return query response.
- The canonical CSV notes that documents appear under the return-creation-documents area of the return object.

Request Payload Transformation:

- Traditional: [GetReturnFiles_example.md](operations/GetReturnFiles_example.md)
- Modern: [orderReturn_example.md](operations/orderReturn_example.md)


- Traditional `GET /return/{returnId}/files` becomes a query on the return object itself using `input.returnId`.
- File and label metadata are now requested from nested return-fulfillment fields instead of a standalone REST files endpoint.

Response Payload Transformation:

- Traditional: [GetReturnFiles_example.md](operations/GetReturnFiles_example.md)
- Modern: [orderReturn_example.md](operations/orderReturn_example.md)


- Document metadata is returned as nested label-document data on the return object rather than a flat traditional `files[]` array.
- The bundled example supports label-document retrieval on the return object, but this package still avoids claiming one-to-one parity for every traditional file-purpose variant.

Related Patterns:

- Full traditional doc extract: references/operations/GetReturnFiles_doc.md
- Full modern doc extract: references/operations/orderReturn_doc.md
- Full modern example: references/operations/orderReturn_example.md

Migration Guide:

- No direct equivalent, but return-related documents will be returned in the sellerOrderReturns and orderReturn query (Return APi) responses if documents are attached to the return request

## Removed traditional rows

### CreateReturnRequest (Decommissioned) -> No replacement
Purpose:

- This traditional capability remains visible for migration planning even though no direct seller-side replacement is validated.

Modern API:

- Mentioned operation/endpoint either could be decommed or already migrated and available in REST(GQL) apis.

Key Differences:

- Do not invent a direct replacement or payload parity claim.

Related Patterns:

- Full traditional doc extract: references/operations/CreateReturnRequest_doc.md

Migration Guide:

- Decommissioned; this traditional flow will not be migrated

### UploadReturnRequestDraftFile (Decommissioned) -> No replacement
Purpose:

- This traditional capability remains visible for migration planning even though no direct seller-side replacement is validated.

Modern API:

- Mentioned operation/endpoint either could be decommed or already migrated and available in REST(GQL) apis.

Key Differences:

- Do not invent a direct replacement or payload parity claim.

Related Patterns:

- Full traditional doc extract: references/operations/UploadReturnRequestDraftFile_doc.md

Migration Guide:


## Additional removed case rows


### CloseCase (Decommissioned) -> No replacement
Purpose:

- Close a traditional case-management record after the underlying issue has been resolved.

Modern API:

- Status is Decommission with no direct replacement.

Key Differences:

- The bundled guidance says case management is merged into inquiry and return workflows rather than preserved as a standalone close method.

Related Patterns:

- Full traditional doc extract: references/operations/CloseCase_doc.md

Migration Guide:


## Additional removed return lifecycle rows

### CheckReturnEligibility (Decommissioned) -> No replacement
Purpose:

- Traditional return-eligibility checking remains visible for migration planning even though no validated seller-side replacement is documented in the canonical inventory.

Modern API:

- Mentioned operation/endpoint either could be decommed or already migrated and available in REST(GQL) apis.

Key Differences:

- The canonical CSV marks this row decommissioned with no preserved seller-side precheck API.

Related Patterns:

- Full traditional doc extract: references/operations/CheckReturnEligibility_doc.md

Migration Guide:


### CreateReturnDraft (Decommissioned) -> No replacement
Purpose:

- Traditional return-draft creation remains visible for migration planning even though no validated seller-side replacement is documented in the canonical inventory.

Modern API:

- Mentioned operation/endpoint either could be decommed or already migrated and available in REST(GQL) apis.

Key Differences:

- The canonical CSV marks this row decommissioned with no preserved direct replacement.

Related Patterns:

- Full traditional doc extract: references/operations/CreateReturnDraft_doc.md

Migration Guide:


### DeleteReturnRequestDraftFile (Decommissioned) -> No replacement
Purpose:

- Traditional draft-file deletion remains visible for migration planning even though no validated seller-side replacement is documented in the canonical inventory.

Modern API:

- Mentioned operation/endpoint either could be decommed or already migrated and available in REST(GQL) apis.

Key Differences:

- No validated seller-side replacement is named in the canonical inventory.

Related Patterns:

- Full traditional doc extract: references/operations/DeleteReturnRequestDraftFile_doc.md

Migration Guide:


### GetReturnDraft (Decommissioned) -> No replacement
Purpose:

- Traditional return-draft retrieval remains visible for migration planning even though no validated seller-side replacement is documented in the canonical inventory.

Modern API:

- Mentioned operation/endpoint either could be decommed or already migrated and available in REST(GQL) apis.

Key Differences:

- The underlying draft concept is removed from the seller-side migration inventory.

Related Patterns:

- Full traditional doc extract: references/operations/GetReturnDraft_doc.md

Migration Guide:


### GetReturnEstimate (Decommissioned) -> No replacement
Purpose:

- Traditional return-estimate retrieval remains visible for migration planning even though no validated seller-side replacement is documented in the canonical inventory.

Modern API:

- Mentioned operation/endpoint either could be decommed or already migrated and available in REST(GQL) apis.

Key Differences:

- The canonical inventory does not preserve a direct estimate endpoint for this removed flow.

Related Patterns:

- Full traditional doc extract: references/operations/GetReturnEstimate_doc.md

Migration Guide:


### CancelReturnRequest (Decommissioned) -> No replacement
Purpose:

- Traditional return-request cancellation remains visible for migration planning even though no validated seller-side replacement is documented in the canonical inventory.

Modern API:

- Mentioned operation/endpoint either could be decommed or already migrated and available in REST(GQL) apis.

Key Differences:

- The canonical CSV marks this row as a removed traditional flow.

Related Patterns:

- Full traditional doc extract: references/operations/CancelReturnRequest_doc.md

Migration Guide:


### CheckShippingLabelPrintEligibility (Decommissioned) -> No replacement
Purpose:

- Traditional shipping-label print eligibility remains visible for migration planning even though no validated seller-side replacement is documented in the canonical inventory.

Modern API:

- Mentioned operation/endpoint either could be decommed or already migrated and available in REST(GQL) apis.

Key Differences:

- This helper flow is removed instead of remapped.

Related Patterns:

- Full traditional doc extract: references/operations/CheckShippingLabelPrintEligibility_doc.md

Migration Guide:


### GetReturnRequestDraftFiles (Decommissioned) -> No replacement
Purpose:

- Traditional draft-file retrieval remains visible for migration planning even though no validated seller-side replacement is documented in the canonical inventory.

Modern API:

- Mentioned operation/endpoint either could be decommed or already migrated and available in REST(GQL) apis.

Key Differences:

- The draft-file concept is removed from the seller-side migration inventory.

Related Patterns:

- Full traditional doc extract: references/operations/GetReturnRequestDraftFiles_doc.md

Migration Guide:


### InitiateReturnShippingLabel (Decommissioned) -> No replacement
Purpose:

- Traditional return-shipping-label initiation remains visible for migration planning even though no validated seller-side replacement is documented in the canonical inventory.

Modern API:

- Mentioned operation/endpoint either could be decommed or already migrated and available in REST(GQL) apis.

Key Differences:

- The canonical CSV marks this row decommissioned and explicitly says the old initiation flow is no longer supported.

Related Patterns:

- Full traditional doc extract: references/operations/InitiateReturnShippingLabel_doc.md

Migration Guide:


### VoidShippingLabel (Decommissioned) -> No replacement
Purpose:

- Traditional void-shipping-label workflow remains visible for migration planning even though no validated seller-side replacement is documented in the canonical inventory.

Modern API:

- Mentioned operation/endpoint either could be decommed or already migrated and available in REST(GQL) apis.

Key Differences:

- No direct replacement is validated in the bundled source set.

Related Patterns:

- Full traditional doc extract: references/operations/VoidShippingLabel_doc.md

Migration Guide:


### GetReturnShippingLabel (Decommissioned) -> No replacement
Purpose:

- Traditional return-shipping-label retrieval remains visible for migration planning even though no validated seller-side replacement is documented in the canonical inventory.

Modern API:

- Mentioned operation/endpoint either could be decommed or already migrated and available in REST(GQL) apis.

Key Differences:

- No direct replacement is validated in the bundled source set.

Related Patterns:

- Full traditional doc extract: references/operations/GetReturnShippingLabel_doc.md

Migration Guide:


### MarkReturnRefundReceived (Decommissioned) -> No replacement
Purpose:

- Traditional refund-received confirmation remains visible for migration planning even though no validated seller-side replacement is documented in the canonical inventory.

Modern API:

- Mentioned operation/endpoint either could be decommed or already migrated and available in REST(GQL) apis.

Key Differences:

- The canonical inventory does not preserve a direct confirmation step for this old return-refund flow.

Related Patterns:

- Full traditional doc extract: references/operations/MarkReturnRefundReceived_doc.md

Migration Guide:


### MarkReturnRefundSent (Decommissioned) -> No replacement
Purpose:

- Traditional refund-sent confirmation remains visible for migration planning even though no validated seller-side replacement is documented in the canonical inventory.

Modern API:

- Mentioned operation/endpoint either could be decommed or already migrated and available in REST(GQL) apis.

Key Differences:

- No direct replacement is validated in the canonical inventory.

Related Patterns:

- Full traditional doc extract: references/operations/MarkReturnRefundSent_doc.md

Migration Guide:


### MarkReturnShipped (Decommissioned) -> No replacement
Purpose:

- Traditional return-shipped confirmation remains visible for migration planning even though no validated seller-side replacement is documented in the canonical inventory.

Modern API:

- Mentioned operation/endpoint either could be decommed or already migrated and available in REST(GQL) apis.

Key Differences:

- The canonical inventory does not preserve a direct modern seller-side equivalent for this old status step.

Related Patterns:

- Full traditional doc extract: references/operations/MarkReturnShipped_doc.md

Migration Guide:


### UpdateShipmentTrackingInfo (Decommissioned) -> recordReturnLabelSentOffline
Purpose:

- Update tracking information associated with a return-related shipment.

Modern API:

- Status is Decommission in the canonical CSV, with `recordReturnLabelSentOffline` preserved as a nearby modern fallback reference.

Key Differences:

- Keep the decommissioned status explicit instead of claiming a clean one-to-one replacement.

Request Payload Transformation:

- Traditional: [UpdateShipmentTrackingInfo_doc.md](operations/UpdateShipmentTrackingInfo_doc.md), [UpdateShipmentTrackingInfo_example.md](operations/UpdateShipmentTrackingInfo_example.md)
- Modern: [recordReturnLabelSentOffline_example.md](operations/recordReturnLabelSentOffline_example.md)


- Map traditional tracking updates to `trackings[]` on `recordReturnLabelSentOffline`, carrying carrier, tracking number, and optional `labelSentAt` timestamp.
- Use `offlineReturnLabelChannel` when the seller needs to record how the label was communicated outside the downloadable-label workflow.

Response Payload Transformation:

- Traditional: [UpdateShipmentTrackingInfo_doc.md](operations/UpdateShipmentTrackingInfo_doc.md), [UpdateShipmentTrackingInfo_example.md](operations/UpdateShipmentTrackingInfo_example.md)
- Modern: [recordReturnLabelSentOffline_example.md](operations/recordReturnLabelSentOffline_example.md)


- The modern fallback returns the updated `OrderReturn` object instead of a traditional shipment-tracking acknowledgement.
- This remains the non-downloadable-label path; downloadable-label workflows should still go through Media API upload plus `attachReturnShipmentLabel`.

Related Patterns:

- Full traditional doc extract: references/operations/UpdateShipmentTrackingInfo_doc.md
- Full traditional example stub: references/operations/UpdateShipmentTrackingInfo_example.md
- Full modern doc extract: references/operations/recordReturnLabelSentOffline_doc.md
- Full modern example: references/operations/recordReturnLabelSentOffline_example.md

Migration Guide:



### GetShipmentTrackingInfo -> orderReturn
Purpose:

- Retrieve shipment-tracking activity tied to a seller-side return request.

Modern API:

- GraphQL `orderReturn` in Return API.

Key Differences:

- The bundled migration guide says return fulfillment and shipment-tracking information is returned through `sellerOrderReturns` and `orderReturn`, not through a standalone shipment-tracking operation.
- The canonical CSV points to `orderReturn`, while the bundled modern docs expose that surface as a return lookup rather than a dedicated tracking API.

Request Payload Transformation:

- Traditional: [GetShipmentTrackingInfo_example.md](operations/GetShipmentTrackingInfo_example.md)
- Modern: [orderReturn_example.md](operations/orderReturn_example.md)

REST (before):

```http
GET /post-order/v2/return/{returnId}/shipping_track_info
Authorization: Bearer <access-token>
```


- Traditional standalone `/return/{returnId}/shipping_track_info` endpoint is replaced by querying the return object with selected tracking fields.
- Shipment tracking information is now requested through nested `returnFulfillment` fields rather than a dedicated tracking endpoint.

Response Payload Transformation:

- Traditional: [GetShipmentTrackingInfo_example.md](operations/GetShipmentTrackingInfo_example.md)
- Modern: [orderReturn_example.md](operations/orderReturn_example.md)

REST (before):

```http
GET /post-order/v2/return/5********2/shipping_track_info
Authorization: Bearer <access-token>
```

Response:

```json
{
  "trackingInfo": {
    "returnedShipment": {
      "shippingCarrier": "USPS",
      "trackingNumber": "1Z999AA10123456784",
      "shippedDate": {
        "value": "2015-08-10T10:35:24.000Z"
      }
    },
    "replacementShipment": {
      "shippingCarrier": "UPS",
      "trackingNumber": "1Z999999991234567",
      "shippedDate": {
        "value": "2015-08-15T14:22:10.000Z"
      }
    }
  }
}
```


- Traditional response structure flattens returned/replacement shipments together; GraphQL separates them into `buyerFulfillmentInitiation` and `sellerFulfillmentInitiation`.
- Tracking fields use standardized camelCase naming and ISO date/time format in GraphQL.
- The modern structure preserves more fulfillment context including label provisioning and multiple shipment legs.

Related Patterns:

- Full traditional doc extract: references/operations/GetShipmentTrackingInfo_doc.md
- Full modern doc extract: references/operations/orderReturn_doc.md
- Full modern example: references/operations/orderReturn_example.md

Migration Guide:

- No direct equivalent, but return fulfillment/shipment tracking information will be returned in the sellerOrderReturns and orderReturn query (Return API) responses if available

### ProvidesReturnAddress (Decommissioned) -> No replacement
Purpose:

- Traditional return-address provisioning remains visible for migration planning even though no validated seller-side API replacement is documented in the canonical inventory.

Modern API:

- Mentioned operation/endpoint either could be decommed or already migrated and available in REST(GQL) apis.

Key Differences:

- The canonical CSV explicitly notes that alternative return addresses can only be added outside this API package.

Related Patterns:

- Full traditional doc extract: references/operations/ProvidesReturnAddress_doc.md

Migration Guide:

- No direct equivalent, and alternative return addresses can only be added in My eBay.


### SubmitReturnFile (Decommissioned) -> No replacement
Purpose:

- Traditional return-file submission remains visible for migration planning even though no validated seller-side replacement is documented in the canonical inventory.

Modern API:

- Mentioned operation/endpoint either could be decommed or already migrated and available in REST(GQL) apis.

Key Differences:

- The canonical inventory does not preserve a direct seller-side equivalent for this old file-submission flow.

Related Patterns:

- Full traditional doc extract: references/operations/SubmitReturnFile_doc.md

Migration Guide:

- Removed from the current migration inventory.

### UpdateReturnDraft (Decommissioned) -> No replacement
Purpose:

- Traditional return-draft update remains visible for migration planning even though no validated seller-side replacement is documented in the canonical inventory.

Modern API:

- Mentioned operation/endpoint either could be decommed or already migrated and available in REST(GQL) apis.

Key Differences:

- The underlying draft concept is removed from the seller-side migration inventory.

Related Patterns:

- Full traditional doc extract: references/operations/UpdateReturnDraft_doc.md

Migration Guide:


