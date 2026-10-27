# SetShippingDiscountProfiles — Example

## Request Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<SetShippingDiscountProfilesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>A3</eBayAuthToken>
  </RequesterCredentials>
  <CalculatedHandlingDiscount>
    <DiscountName>Ie</DiscountName>
  </CalculatedHandlingDiscount>
  <CalculatedShippingDiscount>
    <DiscountName>Wf</DiscountName>
    <DiscountProfile>
      <DiscountProfileName>C1</DiscountProfileName>
      <WeightOff>2</WeightOff>
    </DiscountProfile>
  </CalculatedShippingDiscount>
  <CombinedDuration>Days_3</CombinedDuration>
  <CurrencyID>USD</CurrencyID>
  <ModifyActionCode>Add</ModifyActionCode>
</SetShippingDiscountProfilesRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<SetShippingDiscountProfilesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
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
      <WeightOff></WeightOff>
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
  <ModifyActionCode></ModifyActionCode>
  <PromotionalShippingDiscountDetails>
    <DiscountName></DiscountName>
    <ItemCount>int</ItemCount>
    <OrderAmount currencyID="CurrencyCodeType">
    </OrderAmount>
    <ShippingCost currencyID="CurrencyCodeType">
    </ShippingCost>
  </PromotionalShippingDiscountDetails>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</SetShippingDiscountProfilesRequest>
```

## Response Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<SetShippingDiscountProfilesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
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
</SetShippingDiscountProfilesResponse>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<SetShippingDiscountProfilesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
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
      <WeightOff></WeightOff>
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
  <ModifyActionCode></ModifyActionCode>
  <PromotionalShippingDiscountDetails>
    <DiscountName></DiscountName>
    <ItemCount>int</ItemCount>
    <OrderAmount currencyID="CurrencyCodeType">
    </OrderAmount>
    <ShippingCost currencyID="CurrencyCodeType">
    </ShippingCost>
  </PromotionalShippingDiscountDetails>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</SetShippingDiscountProfilesRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<SetShippingDiscountProfilesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
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
</SetShippingDiscountProfilesResponse>
```
