# AddMemberMessagesAAQToBidder — Example

## Request Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<AddMemberMessagesAAQToBidderRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>A3</eBayAuthToken>
  </RequesterCredentials>
  <AddMemberMessagesAAQToBidderRequestContainer>
    <!-- This is a seller-defined value, and is used to match up each member message in the response -->
    <CorrelationID>1</CorrelationID>
    <!-- The user making this call must be the seller of the listing ID posted below -->
    <ItemID>12</ItemID>
    <MemberMessage>
      <Body>Greetings! Thank you for your offer. In fact, you made the Best Offer, so I am happy to inform you that you won the book.</Body> !-- The user ID of the buyer being sent the message -->
      <RecipientID>br</RecipientID>
    </MemberMessage>
  </AddMemberMessagesAAQToBidderRequestContainer>
  <AddMemberMessagesAAQToBidderRequestContainer>
    <CorrelationID>2</CorrelationID>
    <!-- This Item ID value should be the same for each buyer message being sent -->
    <ItemID>12</ItemID>
    <MemberMessage>
      <Body>Greetings! Thank you for your offer. I am sorry to inform you that another bidder also made an offer, and I have decided to go with their offer. Good luck with your future bidding.</Body>
      <RecipientID>mr</RecipientID>
    </MemberMessage>
  </AddMemberMessagesAAQToBidderRequestContainer>
</AddMemberMessagesAAQToBidderRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<AddMemberMessagesAAQToBidderRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <AddMemberMessagesAAQToBidderRequestContainer>
    <CorrelationID>string</CorrelationID>
    <ItemID>string</ItemID>
    <MemberMessage>
      <Body>string</Body>
      <EmailCopyToSender>boolean</EmailCopyToSender>
      <RecipientID>string</RecipientID>
      <!-- ... more RecipientID values allowed here ... -->
    </MemberMessage>
  </AddMemberMessagesAAQToBidderRequestContainer>
  <!-- ... more AddMemberMessagesAAQToBidderRequestContainer nodes allowed here ... -->
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</AddMemberMessagesAAQToBidderRequest>
```

## Response Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<AddMemberMessagesAAQToBidderResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Timestamp>2018-10-29T18:36:52.001Z</Timestamp>
  <Ack>Success</Ack>
  <Version>1081</Version>
  <Build>e1081_core_Bundled_2854399_R1</Build>
  <AddMemberMessagesAAQToBidderResponseContainer>
    <CorrelationID>1</CorrelationID>
    <Ack>Success</Ack>
  </AddMemberMessagesAAQToBidderResponseContainer>
  <AddMemberMessagesAAQToBidderResponseContainer>
    <CorrelationID>2</CorrelationID>
    <Ack>Success</Ack>
  </AddMemberMessagesAAQToBidderResponseContainer>
</AddMemberMessagesAAQToBidderResponse>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<AddMemberMessagesAAQToBidderRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <AddMemberMessagesAAQToBidderRequestContainer>
    <CorrelationID>string</CorrelationID>
    <ItemID>string</ItemID>
    <MemberMessage>
      <Body>string</Body>
      <EmailCopyToSender>boolean</EmailCopyToSender>
      <RecipientID>string</RecipientID>
      <!-- ... more RecipientID values allowed here ... -->
    </MemberMessage>
  </AddMemberMessagesAAQToBidderRequestContainer>
  <!-- ... more AddMemberMessagesAAQToBidderRequestContainer nodes allowed here ... -->
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</AddMemberMessagesAAQToBidderRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<AddMemberMessagesAAQToBidderResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <AddMemberMessagesAAQToBidderResponseContainer>
    <Ack></Ack>
    <CorrelationID>string</CorrelationID>
  </AddMemberMessagesAAQToBidderResponseContainer>
  <!-- ... more AddMemberMessagesAAQToBidderResponseContainer nodes allowed here ... -->
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
</AddMemberMessagesAAQToBidderResponse>
```
