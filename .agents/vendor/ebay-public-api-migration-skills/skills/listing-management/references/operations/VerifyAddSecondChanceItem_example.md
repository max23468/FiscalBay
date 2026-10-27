# VerifyAddSecondChanceItem — Example

## Request Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<VerifyAddSecondChanceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>PLACEHOLDER_TOKEN</eBayAuthToken>
  </RequesterCredentials>
  <ItemID>11</ItemID>
  <RecipientBidderUserID>br</RecipientBidderUserID>
  <Duration>Days_5</Duration>
</VerifyAddSecondChanceItemRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<VerifyAddSecondChanceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <BuyItNowPrice></BuyItNowPrice>
  <Duration></Duration>
  <ItemID></ItemID>
  <RecipientBidderUserID></RecipientBidderUserID>
  <SellerMessage>string</SellerMessage>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</VerifyAddSecondChanceItemRequest>
```

## Response Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<VerifyAddSecondChanceItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <EndTime>dateTime</EndTime>
  <StartTime>dateTime</StartTime>
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
</VerifyAddSecondChanceItemResponse>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<VerifyAddSecondChanceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <BuyItNowPrice></BuyItNowPrice>
  <Duration></Duration>
  <ItemID></ItemID>
  <RecipientBidderUserID></RecipientBidderUserID>
  <SellerMessage>string</SellerMessage>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</VerifyAddSecondChanceItemRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<VerifyAddSecondChanceItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <EndTime>dateTime</EndTime>
  <StartTime>dateTime</StartTime>
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
</VerifyAddSecondChanceItemResponse>
```
