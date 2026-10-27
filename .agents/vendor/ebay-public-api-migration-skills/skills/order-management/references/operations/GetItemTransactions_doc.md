# GetItemTransactions - Traditional API (SOAP)

> **Call Name:** GetItemTransactions
> **API Type:** SOAP XML traditional API
> **API Version:** 1129
> **Service:** Traditional

---

## Metadata

| Property | Value |
|----------|-------|
| **Call Type** | Core |
| **Deprecated** | No |
| **Replacement** | See Migration Path section |
| **Rate Limit** | Not specified in source |
| **Supported Sites** | Not specified in source |

---

## Description

Use this call to retrieve order line item (transaction) information for a specified listing. The call returns zero, one, or multiple order line items, depending on the number of items sold from the specified listing.

**Purpose:**
Use this call to retrieve order line item (transaction) information for a specified listing. The call returns zero, one, or multiple order line items, depending on the number of items sold from the specified listing. An order line item contains information about the sale of one or more items.

**Use Cases:**
- Retrieve order line item information for one specific listing.
- Retrieve one specific order line item by ItemID and TransactionID or by OrderLineItemID.
- Page through transactions for multiple-quantity or multiple-variation listings.

**Important Notes:**
- The call can return zero, one, or multiple transactions depending on how many items sold from the specified listing.
- If no date filters are used, transactions from the last 30 days are returned for the specified listing.
- Date windows are limited to 30 days, and ModTimeFrom cannot go back more than 90 days.
- GetItemTransactions does not support SKU as an input; use GetSellerTransactions for SKU-based lookups.

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
X-EBAY-API-COMPATIBILITY-LEVEL: 1129
X-EBAY-API-CALL-NAME: GetItemTransactions
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

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| None identified | - | No | No always-required request fields were explicitly labeled in the extracted source. |

#### Optional Fields

| Field Path | Type | Default | Description | Constraints |
|------------|------|---------|-------------|-------------|
| ModTimeFrom | dateTime | Not specified in source | The ModTimeFrom and ModTimeTo fields are used to retrieve order line items that were created or modified within a specified date range. The ModTimeFrom field is the starting date range. All of the listing's order line items that were generated or modified within this date range are returned in the output. The maximum date range that may be specified is 30 days. This value cannot be set back more than 90 days in the past, as this call cannot retrieve sales older than 90 days old. The maximum date range that may be specified is 30 days. This field is not applicable (and is ignored) if the user is looking for a specific order line item by either using an ItemID / TransactionID pair, or an OrderLineItemID value. Note: Please note that for a multiple line item order, all line items of that order that meet the filter criteria may be returned in the responses, even the line item(s) that were not actually modified. In other words, if any part of the order was modified, all line items of that order may be returned. | Not specified in source |
| ModTimeTo | dateTime | Not specified in source | The ModTimeFrom and ModTimeTo fields are used to retrieve order line items that were created or modified within a specified date range. The ModTimeTo field is the ending date range. All eBay order line items that were generated (or last modified) within this date range are returned in the output. The maximum date range that may be specified is 30 days. If the ModTimeFrom field is used and the ModTimeTo field is omitted, the ModTimeTo value defaults to the present time or to 30 days after the date specified with the ModTimeFrom value (if ModTimeFrom value is more than 30 days in the past). This field is not applicable (and is ignored) if the user is looking for a specific order line item by either using an ItemID / TransactionID pair, or an OrderLineItemID value. Note: Please note that for a multiple line item order, all line items of that order that meet the filter criteria may be returned in the responses, even the line item(s) that were not actually modified. In other words, if any part of the order was modified, all line items of that order may be returned. | Not specified in source |
| TransactionID | string | Not specified in source | Include a TransactionID field in the request if you want to retrieve the data for a specific order line item for the listing specified in the ItemID field. This field is really only applicable for a multiple-quantity or multiple-variation, fixed-price listing that may have multiple sales. An auction listing or a single-quantity, fixed-price listing will only result in one order line item, so this field is not needed in these two cases. If an OrderLineItemID value is used instead to identify an order line item, this field is ignored. If this field is used, any specified date filter is ignored. The TransactionID value for auction listings is always 0 since there can be only one winning bidder/one sale for an auction listing. Note: Beginning in July 2024, non-zero transaction IDs will start being returned for auction listings. If necessary, update code to handle non-zero transaction IDs for auction transactions before this time. | Not specified in source |
| Pagination | PaginationType | Not specified in source | This container controls how many order line items should be returned per page of data, as well as which page of data to return (if there are multiple pages of order line items). Use the EntriesPerPage property to control the number of order line items to return per call and the PageNumber property to specify the specific page of data to return. If multiple pages of order line items are returned based on input criteria and Pagination properties, GetItemTransactions will need to be called multiple times (with the PageNumber value being increased by 1 each time) to scroll through all results. | Not specified in source |
| IncludeFinalValueFee | boolean | Not specified in source | This field is included and set to true if the user wants to view the Final Value Fee (FVF) for all order line items in the response. The Final Value Fee is returned in the Transaction.FinalValueFee field. The Final Value Fee is assessed right after the creation of an order line item. See the Selling fees help page for more information about how Final Value Fees are calculated. | Not specified in source |
| IncludeContainingOrder | boolean | Not specified in source | This field is included and set to true if the user wants to view order-level details, including the unique identifier of the order and the status of the order. The order-level details will be shown in the ContainingOrder container in the response. | Not specified in source |
| Platform | TransactionPlatformCodeType | Not specified in source | Note: This field is should no longer be used, as its purpose in the past was to give the user the ability to retrieve only eBay marketplace order line items or only Half.com listings, and since the Half.com site no longer exists, this field is no longer relevant. | Not specified in source |
| NumberOfDays | int | Not specified in source | This date range filter specifies the number of days (24-hour periods) in the past to search for order line items. All eBay order line items that were either created or modified within this period are returned in the response. If specified, NumberOfDays will override any date range specified with the ModTimeFrom / ModTimeTo date range filters. This field is not applicable if a specific order line item is specified either through an ItemID TransactionID pair or an OrderLineItemID value. | Not specified in source |
| IncludeVariations | boolean | Not specified in source | If this field is included in the request and set to true , details on all variations defined in the specified multiple-variation listing are returned, including variations that have no sales. If this field is not included in the request or set to false , the variations with sales are still returned in separate Transaction nodes. This information is intended to help sellers to reconcile their local inventory with eBay's records, while processing order line items (without requiring a separate call to GetItem ). | Not specified in source |
| OrderLineItemID | string | Not specified in source | A unique identifier for an eBay order line item. This identifier is created once there is a commitment to buy (bidder wins the auction, buyer clicks buy button, or buyer purchases item through PlaceOffer call). If you want to retrieve data on a specific order line item, you can use an OrderLineItemID value in the request instead of an ItemID / TransactionID pair. If an OrderLineItemID is provided, any specified date range filter is ignored. | Not specified in source |

#### Conditional Fields

| Field Path | Type | Condition | Description |
|------------|------|-----------|-------------|
| ItemID | ItemIDType | Conditionally | Unique identifier for an eBay listing. A listing can have multiple order line items, but only one ItemID . When you use ItemID alone, eBay returns all order line items that are associated with the ItemID . If you pair ItemID with a specific TransactionID , data on a specific order line item is returned. An OrderLineItemID value can be used instead of an ItemID / TransactionID pair to identify an order line item, and if an OrderLineItemID is specified in the request, any ItemID / TransactionID pair specified in the same request is ignored. Note: GetItemTransactions doesn't support SKU as an input because this call requires an identifier that is unique across your active and ended listings. Even when InventoryTrackingMethod is set to SKU in a listing, the SKU is only unique across your active listings (not your ended listings). To retrieve order line items by SKU, use GetSellerTransactions instead. |

## Response Structure

### XML Schema

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
| PaginationResult | PaginationResultType | Always | Contains the total number of pages ( TotalNumberOfPages ) and the total number of entries ( TotalNumberOfEntries ) that could be returned given repeated calls that use the same selection criteria as the call that returned this response. |
| HasMoreTransactions | boolean | Always | Indicates whether there are additional order line items to retrieve. That is, indicates whether more pages of data are available to be returned, given the filters that were specified in the request. Returns false for the last page of data. |
| TransactionsPerPage | int | Always | Number of order line items returned per page (per call). May be a higher value than ReturnedTransactionCountActual if the page returned is the last page and more than one page of data exists. |
| PageNumber | int | Always | Page number for the page of order line items the response returned. |
| ReturnedTransactionCountActual | int | Always | Number of order line items retrieved in the current page of results just returned. May be a lower value than TransactionsPerPage if the page returned is the last page and more than one page of data exists. |
| Item | ItemType | Always | Item object that spawned the order line item. It is a purchase from this item's listing that the order line item represents. |
| TransactionArray | TransactionArrayType | Conditionally | List of Transaction objects representing the order line items resulting from the listing. Each Transaction object contains the data for one purchase (of one or more items in the same listing). The Transaction.Item field is not returned because the Item object is returned at the root level of the response. See the reference guide for more information about the fields that are returned. Note: The GetItemTransactions call does not support Team Access (formerly multi-user account access) . Transactions are only returned for the user that makes the call. You cannot use GetItemTransactions to return transactions for another user. The call succeeds but returns an empty . |

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

### GetItemTransactionsRequestType

**Description:** This call retrieves details on one or more order line items for a specified eBay listing. Auctions and single-quantity, fixed-price listings can only have one order line item, but a multiple-quantity and/or multiple-variation, fixed-priced listing can have numerous order line items. To find one or more order line items for an eBay listing, an ItemID value can be passed in. If a user wanted to retrieve a specific order line item, an ItemID value and a an TransactionID value can be passed in, or an OrderLineItemID value can be passed in instead of an ItemID / TransactionID pair. The NumberOfDays or the ModTimeFrom and ModTimeTo date range filters can be used to retrieve order line items generated (or last modified) within a specific range of time. The maximum date range that can be set is 30 days, and the ModTimeFrom date value cannot be set any further back than 90 days in the past. If no date range filters are used, all order line items (associated with the specified listing) generated (or last modified) in the last 30 days are retrieved. Date ranges are generally only used for multiple-quantity or multiple-variation, fixed-price listings that can have multiple order line items. There are also pagination filters available that allow the user to control how many and which order line items are returned on each page of a results set.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| ItemID | ItemIDType | [0..1] | Unique identifier for an eBay listing. A listing can have multiple order line items, but only one ItemID . When you use ItemID alone, eBay returns all order line items that are associated with the ItemID . If you pair ItemID with a specific TransactionID , data on a specific order line item is returned. An OrderLineItemID value can be used instead of an ItemID / TransactionID pair to identify an order line item, and if an OrderLineItemID is specified in the request, any ItemID / TransactionID pair specified in the same request is ignored. Note: GetItemTransactions doesn't support SKU as an input because this call requires an identifier that is unique across your active and ended listings. Even when InventoryTrackingMethod is set to SKU in a listing, the SKU is only unique across your active listings (not your ended listings). To retrieve order line items by SKU, use GetSellerTransactions instead. |
| ModTimeFrom | dateTime | [0..1] | The ModTimeFrom and ModTimeTo fields are used to retrieve order line items that were created or modified within a specified date range. The ModTimeFrom field is the starting date range. All of the listing's order line items that were generated or modified within this date range are returned in the output. The maximum date range that may be specified is 30 days. This value cannot be set back more than 90 days in the past, as this call cannot retrieve sales older than 90 days old. The maximum date range that may be specified is 30 days. This field is not applicable (and is ignored) if the user is looking for a specific order line item by either using an ItemID / TransactionID pair, or an OrderLineItemID value. Note: Please note that for a multiple line item order, all line items of that order that meet the filter criteria may be returned in the responses, even the line item(s) that were not actually modified. In other words, if any part of the order was modified, all line items of that order may be returned. |
| ModTimeTo | dateTime | [0..1] | The ModTimeFrom and ModTimeTo fields are used to retrieve order line items that were created or modified within a specified date range. The ModTimeTo field is the ending date range. All eBay order line items that were generated (or last modified) within this date range are returned in the output. The maximum date range that may be specified is 30 days. If the ModTimeFrom field is used and the ModTimeTo field is omitted, the ModTimeTo value defaults to the present time or to 30 days after the date specified with the ModTimeFrom value (if ModTimeFrom value is more than 30 days in the past). This field is not applicable (and is ignored) if the user is looking for a specific order line item by either using an ItemID / TransactionID pair, or an OrderLineItemID value. Note: Please note that for a multiple line item order, all line items of that order that meet the filter criteria may be returned in the responses, even the line item(s) that were not actually modified. In other words, if any part of the order was modified, all line items of that order may be returned. |
| TransactionID | string | [0..1] | Include a TransactionID field in the request if you want to retrieve the data for a specific order line item for the listing specified in the ItemID field. This field is really only applicable for a multiple-quantity or multiple-variation, fixed-price listing that may have multiple sales. An auction listing or a single-quantity, fixed-price listing will only result in one order line item, so this field is not needed in these two cases. If an OrderLineItemID value is used instead to identify an order line item, this field is ignored. If this field is used, any specified date filter is ignored. The TransactionID value for auction listings is always 0 since there can be only one winning bidder/one sale for an auction listing. Note: Beginning in July 2024, non-zero transaction IDs will start being returned for auction listings. If necessary, update code to handle non-zero transaction IDs for auction transactions before this time. |
| Pagination | PaginationType | [0..1] | This container controls how many order line items should be returned per page of data, as well as which page of data to return (if there are multiple pages of order line items). Use the EntriesPerPage property to control the number of order line items to return per call and the PageNumber property to specify the specific page of data to return. If multiple pages of order line items are returned based on input criteria and Pagination properties, GetItemTransactions will need to be called multiple times (with the PageNumber value being increased by 1 each time) to scroll through all results. |
| IncludeFinalValueFee | boolean | [0..1] | This field is included and set to true if the user wants to view the Final Value Fee (FVF) for all order line items in the response. The Final Value Fee is returned in the Transaction.FinalValueFee field. The Final Value Fee is assessed right after the creation of an order line item. See the Selling fees help page for more information about how Final Value Fees are calculated. |
| IncludeContainingOrder | boolean | [0..1] | This field is included and set to true if the user wants to view order-level details, including the unique identifier of the order and the status of the order. The order-level details will be shown in the ContainingOrder container in the response. |
| Platform | TransactionPlatformCodeType | [0..1] | Note: This field is should no longer be used, as its purpose in the past was to give the user the ability to retrieve only eBay marketplace order line items or only Half.com listings, and since the Half.com site no longer exists, this field is no longer relevant. |
| NumberOfDays | int | [0..1] | This date range filter specifies the number of days (24-hour periods) in the past to search for order line items. All eBay order line items that were either created or modified within this period are returned in the response. If specified, NumberOfDays will override any date range specified with the ModTimeFrom / ModTimeTo date range filters. This field is not applicable if a specific order line item is specified either through an ItemID TransactionID pair or an OrderLineItemID value. |
| IncludeVariations | boolean | [0..1] | If this field is included in the request and set to true , details on all variations defined in the specified multiple-variation listing are returned, including variations that have no sales. If this field is not included in the request or set to false , the variations with sales are still returned in separate Transaction nodes. This information is intended to help sellers to reconcile their local inventory with eBay's records, while processing order line items (without requiring a separate call to GetItem ). |
| OrderLineItemID | string | [0..1] | A unique identifier for an eBay order line item. This identifier is created once there is a commitment to buy (bidder wins the auction, buyer clicks buy button, or buyer purchases item through PlaceOffer call). If you want to retrieve data on a specific order line item, you can use an OrderLineItemID value in the request instead of an ItemID / TransactionID pair. If an OrderLineItemID is provided, any specified date range filter is ignored. |

**XML Example:**
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

### GetItemTransactionsResponseType

**Description:** Returns an array of order line item data for the item specified in the request. The results can be used to create a report of data that is commonly necessary for order processing. Zero, one, or many Transaction objects can be returned in the TransactionArray . The set of order line items returned is limited to those that were modified between the times specified in the request's ModTimeFrom and ModTime filters. Also returns the Item object that spawned the order line items. If pagination filters were specified in the request, returns meta-data describing the effects of those filters on the current response and the estimated effects if the same filters are used in subsequent calls. Data from the TransactionArray may be used to trigger the following Platform Notifications: EndOfAuction , AuctionCheckoutComplete , FixedPriceTransaction , CheckoutBuyerRequestsTotal , ItemMarkedShipped , and ItemMarkedPaid . Each notification will be based on the state of the item (a 'snapshot' of the item) at the time the order line item was created.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| PaginationResult | PaginationResultType | [0..1] | Contains the total number of pages ( TotalNumberOfPages ) and the total number of entries ( TotalNumberOfEntries ) that could be returned given repeated calls that use the same selection criteria as the call that returned this response. |
| HasMoreTransactions | boolean | [0..1] | Indicates whether there are additional order line items to retrieve. That is, indicates whether more pages of data are available to be returned, given the filters that were specified in the request. Returns false for the last page of data. |
| TransactionsPerPage | int | [0..1] | Number of order line items returned per page (per call). May be a higher value than ReturnedTransactionCountActual if the page returned is the last page and more than one page of data exists. |
| PageNumber | int | [0..1] | Page number for the page of order line items the response returned. |
| ReturnedTransactionCountActual | int | [0..1] | Number of order line items retrieved in the current page of results just returned. May be a lower value than TransactionsPerPage if the page returned is the last page and more than one page of data exists. |
| Item | ItemType | [0..1] | Item object that spawned the order line item. It is a purchase from this item's listing that the order line item represents. |
| TransactionArray | TransactionArrayType | [0..1] | List of Transaction objects representing the order line items resulting from the listing. Each Transaction object contains the data for one purchase (of one or more items in the same listing). The Transaction.Item field is not returned because the Item object is returned at the root level of the response. See the reference guide for more information about the fields that are returned. Note: The GetItemTransactions call does not support Team Access (formerly multi-user account access) . Transactions are only returned for the user that makes the call. You cannot use GetItemTransactions to return transactions for another user. The call succeeds but returns an empty . |

**XML Example:**
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

1. **Specific transaction identifiers override time filters**
   - Description: If TransactionID or OrderLineItemID is used to target a specific transaction, date filters are ignored.
   - Applies when: When identifying one order line item directly.
   - Impact: The response focuses on the targeted transaction instead of a time window.

2. **Date windows are capped**
   - Description: The maximum date range is 30 days and sales older than 90 days are not retrievable.
   - Applies when: When using ModTimeFrom/ModTimeTo.
   - Impact: Older or broader windows are unsupported.

3. **SKU is not a valid identifier here**
   - Description: GetItemTransactions requires listing-unique identifiers and does not support SKU as input.
   - Applies when: When trying to retrieve transactions by SKU.
   - Impact: Use GetSellerTransactions instead.

4. **Auction transaction IDs are changing**
   - Description: The source notes that non-zero transaction IDs begin returning for auction listings beginning in July 2024.
   - Applies when: When handling auction transaction identifiers.
   - Impact: Code should not assume auction TransactionID is always 0.

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

1. **Use the most specific identifier available**
   - Prefer OrderLineItemID or ItemID plus TransactionID when you need a single transaction.

2. **Use time filters for large sales histories**
   - For listings with many transactions, narrow the result set with ModTime filters and pagination.

3. **Do not rely on SKU lookup**
   - The source explicitly directs SKU-based transaction lookups to GetSellerTransactions.

4. **Prepare for non-zero auction transaction IDs**
   - If traditional code assumes 0 for auction transactions, update it.

---

## Migration Path

### New API Equivalent

| SOAP Operation | New API | Type |
|----------------|---------|------|
| GetItemTransactions | Unknown sellerOrders | Query |
| GetItemTransactions | Unknown buyerOrders | Query |
| GetItemTransactions | Order API ordersByIds | Query |
| GetItemTransactions | Order API orderLineItemsByIds | Query |
| GetItemTransactions | Unknown sellerItemCommitments | Query |
| GetItemTransactions | Unknown buyerItemCommitments | Query |
| GetItemTransactions | Item Commitment API itemCommitmentsByIds | Query |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_getitemtransactions_html.jsonl`; `.trace_artifacts/extract_wsdl_getitemtransactions.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
