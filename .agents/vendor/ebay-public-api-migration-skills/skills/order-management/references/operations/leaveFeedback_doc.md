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

### leaveFeedback

#### POST /feedback
**Description:** This method creates and submits feedback to the user's order partner for a line item in the order. For each order, the order partner is the other participant in the transaction, either the buyer or seller, depending on the eBay user associated with the user token. This method allows users to provide detailed information about the transaction, including the feedback rating, comments, and seller delivery. You can also add images to your feedback.

**Note:** A seller can only provide a comment for a buyer, but a buyer can provide a comment plus provide ratings on a number of metrics for a seller.

**Note:** The feedback must adhere to community guidelines and be relevant to the transaction.

When leaving feedback, keep the following in mind:

*   Your feedback score is not affected when you leave feedback
*   Feedback can only be revised once after it is submitted

For additional information on leaving feedback, see the following:

*   [Leaving feedback for sellers](https://www.ebay.com/help/buying/leaving-feedback-sellers/leaving-feedback-sellers?id=4007)
*   [Leaving feedback for buyers](https://www.ebay.com/help/selling/leaving-feedback-buyers/leaving-feedback-buyers?id=4078)

A successful call to this method returns a feedback ID, which is a unique identifier for the newly created feedback and allows for reference and tracking.
**Parameters:**
- **Content-Type** (string) *required*
  - This header indicates the format of the request body provided by the client. Its value should be set to **application/json**.
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope/commerce.feedback`

## Shared Types

Shared API-level schema and common type definitions live in [Feedback API_shared.md](Feedback API_shared.md).
