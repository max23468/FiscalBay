# GetTokenStatus - Traditional API (SOAP)

> **Call Name:** GetTokenStatus
> **API Type:** SOAP XML traditional API
> **API Version:** 1123
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

Use this call to retrieve the status of a user token, which represents permission for an application to access, on the user's behalf, eBay data using eBay APIs. See Getting Tokens for a detailed description of how to obtain user tokens.

**Purpose:**
Use this call to retrieve the status of a user token, which represents permission for an application to access, on the user's behalf, eBay data using eBay APIs. See Getting Tokens for a detailed description of how to obtain user tokens. Unlike other Traditional API calls, GetTokenStatus requires your application keys ( AppID , DevID , and CERT ), as well as an eBayAuthToken value for which you want the status.

**Use Cases:**
- Checks status for a traditional token.
- Mapping exists but target API name is still Unknown.

**Important Notes:**
- Checks status for a traditional token.
- Mapping exists but target API name is still Unknown.

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
X-EBAY-API-COMPATIBILITY-LEVEL: 1123
X-EBAY-API-CALL-NAME: GetTokenStatus
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
<GetTokenStatusRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- (No call-specific Input fields) -->
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetTokenStatusRequest>
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
<GetTokenStatusResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <TokenStatus>
    <EIASToken>string</EIASToken>
    <ExpirationTime>dateTime</ExpirationTime>
    <RevocationTime>dateTime</RevocationTime>
    <Status></Status>
  </TokenStatus>
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
</GetTokenStatusResponse>
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
| TokenStatus | TokenStatusType | Always | This container value indicates the status and expiration date of a user token. If a user token was revoked, the date/time of the revocation is also returned under this container. |

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

### GetTokenStatusRequestType

**Description:** This call is used to get the current status of a user token. There are no call-specific fields in the request payload.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| Not specified in source | Not specified in source | Not specified in source | Not specified in source |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<GetTokenStatusRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- (No call-specific Input fields) -->
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetTokenStatusRequest>
```

### GetTokenStatusResponseType

**Description:** The base response of the GetTokenStatus call. This call retrieves the status of a user token.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| TokenStatus | TokenStatusType | [0..1] | This container value indicates the status and expiration date of a user token. If a user token was revoked, the date/time of the revocation is also returned under this container. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<GetTokenStatusResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <TokenStatus>
    <EIASToken>string</EIASToken>
    <ExpirationTime>dateTime</ExpirationTime>
    <RevocationTime>dateTime</RevocationTime>
    <Status></Status>
  </TokenStatus>
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
</GetTokenStatusResponse>
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

1. Use this only where traditional token status inspection is still required.

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
| GetTokenStatus | Unknown Not specified in source | Not specified in source |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_gettokenstatus_html.jsonl`; `.trace_artifacts/extract_wsdl_gettokenstatus.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
