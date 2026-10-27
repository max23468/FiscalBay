# SetTaxTable — Example

## Request Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<SetTaxTableRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>ABC..123</eBayAuthToken>
  </RequesterCredentials>
  <TaxTable>
    <TaxJurisdiction>
      <JurisdictionID>CA</JurisdictionID>
      <SalesTaxPercent>8.25</SalesTaxPercent>
      <ShippingIncludedInTax>true</ShippingIncludedInTax>
    </TaxJurisdiction>
    <TaxJurisdiction>
      <JurisdictionID>MI</JurisdictionID>
      <SalesTaxPercent>6.0</SalesTaxPercent>
      <ShippingIncludedInTax>false</ShippingIncludedInTax>
    </TaxJurisdiction>
  </TaxTable>
</SetTaxTableRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<SetTaxTableRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <TaxTable>
    <TaxJurisdiction>
      <JurisdictionID>string</JurisdictionID>
      <SalesTaxPercent>float</SalesTaxPercent>
      <ShippingIncludedInTax>boolean</ShippingIncludedInTax>
    </TaxJurisdiction>
    <!-- ... more TaxJurisdiction nodes allowed here ... -->
  </TaxTable>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</SetTaxTableRequest>
```

## Response Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<SetTaxTableResponse xmlns="urn:ebay:apis:eBLBaseComponents">
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
</SetTaxTableResponse>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<SetTaxTableRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <TaxTable>
    <TaxJurisdiction>
      <JurisdictionID>string</JurisdictionID>
      <SalesTaxPercent>float</SalesTaxPercent>
      <ShippingIncludedInTax>boolean</ShippingIncludedInTax>
    </TaxJurisdiction>
    <!-- ... more TaxJurisdiction nodes allowed here ... -->
  </TaxTable>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</SetTaxTableRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<SetTaxTableResponse xmlns="urn:ebay:apis:eBLBaseComponents">
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
</SetTaxTableResponse>
```
