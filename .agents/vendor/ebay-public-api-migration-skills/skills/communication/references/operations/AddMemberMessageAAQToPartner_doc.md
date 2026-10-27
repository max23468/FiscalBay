# AddMemberMessageAAQToPartner - Traditional API (SOAP)

> **Call Name:** AddMemberMessageAAQToPartner
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

This call enables a buyer and seller in an order relationship to send messages to each other through My eBay. Buyer and seller order partners can send messages to each other up to 90 days after the creation of the order line item.

**Purpose:**
This call enables a buyer and seller in an order relationship to send messages to each other through My eBay. Buyer and seller order partners can send messages to each other up to 90 days after the creation of the order line item. Short-duration call rate limit: To protect eBay's infrastructure and servers from being overloaded and/or destabilized, the AddMemberMessageAAQToPartner call has a short-duration call rate limit that restricts bursts of very high traffic.Per (seller) user ID, no more than 75 AddMemberMessageAAQToPartner calls can be executed within any 60-second interval.

**Use Cases:**
- Sends an ask-a-question message to a listing partner.

**Important Notes:**
- Sends an ask-a-question message to a listing partner.

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
X-EBAY-API-CALL-NAME: AddMemberMessageAAQToPartner
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
<AddMemberMessageAAQToPartnerRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <ItemID></ItemID>
  <MemberMessage>
    <Body>string</Body>
    <EmailCopyToSender>boolean</EmailCopyToSender>
    <MessageMedia>
      <MediaName>string</MediaName>
      <MediaURL>anyURI</MediaURL>
    </MessageMedia>
    <!-- ... more MessageMedia nodes allowed here ... -->
    <QuestionType></QuestionType>
    <RecipientID>string</RecipientID>
    <!-- ... more RecipientID values allowed here ... -->
    <Subject>string</Subject>
  </MemberMessage>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</AddMemberMessageAAQToPartnerRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| ItemID | ItemIDType | Yes | Unique identifier for the listing that is being discussed between the two order partners. |
| MemberMessage | MemberMessageType | Yes | This container holds the message, and includes the subject, message body, and other details related to the message. |

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
<AddMemberMessageAAQToPartnerResponse xmlns="urn:ebay:apis:eBLBaseComponents">
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
</AddMemberMessageAAQToPartnerResponse>
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

### AddMemberMessageAAQToPartnerRequestType

**Description:** Enables a buyer and seller in an order relationship to send messages to each other's My Messages Inboxes.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| ItemID | ItemIDType | [0..1] | Unique identifier for the listing that is being discussed between the two order partners. |
| MemberMessage | MemberMessageType | [0..1] | This container holds the message, and includes the subject, message body, and other details related to the message. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<AddMemberMessageAAQToPartnerRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <ItemID></ItemID>
  <MemberMessage>
    <Body>string</Body>
    <EmailCopyToSender>boolean</EmailCopyToSender>
    <MessageMedia>
      <MediaName>string</MediaName>
      <MediaURL>anyURI</MediaURL>
    </MessageMedia>
    <!-- ... more MessageMedia nodes allowed here ... -->
    <QuestionType></QuestionType>
    <RecipientID>string</RecipientID>
    <!-- ... more RecipientID values allowed here ... -->
    <Subject>string</Subject>
  </MemberMessage>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</AddMemberMessageAAQToPartnerRequest>
```

### AddMemberMessageAAQToPartnerResponseType

**Description:** Not specified in source

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| Not specified in source | Not specified in source | Not specified in source | Not specified in source |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<AddMemberMessageAAQToPartnerResponse xmlns="urn:ebay:apis:eBLBaseComponents">
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
</AddMemberMessageAAQToPartnerResponse>
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

1. Partner messaging depends on the specific listing/partner context.

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
| AddMemberMessageAAQToPartner | Message API sendMessage | POST |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_addmembermessageaaqtopartner_html.jsonl`; `.trace_artifacts/extract_wsdl_addmembermessageaaqtopartner.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
