# FeedbackStarChanged

- Source URL: https://developer.ebay.com/api-docs/static/pn_feedback-star-changed.html

## Description

eBay sends a FeedbackStarChanged notification to third parties subscribed on the member's behalf whenever they attain a new Feedback Star level. The typical flow of events is: A third party subscribes to the FeedbackStarChanged notification on behalf of a member (buyer or seller). The buyer receives feedback that bumps them up to the next Feedback Star level. eBay sends the FeedbackStarChanged notification to the third party, indicating the member reached a new Feedback Star level. eBay also sends FeedbackStarChanged notifications to the third party for all new Feedback Star levels a member attains. Data Fields Returned API Call that displays this notification: GetFeedback The data fields returned by the FeedbackStarChanged notification are the same as those returned by GetFeedbackResponse . Refer to the GetFeedback call reference documentation for additional information. Refer to SOAP Message Body for information about the standard elements returned for all notifications.
