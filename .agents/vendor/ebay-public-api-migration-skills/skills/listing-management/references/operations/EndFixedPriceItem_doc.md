# EndFixedPriceItem - Traditional API (SOAP)

> **Call Name:** EndFixedPriceItem
> **API Type:** SOAP XML traditional API
> **API Version:** 1131
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

Use this call to end the specified fixed-price listing before the date and time at which it would normally end (per the listing duration). While you can also use EndItem to end fixed-price listings, EndFixedPriceItem has the following differences from EndItem : If the seller listed the item with SKU-based inventory tracking, EndFixedPriceItem gives you an option to end the listing by SKU instead of by ItemID .

**Purpose:**
Use this call to end the specified fixed-price listing before the date and time at which it would normally end (per the listing duration). While you can also use EndItem to end fixed-price listings, EndFixedPriceItem has the following differences from EndItem : If the seller listed the item with SKU-based inventory tracking, EndFixedPriceItem gives you an option to end the listing by SKU instead of by ItemID . The call supports only fixed-price listings (not auctions).

**Use Cases:**
- Ends a fixed-price listing early.

**Important Notes:**
- Ends a fixed-price listing early.

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
X-EBAY-API-CALL-NAME: EndFixedPriceItem
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
<EndFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <EndingReason></EndingReason>
  <ItemID></ItemID>
  <SKU></SKU>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</EndFixedPriceItemRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| EndingReason | EndReasonCodeType | Yes | The seller's reason for ending the listing early is input into this required field. The seller is not allowed to use the ProductDeleted value, as this ending reason can only be used internally by eBay to administratively end a listing due to the associated Catalog product being removed from the eBay Catalog. |

#### Optional Fields

| Field Path | Type | Default | Description | Constraints |
|------------|------|---------|-------------|-------------|
| None | - | - | No optional fields were identified in the extracted source. | - |

#### Conditional Fields

| Field Path | Type | Condition | Description |
|------------|------|-----------|-------------|
| ItemID | ItemIDType | Conditionally | Unique identifier of the listing that you want to end. In the EndFixedPriceItem request, either ItemID or SKU value is required. If both are passed in and they don't refer to the same listing, eBay ignores SKU and considers only the ItemID . |
| SKU | SKUType | Conditionally | The seller-defined SKU (stock keeping unit) value of the item in the listing being ended. The SKU field can only be used to end a listing if that listing was created or relisted with an AddFixedPriceItem or RelistFixedPriceItem call, and the Item.InventoryTrackingMethod was included in the call and set to SKU . In the EndFixedPriceItem request, either ItemID or SKU is required. If both are passed in and they don't refer to the same listing, eBay ignores SKU and considers only the ItemID . |

## Response Structure

### XML Schema

```xml
<?xml version="1.0" encoding="utf-8"?>
<EndFixedPriceItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <EndTime>dateTime</EndTime>
  <SKU></SKU>
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
</EndFixedPriceItemResponse>
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
| EndTime | dateTime | Always | Timestamp that indicates the date and time (GMT) that the specified listing was ended. |
| SKU | SKUType | Conditionally | If a SKU (stock-keeping unit) exists for the item in the listing, it is returned in the response. |

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

### EndFixedPriceItemRequestType

**Description:** Ends the specified fixed-price listing before the date and time at which it would normally end (per the listing duration).

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| ItemID | ItemIDType | [0..1] | Unique identifier of the listing that you want to end. In the EndFixedPriceItem request, either ItemID or SKU value is required. If both are passed in and they don't refer to the same listing, eBay ignores SKU and considers only the ItemID . |
| EndingReason | EndReasonCodeType | [0..1] | The seller's reason for ending the listing early is input into this required field. The seller is not allowed to use the ProductDeleted value, as this ending reason can only be used internally by eBay to administratively end a listing due to the associated Catalog product being removed from the eBay Catalog. |
| SKU | SKUType | [0..1] | The seller-defined SKU (stock keeping unit) value of the item in the listing being ended. The SKU field can only be used to end a listing if that listing was created or relisted with an AddFixedPriceItem or RelistFixedPriceItem call, and the Item.InventoryTrackingMethod was included in the call and set to SKU . In the EndFixedPriceItem request, either ItemID or SKU is required. If both are passed in and they don't refer to the same listing, eBay ignores SKU and considers only the ItemID . |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<EndFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <EndingReason></EndingReason>
  <ItemID></ItemID>
  <SKU></SKU>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</EndFixedPriceItemRequest>
```

### EndFixedPriceItemResponseType

**Description:** Acknowledgement that includes SKU, as well as the date and time that the listing ended due to the call to EndFixedPriceItem.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| EndTime | dateTime | [0..1] | Timestamp that indicates the date and time (GMT) that the specified listing was ended. |
| SKU | SKUType | [0..1] | If a SKU (stock-keeping unit) exists for the item in the listing, it is returned in the response. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<EndFixedPriceItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <EndTime>dateTime</EndTime>
  <SKU></SKU>
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
</EndFixedPriceItemResponse>
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

1. Only active listings can be ended.

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
| EndFixedPriceItem | Listing API endListing | Mutation |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_endfixedpriceitem_html.jsonl`; `.trace_artifacts/extract_wsdl_endfixedpriceitem.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
