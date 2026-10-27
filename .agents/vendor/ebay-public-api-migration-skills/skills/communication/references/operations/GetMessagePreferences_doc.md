# GetMessagePreferences - Traditional API (SOAP)

> **Call Name:** GetMessagePreferences
> **API Type:** SOAP XML traditional API
> **API Version:** Not specified in source
> **Service:** Traditional

---

## Metadata

| Property | Value |
|----------|-------|
| **Call Type** | Core |
| **Deprecated** | No |
| **Replacement** | Not specified in source |
| **Rate Limit** | Not specified in source |
| **Supported Sites** | Not specified in source |

---

## Description

Use this call to return a seller's Ask Seller a Question (ASQ) subjects, each in its own Subject node. If the seller has not customized the ASQ subjects with SetMessagePreferences , the call returns the current default values.

**Purpose:**
Use this call to return a seller's Ask Seller a Question (ASQ) subjects, each in its own Subject node. If the seller has not customized the ASQ subjects with SetMessagePreferences , the call returns the current default values. GetMessagePreferences returns a maximum of ten Subject nodes.

**Use Cases:**
- Retrieves traditional message preferences.

**Important Notes:**
- Retrieves traditional message preferences.

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
X-EBAY-API-CALL-NAME: GetMessagePreferences
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
<GetMessagePreferencesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <IncludeASQPreferences>boolean</IncludeASQPreferences>
  <SellerID></SellerID>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetMessagePreferencesRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| SellerID | UserIDType | Yes | The eBay user ID of the seller to retrieve ASQ subjects for. A user can retrieve their own ASQ subjects or those of another eBay user with a seller account. |
| IncludeASQPreferences | boolean | Yes | This field must be included and set to true to retrieve the ASQ subjects for the specified eBay user. |

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
<GetMessagePreferencesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <ASQPreferences>
    <Subject>string</Subject>
    <!-- ... more Subject values allowed here ... -->
  </ASQPreferences>
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
</GetMessagePreferencesResponse>
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
| ASQPreferences | ASQPreferencesType | Conditionally | Returns a seller's ASQ subjects, each in its own Subject node. If the seller has not customized the ASQ subjects using SetMessagePreferences, the call will return the current default values. Returned if IncludeASQPreferences = true was specified in the request. |

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

### GetMessagePreferencesRequestType

**Description:** Returns a seller's Ask Seller a Question (ASQ) subjects, each in its own Subject field.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| SellerID | UserIDType | [0..1] | The eBay user ID of the seller to retrieve ASQ subjects for. A user can retrieve their own ASQ subjects or those of another eBay user with a seller account. |
| IncludeASQPreferences | boolean | [0..1] | This field must be included and set to true to retrieve the ASQ subjects for the specified eBay user. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<GetMessagePreferencesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <IncludeASQPreferences>boolean</IncludeASQPreferences>
  <SellerID></SellerID>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetMessagePreferencesRequest>
```

### GetMessagePreferencesResponseType

**Description:** Contains the ASQ subjects for the user specified in the request.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| ASQPreferences | ASQPreferencesType | [0..1] | Returns a seller's ASQ subjects, each in its own Subject node. If the seller has not customized the ASQ subjects using SetMessagePreferences, the call will return the current default values. Returned if IncludeASQPreferences = true was specified in the request. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<GetMessagePreferencesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <ASQPreferences>
    <Subject>string</Subject>
    <!-- ... more Subject values allowed here ... -->
  </ASQPreferences>
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
</GetMessagePreferencesResponse>
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

1. Preference retrieval is scoped to the authenticated account.

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
| GetMessagePreferences | Unknown No replacement | No replacement |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_getmessagepreferences_html.jsonl`; `.trace_artifacts/extract_wsdl_getmessagepreferences.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
