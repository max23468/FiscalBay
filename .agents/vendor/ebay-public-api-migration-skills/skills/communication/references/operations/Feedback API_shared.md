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
# Feedback API API


## Types

### AwaitingFeedback
**Description:** This type contains the details for each line item awaiting feedback.
**Type:** object

**Properties:**
- **listingId** (string)
  - This is the unique identifier for the listing associated with the line item. It is used to reference the specific listing that is awaiting feedback.
- **listingPrice** (ListingPrice)
  - This container shows the sale price of the listing.
- **listingTitle** (string)
  - The title of the listing.
- **orderLineItemId** (string)
  - The unique identifier for the eBay order line item associated with the listing. It is used to pinpoint the exact line item awaiting feedback.
- **ratingTemplates** (array)
  - This array contains a list of available values for use in a particular rating as well as whether the value is enabled. This is dependent on what seller ratings the buyer's order partner qualifies.  

**Note:** Rating templates should only be returned to the user in their role as a buyer; only sellers have Detailed Seller Ratings (DSRs).

Use the metadata returned here when leaving DSR ratings through the **leaveFeedback** method. The key field in this container is the **ratingKey** field. See **FeedbackRatingTypeEnum** for its values. The other metadata returned in this container apply to each **ratingKey** value that is returned.
- **transactionId** (string)
  - The unique identifier of the sales transaction.

### AwaitingFeedbackResponse
**Description:** This type defines the fields for the **getItemsAwaitingFeedback** response.
**Type:** object

**Properties:**
- **itemsAwaitingFeedbackCount** (ItemsAwaitingFeedbackCount)
  - This container returns the number of line items awaiting feedback. The **asSeller** and **asBuyer** fields return the total count of items awaiting feedback as seller and buyer and are not affected by the **userRole** filter.
- **lineItems** (array)
  - This array contains the details for each line item awaiting feedback. An empty array is returned if no line items are awaiting feedback or that match the filter criteria.
- **pagination** (Pagination)
  - This container provides pagination information for the returned line items awaiting feedback (as filtered).

### Comment
**Description:** This type provides the details of the feedback comment left by the user.
**Type:** object

**Properties:**
- **commentPeriod** (CommentCommentPeriod)
  - This container indicates the timing of a feedback comment based on when it was left. It is only returned if a comment was provided. Possible values are 30 days, 90 days, 180 days, 365 days, or 5 years:  

*   Less than 30 days: 30 DAY
*   Over 30 but less than 90 days: 90 DAY
*   Over 90 but less than 180 days: 180 DAY
*   Over 180 but less than 365 days: 365 DAY
*   More than 365 days: 5 YEAR
- **commentText** (string)
  - The text of the feedback comment, follow-up, or reply. HTML formatting and personal information (for example, phone numbers) are not allowed. This field is returned if a comment was provided for the feedback entry. If the comment was removed due to eBay policy, this field will contain '`--`' and the **commentTextRemovedPerPolicy** field will return `true`.
- **commentTextRemovedPerPolicy** (boolean)
  - If `true`, this boolean indicates the feedback follow-up or reply comment text was removed per eBay policy. This field is only returned when a **followupComment** container is returned.
- **state** (FeedbackCommentStateEnum)
  - This enumerated value indicates the state of the feedback (for example, `ENTERED`). This can be the state of the feedback comment, the follow-up comment, or the reply comment.

### CommentCommentPeriod
**Description:** This type provides fields that descrbes timing associated with the comment.
**Type:** object

**Properties:**
- **unit** (string)
  - Unit of time for the **value**. Supported values: `DAY` or `YEAR`.
- **value** (integer)
  - Value of the time period expressed in the period contained in the **unit**. Supported values are `30`, `60`, or `365`.

See the **commentPeriod** container for more information.

### FeedbackAggregationTypeEnum
**Description:** This enumerated type provides fields for describing the feedback aggregation. | - **AVG**: This value represents the average value of feedback ratings. The metric associated with this value represents the mean of all feedback scores returned over a specified period, providing a general measure of user satisfaction or performance. - **COUNT**: This value indicates the total number of feedback entries returned. - **UNIQUE_PROVIDER_COUNT**: This value refers to the number of unique users who have provided feedback, which helps to identify how many individual users have contributed feedback. - **POSITIVE_PERCENT_EXCLUDING_NEUTRAL_FEEDBACK**: This value represents the percentage of positive feedback returned, excluding neutral responses. The metric associated with this value focuses on feedback that is explicitly positive (without neutral feedback).
**Type:** object

### FeedbackCommentStateEnum
**Description:** This enumerated type specifies the possible states of a feedback comment. It represents the current visibility of a comment associated with a feedback entry. | - **ENTERED**: This value indicates that the comment has been entered and is currently visible as submitted by the user. - **WITHDRAWN**: This value indicates that the comment has been withdrawn, typically by the user, and is no longer actively displayed. - **HIDDEN**: This value indicates that the comment is concealed from view, usually due to policy reasons or eBay moderation. - **REVISED**: This value indicates that the comment has been updated or modified after its initial entry.
**Type:** object

### FeedbackDetail
**Description:** This type provides attributes for returned feedback entries.
**Type:** object

**Properties:**
- **automatedFeedback** (boolean)
  - If the returned value is `true`, feedback was generated and added automatically by eBay. If a seller has a feedback score 10 or less, eBay automatically leaves feedback. The buyer can choose to override the eBay feedback and leave feedback of their own.  

**Note:** Detailed Seller Ratings (DSRs) are not provided by eBay, only a predefined comment and a positive rating.
- **commentType** (FeedbackRatingValuesEnum)
  - This enumerated value indicates the type of feedback: `POSITIVE`, `NEUTRAL`, `NEGATIVE`.  

**Note:** Sellers can only leave positive feedback for buyers.
- **eligibleForRevision** (boolean)
  - This boolean indicates whether the feedback is eligible for revision. If returned as `true`, it means the feedback can be modified. Feedback that is older than 30 days or has already been revised once cannot be erased or further revised.
- **feedbackComment** (Comment)
  - This container provides the feedback comment left by a user when submitting feedback for a seller or buyer.
- **feedbackEnteredDate** (string)
  - The timestamp when the feedback was submitted.
- **feedbackEnteredPeriod** (FeedbackEnteredPeriod)
  - This container represents the duration since feedback was entered, expressed as a numeric value and a unit of time in days.
- **feedbackId** (string)
  - The unique identifier of the feedback entry.
- **feedbackRatings** (array)
  - This array contains a list of ratings attached to feedback.  

**Note:** This array only applies to buyers feedback for sellers (sellers can only give positive feedback to buyers).
- **feedbackScore** (integer)
  - The feedback receiver's feedback score after receiving this specific feedback.
- **feedbackState** (FeedbackStateEnum)
  - This enumerated value indicates the current state of the feedback entry (for example, `ENTERED`).
- **followupComment** (Comment)
  - This container provides the details of any follow-up comment left.  

**Note:** A buyer leaves follow-up comments and a seller leaves reply comments.
- **hasImages** (boolean)
  - If returned as `true`, this boolean indicates that the feedback entry has one or more images attached. If `false`, there are no images attached.
- **images** (array)
  - This array contains the list of attached images.
- **orderLineItemSummary** (OrderLineItemSummary)
  - This container provides a summary of the line item associated with the feedback entry.

**Note:** Certain fields within this container are returned only when the request uses the **Authorization code grant flow** (user access token) and the **user\_id** matches the authenticated user. These fields are not returned when accessing a different **user\_id** or when using the **Client credentials grant flow** (application access token). See [OAuth scope](#h3-oauth-scope) for details on the flows and required permissions.
- **providerUserDetail** (ProviderUserDetail)
  - This container details the attributes of the user who provided the feedback.
- **repliedBeforeFollowup** (boolean)
  - If returned as `true`, this boolean indicates the feedback reply was given by the seller before the follow-up comment was given by the buyer.
- **replyComment** (Comment)
  - This container provides the details of any reply to the feedback.  

**Note:** A buyer leaves follow-up comments and a seller leaves reply comments.
- **topics** (array)
  - This array provides descriptions of AI-generated insights related to a feedback entry for the specified **filter** topic. The feedback provided is considered relevant to the requested **topic**. For example, when using the request parameter filter of `topics:product-satisfaction`, the returned array might be:

{  
  "coarseTopic" : "product-satisfaction",  
  "highlightedTexts" : \[  
    "This machine is amazing",  
    "Very happy with this purchase"  
    \],  
  "sentiment" : "Positive"  
}

If no topics exist for that feedback, an empty array is returned.

### FeedbackEnteredPeriod
**Description:** This type specifies the amount of time elapsed associated with a feedback entry.
**Type:** object

**Properties:**
- **unit** (string)
  - The unit for the feedback entry period's **value**. Supported value: `DAY`.
- **value** (integer)
  - The value for the feedback entry period, specified in units of **unit**. Supported values are `7`, `30`, `90`, `180`, or `365`.

### FeedbackMetrics
**Description:** This type provides fields for the array of metrics associated with feedback aggregation.
**Type:** object

**Properties:**
- **metricName** (FeedbackAggregationTypeEnum)
  - This enumerated value specifies the type of feedback aggregation. For example, `AVG` would indicate the feedback returned represents the average value of the feedback. See **metricValue** for the value of the returned feedback.
- **metricValue** (number)
  - The decimal value of the specified metric. For example, 55.8 would represent a value associated with the **metricName** (see **metricName** for interpretation and units).

### FeedbackRating
**Description:** This type provides for fields in ratings attached to feedback.
**Type:** object

**Properties:**
- **ratingType** (FeedbackRatingTypeEnum)
  - This enumerated value indicates the type of rating (for example, `OVERALL_EXPERIENCE`, `DSR_ITEM_AS_DESCRIBED`).
- **value** (string)
  - The value assigned to the rating, specified as a string representing a number from `1` to `5`, with `1` representing the lowest rating and `5` representing the highest rating.

### FeedbackRatingAcceptableValue
**Description:** This type provides fields for available values for use in a particular rating and whether the value is enabled.
**Type:** object

**Properties:**
- **enabled** (boolean)
  - If `true`, this boolean indicates that this value is enabled and selectable.
- **value** (string)
  - The value that can be selected for feedback. For most **ratingType** values, this is `1` through `5`, with `1` representing the lowest rating and `5` representing the highest rating. For **ratingType** of `OVERALL_EXPERIENCE`, this can be `POSITIVE`, `NEGATIVE`, and `NEUTRAL`. These are the same values as used with the **leaveFeedback** methods.
- **valueLabel** (string)
  - This field provides information about the corresponding **value**.

### FeedbackRatingSummary
**Description:** This type provides fields for an array containing a summary of feedback ratings. Each element provides detailed metrics and distributions for specific rating types.
**Type:** object

**Properties:**
- **ratingSummaryByRatingType** (array)
  - An array that includes metrics and distributions for each rating type.
- **ratingType** (FeedbackRatingTypeEnum)
  - This enumerated value indicates the type of rating being summarized. For example, `OVERALL_EXPERIENCE` indicates the rating applies to the overall transaction experience.

### FeedbackRatingTemplateType
**Description:** This type defines fields for user feedback collection, including acceptable values, a default preselection value, and an early feedback message. It also provides fields to enable the template as well as limits and options for freetext characters, multi-value rating, and other similar features.
**Type:** object

**Properties:**
- **acceptableValues** (array)
  - This array contains a list of available values for use in a particular rating and whether the value is enabled. This is provided if **ratingValueType** is `RANGE` or `PREDEFINED`.

The following is an example of a predefined list:

\[  
  {  
    "value": "POSITIVE",  
    "valueLabel": "Positive",  
    "enabled": true  
  },  
  {  
    "value": "NEUTRAL",  
    "valueLabel": "Neutral",  
    "enabled": true  
  },  
  {  
    "value": "NEGATIVE",  
    "valueLabel": "Negative",  
    "enabled": true  
  }  
\]

For other examples, see the [Using rating templates](/develop/guides-v2/communications/sell-communications-guide#using-rating-templates).
- **defaultValue** (string)
  - The default value preselected for the rating, if set.
- **earlyFeedbackMessage** (string)
  - For eligible sellers, a message may be shown requiring a wait period before you can leave neutral or negative feedback.
- **enabled** (boolean)
  - If returned as `true`, this boolean indicates that the corresponding feedback rating template is enabled for the user to provide feedback for this line item. This value will generally be `true` when the user role is a buyer, but `false` when the user role is a seller because buyers do not have Detailed Seller Ratings (DSRs).
- **maximumCharactersAllowed** (integer)
  - The maximum number of characters allowed to be used for a rating that uses freetext. It is only applicable for a rating whose **ratingValueType** is `FREETEXT`.

**Maximum:** 500
- **multiValueRating** (boolean)
  - If returned as `true`, multiple values can be specified for the rating.
- **ratingKey** (FeedbackRatingTypeEnum)
  - This enumerated value indicates the type of rating that is tracked for the seller. All of the metadata returned under each node for the **ratingTemplates** array will apply to this rating type. For example, the value `OVERALL_EXPERIENCE` indicates the rating is for the overall transaction experience.
- **ratingLabel** (string)
  - This field provides more details about and/or provides guidance on the corresponding rating type. For example, the rating label of **Rate this transaction** describes the feedback for the user to enter for an `OVERALL_EXPERIENCE` **ratingKey**.
- **ratingValueType** (FeedbackRatingValueTypeEnum)
  - This enumerated value indicates the type of data used to provide the specific feedback rating.  

If `PREDEFINED` or `RANGE` is returned, more information on the supported values will be returned under the **acceptableValues** array. If `FREETEXT` is returned, the maximum number of characters supported can be seen in the **maximumCharactersAllowed** field.
- **required** (boolean)
  - If returned as `true`, this rating type is required when leaving feedback.

### FeedbackRatingTypeEnum
**Description:** This enumerated type indicates the key for the type of rating. For example, the value `OVERALL_EXPERIENCE` indicates the rating is for the overall transaction experience. | - **OVERALL_EXPERIENCE**: This value indicates the rating applies to the overall transaction experience. - **OVERALL_EXPERIENCE_COMMENT**: This value indicates the comments are related to the overall experience. - **ON_TIME_DELIVERY**: This value indicates the rating applies to the timeliness of delivery. - **DSR_ITEM_AS_DESCRIBED**: This value indicates the Detailed Seller Rating applies to listing description accuracy. - **DSR_COMMUNICATION**: This value indicates the Detailed Seller Rating applies to communication. - **DSR_SHIPPING_CHARGES**: This value indicates the Detailed Seller Rating applies to shipping charges. - **DSR_SHIPPING_TIME**: This value indicates the Detailed Seller Rating applies to shipping time. - **ITEM_RATING**: This value indicates the rating specifically applies to the item itself.
**Type:** object

### FeedbackRatingValueDistribution
**Description:** This type provides fields for an array listing the distribution values of the feedback ratings.
**Type:** object

**Properties:**
- **count** (integer)
  - An integer representing the number of occurrences for a specific feedback rating **value**. For example, for the `POSITIVE` **value**, a `3` returned as the **count** represents three positive ratings were returned.
- **value** (string)
  - A string indicating the specific feedback rating value. Supported values include `POSITIVE`, `NEUTRAL`, `NEGATIVE`, `1`, `2`, `3`, `4`, and `5`.

### FeedbackRatingValueTypeEnum
**Description:** This enumerated type indicates the type of feedback values accepted. | - **RANGE**: This value indicates a numerical range and is used for star ratings of 1 through 5. For example, users can rate SHIPPING\_TIME as 1 star for poor shipping time or 5 stars for on time shipping. - **FREETEXT**: This value indicates a free text input. - **PREDEFINED**: This value indicates a predefined format.
**Type:** object

### FeedbackRatingValuesEnum
**Description:** This enumerated type defines the possible rating values that can be assigned for specific feedback criteria when leaving feedback. | - **POSITIVE**: This value indicates that the feedback expresses satisfaction with the transaction or experience. This typically reflects a successful and favorable interaction between the buyer and seller. - **NEUTRAL**: This value indicates that the feedback is neither distinctly favorable nor unfavorable. The transaction was completed, but did not fully meet expectations, or was considered average. - **NEGATIVE**: This value indicates dissatisfaction with the transaction or experience. This type of feedback highlights issues or problems that occurred, signaling that the buyer or seller was not satisfied.
**Type:** object

### FeedbackStarTypeEnum
**Description:** This enumerated type provides the available visual star representation of a feedback score. | - **YELLOW_STAR**: A yellow feedback star assigned to users with scores in the designated range. - **BLUE_STAR**: A blue feedback star assigned to users with scores in the designated range. - **TURQUOISE_STAR**: A turquoise feedback star assigned to users with scores in the designated range. - **PURPLE_STAR**: A purple feedback star assigned to users with scores in the designated range. - **RED_STAR**: A red feedback star assigned to users with scores in the designated range. - **GREEN_STAR**: A green feedback star assigned to users with scores in the designated range. - **YELLOW_SHOOTING_STAR**: A yellow shooting feedback star assigned to users with scores in the designated range. - **TURQUOISE_SHOOTING_STAR**: A turquoise shooting feedback star assigned to users with scores in the designated range. - **PURPLE_SHOOTING_STAR**: A purple shooting feedback star assigned to users with scores in the designated range. - **RED_SHOOTING_STAR**: A red shooting feedback star assigned to users with scores in the designated range. - **GREEN_SHOOTING_STAR**: A green shooting feedback star assigned to users with scores in the designated range. - **SILVER_SHOOTING_STAR**: A silver shooting feedback star assigned to users with scores in the designated range.
**Type:** object

### FeedbackStateEnum
**Description:** This enumerated type defines the possible states of feedback entries returned. | - **ENTERED**: This value indicates that the feedback has been submitted and is currently active. The feedback is visible to applicable parties. - **WITHDRAWN**: This value indicates that the feedback has been officially withdrawn and no longer has an effect on reputation calculations. - **HIDDEN**: This value indicates that the feedback has been hidden due to policy and is not visible to standard views. See [Feedback policy](https://www.ebay.com/help/policies/feedback-policies/feedback-policy?id=4208) for more information. - **REVISED**: This value indicates that the feedback was edited after initial submission. The revised version is not active. - **REVISION_OPEN**: This value indicates that a request to revise the feedback is in progress but not yet completed. - **REVISION_DECLINED_OR_EXPIRED**: This value indicates that the feedback revision request was declined or has expired.
**Type:** object

### GetFeedbackRatingSummaryResponse
**Description:** This type defines the fields for the **getFeedbackRatingSummary** response.
**Type:** object

**Properties:**
- **feedbackRatingSummary** (array)
  - An array containing a summary of feedback ratings. Each element provides detailed metrics and distributions for specific rating types.

### GetFeedbackResponse
**Description:** This type defines the fields for the **getFeedback** response.
**Type:** object

**Properties:**
- **feedbackEntries** (array)
  - This array contains a list of feedback entries that meet the specified criteria.
- **pagination** (Pagination)
  - This container provides pagination information for the returned feedback response (as filtered).

### Image
**Description:** This type provides a field for image URLs.
**Type:** object

**Properties:**
- **url** (string)
  - This field provides the URL of an attached image and is included in the response whenever an image is attached to the feedback.

### ItemsAwaitingFeedbackCount
**Description:** This type returns the number of line items awaiting feedback.
**Type:** object

**Properties:**
- **asBuyer** (integer)
  - The number of line items for which feedback is pending from the user in the buyer role.
- **asSeller** (integer)
  - The number of line items for which feedback is pending from the user in the seller role.

### KeyEnum
**Description:** This enumerated type indicates the key for the type of feedback rating submitted. For example, the value `ON_TIME_DELIVERY` indicates the rating provides feedback on if the item was delivered within the timeframe promised by the seller. | - **ON_TIME_DELIVERY**: This value indicates if the item was delivered within the timeframe promised by the seller. - **ITEM_AS_DESCRIBED**: This value reflects how accurately the item matched its description in the listing. - **COMMUNICATION**: This value evaluates the quality, responsiveness, and clarity of communication from the seller. - **SHIPPING_CHARGES**: This value rates the fairness and transparency of the shipping costs charged by the seller. - **SHIPPING_TIME**: This value assesses how quickly the seller shipped the item after payment was received.
**Type:** object

### LeaveFeedbackRequest
**Description:** This type provides fields available to leave feedback in the **leaveFeedback** request.
**Type:** object

**Properties:**
- **commentText** (string)
  - Use this field to provide the feedback left by the user, describing their experience with the line item of the transaction. No HTML formatting or personal information (such as phone numbers) is permitted.  

**Maximum length:** 500 characters
- **commentType** (FeedbackRatingValuesEnum)
  - Set this enumerated value to indicate the overall rating of the transaction: `POSITIVE`, `NEUTRAL`, or `NEGATIVE`.  

**Note:** Sellers can only provide positive feedback.
- **images** (array)
  - Use this array to optionally list up to 5 images attached to the feedback.
- **listingId** (string)
  - Use this field to provide the listing ID related to the transaction.
- **orderLineItemId** (string)
  - Use this field to provide the unique identifier of the line item for this feedback.
- **sellerRatings** (array)
  - Use this array to list ratings for specific aspects of the seller's performance.
- **transactionId** (string)
  - Use this field to provide the unique identifier of the transaction for this feedback.

### LeaveFeedbackResponse
**Description:** This type defines the fields for the **leaveFeedback** response for the feedback.
**Type:** object

**Properties:**
- **feedbackId** (string)
  - The unique ID assigned to the submitted feedback.

### ListingPrice
**Description:** This type provides details about the price of the listing awaiting feedback.
**Type:** object

**Properties:**
- **currency** (string)
  - This field provides the three-letter [ISO 4217](https://www.iso.org/iso-4217-currency-codes.html) code that represents the currency of the amount in the value field. Both the **value** and **currency** fields are always returned when expressing prices.
- **value** (number)
  - This field contains the numerical value of the listing price in the currency specified in the **currency** field. Both the **value** and **currency** fields are always returned when expressing prices.

### OrderLineItemAttribute
**Description:** This type describes line item attributes.
**Type:** object

**Properties:**
- **name** (OrderLineItemAttributesEnum)
  - This enumerated value indicates an attribute of the line item. The **value** field indicates if the attribute applies.
- **value** (string)
  - If returned as `true`, the line item attribute **name** applies; if returned as `false`, the attribute does not apply.

### OrderLineItemAttributesEnum
**Description:** This enumerated type provides fields to indicate special characteristics associated with an item or transaction. | - **PRIVATE_ITEM**: This value indicates the item was listed as private, meaning buyer identities are not publicly disclosed. - **MATURE_CATEGORY**: This value specifies that the item belongs to a mature or adult-only category. - **SOLD_AS_BEST_OFFER**: This value signifies that the item was sold using eBay's Best Offer feature, where the price was negotiated.
**Type:** object

### OrderLineItemSummary
**Description:** This type provides fields for a summary of the line item related to feedback.
**Type:** object

**Properties:**
- **listingId** (string)
  - This field provides the unique identifier for the listing associated with the feedback entry. It is conditionally returned based on the authorization flow and user context. See **orderLineItemSummary** for details on when this field is included.
- **listingPrice** (ListingPrice)
  - This container provides the sale price of the listing. It is conditionally returned based on the authorization flow and user context. See **orderLineItemSummary** for details on when this field is included.
- **listingTitle** (string)
  - This field contains the title of the listing. It is conditionally returned based on the authorization flow and user context. See **orderLineItemSummary** for details on when this field is included.
- **orderLineItemAttributes** (array)
  - This array describes order line attributes including names and values of a transaction.
- **orderLineItemId** (string)
  - The unique identifier of the line item for this feedback. It is conditionally returned based on the authorization flow and user context. See **orderLineItemSummary** for details on when this field is included.
- **transactionPeriod** (TransactionPeriod)
  - This container indicates if the time since the item was bought on eBay is less than, more than, or equal to 90 days

### Pagination
**Description:** This type provides pagination information for the returned line items.
**Type:** object

**Properties:**
- **count** (integer)
  - This value indicates the number of feedback entries on the current response page.
- **limit** (integer)
  - The value of the **limit** parameter submitted in the request. This is the maximum number of line items awaiting feedback, as filtered, to return per page from the result set. This field indicates the number of line items returned per page of data.

**Note:** If this is the last or only page of the result set, the page may contain fewer line items than the **limit** value.

If a **limit** parameter was not included in the request, this value will default to `25`, returning up to 25 line items on each page.

**Default:** 25
- **next** (string)
  - The relative URI for the next page of results starting with the resource name. This URI is returned if there is an additional page of results in the result set.
- **offset** (integer)
  - The value of the **offset** parameter submitted in the request. This field indicates how many results were skipped in the response. If an **offset** parameter was not included in the request, this value will default to `0`, returning the first page of results.

**Default:** 0
- **prev** (string)
  - The relative URI for the previous page of results starting with the resource name. This URI is returned if there is a previous page of results in the result set.
- **total** (integer)
  - The total number of line items available that match the filter criteria.

**Note:** If the total value exceeds the limit value, there are multiple pages of results.

### Period
**Description:** This type provides fields for the time period on which the feedback summary is calculated.
**Type:** object

**Properties:**
- **unit** (string)
  - The unit of the period's **value**. Supported value: `DAY`.
- **value** (integer)
  - The value for the feedback period, specified in units of **unit**. Supported value: `90`.

### ProviderUserDetail
**Description:** This type provides the details of the user who provided the feedback of a **getFeedback** response.
**Type:** object

**Properties:**
- **feedbackScore** (integer)
  - This integer indicates the feedback score of the feedback provider at the time the specific feedback was left.
- **feedbackStar** (FeedbackStarTypeEnum)
  - This enumerated value provides the visual star representation of the feedback score (for example, `YELLOW_STAR`).
- **role** (UserRoleEnum)
  - This enumerated value indicates the user's role in the transaction (`BUYER` or `SELLER`).
- **userAttributes** (array)
  - This array lists additional attributes that relate to the user (such as verification status).
- **userId** (string)
  - This field indicates the unique identifier of the user who gave the feedback.  
  
**Note:** Select developers will not receive username data for U.S. users through this field. Instead, an immutable user ID will be returned in its place. For more information, please refer to [Data Handling Compliance](/api-docs/static/data-handling-update.html).

### ProviderUserDetailUserAttributes
**Description:** This type defines the attributes of the user who provided the feedback of a **getFeedback** response.
**Type:** object

**Properties:**
- **name** (UserAttributeEnum)
  - This enumerated value indicates an attribute of the user (for example, `USER_VERIFIED`). The **value** field indicates if the attribute applies.
- **value** (string)
  - If returned as `true`, the user attribute **name** applies; if returned as `false`, the attribute does not apply.

### RatingSummaryByRatingType
**Description:** This type provides fields for an array that includes metrics and distributions for each rating type.
**Type:** object

**Properties:**
- **feedbackMetrics** (array)
  - An array of metrics associated with feedback aggregation.
- **feedbackRatingValueDistribution** (array)
  - An array listing the distribution values of the feedback ratings.
- **period** (Period)
  - The time period on which the feedback summary is calculated.
- **userRoleType** (UserRoleEnum)
  - This enumerated value indicates the user's role in the feedback (`BUYER` or `SELLER`).

### RespondToFeedbackRequest
**Description:** The type that defines the fields for the **respondToFeedback** request.
**Type:** object

**Properties:**
- **feedbackId** (string)
  - Use this field to provide the unique identifier for the feedback being responded to. It is used to specify the feedback entry associated with the feedback response. This value can be returned using the **getFeedback** method (strong>feedbackId field).
- **recipientUserId** (string)
  - Use this field to provide the identifier of the user who provided the original feedback. This value can be returned using the **getFeedback** method (**userId** field).  
  
**Note:** Both usernames and public user IDs will be accepted in this field. For more information, please refer to [Data Handling Compliance](/api-docs/static/data-handling-update.html).
- **responseText** (string)
  - Use this field to provide the text content of the response. This field is used to provide additional context or address the feedback given by the order partner. No HTML formatting or personal information (such as phone numbers) is permitted.  
  
**Maximum length:** 500 characters.
- **responseType** (ResponseTypeEnum)
  - Set this enumerated value to describe the type of response being submitted (for example, a `REPLY` or a `FOLLOW_UP`).

### ResponseTypeEnum
**Description:** This enumerated type categorizes the nature of responses provided to feedback entries. | - **REPLY**: This value indicates the feedback is a direct response to the feedback received. - **FOLLOW_UP**: This value indicates the feedback is a subsequent response that provides additional information or updates after an initial reply has been made.
**Type:** object

### SellerRating
**Description:** This type provides fields for specific aspects of the seller's performance.
**Type:** object

**Properties:**
- **key** (KeyEnum)
  - The enumerated value of the category being rated, such as delivery timeliness (`ON_TIME_DELIVERY`).
- **value** (string)
  - The value assigned for the selected category. Use a value of `1` through `5`, with `1` being the lowest rating and `5` being the highest.

### ThresholdTypeEnum
**Description:** This enumerated type indicates the comparison of thresholds applicable to the transaction period. | - **MORE_THAN**: This value indicates the transaction period is longer than the specified threshold. For example, if the threshold value was 30 days, this value indicates periods exceeding 30 days. - **LESS_THAN**: This value indicates the transaction period is shorter than the specified threshold. For example, if the threshold value was 30 days, this value indicates periods falling short of 30 days. - **EQUAL**: This value indicates the transaction period matches the specified threshold.
**Type:** object

### Topic
**Description:** This type provides subject-based fields derived from feedback.
**Type:** object

**Properties:**
- **coarseTopic** (string)
  - The main topic (or category) detected in the comment. See the available **topics** in the **filter** query parameter.
- **fineTopic** (string)
  - **Note:** Fine topics are not currently supported.

A more specific detail or subtopic related to the coarse topic.
- **highlightedTexts** (array)
  - This array lists any text snippets, phrases, or examples from the feedback that supports the detected topic.
- **sentiment** (string)
  - This field indicates a classification of the feedback, whether the feedback is `Positive`, `Negative`, or `Neutral`.

### TransactionPeriod
**Description:** This type specifies the amount of time elapsed and the threshold associated with a transaction.
**Type:** object

**Properties:**
- **period** (Period)
  - This container indicates if the time since the item was bought on eBay is less than, more than, or equal to 90 days.
- **thresholdType** (ThresholdTypeEnum)
  - This enumerated value indicates whether a transaction **period** exceeds, falls short, or matches the threshold. You can use this field to trigger specific logic or actions based on whether a transaction period exceeds, falls short, or matches the threshold.

### UserAttributeEnum
**Description:** This enumerated type defines the user attribute names for the user who provided the feedback. | - **USER_VERIFIED**: This value indicates that the user's account has successfully passed eBay's identity verification processes. - **USER_REGISTERED**: This value indicates that the user has completed registration and has an active account on eBay. - **USER_SAME_AS_SIGNED_IN_USER**: This value indicates that the feedback is being given by the same user who is currently authenticated in the API session. - **USER_PROFILE_PRIVATE**: This value indicates that the user has set their eBay profile details to be private (not visible to other users).
**Type:** object

### UserRoleEnum
**Description:** This enumerated type provides fields that indicate the user's role associated with the feedback. | - **SELLER**: This value indicates feedback related to the user's role as a seller. - **BUYER**: This value indicates feedback related to the user's role as a buyer.
**Type:** object

## Rate Limits

See [API Call Limits](https://developer.ebay.com/develop/get-started/api-call-limits) on the eBay Developer Program.

## Resources

### Documentation

- [eBay Developer Program](https://developer.ebay.com/)
- [API Documentation](https://developer.ebay.com/develop/api/)
- [SDKs and Widgets](https://developer.ebay.com/develop/sdks-and-widgets)
- [Developer Community Forum](https://community.ebay.com/t5/Developer-Groups/ct-p/developergroup)

### Tools

- [API Explorer](https://developer.ebay.com/my/api_test_tool)
- [GraphQL Explorer](https://developer.ebay.com/my/graphql_explorer)

### Support

- [Developer Support](https://developer.ebay.com/support/)
- [API Status](https://developer.ebay.com/support/api-status)
- [Release Notes](https://developer.ebay.com/develop/api/release_notes/)

---
*Generated on 2026-04-14T01:57:36.941Z*
