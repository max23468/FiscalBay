# GetSellerTransactions - Traditional API (SOAP)

> **Call Name:** GetSellerTransactions
> **API Type:** SOAP XML traditional API
> **API Version:** 1131
> **Service:** Traditional

---

## Metadata

| Property | Value |
|----------|-------|
| **Call Type** | Core |
| **Deprecated** | No |
| **Replacement** | See Migration Path section |
| **Rate Limit** | If exceeded, the application is blocked until the block resets after 15 seconds. |
| **Supported Sites** | Not specified in source |

---

## Description

Use this call to retrieve all of your order line items (transactions). This call can potentially return many order line items, depending on the recent sale activity of the authenticated user.

**Purpose:**
Use this call to retrieve all of your order line items (transactions). This call can potentially return many order line items, depending on the recent sale activity of the authenticated user. Short-duration call rate limit: To protect eBay's infrastructure and servers from being overloaded and/or destabilized, the GetSellerTransactions call has a short-duration call rate limit.

**Use Cases:**
- Retrieve recent seller order line items for sales processing and reporting.
- Filter transaction results by modification time, page, SKU, or inventory tracking method.
- Page through large transaction result sets until all recent sales are retrieved.

**Important Notes:**
- The call cannot retrieve sales older than 90 days.
- If no SKU or time-range filter is used, the call defaults to retrieving order line items from the last 30 days.
- The call has a short-duration rate limit of 1000 calls per seller user ID within any 15-second interval.
- The source recommends considering GetOrders for order management, especially when handling multi-line-item orders.

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
X-EBAY-API-COMPATIBILITY-LEVEL: 1131
X-EBAY-API-CALL-NAME: GetSellerTransactions
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

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| None identified | - | No | No always-required request fields were explicitly labeled in the extracted source. |

#### Optional Fields

| Field Path | Type | Default | Description | Constraints |
|------------|------|---------|-------------|-------------|
| ModTimeFrom | dateTime | Not specified in source | The ModTimeFrom and ModTimeTo fields are used to retrieve order line items that were created or modified within a specified date range. The ModTimeFrom field is the starting date range. All of the seller's order line items that were created or modified within this date range are returned in the output. The maximum date range that may be specified is 30 days. This value cannot be set back more than 90 days in the past, as this call cannot retrieve sales older than 90 days. This field is not applicable if the NumberOfDays date filter is used. If you don't specify a ModTimeFrom / ModTimeTo filter, the NumberOfDays time filter is used and it defaults to 30 (days). Note: Please note that for a multiple line item order, all line items of that order that meet the filter criteria may be returned in the responses, even the line item(s) that were not actually modified. In other words, if any part of the order was modified, all line items of that order may be returned. | Not specified in source |
| ModTimeTo | dateTime | Not specified in source | The ModTimeFrom and ModTimeTo fields are used to retrieve order line items that were created or modified within a specified date range. The ModTimeTo field is the ending date range. All of the seller's order line items that were created or modified within this date range are returned in the output. The maximum date range that may be specified is 30 days. If the ModTimeFrom field is used and the ModTimeTo field is omitted, the ModTimeTo value defaults to the present time or to 30 days past the ModTimeFrom value (if ModTimeFrom value is more than 30 days in the past). This field is not applicable if the NumberOfDays date filter is used. If you don't specify a ModTimeFrom / ModTimeTo filter, the NumberOfDays time filter is used and it defaults to 30 (days). Note: Please note that for a multiple line item order, all line items of that order that meet the filter criteria may be returned in the responses, even the line item(s) that were not actually modified. In other words, if any part of the order was modified, all line items of that order may be returned. | Not specified in source |
| Pagination | PaginationType | Not specified in source | If many order line items are available to retrieve, you may need to call GetSellerTransactions multiple times to retrieve all the data. Each result set is returned as a page of order line items. Use the Pagination filters to control the maximum number of order line items to retrieve per page (i.e., per call), and the page number to retrieve. | Not specified in source |
| IncludeFinalValueFee | boolean | Not specified in source | This field is included and set to true if the user wants to view the Final Value Fee (FVF) for all order line items in the response. The Final Value Fee is returned in the Transaction.FinalValueFee field. The Final Value Fee is assessed right after the creation of an order line item. See the Selling fees help page for more information about how Final Value Fees are calculated. | Not specified in source |
| IncludeContainingOrder | boolean | Not specified in source | This field is included and set to true if the user wants to view order-level details, including the unique identifier of the order and the status of the order. The order-level details will be shown in the ContainingOrder container in the response. | Not specified in source |
| SKUArray | SKUArrayType | Not specified in source | This container is used to search for order line items generated from one or more product SKU values. The response will only include order line items for the seller's product(s) that are represented by the specified SKU value(s). If a user wants to retrieve order line items based on SKUs, the InventoryTrackingMethod must be set to SKU . The InventoryTrackingMethod value can be set when the seller lists the item through an AddFixedPriceItem call, or it can be set by including the InventoryTrackingMethod field in a GetSellerTransactions call and setting its value to SKU . Note: SKU values must be defined for products in listings for this container to be applicable. | Not specified in source |
| Platform | TransactionPlatformCodeType | Not specified in source | Note: This field should no longer be used since its sole purpose was to allow the seller to filter between eBay orders and Half.com orders, and the Half.com site no longer exists. | Not specified in source |
| NumberOfDays | int | Not specified in source | This field is used to specify how many days (24-hour periods) back in the past you wish to retrieve order line items. All order line items created (or last modified) within this period are retrieved. This value can be set between 1 (day) and 30 (days), and defaults to 30 (days) if omitted from the call. If the NumberOfDays filter is used, ModTimeFrom and ModTimeTo date range filters are ignored (if included in the same request). | Not specified in source |
| IncludeCodiceFiscale | boolean | Not specified in source | If this field is included in the call request and set to true , taxpayer identification information for the buyer is returned under the BuyerTaxIdentifier container. Codice Fiscale is only applicable to buyers on the Italy and Spain sites. It is required that buyers on the Italy site provide their Codice Fiscale ID before buying an item, and sellers on the Spain site have the option of requiring buyers on the Spain site to provide their taxpayer ID. | Not specified in source |

#### Conditional Fields

| Field Path | Type | Condition | Description |
|------------|------|-----------|-------------|
| InventoryTrackingMethod | InventoryTrackingMethodCodeType | Conditionally | This filter is used if the seller wishes to set/change the inventory tracking method. When creating a listing with the AddFixedPriceItem call (or relisting with RelistFixedPriceItem call), sellers can decide whether to track their inventory by Item ID (generated by eBay at listing time) or by seller-defined SKU value. This field is needed (and its value must be set to SKU ) if the seller wishes to retrieve order line items based on specified SKU values (specified through SKUArray container) and the current inventory tracking method is set to Item ID. A seller can use a GetItem call for a listing (and look for the Item.InventoryTrackingMethod in the response) to see which inventory tracking method is used for the listing/product. |

## Response Structure

### XML Schema

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
| PaginationResult | PaginationResultType | Always | Container consisting of the total number of order line items that match the input criteria and the total number of pages that must be scrolled through to view all order line items. To scroll through each page of order line item data, make subsequent GetSellerTransactions calls, incrementing the Pagination.PageNumber field by a value of '1' each time. |
| HasMoreTransactions | boolean | Always | This flag indicates whether there are additional pages of order line items to view. This field will be returned as true if there are additional pages or order line items to view , or false if the current page of order line item data is the last page of data. |
| TransactionsPerPage | int | Always | This value indicates the number of order line items returned per page (per call) and is controlled by the Pagination.EntriesPerPage value passed in the call request. Unless it is the last (or possibly only) page of data ( HasMoreTransactions=false ), the TransactionsPerPage value should equal the Pagination.EntriesPerPage value passed in the call request. Note: Due to the fact that item data on the eBay platform has a shorter retention period than order data, it is possible that some retrieved pages will contain no data. For pages that contain no data, the ReturnedTransactionCountActual value will be '0'. It is also possible that pages 2, 3, and 4 have no data, but pages 1 and 5 do have data. Therefore, we recommend that you scroll through each page of data (making subsequent GetSellerTransactions calls and incrementing the Pagination.PageNumber value by '1' each time) until you reach the last page, indicated by HasMoreTransactions=false . |
| PageNumber | int | Always | This value indicates the page number of retrieved order line items that match the input criteria. This value is controlled by the Pagination.PageNumber value passed in the call request. To scroll through all pages of order line items that match the input criteria, you increment the Pagination.PageNumber value by 1 with each subsequent GetSellerTransactions call. |
| ReturnedTransactionCountActual | int | Always | This value indicates the total number of (non-empty) order line items retrieved in the current page of results. The ReturnedTransactionCountActual value will be lower than the TransactionsPerPage value if one or more empty order line items are retrieved on the page. Note: Due to the fact that item data on the eBay platform has a shorter retention period than order data, it is possible that some retrieved pages will contain no data. For pages that contain no order line item data, the ReturnedTransactionCountActual value will be '0'. It is also possible that pages 2, 3, and 4 have no data, but pages 1 and 5 do have data. Therefore, we recommend that you scroll through each page of data (making subsequent GetSellerTransactions calls and incrementing the Pagination.PageNumber value by '1' each time) until you reach the last page, indicated by HasMoreTransactions=false . |
| Seller | UserType | Always | Contains information about the seller whose order line items are being returned. See the reference guide for information about the Seller object fields that are returned. |
| TransactionArray | TransactionArrayType | Conditionally | List of Transaction objects representing the seller's recent sales. Each Transaction object contains the data for one purchase (of one or more items in the same listing). See the reference guide for more information about the fields that are returned for each order line item. |

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

### GetSellerTransactionsRequestType

**Description:** Retrieves a seller's order line item information. To retrieve order line items for another seller, the GetItemTransactions ) call should be used. This call cannot retrieve sales older than 90 days old. If one or more SKU values or the date range filters ( ModTimeFrom / ModTimeTo or NumberOfDays ) are not used, the GetItemTransactions ) call will retrieve order line items created (or modified) within the last 30 days.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| ModTimeFrom | dateTime | [0..1] | The ModTimeFrom and ModTimeTo fields are used to retrieve order line items that were created or modified within a specified date range. The ModTimeFrom field is the starting date range. All of the seller's order line items that were created or modified within this date range are returned in the output. The maximum date range that may be specified is 30 days. This value cannot be set back more than 90 days in the past, as this call cannot retrieve sales older than 90 days. This field is not applicable if the NumberOfDays date filter is used. If you don't specify a ModTimeFrom / ModTimeTo filter, the NumberOfDays time filter is used and it defaults to 30 (days). Note: Please note that for a multiple line item order, all line items of that order that meet the filter criteria may be returned in the responses, even the line item(s) that were not actually modified. In other words, if any part of the order was modified, all line items of that order may be returned. |
| ModTimeTo | dateTime | [0..1] | The ModTimeFrom and ModTimeTo fields are used to retrieve order line items that were created or modified within a specified date range. The ModTimeTo field is the ending date range. All of the seller's order line items that were created or modified within this date range are returned in the output. The maximum date range that may be specified is 30 days. If the ModTimeFrom field is used and the ModTimeTo field is omitted, the ModTimeTo value defaults to the present time or to 30 days past the ModTimeFrom value (if ModTimeFrom value is more than 30 days in the past). This field is not applicable if the NumberOfDays date filter is used. If you don't specify a ModTimeFrom / ModTimeTo filter, the NumberOfDays time filter is used and it defaults to 30 (days). Note: Please note that for a multiple line item order, all line items of that order that meet the filter criteria may be returned in the responses, even the line item(s) that were not actually modified. In other words, if any part of the order was modified, all line items of that order may be returned. |
| Pagination | PaginationType | [0..1] | If many order line items are available to retrieve, you may need to call GetSellerTransactions multiple times to retrieve all the data. Each result set is returned as a page of order line items. Use the Pagination filters to control the maximum number of order line items to retrieve per page (i.e., per call), and the page number to retrieve. |
| IncludeFinalValueFee | boolean | [0..1] | This field is included and set to true if the user wants to view the Final Value Fee (FVF) for all order line items in the response. The Final Value Fee is returned in the Transaction.FinalValueFee field. The Final Value Fee is assessed right after the creation of an order line item. See the Selling fees help page for more information about how Final Value Fees are calculated. |
| IncludeContainingOrder | boolean | [0..1] | This field is included and set to true if the user wants to view order-level details, including the unique identifier of the order and the status of the order. The order-level details will be shown in the ContainingOrder container in the response. |
| SKUArray | SKUArrayType | [0..1] | This container is used to search for order line items generated from one or more product SKU values. The response will only include order line items for the seller's product(s) that are represented by the specified SKU value(s). If a user wants to retrieve order line items based on SKUs, the InventoryTrackingMethod must be set to SKU . The InventoryTrackingMethod value can be set when the seller lists the item through an AddFixedPriceItem call, or it can be set by including the InventoryTrackingMethod field in a GetSellerTransactions call and setting its value to SKU . Note: SKU values must be defined for products in listings for this container to be applicable. |
| Platform | TransactionPlatformCodeType | [0..1] | Note: This field should no longer be used since its sole purpose was to allow the seller to filter between eBay orders and Half.com orders, and the Half.com site no longer exists. |
| NumberOfDays | int | [0..1] | This field is used to specify how many days (24-hour periods) back in the past you wish to retrieve order line items. All order line items created (or last modified) within this period are retrieved. This value can be set between 1 (day) and 30 (days), and defaults to 30 (days) if omitted from the call. If the NumberOfDays filter is used, ModTimeFrom and ModTimeTo date range filters are ignored (if included in the same request). |
| InventoryTrackingMethod | InventoryTrackingMethodCodeType | [0..1] | This filter is used if the seller wishes to set/change the inventory tracking method. When creating a listing with the AddFixedPriceItem call (or relisting with RelistFixedPriceItem call), sellers can decide whether to track their inventory by Item ID (generated by eBay at listing time) or by seller-defined SKU value. This field is needed (and its value must be set to SKU ) if the seller wishes to retrieve order line items based on specified SKU values (specified through SKUArray container) and the current inventory tracking method is set to Item ID. A seller can use a GetItem call for a listing (and look for the Item.InventoryTrackingMethod in the response) to see which inventory tracking method is used for the listing/product. |
| IncludeCodiceFiscale | boolean | [0..1] | If this field is included in the call request and set to true , taxpayer identification information for the buyer is returned under the BuyerTaxIdentifier container. Codice Fiscale is only applicable to buyers on the Italy and Spain sites. It is required that buyers on the Italy site provide their Codice Fiscale ID before buying an item, and sellers on the Spain site have the option of requiring buyers on the Spain site to provide their taxpayer ID. |

**XML Example:**
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

### GetSellerTransactionsResponseType

**Description:** Returns an array of order line item (transaction) data for the seller specified in the request. The results can be used to create a report of data that is commonly necessary for order processing. Zero, one, or many Transaction objects can be returned in the TransactionArray . The set of order line items returned is limited to those that were modified between the times specified in the request's ModTimeFrom and ModTimeTo filters. The order line items returned are sorted by Transaction.Status.LastTimeModified , ascending order (that is, order line items that more recently were modified are returned last). This call also returns information about the seller whose order line items were requested. If pagination filters were specified in the request, returns meta-data describing the effects of those filters on the current response and the estimated effects if the same filters are used in subsequent calls.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| PaginationResult | PaginationResultType | [0..1] | Container consisting of the total number of order line items that match the input criteria and the total number of pages that must be scrolled through to view all order line items. To scroll through each page of order line item data, make subsequent GetSellerTransactions calls, incrementing the Pagination.PageNumber field by a value of '1' each time. |
| HasMoreTransactions | boolean | [0..1] | This flag indicates whether there are additional pages of order line items to view. This field will be returned as true if there are additional pages or order line items to view , or false if the current page of order line item data is the last page of data. |
| TransactionsPerPage | int | [0..1] | This value indicates the number of order line items returned per page (per call) and is controlled by the Pagination.EntriesPerPage value passed in the call request. Unless it is the last (or possibly only) page of data ( HasMoreTransactions=false ), the TransactionsPerPage value should equal the Pagination.EntriesPerPage value passed in the call request. Note: Due to the fact that item data on the eBay platform has a shorter retention period than order data, it is possible that some retrieved pages will contain no data. For pages that contain no data, the ReturnedTransactionCountActual value will be '0'. It is also possible that pages 2, 3, and 4 have no data, but pages 1 and 5 do have data. Therefore, we recommend that you scroll through each page of data (making subsequent GetSellerTransactions calls and incrementing the Pagination.PageNumber value by '1' each time) until you reach the last page, indicated by HasMoreTransactions=false . |
| PageNumber | int | [0..1] | This value indicates the page number of retrieved order line items that match the input criteria. This value is controlled by the Pagination.PageNumber value passed in the call request. To scroll through all pages of order line items that match the input criteria, you increment the Pagination.PageNumber value by 1 with each subsequent GetSellerTransactions call. |
| ReturnedTransactionCountActual | int | [0..1] | This value indicates the total number of (non-empty) order line items retrieved in the current page of results. The ReturnedTransactionCountActual value will be lower than the TransactionsPerPage value if one or more empty order line items are retrieved on the page. Note: Due to the fact that item data on the eBay platform has a shorter retention period than order data, it is possible that some retrieved pages will contain no data. For pages that contain no order line item data, the ReturnedTransactionCountActual value will be '0'. It is also possible that pages 2, 3, and 4 have no data, but pages 1 and 5 do have data. Therefore, we recommend that you scroll through each page of data (making subsequent GetSellerTransactions calls and incrementing the Pagination.PageNumber value by '1' each time) until you reach the last page, indicated by HasMoreTransactions=false . |
| Seller | UserType | [0..1] | Contains information about the seller whose order line items are being returned. See the reference guide for information about the Seller object fields that are returned. |
| TransactionArray | TransactionArrayType | [0..1] | List of Transaction objects representing the seller's recent sales. Each Transaction object contains the data for one purchase (of one or more items in the same listing). See the reference guide for more information about the fields that are returned for each order line item. |

**XML Example:**
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

---

## Enumerations

### NumberOfDays

| Value | Description | Notes |
|-------|-------------|-------|
| 1-30 | The number of days of transactions to retrieve. | Defaults to 30 if omitted. |

### Platform

| Value | Description | Notes |
|-------|-------------|-------|
| Deprecated | This field should no longer be used because Half.com no longer exists. | Marked deprecated/no-op in WSDL metadata. |

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

1. **Date windows are capped**
   - Description: ModTimeFrom/ModTimeTo can cover at most 30 days, and sales older than 90 days are not retrievable.
   - Applies when: When using modification-time filters.
   - Impact: Older or oversized windows are not supported.

2. **NumberOfDays overrides explicit mod-time filters**
   - Description: If NumberOfDays is used, ModTimeFrom and ModTimeTo are ignored.
   - Applies when: When both filter styles are provided.
   - Impact: Request behavior follows NumberOfDays.

3. **SKU lookups may require SKU inventory tracking**
   - Description: InventoryTrackingMethod must be set to SKU when retrieving transactions by SKU and the current tracking method is Item ID.
   - Applies when: When SKUArray is used.
   - Impact: Without SKU tracking, SKU-based transaction lookup may not work as intended.

4. **Paginate until the final page**
   - Description: The source warns that some middle pages can be empty even when later pages still contain data.
   - Applies when: When reading paged results.
   - Impact: Continue paging until HasMoreTransactions becomes false.

### Revision Restrictions (If applicable)

| Condition | Allowed Changes | Prohibited Changes |
|-----------|-----------------|-------------------|
| Source does not provide a separate revision-restrictions table for this call | See operation-level rules and field descriptions | Not specified in source |

---

## Rate Limits & Throttling

| Metric | Limit | Window | Notes |
|--------|-------|--------|-------|
| API Calls | Not specified in source | Not specified in source | No long-window quota is explicitly provided in the extracted source. |
| Frequency | 1000 calls per seller user ID | 15 seconds | If exceeded, the application is blocked until the block resets after 15 seconds. |

**Throttling Behavior:**
If exceeded, the application is blocked until the block resets after 15 seconds.

---

## Best Practices

1. **Prefer recent and narrow filters**
   - Use ModTime or NumberOfDays filters intentionally so that you avoid broad transaction scans.

2. **Keep paging even through empty pages**
   - The source explicitly notes that intermediate pages may be empty, so continue until HasMoreTransactions is false.

3. **Use GetOrders when appropriate**
   - The source suggests GetOrders as a better fit for some order-management workflows.

4. **Request extra fee and order details only when needed**
   - IncludeFinalValueFee and IncludeContainingOrder should be enabled only when your workflow requires those details.

---

## Migration Path

### New API Equivalent

| SOAP Operation | New API | Type |
|----------------|---------|------|
| GetSellerTransactions | Order API orders | Query |
| GetSellerTransactions | Order API ordersByIds | Query |
| GetSellerTransactions | Order API orderLineItemsByIds | Query |
| GetSellerTransactions | Item Commitment API itemCommitments | Query |
| GetSellerTransactions | Item Commitment API itemCommitmentsByIds | Query |
| GetSellerTransactions | Finance API getOrders getOrder methods | GET |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_getsellertransactions_html.jsonl`; `.trace_artifacts/extract_wsdl_getsellertransactions.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
