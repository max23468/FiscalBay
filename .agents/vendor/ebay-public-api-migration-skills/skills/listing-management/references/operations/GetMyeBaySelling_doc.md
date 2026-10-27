# GetMyeBaySelling - Traditional API (SOAP)

> **Call Name:** GetMyeBaySelling
> **API Type:** SOAP XML traditional API
> **API Version:** Not specified in source
> **Service:** Traditional

---

## Metadata

| Property | Value |
|----------|-------|
| **Call Type** | Not specified in source |
| **Deprecated** | Yes |
| **Replacement** | sellerListingSearch query of the Listing API |
| **Rate Limit** | Short-duration call rate limit: To protect eBay's infrastructure and servers from being overloaded and/or destabilized, the GetMyeBaySelling call has a short-duration call rate limit to restrict bursts of very high traffic.Per (seller) user ID, no more than 300 GetMyeBaySelling calls can be executed within any 15-second interval. If this call rate limit is exceeded at any time, the application making the called is blocked. This short-duration call rate limit applies to all seller accounts, and sellers/developers cannot appeal or request for a higher limit. |
| **Supported Sites** | Not specified in source |

---

## Description

Use this call to retrieve information from the All Selling section of the authenticated user's My eBay account. You can review items that the user is currently selling (the Active list), items that have bids, sold items, and unsold items. You can also return items that the user has deleted from their sold and unsold lists, and items that have been scheduled but are not yet active. GetMyeBaySelling returns information for only the user authenticated with the call.

**Purpose:**
Use this call to retrieve information from the All Selling section of the authenticated user's My eBay account. You can review items that the user is currently selling (the Active list), items that have bids, sold items, and unsold items.

**Use Cases:**
- Depending on the selling information you want to inspect, GetMyeBaySelling can return any combination of selling information contained in the user's My eBay account.
- For each response container you want returned, specify a value of true in the respective container's Include field in your request.
- For example, the following code returns the list of items currently for sale: <ActiveList> <Include>true</Include> </ActiveList> Each response container returns with a default set of fields.

**Important Notes:**
- GetMyeBaySelling returns information for only the user authenticated with the call.
- Short-duration call rate limit: To protect eBay's infrastructure and servers from being overloaded and/or destabilized, the GetMyeBaySelling call has a short-duration call rate limit to restrict bursts of very high traffic.Per (seller) user ID, no more than 300 GetMyeBaySelling calls can be executed within any 15-second interval.
- If this call rate limit is exceeded at any time, the application making the called is blocked.
- This short-duration call rate limit applies to all seller accounts, and sellers/developers cannot appeal or request for a higher limit.
- In this case, you only have to specify a container if you want to override the default return set with a custom setting.

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
X-EBAY-API-CALL-NAME: GetMyeBaySelling
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
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <ActiveList>
    <Include>boolean</Include>
    <IncludeNotes>boolean</IncludeNotes>
    <ListingType></ListingType>
    <Pagination>
      <EntriesPerPage>int</EntriesPerPage>
      <PageNumber>int</PageNumber>
    </Pagination>
    <Sort></Sort>
  </ActiveList>
  <HideVariations>boolean</HideVariations>
  <ScheduledList>
    <Include>boolean</Include>
    <IncludeNotes>boolean</IncludeNotes>
    <Pagination>
      <EntriesPerPage>int</EntriesPerPage>
      <PageNumber>int</PageNumber>
    </Pagination>
    <Sort></Sort>
  </ScheduledList>
  <SellingSummary>
    <Include>boolean</Include>
  </SellingSummary>
  <SoldList>
    <DurationInDays>int</DurationInDays>
    <Include>boolean</Include>
    <IncludeNotes>boolean</IncludeNotes>
    <OrderStatusFilter></OrderStatusFilter>
    <Pagination>
      <EntriesPerPage>int</EntriesPerPage>
      <PageNumber>int</PageNumber>
    </Pagination>
    <Sort></Sort>
  </SoldList>
  <UnsoldList>
    <DurationInDays>int</DurationInDays>
    <Include>boolean</Include>
    <IncludeNotes>boolean</IncludeNotes>
    <Pagination>
      <EntriesPerPage>int</EntriesPerPage>
      <PageNumber>int</PageNumber>
    </Pagination>
    <Sort></Sort>
  </UnsoldList>
  <!-- Standard Input Fields -->
  <DetailLevel></DetailLevel>
  <!-- ... more DetailLevel values allowed here ... -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <OutputSelector>string</OutputSelector>
  <!-- ... more OutputSelector values allowed here ... -->
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetMyeBaySellingRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| Not specified in source | Not specified in source | Not specified in source | Not specified in source |

#### Optional Fields

| Field Path | Type | Default | Description | Constraints |
|------------|------|---------|-------------|-------------|
| ScheduledList | ItemListCustomizationType | Not specified in source | Include this container and set the <b>ScheduledList.Include</b> field to <code>true</code> to return the list of items that are scheduled to become active listings on eBay.com at a future date/time. <br><br> The user also has the option of using pagination and sorting for the list of Scheduled listings that will be returned. | Not specified in source |
| ActiveList | ItemListCustomizationType | Not specified in source | Include this container and set the <b>ActiveList.Include</b> field to <code>true</code> to return the list of active listings on eBay.com. <br><br> The user also has the option of using pagination and sorting for the list of active listings that will be returned. | Not specified in source |
| SoldList | ItemListCustomizationType | Not specified in source | Include this container and set the <b>SoldList.Include</b> field to <code>true</code> to return the list of sold order line items. <br><br> The user also has the option of using pagination and sorting for the list of sold items that will be returned. | Not specified in source |
| UnsoldList | ItemListCustomizationType | Not specified in source | Include this container and set the <b>UnsoldList.Include</b> field to <code>true</code> to return the listings that have ended without a purchase. <br><br> The user also has the option of using pagination and sorting for the list of unsold items that will be returned. | Not specified in source |
| SellingSummary | ItemListCustomizationType | Not specified in source | Include this container and set the <b>SellingSummary.Include</b> field to <code>true</code> to return the <b>SellingSummary</b> container in the response. The <b>SellingSummary</b> container consists of selling activity counts and values. | Not specified in source |
| HideVariations | boolean | false | If this field is included and set to <code>true</code>, the <b>Variations</b> node (and all variation data) is omitted for all multiple-variation listings in the response. If this field is omitted or set to <code>false</code>, the <b>Variations</b> node is returned for all multiple-variation listings in the response. <br> | Default: false |

#### Conditional Fields

| Field Path | Type | Condition | Description |
|------------|------|-----------|-------------|
| Not specified in source | Not specified in source | Not specified in source | Not specified in source |

## Response Structure

### XML Schema

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <ActiveList>
    <ItemArray>
      <Item>
        <BestOfferDetails>
          <BestOfferCount>int</BestOfferCount>
        </BestOfferDetails>
        <BuyItNowPrice currencyID="CurrencyCodeType">
        </BuyItNowPrice>
        <ClassifiedAdPayPerLeadFee currencyID="CurrencyCodeType">
        </ClassifiedAdPayPerLeadFee>
        <eBayNotes>string</eBayNotes>
        <HideFromSearch>boolean</HideFromSearch>
        <ItemID></ItemID>
        <LeadCount>int</LeadCount>
        <ListingDetails>
          <StartTime>dateTime</StartTime>
        </ListingDetails>
        <ListingDuration>token</ListingDuration>
        <ListingType></ListingType>
        <NewLeadCount>int</NewLeadCount>
        <PictureDetails>
          <GalleryURL>anyURI</GalleryURL>
        </PictureDetails>
        <PrivateNotes>string</PrivateNotes>
        <Quantity>int</Quantity>
        <QuantityAvailable>int</QuantityAvailable>
        <QuestionCount>long</QuestionCount>
        <ReasonHideFromSearch></ReasonHideFromSearch>
        <ReservePrice currencyID="CurrencyCodeType">
        </ReservePrice>
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
        <SellingStatus>
          <BidCount>int</BidCount>
          <BidderCount>long</BidderCount>
          <ConvertedCurrentPrice currencyID="CurrencyCodeType">
          </ConvertedCurrentPrice>
          <CurrentPrice currencyID="CurrencyCodeType">
          </CurrentPrice>
          <HighBidder>
            <FeedbackRatingStar></FeedbackRatingStar>
            <FeedbackScore>int</FeedbackScore>
            <UserID></UserID>
          </HighBidder>
          <PromotionalSaleDetails>
            <EndTime>dateTime</EndTime>
            <OriginalPrice currencyID="CurrencyCodeType">
            </OriginalPrice>
            <StartTime>dateTime</StartTime>
          </PromotionalSaleDetails>
          <QuantitySold>int</QuantitySold>
          <ReserveMet>boolean</ReserveMet>
        </SellingStatus>
        <ShippingDetails>
          <GlobalShipping>boolean</GlobalShipping>
          <ShippingServiceOptions>
            <LocalPickup>boolean</LocalPickup>
            <ShippingServiceCost currencyID="CurrencyCodeType">
            </ShippingServiceCost>
          </ShippingServiceOptions>
          <!-- ... more ShippingServiceOptions nodes allowed here ... -->
          <ShippingType></ShippingType>
        </ShippingDetails>
        <SKU></SKU>
        <StartPrice currencyID="CurrencyCodeType">
        </StartPrice>
        <TimeLeft>duration</TimeLeft>
        <Title>string</Title>
        <Variations>
          <Variation>
            <PrivateNotes>string</PrivateNotes>
            <Quantity>int</Quantity>
            <SellingStatus>
              <BidCount>int</BidCount>
              <BidderCount>long</BidderCount>
              <ConvertedCurrentPrice currencyID="CurrencyCodeType">
              </ConvertedCurrentPrice>
              <CurrentPrice currencyID="CurrencyCodeType">
              </CurrentPrice>
              <HighBidder>
                <FeedbackRatingStar></FeedbackRatingStar>
                <FeedbackScore>int</FeedbackScore>
                <UserID></UserID>
              </HighBidder>
              <PromotionalSaleDetails>
                <EndTime>dateTime</EndTime>
                <OriginalPrice currencyID="CurrencyCodeType">
                </OriginalPrice>
                <StartTime>dateTime</StartTime>
              </PromotionalSaleDetails>
              <QuantitySold>int</QuantitySold>
              <ReserveMet>boolean</ReserveMet>
            </SellingStatus>
            <SKU></SKU>
            <StartPrice currencyID="CurrencyCodeType">
            </StartPrice>
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
            <WatchCount>long</WatchCount>
          </Variation>
          <!-- ... more Variation nodes allowed here ... -->
        </Variations>
        <WatchCount>long</WatchCount>
      </Item>
      <!-- ... more Item nodes allowed here ... -->
    </ItemArray>
    <PaginationResult>
      <TotalNumberOfEntries>int</TotalNumberOfEntries>
      <TotalNumberOfPages>int</TotalNumberOfPages>
    </PaginationResult>
  </ActiveList>
  <ScheduledList>
    <ItemArray>
      <Item>
        <BuyItNowPrice currencyID="CurrencyCodeType">
        </BuyItNowPrice>
        <ClassifiedAdPayPerLeadFee currencyID="CurrencyCodeType">
        </ClassifiedAdPayPerLeadFee>
        <eBayNotes>string</eBayNotes>
        <HideFromSearch>boolean</HideFromSearch>
        <ItemID></ItemID>
        <ListingDetails>
          <StartTime>dateTime</StartTime>
        </ListingDetails>
        <ListingDuration>token</ListingDuration>
        <ListingType></ListingType>
        <PictureDetails>
          <GalleryURL>anyURI</GalleryURL>
        </PictureDetails>
        <PrivateNotes>string</PrivateNotes>
        <Quantity>int</Quantity>
        <QuantityAvailable>int</QuantityAvailable>
        <QuestionCount>long</QuestionCount>
        <ReasonHideFromSearch></ReasonHideFromSearch>
        <ReservePrice currencyID="CurrencyCodeType">
        </ReservePrice>
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
        <SellingStatus>
          <ConvertedCurrentPrice currencyID="CurrencyCodeType">
          </ConvertedCurrentPrice>
          <CurrentPrice currencyID="CurrencyCodeType">
          </CurrentPrice>
          <QuantitySold>int</QuantitySold>
          <ReserveMet>boolean</ReserveMet>
        </SellingStatus>
        <ShippingDetails>
          <GlobalShipping>boolean</GlobalShipping>
          <ShippingServiceOptions>
            <LocalPickup>boolean</LocalPickup>
            <ShippingServiceCost currencyID="CurrencyCodeType">
            </ShippingServiceCost>
          </ShippingServiceOptions>
          <!-- ... more ShippingServiceOptions nodes allowed here ... -->
          <ShippingType></ShippingType>
        </ShippingDetails>
        <SKU></SKU>
        <StartPrice currencyID="CurrencyCodeType">
        </StartPrice>
        <TimeLeft>duration</TimeLeft>
        <Title>string</Title>
        <Variations>
          <Variation>
            <PrivateNotes>string</PrivateNotes>
            <Quantity>int</Quantity>
            <SellingStatus>
              <ConvertedCurrentPrice currencyID="CurrencyCodeType">
              </ConvertedCurrentPrice>
              <CurrentPrice currencyID="CurrencyCodeType">
              </CurrentPrice>
              <QuantitySold>int</QuantitySold>
              <ReserveMet>boolean</ReserveMet>
            </SellingStatus>
            <SKU></SKU>
            <StartPrice currencyID="CurrencyCodeType">
            </StartPrice>
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
            <WatchCount>long</WatchCount>
          </Variation>
          <!-- ... more Variation nodes allowed here ... -->
        </Variations>
        <WatchCount>long</WatchCount>
      </Item>
      <!-- ... more Item nodes allowed here ... -->
    </ItemArray>
    <PaginationResult>
      <TotalNumberOfEntries>int</TotalNumberOfEntries>
      <TotalNumberOfPages>int</TotalNumberOfPages>
    </PaginationResult>
  </ScheduledList>
  <SellingSummary>
    <ActiveAuctionCount>int</ActiveAuctionCount>
    <AuctionSellingCount>int</AuctionSellingCount>
    <SoldDurationInDays>int</SoldDurationInDays>
    <TotalAuctionSellingValue currencyID="CurrencyCodeType">
    </TotalAuctionSellingValue>
    <TotalSoldCount>int</TotalSoldCount>
    <TotalSoldValue currencyID="CurrencyCodeType">
    </TotalSoldValue>
  </SellingSummary>
  <SoldList>
    <OrderTransactionArray>
      <OrderTransaction>
        <Order>
          <OrderID></OrderID>
          <RefundAmount currencyID="CurrencyCodeType">
          </RefundAmount>
          <RefundStatus>string</RefundStatus>
          <Subtotal currencyID="CurrencyCodeType">
          </Subtotal>
          <TransactionArray>
            <Transaction>
              <Buyer>
                <BuyerInfo>
                  <ShippingAddress>
                    <PostalCode>string</PostalCode>
                  </ShippingAddress>
                </BuyerInfo>
                <Email>string</Email>
                <UserID></UserID>
              </Buyer>
              <ConvertedTransactionPrice currencyID="CurrencyCodeType">
              </ConvertedTransactionPrice>
              <CreatedDate>dateTime</CreatedDate>
              <FeedbackLeft>
                <CommentType></CommentType>
              </FeedbackLeft>
              <FeedbackReceived>
                <CommentType></CommentType>
              </FeedbackReceived>
              <IsMultiLegShipping>boolean</IsMultiLegShipping>
              <Item>
                <BuyItNowPrice currencyID="CurrencyCodeType">
                </BuyItNowPrice>
                <ClassifiedAdPayPerLeadFee currencyID="CurrencyCodeType">
                </ClassifiedAdPayPerLeadFee>
                <HideFromSearch>boolean</HideFromSearch>
                <ItemID></ItemID>
                <ListingDetails>
                  <EndTime>dateTime</EndTime>
                  <StartTime>dateTime</StartTime>
                </ListingDetails>
                <ListingType></ListingType>
                <PictureDetails>
                  <GalleryURL>anyURI</GalleryURL>
                </PictureDetails>
                <PrivateNotes>string</PrivateNotes>
                <Quantity>int</Quantity>
                <QuantityAvailable>int</QuantityAvailable>
                <QuestionCount>long</QuestionCount>
                <ReasonHideFromSearch></ReasonHideFromSearch>
                <ReservePrice currencyID="CurrencyCodeType">
                </ReservePrice>
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
                <SellingStatus>
                  <ConvertedCurrentPrice currencyID="CurrencyCodeType">
                  </ConvertedCurrentPrice>
                  <CurrentPrice currencyID="CurrencyCodeType">
                  </CurrentPrice>
                  <QuantitySold>int</QuantitySold>
                  <ReserveMet>boolean</ReserveMet>
                </SellingStatus>
                <ShippingDetails>
                  <GlobalShipping>boolean</GlobalShipping>
                  <ShippingServiceOptions>
                    <LocalPickup>boolean</LocalPickup>
                    <ShippingServiceCost currencyID="CurrencyCodeType">
                    </ShippingServiceCost>
                  </ShippingServiceOptions>
                  <!-- ... more ShippingServiceOptions nodes allowed here ... -->
                  <ShippingType></ShippingType>
                </ShippingDetails>
                <SKU></SKU>
                <StartPrice currencyID="CurrencyCodeType">
                </StartPrice>
                <TimeLeft>duration</TimeLeft>
                <Title>string</Title>
                <Variations>
                  <Variation>
                    <Quantity>int</Quantity>
                    <SellingStatus>
                      <ConvertedCurrentPrice currencyID="CurrencyCodeType">
                      </ConvertedCurrentPrice>
                      <CurrentPrice currencyID="CurrencyCodeType">
                      </CurrentPrice>
                      <QuantitySold>int</QuantitySold>
                      <ReserveMet>boolean</ReserveMet>
                    </SellingStatus>
                    <SKU></SKU>
                    <StartPrice currencyID="CurrencyCodeType">
                    </StartPrice>
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
                    <WatchCount>long</WatchCount>
                  </Variation>
                  <!-- ... more Variation nodes allowed here ... -->
                </Variations>
                <WatchCount>long</WatchCount>
              </Item>
              <OrderLineItemID>string</OrderLineItemID>
              <PaidTime>dateTime</PaidTime>
              <Platform></Platform>
              <QuantityPurchased>int</QuantityPurchased>
              <SellerPaidStatus></SellerPaidStatus>
              <ShippedTime>dateTime</ShippedTime>
              <Status>
                <PaymentHoldStatus></PaymentHoldStatus>
              </Status>
              <TotalPrice currencyID="CurrencyCodeType">
              </TotalPrice>
              <TotalTransactionPrice currencyID="CurrencyCodeType">
              </TotalTransactionPrice>
              <TransactionID>string</TransactionID>
            </Transaction>
            <!-- ... more Transaction nodes allowed here ... -->
          </TransactionArray>
        </Order>
        <Transaction>
          <Buyer>
            <BuyerInfo>
              <ShippingAddress>
                <PostalCode>string</PostalCode>
              </ShippingAddress>
            </BuyerInfo>
            <Email>string</Email>
            <UserID></UserID>
          </Buyer>
          <ConvertedTransactionPrice currencyID="CurrencyCodeType">
          </ConvertedTransactionPrice>
          <CreatedDate>dateTime</CreatedDate>
          <FeedbackLeft>
            <CommentType></CommentType>
          </FeedbackLeft>
          <FeedbackReceived>
            <CommentType></CommentType>
          </FeedbackReceived>
          <IsMultiLegShipping>boolean</IsMultiLegShipping>
          <Item>
            <BuyItNowPrice currencyID="CurrencyCodeType">
            </BuyItNowPrice>
            <ClassifiedAdPayPerLeadFee currencyID="CurrencyCodeType">
            </ClassifiedAdPayPerLeadFee>
            <HideFromSearch>boolean</HideFromSearch>
            <ItemID></ItemID>
            <ListingDetails>
              <EndTime>dateTime</EndTime>
              <StartTime>dateTime</StartTime>
            </ListingDetails>
            <ListingType></ListingType>
            <PictureDetails>
              <GalleryURL>anyURI</GalleryURL>
            </PictureDetails>
            <PrivateNotes>string</PrivateNotes>
            <Quantity>int</Quantity>
            <QuantityAvailable>int</QuantityAvailable>
            <QuestionCount>long</QuestionCount>
            <ReasonHideFromSearch></ReasonHideFromSearch>
            <ReservePrice currencyID="CurrencyCodeType">
            </ReservePrice>
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
            <SellingStatus>
              <ConvertedCurrentPrice currencyID="CurrencyCodeType">
              </ConvertedCurrentPrice>
              <CurrentPrice currencyID="CurrencyCodeType">
              </CurrentPrice>
              <QuantitySold>int</QuantitySold>
              <ReserveMet>boolean</ReserveMet>
            </SellingStatus>
            <ShippingDetails>
              <GlobalShipping>boolean</GlobalShipping>
              <ShippingServiceOptions>
                <LocalPickup>boolean</LocalPickup>
                <ShippingServiceCost currencyID="CurrencyCodeType">
                </ShippingServiceCost>
              </ShippingServiceOptions>
              <!-- ... more ShippingServiceOptions nodes allowed here ... -->
              <ShippingType></ShippingType>
            </ShippingDetails>
            <SKU></SKU>
            <StartPrice currencyID="CurrencyCodeType">
            </StartPrice>
            <TimeLeft>duration</TimeLeft>
            <Title>string</Title>
            <Variations>
              <Variation>
                <Quantity>int</Quantity>
                <SellingStatus>
                  <ConvertedCurrentPrice currencyID="CurrencyCodeType">
                  </ConvertedCurrentPrice>
                  <CurrentPrice currencyID="CurrencyCodeType">
                  </CurrentPrice>
                  <QuantitySold>int</QuantitySold>
                  <ReserveMet>boolean</ReserveMet>
                </SellingStatus>
                <SKU></SKU>
                <StartPrice currencyID="CurrencyCodeType">
                </StartPrice>
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
                <WatchCount>long</WatchCount>
              </Variation>
              <!-- ... more Variation nodes allowed here ... -->
            </Variations>
            <WatchCount>long</WatchCount>
          </Item>
          <OrderLineItemID>string</OrderLineItemID>
          <PaidTime>dateTime</PaidTime>
          <Platform></Platform>
          <QuantityPurchased>int</QuantityPurchased>
          <SellerPaidStatus></SellerPaidStatus>
          <ShippedTime>dateTime</ShippedTime>
          <Status>
            <PaymentHoldStatus></PaymentHoldStatus>
          </Status>
          <TotalPrice currencyID="CurrencyCodeType">
          </TotalPrice>
          <TotalTransactionPrice currencyID="CurrencyCodeType">
          </TotalTransactionPrice>
          <TransactionID>string</TransactionID>
        </Transaction>
      </OrderTransaction>
      <!-- ... more OrderTransaction nodes allowed here ... -->
    </OrderTransactionArray>
    <PaginationResult>
      <TotalNumberOfEntries>int</TotalNumberOfEntries>
      <TotalNumberOfPages>int</TotalNumberOfPages>
    </PaginationResult>
  </SoldList>
  <Summary>
    <ActiveAuctionCount>int</ActiveAuctionCount>
    <AmountLimitRemaining currencyID="CurrencyCodeType">
    </AmountLimitRemaining>
    <AuctionSellingCount>int</AuctionSellingCount>
    <ClassifiedAdCount>int</ClassifiedAdCount>
    <QuantityLimitRemaining>long</QuantityLimitRemaining>
    <SoldDurationInDays>int</SoldDurationInDays>
    <TotalAuctionSellingValue currencyID="CurrencyCodeType">
    </TotalAuctionSellingValue>
    <TotalListingsWithLeads>int</TotalListingsWithLeads>
    <TotalSoldCount>int</TotalSoldCount>
    <TotalSoldValue currencyID="CurrencyCodeType">
    </TotalSoldValue>
  </Summary>
  <UnsoldList>
    <ItemArray>
      <Item>
        <BuyItNowPrice currencyID="CurrencyCodeType">
        </BuyItNowPrice>
        <ClassifiedAdPayPerLeadFee currencyID="CurrencyCodeType">
        </ClassifiedAdPayPerLeadFee>
        <eBayNotes>string</eBayNotes>
        <HideFromSearch>boolean</HideFromSearch>
        <ItemID></ItemID>
        <LeadCount>int</LeadCount>
        <ListingDetails>
          <EndTime>dateTime</EndTime>
          <StartTime>dateTime</StartTime>
        </ListingDetails>
        <ListingDuration>token</ListingDuration>
        <ListingType></ListingType>
        <PictureDetails>
          <GalleryURL>anyURI</GalleryURL>
        </PictureDetails>
        <PrivateNotes>string</PrivateNotes>
        <Quantity>int</Quantity>
        <QuantityAvailable>int</QuantityAvailable>
        <QuestionCount>long</QuestionCount>
        <ReasonHideFromSearch></ReasonHideFromSearch>
        <Relisted>boolean</Relisted>
        <ReservePrice currencyID="CurrencyCodeType">
        </ReservePrice>
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
        <SellingStatus>
          <BidCount>int</BidCount>
          <BidderCount>long</BidderCount>
          <ConvertedCurrentPrice currencyID="CurrencyCodeType">
          </ConvertedCurrentPrice>
          <CurrentPrice currencyID="CurrencyCodeType">
          </CurrentPrice>
          <QuantitySold>int</QuantitySold>
          <ReserveMet>boolean</ReserveMet>
        </SellingStatus>
        <ShippingDetails>
          <GlobalShipping>boolean</GlobalShipping>
          <ShippingServiceOptions>
            <LocalPickup>boolean</LocalPickup>
            <ShippingServiceCost currencyID="CurrencyCodeType">
            </ShippingServiceCost>
          </ShippingServiceOptions>
          <!-- ... more ShippingServiceOptions nodes allowed here ... -->
          <ShippingType></ShippingType>
        </ShippingDetails>
        <SKU></SKU>
        <StartPrice currencyID="CurrencyCodeType">
        </StartPrice>
        <TimeLeft>duration</TimeLeft>
        <Title>string</Title>
        <Variations>
          <Variation>
            <PrivateNotes>string</PrivateNotes>
            <Quantity>int</Quantity>
            <SellingStatus>
              <BidCount>int</BidCount>
              <BidderCount>long</BidderCount>
              <ConvertedCurrentPrice currencyID="CurrencyCodeType">
              </ConvertedCurrentPrice>
              <CurrentPrice currencyID="CurrencyCodeType">
              </CurrentPrice>
              <QuantitySold>int</QuantitySold>
              <ReserveMet>boolean</ReserveMet>
            </SellingStatus>
            <SKU></SKU>
            <StartPrice currencyID="CurrencyCodeType">
            </StartPrice>
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
            <WatchCount>long</WatchCount>
          </Variation>
          <!-- ... more Variation nodes allowed here ... -->
        </Variations>
        <WatchCount>long</WatchCount>
      </Item>
      <!-- ... more Item nodes allowed here ... -->
    </ItemArray>
    <PaginationResult>
      <TotalNumberOfEntries>int</TotalNumberOfEntries>
      <TotalNumberOfPages>int</TotalNumberOfPages>
    </PaginationResult>
  </UnsoldList>
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
</GetMyeBaySellingResponse>
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
| SellingSummary | SellingSummaryType | Conditionally | This container consists of seller activity counts and values. For this container to be returned, the user must include the <b>SellingSummary.Include</b> field in the request and set its value to <code>true</code>. |
| ScheduledList | PaginatedItemArrayType | Conditionally | This container consists of the items that are scheduled to become active at a future date/time. This container will be returned if the eBay user has one or more listings scheduled to become active at a future date/time. <br><br> This container will not be returned in the response (even if there are listings scheduled to become active) if the <b>DetailLevel</b> value is set to <code>ReturnSummary</code> and the <b>ScheduledList.Include</b> field is omitted or set to <code>false</code>. |
| ActiveList | PaginatedItemArrayType | Conditionally | This container consists of active listings. This container will be returned if the eBay user has one or more active listings on eBay.com. <br><br> This container will not be returned in the response (even if there are one or more active listings) if the <b>DetailLevel</b> value is set to <code>ReturnSummary</code> and the <b>ActiveList.Include</b> field is omitted or set to <code>false</code>. |
| SoldList | PaginatedOrderTransactionArrayType | Conditionally | This container consists of order line items that have been sold. This container will be returned if the eBay user has one or more listings that have had recent sales. <br><br> This container will not be returned in the response (even if there are one or more sales) if the <b>DetailLevel</b> value is set to <code>ReturnSummary</code> and the <b>SoldList.Include</b> field is omitted or set to <code>false</code>. |
| UnsoldList | PaginatedItemArrayType | Conditionally | This container consists of listings that have ended without sales. This container will be returned if the eBay user has one or more listings that have ended without sales. <br><br> This container will not be returned in the response (even if there are one or more listings that ended without sales) if the <b>DetailLevel</b> value is set to <code>ReturnSummary</code> and the <b>UnsoldList.Include</b> field is omitted or set to <code>false</code>. |
| Summary | MyeBaySellingSummaryType | Always | This container consists of seller activity counts and values. This container is always returned if there has been recent sell activity. |

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

### GetMyeBaySellingRequestType

**Description:** Retrieves information regarding the user's selling activity, such as items that the user is currently selling (the Active list), auction listings that have bids, sold items, and unsold items.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| ScheduledList | ItemListCustomizationType | [0..1] | Include this container and set the <b>ScheduledList.Include</b> field to <code>true</code> to return the list of items that are scheduled to become active listings on eBay.com at a future date/time. <br><br> The user also has the option of using pagination and sorting for the list of Scheduled listings that will be returned. |
| ActiveList | ItemListCustomizationType | [0..1] | Include this container and set the <b>ActiveList.Include</b> field to <code>true</code> to return the list of active listings on eBay.com. <br><br> The user also has the option of using pagination and sorting for the list of active listings that will be returned. |
| SoldList | ItemListCustomizationType | [0..1] | Include this container and set the <b>SoldList.Include</b> field to <code>true</code> to return the list of sold order line items. <br><br> The user also has the option of using pagination and sorting for the list of sold items that will be returned. |
| UnsoldList | ItemListCustomizationType | [0..1] | Include this container and set the <b>UnsoldList.Include</b> field to <code>true</code> to return the listings that have ended without a purchase. <br><br> The user also has the option of using pagination and sorting for the list of unsold items that will be returned. |
| SellingSummary | ItemListCustomizationType | [0..1] | Include this container and set the <b>SellingSummary.Include</b> field to <code>true</code> to return the <b>SellingSummary</b> container in the response. The <b>SellingSummary</b> container consists of selling activity counts and values. |
| HideVariations | boolean | [0..1] | If this field is included and set to <code>true</code>, the <b>Variations</b> node (and all variation data) is omitted for all multiple-variation listings in the response. If this field is omitted or set to <code>false</code>, the <b>Variations</b> node is returned for all multiple-variation listings in the response. <br> |

**XML Example:**

Not specified in source

### GetMyeBaySellingResponseType

**Description:** Returns summary and detail information about items the user is selling, items scheduled to sell, currently listed, sold, and closed but not sold.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| SellingSummary | SellingSummaryType | [0..1] | This container consists of seller activity counts and values. For this container to be returned, the user must include the <b>SellingSummary.Include</b> field in the request and set its value to <code>true</code>. |
| ScheduledList | PaginatedItemArrayType | [0..1] | This container consists of the items that are scheduled to become active at a future date/time. This container will be returned if the eBay user has one or more listings scheduled to become active at a future date/time. <br><br> This container will not be returned in the response (even if there are listings scheduled to become active) if the <b>DetailLevel</b> value is set to <code>ReturnSummary</code> and the <b>ScheduledList.Include</b> field is omitted or set to <code>false</code>. |
| ActiveList | PaginatedItemArrayType | [0..1] | This container consists of active listings. This container will be returned if the eBay user has one or more active listings on eBay.com. <br><br> This container will not be returned in the response (even if there are one or more active listings) if the <b>DetailLevel</b> value is set to <code>ReturnSummary</code> and the <b>ActiveList.Include</b> field is omitted or set to <code>false</code>. |
| SoldList | PaginatedOrderTransactionArrayType | [0..1] | This container consists of order line items that have been sold. This container will be returned if the eBay user has one or more listings that have had recent sales. <br><br> This container will not be returned in the response (even if there are one or more sales) if the <b>DetailLevel</b> value is set to <code>ReturnSummary</code> and the <b>SoldList.Include</b> field is omitted or set to <code>false</code>. |
| UnsoldList | PaginatedItemArrayType | [0..1] | This container consists of listings that have ended without sales. This container will be returned if the eBay user has one or more listings that have ended without sales. <br><br> This container will not be returned in the response (even if there are one or more listings that ended without sales) if the <b>DetailLevel</b> value is set to <code>ReturnSummary</code> and the <b>UnsoldList.Include</b> field is omitted or set to <code>false</code>. |
| Summary | MyeBaySellingSummaryType | [0..1] | This container consists of seller activity counts and values. This container is always returned if there has been recent sell activity. |

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

#### ScheduledList
- **Max Length:** Not specified in source
- **Min Length:** Not specified in source
- **Pattern:** Not specified in source
- **Allowed Values:** Not specified in source
- **Dependencies:** No

#### ActiveList
- **Max Length:** Not specified in source
- **Min Length:** Not specified in source
- **Pattern:** Not specified in source
- **Allowed Values:** Not specified in source
- **Dependencies:** No

#### SoldList
- **Max Length:** Not specified in source
- **Min Length:** Not specified in source
- **Pattern:** Not specified in source
- **Allowed Values:** Not specified in source
- **Dependencies:** No

#### UnsoldList
- **Max Length:** Not specified in source
- **Min Length:** Not specified in source
- **Pattern:** Not specified in source
- **Allowed Values:** Not specified in source
- **Dependencies:** No

#### SellingSummary
- **Max Length:** Not specified in source
- **Min Length:** Not specified in source
- **Pattern:** Not specified in source
- **Allowed Values:** Not specified in source
- **Dependencies:** No

#### HideVariations
- **Max Length:** Not specified in source
- **Min Length:** Not specified in source
- **Pattern:** Not specified in source
- **Allowed Values:** Not specified in source
- **Dependencies:** No

### Operation-Level Rules

1. **Rule 1**
   - Description: GetMyeBaySelling returns information for only the user authenticated with the call.
   - Applies when: Not specified in source
   - Impact: Not specified in source
2. **Rule 2**
   - Description: Short-duration call rate limit: To protect eBay's infrastructure and servers from being overloaded and/or destabilized, the GetMyeBaySelling call has a short-duration call rate limit to restrict bursts of very high traffic.Per (seller) user ID, no more than 300 GetMyeBaySelling calls can be executed within any 15-second interval.
   - Applies when: Not specified in source
   - Impact: Not specified in source
3. **Rule 3**
   - Description: If this call rate limit is exceeded at any time, the application making the called is blocked.
   - Applies when: Not specified in source
   - Impact: Not specified in source
4. **Rule 4**
   - Description: Each time an application is blocked, the user/application must wait until the block is reset after 15 seconds.
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
| API Calls | Not specified in source | Not specified in source | Short-duration call rate limit: To protect eBay's infrastructure and servers from being overloaded and/or destabilized, the GetMyeBaySelling call has a short-duration call rate limit to restrict bursts of very high traffic.Per (seller) user ID, no more than 300 GetMyeBaySelling calls can be executed within any 15-second interval. If this call rate limit is exceeded at any time, the application making the called is blocked. This short-duration call rate limit applies to all seller accounts, and sellers/developers cannot appeal or request for a higher limit. |
| Frequency | Not specified in source | Not specified in source | Not specified in source |

**Throttling Behavior:**
Short-duration call rate limit: To protect eBay's infrastructure and servers from being overloaded and/or destabilized, the GetMyeBaySelling call has a short-duration call rate limit to restrict bursts of very high traffic.Per (seller) user ID, no more than 300 GetMyeBaySelling calls can be executed within any 15-second interval. If this call rate limit is exceeded at any time, the application making the called is blocked. This short-duration call rate limit applies to all seller accounts, and sellers/developers cannot appeal or request for a higher limit.

---

## Best Practices

1. **Practice 1**
   - If you need, use the controls provided in each container to filter or alter the presentation of the default response set.
2. **Practice 2**
   - Because the call returns information for only the user making the call, you will need to use several test users to fully test the call.
3. **Error Handling**
   - Always check `Ack` value before processing response data
   - Log `CorrelationID` for debugging
   - Implement exponential backoff only when rate-limit behavior is documented in source
4. **Performance Optimization**
   - If you need, use the controls provided in each container to filter or alter the presentation of the default response set.
   - For example, some containers can be sorted and some support pagination.

---

## HTTP Status Codes

Not specified in source

---

## Migration Path

| SOAP Operation | New API | Type | Endpoint | Notes |
|----------------|---------|------|----------|-------|
| GetMyeBaySelling | sellerListingSearch query of the Listing API | Query | Not specified in source | Not specified in source |

---

## Migration Notes

- New API family: Listing API
  - Operation: sellerListingSearch query of the Listing API
  - Type: Query
  - Endpoint: Not specified in source
  - Notes: Not specified in source
- Related calls in source: GetMyeBaySelling; GetCategoryFeatures, GetMyeBayBuying, GetMyeBaySelling, GetUser; GetAccount, GetAdFormatLeads, GetAllBidders, GetBestOffers, GetBidderList, GetCategories, GetCategoryFeatures, GetFeedback, GetItem, GetItemShipping, GetItemTransactions, GetItemsAwaitingFeedback, GetMemberMessages, GetMyMessages, GetMyeBayBuying, GetMyeBaySelling, GetNotificationPreferences, GetOrders, GetSellerEvents, GetSellerList, GetSellerTransactions; GetAccount, GetFeedback, GetItemTransactions, GetItemsAwaitingFeedback, GetMemberMessages, GetMyMessages, GetMyeBayBuying, GetMyeBaySelling, GetSellerTransactions, GetVeROReportStatus; GetAccount, GetBestOffers, GetFeedback, GetItemTransactions, GetItemsAwaitingFeedback, GetMemberMessages, GetMyMessages, GetMyeBayBuying, GetMyeBaySelling, GetOrders, GetSellerTransactions, GetVeROReportStatus; GetBidderList, GetItemShipping, GetMyeBaySelling; GetMyeBayBuying, GetMyeBaySelling; GetMyeBaySelling, GetSellerEvents; GetItem, GetMyeBaySelling, GetSellerList; GetItemTransactions, GetMyeBaySelling; GetItemsAwaitingFeedback, GetMyeBaySelling; GetItemTransactions, GetMyeBaySelling, GetSellerTransactions

*Source: developer_ebay_com_devzone_xml_docs_reference_ebay_getmyebayselling_html.jsonl | Generated: 2026-03-25 | Template Version: 1.0.0*
