# GetSessionID - Traditional API (SOAP)

> **Call Name:** GetSessionID
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

Use this call to retrieve a SessionID , which is a unique identifier that you use for authentication during the token-creation process. You must have a valid SessionID value in order to make a FetchToken request.

**Purpose:**
Use this call to retrieve a SessionID , which is a unique identifier that you use for authentication during the token-creation process. You must have a valid SessionID value in order to make a FetchToken request. See Getting a Token via FetchToken for a step-by-step description of retrieving and using a SessionID .

**Use Cases:**
- Traditional AuthN/AuthZ session bootstrap call.
- Mapping exists but target API name is still Unknown.

**Important Notes:**
- Traditional AuthN/AuthZ session bootstrap call.
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
X-EBAY-API-CALL-NAME: GetSessionID
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
<GetSessionIDRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <RuName>string</RuName>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetSessionIDRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| RuName | string | Yes | The eBay Registered URL must be specified in this field. An eBay Registered URL is created and associated with a developer's Sandbox or Production key set by logging into the user's developer account on developer.ebay.com and going to the User Tokens page. The RuName value passed in this field must match the one specified for the specific Sandbox or Production key set being used to make the GetSessionID call. For more information on adding and registering your RuName , see the Setting Up an Application to Receive Tokens tutorial. |

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
<GetSessionIDResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <SessionID>string</SessionID>
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
</GetSessionIDResponse>
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
| SessionID | string | Always | A 40-character identifier supplied by eBay to an application. Used to confirm the identities of the user and the application in a URL redirect during the process in which the user agrees to let the application wield a user token that grants the application the right to access eBay data on behalf of the user. Subsequently also used as input for the FetchToken API call. The SessionID value is valid for five minutes after it is retrieved. |

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

### GetSessionIDRequestType

**Description:** Retrieves a session ID that identifies a user and your application when you make a FetchToken request.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| RuName | string | [0..1] | The eBay Registered URL must be specified in this field. An eBay Registered URL is created and associated with a developer's Sandbox or Production key set by logging into the user's developer account on developer.ebay.com and going to the User Tokens page. The RuName value passed in this field must match the one specified for the specific Sandbox or Production key set being used to make the GetSessionID call. For more information on adding and registering your RuName , see the Setting Up an Application to Receive Tokens tutorial. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<GetSessionIDRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <RuName>string</RuName>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetSessionIDRequest>
```

### GetSessionIDResponseType

**Description:** The base response of the GetSessionID call. This response will include the generated SessionID value, which is a unique identifier for authenticating data entry during the process that creates a user token.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| SessionID | string | [0..1] | A 40-character identifier supplied by eBay to an application. Used to confirm the identities of the user and the application in a URL redirect during the process in which the user agrees to let the application wield a user token that grants the application the right to access eBay data on behalf of the user. Subsequently also used as input for the FetchToken API call. The SessionID value is valid for five minutes after it is retrieved. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<GetSessionIDResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <SessionID>string</SessionID>
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
</GetSessionIDResponse>
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

1. Treat session identifiers as short-lived auth flow artifacts.

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
| GetSessionID | Unknown No replacement | No replacement |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_getsessionid_html.jsonl`; `.trace_artifacts/extract_wsdl_getsessionid.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
