# Offers and Leads Intent Guide

Answer rule:

- When the selected `references/operation-mapping.md` entry includes guide-derived `Migration Guide:` bullets such as `Key changes`, `Key things to know`, prerequisites, sequencing, or caveats, include those points in the answer instead of returning only the replacement name.

## Intent: "I need to migrate GetBestOffers"

When to use it:
- The source flow uses GetBestOffers.
- You need the primary seller-side GraphQL replacement and the modern filter model.

Recommended workflow:
1. Open references/operation-mapping.md and go to the Best Offer History Retrieval section.
2. Start with the GetBestOffers -> sellerNegotiationHistory entry.
3. Use references/operations/GetBestOffers_doc.md for the SOAP request and response shape.
4. Use references/operations/sellerNegotiationHistory_doc.md and references/operations/sellerNegotiationHistory_example.md for the modern query model and bundled example evidence.

Navigate next:
- references/operation-mapping.md
- references/operations/GetBestOffers_doc.md
- references/operations/sellerNegotiationHistory_doc.md
- references/operations/sellerNegotiationHistory_example.md

## Intent: "How can I find best offers using APIs?"

When to use it:
- The prompt asks how to find, review, retrieve, or inspect best offers.
- The user did not mention `GetBestOffers` explicitly, but the task is still seller-side best-offer history retrieval.

Recommended workflow:
1. Start with `GetBestOffers -> sellerNegotiationHistory` in references/operation-mapping.md.
2. Keep the answer centered on seller-side Offer API negotiation-history retrieval, not on accept/counter/decline mutations unless the user asks about response handling.
3. Mention the key filters from the modern query, such as item scope, offer status, and pagination.
4. Use references/operations/sellerNegotiationHistory_example.md for a concrete query and response sample.

## Intent: "I need to accept, counter, or decline a Best Offer"

When to use it:
- The source flow uses RespondToBestOffer.
- You need to map the seller Action value to the right modern mutation.

Recommended workflow:
1. Open references/operation-mapping.md and go to the Best Offer Negotiation section.
2. Pick acceptOffer, counterOffer, or declineOffer based on the seller action.
3. Load rules/best-offer-negotiation.md for quantity, message, and multi-decline caveats.
4. Check the matching traditional and modern support docs in references/operations/.

Navigate next:
- references/operation-mapping.md
- rules/best-offer-negotiation.md
- references/operations/RespondToBestOffer_doc.md
- references/operations/acceptOffer_doc.md
- references/operations/counterOffer_doc.md
- references/operations/declineOffer_doc.md

## Intent: "I need to explain why one SOAP call became three GraphQL mutations"

When to use it:
- A partner expects one modern equivalent for RespondToBestOffer.
- You need to explain the split cleanly and conservatively.

Recommended workflow:
1. Use INDEX.md for the split overview.
2. Use references/operation-mapping.md to show the action-specific mappings.
3. Use rules/best-offer-negotiation.md to highlight the bulk-decline difference and negotiation-state handling.

Navigate next:
- INDEX.md
- references/operation-mapping.md
- rules/best-offer-negotiation.md

## Intent: "I need to migrate GetAdFormatLeads"

When to use it:
- The source flow uses GetAdFormatLeads.
- You need to choose between seller-wide and item-scoped Leads API retrieval.

Recommended workflow:
1. Open references/operation-mapping.md and go to the Classified Lead Retrieval section.
2. Choose getAllClassifiedLeads when the traditional flow is seller-wide, or getClassifiedLeadsByItemId when one listing itemId is already known.
3. Review rules/classified-leads-retrieval.md for query-parameter routing and auth requirements.
4. Use references/operations/GetAdFormatLeads_doc.md plus the matching modern doc and example file.

Navigate next:
- references/operation-mapping.md
- rules/classified-leads-retrieval.md
- references/operations/GetAdFormatLeads_doc.md
- references/operations/getAllClassifiedLeads_doc.md
- references/operations/getAllClassifiedLeads_example.md
- references/operations/getClassifiedLeadsByItemId_doc.md
- references/operations/getClassifiedLeadsByItemId_example.md

## Intent: "I need to retrieve Classified Ad leads for one listing"

When to use it:
- The source flow uses GetAdFormatLeads and the caller already has one item ID.
- You need the direct modern replacement in this domain, plus the REST path, filters, scope, and response shape for item-specific leads.

Recommended workflow:
1. Open references/operation-mapping.md and go to the GetAdFormatLeads -> getClassifiedLeadsByItemId section.
2. Review rules/classified-leads-retrieval.md for filter semantics and domain boundaries.
3. Use references/operations/getClassifiedLeadsByItemId_doc.md and references/operations/getClassifiedLeadsByItemId_example.md for request and response details.

Navigate next:
- references/operation-mapping.md
- rules/classified-leads-retrieval.md
- references/operations/GetAdFormatLeads_doc.md
- references/operations/getClassifiedLeadsByItemId_doc.md
- references/operations/getClassifiedLeadsByItemId_example.md

## Intent: "I need to know whether GetAdFormatLeads maps here or in another domain"

When to use it:
- You are packaging or reviewing domain boundaries.
- You need to explain why one traditional SOAP call now has two REST methods in this package.

Recommended workflow:
1. Check INDEX.md for the two validated Leads API mappings retained in this skill.
2. Read references/operation-mapping.md for the split rationale.
3. Use rules/classified-leads-retrieval.md to explain when to choose getAllClassifiedLeads versus getClassifiedLeadsByItemId.

Navigate next:
- INDEX.md
- references/operation-mapping.md
- rules/classified-leads-retrieval.md
