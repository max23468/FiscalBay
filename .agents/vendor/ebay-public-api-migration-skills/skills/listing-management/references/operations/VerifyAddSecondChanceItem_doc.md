# VerifyAddSecondChanceItem - Traditional API (SOAP)

> **Call Name:** VerifyAddSecondChanceItem
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

Use this call to test the inputs for AddSecondChanceItem without actually extending the second chance offer. Use VerifyAddSecondChanceItem to test extending a second-chance offer to a non-winning bidder from a specified ended listing.

**Purpose:**
Use this call to test the inputs for AddSecondChanceItem without actually extending the second chance offer. Use VerifyAddSecondChanceItem to test extending a second-chance offer to a non-winning bidder from a specified ended listing. This call tests the inputs that you would use with AddSecondChanceItem , but it does not actually extend the second chance offer (no new listing is created and no notification email is sent to the recipient user).

**Use Cases:**
- Verifies a second-chance offer listing without creating it.

**Important Notes:**
- Verifies a second-chance offer listing without creating it.

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
X-EBAY-API-CALL-NAME: VerifyAddSecondChanceItem
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
<VerifyAddSecondChanceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
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
</VerifyAddSecondChanceItemRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| RecipientBidderUserID | UserIDType | Yes | Specifies the bidder from the original, ended listing to whom the seller is extending the second chance offer. Specify only one RecipientBidderUserID per call. If multiple users are specified (each in a RecipientBidderUserID node), only the last one specified receives the offer. |
| Duration | SecondChanceOfferDurationCodeType | Yes | Specifies the length of time the Second Chance Offer listing will be active. The recipient bidder has that much time to purchase the item or the listing expires. |
| ItemID | ItemIDType | Yes | This field is used to identify the recently-ended auction listing for which a Second Chance Offer will be made to one of the non-winning bidders on the recently-ended auction listing. |

#### Optional Fields

| Field Path | Type | Default | Description | Constraints |
|------------|------|---------|-------------|-------------|
| BuyItNowPrice | AmountType | Not specified in source | Specifies the amount the offer recipient must pay to purchase the item from the Second Chance Offer listing. Use only when the original item was an eBay Motors (or in some categories on U.S. and international sites for high-priced items, such as items in many U.S. and Canada Business and Industrial categories) and it ended unsold because the reserve price was not met. Call fails with an error for any other item conditions. | Not specified in source |
| SellerMessage | string | Not specified in source | Message content. Cannot contain HTML, asterisks, or quotes. This content is included in the Second Chance Offer email sent to the recipient, which can be retrieved with GetMyMessages . | Not specified in source |

#### Conditional Fields

| Field Path | Type | Condition | Description |
|------------|------|-----------|-------------|
| None | - | - | No conditional request fields were identified in the extracted source. |

## Response Structure

### XML Schema

```xml
<?xml version="1.0" encoding="utf-8"?>
<VerifyAddSecondChanceItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <EndTime>dateTime</EndTime>
  <StartTime>dateTime</StartTime>
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
</VerifyAddSecondChanceItemResponse>
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
| StartTime | dateTime | Always | Indicates the date and time when the the new Second Chance Offer listing became active and the recipient user could purchase the item. |
| EndTime | dateTime | Always | Indicates the date and time when the Second Chance Offer listing expires, at which time the listing ends (if the recipient user does not purchase the item first). |

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

### VerifyAddSecondChanceItemRequestType

**Description:** Simulates the creation of a new Second Chance Offer listing of an item without actually creating a listing.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| RecipientBidderUserID | UserIDType | [0..1] | Specifies the bidder from the original, ended listing to whom the seller is extending the second chance offer. Specify only one RecipientBidderUserID per call. If multiple users are specified (each in a RecipientBidderUserID node), only the last one specified receives the offer. |
| BuyItNowPrice | AmountType | [0..1] | Specifies the amount the offer recipient must pay to purchase the item from the Second Chance Offer listing. Use only when the original item was an eBay Motors (or in some categories on U.S. and international sites for high-priced items, such as items in many U.S. and Canada Business and Industrial categories) and it ended unsold because the reserve price was not met. Call fails with an error for any other item conditions. |
| Duration | SecondChanceOfferDurationCodeType | [0..1] | Specifies the length of time the Second Chance Offer listing will be active. The recipient bidder has that much time to purchase the item or the listing expires. |
| ItemID | ItemIDType | [0..1] | This field is used to identify the recently-ended auction listing for which a Second Chance Offer will be made to one of the non-winning bidders on the recently-ended auction listing. |
| SellerMessage | string | [0..1] | Message content. Cannot contain HTML, asterisks, or quotes. This content is included in the Second Chance Offer email sent to the recipient, which can be retrieved with GetMyMessages . |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<VerifyAddSecondChanceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
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
</VerifyAddSecondChanceItemRequest>
```

### VerifyAddSecondChanceItemResponseType

**Description:** Base response of the VerifyAddSecondChanceItem call.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| StartTime | dateTime | [0..1] | Indicates the date and time when the the new Second Chance Offer listing became active and the recipient user could purchase the item. |
| EndTime | dateTime | [0..1] | Indicates the date and time when the Second Chance Offer listing expires, at which time the listing ends (if the recipient user does not purchase the item first). |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<VerifyAddSecondChanceItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <EndTime>dateTime</EndTime>
  <StartTime>dateTime</StartTime>
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
</VerifyAddSecondChanceItemResponse>
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

1. Verification does not create a live listing; success typically returns ItemID 0.

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
| VerifyAddSecondChanceItem | Listing API createSecondChanceListing | Mutation |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_verifyaddsecondchanceitem_html.jsonl`; `.trace_artifacts/extract_wsdl_verifyaddsecondchanceitem.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
