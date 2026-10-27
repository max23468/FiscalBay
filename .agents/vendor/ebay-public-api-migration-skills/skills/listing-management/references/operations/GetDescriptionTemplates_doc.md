# GetDescriptionTemplates - Traditional API (SOAP)

> **Call Name:** GetDescriptionTemplates
> **API Type:** SOAP XML traditional API
> **API Version:** 1131
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

Use this call to retrieve the Theme and Layout specifications for the display of an item's description. If desired, you can retrieve template information for specific categories and you can set the LastModifiedTime field to return templates by date.

**Purpose:**
Use this call to retrieve the Theme and Layout specifications for the display of an item's description. If desired, you can retrieve template information for specific categories and you can set the LastModifiedTime field to return templates by date. Note: As of May 31, 2020, sellers are no longer able to use Listing Designer templates when they create or revise listings.

**Use Cases:**
- Retrieves traditional description templates.

**Important Notes:**
- Retrieves traditional description templates.

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
X-EBAY-API-CALL-NAME: GetDescriptionTemplates
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
<GetDescriptionTemplatesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <CategoryID>string</CategoryID>
  <LastModifiedTime>dateTime</LastModifiedTime>
  <MotorVehicles>boolean</MotorVehicles>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetDescriptionTemplatesRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| None identified | - | No | No always-required request fields were explicitly labeled in the extracted source. |

#### Optional Fields

| Field Path | Type | Default | Description | Constraints |
|------------|------|---------|-------------|-------------|
| CategoryID | string | Not specified in source | A CategoryID value can be specified if the seller would like to only see the Listing Designer templates that are available for that eBay category. This field will be ignored if the MotorVehicles boolean field is also included in the call request and set to true . | Not specified in source |
| LastModifiedTime | dateTime | Not specified in source | This dateTime filter can be included and used if the user only wants to check for recently-added Listing Designer templates. If this filter is used, only the Listing Designer templates that have been added/modified after the specified timestamp will be returned in the response. Typically, you will pass in the timestamp value that was returned the last time you refreshed the list of Listing Designer templates. | Not specified in source |
| MotorVehicles | boolean | Not specified in source | This boolean field should be included and set to true if the user would only like to see the Listing Designer templates that are available for motor vehicle categories. This field will override any CategoryID value that is specified in the call request. Note: Motor vehicle-related Listing Designer templates are only available for eBay Motors on the US and Canada (English) marketplaces. To retrieve eBay US Motors Listing Designer templates, the SITEID HTTP header value must be set to 100 , which is the identifier of the eBay US Motors vertical (ebay.com/motors). | Not specified in source |

#### Conditional Fields

| Field Path | Type | Condition | Description |
|------------|------|-----------|-------------|
| None | - | - | No conditional request fields were identified in the extracted source. |

## Response Structure

### XML Schema

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetDescriptionTemplatesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <DescriptionTemplate>
    <GroupID>int</GroupID>
    <ID>int</ID>
    <ImageURL>anyURI</ImageURL>
    <Name>string</Name>
    <TemplateXML>string</TemplateXML>
    <Type></Type>
  </DescriptionTemplate>
  <!-- ... more DescriptionTemplate nodes allowed here ... -->
  <LayoutTotal>int</LayoutTotal>
  <ObsoleteLayoutID>int</ObsoleteLayoutID>
  <!-- ... more ObsoleteLayoutID values allowed here ... -->
  <ObsoleteThemeID>int</ObsoleteThemeID>
  <!-- ... more ObsoleteThemeID values allowed here ... -->
  <ThemeGroup>
    <GroupID>int</GroupID>
    <GroupName>string</GroupName>
    <ThemeID>int</ThemeID>
    <!-- ... more ThemeID values allowed here ... -->
    <ThemeTotal>int</ThemeTotal>
  </ThemeGroup>
  <!-- ... more ThemeGroup nodes allowed here ... -->
  <ThemeTotal>int</ThemeTotal>
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
</GetDescriptionTemplatesResponse>
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
| DescriptionTemplate | DescriptionTemplateType | Always | A DescriptionTemplate container is retrieved for each available Listing Designer template. Each DescriptionTemplate container includes the unique identifier of the template, the Listing Designer Theme Group that it belongs to, the CDATA representation of the Listing Designer template, and the URL to an image that serves as an example of the Listing Designer template. |
| LayoutTotal | int | Always | This integer value indicates the total number of Listing Designer Layout templates that were retrieved. This field is always returned, even if it is 0 |
| ObsoleteLayoutID | int | Conditionally | The unique identifier of a Listing Designer Layout template that is now obsolete. An ObsoleteLayoutID field is returned for each obsolete Listing Designer Layout template. |
| ObsoleteThemeID | int | Conditionally | The unique identifier of a Listing Designer Theme template that is now obsolete. An ObsoleteThemeID field is returned for each obsolete Listing Designer Theme template. |
| ThemeGroup | ThemeGroupType | Conditionally | A ThemeGroup container is retrieved for each available Listing Designer Theme Group. Each ThemeGroup container includes the unique identifier of the Theme Group, the Theme Group name, and all of the Listing Designer Theme template that belong to that Theme Group. |
| ThemeTotal | int | Always | This integer value indicates the total number of Listing Designer Theme templates that were retrieved. This field is always returned, even if it is 0 |

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

### GetDescriptionTemplatesRequestType

**Description:** This is the base request type for the GetDescriptionTemplates call. This call retrieves detailed information on the Listing Designer templates that are available for use by the seller.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| CategoryID | string | [0..1] | A CategoryID value can be specified if the seller would like to only see the Listing Designer templates that are available for that eBay category. This field will be ignored if the MotorVehicles boolean field is also included in the call request and set to true . |
| LastModifiedTime | dateTime | [0..1] | This dateTime filter can be included and used if the user only wants to check for recently-added Listing Designer templates. If this filter is used, only the Listing Designer templates that have been added/modified after the specified timestamp will be returned in the response. Typically, you will pass in the timestamp value that was returned the last time you refreshed the list of Listing Designer templates. |
| MotorVehicles | boolean | [0..1] | This boolean field should be included and set to true if the user would only like to see the Listing Designer templates that are available for motor vehicle categories. This field will override any CategoryID value that is specified in the call request. Note: Motor vehicle-related Listing Designer templates are only available for eBay Motors on the US and Canada (English) marketplaces. To retrieve eBay US Motors Listing Designer templates, the SITEID HTTP header value must be set to 100 , which is the identifier of the eBay US Motors vertical (ebay.com/motors). |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<GetDescriptionTemplatesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <CategoryID>string</CategoryID>
  <LastModifiedTime>dateTime</LastModifiedTime>
  <MotorVehicles>boolean</MotorVehicles>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetDescriptionTemplatesRequest>
```

### GetDescriptionTemplatesResponseType

**Description:** This is the base response type for the GetDescriptionTemplates call. This call retrieves the Listing Designer templates that are available for use by the seller. The user has the option of retrieving all available Listing Designer templates for all categories, for all motor vehicle categories, or for a specific eBay category. Note: As of May 31, 2020, sellers are no longer able to use Listing Designer templates when they create or revise listings. Existing listings that are already using a Listing Designer template will remain unchanged. The GetDescriptionTemplates call will eventually get deprecated and decommissioned, and more information will be provided on timing at a later date. The GetDescriptionTemplates call will still retrieve Listing Designer template data, but none of retrieved templates will be usable to create or revise a listing.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| DescriptionTemplate | DescriptionTemplateType | [0..unbounded] | A DescriptionTemplate container is retrieved for each available Listing Designer template. Each DescriptionTemplate container includes the unique identifier of the template, the Listing Designer Theme Group that it belongs to, the CDATA representation of the Listing Designer template, and the URL to an image that serves as an example of the Listing Designer template. |
| LayoutTotal | int | [0..1] | This integer value indicates the total number of Listing Designer Layout templates that were retrieved. This field is always returned, even if it is 0 |
| ObsoleteLayoutID | int | [0..unbounded] | The unique identifier of a Listing Designer Layout template that is now obsolete. An ObsoleteLayoutID field is returned for each obsolete Listing Designer Layout template. |
| ObsoleteThemeID | int | [0..unbounded] | The unique identifier of a Listing Designer Theme template that is now obsolete. An ObsoleteThemeID field is returned for each obsolete Listing Designer Theme template. |
| ThemeGroup | ThemeGroupType | [0..unbounded] | A ThemeGroup container is retrieved for each available Listing Designer Theme Group. Each ThemeGroup container includes the unique identifier of the Theme Group, the Theme Group name, and all of the Listing Designer Theme template that belong to that Theme Group. |
| ThemeTotal | int | [0..1] | This integer value indicates the total number of Listing Designer Theme templates that were retrieved. This field is always returned, even if it is 0 |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<GetDescriptionTemplatesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <DescriptionTemplate>
    <GroupID>int</GroupID>
    <ID>int</ID>
    <ImageURL>anyURI</ImageURL>
    <Name>string</Name>
    <TemplateXML>string</TemplateXML>
    <Type></Type>
  </DescriptionTemplate>
  <!-- ... more DescriptionTemplate nodes allowed here ... -->
  <LayoutTotal>int</LayoutTotal>
  <ObsoleteLayoutID>int</ObsoleteLayoutID>
  <!-- ... more ObsoleteLayoutID values allowed here ... -->
  <ObsoleteThemeID>int</ObsoleteThemeID>
  <!-- ... more ObsoleteThemeID values allowed here ... -->
  <ThemeGroup>
    <GroupID>int</GroupID>
    <GroupName>string</GroupName>
    <ThemeID>int</ThemeID>
    <!-- ... more ThemeID values allowed here ... -->
    <ThemeTotal>int</ThemeTotal>
  </ThemeGroup>
  <!-- ... more ThemeGroup nodes allowed here ... -->
  <ThemeTotal>int</ThemeTotal>
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
</GetDescriptionTemplatesResponse>
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

1. Template retrieval depends on the authenticated seller/site context.

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
| GetDescriptionTemplates | Unknown No replacement | No replacement |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_getdescriptiontemplates_html.jsonl`; `.trace_artifacts/extract_wsdl_getdescriptiontemplates.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
