# ItemListed legacy SOAP body example

**Source URL:** https://developer.ebay.com/api-docs/static/pn_item-listed.html

The legacy notification page includes a populated `Sample ItemListed
Notification`. The SOAP body below is copied from that official example.

```xml
<soapenv:Body>
	<GetItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
		<Timestamp>2011-01-06T08:08:13.025Z</Timestamp>
		<Ack>Success</Ack>
		<CorrelationID>40</CorrelationID>
		<Version>699</Version>
		<Build>E699_CORE_BUNDLED_12457306_R1</Build>
		<NotificationEventName>ItemListed</NotificationEventName>
		<RecipientUserID>tr</RecipientUserID>
		<EIASToken>n</EIASToken>
		<Item>
			<AutoPay>false</AutoPay>
			<BuyerProtection>ItemIneligible</BuyerProtection>
			<BuyItNowPrice currencyID="USD">0.0</BuyItNowPrice>
			<Country>US</Country>
			<Currency>USD</Currency>
			<HitCounter>NoHitCounter</HitCounter>
			<ItemID>17</ItemID>
			<ListingDetails>
				<Adult>false</Adult>
				<BindingAuction>false</BindingAuction>
				<CheckoutEnabled>true</CheckoutEnabled>
				<ConvertedBuyItNowPrice currencyID="USD">0.0</ConvertedBuyItNowPrice>
				<ConvertedStartPrice currencyID="USD">1.0</ConvertedStartPrice>
				<ConvertedReservePrice currencyID="USD">0.0</ConvertedReservePrice>
				<HasReservePrice>false</HasReservePrice>
				<StartTime>2011-01-06T08:07:54.000Z</StartTime>
				<EndTime>2011-01-13T08:07:54.000Z</EndTime>
				<ViewItemURL>http://ebay.com/ws/eBayISAPI.dll?ViewItem&amp;item=17&amp;category=377</ViewItemURL>
				<HasUnansweredQuestions>false</HasUnansweredQuestions>
				<HasPublicMessages>false</HasPublicMessages>
			</ListingDetails>
			<ListingDuration>Days_7</ListingDuration>
			<ListingType>Chinese</ListingType>
			<Location>Sa</Location>
			<PrimaryCategory>
				<CategoryID>377</CategoryID>
				<CategoryName>Books:Fiction &amp; Literature</CategoryName>
			</PrimaryCategory>
			<PrivateListing>false</PrivateListing>
			<Quantity>1</Quantity>
			<ReservePrice currencyID="USD">0.0</ReservePrice>
			<ReviseStatus>
				<ItemRevised>false</ItemRevised>
			</ReviseStatus>
			<Seller>
				<AboutMePage>false</AboutMePage>
				<Email>tr@.com</Email>
				<FeedbackScore>31</FeedbackScore>
				<PositiveFeedbackPercent>100.0</PositiveFeedbackPercent>
				<FeedbackPrivate>false</FeedbackPrivate>
				<FeedbackRatingStar>Yellow</FeedbackRatingStar>
				<IDVerified>true</IDVerified>
				<eBayGoodStanding>true</eBayGoodStanding>
				<NewUser>false</NewUser>
				<RegistrationDate>2010-01-01T00:00:00.000Z</RegistrationDate>
				<Site>US</Site>
				<Status>Confirmed</Status>
				<UserID>tr</UserID>
				<UserIDChanged>false</UserIDChanged>
				<UserIDLastChanged>2007-11-29T18:43:54.000Z</UserIDLastChanged>
				<VATStatus>NoVATTax</VATStatus>
				<SellerInfo>
					<AllowPaymentEdit>true</AllowPaymentEdit>
					<CheckoutEnabled>true</CheckoutEnabled>
					<CIPBankAccountStored>false</CIPBankAccountStored>
					<GoodStanding>true</GoodStanding>
					<LiveAuctionAuthorized>false</LiveAuctionAuthorized>
					<MerchandizingPref>OptIn</MerchandizingPref>
					<QualifiesForB2BVAT>false</QualifiesForB2BVAT>
					<StoreOwner>true</StoreOwner>
					<StoreURL>http://www.stores.ebay.com/id=16</StoreURL>
					<SafePaymentExempt>false</SafePaymentExempt>
				</SellerInfo>
				<MotorsDealer>false</MotorsDealer>
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
			<ShippingDetails>
				<ApplyShippingDiscount>false</ApplyShippingDiscount>
				<CalculatedShippingRate>
					<OriginatingPostalCode>95</OriginatingPostalCode>
					<PackagingHandlingCosts currencyID="USD">0.0</PackagingHandlingCosts>
				</CalculatedShippingRate>
				<ShippingServiceOptions>
					<ShippingService>USPSMedia</ShippingService>
					<ShippingServicePriority>1</ShippingServicePriority>
					<ExpeditedService>false</ExpeditedService>
					<ShippingTimeMin>2</ShippingTimeMin>
					<ShippingTimeMax>9</ShippingTimeMax>
				</ShippingServiceOptions>
				<ShippingType>Calculated</ShippingType>
				<ExcludeShipToLocation>Asia</ExcludeShipToLocation>
				<ExcludeShipToLocation>Middle East</ExcludeShipToLocation>
				<ExcludeShipToLocation>Southeast Asia</ExcludeShipToLocation>
				<SellerExcludeShipToLocationsPreference>true</SellerExcludeShipToLocationsPreference>
			</ShippingDetails>
			<ShipToLocations>US</ShipToLocations>
			<Site>US</Site>
			<StartPrice currencyID="USD">1.0</StartPrice>
			<Storefront>
				<StoreCategoryID>1</StoreCategoryID>
				<StoreCategory2ID>0</StoreCategory2ID>
				<StoreURL>http://www.stores.ebay.com/id=16</StoreURL>
			</Storefront>
			<TimeLeft>P6DT23H59M42S</TimeLeft>
			<Title>Harry Potter and the Philosopher&apos;s Stone</Title>
			<UUID>CB</UUID>
			<HitCount>0</HitCount>
			<LocationDefaulted>true</LocationDefaulted>
			<PostalCode>95</PostalCode>
			<PictureDetails>
				<GalleryType>Gallery</GalleryType>
				<PhotoDisplay>PicturePack</PhotoDisplay>
				<PictureURL>http://i1.ebayimg.com/03/i/00/3e/60/d1.JPG?set_id=87</PictureURL>
			</PictureDetails>
			<DispatchTimeMax>3</DispatchTimeMax>
			<ProxyItem>false</ProxyItem>
			<BuyerGuaranteePrice currencyID="USD">20000.0</BuyerGuaranteePrice>
			<IntangibleItem>false</IntangibleItem>
			<ReturnPolicy>
				<RefundOption>MoneyBack</RefundOption>
				<Refund>Money Back</Refund>
				<ReturnsWithinOption>Days_30</ReturnsWithinOption>
				<ReturnsWithin>30 Days</ReturnsWithin>
				<ReturnsAcceptedOption>ReturnsAccepted</ReturnsAcceptedOption>
				<ReturnsAccepted>Returns Accepted</ReturnsAccepted>
				<ShippingCostPaidByOption>Buyer</ShippingCostPaidByOption>
				<ShippingCostPaidBy>Buyer</ShippingCostPaidBy>
			</ReturnPolicy>
			<PaymentAllowedSite>eBayMotors</PaymentAllowedSite>
			<PaymentAllowedSite>CanadaFrench</PaymentAllowedSite>
			<PaymentAllowedSite>Canada</PaymentAllowedSite>
			<PaymentAllowedSite>US</PaymentAllowedSite>
			<ConditionID>1000</ConditionID>
			<ConditionDisplayName>Brand New</ConditionDisplayName>
		</Item>
	</GetItemResponse>
</soapenv:Body>
```
