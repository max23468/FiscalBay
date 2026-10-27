# GetUserContactDetails - Traditional API (SOAP)

> **Call Name:** GetUserContactDetails
> **API Type:** SOAP XML traditional API
> **API Version:** 1131
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

Use this call to retrieve contact information for a specified user, given that a bidding relationship (as either a buyer or seller) exists between the caller and the user. The bidder must be bidding on the seller's active item, or an eBay user must have made an offer on the item using Best Offer.

**Purpose:**
Use this call to retrieve contact information for a specified user, given that a bidding relationship (as either a buyer or seller) exists between the caller and the user. The bidder must be bidding on the seller's active item, or an eBay user must have made an offer on the item using Best Offer. In addition, the item must be in either the eBay Motors (SiteID=100) category, or in Business & Industrial category.

**Use Cases:**
- Retrieves another user's contact details when allowed by policy.

**Important Notes:**
- Retrieves another user's contact details when allowed by policy.

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
X-EBAY-API-COMPATIBILITY-LEVEL: 1131
X-EBAY-API-CALL-NAME: GetUserContactDetails
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
<GetUserContactDetailsRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <ContactID>string</ContactID>
  <ItemID>string</ItemID>
  <RequesterID>string</RequesterID>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetUserContactDetailsRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| ItemID | string | Yes | A unique identifier for the eBay listing that the caller and order partner have in common. |
| ContactID | string | Yes | An eBay user ID that uniquely identifies a given user for whom the caller is seeking information. Either a seller's or bidder's/buyer's user ID can be specified here, as long as an bidding/order relationship exists between the requester and the user specified by this field. That is, a bidder must be bidding on the seller's active auction item, or a prospective buyer has proposed a Best Offer on a listing. |
| RequesterID | string | Yes | An eBay user ID that uniquely identifies the person who is making the call. Either a seller's or bidder's/buyer's user ID can be specified here, as long as a bidding/order relationship exists between the requester and the user for whom information is being requested. |

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
<GetUserContactDetailsResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <ContactAddress>
    <CityName>string</CityName>
    <CompanyName>string</CompanyName>
    <Country></Country>
    <Name>string</Name>
    <Phone>string</Phone>
    <StateOrProvince>string</StateOrProvince>
  </ContactAddress>
  <RegistrationDate>dateTime</RegistrationDate>
  <UserID>string</UserID>
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
</GetUserContactDetailsResponse>
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
| UserID | string | Always | An eBay ID that uniquely identifies the given user whose information is given in the call response. |
| ContactAddress | AddressType | Always | Contact information for the requested contact. Note that the email address is NOT returned. |
| RegistrationDate | dateTime | Always | The date and time that the requested contact registered with eBay. |

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

### GetUserContactDetailsRequestType

**Description:** This call is used to retrieve contact information for a specified eBay user, given that a bidding relationship (as either a buyer or seller) exists between the caller and the user.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| ItemID | string | [0..1] | A unique identifier for the eBay listing that the caller and order partner have in common. |
| ContactID | string | [0..1] | An eBay user ID that uniquely identifies a given user for whom the caller is seeking information. Either a seller's or bidder's/buyer's user ID can be specified here, as long as an bidding/order relationship exists between the requester and the user specified by this field. That is, a bidder must be bidding on the seller's active auction item, or a prospective buyer has proposed a Best Offer on a listing. |
| RequesterID | string | [0..1] | An eBay user ID that uniquely identifies the person who is making the call. Either a seller's or bidder's/buyer's user ID can be specified here, as long as a bidding/order relationship exists between the requester and the user for whom information is being requested. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<GetUserContactDetailsRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <ContactID>string</ContactID>
  <ItemID>string</ItemID>
  <RequesterID>string</RequesterID>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetUserContactDetailsRequest>
```

### GetUserContactDetailsResponseType

**Description:** Returns contact information to a seller for both bidders and users who have made offers (via Best Offer) during an active listing.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| UserID | string | [0..1] | An eBay ID that uniquely identifies the given user whose information is given in the call response. |
| ContactAddress | AddressType | [0..1] | Contact information for the requested contact. Note that the email address is NOT returned. |
| RegistrationDate | dateTime | [0..1] | The date and time that the requested contact registered with eBay. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<GetUserContactDetailsResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <ContactAddress>
    <CityName>string</CityName>
    <CompanyName>string</CompanyName>
    <Country></Country>
    <Name>string</Name>
    <Phone>string</Phone>
    <StateOrProvince>string</StateOrProvince>
  </ContactAddress>
  <RegistrationDate>dateTime</RegistrationDate>
  <UserID>string</UserID>
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
</GetUserContactDetailsResponse>
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

1. Returned contact data depends on relationship and privacy rules.

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
| GetUserContactDetails | User API Not specified in source | Not specified in source |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_getusercontactdetails_html.jsonl`; `.trace_artifacts/extract_wsdl_getusercontactdetails.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
