# SetUserPreferences - Traditional API (SOAP)

> **Call Name:** SetUserPreferences
> **API Type:** SOAP XML traditional API
> **API Version:** Not specified in source
> **Service:** Traditional

---

## Metadata

| Property | Value |
|----------|-------|
| **Call Type** | Core |
| **Deprecated** | No |
| **Replacement** | See Migration Path section |
| **Rate Limit** | Not specified in source |
| **Supported Sites** | Not specified in source |

---

## Description

Use this call to set the authenticated user's preferences to those specified in the request. SetUserPreferences takes as input the data for the user preferences you want to set.

**Purpose:**
Use this call to set the authenticated user's preferences to those specified in the request. SetUserPreferences takes as input the data for the user preferences you want to set. If the call is successful, it returns only the standard data indicating that the call succeeded.

**Use Cases:**
- Sets user preference values in the traditional Traditional model.

**Important Notes:**
- Sets user preference values in the traditional Traditional model.

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
X-EBAY-API-COMPATIBILITY-LEVEL: Not specified in source
X-EBAY-API-CALL-NAME: SetUserPreferences
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

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| None identified | - | No | No always-required request fields were explicitly labeled in the extracted source. |

#### Optional Fields

| Field Path | Type | Default | Description | Constraints |
|------------|------|---------|-------------|-------------|
| BidderNoticePreferences | BidderNoticePreferencesType | Not specified in source | This container is included if the seller wishes to receive contact information for unsuccessful bidders. This preference is only applicable for auction listings. | Not specified in source |
| CombinedPaymentPreferences | CombinedPaymentPreferencesType | Not specified in source | This container is included if the seller wishes to set the preference for allowing Combined Invoice orders for cases where the buyer has multiple unpaid order line items from the same seller. | Not specified in source |
| SellerPaymentPreferences | SellerPaymentPreferencesType | Not specified in source | This container is included if the seller wishes to set various payment preferences. One or more preferences may be set or modified under this container. Payment preferences specified in a SetUserPreferences call override the settings in My eBay payment preferences. | Not specified in source |
| SellerFavoriteItemPreferences | SellerFavoriteItemPreferencesType | Not specified in source | This container is included if the seller wishes to set preferences for displaying items on a buyer's Favorite Sellers' Items page or Favorite Sellers' Items digest. One or more preferences may be set or modified under this container. | Not specified in source |
| EndOfAuctionEmailPreferences | EndOfAuctionEmailPreferencesType | Not specified in source | This container is included if the seller wishes to set preferences for the end-of-auction email sent to the winning bidder. These preferences allow the seller to customize the Email that is sent to buyer at the end of the auction. One or more preferences may be set or modified under this container. These preferences are only applicable for auction listings. | Not specified in source |
| EmailShipmentTrackingNumberPreference | boolean | Not specified in source | This field is included and set to true if the seller wishes to email the shipment's tracking number to the buyer. | Not specified in source |
| RequiredShipPhoneNumberPreference | boolean | Not specified in source | This field is included and set to true if the seller wishes to require the buyer to provide a shipping phone number upon checkout. Some shipping carriers require the receiver's phone number. | Not specified in source |
| UnpaidItemAssistancePreferences | UnpaidItemAssistancePreferencesType | Not specified in source | This container is included if the seller wishes to set or modify Unpaid Item preferences. The Unpaid Item preferences automatically opens an Unpaid Item case on the behalf of the seller if the buyer has not paid for the order after a specified number of days. One or more preferences may be set or modified under this container. | Not specified in source |
| PurchaseReminderEmailPreferences | PurchaseReminderEmailPreferencesType | Not specified in source | This container is included if the seller wishes to set the preference for sending a purchase reminder email to buyers. | Not specified in source |
| DispatchCutoffTimePreference | DispatchCutoffTimePreferencesType | Not specified in source | This container is included if the seller wishes to set/modify the order cut off time for same-day shipping. If the seller specifies a value of 0 in Item.DispatchTimeMax to offer same day handling when listing an item, the seller's shipping time commitment depends on the order cut off time set for the listing site, as indicated by the DispatchCutoffTimePreference.CutoffTime field. Note: For sellers opted in to the feature that supports different order cut off times for each business day, this container cannot be used to change the order cut off for one or more business days. If this container is used, it will have no effect on any of the order cut off times configured for the seller. In order for the seller to change and/or confirm the actual order cutoff times for same-day handling, that seller should go to Shipping Preferences in My eBay. | Not specified in source |
| GlobalShippingProgramListingPreference | boolean | Not specified in source | If this flag is included and set to true , the seller's new listings will enable the Global Shipping Program by default. Note: This field is ignored for sellers who are not opted in to the Global Shipping Program (when GetUserPreferences returns OfferGlobalShippingProgramPreference with a value of false ). | Not specified in source |
| OverrideGSPserviceWithIntlService | boolean | Not specified in source | If this flag is included and set to true , and the seller specifies an international shipping service to a particular country for a given listing, the specified service will take precedence and be the listing's default international shipping option for buyers in that country, rather than the Global Shipping Program. The Global Shipping Program will still be the listing's default option for shipping to any Global Shipping-eligible country for which the seller does not specify an international shipping service. If this flag is set to false , the Global Shipping Program will be each Global Shipping-eligible listing's default option for shipping to any Global Shipping-eligible country, regardless of any international shipping service that the seller specifies for the listing. | Not specified in source |
| OutOfStockControlPreference | boolean | Not specified in source | If this flag is included and set to true , it enables the Out-of-Stock feature. A seller would use this feature to keep Fixed-Price GTC (Good 'Til Canceled) listings alive even when the "quantity available" value goes to 0 (zero). This is useful when waiting for additional stock and eliminates the need to end the listing and then recreating it when stock arrives. While the "quantity available" value is 0, the listing would be hidden from eBay search and if that item was specifically searched for with GetItem (or related call), the element HideFromSearch would be returned as 'true' and ReasonHideFromSearch would be returned as 'OutOfStock'. When stock is available, the seller can use the Revise calls to update the inventory of the item (through the Item.Quantity or Item.Variations.Variation.Quantity fields) and the listing would appear again. You can return the value of this flag using the GetUserPreferences call and setting the ShowOutOfStockControlPreference field to 'true'. IMPORTANT: When a listing using the Out-of-Stock feature has zero quantity, the seller has 90 days to add inventory without incurring a listing fee. Fees are changed at the end of each the billing cycle but are then refunded if the item is out-of-stock for an entire billing period. See Fees For a Listing With Zero Quantity for details. | Not specified in source |

#### Conditional Fields

| Field Path | Type | Condition | Description |
|------------|------|-----------|-------------|
| None | - | - | No conditional request fields were identified in the extracted source. |

## Response Structure

### XML Schema

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
| Not specified in source | Not specified in source | Not specified in source | Not specified in source |

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

### SetUserPreferencesRequestType

**Description:** This call allows an eBay user to set/modify numerous seller account preferences.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| BidderNoticePreferences | BidderNoticePreferencesType | [0..1] | This container is included if the seller wishes to receive contact information for unsuccessful bidders. This preference is only applicable for auction listings. |
| CombinedPaymentPreferences | CombinedPaymentPreferencesType | [0..1] | This container is included if the seller wishes to set the preference for allowing Combined Invoice orders for cases where the buyer has multiple unpaid order line items from the same seller. |
| SellerPaymentPreferences | SellerPaymentPreferencesType | [0..1] | This container is included if the seller wishes to set various payment preferences. One or more preferences may be set or modified under this container. Payment preferences specified in a SetUserPreferences call override the settings in My eBay payment preferences. |
| SellerFavoriteItemPreferences | SellerFavoriteItemPreferencesType | [0..1] | This container is included if the seller wishes to set preferences for displaying items on a buyer's Favorite Sellers' Items page or Favorite Sellers' Items digest. One or more preferences may be set or modified under this container. |
| EndOfAuctionEmailPreferences | EndOfAuctionEmailPreferencesType | [0..1] | This container is included if the seller wishes to set preferences for the end-of-auction email sent to the winning bidder. These preferences allow the seller to customize the Email that is sent to buyer at the end of the auction. One or more preferences may be set or modified under this container. These preferences are only applicable for auction listings. |
| EmailShipmentTrackingNumberPreference | boolean | [0..1] | This field is included and set to true if the seller wishes to email the shipment's tracking number to the buyer. |
| RequiredShipPhoneNumberPreference | boolean | [0..1] | This field is included and set to true if the seller wishes to require the buyer to provide a shipping phone number upon checkout. Some shipping carriers require the receiver's phone number. |
| UnpaidItemAssistancePreferences | UnpaidItemAssistancePreferencesType | [0..1] | This container is included if the seller wishes to set or modify Unpaid Item preferences. The Unpaid Item preferences automatically opens an Unpaid Item case on the behalf of the seller if the buyer has not paid for the order after a specified number of days. One or more preferences may be set or modified under this container. |
| PurchaseReminderEmailPreferences | PurchaseReminderEmailPreferencesType | [0..1] | This container is included if the seller wishes to set the preference for sending a purchase reminder email to buyers. |
| DispatchCutoffTimePreference | DispatchCutoffTimePreferencesType | [0..1] | This container is included if the seller wishes to set/modify the order cut off time for same-day shipping. If the seller specifies a value of 0 in Item.DispatchTimeMax to offer same day handling when listing an item, the seller's shipping time commitment depends on the order cut off time set for the listing site, as indicated by the DispatchCutoffTimePreference.CutoffTime field. Note: For sellers opted in to the feature that supports different order cut off times for each business day, this container cannot be used to change the order cut off for one or more business days. If this container is used, it will have no effect on any of the order cut off times configured for the seller. In order for the seller to change and/or confirm the actual order cutoff times for same-day handling, that seller should go to Shipping Preferences in My eBay. |
| GlobalShippingProgramListingPreference | boolean | [0..1] | If this flag is included and set to true , the seller's new listings will enable the Global Shipping Program by default. Note: This field is ignored for sellers who are not opted in to the Global Shipping Program (when GetUserPreferences returns OfferGlobalShippingProgramPreference with a value of false ). |
| OverrideGSPserviceWithIntlService | boolean | [0..1] | If this flag is included and set to true , and the seller specifies an international shipping service to a particular country for a given listing, the specified service will take precedence and be the listing's default international shipping option for buyers in that country, rather than the Global Shipping Program. The Global Shipping Program will still be the listing's default option for shipping to any Global Shipping-eligible country for which the seller does not specify an international shipping service. If this flag is set to false , the Global Shipping Program will be each Global Shipping-eligible listing's default option for shipping to any Global Shipping-eligible country, regardless of any international shipping service that the seller specifies for the listing. |
| OutOfStockControlPreference | boolean | [0..1] | If this flag is included and set to true , it enables the Out-of-Stock feature. A seller would use this feature to keep Fixed-Price GTC (Good 'Til Canceled) listings alive even when the "quantity available" value goes to 0 (zero). This is useful when waiting for additional stock and eliminates the need to end the listing and then recreating it when stock arrives. While the "quantity available" value is 0, the listing would be hidden from eBay search and if that item was specifically searched for with GetItem (or related call), the element HideFromSearch would be returned as 'true' and ReasonHideFromSearch would be returned as 'OutOfStock'. When stock is available, the seller can use the Revise calls to update the inventory of the item (through the Item.Quantity or Item.Variations.Variation.Quantity fields) and the listing would appear again. You can return the value of this flag using the GetUserPreferences call and setting the ShowOutOfStockControlPreference field to 'true'. IMPORTANT: When a listing using the Out-of-Stock feature has zero quantity, the seller has 90 days to add inventory without incurring a listing fee. Fees are changed at the end of each the billing cycle but are then refunded if the item is out-of-stock for an entire billing period. See Fees For a Listing With Zero Quantity for details. |

**XML Example:**
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

### SetUserPreferencesResponseType

**Description:** Not specified in source

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| Not specified in source | Not specified in source | Not specified in source | Not specified in source |

**XML Example:**
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

1. Preference changes are scoped to the authenticated account.

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

1. Review the request and response XML samples from source before using this operation in production.
2. Prefer the mapped modern API in the Migration Path section when planning new integrations.
3. Keep generated documentation aligned with extracted WSDL metadata and avoid filling gaps with assumptions.

---

## Migration Path

### New API Equivalent

| SOAP Operation | New API | Type |
|----------------|---------|------|
| SetUserPreferences | Account API v2 setUserPreferences | PATCH |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_setuserpreferences_html.jsonl`; `.trace_artifacts/extract_wsdl_setuserpreferences.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
