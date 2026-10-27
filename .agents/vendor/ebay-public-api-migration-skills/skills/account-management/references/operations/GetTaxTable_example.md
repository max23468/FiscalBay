# GetTaxTable — Example

## Request Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetTaxTableRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>A3</eBayAuthToken>
  </RequesterCredentials>
</GetTaxTableRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetTaxTableRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- (No call-specific Input fields) -->
  <!-- Standard Input Fields -->
  <DetailLevel></DetailLevel>
  <!-- ... more DetailLevel values allowed here ... -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetTaxTableRequest>
```

## Response Example

```xml
<?xml version="1.0" encoding="UTF-8"?>
<GetTaxTableResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Timestamp>2019-11-05T22:41:26.783Z</Timestamp>
  <Ack>Success</Ack>
  <Version>1119</Version>
  <Build>E1119_CORE_APISHIP_19043790_R1</Build>
  <LastUpdateTime>2019-01-14T17:43:29.000Z</LastUpdateTime>
  <TaxTable>
    <TaxJurisdiction>
      <JurisdictionID>AK</JurisdictionID>
      <SalesTaxPercent>3.76</SalesTaxPercent>
      <ShippingIncludedInTax>false</ShippingIncludedInTax>
    </TaxJurisdiction>
    <TaxJurisdiction>
      <JurisdictionID>AL</JurisdictionID>
      <SalesTaxPercent>9.01</SalesTaxPercent>
      <ShippingIncludedInTax>false</ShippingIncludedInTax>
    </TaxJurisdiction>
    <TaxJurisdiction>
      <JurisdictionID>AR</JurisdictionID>
      <SalesTaxPercent>9.3</SalesTaxPercent>
      <ShippingIncludedInTax>false</ShippingIncludedInTax>
    </TaxJurisdiction>
    <TaxJurisdiction>
      <JurisdictionID>AZ</JurisdictionID>
      <SalesTaxPercent>8.25</SalesTaxPercent>
      <ShippingIncludedInTax>false</ShippingIncludedInTax>
    </TaxJurisdiction>
    <TaxJurisdiction>
      <JurisdictionID>CA</JurisdictionID>
      <SalesTaxPercent>8.25</SalesTaxPercent>
      <ShippingIncludedInTax>true</ShippingIncludedInTax>
    </TaxJurisdiction>
    <TaxJurisdiction>
      <JurisdictionID>CO</JurisdictionID>
      <SalesTaxPercent>7.5</SalesTaxPercent>
      <ShippingIncludedInTax>false</ShippingIncludedInTax>
    </TaxJurisdiction>
    <TaxJurisdiction>
      <JurisdictionID>CT</JurisdictionID>
      <SalesTaxPercent>6.35</SalesTaxPercent>
      <ShippingIncludedInTax>false</ShippingIncludedInTax>
    </TaxJurisdiction>
    <TaxJurisdiction>
      <JurisdictionID>DC</JurisdictionID>
      <SalesTaxPercent>5.75</SalesTaxPercent>
      <ShippingIncludedInTax>false</ShippingIncludedInTax>
    </TaxJurisdiction>
    <TaxJurisdiction>
      <JurisdictionID>FL</JurisdictionID>
      <SalesTaxPercent>6.8</SalesTaxPercent>
      <ShippingIncludedInTax>false</ShippingIncludedInTax>
    </TaxJurisdiction>
    <TaxJurisdiction>
      <JurisdictionID>GA</JurisdictionID>
      <SalesTaxPercent>7.0</SalesTaxPercent>
      <ShippingIncludedInTax>false</ShippingIncludedInTax>
    </TaxJurisdiction>
    <TaxJurisdiction>
      <JurisdictionID>HI</JurisdictionID>
      <SalesTaxPercent>4.35</SalesTaxPercent>
      <ShippingIncludedInTax>false</ShippingIncludedInTax>
    </TaxJurisdiction>
    <TaxJurisdiction>
      <JurisdictionID>IA</JurisdictionID>
      <SalesTaxPercent>6.8</SalesTaxPercent>
      <ShippingIncludedInTax>false</ShippingIncludedInTax>
    </TaxJurisdiction>
    <TaxJurisdiction>
      <JurisdictionID>ID</JurisdictionID>
      <SalesTaxPercent>6.03</SalesTaxPercent>
      <ShippingIncludedInTax>false</ShippingIncludedInTax>
    </TaxJurisdiction>
    <TaxJurisdiction>
      <JurisdictionID>IL</JurisdictionID>
      <SalesTaxPercent>8.64</SalesTaxPercent>
      <ShippingIncludedInTax>false</ShippingIncludedInTax>
    </TaxJurisdiction>
    <TaxJurisdiction>
      <JurisdictionID>IN</JurisdictionID>
      <SalesTaxPercent>7.0</SalesTaxPercent>
      <ShippingIncludedInTax>false</ShippingIncludedInTax>
    </TaxJurisdiction>
    <TaxJurisdiction>
      <JurisdictionID>KS</JurisdictionID>
      <SalesTaxPercent>8.62</SalesTaxPercent>
      <ShippingIncludedInTax>false</ShippingIncludedInTax>
    </TaxJurisdiction>
  </TaxTable>
</GetTaxTableResponse>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetTaxTableRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- (No call-specific Input fields) -->
  <!-- Standard Input Fields -->
  <DetailLevel></DetailLevel>
  <!-- ... more DetailLevel values allowed here ... -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetTaxTableRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetTaxTableResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <LastUpdateTime>dateTime</LastUpdateTime>
  <TaxTable>
    <TaxJurisdiction>
      <JurisdictionID>string</JurisdictionID>
      <SalesTaxPercent>float</SalesTaxPercent>
      <ShippingIncludedInTax>boolean</ShippingIncludedInTax>
    </TaxJurisdiction>
    <!-- ... more TaxJurisdiction nodes allowed here ... -->
  </TaxTable>
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
</GetTaxTableResponse>
```
