# SetUserPreferences — Example

## Request Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<SetUserPreferencesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>A3</eBayAuthToken>
  </RequesterCredentials>
  <WarningLevel>High</WarningLevel>
  <GlobalShippingProgramListingPreference>true</GlobalShippingProgramListingPreference>
  <OutOfStockControlPreference>true</OutOfStockControlPreference>
</SetUserPreferencesRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<SetUserPreferencesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <BidderNoticePreferences>
    <UnsuccessfulBidderNoticeIncludeMyItems>boolean</UnsuccessfulBidderNoticeIncludeMyItems>
  </BidderNoticePreferences>
  <CombinedPaymentPreferences>
    <CombinedPaymentOption></CombinedPaymentOption>
  </CombinedPaymentPreferences>
  <DispatchCutoffTimePreference>
    <CutoffTime>time</CutoffTime>
  </DispatchCutoffTimePreference>
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
  <OutOfStockControlPreference>boolean</OutOfStockControlPreference>
  <OverrideGSPserviceWithIntlService>boolean</OverrideGSPserviceWithIntlService>
  <PurchaseReminderEmailPreferences>
    <PurchaseReminderEmailPreferences>boolean</PurchaseReminderEmailPreferences>
  </PurchaseReminderEmailPreferences>
  <RequiredShipPhoneNumberPreference>boolean</RequiredShipPhoneNumberPreference>
  <SellerFavoriteItemPreferences>
    <FavoriteItemID></FavoriteItemID>
    <!-- ... more FavoriteItemID values allowed here ... -->
    <ListingType></ListingType>
    <MaxPrice></MaxPrice>
    <MinPrice></MinPrice>
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
  <UnpaidItemAssistancePreferences>
    <AutoRelist>boolean</AutoRelist>
    <DelayBeforeOpeningDispute>int</DelayBeforeOpeningDispute>
    <ExcludedUser>string</ExcludedUser>
    <!-- ... more ExcludedUser values allowed here ... -->
    <OptInStatus>boolean</OptInStatus>
    <RemoveAllExcludedUsers>boolean</RemoveAllExcludedUsers>
  </UnpaidItemAssistancePreferences>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</SetUserPreferencesRequest>
```

## Response Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<SetUserPreferencesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- (No call-specific Output fields) -->
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
</SetUserPreferencesResponse>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<SetUserPreferencesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <BidderNoticePreferences>
    <UnsuccessfulBidderNoticeIncludeMyItems>boolean</UnsuccessfulBidderNoticeIncludeMyItems>
  </BidderNoticePreferences>
  <CombinedPaymentPreferences>
    <CombinedPaymentOption></CombinedPaymentOption>
  </CombinedPaymentPreferences>
  <DispatchCutoffTimePreference>
    <CutoffTime>time</CutoffTime>
  </DispatchCutoffTimePreference>
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
  <OutOfStockControlPreference>boolean</OutOfStockControlPreference>
  <OverrideGSPserviceWithIntlService>boolean</OverrideGSPserviceWithIntlService>
  <PurchaseReminderEmailPreferences>
    <PurchaseReminderEmailPreferences>boolean</PurchaseReminderEmailPreferences>
  </PurchaseReminderEmailPreferences>
  <RequiredShipPhoneNumberPreference>boolean</RequiredShipPhoneNumberPreference>
  <SellerFavoriteItemPreferences>
    <FavoriteItemID></FavoriteItemID>
    <!-- ... more FavoriteItemID values allowed here ... -->
    <ListingType></ListingType>
    <MaxPrice></MaxPrice>
    <MinPrice></MinPrice>
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
  <UnpaidItemAssistancePreferences>
    <AutoRelist>boolean</AutoRelist>
    <DelayBeforeOpeningDispute>int</DelayBeforeOpeningDispute>
    <ExcludedUser>string</ExcludedUser>
    <!-- ... more ExcludedUser values allowed here ... -->
    <OptInStatus>boolean</OptInStatus>
    <RemoveAllExcludedUsers>boolean</RemoveAllExcludedUsers>
  </UnpaidItemAssistancePreferences>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</SetUserPreferencesRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<SetUserPreferencesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- (No call-specific Output fields) -->
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
</SetUserPreferencesResponse>
```
