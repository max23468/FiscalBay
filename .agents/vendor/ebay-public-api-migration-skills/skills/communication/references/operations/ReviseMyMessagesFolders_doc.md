# ReviseMyMessagesFolders - Traditional API (SOAP)

> **Call Name:** ReviseMyMessagesFolders
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

Use this call to add, rename, or remove a folder in My eBay Messages . Note that the Inbox and Sent folders cannot be removed or renamed in My eBay Messages .

**Purpose:**
Use this call to add, rename, or remove a folder in My eBay Messages . Note that the Inbox and Sent folders cannot be removed or renamed in My eBay Messages . A user can have up to 10 custom folders in My eBay Messages , so if a user has no custom folders defined for the account, one ReviseMyMessagesFolders call can be used to create up to 10 new custom folders.

**Use Cases:**
- Revises traditional My Messages folder configuration.

**Important Notes:**
- Revises traditional My Messages folder configuration.

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
X-EBAY-API-CALL-NAME: ReviseMyMessagesFolders
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
<ReviseMyMessagesFoldersRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <FolderID>long</FolderID>
  <!-- ... more FolderID values allowed here ... -->
  <FolderName>string</FolderName>
  <!-- ... more FolderName values allowed here ... -->
  <Operation></Operation>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</ReviseMyMessagesFoldersRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| Operation | MyMessagesFolderOperationCodeType | Yes | This required field is used to indicate the type of operation to perform (add, remove, or rename a folder). See the enumeration descriptions below for more information on the usage, requirements, and limitations on each operation. |

#### Optional Fields

| Field Path | Type | Default | Description | Constraints |
|------------|------|---------|-------------|-------------|
| None | - | - | No optional fields were identified in the extracted source. | - |

#### Conditional Fields

| Field Path | Type | Condition | Description |
|------------|------|-----------|-------------|
| FolderID | long | Conditionally | The eBay-generated unique identifier for a custom folder in My eBay Messages . The FolderID value is required for the 'Rename' and 'Remove' operations, but not for the 'Display' (add) operation. FolderID values can be retrieved by calling GetMyMessages with a DetailLevel value set to ReturnSummary , or the FolderID value for a My eBay Messages folder can be seen at the end of the browser's URL field when you navigate to that folder in My eBay Messages . Note: If multiple folders will be renamed with one call, the user must pay close attention to the order of the FolderID and FolderName fields, as eBay will process these requests in order according to the placement of the the FolderID and FolderName fields. So, the existing folder identified by the first FolderID field in the request payload will get renamed to the folder name passed into the first FolderName field in the request payload, and so on. |
| FolderName | string | Conditionally | The user-specified name of the My eBay Messages folder. The FolderName value is required for the 'Display' (add) and 'Rename' operations, but not for the 'Remove' operation. In a 'Display' (add) operation, the name passed into the FolderName field is the name of the new folder. In a 'Rename' operation, the name passed into the FolderName field will be the new name of the existing folder that is specified through the corresponding FolderID field. FolderName values can be retrieved by calling GetMyMessages with a DetailLevel value set to ReturnSummary , or the FolderName value for a My eBay Messages folder can be seen when you navigate to My eBay Messages . Note: If multiple folders will be renamed with one call, the user must pay close attention to the order of the FolderID and FolderName fields, as eBay will process these requests in order according to the placement of the the FolderID and FolderName fields. So, the existing folder identified by the first FolderID field in the request payload will get renamed to the folder name passed into the first FolderName field in the request payload, and so on. |

## Response Structure

### XML Schema

```xml
<?xml version="1.0" encoding="utf-8"?>
<ReviseMyMessagesFoldersResponse xmlns="urn:ebay:apis:eBLBaseComponents">
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
</ReviseMyMessagesFoldersResponse>
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

### ReviseMyMessagesFoldersRequestType

**Description:** This call can be used to add, remove, or rename a custom folder in My eBay Messages . Note that the Inbox and Sent folders cannot be removed or renamed in My eBay Messages . A user can have up to 10 custom folders in My eBay Messages , and it is possible to add, remove, or rename up to 10 custom folders with one ReviseMyMessagesFolders call

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| Operation | MyMessagesFolderOperationCodeType | [0..1] | This required field is used to indicate the type of operation to perform (add, remove, or rename a folder). See the enumeration descriptions below for more information on the usage, requirements, and limitations on each operation. |
| FolderID | long | [0..unbounded] | The eBay-generated unique identifier for a custom folder in My eBay Messages . The FolderID value is required for the 'Rename' and 'Remove' operations, but not for the 'Display' (add) operation. FolderID values can be retrieved by calling GetMyMessages with a DetailLevel value set to ReturnSummary , or the FolderID value for a My eBay Messages folder can be seen at the end of the browser's URL field when you navigate to that folder in My eBay Messages . Note: If multiple folders will be renamed with one call, the user must pay close attention to the order of the FolderID and FolderName fields, as eBay will process these requests in order according to the placement of the the FolderID and FolderName fields. So, the existing folder identified by the first FolderID field in the request payload will get renamed to the folder name passed into the first FolderName field in the request payload, and so on. |
| FolderName | string | [0..unbounded] | The user-specified name of the My eBay Messages folder. The FolderName value is required for the 'Display' (add) and 'Rename' operations, but not for the 'Remove' operation. In a 'Display' (add) operation, the name passed into the FolderName field is the name of the new folder. In a 'Rename' operation, the name passed into the FolderName field will be the new name of the existing folder that is specified through the corresponding FolderID field. FolderName values can be retrieved by calling GetMyMessages with a DetailLevel value set to ReturnSummary , or the FolderName value for a My eBay Messages folder can be seen when you navigate to My eBay Messages . Note: If multiple folders will be renamed with one call, the user must pay close attention to the order of the FolderID and FolderName fields, as eBay will process these requests in order according to the placement of the the FolderID and FolderName fields. So, the existing folder identified by the first FolderID field in the request payload will get renamed to the folder name passed into the first FolderName field in the request payload, and so on. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<ReviseMyMessagesFoldersRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <FolderID>long</FolderID>
  <!-- ... more FolderID values allowed here ... -->
  <FolderName>string</FolderName>
  <!-- ... more FolderName values allowed here ... -->
  <Operation></Operation>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</ReviseMyMessagesFoldersRequest>
```

### ReviseMyMessagesFoldersResponseType

**Description:** Not specified in source

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| Not specified in source | Not specified in source | Not specified in source | Not specified in source |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<ReviseMyMessagesFoldersResponse xmlns="urn:ebay:apis:eBLBaseComponents">
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
</ReviseMyMessagesFoldersResponse>
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

1. Folder changes are scoped to the authenticated user.

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
| ReviseMyMessagesFolders | Unknown No replacement | No replacement |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_revisemymessagesfolders_html.jsonl`; `.trace_artifacts/extract_wsdl_revisemymessagesfolders.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
