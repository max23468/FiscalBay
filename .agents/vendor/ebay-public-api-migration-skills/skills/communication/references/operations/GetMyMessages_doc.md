# GetMyMessages - Traditional API (SOAP)

> **Call Name:** GetMyMessages
> **API Type:** SOAP XML traditional API
> **API Version:** 1127
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

Use this call to retrieve information about the threaded messages sent to a user's My Messages mailbox. Depending on the detail level, the response can include message counts and headers, resolution status and flagged status, and message text.

**Purpose:**
Use this call to retrieve information about the threaded messages sent to a user's My Messages mailbox. Depending on the detail level, the response can include message counts and headers, resolution status and flagged status, and message text. Note: GetMyMessages requires a DetailLevel in the request.

**Use Cases:**
- Retrieves My Messages data for the authenticated user.

**Important Notes:**
- Retrieves My Messages data for the authenticated user.

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
X-EBAY-API-COMPATIBILITY-LEVEL: 1127
X-EBAY-API-CALL-NAME: GetMyMessages
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
<GetMyMessagesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <EndTime>dateTime</EndTime>
  <ExternalMessageIDs>
    <ExternalMessageID></ExternalMessageID>
    <!-- ... more ExternalMessageID values allowed here ... -->
  </ExternalMessageIDs>
  <FolderID>long</FolderID>
  <IncludeHighPriorityMessageOnly>boolean</IncludeHighPriorityMessageOnly>
  <MessageIDs>
    <MessageID></MessageID>
    <!-- ... more MessageID values allowed here ... -->
  </MessageIDs>
  <Pagination>
    <EntriesPerPage>int</EntriesPerPage>
    <PageNumber>int</PageNumber>
  </Pagination>
  <StartTime>dateTime</StartTime>
  <!-- Standard Input Fields -->
  <DetailLevel></DetailLevel>
  <!-- ... more DetailLevel values allowed here ... -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <OutputSelector>string</OutputSelector>
  <!-- ... more OutputSelector values allowed here ... -->
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetMyMessagesRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| None identified | - | No | No always-required request fields were explicitly labeled in the extracted source. |

#### Optional Fields

| Field Path | Type | Default | Description | Constraints |
|------------|------|---------|-------------|-------------|
| FolderID | long | Not specified in source | A unique identifier for a My Messages folder. If a FolderID value is provided, only messages from the specified folder are returned in the response. | Not specified in source |
| StartTime | dateTime | Not specified in source | The beginning of the date-range filter. Filtering takes into account the entire timestamp of when messages were sent. Messages expire after one year. | Not specified in source |
| ExternalMessageIDs | MyMessagesExternalMessageIDArrayType | Not specified in source | This field is currently available on the US site. A container for IDs that uniquely identify messages for a given user. If provided at the time of message creation, this ID can be used to retrieve messages and will take precedence over message ID. | Not specified in source |
| Pagination | PaginationType | Not specified in source | Specifies how to create virtual pages in the returned list (such as total number of entries and total number of pages to return). Default value for EntriesPerPage with GetMyMessages is 25. | Not specified in source |
| IncludeHighPriorityMessageOnly | boolean | Not specified in source | If this field is included in the request and set to true , only High Priority messages are returned in the response. | Not specified in source |

#### Conditional Fields

| Field Path | Type | Condition | Description |
|------------|------|-----------|-------------|
| MessageIDs | MyMessagesMessageIDArrayType | Conditionally | This container can be used to retrieve one or more specific messages identified with their unique MessageID values. Up to 10 MessageID values can be specified with one call. |
| EndTime | dateTime | Conditionally | The end of the date-range filter. See StartTime (which is the beginning of the date-range filter). |

## Response Structure

### XML Schema

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetMyMessagesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <Messages>
    <Message>
      <Content>string</Content>
      <ExpirationDate>dateTime</ExpirationDate>
      <ExternalMessageID>string</ExternalMessageID>
      <Flagged>boolean</Flagged>
      <Folder>
        <FolderID>long</FolderID>
      </Folder>
      <HighPriority>boolean</HighPriority>
      <ItemEndTime>dateTime</ItemEndTime>
      <ItemID></ItemID>
      <ItemTitle>string</ItemTitle>
      <ListingStatus></ListingStatus>
      <MessageID></MessageID>
      <MessageMedia>
        <MediaName>string</MediaName>
        <MediaURL>anyURI</MediaURL>
      </MessageMedia>
      <!-- ... more MessageMedia nodes allowed here ... -->
      <MessageType></MessageType>
      <QuestionType></QuestionType>
      <Read>boolean</Read>
      <ReceiveDate>dateTime</ReceiveDate>
      <RecipientUserID>string</RecipientUserID>
      <Replied>boolean</Replied>
      <ResponseDetails>
        <ResponseEnabled>boolean</ResponseEnabled>
        <ResponseURL>anyURI</ResponseURL>
      </ResponseDetails>
      <Sender>string</Sender>
      <SendToName>string</SendToName>
      <Subject>string</Subject>
      <Text>string</Text>
    </Message>
    <!-- ... more Message nodes allowed here ... -->
  </Messages>
  <Summary>
    <FlaggedMessageCount>int</FlaggedMessageCount>
    <FolderSummary>
      <FolderID>long</FolderID>
      <FolderName>string</FolderName>
      <NewHighPriorityCount>int</NewHighPriorityCount>
      <NewMessageCount>int</NewMessageCount>
      <TotalHighPriorityCount>int</TotalHighPriorityCount>
      <TotalMessageCount>int</TotalMessageCount>
    </FolderSummary>
    <!-- ... more FolderSummary nodes allowed here ... -->
    <NewHighPriorityCount>int</NewHighPriorityCount>
    <NewMessageCount>int</NewMessageCount>
    <TotalHighPriorityCount>int</TotalHighPriorityCount>
    <TotalMessageCount>int</TotalMessageCount>
  </Summary>
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
</GetMyMessagesResponse>
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
| Summary | MyMessagesSummaryType | Conditionally | Summary data for a given user's messages. This includes the numbers of new messages, flagged messages, and total messages. The amount and type of data returned is the same whether or not the request includes specific Message IDs. Always/Conditionally returned logic assumes a detail level of ReturnMessages. |
| Messages | MyMessagesMessageArrayType | Always | This container consists of an array of one or more messages that match the search criteria in the call request. |

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

### GetMyMessagesRequestType

**Description:** Retrieves information about the messages sent to a given user.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| MessageIDs | MyMessagesMessageIDArrayType | [0..1] | This container can be used to retrieve one or more specific messages identified with their unique MessageID values. Up to 10 MessageID values can be specified with one call. |
| FolderID | long | [0..1] | A unique identifier for a My Messages folder. If a FolderID value is provided, only messages from the specified folder are returned in the response. |
| StartTime | dateTime | [0..1] | The beginning of the date-range filter. Filtering takes into account the entire timestamp of when messages were sent. Messages expire after one year. |
| EndTime | dateTime | [0..1] | The end of the date-range filter. See StartTime (which is the beginning of the date-range filter). |
| ExternalMessageIDs | MyMessagesExternalMessageIDArrayType | [0..1] | This field is currently available on the US site. A container for IDs that uniquely identify messages for a given user. If provided at the time of message creation, this ID can be used to retrieve messages and will take precedence over message ID. |
| Pagination | PaginationType | [0..1] | Specifies how to create virtual pages in the returned list (such as total number of entries and total number of pages to return). Default value for EntriesPerPage with GetMyMessages is 25. |
| IncludeHighPriorityMessageOnly | boolean | [0..1] | If this field is included in the request and set to true , only High Priority messages are returned in the response. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<GetMyMessagesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <EndTime>dateTime</EndTime>
  <ExternalMessageIDs>
    <ExternalMessageID></ExternalMessageID>
    <!-- ... more ExternalMessageID values allowed here ... -->
  </ExternalMessageIDs>
  <FolderID>long</FolderID>
  <IncludeHighPriorityMessageOnly>boolean</IncludeHighPriorityMessageOnly>
  <MessageIDs>
    <MessageID></MessageID>
    <!-- ... more MessageID values allowed here ... -->
  </MessageIDs>
  <Pagination>
    <EntriesPerPage>int</EntriesPerPage>
    <PageNumber>int</PageNumber>
  </Pagination>
  <StartTime>dateTime</StartTime>
  <!-- Standard Input Fields -->
  <DetailLevel></DetailLevel>
  <!-- ... more DetailLevel values allowed here ... -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <OutputSelector>string</OutputSelector>
  <!-- ... more OutputSelector values allowed here ... -->
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetMyMessagesRequest>
```

### GetMyMessagesResponseType

**Description:** Conains information about the messages sent to a user. Depending on the detail level, this information can include message counts, resolution and flagged status, message headers, and message text.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| Summary | MyMessagesSummaryType | [0..1] | Summary data for a given user's messages. This includes the numbers of new messages, flagged messages, and total messages. The amount and type of data returned is the same whether or not the request includes specific Message IDs. Always/Conditionally returned logic assumes a detail level of ReturnMessages. |
| Messages | MyMessagesMessageArrayType | [0..1] | This container consists of an array of one or more messages that match the search criteria in the call request. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<GetMyMessagesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <Messages>
    <Message>
      <Content>string</Content>
      <ExpirationDate>dateTime</ExpirationDate>
      <ExternalMessageID>string</ExternalMessageID>
      <Flagged>boolean</Flagged>
      <Folder>
        <FolderID>long</FolderID>
      </Folder>
      <HighPriority>boolean</HighPriority>
      <ItemEndTime>dateTime</ItemEndTime>
      <ItemID></ItemID>
      <ItemTitle>string</ItemTitle>
      <ListingStatus></ListingStatus>
      <MessageID></MessageID>
      <MessageMedia>
        <MediaName>string</MediaName>
        <MediaURL>anyURI</MediaURL>
      </MessageMedia>
      <!-- ... more MessageMedia nodes allowed here ... -->
      <MessageType></MessageType>
      <QuestionType></QuestionType>
      <Read>boolean</Read>
      <ReceiveDate>dateTime</ReceiveDate>
      <RecipientUserID>string</RecipientUserID>
      <Replied>boolean</Replied>
      <ResponseDetails>
        <ResponseEnabled>boolean</ResponseEnabled>
        <ResponseURL>anyURI</ResponseURL>
      </ResponseDetails>
      <Sender>string</Sender>
      <SendToName>string</SendToName>
      <Subject>string</Subject>
      <Text>string</Text>
    </Message>
    <!-- ... more Message nodes allowed here ... -->
  </Messages>
  <Summary>
    <FlaggedMessageCount>int</FlaggedMessageCount>
    <FolderSummary>
      <FolderID>long</FolderID>
      <FolderName>string</FolderName>
      <NewHighPriorityCount>int</NewHighPriorityCount>
      <NewMessageCount>int</NewMessageCount>
      <TotalHighPriorityCount>int</TotalHighPriorityCount>
      <TotalMessageCount>int</TotalMessageCount>
    </FolderSummary>
    <!-- ... more FolderSummary nodes allowed here ... -->
    <NewHighPriorityCount>int</NewHighPriorityCount>
    <NewMessageCount>int</NewMessageCount>
    <TotalHighPriorityCount>int</TotalHighPriorityCount>
    <TotalMessageCount>int</TotalMessageCount>
  </Summary>
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
</GetMyMessagesResponse>
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

1. Results are limited to the authenticated user's mailbox state.

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
| GetMyMessages | Message API getConversations | GET |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_getmymessages_html.jsonl`; `.trace_artifacts/extract_wsdl_getmymessages.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
