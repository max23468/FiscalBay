# FeedbackLeft

- Source URL: https://developer.ebay.com/api-docs/static/pn_feedback-left.html

## Description

eBay sends a FeedbackLeft notification to third parties subscribed on the user's
behalf whenever initial feedback comments are left by that user and when
updated follow-up comments are left for items in dispute.

The typical flow of events is:

- A third party subscribes to the FeedbackLeft notification on behalf of a user.
- The user leaves initial feedback comments or updated follow-up comments for
  items in dispute.
- eBay sends the FeedbackLeft notification to the third party, indicating that
  the user left new feedback.

eBay also sends FeedbackLeft notifications to the third party for all feedback
items the user leaves, either through the eBay sites or programmatically from
an API or SDK.

Data Fields Returned:

- API call that displays this notification: GetFeedback with ReturnAll detail
  level.
- The data fields returned by the FeedbackLeft notification are the same as
  those returned by GetFeedbackResponse with ReturnAll details requested.
- Refer to the GetFeedback call reference documentation for additional
  information.
- Refer to SOAP Message Body for information about the standard elements
  returned for all notifications.
