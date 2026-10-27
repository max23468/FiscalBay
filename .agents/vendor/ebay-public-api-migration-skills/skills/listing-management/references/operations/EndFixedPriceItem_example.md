# EndFixedPriceItem — Example

## Request Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<EndFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ItemID>14</ItemID>
  <EndingReason>NotAvailable</EndingReason>
  <RequesterCredentials>
    <eBayAuthToken>PLACEHOLDER_TOKEN</eBayAuthToken>
  </RequesterCredentials>
</EndFixedPriceItemRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<EndFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <EndingReason></EndingReason>
  <ItemID></ItemID>
  <SKU></SKU>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</EndFixedPriceItemRequest>
```

## Response Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<EndFixedPriceItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Timestamp>2019-11-04T17:33:35.145Z</Timestamp>
  <Ack>Success</Ack>
  <Version>1131</Version>
  <Build>E1131_UNI_API5_19098188_R1</Build>
  <EndTime>2019-11-04T17:33:35.038Z</EndTime>
</EndFixedPriceItemResponse>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<EndFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <EndingReason></EndingReason>
  <ItemID></ItemID>
  <SKU></SKU>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</EndFixedPriceItemRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<EndFixedPriceItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <EndTime>dateTime</EndTime>
  <SKU></SKU>
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
</EndFixedPriceItemResponse>
```
