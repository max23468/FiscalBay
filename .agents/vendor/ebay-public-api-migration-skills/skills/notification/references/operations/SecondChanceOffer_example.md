# SecondChanceOffer legacy SOAP body example

**Source URLs:**
- https://developer.ebay.com/api-docs/static/pn_second-chance.html
- https://developer.ebay.com/devzone/xml/docs/reference/ebay/GetMyMessages.html

The legacy notification page says `SecondChanceOffer` returns the same payload
shape as `GetItem` with default detail level, but it does not publish a SOAP
sample. eBay's official `GetMyMessages` samples also show a "Second Chance
Offer" message subject. The SOAP body below is an adapted `GetItemResponse`
example that preserves the documented notification shape and event context.

```xml
<soapenv:Body>
	<GetItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
		<Timestamp>2019-10-20T23:34:37.000Z</Timestamp>
		<Ack>Success</Ack>
		<Version>1127</Version>
		<Build>E1127_CORE_APIMSG_19083139_R1</Build>
		<NotificationEventName>SecondChanceOffer</NotificationEventName>
		<RecipientUserID>buyer-example</RecipientUserID>
		<Item>
			<ItemID>330033003300</ItemID>
			<ListingDetails>
				<StartTime>2019-10-10T23:34:37.000Z</StartTime>
				<EndTime>2019-10-20T23:34:30.000Z</EndTime>
				<ViewItemURL>https://www.ebay.com/itm/330033003300</ViewItemURL>
			</ListingDetails>
			<ListingType>Chinese</ListingType>
			<PrimaryCategory>
				<CategoryID>267</CategoryID>
				<CategoryName>Books &amp; Magazines</CategoryName>
			</PrimaryCategory>
			<Quantity>1</Quantity>
			<Seller>
				<UserID>seller-example</UserID>
				<FeedbackScore>57</FeedbackScore>
			</Seller>
			<SellingStatus>
				<CurrentPrice currencyID="USD">12.00</CurrentPrice>
				<SecondChanceEligible>true</SecondChanceEligible>
				<ListingStatus>Completed</ListingStatus>
			</SellingStatus>
			<Site>US</Site>
			<Title>Auction Title</Title>
		</Item>
	</GetItemResponse>
</soapenv:Body>
```
