# ItemRevised legacy SOAP body example

**Source URL:** https://developer.ebay.com/api-docs/static/pn_item-revised.html

The legacy notification page includes a populated `Sample ItemRevised
Notification`. The SOAP body below is copied from that official example.

```xml
<soapenv:Body>
	<GetItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
		<Timestamp>2005-04-30T03:43:03.029Z</Timestamp>
		<Ack>Success</Ack>
		<CorrelationID>10</CorrelationID>
		<Version>491</Version>
		<Build>e491_core_Bundled_3979444_R1</Build>
		<NotificationEventName>ItemRevised</NotificationEventName>
		<RecipientUserID>s1</RecipientUserID>
		<Item>
			<AutoPay>false</AutoPay>
			<BuyerProtection>ItemIneligible</BuyerProtection>
			<BuyItNowPrice currencyID="USD">0.0</BuyItNowPrice>
			<Country>US</Country>
			<Currency>USD</Currency>
			<HitCounter>NoHitCounter</HitCounter>
			<ItemID>12</ItemID>
			<ListingDetails>
				<Adult>false</Adult>
				<BindingAuction>false</BindingAuction>
				<CheckoutEnabled>true</CheckoutEnabled>
				<ConvertedBuyItNowPrice currencyID="USD">0.0</ConvertedBuyItNowPrice>
				<ConvertedStartPrice currencyID="USD">1.0</ConvertedStartPrice>
				<ConvertedReservePrice currencyID="USD">0.0</ConvertedReservePrice>
				<HasReservePrice>false</HasReservePrice>
				<StartTime>2006-12-19T22:06:23.000Z</StartTime>
				<EndTime>2006-12-24T22:06:23.000Z</EndTime>
				<ViewItemURL>http://cgi.ebay.com/ws/eBayISAPI.dll?ViewItem&amp;item=12&amp;category=1463</ViewItemURL>
				<HasUnansweredQuestions>false</HasUnansweredQuestions>
				<HasPublicMessages>false</HasPublicMessages>
			</ListingDetails>
			<ListingDuration>Days_5</ListingDuration>
			<ListingType>Chinese</ListingType>
			<Location>Se</Location>
			<PrimaryCategory>
				<CategoryID>1463</CategoryID>
				<CategoryName>Collectibles:Trading Cards:Phone Cards</CategoryName>
			</PrimaryCategory>
			<PrivateListing>false</PrivateListing>
			<Quantity>1</Quantity>
			<ReservePrice currencyID="USD">0.0</ReservePrice>
			<ReviseStatus>
				<ItemRevised>true</ItemRevised>
			</ReviseStatus>
			<Seller>
				<AboutMePage>false</AboutMePage>
				<Email>s1@.com</Email>
				<FeedbackScore>100</FeedbackScore>
				<FeedbackPrivate>false</FeedbackPrivate>
				<FeedbackRatingStar>Turquoise</FeedbackRatingStar>
				<IDVerified>false</IDVerified>
				<eBayGoodStanding>true</eBayGoodStanding>
				<NewUser>false</NewUser>
				<RegistrationDate>2004-02-23T23:50:13.000Z</RegistrationDate>
				<Site>US</Site>
				<Status>Confirmed</Status>
				<UserID>s1</UserID>
				<UserIDChanged>false</UserIDChanged>
				<UserIDLastChanged>2004-02-23T23:48:54.000Z</UserIDLastChanged>
				<VATStatus>NoVATTax</VATStatus>
			</Seller>
			<SellingStatus>
				<BidCount>0</BidCount>
				<BidIncrement currencyID="USD">0.25</BidIncrement>
				<ConvertedCurrentPrice currencyID="USD">1.0</ConvertedCurrentPrice>
				<CurrentPrice currencyID="USD">1.0</CurrentPrice>
				<LeadCount>0</LeadCount>
				<MinimumToBid currencyID="USD">1.0</MinimumToBid>
				<QuantitySold>0</QuantitySold>
				<ReserveMet>true</ReserveMet>
				<SecondChanceEligible>false</SecondChanceEligible>
				<ListingStatus>Active</ListingStatus>
			</SellingStatus>
			<ShipToLocations>US</ShipToLocations>
			<Site>US</Site>
			<StartPrice currencyID="USD">1.0</StartPrice>
			<TimeLeft>P4DT23H58M10S</TimeLeft>
			<Title>Test ItemRevised notification 2</Title>
			<HitCount>0</HitCount>
			<ProxyItem>false</ProxyItem>
		</Item>
	</GetItemResponse>
</soapenv:Body>
```
