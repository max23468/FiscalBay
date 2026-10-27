# GeteBayDetails - Traditional API (SOAP)

> **Call Name:** GeteBayDetails
> **API Type:** SOAP XML traditional API
> **API Version:** Not specified in source
> **Service:** Traditional

---

## Metadata

| Property | Value |
|----------|-------|
| **Call Type** | Not specified in source |
| **Deprecated** | Yes |
| **Replacement** | Sell Metadata getCurrencies; Sell Metadata getExcludeShippingLocations; Sell Metadata getHandlingTimes; Sell Metadata getShippingCarriers; Sell Metadata getShippingLocations; Sell Metadata getShippingServices |
| **Rate Limit** | Other Sources of Meta-data Sets and Specialized Data In addition to GeteBayDetails , you can use several other methods to get eBay site meta-data: GetCategories GetCategoryFeatures GetDescriptionTemplates Working with Custom Item Specifics (new method of working with Item Specifics ) Optimizing Your Calls The amount of data returned from a call depends on the listed DetailName values. |
| **Supported Sites** | Use this call to retrieve the available meta-data for the specified eBay site. |

---

## Description

Use this call to retrieve the available meta-data for the specified eBay site. By storing the information, you can keep your applications up to date with the latest details. In addition, you can use GeteBayDetails to look up site information instead referring to the documentation or the eBay online help system. You can also use GeteBayDetails to get the links to the eBay Content Logos, which you might be required to display in your applications per your API License Agreement.

**Purpose:**
Use this call to retrieve the available meta-data for the specified eBay site. By storing the information, you can keep your applications up to date with the latest details.

**Use Cases:**
- Call GeteBayDetails without any input fields to get the complete set of meta-data for the site whose ID you provide in the request header.
- To retrieve specific site information, use DetailName elements.
- See GeteBayDetails

**Important Notes:**
- It is recommended that you call GeteBayDetails once per week for each pertinent site ID and store the returned data for ease of lookup.

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
X-EBAY-API-CALL-NAME: GeteBayDetails
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
<GeteBayDetailsRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <DetailName></DetailName>
  <!-- ... more DetailName values allowed here ... -->
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GeteBayDetailsRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| Not specified in source | Not specified in source | Not specified in source | Not specified in source |

#### Optional Fields

| Field Path | Type | Default | Description | Constraints |
|------------|------|---------|-------------|-------------|
| DetailName | DetailNameCodeType | Not specified in source | One or more <b>DetailName</b> fields may be used to control the the type of metadata that is returned in the response. If no <b>DetailName</b> fields are used, all metadata will be returned in the response. It is a good idea to familiarize yourself with the metadata that can be returned with <b>GeteBayDetails</b> by reading through the enumeration values in <a href="types/DetailNameCodeType.html">DetailNameCodeType</a>. | Not specified in source |

#### Conditional Fields

| Field Path | Type | Condition | Description |
|------------|------|-----------|-------------|
| Not specified in source | Not specified in source | Not specified in source | Not specified in source |

## Response Structure

### XML Schema

```xml
<?xml version="1.0" encoding="utf-8"?>
<GeteBayDetailsResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <BuyerRequirementDetails>
    <DetailVersion>string</DetailVersion>
    <LinkedPayPalAccount>boolean</LinkedPayPalAccount>
    <MaximumBuyerPolicyViolations>
      <NumberOfPolicyViolations></NumberOfPolicyViolations>
      <PolicyViolationDuration></PolicyViolationDuration>
      <!-- ... more PolicyViolationDuration nodes allowed here ... -->
    </MaximumBuyerPolicyViolations>
    <MaximumItemRequirements>
      <MaximumItemCount>int</MaximumItemCount>
      <!-- ... more MaximumItemCount values allowed here ... -->
      <MinimumFeedbackScore>int</MinimumFeedbackScore>
      <!-- ... more MinimumFeedbackScore values allowed here ... -->
    </MaximumItemRequirements>
    <MaximumUnpaidItemStrikesInfo>
      <MaximumUnpaidItemStrikesCount>
        <Count>int</Count>
        <!-- ... more Count values allowed here ... -->
      </MaximumUnpaidItemStrikesCount>
      <MaximumUnpaidItemStrikesDuration>
        <Description>string</Description>
        <Period></Period>
      </MaximumUnpaidItemStrikesDuration>
      <!-- ... more MaximumUnpaidItemStrikesDuration nodes allowed here ... -->
    </MaximumUnpaidItemStrikesInfo>
    <MinimumFeedbackScore></MinimumFeedbackScore>
    <ShipToRegistrationCountry>boolean</ShipToRegistrationCountry>
    <UpdateTime>dateTime</UpdateTime>
  </BuyerRequirementDetails>
  <!-- ... more BuyerRequirementDetails nodes allowed here ... -->
  <CountryDetails>
    <Country></Country>
    <Description>string</Description>
    <DetailVersion>string</DetailVersion>
    <UpdateTime>dateTime</UpdateTime>
  </CountryDetails>
  <!-- ... more CountryDetails nodes allowed here ... -->
  <CurrencyDetails>
    <Currency></Currency>
    <Description>string</Description>
    <DetailVersion>string</DetailVersion>
    <UpdateTime>dateTime</UpdateTime>
  </CurrencyDetails>
  <!-- ... more CurrencyDetails nodes allowed here ... -->
  <DispatchTimeMaxDetails>
    <Description>string</Description>
    <DetailVersion>string</DetailVersion>
    <DispatchTimeMax>int</DispatchTimeMax>
    <ExtendedHandling>boolean</ExtendedHandling>
    <UpdateTime>dateTime</UpdateTime>
  </DispatchTimeMaxDetails>
  <!-- ... more DispatchTimeMaxDetails nodes allowed here ... -->
  <ExcludeShippingLocationDetails>
    <Description>string</Description>
    <DetailVersion>string</DetailVersion>
    <Location>string</Location>
    <Region>string</Region>
    <UpdateTime>dateTime</UpdateTime>
  </ExcludeShippingLocationDetails>
  <!-- ... more ExcludeShippingLocationDetails nodes allowed here ... -->
  <ItemSpecificDetails>
    <DetailVersion>string</DetailVersion>
    <MaxCharactersPerName>int</MaxCharactersPerName>
    <MaxCharactersPerValue>int</MaxCharactersPerValue>
    <MaxItemSpecificsPerItem>int</MaxItemSpecificsPerItem>
    <MaxValuesPerName>int</MaxValuesPerName>
    <UpdateTime>dateTime</UpdateTime>
  </ItemSpecificDetails>
  <!-- ... more ItemSpecificDetails nodes allowed here ... -->
  <ListingFeatureDetails>
    <BoldTitle></BoldTitle>
    <Border></Border>
    <DetailVersion>string</DetailVersion>
    <FeaturedFirst></FeaturedFirst>
    <FeaturedPlus></FeaturedPlus>
    <GiftIcon></GiftIcon>
    <Highlight></Highlight>
    <HomePageFeatured></HomePageFeatured>
    <ProPack></ProPack>
    <UpdateTime>dateTime</UpdateTime>
  </ListingFeatureDetails>
  <!-- ... more ListingFeatureDetails nodes allowed here ... -->
  <ListingStartPriceDetails>
    <Description>string</Description>
    <DetailVersion>string</DetailVersion>
    <ListingType></ListingType>
    <MinBuyItNowPricePercent>float</MinBuyItNowPricePercent>
    <StartPrice currencyID="CurrencyCodeType">
    </StartPrice>
    <UpdateTime>dateTime</UpdateTime>
  </ListingStartPriceDetails>
  <!-- ... more ListingStartPriceDetails nodes allowed here ... -->
  <PaymentOptionDetails>
    <Description>string</Description>
    <DetailVersion>string</DetailVersion>
    <PaymentOption></PaymentOption>
    <UpdateTime>dateTime</UpdateTime>
  </PaymentOptionDetails>
  <!-- ... more PaymentOptionDetails nodes allowed here ... -->
  <ProductDetails>
    <ProductIdentifierUnavailableText>string</ProductIdentifierUnavailableText>
  </ProductDetails>
  <RecoupmentPolicyDetails>
    <DetailVersion>string</DetailVersion>
    <EnforcedOnListingSite>boolean</EnforcedOnListingSite>
    <EnforcedOnRegistrationSite>boolean</EnforcedOnRegistrationSite>
    <UpdateTime>dateTime</UpdateTime>
  </RecoupmentPolicyDetails>
  <!-- ... more RecoupmentPolicyDetails nodes allowed here ... -->
  <RegionDetails></RegionDetails>
  <!-- ... more RegionDetails nodes allowed here ... -->
  <RegionOfOriginDetails></RegionOfOriginDetails>
  <!-- ... more RegionOfOriginDetails nodes allowed here ... -->
  <ReturnPolicyDetails>
    <Description>boolean</Description>
    <DetailVersion>string</DetailVersion>
    <Refund>
      <Description>string</Description>
      <RefundOption>token</RefundOption>
    </Refund>
    <!-- ... more Refund nodes allowed here ... -->
    <ReturnsAccepted>
      <Description>string</Description>
      <ReturnsAcceptedOption>token</ReturnsAcceptedOption>
    </ReturnsAccepted>
    <!-- ... more ReturnsAccepted nodes allowed here ... -->
    <ReturnsWithin>
      <Description>string</Description>
      <ReturnsWithinOption>token</ReturnsWithinOption>
    </ReturnsWithin>
    <!-- ... more ReturnsWithin nodes allowed here ... -->
    <ShippingCostPaidBy>
      <Description>string</Description>
      <ShippingCostPaidByOption>token</ShippingCostPaidByOption>
    </ShippingCostPaidBy>
    <!-- ... more ShippingCostPaidBy nodes allowed here ... -->
    <UpdateTime>dateTime</UpdateTime>
  </ReturnPolicyDetails>
  <ShippingCarrierDetails>
    <Description>string</Description>
    <DetailVersion>string</DetailVersion>
    <ShippingCarrier></ShippingCarrier>
    <ShippingCarrierID>int</ShippingCarrierID>
    <UpdateTime>dateTime</UpdateTime>
  </ShippingCarrierDetails>
  <!-- ... more ShippingCarrierDetails nodes allowed here ... -->
  <ShippingCategoryDetails>
    <Description>string</Description>
    <DetailVersion>string</DetailVersion>
    <ShippingCategory>token</ShippingCategory>
    <UpdateTime>dateTime</UpdateTime>
  </ShippingCategoryDetails>
  <!-- ... more ShippingCategoryDetails nodes allowed here ... -->
  <ShippingLocationDetails>
    <Description>string</Description>
    <DetailVersion>string</DetailVersion>
    <ShippingLocation>string</ShippingLocation>
    <UpdateTime>dateTime</UpdateTime>
  </ShippingLocationDetails>
  <!-- ... more ShippingLocationDetails nodes allowed here ... -->
  <ShippingPackageDetails>
    <DefaultValue>boolean</DefaultValue>
    <Description>string</Description>
    <DetailVersion>string</DetailVersion>
    <DimensionsSupported>boolean</DimensionsSupported>
    <PackageID>int</PackageID>
    <ShippingPackage></ShippingPackage>
    <UpdateTime>dateTime</UpdateTime>
  </ShippingPackageDetails>
  <!-- ... more ShippingPackageDetails nodes allowed here ... -->
  <ShippingServiceDetails>
    <CostGroupFlat>token</CostGroupFlat>
    <DeprecationDetails>
      <AnnouncementStartTime>dateTime</AnnouncementStartTime>
      <EventTime>dateTime</EventTime>
      <MessageType></MessageType>
    </DeprecationDetails>
    <!-- ... more DeprecationDetails nodes allowed here ... -->
    <Description>string</Description>
    <DetailVersion>string</DetailVersion>
    <DimensionsRequired>boolean</DimensionsRequired>
    <ExpeditedService>boolean</ExpeditedService>
    <InternationalService>boolean</InternationalService>
    <MappedToShippingServiceID>int</MappedToShippingServiceID>
    <ServiceType></ServiceType>
    <!-- ... more ServiceType values allowed here ... -->
    <ShippingCarrier></ShippingCarrier>
    <!-- ... more ShippingCarrier values allowed here ... -->
    <ShippingCategory>token</ShippingCategory>
    <ShippingPackage></ShippingPackage>
    <!-- ... more ShippingPackage values allowed here ... -->
    <ShippingService>token</ShippingService>
    <ShippingServiceID>int</ShippingServiceID>
    <ShippingServicePackageDetails>
      <DimensionsRequired>boolean</DimensionsRequired>
      <Name></Name>
    </ShippingServicePackageDetails>
    <!-- ... more ShippingServicePackageDetails nodes allowed here ... -->
    <ShippingTimeMax>int</ShippingTimeMax>
    <ShippingTimeMin>int</ShippingTimeMin>
    <SurchargeApplicable>boolean</SurchargeApplicable>
    <UpdateTime>dateTime</UpdateTime>
    <ValidForSellingFlow>boolean</ValidForSellingFlow>
    <WeightRequired>boolean</WeightRequired>
  </ShippingServiceDetails>
  <!-- ... more ShippingServiceDetails nodes allowed here ... -->
  <SiteDetails>
    <DetailVersion>string</DetailVersion>
    <Site></Site>
    <SiteID>int</SiteID>
    <UpdateTime>dateTime</UpdateTime>
  </SiteDetails>
  <!-- ... more SiteDetails nodes allowed here ... -->
  <TaxJurisdiction>
    <DetailVersion>string</DetailVersion>
    <JurisdictionID>string</JurisdictionID>
    <JurisdictionName>string</JurisdictionName>
    <UpdateTime>dateTime</UpdateTime>
  </TaxJurisdiction>
  <!-- ... more TaxJurisdiction nodes allowed here ... -->
  <TimeZoneDetails>
    <DaylightSavingsInEffect>boolean</DaylightSavingsInEffect>
    <DaylightSavingsLabel>string</DaylightSavingsLabel>
    <DaylightSavingsOffset>string</DaylightSavingsOffset>
    <DetailVersion>string</DetailVersion>
    <StandardLabel>string</StandardLabel>
    <StandardOffset>string</StandardOffset>
    <TimeZoneID>string</TimeZoneID>
    <UpdateTime>dateTime</UpdateTime>
  </TimeZoneDetails>
  <!-- ... more TimeZoneDetails nodes allowed here ... -->
  <UpdateTime>dateTime</UpdateTime>
  <URLDetails>
    <DetailVersion>string</DetailVersion>
    <UpdateTime>dateTime</UpdateTime>
    <URL>anyURI</URL>
    <URLType></URLType>
  </URLDetails>
  <!-- ... more URLDetails nodes allowed here ... -->
  <VariationDetails>
    <DetailVersion>string</DetailVersion>
    <MaxNamesPerVariationSpecificsSet>int</MaxNamesPerVariationSpecificsSet>
    <MaxValuesPerVariationSpecificsSetName>int</MaxValuesPerVariationSpecificsSetName>
    <MaxVariationsPerItem>int</MaxVariationsPerItem>
    <UpdateTime>dateTime</UpdateTime>
  </VariationDetails>
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
</GeteBayDetailsResponse>
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
| CountryDetails | CountryDetailsType | Conditionally | Lists the country code and associated name of the countries supported by the eBay system, regardless of the site specified in the request. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>CountryDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| CurrencyDetails | CurrencyDetailsType | Conditionally | Lists the currencies supported by the eBay system, regardless of the site specified in the request. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>CurrencyDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| DispatchTimeMaxDetails | DispatchTimeMaxDetailsType | Conditionally | A dispatch time specifies the maximum number of business days a seller commits to for shipping an item to domestic buyers after receiving a cleared payment. Returns all dispatch times in the system, regardless of the site specified in the request. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>DispatchTimeMaxDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| PaymentOptionDetails | PaymentOptionDetailsType | Conditionally | Although the supported payment methods for the specified eBay site are returned, it is recommended that the seller use <b>GetCategoryFeatures</b> instead, and pass in <b>PaymentMethods</b> as a <b>FeatureID</b> value in the request. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>PaymentOptionDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| RegionDetails | RegionDetailsType | Conditionally | Lists the cities and other domestic regions for the specified site's country. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>RegionDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| ShippingLocationDetails | ShippingLocationDetailsType | Conditionally | Lists the worldwide regions that can be set as shipping locations from the specified eBay site. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>ShippingLocationDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| ShippingServiceDetails | ShippingServiceDetailsType | Conditionally | Lists the shipping services supported by the specified eBay site. Returns only the shipping services that are applicable to the site specified in the request. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>ShippingServiceDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| SiteDetails | SiteDetailsType | Conditionally | Lists all available eBay sites and their associated <b>SiteID</b> numbers. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>SiteDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| TaxJurisdiction | TaxJurisdictionType | Conditionally | Details the different tax jurisdictions or tax regions applicable to the site specified in the request. Note that tax jurisdictions are only applicable to the following eBay sites: eBay US (Site ID 0), eBay Canada (Site ID 2), eBay Canada (French) (Site ID 210), and eBay India (Site ID 203). An empty response will be returned for any other Site ID that is passed in the HTTP header. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>TaxJurisdiction</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| URLDetails | URLDetailsType | Conditionally | Lists eBay URLs that are applicable to the site specified in the request. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>URLDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| TimeZoneDetails | TimeZoneDetailsType | Conditionally | Lists the details of the time zones supported by the eBay system. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>TimeZoneDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| ItemSpecificDetails | ItemSpecificDetailsType | Conditionally | Lists the site's maximum thresholds for specifying Item Specifics. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>ItemSpecificDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| RegionOfOriginDetails | RegionOfOriginDetailsType | Conditionally | Lists the worldwide regions and individual countries that can be set as shipping locations from the specified eBay site. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>RegionOfOriginDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| ShippingPackageDetails | ShippingPackageDetailsType | Conditionally | Lists the various shipping packages supported by the specified site. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>ShippingPackageDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| ShippingCarrierDetails | ShippingCarrierDetailsType | Conditionally | Lists the shipping carriers supported by the specified site. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>ShippingCarrierDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| ReturnPolicyDetails | ReturnPolicyDetailsType | Conditionally | Lists the supported values that may be used for return policies on the specified eBay site, such as the return period, supported restocking fees, and refund options. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>ReturnPolicyDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> <span class="tablenote"><b>Note: </b> This container has been staged for deprecation. Although domestic return policy metadata is still getting returned at the moment, it is recommended that users start making plans to use the <b>GetCategoryFeatures</b> call instead to retrieve category-level, domestic return policy metadata. </span> |
| ListingStartPriceDetails | ListingStartPriceDetailsType | Conditionally | Lists the minimum starting prices for the supported types of eBay listings. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>ListingStartPriceDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| BuyerRequirementDetails | SiteBuyerRequirementDetailsType | Conditionally | Lists the threshold values that can be passed in through the <b>BuyerRequirementDetails</b> container in the Add/Revise/Relist API calls. Buyer Requirements allow the seller to block buyers who have unpaid item defects, policy violations, low Feedback scores, and/or other undesirable qualities/statistics. Buyer Requirements are set at the seller's account level, but by using a <b>BuyerRequirementDetails</b> container in an Add/Revise/Relist API call, the values in that container will override values set at the account level. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>BuyerRequirementDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| ListingFeatureDetails | ListingFeatureDetailsType | Conditionally | Details the listing features available for the eBay site specified in the request. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>ListingFeatureDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| VariationDetails | VariationDetailsType | Conditionally | Site-level validation rules for multiple-variation listings (for example, the maximum number of variations per listing). Use <b>GetCategoryFeatures</b> to determine which categories on a site support variations. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>VariationDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| ExcludeShippingLocationDetails | ExcludeShippingLocationDetailsType | Conditionally | Lists the locations supported by the <b>ExcludeShipToLocation</b> feature. These are locations that a seller can list as areas where they will not ship an item. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>ExcludeShippingLocationDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| UpdateTime | dateTime | Always | The time of the most recent modification to any feature detail. If specific feature details are passed in the request, gives the most recent modification time of those feature details. |
| RecoupmentPolicyDetails | RecoupmentPolicyDetailsType | Conditionally | Details the recoupment policies for the site specified in the request. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>RecoupmentPolicyDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| ShippingCategoryDetails | ShippingCategoryDetailsType | Conditionally | A shipping service category supported for the site. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>ShippingCategoryDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> Each shipping service supported for a site is automatically categorized by eBay into one of the shipping categories available for that site depending on how the shipping service shipping time aligns with the shipping times specified by eBay for each category. <br><br> Notice that you cannot specify a <b>ShippingCategory</b> as an input to any API call - eBay does this categorizing automatically. <b>ShippingCategory</b> is read-only data that is returned in the <b>ShippingServiceDetails</b> container. One possible use of this data is to segregate shipping services by <b>ShippingCategory</b> in a pick list. (For an example of this, see the Services pulldown menu in the Give buyers shipping details form in the eBay Sell Your Item flow.) <br><br> One way to populate the picklist would be to call <b>GeteBayDetails</b> with <b>DetailName</b> set to <b>ShippingServiceDetails</b>. Then sort these results by <b>ShippingCategory</b> and populate the picklist. |
| ProductDetails | ProductDetailsType | Conditionally | The <b>ProductDetails.ProductIdentifierUnavailableText</b> field contains the actual text that should be passed into the relevant product identification fields (EAN, ISBN, UPC, MPN/Brand) if eBay is prompting/expecting one of these fields in the call request, but the identifiers do not exist/apply for the product. The text will vary based on the listing site. This text should only be used if no product ID exists for the product. If a product identifier value does actually exist for a product, but the seller passes in 'Does not apply' text, that listing may get penalized in search. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>ProductDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |

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

### GeteBayDetailsRequestType

**Description:** This is the base request type for the <b>GeteBayDetails</b> call. This call retrieves the latest eBay feature-related metadata values that are supported when listing items. This metadata includes country codes, currency codes, Item Specifics thresholds, supported Return Policy values, available shipping carriers and shipping service options, and more. This call may be used to keep metadata up-to-date in your applications. <br><br> In some cases, the data returned in the response will vary according to the eBay site that you use for the request.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| DetailName | DetailNameCodeType | [0..unbounded] | One or more <b>DetailName</b> fields may be used to control the the type of metadata that is returned in the response. If no <b>DetailName</b> fields are used, all metadata will be returned in the response. It is a good idea to familiarize yourself with the metadata that can be returned with <b>GeteBayDetails</b> by reading through the enumeration values in <a href="types/DetailNameCodeType.html">DetailNameCodeType</a>. |

**XML Example:**

Not specified in source

### GeteBayDetailsResponseType

**Description:** Details about a specified site in response to <b>GeteBayDetailsRequest</b>. If no <b>DetailName</b> field is identified in the request, all elements of <b>GeteBayDetailsResponse</b> are returned. Otherwise, eBay returns only the elements corresponding to the specified <b>DetailName</b> fields. <b>UpdateTime</b> gives the time of modification of the most recently modified <b>DetailName</b>.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| CountryDetails | CountryDetailsType | [0..unbounded] | Lists the country code and associated name of the countries supported by the eBay system, regardless of the site specified in the request. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>CountryDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| CurrencyDetails | CurrencyDetailsType | [0..unbounded] | Lists the currencies supported by the eBay system, regardless of the site specified in the request. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>CurrencyDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| DispatchTimeMaxDetails | DispatchTimeMaxDetailsType | [0..unbounded] | A dispatch time specifies the maximum number of business days a seller commits to for shipping an item to domestic buyers after receiving a cleared payment. Returns all dispatch times in the system, regardless of the site specified in the request. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>DispatchTimeMaxDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| PaymentOptionDetails | PaymentOptionDetailsType | [0..unbounded] | Although the supported payment methods for the specified eBay site are returned, it is recommended that the seller use <b>GetCategoryFeatures</b> instead, and pass in <b>PaymentMethods</b> as a <b>FeatureID</b> value in the request. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>PaymentOptionDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| RegionDetails | RegionDetailsType | [0..unbounded] | Lists the cities and other domestic regions for the specified site's country. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>RegionDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| ShippingLocationDetails | ShippingLocationDetailsType | [0..unbounded] | Lists the worldwide regions that can be set as shipping locations from the specified eBay site. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>ShippingLocationDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| ShippingServiceDetails | ShippingServiceDetailsType | [0..unbounded] | Lists the shipping services supported by the specified eBay site. Returns only the shipping services that are applicable to the site specified in the request. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>ShippingServiceDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| SiteDetails | SiteDetailsType | [0..unbounded] | Lists all available eBay sites and their associated <b>SiteID</b> numbers. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>SiteDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| TaxJurisdiction | TaxJurisdictionType | [0..unbounded] | Details the different tax jurisdictions or tax regions applicable to the site specified in the request. Note that tax jurisdictions are only applicable to the following eBay sites: eBay US (Site ID 0), eBay Canada (Site ID 2), eBay Canada (French) (Site ID 210), and eBay India (Site ID 203). An empty response will be returned for any other Site ID that is passed in the HTTP header. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>TaxJurisdiction</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| URLDetails | URLDetailsType | [0..unbounded] | Lists eBay URLs that are applicable to the site specified in the request. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>URLDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| TimeZoneDetails | TimeZoneDetailsType | [0..unbounded] | Lists the details of the time zones supported by the eBay system. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>TimeZoneDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| ItemSpecificDetails | ItemSpecificDetailsType | [0..unbounded] | Lists the site's maximum thresholds for specifying Item Specifics. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>ItemSpecificDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| RegionOfOriginDetails | RegionOfOriginDetailsType | [0..unbounded] | Lists the worldwide regions and individual countries that can be set as shipping locations from the specified eBay site. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>RegionOfOriginDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| ShippingPackageDetails | ShippingPackageDetailsType | [0..unbounded] | Lists the various shipping packages supported by the specified site. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>ShippingPackageDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| ShippingCarrierDetails | ShippingCarrierDetailsType | [0..unbounded] | Lists the shipping carriers supported by the specified site. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>ShippingCarrierDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| ReturnPolicyDetails | ReturnPolicyDetailsType | [0..1] | Lists the supported values that may be used for return policies on the specified eBay site, such as the return period, supported restocking fees, and refund options. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>ReturnPolicyDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> <span class="tablenote"><b>Note: </b> This container has been staged for deprecation. Although domestic return policy metadata is still getting returned at the moment, it is recommended that users start making plans to use the <b>GetCategoryFeatures</b> call instead to retrieve category-level, domestic return policy metadata. </span> |
| ListingStartPriceDetails | ListingStartPriceDetailsType | [0..unbounded] | Lists the minimum starting prices for the supported types of eBay listings. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>ListingStartPriceDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| BuyerRequirementDetails | SiteBuyerRequirementDetailsType | [0..unbounded] | Lists the threshold values that can be passed in through the <b>BuyerRequirementDetails</b> container in the Add/Revise/Relist API calls. Buyer Requirements allow the seller to block buyers who have unpaid item defects, policy violations, low Feedback scores, and/or other undesirable qualities/statistics. Buyer Requirements are set at the seller's account level, but by using a <b>BuyerRequirementDetails</b> container in an Add/Revise/Relist API call, the values in that container will override values set at the account level. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>BuyerRequirementDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| ListingFeatureDetails | ListingFeatureDetailsType | [0..unbounded] | Details the listing features available for the eBay site specified in the request. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>ListingFeatureDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| VariationDetails | VariationDetailsType | [0..1] | Site-level validation rules for multiple-variation listings (for example, the maximum number of variations per listing). Use <b>GetCategoryFeatures</b> to determine which categories on a site support variations. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>VariationDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| ExcludeShippingLocationDetails | ExcludeShippingLocationDetailsType | [0..unbounded] | Lists the locations supported by the <b>ExcludeShipToLocation</b> feature. These are locations that a seller can list as areas where they will not ship an item. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>ExcludeShippingLocationDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| UpdateTime | dateTime | [0..1] | The time of the most recent modification to any feature detail. If specific feature details are passed in the request, gives the most recent modification time of those feature details. |
| RecoupmentPolicyDetails | RecoupmentPolicyDetailsType | [0..unbounded] | Details the recoupment policies for the site specified in the request. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>RecoupmentPolicyDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |
| ShippingCategoryDetails | ShippingCategoryDetailsType | [0..unbounded] | A shipping service category supported for the site. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>ShippingCategoryDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> Each shipping service supported for a site is automatically categorized by eBay into one of the shipping categories available for that site depending on how the shipping service shipping time aligns with the shipping times specified by eBay for each category. <br><br> Notice that you cannot specify a <b>ShippingCategory</b> as an input to any API call - eBay does this categorizing automatically. <b>ShippingCategory</b> is read-only data that is returned in the <b>ShippingServiceDetails</b> container. One possible use of this data is to segregate shipping services by <b>ShippingCategory</b> in a pick list. (For an example of this, see the Services pulldown menu in the Give buyers shipping details form in the eBay Sell Your Item flow.) <br><br> One way to populate the picklist would be to call <b>GeteBayDetails</b> with <b>DetailName</b> set to <b>ShippingServiceDetails</b>. Then sort these results by <b>ShippingCategory</b> and populate the picklist. |
| ProductDetails | ProductDetailsType | [0..1] | The <b>ProductDetails.ProductIdentifierUnavailableText</b> field contains the actual text that should be passed into the relevant product identification fields (EAN, ISBN, UPC, MPN/Brand) if eBay is prompting/expecting one of these fields in the call request, but the identifiers do not exist/apply for the product. The text will vary based on the listing site. This text should only be used if no product ID exists for the product. If a product identifier value does actually exist for a product, but the seller passes in 'Does not apply' text, that listing may get penalized in search. <br/><br/> <span class="tablenote"><b>Note: </b> This container is only returned if <b>ProductDetails</b> is included as a <b>DetailName</b> filter in the request, or if no <b>DetailName</b> filters are used in the request. </span> |

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

#### DetailName
- **Max Length:** Not specified in source
- **Min Length:** Not specified in source
- **Pattern:** Not specified in source
- **Allowed Values:** Not specified in source
- **Dependencies:** No

### Operation-Level Rules

1. **Rule 1**
   - Description: You can also use GeteBayDetails to get the links to the eBay Content Logos, which you might be required to display in your applications per your API License Agreement.
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
| API Calls | Not specified in source | Not specified in source | Other Sources of Meta-data Sets and Specialized Data In addition to GeteBayDetails , you can use several other methods to get eBay site meta-data: GetCategories GetCategoryFeatures GetDescriptionTemplates Working with Custom Item Specifics (new method of working with Item Specifics ) Optimizing Your Calls The amount of data returned from a call depends on the listed DetailName values. |
| Frequency | Not specified in source | Not specified in source | Not specified in source |

**Throttling Behavior:**
Other Sources of Meta-data Sets and Specialized Data In addition to GeteBayDetails , you can use several other methods to get eBay site meta-data: GetCategories GetCategoryFeatures GetDescriptionTemplates Working with Custom Item Specifics (new method of working with Item Specifics ) Optimizing Your Calls The amount of data returned from a call depends on the listed DetailName values.

---

## Best Practices

1. **Practice 1**
   - To retrieve specific site information, use DetailName elements.
2. **Practice 2**
   - Best Practices The following sections list several hints and suggestions for working with GeteBayDetails .
3. **Error Handling**
   - Always check `Ack` value before processing response data
   - Log `CorrelationID` for debugging
   - Implement exponential backoff only when rate-limit behavior is documented in source
4. **Performance Optimization**
   - It is recommended that you call GeteBayDetails once per week for each pertinent site ID and store the returned data for ease of lookup.
   - Call GeteBayDetails without a DetailName value to retrieve all the information available for the specified site, or use DetailName fields to filter the information returned.

---

## HTTP Status Codes

Not specified in source

---

## Migration Path

| SOAP Operation | New API | Type | Endpoint | Notes |
|----------------|---------|------|----------|-------|
| GeteBayDetails | Sell Metadata / getCurrencies | GET | /sell/metadata/v1/marketplace/{marketplace_id}/get_currencies | Not specified in source |
| GeteBayDetails | Sell Metadata / getHandlingTimes | GET | /sell/metadata/v1/shipping/marketplace/{marketplace_id}/get_handling_times | Not specified in source |
| GeteBayDetails | Sell Metadata / getExcludeShippingLocations | GET | /sell/metadata/v1/shipping/marketplace/{marketplace_id}/get_exclude_shipping_locations | Not specified in source |
| GeteBayDetails | Sell Metadata / getShippingCarriers | GET | sell/metadata/v1/shipping/marketplace/{marketplace_id}/get_shipping_carriers | Not specified in source |
| GeteBayDetails | Sell Metadata / getShippingLocations | GET | /sell/metadata/v1/shipping/marketplace/{marketplace_id}/get_shipping_locations | Not specified in source |
| GeteBayDetails | Sell Metadata / getShippingServices | GET | /sell/metadata/v1/shipping/marketplace/{marketplace_id}/get_shipping_services | Not specified in source |

---

## Migration Notes

- New API family: Sell Metadata
  - Operation: getCurrencies
  - Type: GET
  - Endpoint: /sell/metadata/v1/marketplace/{marketplace_id}/get_currencies
  - Notes: Not specified in source
- New API family: Sell Metadata
  - Operation: getHandlingTimes
  - Type: GET
  - Endpoint: /sell/metadata/v1/shipping/marketplace/{marketplace_id}/get_handling_times
  - Notes: Not specified in source
- New API family: Sell Metadata
  - Operation: getExcludeShippingLocations
  - Type: GET
  - Endpoint: /sell/metadata/v1/shipping/marketplace/{marketplace_id}/get_exclude_shipping_locations
  - Notes: Not specified in source
- New API family: Sell Metadata
  - Operation: getShippingCarriers
  - Type: GET
  - Endpoint: sell/metadata/v1/shipping/marketplace/{marketplace_id}/get_shipping_carriers
  - Notes: Not specified in source
- New API family: Sell Metadata
  - Operation: getShippingLocations
  - Type: GET
  - Endpoint: /sell/metadata/v1/shipping/marketplace/{marketplace_id}/get_shipping_locations
  - Notes: Not specified in source
- New API family: Sell Metadata
  - Operation: getShippingServices
  - Type: GET
  - Endpoint: /sell/metadata/v1/shipping/marketplace/{marketplace_id}/get_shipping_services
  - Notes: Not specified in source
- Related calls in source: GeteBayDetails; GetBidderList, GeteBayDetails; GetItemsAwaitingFeedback

*Source: developer_ebay_com_devzone_xml_docs_reference_ebay_getebaydetails_html.jsonl | Generated: 2026-03-25 | Template Version: 1.0.0*
