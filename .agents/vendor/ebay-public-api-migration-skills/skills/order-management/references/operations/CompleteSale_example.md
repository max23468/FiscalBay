# CompleteSale — Example

## Request Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<CompleteSaleRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>A3</eBayAuthToken>
  </RequesterCredentials>
  <WarningLevel>High</WarningLevel>
  <FeedbackInfo>
    <CommentText>Wonderful buyer!</CommentText>
    <CommentType>Positive</CommentType>
    <TargetUser>br</TargetUser>
  </FeedbackInfo>
  <ItemID>10</ItemID>
  <TransactionID>0</TransactionID>
</CompleteSaleRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<CompleteSaleRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <FeedbackInfo>
    <CommentText>string</CommentText>
    <CommentType></CommentType>
    <TargetUser></TargetUser>
  </FeedbackInfo>
  <ItemID></ItemID>
  <OrderID>string</OrderID>
  <OrderLineItemID>string</OrderLineItemID>
  <Paid>boolean</Paid>
  <Shipment>
    <ShipmentTrackingDetails>
      <ShipmentLineItem>
        <LineItem>
          <CountryOfOrigin>string</CountryOfOrigin>
          <Description>string</Description>
          <ItemID></ItemID>
          <Quantity>int</Quantity>
          <TransactionID>string</TransactionID>
        </LineItem>
        <!-- ... more LineItem nodes allowed here ... -->
      </ShipmentLineItem>
      <ShipmentTrackingNumber>string</ShipmentTrackingNumber>
      <ShippingCarrierUsed>string</ShippingCarrierUsed>
    </ShipmentTrackingDetails>
    <!-- ... more ShipmentTrackingDetails nodes allowed here ... -->
    <ShippedTime>dateTime</ShippedTime>
  </Shipment>
  <Shipped>boolean</Shipped>
  <TransactionID>string</TransactionID>
  <!-- Standard Input Fields -->
  <ErrorHandling></ErrorHandling>
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</CompleteSaleRequest>
```

## Response Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<CompleteSaleResponse xmlns="urn:ebay:apis:eBLBaseComponents">
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
</CompleteSaleResponse>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<CompleteSaleRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <FeedbackInfo>
    <CommentText>string</CommentText>
    <CommentType></CommentType>
    <TargetUser></TargetUser>
  </FeedbackInfo>
  <ItemID></ItemID>
  <OrderID>string</OrderID>
  <OrderLineItemID>string</OrderLineItemID>
  <Paid>boolean</Paid>
  <Shipment>
    <ShipmentTrackingDetails>
      <ShipmentLineItem>
        <LineItem>
          <CountryOfOrigin>string</CountryOfOrigin>
          <Description>string</Description>
          <ItemID></ItemID>
          <Quantity>int</Quantity>
          <TransactionID>string</TransactionID>
        </LineItem>
        <!-- ... more LineItem nodes allowed here ... -->
      </ShipmentLineItem>
      <ShipmentTrackingNumber>string</ShipmentTrackingNumber>
      <ShippingCarrierUsed>string</ShippingCarrierUsed>
    </ShipmentTrackingDetails>
    <!-- ... more ShipmentTrackingDetails nodes allowed here ... -->
    <ShippedTime>dateTime</ShippedTime>
  </Shipment>
  <Shipped>boolean</Shipped>
  <TransactionID>string</TransactionID>
  <!-- Standard Input Fields -->
  <ErrorHandling></ErrorHandling>
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</CompleteSaleRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<CompleteSaleResponse xmlns="urn:ebay:apis:eBLBaseComponents">
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
</CompleteSaleResponse>
```
