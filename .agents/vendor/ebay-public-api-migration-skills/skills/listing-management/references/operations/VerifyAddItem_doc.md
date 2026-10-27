# VerifyAddItem - Traditional API (SOAP)

> **Call Name:** VerifyAddItem
> **API Type:** SOAP XML traditional API
> **API Version:** Not specified in source
> **Service:** Traditional

---

## Metadata

| Property | Value |
|----------|-------|
| **Call Type** | Core |
| **Deprecated** | No |
| **Replacement** | createListing mutation of the Listing API |
| **Rate Limit** | Users who exceed Add-call frequency limits may be temporarily blocked and may receive ErrorCode 21919144. |
| **Supported Sites** | Not specified in source |

---

## Description

Use this call to specify the definition of a new item and submit the definition to eBay without creating a listing. This lets the seller test the item definition and get the listing fees before actually listing the item.

**Purpose:**
Use this call to specify the definition of a new item and submit the definition to eBay without creating a listing. This lets the seller test the item definition and get the listing fees before actually listing the item. Note, however, that due to timing considerations, the listing fees returned by VerifyAddItem can be different from the listing fees returned by AddItem for the same item listing.

**Use Cases:**
- Validate a new item definition without publishing the listing.
- Estimate listing fees before calling AddItem.
- Catch schema or validation issues before performing a live listing call.

**Important Notes:**
- The call validates input fields and returns estimated fees without creating a listing.
- Some business-logic checks performed for AddItem are not executed by VerifyAddItem.
- To create multi-variation listings, use VerifyAddFixedPriceItem instead.
- Users who exceed Add-call frequency limits may be temporarily blocked and may receive ErrorCode 21919144.

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
X-EBAY-API-CALL-NAME: VerifyAddItem
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
<VerifyAddItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <Item>
    <ApplicationData>string</ApplicationData>
    <AutoPay>boolean</AutoPay>
    <BestOfferDetails>
      <BestOfferEnabled>boolean</BestOfferEnabled>
    </BestOfferDetails>
    <BuyerResponsibleForShipping>boolean</BuyerResponsibleForShipping>
    <BuyItNowPrice currencyID="CurrencyCodeType">
    </BuyItNowPrice>
    <CategoryMappingAllowed>boolean</CategoryMappingAllowed>
    <Charity>
      <CharityID>string</CharityID>
      <DonationPercent>float</DonationPercent>
    </Charity>
    <ConditionDescription>string</ConditionDescription>
    <ConditionDescriptors>
      <ConditionDescriptor>
        <AdditionalInfo>string</AdditionalInfo>
        <Name>string</Name>
        <Value>string</Value>
        <!-- ... more Value values allowed here ... -->
      </ConditionDescriptor>
      <!-- ... more ConditionDescriptor nodes allowed here ... -->
    </ConditionDescriptors>
    <ConditionID>int</ConditionID>
    <Country></Country>
    <CrossBorderTrade>string</CrossBorderTrade>
    <!-- ... more CrossBorderTrade values allowed here ... -->
    <Currency></Currency>
    <CustomPolicies>
      <ProductCompliancePolicyID>long</ProductCompliancePolicyID>
      <!-- ... more ProductCompliancePolicyID values allowed here ... -->
      <RegionalProductCompliancePolicies>
        <CountryPolicies>
          <Country></Country>
          <PolicyID>long</PolicyID>
          <!-- ... more PolicyID values allowed here ... -->
        </CountryPolicies>
        <!-- ... more CountryPolicies nodes allowed here ... -->
      </RegionalProductCompliancePolicies>
      <RegionalTakeBackPolicies>
        <CountryPolicies>
          <Country></Country>
          <PolicyID>long</PolicyID>
          <!-- ... more PolicyID values allowed here ... -->
        </CountryPolicies>
        <!-- ... more CountryPolicies nodes allowed here ... -->
      </RegionalTakeBackPolicies>
      <TakeBackPolicyID>long</TakeBackPolicyID>
    </CustomPolicies>
    <Description>string</Description>
    <DigitalGoodInfo>
      <DigitalDelivery>boolean</DigitalDelivery>
    </DigitalGoodInfo>
    <DisableBuyerRequirements>boolean</DisableBuyerRequirements>
    <DiscountPriceInfo>
      <MadeForOutletComparisonPrice currencyID="CurrencyCodeType">
      </MadeForOutletComparisonPrice>
      <MinimumAdvertisedPrice currencyID="CurrencyCodeType">
      </MinimumAdvertisedPrice>
      <MinimumAdvertisedPriceExposure></MinimumAdvertisedPriceExposure>
      <OriginalRetailPrice currencyID="CurrencyCodeType">
      </OriginalRetailPrice>
      <SoldOffeBay>boolean</SoldOffeBay>
      <SoldOneBay>boolean</SoldOneBay>
    </DiscountPriceInfo>
    <DispatchTimeMax>int</DispatchTimeMax>
    <eBayPlus>boolean</eBayPlus>
    <ExtendedProducerResponsibility>
      <EcoParticipationFee currencyID="CurrencyCodeType">
      </EcoParticipationFee>
    </ExtendedProducerResponsibility>
    <ExtendedSellerContactDetails>
      <ClassifiedAdContactByEmailEnabled>boolean</ClassifiedAdContactByEmailEnabled>
      <ContactHoursDetails>
        <Hours1AnyTime>boolean</Hours1AnyTime>
        <Hours1Days></Hours1Days>
        <Hours1From>time</Hours1From>
        <Hours1To>time</Hours1To>
        <Hours2AnyTime>boolean</Hours2AnyTime>
        <Hours2Days></Hours2Days>
        <Hours2From>time</Hours2From>
        <Hours2To>time</Hours2To>
        <TimeZoneID>string</TimeZoneID>
      </ContactHoursDetails>
    </ExtendedSellerContactDetails>
    <ItemCompatibilityList>
      <Compatibility>
        <CompatibilityNotes>string</CompatibilityNotes>
        <NameValueList>
          <Name>string</Name>
          <Value>string</Value>
          <!-- ... more Value values allowed here ... -->
        </NameValueList>
        <!-- ... more NameValueList nodes allowed here ... -->
      </Compatibility>
      <!-- ... more Compatibility nodes allowed here ... -->
    </ItemCompatibilityList>
    <ItemSpecifics>
      <NameValueList>
        <Name>string</Name>
        <Value>string</Value>
        <!-- ... more Value values allowed here ... -->
      </NameValueList>
      <!-- ... more NameValueList nodes allowed here ... -->
    </ItemSpecifics>
    <ListingDetails>
      <BestOfferAutoAcceptPrice currencyID="CurrencyCodeType">
      </BestOfferAutoAcceptPrice>
      <MinimumBestOfferPrice currencyID="CurrencyCodeType">
      </MinimumBestOfferPrice>
    </ListingDetails>
    <ListingDuration>token</ListingDuration>
    <ListingEnhancement></ListingEnhancement>
    <!-- ... more ListingEnhancement values allowed here ... -->
    <ListingType></ListingType>
    <Location>string</Location>
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
    <PickupInStoreDetails>
      <EligibleForPickupInStore>boolean</EligibleForPickupInStore>
    </PickupInStoreDetails>
    <PictureDetails>
      <GalleryType></GalleryType>
      <PictureURL>anyURI</PictureURL>
      <!-- ... more PictureURL values allowed here ... -->
    </PictureDetails>
    <PostalCode>string</PostalCode>
    <PrimaryCategory>
      <CategoryID>string</CategoryID>
    </PrimaryCategory>
    <PrivateListing>boolean</PrivateListing>
    <PrivateNotes>string</PrivateNotes>
    <ProductListingDetails>
      <BrandMPN>
        <Brand>string</Brand>
        <MPN>string</MPN>
      </BrandMPN>
      <EAN>string</EAN>
      <IncludeeBayProductDetails>boolean</IncludeeBayProductDetails>
      <IncludeStockPhotoURL>boolean</IncludeStockPhotoURL>
      <ISBN>string</ISBN>
      <ProductReferenceID>string</ProductReferenceID>
      <ReturnSearchResultOnDuplicates>boolean</ReturnSearchResultOnDuplicates>
      <UPC>string</UPC>
      <UseFirstProduct>boolean</UseFirstProduct>
      <UseStockPhotoURLAsGallery>boolean</UseStockPhotoURLAsGallery>
    </ProductListingDetails>
    <Quantity>int</Quantity>
    <QuantityRestrictionPerBuyer>
      <MaximumQuantity>int</MaximumQuantity>
    </QuantityRestrictionPerBuyer>
    <Regulatory>
      <Documents>
        <Document>
          <DocumentID>string</DocumentID>
        </Document>
        <!-- ... more Document nodes allowed here ... -->
      </Documents>
      <EnergyEfficiencyLabel>
        <ImageDescription>string</ImageDescription>
        <ImageURL>anyURI</ImageURL>
        <ProductInformationsheet>anyURI</ProductInformationsheet>
      </EnergyEfficiencyLabel>
      <Hazmat>
        <Component>string</Component>
        <Pictograms>
          <Pictogram>string</Pictogram>
          <!-- ... more Pictogram values allowed here ... -->
        </Pictograms>
        <SignalWord>string</SignalWord>
        <Statements>
          <Statement>string</Statement>
          <!-- ... more Statement values allowed here ... -->
        </Statements>
      </Hazmat>
      <Manufacturer>
        <CityName>string</CityName>
        <CompanyName>string</CompanyName>
        <ContactURL>string</ContactURL>
        <Country></Country>
        <Email>string</Email>
        <Phone>string</Phone>
        <PostalCode>string</PostalCode>
        <StateOrProvince>string</StateOrProvince>
        <Street1>string</Street1>
        <Street2>string</Street2>
      </Manufacturer>
      <ProductSafety>
        <Component>string</Component>
        <Pictograms>
          <Pictogram>string</Pictogram>
          <!-- ... more Pictogram values allowed here ... -->
        </Pictograms>
        <Statements>
          <Statement>string</Statement>
          <!-- ... more Statement values allowed here ... -->
        </Statements>
      </ProductSafety>
      <RepairScore>double</RepairScore>
      <ResponsiblePersons>
        <ResponsiblePerson>
          <CityName>string</CityName>
          <CompanyName>string</CompanyName>
          <ContactURL>string</ContactURL>
          <Country></Country>
          <Email>string</Email>
          <Phone>string</Phone>
          <PostalCode>string</PostalCode>
          <StateOrProvince>string</StateOrProvince>
          <Street1>string</Street1>
          <Street2>string</Street2>
          <Types>ResponsiblePersonCodeTypes<Type></Type>
          <!-- ... more Type values allowed here ... -->
        </Types>
      </ResponsiblePerson>
      <!-- ... more ResponsiblePerson nodes allowed here ... -->
    </ResponsiblePersons>
  </Regulatory>
  <ReservePrice currencyID="CurrencyCodeType">
  </ReservePrice>
  <ReturnPolicy>
    <Description>string</Description>
    <InternationalRefundOption>token</InternationalRefundOption>
    <InternationalReturnsAcceptedOption>token</InternationalReturnsAcceptedOption>
    <InternationalReturnsWithinOption>token</InternationalReturnsWithinOption>
    <InternationalShippingCostPaidByOption>token</InternationalShippingCostPaidByOption>
    <RefundOption>token</RefundOption>
    <ReturnsAcceptedOption>token</ReturnsAcceptedOption>
    <ReturnsWithinOption>token</ReturnsWithinOption>
    <ShippingCostPaidByOption>token</ShippingCostPaidByOption>
  </ReturnPolicy>
  <ScheduleTime>dateTime</ScheduleTime>
  <SecondaryCategory>
    <CategoryID>string</CategoryID>
  </SecondaryCategory>
  <SellerContactDetails>
    <CompanyName>string</CompanyName>
    <County>string</County>
    <PhoneAreaOrCityCode>string</PhoneAreaOrCityCode>
    <PhoneCountryCode></PhoneCountryCode>
    <PhoneLocalNumber>string</PhoneLocalNumber>
    <Street>string</Street>
    <Street2>string</Street2>
  </SellerContactDetails>
  <SellerProfiles>
    <SellerPaymentProfile>
      <PaymentProfileID>long</PaymentProfileID>
      <PaymentProfileName>string</PaymentProfileName>
    </SellerPaymentProfile>
    <SellerReturnProfile>
      <ReturnProfileID>long</ReturnProfileID>
      <ReturnProfileName>string</ReturnProfileName>
    </SellerReturnProfile>
    <SellerShippingProfile>
      <ShippingProfileID>long</ShippingProfileID>
      <ShippingProfileName>string</ShippingProfileName>
    </SellerShippingProfile>
  </SellerProfiles>
  <SellerProvidedTitle>string</SellerProvidedTitle>
  <ShippingDetails>
    <CalculatedShippingRate>
      <InternationalPackagingHandlingCosts currencyID="CurrencyCodeType">
      </InternationalPackagingHandlingCosts>
      <PackagingHandlingCosts currencyID="CurrencyCodeType">
      </PackagingHandlingCosts>
    </CalculatedShippingRate>
    <ExcludeShipToLocation>string</ExcludeShipToLocation>
    <!-- ... more ExcludeShipToLocation values allowed here ... -->
    <GlobalShipping>boolean</GlobalShipping>
    <InternationalPromotionalShippingDiscount>boolean</InternationalPromotionalShippingDiscount>
    <InternationalShippingDiscountProfileID>string</InternationalShippingDiscountProfileID>
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
    <PromotionalShippingDiscount>boolean</PromotionalShippingDiscount>
    <RateTableDetails>
      <DomesticRateTable>string</DomesticRateTable>
      <DomesticRateTableId>string</DomesticRateTableId>
      <InternationalRateTable>string</InternationalRateTable>
      <InternationalRateTableId>string</InternationalRateTableId>
    </RateTableDetails>
    <SalesTax>
      <SalesTaxPercent>float</SalesTaxPercent>
      <SalesTaxState>string</SalesTaxState>
      <ShippingIncludedInTax>boolean</ShippingIncludedInTax>
    </SalesTax>
    <ShippingDiscountProfileID>string</ShippingDiscountProfileID>
    <ShippingServiceOptions>
      <FreeShipping>boolean</FreeShipping>
      <ShippingService>token</ShippingService>
      <ShippingServiceAdditionalCost currencyID="CurrencyCodeType">
      </ShippingServiceAdditionalCost>
      <ShippingServiceCost currencyID="CurrencyCodeType">
      </ShippingServiceCost>
      <ShippingServicePriority>int</ShippingServicePriority>
    </ShippingServiceOptions>
    <!-- ... more ShippingServiceOptions nodes allowed here ... -->
    <ShippingType></ShippingType>
  </ShippingDetails>
  <ShippingPackageDetails>
    <MeasurementUnit></MeasurementUnit>
    <PackageDepth></PackageDepth>
    <PackageLength></PackageLength>
    <PackageWidth></PackageWidth>
    <ShippingIrregular>boolean</ShippingIrregular>
    <ShippingPackage></ShippingPackage>
    <WeightMajor></WeightMajor>
    <WeightMinor></WeightMinor>
  </ShippingPackageDetails>
  <ShippingServiceCostOverrideList>
    <ShippingServiceCostOverride>
      <ShippingServiceAdditionalCost currencyID="CurrencyCodeType">
      </ShippingServiceAdditionalCost>
      <ShippingServiceCost currencyID="CurrencyCodeType">
      </ShippingServiceCost>
      <ShippingServicePriority>int</ShippingServicePriority>
      <ShippingServiceType></ShippingServiceType>
    </ShippingServiceCostOverride>
    <!-- ... more ShippingServiceCostOverride nodes allowed here ... -->
  </ShippingServiceCostOverrideList>
  <ShipToLocations>string</ShipToLocations>
  <!-- ... more ShipToLocations values allowed here ... -->
  <Site></Site>
  <SKU></SKU>
  <StartPrice currencyID="CurrencyCodeType">
  </StartPrice>
  <Storefront>
    <StoreCategory2ID>long</StoreCategory2ID>
    <StoreCategory2Name>string</StoreCategory2Name>
    <StoreCategoryID>long</StoreCategoryID>
    <StoreCategoryName>string</StoreCategoryName>
  </Storefront>
  <SubTitle>string</SubTitle>
  <TaxCategory>string</TaxCategory>
  <Title>string</Title>
  <UseTaxTable>boolean</UseTaxTable>
  <UUID></UUID>
  <VATDetails>
    <BusinessSeller>boolean</BusinessSeller>
    <RestrictedToBusiness>boolean</RestrictedToBusiness>
    <VATPercent>float</VATPercent>
  </VATDetails>
  <VideoDetails>
    <VideoID>string</VideoID>
    <!-- ... more VideoID values allowed here ... -->
  </VideoDetails>
  <VIN>string</VIN>
  <VRM>string</VRM>
</Item>
<!-- Standard Input Fields -->
<ErrorHandling></ErrorHandling>
<ErrorLanguage>string</ErrorLanguage>
<MessageID>string</MessageID>
<Version>string</Version>
<WarningLevel></WarningLevel>
</VerifyAddItemRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| Item | ItemType | Yes | Root container holding all values that define a new listing. |

#### Optional Fields

| Field Path | Type | Default | Description | Constraints |
|------------|------|---------|-------------|-------------|
| None | - | - | No optional fields were identified in the extracted source. | - |

#### Conditional Fields

| Field Path | Type | Condition | Description |
|------------|------|-----------|-------------|
| None | - | - | No conditional request fields were identified in the extracted source. |

## Response Structure

### XML Schema

```xml
<?xml version="1.0" encoding="utf-8"?>
<VerifyAddItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <Category2ID>string</Category2ID>
  <CategoryID>string</CategoryID>
  <DiscountReason></DiscountReason>
  <!-- ... more DiscountReason values allowed here ... -->
  <Fees>
    <Fee>
      <Fee currencyID="CurrencyCodeType">
      </Fee>
      <Name>string</Name>
      <PromotionalDiscount currencyID="CurrencyCodeType">
      </PromotionalDiscount>
    </Fee>
    <!-- ... more Fee nodes allowed here ... -->
  </Fees>
  <ItemID></ItemID>
  <ProductSuggestions>
    <ProductSuggestion>
      <EPID>string</EPID>
      <Recommended>boolean</Recommended>
      <StockPhoto>string</StockPhoto>
      <Title>string</Title>
    </ProductSuggestion>
    <!-- ... more ProductSuggestion nodes allowed here ... -->
  </ProductSuggestions>
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
    <UserDisplayHint>boolean</UserDisplayHint>
  </Errors>
  <!-- ... more Errors nodes allowed here ... -->
  <HardExpirationWarning>string</HardExpirationWarning>
  <Message>string</Message>
  <Timestamp>dateTime</Timestamp>
  <Version>string</Version>
</VerifyAddItemResponse>
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
| ItemID | ItemIDType | Always | With a successful VerifyAddItem call, this field is always returned, but the returned value is always 0 , since this call only validates the data passed in through the request payload and does not actually create an active listing. |
| Fees | FeesType | Always | This container is an array of fees that would incur if the listing defined in request payload of the VerifyAddItem call was published. The fees in this container will not include any fees that are based on the purchase price (such as transaction fees) and only come into play when the listing has a sale. All listing fee types are returned, even if those fees are not applicable for the listing and are '0.0'. Note: The currency used for all fees returned under the Fees container reflects the currency used for the listing site, and not necessarily in the seller's default/home currency. For example, if a Canadian seller is using the VerifyAddItem call to verify a listing on the eBay US site, the currency type shown for each fee will be USD and not CAD . |
| CategoryID | string | Conditionally | ID of the primary category in which the item would be listed. Only returned if you set Item.CategoryMappingAllowed to true in the request and the ID you passed in PrimaryCategory was mapped to a new ID by eBay. If the primary category has not changed or it has expired with no replacement, CategoryID does not return a value. |
| Category2ID | string | Conditionally | ID of the secondary category in which the item would be listed. Only returned if you set Item.CategoryMappingAllowed to true in the request and the ID you passed in SecondaryCategory was mapped to a new ID by eBay. If the secondary category has not changed or it has expired with no replacement, Category2ID does not return a value. |
| DiscountReason | DiscountReasonCodeType | Conditionally | The nature of the discount, if a discount would have applied had this actually been listed at this time. |
| ProductSuggestions | ProductSuggestionsType | Conditionally | Provides a list of products recommended by eBay which match the item information provided by the seller. |

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

### VerifyAddItemRequestType

**Description:** Enables a seller to specify the definition of a new item and submit the definition to eBay without creating a listing. Sellers who engage in cross-border trade on sites that require a recoupment agreement, must agree to the recoupment terms before adding or verifying items. This agreement allows eBay to reimburse a buyer during a dispute and then recoup the cost from the seller. The US site is a recoupment site, and the agreement is located here . The list of the sites where a user has agreed to the recoupment terms is returned by the GetUser response.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| Item | ItemType | [0..1] | Root container holding all values that define a new listing. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<VerifyAddItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <Item>
    <ApplicationData>string</ApplicationData>
    <AutoPay>boolean</AutoPay>
    <BestOfferDetails>
      <BestOfferEnabled>boolean</BestOfferEnabled>
    </BestOfferDetails>
    <BuyerResponsibleForShipping>boolean</BuyerResponsibleForShipping>
    <BuyItNowPrice currencyID="CurrencyCodeType">
    </BuyItNowPrice>
    <CategoryMappingAllowed>boolean</CategoryMappingAllowed>
    <Charity>
      <CharityID>string</CharityID>
      <DonationPercent>float</DonationPercent>
    </Charity>
    <ConditionDescription>string</ConditionDescription>
    <ConditionDescriptors>
      <ConditionDescriptor>
        <AdditionalInfo>string</AdditionalInfo>
        <Name>string</Name>
        <Value>string</Value>
        <!-- ... more Value values allowed here ... -->
      </ConditionDescriptor>
      <!-- ... more ConditionDescriptor nodes allowed here ... -->
    </ConditionDescriptors>
    <ConditionID>int</ConditionID>
    <Country></Country>
    <CrossBorderTrade>string</CrossBorderTrade>
    <!-- ... more CrossBorderTrade values allowed here ... -->
    <Currency></Currency>
    <CustomPolicies>
      <ProductCompliancePolicyID>long</ProductCompliancePolicyID>
      <!-- ... more ProductCompliancePolicyID values allowed here ... -->
      <RegionalProductCompliancePolicies>
        <CountryPolicies>
          <Country></Country>
          <PolicyID>long</PolicyID>
          <!-- ... more PolicyID values allowed here ... -->
        </CountryPolicies>
        <!-- ... more CountryPolicies nodes allowed here ... -->
      </RegionalProductCompliancePolicies>
      <RegionalTakeBackPolicies>
        <CountryPolicies>
          <Country></Country>
          <PolicyID>long</PolicyID>
          <!-- ... more PolicyID values allowed here ... -->
        </CountryPolicies>
        <!-- ... more CountryPolicies nodes allowed here ... -->
      </RegionalTakeBackPolicies>
      <TakeBackPolicyID>long</TakeBackPolicyID>
    </CustomPolicies>
    <Description>string</Description>
    <DigitalGoodInfo>
      <DigitalDelivery>boolean</DigitalDelivery>
    </DigitalGoodInfo>
    <DisableBuyerRequirements>boolean</DisableBuyerRequirements>
    <DiscountPriceInfo>
      <MadeForOutletComparisonPrice currencyID="CurrencyCodeType">
      </MadeForOutletComparisonPrice>
      <MinimumAdvertisedPrice currencyID="CurrencyCodeType">
      </MinimumAdvertisedPrice>
      <MinimumAdvertisedPriceExposure></MinimumAdvertisedPriceExposure>
      <OriginalRetailPrice currencyID="CurrencyCodeType">
      </OriginalRetailPrice>
      <SoldOffeBay>boolean</SoldOffeBay>
      <SoldOneBay>boolean</SoldOneBay>
    </DiscountPriceInfo>
    <DispatchTimeMax>int</DispatchTimeMax>
    <eBayPlus>boolean</eBayPlus>
    <ExtendedProducerResponsibility>
      <EcoParticipationFee currencyID="CurrencyCodeType">
      </EcoParticipationFee>
    </ExtendedProducerResponsibility>
    <ExtendedSellerContactDetails>
      <ClassifiedAdContactByEmailEnabled>boolean</ClassifiedAdContactByEmailEnabled>
      <ContactHoursDetails>
        <Hours1AnyTime>boolean</Hours1AnyTime>
        <Hours1Days></Hours1Days>
        <Hours1From>time</Hours1From>
        <Hours1To>time</Hours1To>
        <Hours2AnyTime>boolean</Hours2AnyTime>
        <Hours2Days></Hours2Days>
        <Hours2From>time</Hours2From>
        <Hours2To>time</Hours2To>
        <TimeZoneID>string</TimeZoneID>
      </ContactHoursDetails>
    </ExtendedSellerContactDetails>
    <ItemCompatibilityList>
      <Compatibility>
        <CompatibilityNotes>string</CompatibilityNotes>
        <NameValueList>
          <Name>string</Name>
          <Value>string</Value>
          <!-- ... more Value values allowed here ... -->
        </NameValueList>
        <!-- ... more NameValueList nodes allowed here ... -->
      </Compatibility>
      <!-- ... more Compatibility nodes allowed here ... -->
    </ItemCompatibilityList>
    <ItemSpecifics>
      <NameValueList>
        <Name>string</Name>
        <Value>string</Value>
        <!-- ... more Value values allowed here ... -->
      </NameValueList>
      <!-- ... more NameValueList nodes allowed here ... -->
    </ItemSpecifics>
    <ListingDetails>
      <BestOfferAutoAcceptPrice currencyID="CurrencyCodeType">
      </BestOfferAutoAcceptPrice>
      <MinimumBestOfferPrice currencyID="CurrencyCodeType">
      </MinimumBestOfferPrice>
    </ListingDetails>
    <ListingDuration>token</ListingDuration>
    <ListingEnhancement></ListingEnhancement>
    <!-- ... more ListingEnhancement values allowed here ... -->
    <ListingType></ListingType>
    <Location>string</Location>
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
    <PickupInStoreDetails>
      <EligibleForPickupInStore>boolean</EligibleForPickupInStore>
    </PickupInStoreDetails>
    <PictureDetails>
      <GalleryType></GalleryType>
      <PictureURL>anyURI</PictureURL>
      <!-- ... more PictureURL values allowed here ... -->
    </PictureDetails>
    <PostalCode>string</PostalCode>
    <PrimaryCategory>
      <CategoryID>string</CategoryID>
    </PrimaryCategory>
    <PrivateListing>boolean</PrivateListing>
    <PrivateNotes>string</PrivateNotes>
    <ProductListingDetails>
      <BrandMPN>
        <Brand>string</Brand>
        <MPN>string</MPN>
      </BrandMPN>
      <EAN>string</EAN>
      <IncludeeBayProductDetails>boolean</IncludeeBayProductDetails>
      <IncludeStockPhotoURL>boolean</IncludeStockPhotoURL>
      <ISBN>string</ISBN>
      <ProductReferenceID>string</ProductReferenceID>
      <ReturnSearchResultOnDuplicates>boolean</ReturnSearchResultOnDuplicates>
      <UPC>string</UPC>
      <UseFirstProduct>boolean</UseFirstProduct>
      <UseStockPhotoURLAsGallery>boolean</UseStockPhotoURLAsGallery>
    </ProductListingDetails>
    <Quantity>int</Quantity>
    <QuantityRestrictionPerBuyer>
      <MaximumQuantity>int</MaximumQuantity>
    </QuantityRestrictionPerBuyer>
    <Regulatory>
      <Documents>
        <Document>
          <DocumentID>string</DocumentID>
        </Document>
        <!-- ... more Document nodes allowed here ... -->
      </Documents>
      <EnergyEfficiencyLabel>
        <ImageDescription>string</ImageDescription>
        <ImageURL>anyURI</ImageURL>
        <ProductInformationsheet>anyURI</ProductInformationsheet>
      </EnergyEfficiencyLabel>
      <Hazmat>
        <Component>string</Component>
        <Pictograms>
          <Pictogram>string</Pictogram>
          <!-- ... more Pictogram values allowed here ... -->
        </Pictograms>
        <SignalWord>string</SignalWord>
        <Statements>
          <Statement>string</Statement>
          <!-- ... more Statement values allowed here ... -->
        </Statements>
      </Hazmat>
      <Manufacturer>
        <CityName>string</CityName>
        <CompanyName>string</CompanyName>
        <ContactURL>string</ContactURL>
        <Country></Country>
        <Email>string</Email>
        <Phone>string</Phone>
        <PostalCode>string</PostalCode>
        <StateOrProvince>string</StateOrProvince>
        <Street1>string</Street1>
        <Street2>string</Street2>
      </Manufacturer>
      <ProductSafety>
        <Component>string</Component>
        <Pictograms>
          <Pictogram>string</Pictogram>
          <!-- ... more Pictogram values allowed here ... -->
        </Pictograms>
        <Statements>
          <Statement>string</Statement>
          <!-- ... more Statement values allowed here ... -->
        </Statements>
      </ProductSafety>
      <RepairScore>double</RepairScore>
      <ResponsiblePersons>
        <ResponsiblePerson>
          <CityName>string</CityName>
          <CompanyName>string</CompanyName>
          <ContactURL>string</ContactURL>
          <Country></Country>
          <Email>string</Email>
          <Phone>string</Phone>
          <PostalCode>string</PostalCode>
          <StateOrProvince>string</StateOrProvince>
          <Street1>string</Street1>
          <Street2>string</Street2>
          <Types>ResponsiblePersonCodeTypes<Type></Type>
          <!-- ... more Type values allowed here ... -->
        </Types>
      </ResponsiblePerson>
      <!-- ... more ResponsiblePerson nodes allowed here ... -->
    </ResponsiblePersons>
  </Regulatory>
  <ReservePrice currencyID="CurrencyCodeType">
  </ReservePrice>
  <ReturnPolicy>
    <Description>string</Description>
    <InternationalRefundOption>token</InternationalRefundOption>
    <InternationalReturnsAcceptedOption>token</InternationalReturnsAcceptedOption>
    <InternationalReturnsWithinOption>token</InternationalReturnsWithinOption>
    <InternationalShippingCostPaidByOption>token</InternationalShippingCostPaidByOption>
    <RefundOption>token</RefundOption>
    <ReturnsAcceptedOption>token</ReturnsAcceptedOption>
    <ReturnsWithinOption>token</ReturnsWithinOption>
    <ShippingCostPaidByOption>token</ShippingCostPaidByOption>
  </ReturnPolicy>
  <ScheduleTime>dateTime</ScheduleTime>
  <SecondaryCategory>
    <CategoryID>string</CategoryID>
  </SecondaryCategory>
  <SellerContactDetails>
    <CompanyName>string</CompanyName>
    <County>string</County>
    <PhoneAreaOrCityCode>string</PhoneAreaOrCityCode>
    <PhoneCountryCode></PhoneCountryCode>
    <PhoneLocalNumber>string</PhoneLocalNumber>
    <Street>string</Street>
    <Street2>string</Street2>
  </SellerContactDetails>
  <SellerProfiles>
    <SellerPaymentProfile>
      <PaymentProfileID>long</PaymentProfileID>
      <PaymentProfileName>string</PaymentProfileName>
    </SellerPaymentProfile>
    <SellerReturnProfile>
      <ReturnProfileID>long</ReturnProfileID>
      <ReturnProfileName>string</ReturnProfileName>
    </SellerReturnProfile>
    <SellerShippingProfile>
      <ShippingProfileID>long</ShippingProfileID>
      <ShippingProfileName>string</ShippingProfileName>
    </SellerShippingProfile>
  </SellerProfiles>
  <SellerProvidedTitle>string</SellerProvidedTitle>
  <ShippingDetails>
    <CalculatedShippingRate>
      <InternationalPackagingHandlingCosts currencyID="CurrencyCodeType">
      </InternationalPackagingHandlingCosts>
      <PackagingHandlingCosts currencyID="CurrencyCodeType">
      </PackagingHandlingCosts>
    </CalculatedShippingRate>
    <ExcludeShipToLocation>string</ExcludeShipToLocation>
    <!-- ... more ExcludeShipToLocation values allowed here ... -->
    <GlobalShipping>boolean</GlobalShipping>
    <InternationalPromotionalShippingDiscount>boolean</InternationalPromotionalShippingDiscount>
    <InternationalShippingDiscountProfileID>string</InternationalShippingDiscountProfileID>
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
    <PromotionalShippingDiscount>boolean</PromotionalShippingDiscount>
    <RateTableDetails>
      <DomesticRateTable>string</DomesticRateTable>
      <DomesticRateTableId>string</DomesticRateTableId>
      <InternationalRateTable>string</InternationalRateTable>
      <InternationalRateTableId>string</InternationalRateTableId>
    </RateTableDetails>
    <SalesTax>
      <SalesTaxPercent>float</SalesTaxPercent>
      <SalesTaxState>string</SalesTaxState>
      <ShippingIncludedInTax>boolean</ShippingIncludedInTax>
    </SalesTax>
    <ShippingDiscountProfileID>string</ShippingDiscountProfileID>
    <ShippingServiceOptions>
      <FreeShipping>boolean</FreeShipping>
      <ShippingService>token</ShippingService>
      <ShippingServiceAdditionalCost currencyID="CurrencyCodeType">
      </ShippingServiceAdditionalCost>
      <ShippingServiceCost currencyID="CurrencyCodeType">
      </ShippingServiceCost>
      <ShippingServicePriority>int</ShippingServicePriority>
    </ShippingServiceOptions>
    <!-- ... more ShippingServiceOptions nodes allowed here ... -->
    <ShippingType></ShippingType>
  </ShippingDetails>
  <ShippingPackageDetails>
    <MeasurementUnit></MeasurementUnit>
    <PackageDepth></PackageDepth>
    <PackageLength></PackageLength>
    <PackageWidth></PackageWidth>
    <ShippingIrregular>boolean</ShippingIrregular>
    <ShippingPackage></ShippingPackage>
    <WeightMajor></WeightMajor>
    <WeightMinor></WeightMinor>
  </ShippingPackageDetails>
  <ShippingServiceCostOverrideList>
    <ShippingServiceCostOverride>
      <ShippingServiceAdditionalCost currencyID="CurrencyCodeType">
      </ShippingServiceAdditionalCost>
      <ShippingServiceCost currencyID="CurrencyCodeType">
      </ShippingServiceCost>
      <ShippingServicePriority>int</ShippingServicePriority>
      <ShippingServiceType></ShippingServiceType>
    </ShippingServiceCostOverride>
    <!-- ... more ShippingServiceCostOverride nodes allowed here ... -->
  </ShippingServiceCostOverrideList>
  <ShipToLocations>string</ShipToLocations>
  <!-- ... more ShipToLocations values allowed here ... -->
  <Site></Site>
  <SKU></SKU>
  <StartPrice currencyID="CurrencyCodeType">
  </StartPrice>
  <Storefront>
    <StoreCategory2ID>long</StoreCategory2ID>
    <StoreCategory2Name>string</StoreCategory2Name>
    <StoreCategoryID>long</StoreCategoryID>
    <StoreCategoryName>string</StoreCategoryName>
  </Storefront>
  <SubTitle>string</SubTitle>
  <TaxCategory>string</TaxCategory>
  <Title>string</Title>
  <UseTaxTable>boolean</UseTaxTable>
  <UUID></UUID>
  <VATDetails>
    <BusinessSeller>boolean</BusinessSeller>
    <RestrictedToBusiness>boolean</RestrictedToBusiness>
    <VATPercent>float</VATPercent>
  </VATDetails>
  <VideoDetails>
    <VideoID>string</VideoID>
    <!-- ... more VideoID values allowed here ... -->
  </VideoDetails>
  <VIN>string</VIN>
  <VRM>string</VRM>
</Item>
<!-- Standard Input Fields -->
<ErrorHandling></ErrorHandling>
<ErrorLanguage>string</ErrorLanguage>
<MessageID>string</MessageID>
<Version>string</Version>
<WarningLevel></WarningLevel>
</VerifyAddItemRequest>
```

### VerifyAddItemResponseType

**Description:** Returns the listing recommendations (if applicable), the estimated fees for the proposed new listing (except the transaction fees, which aren't calculated until the item has sold), and other details.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| ItemID | ItemIDType | [0..1] | With a successful VerifyAddItem call, this field is always returned, but the returned value is always 0 , since this call only validates the data passed in through the request payload and does not actually create an active listing. |
| Fees | FeesType | [0..1] | This container is an array of fees that would incur if the listing defined in request payload of the VerifyAddItem call was published. The fees in this container will not include any fees that are based on the purchase price (such as transaction fees) and only come into play when the listing has a sale. All listing fee types are returned, even if those fees are not applicable for the listing and are '0.0'. Note: The currency used for all fees returned under the Fees container reflects the currency used for the listing site, and not necessarily in the seller's default/home currency. For example, if a Canadian seller is using the VerifyAddItem call to verify a listing on the eBay US site, the currency type shown for each fee will be USD and not CAD . |
| CategoryID | string | [0..1] | ID of the primary category in which the item would be listed. Only returned if you set Item.CategoryMappingAllowed to true in the request and the ID you passed in PrimaryCategory was mapped to a new ID by eBay. If the primary category has not changed or it has expired with no replacement, CategoryID does not return a value. |
| Category2ID | string | [0..1] | ID of the secondary category in which the item would be listed. Only returned if you set Item.CategoryMappingAllowed to true in the request and the ID you passed in SecondaryCategory was mapped to a new ID by eBay. If the secondary category has not changed or it has expired with no replacement, Category2ID does not return a value. |
| DiscountReason | DiscountReasonCodeType | [0..unbounded] | The nature of the discount, if a discount would have applied had this actually been listed at this time. |
| ProductSuggestions | ProductSuggestionsType | [0..1] | Provides a list of products recommended by eBay which match the item information provided by the seller. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<VerifyAddItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <Category2ID>string</Category2ID>
  <CategoryID>string</CategoryID>
  <DiscountReason></DiscountReason>
  <!-- ... more DiscountReason values allowed here ... -->
  <Fees>
    <Fee>
      <Fee currencyID="CurrencyCodeType">
      </Fee>
      <Name>string</Name>
      <PromotionalDiscount currencyID="CurrencyCodeType">
      </PromotionalDiscount>
    </Fee>
    <!-- ... more Fee nodes allowed here ... -->
  </Fees>
  <ItemID></ItemID>
  <ProductSuggestions>
    <ProductSuggestion>
      <EPID>string</EPID>
      <Recommended>boolean</Recommended>
      <StockPhoto>string</StockPhoto>
      <Title>string</Title>
    </ProductSuggestion>
    <!-- ... more ProductSuggestion nodes allowed here ... -->
  </ProductSuggestions>
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
    <UserDisplayHint>boolean</UserDisplayHint>
  </Errors>
  <!-- ... more Errors nodes allowed here ... -->
  <HardExpirationWarning>string</HardExpirationWarning>
  <Message>string</Message>
  <Timestamp>dateTime</Timestamp>
  <Version>string</Version>
</VerifyAddItemResponse>
```

---

## Enumerations

Not specified in source

---

## Error Codes

| Error Code | Short Message | Description | Resolution |
|------------|---------------|-------------|------------|
| 21919144 | Rate limit exceeded | Users who exceed Add-call frequency limits are temporarily blocked from listing. | Retry after the temporary block clears and reduce Add-call burst traffic. |

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

1. **Verification only**
   - Description: VerifyAddItem validates request data but does not create a live listing.
   - Applies when: For every VerifyAddItem call.
   - Impact: Returned ItemID is 0 on success.

2. **Verification is not identical to AddItem**
   - Description: Some AddItem business-logic checks are not executed during VerifyAddItem.
   - Applies when: When using VerifyAddItem as a preflight step.
   - Impact: A successful verification does not guarantee AddItem will succeed.

3. **Cross-border recoupment agreement may apply**
   - Description: Sellers on sites requiring a recoupment agreement must accept those terms before adding or verifying items.
   - Applies when: When verifying listings on recoupment sites.
   - Impact: Verification can be blocked until the agreement is accepted.

### Revision Restrictions (If applicable)

| Condition | Allowed Changes | Prohibited Changes |
|-----------|-----------------|-------------------|
| Source does not provide a separate revision-restrictions table for this call | See operation-level rules and field descriptions | Not specified in source |

---

## Rate Limits & Throttling

| Metric | Limit | Window | Notes |
|--------|-------|--------|-------|
| API Calls | Not specified in source | Not specified in source | No long-window quota is explicitly provided in the extracted source. |
| Frequency | Users who exceed Add-call frequency limits may be temporarily blocked and may receive ErrorCode 21919144. | Not specified in source | Users who exceed Add-call frequency limits may be temporarily blocked and may receive ErrorCode 21919144. |

**Throttling Behavior:**
Users who exceed Add-call frequency limits may be temporarily blocked and may receive ErrorCode 21919144.

---

## Best Practices

1. **Use as a preflight step**
   - VerifyAddItem helps catch listing-definition issues before a real AddItem call.

2. **Do not assume perfect parity with AddItem**
   - A successful verification can still be followed by AddItem failure because some business logic is only checked on AddItem.

3. **Use VerifyAddFixedPriceItem for variation listings**
   - Variation-capable fixed-price listings belong on the fixed-price verification path.

4. **Monitor Add-call frequency**
   - Verification calls still participate in the Add-call family limits.

---

## Migration Path

### New API Equivalent

| SOAP Operation | New API | Type |
|----------------|---------|------|
| VerifyAddItem | Listing API createListing | Mutation |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_verifyadditem_html.jsonl`; `.trace_artifacts/extract_wsdl_verifyadditem.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
