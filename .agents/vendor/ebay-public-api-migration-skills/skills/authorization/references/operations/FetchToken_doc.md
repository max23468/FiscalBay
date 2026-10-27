# FetchToken - Traditional API (SOAP)

> **Call Name:** FetchToken
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

Use this call to retrieve an authentication token for a user. The call can be used to get a token only after the specified user has given consent for the token to be generated.

**Purpose:**
Use this call to retrieve an authentication token for a user. The call can be used to get a token only after the specified user has given consent for the token to be generated. Consent is given through the eBay sign-in page.

**Use Cases:**
- Fetches a user token in the traditional auth flow.
- Mapping exists but target API name is still Unknown.

**Important Notes:**
- Fetches a user token in the traditional auth flow.
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
X-EBAY-API-CALL-NAME: FetchToken
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
<FetchTokenRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <SecretID>string</SecretID>
  <SessionID>string</SessionID>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</FetchTokenRequest>
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
| SecretID | string | No | A value associated with the token retrieval request. SecretID is defined by the application, and is passed in the redirect URL to the eBay sign-in page. eBay recommends using a UUID for the secret ID value. You must also set Username (part of the RequesterCredentials) for the particular user of interest. SecretID and Username are not required if SessionID is present. |
| SessionID | string | No | A value associated with the token retrieval request. eBay generates the session ID when the application makes a GetSessionID request. SessionID is passed in the redirect URL to the eBay sign-in page. The advantage of using SessionID is that it does not require UserID as part of the FetchToken request. SessionID is not required if SecretID is present. |

## Response Structure

### XML Schema

```xml
<?xml version="1.0" encoding="utf-8"?>
<FetchTokenResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <eBayAuthToken>string</eBayAuthToken>
  <HardExpirationTime>dateTime</HardExpirationTime>
  <RESTToken>string</RESTToken>
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
  <Timestamp>dateTime</Timestamp>
  <Version>string</Version>
</FetchTokenResponse>
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
| eBayAuthToken | string | Always | The authentication token for the user. |
| HardExpirationTime | dateTime | Always | Date and time at which the token returned in eBayAuthToken expires and can no longer be used to authenticate the user for that application. |
| RESTToken | string | Conditionally | The REST authentication token for the user. |

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

### FetchTokenRequestType

**Description:** Retrieves an authentication token for a user.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| SecretID | string | [0..1] | A value associated with the token retrieval request. SecretID is defined by the application, and is passed in the redirect URL to the eBay sign-in page. eBay recommends using a UUID for the secret ID value. You must also set Username (part of the RequesterCredentials) for the particular user of interest. SecretID and Username are not required if SessionID is present. |
| SessionID | string | [0..1] | A value associated with the token retrieval request. eBay generates the session ID when the application makes a GetSessionID request. SessionID is passed in the redirect URL to the eBay sign-in page. The advantage of using SessionID is that it does not require UserID as part of the FetchToken request. SessionID is not required if SecretID is present. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<FetchTokenRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <SecretID>string</SecretID>
  <SessionID>string</SessionID>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</FetchTokenRequest>
```

### FetchTokenResponseType

**Description:** Includes the authentication token for the user and the date it expires.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| eBayAuthToken | string | [0..1] | The authentication token for the user. |
| HardExpirationTime | dateTime | [0..1] | Date and time at which the token returned in eBayAuthToken expires and can no longer be used to authenticate the user for that application. |
| RESTToken | string | [0..1] | The REST authentication token for the user. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<FetchTokenResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <eBayAuthToken>string</eBayAuthToken>
  <HardExpirationTime>dateTime</HardExpirationTime>
  <RESTToken>string</RESTToken>
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
  <Timestamp>dateTime</Timestamp>
  <Version>string</Version>
</FetchTokenResponse>
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

1. Use only within the corresponding traditional token flow.

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
| FetchToken | Unknown No replacement | No replacement |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_fetchtoken_html.jsonl`; `.trace_artifacts/extract_wsdl_fetchtoken.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
