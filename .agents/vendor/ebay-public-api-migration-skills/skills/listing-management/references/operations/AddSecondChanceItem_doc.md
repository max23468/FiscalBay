# AddSecondChanceItem - Traditional API (SOAP)

> **Call Name:** AddSecondChanceItem
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

Use this call to create a Second Chance Offer (that is, an offer for an unsold item) for one of that item's non-winning bidders. AddSecondChanceItem creates a special type of listing in which only the specified Second Chance Offer recipient may purchase the item.

**Purpose:**
Use this call to create a Second Chance Offer (that is, an offer for an unsold item) for one of that item's non-winning bidders. AddSecondChanceItem creates a special type of listing in which only the specified Second Chance Offer recipient may purchase the item. The recipient who is chosen by the seller must be one of the non-winning bidders from the ended listing.

**Use Cases:**
- Creates a second chance offer for a bidder after an auction.

**Important Notes:**
- Creates a second chance offer for a bidder after an auction.

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
X-EBAY-API-CALL-NAME: AddSecondChanceItem
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
<AddSecondChanceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <BuyItNowPrice></BuyItNowPrice>
  <Duration></Duration>
  <ItemID></ItemID>
  <RecipientBidderUserID></RecipientBidderUserID>
  <SellerMessage>string</SellerMessage>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</AddSecondChanceItemRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| RecipientBidderUserID | UserIDType | Yes | This field is used to specify the bidder that is being offered the Second Chance Offer. The eBay User ID of the bidder is used in this field. Specify only one RecipientBidderUserID per call. If multiple users are specified, only the last one specified receives the offer. User ID values will be returned in the Offer.User.UserID field of the GetAllBidders call response. |
| Duration | SecondChanceOfferDurationCodeType | Yes | This enumeration value indicates the length of time (in days) that the Second Chance Offer will be available to the recipient. Upon receiving the Second Chance Offer, the recipient bidder will have this many days to accept the offer before the offer expires. One of the values in SecondChanceOfferDurationCodeType must be used. |
| ItemID | ItemIDType | Yes | This field is used to identify the original auction listing through its unique identifier (Item ID). Upon a successful call, the Second Chance Offer will be identified by a new ItemID in the response. |

#### Optional Fields

| Field Path | Type | Default | Description | Constraints |
|------------|------|---------|-------------|-------------|
| BuyItNowPrice | AmountType | Not specified in source | The amount the offer recipient must pay to purchase the item as a Second Chance Offer. This field should only be used when the original item was listed in an eBay Motors vehicle category (or in some categories on U.S. and international sites for high-priced items, such as items in many U.S. and Canada Business and Industrial categories) and it ended unsold because the reserve price was not met. Otherwise, eBay establishes the price and no price should be submitted. The price offered to the Second Chance Offer recipient is generally the highest bid that the user made on the original listing. | Not specified in source |
| SellerMessage | string | Not specified in source | This optional field is used to provide a message to the recipient of the Second Chance Offer. This message cannot contain HTML, asterisks, or quotes. The content in this field will be included in the Second Chance Offer email that is sent to the recipient. | Not specified in source |

#### Conditional Fields

| Field Path | Type | Condition | Description |
|------------|------|-----------|-------------|
| None | - | - | No conditional request fields were identified in the extracted source. |

## Response Structure

### XML Schema

```xml
<?xml version="1.0" encoding="utf-8"?>
<AddSecondChanceItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <EndTime>dateTime</EndTime>
  <ItemID></ItemID>
  <StartTime>dateTime</StartTime>
  <!-- Standard Output Fields -->
  <Ack></Ack>
  <Build>string</Build>
  <CorrelationID>string</CorrelationID>
  <DuplicateInvocationDetails>
    <DuplicateInvocationID></DuplicateInvocationID>
    <InvocationTrackingID>string</InvocationTrackingID>
    <Status></Status>
  </DuplicateInvocationDetails>
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
</AddSecondChanceItemResponse>
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
| ItemID | ItemIDType | Always | This field contains the Item ID for the Second Chance Offer that was just created with the AddSecondChanceItem call. Note that this Item ID will be different from the Item ID in the original auction listing that was passed in the request. |
| StartTime | dateTime | Always | This timestamp indicates the date and time when the Second Chance Offer became available to the recipient. |
| EndTime | dateTime | Always | This timestamp indicates the date and time when the Second Chance Offer listing will expire, at which time the recipient will no longer be able to purchase the item. |

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

### AddSecondChanceItemRequestType

**Description:** Used by the seller of an auction listing to provide a Second Chance Offer to one of that auction item's non-winning bidders. A Second Chance Offer is used by sellers whenever the seller was unable to complete the sale with the winning bidder because the bidder didn't pay, or if the auction listing ended without the Reserve Price being met, or if that seller has multiple identical items for sale and wants to give other bidders a chance to purchase the item. To get information on the bidders for a recently-ended auction listing, the seller can use the GetAllBidders call and pass the corresponding ItemID value into the call request. For more information on the specifics of Second Chance Offers, see the Making a Second Chance Offer help page.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| RecipientBidderUserID | UserIDType | [0..1] | This field is used to specify the bidder that is being offered the Second Chance Offer. The eBay User ID of the bidder is used in this field. Specify only one RecipientBidderUserID per call. If multiple users are specified, only the last one specified receives the offer. User ID values will be returned in the Offer.User.UserID field of the GetAllBidders call response. |
| BuyItNowPrice | AmountType | [0..1] | The amount the offer recipient must pay to purchase the item as a Second Chance Offer. This field should only be used when the original item was listed in an eBay Motors vehicle category (or in some categories on U.S. and international sites for high-priced items, such as items in many U.S. and Canada Business and Industrial categories) and it ended unsold because the reserve price was not met. Otherwise, eBay establishes the price and no price should be submitted. The price offered to the Second Chance Offer recipient is generally the highest bid that the user made on the original listing. |
| Duration | SecondChanceOfferDurationCodeType | [0..1] | This enumeration value indicates the length of time (in days) that the Second Chance Offer will be available to the recipient. Upon receiving the Second Chance Offer, the recipient bidder will have this many days to accept the offer before the offer expires. One of the values in SecondChanceOfferDurationCodeType must be used. |
| ItemID | ItemIDType | [0..1] | This field is used to identify the original auction listing through its unique identifier (Item ID). Upon a successful call, the Second Chance Offer will be identified by a new ItemID in the response. |
| SellerMessage | string | [0..1] | This optional field is used to provide a message to the recipient of the Second Chance Offer. This message cannot contain HTML, asterisks, or quotes. The content in this field will be included in the Second Chance Offer email that is sent to the recipient. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<AddSecondChanceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <BuyItNowPrice></BuyItNowPrice>
  <Duration></Duration>
  <ItemID></ItemID>
  <RecipientBidderUserID></RecipientBidderUserID>
  <SellerMessage>string</SellerMessage>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</AddSecondChanceItemRequest>
```

### AddSecondChanceItemResponseType

**Description:** Type defining the response container of an AddSecondChanceItem call. This response container consists of the ItemID of the listing in which a Second Chance Offer is being offered, as well as the start and end time that the Second Chance Offer is available to the recipient (identified through the RecipientBidderUserID in the request).

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| ItemID | ItemIDType | [0..1] | This field contains the Item ID for the Second Chance Offer that was just created with the AddSecondChanceItem call. Note that this Item ID will be different from the Item ID in the original auction listing that was passed in the request. |
| StartTime | dateTime | [0..1] | This timestamp indicates the date and time when the Second Chance Offer became available to the recipient. |
| EndTime | dateTime | [0..1] | This timestamp indicates the date and time when the Second Chance Offer listing will expire, at which time the recipient will no longer be able to purchase the item. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<AddSecondChanceItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <EndTime>dateTime</EndTime>
  <ItemID></ItemID>
  <StartTime>dateTime</StartTime>
  <!-- Standard Output Fields -->
  <Ack></Ack>
  <Build>string</Build>
  <CorrelationID>string</CorrelationID>
  <DuplicateInvocationDetails>
    <DuplicateInvocationID></DuplicateInvocationID>
    <InvocationTrackingID>string</InvocationTrackingID>
    <Status></Status>
  </DuplicateInvocationDetails>
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
</AddSecondChanceItemResponse>
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

1. Second chance offers require an eligible prior auction/bidder context.

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
| AddSecondChanceItem | Listing API createSecondChanceListing | Mutation |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_addsecondchanceitem_html.jsonl`; `.trace_artifacts/extract_wsdl_addsecondchanceitem.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
