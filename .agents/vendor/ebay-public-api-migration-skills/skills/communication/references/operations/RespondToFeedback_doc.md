---
title: Feedback API
description: "The **Feedback API** includes resources for retrieving items awaiting feedback, retrieving and submitting feedback entries, providing feedback rating summaries, and responding to feedback. These methods allow users to manage feedback across buying and selling activities. **Note:** Feedback is tracked at the line item level within an order, not for the whole order. Each line item can have its own feedback record."
api_version: v1.0.0
api_name: feedback_api
api_type: REST
api_group: feedback/api
source_url:
  html: https://developer.ebay.com/develop/api/feedback/api
  md: https://developer.ebay.com/develop/api/feedback/api.md
---
# Feedback API

## API Methods

### respondToFeedback

#### POST /respond_to_feedback
**Description:** This method allows users to respond to feedback provided by the order partner for a specific line item in an order. For each order, the order partner is the other participant in the transaction, either the buyer or seller, depending on the eBay user associated with the user token. This method allows the user to provide additional context or address the order partner's feedback.

**Note:** The feedback response must adhere to community guidelines and be relevant to the transaction.

You can only use this method if feedback has been provided by the order partner and you have not yet responded to it.

When responding to feedback, your feedback score is not affected when you respond.

For additional information on leaving feedback, see the following:

*   [Leaving feedback for sellers](https://www.ebay.com/help/buying/leaving-feedback-sellers/leaving-feedback-sellers?id=4007)
*   [Leaving feedback for buyers](https://www.ebay.com/help/selling/leaving-feedback-buyers/leaving-feedback-buyers?id=4078)

A successful call returns an HTTP status of **200 Success**.
**Parameters:**
- **Content-Type** (string) *required*
  - This header indicates the format of the request body provided by the client. Its value should be set to **application/json**.
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope/commerce.feedback`

## Error Codes

The following error codes may be returned by this API:

## Shared Types

Shared API-level schema and common type definitions live in [Feedback API_shared.md](Feedback API_shared.md).
