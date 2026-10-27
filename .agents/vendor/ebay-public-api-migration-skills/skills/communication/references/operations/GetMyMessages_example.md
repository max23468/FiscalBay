# GetMyMessages — Example

## Request Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetMyMessagesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <DetailLevel>ReturnMessages</DetailLevel>
  <RequesterCredentials>
    <eBayAuthToken>1C</eBayAuthToken>
  </RequesterCredentials>
  <FolderID></FolderID>
</GetMyMessagesRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetMyMessagesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <EndTime>dateTime</EndTime>
  <ExternalMessageIDs>
    <ExternalMessageID></ExternalMessageID>
    <!-- ... more ExternalMessageID values allowed here ... -->
  </ExternalMessageIDs>
  <FolderID>long</FolderID>
  <IncludeHighPriorityMessageOnly>boolean</IncludeHighPriorityMessageOnly>
  <MessageIDs>
    <MessageID></MessageID>
    <!-- ... more MessageID values allowed here ... -->
  </MessageIDs>
  <Pagination>
    <EntriesPerPage>int</EntriesPerPage>
    <PageNumber>int</PageNumber>
  </Pagination>
  <StartTime>dateTime</StartTime>
  <!-- Standard Input Fields -->
  <DetailLevel></DetailLevel>
  <!-- ... more DetailLevel values allowed here ... -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <OutputSelector>string</OutputSelector>
  <!-- ... more OutputSelector values allowed here ... -->
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetMyMessagesRequest>
```

## Response Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetMyMessagesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Timestamp>2019-11-04T22:17:05.891Z</Timestamp>
  <Ack>Success</Ack>
  <Version>1127</Version>
  <Build>E1127_CORE_APIMSG_19083139_R1</Build>
  <Messages>
    <Message>
      <Sender>ey</Sender>
      <RecipientUserID>sr</RecipientUserID>
      <Subject>eBay Second Chance Offer for Item #39: Auction Title</Subject>
      <MessageID>29</MessageID>
      <Flagged>false</Flagged>
      <Read>false</Read>
      <ReceiveDate>2019-10-20T23:34:37.000Z</ReceiveDate>
      <ExpirationDate>2019-11-20T23:34:30.000Z</ExpirationDate>
      <ResponseDetails>
        <ResponseEnabled>true</ResponseEnabled>
        <ResponseURL>http://.com</ResponseURL>
      </ResponseDetails>
      <Folder>
        <FolderID></FolderID>
      </Folder>
    </Message>
  </Messages>
</GetMyMessagesResponse>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetMyMessagesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <EndTime>dateTime</EndTime>
  <ExternalMessageIDs>
    <ExternalMessageID></ExternalMessageID>
    <!-- ... more ExternalMessageID values allowed here ... -->
  </ExternalMessageIDs>
  <FolderID>long</FolderID>
  <IncludeHighPriorityMessageOnly>boolean</IncludeHighPriorityMessageOnly>
  <MessageIDs>
    <MessageID></MessageID>
    <!-- ... more MessageID values allowed here ... -->
  </MessageIDs>
  <Pagination>
    <EntriesPerPage>int</EntriesPerPage>
    <PageNumber>int</PageNumber>
  </Pagination>
  <StartTime>dateTime</StartTime>
  <!-- Standard Input Fields -->
  <DetailLevel></DetailLevel>
  <!-- ... more DetailLevel values allowed here ... -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <OutputSelector>string</OutputSelector>
  <!-- ... more OutputSelector values allowed here ... -->
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetMyMessagesRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetMyMessagesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <Messages>
    <Message>
      <Content>string</Content>
      <ExpirationDate>dateTime</ExpirationDate>
      <ExternalMessageID>string</ExternalMessageID>
      <Flagged>boolean</Flagged>
      <Folder>
        <FolderID>long</FolderID>
      </Folder>
      <HighPriority>boolean</HighPriority>
      <ItemEndTime>dateTime</ItemEndTime>
      <ItemID></ItemID>
      <ItemTitle>string</ItemTitle>
      <ListingStatus></ListingStatus>
      <MessageID></MessageID>
      <MessageMedia>
        <MediaName>string</MediaName>
        <MediaURL>anyURI</MediaURL>
      </MessageMedia>
      <!-- ... more MessageMedia nodes allowed here ... -->
      <MessageType></MessageType>
      <QuestionType></QuestionType>
      <Read>boolean</Read>
      <ReceiveDate>dateTime</ReceiveDate>
      <RecipientUserID>string</RecipientUserID>
      <Replied>boolean</Replied>
      <ResponseDetails>
        <ResponseEnabled>boolean</ResponseEnabled>
        <ResponseURL>anyURI</ResponseURL>
      </ResponseDetails>
      <Sender>string</Sender>
      <SendToName>string</SendToName>
      <Subject>string</Subject>
      <Text>string</Text>
    </Message>
    <!-- ... more Message nodes allowed here ... -->
  </Messages>
  <Summary>
    <FlaggedMessageCount>int</FlaggedMessageCount>
    <FolderSummary>
      <FolderID>long</FolderID>
      <FolderName>string</FolderName>
      <NewHighPriorityCount>int</NewHighPriorityCount>
      <NewMessageCount>int</NewMessageCount>
      <TotalHighPriorityCount>int</TotalHighPriorityCount>
      <TotalMessageCount>int</TotalMessageCount>
    </FolderSummary>
    <!-- ... more FolderSummary nodes allowed here ... -->
    <NewHighPriorityCount>int</NewHighPriorityCount>
    <NewMessageCount>int</NewMessageCount>
    <TotalHighPriorityCount>int</TotalHighPriorityCount>
    <TotalMessageCount>int</TotalMessageCount>
  </Summary>
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
</GetMyMessagesResponse>
```
