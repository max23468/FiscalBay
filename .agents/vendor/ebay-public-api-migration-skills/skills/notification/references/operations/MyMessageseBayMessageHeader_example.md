# MyMessageseBayMessageHeader legacy SOAP body example

**Source URLs:**
- https://developer.ebay.com/api-docs/static/pn_my-messages.html
- https://developer.ebay.com/devzone/xml/docs/reference/ebay/GetMyMessages.html

The My Messages notification page explains that header-only eBay-message
notifications return the same `GetMyMessagesResponse` payload shape as
`GetMyMessages` with `ReturnHeaders`. The SOAP body below is adapted from the
official header sample using an eBay-sent message.

```xml
<soapenv:Body>
	<GetMyMessagesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
		<Timestamp>2019-11-04T22:17:05.891Z</Timestamp>
		<Ack>Success</Ack>
		<Version>1127</Version>
		<Build>E1127_CORE_APIMSG_19083139_R1</Build>
		<NotificationEventName>MyMessageseBayMessageHeader</NotificationEventName>
		<Messages>
			<Message>
				<Sender>e**y</Sender>
				<RecipientUserID>seller-example</RecipientUserID>
				<Subject>eBay sent an update for item 110011001106</Subject>
				<MessageID>1000000005</MessageID>
				<Flagged>false</Flagged>
				<Read>false</Read>
				<ReceiveDate>2019-10-24T18:10:13.000Z</ReceiveDate>
				<ExpirationDate>2020-10-24T18:10:13.000Z</ExpirationDate>
				<ItemID>110011001106</ItemID>
				<ResponseDetails>
					<ResponseEnabled>false</ResponseEnabled>
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
