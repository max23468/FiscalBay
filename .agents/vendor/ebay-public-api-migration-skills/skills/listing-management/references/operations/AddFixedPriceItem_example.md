# AddFixedPriceItem — Example

## Request Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<AddFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>PLACEHOLDER_TOKEN</eBayAuthToken>
  </RequesterCredentials>
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <Item>
    <AutoPay>false</AutoPay>
    <PaymentDetails>
      <DaysToFullPayment>7</DaysToFullPayment>
      <DepositAmount currencyID="USD">1000.0</DepositAmount>
      <DepositType>OtherMethod</DepositType>
      <HoursToDeposit>48</HoursToDeposit>
    </PaymentDetails>
    <BuyItNowPrice currencyID="USD">0.0</BuyItNowPrice>
    <Country>US</Country>
    <Currency>USD</Currency>
    <Description>This is the item description</Description>
    <HitCounter>HiddenStyle</HitCounter>
    <ListingDuration>Days_5</ListingDuration>
    <ListingEnhancement>BoldTitle</ListingEnhancement>
    <ListingType>FixedPriceItem</ListingType>
    <Location>Wa</Location>
    <PaymentMethods>MOCC</PaymentMethods>
    <PaymentMethods>PersonalCheck</PaymentMethods>
    <PrimaryCategory>
      <CategoryID>6249</CategoryID>
    </PrimaryCategory>
    <Quantity>1</Quantity>
    <ShippingDetails>
      <ApplyShippingDiscount>false</ApplyShippingDiscount>
      <ShippingDiscountProfileID>0</ShippingDiscountProfileID>
      <InternationalShippingDiscountProfileID>0</InternationalShippingDiscountProfileID>
      <SellerExcludeShipToLocationsPreference>true</SellerExcludeShipToLocationsPreference>
    </ShippingDetails>
    <ShipToLocations>US</ShipToLocations>
    <Site>eBayMotors</Site>
    <StartPrice currencyID="USD">53999.0</StartPrice>
    <SubTitle>Country Chevrolet Warrenton Warrenton</SubTitle>
    <Title>2017 GMC Yukon Denali</Title>
    <SKU>12</SKU>
    <PostalCode>24</PostalCode>
    <PictureDetails>
      <GalleryType>Gallery</GalleryType>
      <PhotoDisplay>PicturePack</PhotoDisplay>
      <PictureURL>https://i.ebayimg.com/00/s/N=/z/Gw/$_57.JPG?set_id=2</PictureURL>
      <PictureURL>https://i.ebayimg.com/00/s/N=/z/Xx/$_57.JPG?set_id=2</PictureURL>
      <PictureURL>https://i.ebayimg.com/00/s/N=/z/gy/$_57.JPG?set_id=2</PictureURL>
      <PictureURL>https://i.ebayimg.com/00/s/N=/z/5z/$_57.JPG?set_id=2</PictureURL>
      <PictureURL>https://i.ebayimg.com/00/s/N=/z/b0/$_57.JPG?set_id=2</PictureURL>
      <PictureURL>https://i.ebayimg.com/00/s/N=/z/Q1/$_57.JPG?set_id=2</PictureURL>
      <PictureURL>https://i.ebayimg.com/00/s/N=/z/-2/$_57.JPG?set_id=2</PictureURL>
      <PictureURL>https://i.ebayimg.com/00/s/N=/z/D3/$_57.JPG?set_id=2</PictureURL>
      <PictureURL>https://i.ebayimg.com/00/s/N=/z/l4/$_57.JPG?set_id=2</PictureURL>
      <PictureURL>https://i.ebayimg.com/00/s/N=/z/y5/$_57.JPG?set_id=2</PictureURL>
      <PictureURL>https://i.ebayimg.com/00/s/N=/z/I6/$_57.JPG?set_id=2</PictureURL>
      <PictureURL>https://i.ebayimg.com/00/s/N=/z/87/$_57.JPG?set_id=2</PictureURL>
      <PictureURL>https://i.ebayimg.com/00/s/N=/z/X8/$_57.JPG?set_id=2</PictureURL>
      <PictureURL>https://i.ebayimg.com/00/s/N=/z/x9/$_57.JPG?set_id=2</PictureURL>
      <PictureURL>https://i.ebayimg.com/00/s/N=/z/1-/$_57.JPG?set_id=2</PictureURL>
      <PictureURL>https://i.ebayimg.com/00/s/N=/z/G~/$_57.JPG?set_id=2</PictureURL>
      <PictureURL>https://i.ebayimg.com/00/s/N=/z/QA/$_57.JPG?set_id=2</PictureURL>
      <PictureURL>https://i.ebayimg.com/00/s/N=/z/LB/$_57.JPG?set_id=2</PictureURL>
      <PictureURL>https://i.ebayimg.com/00/s/N=/z/FC/$_57.JPG?set_id=2</PictureURL>
      <PictureURL>https://i.ebayimg.com/00/s/N=/z/tD/$_57.JPG?set_id=2</PictureURL>
      <PictureURL>https://i.ebayimg.com/00/s/N=/z/BE/$_57.JPG?set_id=2</PictureURL>
      <PictureURL>https://i.ebayimg.com/00/s/N=/z/XF/$_57.JPG?set_id=2</PictureURL>
      <PictureURL>https://i.ebayimg.com/00/s/N=/z/8G/$_57.JPG?set_id=2</PictureURL>
      <PictureURL>https://i.ebayimg.com/00/s/N=/z/Fo/$_57.JPG?set_id=2</PictureURL>
      <PictureSource>EPS</PictureSource>
    </PictureDetails>
    <ItemSpecifics>
      <NameValueList>
        <Name>Mileage</Name>
        <Value>54594</Value>
        <Source>ItemSpecific</Source>
      </NameValueList>
      <NameValueList>
        <Name>Vehicle Title</Name>
        <Value>Clean</Value>
        <Source>ItemSpecific</Source>
      </NameValueList>
      <NameValueList>
        <Name>Year</Name>
        <Value>2017</Value>
        <Source>ItemSpecific</Source>
      </NameValueList>
      <NameValueList>
        <Name>Make</Name>
        <Value>GMC</Value>
        <Source>ItemSpecific</Source>
      </NameValueList>
      <NameValueList>
        <Name>Trim</Name>
        <Value>Denali</Value>
        <Source>ItemSpecific</Source>
      </NameValueList>
      <NameValueList>
        <Name>Drive Type</Name>
        <Value>4WD 4dr Denali</Value>
        <Source>ItemSpecific</Source>
      </NameValueList>
      <NameValueList>
        <Name>Engine</Name>
        <Value>EcoTec3 6.2L V8</Value>
        <Source>ItemSpecific</Source>
      </NameValueList>
      <NameValueList>
        <Name>Fuel Type</Name>
        <Value>Gasoline</Value>
        <Source>ItemSpecific</Source>
      </NameValueList>
      <NameValueList>
        <Name>Body Type</Name>
        <Value>Sport Utility</Value>
        <Source>ItemSpecific</Source>
      </NameValueList>
      <NameValueList>
        <Name>Options</Name>
        <Value>ENGINE, 6.2L ECOTEC3 V8</Value>
        <Source>ItemSpecific</Source>
      </NameValueList>
      <NameValueList>
        <Name>Power Options</Name>
        <Value>--</Value>
        <Source>ItemSpecific</Source>
      </NameValueList>
      <NameValueList>
        <Name>Exterior Color</Name>
        <Value>Mineral Metallic</Value>
        <Source>ItemSpecific</Source>
      </NameValueList>
      <NameValueList>
        <Name>Interior Color</Name>
        <Value>Cocoa/Shale</Value>
        <Source>ItemSpecific</Source>
      </NameValueList>
      <NameValueList>
        <Name>Transmission</Name>
        <Value>Automatic</Value>
        <Source>ItemSpecific</Source>
      </NameValueList>
      <NameValueList>
        <Name>Warranty</Name>
        <Value>Unspecified</Value>
        <Source>ItemSpecific</Source>
      </NameValueList>
      <NameValueList>
        <Name>For Sale By</Name>
        <Value>Dealer</Value>
        <Source>ItemSpecific</Source>
      </NameValueList>
      <NameValueList>
        <Name>Model</Name>
        <Value>Yukon</Value>
        <Source>ItemSpecific</Source>
      </NameValueList>
    </ItemSpecifics>
    <ConditionID>3000</ConditionID>
    <SellerProvidedTitle>2017 GMC Yukon Denali 54 Miles Mineral Metallic</SellerProvidedTitle>
    <VIN>10</VIN>
  </Item>
</AddFixedPriceItemRequest>
```

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

## Response Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<AddFixedPriceItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Timestamp>2021-12-17T00:34:44.275Z</Timestamp>
  <Version>1229</Version>
  <Build>E1229_UNI_API5_19110890_R1</Build>
  <ItemID>27</ItemID>
  <Fees>
    <Fee>
      <Name>AuctionLengthFee</Name>
      <Fee currencyID="USD">0.0</Fee>
    </Fee>
    <Fee>
      <Name>BoldFee</Name>
      <Fee currencyID="USD">5.0</Fee>
    </Fee>
    <Fee>
      <Name>BuyItNowFee</Name>
      <Fee currencyID="USD">0.0</Fee>
    </Fee>
    <Fee>
      <Name>CategoryFeaturedFee</Name>
      <Fee currencyID="USD">0.0</Fee>
    </Fee>
    <Fee>
      <Name>FeaturedFee</Name>
      <Fee currencyID="USD">0.0</Fee>
    </Fee>
    <Fee>
      <Name>GalleryPlusFee</Name>
      <Fee currencyID="USD">0.0</Fee>
    </Fee>
    <Fee>
      <Name>FeaturedGalleryFee</Name>
      <Fee currencyID="USD">0.0</Fee>
    </Fee>
    <Fee>
      <Name>FixedPriceDurationFee</Name>
      <Fee currencyID="USD">0.0</Fee>
    </Fee>
    <Fee>
      <Name>GalleryFee</Name>
      <Fee currencyID="USD">0.0</Fee>
    </Fee>
    <Fee>
      <Name>GiftIconFee</Name>
      <Fee currencyID="USD">0.0</Fee>
    </Fee>
    <Fee>
      <Name>HighLightFee</Name>
      <Fee currencyID="USD">0.0</Fee>
    </Fee>
    <Fee>
      <Name>InsertionFee</Name>
      <Fee currencyID="USD">50.0</Fee>
    </Fee>
    <Fee>
      <Name>InternationalInsertionFee</Name>
      <Fee currencyID="USD">0.0</Fee>
    </Fee>
    <Fee>
      <Name>ListingDesignerFee</Name>
      <Fee currencyID="USD">0.0</Fee>
    </Fee>
    <Fee>
      <Name>ListingFee</Name>
      <Fee currencyID="USD">64.0</Fee>
    </Fee>
    <Fee>
      <Name>PhotoDisplayFee</Name>
      <Fee currencyID="USD">4.0</Fee>
    </Fee>
    <Fee>
      <Name>PhotoFee</Name>
      <Fee currencyID="USD">0.0</Fee>
    </Fee>
    <Fee>
      <Name>ReserveFee</Name>
      <Fee currencyID="USD">0.0</Fee>
    </Fee>
    <Fee>
      <Name>SchedulingFee</Name>
      <Fee currencyID="USD">0.0</Fee>
    </Fee>
    <Fee>
      <Name>SubtitleFee</Name>
      <Fee currencyID="USD">5.0</Fee>
    </Fee>
    <Fee>
      <Name>BorderFee</Name>
      <Fee currencyID="USD">0.0</Fee>
    </Fee>
    <Fee>
      <Name>ProPackBundleFee</Name>
      <Fee currencyID="USD">0.0</Fee>
    </Fee>
    <Fee>
      <Name>BasicUpgradePackBundleFee</Name>
      <Fee currencyID="USD">0.0</Fee>
    </Fee>
    <Fee>
      <Name>ValuePackBundleFee</Name>
      <Fee currencyID="USD">0.0</Fee>
    </Fee>
    <Fee>
      <Name>PrivateListingFee</Name>
      <Fee currencyID="USD">0.0</Fee>
    </Fee>
    <Fee>
      <Name>ProPackPlusBundleFee</Name>
      <Fee currencyID="USD">0.0</Fee>
    </Fee>
    <Fee>
      <Name>MotorsGermanySearchFee</Name>
      <Fee currencyID="USD">0.0</Fee>
    </Fee>
  </Fees>
  <DiscountReason>SpecialOffer</DiscountReason>
</AddFixedPriceItemResponse>
```
