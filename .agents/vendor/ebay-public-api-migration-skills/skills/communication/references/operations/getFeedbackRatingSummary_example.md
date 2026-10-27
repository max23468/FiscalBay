# GET : getFeedbackRatingSummary Samples
- [Sample 1: Get Feedback Rating Summary](#sample-1-get-feedback-rating-summary)

---

## Sample 1: Get Feedback Rating Summary

This call retrieves a detailed overview of feedback ratings associated with the specified user filtering for the type of rating (this sample uses `OVERALL_EXPERIENCE`) and period in the eBay marketplace.

### Input

The input specifies the user ID, type of rating, and period and excludes repeat feedback.

```http
GET https://api.ebay.com/commerce/feedback/v1/feedback_rating_summary?user_id=sd*********er&filter=ratingType:OVERALL_EXPERIENCE,period:365,excludeRepeatFeedback:true
```

### Output

If the call is successful, an array of feedback ratings matching the specified criteria are returned.

```json
{
   "feedbackRatingSummary": [
       {
           "ratingType": "OVERALL_EXPERIENCE",
           "ratingSummaryByRatingType": [
               {
                   "period": {
                       "value": 365,
                       "unit": "DAY"
                   },
                   "feedbackMetrics": [
                       {
                           "metricName": "POSITIVE_PERCENT_EXCLUDING_NEUTRAL_FEEDBACK",
                           "metricValue": 55.8
                       }
                   ],
                   "feedbackRatingValueDistribution": [
                       {
                           "value": "POSITIVE",
                           "count": 29
                       },
                       {
                           "value": "NEUTRAL",
                           "count": 28
                       },
                       {
                           "value": "NEGATIVE",
                           "count": 23
                       }
                   ]
               },
               {
                   "period": {
                       "value": 365,
                       "unit": "DAY"
                   },
                   "userRoleType": "BUYER",
                   "feedbackRatingValueDistribution": [
                       {
                           "value": "POSITIVE",
                           "count": 0
                       },
                       {
                           "value": "NEUTRAL",
                           "count": 0
                       },
                       {
                           "value": "NEGATIVE",
                           "count": 0
                       }
                   ]
               },
               {
                   "period": {
                       "value": 365,
                       "unit": "DAY"
                   },
                   "userRoleType": "SELLER",
                   "feedbackMetrics": [
                       {
                           "metricName": "POSITIVE_PERCENT_EXCLUDING_NEUTRAL_FEEDBACK",
                           "metricValue": 55.8
                       }
                   ],
                   "feedbackRatingValueDistribution": [
                       {
                           "value": "POSITIVE",
                           "count": 29
                       },
                       {
                           "value": "NEUTRAL",
                           "count": 28
                       },
                       {
                           "value": "NEGATIVE",
                           "count": 23
                       }
                   ]
               }
           ]
       }
   ]
}
```

---

