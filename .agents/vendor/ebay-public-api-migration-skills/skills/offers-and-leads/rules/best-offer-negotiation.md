# Best Offer Negotiation Rules

Use these rules for any RespondToBestOffer migration.

## Routing Rule

- Do not map RespondToBestOffer to one generic modern operation.
- Route by seller intent:
  - Accept -> acceptOffer
  - Counter -> counterOffer
  - Decline -> declineOffer

## Required Modern Identifiers

- All three GraphQL mutations require itemId and offerId.
- The traditional SOAP request also uses ItemID and BestOfferID, but the modern itemId is the purchasable item identifier used by the GraphQL Offer API.
- A stale offerId can invalidate the mutation even when the listing identifier is correct, so retrieve the latest negotiation state before responding.

## Message Handling

- SellerResponse in SOAP maps to the optional message field in all three GraphQL inputs.
- The schema limits GraphQL message to 250 characters.

## Counteroffer Amount Rule

- SOAP CounterOfferPrice represents the full counteroffer value for the requested quantity.
- GraphQL counterOffer.proposedPrice is a per-unit amount.
- If SOAP CounterOfferQuantity is greater than 1, divide the total SOAP counteroffer amount into the unit value required by proposedPrice and send quantity separately.

## Bulk Decline Difference

- SOAP can decline multiple BestOfferID values in one RespondToBestOffer request.
- Modern declineOffer accepts one offerId per mutation.
- If a traditional flow declines several offers at once, the client must loop over each offer ID and handle partial failures explicitly.

## Negotiation Workflow Guidance

- Best Offer capability should already be enabled on the listing before response handling begins.
- Use GetBestOffers or sellerNegotiationHistory to inspect current offers before taking action.
- Treat the mutation as one step in the negotiation workflow, not as a replacement for offer discovery or configuration.

## GraphQL Transport Rules

- Use POST https://graphqlapi.ebay.com/graphql.
- Send Authorization, Content-Type: application/json, and X-EBAY-C-MARKETPLACE-ID headers.
- GraphQL may return HTTP 200 with errors, so inspect __typename and error branches instead of relying only on the status code.
