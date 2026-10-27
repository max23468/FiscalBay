# GetMemberMessages - Traditional API (SOAP)

> **Call Name:** GetMemberMessages
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

Use this call to retrieve a list of messages from buyers. The messages pertain to the active listings of the authenticated caller.

**Purpose:**
Use this call to retrieve a list of messages from buyers. The messages pertain to the active listings of the authenticated caller. A buyer can ask a question on the eBay site.

**Use Cases:**
- Retrieves member-to-member messages.

**Important Notes:**
- Retrieves member-to-member messages.

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
X-EBAY-API-CALL-NAME: GetMemberMessages
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
<GetMemberMessagesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <DisplayToPublic>boolean</DisplayToPublic>
  <EndCreationTime>dateTime</EndCreationTime>
  <ItemID></ItemID>
  <MailMessageType></MailMessageType>
  <MemberMessageID>string</MemberMessageID>
  <MessageStatus></MessageStatus>
  <Pagination>
    <EntriesPerPage>int</EntriesPerPage>
    <PageNumber>int</PageNumber>
  </Pagination>
  <SenderID></SenderID>
  <StartCreationTime>dateTime</StartCreationTime>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <OutputSelector>string</OutputSelector>
  <!-- ... more OutputSelector values allowed here ... -->
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetMemberMessagesRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| MailMessageType | MessageTypeCodeType | Yes | This required field indicates the type of member message to retrieve. Only the following two enumeration values are allowed. The call will fail if this field is not included in the request. |

#### Optional Fields

| Field Path | Type | Default | Description | Constraints |
|------------|------|---------|-------------|-------------|
| MessageStatus | MessageStatusTypeCodeType | Not specified in source | This field allows you to retrieve only unanswered member messages or answered member messages. If this field is omitted, both answered and unanswered member messages are retrieved. | Not specified in source |
| DisplayToPublic | boolean | Not specified in source | If included in the request and set to true , only public messages (viewable in the Item listing) are returned. If omitted or set to false in the request, all messages (that match other filters in the request) are returned in the response. | Not specified in source |
| Pagination | PaginationType | Not specified in source | Standard pagination argument used to reduce response. | Not specified in source |
| MemberMessageID | string | Not specified in source | An ID that uniquely identifies the message for a given user to be retrieved. Used for the AskSellerQuestion notification only. | Not specified in source |
| SenderID | UserIDType | Not specified in source | An eBay ID that uniquely identifies a user. For GetMemberMessages , this is the sender of the message. If included in the request, returns only messages from the specified sender. | Not specified in source |

#### Conditional Fields

| Field Path | Type | Condition | Description |
|------------|------|-----------|-------------|
| ItemID | ItemIDType | Conditionally | The unique identifier of the eBay listing for which you wish to retrieve member messages. For Ask Seller Question messages, the ItemID and/or a date range (specified with StartCreationTime and EndCreationTime fields), are required, or the call will fail. |
| StartCreationTime | dateTime | Conditionally | Used as beginning of date range filter. If specified, filters the returned messages to only those with a creation date greater than or equal to the specified date and time. For Contact eBay Member (CEM) messages, StartCreationTime and EndCreationTime must be provided. For Ask Seller a Question (ASQ) messages, either the ItemID , or a date range (specified with StartCreationTime and EndCreationTime ), or both must be included. |
| EndCreationTime | dateTime | Conditionally | Used as end of date range filter. If specified, filters the returned messages to only those with a creation date less than or equal to the specified date and time. For Contact eBay Member (CEM) messages, StartCreationTime and EndCreationTime must be provided. For Ask Seller a Question (ASQ) messages, either the ItemID , or a date range (specified with StartCreationTime and EndCreationTime ), or both must be included. |

## Response Structure

### XML Schema

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetMemberMessagesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <HasMoreItems>boolean</HasMoreItems>
  <MemberMessage>
    <MemberMessageExchange>
      <Item>
        <ItemID></ItemID>
        <ListingDetails>
          <EndTime>dateTime</EndTime>
          <StartTime>dateTime</StartTime>
        </ListingDetails>
        <SellingStatus>
          <CurrentPrice currencyID="CurrencyCodeType">
          </CurrentPrice>
        </SellingStatus>
        <Title>string</Title>
      </Item>
      <LastModifiedDate>dateTime</LastModifiedDate>
      <MessageMedia>
        <MediaName>string</MediaName>
        <MediaURL>anyURI</MediaURL>
      </MessageMedia>
      <!-- ... more MessageMedia nodes allowed here ... -->
      <MessageStatus></MessageStatus>
      <Question>
        <Body>string</Body>
        <DisplayToPublic>boolean</DisplayToPublic>
        <MessageID>string</MessageID>
        <MessageMedia>
          <MediaName>string</MediaName>
          <MediaURL>anyURI</MediaURL>
        </MessageMedia>
        <!-- ... more MessageMedia nodes allowed here ... -->
        <MessageType></MessageType>
        <QuestionType></QuestionType>
        <RecipientID>string</RecipientID>
        <!-- ... more RecipientID values allowed here ... -->
        <SenderEmail>string</SenderEmail>
        <SenderID>string</SenderID>
        <Subject>string</Subject>
      </Question>
      <Response>string</Response>
      <!-- ... more Response values allowed here ... -->
    </MemberMessageExchange>
    <!-- ... more MemberMessageExchange nodes allowed here ... -->
  </MemberMessage>
  <PaginationResult>
    <TotalNumberOfEntries>int</TotalNumberOfEntries>
    <TotalNumberOfPages>int</TotalNumberOfPages>
  </PaginationResult>
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
</GetMemberMessagesResponse>
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
| MemberMessage | MemberMessageExchangeArrayType | Conditionally | The returned member messages. Returned if messages that meet the request criteria exist. Note that GetMemberMessages does not return messages when, in the request, the MailMessageType is AskSellerQuestion . |
| PaginationResult | PaginationResultType | Always | Shows the pagination of data returned by requests. |
| HasMoreItems | boolean | Always | Specifies whether the response has more items. |

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

### GetMemberMessagesRequestType

**Description:** Retrieves a list of the messages buyers have posted about your active item listings.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| ItemID | ItemIDType | [0..1] | The unique identifier of the eBay listing for which you wish to retrieve member messages. For Ask Seller Question messages, the ItemID and/or a date range (specified with StartCreationTime and EndCreationTime fields), are required, or the call will fail. |
| MailMessageType | MessageTypeCodeType | [0..1] | This required field indicates the type of member message to retrieve. Only the following two enumeration values are allowed. The call will fail if this field is not included in the request. |
| MessageStatus | MessageStatusTypeCodeType | [0..1] | This field allows you to retrieve only unanswered member messages or answered member messages. If this field is omitted, both answered and unanswered member messages are retrieved. |
| DisplayToPublic | boolean | [0..1] | If included in the request and set to true , only public messages (viewable in the Item listing) are returned. If omitted or set to false in the request, all messages (that match other filters in the request) are returned in the response. |
| StartCreationTime | dateTime | [0..1] | Used as beginning of date range filter. If specified, filters the returned messages to only those with a creation date greater than or equal to the specified date and time. For Contact eBay Member (CEM) messages, StartCreationTime and EndCreationTime must be provided. For Ask Seller a Question (ASQ) messages, either the ItemID , or a date range (specified with StartCreationTime and EndCreationTime ), or both must be included. |
| EndCreationTime | dateTime | [0..1] | Used as end of date range filter. If specified, filters the returned messages to only those with a creation date less than or equal to the specified date and time. For Contact eBay Member (CEM) messages, StartCreationTime and EndCreationTime must be provided. For Ask Seller a Question (ASQ) messages, either the ItemID , or a date range (specified with StartCreationTime and EndCreationTime ), or both must be included. |
| Pagination | PaginationType | [0..1] | Standard pagination argument used to reduce response. |
| MemberMessageID | string | [0..1] | An ID that uniquely identifies the message for a given user to be retrieved. Used for the AskSellerQuestion notification only. |
| SenderID | UserIDType | [0..1] | An eBay ID that uniquely identifies a user. For GetMemberMessages , this is the sender of the message. If included in the request, returns only messages from the specified sender. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<GetMemberMessagesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <DisplayToPublic>boolean</DisplayToPublic>
  <EndCreationTime>dateTime</EndCreationTime>
  <ItemID></ItemID>
  <MailMessageType></MailMessageType>
  <MemberMessageID>string</MemberMessageID>
  <MessageStatus></MessageStatus>
  <Pagination>
    <EntriesPerPage>int</EntriesPerPage>
    <PageNumber>int</PageNumber>
  </Pagination>
  <SenderID></SenderID>
  <StartCreationTime>dateTime</StartCreationTime>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <OutputSelector>string</OutputSelector>
  <!-- ... more OutputSelector values allowed here ... -->
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetMemberMessagesRequest>
```

### GetMemberMessagesResponseType

**Description:** Retrieves a list of the messages buyers have posted about your active item listings.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| MemberMessage | MemberMessageExchangeArrayType | [0..1] | The returned member messages. Returned if messages that meet the request criteria exist. Note that GetMemberMessages does not return messages when, in the request, the MailMessageType is AskSellerQuestion . |
| PaginationResult | PaginationResultType | [0..1] | Shows the pagination of data returned by requests. |
| HasMoreItems | boolean | [0..1] | Specifies whether the response has more items. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<GetMemberMessagesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <HasMoreItems>boolean</HasMoreItems>
  <MemberMessage>
    <MemberMessageExchange>
      <Item>
        <ItemID></ItemID>
        <ListingDetails>
          <EndTime>dateTime</EndTime>
          <StartTime>dateTime</StartTime>
        </ListingDetails>
        <SellingStatus>
          <CurrentPrice currencyID="CurrencyCodeType">
          </CurrentPrice>
        </SellingStatus>
        <Title>string</Title>
      </Item>
      <LastModifiedDate>dateTime</LastModifiedDate>
      <MessageMedia>
        <MediaName>string</MediaName>
        <MediaURL>anyURI</MediaURL>
      </MessageMedia>
      <!-- ... more MessageMedia nodes allowed here ... -->
      <MessageStatus></MessageStatus>
      <Question>
        <Body>string</Body>
        <DisplayToPublic>boolean</DisplayToPublic>
        <MessageID>string</MessageID>
        <MessageMedia>
          <MediaName>string</MediaName>
          <MediaURL>anyURI</MediaURL>
        </MessageMedia>
        <!-- ... more MessageMedia nodes allowed here ... -->
        <MessageType></MessageType>
        <QuestionType></QuestionType>
        <RecipientID>string</RecipientID>
        <!-- ... more RecipientID values allowed here ... -->
        <SenderEmail>string</SenderEmail>
        <SenderID>string</SenderID>
        <Subject>string</Subject>
      </Question>
      <Response>string</Response>
      <!-- ... more Response values allowed here ... -->
    </MemberMessageExchange>
    <!-- ... more MemberMessageExchange nodes allowed here ... -->
  </MemberMessage>
  <PaginationResult>
    <TotalNumberOfEntries>int</TotalNumberOfEntries>
    <TotalNumberOfPages>int</TotalNumberOfPages>
  </PaginationResult>
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
</GetMemberMessagesResponse>
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

1. Message retrieval is scoped to accessible conversations.

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
| GetMemberMessages | Message API getConversations | GET |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_getmembermessages_html.jsonl`; `.trace_artifacts/extract_wsdl_getmembermessages.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
