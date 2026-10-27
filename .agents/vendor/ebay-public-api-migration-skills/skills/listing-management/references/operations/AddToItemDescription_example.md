# AddToItemDescription — Example

## Request Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<AddToItemDescriptionRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>PLACEHOLDER_TOKEN</eBayAuthToken>
  </RequesterCredentials>
  <!-- The user must be the seller of the item, and the listing must be active -->
  <ItemID>10</ItemID>
  <Description>Perfect timing for Halloween!</Description>
</AddToItemDescriptionRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<AddToItemDescriptionRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <Description>string</Description>
  <ItemID></ItemID>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <InvocationID></InvocationID>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</AddToItemDescriptionRequest>
```

## Response Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<AddToItemDescriptionResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- (No call-specific Output fields) -->
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
  <Message>string</Message>
  <Timestamp>dateTime</Timestamp>
  <Version>string</Version>
</AddToItemDescriptionResponse>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<AddToItemDescriptionRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <Description>string</Description>
  <ItemID></ItemID>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <InvocationID></InvocationID>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</AddToItemDescriptionRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<AddToItemDescriptionResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- (No call-specific Output fields) -->
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
  <Message>string</Message>
  <Timestamp>dateTime</Timestamp>
  <Version>string</Version>
</AddToItemDescriptionResponse>
```
