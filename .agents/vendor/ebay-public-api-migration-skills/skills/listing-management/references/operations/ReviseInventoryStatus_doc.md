# ReviseInventoryStatus - Traditional API (SOAP)

> **Call Name:** ReviseInventoryStatus
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

This call enables a seller to change the price and/or quantity of up to four active, fixed-price listings. The fixed-price listing(s) to modify are identified with the ItemID of the listing or the SKU value of the item (if a seller-defined SKU value exists for the listing).

**Purpose:**
This call enables a seller to change the price and/or quantity of up to four active, fixed-price listings. The fixed-price listing(s) to modify are identified with the ItemID of the listing or the SKU value of the item (if a seller-defined SKU value exists for the listing). This call can be used to update both single-variation and multiple-variation listings.

**Use Cases:**
- Updates listing price and/or quantity quickly.

**Important Notes:**
- Updates listing price and/or quantity quickly.

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
X-EBAY-API-CALL-NAME: ReviseInventoryStatus
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
<ReviseInventoryStatusRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <InventoryStatus>
    <ItemID></ItemID>
    <Quantity>int</Quantity>
    <SKU></SKU>
    <StartPrice></StartPrice>
  </InventoryStatus>
  <!-- ... more InventoryStatus nodes allowed here ... -->
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</ReviseInventoryStatusRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| InventoryStatus | InventoryStatusType | Yes | One InventoryStatus container is required for each item or item variation that is being revised. Whether updating the price and/or quantity of a single-variation listing or a specific variation within a multiple-variation listing, the limit of items or item variations that can be modified with one call is four. |

#### Optional Fields

| Field Path | Type | Default | Description | Constraints |
|------------|------|---------|-------------|-------------|
| None | - | - | No optional fields were identified in the extracted source. | - |

#### Conditional Fields

| Field Path | Type | Condition | Description |
|------------|------|-----------|-------------|
| None | - | - | No conditional request fields were identified in the extracted source. |

## Response Structure

### XML Schema

```xml
<?xml version="1.0" encoding="utf-8"?>
<ReviseInventoryStatusResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <Fees>
    <Fee>
      <Fee currencyID="CurrencyCodeType">
      </Fee>
      <Name>string</Name>
      <PromotionalDiscount currencyID="CurrencyCodeType">
      </PromotionalDiscount>
    </Fee>
    <!-- ... more Fee nodes allowed here ... -->
    <ItemID></ItemID>
  </Fees>
  <!-- ... more Fees nodes allowed here ... -->
  <InventoryStatus>
    <ItemID></ItemID>
    <SKU></SKU>
  </InventoryStatus>
  <!-- ... more InventoryStatus nodes allowed here ... -->
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
</ReviseInventoryStatusResponse>
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
| InventoryStatus | InventoryStatusType | Always | One InventoryStatus container is returned for each item or item variation that was revised. Whether updating the price and/or quantity of a single-variation listing or a specific variation within a multiple-variation listing, the limit of items or item variations that can be modified with one call is four. Note that the SKU field is returned as an empty tag if it is not defined for a single-variation listing. |
| Fees | InventoryFeesType | Always | A Fees container is returned for each fixed-price listing that was modified with the ReviseInventoryStatus call. This container consists of the estimated listing fees for the revised listing, and the listing is identified in the ItemID field. Each type of fee is returned even if it is not applicable (has a value of 0.0 . The transaction fees are not in this container, as these values cannot be determined until a sale is made. Note that these fees are at the listing level, so if multiple variations within a multiple-variation listing were modified, the fees in this container would be cumulative totals, and would not single out the fees associated with each modified item variation. Please note that since fees are returned at the listing level, it is possible that the response will include one Fees container and four InventoryStatus containers if you made revisions to four different item variations within the same multiple-variation listing. |

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

### ReviseInventoryStatusRequestType

**Description:** Enables a seller to change the price and/or quantity of one to four active, fixed-price listings. The fixed-price listing to modify is identified with the ItemID of the listing and/or the SKU value of the item (if a seller-defined SKU value exists for the listing). If the seller is modifying one or more variations within a multiple-variation listing, the ItemID and SKU fields in the InventoryStatus container become required, with the ItemID value identifying the listing, and the SKU value identifying the specific product variation within that multiple-variation listing. Each variation within a multiple-variation listing requires a seller-defined SKU value. Whether updating the price and/or quantity of a single-variation listing or a specific variation within a multiple-variation listing, the limit of items or item variations that can be modified with one call is four.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| InventoryStatus | InventoryStatusType | [0..unbounded] | One InventoryStatus container is required for each item or item variation that is being revised. Whether updating the price and/or quantity of a single-variation listing or a specific variation within a multiple-variation listing, the limit of items or item variations that can be modified with one call is four. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<ReviseInventoryStatusRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <InventoryStatus>
    <ItemID></ItemID>
    <Quantity>int</Quantity>
    <SKU></SKU>
    <StartPrice></StartPrice>
  </InventoryStatus>
  <!-- ... more InventoryStatus nodes allowed here ... -->
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</ReviseInventoryStatusRequest>
```

### ReviseInventoryStatusResponseType

**Description:** The base response type for the ReviseInventoryStatus call. The response includes a Fees container and an InventoryStatus container for each item and/or item variation that was revised.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| InventoryStatus | InventoryStatusType | [0..unbounded] | One InventoryStatus container is returned for each item or item variation that was revised. Whether updating the price and/or quantity of a single-variation listing or a specific variation within a multiple-variation listing, the limit of items or item variations that can be modified with one call is four. Note that the SKU field is returned as an empty tag if it is not defined for a single-variation listing. |
| Fees | InventoryFeesType | [0..unbounded] | A Fees container is returned for each fixed-price listing that was modified with the ReviseInventoryStatus call. This container consists of the estimated listing fees for the revised listing, and the listing is identified in the ItemID field. Each type of fee is returned even if it is not applicable (has a value of 0.0 . The transaction fees are not in this container, as these values cannot be determined until a sale is made. Note that these fees are at the listing level, so if multiple variations within a multiple-variation listing were modified, the fees in this container would be cumulative totals, and would not single out the fees associated with each modified item variation. Please note that since fees are returned at the listing level, it is possible that the response will include one Fees container and four InventoryStatus containers if you made revisions to four different item variations within the same multiple-variation listing. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<ReviseInventoryStatusResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <Fees>
    <Fee>
      <Fee currencyID="CurrencyCodeType">
      </Fee>
      <Name>string</Name>
      <PromotionalDiscount currencyID="CurrencyCodeType">
      </PromotionalDiscount>
    </Fee>
    <!-- ... more Fee nodes allowed here ... -->
    <ItemID></ItemID>
  </Fees>
  <!-- ... more Fees nodes allowed here ... -->
  <InventoryStatus>
    <ItemID></ItemID>
    <SKU></SKU>
  </InventoryStatus>
  <!-- ... more InventoryStatus nodes allowed here ... -->
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
</ReviseInventoryStatusResponse>
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

1. Use only supported inventory status fields in the fast-revise flow.

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
| ReviseInventoryStatus | Listing API bulkUpdateInventory | Mutation |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_reviseinventorystatus_html.jsonl`; `.trace_artifacts/extract_wsdl_reviseinventorystatus.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
