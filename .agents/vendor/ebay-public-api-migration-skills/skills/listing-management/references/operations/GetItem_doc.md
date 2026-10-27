# GetItem - Traditional API (SOAP)

> **Call Name:** GetItem
> **API Type:** SOAP XML traditional API
> **API Version:** Not specified in source
> **Service:** Traditional

---

## Metadata

| Property | Value |
|----------|-------|
| **Call Type** | Not specified in source |
| **Deprecated** | Yes |
| **Replacement** | Listing API; Listing API sellerListings query of Listing API Note: The Browse API can also be used, but the sellerListings query is specifically designed to check the created or revised listing and this query will show some seller-provided data that will not be shown in the Browse API. |
| **Rate Limit** | Make multiple calls to GetItem to review details for more than a single item. Rather than repeating calls to GetItem to retrieve data for multiple items listed by the same seller, use GetSellerList instead. Automatic polling frequency can be increased during the last four hours of an auction. |
| **Supported Sites** | Use this call to retrieve the data for a single item listed on an eBay site. |

---

## Description

Use this call to retrieve the data for a single item listed on an eBay site. GetItem returns the data in an Item object. This call is conceptually similar to eBay's View item page. Data returned includes the item's title, description, price information, seller information, shipping details, high bidder information (if there currently is a high bidder), and so on.

**Purpose:**
Use this call to retrieve the data for a single item listed on an eBay site. GetItem returns the data in an Item object.

**Use Cases:**
- GetItem returns item data for only a single item per call.
- Make multiple calls to GetItem to review details for more than a single item.
- GetItem returns different sets of item information depending on how you set the DetailLevel input field.

**Important Notes:**
- GetItem returns item data for only a single item per call.
- Only increase the frequency if the user is logged in and active in the system.
- You can test GetItem in the Sandbox.
- However, you must have existing items in the Sandbox before you can call GetItem .
- Below are some test case scenarios to consider: Some data values are only returned if the call requestor is the same as the one who listed the item.

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
X-EBAY-API-CALL-NAME: GetItem
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
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <IncludeItemCompatibilityList>boolean</IncludeItemCompatibilityList>
  <IncludeItemSpecifics>boolean</IncludeItemSpecifics>
  <IncludeTaxTable>boolean</IncludeTaxTable>
  <IncludeWatchCount>boolean</IncludeWatchCount>
  <ItemID></ItemID>
  <SKU></SKU>
  <TransactionID>string</TransactionID>
  <VariationSKU></VariationSKU>
  <VariationSpecifics>
    <NameValueList>
      <Name>string</Name>
      <Value>string</Value>
      <!-- ... more Value values allowed here ... -->
    </NameValueList>
    <!-- ... more NameValueList nodes allowed here ... -->
  </VariationSpecifics>
  <!-- Standard Input Fields -->
  <DetailLevel></DetailLevel>
  <!-- ... more DetailLevel values allowed here ... -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <OutputSelector>string</OutputSelector>
  <!-- ... more OutputSelector values allowed here ... -->
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetItemRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| Not specified in source | Not specified in source | Not specified in source | Not specified in source |

#### Optional Fields

| Field Path | Type | Default | Description | Constraints |
|------------|------|---------|-------------|-------------|
| IncludeWatchCount | boolean | false | The seller can include this field and set its value to <code>true</code> if that seller wants to see how many prospective bidders/buyers currently have the item added to their Watch Lists. The Watch count is returned in the <b>WatchCount</b> field in the response. <br> <br> This field will only be returnd to the seller of the item. | Default: false |
| IncludeItemSpecifics | boolean | false | If this field is included and set to <code>true</code>, the call response includes the <b>ItemSpecifics</b> container if Item Specifics are defined for the listing.<br> <br> An Item Specific is any aspect that helps define/classify the item. Many eBay categories mandate including specific Item Specifics, so it is always a good idea to make a call to the <a href="/api-docs/commerce/taxonomy/resources/category_tree/methods/getItemAspectsForCategory" target="_blank">getItemAspectsForCategory</a> method of the Taxonomy API to see what Item Specifics are required and which ones are recommended.<br> <br> Including this field and setting it to <code>true</code> will also return the <strong>UnitInfo</strong> container if applicable. The <strong>UnitInfo</strong> container will provide information about the weight, volume or other quantity measurement of a listed item. The European Union requires listings for certain types of products to include the price per unit so buyers can accurately compare prices. eBay uses the <strong>UnitType</strong> and <strong>UnitQuantity</strong> values and the item's listed price to calculate and display the per-unit price on eBay EU sites. | Default: false |
| IncludeTaxTable | boolean | false | The seller will include this field and set its value to <code>true</code> if the seller wishes to view the defined sales tax rates for the various jurisdictions in the country (generally, states and provinces). Information for each defined sales tax rate will be returned in the <b>TaxTable</b> container in the response. <br/><br/> Even if this field is included and set to <code>true</code>, no <b>TaxTable</b> container will be returned If no sales tax rates are defined for any tax jurisdiction in the seller's sales tax table. <br/><br/> Sales tax tables are only available for eBay US and Canada marketplaces. Sales tax rates can be added/modified in My eBay, through the <b>SetTaxTable</b> and <b>GetTaxTable</b> calls of the Traditional API, or through the Sales Tax calls of the Account API. | Default: false |
| IncludeItemCompatibilityList | boolean | false | This field is used to specify whether or not to retrieve Parts Compatiblity information for a motor part or accessory listing. If this field is included and set to <code>true</code>, the <b>Item.ItemCompatibilityList</b> container will be returned if a Parts Compatibility list exists for the listing. A Parts Compatibility list is a list of motor vehicles that are compatible with the listed motor part or accesory item. If a Parts Compatibility list does not exist for the listing, this field will have no effect if it is included, regardless of its value (<code>true</code> or <code>false</code>). <br><br> If this field is included and set to <code>false</code> or omitted, but a Parts Compatibility list does exist for the listing, the <b>Item.ItemCompatibilityList</b> container will not be returned, but the <b>Item.ItemCompatibilityCount</b> field will be returned, and this field will simply indicate the quantity of motor vehicles that are compatible with the the listed motor part or accesory item. <br><br> Parts Compatibility lists are only applicable to motor parts and accessory categories on the sites that support eBay Motors - US, CA, UK, and DE. | Default: false |

#### Conditional Fields

| Field Path | Type | Condition | Description |
|------------|------|-----------|-------------|
| ItemID | ItemIDType | Conditionally | This field is used to identify the eBay listing by Item ID value. <br><br> <b>ItemID</b> is a required input in most cases. <b>SKU</b> can be used instead in certain cases (see the description of SKU). If both <b>ItemID</b> and <b>SKU</b> are specified for items where the inventory tracking method is <b>ItemID</b>, <b>ItemID</b> takes precedence. |
| SKU | SKUType | Conditionally | Retrieves an item that was listed by the user identified in AuthToken and that is being tracked by this SKU.<br> <br> A SKU (stock keeping unit) is an identifier defined by a seller. Some sellers use SKUs to track complex flows of products and information on the client side. eBay preserves the SKU on the item, enabling you to obtain it before and after an order line item is created. (SKU is recommended as an alternative to ApplicationData.)<br> <br> In <b>GetItem</b>, <b>SKU</b> can only be used to retrieve one of your own items, where you listed the item by using <b>AddFixedPriceItem</b> or <b>RelistFixedPriceItem</b>, and you set <b>Item.InventoryTrackingMethod</b> to <b>SKU</b> at the time the item was listed. (These criteria are necessary to uniquely identify the listing by a SKU.)<br> <br> Either <b>ItemID</b> or <b>SKU</b> is required in the request. If both are passed, they must refer to the same item, and that item must have <b>InventoryTrackingMethod</b> set to <b>SKU</b>. |
| VariationSKU | SKUType | Conditionally | Variation-level SKU that uniquely identifes a Variation within the listing identified by <b>ItemID</b>. Only applicable when the seller listed the item with Variation-level SKU (<b>Variation.SKU</b>) values. Retrieves all the usual <b>Item</b> fields, but limits the <b>Variations</b> content to the specified Variation. If not specified, the response includes all Variations. |
| VariationSpecifics | NameValueListArrayType | Conditionally | Name-value pairs that identify one or more Variations within the listing identified by <b>ItemID</b>. Only applicable when the seller listed the item with Variations. Retrieves all the usual <b>Item</b> fields, but limits the Variations content to the specified Variation(s). If the specified pairs do not match any Variation, eBay returns all Variations.<br> <br> To retrieve only one variation, specify the full set of name/value pairs that match all the name-value pairs of one Variation. <br> <br> To retrieve multiple variations (using a wildcard), specify one or more name/value pairs that partially match the desired variations. For example, if the listing contains Variations for shirts in different colors and sizes, specify Color as Red (and no other name/value pairs) to retrieve all the red shirts in all sizes (but no other colors). |
| TransactionID | string | Conditionally | A unique identifier for an order line item. An order line item is created when a buyer commits to purchasing an item. <br><br> Since you can change active multiple-quantity fixed-price listings even after one of the items has been purchased, the <b>TransactionID</b> is associated with a snapshot of the item data at the time of the purchase. <br><br> After one item in a multi-quantity listing has been sold, sellers can not change the values in the Title, Primary Category, Secondary Category, Listing Duration, and Listing Type fields. However, all other fields are editable. <br><br> Specifying a <b>TransactionID</b> in the <b>GetItem</b> request allows you to retrieve a snapshot of the listing as it was when the order line item was created. <br> <br> The <b>TransactionID</b> value for auction listings is always <code>0</code> since there can be only one winning bidder/one sale for an auction listing. <br/><br/> <span class="tablenote"><b>Note: </b> Beginning in July 2024, non-zero transaction IDs will start being returned for auction listings. If necessary, update code to handle non-zero transaction IDs for auction transactions before this time. </span> |

## Response Structure

### XML Schema

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <Item>
    <ApplicationData>string</ApplicationData>
    <ApplyBuyerProtection>
      <BuyerProtectionSource></BuyerProtectionSource>
      <BuyerProtectionStatus></BuyerProtectionStatus>
    </ApplyBuyerProtection>
    <AutoPay>boolean</AutoPay>
    <AvailableForPickupDropOff>boolean</AvailableForPickupDropOff>
    <BestOfferDetails>
      <BestOfferCount>int</BestOfferCount>
      <BestOfferEnabled>boolean</BestOfferEnabled>
    </BestOfferDetails>
    <BusinessSellerDetails>
      <AdditionalContactInformation>string</AdditionalContactInformation>
      <Address>
        <FirstName>string</FirstName>
        <LastName>string</LastName>
      </Address>
      <Email>string</Email>
      <Fax>string</Fax>
      <LegalInvoice>boolean</LegalInvoice>
      <TermsAndConditions>string</TermsAndConditions>
      <TradeRegistrationNumber>string</TradeRegistrationNumber>
      <VATDetails>
        <BusinessSeller>boolean</BusinessSeller>
        <RestrictedToBusiness>boolean</RestrictedToBusiness>
        <VATID>string</VATID>
        <VATPercent>float</VATPercent>
        <VATSite>string</VATSite>
      </VATDetails>
    </BusinessSellerDetails>
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
    <ConditionDefinition>string</ConditionDefinition>
    <ConditionDescriptors>
      <ConditionDescriptor>
        <AdditionalInfo>string</AdditionalInfo>
        <Name>string</Name>
        <Value>string</Value>
        <!-- ... more Value values allowed here ... -->
      </ConditionDescriptor>
      <!-- ... more ConditionDescriptor nodes allowed here ... -->
    </ConditionDescriptors>
    <ConditionDisplayName>string</ConditionDisplayName>
    <ConditionID>int</ConditionID>
    <Country></Country>
    <CrossBorderTrade>string</CrossBorderTrade>
    <!-- ... more CrossBorderTrade values allowed here ... -->
    <Currency></Currency>
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
      <PricingTreatment></PricingTreatment>
      <SoldOffeBay>boolean</SoldOffeBay>
      <SoldOneBay>boolean</SoldOneBay>
    </DiscountPriceInfo>
    <DispatchTimeMax>int</DispatchTimeMax>
    <eBayPlus>boolean</eBayPlus>
    <eBayPlusEligible>boolean</eBayPlusEligible>
    <EligibleForPickupDropOff>boolean</EligibleForPickupDropOff>
    <eMailDeliveryAvailable>boolean</eMailDeliveryAvailable>
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
    <FreeAddedCategory>
      <CategoryID>string</CategoryID>
      <CategoryName>string</CategoryName>
    </FreeAddedCategory>
    <HideFromSearch>boolean</HideFromSearch>
    <IgnoreQuantity>boolean</IgnoreQuantity>
    <IntegratedMerchantCreditCardEnabled>boolean</IntegratedMerchantCreditCardEnabled>
    <InventoryTrackingMethod></InventoryTrackingMethod>
    <IsIntermediatedShippingEligible>boolean</IsIntermediatedShippingEligible>
    <IsItemEMSEligible>boolean</IsItemEMSEligible>
    <IsSecureDescription>boolean</IsSecureDescription>
    <ItemCompatibilityCount>int</ItemCompatibilityCount>
    <ItemCompatibilityList>
      <Compatibility>
        <CompatibilityNotes>string</CompatibilityNotes>
        <NameValueList>
          <Name>string</Name>
          <Source></Source>
          <Value>string</Value>
          <!-- ... more Value values allowed here ... -->
        </NameValueList>
        <!-- ... more NameValueList nodes allowed here ... -->
      </Compatibility>
      <!-- ... more Compatibility nodes allowed here ... -->
    </ItemCompatibilityList>
    <ItemID></ItemID>
    <ItemPolicyViolation>
      <PolicyID>long</PolicyID>
      <PolicyText>string</PolicyText>
    </ItemPolicyViolation>
    <ItemSpecifics>
      <NameValueList>
        <Name>string</Name>
        <Source></Source>
        <Value>string</Value>
        <!-- ... more Value values allowed here ... -->
      </NameValueList>
      <!-- ... more NameValueList nodes allowed here ... -->
    </ItemSpecifics>
    <ListingDetails>
      <Adult>boolean</Adult>
      <BestOfferAutoAcceptPrice currencyID="CurrencyCodeType">
      </BestOfferAutoAcceptPrice>
      <BindingAuction>boolean</BindingAuction>
      <BuyItNowAvailable>boolean</BuyItNowAvailable>
      <CheckoutEnabled>boolean</CheckoutEnabled>
      <ConvertedBuyItNowPrice currencyID="CurrencyCodeType">
      </ConvertedBuyItNowPrice>
      <ConvertedReservePrice currencyID="CurrencyCodeType">
      </ConvertedReservePrice>
      <ConvertedStartPrice currencyID="CurrencyCodeType">
      </ConvertedStartPrice>
      <EndingReason></EndingReason>
      <EndTime>dateTime</EndTime>
      <HasPublicMessages>boolean</HasPublicMessages>
      <HasReservePrice>boolean</HasReservePrice>
      <HasUnansweredQuestions>boolean</HasUnansweredQuestions>
      <MinimumBestOfferPrice currencyID="CurrencyCodeType">
      </MinimumBestOfferPrice>
      <RelistedItemID></RelistedItemID>
      <SecondChanceOriginalItemID></SecondChanceOriginalItemID>
      <StartTime>dateTime</StartTime>
      <ViewItemURL>anyURI</ViewItemURL>
      <ViewItemURLForNaturalSearch>anyURI</ViewItemURLForNaturalSearch>
    </ListingDetails>
    <ListingDuration>token</ListingDuration>
    <ListingEnhancement></ListingEnhancement>
    <!-- ... more ListingEnhancement values allowed here ... -->
    <ListingSubtype2></ListingSubtype2>
    <ListingType></ListingType>
    <Location>string</Location>
    <LocationDefaulted>boolean</LocationDefaulted>
    <LotSize>int</LotSize>
    <MechanicalCheckAccepted>boolean</MechanicalCheckAccepted>
    <PaymentAllowedSite></PaymentAllowedSite>
    <!-- ... more PaymentAllowedSite values allowed here ... -->
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
      <EligibleForPickupDropOff>boolean</EligibleForPickupDropOff>
      <EligibleForPickupInStore>boolean</EligibleForPickupInStore>
    </PickupInStoreDetails>
    <PictureDetails>
      <ExtendedPictureDetails>
        <PictureURLs>
          <eBayPictureURL>anyURI</eBayPictureURL>
          <!-- ... more eBayPictureURL values allowed here ... -->
          <ExternalPictureURL>anyURI</ExternalPictureURL>
        </PictureURLs>
        <!-- ... more PictureURLs nodes allowed here ... -->
      </ExtendedPictureDetails>
      <ExternalPictureURL>anyURI</ExternalPictureURL>
      <GalleryErrorInfo>string</GalleryErrorInfo>
      <GalleryStatus></GalleryStatus>
      <GalleryType></GalleryType>
      <PictureSource></PictureSource>
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
      <BrandMPN>
        <Brand>string</Brand>
        <MPN>string</MPN>
      </BrandMPN>
      <Copyright>string</Copyright>
      <!-- ... more Copyright values allowed here ... -->
      <EAN>string</EAN>
      <IncludeeBayProductDetails>boolean</IncludeeBayProductDetails>
      <IncludeStockPhotoURL>boolean</IncludeStockPhotoURL>
      <ISBN>string</ISBN>
      <ProductReferenceID>string</ProductReferenceID>
      <StockPhotoURL>anyURI</StockPhotoURL>
      <UPC>string</UPC>
      <UseStockPhotoURLAsGallery>boolean</UseStockPhotoURLAsGallery>
    </ProductListingDetails>
    <ProxyItem>boolean</ProxyItem>
    <Quantity>int</Quantity>
    <QuantityAvailableHint></QuantityAvailableHint>
    <QuantityThreshold>int</QuantityThreshold>
    <ReasonHideFromSearch></ReasonHideFromSearch>
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
        <Statements></Statements>
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
        <Statements></Statements>
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
  <RelistParentID>long</RelistParentID>
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
    <PositiveFeedbackPercent>float</PositiveFeedbackPercent>
    <RegistrationAddress>
      <CityName>string</CityName>
      <Country></Country>
      <CountryName>string</CountryName>
      <FirstName>string</FirstName>
      <LastName>string</LastName>
      <Name>string</Name>
      <Phone>string</Phone>
      <PostalCode>string</PostalCode>
      <Street>string</Street>
      <Street1>string</Street1>
      <Street2>string</Street2>
    </RegistrationAddress>
    <RegistrationDate>dateTime</RegistrationDate>
    <SellerInfo>
      <AllowPaymentEdit>boolean</AllowPaymentEdit>
      <BillingCurrency></BillingCurrency>
      <CheckoutEnabled>boolean</CheckoutEnabled>
      <CIPBankAccountStored>boolean</CIPBankAccountStored>
      <GoodStanding>boolean</GoodStanding>
      <QualifiesForB2BVAT>boolean</QualifiesForB2BVAT>
      <SafePaymentExempt>boolean</SafePaymentExempt>
      <SellerBusinessType></SellerBusinessType>
      <SellerLevel></SellerLevel>
      <StoreOwner>boolean</StoreOwner>
      <StoreURL>anyURI</StoreURL>
      <TopRatedSeller>boolean</TopRatedSeller>
    </SellerInfo>
    <Site></Site>
    <Status></Status>
    <UserID></UserID>
    <UserIDChanged>boolean</UserIDChanged>
    <UserIDLastChanged>dateTime</UserIDLastChanged>
    <VATStatus></VATStatus>
  </Seller>
  <SellerContactDetails>
    <CompanyName>string</CompanyName>
    <County>string</County>
    <FirstName>string</FirstName>
    <LastName>string</LastName>
    <PhoneAreaOrCityCode>string</PhoneAreaOrCityCode>
    <PhoneCountryCode></PhoneCountryCode>
    <PhoneCountryPrefix>string</PhoneCountryPrefix>
    <PhoneLocalNumber>string</PhoneLocalNumber>
    <Street1>string</Street1>
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
  <SellerVacationNote>string</SellerVacationNote>
  <SellingStatus>
    <AdminEnded>boolean</AdminEnded>
    <BidCount>int</BidCount>
    <BidIncrement currencyID="CurrencyCodeType">
    </BidIncrement>
    <ConvertedCurrentPrice currencyID="CurrencyCodeType">
    </ConvertedCurrentPrice>
    <CurrentPrice currencyID="CurrencyCodeType">
    </CurrentPrice>
    <HighBidder>
      <AboutMePage>boolean</AboutMePage>
      <BuyerInfo>
        <ShippingAddress>
          <Country></Country>
          <FirstName>string</FirstName>
          <LastName>string</LastName>
          <PostalCode>string</PostalCode>
        </ShippingAddress>
      </BuyerInfo>
      <eBayGoodStanding>boolean</eBayGoodStanding>
      <Email>string</Email>
      <FeedbackPrivate>boolean</FeedbackPrivate>
      <FeedbackRatingStar></FeedbackRatingStar>
      <FeedbackScore>int</FeedbackScore>
      <IDVerified>boolean</IDVerified>
      <NewUser>boolean</NewUser>
      <PositiveFeedbackPercent>float</PositiveFeedbackPercent>
      <RegistrationAddress>
        <CityName>string</CityName>
        <Country></Country>
        <CountryName>string</CountryName>
        <FirstName>string</FirstName>
        <LastName>string</LastName>
        <Name>string</Name>
        <Phone>string</Phone>
        <PostalCode>string</PostalCode>
        <Street>string</Street>
        <Street1>string</Street1>
        <Street2>string</Street2>
      </RegistrationAddress>
      <RegistrationDate>dateTime</RegistrationDate>
      <Site></Site>
      <Status></Status>
      <UserAnonymized>boolean</UserAnonymized>
      <UserID></UserID>
      <UserIDChanged>boolean</UserIDChanged>
      <UserIDLastChanged>dateTime</UserIDLastChanged>
      <VATStatus></VATStatus>
    </HighBidder>
    <LeadCount>int</LeadCount>
    <ListingOnHold>boolean</ListingOnHold>
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
    <QuantitySoldByPickupInStore>int</QuantitySoldByPickupInStore>
    <ReserveMet>boolean</ReserveMet>
    <SecondChanceEligible>boolean</SecondChanceEligible>
    <SoldAsBin>boolean</SoldAsBin>
  </SellingStatus>
  <ShippingDetails>
    <CalculatedShippingDiscount>
      <DiscountName></DiscountName>
      <DiscountProfile>
        <DiscountProfileID>string</DiscountProfileID>
        <DiscountProfileName>string</DiscountProfileName>
        <MappedDiscountProfileID>string</MappedDiscountProfileID>
        <WeightOff unit="token" measurementSystem="MeasurementSystemCodeType">
        </WeightOff>
      </DiscountProfile>
      <!-- ... more DiscountProfile nodes allowed here ... -->
    </CalculatedShippingDiscount>
    <CalculatedShippingRate>
      <InternationalPackagingHandlingCosts currencyID="CurrencyCodeType">
      </InternationalPackagingHandlingCosts>
      <PackagingHandlingCosts currencyID="CurrencyCodeType">
      </PackagingHandlingCosts>
    </CalculatedShippingRate>
    <ExcludeShipToLocation>string</ExcludeShipToLocation>
    <!-- ... more ExcludeShipToLocation values allowed here ... -->
    <FlatShippingDiscount>
      <DiscountName></DiscountName>
      <DiscountProfile>
        <DiscountProfileID>string</DiscountProfileID>
        <DiscountProfileName>string</DiscountProfileName>
        <EachAdditionalAmount currencyID="CurrencyCodeType">
        </EachAdditionalAmount>
        <EachAdditionalAmountOff currencyID="CurrencyCodeType">
        </EachAdditionalAmountOff>
        <EachAdditionalPercentOff>float</EachAdditionalPercentOff>
      </DiscountProfile>
      <!-- ... more DiscountProfile nodes allowed here ... -->
    </FlatShippingDiscount>
    <GetItFast>boolean</GetItFast>
    <GlobalShipping>boolean</GlobalShipping>
    <InternationalCalculatedShippingDiscount>
      <DiscountName></DiscountName>
      <DiscountProfile>
        <DiscountProfileID>string</DiscountProfileID>
        <DiscountProfileName>string</DiscountProfileName>
        <MappedDiscountProfileID>string</MappedDiscountProfileID>
        <WeightOff unit="token" measurementSystem="MeasurementSystemCodeType">
        </WeightOff>
      </DiscountProfile>
      <!-- ... more DiscountProfile nodes allowed here ... -->
    </InternationalCalculatedShippingDiscount>
    <InternationalFlatShippingDiscount>
      <DiscountName></DiscountName>
      <DiscountProfile>
        <DiscountProfileID>string</DiscountProfileID>
        <DiscountProfileName>string</DiscountProfileName>
        <EachAdditionalAmount currencyID="CurrencyCodeType">
        </EachAdditionalAmount>
        <EachAdditionalAmountOff currencyID="CurrencyCodeType">
        </EachAdditionalAmountOff>
        <EachAdditionalPercentOff>float</EachAdditionalPercentOff>
      </DiscountProfile>
      <!-- ... more DiscountProfile nodes allowed here ... -->
    </InternationalFlatShippingDiscount>
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
    <PromotionalShippingDiscountDetails>
      <DiscountName></DiscountName>
      <ItemCount>int</ItemCount>
      <OrderAmount currencyID="CurrencyCodeType">
      </OrderAmount>
      <ShippingCost currencyID="CurrencyCodeType">
      </ShippingCost>
    </PromotionalShippingDiscountDetails>
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
    <SellerExcludeShipToLocationsPreference>boolean</SellerExcludeShipToLocationsPreference>
    <ShippingDiscountProfileID>string</ShippingDiscountProfileID>
    <ShippingServiceOptions>
      <ExpeditedService>boolean</ExpeditedService>
      <FreeShipping>boolean</FreeShipping>
      <ShippingService>token</ShippingService>
      <ShippingServiceAdditionalCost currencyID="CurrencyCodeType">
      </ShippingServiceAdditionalCost>
      <ShippingServiceCost currencyID="CurrencyCodeType">
      </ShippingServiceCost>
      <ShippingServicePriority>int</ShippingServicePriority>
      <ShippingTimeMax>int</ShippingTimeMax>
      <ShippingTimeMin>int</ShippingTimeMin>
    </ShippingServiceOptions>
    <!-- ... more ShippingServiceOptions nodes allowed here ... -->
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
  <ShippingPackageDetails>
    <PackageDepth unit="token" measurementSystem="MeasurementSystemCodeType">
    </PackageDepth>
    <PackageLength unit="token" measurementSystem="MeasurementSystemCodeType">
    </PackageLength>
    <PackageWidth unit="token" measurementSystem="MeasurementSystemCodeType">
    </PackageWidth>
    <ShippingIrregular>boolean</ShippingIrregular>
    <ShippingPackage></ShippingPackage>
    <WeightMajor unit="token" measurementSystem="MeasurementSystemCodeType">
    </WeightMajor>
    <WeightMinor unit="token" measurementSystem="MeasurementSystemCodeType">
    </WeightMinor>
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
    <StoreCategoryID>long</StoreCategoryID>
    <StoreURL>anyURI</StoreURL>
  </Storefront>
  <SubTitle>string</SubTitle>
  <TaxCategory>string</TaxCategory>
  <TimeLeft>duration</TimeLeft>
  <Title>string</Title>
  <TopRatedListing>boolean</TopRatedListing>
  <UnitInfo>
    <UnitQuantity>double</UnitQuantity>
    <UnitType>string</UnitType>
  </UnitInfo>
  <UUID></UUID>
  <Variations>
    <Pictures>
      <VariationSpecificName>string</VariationSpecificName>
      <VariationSpecificPictureSet>
        <ExtendedPictureDetails>
          <PictureURLs>
            <eBayPictureURL>anyURI</eBayPictureURL>
            <!-- ... more eBayPictureURL values allowed here ... -->
            <ExternalPictureURL>anyURI</ExternalPictureURL>
          </PictureURLs>
          <!-- ... more PictureURLs nodes allowed here ... -->
        </ExtendedPictureDetails>
        <ExternalPictureURL>anyURI</ExternalPictureURL>
        <!-- ... more ExternalPictureURL values allowed here ... -->
        <PictureURL>anyURI</PictureURL>
        <!-- ... more PictureURL values allowed here ... -->
        <VariationSpecificValue>string</VariationSpecificValue>
      </VariationSpecificPictureSet>
      <!-- ... more VariationSpecificPictureSet nodes allowed here ... -->
    </Pictures>
    <Variation>
      <DiscountPriceInfo>
        <MadeForOutletComparisonPrice currencyID="CurrencyCodeType">
        </MadeForOutletComparisonPrice>
        <MinimumAdvertisedPrice currencyID="CurrencyCodeType">
        </MinimumAdvertisedPrice>
        <MinimumAdvertisedPriceExposure></MinimumAdvertisedPriceExposure>
        <OriginalRetailPrice currencyID="CurrencyCodeType">
        </OriginalRetailPrice>
        <PricingTreatment></PricingTreatment>
        <SoldOffeBay>boolean</SoldOffeBay>
        <SoldOneBay>boolean</SoldOneBay>
      </DiscountPriceInfo>
      <Quantity>int</Quantity>
      <SellingStatus>
        <AdminEnded>boolean</AdminEnded>
        <BidCount>int</BidCount>
        <BidIncrement currencyID="CurrencyCodeType">
        </BidIncrement>
        <ConvertedCurrentPrice currencyID="CurrencyCodeType">
        </ConvertedCurrentPrice>
        <CurrentPrice currencyID="CurrencyCodeType">
        </CurrentPrice>
        <HighBidder>
          <AboutMePage>boolean</AboutMePage>
          <BuyerInfo>
            <ShippingAddress>
              <Country></Country>
              <FirstName>string</FirstName>
              <LastName>string</LastName>
              <PostalCode>string</PostalCode>
            </ShippingAddress>
          </BuyerInfo>
          <eBayGoodStanding>boolean</eBayGoodStanding>
          <Email>string</Email>
          <FeedbackPrivate>boolean</FeedbackPrivate>
          <FeedbackRatingStar></FeedbackRatingStar>
          <FeedbackScore>int</FeedbackScore>
          <IDVerified>boolean</IDVerified>
          <NewUser>boolean</NewUser>
          <PositiveFeedbackPercent>float</PositiveFeedbackPercent>
          <RegistrationAddress>
            <CityName>string</CityName>
            <Country></Country>
            <CountryName>string</CountryName>
            <FirstName>string</FirstName>
            <LastName>string</LastName>
            <Name>string</Name>
            <Phone>string</Phone>
            <PostalCode>string</PostalCode>
            <Street>string</Street>
            <Street1>string</Street1>
            <Street2>string</Street2>
          </RegistrationAddress>
          <RegistrationDate>dateTime</RegistrationDate>
          <Site></Site>
          <Status></Status>
          <UserAnonymized>boolean</UserAnonymized>
          <UserID></UserID>
          <UserIDChanged>boolean</UserIDChanged>
          <UserIDLastChanged>dateTime</UserIDLastChanged>
          <VATStatus></VATStatus>
        </HighBidder>
        <LeadCount>int</LeadCount>
        <ListingOnHold>boolean</ListingOnHold>
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
        <QuantitySoldByPickupInStore>int</QuantitySoldByPickupInStore>
        <ReserveMet>boolean</ReserveMet>
        <SecondChanceEligible>boolean</SecondChanceEligible>
        <SoldAsBin>boolean</SoldAsBin>
      </SellingStatus>
      <SKU></SKU>
      <StartPrice currencyID="CurrencyCodeType">
      </StartPrice>
      <VariationExtendedProducerResponsibility>
        <EcoParticipationFee currencyID="CurrencyCodeType">
        </EcoParticipationFee>
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
          <Source></Source>
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
        <Source></Source>
        <Value>string</Value>
        <!-- ... more Value values allowed here ... -->
      </NameValueList>
      <!-- ... more NameValueList nodes allowed here ... -->
    </VariationSpecificsSet>
  </Variations>
  <VATDetails>
    <VATPercent>float</VATPercent>
  </VATDetails>
  <VideoDetails>
    <VideoID>string</VideoID>
    <!-- ... more VideoID values allowed here ... -->
  </VideoDetails>
  <VIN>string</VIN>
  <VINLink>string</VINLink>
  <VRM>string</VRM>
  <VRMLink>string</VRMLink>
  <WatchCount>long</WatchCount>
</Item>
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
</GetItemResponse>
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
| Item | ItemType | Always | This container consists of detailed information about the retrieved listing. The amount of information that is returned is partially controlled by the filters that are set in the call request. |

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

### GetItemRequestType

**Description:** The <b>GetItem</b> call returns listing data such as title, description, price information, user information, and so on, for the specified <b>ItemID</b>.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| ItemID | ItemIDType | [0..1] | This field is used to identify the eBay listing by Item ID value. <br><br> <b>ItemID</b> is a required input in most cases. <b>SKU</b> can be used instead in certain cases (see the description of SKU). If both <b>ItemID</b> and <b>SKU</b> are specified for items where the inventory tracking method is <b>ItemID</b>, <b>ItemID</b> takes precedence. |
| IncludeWatchCount | boolean | [0..1] | The seller can include this field and set its value to <code>true</code> if that seller wants to see how many prospective bidders/buyers currently have the item added to their Watch Lists. The Watch count is returned in the <b>WatchCount</b> field in the response. <br> <br> This field will only be returnd to the seller of the item. |
| IncludeItemSpecifics | boolean | [0..1] | If this field is included and set to <code>true</code>, the call response includes the <b>ItemSpecifics</b> container if Item Specifics are defined for the listing.<br> <br> An Item Specific is any aspect that helps define/classify the item. Many eBay categories mandate including specific Item Specifics, so it is always a good idea to make a call to the <a href="/api-docs/commerce/taxonomy/resources/category_tree/methods/getItemAspectsForCategory" target="_blank">getItemAspectsForCategory</a> method of the Taxonomy API to see what Item Specifics are required and which ones are recommended.<br> <br> Including this field and setting it to <code>true</code> will also return the <strong>UnitInfo</strong> container if applicable. The <strong>UnitInfo</strong> container will provide information about the weight, volume or other quantity measurement of a listed item. The European Union requires listings for certain types of products to include the price per unit so buyers can accurately compare prices. eBay uses the <strong>UnitType</strong> and <strong>UnitQuantity</strong> values and the item's listed price to calculate and display the per-unit price on eBay EU sites. |
| IncludeTaxTable | boolean | [0..1] | The seller will include this field and set its value to <code>true</code> if the seller wishes to view the defined sales tax rates for the various jurisdictions in the country (generally, states and provinces). Information for each defined sales tax rate will be returned in the <b>TaxTable</b> container in the response. <br/><br/> Even if this field is included and set to <code>true</code>, no <b>TaxTable</b> container will be returned If no sales tax rates are defined for any tax jurisdiction in the seller's sales tax table. <br/><br/> Sales tax tables are only available for eBay US and Canada marketplaces. Sales tax rates can be added/modified in My eBay, through the <b>SetTaxTable</b> and <b>GetTaxTable</b> calls of the Traditional API, or through the Sales Tax calls of the Account API. |
| SKU | SKUType | [0..1] | Retrieves an item that was listed by the user identified in AuthToken and that is being tracked by this SKU.<br> <br> A SKU (stock keeping unit) is an identifier defined by a seller. Some sellers use SKUs to track complex flows of products and information on the client side. eBay preserves the SKU on the item, enabling you to obtain it before and after an order line item is created. (SKU is recommended as an alternative to ApplicationData.)<br> <br> In <b>GetItem</b>, <b>SKU</b> can only be used to retrieve one of your own items, where you listed the item by using <b>AddFixedPriceItem</b> or <b>RelistFixedPriceItem</b>, and you set <b>Item.InventoryTrackingMethod</b> to <b>SKU</b> at the time the item was listed. (These criteria are necessary to uniquely identify the listing by a SKU.)<br> <br> Either <b>ItemID</b> or <b>SKU</b> is required in the request. If both are passed, they must refer to the same item, and that item must have <b>InventoryTrackingMethod</b> set to <b>SKU</b>. |
| VariationSKU | SKUType | [0..1] | Variation-level SKU that uniquely identifes a Variation within the listing identified by <b>ItemID</b>. Only applicable when the seller listed the item with Variation-level SKU (<b>Variation.SKU</b>) values. Retrieves all the usual <b>Item</b> fields, but limits the <b>Variations</b> content to the specified Variation. If not specified, the response includes all Variations. |
| VariationSpecifics | NameValueListArrayType | [0..1] | Name-value pairs that identify one or more Variations within the listing identified by <b>ItemID</b>. Only applicable when the seller listed the item with Variations. Retrieves all the usual <b>Item</b> fields, but limits the Variations content to the specified Variation(s). If the specified pairs do not match any Variation, eBay returns all Variations.<br> <br> To retrieve only one variation, specify the full set of name/value pairs that match all the name-value pairs of one Variation. <br> <br> To retrieve multiple variations (using a wildcard), specify one or more name/value pairs that partially match the desired variations. For example, if the listing contains Variations for shirts in different colors and sizes, specify Color as Red (and no other name/value pairs) to retrieve all the red shirts in all sizes (but no other colors). |
| TransactionID | string | [0..1] | A unique identifier for an order line item. An order line item is created when a buyer commits to purchasing an item. <br><br> Since you can change active multiple-quantity fixed-price listings even after one of the items has been purchased, the <b>TransactionID</b> is associated with a snapshot of the item data at the time of the purchase. <br><br> After one item in a multi-quantity listing has been sold, sellers can not change the values in the Title, Primary Category, Secondary Category, Listing Duration, and Listing Type fields. However, all other fields are editable. <br><br> Specifying a <b>TransactionID</b> in the <b>GetItem</b> request allows you to retrieve a snapshot of the listing as it was when the order line item was created. <br> <br> The <b>TransactionID</b> value for auction listings is always <code>0</code> since there can be only one winning bidder/one sale for an auction listing. <br/><br/> <span class="tablenote"><b>Note: </b> Beginning in July 2024, non-zero transaction IDs will start being returned for auction listings. If necessary, update code to handle non-zero transaction IDs for auction transactions before this time. </span> |
| IncludeItemCompatibilityList | boolean | [0..1] | This field is used to specify whether or not to retrieve Parts Compatiblity information for a motor part or accessory listing. If this field is included and set to <code>true</code>, the <b>Item.ItemCompatibilityList</b> container will be returned if a Parts Compatibility list exists for the listing. A Parts Compatibility list is a list of motor vehicles that are compatible with the listed motor part or accesory item. If a Parts Compatibility list does not exist for the listing, this field will have no effect if it is included, regardless of its value (<code>true</code> or <code>false</code>). <br><br> If this field is included and set to <code>false</code> or omitted, but a Parts Compatibility list does exist for the listing, the <b>Item.ItemCompatibilityList</b> container will not be returned, but the <b>Item.ItemCompatibilityCount</b> field will be returned, and this field will simply indicate the quantity of motor vehicles that are compatible with the the listed motor part or accesory item. <br><br> Parts Compatibility lists are only applicable to motor parts and accessory categories on the sites that support eBay Motors - US, CA, UK, and DE. |

**XML Example:**

Not specified in source

### GetItemResponseType

**Description:** This type is used to display detailed information about the listing that was retrieved.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| Item | ItemType | [0..1] | This container consists of detailed information about the retrieved listing. The amount of information that is returned is partially controlled by the filters that are set in the call request. |

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

#### ItemID
- **Max Length:** Not specified in source
- **Min Length:** Not specified in source
- **Pattern:** Not specified in source
- **Allowed Values:** Not specified in source
- **Dependencies:** Conditionally

#### IncludeWatchCount
- **Max Length:** Not specified in source
- **Min Length:** Not specified in source
- **Pattern:** Not specified in source
- **Allowed Values:** Not specified in source
- **Dependencies:** No

#### IncludeItemSpecifics
- **Max Length:** Not specified in source
- **Min Length:** Not specified in source
- **Pattern:** Not specified in source
- **Allowed Values:** Not specified in source
- **Dependencies:** No

#### IncludeTaxTable
- **Max Length:** Not specified in source
- **Min Length:** Not specified in source
- **Pattern:** Not specified in source
- **Allowed Values:** Not specified in source
- **Dependencies:** No

#### SKU
- **Max Length:** 50
- **Min Length:** Not specified in source
- **Pattern:** Not specified in source
- **Allowed Values:** Not specified in source
- **Dependencies:** Conditionally

#### VariationSKU
- **Max Length:** Not specified in source
- **Min Length:** Not specified in source
- **Pattern:** Not specified in source
- **Allowed Values:** Not specified in source
- **Dependencies:** Conditionally

#### VariationSpecifics
- **Max Length:** Not specified in source
- **Min Length:** Not specified in source
- **Pattern:** Not specified in source
- **Allowed Values:** Not specified in source
- **Dependencies:** Conditionally

#### TransactionID
- **Max Length:** Not specified in source
- **Min Length:** Not specified in source
- **Pattern:** Not specified in source
- **Allowed Values:** Not specified in source
- **Dependencies:** Conditionally

#### IncludeItemCompatibilityList
- **Max Length:** Not specified in source
- **Min Length:** Not specified in source
- **Pattern:** Not specified in source
- **Allowed Values:** Not specified in source
- **Dependencies:** No

### Operation-Level Rules

1. **Rule 1**
   - Description: GetItem returns item data for only a single item per call.
   - Applies when: Not specified in source
   - Impact: Not specified in source
2. **Rule 2**
   - Description: Only increase the frequency if the user is logged in and active in the system.
   - Applies when: Not specified in source
   - Impact: Not specified in source
3. **Rule 3**
   - Description: However, you must have existing items in the Sandbox before you can call GetItem .
   - Applies when: Not specified in source
   - Impact: Not specified in source
4. **Rule 4**
   - Description: Below are some test case scenarios to consider: Some data values are only returned if the call requestor is the same as the one who listed the item.
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
| API Calls | Not specified in source | Not specified in source | Make multiple calls to GetItem to review details for more than a single item. Rather than repeating calls to GetItem to retrieve data for multiple items listed by the same seller, use GetSellerList instead. Automatic polling frequency can be increased during the last four hours of an auction. |
| Frequency | Not specified in source | Not specified in source | Not specified in source |

**Throttling Behavior:**
Make multiple calls to GetItem to review details for more than a single item. Rather than repeating calls to GetItem to retrieve data for multiple items listed by the same seller, use GetSellerList instead. Automatic polling frequency can be increased during the last four hours of an auction.

---

## Best Practices

1. **Practice 1**
   - Rather than repeating calls to GetItem to retrieve data for multiple items listed by the same seller, use GetSellerList instead.
2. **Practice 2**
   - For applications that list different types of items (such as Chinese auctions and fixed price items), use AddItem to create all different item types, then use GetItem to retrieve the data for each different item type.
3. **Error Handling**
   - Always check `Ack` value before processing response data
   - Log `CorrelationID` for debugging
   - Implement exponential backoff only when rate-limit behavior is documented in source
4. **Performance Optimization**
   - Make multiple calls to GetItem to review details for more than a single item.
   - Rather than repeating calls to GetItem to retrieve data for multiple items listed by the same seller, use GetSellerList instead.

---

## HTTP Status Codes

Not specified in source

---

## Migration Path

| SOAP Operation | New API | Type | Endpoint | Notes |
|----------------|---------|------|----------|-------|
| GetItem | Listing API / sellerListings query of Listing API Note: The Browse API can also be used, but the sellerListings query is specifically designed to check the created or revised listing and this query will show some seller-provided data that will not be shown in the Browse API. | Query | Not specified in source | Not specified in source |
| GetItem | Listing API | Query | Not specified in source | Not specified in source |

---

## Migration Notes

- New API family: Listing API
  - Operation: sellerListings query of Listing API Note: The Browse API can also be used, but the sellerListings query is specifically designed to check the created or revised listing and this query will show some seller-provided data that will not be shown in the Browse API.
  - Type: Query
  - Endpoint: Not specified in source
  - Notes: Not specified in source
- New API family: Listing API
  - Operation: Not specified in source
  - Type: Query
  - Endpoint: Not specified in source
  - Notes: Not specified in source
- Related calls in source: GetItem; GetAccount, GetAdFormatLeads, GetAllBidders, GetBestOffers, GetBidderList, GetCategories, GetCategoryFeatures, GetFeedback, GetItem, GetItemShipping, GetItemTransactions, GetItemsAwaitingFeedback, GetMemberMessages, GetMyMessages, GetMyeBayBuying, GetMyeBaySelling, GetNotificationPreferences, GetOrders, GetSellerEvents, GetSellerList, GetSellerTransactions; GetItem, GetSellerList; GetItem, GetItems; AddFixedPriceItem, AddItem, AddItems, GetItem, GetItems, GetSellerList, RelistFixedPriceItem, RelistItem, ReviseFixedPriceItem, ReviseItem, VerifyAddFixedPriceItem, VerifyAddItem, VerifyRelistItem; GetItem, GetMyeBaySelling, GetSellerList; GetItem, GetItemShipping, GetSellerList; GetItem, GetSellerEvents, GetSellerList; GetItem, VerifyRelistItem

*Source: developer_ebay_com_devzone_xml_docs_reference_ebay_getitem_html.jsonl | Generated: 2026-03-25 | Template Version: 1.0.0*
