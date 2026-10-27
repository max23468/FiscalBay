# GetSellerList - Traditional API (SOAP)

> **Call Name:** GetSellerList
> **API Type:** SOAP XML traditional API
> **API Version:** Not specified in source
> **Service:** Traditional

---

## Metadata

| Property | Value |
|----------|-------|
| **Call Type** | Core |
| **Deprecated** | No |
| **Replacement** | sellerListingSearch query of the Listing API |
| **Rate Limit** | Short-duration call rate limit: no more than 300 GetSellerList calls per seller user ID within any 15-second interval. |
| **Supported Sites** | Not specified in source |

---

## Description

Use this call to retrieve items listed by the authenticated user, including item data. GetSellerList returns an array of zero or more items, depending on the user's activity and the inputs used in the call.

**Purpose:**
Retrieve the authenticated seller's listings for a specified start-time or end-time range, with optional filters that narrow the results or increase the amount of returned listing detail.

**Use Cases:**
- Retrieve listings that started during a specified time range.
- Retrieve listings that ended during a specified time range.
- Filter the seller's listings by category, SKU, watch count needs, or response granularity.

**Important Notes:**
- At least one date-range filter must be specified in every request.
- The date range for either the start-time or end-time filter cannot exceed 120 days.
- Pagination is required, and `Pagination.EntriesPerPage` must be set.
- If a `DetailLevel` is used, pagination values must also be set, and no more than 200 items are returned per call.
- If no `DetailLevel` is used, up to 5,000 items can be returned in one call.
- The call has a short-duration limit of 300 calls per seller user ID within 15 seconds.

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
X-EBAY-API-CALL-NAME: GetSellerList
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
<GetSellerListRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>Not specified in source</eBayAuthToken>
  </RequesterCredentials>
  <AdminEndedItemsOnly>boolean</AdminEndedItemsOnly>
  <CategoryID>int</CategoryID>
  <EndTimeFrom>dateTime</EndTimeFrom>
  <EndTimeTo>dateTime</EndTimeTo>
  <GranularityLevel></GranularityLevel>
  <IncludeVariations>boolean</IncludeVariations>
  <IncludeWatchCount>boolean</IncludeWatchCount>
  <MotorsDealerUsers>
    <UserID></UserID>
  </MotorsDealerUsers>
  <Pagination>
    <EntriesPerPage>int</EntriesPerPage>
    <PageNumber>int</PageNumber>
  </Pagination>
  <SKUArray>
    <SKU></SKU>
  </SKUArray>
  <Sort>int</Sort>
  <StartTimeFrom>dateTime</StartTimeFrom>
  <StartTimeTo>dateTime</StartTimeTo>
  <DetailLevel></DetailLevel>
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <OutputSelector>string</OutputSelector>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetSellerListRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| Pagination | PaginationType | Yes | This container controls the maximum number of listings that can appear on one page of the result set, as well as the page number of the result to return. The `EntriesPerPage` value must be set. |

#### Optional Fields

| Field Path | Type | Default | Description | Constraints |
|------------|------|---------|-------------|-------------|
| MotorsDealerUsers | UserIDArrayType | Not specified in source | Specifies the list of Motors Dealer sellers for which a special set of metrics can be requested. Applies to eBay Motors Pro applications only. | Applies to eBay Motors Pro applications only |
| Sort | int | `2 (Ascending)` | Controls the order in which returned listings are sorted by actual or scheduled end date. | Explicit values in source: `1` descending, `2` ascending |
| GranularityLevel | GranularityLevelCodeType | `Coarse` | Controls the amount of data returned in the response. If both `GranularityLevel` and `DetailLevel` are specified, `DetailLevel` is ignored. | Do not use with `DetailLevel` if you expect `DetailLevel` to take effect |
| SKUArray | SKUArrayType | Not specified in source | Limits the response to listings associated with one or more SKUs. Other request criteria still apply. | Listings with matching SKUs are returned regardless of `Item.InventoryTrackingMethod` |
| IncludeWatchCount | boolean | `false` | Returns the watch count for each listing when set to `true`. | None stated beyond boolean behavior |
| AdminEndedItemsOnly | boolean | `false` | Returns listings that were administratively ended by eBay due to a listing policy violation when set to `true`. | None stated beyond boolean behavior |
| CategoryID | int | Not specified in source | Limits the response to listings in the specified category. | Category filter |
| IncludeVariations | boolean | Not specified in source | Returns the `Variations` node for multi-variation listings when set to `true`. | Can increase payload size significantly for sellers with many multi-variation listings |

#### Conditional Fields

| Field Path | Type | Condition | Description |
|------------|------|-----------|-------------|
| EndTimeFrom | dateTime | Use with `EndTimeTo`; either an end-time range or a start-time range is required in every request | Earliest item end time in the date-range filter; the range must be less than 120 days |
| EndTimeTo | dateTime | Required if `EndTimeFrom` is specified | Latest item end time in the date-range filter |
| StartTimeFrom | dateTime | Use with `StartTimeTo`; either a start-time range or an end-time range is required in every request | Earliest item start time in the date-range filter; the range must be less than 120 days |
| StartTimeTo | dateTime | Required if `StartTimeFrom` is specified | Latest item start time in the date-range filter |

## Response Structure

### XML Schema

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetSellerListResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <PaginationResult>
    <TotalNumberOfPages>int</TotalNumberOfPages>
    <TotalNumberOfEntries>int</TotalNumberOfEntries>
  </PaginationResult>
  <HasMoreItems>boolean</HasMoreItems>
  <ItemArray>
    <Item></Item>
  </ItemArray>
  <ItemsPerPage>int</ItemsPerPage>
  <PageNumber>int</PageNumber>
  <ReturnedItemCountActual>int</ReturnedItemCountActual>
  <Seller></Seller>
  <Ack></Ack>
  <Build>string</Build>
  <CorrelationID>string</CorrelationID>
  <Errors>
    <ErrorClassification></ErrorClassification>
    <ErrorCode>token</ErrorCode>
    <ErrorParameters ParamID="string">
      <Value>string</Value>
    </ErrorParameters>
    <LongMessage>string</LongMessage>
    <SeverityCode></SeverityCode>
    <ShortMessage>string</ShortMessage>
  </Errors>
  <HardExpirationWarning>string</HardExpirationWarning>
  <Timestamp>dateTime</Timestamp>
  <Version>string</Version>
</GetSellerListResponse>
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
| PaginationResult | PaginationResultType | Always | Shows the total number of pages in the result set and the total number of listings that match the current input criteria. |
| HasMoreItems | boolean | Always | Returns `true` when more pages remain in the result set and `false` when the current page is the last or only page. |
| ItemArray | ItemArrayType | Always | Contains one or more listings that match the input criteria. If none match, the container is returned as an empty tag. |
| ItemsPerPage | int | Always | Reflects the `Pagination.EntriesPerPage` value from the request and sets the maximum number of listings that may be returned on the current page. |
| PageNumber | int | Always | Reflects the current page in the result set. Defaults to `1` if `Pagination.PageNumber` was not included in the request. |
| ReturnedItemCountActual | int | Always | Indicates the total number of listings shown on the current page of the result set. |
| Seller | UserType | Conditionally | Returned only when `GranularityLevel` is set to `Fine`; contains detailed information about the seller and the seller's account. |

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

### GetSellerListRequestType

**Description:** This call is used to retrieve an array of listings for the seller. The seller must be associated with the user/application token being used to make the call. This call requires that either the Start Time or End Time date-range filters be used, the selected range cannot exceed 120 days, and pagination is also required.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| MotorsDealerUsers | UserIDArrayType | [0..1] | Specifies the list of Motors Dealer sellers for which a special set of metrics can be requested. Applies to eBay Motors Pro applications only. |
| EndTimeFrom | dateTime | [0..1] | Earliest date to use in an end-time range filter. Each time range must be less than 120 days. |
| EndTimeTo | dateTime | [0..1] | Latest date to use in an end-time range filter. Must be specified if `EndTimeFrom` is specified. |
| Sort | int | [0..1] | Controls the order of returned listings by actual or scheduled end date. |
| StartTimeFrom | dateTime | [0..1] | Earliest date to use in a start-time range filter. At least one start-time or end-time range is required in every request. |
| StartTimeTo | dateTime | [0..1] | Latest date to use in a start-time range filter. Must be specified if `StartTimeFrom` is specified. |
| Pagination | PaginationType | [0..1] | Controls entries per page and page number. `EntriesPerPage` must be set for this call. |
| GranularityLevel | GranularityLevelCodeType | [0..1] | Controls how much data is returned in the response. If both `GranularityLevel` and `DetailLevel` are specified, `DetailLevel` is ignored. |
| SKUArray | SKUArrayType | [0..1] | Restricts results to one or more SKUs while still honoring other request criteria. |
| IncludeWatchCount | boolean | [0..1] | Returns the number of watchers for each listing when set to `true`. |
| AdminEndedItemsOnly | boolean | [0..1] | Returns listings administratively ended by eBay due to a listing policy violation when set to `true`. |
| CategoryID | int | [0..1] | Restricts the response to listings in the specified category. |
| IncludeVariations | boolean | [0..1] | Returns the `Variations` node for multi-variation listings when set to `true`. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<GetSellerListRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <AdminEndedItemsOnly>boolean</AdminEndedItemsOnly>
  <CategoryID>int</CategoryID>
  <EndTimeFrom>dateTime</EndTimeFrom>
  <EndTimeTo>dateTime</EndTimeTo>
  <GranularityLevel></GranularityLevel>
  <IncludeVariations>boolean</IncludeVariations>
  <IncludeWatchCount>boolean</IncludeWatchCount>
  <MotorsDealerUsers>
    <UserID></UserID>
  </MotorsDealerUsers>
  <Pagination>
    <EntriesPerPage>int</EntriesPerPage>
    <PageNumber>int</PageNumber>
  </Pagination>
  <SKUArray>
    <SKU></SKU>
  </SKUArray>
  <Sort>int</Sort>
  <StartTimeFrom>dateTime</StartTimeFrom>
  <StartTimeTo>dateTime</StartTimeTo>
</GetSellerListRequest>
```

### GetSellerListResponseType

**Description:** This is the base response type of the `GetSellerList` call. The response includes an array of one or more listings that matched the input criteria, as well as pagination data.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| PaginationResult | PaginationResultType | [0..1] | Shows the total number of pages and the total number of listings that match the current input criteria. |
| HasMoreItems | boolean | [0..1] | Indicates whether more pages remain in the current result set. |
| ItemArray | ItemArrayType | [0..1] | Array of one or more listings that match the input criteria. |
| ItemsPerPage | int | [0..1] | Reflects the value set in `Pagination.EntriesPerPage`. |
| PageNumber | int | [0..1] | Reflects the page number being returned; defaults to `1` if omitted in the request. |
| ReturnedItemCountActual | int | [0..1] | Total number of listings shown on the current page. |
| Seller | UserType | [0..1] | Detailed seller account information returned only when `GranularityLevel` is `Fine`. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<GetSellerListResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <PaginationResult>
    <TotalNumberOfPages>int</TotalNumberOfPages>
    <TotalNumberOfEntries>int</TotalNumberOfEntries>
  </PaginationResult>
  <HasMoreItems>boolean</HasMoreItems>
  <ItemArray>
    <Item></Item>
  </ItemArray>
  <ItemsPerPage>int</ItemsPerPage>
  <PageNumber>int</PageNumber>
  <ReturnedItemCountActual>int</ReturnedItemCountActual>
  <Seller></Seller>
</GetSellerListResponse>
```

---

## Enumerations

### Sort

| Value | Description | Notes |
|-------|-------------|-------|
| `1` | Descending order | Sorts by the listings' actual or scheduled end dates |
| `2` | Ascending order | Default value in WSDL appinfo |

### GranularityLevel

| Value | Description | Notes |
|-------|-------------|-------|
| `Coarse` | Default response granularity | Used when neither `GranularityLevel` nor `DetailLevel` is specified |
| `Fine` | Returns detailed seller account information in `Seller` | Explicitly referenced as the condition for the `Seller` container |

---

## Error Codes

| Error Code | Short Message | Description | Resolution |
|------------|---------------|-------------|------------|
| Source does not provide call-specific error codes | Source does not provide call-specific error codes | The extracted JSONL and WSDL content define the `Errors` container but do not include a GetSellerList-specific error code table. | Use the Traditional API error payload returned at runtime and validate request filters, pagination, and rate-limit behavior. |

---

## Business Rules & Constraints

### Field-Level Constraints

#### StartTimeFrom / StartTimeTo
- **Max Length:** Not specified in source
- **Min Length:** Not specified in source
- **Pattern:** dateTime
- **Allowed Values:** Not specified in source
- **Dependencies:** `StartTimeTo` must be specified if `StartTimeFrom` is specified; the range must be less than 120 days

#### EndTimeFrom / EndTimeTo
- **Max Length:** Not specified in source
- **Min Length:** Not specified in source
- **Pattern:** dateTime
- **Allowed Values:** Not specified in source
- **Dependencies:** `EndTimeTo` must be specified if `EndTimeFrom` is specified; the range must be less than 120 days

#### Pagination
- **Max Length:** Not specified in source
- **Min Length:** Not specified in source
- **Pattern:** Not specified in source
- **Allowed Values:** Not specified in source
- **Dependencies:** `EntriesPerPage` must be set for GetSellerList; `PageNumber` defaults to `1` if omitted

#### IncludeVariations
- **Max Length:** Not specified in source
- **Min Length:** Not specified in source
- **Pattern:** boolean
- **Allowed Values:** `true`, `false`
- **Dependencies:** Can significantly increase response size for sellers with many multi-variation listings

### Operation-Level Rules

1. **Date-range filter required**
   - Description: Every request must specify either a start-time range or an end-time range.
   - Applies when: Any `GetSellerList` request is made.
   - Impact: Requests without at least one date-range filter are invalid.

2. **Date range cannot exceed 120 days**
   - Description: The chosen start-time or end-time range must be less than 120 days.
   - Applies when: `StartTimeFrom`/`StartTimeTo` or `EndTimeFrom`/`EndTimeTo` is used.
   - Impact: Oversized ranges cause request errors.

3. **Pagination is mandatory**
   - Description: `GetSellerList` requires pagination, and `Pagination.EntriesPerPage` must be supplied.
   - Applies when: Any `GetSellerList` request is made.
   - Impact: Requests must be paged; `PageNumber` defaults to `1` when omitted.

4. **Granularity and detail interaction**
   - Description: Either `GranularityLevel` or `DetailLevel` can be used, but if both are specified, `DetailLevel` is ignored.
   - Applies when: Both fields are sent together.
   - Impact: Response shaping follows `GranularityLevel` rather than `DetailLevel`.

### Revision Restrictions (If applicable)

| Condition | Allowed Changes | Prohibited Changes |
|-----------|-----------------|-------------------|
| Source does not describe revision restrictions for this retrieval call | Not applicable | Not applicable |

---

## Rate Limits & Throttling

| Metric | Limit | Window | Notes |
|--------|-------|--------|-------|
| API Calls | Not specified in source | Not specified in source | The source does not provide a daily or longer-window GetSellerList quota. |
| Frequency | 300 calls per seller user ID | 15 seconds | If the limit is exceeded, the calling application is blocked until the block resets after 15 seconds. |

**Throttling Behavior:**
The source states that the GetSellerList call has a short-duration rate limit to protect eBay infrastructure. When the limit is exceeded, the application making the call is blocked, and the user/application must wait 15 seconds for the block to reset.

---

## Best Practices

1. **Use narrow date ranges**
   - Shorter start-time or end-time ranges reduce payload size and help avoid unnecessarily large result sets.

2. **Paginate deliberately**
   - Always set `Pagination.EntriesPerPage`, and increment `Pagination.PageNumber` when `HasMoreItems` is `true`.

3. **Keep response detail conservative**
   - Many item details do not change often, so after an initial download you should retrieve only the information likely to change.

4. **Be careful with rich result options**
   - Using `DetailLevel`, fine-grained results, or `IncludeVariations=true` can enlarge the response and may require more pagination.

---

## Migration Path

### New API Equivalent

| SOAP Operation | New API | Type |
|----------------|---------|------|
| GetSellerList | sellerListingSearch query of the Listing API | Query |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_getsellerlist_html.jsonl`; `src-skills/api-guide-generator/references/wsdl/Trading_API.wsdl` | Generated: 2026-03-25 | Template Version: 1.0.0*
