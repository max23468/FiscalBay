# GetStore - Traditional API

> **Call Name:** GetStore
> **API Type:** Traditional API
> **API Version:** 1131
> **Service:** Not specified in source

---

## Metadata

| Property | Value |
|----------|-------|
| **Call Type** | Core |
| **Deprecated** | Not specified in source |
| **Replacement** | Stores API getStore; Stores API getStoreCategories |
| **Rate Limit** | Not specified in source |
| **Supported Sites** | Not specified in source |

---

## Description

GetStore Use this call to retrieve information for an eBay store. Testing GetStore You can test this call in the Sandbox, as follows: With a test user, use SetStore to create an eBay Store in the Sandbox environment.

**Purpose:**
GetStore Use this call to retrieve information for an eBay store. Testing GetStore You can test this call in the Sandbox, as follows: With a test user, use SetStore to create an eBay Store in the Sandbox environment. Call GetStore to retrieve the details for that store.

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
<GetStoreRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <CategoryStructureOnly>boolean</CategoryStructureOnly>
  <LevelLimit>int</LevelLimit>
  <RootCategoryID>long</RootCategoryID>
  <UserID>string</UserID>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel></GetStoreRequest>
```

### Request Fields

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| CategoryStructureOnly | boolean | No | Include this field and set its value to true if you wish to restrict the call response to only the store category hierarchy data. |
| RootCategoryID | long | No | The unique identifier of an eBay Store category. This field is used if the user wants to isolate the category hierarchy data to one particular eBay category (and its subcategories if applicable). The LevelLimit value will determine how many additional levels of categories are returned. |
| LevelLimit | int | No | This field allows the seller to limit the number of levels of eBay Store categories that are returned. To return only top-level eBay Store categories, the user can include this field and set its value to 1 (and not use a RootCategoryID value). To retrieve a specific eBay Store Category and that category's child categories, the user could specify the unique eBay Store Category ID in the RootCategoryID field and then set the LevelLimit value to 2 . If LevelLimit is omitted, the complete eBay Store Category hierarchy is returned, or all of specified store category's child categories. eBay Stores support only three levels of store categories. |
| UserID | UserIDType | No | The eBay user ID of the eBay seller that owns the eBay Store to be retrieved. This field is only needed if the user wants to view the eBay Store information owned by a different seller (than the seller associated with the authenticated user token). If this field is omitted, the eBay Store information for the seller associated with the authenticated user token is returned. |

## Response Structure

### XML Schema

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetStoreResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <Store>
    <CustomCategories>
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
      <!-- ... more CustomCategory nodes allowed here ... --></CustomCategories>
    <Description>string</Description>
    <LastOpenedTime>dateTime</LastOpenedTime>
    <Logo>
      <URL>anyURI</URL></Logo>
    <Name>string</Name>
    <URL>anyURI</URL>
    <URLPath>string</URLPath></Store>
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
  <Version>string</Version></GetStoreResponse>
```

### Response Fields

| Field Path | Type | Occurrence | Description |
|------------|------|------------|-------------|
| Store | StoreType | Always | This container consists of detailed information on the seller's eBay Store. |

## Complex Types Reference

### GetStoreRequestType

**Description:** This call is used to retrieve information on a seller's eBay Store, including detailed information on all customized Store categories that the seller has set up.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| CategoryStructureOnly | boolean | [0..1] | Include this field and set its value to true if you wish to restrict the call response to only the store category hierarchy data. |
| RootCategoryID | long | [0..1] | The unique identifier of an eBay Store category. This field is used if the user wants to isolate the category hierarchy data to one particular eBay category (and its subcategories if applicable). The LevelLimit value will determine how many additional levels of categories are returned. |
| LevelLimit | int | [0..1] | This field allows the seller to limit the number of levels of eBay Store categories that are returned. To return only top-level eBay Store categories, the user can include this field and set its value to 1 (and not use a RootCategoryID value). To retrieve a specific eBay Store Category and that category's child categories, the user could specify the unique eBay Store Category ID in the RootCategoryID field and then set the LevelLimit value to 2 . If LevelLimit is omitted, the complete eBay Store Category hierarchy is returned, or all of specified store category's child categories. eBay Stores support only three levels of store categories. |
| UserID | UserIDType | [0..1] | The eBay user ID of the eBay seller that owns the eBay Store to be retrieved. This field is only needed if the user wants to view the eBay Store information owned by a different seller (than the seller associated with the authenticated user token). If this field is omitted, the eBay Store information for the seller associated with the authenticated user token is returned. |

### GetStoreResponseType

**Description:** The base response type of the GetStore call. This response consists of the data describing a seller's eBay store, and includes the eBay Store name, the description of the store, the URL to the eBay Store, and eBay Store Category hierarchy.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| Store | StoreType | [0..1] | This container consists of detailed information on the seller's eBay Store. |

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
| GetStore | Stores API getStore | GET |
| GetStore | Stores API getStoreCategories | GET |

---

*Source: `/Users/xinyliu/Documents/sddz/GitHub/ebay-public-api-migration-skills copy/resource-for-migration/new_scrape/developer_ebay_com_devzone_xml_docs_reference_ebay_getstore_html.jsonl`; `.trace_artifacts/extract_wsdl_getstore.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
