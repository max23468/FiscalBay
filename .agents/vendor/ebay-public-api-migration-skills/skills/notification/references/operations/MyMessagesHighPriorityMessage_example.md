# MyMessagesHighPriorityMessage legacy SOAP body example

**Source URLs:**
- https://developer.ebay.com/devzone/xml/docs/reference/ebay/GetMyMessages.html
- https://developer.ebay.com/api-docs/static/pn_my-messages.html

`GetMyMessages` supports filtering to high-priority messages through
`IncludeHighPriorityMessageOnly`, and the My Messages notification page states the
notification output is the same `GetMyMessagesResponse` payload. The SOAP body
below is an adapted high-priority message example based on the official message
header/detail samples and the documented `HighPriority` field.

```xml
<soapenv:Body>
	<GetMyMessagesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
		<Timestamp>2019-11-04T22:17:05.891Z</Timestamp>
		<Ack>Success</Ack>
		<Version>1127</Version>
		<Build>E1127_CORE_APIMSG_19083139_R1</Build>
		<NotificationEventName>MyMessagesHighPriorityMessage</NotificationEventName>
		<Messages>
			<Message>
				<Sender>ebay-system</Sender>
				<RecipientUserID>seller-example</RecipientUserID>
				<Subject>Immediate action requested for item 110011001104</Subject>
				<MessageID>1000000003</MessageID>
				<Text>Please review this high-priority message in My Messages.</Text>
				<Flagged>true</Flagged>
				<HighPriority>true</HighPriority>
				<Read>false</Read>
				<ReceiveDate>2019-10-24T18:10:13.000Z</ReceiveDate>
				<ExpirationDate>2020-10-24T18:10:13.000Z</ExpirationDate>
				<ItemID>110011001104</ItemID>
				<ItemTitle>Example high-priority listing message</ItemTitle>
				<ResponseDetails>
					<ResponseEnabled>true</ResponseEnabled>
					<ResponseURL>https://www.ebay.com/mymessages</ResponseURL>
				</ResponseDetails>
				<Folder>
					<FolderID>0</FolderID>
				</Folder>
				<Replied>false</Replied>
			</Message>
		</Messages>
	</GetMyMessagesResponse>
</soapenv:Body>
```
