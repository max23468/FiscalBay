# AddMemberMessagesAAQToBidder - Traditional API (SOAP)

> **Call Name:** AddMemberMessagesAAQToBidder
> **API Type:** SOAP XML traditional API
> **API Version:** 1081
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

Sellers use this call to send messages to bidders, and to users who have made offers via Best Offer, regarding an active listing. Messages sent to users appear in their My eBay Inbox.

**Purpose:**
Sellers use this call to send messages to bidders, and to users who have made offers via Best Offer, regarding an active listing. Messages sent to users appear in their My eBay Inbox. Sellers can use AddMemberMessagesAAQToBidder to send up to ten messages per call.

**Use Cases:**
- Sends ask-a-question messages to bidder(s).

**Important Notes:**
- Sends ask-a-question messages to bidder(s).

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
X-EBAY-API-COMPATIBILITY-LEVEL: 1081
X-EBAY-API-CALL-NAME: AddMemberMessagesAAQToBidder
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
<AddMemberMessagesAAQToBidderRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <AddMemberMessagesAAQToBidderRequestContainer>
    <CorrelationID>string</CorrelationID>
    <ItemID>string</ItemID>
    <MemberMessage>
      <Body>string</Body>
      <EmailCopyToSender>boolean</EmailCopyToSender>
      <RecipientID>string</RecipientID>
      <!-- ... more RecipientID values allowed here ... -->
    </MemberMessage>
  </AddMemberMessagesAAQToBidderRequestContainer>
  <!-- ... more AddMemberMessagesAAQToBidderRequestContainer nodes allowed here ... -->
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</AddMemberMessagesAAQToBidderRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| AddMemberMessagesAAQToBidderRequestContainer | AddMemberMessagesAAQToBidderRequestContainerType | Yes | An AddMemberMessagesAAQToBidderRequestContainer container is required for each message being sent to unique bidders/potential buyers. A seller can send up to 10 messages to unique bidders/potential buyers in one AddMemberMessagesAAQToBidder call. |

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
<AddMemberMessagesAAQToBidderResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <AddMemberMessagesAAQToBidderResponseContainer>
    <Ack></Ack>
    <CorrelationID>string</CorrelationID>
  </AddMemberMessagesAAQToBidderResponseContainer>
  <!-- ... more AddMemberMessagesAAQToBidderResponseContainer nodes allowed here ... -->
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
</AddMemberMessagesAAQToBidderResponse>
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
| AddMemberMessagesAAQToBidderResponseContainer | AddMemberMessagesAAQToBidderResponseContainerType | Always | Container consisting of the Ack field (indicating the result of the send message operation) and the CorrelationID field (used to track multiple send message operations performed in one call). |

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

### AddMemberMessagesAAQToBidderRequestType

**Description:** The base request of the AddMemberMessagesAAQToBidder call, which allows a seller to send up to 10 messages to bidders/potential buyers regarding an active listing. These potential buyers may include those who have made a Best Offer on a listing.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| AddMemberMessagesAAQToBidderRequestContainer | AddMemberMessagesAAQToBidderRequestContainerType | [0..unbounded] | An AddMemberMessagesAAQToBidderRequestContainer container is required for each message being sent to unique bidders/potential buyers. A seller can send up to 10 messages to unique bidders/potential buyers in one AddMemberMessagesAAQToBidder call. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<AddMemberMessagesAAQToBidderRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <AddMemberMessagesAAQToBidderRequestContainer>
    <CorrelationID>string</CorrelationID>
    <ItemID>string</ItemID>
    <MemberMessage>
      <Body>string</Body>
      <EmailCopyToSender>boolean</EmailCopyToSender>
      <RecipientID>string</RecipientID>
      <!-- ... more RecipientID values allowed here ... -->
    </MemberMessage>
  </AddMemberMessagesAAQToBidderRequestContainer>
  <!-- ... more AddMemberMessagesAAQToBidderRequestContainer nodes allowed here ... -->
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</AddMemberMessagesAAQToBidderRequest>
```

### AddMemberMessagesAAQToBidderResponseType

**Description:** Type defining the AddMemberMessagesAAQToBidderResponseContainer container, which consists of the Ack field (indicating the result of the send message operation) and the CorrelationID field (used to track multiple send message operations performed in one call).

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| AddMemberMessagesAAQToBidderResponseContainer | AddMemberMessagesAAQToBidderResponseContainerType | [0..unbounded] | Container consisting of the Ack field (indicating the result of the send message operation) and the CorrelationID field (used to track multiple send message operations performed in one call). |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<AddMemberMessagesAAQToBidderResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <AddMemberMessagesAAQToBidderResponseContainer>
    <Ack></Ack>
    <CorrelationID>string</CorrelationID>
  </AddMemberMessagesAAQToBidderResponseContainer>
  <!-- ... more AddMemberMessagesAAQToBidderResponseContainer nodes allowed here ... -->
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
</AddMemberMessagesAAQToBidderResponse>
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

1. Bidder messaging is limited to eligible recipient and listing contexts.

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
| AddMemberMessagesAAQToBidder | Message API sendMessage | POST |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_addmembermessagesaaqtobidder_html.jsonl`; `.trace_artifacts/extract_wsdl_addmembermessagesaaqtobidder.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
