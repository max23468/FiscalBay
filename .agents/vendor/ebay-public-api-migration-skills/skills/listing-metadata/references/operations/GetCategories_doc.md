# GetCategories - Traditional API (SOAP)

> **Call Name:** GetCategories
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

Note: This call has been deprecated and will be decommissioned on March 31st, 2026. Users are recommended to migrate to the Taxonomy API and Metadata API to retrieve category taxonomy and metadata information.

**Purpose:**
Note: This call has been deprecated and will be decommissioned on March 31st, 2026. Users are recommended to migrate to the Taxonomy API and Metadata API to retrieve category taxonomy and metadata information. See GetCategories Migration Guide for more information.

**Use Cases:**
- Retrieves the category hierarchy for a marketplace.

**Important Notes:**
- Retrieves the category hierarchy for a marketplace.

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
X-EBAY-API-CALL-NAME: GetCategories
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
<GetCategoriesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <CategoryParent>string</CategoryParent>
  <!-- ... more CategoryParent values allowed here ... -->
  <CategorySiteID>string</CategorySiteID>
  <LevelLimit>int</LevelLimit>
  <ViewAllNodes>boolean</ViewAllNodes>
  <!-- Standard Input Fields -->
  <DetailLevel></DetailLevel>
  <!-- ... more DetailLevel values allowed here ... -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <OutputSelector>string</OutputSelector>
  <!-- ... more OutputSelector values allowed here ... -->
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetCategoriesRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| None identified | - | No | No always-required request fields were explicitly labeled in the extracted source. |

#### Optional Fields

| Field Path | Type | Default | Description | Constraints |
|------------|------|---------|-------------|-------------|
| CategoryParent | string | Not specified in source | This field is used if the user wishes to retrieve category hierarchy information on one or more specific eBay categories, and optionally, one or more levels of each category's children (if a category has one or more levels of children). For example, if you wanted to view the entire category hierarchy under the Home & Garden L1 category, you would include this field and set its value to 11700 . As long as the LevelLimit field is omitted, all of Home & Garden 's child categories are returned. If you only wanted to see the next level (L2s) of Home & Garden categories, you would include the LevelLimit field and set its value to 2 , allowing the L1 category ( Home & Garden ) and all of its L2 categories to appear in the response. If you wanted to see all of the Category IDs for the eBay site's L1 categories, you could omit the CategoryParent field but include the LevelLimit field and set its value to 1 . Note: Numerous Category IDs may be specified under multiple CategoryParent fields in a GetCategories request, but if multiple CategoryParent fields are used, the specified Category IDs should all be at the same level (L1, L2, L3, etc.). | Not specified in source |
| LevelLimit | int | Not specified in source | This field is used if the user wants to control the maximum depth of the category hierarchy to retrieve, or in other words, how many levels of eBay categories that are returned in the response. If this field is omitted, every eBay category from the root on down will be returned, or, if a CategoryParent category is specified, the specified category and all of its children (down to the leaf categories) are returned. If the CategoryParent is not used, but the LevelLimit field is used and set to 1 , only the top-level categories (also known as L1 categories) are returned in the response. | Not specified in source |
| ViewAllNodes | boolean | Not specified in source | This flag controls whether all eBay categories (that satisfy input filters) are returned, or only leaf categories (you can only list items in leaf categories) are returned. The default value is 'true', so if this field is omitted, all eBay categories will be returned. If you only want to retrieve leaf categories, include this flag and set it to false . | Not specified in source |

#### Conditional Fields

| Field Path | Type | Condition | Description |
|------------|------|-----------|-------------|
| CategorySiteID | string | No | This field is used if the user wants to retrieve category data for another eBay site (other than the one specified in the X-EBAY-API-SITEID request header). If this field is omitted, the categories from the site specified in the required X-EBAY-API-SITEID request header are returned. If this field is included, the site specified in this field overrides the site ID in the request header. |

## Response Structure

### XML Schema

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetCategoriesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <CategoryArray>
    <Category>
      <AutoPayEnabled>boolean</AutoPayEnabled>
      <B2BVATEnabled>boolean</B2BVATEnabled>
      <BestOfferEnabled>boolean</BestOfferEnabled>
      <CategoryID>string</CategoryID>
      <CategoryLevel>int</CategoryLevel>
      <CategoryName>string</CategoryName>
      <CategoryParentID>string</CategoryParentID>
      <!-- ... more CategoryParentID values allowed here ... -->
      <Expired>boolean</Expired>
      <LeafCategory>boolean</LeafCategory>
      <LSD>boolean</LSD>
      <ORPA>boolean</ORPA>
      <ORRA>boolean</ORRA>
      <Virtual>boolean</Virtual>
    </Category>
    <!-- ... more Category nodes allowed here ... -->
  </CategoryArray>
  <CategoryCount>int</CategoryCount>
  <CategoryVersion>string</CategoryVersion>
  <MinimumReservePrice>double</MinimumReservePrice>
  <ReduceReserveAllowed>boolean</ReduceReserveAllowed>
  <ReservePriceAllowed>boolean</ReservePriceAllowed>
  <UpdateTime>dateTime</UpdateTime>
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
</GetCategoriesResponse>
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
| CategoryArray | CategoryArrayType | Always | List of the returned categories. The category array contains one CategoryType object for each returned category. Returns empty if no detail level is specified. |
| CategoryCount | int | Always | Indicates the number of categories returned (i.e., the number of CategoryType objects in CategoryArray). |
| UpdateTime | dateTime | Always | Indicates the last date and time that eBay modified the category hierarchy for the specified eBay site. |
| CategoryVersion | string | Always | Indicates the version of the category hierarchy on the specified eBay site. |
| ReservePriceAllowed | boolean | Always | If true, ReservePriceAllowed indicates that all categories on the site allow the seller to specify a reserve price for an item. If false, this field is not returned in the response and all categories on the site do not normally allow sellers to specify reserve prices. The Category.ORPA (override reserve price allowed) field can override (or toggle) the reserve price allowed setting for a given category. For example, if ReservePriceAllowed is false and Category.ORPA is true, the category overrides the site setting and supports reserve prices. If ReservePriceAllowed is true and Category.ORPA is true, the category overrides the site setting and does does not support reserve prices. |
| MinimumReservePrice | double | Always | Indicates the lowest possible reserve price allowed for any item listed in any category on the site. You can use the fields returned by GetCategoryFeatures to determine if a different Minimum Reserve Price is defined for the category you want to use. |
| ReduceReserveAllowed | boolean | Always | If true, ReduceReserveAllowed indicates that all categories on the site allow the seller to reduce an item's reserve price. If false, this field is not returned in the response and all categories on the site do not normally allow sellers to reduce an item's reserve price. The Category.ORRA (override reduce reserve price) field can override (or toggle) the reserve price reduction setting for a given category. For example, if ReduceReserveAllowed is false and Category.ORRA is true, the category overrides the site setting and supports reducing reserve prices. If ReduceReserveAllowed is true and Category.ORRA is true, the category overrides the site setting and does does not support reducing reserve prices. |

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

### GetCategoriesRequestType

**Description:** Retrieves the latest eBay category hierarchy for a given eBay site. Information returned for each category includes the category name and the unique ID for the category (unique within the eBay site for which categories are retrieved). A category ID is a required input when you list most items.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| CategorySiteID | string | [0..1] | This field is used if the user wants to retrieve category data for another eBay site (other than the one specified in the X-EBAY-API-SITEID request header). If this field is omitted, the categories from the site specified in the required X-EBAY-API-SITEID request header are returned. If this field is included, the site specified in this field overrides the site ID in the request header. |
| CategoryParent | string | [0..unbounded] | This field is used if the user wishes to retrieve category hierarchy information on one or more specific eBay categories, and optionally, one or more levels of each category's children (if a category has one or more levels of children). For example, if you wanted to view the entire category hierarchy under the Home & Garden L1 category, you would include this field and set its value to 11700 . As long as the LevelLimit field is omitted, all of Home & Garden 's child categories are returned. If you only wanted to see the next level (L2s) of Home & Garden categories, you would include the LevelLimit field and set its value to 2 , allowing the L1 category ( Home & Garden ) and all of its L2 categories to appear in the response. If you wanted to see all of the Category IDs for the eBay site's L1 categories, you could omit the CategoryParent field but include the LevelLimit field and set its value to 1 . Note: Numerous Category IDs may be specified under multiple CategoryParent fields in a GetCategories request, but if multiple CategoryParent fields are used, the specified Category IDs should all be at the same level (L1, L2, L3, etc.). |
| LevelLimit | int | [0..1] | This field is used if the user wants to control the maximum depth of the category hierarchy to retrieve, or in other words, how many levels of eBay categories that are returned in the response. If this field is omitted, every eBay category from the root on down will be returned, or, if a CategoryParent category is specified, the specified category and all of its children (down to the leaf categories) are returned. If the CategoryParent is not used, but the LevelLimit field is used and set to 1 , only the top-level categories (also known as L1 categories) are returned in the response. |
| ViewAllNodes | boolean | [0..1] | This flag controls whether all eBay categories (that satisfy input filters) are returned, or only leaf categories (you can only list items in leaf categories) are returned. The default value is 'true', so if this field is omitted, all eBay categories will be returned. If you only want to retrieve leaf categories, include this flag and set it to false . |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<GetCategoriesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <CategoryParent>string</CategoryParent>
  <!-- ... more CategoryParent values allowed here ... -->
  <CategorySiteID>string</CategorySiteID>
  <LevelLimit>int</LevelLimit>
  <ViewAllNodes>boolean</ViewAllNodes>
  <!-- Standard Input Fields -->
  <DetailLevel></DetailLevel>
  <!-- ... more DetailLevel values allowed here ... -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <OutputSelector>string</OutputSelector>
  <!-- ... more OutputSelector values allowed here ... -->
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetCategoriesRequest>
```

### GetCategoriesResponseType

**Description:** Contains the category data for the eBay site specified as input. The category data is contained in a CategoryArrayType object, within which are zero, one, or multiple CategoryType objects. Each CategoryType object contains the detail data for one category. Other fields tell how many categories are returned in a call, when the category hierarchy was last updated, and the version of the category hierarchy (all three of which can differ from one eBay site to the next).

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| CategoryArray | CategoryArrayType | [0..1] | List of the returned categories. The category array contains one CategoryType object for each returned category. Returns empty if no detail level is specified. |
| CategoryCount | int | [0..1] | Indicates the number of categories returned (i.e., the number of CategoryType objects in CategoryArray). |
| UpdateTime | dateTime | [0..1] | Indicates the last date and time that eBay modified the category hierarchy for the specified eBay site. |
| CategoryVersion | string | [0..1] | Indicates the version of the category hierarchy on the specified eBay site. |
| ReservePriceAllowed | boolean | [0..1] | If true, ReservePriceAllowed indicates that all categories on the site allow the seller to specify a reserve price for an item. If false, this field is not returned in the response and all categories on the site do not normally allow sellers to specify reserve prices. The Category.ORPA (override reserve price allowed) field can override (or toggle) the reserve price allowed setting for a given category. For example, if ReservePriceAllowed is false and Category.ORPA is true, the category overrides the site setting and supports reserve prices. If ReservePriceAllowed is true and Category.ORPA is true, the category overrides the site setting and does does not support reserve prices. |
| MinimumReservePrice | double | [0..1] | Indicates the lowest possible reserve price allowed for any item listed in any category on the site. You can use the fields returned by GetCategoryFeatures to determine if a different Minimum Reserve Price is defined for the category you want to use. |
| ReduceReserveAllowed | boolean | [0..1] | If true, ReduceReserveAllowed indicates that all categories on the site allow the seller to reduce an item's reserve price. If false, this field is not returned in the response and all categories on the site do not normally allow sellers to reduce an item's reserve price. The Category.ORRA (override reduce reserve price) field can override (or toggle) the reserve price reduction setting for a given category. For example, if ReduceReserveAllowed is false and Category.ORRA is true, the category overrides the site setting and supports reducing reserve prices. If ReduceReserveAllowed is true and Category.ORRA is true, the category overrides the site setting and does does not support reducing reserve prices. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<GetCategoriesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <CategoryArray>
    <Category>
      <AutoPayEnabled>boolean</AutoPayEnabled>
      <B2BVATEnabled>boolean</B2BVATEnabled>
      <BestOfferEnabled>boolean</BestOfferEnabled>
      <CategoryID>string</CategoryID>
      <CategoryLevel>int</CategoryLevel>
      <CategoryName>string</CategoryName>
      <CategoryParentID>string</CategoryParentID>
      <!-- ... more CategoryParentID values allowed here ... -->
      <Expired>boolean</Expired>
      <LeafCategory>boolean</LeafCategory>
      <LSD>boolean</LSD>
      <ORPA>boolean</ORPA>
      <ORRA>boolean</ORRA>
      <Virtual>boolean</Virtual>
    </Category>
    <!-- ... more Category nodes allowed here ... -->
  </CategoryArray>
  <CategoryCount>int</CategoryCount>
  <CategoryVersion>string</CategoryVersion>
  <MinimumReservePrice>double</MinimumReservePrice>
  <ReduceReserveAllowed>boolean</ReduceReserveAllowed>
  <ReservePriceAllowed>boolean</ReservePriceAllowed>
  <UpdateTime>dateTime</UpdateTime>
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
</GetCategoriesResponse>
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

1. Category-tree retrieval depends on requested site/category scope.

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
| GetCategories | Taxonomy getDefaultCategoryTreeId | GET |
| GetCategories | Taxonomy getCategoryTree | GET |
| GetCategories | Taxonomy getCategorySubtree | GET |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_getcategories_html.jsonl`; `.trace_artifacts/extract_wsdl_getcategories.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
