# ProductDetails - Traditional API

> **Call Name:** ProductDetails
> **API Type:** Traditional API
> **API Version:** Not specified in source
> **Service:** Not specified in source

---

## Metadata

| Property | Value |
|----------|-------|
| **Call Type** | Core |
| **Deprecated** | No |
| **Replacement** | Catalog getProduct; Catalog search |
| **Rate Limit** | Not specified in source |
| **Supported Sites** | Not specified in source |

---

## Description

getProductDetails Use this call to retrieve details for a specific product. The request requires a product identifier, either an eBay-specific identifier (e.g., ePID) or an external identifier, such as a Universal Part Code (UPC).

**Purpose:**
getProductDetails Use this call to retrieve details for a specific product. The request requires a product identifier, either an eBay-specific identifier (e.g., ePID) or an external identifier, such as a Universal Part Code (UPC). The product details consist of name-value pairs that describe the product, such the supplier, display name, or part number.

**Use Cases:**
- Use this operation when working with the corresponding traditional product or metadata flow.
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
Not specified in source
```

### Request Fields

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| productIdentifier | ProductIdentifier | Yes | The product identifier type and value. Product identifiers, such as ePID values or ISBN values, are unique across all sites. |
| datasetPropertyName | string | No | Individual property name from the dataset. You can either enter dataset name or enter individual property names from the dataset. Only one should be preset at a time. |
| dataset | token | No | This will define what are properties that will be returned for this catelog-enabled category. Dataset values: DisplayableProductDetails Properies for use in a user interface to describe products. DisplayableSearchResults Properties for use in results for product searches. Searchable Properties for use in searches. Sortable Properties that are suitable for sorting. User can either enter dataset name or enter individual property names (datasetPropertyName) from the dataset. Only one should be preset at a time. |
| productStatusFilter | ProductStatus | No | Specifies whether or not to filter out the products which are disabled for selling on eBay, disabled for product reviews, or disabled for selling on half.com. |

## Response Structure

### XML Schema

```xml
Not specified in source
```

### Response Fields

| Field Path | Type | Occurrence | Description |
|------------|------|------------|-------------|
| Not specified in source | Not specified in source | Not specified in source | Not specified in source |

## Complex Types Reference

### GetProductDetailsRequest

**Description:** Not specified in source

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| productIdentifier | ProductIdentifier | [1..1] | The product identifier type and value. Product identifiers, such as ePID values or ISBN values, are unique across all sites. |
| datasetPropertyName | string | [0..unbounded] | Individual property name from the dataset. You can either enter dataset name or enter individual property names from the dataset. Only one should be preset at a time. |
| dataset | token | [0..unbounded] | This will define what are properties that will be returned for this catelog-enabled category. Dataset values: DisplayableProductDetails Properies for use in a user interface to describe products. DisplayableSearchResults Properties for use in results for product searches. Searchable Properties for use in searches. Sortable Properties that are suitable for sorting. User can either enter dataset name or enter individual property names (datasetPropertyName) from the dataset. Only one should be preset at a time. |
| productStatusFilter | ProductStatus | [0..1] | Specifies whether or not to filter out the products which are disabled for selling on eBay, disabled for product reviews, or disabled for selling on half.com. |

### GetProductDetailsResponse

**Description:** Not specified in source

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| Not specified in source | Not specified in source | Not specified in source | Not specified in source |

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
| ProductDetails | Catalog getProduct | GET |
| ProductDetails | Catalog search | GET |

---

*Source: `/Users/xinyliu/Documents/sddz/GitHub/ebay-public-api-migration-skills copy/resource-for-migration/new_scrape/developer_ebay_com_devzone_product_callref_getproductdetails_html.jsonl`; `.trace_artifacts/extract_wsdl_productdetails.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
