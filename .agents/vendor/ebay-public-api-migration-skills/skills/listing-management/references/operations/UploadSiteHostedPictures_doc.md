# UploadSiteHostedPictures - Traditional API (SOAP)

> **Call Name:** UploadSiteHostedPictures
> **API Type:** SOAP XML traditional API
> **API Version:** 4
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

Note: This call has been deprecated and will be decommissioned on September 30th, 2026. Users are recommended to migrate to the createImageFromFile and createImageFromUrl methods of the Media API .

**Purpose:**
Note: This call has been deprecated and will be decommissioned on September 30th, 2026. Users are recommended to migrate to the createImageFromFile and createImageFromUrl methods of the Media API . Use this call to upload a picture to eBay Picture Services (EPS).

**Use Cases:**
- Uploads pictures for eBay-hosted use.

**Important Notes:**
- Uploads pictures for eBay-hosted use.

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
X-EBAY-API-COMPATIBILITY-LEVEL: 4
X-EBAY-API-CALL-NAME: UploadSiteHostedPictures
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
<UploadSiteHostedPicturesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <ebl:eBayAuthToken xmlns:ebl="urn:ebay:apis:eBLBaseComponents">TOKEN</ebl:eBayAuthToken>
  </RequesterCredentials>
  <PictureName>Gall-Peters projection map</PictureName>
  <PictureSet>Standard</PictureSet>
</UploadSiteHostedPicturesRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| None identified | - | No | No always-required request fields were explicitly labeled in the extracted source. |

#### Optional Fields

| Field Path | Type | Default | Description | Constraints |
|------------|------|---------|-------------|-------------|
| PictureName | string | Not specified in source | A seller-defined name for the picture. This field is optional, but can make it easier for a seller to track than an arbitrary, eBay-assigned URL. | Not specified in source |
| PictureSystemVersion | int | Not specified in source | Specifies the picture system version. Only version 2 is valid. Available to support future changes in the picture system version. | Not specified in source |
| PictureSet | PictureSetCodeType | Not specified in source | This enumeration value indicates the size of the picture that will be generated. IMPORTANT: To get the standard website image sizing with Zoom, set this field to Supersize . | Not specified in source |
| PictureData | Base64BinaryType | Not specified in source | An optional reference ID to the binary attachment. The PictureData field does not contain the binary attachment. The binary attachment is image data, including the headers, from a JPG, GIF, PNG, BMP, or TIF format image file. The binary attachment must be sent as a MIME attachment, in your POST request, after the XML input. | Not specified in source |
| PictureUploadPolicy | PictureUploadPolicyCodeType | Not specified in source | Determines if the uploaded picture is to replace all the pictures or to be added to the pictures currently available to a seller on the eBay site. The picture is available to the seller on the My Picture Uploads tab within the Sell Your Item pages. The picture you upload (and its URL) is stored for a period of time on the EPS server. If, within that time, the picture is associated with an item, then the picture persists on the eBay site for the same time length as other pictures uploaded using the UploadSiteHostedPictures call. The expiration date of the picture is returned in the SiteHostedPictureDetails.UseByDate field in the response. | Not specified in source |

#### Conditional Fields

| Field Path | Type | Condition | Description |
|------------|------|-----------|-------------|
| ExternalPictureURL | anyURI | Conditionally | This field is used if the seller wishes to upload a picture to the EPS server that is currently on another external site. The URL of the picture you want to upload is passed in this field. Only https:// servers are supported. You can include only one ExternalPictureURL field per call. The eBay server uses the information in this field to retrieve a picture from an external web server. Once retrieved, the picture will be copied to eBay Picture Services and retained for 30 days if not associated with a listing. When associated with a listing, the duration is the length of the listing plus 90 days. |

## Response Structure

### XML Schema

```xml
<?xml version="1.0" encoding="utf-8"?>
<UploadSiteHostedPicturesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <PictureSystemVersion>int</PictureSystemVersion>
  <SiteHostedPictureDetails>
    <BaseURL>anyURI</BaseURL>
    <ExternalPictureURL>anyURI</ExternalPictureURL>
    <FullURL>anyURI</FullURL>
    <PictureFormat></PictureFormat>
    <PictureName>string</PictureName>
    <PictureSet></PictureSet>
    <PictureSetMember>
      <MemberURL>anyURI</MemberURL>
      <PictureHeight>int</PictureHeight>
      <PictureWidth>int</PictureWidth>
    </PictureSetMember>
    <!-- ... more PictureSetMember nodes allowed here ... -->
    <UseByDate>dateTime</UseByDate>
  </SiteHostedPictureDetails>
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
</UploadSiteHostedPicturesResponse>
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
| PictureSystemVersion | int | Always | Specifies the picture system version that was used to upload pictures. Only version 2 is valid. |
| SiteHostedPictureDetails | SiteHostedPictureDetailsType | Always | The information about an UploadSiteHostedPictures upload, including the URL of the uploaded picture. |

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

### UploadSiteHostedPicturesRequestType

**Description:** Uploads a picture to the eBay Picture Service and returns a URL of the picture. You will use this URL when creating, revising, or relisting an item with the Traditional API.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| PictureName | string | [0..1] | A seller-defined name for the picture. This field is optional, but can make it easier for a seller to track than an arbitrary, eBay-assigned URL. |
| PictureSystemVersion | int | [0..1] | Specifies the picture system version. Only version 2 is valid. Available to support future changes in the picture system version. |
| PictureSet | PictureSetCodeType | [0..1] | This enumeration value indicates the size of the picture that will be generated. IMPORTANT: To get the standard website image sizing with Zoom, set this field to Supersize . |
| PictureData | Base64BinaryType | [0..1] | An optional reference ID to the binary attachment. The PictureData field does not contain the binary attachment. The binary attachment is image data, including the headers, from a JPG, GIF, PNG, BMP, or TIF format image file. The binary attachment must be sent as a MIME attachment, in your POST request, after the XML input. |
| PictureUploadPolicy | PictureUploadPolicyCodeType | [0..1] | Determines if the uploaded picture is to replace all the pictures or to be added to the pictures currently available to a seller on the eBay site. The picture is available to the seller on the My Picture Uploads tab within the Sell Your Item pages. The picture you upload (and its URL) is stored for a period of time on the EPS server. If, within that time, the picture is associated with an item, then the picture persists on the eBay site for the same time length as other pictures uploaded using the UploadSiteHostedPictures call. The expiration date of the picture is returned in the SiteHostedPictureDetails.UseByDate field in the response. |
| ExternalPictureURL | anyURI | [0..unbounded] | This field is used if the seller wishes to upload a picture to the EPS server that is currently on another external site. The URL of the picture you want to upload is passed in this field. Only https:// servers are supported. You can include only one ExternalPictureURL field per call. The eBay server uses the information in this field to retrieve a picture from an external web server. Once retrieved, the picture will be copied to eBay Picture Services and retained for 30 days if not associated with a listing. When associated with a listing, the duration is the length of the listing plus 90 days. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<UploadSiteHostedPicturesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <ebl:eBayAuthToken xmlns:ebl="urn:ebay:apis:eBLBaseComponents">TOKEN</ebl:eBayAuthToken>
  </RequesterCredentials>
  <PictureName>Gall-Peters projection map</PictureName>
  <PictureSet>Standard</PictureSet>
</UploadSiteHostedPicturesRequest>
```

### UploadSiteHostedPicturesResponseType

**Description:** Contains information about a picture upload (i.e., information about a picture upload containing a binary attachment of an image).

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| PictureSystemVersion | int | [0..1] | Specifies the picture system version that was used to upload pictures. Only version 2 is valid. |
| SiteHostedPictureDetails | SiteHostedPictureDetailsType | [0..1] | The information about an UploadSiteHostedPictures upload, including the URL of the uploaded picture. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<UploadSiteHostedPicturesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <PictureSystemVersion>int</PictureSystemVersion>
  <SiteHostedPictureDetails>
    <BaseURL>anyURI</BaseURL>
    <ExternalPictureURL>anyURI</ExternalPictureURL>
    <FullURL>anyURI</FullURL>
    <PictureFormat></PictureFormat>
    <PictureName>string</PictureName>
    <PictureSet></PictureSet>
    <PictureSetMember>
      <MemberURL>anyURI</MemberURL>
      <PictureHeight>int</PictureHeight>
      <PictureWidth>int</PictureWidth>
    </PictureSetMember>
    <!-- ... more PictureSetMember nodes allowed here ... -->
    <UseByDate>dateTime</UseByDate>
  </SiteHostedPictureDetails>
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
</UploadSiteHostedPicturesResponse>
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

1. Uploaded images must follow media constraints in the source.

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
| UploadSiteHostedPictures | Media API createImageFromFile | POST |
| UploadSiteHostedPictures | Media API createImageFromUrl | POST |
| UploadSiteHostedPictures | Media API getImage | GET |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_uploadsitehostedpictures_html.jsonl`; `.trace_artifacts/extract_wsdl_uploadsitehostedpictures.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
