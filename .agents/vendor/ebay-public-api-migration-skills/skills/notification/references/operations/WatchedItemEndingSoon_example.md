# WatchedItemEndingSoon legacy SOAP body example

**Source URL:** https://developer.ebay.com/api-docs/static/pn_watched-item-ending-soon.html

The legacy notification page includes a populated `Sample
WatchedItemEndingSoon Notification`. The SOAP body below is copied from that
official example.

```xml
<soapenv:Body>
	<GetItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
		<Timestamp>2007-03-09T19:18:08.284Z</Timestamp>
		<Ack>Success</Ack>
		<Version>505</Version>
		<Build>e505_core_API_32243_90</Build>
		<NotificationEventName>WatchedItemEndingSoon</NotificationEventName>
		<WatchList>
			<ItemArray>
				<Item>
					<BuyItNowPrice currencyID="USD">10.0</BuyItNowPrice>
					<ItemID>41</ItemID>
					<ListingDetails>
						<StartTime>2007-03-08T20:57:14.000Z</StartTime>
						<EndTime>2007-03-15T20:57:14.000Z</EndTime>
					</ListingDetails>
					<Seller>
						<UserID>sr</UserID>
					</Seller>
					<SellingStatus>
						<CurrentPrice currencyID="USD">10.0</CurrentPrice>
					</SellingStatus>
					<Site>US</Site>
					<TimeLeft>P6DT1H39M6S</TimeLeft>
					<Title>SDK item title</Title>
					<QuantityAvailable>1</QuantityAvailable>
				</Item>
			</ItemArray>
			<PaginationResult>
				<TotalNumberOfPages>1</TotalNumberOfPages>
				<TotalNumberOfEntries>1</TotalNumberOfEntries>
			</PaginationResult>
		</WatchList>
	</GetItemResponse>
</soapenv:Body>
```
