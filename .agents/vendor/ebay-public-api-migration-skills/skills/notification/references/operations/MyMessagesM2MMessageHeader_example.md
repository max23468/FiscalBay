# MyMessagesM2MMessageHeader legacy SOAP body example

**Source URLs:**
- https://developer.ebay.com/api-docs/static/pn_my-messages.html
- https://developer.ebay.com/devzone/xml/docs/reference/ebay/GetMyMessages.html

The legacy notification page says this notification sends a
`GetMyMessagesResponse` at `ReturnHeaders` detail level. The SOAP body below is
adapted from the official `GetMyMessages` header sample.

```xml
<soapenv:Body>
	<GetMyMessagesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
		<Timestamp>2019-11-04T22:17:05.891Z</Timestamp>
		<Ack>Success</Ack>
		<Version>1127</Version>
		<Build>E1127_CORE_APIMSG_19083139_R1</Build>
		<NotificationEventName>MyMessagesM2MMessageHeader</NotificationEventName>
		<Messages>
			<Message>
				<Sender>buyer-example</Sender>
				<RecipientUserID>seller-example</RecipientUserID>
				<Subject>buyer-example has sent a question about item #110011001102</Subject>
				<MessageID>1000000001</MessageID>
				<Flagged>false</Flagged>
				<Read>false</Read>
				<ReceiveDate>2019-10-18T02:54:32.000Z</ReceiveDate>
				<ExpirationDate>2020-02-12T02:54:31.000Z</ExpirationDate>
				<ItemID>110011001102</ItemID>
				<ResponseDetails>
					<ResponseEnabled>true</ResponseEnabled>
					<ResponseURL>https://contact.ebay.com/ws/eBayISAPI.dll?M2MContact&amp;item=110011001102&amp;messageid=1000000001</ResponseURL>
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
