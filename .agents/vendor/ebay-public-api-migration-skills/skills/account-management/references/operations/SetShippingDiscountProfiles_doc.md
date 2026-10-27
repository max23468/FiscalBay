# SetShippingDiscountProfiles - Traditional API (SOAP)

> **Call Name:** SetShippingDiscountProfiles
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

This call enables a seller to define shipping cost discount profiles for things such as combined payments for shipping and handling costs (known as Combined Invoice orders). You can test this call in the Sandbox, as follows: Use My eBay in the Sandbox web site to become familiar with shipping discount profiles.

**Purpose:**
This call enables a seller to define shipping cost discount profiles for things such as combined payments for shipping and handling costs (known as Combined Invoice orders). You can test this call in the Sandbox, as follows: Use My eBay in the Sandbox web site to become familiar with shipping discount profiles. Call GetShippingDiscountProfiles to see what profiles and details have been defined for the seller, if any.

**Use Cases:**
- Sets shipping discount profile configuration.

**Important Notes:**
- Sets shipping discount profile configuration.

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
X-EBAY-API-CALL-NAME: SetShippingDiscountProfiles
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
<SetShippingDiscountProfilesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <CalculatedHandlingDiscount>
    <DiscountName></DiscountName>
    <EachAdditionalAmount currencyID="CurrencyCodeType">
    </EachAdditionalAmount>
    <EachAdditionalOffAmount currencyID="CurrencyCodeType">
    </EachAdditionalOffAmount>
    <EachAdditionalPercentOff>float</EachAdditionalPercentOff>
    <OrderHandlingAmount currencyID="CurrencyCodeType">
    </OrderHandlingAmount>
  </CalculatedHandlingDiscount>
  <CalculatedShippingDiscount>
    <DiscountName></DiscountName>
    <DiscountProfile>
      <DiscountProfileID>string</DiscountProfileID>
      <DiscountProfileName>string</DiscountProfileName>
      <MappedDiscountProfileID>string</MappedDiscountProfileID>
      <WeightOff></WeightOff>
    </DiscountProfile>
    <!-- ... more DiscountProfile nodes allowed here ... -->
  </CalculatedShippingDiscount>
  <CombinedDuration></CombinedDuration>
  <CurrencyID></CurrencyID>
  <FlatShippingDiscount>
    <DiscountName></DiscountName>
    <DiscountProfile>
      <DiscountProfileID>string</DiscountProfileID>
      <DiscountProfileName>string</DiscountProfileName>
      <EachAdditionalAmount currencyID="CurrencyCodeType">
      </EachAdditionalAmount>
      <EachAdditionalAmountOff currencyID="CurrencyCodeType">
      </EachAdditionalAmountOff>
      <EachAdditionalPercentOff>float</EachAdditionalPercentOff>
    </DiscountProfile>
    <!-- ... more DiscountProfile nodes allowed here ... -->
  </FlatShippingDiscount>
  <ModifyActionCode></ModifyActionCode>
  <PromotionalShippingDiscountDetails>
    <DiscountName></DiscountName>
    <ItemCount>int</ItemCount>
    <OrderAmount currencyID="CurrencyCodeType">
    </OrderAmount>
    <ShippingCost currencyID="CurrencyCodeType">
    </ShippingCost>
  </PromotionalShippingDiscountDetails>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</SetShippingDiscountProfilesRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| CombinedDuration | CombinedPaymentPeriodCodeType | Yes | This field is used to specify the number of days after the purchase of an item that the buyer or seller can combine multiple and mutual order line items into one Combined Invoice order. In a Combined Invoice order, the buyer makes one payment for all order line items, hence only unpaid order line items can be combined into a Combined Invoice order. |
| ModifyActionCode | ModifyActionCodeType | Yes | This field is used to set which action is being taken ( Add , Update , or Delete ) in the call. If you are adding a shipping discount rule, you will have to supply a name for that shipping discount profile. If you want to update or delete a shipping discount profile, you'll have to provide the unique identifier of this rule through the corresponding containers. The unique identifiers of these rules can be retrieved with the GetShippingDiscountRules call, or the seller can view these identifiers in My eBay Shipping Preferences. |

#### Optional Fields

| Field Path | Type | Default | Description | Constraints |
|------------|------|---------|-------------|-------------|
| FlatShippingDiscount | FlatShippingDiscountType | Not specified in source | This container allows you to create, update, or delete a flat-rate shipping discount profile. | Not specified in source |
| CalculatedShippingDiscount | CalculatedShippingDiscountType | Not specified in source | This container allows you to create, update, or delete a calculated shipping discount profile. | Not specified in source |
| CalculatedHandlingDiscount | CalculatedHandlingDiscountType | Not specified in source | This container allows you to create, update, or delete a calculated handling discount profile. | Not specified in source |
| PromotionalShippingDiscountDetails | PromotionalShippingDiscountDetailsType | Not specified in source | This container allows you to create, update, or delete a promotional shipping discount profile. | Not specified in source |

#### Conditional Fields

| Field Path | Type | Condition | Description |
|------------|------|-----------|-------------|
| CurrencyID | CurrencyCodeType | Conditionally | The three-digit code of the currency to be used for shipping discounts on Combined Invoice orders. A discount profile can only be associated with a listing if the CurrencyID value of the profile matches the Item.Currency value specified in a listing. This field is required if the user is adding or updating one or more shipping discount profiles. Note that There is a currencyID attribute on all SetShippingDiscountProfiles elements involving money. To avoid a call error, be sure to use the same currency type in these attributes as what is set for the CurrencyID field. |

## Response Structure

### XML Schema

```xml
<?xml version="1.0" encoding="utf-8"?>
<SetShippingDiscountProfilesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
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
</SetShippingDiscountProfilesResponse>
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

### SetShippingDiscountProfilesRequestType

**Description:** This call enables a seller to create and manage shipping discounts rules. These are the same shipping discount rules that can be created or managed in My eBay Shipping Preferences. The types of shipping discount rules that can be created and managed with this call include flat-rate shipping rules, calculated shipping rules, and promotional shipping rules. This call can also be used by sellers to set whether or not they allow buyers to combine separate line items into one Combined Invoice order, and how many days they allow buyers to perform that action. A seller can only create, update, or delete one discount rule type with each call. The action to take (either Add , Update , or Delete ) is set and controlled with the ModifyActionCode field.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| CurrencyID | CurrencyCodeType | [0..1] | The three-digit code of the currency to be used for shipping discounts on Combined Invoice orders. A discount profile can only be associated with a listing if the CurrencyID value of the profile matches the Item.Currency value specified in a listing. This field is required if the user is adding or updating one or more shipping discount profiles. Note that There is a currencyID attribute on all SetShippingDiscountProfiles elements involving money. To avoid a call error, be sure to use the same currency type in these attributes as what is set for the CurrencyID field. |
| CombinedDuration | CombinedPaymentPeriodCodeType | [0..1] | This field is used to specify the number of days after the purchase of an item that the buyer or seller can combine multiple and mutual order line items into one Combined Invoice order. In a Combined Invoice order, the buyer makes one payment for all order line items, hence only unpaid order line items can be combined into a Combined Invoice order. |
| ModifyActionCode | ModifyActionCodeType | [0..1] | This field is used to set which action is being taken ( Add , Update , or Delete ) in the call. If you are adding a shipping discount rule, you will have to supply a name for that shipping discount profile. If you want to update or delete a shipping discount profile, you'll have to provide the unique identifier of this rule through the corresponding containers. The unique identifiers of these rules can be retrieved with the GetShippingDiscountRules call, or the seller can view these identifiers in My eBay Shipping Preferences. |
| FlatShippingDiscount | FlatShippingDiscountType | [0..1] | This container allows you to create, update, or delete a flat-rate shipping discount profile. |
| CalculatedShippingDiscount | CalculatedShippingDiscountType | [0..1] | This container allows you to create, update, or delete a calculated shipping discount profile. |
| CalculatedHandlingDiscount | CalculatedHandlingDiscountType | [0..1] | This container allows you to create, update, or delete a calculated handling discount profile. |
| PromotionalShippingDiscountDetails | PromotionalShippingDiscountDetailsType | [0..1] | This container allows you to create, update, or delete a promotional shipping discount profile. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<SetShippingDiscountProfilesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <CalculatedHandlingDiscount>
    <DiscountName></DiscountName>
    <EachAdditionalAmount currencyID="CurrencyCodeType">
    </EachAdditionalAmount>
    <EachAdditionalOffAmount currencyID="CurrencyCodeType">
    </EachAdditionalOffAmount>
    <EachAdditionalPercentOff>float</EachAdditionalPercentOff>
    <OrderHandlingAmount currencyID="CurrencyCodeType">
    </OrderHandlingAmount>
  </CalculatedHandlingDiscount>
  <CalculatedShippingDiscount>
    <DiscountName></DiscountName>
    <DiscountProfile>
      <DiscountProfileID>string</DiscountProfileID>
      <DiscountProfileName>string</DiscountProfileName>
      <MappedDiscountProfileID>string</MappedDiscountProfileID>
      <WeightOff></WeightOff>
    </DiscountProfile>
    <!-- ... more DiscountProfile nodes allowed here ... -->
  </CalculatedShippingDiscount>
  <CombinedDuration></CombinedDuration>
  <CurrencyID></CurrencyID>
  <FlatShippingDiscount>
    <DiscountName></DiscountName>
    <DiscountProfile>
      <DiscountProfileID>string</DiscountProfileID>
      <DiscountProfileName>string</DiscountProfileName>
      <EachAdditionalAmount currencyID="CurrencyCodeType">
      </EachAdditionalAmount>
      <EachAdditionalAmountOff currencyID="CurrencyCodeType">
      </EachAdditionalAmountOff>
      <EachAdditionalPercentOff>float</EachAdditionalPercentOff>
    </DiscountProfile>
    <!-- ... more DiscountProfile nodes allowed here ... -->
  </FlatShippingDiscount>
  <ModifyActionCode></ModifyActionCode>
  <PromotionalShippingDiscountDetails>
    <DiscountName></DiscountName>
    <ItemCount>int</ItemCount>
    <OrderAmount currencyID="CurrencyCodeType">
    </OrderAmount>
    <ShippingCost currencyID="CurrencyCodeType">
    </ShippingCost>
  </PromotionalShippingDiscountDetails>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</SetShippingDiscountProfilesRequest>
```

### SetShippingDiscountProfilesResponseType

**Description:** Not specified in source

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| Not specified in source | Not specified in source | Not specified in source | Not specified in source |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<SetShippingDiscountProfilesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
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
</SetShippingDiscountProfilesResponse>
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

1. Discount profile changes affect the authenticated seller account.

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
| SetShippingDiscountProfiles | Account API v2 createCalculatedShippingRules | POST |
| SetShippingDiscountProfiles | Account API v2 createFlatShippingRules | POST |
| SetShippingDiscountProfiles | Account API v2 createPromotionalShippingRule | POST |
| SetShippingDiscountProfiles | Account API v2 updateCalculatedShippingRules | POST |
| SetShippingDiscountProfiles | Account API v2 updateCombinedPayments | POST |
| SetShippingDiscountProfiles | Account API v2 updateFlatShippingRules | POST |
| SetShippingDiscountProfiles | Account API v2 updatePromotionalShippingRule | POST |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_setshippingdiscountprofiles_html.jsonl`; `.trace_artifacts/extract_wsdl_setshippingdiscountprofiles.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
