# GetUserPreferences - Traditional API (SOAP)

> **Call Name:** GetUserPreferences
> **API Type:** SOAP XML traditional API
> **API Version:** 1131
> **Service:** Traditional

---

## Metadata

| Property | Value |
|----------|-------|
| **Call Type** | Core |
| **Deprecated** | No |
| **Replacement** | GetUserPreferences method of Account API v2 |
| **Rate Limit** | Not specified in source |
| **Supported Sites** | Not specified in source |

---

## Description

Use this call to retrieve user preferences for the authenticated caller.

**Purpose:**
Use this call to retrieve user preferences for the authenticated caller.

**Use Cases:**
- Retrieve the authenticated user's current seller and account preference values.
- Fetch only the preference groups needed by setting the corresponding request flags to true.
- Verify Sandbox preference settings after changing them with SetUserPreferences or My eBay.

**Important Notes:**
- A preference set is only returned when its corresponding request flag is included and set to true.
- Specify only the flags you need so that you minimize the amount of data returned.
- Many returned preferences can be modified with SetUserPreferences and are also visible in My eBay.

---

## Authentication

### Required Credentials

| Method | Description |
|--------|-------------|
| **eBayAuthToken** | Required in `RequesterCredentials` element |
| **App ID** | Not specified in source |
| **Dev ID** | Not specified in source |
| **Cert ID** | Not specified in source |

### HTTP Headers

```http
X-EBAY-API-SITEID: Not specified in source
X-EBAY-API-COMPATIBILITY-LEVEL: 1131
X-EBAY-API-CALL-NAME: GetUserPreferences
X-EBAY-API-DEV-NAME: Not specified in source
X-EBAY-API-APP-NAME: Not specified in source
X-EBAY-API-CERT-NAME: Not specified in source
Content-Type: text/xml; charset=utf-8
```

---

## Request Structure

### Endpoint

```
POST https://api.ebay.com/ws/api.dll
```

### XML Schema

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

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| None | - | No | No request fields are always required according to the extracted source; request booleans and filters are opt-in. |

#### Optional Fields

| Field Path | Type | Default | Description | Constraints |
|------------|------|---------|-------------|-------------|
| ShowBidderNoticePreferences | boolean | Not specified in source | If included and set to true , the seller's preference for receiving contact information for unsuccessful bidders is returned in the response. | Not specified in source |
| ShowCombinedPaymentPreferences | boolean | Not specified in source | If included and set to true , the seller's combined invoice preferences are returned in the response. These preferences are used to allow Combined Invoice orders. | Not specified in source |
| ShowSellerPaymentPreferences | boolean | Not specified in source | If included and set to true , the seller's payment preferences are returned in the response. | Not specified in source |
| ShowEndOfAuctionEmailPreferences | boolean | Not specified in source | If included and set to true , the seller's preferences for the end-of-auction email sent to the winning bidder is returned in the response. These preferences are only applicable for auction listings. | Not specified in source |
| ShowSellerFavoriteItemPreferences | boolean | Not specified in source | If included and set to true , the seller's favorite item preferences are returned in the response. | Not specified in source |
| ShowEmailShipmentTrackingNumberPreference | boolean | Not specified in source | If included and set to true , the seller's preference for sending an email to the buyer with the shipping tracking number is returned in the response. | Not specified in source |
| ShowRequiredShipPhoneNumberPreference | boolean | Not specified in source | If included and set to true , the seller's preference for requiring that the buyer supply a shipping phone number upon checkout is returned in the response. Some shipping carriers require the receiver's phone number. | Not specified in source |
| ShowSellerExcludeShipToLocationPreference | boolean | Not specified in source | If included and set to true , all of the seller's excluded shipping locations are returned in the response. The returned list mirrors the seller's current Exclude shipping locations list in My eBay's Shipping Preferences. An excluded shipping location in My eBay can be an entire geographical region (such as Middle East) or only an individual country (such as Iraq). Sellers can override these default settings for an individual listing by using the Item.ShippingDetails.ExcludeShipToLocation field in the AddItem family of calls. | Not specified in source |
| ShowPurchaseReminderEmailPreferences | boolean | Not specified in source | If included and set to true , the seller's preference for sending a purchase reminder email to buyers is returned in the response. | Not specified in source |
| ShowUnpaidItemAssistanceExclusionList | boolean | Not specified in source | If included and set to true , the list of eBay user IDs on the Unpaid Item preferences Excluded User list is returned through the UnpaidItemAssistancePreferences.ExcludedUser field in the response. For excluded users, an Unpaid Item is not automatically cancelled. The Excluded User list is managed through the SetUserPreferences call. Note: To return the list of buyers excluded from the Unpaid Item preferences, the ShowUnpaidItemAssistancePreference field must also be included and set to true in the request. | Not specified in source |
| ShowSellerProfilePreferences | boolean | Not specified in source | If this flag is included and set to true , the seller's Business Policies profile information is returned in the response. This information includes a flag that indicates whether or not the seller has opted into Business Policies, as well as Business Policies profiles (payment, shipping, and return policy) active on the seller's account. | Not specified in source |
| ShowSellerReturnPreferences | boolean | Not specified in source | If this flag is included and set to true , the SellerReturnPreferences container is returned in the response and indicates whether or not the seller has opted in to eBay Managed Returns. eBay Managed Returns are currently only available on the US, UK, DE, AU, and CA (English and French) sites. | Not specified in source |
| ShowGlobalShippingProgramPreference | boolean | Not specified in source | If this flag is included and set to true , the seller's preference for offering the Global Shipping Program to international buyers will be returned in OfferGlobalShippingProgramPreference . | Not specified in source |
| ShowDispatchCutoffTimePreferences | boolean | Not specified in source | If included and set to true , the seller's same-day handling cutoff time is returned in DispatchCutoffTimePreference.CutoffTime . Note: For sellers opted in to the feature that supports different order cutoff times for each business day, the order cutoff time returned in the response may not be accurate. In order for the seller to confirm the actual order cutoff time for same-day handling, that seller should view Shipping Preferences in My eBay. | Not specified in source |
| ShowGlobalShippingProgramListingPreference | boolean | Not specified in source | If included and set to true , the GlobalShippingProgramListingPreference field is returned. A returned value of true indicates that the seller's new listings will enable the Global Shipping Program by default. | Not specified in source |
| ShowOverrideGSPServiceWithIntlServicePreference | boolean | Not specified in source | If included and set to true , the OverrideGSPServiceWithIntlServicePreference field is returned. A returned value of true indicates that for the seller's listings that specify an international shipping service for any Global Shipping-eligible country, the specified service will take precedence and be the listing's default international shipping option for buyers in that country, rather than the Global Shipping Program. A returned value of false indicates that the Global Shipping program will take precedence over any international shipping service as the default option in Global Shipping-eligible listings for shipping to any Global Shipping-eligible country. | Not specified in source |
| ShowPickupDropoffPreferences | boolean | Not specified in source | If included and set to true , the PickupDropoffSellerPreference field is returned. A returned value of true indicates that the seller's new listings will by default be eligible to be evaluated for the Click and Collect feature. With the Click and Collect feature, a buyer can purchase certain items on eBay and collect them at a local store. Buyers are notified by eBay once their items are available. The Click and Collect feature is only available to large merchants on the eBay UK (site ID 3), eBay Australia (Site ID 15), and eBay Germany (Site ID 77) sites. Note: The Click and Collect program no longer allows sellers to set the Click and Collect preference at the listing level. | Not specified in source |
| ShowOutOfStockControlPreference | boolean | Not specified in source | If included and set to true , the seller's preferences related to the Out-of-Stock feature will be returned. This feature is set using the SetUserPreferences call. | Not specified in source |
| ShoweBayPLUSPreference | boolean | Not specified in source | To determine whether a seller can offer eBay Plus in qualified listings, include this field and set it to true . eBay Plus is a premium account option for buyers, which provides benefits such as fast free domestic shipping and free returns on selected items. Top Rated eBay sellers must opt in to eBay Plus, and can offer the program on a per-listing basis. The eBayPLUSPreference container is returned in the response with information about each country where the seller is eligible to offer eBay Plus on listings (one eBayPLUSPreference container per country), as well as the seller's opt-in status and listing preference for each country. Note: Currently, eBay Plus is available only to buyers in Germany and Australia. In Australia, the seller has no control/responsibility over setting the eBay Plus feature for a listing. Instead, eBay will evaluate/determine whether a listing is eligible for eBay Plus. | Not specified in source |

#### Conditional Fields

| Field Path | Type | Condition | Description |
|------------|------|-----------|-------------|
| ShowUnpaidItemAssistancePreference | boolean | Conditionally | If included and set to true , the seller's Unpaid Item preferences are returned in the response. The Unpaid Item preferences can be used to automatically cancel an unpaid order and relist the item on the behalf of the seller. Note: To return the list of buyers excluded from the Unpaid Item preferences, the ShowUnpaidItemAssistanceExclusionList field must also be included and set to true in the request. Excluded buyers can be viewed in the UnpaidItemAssistancePreferences.ExcludedUser field. |

## Response Structure

### XML Schema

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

### Response Fields

#### System Fields (Always Returned)

| Field Path | Type | Description |
|------------|------|-------------|
| Timestamp | dateTime | Not specified in source |
| Ack | AckCodeType | Not specified in source |
| Version | string | Not specified in source |
| Build | string | Not specified in source |
| CorrelationID | string | Not specified in source |

#### Data Fields

| Field Path | Type | Occurrence | Description |
|------------|------|------------|-------------|
| BidderNoticePreferences | BidderNoticePreferencesType | Conditionally | Container consisting of the seller's preference for receiving contact information for unsuccessful bidders. This container is returned when ShowBidderNoticePreferences is included and set to true in the request. This preference is only applicable for auction listings. |
| CombinedPaymentPreferences | CombinedPaymentPreferencesType | Conditionally | Container consisting of the seller's Combined Invoice preferences. These preferences are used to allow Combined Invoice orders. This container is returned when ShowCombinedPaymentPreferences is included and set to true in the request. |
| SellerPaymentPreferences | SellerPaymentPreferencesType | Conditionally | Container consisting of the seller's payment preferences. This container is returned when ShowSellerPaymentPreferences is included and set to true in the request. |
| SellerFavoriteItemPreferences | SellerFavoriteItemPreferencesType | Conditionally | Container consisting of the seller's preferences for displaying items on a buyer's Favorite Sellers' Items page or Favorite Sellers' Items digest. This container is returned when ShowSellerFavoriteItemPreferences is included and set to true in the request. |
| EndOfAuctionEmailPreferences | EndOfAuctionEmailPreferencesType | Conditionally | Container consisting of the seller's preferences for the end-of-auction email sent to the winning bidder. This container is returned when ShowEndOfAuctionEmailPreferences is included and set to true in the request. These preferences are only applicable for auction listings. |
| EmailShipmentTrackingNumberPreference | boolean | Conditionally | Container consisting of the seller's preference for sending an email to the buyer with the shipment tracking number. This container is returned when ShowEmailShipmentTrackingNumberPreference is included and set to true in the request. |
| RequiredShipPhoneNumberPreference | boolean | Conditionally | Container consisting of the seller's preference for requiring that the buyer supply a shipping phone number upon checkout. Some shipping carriers require the receiver's phone number. This container is returned when ShowRequiredShipPhoneNumberPreference is included and set to true in the request. |
| UnpaidItemAssistancePreferences | UnpaidItemAssistancePreferencesType | Conditionally | Container consisting of a seller's Unpaid Item preferences. The Unpaid Item preferences can be used to automatically cancel an unpaid order and relist the item on the behalf of the seller. This container is returned if ShowUnpaidItemAssistancePreference is included and set to true in the request. Note: To return the list of buyers excluded from the Unpaid Item preferences, the ShowUnpaidItemAssistanceExclusionList field must also be included and set to true in the request. Excluded buyers can be viewed in the UnpaidItemAssistancePreferences.ExcludedUser field. |
| SellerExcludeShipToLocationPreferences | SellerExcludeShipToLocationPreferencesType | Conditionally | Container consisting of a list of the seller's excluded shipping locations. The returned list mirrors the seller's current Exclude shipping locations list in My eBay's shipping preferences. An excluded shipping location in My eBay can be an entire geographical region (such as Middle East) or only an individual country (such as Iraq). Sellers can override these default settings for an individual listing by using the Item.ShippingDetails.ExcludeShipToLocation field in the Add/Revise/Relist calls. This container is returned if the ShowSellerExcludeShipToLocationPreference field is included and set to true in the request. |
| PurchaseReminderEmailPreferences | PurchaseReminderEmailPreferencesType | Conditionally | Container consisting of a seller's preference for sending a purchase reminder email to buyers. This container is returned if the ShowPurchaseReminderEmailPreferences field is included and set to true in the request. |
| SellerProfilePreferences | SellerProfilePreferencesType | Conditionally | Parent response container consisting of high-level information for all Business Policies defined for the user's account. This container is returned if ShowSellerProfilePreferences is included and set to true in the GetUserPreferences request (and one or more Business Policies are defined for the user's account). |
| SellerReturnPreferences | SellerReturnPreferencesType | Conditionally | Container consisting of the OptedIn flag that indicates whether or not the seller has opted in to eBay Managed Returns. This container is only returned if ShowSellerReturnPreferences is included and set to true in the request. |
| OfferGlobalShippingProgramPreference | boolean | Conditionally | This flag indicates whether the seller has opted in to the Global Shipping Program and is able to offer global shipping to international buyers. Returned when ShowGlobalShippingProgramPreference is included and set to true . |
| DispatchCutoffTimePreference | DispatchCutoffTimePreferencesType | Conditionally | Contains information about a seller's order cutoff time preferences for same-day shipping. If the seller specifies a value of '0' in Item.DispatchTimeMax to offer same-day handling when listing an item, the seller's shipping time commitment depends on the order cutoff time set for the listing site, as indicated by DispatchCutoffTimePreference.CutoffTime . Returned when ShowDispatchCutoffTimePreferences is included and set to true . Note: For sellers opted in to the feature that supports different order cutoff times for each business day, the order cutoff time returned in this container may not be accurate. In order for the seller to confirm the actual order cutoff time for same-day handling, that seller should view Shipping Preferences in My eBay. |
| GlobalShippingProgramListingPreference | boolean | Conditionally | If the ShowGlobalShippingProgramListingPreference field is submitted and set to true , this flag is returned. A returned value of true indicates that the seller's new listings will enable the Global Shipping Program by default. |
| OverrideGSPServiceWithIntlServicePreference | boolean | Conditionally | If the ShowOverrideGSPServiceWithIntlServicePreference field is submitted and set to true , this flag is returned. A returned value of true indicates that for the seller's listings that specify an international shipping service for any Global Shipping-eligible country, the specified service will take precedence and be the listing's default international shipping option for buyers in that country, rather than the Global Shipping Program. A returned value of false indicates that the Global Shipping program will take precedence over any international shipping service as the default option in Global Shipping-eligible listings for shipping to any Global Shipping-eligible country. |
| PickupDropoffSellerPreference | boolean | Conditionally | This boolean field is returned if the ShowPickupDropoffPreferences field is included and set to true in the request. This field will be returned as true if the seller has enabled the Click and Collect feature at the account level. All of the seller's new listings will by default be eligible to be evaluated for the Click and Collect feature. With the Click and Collect feature, a buyer can purchase certain items on eBay and collect them at a local store. Buyers are notified by eBay once their items are available. The Click and Collect feature is only available to large merchants on the eBay UK (site ID 3), eBay Australia (Site ID 15), and eBay Germany (Site ID 77) sites. Note: The Click and Collect program no longer allows sellers to set the Click and Collect preference at the listing level. |
| OutOfStockControlPreference | boolean | Conditionally | This boolean field is returned if the ShowOutOfStockControlPreference field is included and set to true in the request. This field will be returned as true if the seller has set SetUserPreferences.OutOfStockControlPreference to true . |
| eBayPLUSPreference | EBayPLUSPreferenceType | Conditionally | Contains information about each country where the seller is eligible to offer eBay Plus on listings (one eBayPLUSPreference container per country), as well as the seller's opt-in status and listing preference for each country. eBay Plus is a premium account option for buyers, which provides benefits such as fast free domestic shipping and free returns on selected items. Top Rated eBay sellers must opt in to eBay Plus to offer the program on a per-listing basis. Note: Currently, eBay Plus is available only to buyers in Germany and Australia. In Australia, the seller has no control/responsibility over setting the eBay Plus feature for a listing. Instead, eBay will evaluate/determine whether a listing is eligible for eBay Plus. |

#### Error Fields (On Failure)

| Field Path | Type | Description |
|------------|------|-------------|
| Errors.ShortMessage | string | Brief error description |
| Errors.LongMessage | string | Detailed error explanation |
| Errors.ErrorCode | int | Numeric error code |
| Errors.SeverityCode | ErrorSeverityCodeType | Error/Warning |
| Errors.ErrorClassification | ErrorClassificationCodeType | RequestError/SystemError |
| Errors.ErrorParameters | NameValueListType[] | Additional error context |

## Complex Types Reference

### GetUserPreferencesRequestType

**Description:** Retrieves the specified user preferences for the authenticated caller.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| ShowBidderNoticePreferences | boolean | [1..1] | If included and set to true , the seller's preference for receiving contact information for unsuccessful bidders is returned in the response. |
| ShowCombinedPaymentPreferences | boolean | [1..1] | If included and set to true , the seller's combined invoice preferences are returned in the response. These preferences are used to allow Combined Invoice orders. |
| ShowSellerPaymentPreferences | boolean | [1..1] | If included and set to true , the seller's payment preferences are returned in the response. |
| ShowEndOfAuctionEmailPreferences | boolean | [0..1] | If included and set to true , the seller's preferences for the end-of-auction email sent to the winning bidder is returned in the response. These preferences are only applicable for auction listings. |
| ShowSellerFavoriteItemPreferences | boolean | [0..1] | If included and set to true , the seller's favorite item preferences are returned in the response. |
| ShowEmailShipmentTrackingNumberPreference | boolean | [0..1] | If included and set to true , the seller's preference for sending an email to the buyer with the shipping tracking number is returned in the response. |
| ShowRequiredShipPhoneNumberPreference | boolean | [0..1] | If included and set to true , the seller's preference for requiring that the buyer supply a shipping phone number upon checkout is returned in the response. Some shipping carriers require the receiver's phone number. |
| ShowSellerExcludeShipToLocationPreference | boolean | [0..1] | If included and set to true , all of the seller's excluded shipping locations are returned in the response. The returned list mirrors the seller's current Exclude shipping locations list in My eBay's Shipping Preferences. An excluded shipping location in My eBay can be an entire geographical region (such as Middle East) or only an individual country (such as Iraq). Sellers can override these default settings for an individual listing by using the Item.ShippingDetails.ExcludeShipToLocation field in the AddItem family of calls. |
| ShowUnpaidItemAssistancePreference | boolean | [0..1] | If included and set to true , the seller's Unpaid Item preferences are returned in the response. The Unpaid Item preferences can be used to automatically cancel an unpaid order and relist the item on the behalf of the seller. Note: To return the list of buyers excluded from the Unpaid Item preferences, the ShowUnpaidItemAssistanceExclusionList field must also be included and set to true in the request. Excluded buyers can be viewed in the UnpaidItemAssistancePreferences.ExcludedUser field. |
| ShowPurchaseReminderEmailPreferences | boolean | [0..1] | If included and set to true , the seller's preference for sending a purchase reminder email to buyers is returned in the response. |
| ShowUnpaidItemAssistanceExclusionList | boolean | [0..1] | If included and set to true , the list of eBay user IDs on the Unpaid Item preferences Excluded User list is returned through the UnpaidItemAssistancePreferences.ExcludedUser field in the response. For excluded users, an Unpaid Item is not automatically cancelled. The Excluded User list is managed through the SetUserPreferences call. Note: To return the list of buyers excluded from the Unpaid Item preferences, the ShowUnpaidItemAssistancePreference field must also be included and set to true in the request. |
| ShowSellerProfilePreferences | boolean | [1..1] | If this flag is included and set to true , the seller's Business Policies profile information is returned in the response. This information includes a flag that indicates whether or not the seller has opted into Business Policies, as well as Business Policies profiles (payment, shipping, and return policy) active on the seller's account. |
| ShowSellerReturnPreferences | boolean | [0..1] | If this flag is included and set to true , the SellerReturnPreferences container is returned in the response and indicates whether or not the seller has opted in to eBay Managed Returns. eBay Managed Returns are currently only available on the US, UK, DE, AU, and CA (English and French) sites. |
| ShowGlobalShippingProgramPreference | boolean | [0..1] | If this flag is included and set to true , the seller's preference for offering the Global Shipping Program to international buyers will be returned in OfferGlobalShippingProgramPreference . |
| ShowDispatchCutoffTimePreferences | boolean | [0..1] | If included and set to true , the seller's same-day handling cutoff time is returned in DispatchCutoffTimePreference.CutoffTime . Note: For sellers opted in to the feature that supports different order cutoff times for each business day, the order cutoff time returned in the response may not be accurate. In order for the seller to confirm the actual order cutoff time for same-day handling, that seller should view Shipping Preferences in My eBay. |
| ShowGlobalShippingProgramListingPreference | boolean | [0..1] | If included and set to true , the GlobalShippingProgramListingPreference field is returned. A returned value of true indicates that the seller's new listings will enable the Global Shipping Program by default. |
| ShowOverrideGSPServiceWithIntlServicePreference | boolean | [0..1] | If included and set to true , the OverrideGSPServiceWithIntlServicePreference field is returned. A returned value of true indicates that for the seller's listings that specify an international shipping service for any Global Shipping-eligible country, the specified service will take precedence and be the listing's default international shipping option for buyers in that country, rather than the Global Shipping Program. A returned value of false indicates that the Global Shipping program will take precedence over any international shipping service as the default option in Global Shipping-eligible listings for shipping to any Global Shipping-eligible country. |
| ShowPickupDropoffPreferences | boolean | [0..1] | If included and set to true , the PickupDropoffSellerPreference field is returned. A returned value of true indicates that the seller's new listings will by default be eligible to be evaluated for the Click and Collect feature. With the Click and Collect feature, a buyer can purchase certain items on eBay and collect them at a local store. Buyers are notified by eBay once their items are available. The Click and Collect feature is only available to large merchants on the eBay UK (site ID 3), eBay Australia (Site ID 15), and eBay Germany (Site ID 77) sites. Note: The Click and Collect program no longer allows sellers to set the Click and Collect preference at the listing level. |
| ShowOutOfStockControlPreference | boolean | [0..1] | If included and set to true , the seller's preferences related to the Out-of-Stock feature will be returned. This feature is set using the SetUserPreferences call. |
| ShoweBayPLUSPreference | boolean | [0..1] | To determine whether a seller can offer eBay Plus in qualified listings, include this field and set it to true . eBay Plus is a premium account option for buyers, which provides benefits such as fast free domestic shipping and free returns on selected items. Top Rated eBay sellers must opt in to eBay Plus, and can offer the program on a per-listing basis. The eBayPLUSPreference container is returned in the response with information about each country where the seller is eligible to offer eBay Plus on listings (one eBayPLUSPreference container per country), as well as the seller's opt-in status and listing preference for each country. Note: Currently, eBay Plus is available only to buyers in Germany and Australia. In Australia, the seller has no control/responsibility over setting the eBay Plus feature for a listing. Instead, eBay will evaluate/determine whether a listing is eligible for eBay Plus. |

**XML Example:**
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

### GetUserPreferencesResponseType

**Description:** Contains some or all of the authenticated user's preferences. The preferences are grouped in sets and are returned according to the flag settings in the request.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| BidderNoticePreferences | BidderNoticePreferencesType | [0..1] | Container consisting of the seller's preference for receiving contact information for unsuccessful bidders. This container is returned when ShowBidderNoticePreferences is included and set to true in the request. This preference is only applicable for auction listings. |
| CombinedPaymentPreferences | CombinedPaymentPreferencesType | [0..1] | Container consisting of the seller's Combined Invoice preferences. These preferences are used to allow Combined Invoice orders. This container is returned when ShowCombinedPaymentPreferences is included and set to true in the request. |
| SellerPaymentPreferences | SellerPaymentPreferencesType | [0..1] | Container consisting of the seller's payment preferences. This container is returned when ShowSellerPaymentPreferences is included and set to true in the request. |
| SellerFavoriteItemPreferences | SellerFavoriteItemPreferencesType | [0..1] | Container consisting of the seller's preferences for displaying items on a buyer's Favorite Sellers' Items page or Favorite Sellers' Items digest. This container is returned when ShowSellerFavoriteItemPreferences is included and set to true in the request. |
| EndOfAuctionEmailPreferences | EndOfAuctionEmailPreferencesType | [0..1] | Container consisting of the seller's preferences for the end-of-auction email sent to the winning bidder. This container is returned when ShowEndOfAuctionEmailPreferences is included and set to true in the request. These preferences are only applicable for auction listings. |
| EmailShipmentTrackingNumberPreference | boolean | [0..1] | Container consisting of the seller's preference for sending an email to the buyer with the shipment tracking number. This container is returned when ShowEmailShipmentTrackingNumberPreference is included and set to true in the request. |
| RequiredShipPhoneNumberPreference | boolean | [0..1] | Container consisting of the seller's preference for requiring that the buyer supply a shipping phone number upon checkout. Some shipping carriers require the receiver's phone number. This container is returned when ShowRequiredShipPhoneNumberPreference is included and set to true in the request. |
| UnpaidItemAssistancePreferences | UnpaidItemAssistancePreferencesType | [0..1] | Container consisting of a seller's Unpaid Item preferences. The Unpaid Item preferences can be used to automatically cancel an unpaid order and relist the item on the behalf of the seller. This container is returned if ShowUnpaidItemAssistancePreference is included and set to true in the request. Note: To return the list of buyers excluded from the Unpaid Item preferences, the ShowUnpaidItemAssistanceExclusionList field must also be included and set to true in the request. Excluded buyers can be viewed in the UnpaidItemAssistancePreferences.ExcludedUser field. |
| SellerExcludeShipToLocationPreferences | SellerExcludeShipToLocationPreferencesType | [0..1] | Container consisting of a list of the seller's excluded shipping locations. The returned list mirrors the seller's current Exclude shipping locations list in My eBay's shipping preferences. An excluded shipping location in My eBay can be an entire geographical region (such as Middle East) or only an individual country (such as Iraq). Sellers can override these default settings for an individual listing by using the Item.ShippingDetails.ExcludeShipToLocation field in the Add/Revise/Relist calls. This container is returned if the ShowSellerExcludeShipToLocationPreference field is included and set to true in the request. |
| PurchaseReminderEmailPreferences | PurchaseReminderEmailPreferencesType | [0..1] | Container consisting of a seller's preference for sending a purchase reminder email to buyers. This container is returned if the ShowPurchaseReminderEmailPreferences field is included and set to true in the request. |
| SellerProfilePreferences | SellerProfilePreferencesType | [0..1] | Parent response container consisting of high-level information for all Business Policies defined for the user's account. This container is returned if ShowSellerProfilePreferences is included and set to true in the GetUserPreferences request (and one or more Business Policies are defined for the user's account). |
| SellerReturnPreferences | SellerReturnPreferencesType | [0..1] | Container consisting of the OptedIn flag that indicates whether or not the seller has opted in to eBay Managed Returns. This container is only returned if ShowSellerReturnPreferences is included and set to true in the request. |
| OfferGlobalShippingProgramPreference | boolean | [0..1] | This flag indicates whether the seller has opted in to the Global Shipping Program and is able to offer global shipping to international buyers. Returned when ShowGlobalShippingProgramPreference is included and set to true . |
| DispatchCutoffTimePreference | DispatchCutoffTimePreferencesType | [0..1] | Contains information about a seller's order cutoff time preferences for same-day shipping. If the seller specifies a value of '0' in Item.DispatchTimeMax to offer same-day handling when listing an item, the seller's shipping time commitment depends on the order cutoff time set for the listing site, as indicated by DispatchCutoffTimePreference.CutoffTime . Returned when ShowDispatchCutoffTimePreferences is included and set to true . Note: For sellers opted in to the feature that supports different order cutoff times for each business day, the order cutoff time returned in this container may not be accurate. In order for the seller to confirm the actual order cutoff time for same-day handling, that seller should view Shipping Preferences in My eBay. |
| GlobalShippingProgramListingPreference | boolean | [0..1] | If the ShowGlobalShippingProgramListingPreference field is submitted and set to true , this flag is returned. A returned value of true indicates that the seller's new listings will enable the Global Shipping Program by default. |
| OverrideGSPServiceWithIntlServicePreference | boolean | [0..1] | If the ShowOverrideGSPServiceWithIntlServicePreference field is submitted and set to true , this flag is returned. A returned value of true indicates that for the seller's listings that specify an international shipping service for any Global Shipping-eligible country, the specified service will take precedence and be the listing's default international shipping option for buyers in that country, rather than the Global Shipping Program. A returned value of false indicates that the Global Shipping program will take precedence over any international shipping service as the default option in Global Shipping-eligible listings for shipping to any Global Shipping-eligible country. |
| PickupDropoffSellerPreference | boolean | [0..1] | This boolean field is returned if the ShowPickupDropoffPreferences field is included and set to true in the request. This field will be returned as true if the seller has enabled the Click and Collect feature at the account level. All of the seller's new listings will by default be eligible to be evaluated for the Click and Collect feature. With the Click and Collect feature, a buyer can purchase certain items on eBay and collect them at a local store. Buyers are notified by eBay once their items are available. The Click and Collect feature is only available to large merchants on the eBay UK (site ID 3), eBay Australia (Site ID 15), and eBay Germany (Site ID 77) sites. Note: The Click and Collect program no longer allows sellers to set the Click and Collect preference at the listing level. |
| OutOfStockControlPreference | boolean | [0..1] | This boolean field is returned if the ShowOutOfStockControlPreference field is included and set to true in the request. This field will be returned as true if the seller has set SetUserPreferences.OutOfStockControlPreference to true . |
| eBayPLUSPreference | EBayPLUSPreferenceType | [0..unbounded] | Contains information about each country where the seller is eligible to offer eBay Plus on listings (one eBayPLUSPreference container per country), as well as the seller's opt-in status and listing preference for each country. eBay Plus is a premium account option for buyers, which provides benefits such as fast free domestic shipping and free returns on selected items. Top Rated eBay sellers must opt in to eBay Plus to offer the program on a per-listing basis. Note: Currently, eBay Plus is available only to buyers in Germany and Australia. In Australia, the seller has no control/responsibility over setting the eBay Plus feature for a listing. Instead, eBay will evaluate/determine whether a listing is eligible for eBay Plus. |

**XML Example:**
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

---

## Enumerations

Not specified in source

---

## Error Codes

| Error Code | Short Message | Description | Resolution |
|------------|---------------|-------------|------------|
| Source does not provide call-specific error codes | Source does not provide call-specific error codes | The extracted JSONL and WSDL content define the Errors container but do not include a call-specific error code table. | Use runtime Traditional API error payloads together with the documented request rules for troubleshooting. |

---

## Business Rules & Constraints

### Field-Level Constraints

#### Request fields
- **Max Length:** Not specified in source
- **Min Length:** Not specified in source
- **Pattern:** Not specified in source
- **Allowed Values:** Not specified in source unless noted in field descriptions
- **Dependencies:** See request-field descriptions and operation-level rules below

### Operation-Level Rules

1. **Flag-driven retrieval**
   - Description: Preference containers are only returned when the matching request boolean is included and set to true.
   - Applies when: Whenever GetUserPreferences is called.
   - Impact: Only explicitly requested preference sets are returned.

2. **Unpaid Item exclusion dependency**
   - Description: To return excluded buyers, ShowUnpaidItemAssistancePreference must also be true when ShowUnpaidItemAssistanceExclusionList is requested.
   - Applies when: When retrieving unpaid-item exclusion users.
   - Impact: Both flags must be sent together.

3. **Prefer narrow requests**
   - Description: The source recommends specifying only the flags you need.
   - Applies when: When designing preference retrieval workflows.
   - Impact: This reduces unnecessary payload volume.

### Revision Restrictions (If applicable)

| Condition | Allowed Changes | Prohibited Changes |
|-----------|-----------------|-------------------|
| Source does not provide a separate revision-restrictions table for this call | See operation-level rules and field descriptions | Not specified in source |

---

## Rate Limits & Throttling

| Metric | Limit | Window | Notes |
|--------|-------|--------|-------|
| API Calls | Not specified in source | Not specified in source | No long-window quota is explicitly provided in the extracted source. |
| Frequency | Not specified in source | Not specified in source | Not specified in source |

**Throttling Behavior:**
Not specified in source

---

## Best Practices

1. **Request only needed preference sets**
   - Send only the boolean flags for the preference groups your application actually needs.

2. **Verify after setting preferences**
   - In Sandbox, set preferences first and then call GetUserPreferences to confirm the stored values.

3. **Use SetUserPreferences for updates**
   - Treat GetUserPreferences as a read operation and SetUserPreferences as the write path for the same preference families.

4. **Inspect returned containers directly**
   - The source recommends reading the returned preference containers and storing or displaying the values as needed.

---

## Migration Path

### New API Equivalent

| SOAP Operation | New API | Type |
|----------------|---------|------|
| GetUserPreferences | Account API v2 GetUserPreferences | GET |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_getuserpreferences_html.jsonl`; `.trace_artifacts/extract_wsdl_getuserpreferences.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
