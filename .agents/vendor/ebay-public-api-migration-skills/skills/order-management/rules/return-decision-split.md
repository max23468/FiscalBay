# Return Decision Split

Use this rule for `ProcessReturnRequest`, `AddShippingLabelInfo`, `SendReturnShippingLabel`, `IssueReturnRefund`, and adjacent return-management rows.

## Rule

- Break `ProcessReturnRequest` into the exact seller outcome instead of treating it as one mutation.
- Use `approveReturn`, `declineReturn`, `proposeKeepItemWithPartialRefund`, or `provideRmaNumber` depending on the desired action.
- Use `attachReturnShipmentLabel` or `recordReturnLabelSentOffline` when shipping-label details are the actual task.
- Use `recordReturnReceived` when the physical return is received.
- Use `processReturnRefund` for refund actions.

## Why It Matters

- The canonical CSV maps several traditional Post-Order return methods to multiple distinct GraphQL mutations.
- The Order Management guide describes separate flows for approval, shipping-label issuance, receipt, and refund.

