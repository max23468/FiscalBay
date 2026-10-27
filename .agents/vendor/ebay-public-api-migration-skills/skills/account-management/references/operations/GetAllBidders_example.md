# GetAllBidders — Example

## Request Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetAllBiddersRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>PLACEHOLDER_TOKEN</eBayAuthToken>
  </RequesterCredentials>
  <ItemID>12</ItemID>
  <IncludeBiddingSummary>true</IncludeBiddingSummary>
</GetAllBiddersRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetAllBiddersRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <CallMode></CallMode>
  <IncludeBiddingSummary>boolean</IncludeBiddingSummary>
  <ItemID></ItemID>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <OutputSelector>string</OutputSelector>
  <!-- ... more OutputSelector values allowed here ... -->
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetAllBiddersRequest>
```

## Response Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetAllBiddersResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <BidArray>
    <Offer>
      <Action></Action>
      <ConvertedPrice currencyID="CurrencyCodeType">
      </ConvertedPrice>
      <Currency></Currency>
      <HighestBid currencyID="CurrencyCodeType">
      </HighestBid>
      <MaxBid currencyID="CurrencyCodeType">
      </MaxBid>
      <MyMaxBid currencyID="CurrencyCodeType">
      </MyMaxBid>
      <Quantity>int</Quantity>
      <SecondChanceEnabled>boolean</SecondChanceEnabled>
      <SiteCurrency></SiteCurrency>
      <TimeBid>dateTime</TimeBid>
      <User>
        <AboutMePage>boolean</AboutMePage>
        <BiddingSummary>
          <BidActivityWithSeller>int</BidActivityWithSeller>
          <BidRetractions>int</BidRetractions>
          <BidsToUniqueCategories>int</BidsToUniqueCategories>
          <BidsToUniqueSellers>int</BidsToUniqueSellers>
          <ItemBidDetails>
            <BidCount>int</BidCount>
            <CategoryID>string</CategoryID>
            <ItemID></ItemID>
            <LastBidTime>dateTime</LastBidTime>
            <SellerID></SellerID>
          </ItemBidDetails>
          <!-- ... more ItemBidDetails nodes allowed here ... -->
          <SummaryDays>int</SummaryDays>
          <TotalBids>int</TotalBids>
        </BiddingSummary>
        <BuyerInfo>
          <ShippingAddress>
            <Country></Country>
            <PostalCode>string</PostalCode>
          </ShippingAddress>
        </BuyerInfo>
        <eBayGoodStanding>boolean</eBayGoodStanding>
        <Email>string</Email>
        <FeedbackPrivate>boolean</FeedbackPrivate>
        <FeedbackRatingStar></FeedbackRatingStar>
        <FeedbackScore>int</FeedbackScore>
        <IDVerified>boolean</IDVerified>
        <NewUser>boolean</NewUser>
        <PositiveFeedbackPercent>float</PositiveFeedbackPercent>
        <RegistrationDate>dateTime</RegistrationDate>
        <Site></Site>
        <Status></Status>
        <UserAnonymized>boolean</UserAnonymized>
        <UserID></UserID>
        <UserIDChanged>boolean</UserIDChanged>
        <UserIDLastChanged>dateTime</UserIDLastChanged>
        <VATStatus></VATStatus>
      </User>
    </Offer>
    <!-- ... more Offer nodes allowed here ... -->
  </BidArray>
  <HighBidder></HighBidder>
  <HighestBid currencyID="CurrencyCodeType">
  </HighestBid>
  <ListingStatus></ListingStatus>
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
</GetAllBiddersResponse>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetAllBiddersRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <CallMode></CallMode>
  <IncludeBiddingSummary>boolean</IncludeBiddingSummary>
  <ItemID></ItemID>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <OutputSelector>string</OutputSelector>
  <!-- ... more OutputSelector values allowed here ... -->
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetAllBiddersRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetAllBiddersResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <BidArray>
    <Offer>
      <Action></Action>
      <ConvertedPrice currencyID="CurrencyCodeType">
      </ConvertedPrice>
      <Currency></Currency>
      <HighestBid currencyID="CurrencyCodeType">
      </HighestBid>
      <MaxBid currencyID="CurrencyCodeType">
      </MaxBid>
      <MyMaxBid currencyID="CurrencyCodeType">
      </MyMaxBid>
      <Quantity>int</Quantity>
      <SecondChanceEnabled>boolean</SecondChanceEnabled>
      <SiteCurrency></SiteCurrency>
      <TimeBid>dateTime</TimeBid>
      <User>
        <AboutMePage>boolean</AboutMePage>
        <BiddingSummary>
          <BidActivityWithSeller>int</BidActivityWithSeller>
          <BidRetractions>int</BidRetractions>
          <BidsToUniqueCategories>int</BidsToUniqueCategories>
          <BidsToUniqueSellers>int</BidsToUniqueSellers>
          <ItemBidDetails>
            <BidCount>int</BidCount>
            <CategoryID>string</CategoryID>
            <ItemID></ItemID>
            <LastBidTime>dateTime</LastBidTime>
            <SellerID></SellerID>
          </ItemBidDetails>
          <!-- ... more ItemBidDetails nodes allowed here ... -->
          <SummaryDays>int</SummaryDays>
          <TotalBids>int</TotalBids>
        </BiddingSummary>
        <BuyerInfo>
          <ShippingAddress>
            <Country></Country>
            <PostalCode>string</PostalCode>
          </ShippingAddress>
        </BuyerInfo>
        <eBayGoodStanding>boolean</eBayGoodStanding>
        <Email>string</Email>
        <FeedbackPrivate>boolean</FeedbackPrivate>
        <FeedbackRatingStar></FeedbackRatingStar>
        <FeedbackScore>int</FeedbackScore>
        <IDVerified>boolean</IDVerified>
        <NewUser>boolean</NewUser>
        <PositiveFeedbackPercent>float</PositiveFeedbackPercent>
        <RegistrationDate>dateTime</RegistrationDate>
        <Site></Site>
        <Status></Status>
        <UserAnonymized>boolean</UserAnonymized>
        <UserID></UserID>
        <UserIDChanged>boolean</UserIDChanged>
        <UserIDLastChanged>dateTime</UserIDLastChanged>
        <VATStatus></VATStatus>
      </User>
    </Offer>
    <!-- ... more Offer nodes allowed here ... -->
  </BidArray>
  <HighBidder></HighBidder>
  <HighestBid currencyID="CurrencyCodeType">
  </HighestBid>
  <ListingStatus></ListingStatus>
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
</GetAllBiddersResponse>
```
