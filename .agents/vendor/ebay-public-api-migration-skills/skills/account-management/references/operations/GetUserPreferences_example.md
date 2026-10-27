# GetUserPreferences — Example

## Request Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetUserPreferencesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>A3</eBayAuthToken>
  </RequesterCredentials>
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <ShowBidderNoticePreferences>true</ShowBidderNoticePreferences>
  <ShowCombinedPaymentPreferences>true</ShowCombinedPaymentPreferences>
  <ShowDispatchCutoffTimePreferences>true</ShowDispatchCutoffTimePreferences>
  <ShoweBayPLUSPreference>true</ShoweBayPLUSPreference>
  <ShowEmailShipmentTrackingNumberPreference>true</ShowEmailShipmentTrackingNumberPreference>
  <ShowEndOfAuctionEmailPreferences>true</ShowEndOfAuctionEmailPreferences>
  <ShowGlobalShippingProgramListingPreference>true</ShowGlobalShippingProgramListingPreference>
  <ShowGlobalShippingProgramPreference>true</ShowGlobalShippingProgramPreference>
  <ShowOutOfStockControlPreference>true</ShowOutOfStockControlPreference>
  <ShowOverrideGSPServiceWithIntlServicePreference>true</ShowOverrideGSPServiceWithIntlServicePreference>
  <ShowPickupDropoffPreferences>true</ShowPickupDropoffPreferences>
  <ShowPurchaseReminderEmailPreferences>true</ShowPurchaseReminderEmailPreferences>
  <ShowRequiredShipPhoneNumberPreference>true</ShowRequiredShipPhoneNumberPreference>
  <ShowSellerExcludeShipToLocationPreference>true</ShowSellerExcludeShipToLocationPreference>
  <ShowSellerFavoriteItemPreferences>true</ShowSellerFavoriteItemPreferences>
  <ShowSellerPaymentPreferences>true</ShowSellerPaymentPreferences>
  <ShowSellerProfilePreferences>true</ShowSellerProfilePreferences>
  <ShowSellerReturnPreferences>true</ShowSellerReturnPreferences>
  <ShowUnpaidItemAssistanceExclusionList>true</ShowUnpaidItemAssistanceExclusionList>
  <ShowUnpaidItemAssistancePreference>true</ShowUnpaidItemAssistancePreference>
</GetUserPreferencesRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetUserPreferencesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <ShowBidderNoticePreferences>boolean</ShowBidderNoticePreferences>
  <ShowCombinedPaymentPreferences>boolean</ShowCombinedPaymentPreferences>
  <ShowDispatchCutoffTimePreferences>boolean</ShowDispatchCutoffTimePreferences>
  <ShoweBayPLUSPreference>boolean</ShoweBayPLUSPreference>
  <ShowEmailShipmentTrackingNumberPreference>boolean</ShowEmailShipmentTrackingNumberPreference>
  <ShowEndOfAuctionEmailPreferences>boolean</ShowEndOfAuctionEmailPreferences>
  <ShowGlobalShippingProgramListingPreference>boolean</ShowGlobalShippingProgramListingPreference>
  <ShowGlobalShippingProgramPreference>boolean</ShowGlobalShippingProgramPreference>
  <ShowOutOfStockControlPreference>boolean</ShowOutOfStockControlPreference>
  <ShowOverrideGSPServiceWithIntlServicePreference>boolean</ShowOverrideGSPServiceWithIntlServicePreference>
  <ShowPickupDropoffPreferences>boolean</ShowPickupDropoffPreferences>
  <ShowPurchaseReminderEmailPreferences>boolean</ShowPurchaseReminderEmailPreferences>
  <ShowRequiredShipPhoneNumberPreference>boolean</ShowRequiredShipPhoneNumberPreference>
  <ShowSellerExcludeShipToLocationPreference>boolean</ShowSellerExcludeShipToLocationPreference>
  <ShowSellerFavoriteItemPreferences>boolean</ShowSellerFavoriteItemPreferences>
  <ShowSellerPaymentPreferences>boolean</ShowSellerPaymentPreferences>
  <ShowSellerProfilePreferences>boolean</ShowSellerProfilePreferences>
  <ShowSellerReturnPreferences>boolean</ShowSellerReturnPreferences>
  <ShowUnpaidItemAssistanceExclusionList>boolean</ShowUnpaidItemAssistanceExclusionList>
  <ShowUnpaidItemAssistancePreference>boolean</ShowUnpaidItemAssistancePreference>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetUserPreferencesRequest>
```

## Response Example

```xml
<?xml version="1.0" encoding="UTF-8"?>
<GetUserPreferencesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Timestamp>2019-11-06T17:13:23.570Z</Timestamp>
  <Ack>Success</Ack>
  <Version>1131</Version>
  <Build>E1131_CORE_APISELLING_19099826_R1</Build>
  <BidderNoticePreferences></BidderNoticePreferences>
  <CombinedPaymentPreferences>
    <CombinedPaymentOption>SpecifyDiscountLater</CombinedPaymentOption>
  </CombinedPaymentPreferences>
  <SellerPaymentPreferences>
    <DisplayPayNowButton>ShowPayNowButtonForAllPaymentMethods</DisplayPayNowButton>
    <PayPalPreferred>false</PayPalPreferred>
    <DefaultPayPalEmailAddress>r@.com</DefaultPayPalEmailAddress>
    <PayPalAlwaysOn>true</PayPalAlwaysOn>
    <UPSRateOption>UPSDailyRates</UPSRateOption>
  </SellerPaymentPreferences>
  <SellerFavoriteItemPreferences>
    <StoreCategoryID>0</StoreCategoryID>
    <ListingType>LeadGeneration</ListingType>
    <SearchSortOrder>NewlyListed</SearchSortOrder>
    <MinPrice currencyID="USD">-1.0</MinPrice>
    <MaxPrice currencyID="USD">-1.0</MaxPrice>
    <FavoriteItemID></FavoriteItemID>
    <FavoriteItemID></FavoriteItemID>
    <FavoriteItemID></FavoriteItemID>
    <FavoriteItemID></FavoriteItemID>
  </SellerFavoriteItemPreferences>
  <EndOfAuctionEmailPreferences>
    <TemplateText>this is my custom text that i just changed</TemplateText>
    <LogoType>Store</LogoType>
    <EmailCustomized>false</EmailCustomized>
    <TextCustomized>false</TextCustomized>
    <LogoCustomized>false</LogoCustomized>
    <CopyEmail>false</CopyEmail>
  </EndOfAuctionEmailPreferences>
  <EmailShipmentTrackingNumberPreference>false</EmailShipmentTrackingNumberPreference>
  <RequiredShipPhoneNumberPreference>false</RequiredShipPhoneNumberPreference>
  <UnpaidItemAssistancePreferences>
    <DelayBeforeOpeningDispute>30</DelayBeforeOpeningDispute>
    <OptInStatus>true</OptInStatus>
    <AutoRelist>false</AutoRelist>
    <ExcludedUser>r9</ExcludedUser>
  </UnpaidItemAssistancePreferences>
  <SellerExcludeShipToLocationPreferences>
    <ExcludeShipToLocation>YE</ExcludeShipToLocation>
    <ExcludeShipToLocation>QA</ExcludeShipToLocation>
    <ExcludeShipToLocation>SA</ExcludeShipToLocation>
    <ExcludeShipToLocation>IQ</ExcludeShipToLocation>
    <ExcludeShipToLocation>IL</ExcludeShipToLocation>
    <ExcludeShipToLocation>KW</ExcludeShipToLocation>
    <ExcludeShipToLocation>BH</ExcludeShipToLocation>
    <ExcludeShipToLocation>JO</ExcludeShipToLocation>
    <ExcludeShipToLocation>OM</ExcludeShipToLocation>
    <ExcludeShipToLocation>TR</ExcludeShipToLocation>
    <ExcludeShipToLocation>AE</ExcludeShipToLocation>
    <ExcludeShipToLocation>Middle East</ExcludeShipToLocation>
    <ExcludeShipToLocation>LB</ExcludeShipToLocation>
  </SellerExcludeShipToLocationPreferences>
  <PurchaseReminderEmailPreferences>
    <PurchaseReminderEmailPreferences>true</PurchaseReminderEmailPreferences>
  </PurchaseReminderEmailPreferences>
  <SellerProfilePreferences>
    <SellerProfileOptedIn>true</SellerProfileOptedIn>
    <SupportedSellerProfiles>
      <SupportedSellerProfile>
        <ProfileID>10</ProfileID>
        <ProfileType>PAYMENT</ProfileType>
        <ProfileName>es</ProfileName>
        <ShortSummary>eBay Payments</ShortSummary>
        <CategoryGroup>
          <Name>ALL</Name>
          <IsDefault>false</IsDefault>
        </CategoryGroup>
      </SupportedSellerProfile>
      <SupportedSellerProfile>
        <ProfileID>30</ProfileID>
        <ProfileType>PAYMENT</ProfileType>
        <ProfileName>Py</ProfileName>
        <ShortSummary>PayPal, r@g.com</ShortSummary>
        <CategoryGroup>
          <Name>ALL</Name>
          <IsDefault>true</IsDefault>
        </CategoryGroup>
      </SupportedSellerProfile>
      <SupportedSellerProfile>
        <ProfileID>10</ProfileID>
        <ProfileType>PAYMENT</ProfileType>
        <ProfileName>Pl</ProfileName>
        <ShortSummary>PayPal, r@g.com</ShortSummary>
        <CategoryGroup>
          <Name>ALL</Name>
          <IsDefault>false</IsDefault>
        </CategoryGroup>
      </SupportedSellerProfile>
      <SupportedSellerProfile>
        <ProfileID>10</ProfileID>
        <ProfileType>PAYMENT</ProfileType>
        <ProfileName>es</ProfileName>
        <ShortSummary>eBay Payments</ShortSummary>
        <CategoryGroup>
          <Name>ALL</Name>
          <IsDefault>false</IsDefault>
        </CategoryGroup>
      </SupportedSellerProfile>
      <SupportedSellerProfile>
        <ProfileID>10</ProfileID>
        <ProfileType>RETURN_POLICY</ProfileType>
        <ProfileName>rt</ProfileName>
        <ShortSummary>Return policy for rare books.</ShortSummary>
        <CategoryGroup>
          <Name>ALL</Name>
          <IsDefault>false</IsDefault>
        </CategoryGroup>
      </SupportedSellerProfile>
      <SupportedSellerProfile>
        <ProfileID>10</ProfileID>
        <ProfileType>RETURN_POLICY</ProfileType>
        <ProfileName>Py</ProfileName>
        <CategoryGroup>
          <Name>ALL</Name>
          <IsDefault>false</IsDefault>
        </CategoryGroup>
      </SupportedSellerProfile>
      <SupportedSellerProfile>
        <ProfileID>10</ProfileID>
        <ProfileType>RETURN_POLICY</ProfileType>
        <ProfileName>R0</ProfileName>
        <ShortSummary>Returns Accepted, Buyer, 30 Days, Money back or replacement (buyer's choice)</ShortSummary>
        <CategoryGroup>
          <Name>ALL</Name>
          <IsDefault>false</IsDefault>
        </CategoryGroup>
      </SupportedSellerProfile>
      <SupportedSellerProfile>
        <ProfileID>10</ProfileID>
        <ProfileType>RETURN_POLICY</ProfileType>
        <ProfileName>Rr</ProfileName>
        <ShortSummary>Returns Accepted, Buyer, 60 Days, Money back</ShortSummary>
        <CategoryGroup>
          <Name>ALL</Name>
          <IsDefault>true</IsDefault>
        </CategoryGroup>
      </SupportedSellerProfile>
      <SupportedSellerProfile>
        <ProfileID>30</ProfileID>
        <ProfileType>RETURN_POLICY</ProfileType>
        <ProfileName>Nd</ProfileName>
        <ShortSummary>No returns accepted</ShortSummary>
        <CategoryGroup>
          <Name>ALL</Name>
          <IsDefault>false</IsDefault>
        </CategoryGroup>
      </SupportedSellerProfile>
      <SupportedSellerProfile>
        <ProfileID>10</ProfileID>
        <ProfileType>SHIPPING</ProfileType>
        <ProfileName>C1</ProfileName>
        <ShortSummary>Domestic: Calculated: Standard services($0.00) Otherservices. International: Calculated: USPS Priority Mail International Small Flat Rate Box</ShortSummary>
        <CategoryGroup>
          <Name>ALL</Name>
          <IsDefault>false</IsDefault>
        </CategoryGroup>
      </SupportedSellerProfile>
      <SupportedSellerProfile>
        <ProfileID>10</ProfileID>
        <ProfileType>SHIPPING</ProfileType>
        <ProfileName>Tt</ProfileName>
        <ShortSummary>Shipping policy for tractors</ShortSummary>
        <CategoryGroup>
          <Name>ALL</Name>
          <IsDefault>false</IsDefault>
        </CategoryGroup>
      </SupportedSellerProfile>
      <SupportedSellerProfile>
        <ProfileID>10</ProfileID>
        <ProfileType>SHIPPING</ProfileType>
        <ProfileName>C1</ProfileName>
        <ShortSummary>Domestic: Calculated: Expedited services($7.25) Otherservices.</ShortSummary>
        <CategoryGroup>
          <Name>ALL</Name>
          <IsDefault>false</IsDefault>
        </CategoryGroup>
      </SupportedSellerProfile>
      <SupportedSellerProfile>
        <ProfileID>10</ProfileID>
        <ProfileType>SHIPPING</ProfileType>
        <ProfileName>Fd</ProfileName>
        <CategoryGroup>
          <Name>ALL</Name>
          <IsDefault>false</IsDefault>
        </CategoryGroup>
      </SupportedSellerProfile>
      <SupportedSellerProfile>
        <ProfileID>10</ProfileID>
        <ProfileType>SHIPPING</ProfileType>
        <ProfileName>C2</ProfileName>
        <ShortSummary>Domestic: Calculated: Expedited services.</ShortSummary>
        <CategoryGroup>
          <Name>ALL</Name>
          <IsDefault>false</IsDefault>
        </CategoryGroup>
      </SupportedSellerProfile>
      <SupportedSellerProfile>
        <ProfileID>10</ProfileID>
        <ProfileType>SHIPPING</ProfileType>
        <ProfileName>Cp/</ProfileName>
        <ShortSummary>Domestic: Calculated: Standard services($0.00) Otherservices. International: Calculated: USPS First Class Mail International / First Class Package International Service</ShortSummary>
        <CategoryGroup>
          <Name>ALL</Name>
          <IsDefault>false</IsDefault>
        </CategoryGroup>
      </SupportedSellerProfile>
    </SupportedSellerProfiles>
  </SellerProfilePreferences>
  <SellerReturnPreferences>
    <OptedIn>true</OptedIn>
  </SellerReturnPreferences>
  <OfferGlobalShippingProgramPreference>true</OfferGlobalShippingProgramPreference>
  <DispatchCutoffTimePreference>
    <CutoffTime>20:00:00.000Z</CutoffTime>
  </DispatchCutoffTimePreference>
  <GlobalShippingProgramListingPreference>true</GlobalShippingProgramListingPreference>
  <OverrideGSPServiceWithIntlServicePreference>true</OverrideGSPServiceWithIntlServicePreference>
  <PickupDropoffSellerPreference>false</PickupDropoffSellerPreference>
  <OutOfStockControlPreference>true</OutOfStockControlPreference>
  <eBayPLUSPreference>
    <Country>DE</Country>
    <OptInStatus>false</OptInStatus>
  </eBayPLUSPreference>
</GetUserPreferencesResponse>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetUserPreferencesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <ShowBidderNoticePreferences>boolean</ShowBidderNoticePreferences>
  <ShowCombinedPaymentPreferences>boolean</ShowCombinedPaymentPreferences>
  <ShowDispatchCutoffTimePreferences>boolean</ShowDispatchCutoffTimePreferences>
  <ShoweBayPLUSPreference>boolean</ShoweBayPLUSPreference>
  <ShowEmailShipmentTrackingNumberPreference>boolean</ShowEmailShipmentTrackingNumberPreference>
  <ShowEndOfAuctionEmailPreferences>boolean</ShowEndOfAuctionEmailPreferences>
  <ShowGlobalShippingProgramListingPreference>boolean</ShowGlobalShippingProgramListingPreference>
  <ShowGlobalShippingProgramPreference>boolean</ShowGlobalShippingProgramPreference>
  <ShowOutOfStockControlPreference>boolean</ShowOutOfStockControlPreference>
  <ShowOverrideGSPServiceWithIntlServicePreference>boolean</ShowOverrideGSPServiceWithIntlServicePreference>
  <ShowPickupDropoffPreferences>boolean</ShowPickupDropoffPreferences>
  <ShowPurchaseReminderEmailPreferences>boolean</ShowPurchaseReminderEmailPreferences>
  <ShowRequiredShipPhoneNumberPreference>boolean</ShowRequiredShipPhoneNumberPreference>
  <ShowSellerExcludeShipToLocationPreference>boolean</ShowSellerExcludeShipToLocationPreference>
  <ShowSellerFavoriteItemPreferences>boolean</ShowSellerFavoriteItemPreferences>
  <ShowSellerPaymentPreferences>boolean</ShowSellerPaymentPreferences>
  <ShowSellerProfilePreferences>boolean</ShowSellerProfilePreferences>
  <ShowSellerReturnPreferences>boolean</ShowSellerReturnPreferences>
  <ShowUnpaidItemAssistanceExclusionList>boolean</ShowUnpaidItemAssistanceExclusionList>
  <ShowUnpaidItemAssistancePreference>boolean</ShowUnpaidItemAssistancePreference>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetUserPreferencesRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetUserPreferencesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <BidderNoticePreferences>
    <UnsuccessfulBidderNoticeIncludeMyItems>boolean</UnsuccessfulBidderNoticeIncludeMyItems>
  </BidderNoticePreferences>
  <CombinedPaymentPreferences>
    <CombinedPaymentOption></CombinedPaymentOption>
  </CombinedPaymentPreferences>
  <DispatchCutoffTimePreference>
    <CutoffTime>time</CutoffTime>
  </DispatchCutoffTimePreference>
  <eBayPLUSPreference>
    <Country></Country>
    <ListingPreference>boolean</ListingPreference>
    <OptInStatus>boolean</OptInStatus>
  </eBayPLUSPreference>
  <!-- ... more eBayPLUSPreference nodes allowed here ... -->
  <EmailShipmentTrackingNumberPreference>boolean</EmailShipmentTrackingNumberPreference>
  <EndOfAuctionEmailPreferences>
    <EmailCustomized>boolean</EmailCustomized>
    <LogoCustomized>boolean</LogoCustomized>
    <LogoType></LogoType>
    <LogoURL>anyURI</LogoURL>
    <TemplateText>string</TemplateText>
    <TextCustomized>boolean</TextCustomized>
  </EndOfAuctionEmailPreferences>
  <GlobalShippingProgramListingPreference>boolean</GlobalShippingProgramListingPreference>
  <OfferGlobalShippingProgramPreference>boolean</OfferGlobalShippingProgramPreference>
  <OutOfStockControlPreference>boolean</OutOfStockControlPreference>
  <OverrideGSPServiceWithIntlServicePreference>boolean</OverrideGSPServiceWithIntlServicePreference>
  <PickupDropoffSellerPreference>boolean</PickupDropoffSellerPreference>
  <PurchaseReminderEmailPreferences>
    <PurchaseReminderEmailPreferences>boolean</PurchaseReminderEmailPreferences>
  </PurchaseReminderEmailPreferences>
  <RequiredShipPhoneNumberPreference>boolean</RequiredShipPhoneNumberPreference>
  <SellerExcludeShipToLocationPreferences>
    <ExcludeShipToLocation>string</ExcludeShipToLocation>
    <!-- ... more ExcludeShipToLocation values allowed here ... -->
  </SellerExcludeShipToLocationPreferences>
  <SellerFavoriteItemPreferences>
    <FavoriteItemID></FavoriteItemID>
    <!-- ... more FavoriteItemID values allowed here ... -->
    <ListingType></ListingType>
    <MaxPrice currencyID="CurrencyCodeType">
    </MaxPrice>
    <MinPrice currencyID="CurrencyCodeType">
    </MinPrice>
    <SearchKeywords>string</SearchKeywords>
    <SearchSortOrder></SearchSortOrder>
    <StoreCategoryID>long</StoreCategoryID>
  </SellerFavoriteItemPreferences>
  <SellerPaymentPreferences>
    <AlwaysUseThisPaymentAddress>boolean</AlwaysUseThisPaymentAddress>
    <DefaultPayPalEmailAddress>string</DefaultPayPalEmailAddress>
    <DisplayPayNowButton></DisplayPayNowButton>
    <FedExRateOption></FedExRateOption>
    <PayPalAlwaysOn>boolean</PayPalAlwaysOn>
    <PayPalPreferred>boolean</PayPalPreferred>
    <SellerPaymentAddress>
      <Country></Country>
    </SellerPaymentAddress>
    <UPSRateOption></UPSRateOption>
    <USPSRateOption></USPSRateOption>
  </SellerPaymentPreferences>
  <SellerProfilePreferences>
    <SellerProfileOptedIn>boolean</SellerProfileOptedIn>
    <SupportedSellerProfiles>
      <SupportedSellerProfile>
        <CategoryGroup>
          <IsDefault>boolean</IsDefault>
          <Name>string</Name>
        </CategoryGroup>
        <ProfileID>long</ProfileID>
        <ProfileName>string</ProfileName>
        <ProfileType>string</ProfileType>
        <ShortSummary>string</ShortSummary>
      </SupportedSellerProfile>
      <!-- ... more SupportedSellerProfile nodes allowed here ... -->
    </SupportedSellerProfiles>
  </SellerProfilePreferences>
  <SellerReturnPreferences>
    <OptedIn>boolean</OptedIn>
  </SellerReturnPreferences>
  <UnpaidItemAssistancePreferences>
    <AutoRelist>boolean</AutoRelist>
    <DelayBeforeOpeningDispute>int</DelayBeforeOpeningDispute>
    <ExcludedUser>string</ExcludedUser>
    <!-- ... more ExcludedUser values allowed here ... -->
    <OptInStatus>boolean</OptInStatus>
    <RemoveAllExcludedUsers>boolean</RemoveAllExcludedUsers>
  </UnpaidItemAssistancePreferences>
  <!-- Standard Output Fields -->
  <Ack></Ack>
  <Build>string</Build>
  <CorrelationID>string</CorrelationID>
  <Errors>
    <ErrorClassification></ErrorClassification>
    <ErrorCode>token</ErrorCode>
    <ErrorParameters ParamID="string">
      <Value>string</Value>
    </ErrorParameters>
    <!-- ... more ErrorParameters nodes allowed here ... -->
    <LongMessage>string</LongMessage>
    <SeverityCode></SeverityCode>
    <ShortMessage>string</ShortMessage>
  </Errors>
  <!-- ... more Errors nodes allowed here ... -->
  <HardExpirationWarning>string</HardExpirationWarning>
  <Timestamp>dateTime</Timestamp>
  <Version>string</Version>
</GetUserPreferencesResponse>
```
