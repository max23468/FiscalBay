---
title: VeRO API
description: "API documentation and reference"
api_version: 1.0.0
api_name: vero_api
api_type: REST
api_group: vero/api
source_url:
  html: https://developer.ebay.com/develop/api/vero/api
  md: https://developer.ebay.com/develop/api/vero/api.md
---
# VeRO API API


## Types

### MarketplaceIdEnum
**Type:** object

### ReasonCodeDetailType
**Description:** This type defines the brief and detailed description of a VeRO infringement, as well as the ID associated with the infringement.
**Type:** object

**Properties:**
- **briefText** (string)
  - The short description of the infringement associated with the reason code.
- **detailedText** (string)
  - The long description of the infringement associated with the reason code.
- **veroReasonCodeId** (string)
  - The unique identifier of a VeRO reason code.

### ReportItemDetails
**Description:** This type defines the details of an item being reported for violating a product owner's copyright, trademark, or intellectual property rights.
**Type:** object

**Properties:**
- **brand** (string)
  - The brand name of the item being reported for VeRO violation.  
  
**Max length:** 50 characters
- **copyEmailToRightsOwner** (boolean)
  - If the VeRO Program member wants a copy of the Notice of Claimed Infringement (NOCI) document sent to their email address, this field should be included in the request and set to `true`. This same document is automatically sent to the seller of the reported item.  
  
As this field defaults to `true, the report will be automatically emailed if this field is omitted.      **Default:** true`
- **countries** (array)
  - If the infringement type stated in the **VeroReasonCodeId** has anything to do with which country the item is being shipped to, each country that would trigger this infringement type should be specified in this comma-delimited array.  
  
This field is required when the **veroReasonCodeId** is `9037` (Item(s) is unlawful importation of product bearing trademark).
- **detailedMessage** (string)
  - This field is used to provide further information about the VeRO reason code.  
  
This field is required when the **veroReasonCodeId** is `9052` or `7052` (Other - Provide details information in additional information box below).  
  
**Max length:** 1000 characters
- **itemId** (string)
  - The unique identifier of the listing being reported for the alleged infringement.
- **messageToSeller** (string)
  - This field is used by the VeRO Program member to provide more details to the seller as to why the item is being reported for the alleged infringement.  
  
**Max length:** 1000 characters
- **patent** (string)
  - This field is used to specify the number of a product patent that is being violated.  
  
This field is required when the **veroReasonCodeId** is `9048` (Item(s) infringes a valid patent).  
  
**Max length:** 15 characters
- **regions** (array)
  - If the infringement type stated in the **veroReasonCodeId** has anything to do with which geographical region the item is being shipped to, each region that would trigger this infringement type should be specified in this comma-delimited array.
- **veroReasonCodeId** (string)
  - The unique identifier for the type of claimed infringement.  
  
Use [getVeroReasonCodes](/api-docs/commerce/vero/resources/vero_reason_code/methods/getVeroReasonCodes) to retrieve a list of valid reason codes for a given eBay site.

### ReportStatusResponse
**Description:** This type defines the response fields of the **getVeroReport** method.
**Type:** object

**Properties:**
- **reportedItemDetails** (array)
  - This array returns the status for each eBay item that was included as part of the report.  
  
This array is only returned if the **includeItemDetails** query parameter is set to `true`.
- **veroReportId** (string)
  - The unique packet identifier of the VeRO report.
- **veroReportStatus** (VeroReportStatusEnum)
  - The processing status of the requested VeRO report.

### ReportedItem
**Description:** This type defines the item ID and status of a VeRO report. If applicable, a reason for report failure is also returned.
**Type:** object

**Properties:**
- **itemId** (string)
  - The unique identifier of the listing that is being reported for copyright, trademark, or intellectual right infringement.
- **reasonForFailure** (string)
  - This text explanation is submitted by eBay when the submission of a VeRO Report has failed or was blocked.  
  
This field is conditionally returned if the **status** value of the report is `ClarificationRequired` or `SubmissionFailed`.
- **status** (VeroReportedItemStatusEnum)
  - The current status of the VeRO reported item.

### VeroReasonCode
**Description:** This type is used to define the details of a VeRO reason code for a specific site.
**Type:** object

**Properties:**
- **marketplaceId** (MarketplaceIdEnum)
  - The eBay site for which reason code details are returned.
- **reasonCodeDetails** (array)
  - This container includes both brief and detailed text descriptions for the VeRO program intellectual property right infringement reason, as well as the ID for the reason code.

### VeroReasonCodeDetailResponse
**Description:** This type defines the response fields returned in the **getCeroReasonCodes** method.
**Type:** object

**Properties:**
- **veroReasonCodes** (array)
  - This array provides a list of VeRO reason codes, as well as the ID and details of each code, based on the input criteria.  
  
If a **X-EBAY-C-MARKETPLACE-ID** header is used, only VeRO reason codes for that specific site will be returned. If this header is not included, all reason codes for all sites are returned.

### VeroReasonCodeResponse
**Type:** object

**Properties:**
- **marketplaceId** (MarketplaceIdEnum)
  - The eBay site for which reason code details are returned.
- **reasonCodeDetails** (ReasonCodeDetailType)
  - This container includes both brief and detailed text descriptions for the VeRO program intellectual property right infringement reason, as well as the ID for the reason code

### VeroReportItemsRequest
**Description:** This type defines the request fields used in the **createVeroReport** method.
**Type:** object

**Properties:**
- **reportItems** (array)
  - This array is used to report one or more eBay items that are allegedly violating the product owner's copyright, trademark, or intellectual property rights.  
  
The **itemId** and **veroReasonCodeId** fields are required for each reported violation.  
  
**Note:** You can report the same item more than once if a different reason code is used each time.

### VeroReportItemsResponse
**Description:** This type defines the response fields used in the **createVeroReport** method.
**Type:** object

**Properties:**
- **veroReportId** (string)
  - The unique identifier of the VeRO report that the item violations have been added to.  
  
**Note:** Users should keep track of the returned **veroReportId**, as there is no programmatic way to retrieve this value at this time.
- **veroReportStatus** (VeroReportStatusEnum)
  - The processing status of the VeRO report.

### VeroReportStatusEnum
**Description:** This enumerated type defines the values that represent the status of a VeRO Report packet. | - **RECEIVED**: RECEIVED - **IN_PROCESS**: IN_PROCESS - **PROCESSED**: PROCESSED
**Type:** object

### VeroReportStatusResponse
**Description:** This type defines the response fields for the **getVeroReports** method.
**Type:** object

**Properties:**
- **href** (string)
  - The URL to the current page of the VeRO reported item results.
- **limit** (integer)
  - The value of the **limit** parameter submitted in the request.
- **next** (string)
  - The URI for the next page of results. This value is returned if there is an additional page of results to return from the result set
- **offset** (integer)
  - The value off the **offset** parameter submitted in the request.
- **prev** (string)
  - The URI for the previous page of results. This is returned if there is a previous page of results from the result set.
- **reportedItemDetails** (array)
  - This array returns the item ID and statuses of the reported items being returned.
- **total** (integer)
  - This is the total number of records that match the input criteria.

### VeroReportedItemStatusEnum
**Description:** This enumerated type defines the status of a VeRO reported item. | - **NONE**: NONE - **RECEIVED**: RECEIVED - **SUBMITTED**: SUBMITTED - **SUBMISSION_FAILED**: SUBMISSION_FAILED - **REMOVED**: REMOVED - **CLARIFICATION_REQUIRED**: CLARIFICATION_REQUIRED
**Type:** object

## Rate Limits

See [API Call Limits](https://developer.ebay.com/develop/get-started/api-call-limits) on the eBay Developer Program.

## Resources

### Documentation

- [eBay Developer Program](https://developer.ebay.com/)
- [API Documentation](https://developer.ebay.com/develop/api/)
- [SDKs and Widgets](https://developer.ebay.com/develop/sdks-and-widgets)
- [Developer Community Forum](https://community.ebay.com/t5/Developer-Groups/ct-p/developergroup)

### Tools

- [API Explorer](https://developer.ebay.com/my/api_test_tool)
- [GraphQL Explorer](https://developer.ebay.com/my/graphql_explorer)

### Support

- [Developer Support](https://developer.ebay.com/support/)
- [API Status](https://developer.ebay.com/support/api-status)
- [Release Notes](https://developer.ebay.com/develop/api/release_notes/)

---
*Generated on 2026-05-13T18:30:15.904Z*
