# GetSellerList — Example

## Request Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetSellerListRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>PLACEHOLDER_TOKEN</eBayAuthToken>
  </RequesterCredentials>
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <GranularityLevel>Coarse</GranularityLevel>
  <StartTimeFrom>2019-10-12T21:59:59.005Z</StartTimeFrom>
  <StartTimeTo>2019-10-26T21:59:59.005Z</StartTimeTo>
  <IncludeWatchCount>true</IncludeWatchCount>
  <Pagination>
    <EntriesPerPage>2</EntriesPerPage>
  </Pagination>
</GetSellerListRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetSellerListRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <AdminEndedItemsOnly>boolean</AdminEndedItemsOnly>
  <CategoryID>int</CategoryID>
  <EndTimeFrom>dateTime</EndTimeFrom>
  <EndTimeTo>dateTime</EndTimeTo>
  <GranularityLevel></GranularityLevel>
  <IncludeVariations>boolean</IncludeVariations>
  <IncludeWatchCount>boolean</IncludeWatchCount>
  <MotorsDealerUsers>
    <UserID></UserID>
  </MotorsDealerUsers>
  <Pagination>
    <EntriesPerPage>int</EntriesPerPage>
    <PageNumber>int</PageNumber>
  </Pagination>
  <SKUArray>
    <SKU></SKU>
  </SKUArray>
  <Sort>int</Sort>
  <StartTimeFrom>dateTime</StartTimeFrom>
  <StartTimeTo>dateTime</StartTimeTo>
  <DetailLevel></DetailLevel>
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <OutputSelector>string</OutputSelector>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetSellerListRequest>
```

## Response Example

```xml
<?xml version="1.0" encoding="UTF-8"?>
<GetSellerListResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Timestamp>2019-11-05T18:28:30.517Z</Timestamp>
  <Ack>Success</Ack>
  <Version>1131</Version>
  <PaginationResult>
    <TotalNumberOfPages>5</TotalNumberOfPages>
    <TotalNumberOfEntries>9</TotalNumberOfEntries>
  </PaginationResult>
  <HasMoreItems>true</HasMoreItems>
  <ItemArray>
    <Item>
      <AutoPay>false</AutoPay>
      <BuyerProtection>ItemIneligible</BuyerProtection>
      <Country>US</Country>
      <Currency>USD</Currency>
      <HitCounter>NoHitCounter</HitCounter>
      <ItemID>17</ItemID>
      <ListingDetails>
        <RelistedItemID>10</RelistedItemID>
        <StartTime>2019-10-13T00:31:36.000Z</StartTime>
        <EndTime>2019-10-20T00:31:36.000Z</EndTime>
        <ViewItemURL>https://www.ebay.com/itm/Brinns-American-Tradition-First-Lady-Gown-Series-Louisa-Johnson-Adams-/17</ViewItemURL>
        <HasUnansweredQuestions>false</HasUnansweredQuestions>
        <HasPublicMessages>false</HasPublicMessages>
        <ViewItemURLForNaturalSearch>https://www.ebay.com/itm/Brinns-American-Tradition-First-Lady-Gown-Series-Louisa-Johnson-Adams-/17</ViewItemURLForNaturalSearch>
      </ListingDetails>
      <ListingDuration>Days_7</ListingDuration>
      <Location>Ty, California</Location>
      <PrimaryCategory>
        <CategoryID>36549</CategoryID>
        <CategoryName>Dolls & Bears:Dolls:By Brand, Company, Character:Other Brand & Character Dolls</CategoryName>
      </PrimaryCategory>
      <Quantity>1</Quantity>
      <ReviseStatus>
        <ItemRevised>false</ItemRevised>
      </ReviseStatus>
      <SellingStatus>
        <BidCount>0</BidCount>
        <BidIncrement currencyID="USD">0.5</BidIncrement>
        <ConvertedCurrentPrice currencyID="USD">8.75</ConvertedCurrentPrice>
        <CurrentPrice currencyID="USD">8.75</CurrentPrice>
        <MinimumToBid currencyID="USD">8.75</MinimumToBid>
        <QuantitySold>0</QuantitySold>
        <SecondChanceEligible>false</SecondChanceEligible>
        <ListingStatus>Completed</ListingStatus>
      </SellingStatus>
      <ShippingDetails>
        <ShippingDiscountProfileID>0</ShippingDiscountProfileID>
        <InternationalShippingDiscountProfileID></InternationalShippingDiscountProfileID>
      </ShippingDetails>
      <ShipToLocations>Worldwide</ShipToLocations>
      <Site>US</Site>
      <Storefront>
        <StoreCategoryID>1</StoreCategoryID>
        <StoreCategory2ID>0</StoreCategory2ID>
        <StoreURL>https://stores.ebay.com/as</StoreURL>
      </Storefront>
      <TimeLeft>PT0S</TimeLeft>
      <Title>Brinn's American Tradition First Lady Gown Series Louisa Johnson Adams</Title>
      <WatchCount>0</WatchCount>
      <BestOfferDetails>
        <BestOfferCount>0</BestOfferCount>
        <BestOfferEnabled>true</BestOfferEnabled>
        <NewBestOffer>false</NewBestOffer>
      </BestOfferDetails>
      <LocationDefaulted>true</LocationDefaulted>
      <BuyerResponsibleForShipping>false</BuyerResponsibleForShipping>
      <PostalCode>91</PostalCode>
      <PictureDetails>
        <GalleryURL>https://i.com//0.jpg</GalleryURL>
        <PhotoDisplay>PicturePack</PhotoDisplay>
        <PictureURL>hhttps://i.com//0.jpg</PictureURL>
        <PictureURL>https://i.com//1.jpg</PictureURL>
        <PictureURL>https://i.com//2.jpg</PictureURL>
        <PictureURL>https://i.com//3.jpg</PictureURL>
      </PictureDetails>
      <ProxyItem>false</ProxyItem>
      <BuyerGuaranteePrice currencyID="USD">20000.0</BuyerGuaranteePrice>
      <BuyerRequirementDetails>
        <ShipToRegistrationCountry>true</ShipToRegistrationCountry>
      </BuyerRequirementDetails>
      <ReturnPolicy>
        <RefundOption>MoneyBackOrReplacement</RefundOption>
        <Refund>Money back or replacement (buyer's choice)</Refund>
        <ReturnsWithinOption>Days_60</ReturnsWithinOption>
        <ReturnsWithin>60 Days</ReturnsWithin>
        <ReturnsAcceptedOption>ReturnsAccepted</ReturnsAcceptedOption>
        <ReturnsAccepted>Returns Accepted</ReturnsAccepted>
        <ShippingCostPaidByOption>Buyer</ShippingCostPaidByOption>
        <ShippingCostPaidBy>Buyer</ShippingCostPaidBy>
      </ReturnPolicy>
      <ConditionID>1000</ConditionID>
      <ConditionDisplayName>New</ConditionDisplayName>
      <PostCheckoutExperienceEnabled>false</PostCheckoutExperienceEnabled>
      <SellerProfiles>
        <SellerShippingProfile>
          <ShippingProfileID>10</ShippingProfileID>
          <ShippingProfileName>C0</ShippingProfileName>
        </SellerShippingProfile>
        <SellerReturnProfile>
          <ReturnProfileID>10</ReturnProfileID>
          <ReturnProfileName>Rr</ReturnProfileName>
        </SellerReturnProfile>
        <SellerPaymentProfile>
          <PaymentProfileID>10</PaymentProfileID>
          <PaymentProfileName>Pl</PaymentProfileName>
        </SellerPaymentProfile>
      </SellerProfiles>
      <RelistParentID>14</RelistParentID>
      <HideFromSearch>false</HideFromSearch>
      <eBayPlus>false</eBayPlus>
      <eBayPlusEligible>false</eBayPlusEligible>
      <IsSecureDescription>true</IsSecureDescription>
    </Item>
    <Item>
      <AutoPay>false</AutoPay>
      <BuyerProtection>ItemIneligible</BuyerProtection>
      <Country>US</Country>
      <Currency>USD</Currency>
      <HitCounter>NoHitCounter</HitCounter>
      <ItemID>12</ItemID>
      <ListingDetails>
        <RelistedItemID>19</RelistedItemID>
        <StartTime>2019-10-15T12:20:04.000Z</StartTime>
        <EndTime>2019-10-22T12:20:04.000Z</EndTime>
        <ViewItemURL>https://www.ebay.com/itm/Our-Lady-Lourdes-Plate-1-Bradford-Exchange-Certified-Authentic-Garrido-/12</ViewItemURL>
        <HasUnansweredQuestions>false</HasUnansweredQuestions>
        <HasPublicMessages>false</HasPublicMessages>
        <ViewItemURLForNaturalSearch>https://www.ebay.com/itm/Our-Lady-Lourdes-Plate-1-Bradford-Exchange-Certified-Authentic-Garrido-/12</ViewItemURLForNaturalSearch>
      </ListingDetails>
      <ListingDuration>Days_7</ListingDuration>
      <Location>Ty, California</Location>
      <PrimaryCategory>
        <CategoryID>11135</CategoryID>
        <CategoryName>Collectibles:Decorative Collectibles:Decorative Collectible Brands:Roman:Other Roman</CategoryName>
      </PrimaryCategory>
      <Quantity>1</Quantity>
      <ReviseStatus>
        <ItemRevised>false</ItemRevised>
      </ReviseStatus>
      <SellingStatus>
        <BidCount>0</BidCount>
        <BidIncrement currencyID="USD">0.5</BidIncrement>
        <ConvertedCurrentPrice currencyID="USD">10.1</ConvertedCurrentPrice>
        <CurrentPrice currencyID="USD">10.1</CurrentPrice>
        <MinimumToBid currencyID="USD">10.1</MinimumToBid>
        <QuantitySold>0</QuantitySold>
        <SecondChanceEligible>false</SecondChanceEligible>
        <ListingStatus>Completed</ListingStatus>
      </SellingStatus>
      <ShippingDetails>
        <ShippingDiscountProfileID>0</ShippingDiscountProfileID>
        <InternationalShippingDiscountProfileID></InternationalShippingDiscountProfileID>
      </ShippingDetails>
      <ShipToLocations>US</ShipToLocations>
      <Site>US</Site>
      <Storefront>
        <StoreCategoryID>1</StoreCategoryID>
        <StoreCategory2ID>0</StoreCategory2ID>
        <StoreURL>https://stores.ebay.com/as</StoreURL>
      </Storefront>
      <TimeLeft>PT0S</TimeLeft>
      <Title>Our Lady of Lourdes Plate #1 - Bradford Exchange Certified Authentic- Garrido</Title>
      <WatchCount>0</WatchCount>
      <BestOfferDetails>
        <BestOfferCount>0</BestOfferCount>
        <BestOfferEnabled>true</BestOfferEnabled>
        <NewBestOffer>false</NewBestOffer>
      </BestOfferDetails>
      <LocationDefaulted>true</LocationDefaulted>
      <BuyerResponsibleForShipping>false</BuyerResponsibleForShipping>
      <PostalCode>91</PostalCode>
      <PictureDetails>
        <GalleryURL>https://i.com//$7.JPG?set_id=80F</GalleryURL>
        <PhotoDisplay>PicturePack</PhotoDisplay>
        <PictureURL>https://i.com//0.jpg</PictureURL>
        <PictureURL>https://i.com//1.jpg</PictureURL>
        <PictureURL>https://i.com//2.jpg</PictureURL>
        <PictureURL>https://i.com//3.jpg</PictureURL>
        <PictureURL>https://i.com//4.jpg</PictureURL>
        <PictureURL>https://i.com//5.jpg</PictureURL>
      </PictureDetails>
      <ProxyItem>false</ProxyItem>
      <BuyerGuaranteePrice currencyID="USD">20000.0</BuyerGuaranteePrice>
      <BuyerRequirementDetails>
        <ShipToRegistrationCountry>true</ShipToRegistrationCountry>
      </BuyerRequirementDetails>
      <ReturnPolicy>
        <RefundOption>MoneyBackOrReplacement</RefundOption>
        <Refund>Money back or replacement (buyer's choice)</Refund>
        <ReturnsWithinOption>Days_14</ReturnsWithinOption>
        <ReturnsWithin>14 Days</ReturnsWithin>
        <ReturnsAcceptedOption>ReturnsAccepted</ReturnsAcceptedOption>
        <ReturnsAccepted>Returns Accepted</ReturnsAccepted>
        <ShippingCostPaidByOption>Buyer</ShippingCostPaidByOption>
        <ShippingCostPaidBy>Buyer</ShippingCostPaidBy>
      </ReturnPolicy>
      <ConditionID>1000</ConditionID>
      <ConditionDisplayName>New</ConditionDisplayName>
      <PostCheckoutExperienceEnabled>false</PostCheckoutExperienceEnabled>
      <SellerProfiles>
        <SellerShippingProfile>
          <ShippingProfileID>10</ShippingProfileID>
          <ShippingProfileName>C1</ShippingProfileName>
        </SellerShippingProfile>
        <SellerReturnProfile>
          <ReturnProfileID>10</ReturnProfileID>
          <ReturnProfileName>R0</ReturnProfileName>
        </SellerReturnProfile>
        <SellerPaymentProfile>
          <PaymentProfileID>10</PaymentProfileID>
          <PaymentProfileName>Pl</PaymentProfileName>
        </SellerPaymentProfile>
      </SellerProfiles>
      <RelistParentID>16</RelistParentID>
      <HideFromSearch>false</HideFromSearch>
      <eBayPlus>false</eBayPlus>
      <eBayPlusEligible>false</eBayPlusEligible>
      <IsSecureDescription>true</IsSecureDescription>
    </Item>
  </ItemArray>
  <ItemsPerPage>2</ItemsPerPage>
  <PageNumber>1</PageNumber>
  <ReturnedItemCountActual>2</ReturnedItemCountActual>
</GetSellerListResponse>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetSellerListRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <AdminEndedItemsOnly>boolean</AdminEndedItemsOnly>
  <CategoryID>int</CategoryID>
  <EndTimeFrom>dateTime</EndTimeFrom>
  <EndTimeTo>dateTime</EndTimeTo>
  <GranularityLevel></GranularityLevel>
  <IncludeVariations>boolean</IncludeVariations>
  <IncludeWatchCount>boolean</IncludeWatchCount>
  <MotorsDealerUsers>
    <UserID></UserID>
  </MotorsDealerUsers>
  <Pagination>
    <EntriesPerPage>int</EntriesPerPage>
    <PageNumber>int</PageNumber>
  </Pagination>
  <SKUArray>
    <SKU></SKU>
  </SKUArray>
  <Sort>int</Sort>
  <StartTimeFrom>dateTime</StartTimeFrom>
  <StartTimeTo>dateTime</StartTimeTo>
</GetSellerListRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetSellerListResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <PaginationResult>
    <TotalNumberOfPages>int</TotalNumberOfPages>
    <TotalNumberOfEntries>int</TotalNumberOfEntries>
  </PaginationResult>
  <HasMoreItems>boolean</HasMoreItems>
  <ItemArray>
    <Item></Item>
  </ItemArray>
  <ItemsPerPage>int</ItemsPerPage>
  <PageNumber>int</PageNumber>
  <ReturnedItemCountActual>int</ReturnedItemCountActual>
  <Seller></Seller>
</GetSellerListResponse>
```
