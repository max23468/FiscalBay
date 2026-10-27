# FeedbackLeft legacy SOAP body example

```xml
<soapenv:Body>
	<GetFeedbackResponse xmlns="urn:ebay:apis:eBLBaseComponents">
		<Timestamp>2008-02-13T02:27:42.996Z</Timestamp>
		<Ack>Success</Ack>
		<CorrelationID>EXAMPLE_CORRELATION_ID</CorrelationID>
		<Version>553</Version>
		<Build>EXAMPLE_BUILD</Build>
		<NotificationEventName>FeedbackLeft</NotificationEventName>
		<RecipientUserID>example-recipient</RecipientUserID>
		<FeedbackDetailArray>
			<FeedbackDetail>
				<CommentingUser>example-user</CommentingUser>
				<CommentingUserScore>100</CommentingUserScore>
				<CommentText>Example feedback comment.</CommentText>
				<CommentTime>2008-02-13T02:27:16.000Z</CommentTime>
				<CommentType>Positive</CommentType>
				<ItemID>EXAMPLE_ITEM_ID</ItemID>
				<Role>Buyer</Role>
				<FeedbackID>EXAMPLE_FEEDBACK_ID</FeedbackID>
			</FeedbackDetail>
		</FeedbackDetailArray>
		<FeedbackDetailItemTotal>214</FeedbackDetailItemTotal>
		<FeedbackScore>1</FeedbackScore>
	</GetFeedbackResponse>
</soapenv:Body>
```
