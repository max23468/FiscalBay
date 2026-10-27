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

### getFeedbackRatingSummary

#### GET /feedback_rating_summary
**Description:** This method provides a detailed overview of feedback ratings associated with a user in the eBay marketplace. Specify a user ID and apply filters to retrieve summarized feedback data categorized by rating types and user roles. These returned metrics are aggregated, which offers insight into user experiences and performance.

**Tip:** You can use this method to help sellers and buyers understand their marketplace reputation and identify areas for improvement.

Returned data provides a summary of feedback ratings for a user by rating type (such as overall experience, communication, or delivery timeliness) for both buyer and seller roles. Each type of rating includes aggregated metrics like averages, counts, unique feedback givers, and the percentage of positive ratings (excluding neutrals). The response also details the distribution of specific rating values, their frequency, and time period (with period units like days or months) over which these metrics were calculated.
**Parameters:**
- **filter** (string) *required*
  - Use this parameter to limit the response based on specified filter values:  

*   **ratingType**: Specifies the type of rating being summarized and returned **(Required)**. Available values include `OVERALL_EXPERIENCE`, `OVERALL_EXPERIENCE_COMMENT`, `ON_TIME_DELIVERY`, `DSR_ITEM_AS_DESCRIBED`, `DSR_COMMUNICATION`, `DSR_SHIPPING_CHARGES`, `DSR_SHIPPING_TIME`, and `ITEM_RATING`.  
    See **FeedbackRatingTypeEnum** for descriptions of values.
*   **excludeRepeatFeedback**: Set to `true` to exclude repeat feedback.
*   **lookbackPeriodInDays**: Limit the response to a previous period of days. Available values include `7`, `30`, `90`, `180`, or `365`

You can send the filter as a query parameter, either with the required **ratingType** only, or combining the filter values with a comma-separated _name_**:**_value_ list. For example:

`filter=ratingType:OVERALL_EXPERIENCE,excludeRepeatFeedback:true,period:365`
- **user_id** (string) *required*
  - Use this parameter to specify the unique identifier (the eBay username associated with the account) for the eBay user whose feedback summary is being retrieved.
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope/commerce.feedback`
- `https://api.ebay.com/oauth/api_scope/commerce.feedback.readonly`

## Shared Types

Shared API-level schema and common type definitions live in [Feedback API_shared.md](Feedback API_shared.md).
