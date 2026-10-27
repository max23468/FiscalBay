# ItemSold legacy SOAP body example

**Source URL:** https://developer.ebay.com/api-docs/static/pn_item-sold.html

The legacy notification page includes a populated `Sample ItemSold
Notification`. The SOAP body below is copied from that official example.

```xml
<soapenv:Body>
	<GetItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
		<Timestamp>2008-02-13T03:47:28.106Z</Timestamp>
		<Ack>Success</Ack>
		<CorrelationID>10</CorrelationID>
		<Version>553</Version>
		<Build>e553_core_Bundled_6057805_R1</Build>
		<NotificationEventName>ItemSold</NotificationEventName>
		<RecipientUserID>S1</RecipientUserID>
		<Item>
			<AutoPay>false</AutoPay>
			<BuyerProtection>ItemEligible</BuyerProtection>
			<BuyItNowPrice currencyID="USD">10.0</BuyItNowPrice>
			<Country>US</Country>
			<Currency>USD</Currency>
			<HitCounter>NoHitCounter</HitCounter>
			<ItemID>22</ItemID>
			<ListingDetails>
				<Adult>false</Adult>
				<CheckoutEnabled>true</CheckoutEnabled>
				<ConvertedStartPrice currencyID="USD">1.0</ConvertedStartPrice>
				<StartTime>2015-02-13T03:42:45.000Z</StartTime>
				<EndTime>2015-02-13T03:43:32.000Z</EndTime>
				<ViewItemURL>https://www.ebay.com/ws/eBayISAPI.dll?ViewItem&amp;item=22&amp;category=1463</ViewItemURL>
				<HasUnansweredQuestions>false</HasUnansweredQuestions>
				<HasPublicMessages>false</HasPublicMessages>
			</ListingDetails>
			<ListingDuration>Days_5</ListingDuration>
			<ListingType>FixedPriceItem</ListingType>
			<Location>SA</Location>
			<PayPalEmailAddress>v2@.com</PayPalEmailAddress>
			<PrimaryCategory>
				<CategoryID>1463</CategoryID>
				<CategoryName>Collectibles:Trading Cards:Phone Cards</CategoryName>
			</PrimaryCategory>
			<PrivateListing>false</PrivateListing>
			<Quantity>1</Quantity>
			<ReviseStatus>
				<ItemRevised>false</ItemRevised>
			</ReviseStatus>
			<Seller>
				<AboutMePage>false</AboutMePage>
				<Email>sr@.com</Email>
				<FeedbackScore>100</FeedbackScore>
				<PositiveFeedbackPercent>98.1</PositiveFeedbackPercent>
				<FeedbackPrivate>false</FeedbackPrivate>
				<FeedbackRatingStar>Turquoise</FeedbackRatingStar>
				<IDVerified>false</IDVerified>
				<eBayGoodStanding>true</eBayGoodStanding>
				<NewUser>false</NewUser>
				<RegistrationDate>2008-02-23T23:50:13.000Z</RegistrationDate>
				<Site>US</Site>
				<Status>Confirmed</Status>
				<UserID>S1</UserID>
				<UserIDChanged>false</UserIDChanged>
				<UserIDLastChanged>2004-02-23T23:48:54.000Z</UserIDLastChanged>
				<VATStatus>NoVATTax</VATStatus>
			</Seller>
			<SellingStatus>
				<ConvertedCurrentPrice currencyID="USD">1.25</ConvertedCurrentPrice>
				<CurrentPrice currencyID="USD">1.25</CurrentPrice>
				<QuantitySold>1</QuantitySold>
				<SecondChanceEligible>true</SecondChanceEligible>
				<ListingStatus>Completed</ListingStatus>
			</SellingStatus>
			<ShippingDetails>
				<AllowPaymentEdit>true</AllowPaymentEdit>
				<ApplyShippingDiscount>false</ApplyShippingDiscount>
				<InsuranceOption>NotOffered</InsuranceOption>
			</ShippingDetails>
			<ShipToLocations>US</ShipToLocations>
			<Site>US</Site>
			<StartPrice currencyID="USD">1.0</StartPrice>
			<TimeLeft>PT0S</TimeLeft>
			<Title>Test Item{Won/Sold} notify</Title>
			<HitCount>0</HitCount>
			<PictureDetails>
				<PhotoDisplay>None</PhotoDisplay>
			</PictureDetails>
			<ProxyItem>false</ProxyItem>
		</Item>
	</GetItemResponse>
</soapenv:Body>
```
