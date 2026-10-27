# RespondToBestOffer - Traditional API (SOAP)

> **Call Name:** RespondToBestOffer
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

This call enables the seller to accept or decline a buyer's Best Offer on an item, or make a counter offer to the buyer's Best Offer. A seller can decline multiple Best Offers with one call, but the seller cannot accept or counter offer multiple Best Offers with one call.

**Purpose:**
This call enables the seller to accept or decline a buyer's Best Offer on an item, or make a counter offer to the buyer's Best Offer. A seller can decline multiple Best Offers with one call, but the seller cannot accept or counter offer multiple Best Offers with one call. Best Offers are not applicable to auction listings.

**Use Cases:**
- Accepts, declines, or counters a Best Offer.

**Important Notes:**
- Accepts, declines, or counters a Best Offer.

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
X-EBAY-API-CALL-NAME: RespondToBestOffer
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
<RespondToBestOfferRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <Action></Action>
  <BestOfferID></BestOfferID>
  <!-- ... more BestOfferID values allowed here ... -->
  <CounterOfferPrice currencyID="CurrencyCodeType">
  </CounterOfferPrice>
  <CounterOfferQuantity>int</CounterOfferQuantity>
  <ItemID></ItemID>
  <SellerResponse>string</SellerResponse>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</RespondToBestOfferRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| ItemID | ItemIDType | Yes | The unique identifier of the listing to which the seller is responding to a Best Offer. |
| BestOfferID | BestOfferIDType | Yes | The unique identifier of a buyer's Best Offer for the order line item. This ID is created once the buyer makes a Best Offer. It is possible that a seller will get multiple Best Offers for an order line item, and if that seller would like to decline multiple/all of the Best Offers with one RespondToBestOffer call, the seller would pass in each of these identifiers in a separate BestOfferID field. However, the seller can only accept or counter offer one Best Offer at a time. |
| Action | BestOfferActionCodeType | Yes | The enumeration value that the seller passes in to this field will control whether the seller accepts or make a counter offer to a single buyer's Best Offer, or declines one or more buyers' Best Offers. A seller can decline multiple Best Offers with one call, but the seller cannot accept or counter offer multiple Best Offers with one call. |

#### Optional Fields

| Field Path | Type | Default | Description | Constraints |
|------------|------|---------|-------------|-------------|
| None | - | - | No optional fields were identified in the extracted source. | - |

#### Conditional Fields

| Field Path | Type | Condition | Description |
|------------|------|-----------|-------------|
| SellerResponse | string | Conditionally | This optional text field allows the seller to provide more details to the buyer about the action being taken against the buyer's Best Offer. |
| CounterOfferPrice | AmountType | Conditionally | The seller inserts counter offer price into this field. This field is conditionally required and only applicable when the Action value is set to Counter , The counter offer price cannot exceed the Buy It Now price for a single quantity item. However, the dollar value in this field may exceed the Buy It Now price if the buyer is requesting or the seller is offering multiple quantity of the item (in a multiple-quantity listing). The quantity of the item must be specified in the CounterOfferQuantity field if the seller is making a counter offer. |
| CounterOfferQuantity | int | Conditionally | The seller inserts the quantity of items in the counter offer into this field. This field is conditionally required and only applicable when the Action value is set to Counter , The counter offer price must be specified in the CounterOfferPrice field if the seller is making a counter offer. This price should reflect the quantity of items in the counter offer. So, if the seller's counter offer 'unit' price is 15 dollars, and the item quantity is '2', the dollar value passed into the CounterOfferPrice field would be 30.0 . |

## Response Structure

### XML Schema

```xml
<?xml version="1.0" encoding="utf-8"?>
<RespondToBestOfferResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <RespondToBestOffer>
    <BestOffer>
      <CallStatus>string</CallStatus>
    </BestOffer>
    <!-- ... more BestOffer nodes allowed here ... -->
  </RespondToBestOffer>
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
</RespondToBestOfferResponse>
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
| RespondToBestOffer | BestOfferArrayType | Always | The BestOffer.CallStatus value returned in this container will indicate whether or not the action specified in the call request (accept, decline, or counter offer) was successful. The accept and counter offer actions can only be applied toward a single Best Offer. However, multiple Best Offers on a listing can be declined with one call. All Best Offers must be successfully declined with the RespondToBestOffer call for the BestOffer.CallStatus value to be Success . |

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

### RespondToBestOfferRequestType

**Description:** This call enables the seller to accept or decline a buyer's Best Offer on an item, or make a counter offer to the buyer's Best Offer. A seller can decline multiple Best Offers with one call, but the seller cannot accept or counter offer multiple Best Offers with one call. Best Offers are not applicable to auction listings. Note: Historically, the Best Offer feature has not been available for auction listings, but beginning with Version 1027, sellers in the US, UK, and DE sites are able to offer the Best Offer feature in auction listings. The seller can offer Buy It Now or Best Offer in an auction listing, but not both.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| ItemID | ItemIDType | [0..1] | The unique identifier of the listing to which the seller is responding to a Best Offer. |
| BestOfferID | BestOfferIDType | [0..unbounded] | The unique identifier of a buyer's Best Offer for the order line item. This ID is created once the buyer makes a Best Offer. It is possible that a seller will get multiple Best Offers for an order line item, and if that seller would like to decline multiple/all of the Best Offers with one RespondToBestOffer call, the seller would pass in each of these identifiers in a separate BestOfferID field. However, the seller can only accept or counter offer one Best Offer at a time. |
| Action | BestOfferActionCodeType | [0..1] | The enumeration value that the seller passes in to this field will control whether the seller accepts or make a counter offer to a single buyer's Best Offer, or declines one or more buyers' Best Offers. A seller can decline multiple Best Offers with one call, but the seller cannot accept or counter offer multiple Best Offers with one call. |
| SellerResponse | string | [0..1] | This optional text field allows the seller to provide more details to the buyer about the action being taken against the buyer's Best Offer. |
| CounterOfferPrice | AmountType | [0..1] | The seller inserts counter offer price into this field. This field is conditionally required and only applicable when the Action value is set to Counter , The counter offer price cannot exceed the Buy It Now price for a single quantity item. However, the dollar value in this field may exceed the Buy It Now price if the buyer is requesting or the seller is offering multiple quantity of the item (in a multiple-quantity listing). The quantity of the item must be specified in the CounterOfferQuantity field if the seller is making a counter offer. |
| CounterOfferQuantity | int | [0..1] | The seller inserts the quantity of items in the counter offer into this field. This field is conditionally required and only applicable when the Action value is set to Counter , The counter offer price must be specified in the CounterOfferPrice field if the seller is making a counter offer. This price should reflect the quantity of items in the counter offer. So, if the seller's counter offer 'unit' price is 15 dollars, and the item quantity is '2', the dollar value passed into the CounterOfferPrice field would be 30.0 . |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<RespondToBestOfferRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <Action></Action>
  <BestOfferID></BestOfferID>
  <!-- ... more BestOfferID values allowed here ... -->
  <CounterOfferPrice currencyID="CurrencyCodeType">
  </CounterOfferPrice>
  <CounterOfferQuantity>int</CounterOfferQuantity>
  <ItemID></ItemID>
  <SellerResponse>string</SellerResponse>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</RespondToBestOfferRequest>
```

### RespondToBestOfferResponseType

**Description:** This is the base response type for the RespondToBestOffer call. Along with the standard output fields for Traditional API calls, this type contains a RespondToBestOffer container that indicates whether or not the action specified in the call request (accept, decline, or counter offer) was successful.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| RespondToBestOffer | BestOfferArrayType | [0..1] | The BestOffer.CallStatus value returned in this container will indicate whether or not the action specified in the call request (accept, decline, or counter offer) was successful. The accept and counter offer actions can only be applied toward a single Best Offer. However, multiple Best Offers on a listing can be declined with one call. All Best Offers must be successfully declined with the RespondToBestOffer call for the BestOffer.CallStatus value to be Success . |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<RespondToBestOfferResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <RespondToBestOffer>
    <BestOffer>
      <CallStatus>string</CallStatus>
    </BestOffer>
    <!-- ... more BestOffer nodes allowed here ... -->
  </RespondToBestOffer>
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
</RespondToBestOfferResponse>
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

1. Response actions must target an existing Best Offer.

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
| RespondToBestOffer | Offer API counterOffer | Mutation |
| RespondToBestOffer | Offer API acceptOffer | Mutation |
| RespondToBestOffer | Offer API declineOffer | Mutation |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_respondtobestoffer_html.jsonl`; `.trace_artifacts/extract_wsdl_respondtobestoffer.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
