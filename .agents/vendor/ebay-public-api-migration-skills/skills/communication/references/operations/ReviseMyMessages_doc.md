# ReviseMyMessages - Traditional API (SOAP)

> **Call Name:** ReviseMyMessages
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

Use this call to change the states (both read and flagged) for a given message. Retrieving messages with GetMyMessages does not automatically mark them as "read." Instead, they must be marked "read." You can use ReviseMyMessages to mark messages as "flagged." Note: Alerts are treated as flagged messages.

**Purpose:**
Use this call to change the states (both read and flagged) for a given message. Retrieving messages with GetMyMessages does not automatically mark them as "read." Instead, they must be marked "read." You can use ReviseMyMessages to mark messages as "flagged." Note: Alerts are treated as flagged messages. ReviseMyMessages accepts up to ten unique MessageID values in the request.

**Use Cases:**
- Revises message status or metadata in My Messages.

**Important Notes:**
- Revises message status or metadata in My Messages.

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
X-EBAY-API-CALL-NAME: ReviseMyMessages
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
<ReviseMyMessagesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <Flagged>boolean</Flagged>
  <FolderID>long</FolderID>
  <MessageIDs>
    <MessageID></MessageID>
    <!-- ... more MessageID values allowed here ... -->
  </MessageIDs>
  <Read>boolean</Read>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</ReviseMyMessagesRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| MessageIDs | MyMessagesMessageIDArrayType | Yes | This container is used to specify up to 10 messages (specified with their MessageID values) on which to perform on or more actions. At least one MessageID value must be included in the request. MessageID values can be retrieved with the GetMyMessages call with the DetailLevel value set to ReturnHeaders . Note: Messages in the Sent folder of My Messages cannot be moved, marked as read, or flagged. |

#### Optional Fields

| Field Path | Type | Default | Description | Constraints |
|------------|------|---------|-------------|-------------|
| None | - | - | No optional fields were identified in the extracted source. | - |

#### Conditional Fields

| Field Path | Type | Condition | Description |
|------------|------|-----------|-------------|
| Read | boolean | Conditionally | This boolean field is used to change the 'Read' status of the message(s) in the MessageIDs container. Including this field and setting its value to true will mark all messages in the MessageIDs container as 'Read'. Conversely, including this field and setting its value to false will mark all messages in the MessageIDs container as 'Unread'. The 'Read' status of a message can be retrieved by looking at the Message.Read boolean field of the GetMyMessages call response. In each ReviseMyMessages call, at least one of the following fields must be specified in the request: Read , Flagged , and FolderID . Note: Messages in the Sent folder of My Messages cannot be moved, marked as read, or flagged. |
| Flagged | boolean | Conditionally | This boolean field is used to change the 'Flagged' status of the message(s) in the MessageIDs container. Including this field and setting its value to true will flag all messages in the MessageIDs container. Conversely, including this field and setting its value to false will unflag all messages in the MessageIDs container. The 'Flagged' status of a message can be retrieved by looking at the Message.Flagged boolean field of the GetMyMessages call response. In each ReviseMyMessages call, at least one of the following fields must be specified in the request: Read , Flagged , and FolderID . Note: Messages in the Sent folder of My Messages cannot be moved, marked as read, or flagged. |
| FolderID | long | Conditionally | A unique identifier of My Messages folder. A FolderID value is supplied if the user want to move the message(s) in the MessageIDs container to a different folder. FolderID values can be retrieved with the GetMyMessages call with the DetailLevel value set to ReturnSummary . In each ReviseMyMessages call, at least one of the following fields must be specified in the request: Read , Flagged , and FolderID . Note: Messages in the Sent folder of My Messages cannot be moved, marked as read, or flagged. |

## Response Structure

### XML Schema

```xml
<?xml version="1.0" encoding="utf-8"?>
<ReviseMyMessagesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
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
</ReviseMyMessagesResponse>
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

### ReviseMyMessagesRequestType

**Description:** This call can be used to mark one or more messages as 'Read', to flag one or more messages, and/or to move one or more messages to another My Messages folder. Any of these actions can be applied on up to 10 messages with one call.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| MessageIDs | MyMessagesMessageIDArrayType | [0..1] | This container is used to specify up to 10 messages (specified with their MessageID values) on which to perform on or more actions. At least one MessageID value must be included in the request. MessageID values can be retrieved with the GetMyMessages call with the DetailLevel value set to ReturnHeaders . Note: Messages in the Sent folder of My Messages cannot be moved, marked as read, or flagged. |
| Read | boolean | [0..1] | This boolean field is used to change the 'Read' status of the message(s) in the MessageIDs container. Including this field and setting its value to true will mark all messages in the MessageIDs container as 'Read'. Conversely, including this field and setting its value to false will mark all messages in the MessageIDs container as 'Unread'. The 'Read' status of a message can be retrieved by looking at the Message.Read boolean field of the GetMyMessages call response. In each ReviseMyMessages call, at least one of the following fields must be specified in the request: Read , Flagged , and FolderID . Note: Messages in the Sent folder of My Messages cannot be moved, marked as read, or flagged. |
| Flagged | boolean | [0..1] | This boolean field is used to change the 'Flagged' status of the message(s) in the MessageIDs container. Including this field and setting its value to true will flag all messages in the MessageIDs container. Conversely, including this field and setting its value to false will unflag all messages in the MessageIDs container. The 'Flagged' status of a message can be retrieved by looking at the Message.Flagged boolean field of the GetMyMessages call response. In each ReviseMyMessages call, at least one of the following fields must be specified in the request: Read , Flagged , and FolderID . Note: Messages in the Sent folder of My Messages cannot be moved, marked as read, or flagged. |
| FolderID | long | [0..1] | A unique identifier of My Messages folder. A FolderID value is supplied if the user want to move the message(s) in the MessageIDs container to a different folder. FolderID values can be retrieved with the GetMyMessages call with the DetailLevel value set to ReturnSummary . In each ReviseMyMessages call, at least one of the following fields must be specified in the request: Read , Flagged , and FolderID . Note: Messages in the Sent folder of My Messages cannot be moved, marked as read, or flagged. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<ReviseMyMessagesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <Flagged>boolean</Flagged>
  <FolderID>long</FolderID>
  <MessageIDs>
    <MessageID></MessageID>
    <!-- ... more MessageID values allowed here ... -->
  </MessageIDs>
  <Read>boolean</Read>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</ReviseMyMessagesRequest>
```

### ReviseMyMessagesResponseType

**Description:** Not specified in source

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| Not specified in source | Not specified in source | Not specified in source | Not specified in source |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<ReviseMyMessagesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
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
</ReviseMyMessagesResponse>
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

1. Changes are limited to the authenticated user's message state.

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
| ReviseMyMessages | Message API updateConversation | POST |
| ReviseMyMessages | Message API bulkUpdateConversation | POST |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_revisemymessages_html.jsonl`; `.trace_artifacts/extract_wsdl_revisemymessages.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
