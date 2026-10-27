# GetItemTransactions — Example

## Request Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetItemTransactionsRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>A3</eBayAuthToken>
  </RequesterCredentials>
  <ItemID>15</ItemID>
</GetItemTransactionsRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetItemTransactionsRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <IncludeContainingOrder>boolean</IncludeContainingOrder>
  <IncludeFinalValueFee>boolean</IncludeFinalValueFee>
  <IncludeVariations>boolean</IncludeVariations>
  <ItemID></ItemID>
  <ModTimeFrom>dateTime</ModTimeFrom>
  <ModTimeTo>dateTime</ModTimeTo>
  <NumberOfDays>int</NumberOfDays>
  <OrderLineItemID>string</OrderLineItemID>
  <Pagination>
    <EntriesPerPage>int</EntriesPerPage>
    <PageNumber>int</PageNumber>
  </Pagination>
  <TransactionID>string</TransactionID>
  <!-- Standard Input Fields -->
  <DetailLevel></DetailLevel>
  <!-- ... more DetailLevel values allowed here ... -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <OutputSelector>string</OutputSelector>
  <!-- ... more OutputSelector values allowed here ... -->
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetItemTransactionsRequest>
```

## Response Example

```xml
<?xml version="1.0" encoding="UTF-8"?>
<GetItemTransactionsResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Timestamp>2019-11-04T21:42:14.767Z</Timestamp>
  <Ack>Success</Ack>
  <Version>1129</Version>
  <Build>E1129_CORE_APIXO_19090105_R1</Build>
  <PaginationResult>
    <TotalNumberOfPages>1</TotalNumberOfPages>
    <TotalNumberOfEntries>1</TotalNumberOfEntries>
  </PaginationResult>
  <HasMoreTransactions>false</HasMoreTransactions>
  <TransactionsPerPage>100</TransactionsPerPage>
  <PageNumber>1</PageNumber>
  <ReturnedTransactionCountActual>1</ReturnedTransactionCountActual>
  <Item>
    <AutoPay>true</AutoPay>
    <Currency>USD</Currency>
    <ItemID>13</ItemID>
    <ListingDetails>
      <ViewItemURL>http://cgi.ebay.com/ws/eBayISAPI.dll?ViewItem&Item=13</ViewItemURL>
      <ViewItemURLForNaturalSearch>http://cgi.ebay.com/Electronic-Animated-Sleeping-Snoring-Whistling-Santa-Claus-in-Box?item=13&category=0&cmd=ViewItem</ViewItemURLForNaturalSearch>
    </ListingDetails>
    <ListingType>StoresFixedPrice</ListingType>
    <PrivateListing>false</PrivateListing>
    <Quantity>1</Quantity>
    <Seller>
      <AboutMePage>false</AboutMePage>
      <EIASToken>PLACEHOLDER-TOKEN</EIASToken>
      <Email>example-seller@example.test</Email>
      <FeedbackScore>57</FeedbackScore>
      <PositiveFeedbackPercent>100.0</PositiveFeedbackPercent>
      <FeedbackPrivate>false</FeedbackPrivate>
      <FeedbackRatingStar>Blue</FeedbackRatingStar>
      <IDVerified>false</IDVerified>
      <eBayGoodStanding>true</eBayGoodStanding>
      <NewUser>false</NewUser>
      <RegistrationDate>2004-02-10T22:49:58.000Z</RegistrationDate>
      <Site>US</Site>
      <Status>Confirmed</Status>
      <UserID>u4</UserID>
      <UserIDChanged>false</UserIDChanged>
      <UserIDLastChanged>2004-02-10T22:50:12.000Z</UserIDLastChanged>
      <VATStatus>NoVATTax</VATStatus>
      <SellerInfo>
        <AllowPaymentEdit>true</AllowPaymentEdit>
        <CheckoutEnabled>true</CheckoutEnabled>
        <CIPBankAccountStored>false</CIPBankAccountStored>
        <GoodStanding>true</GoodStanding>
        <QualifiesForB2BVAT>false</QualifiesForB2BVAT>
        <StoreOwner>true</StoreOwner>
        <StoreURL>http://stores.ebay.com/as</StoreURL>
        <SafePaymentExempt>true</SafePaymentExempt>
      </SellerInfo>
    </Seller>
    <SellingStatus>
      <ConvertedCurrentPrice currencyID="USD">27.0</ConvertedCurrentPrice>
      <CurrentPrice currencyID="USD">27.0</CurrentPrice>
      <QuantitySold>1</QuantitySold>
      <ListingStatus>Completed</ListingStatus>
    </SellingStatus>
    <Site>US</Site>
    <Title>Electronic, Animated Sleeping, Snoring, Whistling Santa Claus in Box</Title>
    <GetItFast>false</GetItFast>
  </Item>
  <TransactionArray>
    <Transaction>
      <AmountPaid currencyID="USD">36.15</AmountPaid>
      <AdjustmentAmount currencyID="USD">0.0</AdjustmentAmount>
      <ConvertedAdjustmentAmount currencyID="USD">0.0</ConvertedAdjustmentAmount>
      <Buyer>
        <AboutMePage>false</AboutMePage>
        <EIASToken>PLACEHOLDER-TOKEN</EIASToken>
        <Email>example-buyer@example.test</Email>
        <FeedbackScore>58</FeedbackScore>
        <PositiveFeedbackPercent>100.0</PositiveFeedbackPercent>
        <FeedbackPrivate>false</FeedbackPrivate>
        <FeedbackRatingStar>Blue</FeedbackRatingStar>
        <IDVerified>false</IDVerified>
        <eBayGoodStanding>true</eBayGoodStanding>
        <NewUser>false</NewUser>
        <RegistrationDate>2016-04-27T02:27:47.000Z</RegistrationDate>
        <Site>US</Site>
        <Status>Confirmed</Status>
        <UserID>n8</UserID>
        <UserIDChanged>false</UserIDChanged>
        <VATStatus>NoVATTax</VATStatus>
        <BuyerInfo>
          <ShippingAddress>
            <Street1>1 D</Street1>
            <CityName>T</CityName>
            <StateOrProvince>CA</StateOrProvince>
            <Country>US</Country>
            <CountryName>United States</CountryName>
            <Phone>1---5</Phone>
            <PostalCode>9</PostalCode>
            <AddressOwner>eBay</AddressOwner>
            <AddressUsage>DefaultShipping</AddressUsage>
          </ShippingAddress>
        </BuyerInfo>
        <UserAnonymized>false</UserAnonymized>
        <UserFirstName>B</UserFirstName>
        <UserLastName>W</UserLastName>
      </Buyer>
      <ShippingDetails>
        <CalculatedShippingRate>
          <OriginatingPostalCode>95391</OriginatingPostalCode>
          <PackageDepth measurementSystem="English" unit="inches">4</PackageDepth>
          <PackageLength measurementSystem="English" unit="inches">7</PackageLength>
          <PackageWidth measurementSystem="English" unit="inches">4</PackageWidth>
          <PackagingHandlingCosts currencyID="USD">0.0</PackagingHandlingCosts>
          <ShippingIrregular>false</ShippingIrregular>
          <ShippingPackage>PackageThickEnvelope</ShippingPackage>
          <WeightMajor measurementSystem="English" unit="lbs">10</WeightMajor>
          <WeightMinor measurementSystem="English" unit="oz">0</WeightMinor>
        </CalculatedShippingRate>
        <ChangePaymentInstructions>true</ChangePaymentInstructions>
        <PaymentEdited>true</PaymentEdited>
        <ShippingServiceOptions>
          <ShippingService>USPSPriority</ShippingService>
          <ShippingServicePriority>1</ShippingServicePriority>
          <ExpeditedService>false</ExpeditedService>
          <ShippingTimeMin>1</ShippingTimeMin>
          <ShippingTimeMax>3</ShippingTimeMax>
        </ShippingServiceOptions>
        <ShippingType>Calculated</ShippingType>
        <SellingManagerSalesRecordNumber>12</SellingManagerSalesRecordNumber>
        <ThirdPartyCheckout>false</ThirdPartyCheckout>
        <TaxTable>
          <TaxJurisdiction>
            <JurisdictionID>CA</JurisdictionID>
            <SalesTaxPercent>8.25</SalesTaxPercent>
            <ShippingIncludedInTax>false</ShippingIncludedInTax>
          </TaxJurisdiction>
        </TaxTable>
        <GetItFast>false</GetItFast>
        <ShippingServiceUsed>USPSPriority</ShippingServiceUsed>
        <ShipmentTrackingDetails>
          <ShippingCarrierUsed>USPS</ShippingCarrierUsed>
          <ShipmentTrackingNumber>92</ShipmentTrackingNumber>
        </ShipmentTrackingDetails>
      </ShippingDetails>
      <ConvertedAmountPaid currencyID="USD">36.15</ConvertedAmountPaid>
      <ConvertedTransactionPrice currencyID="USD">20.0</ConvertedTransactionPrice>
      <CreatedDate>2019-10-02T21:01:06.000Z</CreatedDate>
      <DepositType>None</DepositType>
      <QuantityPurchased>1</QuantityPurchased>
      <Status>
        <eBayPaymentStatus>NoPaymentFailure</eBayPaymentStatus>
        <CheckoutStatus>CheckoutComplete</CheckoutStatus>
        <LastTimeModified>2019-10-08T17:56:11.000Z</LastTimeModified>
        <PaymentMethodUsed>CreditCard</PaymentMethodUsed>
        <CompleteStatus>Complete</CompleteStatus>
        <BuyerSelectedShipping>true</BuyerSelectedShipping>
        <PaymentHoldStatus>None</PaymentHoldStatus>
        <IntegratedMerchantCreditCardEnabled>true</IntegratedMerchantCreditCardEnabled>
        <InquiryStatus>NotApplicable</InquiryStatus>
        <ReturnStatus>NotApplicable</ReturnStatus>
      </Status>
      <TransactionID>22</TransactionID>
      <TransactionPrice currencyID="USD">20.0</TransactionPrice>
      <BestOfferSale>true</BestOfferSale>
      <ShippingServiceSelected>
        <ShippingService>USPSPriority</ShippingService>
        <ShippingServiceCost currencyID="USD">16.15</ShippingServiceCost>
        <ShippingPackageInfo>
          <EstimatedDeliveryTimeMin>2019-10-09T07:00:00.000Z</EstimatedDeliveryTimeMin>
          <EstimatedDeliveryTimeMax>2019-10-09T07:00:00.000Z</EstimatedDeliveryTimeMax>
        </ShippingPackageInfo>
      </ShippingServiceSelected>
      <PaidTime>2019-10-04T02:12:07.000Z</PaidTime>
      <ShippedTime>2019-10-04T23:37:00.000Z</ShippedTime>
      <TransactionSiteID>US</TransactionSiteID>
      <Platform>eBay</Platform>
      <PayPalEmailAddress>Invalid Request</PayPalEmailAddress>
      <BuyerGuaranteePrice currencyID="USD">20000.0</BuyerGuaranteePrice>
      <Taxes>
        <TotalTaxAmount currencyID="USD">1.65</TotalTaxAmount>
        <TaxDetails>
          <Imposition>SalesTax</Imposition>
          <TaxDescription>SalesTax</TaxDescription>
          <TaxAmount currencyID="USD">1.65</TaxAmount>
          <TaxOnSubtotalAmount currencyID="USD">1.65</TaxOnSubtotalAmount>
          <TaxOnShippingAmount currencyID="USD">0.0</TaxOnShippingAmount>
          <TaxOnHandlingAmount currencyID="USD">0.0</TaxOnHandlingAmount>
        </TaxDetails>
      </Taxes>
      <ActualShippingCost currencyID="USD">16.15</ActualShippingCost>
      <ActualHandlingCost currencyID="USD">0.0</ActualHandlingCost>
      <OrderLineItemID>13-22</OrderLineItemID>
      <IsMultiLegShipping>false</IsMultiLegShipping>
      <IntangibleItem>false</IntangibleItem>
      <ExtendedOrderID>0--1</ExtendedOrderID>
      <eBayPlusTransaction>false</eBayPlusTransaction>
    </Transaction>
  </TransactionArray>
  <PayPalPreferred>false</PayPalPreferred>
</GetItemTransactionsResponse>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetItemTransactionsRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <IncludeContainingOrder>boolean</IncludeContainingOrder>
  <IncludeFinalValueFee>boolean</IncludeFinalValueFee>
  <IncludeVariations>boolean</IncludeVariations>
  <ItemID></ItemID>
  <ModTimeFrom>dateTime</ModTimeFrom>
  <ModTimeTo>dateTime</ModTimeTo>
  <NumberOfDays>int</NumberOfDays>
  <OrderLineItemID>string</OrderLineItemID>
  <Pagination>
    <EntriesPerPage>int</EntriesPerPage>
    <PageNumber>int</PageNumber>
  </Pagination>
  <TransactionID>string</TransactionID>
  <!-- Standard Input Fields -->
  <DetailLevel></DetailLevel>
  <!-- ... more DetailLevel values allowed here ... -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <OutputSelector>string</OutputSelector>
  <!-- ... more OutputSelector values allowed here ... -->
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetItemTransactionsRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetItemTransactionsResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <HasMoreTransactions>boolean</HasMoreTransactions>
  <Item>
    <ApplicationData>string</ApplicationData>
    <AutoPay>boolean</AutoPay>
    <BuyItNowPrice currencyID="CurrencyCodeType">
    </BuyItNowPrice>
    <Charity>
      <CharityListing>boolean</CharityListing>
    </Charity>
    <Currency></Currency>
    <InventoryTrackingMethod></InventoryTrackingMethod>
    <ItemID></ItemID>
    <ListingDetails>
      <EndTime>dateTime</EndTime>
      <HasUnansweredQuestions>boolean</HasUnansweredQuestions>
      <StartTime>dateTime</StartTime>
    </ListingDetails>
    <ListingType></ListingType>
    <Location>string</Location>
    <LotSize>int</LotSize>
    <PrivateListing>boolean</PrivateListing>
    <Quantity>int</Quantity>
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
  <PageNumber>int</PageNumber>
  <PaginationResult>
    <TotalNumberOfEntries>int</TotalNumberOfEntries>
    <TotalNumberOfPages>int</TotalNumberOfPages>
  </PaginationResult>
  <ReturnedTransactionCountActual>int</ReturnedTransactionCountActual>
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
        <MotorPurchase>
          <BuyerStep>string</BuyerStep>
          <Facilitator>string</Facilitator>
          <FacilitatorRefId>string</FacilitatorRefId>
          <SellerStep>string</SellerStep>
          <ServiceCost>
            <Amount currencyID="CurrencyCodeType">
            </Amount>
            <ConvertedFromAmount currencyID="CurrencyCodeType">
            </ConvertedFromAmount>
          </ServiceCost>
          <Status>string</Status>
        </MotorPurchase>
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
        <InternationalShippingServiceOption>
          <ImportCharge></ImportCharge>
          <ShippingService>token</ShippingService>
          <ShippingServiceAdditionalCost></ShippingServiceAdditionalCost>
          <ShippingServiceCost></ShippingServiceCost>
          <ShippingServicePriority>int</ShippingServicePriority>
          <ShipToLocation>string</ShipToLocation>
          <!-- ... more ShipToLocation values allowed here ... -->
        </InternationalShippingServiceOption>
        <!-- ... more InternationalShippingServiceOption nodes allowed here ... -->
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
        <ShippingServiceOptions>
          <ExpeditedService>boolean</ExpeditedService>
          <ImportCharge></ImportCharge>
          <ShippingPackageInfo>
            <ActualDeliveryTime>dateTime</ActualDeliveryTime>
            <ScheduledDeliveryTimeMax>dateTime</ScheduledDeliveryTimeMax>
            <ScheduledDeliveryTimeMin>dateTime</ScheduledDeliveryTimeMin>
            <ShippingTrackingEvent>token</ShippingTrackingEvent>
            <StoreID>string</StoreID>
          </ShippingPackageInfo>
          <!-- ... more ShippingPackageInfo nodes allowed here ... -->
          <ShippingService>token</ShippingService>
          <ShippingServiceAdditionalCost></ShippingServiceAdditionalCost>
          <ShippingServiceCost></ShippingServiceCost>
          <ShippingServicePriority>int</ShippingServicePriority>
          <ShippingTimeMax>int</ShippingTimeMax>
          <ShippingTimeMin>int</ShippingTimeMin>
        </ShippingServiceOptions>
        <!-- ... more ShippingServiceOptions nodes allowed here ... -->
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
        <ImportCharge></ImportCharge>
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
        <ShippingServiceAdditionalCost></ShippingServiceAdditionalCost>
        <ShippingServiceCost></ShippingServiceCost>
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
            <Value>string</Value>
            <!-- ... more Value values allowed here ... -->
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
</GetItemTransactionsResponse>
```
