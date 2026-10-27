# AddSecondChanceItem — Example

## Request Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<AddSecondChanceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>PLACEHOLDER_TOKEN</eBayAuthToken>
  </RequesterCredentials>
  <!-- The user ID of an user who made a bid on the auction item. The GetAllBidders call can be used to get bidders on a listing -->
  <RecipientBidderUserID>br</RecipientBidderUserID>
  <!-- The offer duration must be one of the values defined in SecondChanceOfferDurationCodeType -->
  <Duration>Days_3</Duration>
  <ItemID>11</ItemID>
  <SellerMessage>I just got another copy of the book in stock, would you be interested in purchasing the copy?</SellerMessage>
</AddSecondChanceItemRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<AddSecondChanceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
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
</AddSecondChanceItemRequest>
```

## Response Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<AddSecondChanceItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <EndTime>dateTime</EndTime>
  <ItemID></ItemID>
  <StartTime>dateTime</StartTime>
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
</AddSecondChanceItemResponse>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<AddSecondChanceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
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
</AddSecondChanceItemRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<AddSecondChanceItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <EndTime>dateTime</EndTime>
  <ItemID></ItemID>
  <StartTime>dateTime</StartTime>
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
</AddSecondChanceItemResponse>
```
