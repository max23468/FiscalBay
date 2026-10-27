# GetUser — Example

## Request Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetUserRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>A3</eBayAuthToken>
  </RequesterCredentials>
  <UserID>mr</UserID>
</GetUserRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetUserRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <IncludeFeatureEligibility>boolean</IncludeFeatureEligibility>
  <ItemID></ItemID>
  <UserID>string</UserID>
  <!-- Standard Input Fields -->
  <DetailLevel></DetailLevel>
  <!-- ... more DetailLevel values allowed here ... -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetUserRequest>
```

## Response Example

```xml
<?xml version="1.0" encoding="UTF-8"?>
<GetUserResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Timestamp>2019-11-05T22:43:42.456Z</Timestamp>
  <Ack>Success</Ack>
  <Version>1123</Version>
  <Build>E1123_CORE_APISIGNIN_19059235_R1</Build>
  <User>
    <AboutMePage>false</AboutMePage>
    <EIASToken>n=</EIASToken>
    <Email>Invalid Request</Email>
    <FeedbackScore>431</FeedbackScore>
    <UniqueNegativeFeedbackCount>0</UniqueNegativeFeedbackCount>
    <UniquePositiveFeedbackCount>128</UniquePositiveFeedbackCount>
    <PositiveFeedbackPercent>100.0</PositiveFeedbackPercent>
    <FeedbackPrivate>false</FeedbackPrivate>
    <FeedbackRatingStar>Turquoise</FeedbackRatingStar>
    <IDVerified>true</IDVerified>
    <eBayGoodStanding>true</eBayGoodStanding>
    <NewUser>false</NewUser>
    <RegistrationDate>2004-02-10T22:49:58.000Z</RegistrationDate>
    <Site>US</Site>
    <Status>Confirmed</Status>
    <UserID>mr</UserID>
    <UserIDChanged>false</UserIDChanged>
    <UserIDLastChanged>2004-02-10T22:50:12.000Z</UserIDLastChanged>
    <VATStatus>NoVATTax</VATStatus>
    <SellerInfo>
      <AllowPaymentEdit>true</AllowPaymentEdit>
      <CheckoutEnabled>true</CheckoutEnabled>
      <CIPBankAccountStored>false</CIPBankAccountStored>
      <GoodStanding>true</GoodStanding>
      <LiveAuctionAuthorized>false</LiveAuctionAuthorized>
      <MerchandizingPref>OptIn</MerchandizingPref>
      <QualifiesForB2BVAT>false</QualifiesForB2BVAT>
      <SellerGuaranteeLevel>NotEligible</SellerGuaranteeLevel>
      <SchedulingInfo>
        <MaxScheduledMinutes>30240</MaxScheduledMinutes>
        <MinScheduledMinutes>0</MinScheduledMinutes>
        <MaxScheduledItems>3000</MaxScheduledItems>
      </SchedulingInfo>
      <StoreOwner>true</StoreOwner>
      <StoreURL>http://stores.ebay.com/mr</StoreURL>
      <SellerBusinessType>Private</SellerBusinessType>
      <StoreSite>US</StoreSite>
      <PaymentMethod>PayPal</PaymentMethod>
      <CharityRegistered>false</CharityRegistered>
      <SafePaymentExempt>true</SafePaymentExempt>
      <TransactionPercent>33.3</TransactionPercent>
      <RecoupmentPolicyConsent></RecoupmentPolicyConsent>
      <DomesticRateTable>false</DomesticRateTable>
      <InternationalRateTable>false</InternationalRateTable>
    </SellerInfo>
    <BusinessRole>FullMarketPlaceParticipant</BusinessRole>
    <PayPalAccountLevel>Verified</PayPalAccountLevel>
    <PayPalAccountType>Premier</PayPalAccountType>
    <PayPalAccountStatus>Active</PayPalAccountStatus>
    <EBaySubscription>SellerReportsPlus</EBaySubscription>
    <EBaySubscription>CustomCode</EBaySubscription>
    <EBaySubscription>SellingManager</EBaySubscription>
    <EBaySubscription>FileExchange</EBaySubscription>
    <UserSubscription>SellerReportsPlus</UserSubscription>
    <UserSubscription>CustomCode</UserSubscription>
    <UserSubscription>SellingManager</UserSubscription>
    <UserSubscription>FileExchange</UserSubscription>
    <eBayWikiReadOnly>false</eBayWikiReadOnly>
    <MotorsDealer>false</MotorsDealer>
    <UniqueNeutralFeedbackCount>0</UniqueNeutralFeedbackCount>
    <EnterpriseSeller>false</EnterpriseSeller>
  </User>
</GetUserResponse>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetUserRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <IncludeFeatureEligibility>boolean</IncludeFeatureEligibility>
  <ItemID></ItemID>
  <UserID>string</UserID>
  <!-- Standard Input Fields -->
  <DetailLevel></DetailLevel>
  <!-- ... more DetailLevel values allowed here ... -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetUserRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetUserResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <User>
    <AboutMePage>boolean</AboutMePage>
    <BusinessRole></BusinessRole>
    <eBayGoodStanding>boolean</eBayGoodStanding>
    <eBayWikiReadOnly>boolean</eBayWikiReadOnly>
    <EIASToken>string</EIASToken>
    <Email>string</Email>
    <EnterpriseSeller>boolean</EnterpriseSeller>
    <FeedbackPrivate>boolean</FeedbackPrivate>
    <FeedbackRatingStar></FeedbackRatingStar>
    <FeedbackScore>int</FeedbackScore>
    <IDVerified>boolean</IDVerified>
    <Membership>
      <Program>
        <ExpiryDate>dateTime</ExpiryDate>
        <ProgramName>string</ProgramName>
        <Site></Site>
      </Program>
      <!-- ... more Program nodes allowed here ... -->
    </Membership>
    <NewUser>boolean</NewUser>
    <PositiveFeedbackPercent>float</PositiveFeedbackPercent>
    <QualifiesForSelling>boolean</QualifiesForSelling>
    <RegistrationAddress>
      <CityName>string</CityName>
      <CompanyName>string</CompanyName>
      <Country></Country>
      <CountryName>string</CountryName>
      <Name>string</Name>
      <Phone>string</Phone>
      <PostalCode>string</PostalCode>
      <StateOrProvince>string</StateOrProvince>
      <Street>string</Street>
      <Street1>string</Street1>
      <Street2>string</Street2>
    </RegistrationAddress>
    <RegistrationDate>dateTime</RegistrationDate>
    <SellerInfo>
      <AllowPaymentEdit>boolean</AllowPaymentEdit>
      <CharityAffiliationDetails>
        <CharityAffiliationDetail>
          <AffiliationType></AffiliationType>
          <CharityID>string</CharityID>
          <LastUsedTime>dateTime</LastUsedTime>
        </CharityAffiliationDetail>
        <!-- ... more CharityAffiliationDetail nodes allowed here ... -->
      </CharityAffiliationDetails>
      <CharityRegistered>boolean</CharityRegistered>
      <CheckoutEnabled>boolean</CheckoutEnabled>
      <CIPBankAccountStored>boolean</CIPBankAccountStored>
      <DomesticRateTable>boolean</DomesticRateTable>
      <FeatureEligibility>
        <QualifiedForAuctionOneDayDuration>boolean</QualifiedForAuctionOneDayDuration>
        <QualifiedForFixedPriceOneDayDuration>boolean</QualifiedForFixedPriceOneDayDuration>
        <QualifiesForBuyItNow>boolean</QualifiesForBuyItNow>
        <QualifiesForBuyItNowMultiple>boolean</QualifiesForBuyItNowMultiple>
        <QualifiesForVariations>boolean</QualifiesForVariations>
      </FeatureEligibility>
      <GoodStanding>boolean</GoodStanding>
      <InternationalRateTable>boolean</InternationalRateTable>
      <PaymentMethod></PaymentMethod>
      <QualifiesForB2BVAT>boolean</QualifiesForB2BVAT>
      <RecoupmentPolicyConsent>
        <Site></Site>
        <!-- ... more Site values allowed here ... -->
      </RecoupmentPolicyConsent>
      <RegisteredBusinessSeller>boolean</RegisteredBusinessSeller>
      <SafePaymentExempt>boolean</SafePaymentExempt>
      <SchedulingInfo>
        <MaxScheduledItems>int</MaxScheduledItems>
        <MaxScheduledMinutes>int</MaxScheduledMinutes>
        <MinScheduledMinutes>int</MinScheduledMinutes>
      </SchedulingInfo>
      <SellerBusinessType></SellerBusinessType>
      <SellerLevel></SellerLevel>
      <SellerPaymentAddress>
        <CityName>string</CityName>
        <Country></Country>
        <CountryName>string</CountryName>
        <InternationalName>string</InternationalName>
        <InternationalStateAndCity>string</InternationalStateAndCity>
        <InternationalStreet>string</InternationalStreet>
        <Name>string</Name>
        <Phone>string</Phone>
        <PostalCode>string</PostalCode>
        <StateOrProvince>string</StateOrProvince>
        <Street1>string</Street1>
        <Street2>string</Street2>
      </SellerPaymentAddress>
      <StoreOwner>boolean</StoreOwner>
      <StoreSite></StoreSite>
      <StoreURL>anyURI</StoreURL>
      <TopRatedSeller>boolean</TopRatedSeller>
      <TopRatedSellerDetails>
        <TopRatedProgram></TopRatedProgram>
        <!-- ... more TopRatedProgram values allowed here ... -->
      </TopRatedSellerDetails>
      <TransactionPercent>float</TransactionPercent>
    </SellerInfo>
    <Site></Site>
    <Status></Status>
    <TUVLevel>int</TUVLevel>
    <UniqueNegativeFeedbackCount>int</UniqueNegativeFeedbackCount>
    <UniqueNeutralFeedbackCount>int</UniqueNeutralFeedbackCount>
    <UniquePositiveFeedbackCount>int</UniquePositiveFeedbackCount>
    <UserID></UserID>
    <UserIDChanged>boolean</UserIDChanged>
    <UserIDLastChanged>dateTime</UserIDLastChanged>
    <UserSubscription></UserSubscription>
    <!-- ... more UserSubscription values allowed here ... -->
    <VATID>string</VATID>
    <VATStatus></VATStatus>
  </User>
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
</GetUserResponse>
```
