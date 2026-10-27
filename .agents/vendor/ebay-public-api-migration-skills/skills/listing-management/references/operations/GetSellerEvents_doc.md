# GetSellerEvents - Traditional API (SOAP)

> **Call Name:** GetSellerEvents
> **API Type:** SOAP XML traditional API
> **API Version:** 1131
> **Service:** Traditional

---

## Metadata

| Property | Value |
|----------|-------|
| **Call Type** | Core |
| **Deprecated** | No |
| **Replacement** | sellerListingSearch query of the Listing API |
| **Rate Limit** | Per seller user ID, no more than 1000 GetSellerEvents calls can be executed within any 15-second interval. |
| **Supported Sites** | Not specified in source |

---

## Description

Use this call to retrieve a list of the items on which a seller event has occurred. A seller event includes actions such as a revision to the item (e.g., a description change), a price change (through a bid), or the ending of an item's listing.

**Purpose:**
Use this call to retrieve a list of the items on which a seller event has occurred. A seller event includes actions such as a revision to the item (e.g., a description change), a price change (through a bid), or the ending of an item's listing. Short-duration call rate limit: To protect eBay's infrastructure and servers from being overloaded and/or destabilized, the GetSellerEvents call has a short-duration call rate limit to restrict bursts of very high traffic.

**Use Cases:**
- Retrieve items on which seller events have occurred.
- Track listing start, end, or modification activity within a time window.
- Poll for seller-side listing changes for the authenticated seller.

**Important Notes:**
- The call has a short-duration rate limit of 1000 calls per seller user ID within any 15-second interval.
- At least one date-range filter must be used in every request.
- Multiple date-range filter families may not be used in the same call.
- The source recommends using time windows shorter than 48 hours and including a two-minute overlap buffer between requests.

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
X-EBAY-API-CALL-NAME: GetSellerEvents
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
<GetSellerEventsRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <EndTimeFrom>dateTime</EndTimeFrom>
  <EndTimeTo>dateTime</EndTimeTo>
  <HideVariations>boolean</HideVariations>
  <IncludeVariationSpecifics>boolean</IncludeVariationSpecifics>
  <IncludeWatchCount>boolean</IncludeWatchCount>
  <ModTimeFrom>dateTime</ModTimeFrom>
  <ModTimeTo>dateTime</ModTimeTo>
  <NewItemFilter>boolean</NewItemFilter>
  <StartTimeFrom>dateTime</StartTimeFrom>
  <StartTimeTo>dateTime</StartTimeTo>
  <!-- Standard Input Fields -->
  <DetailLevel></DetailLevel>
  <!-- ... more DetailLevel values allowed here ... -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <OutputSelector>string</OutputSelector>
  <!-- ... more OutputSelector values allowed here ... -->
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetSellerEventsRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| None identified | - | No | No always-required request fields were explicitly labeled in the extracted source. |

#### Optional Fields

| Field Path | Type | Default | Description | Constraints |
|------------|------|---------|-------------|-------------|
| StartTimeTo | dateTime | Not specified in source | Describes the latest (most recent) date to use in a time range filter based on item start time. If you specify the corresponding From filter, but you do not include StartTimeTo , the StartTimeTo is set to the time you make the call. | Not specified in source |
| EndTimeTo | dateTime | Not specified in source | Describes the latest (most recent) date to use in a time range filter based on item end time. If you specify the corresponding From filter, but you do not include EndTimeTo , then EndTimeTo is set to the time you make the call. | Not specified in source |
| ModTimeTo | dateTime | Not specified in source | Describes the latest (most recent) date and time to use in a time range filter based on the time an item's record was modified. If you specify the corresponding From filter, but you do not include ModTimeTo , then ModTimeTo is set to the time you make the call. Include a 2-minute buffer between the current time and the ModTimeTo filter. | Not specified in source |
| NewItemFilter | boolean | Not specified in source | If true, response includes only items that have been modified within the ModTime range. If false, response includes all items. | Not specified in source |
| IncludeWatchCount | boolean | Not specified in source | The seller can include this field and set its value to true if that seller wants to see how many prospective bidders/buyers currently have an item added to their Watch Lists. The Watch count is returned in the WatchCount field for each item in the response. | Not specified in source |
| IncludeVariationSpecifics | boolean | Not specified in source | Specifies whether to force the response to include variation specifics for multiple-variation listings. If false (or not specified), eBay keeps the response as small as possible by not returning Variation.VariationSpecifics . It only returns Variation.SKU as an identifier (along with the variation price and other selling details). If the variation has no SKU, then Variation.VariationSpecifics is returned as the variation's unique identifier. If true, Variation.VariationSpecifics is returned. ( Variation.SKU is also returned, if the variation has a SKU.) This may be useful for applications that don't track variations by SKU. Ignored when HideVariations is set to true . Note: If the seller includes a large number of variations in many listings, using this flag may degrade the call's performance. Therefore, when you use this flag, you may need to reduce the total number of items you're requesting at once. For example, you may need to use shorter time ranges in the StartTimeFrom , EndTimeFrom , or ModTimeFrom filters. | Not specified in source |
| HideVariations | boolean | Not specified in source | Specifies whether to force the response to hide variation details for multiple-variation listings. If false (or not specified), eBay returns variation details (if any). In this case, the amount of detail can be controlled by using IncludeVariationSpecifics . If true, variation details are not returned (and IncludeVariationSpecifics has no effect). This may be useful for applications that use other calls, notifications, alerts, or reports to track price and quantity details. | Not specified in source |

#### Conditional Fields

| Field Path | Type | Condition | Description |
|------------|------|-----------|-------------|
| StartTimeFrom | dateTime | Conditionally | Describes the earliest (oldest) time to use in a time range filter based on item start time. Must be specified if StartTimeTo is specified. Either the StartTimeFrom , EndTimeFrom , or ModTimeFrom filter must be specified. If you do not specify the corresponding To filter, it is set to the time you make the call. For better results, the time period you use should be less than 48 hours. If 3000 or more items are found, use a smaller time range. Include a 2-minute, overlapping buffer between requests. For example, if StartTimeTo was 6:58 in a prior request, the current request should use 6:56 in StartTimeFrom (e.g., use ranges like 5:56-6:58, 6:56-7:58, 7:56-8:58). |
| EndTimeFrom | dateTime | Conditionally | Describes the earliest (oldest) date to use in a time range filter based on item end time. Must be specified if EndTimeTo is specified. Either the StartTimeFrom , EndTimeFrom , or ModTimeFrom filter must be specified. If you do not specify the corresponding To filter, it is set to the time you make the call. For better results, the time range you use should be less than 48 hours. If 3000 or more items are found, use a smaller time range. Include a 2-minute, overlapping buffer between requests. For example, if EndTimeTo was 6:58 in a prior request, the current request should use 6:56 in EndTimeFrom (e.g., use ranges like 5:56-6:58, 6:56-7:58, 7:56-8:58). |
| ModTimeFrom | dateTime | Conditionally | Describes the earliest (oldest) date to use in a time range filter based on item modification time. Must be specified if ModTimeTo is specified. Either the StartTimeFrom , EndTimeFrom , or ModTimeFrom filter must be specified. If you do not specify the corresponding To filter, it is set to the time you make the call. Include a 2-minute, overlapping buffer between requests. For example, if ModTimeTo was 6:58 in a prior request, the current request should use 6:56 in ModTimeFrom (e.g., use ranges like 5:56-6:58, 6:56-7:58, 7:56-8:58). For better results, the time range you use should be less than 48 hours. If 3000 or more items are found, use a smaller time range. If an unexpected item is returned (including an old item or an unchanged active item), please ignore the item. Although a maintenance process may have triggered a change in the modification time, item characteristics are unchanged. |

## Response Structure

### XML Schema

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetSellerEventsResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <ItemArray>
    <Item>
      <BestOfferDetails>
        <BestOfferCount>int</BestOfferCount>
        <BestOfferEnabled>boolean</BestOfferEnabled>
      </BestOfferDetails>
      <BuyItNowPrice currencyID="CurrencyCodeType">
      </BuyItNowPrice>
      <Currency></Currency>
      <eBayPlus>boolean</eBayPlus>
      <eBayPlusEligible>boolean</eBayPlusEligible>
      <HitCount>long</HitCount>
      <IsSecureDescription>boolean</IsSecureDescription>
      <ItemID></ItemID>
      <ListingDetails>
        <EndTime>dateTime</EndTime>
        <StartTime>dateTime</StartTime>
      </ListingDetails>
      <ListingType></ListingType>
      <Quantity>int</Quantity>
      <SellerProfiles>
        <SellerPaymentProfile>
          <PaymentProfileID>long</PaymentProfileID>
          <PaymentProfileName>string</PaymentProfileName>
        </SellerPaymentProfile>
        <SellerReturnProfile>
          <ReturnProfileID>long</ReturnProfileID>
          <ReturnProfileName>string</ReturnProfileName>
        </SellerReturnProfile>
        <SellerShippingProfile>
          <ShippingProfileID>long</ShippingProfileID>
          <ShippingProfileName>string</ShippingProfileName>
        </SellerShippingProfile>
      </SellerProfiles>
      <SellerVacationNote>string</SellerVacationNote>
      <SellingStatus>
        <BidCount>int</BidCount>
        <CurrentPrice currencyID="CurrencyCodeType">
        </CurrentPrice>
        <HighBidder>
          <Email>string</Email>
          <FeedbackScore>int</FeedbackScore>
          <UserAnonymized>boolean</UserAnonymized>
          <UserID></UserID>
        </HighBidder>
        <ListingStatus></ListingStatus>
        <QuantitySold>int</QuantitySold>
      </SellingStatus>
      <Site></Site>
      <Title>string</Title>
      <Variations>
        <Variation>
          <Quantity>int</Quantity>
          <SellingStatus>
            <BidCount>int</BidCount>
            <CurrentPrice currencyID="CurrencyCodeType">
            </CurrentPrice>
            <HighBidder>
              <Email>string</Email>
              <FeedbackScore>int</FeedbackScore>
              <UserAnonymized>boolean</UserAnonymized>
              <UserID></UserID>
            </HighBidder>
            <ListingStatus></ListingStatus>
            <QuantitySold>int</QuantitySold>
          </SellingStatus>
          <SKU></SKU>
          <StartPrice currencyID="CurrencyCodeType">
          </StartPrice>
          <VariationProductListingDetails>
            <EAN>string</EAN>
            <ISBN>string</ISBN>
            <UPC>string</UPC>
          </VariationProductListingDetails>
          <VariationSpecifics>
            <NameValueList>
              <Name>string</Name>
              <Value>string</Value>
              <!-- ... more Value values allowed here ... -->
            </NameValueList>
            <!-- ... more NameValueList nodes allowed here ... -->
          </VariationSpecifics>
          <!-- ... more VariationSpecifics nodes allowed here ... -->
        </Variation>
        <!-- ... more Variation nodes allowed here ... -->
      </Variations>
      <WatchCount>long</WatchCount>
    </Item>
    <!-- ... more Item nodes allowed here ... -->
  </ItemArray>
  <TimeTo>dateTime</TimeTo>
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
</GetSellerEventsResponse>
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
| TimeTo | dateTime | Always | Indicates the latest (most recent) date for any date-based filtering specified as input. Specifically, this field contains the value you specified in the StartTimeFrom , EndTimeFrom , or ModTimeFrom filter, if you used a time filter in the request. If no time filter was specified, TimeTo returns the current time. |
| ItemArray | ItemArrayType | Always | Collection of items whose last modified time matches the filters specified in the request. Returns empty if no items were modified within the time range of the request. If 1 to 2999 items are returned, then the results are complete. If 3000 or more items are returned, it usually means additional items exist within the time range you requested, but they were not all returned. To retrieve complete results, use a smaller time range in the request so that fewer than 3000 are returned per response. |

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

### GetSellerEventsRequestType

**Description:** This call is used by a seller to retrieve changes to their own listings that have occurred within the last 48 hours, including price changes, available quantity, and other revisions to listing. One of the available date range filters must be used with this call.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| StartTimeFrom | dateTime | [0..1] | Describes the earliest (oldest) time to use in a time range filter based on item start time. Must be specified if StartTimeTo is specified. Either the StartTimeFrom , EndTimeFrom , or ModTimeFrom filter must be specified. If you do not specify the corresponding To filter, it is set to the time you make the call. For better results, the time period you use should be less than 48 hours. If 3000 or more items are found, use a smaller time range. Include a 2-minute, overlapping buffer between requests. For example, if StartTimeTo was 6:58 in a prior request, the current request should use 6:56 in StartTimeFrom (e.g., use ranges like 5:56-6:58, 6:56-7:58, 7:56-8:58). |
| StartTimeTo | dateTime | [0..1] | Describes the latest (most recent) date to use in a time range filter based on item start time. If you specify the corresponding From filter, but you do not include StartTimeTo , the StartTimeTo is set to the time you make the call. |
| EndTimeFrom | dateTime | [0..1] | Describes the earliest (oldest) date to use in a time range filter based on item end time. Must be specified if EndTimeTo is specified. Either the StartTimeFrom , EndTimeFrom , or ModTimeFrom filter must be specified. If you do not specify the corresponding To filter, it is set to the time you make the call. For better results, the time range you use should be less than 48 hours. If 3000 or more items are found, use a smaller time range. Include a 2-minute, overlapping buffer between requests. For example, if EndTimeTo was 6:58 in a prior request, the current request should use 6:56 in EndTimeFrom (e.g., use ranges like 5:56-6:58, 6:56-7:58, 7:56-8:58). |
| EndTimeTo | dateTime | [0..1] | Describes the latest (most recent) date to use in a time range filter based on item end time. If you specify the corresponding From filter, but you do not include EndTimeTo , then EndTimeTo is set to the time you make the call. |
| ModTimeFrom | dateTime | [0..1] | Describes the earliest (oldest) date to use in a time range filter based on item modification time. Must be specified if ModTimeTo is specified. Either the StartTimeFrom , EndTimeFrom , or ModTimeFrom filter must be specified. If you do not specify the corresponding To filter, it is set to the time you make the call. Include a 2-minute, overlapping buffer between requests. For example, if ModTimeTo was 6:58 in a prior request, the current request should use 6:56 in ModTimeFrom (e.g., use ranges like 5:56-6:58, 6:56-7:58, 7:56-8:58). For better results, the time range you use should be less than 48 hours. If 3000 or more items are found, use a smaller time range. If an unexpected item is returned (including an old item or an unchanged active item), please ignore the item. Although a maintenance process may have triggered a change in the modification time, item characteristics are unchanged. |
| ModTimeTo | dateTime | [0..1] | Describes the latest (most recent) date and time to use in a time range filter based on the time an item's record was modified. If you specify the corresponding From filter, but you do not include ModTimeTo , then ModTimeTo is set to the time you make the call. Include a 2-minute buffer between the current time and the ModTimeTo filter. |
| NewItemFilter | boolean | [0..1] | If true, response includes only items that have been modified within the ModTime range. If false, response includes all items. |
| IncludeWatchCount | boolean | [0..1] | The seller can include this field and set its value to true if that seller wants to see how many prospective bidders/buyers currently have an item added to their Watch Lists. The Watch count is returned in the WatchCount field for each item in the response. |
| IncludeVariationSpecifics | boolean | [0..1] | Specifies whether to force the response to include variation specifics for multiple-variation listings. If false (or not specified), eBay keeps the response as small as possible by not returning Variation.VariationSpecifics . It only returns Variation.SKU as an identifier (along with the variation price and other selling details). If the variation has no SKU, then Variation.VariationSpecifics is returned as the variation's unique identifier. If true, Variation.VariationSpecifics is returned. ( Variation.SKU is also returned, if the variation has a SKU.) This may be useful for applications that don't track variations by SKU. Ignored when HideVariations is set to true . Note: If the seller includes a large number of variations in many listings, using this flag may degrade the call's performance. Therefore, when you use this flag, you may need to reduce the total number of items you're requesting at once. For example, you may need to use shorter time ranges in the StartTimeFrom , EndTimeFrom , or ModTimeFrom filters. |
| HideVariations | boolean | [0..1] | Specifies whether to force the response to hide variation details for multiple-variation listings. If false (or not specified), eBay returns variation details (if any). In this case, the amount of detail can be controlled by using IncludeVariationSpecifics . If true, variation details are not returned (and IncludeVariationSpecifics has no effect). This may be useful for applications that use other calls, notifications, alerts, or reports to track price and quantity details. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<GetSellerEventsRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <EndTimeFrom>dateTime</EndTimeFrom>
  <EndTimeTo>dateTime</EndTimeTo>
  <HideVariations>boolean</HideVariations>
  <IncludeVariationSpecifics>boolean</IncludeVariationSpecifics>
  <IncludeWatchCount>boolean</IncludeWatchCount>
  <ModTimeFrom>dateTime</ModTimeFrom>
  <ModTimeTo>dateTime</ModTimeTo>
  <NewItemFilter>boolean</NewItemFilter>
  <StartTimeFrom>dateTime</StartTimeFrom>
  <StartTimeTo>dateTime</StartTimeTo>
  <!-- Standard Input Fields -->
  <DetailLevel></DetailLevel>
  <!-- ... more DetailLevel values allowed here ... -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <OutputSelector>string</OutputSelector>
  <!-- ... more OutputSelector values allowed here ... -->
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetSellerEventsRequest>
```

### GetSellerEventsResponseType

**Description:** Returns the items in an ItemArrayType object for the a seller events that have occurred and that meet any filters specified. There can be zero, one, or multiple ItemType objects. Each ItemType object contains the detail data for one item listing.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| TimeTo | dateTime | [0..1] | Indicates the latest (most recent) date for any date-based filtering specified as input. Specifically, this field contains the value you specified in the StartTimeFrom , EndTimeFrom , or ModTimeFrom filter, if you used a time filter in the request. If no time filter was specified, TimeTo returns the current time. |
| ItemArray | ItemArrayType | [0..1] | Collection of items whose last modified time matches the filters specified in the request. Returns empty if no items were modified within the time range of the request. If 1 to 2999 items are returned, then the results are complete. If 3000 or more items are returned, it usually means additional items exist within the time range you requested, but they were not all returned. To retrieve complete results, use a smaller time range in the request so that fewer than 3000 are returned per response. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<GetSellerEventsResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <ItemArray>
    <Item>
      <BestOfferDetails>
        <BestOfferCount>int</BestOfferCount>
        <BestOfferEnabled>boolean</BestOfferEnabled>
      </BestOfferDetails>
      <BuyItNowPrice currencyID="CurrencyCodeType">
      </BuyItNowPrice>
      <Currency></Currency>
      <eBayPlus>boolean</eBayPlus>
      <eBayPlusEligible>boolean</eBayPlusEligible>
      <HitCount>long</HitCount>
      <IsSecureDescription>boolean</IsSecureDescription>
      <ItemID></ItemID>
      <ListingDetails>
        <EndTime>dateTime</EndTime>
        <StartTime>dateTime</StartTime>
      </ListingDetails>
      <ListingType></ListingType>
      <Quantity>int</Quantity>
      <SellerProfiles>
        <SellerPaymentProfile>
          <PaymentProfileID>long</PaymentProfileID>
          <PaymentProfileName>string</PaymentProfileName>
        </SellerPaymentProfile>
        <SellerReturnProfile>
          <ReturnProfileID>long</ReturnProfileID>
          <ReturnProfileName>string</ReturnProfileName>
        </SellerReturnProfile>
        <SellerShippingProfile>
          <ShippingProfileID>long</ShippingProfileID>
          <ShippingProfileName>string</ShippingProfileName>
        </SellerShippingProfile>
      </SellerProfiles>
      <SellerVacationNote>string</SellerVacationNote>
      <SellingStatus>
        <BidCount>int</BidCount>
        <CurrentPrice currencyID="CurrencyCodeType">
        </CurrentPrice>
        <HighBidder>
          <Email>string</Email>
          <FeedbackScore>int</FeedbackScore>
          <UserAnonymized>boolean</UserAnonymized>
          <UserID></UserID>
        </HighBidder>
        <ListingStatus></ListingStatus>
        <QuantitySold>int</QuantitySold>
      </SellingStatus>
      <Site></Site>
      <Title>string</Title>
      <Variations>
        <Variation>
          <Quantity>int</Quantity>
          <SellingStatus>
            <BidCount>int</BidCount>
            <CurrentPrice currencyID="CurrencyCodeType">
            </CurrentPrice>
            <HighBidder>
              <Email>string</Email>
              <FeedbackScore>int</FeedbackScore>
              <UserAnonymized>boolean</UserAnonymized>
              <UserID></UserID>
            </HighBidder>
            <ListingStatus></ListingStatus>
            <QuantitySold>int</QuantitySold>
          </SellingStatus>
          <SKU></SKU>
          <StartPrice currencyID="CurrencyCodeType">
          </StartPrice>
          <VariationProductListingDetails>
            <EAN>string</EAN>
            <ISBN>string</ISBN>
            <UPC>string</UPC>
          </VariationProductListingDetails>
          <VariationSpecifics>
            <NameValueList>
              <Name>string</Name>
              <Value>string</Value>
              <!-- ... more Value values allowed here ... -->
            </NameValueList>
            <!-- ... more NameValueList nodes allowed here ... -->
          </VariationSpecifics>
          <!-- ... more VariationSpecifics nodes allowed here ... -->
        </Variation>
        <!-- ... more Variation nodes allowed here ... -->
      </Variations>
      <WatchCount>long</WatchCount>
    </Item>
    <!-- ... more Item nodes allowed here ... -->
  </ItemArray>
  <TimeTo>dateTime</TimeTo>
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
</GetSellerEventsResponse>
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

1. **At least one date-range family is required**
   - Description: One of StartTimeFrom, EndTimeFrom, or ModTimeFrom must be specified.
   - Applies when: For every GetSellerEvents request.
   - Impact: Requests without a date-range filter are invalid.

2. **Do not mix date-range families**
   - Description: Multiple date-range filter families may not be used in the same call.
   - Applies when: When choosing start-time, end-time, or modification-time filters.
   - Impact: Pick one date-range strategy per request.

3. **Use windows shorter than 48 hours**
   - Description: The source recommends using time periods shorter than 48 hours for better results.
   - Applies when: When polling seller events.
   - Impact: Smaller windows reduce large result sets and missed changes.

4. **Overlap requests by two minutes**
   - Description: The source recommends a two-minute overlap between consecutive requests.
   - Applies when: When polling repeatedly over time.
   - Impact: This helps avoid missing changes around request boundaries.

### Revision Restrictions (If applicable)

| Condition | Allowed Changes | Prohibited Changes |
|-----------|-----------------|-------------------|
| Source does not provide a separate revision-restrictions table for this call | See operation-level rules and field descriptions | Not specified in source |

---

## Rate Limits & Throttling

| Metric | Limit | Window | Notes |
|--------|-------|--------|-------|
| API Calls | Not specified in source | Not specified in source | No long-window quota is explicitly provided in the extracted source. |
| Frequency | Per seller user ID, no more than 1000 GetSellerEvents calls can be executed within any 15-second interval. | Not specified in source | Per seller user ID, no more than 1000 GetSellerEvents calls can be executed within any 15-second interval. |

**Throttling Behavior:**
Per seller user ID, no more than 1000 GetSellerEvents calls can be executed within any 15-second interval.

---

## Best Practices

1. **Poll with overlap**
   - Use a two-minute overlap between request windows to avoid missing changes.

2. **Keep windows small**
   - Use date windows shorter than 48 hours and shrink them further if you approach large result sets.

3. **Choose one event-time axis**
   - Use start-time, end-time, or modification-time filters intentionally rather than mixing them.

4. **Respect burst throttling**
   - High-frequency polling must account for the documented 1000-calls-per-15-seconds limit.

---

## Migration Path

### New API Equivalent

| SOAP Operation | New API | Type |
|----------------|---------|------|
| GetSellerEvents | sellerListingSearch query of the Listing API | Query |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_getsellerevents_html.jsonl`; `.trace_artifacts/extract_wsdl_getsellerevents.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
