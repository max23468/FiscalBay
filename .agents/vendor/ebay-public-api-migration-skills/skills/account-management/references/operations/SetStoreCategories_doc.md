# SetStoreCategories - Traditional API

> **Call Name:** SetStoreCategories
> **API Type:** Traditional API
> **API Version:** 1131
> **Service:** Not specified in source

---

## Metadata

| Property | Value |
|----------|-------|
| **Call Type** | Core |
| **Deprecated** | Not specified in source |
| **Replacement** | Stores API addStoreCategory,; Stores API deleteStoreCategory; Stores API moveStoreCategory,; Stores API renameStoreCategory, |
| **Rate Limit** | Not specified in source |
| **Supported Sites** | Not specified in source |

---

## Description

SetStoreCategories Use this call to change the category configuration of a user's eBay store. You can add, delete, move, or rename a list of store categories.

**Purpose:**
SetStoreCategories Use this call to change the category configuration of a user's eBay store. You can add, delete, move, or rename a list of store categories. To call SetStoreCategories , the user must have an eBay Stores subscription and they must have created an eBay Store on the eBay website.

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
<SetStoreCategoriesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <Action></Action>
  <DestinationParentCategoryID>long</DestinationParentCategoryID>
  <ItemDestinationCategoryID>long</ItemDestinationCategoryID>
  <StoreCategories>
    <CustomCategory>
      <CategoryID>long</CategoryID>
      <ChildCategory>
        <CategoryID>long</CategoryID>
        <ChildCategory>
          <CategoryID>long</CategoryID>
          <ChildCategory></ChildCategory>
          <!-->>> ChildCategory can be nested within itself an unlimited number of times>>> -->
          <!-- ... more ChildCategory nodes allowed here ... -->
          <Name>string</Name>
          <Order>int</Order></ChildCategory>
        <!-- ... more ChildCategory nodes allowed here ... -->
        <Name>string</Name>
        <Order>int</Order></ChildCategory>
      <!-- ... more ChildCategory nodes allowed here ... -->
      <Name>string</Name>
      <Order>int</Order></CustomCategory>
    <!-- ... more CustomCategory nodes allowed here ... --></StoreCategories>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel></SetStoreCategoriesRequest>
```

### Request Fields

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| Action | StoreCategoryUpdateActionCodeType | Yes | Specifies the type of action (Add, Move, Delete, or Rename) to carry out for the specified eBay Store categories. |
| ItemDestinationCategoryID | long | Conditionally | Items can only be contained within child categories. A parent category cannot contain items. If adding, moving, or deleting categories displaces items, you must specify a destination child category under which the displaced items will be moved. The destination category must have no child categories. |
| DestinationParentCategoryID | long | Conditionally | When adding or moving store categories, specifies the category under which the listed categories will be located. To add or move categories to the top level, set the value to -999. |
| StoreCategories | StoreCustomCategoryArrayType | Yes | Specifies the store categories on which to act. |

## Response Structure

### XML Schema

```xml
<?xml version="1.0" encoding="utf-8"?>
<SetStoreCategoriesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <CustomCategory></CustomCategory>
  <Status></Status>
  <TaskID>long</TaskID>
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
  <Version>string</Version></SetStoreCategoriesResponse>
```

### Response Fields

| Field Path | Type | Occurrence | Description |
|------------|------|------------|-------------|
| TaskID | long | Always | The task ID associated with the category structure change request. For a simple change, the SetStoreCategories call is processed synchronously. That is, simple changes are made immediately and then the response is returned. For synchronous processing, the task ID in the response is 0. If the category structure changes affect many listings, the changes will be processed asynchronously and the task ID will be a positive number. Use the non-zero task ID with GetStoreCategoryUpdateStatus to monitor the status of asynchronously processed changes. |
| Status | TaskStatusCodeType | Always | When an eBay Store category structure change is processed synchronously, the status is returned as 'Complete' or 'Failed'. For asynchronously processed changes, the status is reported as 'InProgress' or 'Pending'. Use GetStoreCategoryUpdateStatus to monitor the status of asynchronously processed changes. |
| CustomCategory | StoreCustomCategoryArrayType | Always | Contains hierarchy data for eBay Store categories that you have created/modified. |

## Complex Types Reference

### SetStoreCategoriesRequestType

**Description:** This call allows you to set or modify the category structure of an eBay Store. Sellers must have an eBay Store subscription in order to use this call.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| Action | StoreCategoryUpdateActionCodeType | [0..1] | Specifies the type of action (Add, Move, Delete, or Rename) to carry out for the specified eBay Store categories. |
| ItemDestinationCategoryID | long | [0..1] | Items can only be contained within child categories. A parent category cannot contain items. If adding, moving, or deleting categories displaces items, you must specify a destination child category under which the displaced items will be moved. The destination category must have no child categories. |
| DestinationParentCategoryID | long | [0..1] | When adding or moving store categories, specifies the category under which the listed categories will be located. To add or move categories to the top level, set the value to -999. |
| StoreCategories | StoreCustomCategoryArrayType | [0..1] | Specifies the store categories on which to act. |

### SetStoreCategoriesResponseType

**Description:** Base response of the SetStoreCategories call. Returns the status of the eBay Store category changes.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| TaskID | long | [0..1] | The task ID associated with the category structure change request. For a simple change, the SetStoreCategories call is processed synchronously. That is, simple changes are made immediately and then the response is returned. For synchronous processing, the task ID in the response is 0. If the category structure changes affect many listings, the changes will be processed asynchronously and the task ID will be a positive number. Use the non-zero task ID with GetStoreCategoryUpdateStatus to monitor the status of asynchronously processed changes. |
| Status | TaskStatusCodeType | [0..1] | When an eBay Store category structure change is processed synchronously, the status is returned as 'Complete' or 'Failed'. For asynchronously processed changes, the status is reported as 'InProgress' or 'Pending'. Use GetStoreCategoryUpdateStatus to monitor the status of asynchronously processed changes. |
| CustomCategory | StoreCustomCategoryArrayType | [0..1] | Contains hierarchy data for eBay Store categories that you have created/modified. |

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
| SetStoreCategories | Stores API addStoreCategory, | POST |
| SetStoreCategories | Stores API moveStoreCategory, | POST |
| SetStoreCategories | Stores API renameStoreCategory, | PUT |
| SetStoreCategories | Stores API deleteStoreCategory | DELETE |

---

*Source: `/Users/xinyliu/Documents/sddz/GitHub/ebay-public-api-migration-skills copy/resource-for-migration/new_scrape/developer_ebay_com_devzone_xml_docs_reference_ebay_setstorecategories_html.jsonl`; `.trace_artifacts/extract_wsdl_setstorecategories.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
