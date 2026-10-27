# SendInvoice — Example

## Request Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<SendInvoiceRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>A3</eBayAuthToken>
  </RequesterCredentials>
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <ItemID>15</ItemID>
  <TransactionID>0</TransactionID>
  <ShippingServiceOptions>
    <ShippingService>USPSMedia</ShippingService>
    <ShippingServiceCost currencyID="USD">2.5</ShippingServiceCost>
    <ShippingServicePriority>1</ShippingServicePriority>
    <ExpeditedService>false</ExpeditedService>
    <ShippingTimeMin>2</ShippingTimeMin>
    <ShippingTimeMax>9</ShippingTimeMax>
  </ShippingServiceOptions>
</SendInvoiceRequest>
```

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

## Response Example

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
