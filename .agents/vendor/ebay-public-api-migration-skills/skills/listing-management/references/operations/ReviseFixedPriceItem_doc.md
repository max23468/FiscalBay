# ReviseFixedPriceItem - Traditional API (SOAP)

> **Call Name:** ReviseFixedPriceItem
> **API Type:** SOAP XML traditional API
> **API Version:** Not specified in source
> **Service:** Traditional

---

## Metadata

| Property | Value |
|----------|-------|
| **Call Type** | Not specified in source |
| **Deprecated** | Yes |
| **Replacement** | Listing API updateListing |
| **Rate Limit** | Note: Any eBay listing can be revised up to 250 times in one calendar day using ReviseFixedPriceItem and ReviseItem calls. If this revision threshold is reached, the seller will be blocked from using these calls on the listing until the next calendar day. Note: An active listing that was created with the new Inventory model (using the Inventory API or Merchant Integration Platform) cannot be revised using the ReviseFixedPriceItem , ReviseItem , or ReviseInventoryStatus calls. |
| **Supported Sites** | Not specified in source |

---

## Description

Note: Any eBay listing can be revised up to 250 times in one calendar day using ReviseFixedPriceItem and ReviseItem calls. If this revision threshold is reached, the seller will be blocked from using these calls on the listing until the next calendar day. Note: An active listing that was created with the new Inventory model (using the Inventory API or Merchant Integration Platform) cannot be revised using the ReviseFixedPriceItem , ReviseItem , or ReviseInventoryStatus calls. Instead, the seller will need to use the Inventory API or MIP.

**Purpose:**
Note: Any eBay listing can be revised up to 250 times in one calendar day using ReviseFixedPriceItem and ReviseItem calls. If this revision threshold is reached, the seller will be blocked from using these calls on the listing until the next calendar day.

**Use Cases:**
- If this revision threshold is reached, the seller will be blocked from using these calls on the listing until the next calendar day.
- Note: An active listing that was created with the new Inventory model (using the Inventory API or Merchant Integration Platform) cannot be revised using the ReviseFixedPriceItem , ReviseItem , or ReviseInventoryStatus calls.
- Instead, the seller will need to use the Inventory API or MIP.

**Important Notes:**
- Note: Any eBay listing can be revised up to 250 times in one calendar day using ReviseFixedPriceItem and ReviseItem calls.
- Note: An active listing that was created with the new Inventory model (using the Inventory API or Merchant Integration Platform) cannot be revised using the ReviseFixedPriceItem , ReviseItem , or ReviseInventoryStatus calls.
- However, ReviseFixedPriceItem does have these differences from ReviseItem : ReviseFixedPriceItem supports only fields that are applicable to basic fixed-price listings (it does not support fields that are exclusively applicable to auctions, classified ads, or listings with Best Offer).
- After one item in a multi-quantity fixed-price listing has been sold, you cannot change the values in the Title, Primary Category, Secondary Category, Listing Duration, and Listing Type fields.

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
X-EBAY-API-CALL-NAME: ReviseFixedPriceItem
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
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <DeletedField>string</DeletedField>
  <!-- ... more DeletedField values allowed here ... -->
  <Item>
    <ApplicationData>string</ApplicationData>
    <AutoPay>boolean</AutoPay>
    <BestOfferDetails>
      <BestOfferEnabled>boolean</BestOfferEnabled>
    </BestOfferDetails>
    <CategoryMappingAllowed>boolean</CategoryMappingAllowed>
    <CeilingPrice></CeilingPrice>
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
    <FloorPrice></FloorPrice>
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
      <BestOfferAutoAcceptPrice></BestOfferAutoAcceptPrice>
      <MinimumBestOfferPrice></MinimumBestOfferPrice>
    </ListingDetails>
    <ListingDuration>token</ListingDuration>
    <ListingEnhancement></ListingEnhancement>
    <!-- ... more ListingEnhancement values allowed here ... -->
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
    <ModifyNameList>
      <ModifyName>
        <Name>string</Name>
        <NewName>string</NewName>
      </ModifyName>
      <!-- ... more ModifyName nodes allowed here ... -->
    </ModifyNameList>
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
      <Delete>boolean</Delete>
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
</ReviseFixedPriceItemRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| Item | ItemType | Yes | The <b>Item</b> container is used to make changes to the active listing. The seller must pass in the <b>ItemID</b> value for the listing that is being revised. For anything else that the seller wishes to change, such as quantity or price, the seller should include this field in the call request and give it a new value. <br/><br/> If the seller wants to delete one or more optional settings in the listing, the seller should use the <b>DeletedField</b> tag. |

#### Optional Fields

| Field Path | Type | Default | Description | Constraints |
|------------|------|---------|-------------|-------------|
| Not specified in source | Not specified in source | Not specified in source | Not specified in source | Not specified in source |

#### Conditional Fields

| Field Path | Type | Condition | Description |
|------------|------|-----------|-------------|
| DeletedField | string | Conditionally | Specifies the name of a field to delete from a listing. The request can contain zero, one, or many instances of <b>DeletedField</b> (one for each field to be deleted). See the relevant field descriptions to determine when to use <b>DeletedField</b> (and potential consequences). <br><br> You cannot delete required fields from a listing. <br><br> Some fields are optional when you first list an item (e.g., <b>SecondaryCategory</b>), but once they are set they cannot be deleted when you revise an item. Some optional fields cannot be deleted if the item has bids and/or ends within 12 hours. Some optional fields cannot be deleted if other fields depend on them. <br><br> Some data (such as <b>Variation</b> nodes within the <b>Variations</b> container) can't be deleted by using <b>DeletedField</b>. See the relevant field descriptions for how to delete such data. <br><br> Use values that match the case of the schema element names (<b>Item.PictureDetails.PictureURL</b>) or make the initial letter of each field name lowercase (<b>item.pictureDetails.pictureURL</b>). However, do not change the case of letters in the middle of a field name. For example, <b>item.picturedetails.pictureUrl</b> is not allowed. <br><br> To delete a listing enhancement like <b>BoldTitle</b>, specify the value you are deleting in square brackets ("[ ]"); for example, <b>Item.ListingEnhancement[BoldTitle]</b>. |

## Response Structure

### XML Schema

```xml
<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
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
  <DuplicateInvocationDetails></DuplicateInvocationDetails>
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
</ReviseFixedPriceItemResponse>
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
| ItemID | ItemIDType | Always | The unique identifier for the revised listing. Note that the <b>ItemID</b> value does not change when a listing is revised, so this will be the same <b>ItemID</b> value that was passed in the call request. <br/><br/> |
| SKU | SKUType | Conditionally | The seller-defined SKU value for the revised listing (if a SKU value exists for the item). <br/><br/> Note that variation-level SKU values will not be returned if a multiple-variation listing was revised. The seller would have to make a <b>GetItem</b> call to get variation-level SKU values. |
| StartTime | dateTime | Always | This timestamp indicates the date and time when the listing was created on the eBay site. This value doesn't change when a listing is revised. |
| EndTime | dateTime | Always | Date and time when the revised listing is scheduled to end based on the listing's start time and the listing duration value that was set for the listing. If the listing duration is 'GTC' (Good 'Til Cancelled), this value will be updated to one month in the future if the listing is automatically renewed after one month. GTC listings are automatically renewed each month according to the calendar day if quantity still exists for the item. |
| Fees | FeesType | Always | This container is an array of fees associated with the revised listing. The fees in this container will not include any fees that are based on the purchase price (such as transaction fees) and only come into play when the listing has a sale. <br> <br> All listing fee types are returned, even if those fees are not applicable for the revised listing and are '0.0'. <br> <br> <span class="tablenote"><b>Note:</b> The currency used for all fees returned under the <b>Fees</b> container reflects the currency used for the listing site, and not necessarily in the seller's default/home currency. For example, if a Canadian seller is using the <b>ReviseFixedPriceItem</b> call to relist an item on the eBay US site, the currency type shown for each fee will be <code>USD</code> and not <code>CAD</code>. </span> |
| CategoryID | string | Conditionally | Unique identifier of the primary eBay category for the revised listing. This field is returned if the primary category was changed with the revision, and the primary category can only be changed if a fixed-price listing has no sales, and the listing does not end within 12 hours. <br/><br/> This field can also be returned if the <b>Item.CategoryMappingAllowed</b> field was included and set to <code>true</code> in the request and the category ID passed in the <b>Item.PrimaryCategory</b> field was mapped to a new category ID by eBay. If the primary category has not changed or it has expired with no replacement, this field is not returned. <br/> |
| Category2ID | string | Conditionally | Unique identifier of the secondary eBay category for the revised listing. This field is returned if the secondary category was changed with the revision, and the secondary category can only be changed if a fixed-price listing has no sales, and the listing does not end within 12 hours. <br/><br/> This field can also be returned if the <b>Item.CategoryMappingAllowed</b> field was included and set to <code>true</code> in the request and the category ID passed in the <b>Item.PrimaryCategory</b> field was mapped to a new category ID by eBay. If the primary category has not changed or it has expired with no replacement, this field is not returned. <br/> |
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

### ReviseFixedPriceItemRequestType

**Description:** Enables a seller to revise a fixed-price listing on a specified eBay site. To revise an active listing, the seller specifies the <b>ItemID</b> value for the listing. The seller makes one or multiple changes to the listing through the <b>Item</b> container, and the seller can also use one or more <b>DeletedField</b> tags to remove an optional field/setting from the listing.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| Item | ItemType | [0..1] | The <b>Item</b> container is used to make changes to the active listing. The seller must pass in the <b>ItemID</b> value for the listing that is being revised. For anything else that the seller wishes to change, such as quantity or price, the seller should include this field in the call request and give it a new value. <br/><br/> If the seller wants to delete one or more optional settings in the listing, the seller should use the <b>DeletedField</b> tag. |
| DeletedField | string | [0..unbounded] | Specifies the name of a field to delete from a listing. The request can contain zero, one, or many instances of <b>DeletedField</b> (one for each field to be deleted). See the relevant field descriptions to determine when to use <b>DeletedField</b> (and potential consequences). <br><br> You cannot delete required fields from a listing. <br><br> Some fields are optional when you first list an item (e.g., <b>SecondaryCategory</b>), but once they are set they cannot be deleted when you revise an item. Some optional fields cannot be deleted if the item has bids and/or ends within 12 hours. Some optional fields cannot be deleted if other fields depend on them. <br><br> Some data (such as <b>Variation</b> nodes within the <b>Variations</b> container) can't be deleted by using <b>DeletedField</b>. See the relevant field descriptions for how to delete such data. <br><br> Use values that match the case of the schema element names (<b>Item.PictureDetails.PictureURL</b>) or make the initial letter of each field name lowercase (<b>item.pictureDetails.pictureURL</b>). However, do not change the case of letters in the middle of a field name. For example, <b>item.picturedetails.pictureUrl</b> is not allowed. <br><br> To delete a listing enhancement like <b>BoldTitle</b>, specify the value you are deleting in square brackets ("[ ]"); for example, <b>Item.ListingEnhancement[BoldTitle]</b>. |

**XML Example:**

Not specified in source

### ReviseFixedPriceItemResponseType

**Description:** The base response type for the <b>ReviseFixedPriceItem</b> call. The response includes the Item ID for the revised item, the SKU value for the item (if any), listing recommendations (if applicable), the estimated fees for the revised item (except the transaction fees, which aren't calculated until the item has sold), the start and end times of the listing, and other details.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| ItemID | ItemIDType | [0..1] | The unique identifier for the revised listing. Note that the <b>ItemID</b> value does not change when a listing is revised, so this will be the same <b>ItemID</b> value that was passed in the call request. <br/><br/> |
| SKU | SKUType | [0..1] | The seller-defined SKU value for the revised listing (if a SKU value exists for the item). <br/><br/> Note that variation-level SKU values will not be returned if a multiple-variation listing was revised. The seller would have to make a <b>GetItem</b> call to get variation-level SKU values. |
| StartTime | dateTime | [0..1] | This timestamp indicates the date and time when the listing was created on the eBay site. This value doesn't change when a listing is revised. |
| EndTime | dateTime | [0..1] | Date and time when the revised listing is scheduled to end based on the listing's start time and the listing duration value that was set for the listing. If the listing duration is 'GTC' (Good 'Til Cancelled), this value will be updated to one month in the future if the listing is automatically renewed after one month. GTC listings are automatically renewed each month according to the calendar day if quantity still exists for the item. |
| Fees | FeesType | [0..1] | This container is an array of fees associated with the revised listing. The fees in this container will not include any fees that are based on the purchase price (such as transaction fees) and only come into play when the listing has a sale. <br> <br> All listing fee types are returned, even if those fees are not applicable for the revised listing and are '0.0'. <br> <br> <span class="tablenote"><b>Note:</b> The currency used for all fees returned under the <b>Fees</b> container reflects the currency used for the listing site, and not necessarily in the seller's default/home currency. For example, if a Canadian seller is using the <b>ReviseFixedPriceItem</b> call to relist an item on the eBay US site, the currency type shown for each fee will be <code>USD</code> and not <code>CAD</code>. </span> |
| CategoryID | string | [0..1] | Unique identifier of the primary eBay category for the revised listing. This field is returned if the primary category was changed with the revision, and the primary category can only be changed if a fixed-price listing has no sales, and the listing does not end within 12 hours. <br/><br/> This field can also be returned if the <b>Item.CategoryMappingAllowed</b> field was included and set to <code>true</code> in the request and the category ID passed in the <b>Item.PrimaryCategory</b> field was mapped to a new category ID by eBay. If the primary category has not changed or it has expired with no replacement, this field is not returned. <br/> |
| Category2ID | string | [0..1] | Unique identifier of the secondary eBay category for the revised listing. This field is returned if the secondary category was changed with the revision, and the secondary category can only be changed if a fixed-price listing has no sales, and the listing does not end within 12 hours. <br/><br/> This field can also be returned if the <b>Item.CategoryMappingAllowed</b> field was included and set to <code>true</code> in the request and the category ID passed in the <b>Item.PrimaryCategory</b> field was mapped to a new category ID by eBay. If the primary category has not changed or it has expired with no replacement, this field is not returned. <br/> |
| DiscountReason | DiscountReasonCodeType | [0..unbounded] | This field is returned if an eBay special offer or promotion is applicable to the listing. |
| ProductSuggestions | ProductSuggestionsType | [0..1] | Provides a list of products recommended by eBay which match the item information provided by the seller. |

**XML Example:**

Not specified in source

---

## Enumerations

Not specified in source

---

## Error Codes

| Error Code | Short Message | Description | Resolution |
|------------|---------------|-------------|------------|
| Not specified in source | Not specified in source | Not specified in source | Not specified in source |

---

## Business Rules & Constraints

### Field-Level Constraints

#### Item
- **Max Length:** Not specified in source
- **Min Length:** Not specified in source
- **Pattern:** Not specified in source
- **Allowed Values:** Not specified in source
- **Dependencies:** Yes

#### DeletedField
- **Max Length:** Not specified in source
- **Min Length:** Not specified in source
- **Pattern:** Not specified in source
- **Allowed Values:** Not specified in source
- **Dependencies:** Conditionally

### Operation-Level Rules

1. **Rule 1**
   - Description: If this revision threshold is reached, the seller will be blocked from using these calls on the listing until the next calendar day.
   - Applies when: Not specified in source
   - Impact: Not specified in source
2. **Rule 2**
   - Description: Note: An active listing that was created with the new Inventory model (using the Inventory API or Merchant Integration Platform) cannot be revised using the ReviseFixedPriceItem , ReviseItem , or ReviseInventoryStatus calls.
   - Applies when: Not specified in source
   - Impact: Not specified in source
3. **Rule 3**
   - Description: However, ReviseFixedPriceItem does have these differences from ReviseItem : ReviseFixedPriceItem supports only fields that are applicable to basic fixed-price listings (it does not support fields that are exclusively applicable to auctions, classified ads, or listings with Best Offer).
   - Applies when: Not specified in source
   - Impact: Not specified in source
4. **Rule 4**
   - Description: After one item in a multi-quantity fixed-price listing has been sold, you cannot change the values in the Title, Primary Category, Secondary Category, Listing Duration, and Listing Type fields.
   - Applies when: Not specified in source
   - Impact: Not specified in source

### Revision Restrictions (If applicable)

| Condition | Allowed Changes | Prohibited Changes |
|-----------|-----------------|-------------------|
| After one item in a multi-quantity fixed-price listing has been sold | All other fields in the multi-quantity fixed-price listing are editable | Title, Primary Category, Secondary Category, Listing Duration, and Listing Type |

---

## Rate Limits & Throttling

| Metric | Limit | Window | Notes |
|--------|-------|--------|-------|
| API Calls | Not specified in source | Not specified in source | Note: Any eBay listing can be revised up to 250 times in one calendar day using ReviseFixedPriceItem and ReviseItem calls. If this revision threshold is reached, the seller will be blocked from using these calls on the listing until the next calendar day. Note: An active listing that was created with the new Inventory model (using the Inventory API or Merchant Integration Platform) cannot be revised using the ReviseFixedPriceItem , ReviseItem , or ReviseInventoryStatus calls. |
| Frequency | Not specified in source | Not specified in source | Not specified in source |

**Throttling Behavior:**
Note: Any eBay listing can be revised up to 250 times in one calendar day using ReviseFixedPriceItem and ReviseItem calls. If this revision threshold is reached, the seller will be blocked from using these calls on the listing until the next calendar day. Note: An active listing that was created with the new Inventory model (using the Inventory API or Merchant Integration Platform) cannot be revised using the ReviseFixedPriceItem , ReviseItem , or ReviseInventoryStatus calls.

---

## Best Practices

1. **Practice 1**
   - Instead, the seller will need to use the Inventory API or MIP.
2. **Practice 2**
   - Use this call to change the properties of a currently active fixed-price listing (including multi-variation listings).
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
| ReviseFixedPriceItem | Listing API / updateListing | Mutation | Not specified in source | Not specified in source |

---

## Migration Notes

- New API family: Listing API
  - Operation: updateListing
  - Type: Mutation
  - Endpoint: Not specified in source
  - Notes: Not specified in source
- Related calls in source: ReviseFixedPriceItem; AddFixedPriceItem, AddItem, AddItems, AddToItemDescription, EndItem, PlaceOffer, RelistFixedPriceItem, RelistItem, RespondToWantItNowPost, ReviseFixedPriceItem, ReviseItem, VerifyAddFixedPriceItem, VerifyAddItem; AddFixedPriceItem, AddItem, AddItems, AddLiveAuctionItem, AddOrder, AddSecondChanceItem, AddToItemDescription, PlaceOffer, RelistFixedPriceItem, RelistItem, ReviseFixedPriceItem, ReviseItem; AddFixedPriceItem, AddItem, AddItems, RelistItem, ReviseFixedPriceItem, ReviseItem, VerifyAddFixedPriceItem, VerifyAddItem, VerifyRelistItem; AddFixedPriceItem, AddItem, AddItems, RelistFixedPriceItem, RelistItem, ReviseFixedPriceItem, ReviseItem, VerifyAddFixedPriceItem, VerifyAddItem, VerifyRelistItem; AddFixedPriceItem, RelistFixedPriceItem, ReviseFixedPriceItem, VerifyAddFixedPriceItem; AddFixedPriceItem, AddItem, AddItems, RelistFixedPriceItem, RelistItem, ReviseFixedPriceItem, ReviseInventoryStatus, ReviseItem, VerifyAddFixedPriceItem, VerifyAddItem, VerifyRelistItem; AddFixedPriceItem, AddItem, AddItems, AddLiveAuctionItem, RelistFixedPriceItem, RelistItem, ReviseFixedPriceItem, ReviseInventoryStatus, ReviseItem, ReviseLiveAuctionItem, VerifyAddFixedPriceItem, VerifyAddItem, VerifyRelistItem; AddFixedPriceItem, AddItem, AddItems, AddOrder, RelistFixedPriceItem, RelistItem, ReviseFixedPriceItem, ReviseItem, VerifyAddFixedPriceItem, VerifyAddItem, VerifyRelistItem; RelistFixedPriceItem, RelistItem, ReviseFixedPriceItem, ReviseItem; ReviseFixedPriceItem, ReviseItem; RelistFixedPriceItem, RelistItem, ReviseFixedPriceItem, ReviseItem, VerifyRelistItem; RelistFixedPriceItem, ReviseFixedPriceItem; AddFixedPriceItem, AddItem, AddItems, RelistFixedPriceItem, RelistItem, ReviseFixedPriceItem, VerifyAddFixedPriceItem, VerifyAddItem, VerifyRelistItem; AddFixedPriceItem, AddItems, RelistFixedPriceItem, RelistItem, ReviseFixedPriceItem, VerifyAddFixedPriceItem, VerifyAddItem, VerifyRelistItem; AddFixedPriceItem, AddItem, AddItems, RelistFixedPriceItem, ReviseFixedPriceItem, VerifyAddFixedPriceItem, VerifyAddItem; AddFixedPriceItem, AddItem, AddItems, RelistFixedPriceItem, RelistItem, ReviseFixedPriceItem, ReviseItem, VerifyAddFixedPriceItem, VerifyAddItem; AddFixedPriceItem, AddItem, AddItems, GetItem, GetItems, GetSellerList, RelistFixedPriceItem, RelistItem, ReviseFixedPriceItem, ReviseItem, VerifyAddFixedPriceItem, VerifyAddItem, VerifyRelistItem; AddFixedPriceItem, AddItem, AddItems, GetSellerList, RelistFixedPriceItem, RelistItem, ReviseFixedPriceItem, ReviseItem, VerifyAddFixedPriceItem, VerifyAddItem, VerifyRelistItem; AddFixedPriceItem, AddItem, AddItems, RelistFixedPriceItem, RelistItem, ReviseFixedPriceItem, ReviseItem; AddFixedPriceItem, AddItem, RelistFixedPriceItem, RelistItem, ReviseFixedPriceItem, ReviseItem, VerifyAddItem, VerifyRelistItem; AddFixedPriceItem, AddItem, AddItems, AddOrder, RelistFixedPriceItem, RelistItem, ReviseFixedPriceItem, ReviseItem, SendInvoice, VerifyAddFixedPriceItem, VerifyAddItem, VerifyRelistItem; AddFixedPriceItem, RelistFixedPriceItem, ReviseFixedPriceItem; AddFixedPriceItem, AddItem, RelistFixedPriceItem, RelistItem, ReviseFixedPriceItem, ReviseItem, VerifyAddFixedPriceItem, VerifyAddItem, VerifyRelistItem; ReviseItem

*Source: developer_ebay_com_devzone_xml_docs_reference_ebay_revisefixedpriceitem_html.jsonl | Generated: 2026-03-25 | Template Version: 1.0.0*
