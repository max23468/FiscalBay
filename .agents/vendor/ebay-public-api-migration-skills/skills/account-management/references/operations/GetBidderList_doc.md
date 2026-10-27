# GetBidderList - Traditional API (SOAP)

> **Call Name:** GetBidderList
> **API Type:** SOAP XML traditional API
> **API Version:** Not specified in source
> **Service:** Traditional

---

## Metadata

| Property | Value |
|----------|-------|
| **Call Type** | Core |
| **Deprecated** | No |
| **Replacement** | userBiddingActivity query of the Auction API |
| **Rate Limit** | Not specified in source |
| **Supported Sites** | Not specified in source |

---

## Description

Use this call to retrieve all items on which a user is currently bidding, and the ones that they have won or purchased. By default, GetBidderList returns bid information pertaining to the authorized caller.

**Purpose:**
Use this call to retrieve all items on which a user is currently bidding, and the ones that they have won or purchased. By default, GetBidderList returns bid information pertaining to the authorized caller. However, you can specify a UserID to indicate that you want to return information for a different user.

**Use Cases:**
- Retrieve items on which a user is currently bidding.
- Retrieve items the user has won or purchased.
- Inspect active or ended bidder activity within a defined end-time range.

**Important Notes:**
- By default, the call returns bid information for the authorized caller.
- You can pass UserID to retrieve information for a different user when the requester credentials are associated with multiple user IDs.
- GranularityLevel supports Fine or Medium, and Medium returns fewer fields.
- GetBidderList returns a maximum of 200 items when all available fields are returned.

---

## Authentication

### Required Credentials

| Method | Description |
|--------|-------------|
| **eBayAuthToken** | Required in `RequesterCredentials` element |
| **App ID** | Not specified in source |
| **Dev ID** | Not specified in source |
| **Cert ID** | Not specified in source |

### HTTP Headers

```http
X-EBAY-API-SITEID: Not specified in source
X-EBAY-API-COMPATIBILITY-LEVEL: Not specified in source
X-EBAY-API-CALL-NAME: GetBidderList
X-EBAY-API-DEV-NAME: Not specified in source
X-EBAY-API-APP-NAME: Not specified in source
X-EBAY-API-CERT-NAME: Not specified in source
Content-Type: text/xml; charset=utf-8
```

---

## Request Structure

### Endpoint

```
POST https://api.ebay.com/ws/api.dll
```

### XML Schema

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetBidderListRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <ActiveItemsOnly>boolean</ActiveItemsOnly>
  <EndTimeFrom>dateTime</EndTimeFrom>
  <EndTimeTo>dateTime</EndTimeTo>
  <GranularityLevel></GranularityLevel>
  <UserID></UserID>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <OutputSelector>string</OutputSelector>
  <!-- ... more OutputSelector values allowed here ... -->
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetBidderListRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| None identified | - | No | No always-required request fields were explicitly labeled in the extracted source. |

#### Optional Fields

| Field Path | Type | Default | Description | Constraints |
|------------|------|---------|-------------|-------------|
| ActiveItemsOnly | boolean | Not specified in source | Indicates whether or not to limit the result set to active items. If true , only active items are returned and the EndTimeFrom and EndTimeTo filters are ignored. If false (or not sent), both active and ended items are returned. | Not specified in source |
| GranularityLevel | GranularityLevelCodeType | Not specified in source | You can control some of the fields returned in the response by specifying one of two values in the GranularityLevel field: Fine or Medium . Fine returns more fields than the default, while setting this field to Medium returns an abbreviated set of results. | Not specified in source |

#### Conditional Fields

| Field Path | Type | Condition | Description |
|------------|------|-----------|-------------|
| EndTimeFrom | dateTime | Conditionally | Used in conjunction with EndTimeTo . Limits returned items to only those for which the item's end date is on or after the date/time specified. Specify an end date within 30 days prior to today. Items that ended more than 30 days ago are omitted from the results. If specified, EndTimeTo must also be specified. Express date/time in the format YYYY-MM-DD HH:MM:SS , and in GMT. This field is ignored if ActiveItemsOnly is set to true . |
| EndTimeTo | dateTime | Conditionally | Used in conjunction with EndTimeFrom . Limits returned items to only those for which the item's end date is on or before the date/time specified. If specified, EndTimeFrom must also be specified. Express date/time in the format YYYY-MM-DD HH:MM:SS , and in GMT. This field is ignored if ActiveItemsOnly is set to true . Note that for GTC items, whose end times automatically increment by 30 days every 30 days, an EndTimeTo value within the first 30 days of a listing will refer to the listing's initial end time. Note: Starting July 1, 2019, the Good 'Til Cancelled renewal schedule will be modified from every 30 days to once per calendar month. For example, if a GTC listing is created July 5, the next monthly renewal date will be August 5. If a GTC listing is created on the 31st of the month, but the following month only has 30 days, the renewal will happen on the 30th in the following month. Finally, if a GTC listing is created on January 29-31, the renewal will happen on February 28th (or 29th during a 'Leap Year'). See the Good 'Til Cancelled listings update in the Spring 2019 Seller Updates for more information about this change. |
| UserID | UserIDType | Conditionally | The unique identifier of an eBay user. This field is generally not required unless there are multiple User IDs tied to the requester credentials that are specified through the RequesterCredentials header. If there are multiple User IDs tied to the requester credentials, this field allows you to specify the User ID for which you wish to retrieves bids and purchases. |

## Response Structure

### XML Schema

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetBidderListResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <Bidder>
    <AboutMePage>boolean</AboutMePage>
    <eBayGoodStanding>boolean</eBayGoodStanding>
    <Email>string</Email>
    <FeedbackPrivate>boolean</FeedbackPrivate>
    <FeedbackRatingStar></FeedbackRatingStar>
    <FeedbackScore>int</FeedbackScore>
    <IDVerified>boolean</IDVerified>
    <NewUser>boolean</NewUser>
    <RegistrationDate>dateTime</RegistrationDate>
    <Site></Site>
    <Status></Status>
    <UserID></UserID>
    <UserIDChanged>boolean</UserIDChanged>
    <UserIDLastChanged>dateTime</UserIDLastChanged>
    <VATStatus></VATStatus>
  </Bidder>
  <BidItemArray>
    <Item>
      <ApplicationData>string</ApplicationData>
      <AutoPay>boolean</AutoPay>
      <BestOfferDetails>
        <BestOfferCount>int</BestOfferCount>
        <BestOfferEnabled>boolean</BestOfferEnabled>
      </BestOfferDetails>
      <BuyerGuaranteePrice currencyID="CurrencyCodeType">
      </BuyerGuaranteePrice>
      <BuyerProtection></BuyerProtection>
      <BuyerRequirementDetails>
        <MaximumItemRequirements>
          <MaximumItemCount>int</MaximumItemCount>
          <MinimumFeedbackScore>int</MinimumFeedbackScore>
        </MaximumItemRequirements>
        <MaximumUnpaidItemStrikesInfo>
          <Count>int</Count>
          <Period></Period>
        </MaximumUnpaidItemStrikesInfo>
        <ShipToRegistrationCountry>boolean</ShipToRegistrationCountry>
        <ZeroFeedbackScore>boolean</ZeroFeedbackScore>
      </BuyerRequirementDetails>
      <BuyerResponsibleForShipping>boolean</BuyerResponsibleForShipping>
      <BuyItNowPrice currencyID="CurrencyCodeType">
      </BuyItNowPrice>
      <Charity>
        <CharityID>string</CharityID>
        <CharityName>string</CharityName>
        <DonationPercent>float</DonationPercent>
        <LogoURL>string</LogoURL>
        <Mission>string</Mission>
        <Status></Status>
      </Charity>
      <Country></Country>
      <Currency></Currency>
      <DisableBuyerRequirements>boolean</DisableBuyerRequirements>
      <DispatchTimeMax>int</DispatchTimeMax>
      <FreeAddedCategory>
        <CategoryID>string</CategoryID>
        <CategoryName>string</CategoryName>
      </FreeAddedCategory>
      <ItemID></ItemID>
      <ListingDetails>
        <Adult>boolean</Adult>
        <BindingAuction>boolean</BindingAuction>
        <BuyItNowAvailable>boolean</BuyItNowAvailable>
        <CheckoutEnabled>boolean</CheckoutEnabled>
        <ConvertedBuyItNowPrice currencyID="CurrencyCodeType">
        </ConvertedBuyItNowPrice>
        <ConvertedReservePrice currencyID="CurrencyCodeType">
        </ConvertedReservePrice>
        <ConvertedStartPrice currencyID="CurrencyCodeType">
        </ConvertedStartPrice>
        <EndTime>dateTime</EndTime>
        <HasPublicMessages>boolean</HasPublicMessages>
        <HasReservePrice>boolean</HasReservePrice>
        <HasUnansweredQuestions>boolean</HasUnansweredQuestions>
        <RelistedItemID></RelistedItemID>
        <SecondChanceOriginalItemID></SecondChanceOriginalItemID>
        <StartTime>dateTime</StartTime>
        <ViewItemURL>anyURI</ViewItemURL>
        <ViewItemURLForNaturalSearch>anyURI</ViewItemURLForNaturalSearch>
      </ListingDetails>
      <ListingDuration>token</ListingDuration>
      <ListingEnhancement></ListingEnhancement>
      <!-- ... more ListingEnhancement values allowed here ... -->
      <ListingType></ListingType>
      <Location>string</Location>
      <LocationDefaulted>boolean</LocationDefaulted>
      <LotSize>int</LotSize>
      <PaymentDetails>
        <DaysToFullPayment>int</DaysToFullPayment>
        <DepositAmount currencyID="CurrencyCodeType">
        </DepositAmount>
        <DepositType></DepositType>
        <HoursToDeposit>int</HoursToDeposit>
      </PaymentDetails>
      <PaymentMethods></PaymentMethods>
      <!-- ... more PaymentMethods values allowed here ... -->
      <PayPalEmailAddress>string</PayPalEmailAddress>
      <PictureDetails>
        <PictureURL>anyURI</PictureURL>
        <!-- ... more PictureURL values allowed here ... -->
      </PictureDetails>
      <PostalCode>string</PostalCode>
      <PrimaryCategory>
        <CategoryID>string</CategoryID>
        <CategoryName>string</CategoryName>
      </PrimaryCategory>
      <PrivateListing>boolean</PrivateListing>
      <ProductListingDetails>
        <Copyright>string</Copyright>
        <!-- ... more Copyright values allowed here ... -->
        <IncludeeBayProductDetails>boolean</IncludeeBayProductDetails>
        <IncludeStockPhotoURL>boolean</IncludeStockPhotoURL>
        <StockPhotoURL>anyURI</StockPhotoURL>
        <UseStockPhotoURLAsGallery>boolean</UseStockPhotoURLAsGallery>
      </ProductListingDetails>
      <Quantity>int</Quantity>
      <ReservePrice currencyID="CurrencyCodeType">
      </ReservePrice>
      <ReturnPolicy>
        <Description>string</Description>
        <InternationalRefundOption>token</InternationalRefundOption>
        <InternationalReturnsAcceptedOption>token</InternationalReturnsAcceptedOption>
        <InternationalReturnsWithinOption>token</InternationalReturnsWithinOption>
        <InternationalShippingCostPaidByOption>token</InternationalShippingCostPaidByOption>
        <Refund>string</Refund>
        <RefundOption>token</RefundOption>
        <ReturnsAccepted>string</ReturnsAccepted>
        <ReturnsAcceptedOption>token</ReturnsAcceptedOption>
        <ReturnsWithin>string</ReturnsWithin>
        <ReturnsWithinOption>token</ReturnsWithinOption>
        <ShippingCostPaidBy>string</ShippingCostPaidBy>
        <ShippingCostPaidByOption>token</ShippingCostPaidByOption>
      </ReturnPolicy>
      <ReviseStatus>
        <BuyItNowAdded>boolean</BuyItNowAdded>
        <BuyItNowLowered>boolean</BuyItNowLowered>
        <ItemRevised>boolean</ItemRevised>
        <ReserveLowered>boolean</ReserveLowered>
        <ReserveRemoved>boolean</ReserveRemoved>
      </ReviseStatus>
      <SecondaryCategory>
        <CategoryID>string</CategoryID>
        <CategoryName>string</CategoryName>
      </SecondaryCategory>
      <Seller>
        <AboutMePage>boolean</AboutMePage>
        <eBayGoodStanding>boolean</eBayGoodStanding>
        <Email>string</Email>
        <FeedbackPrivate>boolean</FeedbackPrivate>
        <FeedbackRatingStar></FeedbackRatingStar>
        <FeedbackScore>int</FeedbackScore>
        <IDVerified>boolean</IDVerified>
        <NewUser>boolean</NewUser>
        <RegistrationDate>dateTime</RegistrationDate>
        <SellerInfo>
          <AllowPaymentEdit>boolean</AllowPaymentEdit>
          <CheckoutEnabled>boolean</CheckoutEnabled>
          <CIPBankAccountStored>boolean</CIPBankAccountStored>
          <GoodStanding>boolean</GoodStanding>
          <QualifiesForB2BVAT>boolean</QualifiesForB2BVAT>
          <SafePaymentExempt>boolean</SafePaymentExempt>
          <SellerLevel></SellerLevel>
          <StoreOwner>boolean</StoreOwner>
          <TopRatedSeller>boolean</TopRatedSeller>
        </SellerInfo>
        <Site></Site>
        <Status></Status>
        <UserID></UserID>
        <UserIDChanged>boolean</UserIDChanged>
        <UserIDLastChanged>dateTime</UserIDLastChanged>
        <VATStatus></VATStatus>
      </Seller>
      <SellerVacationNote>string</SellerVacationNote>
      <SellingStatus>
        <BidCount>int</BidCount>
        <BidIncrement currencyID="CurrencyCodeType">
        </BidIncrement>
        <ConvertedCurrentPrice currencyID="CurrencyCodeType">
        </ConvertedCurrentPrice>
        <CurrentPrice currencyID="CurrencyCodeType">
        </CurrentPrice>
        <FinalValueFee currencyID="CurrencyCodeType">
        </FinalValueFee>
        <HighBidder>
          <AboutMePage>boolean</AboutMePage>
          <eBayGoodStanding>boolean</eBayGoodStanding>
          <Email>string</Email>
          <FeedbackPrivate>boolean</FeedbackPrivate>
          <FeedbackRatingStar></FeedbackRatingStar>
          <FeedbackScore>int</FeedbackScore>
          <IDVerified>boolean</IDVerified>
          <NewUser>boolean</NewUser>
          <RegistrationDate>dateTime</RegistrationDate>
          <Site></Site>
          <Status></Status>
          <UserID></UserID>
          <UserIDChanged>boolean</UserIDChanged>
          <UserIDLastChanged>dateTime</UserIDLastChanged>
          <VATStatus></VATStatus>
        </HighBidder>
        <LeadCount>int</LeadCount>
        <ListingStatus></ListingStatus>
        <MinimumToBid currencyID="CurrencyCodeType">
        </MinimumToBid>
        <PromotionalSaleDetails>
          <EndTime>dateTime</EndTime>
          <OriginalPrice currencyID="CurrencyCodeType">
          </OriginalPrice>
          <StartTime>dateTime</StartTime>
        </PromotionalSaleDetails>
        <QuantitySold>int</QuantitySold>
        <ReserveMet>boolean</ReserveMet>
        <SecondChanceEligible>boolean</SecondChanceEligible>
      </SellingStatus>
      <ShippingDetails>
        <GetItFast>boolean</GetItFast>
        <InternationalShippingServiceOption>
          <ShippingService>token</ShippingService>
          <ShippingServiceAdditionalCost currencyID="CurrencyCodeType">
          </ShippingServiceAdditionalCost>
          <ShippingServiceCost currencyID="CurrencyCodeType">
          </ShippingServiceCost>
          <ShippingServicePriority>int</ShippingServicePriority>
          <ShipToLocation>string</ShipToLocation>
          <!-- ... more ShipToLocation values allowed here ... -->
        </InternationalShippingServiceOption>
        <!-- ... more InternationalShippingServiceOption nodes allowed here ... -->
        <SalesTax>
          <SalesTaxPercent>float</SalesTaxPercent>
          <SalesTaxState>string</SalesTaxState>
          <ShippingIncludedInTax>boolean</ShippingIncludedInTax>
        </SalesTax>
        <SellerExcludeShipToLocationsPreference>boolean</SellerExcludeShipToLocationsPreference>
        <ShippingType></ShippingType>
        <TaxTable>
          <TaxJurisdiction>
            <JurisdictionID>string</JurisdictionID>
            <SalesTaxPercent>float</SalesTaxPercent>
            <ShippingIncludedInTax>boolean</ShippingIncludedInTax>
          </TaxJurisdiction>
          <!-- ... more TaxJurisdiction nodes allowed here ... -->
        </TaxTable>
        <ThirdPartyCheckout>boolean</ThirdPartyCheckout>
      </ShippingDetails>
      <ShipToLocations>string</ShipToLocations>
      <!-- ... more ShipToLocations values allowed here ... -->
      <Site></Site>
      <SKU></SKU>
      <StartPrice currencyID="CurrencyCodeType">
      </StartPrice>
      <Storefront>
        <StoreCategory2ID>long</StoreCategory2ID>
        <StoreCategoryID>long</StoreCategoryID>
        <StoreURL>anyURI</StoreURL>
      </Storefront>
      <SubTitle>string</SubTitle>
      <TimeLeft>duration</TimeLeft>
      <Title>string</Title>
      <UUID></UUID>
      <VATDetails>
        <VATPercent>float</VATPercent>
      </VATDetails>
    </Item>
    <!-- ... more Item nodes allowed here ... -->
  </BidItemArray>
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
</GetBidderListResponse>
```

### Response Fields

#### System Fields (Always Returned)

| Field Path | Type | Description |
|------------|------|-------------|
| Timestamp | dateTime | Not specified in source |
| Ack | AckCodeType | Not specified in source |
| Version | string | Not specified in source |
| Build | string | Not specified in source |
| CorrelationID | string | Not specified in source |

#### Data Fields

| Field Path | Type | Occurrence | Description |
|------------|------|------------|-------------|
| Bidder | UserType | Always | Data for one eBay bidder. |
| BidItemArray | ItemArrayType | Always | Array of items the bidder has bid on, has won or has lost. |

#### Error Fields (On Failure)

| Field Path | Type | Description |
|------------|------|-------------|
| Errors.ShortMessage | string | Brief error description |
| Errors.LongMessage | string | Detailed error explanation |
| Errors.ErrorCode | int | Numeric error code |
| Errors.SeverityCode | ErrorSeverityCodeType | Error/Warning |
| Errors.ErrorClassification | ErrorClassificationCodeType | RequestError/SystemError |
| Errors.ErrorParameters | NameValueListType[] | Additional error context |

## Complex Types Reference

### GetBidderListRequestType

**Description:** Retrieves all items that the user is currently bidding on, and the ones they have won or purchased.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| ActiveItemsOnly | boolean | [0..1] | Indicates whether or not to limit the result set to active items. If true , only active items are returned and the EndTimeFrom and EndTimeTo filters are ignored. If false (or not sent), both active and ended items are returned. |
| EndTimeFrom | dateTime | [0..1] | Used in conjunction with EndTimeTo . Limits returned items to only those for which the item's end date is on or after the date/time specified. Specify an end date within 30 days prior to today. Items that ended more than 30 days ago are omitted from the results. If specified, EndTimeTo must also be specified. Express date/time in the format YYYY-MM-DD HH:MM:SS , and in GMT. This field is ignored if ActiveItemsOnly is set to true . |
| EndTimeTo | dateTime | [0..1] | Used in conjunction with EndTimeFrom . Limits returned items to only those for which the item's end date is on or before the date/time specified. If specified, EndTimeFrom must also be specified. Express date/time in the format YYYY-MM-DD HH:MM:SS , and in GMT. This field is ignored if ActiveItemsOnly is set to true . Note that for GTC items, whose end times automatically increment by 30 days every 30 days, an EndTimeTo value within the first 30 days of a listing will refer to the listing's initial end time. Note: Starting July 1, 2019, the Good 'Til Cancelled renewal schedule will be modified from every 30 days to once per calendar month. For example, if a GTC listing is created July 5, the next monthly renewal date will be August 5. If a GTC listing is created on the 31st of the month, but the following month only has 30 days, the renewal will happen on the 30th in the following month. Finally, if a GTC listing is created on January 29-31, the renewal will happen on February 28th (or 29th during a 'Leap Year'). See the Good 'Til Cancelled listings update in the Spring 2019 Seller Updates for more information about this change. |
| UserID | UserIDType | [0..1] | The unique identifier of an eBay user. This field is generally not required unless there are multiple User IDs tied to the requester credentials that are specified through the RequesterCredentials header. If there are multiple User IDs tied to the requester credentials, this field allows you to specify the User ID for which you wish to retrieves bids and purchases. |
| GranularityLevel | GranularityLevelCodeType | [0..1] | You can control some of the fields returned in the response by specifying one of two values in the GranularityLevel field: Fine or Medium . Fine returns more fields than the default, while setting this field to Medium returns an abbreviated set of results. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<GetBidderListRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <ActiveItemsOnly>boolean</ActiveItemsOnly>
  <EndTimeFrom>dateTime</EndTimeFrom>
  <EndTimeTo>dateTime</EndTimeTo>
  <GranularityLevel></GranularityLevel>
  <UserID></UserID>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <OutputSelector>string</OutputSelector>
  <!-- ... more OutputSelector values allowed here ... -->
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetBidderListRequest>
```

### GetBidderListResponseType

**Description:** Response to a GetBidderList call, which retrieves all items the user is currently bidding on, or has won or purchased.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| Bidder | UserType | [0..1] | Data for one eBay bidder. |
| BidItemArray | ItemArrayType | [0..1] | Array of items the bidder has bid on, has won or has lost. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<GetBidderListResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <Bidder>
    <AboutMePage>boolean</AboutMePage>
    <eBayGoodStanding>boolean</eBayGoodStanding>
    <Email>string</Email>
    <FeedbackPrivate>boolean</FeedbackPrivate>
    <FeedbackRatingStar></FeedbackRatingStar>
    <FeedbackScore>int</FeedbackScore>
    <IDVerified>boolean</IDVerified>
    <NewUser>boolean</NewUser>
    <RegistrationDate>dateTime</RegistrationDate>
    <Site></Site>
    <Status></Status>
    <UserID></UserID>
    <UserIDChanged>boolean</UserIDChanged>
    <UserIDLastChanged>dateTime</UserIDLastChanged>
    <VATStatus></VATStatus>
  </Bidder>
  <BidItemArray>
    <Item>
      <ApplicationData>string</ApplicationData>
      <AutoPay>boolean</AutoPay>
      <BestOfferDetails>
        <BestOfferCount>int</BestOfferCount>
        <BestOfferEnabled>boolean</BestOfferEnabled>
      </BestOfferDetails>
      <BuyerGuaranteePrice currencyID="CurrencyCodeType">
      </BuyerGuaranteePrice>
      <BuyerProtection></BuyerProtection>
      <BuyerRequirementDetails>
        <MaximumItemRequirements>
          <MaximumItemCount>int</MaximumItemCount>
          <MinimumFeedbackScore>int</MinimumFeedbackScore>
        </MaximumItemRequirements>
        <MaximumUnpaidItemStrikesInfo>
          <Count>int</Count>
          <Period></Period>
        </MaximumUnpaidItemStrikesInfo>
        <ShipToRegistrationCountry>boolean</ShipToRegistrationCountry>
        <ZeroFeedbackScore>boolean</ZeroFeedbackScore>
      </BuyerRequirementDetails>
      <BuyerResponsibleForShipping>boolean</BuyerResponsibleForShipping>
      <BuyItNowPrice currencyID="CurrencyCodeType">
      </BuyItNowPrice>
      <Charity>
        <CharityID>string</CharityID>
        <CharityName>string</CharityName>
        <DonationPercent>float</DonationPercent>
        <LogoURL>string</LogoURL>
        <Mission>string</Mission>
        <Status></Status>
      </Charity>
      <Country></Country>
      <Currency></Currency>
      <DisableBuyerRequirements>boolean</DisableBuyerRequirements>
      <DispatchTimeMax>int</DispatchTimeMax>
      <FreeAddedCategory>
        <CategoryID>string</CategoryID>
        <CategoryName>string</CategoryName>
      </FreeAddedCategory>
      <ItemID></ItemID>
      <ListingDetails>
        <Adult>boolean</Adult>
        <BindingAuction>boolean</BindingAuction>
        <BuyItNowAvailable>boolean</BuyItNowAvailable>
        <CheckoutEnabled>boolean</CheckoutEnabled>
        <ConvertedBuyItNowPrice currencyID="CurrencyCodeType">
        </ConvertedBuyItNowPrice>
        <ConvertedReservePrice currencyID="CurrencyCodeType">
        </ConvertedReservePrice>
        <ConvertedStartPrice currencyID="CurrencyCodeType">
        </ConvertedStartPrice>
        <EndTime>dateTime</EndTime>
        <HasPublicMessages>boolean</HasPublicMessages>
        <HasReservePrice>boolean</HasReservePrice>
        <HasUnansweredQuestions>boolean</HasUnansweredQuestions>
        <RelistedItemID></RelistedItemID>
        <SecondChanceOriginalItemID></SecondChanceOriginalItemID>
        <StartTime>dateTime</StartTime>
        <ViewItemURL>anyURI</ViewItemURL>
        <ViewItemURLForNaturalSearch>anyURI</ViewItemURLForNaturalSearch>
      </ListingDetails>
      <ListingDuration>token</ListingDuration>
      <ListingEnhancement></ListingEnhancement>
      <!-- ... more ListingEnhancement values allowed here ... -->
      <ListingType></ListingType>
      <Location>string</Location>
      <LocationDefaulted>boolean</LocationDefaulted>
      <LotSize>int</LotSize>
      <PaymentDetails>
        <DaysToFullPayment>int</DaysToFullPayment>
        <DepositAmount currencyID="CurrencyCodeType">
        </DepositAmount>
        <DepositType></DepositType>
        <HoursToDeposit>int</HoursToDeposit>
      </PaymentDetails>
      <PaymentMethods></PaymentMethods>
      <!-- ... more PaymentMethods values allowed here ... -->
      <PayPalEmailAddress>string</PayPalEmailAddress>
      <PictureDetails>
        <PictureURL>anyURI</PictureURL>
        <!-- ... more PictureURL values allowed here ... -->
      </PictureDetails>
      <PostalCode>string</PostalCode>
      <PrimaryCategory>
        <CategoryID>string</CategoryID>
        <CategoryName>string</CategoryName>
      </PrimaryCategory>
      <PrivateListing>boolean</PrivateListing>
      <ProductListingDetails>
        <Copyright>string</Copyright>
        <!-- ... more Copyright values allowed here ... -->
        <IncludeeBayProductDetails>boolean</IncludeeBayProductDetails>
        <IncludeStockPhotoURL>boolean</IncludeStockPhotoURL>
        <StockPhotoURL>anyURI</StockPhotoURL>
        <UseStockPhotoURLAsGallery>boolean</UseStockPhotoURLAsGallery>
      </ProductListingDetails>
      <Quantity>int</Quantity>
      <ReservePrice currencyID="CurrencyCodeType">
      </ReservePrice>
      <ReturnPolicy>
        <Description>string</Description>
        <InternationalRefundOption>token</InternationalRefundOption>
        <InternationalReturnsAcceptedOption>token</InternationalReturnsAcceptedOption>
        <InternationalReturnsWithinOption>token</InternationalReturnsWithinOption>
        <InternationalShippingCostPaidByOption>token</InternationalShippingCostPaidByOption>
        <Refund>string</Refund>
        <RefundOption>token</RefundOption>
        <ReturnsAccepted>string</ReturnsAccepted>
        <ReturnsAcceptedOption>token</ReturnsAcceptedOption>
        <ReturnsWithin>string</ReturnsWithin>
        <ReturnsWithinOption>token</ReturnsWithinOption>
        <ShippingCostPaidBy>string</ShippingCostPaidBy>
        <ShippingCostPaidByOption>token</ShippingCostPaidByOption>
      </ReturnPolicy>
      <ReviseStatus>
        <BuyItNowAdded>boolean</BuyItNowAdded>
        <BuyItNowLowered>boolean</BuyItNowLowered>
        <ItemRevised>boolean</ItemRevised>
        <ReserveLowered>boolean</ReserveLowered>
        <ReserveRemoved>boolean</ReserveRemoved>
      </ReviseStatus>
      <SecondaryCategory>
        <CategoryID>string</CategoryID>
        <CategoryName>string</CategoryName>
      </SecondaryCategory>
      <Seller>
        <AboutMePage>boolean</AboutMePage>
        <eBayGoodStanding>boolean</eBayGoodStanding>
        <Email>string</Email>
        <FeedbackPrivate>boolean</FeedbackPrivate>
        <FeedbackRatingStar></FeedbackRatingStar>
        <FeedbackScore>int</FeedbackScore>
        <IDVerified>boolean</IDVerified>
        <NewUser>boolean</NewUser>
        <RegistrationDate>dateTime</RegistrationDate>
        <SellerInfo>
          <AllowPaymentEdit>boolean</AllowPaymentEdit>
          <CheckoutEnabled>boolean</CheckoutEnabled>
          <CIPBankAccountStored>boolean</CIPBankAccountStored>
          <GoodStanding>boolean</GoodStanding>
          <QualifiesForB2BVAT>boolean</QualifiesForB2BVAT>
          <SafePaymentExempt>boolean</SafePaymentExempt>
          <SellerLevel></SellerLevel>
          <StoreOwner>boolean</StoreOwner>
          <TopRatedSeller>boolean</TopRatedSeller>
        </SellerInfo>
        <Site></Site>
        <Status></Status>
        <UserID></UserID>
        <UserIDChanged>boolean</UserIDChanged>
        <UserIDLastChanged>dateTime</UserIDLastChanged>
        <VATStatus></VATStatus>
      </Seller>
      <SellerVacationNote>string</SellerVacationNote>
      <SellingStatus>
        <BidCount>int</BidCount>
        <BidIncrement currencyID="CurrencyCodeType">
        </BidIncrement>
        <ConvertedCurrentPrice currencyID="CurrencyCodeType">
        </ConvertedCurrentPrice>
        <CurrentPrice currencyID="CurrencyCodeType">
        </CurrentPrice>
        <FinalValueFee currencyID="CurrencyCodeType">
        </FinalValueFee>
        <HighBidder>
          <AboutMePage>boolean</AboutMePage>
          <eBayGoodStanding>boolean</eBayGoodStanding>
          <Email>string</Email>
          <FeedbackPrivate>boolean</FeedbackPrivate>
          <FeedbackRatingStar></FeedbackRatingStar>
          <FeedbackScore>int</FeedbackScore>
          <IDVerified>boolean</IDVerified>
          <NewUser>boolean</NewUser>
          <RegistrationDate>dateTime</RegistrationDate>
          <Site></Site>
          <Status></Status>
          <UserID></UserID>
          <UserIDChanged>boolean</UserIDChanged>
          <UserIDLastChanged>dateTime</UserIDLastChanged>
          <VATStatus></VATStatus>
        </HighBidder>
        <LeadCount>int</LeadCount>
        <ListingStatus></ListingStatus>
        <MinimumToBid currencyID="CurrencyCodeType">
        </MinimumToBid>
        <PromotionalSaleDetails>
          <EndTime>dateTime</EndTime>
          <OriginalPrice currencyID="CurrencyCodeType">
          </OriginalPrice>
          <StartTime>dateTime</StartTime>
        </PromotionalSaleDetails>
        <QuantitySold>int</QuantitySold>
        <ReserveMet>boolean</ReserveMet>
        <SecondChanceEligible>boolean</SecondChanceEligible>
      </SellingStatus>
      <ShippingDetails>
        <GetItFast>boolean</GetItFast>
        <InternationalShippingServiceOption>
          <ShippingService>token</ShippingService>
          <ShippingServiceAdditionalCost currencyID="CurrencyCodeType">
          </ShippingServiceAdditionalCost>
          <ShippingServiceCost currencyID="CurrencyCodeType">
          </ShippingServiceCost>
          <ShippingServicePriority>int</ShippingServicePriority>
          <ShipToLocation>string</ShipToLocation>
          <!-- ... more ShipToLocation values allowed here ... -->
        </InternationalShippingServiceOption>
        <!-- ... more InternationalShippingServiceOption nodes allowed here ... -->
        <SalesTax>
          <SalesTaxPercent>float</SalesTaxPercent>
          <SalesTaxState>string</SalesTaxState>
          <ShippingIncludedInTax>boolean</ShippingIncludedInTax>
        </SalesTax>
        <SellerExcludeShipToLocationsPreference>boolean</SellerExcludeShipToLocationsPreference>
        <ShippingType></ShippingType>
        <TaxTable>
          <TaxJurisdiction>
            <JurisdictionID>string</JurisdictionID>
            <SalesTaxPercent>float</SalesTaxPercent>
            <ShippingIncludedInTax>boolean</ShippingIncludedInTax>
          </TaxJurisdiction>
          <!-- ... more TaxJurisdiction nodes allowed here ... -->
        </TaxTable>
        <ThirdPartyCheckout>boolean</ThirdPartyCheckout>
      </ShippingDetails>
      <ShipToLocations>string</ShipToLocations>
      <!-- ... more ShipToLocations values allowed here ... -->
      <Site></Site>
      <SKU></SKU>
      <StartPrice currencyID="CurrencyCodeType">
      </StartPrice>
      <Storefront>
        <StoreCategory2ID>long</StoreCategory2ID>
        <StoreCategoryID>long</StoreCategoryID>
        <StoreURL>anyURI</StoreURL>
      </Storefront>
      <SubTitle>string</SubTitle>
      <TimeLeft>duration</TimeLeft>
      <Title>string</Title>
      <UUID></UUID>
      <VATDetails>
        <VATPercent>float</VATPercent>
      </VATDetails>
    </Item>
    <!-- ... more Item nodes allowed here ... -->
  </BidItemArray>
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
</GetBidderListResponse>
```

---

## Enumerations

### GranularityLevel

| Value | Description | Notes |
|-------|-------------|-------|
| Fine | Returns the most robust output. | Adds more fields than the default. |
| Medium | Returns an abbreviated result set. | Returns fewer fields than Fine. |

---

## Error Codes

| Error Code | Short Message | Description | Resolution |
|------------|---------------|-------------|------------|
| Source does not provide call-specific error codes | Source does not provide call-specific error codes | The extracted JSONL and WSDL content define the Errors container but do not include a call-specific error code table. | Use runtime Traditional API error payloads together with the documented request rules for troubleshooting. |

---

## Business Rules & Constraints

### Field-Level Constraints

#### Request fields
- **Max Length:** Not specified in source
- **Min Length:** Not specified in source
- **Pattern:** Not specified in source
- **Allowed Values:** Not specified in source unless noted in field descriptions
- **Dependencies:** See request-field descriptions and operation-level rules below

### Operation-Level Rules

1. **End-time filters must be paired**
   - Description: EndTimeFrom and EndTimeTo are used together.
   - Applies when: When filtering by end time.
   - Impact: If one is sent, the other must also be sent.

2. **ActiveItemsOnly overrides time filters**
   - Description: When ActiveItemsOnly is true, EndTimeFrom and EndTimeTo are ignored.
   - Applies when: When retrieving only active bidder items.
   - Impact: Time-range filters do not affect the response.

3. **Granularity affects payload size**
   - Description: Fine returns more fields than Medium.
   - Applies when: When choosing GranularityLevel.
   - Impact: Use Medium for smaller responses and Fine for richer item detail.

### Revision Restrictions (If applicable)

| Condition | Allowed Changes | Prohibited Changes |
|-----------|-----------------|-------------------|
| Source does not provide a separate revision-restrictions table for this call | See operation-level rules and field descriptions | Not specified in source |

---

## Rate Limits & Throttling

| Metric | Limit | Window | Notes |
|--------|-------|--------|-------|
| API Calls | Not specified in source | Not specified in source | No long-window quota is explicitly provided in the extracted source. |
| Frequency | Not specified in source | Not specified in source | Not specified in source |

**Throttling Behavior:**
Not specified in source

---

## Best Practices

1. **Use Medium when possible**
   - If you only need a smaller result payload, use Medium granularity instead of Fine.

2. **Avoid refetching stable item detail**
   - The source recommends using GetItem later for item details instead of repeatedly requesting them through GetBidderList.

3. **Use end-time filters deliberately**
   - Restrict the returned items with EndTimeFrom and EndTimeTo when you only need recent bidding activity.

4. **Remember active-item behavior**
   - If you only want active items, set ActiveItemsOnly to true and do not depend on end-time filters.

---

## Migration Path

### New API Equivalent

| SOAP Operation | New API | Type |
|----------------|---------|------|
| GetBidderList | Auction API userBiddingActivity | Query |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_getbidderlist_html.jsonl`; `.trace_artifacts/extract_wsdl_getbidderlist.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
