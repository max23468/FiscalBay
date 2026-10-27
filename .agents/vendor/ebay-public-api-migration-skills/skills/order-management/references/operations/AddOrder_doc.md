# AddOrder - Traditional API (SOAP)

> **Call Name:** AddOrder
> **API Type:** SOAP XML traditional API
> **API Version:** 967
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

Sellers can use this call to combine two or more (maximum of 40) order line items from the same buyer into one Combined Invoice order. This enables a buyer to pay for all order line items with a single payment (and, if so arranged and possible, ship all of the items together, possibly at a discount).

**Purpose:**
Sellers can use this call to combine two or more (maximum of 40) order line items from the same buyer into one Combined Invoice order. This enables a buyer to pay for all order line items with a single payment (and, if so arranged and possible, ship all of the items together, possibly at a discount). An order line item is created when there is a commitment from the buyer to purchase an item.

**Use Cases:**
- Creates a combined order from multiple order line items.

**Important Notes:**
- Creates a combined order from multiple order line items.

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
X-EBAY-API-COMPATIBILITY-LEVEL: 967
X-EBAY-API-CALL-NAME: AddOrder
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
<AddOrderRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <Order>
    <CreatingUserRole></CreatingUserRole>
    <PaymentMethods></PaymentMethods>
    <!-- ... more PaymentMethods values allowed here ... -->
    <SellerEmail>string</SellerEmail>
    <ShippingDetails>
      <InternationalShippingServiceOption>
        <ShippingService>token</ShippingService>
        <ShippingServiceAdditionalCost></ShippingServiceAdditionalCost>
        <ShippingServiceCost></ShippingServiceCost>
        <ShippingServicePriority>int</ShippingServicePriority>
        <ShipToLocation>string</ShipToLocation>
        <!-- ... more ShipToLocation values allowed here ... -->
      </InternationalShippingServiceOption>
      <!-- ... more InternationalShippingServiceOption nodes allowed here ... -->
      <SalesTax>
        <SalesTaxPercent>float</SalesTaxPercent>
        <SalesTaxState>string</SalesTaxState>
        <ShippingIncludedInTax>boolean</ShippingIncludedInTax>
      </SalesTax>
      <ShippingServiceOptions>
        <ShippingService>token</ShippingService>
        <ShippingServiceAdditionalCost></ShippingServiceAdditionalCost>
        <ShippingServiceCost></ShippingServiceCost>
        <ShippingServicePriority>int</ShippingServicePriority>
      </ShippingServiceOptions>
      <!-- ... more ShippingServiceOptions nodes allowed here ... -->
      <ThirdPartyCheckout>boolean</ThirdPartyCheckout>
    </ShippingDetails>
    <Total currencyID="CurrencyCodeType">
    </Total>
    <TransactionArray>
      <Transaction>
        <Item>
          <ItemID></ItemID>
          <ShippingServiceCostOverrideList></ShippingServiceCostOverrideList>
        </Item>
        <TransactionID>string</TransactionID>
      </Transaction>
      <!-- ... more Transaction nodes allowed here ... -->
    </TransactionArray>
  </Order>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <InvocationID></InvocationID>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</AddOrderRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| Order | OrderType | Yes | The root container of the AddOrder request. In this call, the seller identifies two or more unpaid order line items from the same buyer through the TransactionArray container, specifies one or more accepted payment methods through the PaymentMethods field(s), and specifies available shipping services and other shipping details through the ShippingDetails container. |

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
<AddOrderResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <CreatedTime>dateTime</CreatedTime>
  <OrderID></OrderID>
  <!-- Standard Output Fields -->
  <Ack></Ack>
  <Build>string</Build>
  <CorrelationID>string</CorrelationID>
  <DuplicateInvocationDetails>
    <DuplicateInvocationID></DuplicateInvocationID>
    <InvocationTrackingID>string</InvocationTrackingID>
    <Status></Status>
  </DuplicateInvocationDetails>
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
</AddOrderResponse>
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
| OrderID | OrderIDType | Always | The unique identifier of the successfully-created 'Combined Invoice' order. This value is only created and returned if the AddOrder call is successful in creating the new order. This value can be used as an input filter in GetOrders calls to retrieve the 'Combined Invoice' order. Note: This unique identifier is not the same as the OrderID that is generated after payment. |
| CreatedTime | dateTime | Always | Timestamp that indicates the date and time that the 'Combined Invoice' order was created. |

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

### AddOrderRequestType

**Description:** The AddOrder call can be used by a seller to combine two or more unpaid, single line item orders from the same buyer into one 'Combined Invoice' order with multiple line items. Once multiple line items are combined into one order, the buyer can make one single payment for multiple line item order. If possible and agreed to, the seller can then ship multiple line items in the same shipping package, saving on shipping costs, and possibly passing that savings down to the buyer through Combined Shipping Discount rules set up in My eBay.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| Order | OrderType | [0..1] | The root container of the AddOrder request. In this call, the seller identifies two or more unpaid order line items from the same buyer through the TransactionArray container, specifies one or more accepted payment methods through the PaymentMethods field(s), and specifies available shipping services and other shipping details through the ShippingDetails container. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<AddOrderRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <Order>
    <CreatingUserRole></CreatingUserRole>
    <PaymentMethods></PaymentMethods>
    <!-- ... more PaymentMethods values allowed here ... -->
    <SellerEmail>string</SellerEmail>
    <ShippingDetails>
      <InternationalShippingServiceOption>
        <ShippingService>token</ShippingService>
        <ShippingServiceAdditionalCost></ShippingServiceAdditionalCost>
        <ShippingServiceCost></ShippingServiceCost>
        <ShippingServicePriority>int</ShippingServicePriority>
        <ShipToLocation>string</ShipToLocation>
        <!-- ... more ShipToLocation values allowed here ... -->
      </InternationalShippingServiceOption>
      <!-- ... more InternationalShippingServiceOption nodes allowed here ... -->
      <SalesTax>
        <SalesTaxPercent>float</SalesTaxPercent>
        <SalesTaxState>string</SalesTaxState>
        <ShippingIncludedInTax>boolean</ShippingIncludedInTax>
      </SalesTax>
      <ShippingServiceOptions>
        <ShippingService>token</ShippingService>
        <ShippingServiceAdditionalCost></ShippingServiceAdditionalCost>
        <ShippingServiceCost></ShippingServiceCost>
        <ShippingServicePriority>int</ShippingServicePriority>
      </ShippingServiceOptions>
      <!-- ... more ShippingServiceOptions nodes allowed here ... -->
      <ThirdPartyCheckout>boolean</ThirdPartyCheckout>
    </ShippingDetails>
    <Total currencyID="CurrencyCodeType">
    </Total>
    <TransactionArray>
      <Transaction>
        <Item>
          <ItemID></ItemID>
          <ShippingServiceCostOverrideList></ShippingServiceCostOverrideList>
        </Item>
        <TransactionID>string</TransactionID>
      </Transaction>
      <!-- ... more Transaction nodes allowed here ... -->
    </TransactionArray>
  </Order>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <InvocationID></InvocationID>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</AddOrderRequest>
```

### AddOrderResponseType

**Description:** This type defines the response of an AddOrder call. If the multiple line items are successfully combined into a single order, this response includes the unique identifier of this 'Combined Invoice' order (automatically generated by eBay), and a timestamp indicating when the new order was created.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| OrderID | OrderIDType | [0..1] | The unique identifier of the successfully-created 'Combined Invoice' order. This value is only created and returned if the AddOrder call is successful in creating the new order. This value can be used as an input filter in GetOrders calls to retrieve the 'Combined Invoice' order. Note: This unique identifier is not the same as the OrderID that is generated after payment. |
| CreatedTime | dateTime | [0..1] | Timestamp that indicates the date and time that the 'Combined Invoice' order was created. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<AddOrderResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <CreatedTime>dateTime</CreatedTime>
  <OrderID></OrderID>
  <!-- Standard Output Fields -->
  <Ack></Ack>
  <Build>string</Build>
  <CorrelationID>string</CorrelationID>
  <DuplicateInvocationDetails>
    <DuplicateInvocationID></DuplicateInvocationID>
    <InvocationTrackingID>string</InvocationTrackingID>
    <Status></Status>
  </DuplicateInvocationDetails>
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
</AddOrderResponse>
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

1. Order creation requires eligible order line items belonging to the same buyer/seller context.

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
| AddOrder | Purchase Quote API createPurchaseQuote | Mutation |
| AddOrder | Purchase Quote API bulkUpdatePurchaseQuote | Mutation |
| AddOrder | Unknown requestPurchaseQuote | Mutation |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_addorder_html.jsonl`; `.trace_artifacts/extract_wsdl_addorder.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
