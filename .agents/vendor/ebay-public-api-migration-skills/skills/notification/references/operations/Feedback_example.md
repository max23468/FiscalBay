# Feedback legacy SOAP body example

**Source URL:** https://developer.ebay.com/api-docs/static/pn_feedback.html

The legacy notification page includes a populated `Sample Feedback
Notification`. The SOAP body below is copied from that official example.

```xml
<soapenv:Body>
	<GetFeedbackResponse xmlns="urn:ebay:apis:eBLBaseComponents">
		<Timestamp>2005-04-30T03:40:37.529Z</Timestamp>
		<Ack>Success</Ack>
		<CorrelationID>80</CorrelationID>
		<Version>407</Version>
		<Build>20050429131630</Build>
		<NotificationEventName>Feedback</NotificationEventName>
		<RecipientUserID>seller1</RecipientUserID>
		<FeedbackDetailArray>
			<FeedbackDetail>
				<CommentingUser>b1</CommentingUser>
				<CommentingUserScore>2</CommentingUserScore>
				<CommentText>Great transaction!</CommentText>
				<CommentTime>2005-04-30T03:39:46.000Z</CommentTime>
				<CommentType>Positive</CommentType>
				<ItemID>78</ItemID>
				<Role>Seller</Role>
				<FeedbackID>39</FeedbackID>
				<TransactionID>87</TransactionID>
			</FeedbackDetail>
		</FeedbackDetailArray>
		<FeedbackDetailItemTotal>151</FeedbackDetailItemTotal>
		<FeedbackScore>1</FeedbackScore>
	</GetFeedbackResponse>
</soapenv:Body>
```
