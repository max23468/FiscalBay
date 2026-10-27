# Offers and Leads Index

Authoritative lookup table for the traditional operations that belong to the Offers and Leads domain.

## Validated Mappings

| Traditional operation | Status | Modern API family | Modern method or endpoint | Notes |
| --- | --- | --- | --- | --- |
| GetBestOffers | GraphQL query mapping | Offer API | sellerNegotiationHistory | Seller-side retrieval is the primary mapping for this skill. The CSV also contains an alternate negotiation-history row, but Sell guidance is primary here. |
| RespondToBestOffer | GraphQL split mapping | Offer API | acceptOffer, counterOffer, declineOffer | Select the mutation based on the seller Action value. Declines are single-offer per mutation in modern GraphQL. |
| GetAdFormatLeads | REST split mapping | Leads API | GET /sell/leads/v1/classified_lead and GET /sell/leads/v1/classified_lead/{itemId} | Use getAllClassifiedLeads for seller-wide retrieval and getClassifiedLeadsByItemId for one listing. |

## Domain Notes

- No source conflict currently requires a separate Requires confirmation table for this domain.
- GetBestOffers now uses negotiation-history queries instead of SOAP BestOfferArray containers. Seller-side coverage is primary in this skill because the pilot guide is sell-first.
- Best Offer response handling depends on the seller action. The traditional call name alone is not enough; the Action field decides the modern mutation.
- GetAdFormatLeads has two validated Leads API mappings in this domain. Choose the collection endpoint for seller-wide lead retrieval and the item endpoint when one listing is already in scope.
- Bundled Offer API doc pages, the bundled GraphQL supergraph, bundled Leads API doc pages, and bundled usage examples provide the operation-detail evidence for this skill.

## Next Files

- Operation narrative and payload transformations: references/operation-mapping.md
- Intent navigation: INTENTS.md
- Offer mutation rules: rules/best-offer-negotiation.md
- Classified lead rules: rules/classified-leads-retrieval.md
