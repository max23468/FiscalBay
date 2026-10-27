# GetShippingDiscountProfiles - Traditional API (SOAP)

> **Call Name:** GetShippingDiscountProfiles
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

This call returns the shipping discount profiles defined by the user, along with the current settings for packaging and handling costs for Combined Invoice . You can test this call in the Sandbox, as follows: Use My eBay in the Sandbox web site to define one or more flat rate shipping profiles, one or more calculated shipping profiles and a promotional discount.

**Purpose:**
This call returns the shipping discount profiles defined by the user, along with the current settings for packaging and handling costs for Combined Invoice . You can test this call in the Sandbox, as follows: Use My eBay in the Sandbox web site to define one or more flat rate shipping profiles, one or more calculated shipping profiles and a promotional discount. Call GetShippingDiscountProfiles to see what profiles and details have been defined for the seller, if any.

**Use Cases:**
- Retrieves shipping discount profile configuration.

**Important Notes:**
- Retrieves shipping discount profile configuration.

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
X-EBAY-API-CALL-NAME: GetShippingDiscountProfiles
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
<GetShippingDiscountProfilesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- (No call-specific Input fields) -->
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetShippingDiscountProfilesRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| None identified | - | No | No always-required request fields were explicitly labeled in the extracted source. |

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
<GetShippingDiscountProfilesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
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
      <WeightOff unit="token" measurementSystem="MeasurementSystemCodeType">
      </WeightOff>
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
  <PromotionalShippingDiscount>boolean</PromotionalShippingDiscount>
  <PromotionalShippingDiscountDetails>
    <DiscountName></DiscountName>
    <ItemCount>int</ItemCount>
    <OrderAmount currencyID="CurrencyCodeType">
    </OrderAmount>
    <ShippingCost currencyID="CurrencyCodeType">
    </ShippingCost>
  </PromotionalShippingDiscountDetails>
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
</GetShippingDiscountProfilesResponse>
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
| CurrencyID | CurrencyCodeType | Always | The three-digit code of the currency to be used for shipping cost discounts. A discount profile can only be associated with a listing if the CurrencyID value of the profile matches the Item.Currency value specified in a listing. |
| FlatShippingDiscount | FlatShippingDiscountType | Always | This container consists of one or more flat-rate shipping discount rules that are set up for a seller's account. This container is returned as an empty element if no flat-rate shipping discount rules are currently set for the seller's account. |
| CalculatedShippingDiscount | CalculatedShippingDiscountType | Always | This container consists of one or more calculated shipping discount rules that are set up for a seller's account. This container is returned as an empty element if no calculated shipping discount rules are currently set for the seller's account. |
| PromotionalShippingDiscount | boolean | Always | This field indicates whether or not a seller has set up a promotional shipping discount rule in the seller's account. Only one promotional shipping discount may be defined for a seller's account at any given time. This field is returned whether false or true . If true , details of the rule can be found in the PromotionalShippingDiscountDetails container. |
| CalculatedHandlingDiscount | CalculatedHandlingDiscountType | Conditionally | This container consists of the handling discount applicable to a calculated shipping discount rule that is set up for a seller's account. This container is not returned if no calculated shipping discount rules are currently set for the seller's account. |
| PromotionalShippingDiscountDetails | PromotionalShippingDiscountDetailsType | Conditionally | This container consists of information related to the promotional shipping discount rule that is set up for a seller's account. This container is not returned if no promotional shipping discount rule is set up for the seller's account. |
| CombinedDuration | CombinedPaymentPeriodCodeType | Always | This field indicates the number of days after the sale of an item in which the buyer or seller can combine multiple and mutual order line items into one Combined Invoice order. In a Combined Invoice order, the buyer makes one payment for all order line items, hence only unpaid order line items can be combined into a Combined Invoice order. |

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

### GetShippingDiscountProfilesRequestType

**Description:** This call retrieves all shipping discount profiles currently defined by the user, along with other Combined Invoice-related details such as packaging and handling costs.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| Not specified in source | Not specified in source | Not specified in source | Not specified in source |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<GetShippingDiscountProfilesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- (No call-specific Input fields) -->
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetShippingDiscountProfilesRequest>
```

### GetShippingDiscountProfilesResponseType

**Description:** The base response of the GetShippingDiscountProfiles call.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| CurrencyID | CurrencyCodeType | [0..1] | The three-digit code of the currency to be used for shipping cost discounts. A discount profile can only be associated with a listing if the CurrencyID value of the profile matches the Item.Currency value specified in a listing. |
| FlatShippingDiscount | FlatShippingDiscountType | [0..1] | This container consists of one or more flat-rate shipping discount rules that are set up for a seller's account. This container is returned as an empty element if no flat-rate shipping discount rules are currently set for the seller's account. |
| CalculatedShippingDiscount | CalculatedShippingDiscountType | [0..1] | This container consists of one or more calculated shipping discount rules that are set up for a seller's account. This container is returned as an empty element if no calculated shipping discount rules are currently set for the seller's account. |
| PromotionalShippingDiscount | boolean | [0..1] | This field indicates whether or not a seller has set up a promotional shipping discount rule in the seller's account. Only one promotional shipping discount may be defined for a seller's account at any given time. This field is returned whether false or true . If true , details of the rule can be found in the PromotionalShippingDiscountDetails container. |
| CalculatedHandlingDiscount | CalculatedHandlingDiscountType | [0..1] | This container consists of the handling discount applicable to a calculated shipping discount rule that is set up for a seller's account. This container is not returned if no calculated shipping discount rules are currently set for the seller's account. |
| PromotionalShippingDiscountDetails | PromotionalShippingDiscountDetailsType | [0..1] | This container consists of information related to the promotional shipping discount rule that is set up for a seller's account. This container is not returned if no promotional shipping discount rule is set up for the seller's account. |
| CombinedDuration | CombinedPaymentPeriodCodeType | [0..1] | This field indicates the number of days after the sale of an item in which the buyer or seller can combine multiple and mutual order line items into one Combined Invoice order. In a Combined Invoice order, the buyer makes one payment for all order line items, hence only unpaid order line items can be combined into a Combined Invoice order. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<GetShippingDiscountProfilesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
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
      <WeightOff unit="token" measurementSystem="MeasurementSystemCodeType">
      </WeightOff>
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
  <PromotionalShippingDiscount>boolean</PromotionalShippingDiscount>
  <PromotionalShippingDiscountDetails>
    <DiscountName></DiscountName>
    <ItemCount>int</ItemCount>
    <OrderAmount currencyID="CurrencyCodeType">
    </OrderAmount>
    <ShippingCost currencyID="CurrencyCodeType">
    </ShippingCost>
  </PromotionalShippingDiscountDetails>
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
</GetShippingDiscountProfilesResponse>
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

1. Profiles returned belong to the authenticated seller account.

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
| GetShippingDiscountProfiles | Account API v2 getCombinedShippingRules | GET |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_getshippingdiscountprofiles_html.jsonl`; `.trace_artifacts/extract_wsdl_getshippingdiscountprofiles.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
