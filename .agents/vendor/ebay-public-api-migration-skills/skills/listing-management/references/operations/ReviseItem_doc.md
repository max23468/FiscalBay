# ReviseItem - Traditional API (SOAP)

> **Call Name:** ReviseItem
> **API Type:** SOAP XML traditional API
> **API Version:** Not specified in source
> **Service:** Traditional

---

## Metadata

| Property | Value |
|----------|-------|
| **Call Type** | Core |
| **Deprecated** | No |
| **Replacement** | updateListing mutation of the Listing API |
| **Rate Limit** | Any eBay listing can be revised up to 250 times in one calendar day using ReviseItem and ReviseFixedPriceItem. |
| **Supported Sites** | Not specified in source |

---

## Description

Note: Any eBay listing can be revised up to 250 times in one calendar day using ReviseFixedPriceItem and ReviseItem calls. If this revision threshold is reached, the seller will be blocked from using these calls on the listing until the next calendar day.

**Purpose:**
Note: Any eBay listing can be revised up to 250 times in one calendar day using ReviseFixedPriceItem and ReviseItem calls. If this revision threshold is reached, the seller will be blocked from using these calls on the listing until the next calendar day. Note: An active listing that was created with the new Inventory model (using the Inventory API or Merchant Integration Platform) cannot be revised using the ReviseFixedPriceItem , ReviseItem , or ReviseInventoryStatus calls.

**Use Cases:**
- Revise properties of a currently active listing.
- Delete optional listing settings with DeletedField while revising an active item.
- Estimate fees and recommendations without revising by using VerifyOnly.

**Important Notes:**
- A listing can be revised up to 250 times in one calendar day using ReviseItem and ReviseFixedPriceItem.
- Listings created with the Inventory API or Merchant Integration Platform must be revised with those modern inventory tools instead.
- Only active listings can be revised; ended listings can not.
- ReviseItem does not support multiple-variation listing revisions.

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
X-EBAY-API-CALL-NAME: ReviseItem
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
<ReviseItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <DeletedField>string</DeletedField>
  <!-- ... more DeletedField values allowed here ... -->
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
    <CeilingPrice currencyID="CurrencyCodeType">
    </CeilingPrice>
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
    <DescriptionReviseMode></DescriptionReviseMode>
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
    <FloorPrice currencyID="CurrencyCodeType">
    </FloorPrice>
    <ItemCompatibilityList>
      <Compatibility>
        <CompatibilityNotes>string</CompatibilityNotes>
        <Delete>boolean</Delete>
        <NameValueList>
          <Name>string</Name>
          <Value>string</Value>
          <!-- ... more Value values allowed here ... -->
        </NameValueList>
        <!-- ... more NameValueList nodes allowed here ... -->
      </Compatibility>
      <!-- ... more Compatibility nodes allowed here ... -->
      <ReplaceAll>boolean</ReplaceAll>
    </ItemCompatibilityList>
    <ItemID></ItemID>
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
    <ListingSubtype2></ListingSubtype2>
    <Location>string</Location>
    <LotSize>int</LotSize>
    <MappingReferenceId>string</MappingReferenceId>
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
<VerifyOnly>boolean</VerifyOnly>
<!-- Standard Input Fields -->
<ErrorHandling></ErrorHandling>
<ErrorLanguage>string</ErrorLanguage>
<InvocationID></InvocationID>
<MessageID>string</MessageID>
<Version>string</Version>
<WarningLevel></WarningLevel>
</ReviseItemRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| Item | ItemType | Yes | The Item container is used to make changes to the active listing. The seller must pass in the ItemID value for the listing that is being revised. For anything else that the seller wishes to change, such as quantity or price, the seller should include this field in the call request and give it a new value. If the seller wants to delete one or more optional settings in the listing, the seller should use the DeletedField tag. |

#### Optional Fields

| Field Path | Type | Default | Description | Constraints |
|------------|------|---------|-------------|-------------|
| VerifyOnly | boolean | Not specified in source | When the VerifyOnly is included and set as true , the active listing is not actually revised, but the same response is returned and the seller gets to see the expected fees based on the changes made, and can also view any listing recommendations if the Item.IncludeRecommedations boolean field is included and set to true . | Not specified in source |

#### Conditional Fields

| Field Path | Type | Condition | Description |
|------------|------|-----------|-------------|
| DeletedField | string | No | Specifies the name of a field to delete from a listing. The request can contain zero, one, or many instances of DeletedField (one for each field to be deleted). See the relevant field descriptions to determine when to use DeletedField (and potential consequences). You cannot delete required fields from a listing. Some fields are optional when you first list an item (e.g., SecondaryCategory ), but once they are set they cannot be deleted when you revise an item. Some optional fields cannot be deleted if the item has bids and/or ends within 12 hours. Some optional fields cannot be deleted if other fields depend on them. Use values that match the case of the schema element names ( Item.PictureDetails.PictureURL ) or make the initial letter of each field name lowercase ( item.pictureDetails.pictureURL ). However, do not change the case of letters in the middle of a field name. For example, item.picturedetails.pictureURL is not allowed. To delete a listing enhancement like BoldTitle , specify the value you are deleting in square brackets ("[ ]"); for example, Item.ListingEnhancement[BoldTitle] . |

## Response Structure

### XML Schema

```xml
<?xml version="1.0" encoding="utf-8"?>
<ReviseItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <Category2ID>string</Category2ID>
  <CategoryID>string</CategoryID>
  <DiscountReason></DiscountReason>
  <!-- ... more DiscountReason values allowed here ... -->
  <EndTime>dateTime</EndTime>
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
  <StartTime>dateTime</StartTime>
  <VerifyOnly>boolean</VerifyOnly>
  <!-- Standard Output Fields -->
  <Ack></Ack>
  <Build>string</Build>
  <CorrelationID>string</CorrelationID>
  <DuplicateInvocationDetails>
    <DuplicateInvocationID></DuplicateInvocationID>
    <InvocationTrackingID>string</InvocationTrackingID>
    <Status></Status>
  </DuplicateInvocationDetails>
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
</ReviseItemResponse>
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
| ItemID | ItemIDType | Always | The unique identifier for the revised listing. Note that the ItemID value does not change when a listing is revised, so this will be the same ItemID value that was passed in the call request. |
| StartTime | dateTime | Always | This timestamp indicates the date and time when the listing was created on the eBay site. This value doesn't change when a listing is revised. |
| EndTime | dateTime | Always | Date and time when the revised listing is scheduled to end based on the listing's start time and the listing duration value that was set for the listing. If the listing duration is 'GTC' (Good 'Til Cancelled), this value will be updated to one month in the future if the listing is automatically renewed after one month. GTC listings are automatically renewed each month according to the calendar day if quantity still exists for the item. Note: GTC is not applicable to auction listings. |
| Fees | FeesType | Always | This container is an array of fees associated with the revised listing. The fees in this container will not include any fees that are based on the purchase price (such as transaction fees) and only come into play when the listing has a sale. All listing fee types are returned, even if those fees are not applicable for the revised listing and are '0.0'. Note: The currency used for all fees returned under the Fees container reflects the currency used for the listing site, and not necessarily in the seller's default/home currency. For example, if a Canadian seller is using the ReviseItem call to relist an item on the eBay US site, the currency type shown for each fee will be USD and not CAD . |
| CategoryID | string | Conditionally | Unique identifier of the primary eBay category for the revised listing. This field is returned if the primary category was changed with the revision, and the primary category can only be changed if a fixed-price listing has no sales/auction listing has no bids, and the listing does not end within 12 hours. This field can also be returned if the Item.CategoryMappingAllowed field was included and set to true in the request and the category ID passed in the Item.PrimaryCategory field was mapped to a new category ID by eBay. If the primary category has not changed or it has expired with no replacement, this field is not returned. |
| Category2ID | string | Conditionally | Unique identifier of the secondary eBay category for the revised listing. This field is returned if the secondary category was changed with the revision, and the secondary category can only be changed if a fixed-price listing has no sales/auction listing has no bids, and the listing does not end within 12 hours. This field can also be returned if the Item.CategoryMappingAllowed field was included and set to true in the request and the category ID passed in the Item.PrimaryCategory field was mapped to a new category ID by eBay. If the primary category has not changed or it has expired with no replacement, this field is not returned. |
| VerifyOnly | boolean | Conditionally | This field is returned if the VerifyOnly field was included in the call request and set to true . If the listing was revised in 'Verify Only' mode, the active listing is not actually revised, but the same response is returned and the seller gets to see the expected fees based on the changes made, and can also view any listing recommendations if the Item.IncludeRecommedations boolean input field was included and set to true . |
| DiscountReason | DiscountReasonCodeType | Conditionally | This field is returned if an eBay special offer or promotion is applicable to the listing. |
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

### ReviseItemRequestType

**Description:** Enables a seller to revise a listing on a specified eBay site. To revise an active listing, the seller specifies the ItemID value for the listing. The seller makes one or multiple changes to the listing through the Item container, and the seller can also use one or more DeletedField tags to remove an optional field/setting from the listing. After a multiple-quantity, fixed-price listing has one or more sales, or less than 12 hours remain before the listing is scheduled to end, you can not edit the values in the Listing Title, Primary Category, Secondary Category, Listing Duration, and Listing Type fields for that listing. The same applies to an auction listing that has at least one bid. To revise a multiple-variation, fixed-price listing, the ReviseFixedPriceItem call should be used instead, as the ReviseItem call does not support variation-level edits.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| Item | ItemType | [0..1] | The Item container is used to make changes to the active listing. The seller must pass in the ItemID value for the listing that is being revised. For anything else that the seller wishes to change, such as quantity or price, the seller should include this field in the call request and give it a new value. If the seller wants to delete one or more optional settings in the listing, the seller should use the DeletedField tag. |
| DeletedField | string | [0..unbounded] | Specifies the name of a field to delete from a listing. The request can contain zero, one, or many instances of DeletedField (one for each field to be deleted). See the relevant field descriptions to determine when to use DeletedField (and potential consequences). You cannot delete required fields from a listing. Some fields are optional when you first list an item (e.g., SecondaryCategory ), but once they are set they cannot be deleted when you revise an item. Some optional fields cannot be deleted if the item has bids and/or ends within 12 hours. Some optional fields cannot be deleted if other fields depend on them. Use values that match the case of the schema element names ( Item.PictureDetails.PictureURL ) or make the initial letter of each field name lowercase ( item.pictureDetails.pictureURL ). However, do not change the case of letters in the middle of a field name. For example, item.picturedetails.pictureURL is not allowed. To delete a listing enhancement like BoldTitle , specify the value you are deleting in square brackets ("[ ]"); for example, Item.ListingEnhancement[BoldTitle] . |
| VerifyOnly | boolean | [0..1] | When the VerifyOnly is included and set as true , the active listing is not actually revised, but the same response is returned and the seller gets to see the expected fees based on the changes made, and can also view any listing recommendations if the Item.IncludeRecommedations boolean field is included and set to true . |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<ReviseItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <DeletedField>string</DeletedField>
  <!-- ... more DeletedField values allowed here ... -->
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
    <CeilingPrice currencyID="CurrencyCodeType">
    </CeilingPrice>
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
    <DescriptionReviseMode></DescriptionReviseMode>
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
    <FloorPrice currencyID="CurrencyCodeType">
    </FloorPrice>
    <ItemCompatibilityList>
      <Compatibility>
        <CompatibilityNotes>string</CompatibilityNotes>
        <Delete>boolean</Delete>
        <NameValueList>
          <Name>string</Name>
          <Value>string</Value>
          <!-- ... more Value values allowed here ... -->
        </NameValueList>
        <!-- ... more NameValueList nodes allowed here ... -->
      </Compatibility>
      <!-- ... more Compatibility nodes allowed here ... -->
      <ReplaceAll>boolean</ReplaceAll>
    </ItemCompatibilityList>
    <ItemID></ItemID>
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
    <ListingSubtype2></ListingSubtype2>
    <Location>string</Location>
    <LotSize>int</LotSize>
    <MappingReferenceId>string</MappingReferenceId>
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
<VerifyOnly>boolean</VerifyOnly>
<!-- Standard Input Fields -->
<ErrorHandling></ErrorHandling>
<ErrorLanguage>string</ErrorLanguage>
<InvocationID></InvocationID>
<MessageID>string</MessageID>
<Version>string</Version>
<WarningLevel></WarningLevel>
</ReviseItemRequest>
```

### ReviseItemResponseType

**Description:** The base response type for the ReviseItem call. The response includes the Item ID for the revised item, the SKU value for the item (if any), listing recommendations (if applicable), the estimated fees for the revised item (except the transaction fees, which aren't calculated until the item has sold), the start and end times of the listing, and other details.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| ItemID | ItemIDType | [0..1] | The unique identifier for the revised listing. Note that the ItemID value does not change when a listing is revised, so this will be the same ItemID value that was passed in the call request. |
| StartTime | dateTime | [0..1] | This timestamp indicates the date and time when the listing was created on the eBay site. This value doesn't change when a listing is revised. |
| EndTime | dateTime | [0..1] | Date and time when the revised listing is scheduled to end based on the listing's start time and the listing duration value that was set for the listing. If the listing duration is 'GTC' (Good 'Til Cancelled), this value will be updated to one month in the future if the listing is automatically renewed after one month. GTC listings are automatically renewed each month according to the calendar day if quantity still exists for the item. Note: GTC is not applicable to auction listings. |
| Fees | FeesType | [0..1] | This container is an array of fees associated with the revised listing. The fees in this container will not include any fees that are based on the purchase price (such as transaction fees) and only come into play when the listing has a sale. All listing fee types are returned, even if those fees are not applicable for the revised listing and are '0.0'. Note: The currency used for all fees returned under the Fees container reflects the currency used for the listing site, and not necessarily in the seller's default/home currency. For example, if a Canadian seller is using the ReviseItem call to relist an item on the eBay US site, the currency type shown for each fee will be USD and not CAD . |
| CategoryID | string | [0..1] | Unique identifier of the primary eBay category for the revised listing. This field is returned if the primary category was changed with the revision, and the primary category can only be changed if a fixed-price listing has no sales/auction listing has no bids, and the listing does not end within 12 hours. This field can also be returned if the Item.CategoryMappingAllowed field was included and set to true in the request and the category ID passed in the Item.PrimaryCategory field was mapped to a new category ID by eBay. If the primary category has not changed or it has expired with no replacement, this field is not returned. |
| Category2ID | string | [0..1] | Unique identifier of the secondary eBay category for the revised listing. This field is returned if the secondary category was changed with the revision, and the secondary category can only be changed if a fixed-price listing has no sales/auction listing has no bids, and the listing does not end within 12 hours. This field can also be returned if the Item.CategoryMappingAllowed field was included and set to true in the request and the category ID passed in the Item.PrimaryCategory field was mapped to a new category ID by eBay. If the primary category has not changed or it has expired with no replacement, this field is not returned. |
| VerifyOnly | boolean | [0..1] | This field is returned if the VerifyOnly field was included in the call request and set to true . If the listing was revised in 'Verify Only' mode, the active listing is not actually revised, but the same response is returned and the seller gets to see the expected fees based on the changes made, and can also view any listing recommendations if the Item.IncludeRecommedations boolean input field was included and set to true . |
| DiscountReason | DiscountReasonCodeType | [0..unbounded] | This field is returned if an eBay special offer or promotion is applicable to the listing. |
| ProductSuggestions | ProductSuggestionsType | [0..1] | Provides a list of products recommended by eBay which match the item information provided by the seller. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<ReviseItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <Category2ID>string</Category2ID>
  <CategoryID>string</CategoryID>
  <DiscountReason></DiscountReason>
  <!-- ... more DiscountReason values allowed here ... -->
  <EndTime>dateTime</EndTime>
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
  <StartTime>dateTime</StartTime>
  <VerifyOnly>boolean</VerifyOnly>
  <!-- Standard Output Fields -->
  <Ack></Ack>
  <Build>string</Build>
  <CorrelationID>string</CorrelationID>
  <DuplicateInvocationDetails>
    <DuplicateInvocationID></DuplicateInvocationID>
    <InvocationTrackingID>string</InvocationTrackingID>
    <Status></Status>
  </DuplicateInvocationDetails>
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
</ReviseItemResponse>
```

---

## Enumerations

Not specified in source

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

1. **Daily revision threshold applies**
   - Description: Any eBay listing can be revised up to 250 times in one calendar day using ReviseItem and ReviseFixedPriceItem.
   - Applies when: When repeatedly revising the same listing.
   - Impact: Once the threshold is hit, revisions are blocked until the next calendar day.

2. **Ended listings can not be revised**
   - Description: The listing being revised must still be active.
   - Applies when: When calling ReviseItem.
   - Impact: Ended listings require relist flows instead.

3. **Variation edits require ReviseFixedPriceItem**
   - Description: ReviseItem does not support multiple-variation listing revisions.
   - Applies when: When modifying variation listings.
   - Impact: Use ReviseFixedPriceItem instead.

4. **Bids and near-end restrictions apply**
   - Description: Certain fields can not be edited if the item has bids or is within 12 hours of ending.
   - Applies when: When revising auction or sold multi-quantity listings.
   - Impact: Listing title, categories, duration, and type are among restricted fields.

### Revision Restrictions (If applicable)

| Condition | Allowed Changes | Prohibited Changes |
|-----------|-----------------|-------------------|
| Source does not provide a separate revision-restrictions table for this call | See operation-level rules and field descriptions | Not specified in source |

---

## Rate Limits & Throttling

| Metric | Limit | Window | Notes |
|--------|-------|--------|-------|
| API Calls | Not specified in source | Not specified in source | No long-window quota is explicitly provided in the extracted source. |
| Frequency | Any eBay listing can be revised up to 250 times in one calendar day using ReviseItem and ReviseFixedPriceItem. | Not specified in source | Any eBay listing can be revised up to 250 times in one calendar day using ReviseItem and ReviseFixedPriceItem. |

**Throttling Behavior:**
Any eBay listing can be revised up to 250 times in one calendar day using ReviseItem and ReviseFixedPriceItem.

---

## Best Practices

1. **Use VerifyOnly before risky revisions**
   - VerifyOnly lets you preview fees and recommendations without actually revising the listing.

2. **Delete fields carefully**
   - DeletedField has detailed dependency, required-field, and case-sensitivity rules that should be followed exactly.

3. **Use the correct revision path for inventory-model listings**
   - Listings created in the newer Inventory model must be revised with Inventory API or MIP instead of ReviseItem.

4. **Avoid unnecessary revision bursts**
   - Because daily revision thresholds exist, batch or combine listing changes where practical.

---

## Migration Path

### New API Equivalent

| SOAP Operation | New API | Type |
|----------------|---------|------|
| ReviseItem | Listing API updateListing | Mutation |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_reviseitem_html.jsonl`; `.trace_artifacts/extract_wsdl_reviseitem.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
