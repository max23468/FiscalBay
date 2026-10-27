# Order Management Index

This index is regenerated from the canonical `sources/api-mapping/order-management.csv` inventory, with pilot-guide workflow notes folded in only when they do not contradict the CSV.

## Main Table

| Traditional operation | Status | Modern API family | Modern operation | Notes |
| --- | --- | --- | --- | --- |
| AddOrder | GraphQL | Purchase Quote API | `createPurchaseQuote` | Combined-invoice creation becomes purchase-quote creation. |
| CompleteSale | GraphQL + REST | Item Commitment API, Order API, Feedback API, Fulfillment API, Order Inquiry API | `markItemCommitmentsPaid`, `markOrdersPaid`, `leaveFeedback`, `createShippingFulfillment`, `provideShipmentInfoForItemNotReceivedInquiry` | One traditional after-sale call is split by payment, fulfillment, feedback, and INR shipment flows. |
| GetItemTransactions | GraphQL | Order API, Item Commitment API | `orders`, `itemCommitments` | Seller retrieval splits by paid versus unpaid state for one listing. Use `orderLineItemId` instead of traditional `TransactionID` when transaction-level identity matters. |
| GetOrders | GraphQL + REST | Order API, Item Commitment API, Fulfillment API | `orders`, `ordersByIds`, `orderLineItemsByIds`, `itemCommitments`, `itemCommitmentsByIds`, `getOrders`, `getOrder` | GraphQL covers paid and unpaid state explicitly, and the pilot guide also keeps Fulfillment API visible for paid-order retrieval. |
| GetSellerTransactions | GraphQL + REST | Order API, Item Commitment API, Fulfillment API | `orders`, `ordersByIds`, `orderLineItemsByIds`, `itemCommitments`, `itemCommitmentsByIds`, `getOrders`, `getOrder` | The pilot guide groups this with `GetOrders` for paid-versus-unpaid retrieval. Keep `orderLineItemId` as the replacement for traditional `TransactionID`. |
| SendInvoice | GraphQL | Purchase Quote API | `createPurchaseQuote`, `bulkUpdatePurchaseQuote` | Create or update a purchase quote for invoice reminders or cost adjustments before payment. Bundled modern docs use `bulkUpdatePurchaseQuotes`. |
| GetOrderTransactions | Decommission | Order API, Item Commitment API, Fulfillment API | `orders`, `ordersByIds`, `orderLineItemsByIds`, `itemCommitments`, `itemCommitmentsByIds`, `getOrders`, `getOrder` | Decommissioned row stays visible. Route retrieval through the paid-versus-unpaid split instead of expecting direct parity. |
| ReviseCheckoutStatus | Decommission | No replacement | No replacement | No validated replacement in the canonical inventory. |
| CloseCase | Decommission | No replacement | No replacement | Case management is merged into inquiry and return workflows instead of remaining as a standalone seller-side close API. |
| GetCase | GraphQL | Order Inquiry API, Return API | `orderInquiry`, `orderReturn` | Choose the inquiry or return path based on the underlying case type. |
| IssueCaseRefund | Decommission | Return API, Order Inquiry API | `processReturnRefund`, `processOrderInquiryRefund` | Refund path depends on whether the case is tied to a return or an INR inquiry. |
| AppealCaseDecision | GraphQL | Return API, Order Inquiry API | `submitReturnReferral`, `submitOrderInquiryReferral` | Appeal or escalation path depends on the underlying case family. |
| ProvideCaseShipmentInfo | Decommission | Order Inquiry API | `provideShipmentInfoForItemNotReceivedInquiry` | Traditional case shipment info collapses into INR shipment updates. |
| SearchCases | GraphQL | Order Inquiry API, Return API | `sellerOrderInquiries`, `sellerOrderReturns` | Search cases by routing to inquiry or return history. |
| SearchCancellations | GraphQL | Cancellation API | `sellerContractCancellations` | Seller-side cancellation search becomes a GraphQL collection query. |
| ApproveCancellation | GraphQL | Cancellation API | `approveContractCancellation` | Approval becomes a dedicated GraphQL mutation. |
| GetCancellation | GraphQL | Cancellation API | `contractCancellation` | Retrieve one seller-side contract cancellation. |
| CreateCancellationRequest | GraphQL | Cancellation API | `createOrderCancellation`, `createItemCommitmentCancellation`, `createPurchaseQuoteCancellation` | Cancellation creation depends on whether the underlying object is an order, item commitment, or purchase quote. |
| RejectCancellation | GraphQL | Cancellation API | `declineContractCancellation` | Rejection becomes a dedicated GraphQL mutation. |
| CheckCancellationEligibility | No replacement | No replacement | No replacement | Traditional pre-check flow is removed. Ineligible cancellations now surface as business errors when a modern cancellation mutation is attempted. |
| ConfirmCancellationRefund | Decommission | No replacement | No replacement | The old confirm-refund step is removed from the seller-side flow. |
| GetInquiry | GraphQL | Order Inquiry API | `orderInquiry` | Retrieve one seller-side INR inquiry. |
| IssueInquiryRefund | GraphQL | Order Inquiry API | `processOrderInquiryRefund` | Inquiry refunds are handled by a dedicated mutation. |
| ProvideInquiryShipmentInfo | GraphQL | Order Inquiry API | `provideShipmentInfoForItemNotReceivedInquiry` | Shipment updates remain part of the INR flow. |
| SearchInquiries | GraphQL | Order Inquiry API | `sellerOrderInquiries` | Seller-side inquiry search becomes a GraphQL collection query. |
| SendInquiryMessage | GraphQL | Order Inquiry API | `sendOrderInquiryMessage` | Inquiry messaging is a dedicated mutation. |
| CreateInquiry | Decommission | No replacement | No replacement | Traditional inquiry creation is not preserved in the current seller migration inventory. |
| CheckInquiryEligibility | Decommission | No replacement | No replacement | No seller-side replacement is validated in the canonical inventory. |
| CloseInquiry | Decommission | No replacement | No replacement | Traditional inquiry close flow is not preserved in the current seller migration inventory. |
| ConfirmInquiryRefund | Decommission | No replacement | No replacement | Traditional refund confirmation step is removed. |
| EscalateInquiry | GraphQL | Order Inquiry API | `submitOrderInquiryReferral` | Only the seller-side escalation path remains. |
| ProvideInquiryRefundInfo | GraphQL | Order Inquiry API | `sendOrderInquiryMessage` | No direct replacement; the message mutation is the documented alternative. |
| CreateReturnRequest | Decommission | No replacement | No replacement | Traditional return-request creation is not preserved in this seller migration inventory. |
| EscalateReturn | GraphQL | Return API | `submitReturnReferral` | Seller escalation becomes a referral mutation. |
| GetReturn | GraphQL | Return API | `orderReturn` | Retrieve one seller-side return and associated documents or state. |
| GetReturnPreferences | GraphQL | Return API | `sellerReturnPreference` | Seller return preferences are exposed as a GraphQL query. |
| SetReturnPreferences | GraphQL | Return API | `updateSellerRMAPreference` | Seller RMA preference is set through a dedicated mutation. Bundled modern docs use `updateSellerRmaPreference`. |
| AddShippingLabelInfo | GraphQL | Return API | `attachReturnShipmentLabel`, `recordReturnLabelSentOffline` | The CSV keeps two return-label alternatives visible instead of collapsing to one direct replacement. |
| SendReturnShippingLabel | Decommission | Return API | `attachReturnShipmentLabel` | The CSV keeps this row visible but marks the traditional method decommissioned. |
| IssueReturnRefund | GraphQL | Return API | `processReturnRefund` | Return refunds are handled by a dedicated mutation. |
| MarkReturnReceived | GraphQL | Return API | `recordReturnReceived` | Receipt confirmation is a dedicated mutation. |
| ProcessReturnRequest | GraphQL | Return API | `approveReturn`, `declineReturn`, `proposeKeepItemWithPartialRefund`, `provideRmaNumber` | One traditional decision call is split into distinct outcome-specific mutations. |
| SearchReturns | GraphQL | Return API | `sellerOrderReturns` | Seller-side return search becomes a GraphQL collection query. |
| SendReturnMessage | GraphQL | Return API | `sendReturnMessage` | Return messaging is a dedicated mutation. |
| UploadReturnFile | REST | Media API | `uploadPostOrderDocument` | Bundled evidence is partial and the Media API source filenames are not fully consistent. |
| UploadReturnRequestDraftFile | Decommission | No replacement | No replacement | No validated replacement. |
| CheckReturnEligibility | Decommission | No replacement | No replacement | Traditional eligibility precheck flow is removed. |
| CreateReturnDraft | Decommission | No replacement | No replacement | Traditional draft flow is removed. |
| DeleteReturnRequestDraftFile | Decommission | No replacement | No replacement | No validated replacement. |
| GetReturnDraft | Decommission | No replacement | No replacement | No validated replacement. |
| GetReturnEstimate | Decommission | No replacement | No replacement | No validated replacement. |
| CancelReturnRequest | Decommission | No replacement | No replacement | Traditional cancellation flow is removed. |
| GetReturnFiles | GraphQL | Return API | `orderReturn` | Return-associated documents are exposed through the return query rather than a standalone file method. |
| CheckShippingLabelPrintEligibility | Decommission | No replacement | No replacement | No validated replacement. |
| GetReturnRequestDraftFiles | Decommission | No replacement | No replacement | No validated replacement. |
| InitiateReturnShippingLabel | Decommission | No replacement | No replacement | Canonical inventory marks this traditional shipping-label initiation flow as no longer supported. |
| VoidShippingLabel | Decommission | No replacement | No replacement | No validated replacement. |
| GetReturnShippingLabel | Decommission | No replacement | No replacement | No validated replacement. |
| MarkReturnRefundReceived | Decommission | No replacement | No replacement | No validated replacement. |
| MarkReturnRefundSent | Decommission | No replacement | No replacement | No validated replacement. |
| MarkReturnShipped | Decommission | No replacement | No replacement | No validated replacement. |
| UpdateShipmentTrackingInfo | Decommission | Return API | `recordReturnLabelSentOffline` | The traditional row is decommissioned, but the CSV preserves a nearby return-tracking mutation as a fallback reference. |
| GetShipmentTrackingInfo | GraphQL | Return API | `orderReturn` | The canonical CSV points to `orderReturn`, and the guide says tracking data appears in `sellerOrderReturns` and `orderReturn` responses instead of a standalone tracking method. |
| ProvidesReturnAddress | Decommission | No replacement | No replacement | Alternative return addresses remain a My eBay or manual path rather than an API mapping. |
| SubmitReturnFile | Decommission | No replacement | No replacement | No validated replacement. |
| UpdateReturnDraft | Decommission | No replacement | No replacement | No validated replacement. |

## Coverage Notes

- The canonical Order Management inventory contains 66 unique traditional operations.
- The table keeps decommissioned and no-replacement rows visible instead of suppressing them.
- Several modern operation names in the bundled docs differ slightly from the canonical CSV. Those mismatches stay explicit in notes and supporting files.
- Traditional Post-Order rows without bundled traditional doc pages still remain in scope, but some support files contain only validated inventory facts plus modern-side evidence.

