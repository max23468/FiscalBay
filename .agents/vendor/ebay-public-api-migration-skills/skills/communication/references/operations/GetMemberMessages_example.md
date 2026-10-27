# GetMemberMessages — Example

## Request Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetMemberMessagesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>A3</eBayAuthToken>
  </RequesterCredentials>
  <WarningLevel>High</WarningLevel>
  <MailMessageType>AskSellerQuestion</MailMessageType>
  <MessageStatus>Unanswered</MessageStatus>
  <StartCreationTime>2019-09-01T00:00:00.000Z</StartCreationTime>
  <EndCreationTime>2019-09-30T19:23:13.821Z</EndCreationTime>
  <Pagination>
    <EntriesPerPage>5</EntriesPerPage>
    <PageNumber>1</PageNumber>
  </Pagination>
</GetMemberMessagesRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetMemberMessagesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <DisplayToPublic>boolean</DisplayToPublic>
  <EndCreationTime>dateTime</EndCreationTime>
  <ItemID></ItemID>
  <MailMessageType></MailMessageType>
  <MemberMessageID>string</MemberMessageID>
  <MessageStatus></MessageStatus>
  <Pagination>
    <EntriesPerPage>int</EntriesPerPage>
    <PageNumber>int</PageNumber>
  </Pagination>
  <SenderID></SenderID>
  <StartCreationTime>dateTime</StartCreationTime>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <OutputSelector>string</OutputSelector>
  <!-- ... more OutputSelector values allowed here ... -->
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetMemberMessagesRequest>
```

## Response Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetMemberMessagesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <HasMoreItems>boolean</HasMoreItems>
  <MemberMessage>
    <MemberMessageExchange>
      <Item>
        <ItemID></ItemID>
        <ListingDetails>
          <EndTime>dateTime</EndTime>
          <StartTime>dateTime</StartTime>
        </ListingDetails>
        <SellingStatus>
          <CurrentPrice currencyID="CurrencyCodeType">
          </CurrentPrice>
        </SellingStatus>
        <Title>string</Title>
      </Item>
      <LastModifiedDate>dateTime</LastModifiedDate>
      <MessageMedia>
        <MediaName>string</MediaName>
        <MediaURL>anyURI</MediaURL>
      </MessageMedia>
      <!-- ... more MessageMedia nodes allowed here ... -->
      <MessageStatus></MessageStatus>
      <Question>
        <Body>string</Body>
        <DisplayToPublic>boolean</DisplayToPublic>
        <MessageID>string</MessageID>
        <MessageMedia>
          <MediaName>string</MediaName>
          <MediaURL>anyURI</MediaURL>
        </MessageMedia>
        <!-- ... more MessageMedia nodes allowed here ... -->
        <MessageType></MessageType>
        <QuestionType></QuestionType>
        <RecipientID>string</RecipientID>
        <!-- ... more RecipientID values allowed here ... -->
        <SenderEmail>string</SenderEmail>
        <SenderID>string</SenderID>
        <Subject>string</Subject>
      </Question>
      <Response>string</Response>
      <!-- ... more Response values allowed here ... -->
    </MemberMessageExchange>
    <!-- ... more MemberMessageExchange nodes allowed here ... -->
  </MemberMessage>
  <PaginationResult>
    <TotalNumberOfEntries>int</TotalNumberOfEntries>
    <TotalNumberOfPages>int</TotalNumberOfPages>
  </PaginationResult>
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
</GetMemberMessagesResponse>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetMemberMessagesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <DisplayToPublic>boolean</DisplayToPublic>
  <EndCreationTime>dateTime</EndCreationTime>
  <ItemID></ItemID>
  <MailMessageType></MailMessageType>
  <MemberMessageID>string</MemberMessageID>
  <MessageStatus></MessageStatus>
  <Pagination>
    <EntriesPerPage>int</EntriesPerPage>
    <PageNumber>int</PageNumber>
  </Pagination>
  <SenderID></SenderID>
  <StartCreationTime>dateTime</StartCreationTime>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <OutputSelector>string</OutputSelector>
  <!-- ... more OutputSelector values allowed here ... -->
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetMemberMessagesRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetMemberMessagesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <HasMoreItems>boolean</HasMoreItems>
  <MemberMessage>
    <MemberMessageExchange>
      <Item>
        <ItemID></ItemID>
        <ListingDetails>
          <EndTime>dateTime</EndTime>
          <StartTime>dateTime</StartTime>
        </ListingDetails>
        <SellingStatus>
          <CurrentPrice currencyID="CurrencyCodeType">
          </CurrentPrice>
        </SellingStatus>
        <Title>string</Title>
      </Item>
      <LastModifiedDate>dateTime</LastModifiedDate>
      <MessageMedia>
        <MediaName>string</MediaName>
        <MediaURL>anyURI</MediaURL>
      </MessageMedia>
      <!-- ... more MessageMedia nodes allowed here ... -->
      <MessageStatus></MessageStatus>
      <Question>
        <Body>string</Body>
        <DisplayToPublic>boolean</DisplayToPublic>
        <MessageID>string</MessageID>
        <MessageMedia>
          <MediaName>string</MediaName>
          <MediaURL>anyURI</MediaURL>
        </MessageMedia>
        <!-- ... more MessageMedia nodes allowed here ... -->
        <MessageType></MessageType>
        <QuestionType></QuestionType>
        <RecipientID>string</RecipientID>
        <!-- ... more RecipientID values allowed here ... -->
        <SenderEmail>string</SenderEmail>
        <SenderID>string</SenderID>
        <Subject>string</Subject>
      </Question>
      <Response>string</Response>
      <!-- ... more Response values allowed here ... -->
    </MemberMessageExchange>
    <!-- ... more MemberMessageExchange nodes allowed here ... -->
  </MemberMessage>
  <PaginationResult>
    <TotalNumberOfEntries>int</TotalNumberOfEntries>
    <TotalNumberOfPages>int</TotalNumberOfPages>
  </PaginationResult>
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
</GetMemberMessagesResponse>
```
