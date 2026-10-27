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

### getItemsAwaitingFeedback

#### GET /awaiting_feedback
**Description:** This method retrieves line items awaiting feedback from the user's order partner. You can refine the results using optional filter query parameters, such as item ID, username, or user role in the transaction. Sorting and pagination features help organize and navigate returned items efficiently.

For sellers, only sold items that have not yet received feedback are included. For buyers, only purchased items for which feedback is still pending are included. If the user is both a buyer and a seller, this API returns items awaiting feedback for transactions where the user acted as either. Applying filters can limit results to either buyer-only or seller-only transactions.

The response provides an overview of feedback yet to be left for completed transactions (as filtered) with counts for both the buyer and seller roles. It includes an array of line items, each containing the listing ID, title, and price (with currency and value). For each line item, the response offers feedback templates specifying which ratings are available.

**Note:** Detailed seller ratings are for sellers only and are created from buyer feedback.
**Parameters:**
- **filter** (string)
  - Use this parameter to limit the response based on the specified filter parameters. Supported filter parameters include the following:  

*   **listingId**: Filter results by the specific listing ID
*   **receiverName**: Filter results by the user's order partner name involved in the transaction
*   **userRole**: Use this filter to only retrieve feedback due from the user in role as a seller or a buyer. If this filter is not used, all feedback due in both user roles is retrieved (`BUYER` or `SELLER`)

Send the filter as a query parameter in a comma-separated _name_:_value_ list. For example:  
`filter=listingId:123,receiverName:user,userRole:BUYER`
- **limit** (string)
  - This parameter sets the maximum number of line items to return per page of data.  

Use this parameter in conjunction with the **offset** parameter to control the pagination of the output. For example, with offset set to `20` and limit set to `10`, the call retrieves entries 21 through 30 from the result set.

Although this field is optional, if omitted, the default value of `25` is used.

**Default:** 25

**Minimum:** 25

**Maximum:** 200
- **offset** (string)
  - Use this parameter to specify the number of items to skip in the result set. This is used with the `limit` field to control the pagination of the output. For example:  

*   If **offset** is `0` and **limit** is `10`, the method will retrieve items 1-10 from the list of line items returned.
*   If **offset** is `10` and **limit** is `10`, the method will retrieve items 11-20 from the list of line items returned.

**Note:** This feature employs a zero-based list, where the first line item in the list has an offset of 0.

If this parameter is not set, its value defaults to `0`, which returns the first page of records.

**Default:** 0
- **sort** (string)
  - Use this parameter to configure the order of the returned listings. The time is based on when the buyer paid for the line item. Acceptable values:  

*   **END\_TIME\_ASC:** Sorts listings by end time from oldest to newest
*   **END\_TIME\_DESC:** Sorts listings by end time from newest to oldest (default)

If this parameter is omitted, its value defaults to **END\_TIME\_DESC**.

**Default:** `END_TIME_DESC`
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope/commerce.feedback`

## Shared Types

Shared API-level schema and common type definitions live in [Feedback API_shared.md](Feedback API_shared.md).
