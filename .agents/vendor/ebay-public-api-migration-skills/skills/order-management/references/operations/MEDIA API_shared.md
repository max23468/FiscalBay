---
title: Media API
description: "API documentation and reference"
api_version: v1_beta.5.0
api_name: media_api
api_type: REST
api_group: media/api
source_url:
  html: https://developer.ebay.com/develop/api/media/api
  md: https://developer.ebay.com/develop/api/media/api.md
---
# Media API API


## Types

### CreateDocumentFromUrlRequest
**Description:** This type contains the metadata used to create the document ID when creating a document using a URL.
**Type:** object

**Properties:**
- **documentType** (DocumentTypeEnum)
  - The type of the document being created. For example, a `USER_GUIDE_OR_MANUAL` or a `SAFETY_DATA_SHEET`.
- **documentUrl** (string)
  - The URL of the document being created.  
  
The document referenced by the URL must be a .pdf, .png, .jpg, or .jpeg file, and must be no larger than 10 MB.
- **languages** (array)
  - This array shows the language(s) used in the document.

### CreateDocumentRequest
**Description:** This type contains the metadata used to create the document ID.
**Type:** object

**Properties:**
- **documentType** (DocumentTypeEnum)
  - The type of the document being uploaded. For example, a `USER_GUIDE_OR_MANUAL` or a `SAFETY_DATA_SHEET`.
- **languages** (array)
  - This array shows the language(s) used in the document.

### CreateDocumentResponse
**Description:** This type provides information about the created document ID.
**Type:** object

**Properties:**
- **documentId** (string)
  - The unique identifier of the document to be uploaded.  
  
This value is returned in the response and **location** header of the **createDocument** and **createDocumentFromUrl** methods. This ID can be used with the **getDocument** and **uploadDocument** methods, and to add an uploaded document to a listing. See [Adding documents to listings](/api-docs/sell/static/inventory/managing-document-media.html#add-documents) for more information.
- **documentStatus** (DocumentStatusEnum)
  - The status of the document resource.  
  
For example, the value `PENDING_UPLOAD` is the initial state when the reference to the document has been created using the **createDocument** method. When creating a document using the **createDocumentFromUrl** method, the initial state will be `SUBMITTED`.
- **documentType** (DocumentTypeEnum)
  - The type of the document uploaded. For example, `USER_GUIDE_OR_MANUAL`.
- **languages** (array)
  - This array shows the language(s) used in the document.

### CreateImageFromUrlRequest
**Description:** A type that provides the location of the image.
**Type:** object

**Properties:**
- **imageUrl** (string)
  - The image URL of the self-hosted picture to upload to eBay Picture Services (EPS). In addition to the picture requirements in [Picture policy](https://www.ebay.com/help/policies/listing-policies/picture-policy?id=4370), the provided URL must be secured using HTTPS (HTTP is not permitted). For more information, see [Image requirements](/api-docs/sell/static/inventory/managing-image-media.html#image-requirements).

### CreateVideoRequest
**Description:** The request to create a video, which must contain the video's **title**, **size**, and **classification**. **Description** is an optional field when creating videos.
**Type:** object

**Properties:**
- **classification** (array)
  - The intended use for this video content. Currently, videos can only be added and associated with eBay listings, so the only supported value is `ITEM`.
- **description** (string)
  - The description of the video.
- **size** (integer)
  - The size, in bytes, of the video content.  
  
**Max:** 157,286,400 bytes
- **title** (string)
  - The title of the video.

### DocumentMetadata
**Description:** This type provides information about the **documentId**.
**Type:** object

**Properties:**
- **fileName** (string)
  - The name of the file including its extension (for example, `drone_user_warranty.pdf`).
- **fileSize** (string)
  - The size, in bytes, of the document content.
- **fileType** (string)
  - The type of the file uploaded. Supported file types include the following: `pdf`, `jpeg`, `jpg`, and `png`.

### DocumentResponse
**Description:** This type provides information returned about a created document ID, which may or may not have been uploaded.
**Type:** object

**Properties:**
- **documentId** (string)
  - The unique ID of the document.
- **documentMetadata** (DocumentMetadata)
  - This container provides the name, size, and type of the specified file.
- **documentStatus** (DocumentStatusEnum)
  - The status of the document resource.  
  
Once a document has been uploaded using the **uploadDocument** method, the **documentStatus** will be `SUBMITTED`. The document will then either be accepted or rejected. Only documents with the status of `ACCEPTED` are available to be added to a listing.
- **documentType** (DocumentTypeEnum)
  - The type of the document uploaded. For example, `USER_GUIDE_OR_MANUAL`.
- **languages** (array)
  - This array shows the language(s) used in the document.

### DocumentStatusEnum
**Description:** An enumerated value indicating the status of the document. | - **SUBMITTED**: SUBMITTED - **ACCEPTED**: ACCEPTED - **REJECTED**: REJECTED - **PENDING_UPLOAD**: PENDING_UPLOAD - **EXPIRED**: EXPIRED
**Type:** object

### DocumentTypeEnum
**Description:** This enumeration value indicates the type of document. | - **CERTIFICATE_OF_ANALYSIS**: CERTIFICATE_OF_ANALYSIS - **CERTIFICATE_OF_CONFORMITY**: CERTIFICATE_OF_CONFORMITY - **DECLARATION_OF_CONFORMITY**: DECLARATION_OF_CONFORMITY - **INSTRUCTIONS_FOR_USE**: INSTRUCTIONS_FOR_USE - **OTHER_SAFETY_DOCUMENTS**: OTHER_SAFETY_DOCUMENTS - **SAFETY_DATA_SHEET**: SAFETY_DATA_SHEET - **TROUBLE_SHOOTING_GUIDE**: TROUBLE_SHOOTING_GUIDE - **USER_GUIDE_OR_MANUAL**: USER_GUIDE_OR_MANUAL - **INSTALLATION_INSTRUCTIONS**: INSTALLATION_INSTRUCTIONS - **ACCESSIBILITY_INFORMATION**: ACCESSIBILITY_INFORMATION - **SAFETY_TEST_LAB_REPORTS**: SAFETY_TEST_LAB_REPORTS - **GENERAL_CERTIFICATE_OF_CONFORMITY**: GENERAL_CERTIFICATE_OF_CONFORMITY - **CHILDRENS_PRODUCT_CERTIFICATE**: CHILDRENS_PRODUCT_CERTIFICATE
**Type:** object

### Error
**Description:** This type defines the fields that can be returned in an error.
**Type:** object

**Properties:**
- **category** (string)
  - Identifies the type of erro.
- **domain** (string)
  - Name for the primary system where the error occurred. This is relevant for application errors.
- **errorId** (integer)
  - A unique number to identify the error.
- **inputRefIds** (array)
  - An array of request elements most closely associated to the error.
- **longMessage** (string)
  - A more detailed explanation of the error.
- **message** (string)
  - Information on how to correct the problem, in the end user's terms and language where applicable.
- **outputRefIds** (array)
  - An array of request elements most closely associated to the error.
- **parameters** (array)
  - An array of name/value pairs that describe details the error condition. These are useful when multiple errors are returned.
- **subdomain** (string)
  - Further helps indicate which subsystem the error is coming from. System subcategories include: Initialization, Serialization, Security, Monitoring, Rate Limiting, etc.

### ErrorParameter
**Type:** object

**Properties:**
- **name** (string)
  - The object of the error.
- **value** (string)
  - The value of the object.

### Image
**Description:** A type that provides the location of the image.
**Type:** object

**Properties:**
- **imageUrl** (string)
  - The URL of the image's location.

### ImageResponse
**Description:** A type that provides an image's details including its URL and expiration.
**Type:** object

**Properties:**
- **expirationDate** (string)
  - The date and time when an unused EPS image will expire and be removed from the EPS server, in Coordinated Universal Time (UTC). As long as an EPS image is being used in an active listing, that image will remain on the EPS server and be accessible.
- **imageUrl** (string)
  - The EPS URL to access the uploaded image. This URL will be used in listing calls to add the image to a listing.
- **maxDimensionImageUrl** (string)
  - The EPS URL to access the maximum dimension version of the uploaded image.

### Moderation
**Description:** A container that provides video moderation information when calling the **getVideo** method.  
  
This container is returned if the specified video has been blocked by moderators.  
  
**Tip:** See [Video moderation and restrictions](https://www.ebay.com/help/selling/listings/creating-managing-listings/add-video-to-listing?id=5272#section2) in the eBay Seller Center for details about video moderation.
**Type:** object

**Properties:**
- **rejectReasons** (array)
  - The reason(s) why the specified video was blocked by moderators.

### Play
**Description:** The two streaming video URLs available for a successfully uploaded video with a status of `LIVE`. The supported streaming video protocols are DASH (Dynamic Adaptive Streaming over HTTP) and HLS (HTTP Live Streaming).
**Type:** object

**Properties:**
- **playUrl** (string)
  - The playable URL for this video.
- **protocol** (ProtocolEnum)
  - The protocol for the video playlist. Supported protocols are DASH (Dynamic Adaptive Streaming over HTTP) and HLS (HTTP Live Streaming).

### ProtocolEnum
**Description:** An enumerated type that indicates whether the video streaming protocol is DASH (Dynamic Adaptive Streaming over HTTP) or HLS (HTTP Live Streaming).  
  
DASH is also known as MPEG-DASH. It is an internationally accepted protocol for streaming video. It splits a larger media file into much smaller segments.  
  
HLS is a format developed by Apple. Rather than deliver a video file all at once, HLS splits it into much smaller segments. Since HLS was developed by Apple, it is the only method of video streaming currently supported on iOS (iPad and iPhone) and is supported natively within its Mac Safari browser. | - **DASH**: DASH - **HLS**: HLS
**Type:** object

### Video
**Description:** A response field that retrieves all the metadata for the video, including its **title**, **classification**, **size**, **description**, **status**, **status message** (if any), and **expiration date**.
**Type:** object

**Properties:**
- **classification** (array)
  - The intended use for this video content. Currently, videos can only be added and associated with eBay listings, so the only supported value is `ITEM`.
- **description** (string)
  - The description of the video. The video description is an optional field that can be set using the [createVideo]( /api-docs/commerce/media/resources/video/methods/createVideo) method.
- **expirationDate** (string)
  - The date and time when an unused video will expire and be removed from the eBay Video Services server, in Coordinated Universal Time (UTC).  
  
As long as a video is being used in an active listing, that video will remain on the server and be accessible. If a video is not being used on an active listing, its expiration date is automatically set to 30 days after the video's initial upload.
- **moderation** (Moderation)
  - The video moderation information that is returned if a video is blocked by moderators.  
  
**Tip:** See [Video moderation and restrictions](https://www.ebay.com/help/selling/listings/creating-managing-listings/add-video-to-listing?id=5272#section2) in the eBay Seller Center for details about video moderation.  
  
If the video status is `BLOCKED`, ensure that the video complies with eBay's video formatting and content guidelines. Afterwards, begin the video creation and upload procedure anew using the **createVideo** and **uploadVideo** methods.
- **playLists** (array)
  - The playlist created for the uploaded video, which provides the streaming video URLs to play the video. The supported streaming video protocols are DASH (Dynamic Adaptive Streaming over HTTP) and HLS (HTTP Live Streaming). The playlist will only be generated if a video is successfully uploaded with a status of `LIVE`.
- **size** (integer)
  - The size, in bytes, of the video content.
- **status** (VideoStatusEnum)
  - The status of the current video resource.
- **statusMessage** (string)
  - The **statusMessage** field contains additional information on the status. For example, information on why processing might have failed or if the video was blocked.
- **thumbnail** (Image)
  - The URL of the thumbnail image of the video. The thumbnail image's URL must be an eBayPictureURL (EPS URL).
- **title** (string)
  - The title of the video.
- **videoId** (string)
  - The unique ID of the video.

### VideoStatusEnum
**Description:** An enumerated value indicating the video's status. The available status values are `PENDING_UPLOAD`, `PROCESSING`, `PROCESSING_FAILED`, `BLOCKED`, and `LIVE`. | - **PENDING_UPLOAD**: PENDING_UPLOAD - **PROCESSING**: PROCESSING - **PROCESSING_FAILED**: PROCESSING_FAILED - **BLOCKED**: BLOCKED - **LIVE**: LIVE
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
*Generated on 2026-05-13T18:12:02.826Z*
