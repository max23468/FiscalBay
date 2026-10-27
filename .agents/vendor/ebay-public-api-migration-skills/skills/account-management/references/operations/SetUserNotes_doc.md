# SetUserNotes - Traditional API (SOAP)

> **Call Name:** SetUserNotes
> **API Type:** SOAP XML traditional API
> **API Version:** 1125
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

Use this call to add, replace, and delete My eBay notes for items that are being tracked in the My eBay Selling and Buying areas. You can use SetUserNotes to add notes to items that are being tracked in a user's My eBay page, including items the user is selling, items the user is bidding on, and items in the user's watch list.

**Purpose:**
Use this call to add, replace, and delete My eBay notes for items that are being tracked in the My eBay Selling and Buying areas. You can use SetUserNotes to add notes to items that are being tracked in a user's My eBay page, including items the user is selling, items the user is bidding on, and items in the user's watch list. A note is a small piece of text that can be used however a user wants, although its intended use is to help a user attach additional reminders to an item, such as "This item would make a great gift for Mom." If the call to SetUserNotes is successful, it returns the fields of the abstract response object (there are no call-specific return fields).

**Use Cases:**
- Sets notes for a user or transaction context.

**Important Notes:**
- Sets notes for a user or transaction context.

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
X-EBAY-API-COMPATIBILITY-LEVEL: 1125
X-EBAY-API-CALL-NAME: SetUserNotes
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
<SetUserNotesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <Action></Action>
  <ItemID></ItemID>
  <NoteText>string</NoteText>
  <OrderLineItemID>string</OrderLineItemID>
  <SKU></SKU>
  <TransactionID>string</TransactionID>
  <VariationSpecifics>
    <NameValueList>
      <Name>string</Name>
      <Value>string</Value>
      <!-- ... more Value values allowed here ... -->
    </NameValueList>
    <!-- ... more NameValueList nodes allowed here ... -->
  </VariationSpecifics>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</SetUserNotesRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| Action | SetUserNotesActionCodeType | Yes | The seller must include this field and set it to 'AddOrUpdate' to add a new user note or update an existing user note, or set it to 'Delete' to delete an existing user note. |

#### Optional Fields

| Field Path | Type | Default | Description | Constraints |
|------------|------|---------|-------------|-------------|
| TransactionID | string | Not specified in source | Unique identifier for the order line item to which the My eBay note will be attached. Notes can only be added to order line items that are currently being tracked in My eBay. Buyers can view user notes made on order line items in the PrivateNotes field of the WonList container in GetMyeBayBuying , and sellers can view user notes made on order line items in the PrivateNotes field of the SoldList and DeletedFromSoldList containers in GetMyeBaySellinging . The TransactionID value for auction listings is always 0 since there can be only one winning bidder/one sale for an auction listing. Note: Beginning in July 2024, non-zero transaction IDs will start being returned for auction listings. If necessary, update code to handle non-zero transaction IDs for auction transactions before this time. | Not specified in source |
| VariationSpecifics | NameValueListArrayType | Not specified in source | Container consisting of name-value pairs that identify (match) one variation within a fixed-price, multiple-variation listing. The specified name-value pair(s) must exist in the listing specified by either the ItemID or SKU values specified in the request. If a specific order line item is targeted in the request with an ItemID / TransactionID pair or an OrderLineItemID value, any specified VariationSpecifics container is ignored by the call. | Not specified in source |
| SKU | SKUType | Not specified in source | SKU value of the item variation to which the My eBay note will be attached. Notes can only be added to items that are currently being tracked in My eBay. A SKU (stock keeping unit) value is defined by and used by the seller to identify a variation within a fixed-price, multiple- variation listing. The SKU value is assigned to a variation of an item through the Variations.Variation.SKU element. This field can only be used if the Item.InventoryTrackingMethod field (set with the AddFixedPriceItem or RelistFixedPriceItem calls) is set to SKU. If a specific order line item is targeted in the request with an ItemID / TransactionID pair or an OrderLineItemID value, any specified SKU is ignored by the call. | Not specified in source |

#### Conditional Fields

| Field Path | Type | Condition | Description |
|------------|------|-----------|-------------|
| ItemID | ItemIDType | Conditionally | Unique identifier of the listing to which the My eBay note will be attached. Notes can only be added to items that are currently being tracked in My eBay. |
| NoteText | string | Conditionally | This field is needed if the Action is AddOrUpdate . The text supplied in this field will completely replace any existing My eBay note for the specified item. |
| OrderLineItemID | string | Conditionally | A unique identifier for an eBay order line item. This field is created as soon as there is a commitment to buy from the seller. OrderLineItemID can be used in the input instead of an ItemID / TransactionID pair to identify an order line item. Notes can only be added to order line items that are currently being tracked in My eBay. Buyers can view user notes made on order line items in the PrivateNotes field of the WonList container in GetMyeBayBuying , and sellers can view user notes made on order line items in the PrivateNotes field of the SoldList and DeletedFromSoldList containers in GetMyeBaySellinging . |

## Response Structure

### XML Schema

```xml
<?xml version="1.0" encoding="utf-8"?>
<SetUserNotesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- (No call-specific Output fields) -->
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
</SetUserNotesResponse>
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
| Not specified in source | Not specified in source | Not specified in source | Not specified in source |

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

### SetUserNotesRequestType

**Description:** Enables users to add, modify, or delete a pinned note for any item that is being tracked in the My eBay All Selling and All Buying areas.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| ItemID | ItemIDType | [0..1] | Unique identifier of the listing to which the My eBay note will be attached. Notes can only be added to items that are currently being tracked in My eBay. |
| Action | SetUserNotesActionCodeType | [0..1] | The seller must include this field and set it to 'AddOrUpdate' to add a new user note or update an existing user note, or set it to 'Delete' to delete an existing user note. |
| NoteText | string | [0..1] | This field is needed if the Action is AddOrUpdate . The text supplied in this field will completely replace any existing My eBay note for the specified item. |
| TransactionID | string | [0..1] | Unique identifier for the order line item to which the My eBay note will be attached. Notes can only be added to order line items that are currently being tracked in My eBay. Buyers can view user notes made on order line items in the PrivateNotes field of the WonList container in GetMyeBayBuying , and sellers can view user notes made on order line items in the PrivateNotes field of the SoldList and DeletedFromSoldList containers in GetMyeBaySellinging . The TransactionID value for auction listings is always 0 since there can be only one winning bidder/one sale for an auction listing. Note: Beginning in July 2024, non-zero transaction IDs will start being returned for auction listings. If necessary, update code to handle non-zero transaction IDs for auction transactions before this time. |
| VariationSpecifics | NameValueListArrayType | [0..1] | Container consisting of name-value pairs that identify (match) one variation within a fixed-price, multiple-variation listing. The specified name-value pair(s) must exist in the listing specified by either the ItemID or SKU values specified in the request. If a specific order line item is targeted in the request with an ItemID / TransactionID pair or an OrderLineItemID value, any specified VariationSpecifics container is ignored by the call. |
| SKU | SKUType | [0..1] | SKU value of the item variation to which the My eBay note will be attached. Notes can only be added to items that are currently being tracked in My eBay. A SKU (stock keeping unit) value is defined by and used by the seller to identify a variation within a fixed-price, multiple- variation listing. The SKU value is assigned to a variation of an item through the Variations.Variation.SKU element. This field can only be used if the Item.InventoryTrackingMethod field (set with the AddFixedPriceItem or RelistFixedPriceItem calls) is set to SKU. If a specific order line item is targeted in the request with an ItemID / TransactionID pair or an OrderLineItemID value, any specified SKU is ignored by the call. |
| OrderLineItemID | string | [0..1] | A unique identifier for an eBay order line item. This field is created as soon as there is a commitment to buy from the seller. OrderLineItemID can be used in the input instead of an ItemID / TransactionID pair to identify an order line item. Notes can only be added to order line items that are currently being tracked in My eBay. Buyers can view user notes made on order line items in the PrivateNotes field of the WonList container in GetMyeBayBuying , and sellers can view user notes made on order line items in the PrivateNotes field of the SoldList and DeletedFromSoldList containers in GetMyeBaySellinging . |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<SetUserNotesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <Action></Action>
  <ItemID></ItemID>
  <NoteText>string</NoteText>
  <OrderLineItemID>string</OrderLineItemID>
  <SKU></SKU>
  <TransactionID>string</TransactionID>
  <VariationSpecifics>
    <NameValueList>
      <Name>string</Name>
      <Value>string</Value>
      <!-- ... more Value values allowed here ... -->
    </NameValueList>
    <!-- ... more NameValueList nodes allowed here ... -->
  </VariationSpecifics>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</SetUserNotesRequest>
```

### SetUserNotesResponseType

**Description:** Not specified in source

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| Not specified in source | Not specified in source | Not specified in source | Not specified in source |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<SetUserNotesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- (No call-specific Output fields) -->
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
</SetUserNotesResponse>
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

1. Notes are private to the authenticated user context.

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
| SetUserNotes | User Note API createOrReplaceUserNote | Mutation |
| SetUserNotes | User Note API deleteUserNote | Mutation |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_setusernotes_html.jsonl`; `.trace_artifacts/extract_wsdl_setusernotes.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
