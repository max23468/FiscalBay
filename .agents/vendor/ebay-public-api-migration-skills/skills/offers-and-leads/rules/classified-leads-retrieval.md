# Classified Leads Retrieval Rules

Use these rules for GetAdFormatLeads migration when the target domain is Offers and Leads.

## Split-Mapping Rule

- In the Offers and Leads skill, GetAdFormatLeads maps to both getAllClassifiedLeads and getClassifiedLeadsByItemId.
- GetAdFormatLeads does not stay as one modern method across the full repository.
- The pilot guide splits it into:
  - getAllClassifiedLeads for broad seller lead retrieval across listings
  - getClassifiedLeadsByItemId for one listing
- This skill covers both methods because the current domain CSV places both paths in Offers and Leads.

## Request Construction Rule

- The modern methods are REST GET /sell/leads/v1/classified_lead and REST GET /sell/leads/v1/classified_lead/{itemId}.
- There is no request body.
- The traditional SOAP filters move to URI parameters:
  - StartCreationTime -> startTime
  - EndCreationTime -> endTime
  - Status -> status
  - IncludeMemberMessages -> includeMessages
- Choose the collection endpoint when the migration needs seller-wide lead retrieval.
- Choose the item-scoped endpoint when the migration already has the listing item ID and wants leads for that one ad.

## Filter Semantics

- startTime and endTime use ISO 8601 UTC strings.
- status accepts the answered or unanswered lead states documented by the Leads API.
- includeMessages controls whether memberMessage data is returned.
- getAllClassifiedLeads returns grouped lead results across listings.
- getClassifiedLeadsByItemId works similarly but narrows results to one itemId path parameter.

## Auth and Transport Rules

- Use OAuth authorization-code flow with the sell.leads scope.
- Use Authorization for auth and Content-Type: application/json as the documented request header when required by the method page.
- REST response handling follows standard eBay REST rules rather than SOAP Ack/Error containers.

## Operational Constraints

- The Leads API references mark both methods as Limited Release APIs.
- The bundled source set provides REST doc pages and usage examples for both methods.
- The documented success outcomes include 200 and 204, so empty result handling must be explicit.
