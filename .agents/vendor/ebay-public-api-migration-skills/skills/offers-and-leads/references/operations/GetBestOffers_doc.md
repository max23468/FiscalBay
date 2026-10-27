# GetBestOffers - Traditional API (SOAP)

> **Call Name:** GetBestOffers
> **API Type:** SOAP XML traditional API
> **API Version:** 1125
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

Use this call to retrieve details of Best Offers for items being sold by or being bid on by the user. Offers are selected for return based on the BestOfferStatus filter ( Active by default).

**Purpose:**
Use this call to retrieve details of Best Offers for items being sold by or being bid on by the user. Offers are selected for return based on the BestOfferStatus filter ( Active by default). See Enabling Best Offer for details.

**Use Cases:**
- Retrieves Best Offer activity.

**Important Notes:**
- Retrieves Best Offer activity.

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
X-EBAY-API-COMPATIBILITY-LEVEL: 1125
X-EBAY-API-CALL-NAME: GetBestOffers
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
<GetBestOffersRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <BestOfferID></BestOfferID>
  <BestOfferStatus></BestOfferStatus>
  <ItemID></ItemID>
  <Pagination>
    <EntriesPerPage>int</EntriesPerPage>
    <PageNumber>int</PageNumber>
  </Pagination>
  <!-- Standard Input Fields -->
  <DetailLevel></DetailLevel>
  <!-- ... more DetailLevel values allowed here ... -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <OutputSelector>string</OutputSelector>
  <!-- ... more OutputSelector values allowed here ... -->
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetBestOffersRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| None identified | - | No | No always-required request fields were explicitly labeled in the extracted source. |

#### Optional Fields

| Field Path | Type | Default | Description | Constraints |
|------------|------|---------|-------------|-------------|
| ItemID | ItemIDType | Not specified in source | The unique identifier of an eBay listing. If an ItemID is used by itself in the call request, all Best Offers in all states are retrieved for this listing. However, the seller can also combine ItemID and a BestOfferStatus value if that seller only wants to see Best Offers in a specific state. If a BestOfferID field is included in the call request, any ItemID value will be ignored since eBay will only search for and return the Best Offer identified in the BestOfferID field. | Not specified in source |
| BestOfferID | BestOfferIDType | Not specified in source | The unique identifier of a Best Offer. An identifier for a Best Offer is automatically created by eBay once a prospective buyer makes a Best Offer on a Best Offer-enabled listing. If a BestOfferID value is supplied in the call request, any ItemID or BestOfferStatus values will be ignored. Only the Best Offer identified by the BestOfferID value will be returned. | Not specified in source |
| BestOfferStatus | BestOfferStatusCodeType | Not specified in source | This field can be used if the seller wants to retrieve Best Offers in a specific state. The typical use case for this field is when the seller wants to retrieve Best Offers in all states for a specific listing. In fact, the All value can only be used if an ItemID value is also supplied in the call request. If a BestOfferID field is included in the call request, any BestOfferStatus value will be ignored since eBay will only search for and return the Best Offer identified in the BestOfferID field. | Not specified in source |
| Pagination | PaginationType | Not specified in source | This container can be used if the seller is expecting that the GetBestOffers call will retrieve a large number of results, so that seller wishes to view just a subset (one page of multiple pages) of those results at a time. See this container's child fields for more information on how pagination is used. | Not specified in source |

#### Conditional Fields

| Field Path | Type | Condition | Description |
|------------|------|-----------|-------------|
| None | - | - | No conditional request fields were identified in the extracted source. |

## Response Structure

### XML Schema

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetBestOffersResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <BestOfferArray>
    <BestOffer>
      <BestOfferCodeType></BestOfferCodeType>
      <BestOfferID></BestOfferID>
      <Buyer>
        <Email>string</Email>
        <FeedbackScore>int</FeedbackScore>
        <RegistrationDate>dateTime</RegistrationDate>
        <ShippingAddress></ShippingAddress>
        <UserID></UserID>
      </Buyer>
      <BuyerMessage>string</BuyerMessage>
      <ExpirationTime>dateTime</ExpirationTime>
      <Price currencyID="CurrencyCodeType">
      </Price>
      <Quantity>int</Quantity>
      <SellerMessage>string</SellerMessage>
      <Status></Status>
    </BestOffer>
    <!-- ... more BestOffer nodes allowed here ... -->
  </BestOfferArray>
  <Item>
    <BuyItNowPrice currencyID="CurrencyCodeType">
    </BuyItNowPrice>
    <Currency></Currency>
    <ItemID></ItemID>
    <ListingDetails>
      <EndTime>dateTime</EndTime>
    </ListingDetails>
  </Item>
  <ItemBestOffersArray>
    <ItemBestOffers>
      <BestOfferArray>
        <BestOffer>
          <BestOfferCodeType></BestOfferCodeType>
          <BestOfferID></BestOfferID>
          <Buyer>
            <Email>string</Email>
            <FeedbackScore>int</FeedbackScore>
            <RegistrationDate>dateTime</RegistrationDate>
            <ShippingAddress></ShippingAddress>
            <UserID></UserID>
          </Buyer>
          <BuyerMessage>string</BuyerMessage>
          <ExpirationTime>dateTime</ExpirationTime>
          <Price currencyID="CurrencyCodeType">
          </Price>
          <Quantity>int</Quantity>
          <SellerMessage>string</SellerMessage>
          <Status></Status>
        </BestOffer>
        <!-- ... more BestOffer nodes allowed here ... -->
      </BestOfferArray>
      <Item>
        <BuyItNowPrice currencyID="CurrencyCodeType">
        </BuyItNowPrice>
        <Currency></Currency>
        <ItemID></ItemID>
        <ListingDetails>
          <EndTime>dateTime</EndTime>
        </ListingDetails>
      </Item>
      <Role></Role>
    </ItemBestOffers>
    <!-- ... more ItemBestOffers nodes allowed here ... -->
  </ItemBestOffersArray>
  <PageNumber>int</PageNumber>
  <PaginationResult>
    <TotalNumberOfEntries>int</TotalNumberOfEntries>
    <TotalNumberOfPages>int</TotalNumberOfPages>
  </PaginationResult>
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
</GetBestOffersResponse>
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
| BestOfferArray | BestOfferArrayType | Conditionally | All Best Offers for the item according to the filter or Best Offer ID (or both) used in the input. The buyer and seller messages are returned only if the detail level is defined. Includes the buyer and seller message only if the ReturnAll detail level is used. Only returned if Best Offers have been made. |
| Item | ItemType | Conditionally | This container consists of several details about the listing for which a Best Offer has been made, including the Item ID, the current price of the item (not the Best Offer price), and the time that the listing is scheduled to end. |
| ItemBestOffersArray | ItemBestOffersArrayType | Conditionally | A collection of details about the Best Offers received for a specific item. Empty if there are no Best Offers. |
| PageNumber | int | Conditionally | This integer value indicates the current page number of Best Offers that is currently being shown. This value will be the same value passed into the Pagination.PageNumber field in the request. |
| PaginationResult | PaginationResultType | Conditionally | Provides information about the data returned, including the number of pages and the number of entries. |

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

### GetBestOffersRequestType

**Description:** This is the base request type of the GetBestOffers call. Depending on the input parameters that are used, this call can be used by a seller to retrieve all active Best Offers, all Best Offers on a specific listing, a specific Best Offer for a specific listing, or Best Offers in a specific state. Note: The Best Offer feature is now available for auction listings on the following sites: US, Canada, UK, Germany, Australia, France, Italy, and Spain. However, sellers must choose between offering Best Offer or Buy It Now on an auction listing, as both features cannot be enabled on the same auction listing.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| ItemID | ItemIDType | [0..1] | The unique identifier of an eBay listing. If an ItemID is used by itself in the call request, all Best Offers in all states are retrieved for this listing. However, the seller can also combine ItemID and a BestOfferStatus value if that seller only wants to see Best Offers in a specific state. If a BestOfferID field is included in the call request, any ItemID value will be ignored since eBay will only search for and return the Best Offer identified in the BestOfferID field. |
| BestOfferID | BestOfferIDType | [0..1] | The unique identifier of a Best Offer. An identifier for a Best Offer is automatically created by eBay once a prospective buyer makes a Best Offer on a Best Offer-enabled listing. If a BestOfferID value is supplied in the call request, any ItemID or BestOfferStatus values will be ignored. Only the Best Offer identified by the BestOfferID value will be returned. |
| BestOfferStatus | BestOfferStatusCodeType | [0..1] | This field can be used if the seller wants to retrieve Best Offers in a specific state. The typical use case for this field is when the seller wants to retrieve Best Offers in all states for a specific listing. In fact, the All value can only be used if an ItemID value is also supplied in the call request. If a BestOfferID field is included in the call request, any BestOfferStatus value will be ignored since eBay will only search for and return the Best Offer identified in the BestOfferID field. |
| Pagination | PaginationType | [0..1] | This container can be used if the seller is expecting that the GetBestOffers call will retrieve a large number of results, so that seller wishes to view just a subset (one page of multiple pages) of those results at a time. See this container's child fields for more information on how pagination is used. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<GetBestOffersRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <BestOfferID></BestOfferID>
  <BestOfferStatus></BestOfferStatus>
  <ItemID></ItemID>
  <Pagination>
    <EntriesPerPage>int</EntriesPerPage>
    <PageNumber>int</PageNumber>
  </Pagination>
  <!-- Standard Input Fields -->
  <DetailLevel></DetailLevel>
  <!-- ... more DetailLevel values allowed here ... -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <OutputSelector>string</OutputSelector>
  <!-- ... more OutputSelector values allowed here ... -->
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetBestOffersRequest>
```

### GetBestOffersResponseType

**Description:** All Best Offers for the item according to the filter or Best Offer ID (or both) used in the input. For the notification client usage, this response includes a single Best Offer.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| BestOfferArray | BestOfferArrayType | [0..1] | All Best Offers for the item according to the filter or Best Offer ID (or both) used in the input. The buyer and seller messages are returned only if the detail level is defined. Includes the buyer and seller message only if the ReturnAll detail level is used. Only returned if Best Offers have been made. |
| Item | ItemType | [0..1] | This container consists of several details about the listing for which a Best Offer has been made, including the Item ID, the current price of the item (not the Best Offer price), and the time that the listing is scheduled to end. |
| ItemBestOffersArray | ItemBestOffersArrayType | [0..1] | A collection of details about the Best Offers received for a specific item. Empty if there are no Best Offers. |
| PageNumber | int | [0..1] | This integer value indicates the current page number of Best Offers that is currently being shown. This value will be the same value passed into the Pagination.PageNumber field in the request. |
| PaginationResult | PaginationResultType | [0..1] | Provides information about the data returned, including the number of pages and the number of entries. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<GetBestOffersResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <BestOfferArray>
    <BestOffer>
      <BestOfferCodeType></BestOfferCodeType>
      <BestOfferID></BestOfferID>
      <Buyer>
        <Email>string</Email>
        <FeedbackScore>int</FeedbackScore>
        <RegistrationDate>dateTime</RegistrationDate>
        <ShippingAddress></ShippingAddress>
        <UserID></UserID>
      </Buyer>
      <BuyerMessage>string</BuyerMessage>
      <ExpirationTime>dateTime</ExpirationTime>
      <Price currencyID="CurrencyCodeType">
      </Price>
      <Quantity>int</Quantity>
      <SellerMessage>string</SellerMessage>
      <Status></Status>
    </BestOffer>
    <!-- ... more BestOffer nodes allowed here ... -->
  </BestOfferArray>
  <Item>
    <BuyItNowPrice currencyID="CurrencyCodeType">
    </BuyItNowPrice>
    <Currency></Currency>
    <ItemID></ItemID>
    <ListingDetails>
      <EndTime>dateTime</EndTime>
    </ListingDetails>
  </Item>
  <ItemBestOffersArray>
    <ItemBestOffers>
      <BestOfferArray>
        <BestOffer>
          <BestOfferCodeType></BestOfferCodeType>
          <BestOfferID></BestOfferID>
          <Buyer>
            <Email>string</Email>
            <FeedbackScore>int</FeedbackScore>
            <RegistrationDate>dateTime</RegistrationDate>
            <ShippingAddress></ShippingAddress>
            <UserID></UserID>
          </Buyer>
          <BuyerMessage>string</BuyerMessage>
          <ExpirationTime>dateTime</ExpirationTime>
          <Price currencyID="CurrencyCodeType">
          </Price>
          <Quantity>int</Quantity>
          <SellerMessage>string</SellerMessage>
          <Status></Status>
        </BestOffer>
        <!-- ... more BestOffer nodes allowed here ... -->
      </BestOfferArray>
      <Item>
        <BuyItNowPrice currencyID="CurrencyCodeType">
        </BuyItNowPrice>
        <Currency></Currency>
        <ItemID></ItemID>
        <ListingDetails>
          <EndTime>dateTime</EndTime>
        </ListingDetails>
      </Item>
      <Role></Role>
    </ItemBestOffers>
    <!-- ... more ItemBestOffers nodes allowed here ... -->
  </ItemBestOffersArray>
  <PageNumber>int</PageNumber>
  <PaginationResult>
    <TotalNumberOfEntries>int</TotalNumberOfEntries>
    <TotalNumberOfPages>int</TotalNumberOfPages>
  </PaginationResult>
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
</GetBestOffersResponse>
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

1. Returned offers depend on listing, role, and offer-state filters.

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
| GetBestOffers | Offer API sellerNegotiationHistory | Query |
| GetBestOffers | Offer API buyerNegotiationHistory | Query |
| GetBestOffers | Unknown ItemOfferOverviewHistory | Query |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_getbestoffers_html.jsonl`; `.trace_artifacts/extract_wsdl_getbestoffers.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
