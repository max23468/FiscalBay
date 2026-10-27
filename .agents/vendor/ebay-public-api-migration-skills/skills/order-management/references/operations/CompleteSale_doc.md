# CompleteSale - Traditional API (SOAP)

> **Call Name:** CompleteSale
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

Use this call to do various tasks after the creation of a single line item or multiple line item order.

**Purpose:**
Use this call to do various tasks after the creation of a single line item or multiple line item order.

**Use Cases:**
- Updates post-order sale details such as shipment/payment state.

**Important Notes:**
- Updates post-order sale details such as shipment/payment state.

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
X-EBAY-API-CALL-NAME: CompleteSale
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
<CompleteSaleRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <FeedbackInfo>
    <CommentText>string</CommentText>
    <CommentType></CommentType>
    <TargetUser></TargetUser>
  </FeedbackInfo>
  <ItemID></ItemID>
  <OrderID>string</OrderID>
  <OrderLineItemID>string</OrderLineItemID>
  <Paid>boolean</Paid>
  <Shipment>
    <ShipmentTrackingDetails>
      <ShipmentLineItem>
        <LineItem>
          <CountryOfOrigin>string</CountryOfOrigin>
          <Description>string</Description>
          <ItemID></ItemID>
          <Quantity>int</Quantity>
          <TransactionID>string</TransactionID>
        </LineItem>
        <!-- ... more LineItem nodes allowed here ... -->
      </ShipmentLineItem>
      <ShipmentTrackingNumber>string</ShipmentTrackingNumber>
      <ShippingCarrierUsed>string</ShippingCarrierUsed>
    </ShipmentTrackingDetails>
    <!-- ... more ShipmentTrackingDetails nodes allowed here ... -->
    <ShippedTime>dateTime</ShippedTime>
  </Shipment>
  <Shipped>boolean</Shipped>
  <TransactionID>string</TransactionID>
  <!-- Standard Input Fields -->
  <ErrorHandling></ErrorHandling>
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</CompleteSaleRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| None identified | - | No | No always-required request fields were explicitly labeled in the extracted source. |

#### Optional Fields

| Field Path | Type | Default | Description | Constraints |
|------------|------|---------|-------------|-------------|
| FeedbackInfo | FeedbackInfoType | Not specified in source | This container is used by the seller to leave feedback for the buyer for the order line item identified in the call request. The seller must include and specify all fields of this type, including the buyer's eBay User ID, the Feedback rating (a seller can only leave a buyer a 'Positive' rating), and a comment, which helps justify the Feedback rating. The eBay User ID must match the buyer who bought the order line item, or an error will occur. An error will also occur if Feedback has already been left for the buyer (either through API or the Web flow). To determine if Feedback has already been left for an order line item, you can call GetFeedback , passing in the OrderLineItemID value in the call request. Note: Feedback entries are submitted at the order line item level, so either an OrderLineItemID value or an ItemID / TransactionID pair should be specified to identify the order line item (and not an OrderLineItemID value). To leave Feedback for all line items in a multiple line item order, the seller would need a separate CompleteSale request for each order line item. | Not specified in source |
| Shipped | boolean | Not specified in source | The seller includes and sets this field to true if the order or order line item has been shipped. If the call is successful, the order line item(s) are marked as Shipped in My eBay. If the seller includes and sets this field to false, the order or order line item are marked (or remain) as 'Not Shipped' in eBay's system. If this field is not included, the shipped status of the order or order line item remain unchanged in My eBay. If shipment tracking information is provided for an order or order line item through the Shipment container in the same request, the Shipped status is set to true automatically, and the Shipped field is not necessary. | Not specified in source |
| Paid | boolean | Not specified in source | The seller includes and sets this field to true to mark an unpaid order as paid. If the call is successful, the order line item(s) are marked as 'Paid' in eBay's system. Note: The seller is not allowed to set this field to false . | Not specified in source |
| ListingType | ListingTypeCodeType | Not specified in source | Note: DO NOT USE THIS FIELD. Previously, this field's only purpose was to classify the order to be updated as a Half.com order. However, since the Half.com site has been shut down, this field is no longer applicable. | Not specified in source |
| Shipment | ShipmentType | Not specified in source | Container consisting of shipment tracking information, shipped time, and an optional text field to provide additional details to the buyer. Setting the tracking number and shipping carrier automatically marks the order line item as shipped and the Shipped field is not necessary. If you supply ShipmentTrackingNumber , you must also supply ShippingCarrierUsed ; otherwise you will get an error. To modify the shipping tracking number and/or shipping carrier, supply the new number in the ShipmentTrackingNumber field or supply the value for ShippingCarrierUsed , or both. The old number and carrier are deleted and the new ones are added. To simply delete the current tracking details altogether, supply empty Shipment tags. Note: Top-Rated sellers must have a record of uploading shipment tracking information (through site or through API) for at least 95 percent of their order line items (purchased by U.S. buyers) to keep their status as Top-Rated sellers. For more information on the requirements to becoming a Top-Rated Seller, see the Becoming a Top-Rated Seller and qualifying for Top-Rated Plus customer support page. | Not specified in source |
| OrderID | string | Not specified in source | A unique identifier for an eBay order. This field can be used to make an 'order-level' update. If an order has multiple line items, and the CompleteSale call is being used to update the status of, or provide feedback for a single line item within the order, the OrderLineItemID field or ItemID / TransactionID pair must be used to identify this order line item instead of the OrderID field. If the order only has one line item, it the OrderID field can be used to make any updates with the CompleteSale call. OrderID overrides an OrderLineItemID or ItemID / TransactionID pair if these fields are also specified in the same request. Note: Note that the unique identifier of a 'non-immediate payment' order will change as it goes from an unpaid order to a paid order. Due to this scenario, all calls that accept Order ID values as request filters/parameters, including the CompleteSale call, will support the identifiers for both unpaid and paid orders. | Not specified in source |

#### Conditional Fields

| Field Path | Type | Condition | Description |
|------------|------|-----------|-------------|
| ItemID | ItemIDType | Conditionally | Unique identifier for an eBay listing. An ItemID value can be paired up with a corresponding TransactionID value in a CompleteSale request to identify a single order line item. Alternatively, the OrderLineItemID value for the order line item can be used. Unless an OrderLineItemID value is used to identify a single order line item, or the OrderID value is used to identify a single or multiple line item order, the ItemID / TransactionID pair must be specified. To perform an action on an entire multiple line item order, the OrderID field must be used. If an OrderID or OrderLineItemID value is specified, an ItemID / TransactionID pair will be ignored (if present in the same request). |
| TransactionID | string | Conditionally | Unique identifier for a sales transaction. A TransactionID identifier is created once there is a commitment to buy (bidder wins the auction, buyer clicks buy button, or buyer purchases item through PlaceOffer call). The TransactionID can be paired up with the corresponding ItemID value in a CompleteSale request to identify a single order line item. Alternatively, the OrderLineItemID value for the order line item can be used. Unless an OrderLineItemID value is used to identify a single order line item, or the OrderID value is used to identify a single or multiple line item order, the ItemID / TransactionID pair must be specified. To perform an action on an entire multiple line item order, the OrderID field must be used. If an OrderID or OrderLineItemID value is specified, an ItemID / TransactionID pair will be ignored (if present in the same request). The TransactionID value for auction listings is always 0 since there can be only one winning bidder/one sale for an auction listing. Note: Beginning in July 2024, non-zero transaction IDs will start being returned for auction listings. If necessary, update code to handle non-zero transaction IDs for auction transactions before this time. |
| OrderLineItemID | string | No | A unique identifier for an eBay order line item. OrderLineItemID values are returned (at the order line item level) in Traditional API's order management calls. This identifier is created once there is a commitment to buy (bidder wins the auction, buyer clicks buy button, or buyer purchases item through PlaceOffer call). An OrderLineItemID value can be used in a CompleteSale request to identify a line item within an order. Alternatively, an ItemID / TransactionID pair can also be used to identify a line item. Unless an ItemID / TransactionID pair is used to identify an order line item, or an OrderID value is used to identify an order, the OrderLineItemID must be specified. If OrderLineItemID is specified, the ItemID / TransactionID pair are ignored if present in the same request. |

## Response Structure

### XML Schema

```xml
<?xml version="1.0" encoding="utf-8"?>
<CompleteSaleResponse xmlns="urn:ebay:apis:eBLBaseComponents">
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
</CompleteSaleResponse>
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

### CompleteSaleRequestType

**Description:** Enables a seller to perform various tasks with a single or multiple line item order. Tasks available with this call include marking the order as paid, marking the order as shipped, providing shipment tracking details to the buyer, and leaving feedback for the buyer.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| ItemID | ItemIDType | [0..1] | Unique identifier for an eBay listing. An ItemID value can be paired up with a corresponding TransactionID value in a CompleteSale request to identify a single order line item. Alternatively, the OrderLineItemID value for the order line item can be used. Unless an OrderLineItemID value is used to identify a single order line item, or the OrderID value is used to identify a single or multiple line item order, the ItemID / TransactionID pair must be specified. To perform an action on an entire multiple line item order, the OrderID field must be used. If an OrderID or OrderLineItemID value is specified, an ItemID / TransactionID pair will be ignored (if present in the same request). |
| TransactionID | string | [0..1] | Unique identifier for a sales transaction. A TransactionID identifier is created once there is a commitment to buy (bidder wins the auction, buyer clicks buy button, or buyer purchases item through PlaceOffer call). The TransactionID can be paired up with the corresponding ItemID value in a CompleteSale request to identify a single order line item. Alternatively, the OrderLineItemID value for the order line item can be used. Unless an OrderLineItemID value is used to identify a single order line item, or the OrderID value is used to identify a single or multiple line item order, the ItemID / TransactionID pair must be specified. To perform an action on an entire multiple line item order, the OrderID field must be used. If an OrderID or OrderLineItemID value is specified, an ItemID / TransactionID pair will be ignored (if present in the same request). The TransactionID value for auction listings is always 0 since there can be only one winning bidder/one sale for an auction listing. Note: Beginning in July 2024, non-zero transaction IDs will start being returned for auction listings. If necessary, update code to handle non-zero transaction IDs for auction transactions before this time. |
| FeedbackInfo | FeedbackInfoType | [0..1] | This container is used by the seller to leave feedback for the buyer for the order line item identified in the call request. The seller must include and specify all fields of this type, including the buyer's eBay User ID, the Feedback rating (a seller can only leave a buyer a 'Positive' rating), and a comment, which helps justify the Feedback rating. The eBay User ID must match the buyer who bought the order line item, or an error will occur. An error will also occur if Feedback has already been left for the buyer (either through API or the Web flow). To determine if Feedback has already been left for an order line item, you can call GetFeedback , passing in the OrderLineItemID value in the call request. Note: Feedback entries are submitted at the order line item level, so either an OrderLineItemID value or an ItemID / TransactionID pair should be specified to identify the order line item (and not an OrderLineItemID value). To leave Feedback for all line items in a multiple line item order, the seller would need a separate CompleteSale request for each order line item. |
| Shipped | boolean | [0..1] | The seller includes and sets this field to true if the order or order line item has been shipped. If the call is successful, the order line item(s) are marked as Shipped in My eBay. If the seller includes and sets this field to false, the order or order line item are marked (or remain) as 'Not Shipped' in eBay's system. If this field is not included, the shipped status of the order or order line item remain unchanged in My eBay. If shipment tracking information is provided for an order or order line item through the Shipment container in the same request, the Shipped status is set to true automatically, and the Shipped field is not necessary. |
| Paid | boolean | [0..1] | The seller includes and sets this field to true to mark an unpaid order as paid. If the call is successful, the order line item(s) are marked as 'Paid' in eBay's system. Note: The seller is not allowed to set this field to false . |
| ListingType | ListingTypeCodeType | [0..1] | Note: DO NOT USE THIS FIELD. Previously, this field's only purpose was to classify the order to be updated as a Half.com order. However, since the Half.com site has been shut down, this field is no longer applicable. |
| Shipment | ShipmentType | [0..1] | Container consisting of shipment tracking information, shipped time, and an optional text field to provide additional details to the buyer. Setting the tracking number and shipping carrier automatically marks the order line item as shipped and the Shipped field is not necessary. If you supply ShipmentTrackingNumber , you must also supply ShippingCarrierUsed ; otherwise you will get an error. To modify the shipping tracking number and/or shipping carrier, supply the new number in the ShipmentTrackingNumber field or supply the value for ShippingCarrierUsed , or both. The old number and carrier are deleted and the new ones are added. To simply delete the current tracking details altogether, supply empty Shipment tags. Note: Top-Rated sellers must have a record of uploading shipment tracking information (through site or through API) for at least 95 percent of their order line items (purchased by U.S. buyers) to keep their status as Top-Rated sellers. For more information on the requirements to becoming a Top-Rated Seller, see the Becoming a Top-Rated Seller and qualifying for Top-Rated Plus customer support page. |
| OrderID | string | [0..1] | A unique identifier for an eBay order. This field can be used to make an 'order-level' update. If an order has multiple line items, and the CompleteSale call is being used to update the status of, or provide feedback for a single line item within the order, the OrderLineItemID field or ItemID / TransactionID pair must be used to identify this order line item instead of the OrderID field. If the order only has one line item, it the OrderID field can be used to make any updates with the CompleteSale call. OrderID overrides an OrderLineItemID or ItemID / TransactionID pair if these fields are also specified in the same request. Note: Note that the unique identifier of a 'non-immediate payment' order will change as it goes from an unpaid order to a paid order. Due to this scenario, all calls that accept Order ID values as request filters/parameters, including the CompleteSale call, will support the identifiers for both unpaid and paid orders. |
| OrderLineItemID | string | [0..1] | A unique identifier for an eBay order line item. OrderLineItemID values are returned (at the order line item level) in Traditional API's order management calls. This identifier is created once there is a commitment to buy (bidder wins the auction, buyer clicks buy button, or buyer purchases item through PlaceOffer call). An OrderLineItemID value can be used in a CompleteSale request to identify a line item within an order. Alternatively, an ItemID / TransactionID pair can also be used to identify a line item. Unless an ItemID / TransactionID pair is used to identify an order line item, or an OrderID value is used to identify an order, the OrderLineItemID must be specified. If OrderLineItemID is specified, the ItemID / TransactionID pair are ignored if present in the same request. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<CompleteSaleRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <FeedbackInfo>
    <CommentText>string</CommentText>
    <CommentType></CommentType>
    <TargetUser></TargetUser>
  </FeedbackInfo>
  <ItemID></ItemID>
  <OrderID>string</OrderID>
  <OrderLineItemID>string</OrderLineItemID>
  <Paid>boolean</Paid>
  <Shipment>
    <ShipmentTrackingDetails>
      <ShipmentLineItem>
        <LineItem>
          <CountryOfOrigin>string</CountryOfOrigin>
          <Description>string</Description>
          <ItemID></ItemID>
          <Quantity>int</Quantity>
          <TransactionID>string</TransactionID>
        </LineItem>
        <!-- ... more LineItem nodes allowed here ... -->
      </ShipmentLineItem>
      <ShipmentTrackingNumber>string</ShipmentTrackingNumber>
      <ShippingCarrierUsed>string</ShippingCarrierUsed>
    </ShipmentTrackingDetails>
    <!-- ... more ShipmentTrackingDetails nodes allowed here ... -->
    <ShippedTime>dateTime</ShippedTime>
  </Shipment>
  <Shipped>boolean</Shipped>
  <TransactionID>string</TransactionID>
  <!-- Standard Input Fields -->
  <ErrorHandling></ErrorHandling>
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</CompleteSaleRequest>
```

### CompleteSaleResponseType

**Description:** Not specified in source

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| Not specified in source | Not specified in source | Not specified in source | Not specified in source |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<CompleteSaleResponse xmlns="urn:ebay:apis:eBLBaseComponents">
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
</CompleteSaleResponse>
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

1. Only eligible sale-completion fields can be changed for the target transaction/order.

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
| CompleteSale | Order API markOrdersPaid | Mutation |
| CompleteSale | Item Commitment API markItemCommitmentsPaid | Mutation |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_completesale_html.jsonl`; `.trace_artifacts/extract_wsdl_completesale.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
