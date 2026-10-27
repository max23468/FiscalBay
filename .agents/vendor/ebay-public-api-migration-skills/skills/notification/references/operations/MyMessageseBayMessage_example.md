# MyMessageseBayMessage legacy SOAP body example

**Source URLs:**
- https://developer.ebay.com/api-docs/static/pn_my-messages.html
- https://developer.ebay.com/devzone/xml/docs/reference/ebay/GetMyMessages.html

The My Messages notification page explains that eBay-message notifications return
the same `GetMyMessagesResponse` payload shape as `GetMyMessages` with full
message content. The SOAP body below is adapted from the official
`GetMyMessages` message-detail sample using an eBay-sent message.

```xml
<soapenv:Body>
	<GetMyMessagesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
		<Timestamp>2019-11-04T22:17:05.891Z</Timestamp>
		<Ack>Success</Ack>
		<Version>1127</Version>
		<Build>E1127_CORE_APIMSG_19083139_R1</Build>
		<NotificationEventName>MyMessageseBayMessage</NotificationEventName>
		<Messages>
			<Message>
				<Sender>e**y</Sender>
				<RecipientUserID>r***9</RecipientUserID>
				<Subject>You have a new eBay message about item 110011001105</Subject>
				<MessageID>1000000004</MessageID>
				<Text>Good news. You have received a new eBay message in My Messages and can review it on the site.</Text>
				<Flagged>false</Flagged>
				<Read>true</Read>
				<ReceiveDate>2019-10-24T18:10:13.000Z</ReceiveDate>
				<ExpirationDate>2020-10-24T18:10:13.000Z</ExpirationDate>
				<ItemID>110011001105</ItemID>
				<ResponseDetails>
					<ResponseEnabled>false</ResponseEnabled>
				</ResponseDetails>
				<Folder>
					<FolderID>0</FolderID>
				</Folder>
				<Replied>false</Replied>
				<ItemEndTime>2019-10-26T18:28:54.000Z</ItemEndTime>
				<ItemTitle>Example eBay message listing</ItemTitle>
			</Message>
		</Messages>
	</GetMyMessagesResponse>
</soapenv:Body>
```
