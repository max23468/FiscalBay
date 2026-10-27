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

### getFeedback

#### GET /feedback
**Description:** This method enables users to retrieve feedback for any specified user ID and feedback type (sent or received). You can refine the results using optional query parameters such as its feedback ID, listing ID, or order line item ID or by applying one or more filters.

Applying filters can narrow results using criteria such as comment type, photos, or topics identified through AI-based analysis. When filtering for feedback with photos (`filterImage:true`), only entries with images (entries that include image URLs) are returned. Additionally, feedback can be refined for the number of days to look back, the role of the user providing the feedback, and whether to include automated feedback entries left by eBay.

Sorting and pagination features help organize and navigate returned items efficiently.

Returned data includes feedback details (such as comment text and type), feedback ratings (covering criteria like overall experience and, for sellers, item description, shipping time, and communication), role and attributes of the feedback giver, line item and transaction summaries, images, and any available topics. See the **filter** query parameter for additional information. Privacy is safeguarded by restricting the amount of detail visible to users, depending on their context. When accessing another user's feedback without logging in, buyer names are masked and seller names are shown. Logged-in users viewing their own feedback see all names, while those viewing other users' feedback will encounter some masking.
**Parameters:**
- **feedback_id** (string)
  - Use this field to only return a specific feedback record by its feedback ID.  

**Note:** If this query parameter is used, no other filters will be applicable.
- **feedback_type** (string) *required*
  - Use this field to specify the type of feedback records to return. Acceptable values include the following:  

*   **FEEDBACK\_RECEIVED**: Retrieve feedback received by the specified user.
*   **FEEDBACK\_SENT**: Retrieve feedback sent by the specified user.

If not specified, both feedback received and feedback left for the user shall be retrieved.

**Note:** When using **FEEDBACK\_SENT**, it is recommended to also filter **feedback\_id** to target results accurately.
- **filter** (string)
  - Use this parameter to limit the response based on the specified filter parameters as follows:  

*   **commentType**: Return only feedback with the set type of comments. Comment types available are `POSITIVE`, `NEUTRAL`, or `NEGATIVE`.
    
    **Note:** Sellers can only provide positive feedback.
    
*   **filterImage**: Return feedback dependent on if images are included. Filter values available:
    *   `true`: Return only feedback with images
    *   `false`: Return feedback with or without images
*   **topics**: Uses AI to generate items returned that are associated with the set topic. For example, if you set `topics:shipping`, only feedback comments about shipping are returned. Topics available are `shipping`, `service`, `packaging`, `description`, `seller-satisfaction`, `overall-satisfaction`, `refund`, `inventory`, `customer loyalty`, `seller-other`, `quality`, `price`, `condition`, `fit`, `appearance`, `dimensions`, `usage`, `product-satisfaction`, `product-other`, and `extras`.  
      
    See [Retrieve AI-filtered feedback](/develop/guides-v2/communications/sell-communications-guide#retrieve-ai-filtered-items) for an example.
*   **period**: Filter results by the number of days to look back for feedback. If not set, lifetime results are returned. Supported values available are `7`, `30`, `90`, `180`, or `365`.
*   **role**: Filter results by the role of the user providing feedback. Roles available are `BUYER` or `SELLER`.
*   **showAutomatedFeedback**: Filter results to include automated feedback left by eBay entries. For sellers with less than a 10 feedback score, an automated feedback message on behalf of eBay is returned.
    *   `true`: Return automated feedback including both user and eBay generated feedback
    *   `false`: Do not return eBay's automatic feedback for seller in response (default)

Send the filter as a query parameter in a comma-separated _name_:_value_ list. For example:  
  
`filter=commentType:POSITIVE,filterImage:true,topics:fit,period:30,role:SELLER,showAutomatedFeedback:true`
- **limit** (string)
  - Use this parameter to set the maximum number of items to return per page of data.  

Use this parameter in conjunction with the **offset** parameter to control the pagination of the output. For example, with offset set to `20` and limit set to `10`, the call retrieves entries 21 through 30 from the result set.

Although this field is optional, if omitted the default value of `25` is used.

**Default:** 25

**Minimum:** 25

**Maximum:** 200
- **listing_id** (string)
  - Use this field to limit feedback entries to those associated with a specified listing.
- **offset** (string)
  - Use this field to specify the number of line items to skip in the result set. This is used with the `limit` field to control the pagination of the output. For example:  

*   If **offset** is `0` and **limit** is `10`, the method will retrieve items 1-10 from the list of line items returned.
*   If **offset** is `10` and **limit** is `10`, the method will retrieve items 11-20 from the list of line items returned.

**Note:** This feature employs a zero-based list, where the first line item in the list has an offset of 0.

If this parameter is not set, its value defaults to `0` which returns the first page of records.

**Default:** 0
- **order_line_item_id** (string)
  - Use this field to retrieve specific feedback entries related to an order line item ID. A maximum of two entries may be retrieved: feedback left by the buyer and feedback left by the seller.  

**Note:** If this query parameter is set, no other filters will be applicable.
- **sort** (string)
  - Use this parameter to configure the order of the returned items. The time is based on when the buyer paid for the line item. Acceptable values include the following:  

*   **RELEVANCE**: Sorts items by relevance (default). This sort takes into account any available factors such as a comment score, comment type (positive, negative, neutral), how long ago the comment was left, or the length of the comment.
*   **TIME**: Sorts items by end time from newest to oldest.

If this parameter is omitted, its value defaults to **RELEVANCE**.

**Default:** `RELEVANCE`
- **transaction_id** (string)
  - Use this field to limit feedback entries to those associated with the specified transaction ID.
- **user_id** (string) *required*
  - Use this field to specify the unique identifier user ID (eBay username of the user) of the account for which feedback is being retrieved.  
  
**Note:** Both usernames and public user IDs will be accepted in this field. For more information, please refer to [Data Handling Compliance](/api-docs/static/data-handling-update.html).
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope/commerce.feedback`
- `https://api.ebay.com/oauth/api_scope/commerce.feedback.readonly`

## Shared Types

Shared API-level schema and common type definitions live in [Feedback API_shared.md](Feedback API_shared.md).
