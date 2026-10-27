# FeedbackReceived

- Source URL: https://developer.ebay.com/api-docs/static/pn_feedback-received.html

## Description

eBay sends a FeedbackReceived notification to third parties subscribed on the user's behalf whenever initial feedback comments are received by that user and when updated follow-up comments are received for items in dispute. The typical flow of events is: A third party subscribes to the FeedbackReceived notification on behalf of a user. The user receives initial feedback comments or updated follow-up comments for items indispute. eBay sends the FeedbackReceived notification to the third party, indicating the user received new feedback. eBay also sends FeedbackReceived notifications to the third party for all feedback items the user receives, either through the eBay sites or programmatically from an API or SDK. Data Fields Returned API Call that displays this notification: GetFeedback with ReturnAll detail level The data fields returned by the FeedbackReceived notification are the same as those returned by GetFeedbackResponse with ReturnAll details requested. Refer to the GetFeedback call reference documentation for additional information. Refer to SOAP Message Body for information about the standard elements returned for all notifications.
