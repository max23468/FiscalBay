# Offers and Leads Operation Mapping

## Best Offer History Retrieval

### GetBestOffers -> sellerNegotiationHistory
Purpose:
- Retrieve Best Offer history for items being sold by the user, using the primary seller-side GraphQL replacement in this domain.
- Preserve the traditional ability to filter by offer state and time window while moving from one SOAP retrieval call to GraphQL query input filters.
- Full traditional doc extract: references/operations/GetBestOffers_doc.md
- Full modern doc extract: references/operations/sellerNegotiationHistory_doc.md
- Full modern example: references/operations/sellerNegotiationHistory_example.md

Modern API:
- GraphQL query: sellerNegotiationHistory
- Endpoint: POST https://graphqlapi.ebay.com/graphql
- Required OAuth scopes: https://api.ebay.com/oauth/api_scope/sell.offer&eBayUser and https://api.ebay.com/oauth/api_scope/sell.offer.read&eBayUser

Key Differences:
- SOAP GetBestOffers retrieved Best Offer history through XML request filters such as BestOfferStatus, ItemID, and Pagination.
- Modern Offer API retrieval uses GraphQL input.filters.activeAfter, input.filters.activeBefore, input.filters.negotiationCreatorRole, input.filters.statusFilter, and input.filters.pagination instead of SOAP request containers.
- Modern GraphQL returns itemNegotiations and pagination objects in JSON rather than BestOfferArray and PaginationResult containers inside a SOAP envelope.
- The CSV contains a buyerNegotiationHistory row for the buyer perspective, but sell-side guidance is primary in this skill.

Request Payload Transformation:

- Traditional: [GetBestOffers_example.md](operations/GetBestOffers_example.md)
- Modern: [sellerNegotiationHistory_example.md](operations/sellerNegotiationHistory_example.md)




Response Payload Transformation:

- Traditional: [GetBestOffers_example.md](operations/GetBestOffers_example.md)
- Modern: [sellerNegotiationHistory_example.md](operations/sellerNegotiationHistory_example.md)



Related Patterns:
- rules/best-offer-negotiation.md

Supported Features:
- date-range filtering through activeAfter and activeBefore
- status-based retrieval through statusFilter
- cursor-based pagination through filters.pagination and response pagination cursors

Restrictions:
- sellerNegotiationHistory is the primary replacement in this seller-focused skill; buyerNegotiationHistory is only the buyer-side alternate row in the CSV inventory
- seller-initiated negotiations are not currently supported in negotiationCreatorRole

Migration Guide:
- Filter by date range, user role, and offer status
- Pagination control is available

## Best Offer Negotiation

### RespondToBestOffer -> acceptOffer
Purpose:
- Accept a pending buyer Best Offer or counteroffer and complete the negotiation on the seller side.
- Preserve the optional seller response note when one is supplied.
- Full traditional doc extract: references/operations/RespondToBestOffer_doc.md
- Full modern doc extract: references/operations/acceptOffer_doc.md
- Full modern example: references/operations/acceptOffer_example.md

Modern API:
- GraphQL mutation: acceptOffer
- Endpoint: POST https://graphqlapi.ebay.com/graphql
- Required OAuth scopes: https://api.ebay.com/oauth/api_scope/buy.offer&eBayUser and https://api.ebay.com/oauth/api_scope/sell.offer&eBayUser

Key Differences:
- SOAP used one RespondToBestOffer call with Action=Accept. Modern GraphQL uses a dedicated acceptOffer mutation.
- SOAP ItemID and BestOfferID become itemId and offerId in AcceptOfferInput.
- SOAP returned BestOffer.CallStatus inside a SOAP envelope. Modern GraphQL returns a union output whose success branch is AcceptOfferSent.

Request Payload Transformation:

- Traditional: [RespondToBestOffer_example.md](operations/RespondToBestOffer_example.md)
- Modern: [acceptOffer_example.md](operations/acceptOffer_example.md)




Response Payload Transformation:

- Traditional: [RespondToBestOffer_example.md](operations/RespondToBestOffer_example.md)
- Modern: [acceptOffer_example.md](operations/acceptOffer_example.md)



Related Patterns:
- rules/best-offer-negotiation.md

Restrictions:
- The mutation operates on one active offer at a time.
- GraphQL clients must inspect the output union instead of treating HTTP status alone as success.

Migration Guide:
- The offerid and itemid fields identify the offer and item, respectively
- The message field is optional

### RespondToBestOffer -> counterOffer
Purpose:
- Counter a pending buyer Best Offer or counteroffer with a revised seller price and, when needed, a revised quantity.
- Preserve the optional seller response note when provided.
- Full traditional doc extract: references/operations/RespondToBestOffer_doc.md
- Full modern doc extract: references/operations/counterOffer_doc.md
- Full modern example: references/operations/counterOffer_example.md

Modern API:
- GraphQL mutation: counterOffer
- Endpoint: POST https://graphqlapi.ebay.com/graphql
- Required OAuth scopes: https://api.ebay.com/oauth/api_scope/buy.offer&eBayUser and https://api.ebay.com/oauth/api_scope/sell.offer&eBayUser

Key Differences:
- SOAP used Action=Counter plus CounterOfferPrice and CounterOfferQuantity in one XML request. Modern GraphQL uses CounterOfferInput.
- SOAP CounterOfferPrice represented the total counteroffer amount for the requested quantity. GraphQL proposedPrice represents the per-unit amount.
- Modern GraphQL returns CounterOfferSent with a new offer object instead of only CallStatus.

Request Payload Transformation:

- Traditional: [RespondToBestOffer_example.md](operations/RespondToBestOffer_example.md)
- Modern: [counterOffer_example.md](operations/counterOffer_example.md)




Response Payload Transformation:

- Traditional: [RespondToBestOffer_example.md](operations/RespondToBestOffer_example.md)
- Modern: [counterOffer_example.md](operations/counterOffer_example.md)



Related Patterns:
- rules/best-offer-negotiation.md

Restrictions:
- Only one offer can be countered per mutation.
- proposedPrice must be greater than zero and in the listing currency.

Migration Guide:
- The offerid and itemid fields identify the offer and item, respectively
- The proposed counter offer price is set in the proposedPrice container
- The quantity field is optional and is only needed if the seller's counter offer involves increasing or decreasing the current quantity of the offer
- The message field is optional

### RespondToBestOffer -> declineOffer
Purpose:
- Decline an active buyer Best Offer or counteroffer and end the negotiation for that offer.
- Preserve any seller note that explains the decline.
- Full traditional doc extract: references/operations/RespondToBestOffer_doc.md
- Full modern doc extract: references/operations/declineOffer_doc.md
- Full modern example: references/operations/declineOffer_example.md

Modern API:
- GraphQL mutation: declineOffer
- Endpoint: POST https://graphqlapi.ebay.com/graphql
- Required OAuth scopes: https://api.ebay.com/oauth/api_scope/buy.offer&eBayUser and https://api.ebay.com/oauth/api_scope/sell.offer&eBayUser

Key Differences:
- SOAP used Action=Decline and could decline multiple BestOfferID values in one request.
- Modern GraphQL uses one offerId per declineOffer mutation.
- Modern GraphQL returns DeclineOfferSent instead of a BestOffer.CallStatus string.

Request Payload Transformation:

- Traditional: [RespondToBestOffer_example.md](operations/RespondToBestOffer_example.md)
- Modern: [declineOffer_example.md](operations/declineOffer_example.md)




Response Payload Transformation:

- Traditional: [RespondToBestOffer_example.md](operations/RespondToBestOffer_example.md)
- Modern: [declineOffer_example.md](operations/declineOffer_example.md)



Related Patterns:
- rules/best-offer-negotiation.md

Restrictions:
- SOAP can decline multiple BestOfferID values in one request, but declineOffer handles one offerId per mutation.
- GraphQL clients must inspect the output union instead of treating HTTP status alone as success.

Migration Guide:
- The offerid and itemid fields identify the offer and item, respectively
- The message field is optional

## Classified Lead Retrieval

### GetAdFormatLeads -> getAllClassifiedLeads
Purpose:
- Retrieve classified ad leads across the seller's classified-ad listings.
- Preserve the traditional date-range, status, and member-message filters while moving from SOAP XML fields to REST query parameters.
- Full traditional doc extract: references/operations/GetAdFormatLeads_doc.md
- Full modern doc extract: references/operations/getAllClassifiedLeads_doc.md
- Full modern example: references/operations/getAllClassifiedLeads_example.md

Modern API:
- REST method: GET /sell/leads/v1/classified_lead
- Base URL: https://apiz.ebay.com
- Required OAuth scope: https://api.ebay.com/oauth/api_scope/sell.leads

Key Differences:
- SOAP GetAdFormatLeads used XML request fields such as StartCreationTime, EndCreationTime, Status, and IncludeMemberMessages.
- Modern Leads API uses REST query parameters startTime, endTime, status, and includeMessages on a seller-wide collection endpoint.
- Modern response groups results under classifiedLeads with totalItems and totalLeads instead of AdFormatLead and AdFormatLeadCount.

Request Payload Transformation:

- Traditional: [GetAdFormatLeads_example.md](operations/GetAdFormatLeads_example.md)
- Modern: [getAllClassifiedLeads_example.md](operations/getAllClassifiedLeads_example.md)



Response Payload Transformation:

- Traditional: [GetAdFormatLeads_example.md](operations/GetAdFormatLeads_example.md)
- Modern: [getAllClassifiedLeads_example.md](operations/getAllClassifiedLeads_example.md)



Related Patterns:
- rules/classified-leads-retrieval.md

Restrictions:
- This REST method has no request body.
- The Leads API is documented as a Limited Release API.

Migration Guide:
- Retrieve classified ad leads by date range by setting the startTime and endTime dates
- Include the status query parameter if you only want to retrieve answered or unanswered sales leads
- Include the includeMessages boolean field and set it to true if you only want to retrieve sales leads where potential buyer has left a message

### GetAdFormatLeads -> getClassifiedLeadsByItemId
Purpose:
- Retrieve classified ad leads for one known listing itemId.
- Preserve the same traditional date-range, status, and member-message filters while moving ItemID into the REST path.
- Full traditional doc extract: references/operations/GetAdFormatLeads_doc.md
- Full modern doc extract: references/operations/getClassifiedLeadsByItemId_doc.md
- Full modern example: references/operations/getClassifiedLeadsByItemId_example.md

Modern API:
- REST method: GET /sell/leads/v1/classified_lead/{itemId}
- Base URL: https://apiz.ebay.com
- Required OAuth scope: https://api.ebay.com/oauth/api_scope/sell.leads

Key Differences:
- SOAP ItemID was an optional XML field. Modern getClassifiedLeadsByItemId requires itemId in the URI path.
- The same logical time-range, status, and include-messages filters move to REST query parameters.
- Modern response returns itemId, itemTitle, and responses[] instead of SOAP AdFormatLead containers.

Request Payload Transformation:

- Traditional: [GetAdFormatLeads_example.md](operations/GetAdFormatLeads_example.md)
- Modern: [getClassifiedLeadsByItemId_example.md](operations/getClassifiedLeadsByItemId_example.md)



Response Payload Transformation:

- Traditional: [GetAdFormatLeads_example.md](operations/GetAdFormatLeads_example.md)
- Modern: [getClassifiedLeadsByItemId_example.md](operations/getClassifiedLeadsByItemId_example.md)



Related Patterns:
- rules/classified-leads-retrieval.md

Restrictions:
- This REST method has no request body.
- itemId is required in the URI path.

Migration Guide:
- Works similarly to getAllClassifiedLeads with same query parameters, but only retrieves classified ad leads from a specific listing which is identified through the {itemId} path parameter
- See previous row for more information on available query parameters
