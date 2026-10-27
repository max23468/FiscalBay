# GetShippingDiscountProfiles — Example

## Request Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetShippingDiscountProfilesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>A3</eBayAuthToken>
  </RequesterCredentials>
  <WarningLevel>High</WarningLevel>
</GetShippingDiscountProfilesRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetShippingDiscountProfilesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- (No call-specific Input fields) -->
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetShippingDiscountProfilesRequest>
```

## Response Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetShippingDiscountProfilesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <CalculatedHandlingDiscount>
    <DiscountName></DiscountName>
    <EachAdditionalAmount currencyID="CurrencyCodeType">
    </EachAdditionalAmount>
    <EachAdditionalOffAmount currencyID="CurrencyCodeType">
    </EachAdditionalOffAmount>
    <EachAdditionalPercentOff>float</EachAdditionalPercentOff>
    <OrderHandlingAmount currencyID="CurrencyCodeType">
    </OrderHandlingAmount>
  </CalculatedHandlingDiscount>
  <CalculatedShippingDiscount>
    <DiscountName></DiscountName>
    <DiscountProfile>
      <DiscountProfileID>string</DiscountProfileID>
      <DiscountProfileName>string</DiscountProfileName>
      <MappedDiscountProfileID>string</MappedDiscountProfileID>
      <WeightOff unit="token" measurementSystem="MeasurementSystemCodeType">
      </WeightOff>
    </DiscountProfile>
    <!-- ... more DiscountProfile nodes allowed here ... -->
  </CalculatedShippingDiscount>
  <CombinedDuration></CombinedDuration>
  <CurrencyID></CurrencyID>
  <FlatShippingDiscount>
    <DiscountName></DiscountName>
    <DiscountProfile>
      <DiscountProfileID>string</DiscountProfileID>
      <DiscountProfileName>string</DiscountProfileName>
      <EachAdditionalAmount currencyID="CurrencyCodeType">
      </EachAdditionalAmount>
      <EachAdditionalAmountOff currencyID="CurrencyCodeType">
      </EachAdditionalAmountOff>
      <EachAdditionalPercentOff>float</EachAdditionalPercentOff>
    </DiscountProfile>
    <!-- ... more DiscountProfile nodes allowed here ... -->
  </FlatShippingDiscount>
  <PromotionalShippingDiscount>boolean</PromotionalShippingDiscount>
  <PromotionalShippingDiscountDetails>
    <DiscountName></DiscountName>
    <ItemCount>int</ItemCount>
    <OrderAmount currencyID="CurrencyCodeType">
    </OrderAmount>
    <ShippingCost currencyID="CurrencyCodeType">
    </ShippingCost>
  </PromotionalShippingDiscountDetails>
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
</GetShippingDiscountProfilesResponse>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetShippingDiscountProfilesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- (No call-specific Input fields) -->
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetShippingDiscountProfilesRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetShippingDiscountProfilesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <CalculatedHandlingDiscount>
    <DiscountName></DiscountName>
    <EachAdditionalAmount currencyID="CurrencyCodeType">
    </EachAdditionalAmount>
    <EachAdditionalOffAmount currencyID="CurrencyCodeType">
    </EachAdditionalOffAmount>
    <EachAdditionalPercentOff>float</EachAdditionalPercentOff>
    <OrderHandlingAmount currencyID="CurrencyCodeType">
    </OrderHandlingAmount>
  </CalculatedHandlingDiscount>
  <CalculatedShippingDiscount>
    <DiscountName></DiscountName>
    <DiscountProfile>
      <DiscountProfileID>string</DiscountProfileID>
      <DiscountProfileName>string</DiscountProfileName>
      <MappedDiscountProfileID>string</MappedDiscountProfileID>
      <WeightOff unit="token" measurementSystem="MeasurementSystemCodeType">
      </WeightOff>
    </DiscountProfile>
    <!-- ... more DiscountProfile nodes allowed here ... -->
  </CalculatedShippingDiscount>
  <CombinedDuration></CombinedDuration>
  <CurrencyID></CurrencyID>
  <FlatShippingDiscount>
    <DiscountName></DiscountName>
    <DiscountProfile>
      <DiscountProfileID>string</DiscountProfileID>
      <DiscountProfileName>string</DiscountProfileName>
      <EachAdditionalAmount currencyID="CurrencyCodeType">
      </EachAdditionalAmount>
      <EachAdditionalAmountOff currencyID="CurrencyCodeType">
      </EachAdditionalAmountOff>
      <EachAdditionalPercentOff>float</EachAdditionalPercentOff>
    </DiscountProfile>
    <!-- ... more DiscountProfile nodes allowed here ... -->
  </FlatShippingDiscount>
  <PromotionalShippingDiscount>boolean</PromotionalShippingDiscount>
  <PromotionalShippingDiscountDetails>
    <DiscountName></DiscountName>
    <ItemCount>int</ItemCount>
    <OrderAmount currencyID="CurrencyCodeType">
    </OrderAmount>
    <ShippingCost currencyID="CurrencyCodeType">
    </ShippingCost>
  </PromotionalShippingDiscountDetails>
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
</GetShippingDiscountProfilesResponse>
```
