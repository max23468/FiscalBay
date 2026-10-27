# AddItems - Traditional API (SOAP)

> **Call Name:** AddItems
> **API Type:** SOAP XML traditional API
> **API Version:** 1217
> **Service:** Traditional

---

## Metadata

| Property | Value |
|----------|-------|
| **Call Type** | Core |
| **Deprecated** | No |
| **Replacement** | createTask and uploadFile methods of Sell Feed API |
| **Rate Limit** | The source states that users exceeding Add-call frequency limits are temporarily blocked and may receive ErrorCode 21919144. |
| **Supported Sites** | Not specified in source |

---

## Description

Use this call to define one to five items and list them on the specified eBay site. Note: Sellers may be subject to call-rate limits for Add calls.

**Purpose:**
Use this call to define one to five items and list them on the specified eBay site. Note: Sellers may be subject to call-rate limits for Add calls. The Add calls include AddItem , AddFixedPriceItem , AddItems , VerifyAddItem , and VerifyAddFixedPriceItem .

**Use Cases:**
- Create and publish one to five listings in a single request.
- Batch multiple full item definitions using one AddItems call.
- Correlate each submitted item to its response using MessageID in each request container.

**Important Notes:**
- AddItems works like AddItem, but supports up to five items per request.
- Each listing must be defined in its own AddItemRequestContainer node.
- The call does not support multiple-variation listings.
- Users who exceed Add-call frequency limits are temporarily blocked from listing and may receive ErrorCode 21919144.

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
X-EBAY-API-COMPATIBILITY-LEVEL: 1217
X-EBAY-API-CALL-NAME: AddItems
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
<AddItemsRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <AddItemRequestContainer>
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
        <LocalListingDistance>string</LocalListingDistance>
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
  <MessageID>string</MessageID>
</AddItemRequestContainer>
<!-- ... more AddItemRequestContainer nodes allowed here ... -->
<!-- Standard Input Fields -->
<ErrorHandling></ErrorHandling>
<ErrorLanguage>string</ErrorLanguage>
<MessageID>string</MessageID>
<Version>string</Version>
<WarningLevel></WarningLevel>
</AddItemsRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| AddItemRequestContainer | AddItemRequestContainerType | Yes | An AddItemRequestContainer container is required for each listing that will be created with the AddItems request. Up to five of these containers can be included in one AddItems request. |

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
<AddItemsResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <AddItemResponseContainer>
    <Category2ID>string</Category2ID>
    <CategoryID>string</CategoryID>
    <CorrelationID>string</CorrelationID>
    <DiscountReason></DiscountReason>
    <!-- ... more DiscountReason values allowed here ... -->
    <EndTime>dateTime</EndTime>
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
    <Message>string</Message>
    <StartTime>dateTime</StartTime>
  </AddItemResponseContainer>
  <!-- ... more AddItemResponseContainer nodes allowed here ... -->
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
</AddItemsResponse>
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
| AddItemResponseContainer | AddItemResponseContainerType | Always | One AddItemResponseContainer container is returned for each listing that was created with the AddItems call. Each container includes the ItemID of each newly created listings, the eBay category each item is listed under, the seller-defined SKUs of the items (if any), the listing recommendations for each item (if applicable), the start and end time of each listing, and the estimated fees that each listing will incur. |

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

### AddItemsRequestType

**Description:** Base request type for the AddItems call, which is used to create one to five fixed-price, auction, or classified ad listings. The AddItems call does not support multiple-variation listings, so multiple-variation listings cannot be created with this call.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| AddItemRequestContainer | AddItemRequestContainerType | [0..unbounded] | An AddItemRequestContainer container is required for each listing that will be created with the AddItems request. Up to five of these containers can be included in one AddItems request. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<AddItemsRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <AddItemRequestContainer>
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
        <LocalListingDistance>string</LocalListingDistance>
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
  <MessageID>string</MessageID>
</AddItemRequestContainer>
<!-- ... more AddItemRequestContainer nodes allowed here ... -->
<!-- Standard Input Fields -->
<ErrorHandling></ErrorHandling>
<ErrorLanguage>string</ErrorLanguage>
<MessageID>string</MessageID>
<Version>string</Version>
<WarningLevel></WarningLevel>
</AddItemsRequest>
```

### AddItemsResponseType

**Description:** The response of the AddItems call. The response includes the Item IDs of the newly created listings, the eBay category each item is listed under, the seller-defined SKUs of the items (if any), the listing recommendations for each item (if applicable), the start and end time of each listing, and the estimated fees that each listing will incur.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| AddItemResponseContainer | AddItemResponseContainerType | [0..unbounded] | One AddItemResponseContainer container is returned for each listing that was created with the AddItems call. Each container includes the ItemID of each newly created listings, the eBay category each item is listed under, the seller-defined SKUs of the items (if any), the listing recommendations for each item (if applicable), the start and end time of each listing, and the estimated fees that each listing will incur. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<AddItemsResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <AddItemResponseContainer>
    <Category2ID>string</Category2ID>
    <CategoryID>string</CategoryID>
    <CorrelationID>string</CorrelationID>
    <DiscountReason></DiscountReason>
    <!-- ... more DiscountReason values allowed here ... -->
    <EndTime>dateTime</EndTime>
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
    <Message>string</Message>
    <StartTime>dateTime</StartTime>
  </AddItemResponseContainer>
  <!-- ... more AddItemResponseContainer nodes allowed here ... -->
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
</AddItemsResponse>
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

1. **One to five containers only**
   - Description: Each AddItems request can include up to five AddItemRequestContainer nodes.
   - Applies when: When batching listings with AddItems.
   - Impact: Larger listing batches require multiple calls.

2. **One full item definition per container**
   - Description: Each AddItemRequestContainer must carry a complete item definition.
   - Applies when: For every listing created through AddItems.
   - Impact: Incomplete container payloads cannot create a listing.

3. **No multi-variation support**
   - Description: AddItems cannot be used to create multiple-variation listings.
   - Applies when: When listing inventory with variations.
   - Impact: Use a different listing flow for multi-variation inventory.

### Revision Restrictions (If applicable)

| Condition | Allowed Changes | Prohibited Changes |
|-----------|-----------------|-------------------|
| Source does not provide a separate revision-restrictions table for this call | See operation-level rules and field descriptions | Not specified in source |

---

## Rate Limits & Throttling

| Metric | Limit | Window | Notes |
|--------|-------|--------|-------|
| API Calls | Not specified in source | Not specified in source | No long-window quota is explicitly provided in the extracted source. |
| Frequency | Subject to Add-call frequency limits | Not specified in source | The source states that users exceeding Add-call frequency limits are temporarily blocked and may receive ErrorCode 21919144. |

**Throttling Behavior:**
The source states that users exceeding Add-call frequency limits are temporarily blocked and may receive ErrorCode 21919144.

---

## Best Practices

1. **Use MessageID per item**
   - Set a MessageID inside each AddItemRequestContainer so that you can correlate each response container back to the submitted item.

2. **Batch small groups only**
   - Keep AddItems for batches of up to five listings and split larger workloads into multiple requests.

3. **Reuse AddItem guidance**
   - The source explicitly says to refer to AddItem for complete listing details and field-level behavior.

4. **Watch Add-call throttling**
   - High-volume listing workflows should handle temporary Add-call frequency blocks.

---

## Migration Path

### New API Equivalent

| SOAP Operation | New API | Type |
|----------------|---------|------|
| AddItems | Unknown createTask and uploadFile methods of Sell Feed API | Mutation |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_additems_html.jsonl`; `.trace_artifacts/extract_wsdl_additems.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
