# CompleteSale Split

Use this rule for `CompleteSale`.

## Rule

- Do not present `CompleteSale` as a one-call modern replacement.
- Split the task into one of these intents:
- mark payment complete for a paid order with `markOrdersPaid`
- mark payment complete for an unpaid commitment with `markItemCommitmentsPaid`
- create shipment tracking and fulfillment with `createShippingFulfillment`
- leave buyer feedback with `leaveFeedback`
- update INR shipment details with `provideShipmentInfoForItemNotReceivedInquiry` only when the task is actually inquiry remediation

## Why It Matters

- The canonical CSV lists multiple GraphQL and REST replacements for the same traditional row.
- The Order Management guide describes shipment tracking, payment marking, and feedback as separate modern actions.

