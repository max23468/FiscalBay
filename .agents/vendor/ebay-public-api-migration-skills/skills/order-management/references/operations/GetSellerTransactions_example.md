# GetSellerTransactions — Example

## Request Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetSellerTransactionsRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <DetailLevel>ReturnAll</DetailLevel>
  <ModTimeFrom>2019-10-12T13:33:08.757Z</ModTimeFrom>
  <ModTimeTo>2019-10-12T14:33:08.757Z</ModTimeTo>
  <RequesterCredentials>
    <eBayAuthToken>A3</eBayAuthToken>
  </RequesterCredentials>
</GetSellerTransactionsRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetSellerTransactionsRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <IncludeCodiceFiscale>boolean</IncludeCodiceFiscale>
  <IncludeContainingOrder>boolean</IncludeContainingOrder>
  <IncludeFinalValueFee>boolean</IncludeFinalValueFee>
  <InventoryTrackingMethod></InventoryTrackingMethod>
  <ModTimeFrom>dateTime</ModTimeFrom>
  <ModTimeTo>dateTime</ModTimeTo>
  <NumberOfDays>int</NumberOfDays>
  <Pagination>
    <EntriesPerPage>int</EntriesPerPage>
    <PageNumber>int</PageNumber>
  </Pagination>
  <SKUArray>
    <SKU></SKU>
    <!-- ... more SKU values allowed here ... -->
  </SKUArray>
  <!-- Standard Input Fields -->
  <DetailLevel></DetailLevel>
  <!-- ... more DetailLevel values allowed here ... -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <OutputSelector>string</OutputSelector>
  <!-- ... more OutputSelector values allowed here ... -->
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetSellerTransactionsRequest>
```

## Response Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetSellerTransactionsResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Timestamp>2019-11-05T18:34:23.093Z</Timestamp>
  <Ack>Success</Ack>
  <Version>1131</Version>
  <Build>E1131_CORE_APISELLING_19099826_R1</Build>
  <PaginationResult>
    <TotalNumberOfPages>1</TotalNumberOfPages>
    <TotalNumberOfEntries>1</TotalNumberOfEntries>
  </PaginationResult>
  <HasMoreTransactions>false</HasMoreTransactions>
  <TransactionsPerPage>100</TransactionsPerPage>
  <PageNumber>1</PageNumber>
  <ReturnedTransactionCountActual>1</ReturnedTransactionCountActual>
  <Seller>
    <AboutMePage>false</AboutMePage>
    <EIASToken>PLACEHOLDER-TOKEN</EIASToken>
    <Email>example-seller@example.test</Email>
    <FeedbackScore>500</FeedbackScore>
    <PositiveFeedbackPercent>0.0</PositiveFeedbackPercent>
    <FeedbackPrivate>false</FeedbackPrivate>
    <FeedbackRatingStar>Purple</FeedbackRatingStar>
    <IDVerified>true</IDVerified>
    <eBayGoodStanding>true</eBayGoodStanding>
    <NewUser>false</NewUser>
    <RegistrationDate>2008-12-11T00:00:00.000Z</RegistrationDate>
    <Site>US</Site>
    <Status>Confirmed</Status>
    <UserID>mt</UserID>
    <UserIDChanged>false</UserIDChanged>
    <UserIDLastChanged>2006-02-08T21:55:29.000Z</UserIDLastChanged>
    <VATStatus>NoVATTax</VATStatus>
    <SellerInfo>
      <AllowPaymentEdit>true</AllowPaymentEdit>
      <CheckoutEnabled>true</CheckoutEnabled>
      <CIPBankAccountStored>false</CIPBankAccountStored>
      <GoodStanding>true</GoodStanding>
      <QualifiesForB2BVAT>false</QualifiesForB2BVAT>
      <SellerLevel>None</SellerLevel>
      <StoreOwner>false</StoreOwner>
      <SafePaymentExempt>false</SafePaymentExempt>
    </SellerInfo>
  </Seller>
  <TransactionArray>
    <Transaction>
      <AmountPaid currencyID="USD">39.13</AmountPaid>
      <AdjustmentAmount currencyID="USD">0.0</AdjustmentAmount>
      <ConvertedAdjustmentAmount currencyID="USD">0.0</ConvertedAdjustmentAmount>
      <Buyer>
        <AboutMePage>false</AboutMePage>
        <EIASToken>PLACEHOLDER-TOKEN</EIASToken>
        <Email>example-buyer@example.test</Email>
        <FeedbackScore>155</FeedbackScore>
        <PositiveFeedbackPercent>100.0</PositiveFeedbackPercent>
        <FeedbackPrivate>false</FeedbackPrivate>
        <FeedbackRatingStar>Turquoise</FeedbackRatingStar>
        <IDVerified>true</IDVerified>
        <eBayGoodStanding>true</eBayGoodStanding>
        <NewUser>false</NewUser>
        <RegistrationDate>2004-04-04T00:02:13.000Z</RegistrationDate>
        <Site>US</Site>
        <Status>Confirmed</Status>
        <UserID>tr</UserID>
        <UserIDChanged>false</UserIDChanged>
        <UserIDLastChanged>2001-08-29T21:52:58.000Z</UserIDLastChanged>
        <VATStatus>NoVATTax</VATStatus>
        <BuyerInfo>
          <ShippingAddress>
            <Name>tr</Name>
            <Street1>2 n</Street1>
            <CityName>San Jose</CityName>
            <StateOrProvince>CA</StateOrProvince>
            <Country>US</Country>
            <CountryName>United States</CountryName>
            <PostalCode>95125</PostalCode>
            <AddressID>15</AddressID>
            <AddressOwner>ebay</AddressOwner>
          </ShippingAddress>
        </BuyerInfo>
        <UserAnonymized>false</UserAnonymized>
      </Buyer>
      <ShippingDetails>
        <CalculatedShippingRate>
          <OriginatingPostalCode>95125</OriginatingPostalCode>
          <PackageDepth measurementSystem="English" unit="inches">6</PackageDepth>
          <PackageLength measurementSystem="English" unit="inches">7</PackageLength>
          <PackageWidth measurementSystem="English" unit="inches">7</PackageWidth>
          <PackagingHandlingCosts currencyID="USD">0.0</PackagingHandlingCosts>
          <ShippingIrregular>false</ShippingIrregular>
          <ShippingPackage>PackageThickEnvelope</ShippingPackage>
          <WeightMajor measurementSystem="English" unit="lbs">2</WeightMajor>
          <WeightMinor measurementSystem="English" unit="oz">0</WeightMinor>
        </CalculatedShippingRate>
        <ChangePaymentInstructions>true</ChangePaymentInstructions>
        <PaymentEdited>false</PaymentEdited>
        <SalesTax>
          <SalesTaxPercent>8.75</SalesTaxPercent>
          <SalesTaxState>CA</SalesTaxState>
          <ShippingIncludedInTax>false</ShippingIncludedInTax>
          <SalesTaxAmount currencyID="USD">3.15</SalesTaxAmount>
        </SalesTax>
        <ShippingType>Calculated</ShippingType>
        <SellingManagerSalesRecordNumber>16</SellingManagerSalesRecordNumber>
        <TaxTable>
          <TaxJurisdiction>
            <JurisdictionID>CA</JurisdictionID>
            <SalesTaxPercent>8.75</SalesTaxPercent>
            <ShippingIncludedInTax>false</ShippingIncludedInTax>
          </TaxJurisdiction>
        </TaxTable>
        <GetItFast>false</GetItFast>
      </ShippingDetails>
      <ConvertedAmountPaid currencyID="USD">39.13</ConvertedAmountPaid>
      <ConvertedTransactionPrice currencyID="USD">17.99</ConvertedTransactionPrice>
      <CreatedDate>2019-10-12T14:26:17.000Z</CreatedDate>
      <DepositType>None</DepositType>
      <Item>
        <AutoPay>false</AutoPay>
        <BuyItNowPrice currencyID="USD">0.0</BuyItNowPrice>
        <Currency>USD</Currency>
        <ItemID>19</ItemID>
        <ListingDetails>
          <StartTime>2019-10-12T14:16:25.000Z</StartTime>
          <EndTime>2019-10-12T14:16:25.000Z</EndTime>
          <ExpressListing>false</ExpressListing>
        </ListingDetails>
        <ListingType>FixedPriceItem</ListingType>
        <PaymentMethods>PayPal</PaymentMethods>
        <PrimaryCategory>
          <CategoryID>37565</CategoryID>
        </PrimaryCategory>
        <PrivateListing>false</PrivateListing>
        <Quantity>8</Quantity>
        <SecondaryCategory>
          <CategoryID>0</CategoryID>
        </SecondaryCategory>
        <SellingStatus>
          <CurrentPrice currencyID="USD">17.99</CurrentPrice>
          <QuantitySold>2</QuantitySold>
          <ListingStatus>Active</ListingStatus>
        </SellingStatus>
        <Site>US</Site>
        <StartPrice currencyID="USD">17.99</StartPrice>
        <Title>New Ralph Lauren Polo shirt Pink Black Blue Yellow</Title>
        <IntegratedMerchantCreditCardEnabled>false</IntegratedMerchantCreditCardEnabled>
      </Item>
      <QuantityPurchased>2</QuantityPurchased>
      <Status>
        <eBayPaymentStatus>NoPaymentFailure</eBayPaymentStatus>
        <CheckoutStatus>CheckoutIncomplete</CheckoutStatus>
        <LastTimeModified>2019-10-12T14:26:18.000Z</LastTimeModified>
        <PaymentMethodUsed>None</PaymentMethodUsed>
        <CompleteStatus>Incomplete</CompleteStatus>
        <BuyerSelectedShipping>false</BuyerSelectedShipping>
        <PaymentHoldStatus>None</PaymentHoldStatus>
        <IntegratedMerchantCreditCardEnabled>false</IntegratedMerchantCreditCardEnabled>
      </Status>
      <TransactionID>21</TransactionID>
      <TransactionPrice currencyID="USD">17.99</TransactionPrice>
      <BestOfferSale>false</BestOfferSale>
      <ShippingServiceSelected>
        <ShippingService>USPSPriority</ShippingService>
        <ShippingServiceCost currencyID="USD">0.0</ShippingServiceCost>
      </ShippingServiceSelected>
      <TransactionSiteID>US</TransactionSiteID>
      <Platform>eBay</Platform>
      <IntangibleItem>false</IntangibleItem>
      <Variation>
        <SKU>RPnk_M</SKU>
        <VariationSpecifics>
          <NameValueList>
            <Name>Color</Name>
            <Value>Pink</Value>
          </NameValueList>
          <NameValueList>
            <Name>Size</Name>
            <Value>M</Value>
          </NameValueList>
        </VariationSpecifics>
        <VariationTitle>New Ralph Lauren Polo shirt Pink Black Blue Yellow[Pink,M]</VariationTitle>
        <VariationViewItemURL>http://cgi.sandbox.ebay.com/ws/eBayISAPI.dll?ViewItem&item=19&vti=Color%09Pink%0ASize%09M</VariationViewItemURL>
      </Variation>
    </Transaction>
  </TransactionArray>
</GetSellerTransactionsResponse>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetSellerTransactionsRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <IncludeCodiceFiscale>boolean</IncludeCodiceFiscale>
  <IncludeContainingOrder>boolean</IncludeContainingOrder>
  <IncludeFinalValueFee>boolean</IncludeFinalValueFee>
  <InventoryTrackingMethod></InventoryTrackingMethod>
  <ModTimeFrom>dateTime</ModTimeFrom>
  <ModTimeTo>dateTime</ModTimeTo>
  <NumberOfDays>int</NumberOfDays>
  <Pagination>
    <EntriesPerPage>int</EntriesPerPage>
    <PageNumber>int</PageNumber>
  </Pagination>
  <SKUArray>
    <SKU></SKU>
    <!-- ... more SKU values allowed here ... -->
  </SKUArray>
  <!-- Standard Input Fields -->
  <DetailLevel></DetailLevel>
  <!-- ... more DetailLevel values allowed here ... -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <OutputSelector>string</OutputSelector>
  <!-- ... more OutputSelector values allowed here ... -->
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetSellerTransactionsRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetSellerTransactionsResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <HasMoreTransactions>boolean</HasMoreTransactions>
  <PageNumber>int</PageNumber>
  <PaginationResult>
    <TotalNumberOfEntries>int</TotalNumberOfEntries>
    <TotalNumberOfPages>int</TotalNumberOfPages>
  </PaginationResult>
  <ReturnedTransactionCountActual>int</ReturnedTransactionCountActual>
  <Seller>
    <eBayGoodStanding>boolean</eBayGoodStanding>
    <EIASToken>string</EIASToken>
    <Email>string</Email>
    <FeedbackPrivate>boolean</FeedbackPrivate>
    <FeedbackScore>int</FeedbackScore>
    <NewUser>boolean</NewUser>
    <PositiveFeedbackPercent>float</PositiveFeedbackPercent>
    <RegistrationDate>dateTime</RegistrationDate>
    <Site></Site>
    <Status></Status>
    <UserID></UserID>
    <UserIDChanged>boolean</UserIDChanged>
    <VATStatus></VATStatus>
  </Seller>
  <TransactionArray>
    <Transaction>
      <ActualHandlingCost currencyID="CurrencyCodeType">
      </ActualHandlingCost>
      <ActualShippingCost currencyID="CurrencyCodeType">
      </ActualShippingCost>
      <AdjustmentAmount currencyID="CurrencyCodeType">
      </AdjustmentAmount>
      <AmountPaid currencyID="CurrencyCodeType">
      </AmountPaid>
      <BestOfferSale>boolean</BestOfferSale>
      <Buyer>
        <BuyerInfo>
          <BuyerTaxIdentifier>
            <Attribute name="TaxIdentifierAttributeCodeType">
            </Attribute>
            <!-- ... more Attribute values allowed here ... -->
            <ID>string</ID>
            <Type></Type>
          </BuyerTaxIdentifier>
          <!-- ... more BuyerTaxIdentifier nodes allowed here ... -->
          <ShippingAddress>
            <CityName>string</CityName>
            <Country></Country>
            <CountryName>string</CountryName>
            <Phone>string</Phone>
            <PostalCode>string</PostalCode>
            <StateOrProvince>string</StateOrProvince>
            <Street>string</Street>
            <Street1>string</Street1>
            <Street2>string</Street2>
          </ShippingAddress>
        </BuyerInfo>
        <EIASToken>string</EIASToken>
        <Email>string</Email>
        <FeedbackPrivate>boolean</FeedbackPrivate>
        <FeedbackScore>int</FeedbackScore>
        <PositiveFeedbackPercent>float</PositiveFeedbackPercent>
        <RegistrationDate>dateTime</RegistrationDate>
        <Site></Site>
        <Status></Status>
        <UserID></UserID>
        <UserIDChanged>boolean</UserIDChanged>
        <VATStatus></VATStatus>
      </Buyer>
      <BuyerCheckoutMessage>string</BuyerCheckoutMessage>
      <BuyerPackageEnclosures>
        <BuyerPackageEnclosure type="PaymentInstructionCodeType">
        </BuyerPackageEnclosure>
        <!-- ... more BuyerPackageEnclosure values allowed here ... -->
      </BuyerPackageEnclosures>
      <CodiceFiscale>string</CodiceFiscale>
      <ContainingOrder>
        <CancelReason>token</CancelReason>
        <CancelStatus></CancelStatus>
        <ContainseBayPlusTransaction>boolean</ContainseBayPlusTransaction>
        <CreatingUserRole></CreatingUserRole>
        <ExtendedOrderID>string</ExtendedOrderID>
        <OrderID></OrderID>
        <OrderLineItemCount>long</OrderLineItemCount>
        <OrderStatus></OrderStatus>
      </ContainingOrder>
      <ConvertedAdjustmentAmount currencyID="CurrencyCodeType">
      </ConvertedAdjustmentAmount>
      <ConvertedAmountPaid currencyID="CurrencyCodeType">
      </ConvertedAmountPaid>
      <ConvertedTransactionPrice currencyID="CurrencyCodeType">
      </ConvertedTransactionPrice>
      <CreatedDate>dateTime</CreatedDate>
      <DepositType></DepositType>
      <DigitalDeliverySelected>
        <DeliveryDetails>
          <Recipient>
            <Email>string</Email>
            <Name>string</Name>
          </Recipient>
          <Sender>
            <Email>string</Email>
            <Name>string</Name>
          </Sender>
        </DeliveryDetails>
        <DeliveryMethod>token</DeliveryMethod>
        <DeliveryStatus>
          <Email>token</Email>
        </DeliveryStatus>
      </DigitalDeliverySelected>
      <eBayCollectAndRemitTax>boolean</eBayCollectAndRemitTax>
      <eBayCollectAndRemitTaxes>
        <eBayReference name="string">eBayTaxReferenceValue</eBayReference>
        <TaxDetails>
          <CollectionMethod></CollectionMethod>
          <Imposition></Imposition>
          <TaxAmount currencyID="CurrencyCodeType">
          </TaxAmount>
          <TaxCode>string</TaxCode>
          <TaxDescription></TaxDescription>
          <TaxOnHandlingAmount currencyID="CurrencyCodeType">
          </TaxOnHandlingAmount>
          <TaxOnShippingAmount currencyID="CurrencyCodeType">
          </TaxOnShippingAmount>
          <TaxOnSubtotalAmount currencyID="CurrencyCodeType">
          </TaxOnSubtotalAmount>
        </TaxDetails>
        <!-- ... more TaxDetails nodes allowed here ... -->
        <TotalTaxAmount currencyID="CurrencyCodeType">
        </TotalTaxAmount>
      </eBayCollectAndRemitTaxes>
      <eBayPaymentID>string</eBayPaymentID>
      <eBayPlusTransaction>boolean</eBayPlusTransaction>
      <ExtendedOrderID>string</ExtendedOrderID>
      <FinalValueFee currencyID="CurrencyCodeType">
      </FinalValueFee>
      <Gift>boolean</Gift>
      <GiftSummary>
        <Message>string</Message>
      </GiftSummary>
      <GuaranteedDelivery>boolean</GuaranteedDelivery>
      <GuaranteedShipping>boolean</GuaranteedShipping>
      <IntangibleItem>boolean</IntangibleItem>
      <InventoryReservationID>string</InventoryReservationID>
      <InvoiceSentTime>dateTime</InvoiceSentTime>
      <IsMultiLegShipping>boolean</IsMultiLegShipping>
      <Item>
        <ApplicationData>string</ApplicationData>
        <AutoPay>boolean</AutoPay>
        <BuyItNowPrice currencyID="CurrencyCodeType">
        </BuyItNowPrice>
        <Charity>
          <CharityListing>boolean</CharityListing>
        </Charity>
        <Country></Country>
        <Currency></Currency>
        <InventoryTrackingMethod></InventoryTrackingMethod>
        <ItemID></ItemID>
        <ListingDetails>
          <EndTime>dateTime</EndTime>
          <StartTime>dateTime</StartTime>
        </ListingDetails>
        <ListingType></ListingType>
        <Location>string</Location>
        <LotSize>int</LotSize>
        <PrivateListing>boolean</PrivateListing>
        <Quantity>int</Quantity>
        <SellingStatus>
          <BidCount>int</BidCount>
          <ConvertedCurrentPrice currencyID="CurrencyCodeType">
          </ConvertedCurrentPrice>
          <CurrentPrice currencyID="CurrencyCodeType">
          </CurrentPrice>
          <FinalValueFee currencyID="CurrencyCodeType">
          </FinalValueFee>
          <ListingStatus></ListingStatus>
          <QuantitySold>int</QuantitySold>
        </SellingStatus>
        <Site></Site>
        <SKU></SKU>
        <StartPrice currencyID="CurrencyCodeType">
        </StartPrice>
        <Title>string</Title>
      </Item>
      <LogisticsPlanType>token</LogisticsPlanType>
      <MonetaryDetails>
        <Payments>
          <Payment>
            <FeeOrCreditAmount currencyID="CurrencyCodeType">
            </FeeOrCreditAmount>
            <Payee type="UserIdentityCodeType">
            </Payee>
            <Payer type="UserIdentityCodeType">
            </Payer>
            <PaymentAmount currencyID="CurrencyCodeType">
            </PaymentAmount>
            <PaymentReferenceID type="TransactionReferenceCodeType">
            </PaymentReferenceID>
            <!-- ... more PaymentReferenceID values allowed here ... -->
            <PaymentTime>dateTime</PaymentTime>
            <ReferenceID type="TransactionReferenceCodeType">
            </ReferenceID>
          </Payment>
          <!-- ... more Payment nodes allowed here ... -->
        </Payments>
        <Refunds>
          <Refund>
            <FeeOrCreditAmount currencyID="CurrencyCodeType">
            </FeeOrCreditAmount>
            <ReferenceID type="TransactionReferenceCodeType">
            </ReferenceID>
            <RefundAmount currencyID="CurrencyCodeType">
            </RefundAmount>
            <RefundTime>dateTime</RefundTime>
            <RefundTo type="UserIdentityCodeType">
            </RefundTo>
            <RefundType></RefundType>
          </Refund>
          <!-- ... more Refund nodes allowed here ... -->
        </Refunds>
      </MonetaryDetails>
      <MultiLegShippingDetails>
        <SellerShipmentToLogisticsProvider>
          <ShippingServiceDetails>
            <ShippingService>token</ShippingService>
            <TotalShippingCost currencyID="CurrencyCodeType">
            </TotalShippingCost>
          </ShippingServiceDetails>
          <ShippingTimeMax>int</ShippingTimeMax>
          <ShippingTimeMin>int</ShippingTimeMin>
          <ShipToAddress>
            <AddressOwner></AddressOwner>
            <CityName>string</CityName>
            <Country></Country>
            <CountryName>string</CountryName>
            <Phone>string</Phone>
            <PostalCode>string</PostalCode>
            <ReferenceID>string</ReferenceID>
            <StateOrProvince>string</StateOrProvince>
            <Street1>string</Street1>
            <Street2>string</Street2>
          </ShipToAddress>
        </SellerShipmentToLogisticsProvider>
      </MultiLegShippingDetails>
      <OrderLineItemID>string</OrderLineItemID>
      <PaidTime>dateTime</PaidTime>
      <PickupDetails>
        <PickupOptions>
          <PickupMethod>token</PickupMethod>
          <PickupPriority>int</PickupPriority>
        </PickupOptions>
        <!-- ... more PickupOptions nodes allowed here ... -->
      </PickupDetails>
      <PickupMethodSelected>
        <MerchantPickupCode>string</MerchantPickupCode>
        <PickupFulfillmentTime>dateTime</PickupFulfillmentTime>
        <PickupLocationUUID>string</PickupLocationUUID>
        <PickupMethod>token</PickupMethod>
        <PickupStatus></PickupStatus>
        <PickupStoreID>string</PickupStoreID>
      </PickupMethodSelected>
      <Platform></Platform>
      <Program>
        <AuthenticityVerification>
          <OutcomeReason>string</OutcomeReason>
          <ServiceCost>
            <Amount currencyID="CurrencyCodeType">
            </Amount>
            <ConvertedFromAmount currencyID="CurrencyCodeType">
            </ConvertedFromAmount>
          </ServiceCost>
          <Status>string</Status>
        </AuthenticityVerification>
        <Fulfillment>
          <FulfillmentBy>string</FulfillmentBy>
          <FulfillmentRefId>string</FulfillmentRefId>
        </Fulfillment>
      </Program>
      <QuantityPurchased>int</QuantityPurchased>
      <SellerDiscounts>
        <OriginalItemPrice currencyID="CurrencyCodeType">
        </OriginalItemPrice>
        <OriginalItemShippingCost currencyID="CurrencyCodeType">
        </OriginalItemShippingCost>
        <OriginalShippingService>token</OriginalShippingService>
        <SellerDiscount>
          <CampaignDisplayName>string</CampaignDisplayName>
          <CampaignID>long</CampaignID>
          <ItemDiscountAmount currencyID="CurrencyCodeType">
          </ItemDiscountAmount>
          <ShippingDiscountAmount currencyID="CurrencyCodeType">
          </ShippingDiscountAmount>
        </SellerDiscount>
        <!-- ... more SellerDiscount nodes allowed here ... -->
      </SellerDiscounts>
      <ShippedTime>dateTime</ShippedTime>
      <ShippingDetails>
        <CalculatedShippingRate>
          <InternationalPackagingHandlingCosts currencyID="CurrencyCodeType">
          </InternationalPackagingHandlingCosts>
          <PackagingHandlingCosts currencyID="CurrencyCodeType">
          </PackagingHandlingCosts>
        </CalculatedShippingRate>
        <eBayEstimatedLabelCost currencyID="CurrencyCodeType">
        </eBayEstimatedLabelCost>
        <PaymentEdited>boolean</PaymentEdited>
        <SalesTax>
          <SalesTaxAmount currencyID="CurrencyCodeType">
          </SalesTaxAmount>
          <SalesTaxPercent>float</SalesTaxPercent>
          <SalesTaxState>string</SalesTaxState>
          <ShippingIncludedInTax>boolean</ShippingIncludedInTax>
        </SalesTax>
        <SellingManagerSalesRecordNumber>int</SellingManagerSalesRecordNumber>
        <ShipmentTrackingDetails>
          <ShipmentTrackingNumber>string</ShipmentTrackingNumber>
          <ShippingCarrierUsed>string</ShippingCarrierUsed>
        </ShipmentTrackingDetails>
        <!-- ... more ShipmentTrackingDetails nodes allowed here ... -->
        <ShippingRateType></ShippingRateType>
        <ShippingServiceUsed>token</ShippingServiceUsed>
        <ShippingType></ShippingType>
        <TaxTable>
          <TaxJurisdiction>
            <JurisdictionID>string</JurisdictionID>
            <SalesTaxPercent>float</SalesTaxPercent>
            <ShippingIncludedInTax>boolean</ShippingIncludedInTax>
          </TaxJurisdiction>
          <!-- ... more TaxJurisdiction nodes allowed here ... -->
        </TaxTable>
      </ShippingDetails>
      <ShippingServiceSelected>
        <ExpeditedService>boolean</ExpeditedService>
        <ImportCharge currencyID="CurrencyCodeType">
        </ImportCharge>
        <ShippingPackageInfo>
          <ActualDeliveryTime>dateTime</ActualDeliveryTime>
          <EstimatedDeliveryTimeMax>dateTime</EstimatedDeliveryTimeMax>
          <EstimatedDeliveryTimeMin>dateTime</EstimatedDeliveryTimeMin>
          <HandleByTime>dateTime</HandleByTime>
          <MaxNativeEstimatedDeliveryTime>dateTime</MaxNativeEstimatedDeliveryTime>
          <MinNativeEstimatedDeliveryTime>dateTime</MinNativeEstimatedDeliveryTime>
          <ScheduledDeliveryTimeMax>dateTime</ScheduledDeliveryTimeMax>
          <ScheduledDeliveryTimeMin>dateTime</ScheduledDeliveryTimeMin>
          <ShippingTrackingEvent>token</ShippingTrackingEvent>
          <StoreID>string</StoreID>
        </ShippingPackageInfo>
        <!-- ... more ShippingPackageInfo nodes allowed here ... -->
        <ShippingService>token</ShippingService>
        <ShippingServiceAdditionalCost currencyID="CurrencyCodeType">
        </ShippingServiceAdditionalCost>
        <ShippingServiceCost currencyID="CurrencyCodeType">
        </ShippingServiceCost>
        <ShippingServicePriority>int</ShippingServicePriority>
        <ShippingTimeMax>int</ShippingTimeMax>
        <ShippingTimeMin>int</ShippingTimeMin>
      </ShippingServiceSelected>
      <Status>
        <BuyerSelectedShipping>boolean</BuyerSelectedShipping>
        <CheckoutStatus></CheckoutStatus>
        <CompleteStatus></CompleteStatus>
        <DigitalStatus></DigitalStatus>
        <eBayPaymentStatus></eBayPaymentStatus>
        <InquiryStatus></InquiryStatus>
        <LastTimeModified>dateTime</LastTimeModified>
        <PaymentHoldStatus></PaymentHoldStatus>
        <PaymentInstrument></PaymentInstrument>
        <PaymentMethodUsed></PaymentMethodUsed>
        <ReturnStatus></ReturnStatus>
      </Status>
      <Taxes>
        <eBayReference name="string">eBayTaxReferenceValue</eBayReference>
        <TaxDetails>
          <Imposition></Imposition>
          <TaxAmount currencyID="CurrencyCodeType">
          </TaxAmount>
          <TaxCode>string</TaxCode>
          <TaxDescription></TaxDescription>
          <TaxOnHandlingAmount currencyID="CurrencyCodeType">
          </TaxOnHandlingAmount>
          <TaxOnShippingAmount currencyID="CurrencyCodeType">
          </TaxOnShippingAmount>
          <TaxOnSubtotalAmount currencyID="CurrencyCodeType">
          </TaxOnSubtotalAmount>
        </TaxDetails>
        <!-- ... more TaxDetails nodes allowed here ... -->
        <TotalTaxAmount currencyID="CurrencyCodeType">
        </TotalTaxAmount>
      </Taxes>
      <TransactionID>string</TransactionID>
      <TransactionPrice currencyID="CurrencyCodeType">
      </TransactionPrice>
      <TransactionSiteID></TransactionSiteID>
      <Variation>
        <SKU></SKU>
        <VariationSpecifics>
          <NameValueList>
            <Name>string</Name>
          </NameValueList>
          <!-- ... more NameValueList nodes allowed here ... -->
        </VariationSpecifics>
        <!-- ... more VariationSpecifics nodes allowed here ... -->
        <VariationTitle>string</VariationTitle>
        <VariationViewItemURL>anyURI</VariationViewItemURL>
      </Variation>
    </Transaction>
    <!-- ... more Transaction nodes allowed here ... -->
  </TransactionArray>
  <TransactionsPerPage>int</TransactionsPerPage>
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
</GetSellerTransactionsResponse>
```
