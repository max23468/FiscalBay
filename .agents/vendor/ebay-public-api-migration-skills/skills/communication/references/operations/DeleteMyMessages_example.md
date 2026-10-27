# DeleteMyMessages — Example

## Request Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<DeleteMyMessagesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>A3</eBayAuthToken>
  </RequesterCredentials>
  <MessageIDs>
    <MessageID>23</MessageID>
  </MessageIDs>
</DeleteMyMessagesRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<DeleteMyMessagesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <MessageIDs>
    <MessageID></MessageID>
    <!-- ... more MessageID values allowed here ... -->
  </MessageIDs>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</DeleteMyMessagesRequest>
```

## Response Example

```xml
<?xml version="1.0" encoding="UTF-8"?>
<DeleteMyMessagesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Timestamp>2019-11-04T17:17:37.940Z</Timestamp>
  <Ack>Success</Ack>
  <Version>1127</Version>
  <Build>E1127_CORE_APIMSG_19083139_R1</Build>
</DeleteMyMessagesResponse>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<DeleteMyMessagesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <MessageIDs>
    <MessageID></MessageID>
    <!-- ... more MessageID values allowed here ... -->
  </MessageIDs>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</DeleteMyMessagesRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<DeleteMyMessagesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
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
</DeleteMyMessagesResponse>
```
