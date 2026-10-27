# Cancellation Surface Selection

Use this rule for `SearchCancellations`, `GetCancellation`, `ApproveCancellation`, `RejectCancellation`, and especially `CreateCancellationRequest`.

## Rule

- Search with `sellerContractCancellations` and retrieve with `contractCancellation`.
- For seller-initiated creation, choose one mutation based on the underlying object state:
- `createOrderCancellation` for paid orders
- `createItemCommitmentCancellation` for unpaid commitments
- `createPurchaseQuoteCancellation` for purchase-quote flows
- Treat `CheckCancellationEligibility` as removed workflow ceremony, not as a preserved API.

## Compliance Note

- For in-scope EU or UK sellers, digital-signature requirements apply to the listed cancellation methods.

