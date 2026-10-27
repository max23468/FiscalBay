# GetStoreCategoryUpdateStatus - Traditional API

> **Call Name:** GetStoreCategoryUpdateStatus
> **API Type:** Traditional API
> **API Version:** 1131
> **Service:** Not specified in source

---

## Metadata

| Property | Value |
|----------|-------|
| **Call Type** | Core |
| **Deprecated** | Not specified in source |
| **Replacement** | Stores API getStoreTask; Stores API getStoreTasks |
| **Rate Limit** | Not specified in source |
| **Supported Sites** | Not specified in source |

---

## Description

GetStoreCategoryUpdateStatus Use this call to retrieve the status of the processing for category-structure changes specified with a SetStoreCategories request. Usage Details GetStoreCategoryUpdateStatus is needed only when a call to SetStoreCategories affects many listings, causing the category structure changes to be processed asynchronously.

**Purpose:**
GetStoreCategoryUpdateStatus Use this call to retrieve the status of the processing for category-structure changes specified with a SetStoreCategories request. Usage Details GetStoreCategoryUpdateStatus is needed only when a call to SetStoreCategories affects many listings, causing the category structure changes to be processed asynchronously. In this case, the value for TaskID in the SetStoreCategories response will be non-zero.

**Use Cases:**
- Use this operation when working with the corresponding traditional store or product flow.
- Review the Migration Path section before implementing new integrations.

**Important Notes:**
- This document is generated from JSONL plus WSDL sources.
- Request and response tables prioritize extracted WSDL metadata when available.

---

## Authentication

### Required Credentials

| Method | Description |
|--------|-------------|
| **Authentication** | Not specified in source |

### HTTP Headers

```http
Not specified in source
```

---

## Request Structure

### Endpoint

```
Not specified in source
```

### XML Schema

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetStoreCategoryUpdateStatusRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <TaskID>long</TaskID>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel></GetStoreCategoryUpdateStatusRequest>
```

### Request Fields

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| TaskID | long | Yes | The unique identifier of an eBay Store Category hierarchy change task. A TaskID value is returned in the response of a successful SetStoreCategories call. Note: Depending on the breadth of changes being made to an eBay Store Category hierarchy, it is is possible that the SetStoreCategories call will complete the task simultaneously with the call response. A seller will know if an eBay Store Category hierarchy task was completed simultaneously if the TaskID value is returned as 0 , and the Status field is returned with a value of Complete . If the task was not completely simultaneously, the TaskID value will be a positive integer, and the Status field will show a value of InProgress or Pending . |

## Response Structure

### XML Schema

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetStoreCategoryUpdateStatusResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <Status></Status>
  <!-- Standard Output Fields -->
  <Ack></Ack>
  <Build>string</Build>
  <CorrelationID>string</CorrelationID>
  <Errors>
    <ErrorClassification></ErrorClassification>
    <ErrorCode>token</ErrorCode>
    <ErrorParameters ParamID="string">
      <Value>string</Value></ErrorParameters>
    <!-- ... more ErrorParameters nodes allowed here ... -->
    <LongMessage>string</LongMessage>
    <SeverityCode></SeverityCode>
    <ShortMessage>string</ShortMessage></Errors>
  <!-- ... more Errors nodes allowed here ... -->
  <HardExpirationWarning>string</HardExpirationWarning>
  <Timestamp>dateTime</Timestamp>
  <Version>string</Version></GetStoreCategoryUpdateStatusResponse>
```

### Response Fields

| Field Path | Type | Occurrence | Description |
|------------|------|------------|-------------|
| Status | TaskStatusCodeType | Always | The enumeration value indicates the status of an update to the eBay Store Category hierarchy. |

## Complex Types Reference

### GetStoreCategoryUpdateStatusRequestType

**Description:** This call is used to retrieve the status of an eBay Store Category hierarchy change that was made with a SetStoreCategories call.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| TaskID | long | [0..1] | The unique identifier of an eBay Store Category hierarchy change task. A TaskID value is returned in the response of a successful SetStoreCategories call. Note: Depending on the breadth of changes being made to an eBay Store Category hierarchy, it is is possible that the SetStoreCategories call will complete the task simultaneously with the call response. A seller will know if an eBay Store Category hierarchy task was completed simultaneously if the TaskID value is returned as 0 , and the Status field is returned with a value of Complete . If the task was not completely simultaneously, the TaskID value will be a positive integer, and the Status field will show a value of InProgress or Pending . |

### GetStoreCategoryUpdateStatusResponseType

**Description:** The base response of a GetStoreCategoryUpdateStatus call. The response includes the status of an eBay Store Category hierarchy change that was made with a SetStoreCategories call.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| Status | TaskStatusCodeType | [0..1] | The enumeration value indicates the status of an update to the eBay Store Category hierarchy. |

---

## Enumerations

Not specified in source.

---

## Error Codes

| Error Code | Short Message | Description | Resolution |
|------------|---------------|-------------|------------|
| Not specified in source | Not specified in source | Not specified in source | Refer to runtime responses and the matched source JSONL. |

---

## Business Rules & Constraints

1. Validate request arguments against the request field table and WSDL metadata.
2. Use the matched JSONL sample as the source of example payload structure.
3. Prefer the mapped replacement APIs for new implementations.

---

## Rate Limits & Throttling

| Metric | Limit | Window | Notes |
|--------|-------|--------|-------|
| Not specified in source | Not specified in source | Not specified in source | Not specified in source |

---

## Best Practices

1. Review both the JSONL sample and the WSDL-derived field metadata when implementing this call.
3. Treat the Migration Path section as the default direction for new development.

---

## Migration Path

### New API Equivalent

| SOAP Operation | New API | Type |
|----------------|---------|------|
| GetStoreCategoryUpdateStatus | Stores API getStoreTask | GET |
| GetStoreCategoryUpdateStatus | Stores API getStoreTasks | GET |

---

*Source: `/Users/xinyliu/Documents/sddz/GitHub/ebay-public-api-migration-skills copy/resource-for-migration/new_scrape/developer_ebay_com_devzone_xml_docs_reference_ebay_getstorecategoryupdatestatus_html.jsonl`; `.trace_artifacts/extract_wsdl_getstorecategoryupdatestatus.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
