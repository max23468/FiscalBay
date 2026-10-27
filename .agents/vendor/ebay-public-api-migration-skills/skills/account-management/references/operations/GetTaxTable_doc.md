# GetTaxTable - Traditional API (SOAP)

> **Call Name:** GetTaxTable
> **API Type:** SOAP XML traditional API
> **API Version:** 1119
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

Use this call to retrieve information on the seller's tax table. This information includes the all of the site's tax jurisdictions, a boolean field to indicate if sales tax is applied to shipping and handling charges, and the sales tax rate for each jurisdiction (if a sales tax rate is set for that jurisdiction).

**Purpose:**
Use this call to retrieve information on the seller's tax table. This information includes the all of the site's tax jurisdictions, a boolean field to indicate if sales tax is applied to shipping and handling charges, and the sales tax rate for each jurisdiction (if a sales tax rate is set for that jurisdiction). When calling GetTaxTable , the seller is determined by the authorization token, and the Site ID is specified in the HTTP header.

**Use Cases:**
- Retrieves the seller's tax table.

**Important Notes:**
- Retrieves the seller's tax table.

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
X-EBAY-API-COMPATIBILITY-LEVEL: 1119
X-EBAY-API-CALL-NAME: GetTaxTable
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
<GetTaxTableRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- (No call-specific Input fields) -->
  <!-- Standard Input Fields -->
  <DetailLevel></DetailLevel>
  <!-- ... more DetailLevel values allowed here ... -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetTaxTableRequest>
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
<GetTaxTableResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <LastUpdateTime>dateTime</LastUpdateTime>
  <TaxTable>
    <TaxJurisdiction>
      <JurisdictionID>string</JurisdictionID>
      <SalesTaxPercent>float</SalesTaxPercent>
      <ShippingIncludedInTax>boolean</ShippingIncludedInTax>
    </TaxJurisdiction>
    <!-- ... more TaxJurisdiction nodes allowed here ... -->
  </TaxTable>
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
</GetTaxTableResponse>
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
| LastUpdateTime | dateTime | Conditionally | The last time (in GMT) that the tax table was updated. Only returned if the user previously created a tax table and if the site has jurisdictions. LastUpdateTime is useful for synchronization. If you cache the user's tax table, you can use GetTaxTable to check if it has changed and whether you need to update the cached tax table. |
| TaxTable | TaxTableType | Always | A container of tax jurisdiction information unique to a user/site combination. Returned as an empty container if no Sales Tax Table information exists for the seller's account and no DetailLevel is used. If DetailLevel is not specified, information is only returned for the jurisdictions for which the user provided tax information. If DetailLevel is set to ReturnAll , tax information is returned for all possible jurisdictions, whether specified by the user or not. ShippingIncludedInTax and SalesTaxPercent are returned but are empty. |

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

### GetTaxTableRequestType

**Description:** The base request type of the GetTaxTable call, which retrieves information on the seller's Sales Tax Table. This information includes all of the site's tax jurisdictions, a boolean field to indicate if sales tax is applied to shipping and handling charges, and the sales tax rate for each jurisdiction (if a sales tax rate is set for that jurisdiction). Sales tax tables are only supported on the eBay US and Candada marketplaces.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| Not specified in source | Not specified in source | Not specified in source | Not specified in source |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<GetTaxTableRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- (No call-specific Input fields) -->
  <!-- Standard Input Fields -->
  <DetailLevel></DetailLevel>
  <!-- ... more DetailLevel values allowed here ... -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetTaxTableRequest>
```

### GetTaxTableResponseType

**Description:** The base response of the GetTaxTable call.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| LastUpdateTime | dateTime | [0..1] | The last time (in GMT) that the tax table was updated. Only returned if the user previously created a tax table and if the site has jurisdictions. LastUpdateTime is useful for synchronization. If you cache the user's tax table, you can use GetTaxTable to check if it has changed and whether you need to update the cached tax table. |
| TaxTable | TaxTableType | [0..1] | A container of tax jurisdiction information unique to a user/site combination. Returned as an empty container if no Sales Tax Table information exists for the seller's account and no DetailLevel is used. If DetailLevel is not specified, information is only returned for the jurisdictions for which the user provided tax information. If DetailLevel is set to ReturnAll , tax information is returned for all possible jurisdictions, whether specified by the user or not. ShippingIncludedInTax and SalesTaxPercent are returned but are empty. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<GetTaxTableResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <LastUpdateTime>dateTime</LastUpdateTime>
  <TaxTable>
    <TaxJurisdiction>
      <JurisdictionID>string</JurisdictionID>
      <SalesTaxPercent>float</SalesTaxPercent>
      <ShippingIncludedInTax>boolean</ShippingIncludedInTax>
    </TaxJurisdiction>
    <!-- ... more TaxJurisdiction nodes allowed here ... -->
  </TaxTable>
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
</GetTaxTableResponse>
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

1. Tax-table retrieval is scoped to the authenticated account.

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
| GetTaxTable | Account API v1 getSalesTax | GET |
| GetTaxTable | Account API v1 getSalesTaxes | GET |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_gettaxtable_html.jsonl`; `.trace_artifacts/extract_wsdl_gettaxtable.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
