# RelistItem - Traditional API (SOAP)

> **Call Name:** RelistItem
> **API Type:** SOAP XML traditional API
> **API Version:** 1131
> **Service:** Traditional

---

## Metadata

| Property | Value |
|----------|-------|
| **Call Type** | Core |
| **Deprecated** | No |
| **Replacement** | relistListing mutation of the Listing API |
| **Rate Limit** | Not specified in source |
| **Supported Sites** | Not specified in source |

---

## Description

Use this call to relist a single auction-style item that has ended. The item may be relisted as it was originally defined, or the seller may change a number of the item's listing properties.

**Purpose:**
Use this call to relist a single auction-style item that has ended. The item may be relisted as it was originally defined, or the seller may change a number of the item's listing properties. Note: If the item was being watched when the listing ended, it will continue to be watched when the item is relisted.

**Use Cases:**
- Relist a single auction-style item that has already ended.
- Relist an ended item while changing selected listing properties.
- Remove optional listing settings during relist by using DeletedField entries.

**Important Notes:**
- Only the user who created the original listing can relist it.
- The original listing must have ended, and the relist must occur within 90 days of the original end time.
- If the ended item was on users' Watch Lists, it remains watched after relisting.
- Use RelistFixedPriceItem instead of RelistItem for fixed-price, single multi-item, or multi-variation relists.

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
X-EBAY-API-COMPATIBILITY-LEVEL: 1131
X-EBAY-API-CALL-NAME: RelistItem
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
<RelistItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
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
    <ListingType></ListingType>
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
  <RelistLink>boolean</RelistLink>
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
</RelistItemRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| Item | ItemType | Yes | The Item container is used to configure the item that will be relisted. If the seller plans to relist the item with no changes, the only field under the Item container that is required is the ItemID field. In the ItemID field, the seller specifies the item that will be relisted. If the seller wishes to change anything else for the listing, the seller should include this field in the call request and give it a new value. If the seller wants to delete one or more optional settings in the listing, the seller should use the DeletedField tag. |

#### Optional Fields

| Field Path | Type | Default | Description | Constraints |
|------------|------|---------|-------------|-------------|
| None | - | - | No optional fields were identified in the extracted source. | - |

#### Conditional Fields

| Field Path | Type | Condition | Description |
|------------|------|-----------|-------------|
| DeletedField | string | Conditionally | Specifies the name of the field to delete from a listing. See Relist Items for rules on deleting values when relisting items. Also see the relevant field descriptions to determine when to use DeletedField (and potential consequences). The request can contain zero, one, or many instances of DeletedField (one for each field to be deleted). Case-sensitivity must be taken into account when using a DeletedField tag to delete a field. The value passed into a DeletedField tag must either match the case of the schema element names in the full field path (Item.PictureDetails.PictureURL), or the initial letter of each schema element name in the full field path must be lowercase (item.pictureDetails.pictureURL). Do not change the case of letters in the middle of a field name. For example, item.picturedetails.pictureURL is not allowed. To delete a listing enhancement like 'BoldTitle', specify the value you are deleting; for example, Item.ListingEnhancement[BoldTitle]. |

## Response Structure

### XML Schema

```xml
<?xml version="1.0" encoding="utf-8"?>
<RelistItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
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
</RelistItemResponse>
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
| ItemID | ItemIDType | Always | The unique identifier for the relisted item. Note that the ItemID value changes when a listing is relisted, so this will not be the same ItemID value that was passed in the call request. |
| Fees | FeesType | Always | This container is an array of fees associated with the relisted item. The fees in this container will not include any fees that are based on the purchase price (such as transaction fees) and only come into play when the listing has a sale. All listing fee types are returned, even if those fees are not applicable for the relisted item and are '0.0'. Note: The currency used for all fees returned under the Fees container reflects the currency used for the listing site, and not necessarily in the seller's default/home currency. For example, if a Canadian seller is using the RelistItem call to relist an item on the eBay US site, the currency type shown for each fee will be USD and not CAD . |
| StartTime | dateTime | Always | This timestamp indicates the date and time when the relisted item became active on the eBay site. |
| EndTime | dateTime | Always | This timestamp indicates the date and time when the relisted item is scheduled to end on the eBay site. This date/time is calculated by using the StartTime and the listing duration. GTC listings are automatically renewed each month according to the calendar day. |
| CategoryID | string | Conditionally | Unique identifier of the primary eBay category in which the item was relisted. This field is only returned if the Item.CategoryMappingAllowed field was included and set to true in the request and the category ID passed in the Item.PrimaryCategory field was mapped to a new category ID by eBay. If the primary category has not changed or it has expired with no replacement, this field is not returned. |
| Category2ID | string | Conditionally | Unique identifier of the secondary eBay category (if one was used) in which the item was relisted. This field is only returned if the Item.CategoryMappingAllowed field was included and set to true in the request and the category ID passed in the Item.SecondaryCategory field was mapped to a new category ID by eBay. If the secondary category has not changed or it has expired with no replacement, this field is not returned. |
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

### RelistItemRequestType

**Description:** Enables a seller to relist a listing that has recently ended on a specified eBay site. A seller has to up to 90 days to relist an ended listing. When an item is relisted, it will receive a new ItemID value, but this item will remain on other users' Watch Lists after it is relisted. The seller has the opportunity to make changes to the listing through the Item container, and the seller can also use one or more DeletedField tags to remove an optional field/setting from the listing.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| Item | ItemType | [0..1] | The Item container is used to configure the item that will be relisted. If the seller plans to relist the item with no changes, the only field under the Item container that is required is the ItemID field. In the ItemID field, the seller specifies the item that will be relisted. If the seller wishes to change anything else for the listing, the seller should include this field in the call request and give it a new value. If the seller wants to delete one or more optional settings in the listing, the seller should use the DeletedField tag. |
| DeletedField | string | [0..unbounded] | Specifies the name of the field to delete from a listing. See Relist Items for rules on deleting values when relisting items. Also see the relevant field descriptions to determine when to use DeletedField (and potential consequences). The request can contain zero, one, or many instances of DeletedField (one for each field to be deleted). Case-sensitivity must be taken into account when using a DeletedField tag to delete a field. The value passed into a DeletedField tag must either match the case of the schema element names in the full field path (Item.PictureDetails.PictureURL), or the initial letter of each schema element name in the full field path must be lowercase (item.pictureDetails.pictureURL). Do not change the case of letters in the middle of a field name. For example, item.picturedetails.pictureURL is not allowed. To delete a listing enhancement like 'BoldTitle', specify the value you are deleting; for example, Item.ListingEnhancement[BoldTitle]. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<RelistItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
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
    <ListingType></ListingType>
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
  <RelistLink>boolean</RelistLink>
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
</RelistItemRequest>
```

### RelistItemResponseType

**Description:** The base response type for the RelistItem call. The response includes the Item ID for the relisted item, the SKU value for the item (if any), listing recommendations (if applicable), the estimated fees for the relisted item (except the transaction fees, which aren't calculated until the item has sold), the start and end times of the listing, and other details.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| ItemID | ItemIDType | [0..1] | The unique identifier for the relisted item. Note that the ItemID value changes when a listing is relisted, so this will not be the same ItemID value that was passed in the call request. |
| Fees | FeesType | [0..1] | This container is an array of fees associated with the relisted item. The fees in this container will not include any fees that are based on the purchase price (such as transaction fees) and only come into play when the listing has a sale. All listing fee types are returned, even if those fees are not applicable for the relisted item and are '0.0'. Note: The currency used for all fees returned under the Fees container reflects the currency used for the listing site, and not necessarily in the seller's default/home currency. For example, if a Canadian seller is using the RelistItem call to relist an item on the eBay US site, the currency type shown for each fee will be USD and not CAD . |
| StartTime | dateTime | [0..1] | This timestamp indicates the date and time when the relisted item became active on the eBay site. |
| EndTime | dateTime | [0..1] | This timestamp indicates the date and time when the relisted item is scheduled to end on the eBay site. This date/time is calculated by using the StartTime and the listing duration. GTC listings are automatically renewed each month according to the calendar day. |
| CategoryID | string | [0..1] | Unique identifier of the primary eBay category in which the item was relisted. This field is only returned if the Item.CategoryMappingAllowed field was included and set to true in the request and the category ID passed in the Item.PrimaryCategory field was mapped to a new category ID by eBay. If the primary category has not changed or it has expired with no replacement, this field is not returned. |
| Category2ID | string | [0..1] | Unique identifier of the secondary eBay category (if one was used) in which the item was relisted. This field is only returned if the Item.CategoryMappingAllowed field was included and set to true in the request and the category ID passed in the Item.SecondaryCategory field was mapped to a new category ID by eBay. If the secondary category has not changed or it has expired with no replacement, this field is not returned. |
| DiscountReason | DiscountReasonCodeType | [0..unbounded] | This field is returned if an eBay special offer or promotion is applicable to the listing. |
| ProductSuggestions | ProductSuggestionsType | [0..1] | Provides a list of products recommended by eBay which match the item information provided by the seller. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<RelistItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
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
</RelistItemResponse>
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

1. **Relist window is limited**
   - Description: A seller has up to 90 days to relist an ended listing.
   - Applies when: When relisting any ended item.
   - Impact: Listings outside that window cannot be relisted through RelistItem.

2. **A relisted listing gets a new ItemID**
   - Description: Relisted items receive a new ItemID value.
   - Applies when: On every successful relist.
   - Impact: Downstream systems must track the new ItemID rather than the original one.

3. **DeletedField is case-sensitive**
   - Description: DeletedField values must match schema element casing or use the documented lowercase-initial style.
   - Applies when: When removing optional fields during relist.
   - Impact: Incorrect field casing prevents the intended deletion.

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

1. **Send only intended changes**
   - By default the original item definition rolls forward, so only send changed values plus any DeletedField removals you need.

2. **Track the new ItemID**
   - Successful relists produce a new listing identifier that should replace the ended listing ID in your workflow.

3. **Use the correct relist operation**
   - RelistFixedPriceItem is the right operation for fixed-price and multi-variation relists.

4. **Review deletion rules carefully**
   - The source explicitly recommends following the relist-item guide for DeletedField behavior and consequences.

---

## Migration Path

### New API Equivalent

| SOAP Operation | New API | Type |
|----------------|---------|------|
| RelistItem | Listing API relistListing | Mutation |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_relistitem_html.jsonl`; `.trace_artifacts/extract_wsdl_relistitem.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
