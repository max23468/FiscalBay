# ReviseMyMessages — Example

## Request Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<ReviseMyMessagesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>A3</eBayAuthToken>
  </RequesterCredentials>
  <WarningLevel>High</WarningLevel>
  <MessageIDs>
    <MessageID>10</MessageID>
  </MessageIDs>
  <FolderID>16</FolderID>
</ReviseMyMessagesRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<ReviseMyMessagesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <Flagged>boolean</Flagged>
  <FolderID>long</FolderID>
  <MessageIDs>
    <MessageID></MessageID>
    <!-- ... more MessageID values allowed here ... -->
  </MessageIDs>
  <Read>boolean</Read>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</ReviseMyMessagesRequest>
```

## Response Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<ReviseMyMessagesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
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
</ReviseMyMessagesResponse>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<ReviseMyMessagesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <Flagged>boolean</Flagged>
  <FolderID>long</FolderID>
  <MessageIDs>
    <MessageID></MessageID>
    <!-- ... more MessageID values allowed here ... -->
  </MessageIDs>
  <Read>boolean</Read>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</ReviseMyMessagesRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<ReviseMyMessagesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
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
</ReviseMyMessagesResponse>
```
