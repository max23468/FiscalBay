# AddMemberMessageAAQToPartner — Example

## Request Example

```xml
<?xml version="1.0" encoding="UTF-8"?>
<AddMemberMessageAAQToPartnerRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>A3</eBayAuthToken>
  </RequesterCredentials>
  <!-- The user making this call must be the buyer or seller of the listing ID posted below -->
  <ItemID>18</ItemID>
  <MemberMessage>
    <Subject>Question about shipping</Subject>
    <Body>I would like to have the item shipped in a box, and not in a padded envelope. Is there any additional charge for that?</Body>
    <!-- The Question Type pass in the field below should be one of the enum values defined in QuestionTypeCodeType of traditional API, including 'General', 'Payment', or 'Shipping' -->
    <QuestionType>Shipping</QuestionType>
    <!-- The recipient must be the order partner of the user making the call -->
    <RecipientID>Tr</RecipientID>
  </MemberMessage>
</AddMemberMessageAAQToPartnerRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<AddMemberMessageAAQToPartnerRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <ItemID></ItemID>
  <MemberMessage>
    <Body>string</Body>
    <EmailCopyToSender>boolean</EmailCopyToSender>
    <MessageMedia>
      <MediaName>string</MediaName>
      <MediaURL>anyURI</MediaURL>
    </MessageMedia>
    <!-- ... more MessageMedia nodes allowed here ... -->
    <QuestionType></QuestionType>
    <RecipientID>string</RecipientID>
    <!-- ... more RecipientID values allowed here ... -->
    <Subject>string</Subject>
  </MemberMessage>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</AddMemberMessageAAQToPartnerRequest>
```

## Response Example

```xml
<?xml version="1.0" encoding="UTF-8"?>
<AddMemberMessageAAQToPartnerResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Timestamp>2018-10-29T18:36:52.001Z</Timestamp>
  <Ack>Success</Ack>
  <Version>1081</Version>
  <Build>E1081_CORE_BUNDLED_11934711_R1</Build>
</AddMemberMessageAAQToPartnerResponse>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<AddMemberMessageAAQToPartnerRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <ItemID></ItemID>
  <MemberMessage>
    <Body>string</Body>
    <EmailCopyToSender>boolean</EmailCopyToSender>
    <MessageMedia>
      <MediaName>string</MediaName>
      <MediaURL>anyURI</MediaURL>
    </MessageMedia>
    <!-- ... more MessageMedia nodes allowed here ... -->
    <QuestionType></QuestionType>
    <RecipientID>string</RecipientID>
    <!-- ... more RecipientID values allowed here ... -->
    <Subject>string</Subject>
  </MemberMessage>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</AddMemberMessageAAQToPartnerRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<AddMemberMessageAAQToPartnerResponse xmlns="urn:ebay:apis:eBLBaseComponents">
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
</AddMemberMessageAAQToPartnerResponse>
```
