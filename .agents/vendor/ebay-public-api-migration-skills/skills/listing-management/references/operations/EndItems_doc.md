# EndItems - Traditional API (SOAP)

> **Call Name:** EndItems
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

Use this call to explicitly end multiple active item listings before they would ordinarily end (per the listing duration). You can specify up to ten listings to end in a single request.

**Purpose:**
Use this call to explicitly end multiple active item listings before they would ordinarily end (per the listing duration). You can specify up to ten listings to end in a single request. This call works just like EndItem , the logic and restrictions that apply to EndItem apply equally to EndItems .

**Use Cases:**
- Ends multiple listings in a batch.

**Important Notes:**
- Ends multiple listings in a batch.

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
X-EBAY-API-CALL-NAME: EndItems
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
<EndItemsRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <EndItemRequestContainer>
    <EndingReason></EndingReason>
    <ItemID></ItemID>
    <MessageID>string</MessageID>
  </EndItemRequestContainer>
  <!-- ... more EndItemRequestContainer nodes allowed here ... -->
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</EndItemsRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| EndItemRequestContainer | EndItemRequestContainerType | Yes | An EndItemRequestContainer container is required for each eBay listing that the seller plans to end through the EndItems call. Up to 10 eBay listings can be ended with one EndItems call. |

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
<EndItemsResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <EndItemResponseContainer>
    <CorrelationID>string</CorrelationID>
    <EndTime>dateTime</EndTime>
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
  </EndItemResponseContainer>
  <!-- ... more EndItemResponseContainer nodes allowed here ... -->
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
</EndItemsResponse>
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
| EndItemResponseContainer | EndItemResponseContainerType | Always | Returns a response for an individually ended item. Mutiple containers will be listed if multiple items are ended. |

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

### EndItemsRequestType

**Description:** The EndItems call is used to end up to 10 specified eBay listings before the date and time at which those listings would normally end per the listing duration.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| EndItemRequestContainer | EndItemRequestContainerType | [0..unbounded] | An EndItemRequestContainer container is required for each eBay listing that the seller plans to end through the EndItems call. Up to 10 eBay listings can be ended with one EndItems call. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<EndItemsRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <EndItemRequestContainer>
    <EndingReason></EndingReason>
    <ItemID></ItemID>
    <MessageID>string</MessageID>
  </EndItemRequestContainer>
  <!-- ... more EndItemRequestContainer nodes allowed here ... -->
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</EndItemsRequest>
```

### EndItemsResponseType

**Description:** Contains a response of the resulting status of ending each item.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| EndItemResponseContainer | EndItemResponseContainerType | [0..unbounded] | Returns a response for an individually ended item. Mutiple containers will be listed if multiple items are ended. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<EndItemsResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <EndItemResponseContainer>
    <CorrelationID>string</CorrelationID>
    <EndTime>dateTime</EndTime>
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
  </EndItemResponseContainer>
  <!-- ... more EndItemResponseContainer nodes allowed here ... -->
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
</EndItemsResponse>
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

1. Only active listings in the request can be ended.

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
| EndItems | Listing API endListing | Mutation |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_enditems_html.jsonl`; `.trace_artifacts/extract_wsdl_enditems.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
