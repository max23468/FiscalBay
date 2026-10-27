# EndItems — Example

## Request Example

```xml
<?xml version="1.0" encoding="utf-8" ?>
<EndItemsRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>PLACEHOLDER_TOKEN</eBayAuthToken>
  </RequesterCredentials>
  <EndItemRequestContainer>
    <MessageID>1</MessageID>
    <EndingReason>LostOrBroken</EndingReason>
    <ItemID>15</ItemID>
  </EndItemRequestContainer>
  <EndItemRequestContainer>
    <MessageID>2</MessageID>
    <EndingReason>LostOrBroken</EndingReason>
    <ItemID>16</ItemID>
  </EndItemRequestContainer>
</EndItemsRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<EndItemsRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <EndItemRequestContainer>
    <EndingReason></EndingReason>
    <ItemID></ItemID>
    <MessageID>string</MessageID>
  </EndItemRequestContainer>
  <!-- ... more EndItemRequestContainer nodes allowed here ... -->
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</EndItemsRequest>
```

## Response Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<EndItemsResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Timestamp>2019-11-04T17:33:35.145Z</Timestamp>
  <Ack>Success</Ack>
  <Version>1131</Version>
  <Build>E1131_UNI_API5_19098188_R1</Build>
  <EndItemResponseContainer>
    <EndTime>2019-11-04T17:33:35.145Z</EndTime>
    <CorrelationID>1</CorrelationID>
  </EndItemResponseContainer>
  <EndItemResponseContainer>
    <EndTime>2019-11-04T17:33:35.145Z</EndTime>
    <CorrelationID>2</CorrelationID>
  </EndItemResponseContainer>
</EndItemsResponse>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<EndItemsRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <EndItemRequestContainer>
    <EndingReason></EndingReason>
    <ItemID></ItemID>
    <MessageID>string</MessageID>
  </EndItemRequestContainer>
  <!-- ... more EndItemRequestContainer nodes allowed here ... -->
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</EndItemsRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<EndItemsResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <EndItemResponseContainer>
    <CorrelationID>string</CorrelationID>
    <EndTime>dateTime</EndTime>
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
  </EndItemResponseContainer>
  <!-- ... more EndItemResponseContainer nodes allowed here ... -->
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
</EndItemsResponse>
```
