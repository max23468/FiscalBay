# SendInvoice - Traditional API (SOAP)

> **Call Name:** SendInvoice
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

Use this call to send an email invoice or order to a buyer. If you specify a valid ItemID and TransactionID pair or an OrderLineItemID, SendInvoice sends a new or reminder invoice to the buyer.

**Purpose:**
Use this call to send an email invoice or order to a buyer. If you specify a valid ItemID and TransactionID pair or an OrderLineItemID, SendInvoice sends a new or reminder invoice to the buyer. If you instead specify an OrderID, SendInvoice sends the order information to the buyer.

**Use Cases:**
- Sends an invoice for an order/transaction.

**Important Notes:**
- Sends an invoice for an order/transaction.

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
X-EBAY-API-CALL-NAME: SendInvoice
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
<SendInvoiceRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <AdjustmentAmount currencyID="CurrencyCodeType">
  </AdjustmentAmount>
  <CheckoutInstructions>string</CheckoutInstructions>
  <EmailCopyToSeller>boolean</EmailCopyToSeller>
  <InternationalShippingServiceOptions>
    <ShippingService>token</ShippingService>
    <ShippingServiceAdditionalCost currencyID="CurrencyCodeType">
    </ShippingServiceAdditionalCost>
    <ShippingServiceCost currencyID="CurrencyCodeType">
    </ShippingServiceCost>
    <ShippingServicePriority>int</ShippingServicePriority>
    <ShipToLocation>string</ShipToLocation>
    <!-- ... more ShipToLocation values allowed here ... -->
  </InternationalShippingServiceOptions>
  <!-- ... more InternationalShippingServiceOptions nodes allowed here ... -->
  <ItemID></ItemID>
  <OrderID></OrderID>
  <OrderLineItemID>string</OrderLineItemID>
  <PaymentMethods></PaymentMethods>
  <!-- ... more PaymentMethods values allowed here ... -->
  <SalesTax>
    <SalesTaxAmount currencyID="CurrencyCodeType">
    </SalesTaxAmount>
    <SalesTaxPercent>float</SalesTaxPercent>
    <SalesTaxState>string</SalesTaxState>
    <ShippingIncludedInTax>boolean</ShippingIncludedInTax>
  </SalesTax>
  <ShippingServiceOptions>
    <ShippingService>token</ShippingService>
    <ShippingServiceAdditionalCost currencyID="CurrencyCodeType">
    </ShippingServiceAdditionalCost>
    <ShippingServiceCost currencyID="CurrencyCodeType">
    </ShippingServiceCost>
    <ShippingServicePriority>int</ShippingServicePriority>
  </ShippingServiceOptions>
  <!-- ... more ShippingServiceOptions nodes allowed here ... -->
  <SKU></SKU>
  <TransactionID>string</TransactionID>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</SendInvoiceRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| None identified | - | No | No always-required request fields were explicitly labeled in the extracted source. |

#### Optional Fields

| Field Path | Type | Default | Description | Constraints |
|------------|------|---------|-------------|-------------|
| InternationalShippingServiceOptions | InternationalShippingServiceOptionsType | Not specified in source | If the buyer has an international shipping address, use this container to offer up to four international shipping service options (or five if one of the shipping service options is Global Shipping Program or eBay International Shipping). If one or more international shipping service options are offered through this container, the (domestic) ShippingServiceOptions container should not be included in the same request. | Not specified in source |
| ShippingServiceOptions | ShippingServiceOptionsType | Not specified in source | If the buyer has a domestic shipping address, use this container to offer up to four domestic shipping service options. If one or more domestic shipping service options are offered through this container, the InternationalShippingServiceOptions container should not be included in the same request. | Not specified in source |
| SalesTax | SalesTaxType | Not specified in source | This container is used if the seller wishes to apply sales tax to the order if the buyer lives in a state/jurisdiction where sales tax is not already collected automatically by eBay and remitted to the tax authority. The amount of sales tax applied to the order is dependent on the sales tax rate in the buyer's state and whether sales tax is being applied to the cost of the order only or the cost of the order plus shipping and handling. Note: Buyers in all 50 US states and DC are automatically charged sales tax for eBay purchases, and eBay collects and remits this sales tax to the proper taxing authority on the buyer's behalf. Because of this, if a sales tax percentage rate is applied to a listing by a seller in one of these states, this field will be ignored during the checkout process. Currently, sales tax percentage rates can only be specified by sellers in Canada and 5 US territories, including American Samoa (AS), Guam (GU), Northern Mariana Islands (MP), Palau (PW), and Virgin Islands (VI). | Not specified in source |
| PaymentMethods | BuyerPaymentMethodCodeType | Not specified in source | This field should only be used if the seller needs to add one or more offline payment options for an order that requires/supports offline payment. A seller should not submit any online payment methods here since eBay now controls the available online payment options that are available to buyers, and not the seller. | Not specified in source |
| CheckoutInstructions | string | Not specified in source | This field allows the seller to provide a message or instructions regarding checkout/payment, or the return policy. | Not specified in source |
| EmailCopyToSeller | boolean | Not specified in source | This field is included and set to true if the seller wishes to receive an email copy of the invoice sent to the buyer. | Not specified in source |

#### Conditional Fields

| Field Path | Type | Condition | Description |
|------------|------|-----------|-------------|
| ItemID | ItemIDType | Conditionally | Unique identifier of the eBay listing. Unless OrderID or OrderLineItemID is provided in the request, the ItemID value (or SKU value) is conditionally required and must be paired with the corresponding TransactionID value to identify an order line item. For a multiple line item order, OrderID should be used. |
| TransactionID | string | Conditionally | Unique identifier for an eBay sales transaction. This identifier is created once there is a commitment from a buyer to purchase an item. Since an auction listing can only have one sales transaction during the duration of the listing, the TransactionID value for auction listings is always 0 . Note: Beginning in July 2024, non-zero transaction IDs will start being returned for auction listings. If necessary, update code to handle non-zero transaction IDs for auction transactions before this time. Unless OrderID or OrderLineItemID is provided in the request, the TransactionID value is required and must be paired with the corresponding ItemID value to identify an order line item. For a multiple line item order, OrderID should be used. |
| OrderID | OrderIDType | Conditionally | A unique identifier that identifies a single line item or multiple line item order. Unless the ItemID value (or SKU value) and corresponding TransactionID value, or the OrderLineItemID value is provided in the request to identify a single line item order, the OrderID value must be specified. If OrderID value is specified, OrderLineItemID , ItemID , TransactionID , and SKU fields are ignored if present in the same request. Note: Note that the unique identifier of a 'non-immediate payment' order will change as it goes from an unpaid order to a paid order. Due to this scenario, all Traditional API calls that accept Order ID values as filters in the request payload will support the identifiers for both unpaid and paid orders. Sellers can check to see if an order has been paid by looking for a value of Complete in the CheckoutStatus.Status field in the response of GetOrders call, or in the Status.CompleteStatus field in the response of GetItemTransactions or GetSellerTransactions call. Sellers should not fulfill orders until buyer has made payment. |
| SKU | SKUType | Conditionally | The seller's unique identifier for an item that is being tracked by this SKU. If OrderID or OrderLineItemID are not provided, both SKU (or ItemID ) and corresponding TransactionID must be provided to uniquely identify a single line item order. For a multiple line item order, OrderID must be used. This field should only be used if the Item.InventoryTrackingMethod field (set with the AddFixedPriceItem or RelistFixedPriceItem calls) is set to SKU . |
| OrderLineItemID | string | Conditionally | A unique identifier for an eBay order line item. This identifier is created as soon as there is a commitment to buy (bidder wins the auction, buyer clicks buy button, or buyer purchases item through PlaceOffer call). Unless the ItemID (or SKU ) and corresponding TransactionID is used to identify a single line item order, or the OrderID is used to identify a single or multiple line item order, the OrderLineItemID must be specified. For a multiple line item order, OrderID should be used. If OrderLineItemID is specified, ItemID , TransactionID , and SKU are ignored if present in the same request. |
| AdjustmentAmount | AmountType | Conditionally | This field allows the seller to adjust the total cost of the order to account for an extra charge or to pass down a discount to the buyer. The currency used in this field must be the same currency of the listing site. A positive value in this field indicates that the amount is an extra charge being paid to the seller by the buyer, and a negative value indicates that the amount is a discount given to the buyer by the seller. |

## Response Structure

### XML Schema

```xml
<?xml version="1.0" encoding="utf-8"?>
<SendInvoiceResponse xmlns="urn:ebay:apis:eBLBaseComponents">
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
</SendInvoiceResponse>
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

### SendInvoiceRequestType

**Description:** This call enables a seller to send an order invoice to a buyer. Optionally, and when applicable, this call can also be used to update the shipping service options available for shipment, to provide payment or checkout instructions to the buyer, to make a cost adjustment for the order/order line item, or to provide one or more offline payment methods (for orders where offline payment is an option).

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| ItemID | ItemIDType | [0..1] | Unique identifier of the eBay listing. Unless OrderID or OrderLineItemID is provided in the request, the ItemID value (or SKU value) is conditionally required and must be paired with the corresponding TransactionID value to identify an order line item. For a multiple line item order, OrderID should be used. |
| TransactionID | string | [0..1] | Unique identifier for an eBay sales transaction. This identifier is created once there is a commitment from a buyer to purchase an item. Since an auction listing can only have one sales transaction during the duration of the listing, the TransactionID value for auction listings is always 0 . Note: Beginning in July 2024, non-zero transaction IDs will start being returned for auction listings. If necessary, update code to handle non-zero transaction IDs for auction transactions before this time. Unless OrderID or OrderLineItemID is provided in the request, the TransactionID value is required and must be paired with the corresponding ItemID value to identify an order line item. For a multiple line item order, OrderID should be used. |
| OrderID | OrderIDType | [0..1] | A unique identifier that identifies a single line item or multiple line item order. Unless the ItemID value (or SKU value) and corresponding TransactionID value, or the OrderLineItemID value is provided in the request to identify a single line item order, the OrderID value must be specified. If OrderID value is specified, OrderLineItemID , ItemID , TransactionID , and SKU fields are ignored if present in the same request. Note: Note that the unique identifier of a 'non-immediate payment' order will change as it goes from an unpaid order to a paid order. Due to this scenario, all Traditional API calls that accept Order ID values as filters in the request payload will support the identifiers for both unpaid and paid orders. Sellers can check to see if an order has been paid by looking for a value of Complete in the CheckoutStatus.Status field in the response of GetOrders call, or in the Status.CompleteStatus field in the response of GetItemTransactions or GetSellerTransactions call. Sellers should not fulfill orders until buyer has made payment. |
| InternationalShippingServiceOptions | InternationalShippingServiceOptionsType | [0..unbounded] | If the buyer has an international shipping address, use this container to offer up to four international shipping service options (or five if one of the shipping service options is Global Shipping Program or eBay International Shipping). If one or more international shipping service options are offered through this container, the (domestic) ShippingServiceOptions container should not be included in the same request. |
| ShippingServiceOptions | ShippingServiceOptionsType | [0..unbounded] | If the buyer has a domestic shipping address, use this container to offer up to four domestic shipping service options. If one or more domestic shipping service options are offered through this container, the InternationalShippingServiceOptions container should not be included in the same request. |
| SalesTax | SalesTaxType | [0..1] | This container is used if the seller wishes to apply sales tax to the order if the buyer lives in a state/jurisdiction where sales tax is not already collected automatically by eBay and remitted to the tax authority. The amount of sales tax applied to the order is dependent on the sales tax rate in the buyer's state and whether sales tax is being applied to the cost of the order only or the cost of the order plus shipping and handling. Note: Buyers in all 50 US states and DC are automatically charged sales tax for eBay purchases, and eBay collects and remits this sales tax to the proper taxing authority on the buyer's behalf. Because of this, if a sales tax percentage rate is applied to a listing by a seller in one of these states, this field will be ignored during the checkout process. Currently, sales tax percentage rates can only be specified by sellers in Canada and 5 US territories, including American Samoa (AS), Guam (GU), Northern Mariana Islands (MP), Palau (PW), and Virgin Islands (VI). |
| PaymentMethods | BuyerPaymentMethodCodeType | [0..unbounded] | This field should only be used if the seller needs to add one or more offline payment options for an order that requires/supports offline payment. A seller should not submit any online payment methods here since eBay now controls the available online payment options that are available to buyers, and not the seller. |
| CheckoutInstructions | string | [0..1] | This field allows the seller to provide a message or instructions regarding checkout/payment, or the return policy. |
| EmailCopyToSeller | boolean | [0..1] | This field is included and set to true if the seller wishes to receive an email copy of the invoice sent to the buyer. |
| SKU | SKUType | [0..1] | The seller's unique identifier for an item that is being tracked by this SKU. If OrderID or OrderLineItemID are not provided, both SKU (or ItemID ) and corresponding TransactionID must be provided to uniquely identify a single line item order. For a multiple line item order, OrderID must be used. This field should only be used if the Item.InventoryTrackingMethod field (set with the AddFixedPriceItem or RelistFixedPriceItem calls) is set to SKU . |
| OrderLineItemID | string | [0..1] | A unique identifier for an eBay order line item. This identifier is created as soon as there is a commitment to buy (bidder wins the auction, buyer clicks buy button, or buyer purchases item through PlaceOffer call). Unless the ItemID (or SKU ) and corresponding TransactionID is used to identify a single line item order, or the OrderID is used to identify a single or multiple line item order, the OrderLineItemID must be specified. For a multiple line item order, OrderID should be used. If OrderLineItemID is specified, ItemID , TransactionID , and SKU are ignored if present in the same request. |
| AdjustmentAmount | AmountType | [0..1] | This field allows the seller to adjust the total cost of the order to account for an extra charge or to pass down a discount to the buyer. The currency used in this field must be the same currency of the listing site. A positive value in this field indicates that the amount is an extra charge being paid to the seller by the buyer, and a negative value indicates that the amount is a discount given to the buyer by the seller. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<SendInvoiceRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <AdjustmentAmount currencyID="CurrencyCodeType">
  </AdjustmentAmount>
  <CheckoutInstructions>string</CheckoutInstructions>
  <EmailCopyToSeller>boolean</EmailCopyToSeller>
  <InternationalShippingServiceOptions>
    <ShippingService>token</ShippingService>
    <ShippingServiceAdditionalCost currencyID="CurrencyCodeType">
    </ShippingServiceAdditionalCost>
    <ShippingServiceCost currencyID="CurrencyCodeType">
    </ShippingServiceCost>
    <ShippingServicePriority>int</ShippingServicePriority>
    <ShipToLocation>string</ShipToLocation>
    <!-- ... more ShipToLocation values allowed here ... -->
  </InternationalShippingServiceOptions>
  <!-- ... more InternationalShippingServiceOptions nodes allowed here ... -->
  <ItemID></ItemID>
  <OrderID></OrderID>
  <OrderLineItemID>string</OrderLineItemID>
  <PaymentMethods></PaymentMethods>
  <!-- ... more PaymentMethods values allowed here ... -->
  <SalesTax>
    <SalesTaxAmount currencyID="CurrencyCodeType">
    </SalesTaxAmount>
    <SalesTaxPercent>float</SalesTaxPercent>
    <SalesTaxState>string</SalesTaxState>
    <ShippingIncludedInTax>boolean</ShippingIncludedInTax>
  </SalesTax>
  <ShippingServiceOptions>
    <ShippingService>token</ShippingService>
    <ShippingServiceAdditionalCost currencyID="CurrencyCodeType">
    </ShippingServiceAdditionalCost>
    <ShippingServiceCost currencyID="CurrencyCodeType">
    </ShippingServiceCost>
    <ShippingServicePriority>int</ShippingServicePriority>
  </ShippingServiceOptions>
  <!-- ... more ShippingServiceOptions nodes allowed here ... -->
  <SKU></SKU>
  <TransactionID>string</TransactionID>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</SendInvoiceRequest>
```

### SendInvoiceResponseType

**Description:** Not specified in source

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| Not specified in source | Not specified in source | Not specified in source | Not specified in source |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<SendInvoiceResponse xmlns="urn:ebay:apis:eBLBaseComponents">
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
</SendInvoiceResponse>
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

1. Invoice sending requires an eligible order or transaction context.

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
| SendInvoice | Purchase Quote API createPurchaseQuote | Mutation |
| SendInvoice | Purchase Quote API bulkUpdatePurchaseQuote | Mutation |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_sendinvoice_html.jsonl`; `.trace_artifacts/extract_wsdl_sendinvoice.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
