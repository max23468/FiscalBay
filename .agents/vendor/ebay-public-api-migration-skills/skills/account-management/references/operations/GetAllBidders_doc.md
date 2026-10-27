# GetAllBidders - Traditional API (SOAP)

> **Call Name:** GetAllBidders
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

Use this call to retrieve bidding activity for a list of eBay users that have bid on an active or recently-ended auction listing.

**Purpose:**
Use this call to retrieve bidding activity for a list of eBay users that have bid on an active or recently-ended auction listing.

**Use Cases:**
- Retrieves bidder information for an auction listing.

**Important Notes:**
- Retrieves bidder information for an auction listing.

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
X-EBAY-API-CALL-NAME: GetAllBidders
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
<GetAllBiddersRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <CallMode></CallMode>
  <IncludeBiddingSummary>boolean</IncludeBiddingSummary>
  <ItemID></ItemID>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <OutputSelector>string</OutputSelector>
  <!-- ... more OutputSelector values allowed here ... -->
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetAllBiddersRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| ItemID | ItemIDType | Yes | This is the unique identifier of the auction listing for which bidders are being retrieved. This auction listing can be active or recently ended. However, to retrieve bidders for an active auction listing, the only CallMode enumeration value that can be used is ViewAll . |

#### Optional Fields

| Field Path | Type | Default | Description | Constraints |
|------------|------|---------|-------------|-------------|
| CallMode | GetAllBiddersModeCodeType | Not specified in source | The enumeration value that is passed into this field will control the set of bidders that will be retrieved in the response. To retrieve bidders from a recently-ended auction listing, any of the three values can be used. To retrieve bidders for an active auction listing, only the ViewAll enumeration value can be used. These values are discussed in GetAllBiddersModeCodeType . | Not specified in source |

#### Conditional Fields

| Field Path | Type | Condition | Description |
|------------|------|-----------|-------------|
| IncludeBiddingSummary | boolean | Conditionally | The user must include this field and set its value to true if the user wishes to retrieve the BiddingSummary container for each bidder. The BiddingSummary container consists of more detailed bidding information on each bidder. |

## Response Structure

### XML Schema

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetAllBiddersResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <BidArray>
    <Offer>
      <Action></Action>
      <ConvertedPrice currencyID="CurrencyCodeType">
      </ConvertedPrice>
      <Currency></Currency>
      <HighestBid currencyID="CurrencyCodeType">
      </HighestBid>
      <MaxBid currencyID="CurrencyCodeType">
      </MaxBid>
      <MyMaxBid currencyID="CurrencyCodeType">
      </MyMaxBid>
      <Quantity>int</Quantity>
      <SecondChanceEnabled>boolean</SecondChanceEnabled>
      <SiteCurrency></SiteCurrency>
      <TimeBid>dateTime</TimeBid>
      <User>
        <AboutMePage>boolean</AboutMePage>
        <BiddingSummary>
          <BidActivityWithSeller>int</BidActivityWithSeller>
          <BidRetractions>int</BidRetractions>
          <BidsToUniqueCategories>int</BidsToUniqueCategories>
          <BidsToUniqueSellers>int</BidsToUniqueSellers>
          <ItemBidDetails>
            <BidCount>int</BidCount>
            <CategoryID>string</CategoryID>
            <ItemID></ItemID>
            <LastBidTime>dateTime</LastBidTime>
            <SellerID></SellerID>
          </ItemBidDetails>
          <!-- ... more ItemBidDetails nodes allowed here ... -->
          <SummaryDays>int</SummaryDays>
          <TotalBids>int</TotalBids>
        </BiddingSummary>
        <BuyerInfo>
          <ShippingAddress>
            <Country></Country>
            <PostalCode>string</PostalCode>
          </ShippingAddress>
        </BuyerInfo>
        <eBayGoodStanding>boolean</eBayGoodStanding>
        <Email>string</Email>
        <FeedbackPrivate>boolean</FeedbackPrivate>
        <FeedbackRatingStar></FeedbackRatingStar>
        <FeedbackScore>int</FeedbackScore>
        <IDVerified>boolean</IDVerified>
        <NewUser>boolean</NewUser>
        <PositiveFeedbackPercent>float</PositiveFeedbackPercent>
        <RegistrationDate>dateTime</RegistrationDate>
        <Site></Site>
        <Status></Status>
        <UserAnonymized>boolean</UserAnonymized>
        <UserID></UserID>
        <UserIDChanged>boolean</UserIDChanged>
        <UserIDLastChanged>dateTime</UserIDLastChanged>
        <VATStatus></VATStatus>
      </User>
    </Offer>
    <!-- ... more Offer nodes allowed here ... -->
  </BidArray>
  <HighBidder></HighBidder>
  <HighestBid currencyID="CurrencyCodeType">
  </HighestBid>
  <ListingStatus></ListingStatus>
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
</GetAllBiddersResponse>
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
| BidArray | OfferArrayType | Always | This container consists of an array of bids made on the specified auction listing. Each OfferType object represents the data for one bid. |
| HighBidder | UserIDType | Always | The eBay user ID for the user with the winning bid (if auction has ended) or current highest bid (if auction is still active). The seller should take note of or save this User ID as this user may be a a Second Chance Offer candidate. |
| HighestBid | AmountType | Always | This is the dollar amount of the winning bid (if auction has ended) or dollar amount of the current highest bid (if auction is still active). |
| ListingStatus | ListingStatusCodeType | Always | This enumeration value indicates the listing status of the specified listing. |

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

### GetAllBiddersRequestType

**Description:** This is the base request type for the GetAllBidders call, which is used to retrieve bidders from an active or recently-ended auction listing.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| ItemID | ItemIDType | [0..1] | This is the unique identifier of the auction listing for which bidders are being retrieved. This auction listing can be active or recently ended. However, to retrieve bidders for an active auction listing, the only CallMode enumeration value that can be used is ViewAll . |
| CallMode | GetAllBiddersModeCodeType | [0..1] | The enumeration value that is passed into this field will control the set of bidders that will be retrieved in the response. To retrieve bidders from a recently-ended auction listing, any of the three values can be used. To retrieve bidders for an active auction listing, only the ViewAll enumeration value can be used. These values are discussed in GetAllBiddersModeCodeType . |
| IncludeBiddingSummary | boolean | [0..1] | The user must include this field and set its value to true if the user wishes to retrieve the BiddingSummary container for each bidder. The BiddingSummary container consists of more detailed bidding information on each bidder. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<GetAllBiddersRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <CallMode></CallMode>
  <IncludeBiddingSummary>boolean</IncludeBiddingSummary>
  <ItemID></ItemID>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <OutputSelector>string</OutputSelector>
  <!-- ... more OutputSelector values allowed here ... -->
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetAllBiddersRequest>
```

### GetAllBiddersResponseType

**Description:** Includes detailed bidding data for the auction listing that was specified in the request. Unless the listing is private, the actual eBay user IDs of all bidders are returned if the listing's seller makes this API call. If a bidder makes this API call, only that bidder's eBay user ID is returned, and the rest of the bidder's user IDs are anonymized.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| BidArray | OfferArrayType | [0..1] | This container consists of an array of bids made on the specified auction listing. Each OfferType object represents the data for one bid. |
| HighBidder | UserIDType | [0..1] | The eBay user ID for the user with the winning bid (if auction has ended) or current highest bid (if auction is still active). The seller should take note of or save this User ID as this user may be a a Second Chance Offer candidate. |
| HighestBid | AmountType | [0..1] | This is the dollar amount of the winning bid (if auction has ended) or dollar amount of the current highest bid (if auction is still active). |
| ListingStatus | ListingStatusCodeType | [0..1] | This enumeration value indicates the listing status of the specified listing. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<GetAllBiddersResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <BidArray>
    <Offer>
      <Action></Action>
      <ConvertedPrice currencyID="CurrencyCodeType">
      </ConvertedPrice>
      <Currency></Currency>
      <HighestBid currencyID="CurrencyCodeType">
      </HighestBid>
      <MaxBid currencyID="CurrencyCodeType">
      </MaxBid>
      <MyMaxBid currencyID="CurrencyCodeType">
      </MyMaxBid>
      <Quantity>int</Quantity>
      <SecondChanceEnabled>boolean</SecondChanceEnabled>
      <SiteCurrency></SiteCurrency>
      <TimeBid>dateTime</TimeBid>
      <User>
        <AboutMePage>boolean</AboutMePage>
        <BiddingSummary>
          <BidActivityWithSeller>int</BidActivityWithSeller>
          <BidRetractions>int</BidRetractions>
          <BidsToUniqueCategories>int</BidsToUniqueCategories>
          <BidsToUniqueSellers>int</BidsToUniqueSellers>
          <ItemBidDetails>
            <BidCount>int</BidCount>
            <CategoryID>string</CategoryID>
            <ItemID></ItemID>
            <LastBidTime>dateTime</LastBidTime>
            <SellerID></SellerID>
          </ItemBidDetails>
          <!-- ... more ItemBidDetails nodes allowed here ... -->
          <SummaryDays>int</SummaryDays>
          <TotalBids>int</TotalBids>
        </BiddingSummary>
        <BuyerInfo>
          <ShippingAddress>
            <Country></Country>
            <PostalCode>string</PostalCode>
          </ShippingAddress>
        </BuyerInfo>
        <eBayGoodStanding>boolean</eBayGoodStanding>
        <Email>string</Email>
        <FeedbackPrivate>boolean</FeedbackPrivate>
        <FeedbackRatingStar></FeedbackRatingStar>
        <FeedbackScore>int</FeedbackScore>
        <IDVerified>boolean</IDVerified>
        <NewUser>boolean</NewUser>
        <PositiveFeedbackPercent>float</PositiveFeedbackPercent>
        <RegistrationDate>dateTime</RegistrationDate>
        <Site></Site>
        <Status></Status>
        <UserAnonymized>boolean</UserAnonymized>
        <UserID></UserID>
        <UserIDChanged>boolean</UserIDChanged>
        <UserIDLastChanged>dateTime</UserIDLastChanged>
        <VATStatus></VATStatus>
      </User>
    </Offer>
    <!-- ... more Offer nodes allowed here ... -->
  </BidArray>
  <HighBidder></HighBidder>
  <HighestBid currencyID="CurrencyCodeType">
  </HighestBid>
  <ListingStatus></ListingStatus>
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
</GetAllBiddersResponse>
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

1. Only auction listings with bidder activity are eligible.

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
| GetAllBidders | Auction API itemBiddingActivity | Query |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_getallbidders_html.jsonl`; `.trace_artifacts/extract_wsdl_getallbidders.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
