# AddFixedPriceItem - Traditional API (SOAP)

> **Call Name:** AddFixedPriceItem
> **API Type:** SOAP XML traditional API
> **API Version:** Not specified in source
> **Service:** Traditional

---

## Metadata

| Property | Value |
|----------|-------|
| **Call Type** | Not specified in source |
| **Deprecated** | Yes |
| **Replacement** | Listing API createListing |
| **Rate Limit** | Note: Sellers may be subject to call-rate limits for Add calls. The Add calls include AddItem , AddFixedPriceItem , AddItems , VerifyAddItem , and VerifyAddFixedPriceItem . Users who exceed these call frequency limits for Add calls will be temporarily blocked from listing, and an error message ( ErrorCode 21919144) will alert them to this fact. |
| **Supported Sites** | Most production eBay sites (in the EU, Asia/Pacific, and North America) support this call. |

---

## Description

Use this call to define and list a new fixed-price item. This call returns the item ID for the new listing, plus an estimation of the fees the seller will incur for posting the listing (not including transaction fees, which cannot be calculated until the listing has ended). Note: Sellers may be subject to call-rate limits for Add calls. The Add calls include AddItem , AddFixedPriceItem , AddItems , VerifyAddItem , and VerifyAddFixedPriceItem .

**Purpose:**
Use this call to define and list a new fixed-price item. This call returns the item ID for the new listing, plus an estimation of the fees the seller will incur for posting the listing (not including transaction fees, which cannot be calculated until the listing has ended).

**Use Cases:**
- This call returns the item ID for the new listing, plus an estimation of the fees the seller will incur for posting the listing (not including transaction fees, which cannot be calculated until the listing has ended).
- Note: Sellers may be subject to call-rate limits for Add calls.
- The Add calls include AddItem , AddFixedPriceItem , AddItems , VerifyAddItem , and VerifyAddFixedPriceItem .

**Important Notes:**
- This call returns the item ID for the new listing, plus an estimation of the fees the seller will incur for posting the listing (not including transaction fees, which cannot be calculated until the listing has ended).
- Note: Sellers may be subject to call-rate limits for Add calls.
- Users who exceed these call frequency limits for Add calls will be temporarily blocked from listing, and an error message ( ErrorCode 21919144) will alert them to this fact.
- These call frequency limits are subject to change without notice.
- AddFixedPriceItem is nearly identical to AddItem , with these differences: AddFixedPriceItem supports fields that are only applicable to fixed-price listings.

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
X-EBAY-API-CALL-NAME: AddFixedPriceItem
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
<AddFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <Item>
    <ApplicationData>string</ApplicationData>
    <AutoPay>boolean</AutoPay>
    <BestOfferDetails>
      <BestOfferEnabled>boolean</BestOfferEnabled>
    </BestOfferDetails>
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
      <MadeForOutletComparisonPrice></MadeForOutletComparisonPrice>
      <MinimumAdvertisedPrice></MinimumAdvertisedPrice>
      <MinimumAdvertisedPriceExposure></MinimumAdvertisedPriceExposure>
      <OriginalRetailPrice></OriginalRetailPrice>
      <SoldOffeBay>boolean</SoldOffeBay>
      <SoldOneBay>boolean</SoldOneBay>
    </DiscountPriceInfo>
    <DispatchTimeMax>int</DispatchTimeMax>
    <eBayPlus>boolean</eBayPlus>
    <ExtendedProducerResponsibility>
      <EcoParticipationFee></EcoParticipationFee>
    </ExtendedProducerResponsibility>
    <InventoryTrackingMethod></InventoryTrackingMethod>
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
      <BestOfferAutoAcceptPrice></BestOfferAutoAcceptPrice>
      <LocalListingDistance>string</LocalListingDistance>
      <MinimumBestOfferPrice></MinimumBestOfferPrice>
    </ListingDetails>
    <ListingDuration>token</ListingDuration>
    <ListingEnhancement></ListingEnhancement>
    <!-- ... more ListingEnhancement values allowed here ... -->
    <ListingType></ListingType>
    <Location>string</Location>
    <MappingReferenceId>string</MappingReferenceId>
    <PaymentMethods></PaymentMethods>
    <!-- ... more PaymentMethods values allowed here ... -->
    <PayPalEmailAddress>string</PayPalEmailAddress>
    <PickupInStoreDetails>
      <EligibleForPickupInStore>boolean</EligibleForPickupInStore>
    </PickupInStoreDetails>
    <PictureDetails>
      <GalleryType></GalleryType>
      <PictureSource></PictureSource>
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
      <InternationalPackagingHandlingCosts></InternationalPackagingHandlingCosts>
      <PackagingHandlingCosts></PackagingHandlingCosts>
    </CalculatedShippingRate>
    <ExcludeShipToLocation>string</ExcludeShipToLocation>
    <!-- ... more ExcludeShipToLocation values allowed here ... -->
    <GlobalShipping>boolean</GlobalShipping>
    <InternationalPromotionalShippingDiscount>boolean</InternationalPromotionalShippingDiscount>
    <InternationalShippingDiscountProfileID>string</InternationalShippingDiscountProfileID>
    <InternationalShippingServiceOption>
      <ShippingService>token</ShippingService>
      <ShippingServiceAdditionalCost></ShippingServiceAdditionalCost>
      <ShippingServiceCost></ShippingServiceCost>
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
      <ShippingServiceAdditionalCost></ShippingServiceAdditionalCost>
      <ShippingServiceCost></ShippingServiceCost>
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
      <ShippingServiceAdditionalCost></ShippingServiceAdditionalCost>
      <ShippingServiceCost></ShippingServiceCost>
      <ShippingServicePriority>int</ShippingServicePriority>
      <ShippingServiceType></ShippingServiceType>
    </ShippingServiceCostOverride>
    <!-- ... more ShippingServiceCostOverride nodes allowed here ... -->
  </ShippingServiceCostOverrideList>
  <ShipToLocations>string</ShipToLocations>
  <!-- ... more ShipToLocations values allowed here ... -->
  <Site></Site>
  <SKU></SKU>
  <StartPrice></StartPrice>
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
  <Variations>
    <Pictures>
      <VariationSpecificName>string</VariationSpecificName>
      <VariationSpecificPictureSet>
        <PictureURL>anyURI</PictureURL>
        <!-- ... more PictureURL values allowed here ... -->
        <VariationSpecificValue>string</VariationSpecificValue>
      </VariationSpecificPictureSet>
      <!-- ... more VariationSpecificPictureSet nodes allowed here ... -->
    </Pictures>
    <Variation>
      <DiscountPriceInfo>
        <MadeForOutletComparisonPrice></MadeForOutletComparisonPrice>
        <MinimumAdvertisedPrice></MinimumAdvertisedPrice>
        <MinimumAdvertisedPriceExposure></MinimumAdvertisedPriceExposure>
        <OriginalRetailPrice></OriginalRetailPrice>
        <SoldOffeBay>boolean</SoldOffeBay>
        <SoldOneBay>boolean</SoldOneBay>
      </DiscountPriceInfo>
      <Quantity>int</Quantity>
      <SKU></SKU>
      <StartPrice></StartPrice>
      <VariationExtendedProducerResponsibility>
        <EcoParticipationFee></EcoParticipationFee>
      </VariationExtendedProducerResponsibility>
      <VariationProductListingDetails>
        <EAN>string</EAN>
        <ISBN>string</ISBN>
        <ProductReferenceID>string</ProductReferenceID>
        <UPC>string</UPC>
      </VariationProductListingDetails>
      <VariationSpecifics>
        <NameValueList>
          <Name>string</Name>
          <Value>string</Value>
          <!-- ... more Value values allowed here ... -->
        </NameValueList>
        <!-- ... more NameValueList nodes allowed here ... -->
      </VariationSpecifics>
      <!-- ... more VariationSpecifics nodes allowed here ... -->
    </Variation>
    <!-- ... more Variation nodes allowed here ... -->
    <VariationSpecificsSet>
      <NameValueList>
        <Name>string</Name>
        <Value>string</Value>
        <!-- ... more Value values allowed here ... -->
      </NameValueList>
      <!-- ... more NameValueList nodes allowed here ... -->
    </VariationSpecificsSet>
  </Variations>
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
<ErrorLanguage>string</ErrorLanguage>
<MessageID>string</MessageID>
<Version>string</Version>
<WarningLevel></WarningLevel>
</AddFixedPriceItemRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| Item | ItemType | Yes | This container is used to specify all of the values and settings that define a new fixed-price listing. |

#### Optional Fields

| Field Path | Type | Default | Description | Constraints |
|------------|------|---------|-------------|-------------|
| Not specified in source | Not specified in source | Not specified in source | Not specified in source | Not specified in source |

#### Conditional Fields

| Field Path | Type | Condition | Description |
|------------|------|-----------|-------------|
| Not specified in source | Not specified in source | Not specified in source | Not specified in source |

## Response Structure

### XML Schema

```xml
<?xml version="1.0" encoding="utf-8"?>
<AddFixedPriceItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
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
  <SKU></SKU>
  <StartTime>dateTime</StartTime>
  <!-- Standard Output Fields -->
  <Ack></Ack>
  <Build>string</Build>
  <CorrelationID>string</CorrelationID>
  <DuplicateInvocationDetails>
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
  </Errors>
  <!-- ... more Errors nodes allowed here ... -->
  <HardExpirationWarning>string</HardExpirationWarning>
  <Message>string</Message>
  <Timestamp>dateTime</Timestamp>
  <Version>string</Version>
</AddFixedPriceItemResponse>
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
| ItemID | ItemIDType | Always | Unique identifier for the new fixed-price listing. This field is returned as long as the listing was successfully created. |
| SKU | SKUType | Conditionally | The SKU value for an item is returned if the seller specified a SKU value through the <b>Item.SKU</b> field in the request. In the case of a multiple-variation listing, variation-level SKU values are not returned in the response. To get this data, a <b>GetItem</b> call would have to be made by the seller. |
| StartTime | dateTime | Always | Starting date and time for the new listing. This value is based on the time the listing was received and processed, or the time the item will be listed if the seller included the <b>Item.ScheduleTime</b> field in the request and set a custom start time of the listing (in the future). |
| EndTime | dateTime | Conditionally | Date and time when the new listing is scheduled to end based on the start time and the listing duration value that was set in the <b>ListingDuration</b> field at listing time. If the value of <b>ListingDuration</b> was set to <code>GTC</code> (Good 'Til Cancelled) this value will be set one month ahead of the start time, and this value will continue to be updated one month ahead each time the GTC listing needs to be renewed. Fixed-price listings get renewed automatically as long as there is still a quantity of <code>1</code> or above, or even if the quantity is <code>0</code>, but the 'out-of-stock control' feature is enabled. |
| Fees | FeesType | Always | This container is an array of fees associated with the creation of the listing. The fees in this container will not include any fees that are based on the purchase price (such as transaction fees) and only come into play when the listing has a sale. <br> <br> All listing fee types are returned, even if those fees are not applicable for the new listing and are '0.0'. <br> <br> <span class="tablenote"><b>Note:</b> The currency used for all fees returned under the <b>Fees</b> container reflects the currency used for the listing site, and not necessarily in the seller's default/home currency. For example, if a Canadian seller is using the <b>AddFixedPriceItem</b> call to list an item on the eBay US site, the currency type shown for each fee will be <code>USD</code> and not <code>CAD</code>. </span> |
| CategoryID | string | Conditionally | The unique identifier of the primary category in which the item was listed. This field is only returned if the <b>Item.CategoryMappingAllowed</b> boolean field is set to <code>true</code> in the request (or omitted) and the Category ID passed in as the primary listing category was automatically mapped to a new Category ID by eBay. If the primary category ID passed in the request is still active/valid, this field is not returned. |
| Category2ID | string | Conditionally | Unique identifier of the secondary category in which the item was listed. This field is only returned if the <b>Item.CategoryMappingAllowed</b> boolean field is set to <code>true</code> in the request (or omitted) and the Category ID passed in as the secondary listing category was automatically mapped to a new Category ID by eBay. If the secondary category ID passed in the request is still active/valid, this field is not returned. |
| DiscountReason | DiscountReasonCodeType | Conditionally | This container is an array of one or more listing fee/upgrade discount types being offered by eBay to the seller. |
| ProductSuggestions | ProductSuggestionsType | Conditionally | This container holds an array of one or more products in the eBay product catalog that appear to match the product being listed, just based on the information in the listing. This container will not be returned if no similar products were found in the eBay product catalog. |

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

### AddFixedPriceItemRequestType

**Description:** This call allows a seller to create and publish a fixed-price listing. The main difference between <b>AddFixedPriceItem</b> and <b>AddItem</b> is that <b>AddFixedPriceItem</b> supports the creation of fixed-price listings only, whereas <b>AddItem</b> supports all listing formats. <br> <br> Also, only <b>AddFixedPriceItem</b> supports multiple-variation listings and tracking inventory by a seller-defined SKU value. <b>AddItem</b> does not support Variations or the <b>InventoryTrackingMethod</b> field.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| Item | ItemType | [0..1] | This container is used to specify all of the values and settings that define a new fixed-price listing. |

**XML Example:**

Not specified in source

### AddFixedPriceItemResponseType

**Description:** If the new listing is created successfully, the <b>AddFixedPriceItem</b> response includes the unique identifier of the new listing (<b>ItemID</b>) and the estimated values of any fees (such as insertion fee and any other listing upgrade fees) generated as a result of the listing being created. <br/><br/> Other response fields include the the start and end times of the listing, and any other applicable fields such as the product SKU (if defined by seller), listing recommendations (if applicable), or other details.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| ItemID | ItemIDType | [0..1] | Unique identifier for the new fixed-price listing. This field is returned as long as the listing was successfully created. |
| SKU | SKUType | [0..1] | The SKU value for an item is returned if the seller specified a SKU value through the <b>Item.SKU</b> field in the request. In the case of a multiple-variation listing, variation-level SKU values are not returned in the response. To get this data, a <b>GetItem</b> call would have to be made by the seller. |
| StartTime | dateTime | [0..1] | Starting date and time for the new listing. This value is based on the time the listing was received and processed, or the time the item will be listed if the seller included the <b>Item.ScheduleTime</b> field in the request and set a custom start time of the listing (in the future). |
| EndTime | dateTime | [0..1] | Date and time when the new listing is scheduled to end based on the start time and the listing duration value that was set in the <b>ListingDuration</b> field at listing time. If the value of <b>ListingDuration</b> was set to <code>GTC</code> (Good 'Til Cancelled) this value will be set one month ahead of the start time, and this value will continue to be updated one month ahead each time the GTC listing needs to be renewed. Fixed-price listings get renewed automatically as long as there is still a quantity of <code>1</code> or above, or even if the quantity is <code>0</code>, but the 'out-of-stock control' feature is enabled. |
| Fees | FeesType | [0..1] | This container is an array of fees associated with the creation of the listing. The fees in this container will not include any fees that are based on the purchase price (such as transaction fees) and only come into play when the listing has a sale. <br> <br> All listing fee types are returned, even if those fees are not applicable for the new listing and are '0.0'. <br> <br> <span class="tablenote"><b>Note:</b> The currency used for all fees returned under the <b>Fees</b> container reflects the currency used for the listing site, and not necessarily in the seller's default/home currency. For example, if a Canadian seller is using the <b>AddFixedPriceItem</b> call to list an item on the eBay US site, the currency type shown for each fee will be <code>USD</code> and not <code>CAD</code>. </span> |
| CategoryID | string | [0..1] | The unique identifier of the primary category in which the item was listed. This field is only returned if the <b>Item.CategoryMappingAllowed</b> boolean field is set to <code>true</code> in the request (or omitted) and the Category ID passed in as the primary listing category was automatically mapped to a new Category ID by eBay. If the primary category ID passed in the request is still active/valid, this field is not returned. |
| Category2ID | string | [0..1] | Unique identifier of the secondary category in which the item was listed. This field is only returned if the <b>Item.CategoryMappingAllowed</b> boolean field is set to <code>true</code> in the request (or omitted) and the Category ID passed in as the secondary listing category was automatically mapped to a new Category ID by eBay. If the secondary category ID passed in the request is still active/valid, this field is not returned. |
| DiscountReason | DiscountReasonCodeType | [0..unbounded] | This container is an array of one or more listing fee/upgrade discount types being offered by eBay to the seller. |
| ProductSuggestions | ProductSuggestionsType | [0..1] | This container holds an array of one or more products in the eBay product catalog that appear to match the product being listed, just based on the information in the listing. This container will not be returned if no similar products were found in the eBay product catalog. |

**XML Example:**

Not specified in source

---

## Enumerations

Not specified in source

---

## Error Codes

| Error Code | Short Message | Description | Resolution |
|------------|---------------|-------------|------------|
| 21919144 | Not specified in source | ddItems , VerifyAddItem , and VerifyAddFixedPriceItem . Users who exceed these call frequency limits for Add calls will be temporarily blocked from listing, and an error message ( ErrorCode 21919144) will alert them to this fact. These call frequency limits are subject to change without notice. A fixed-price listing can include multiple, identical items for sale by setting the Quantity to a value greater than 1. Ad | Not specified in source |

---

## Business Rules & Constraints

### Field-Level Constraints

#### Item
- **Max Length:** Not specified in source
- **Min Length:** Not specified in source
- **Pattern:** Not specified in source
- **Allowed Values:** Not specified in source
- **Dependencies:** Yes

### Operation-Level Rules

1. **Rule 1**
   - Description: This call returns the item ID for the new listing, plus an estimation of the fees the seller will incur for posting the listing (not including transaction fees, which cannot be calculated until the listing has ended).
   - Applies when: Not specified in source
   - Impact: Not specified in source
2. **Rule 2**
   - Description: Note: Sellers may be subject to call-rate limits for Add calls.
   - Applies when: Not specified in source
   - Impact: Not specified in source
3. **Rule 3**
   - Description: Users who exceed these call frequency limits for Add calls will be temporarily blocked from listing, and an error message ( ErrorCode 21919144) will alert them to this fact.
   - Applies when: Not specified in source
   - Impact: Not specified in source
4. **Rule 4**
   - Description: AddFixedPriceItem is nearly identical to AddItem , with these differences: AddFixedPriceItem supports fields that are only applicable to fixed-price listings.
   - Applies when: Not specified in source
   - Impact: Not specified in source

### Revision Restrictions (If applicable)

| Condition | Allowed Changes | Prohibited Changes |
|-----------|-----------------|-------------------|
| Not specified in source | Not specified in source | Not specified in source |

---

## Rate Limits & Throttling

| Metric | Limit | Window | Notes |
|--------|-------|--------|-------|
| API Calls | Not specified in source | Not specified in source | Note: Sellers may be subject to call-rate limits for Add calls. The Add calls include AddItem , AddFixedPriceItem , AddItems , VerifyAddItem , and VerifyAddFixedPriceItem . Users who exceed these call frequency limits for Add calls will be temporarily blocked from listing, and an error message ( ErrorCode 21919144) will alert them to this fact. |
| Frequency | Not specified in source | Not specified in source | Not specified in source |

**Throttling Behavior:**
Note: Sellers may be subject to call-rate limits for Add calls. The Add calls include AddItem , AddFixedPriceItem , AddItems , VerifyAddItem , and VerifyAddFixedPriceItem . Users who exceed these call frequency limits for Add calls will be temporarily blocked from listing, and an error message ( ErrorCode 21919144) will alert them to this fact.

---

## Best Practices

1. **Practice 1**
   - Use this call to define and list a new fixed-price item.
2. **Practice 2**
   - To use this feature, you need to set Item.InventoryTrackingMethod to SKU, and set a value for Item.SKU (even if you previously set these values in AddFixedPriceItem ).
3. **Error Handling**
   - Always check `Ack` value before processing response data
   - Log `CorrelationID` for debugging
   - Implement exponential backoff only when rate-limit behavior is documented in source
4. **Performance Optimization**
   - Not specified in source
   - Not specified in source

---

## HTTP Status Codes

Not specified in source

---

## Migration Path

| SOAP Operation | New API | Type | Endpoint | Notes |
|----------------|---------|------|----------|-------|
| AddFixedPriceItem | Listing API / createListing | Mutation | Not specified in source | Not specified in source |

---

## Migration Notes

- New API family: Listing API
  - Operation: createListing
  - Type: Mutation
  - Endpoint: Not specified in source
  - Notes: Not specified in source
- Related calls in source: AddFixedPriceItem; AddFixedPriceItem, AddItem, AddItems, AddToItemDescription, EndItem, PlaceOffer, RelistFixedPriceItem, RelistItem, RespondToWantItNowPost, ReviseFixedPriceItem, ReviseItem, VerifyAddFixedPriceItem, VerifyAddItem; AddFixedPriceItem, AddItem, AddItems, AddLiveAuctionItem, AddOrder, AddSecondChanceItem, AddToItemDescription, PlaceOffer, RelistFixedPriceItem, RelistItem, ReviseFixedPriceItem, ReviseItem; AddFixedPriceItem, AddItem, AddItems, AddOrder, AddSecondChanceItem, AddToItemDescription, PlaceOffer, RelistItem, ReviseItem; AddFixedPriceItem, AddItem, AddItems, RelistItem, ReviseFixedPriceItem, ReviseItem, VerifyAddFixedPriceItem, VerifyAddItem, VerifyRelistItem; AddFixedPriceItem, AddItem, AddItems, RelistFixedPriceItem, RelistItem, ReviseFixedPriceItem, ReviseItem, VerifyAddFixedPriceItem, VerifyAddItem, VerifyRelistItem; AddFixedPriceItem, AddItem, AddItems, RelistItem, ReviseItem, VerifyAddFixedPriceItem, VerifyAddItem, VerifyRelistItem; AddFixedPriceItem, RelistFixedPriceItem, ReviseFixedPriceItem, VerifyAddFixedPriceItem; AddFixedPriceItem, AddItem, AddItems, RelistFixedPriceItem, RelistItem, ReviseFixedPriceItem, ReviseInventoryStatus, ReviseItem, VerifyAddFixedPriceItem, VerifyAddItem, VerifyRelistItem; AddFixedPriceItem, AddItem, AddItems, AddLiveAuctionItem, RelistFixedPriceItem, RelistItem, ReviseFixedPriceItem, ReviseInventoryStatus, ReviseItem, ReviseLiveAuctionItem, VerifyAddFixedPriceItem, VerifyAddItem, VerifyRelistItem; AddFixedPriceItem, AddItem, AddItems, AddOrder, RelistFixedPriceItem, RelistItem, ReviseFixedPriceItem, ReviseItem, VerifyAddFixedPriceItem, VerifyAddItem, VerifyRelistItem; AddFixedPriceItem, AddItem, AddItems, VerifyAddFixedPriceItem, VerifyAddItem; AddFixedPriceItem, AddItem, AddItems, RelistFixedPriceItem, RelistItem, VerifyAddFixedPriceItem, VerifyAddItem, VerifyRelistItem; AddFixedPriceItem, AddItem, AddItems, RelistFixedPriceItem, RelistItem, ReviseFixedPriceItem, VerifyAddFixedPriceItem, VerifyAddItem, VerifyRelistItem; AddFixedPriceItem, AddItems, RelistFixedPriceItem, RelistItem, ReviseFixedPriceItem, VerifyAddFixedPriceItem, VerifyAddItem, VerifyRelistItem; AddFixedPriceItem, AddItem, AddItems, RelistFixedPriceItem, ReviseFixedPriceItem, VerifyAddFixedPriceItem, VerifyAddItem; AddFixedPriceItem, RelistFixedPriceItem, VerifyAddFixedPriceItem; AddFixedPriceItem, AddItem, AddItems, RelistFixedPriceItem, RelistItem, ReviseFixedPriceItem, ReviseItem, VerifyAddFixedPriceItem, VerifyAddItem; AddFixedPriceItem, AddItem, AddItems, GetItem, GetItems, GetSellerList, RelistFixedPriceItem, RelistItem, ReviseFixedPriceItem, ReviseItem, VerifyAddFixedPriceItem, VerifyAddItem, VerifyRelistItem; AddFixedPriceItem, AddItem, AddItems, GetSellerList, RelistFixedPriceItem, RelistItem, ReviseFixedPriceItem, ReviseItem, VerifyAddFixedPriceItem, VerifyAddItem, VerifyRelistItem; AddFixedPriceItem, AddItem, AddItems, RelistFixedPriceItem, RelistItem, ReviseFixedPriceItem, ReviseItem; AddFixedPriceItem, AddItem, AddItems; AddFixedPriceItem, AddItem, RelistFixedPriceItem, RelistItem, ReviseFixedPriceItem, ReviseItem, VerifyAddItem, VerifyRelistItem; AddFixedPriceItem, AddItem, AddItems, AddOrder, RelistFixedPriceItem, RelistItem, ReviseFixedPriceItem, ReviseItem, SendInvoice, VerifyAddFixedPriceItem, VerifyAddItem, VerifyRelistItem; AddFixedPriceItem, RelistFixedPriceItem, ReviseFixedPriceItem; AddFixedPriceItem, AddItem, RelistFixedPriceItem, RelistItem, ReviseFixedPriceItem, ReviseItem, VerifyAddFixedPriceItem, VerifyAddItem, VerifyRelistItem; AddFixedPriceItem, VerifyAddFixedPriceItem; AddItem, AddItems, VerifyAddFixedPriceItem; AddFixedPriceItem, AddItems, VerifyAddItem

*Source: developer_ebay_com_devzone_xml_docs_reference_ebay_addfixedpriceitem_html.jsonl | Generated: 2026-03-25 | Template Version: 1.0.0*
