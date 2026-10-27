# Paid Vs Unpaid Order Surfaces

Use this rule whenever a traditional order-retrieval, invoice, payment, or cancellation task could span both paid and unpaid states.

## Rule

- Use Order API or Fulfillment API for paid orders.
- Use Item Commitment API for unpaid commitments that still represent auction or unpaid-order state.
- Use Purchase Quote API for combined-invoice or invoice-reminder workflows that still live before final payment completion.

## Why It Matters

- The canonical CSV repeatedly splits `GetOrders`, `GetSellerTransactions`, `GetItemTransactions`, and `CreateCancellationRequest` across paid and unpaid modern surfaces.
- The Order Management guide distinguishes final fulfilled orders from unpaid or pre-fulfillment states.

## Practical Guidance

- Ask first whether payment has completed.
- If the task is search or lookup, select the query surface based on paid state before deciding between GraphQL and REST.
- If the task is creation or mutation, keep the underlying business object explicit: order, item commitment, or purchase quote.

