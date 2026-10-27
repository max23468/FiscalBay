# GET : getFeedback Samples
- [Sample 1: Get Feedback by feedback_id](#sample-1-get-feedback-by-feedback_id)

---

## Sample 1: Get Feedback by feedback_id

This call retrieves detailed feedback information using a specified feedback ID. Feedback is tracked at the line item level within an order, meaning each feedback entry corresponds to a single line item.

### Input

The inputs are `feedback_type`, `user_id`, and `feedback_id` URI parameters.

```http
GET https://api.ebay.com/commerce/feedback/v1/feedback?feedback_type=FEEDBACK_RECEIVED&user_id=sd*********er&feedback_id=89*******17
```

### Output

If the call is successful, an array of line items matching the specified criteria are returned. Since no **offset** or **limit** was sent in the request, the default values were used and returned.

```json
{
   "pagination": {
       "count": 1,
       "offset": 0,
       "limit": 25
   },
   "feedbackEntries": [
       {
           "feedbackId": "89*******17",
           "listingTransactionSummary": {
               "listingId": "250074144140",
               "listingTitle": "DCP -- 2-IntlCalculatedShipping Item16*********14-16*********14**49****ea-d**3-4",
               "listingPrice": {
                   "value": 10.0,
                   "currency": "CAD"
               },
               "transactionPeriod": {
                   "thresholdType": "LESS_THAN",
                   "period": {
                       "value": 90,
                       "unit": "DAY"
                   }
               },
               "OrderLineItemAttribute": [
                   {
                       "name": "SOLD_AS_BEST_OFFER",
                       "value": "false"
                   },
                   {
                       "name": "MATURE_CATEGORY",
                       "value": "false"
                   },
                   {
                       "name": "PRIVATE_ITEM",
                       "value": "false"
                   }
               ]
           },
           "hasImages": true,
           "feedbackEnteredPeriod": {
               "value": 30,
               "unit": "DAY"
           },
           "feedbackScore": 70,
           "commentType": "POSITIVE",
           "feedbackComment": {
               "commentText": "rcsx10 - positive  - 5 Shipping cost/1 star item desc - 5 images",
               "state": "ENTERED"
           },
           "feedbackRatings": [
               {
                   "ratingType": "DSR_SHIPPING_CHARGES",
                   "value": "5"
               },
               {
                   "ratingType": "ON_TIME_DELIVERY",
                   "value": "BUYER_DIDNT_PROVIDE_ANSWER"
               },
               {
                   "ratingType": "DSR_ITEM_AS_DESCRIBED",
                   "value": "1"
               }
           ],
           "replyComment": {
               "commentText": "thank you",
               "commentPeriod": {
                   "value": 30,
                   "unit": "DAY"
               },
               "state": "ENTERED",
               "commentTextRemovedPerPolicy": false
           },
           "providerUserDetail": {
               "userId": "x***r",
               "role": "BUYER",
               "feedbackScore": 17,
               "userAttributes": [
                   {
                       "name": "USER_SAME_AS_SIGNED_IN_USER",
                       "value": "false"
                   },
                   {
                       "name": "USER_VERIFIED",
                       "value": "true"
                   },
                   {
                       "name": "USER_REGISTERED",
                       "value": "true"
                   },
                   {
                       "name": "USER_PROFILE_PRIVATE",
                       "value": "false"
                   }
               ]
           },
           "feedbackState": "ENTERED",
           "eligibleForRevision": false,
           "images": [
               {
                   "url": "https://i.ebayimg.com/00/s/M*********Ew/z/gQ************bB/$_1.JPG?set_id=2"
               },
               {
                   "url": "https://i.ebayimg.com/00/s/OD*DA=/z/R-k*A*********bD/$_1.JPG?set_id=2"
               },                                          
               {                                           
                   "url": "https://i.ebayimg.com/00/s/OT*DA=/z/gQ************bG/$_1.JPG?set_id=2"
               },                                          
               {                                           
                   "url": "https://i.ebayimg.com/00/s/OD*DA=/z/R-************bI/$_1.JPG?set_id=2"
               },                                          
               {                                           
                   "url": "https://i.ebayimg.com/00/s/OD*DA=/z/R-************bL/$_1.JPG?set_id=2"
               }                                           
           ],
           "automatedFeedback": false
       }
   ]
}
```

---

