# AddMemberMessageRTQ — Example

## Request Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<AddMemberMessageRTQRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>A3</eBayAuthToken>
  </RequesterCredentials>
  <!-- The user making this call must be the seller of the listing ID posted below -->
  <ItemID>12</ItemID>
  <MemberMessage>
    <Body>Indeed, this is the first book in the Harry Potter series, with the original UK title. When released in the United states, the title was changed.</Body>
    <DisplayToPublic>true</DisplayToPublic>
    <EmailCopyToSender>true</EmailCopyToSender>
    <!-- This is the unique identifier of the buyer's question. Message ID values can be retrieved with a GetMyMessages call -->
    <ParentMessageID>76</ParentMessageID>
    <!-- This is the user ID of the prospective buyer/bidder that asked the question -->
    <RecipientID>br</RecipientID>
  </MemberMessage>
</AddMemberMessageRTQRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<AddMemberMessageRTQRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <ItemID></ItemID>
  <MemberMessage>
    <Body>string</Body>
    <DisplayToPublic>boolean</DisplayToPublic>
    <EmailCopyToSender>boolean</EmailCopyToSender>
    <MessageMedia>
      <MediaName>string</MediaName>
      <MediaURL>anyURI</MediaURL>
    </MessageMedia>
    <!-- ... more MessageMedia nodes allowed here ... -->
    <ParentMessageID>string</ParentMessageID>
    <RecipientID>string</RecipientID>
    <!-- ... more RecipientID values allowed here ... -->
  </MemberMessage>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</AddMemberMessageRTQRequest>
```

## Response Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<AddMemberMessageRTQResponse xmlns="urn:ebay:apis:eBLBaseComponents">
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
</AddMemberMessageRTQResponse>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<AddMemberMessageRTQRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <ItemID></ItemID>
  <MemberMessage>
    <Body>string</Body>
    <DisplayToPublic>boolean</DisplayToPublic>
    <EmailCopyToSender>boolean</EmailCopyToSender>
    <MessageMedia>
      <MediaName>string</MediaName>
      <MediaURL>anyURI</MediaURL>
    </MessageMedia>
    <!-- ... more MessageMedia nodes allowed here ... -->
    <ParentMessageID>string</ParentMessageID>
    <RecipientID>string</RecipientID>
    <!-- ... more RecipientID values allowed here ... -->
  </MemberMessage>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</AddMemberMessageRTQRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<AddMemberMessageRTQResponse xmlns="urn:ebay:apis:eBLBaseComponents">
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
</AddMemberMessageRTQResponse>
```
