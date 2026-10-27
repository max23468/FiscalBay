# GetSellerEvents — Example

## Request Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetSellerEventsRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>PLACEHOLDER_TOKEN</eBayAuthToken>
  </RequesterCredentials>
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <ModTimeFrom>2019-06-01T00:00:01.000Z</ModTimeFrom>
  <DetailLevel>ReturnAll</DetailLevel>
</GetSellerEventsRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetSellerEventsRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <EndTimeFrom>dateTime</EndTimeFrom>
  <EndTimeTo>dateTime</EndTimeTo>
  <HideVariations>boolean</HideVariations>
  <IncludeVariationSpecifics>boolean</IncludeVariationSpecifics>
  <IncludeWatchCount>boolean</IncludeWatchCount>
  <ModTimeFrom>dateTime</ModTimeFrom>
  <ModTimeTo>dateTime</ModTimeTo>
  <NewItemFilter>boolean</NewItemFilter>
  <StartTimeFrom>dateTime</StartTimeFrom>
  <StartTimeTo>dateTime</StartTimeTo>
  <!-- Standard Input Fields -->
  <DetailLevel></DetailLevel>
  <!-- ... more DetailLevel values allowed here ... -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <OutputSelector>string</OutputSelector>
  <!-- ... more OutputSelector values allowed here ... -->
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetSellerEventsRequest>
```

## Response Example

```xml
<?xml version="1.0" encoding="UTF-8"?>
<GetSellerEventsResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Timestamp>2019-11-05T18:10:12.440Z</Timestamp>
  <Ack>Success</Ack>
  <Version>1131</Version>
  <Build>E1131_CORE_APISELLING_19099826_R1</Build>
  <TimeTo>2019-11-05T18:10:11.830Z</TimeTo>
  <ItemArray>
    <Item>
      <ItemID>13</ItemID>
      <ListingDetails>
        <StartTime>2018-09-08T19:44:06.000Z</StartTime>
        <EndTime>2019-11-08T19:44:06.000Z</EndTime>
      </ListingDetails>
      <SellingStatus>
        <BidCount>0</BidCount>
        <CurrentPrice currencyID="USD">25.0</CurrentPrice>
        <QuantitySold>0</QuantitySold>
        <ListingStatus>Active</ListingStatus>
      </SellingStatus>
      <Site>US</Site>
      <Title>Brinn's First Lady Gown Series Emily Tennessee Donelson</Title>
      <Quantity>1</Quantity>
      <Currency>USD</Currency>
      <ListingType>StoresFixedPrice</ListingType>
      <BestOfferDetails>
        <BestOfferCount>0</BestOfferCount>
        <BestOfferEnabled>true</BestOfferEnabled>
      </BestOfferDetails>
      <HitCounter>NoHitCounter</HitCounter>
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
          <PaymentProfileID>30</PaymentProfileID>
          <PaymentProfileName>Py</PaymentProfileName>
        </SellerPaymentProfile>
      </SellerProfiles>
      <eBayPlus>false</eBayPlus>
      <eBayPlusEligible>false</eBayPlusEligible>
    </Item>
    <Item>
      <ItemID>15</ItemID>
      <ListingDetails>
        <StartTime>2018-09-21T17:57:57.000Z</StartTime>
        <EndTime>2019-11-21T17:57:57.000Z</EndTime>
      </ListingDetails>
      <SellingStatus>
        <BidCount>0</BidCount>
        <CurrentPrice currencyID="USD">22.0</CurrentPrice>
        <QuantitySold>0</QuantitySold>
        <ListingStatus>Active</ListingStatus>
      </SellingStatus>
      <Site>US</Site>
      <Title>Brinn's Musical Calendar Miss Doll May 1986 - "Rose Garden"</Title>
      <Quantity>1</Quantity>
      <Currency>USD</Currency>
      <ListingType>StoresFixedPrice</ListingType>
      <BestOfferDetails>
        <BestOfferCount>0</BestOfferCount>
        <BestOfferEnabled>true</BestOfferEnabled>
      </BestOfferDetails>
      <HitCounter>NoHitCounter</HitCounter>
      <SellerProfiles>
        <SellerShippingProfile>
          <ShippingProfileID>10</ShippingProfileID>
          <ShippingProfileName>C2</ShippingProfileName>
        </SellerShippingProfile>
        <SellerReturnProfile>
          <ReturnProfileID>10</ReturnProfileID>
          <ReturnProfileName>Rr</ReturnProfileName>
        </SellerReturnProfile>
        <SellerPaymentProfile>
          <PaymentProfileID>30</PaymentProfileID>
          <PaymentProfileName>Py</PaymentProfileName>
        </SellerPaymentProfile>
      </SellerProfiles>
      <eBayPlus>false</eBayPlus>
      <eBayPlusEligible>false</eBayPlusEligible>
    </Item>
    <Item>
      <ItemID>18</ItemID>
      <ListingDetails>
        <StartTime>2018-09-28T16:47:22.000Z</StartTime>
        <EndTime>2019-11-28T16:47:22.000Z</EndTime>
      </ListingDetails>
      <SellingStatus>
        <BidCount>0</BidCount>
        <CurrentPrice currencyID="USD">19.95</CurrentPrice>
        <QuantitySold>2</QuantitySold>
        <ListingStatus>Active</ListingStatus>
      </SellingStatus>
      <Site>US</Site>
      <Title>M.I. Hummel "Sisters" Collector Plates - The Danbury Mint</Title>
      <Quantity>2</Quantity>
      <Currency>USD</Currency>
      <ListingType>StoresFixedPrice</ListingType>
      <BestOfferDetails>
        <BestOfferCount>1</BestOfferCount>
        <BestOfferEnabled>true</BestOfferEnabled>
      </BestOfferDetails>
      <HitCounter>NoHitCounter</HitCounter>
      <SellerProfiles>
        <SellerShippingProfile>
          <ShippingProfileID>10</ShippingProfileID>
          <ShippingProfileName>C2</ShippingProfileName>
        </SellerShippingProfile>
        <SellerReturnProfile>
          <ReturnProfileID>10</ReturnProfileID>
          <ReturnProfileName>R0</ReturnProfileName>
        </SellerReturnProfile>
        <SellerPaymentProfile>
          <PaymentProfileID>10</PaymentProfileID>
          <PaymentProfileName>es</PaymentProfileName>
        </SellerPaymentProfile>
      </SellerProfiles>
      <eBayPlus>false</eBayPlus>
      <eBayPlusEligible>false</eBayPlusEligible>
    </Item>
    <Item>
      <ItemID>18</ItemID>
      <ListingDetails>
        <StartTime>2019-06-10T19:29:18.000Z</StartTime>
        <EndTime>2019-11-04T17:33:35.000Z</EndTime>
      </ListingDetails>
      <SellingStatus>
        <BidCount>0</BidCount>
        <CurrentPrice currencyID="USD">28.0</CurrentPrice>
        <QuantitySold>1</QuantitySold>
        <HighBidder>
          <UserID>pd</UserID>
          <UserAnonymized>false</UserAnonymized>
          <Email>j@.com</Email>
          <FeedbackScore>22</FeedbackScore>
        </HighBidder>
        <ListingStatus>Completed</ListingStatus>
      </SellingStatus>
      <Site>US</Site>
      <Title>Electronic, Animated Sleeping, Snoring, Whistling Mrs. Claus in Box</Title>
      <Quantity>1</Quantity>
      <Currency>USD</Currency>
      <ListingType>StoresFixedPrice</ListingType>
      <BestOfferDetails>
        <BestOfferCount>1</BestOfferCount>
        <BestOfferEnabled>true</BestOfferEnabled>
      </BestOfferDetails>
      <HitCounter>NoHitCounter</HitCounter>
      <SellerProfiles>
        <SellerShippingProfile>
          <ShippingProfileID>10</ShippingProfileID>
          <ShippingProfileName>C1</ShippingProfileName>
        </SellerShippingProfile>
        <SellerReturnProfile>
          <ReturnProfileID>10</ReturnProfileID>
          <ReturnProfileName>Rr</ReturnProfileName>
        </SellerReturnProfile>
        <SellerPaymentProfile>
          <PaymentProfileID>10</PaymentProfileID>
          <PaymentProfileName>es</PaymentProfileName>
        </SellerPaymentProfile>
      </SellerProfiles>
      <eBayPlus>false</eBayPlus>
      <eBayPlusEligible>false</eBayPlusEligible>
    </Item>
    <Item>
      <ItemID>13</ItemID>
      <ListingDetails>
        <StartTime>2019-06-10T18:49:25.000Z</StartTime>
        <EndTime>2019-10-09T23:10:25.000Z</EndTime>
      </ListingDetails>
      <SellingStatus>
        <BidCount>0</BidCount>
        <CurrentPrice currencyID="USD">27.0</CurrentPrice>
        <QuantitySold>1</QuantitySold>
        <HighBidder>
          <UserID>n8</UserID>
          <UserAnonymized>false</UserAnonymized>
          <Email>n@.com</Email>
          <FeedbackScore>58</FeedbackScore>
        </HighBidder>
        <ListingStatus>Completed</ListingStatus>
      </SellingStatus>
      <Site>US</Site>
      <Title>Electronic, Animated Sleeping, Snoring, Whistling Santa Claus in Box</Title>
      <Quantity>1</Quantity>
      <Currency>USD</Currency>
      <ListingType>StoresFixedPrice</ListingType>
      <BestOfferDetails>
        <BestOfferCount>1</BestOfferCount>
        <BestOfferEnabled>true</BestOfferEnabled>
      </BestOfferDetails>
      <HitCounter>NoHitCounter</HitCounter>
      <SellerProfiles>
        <SellerShippingProfile>
          <ShippingProfileID>30</ShippingProfileID>
          <ShippingProfileName>Cy</ShippingProfileName>
        </SellerShippingProfile>
        <SellerReturnProfile>
          <ReturnProfileID>10</ReturnProfileID>
          <ReturnProfileName>Rr</ReturnProfileName>
        </SellerReturnProfile>
        <SellerPaymentProfile>
          <PaymentProfileID>10</PaymentProfileID>
          <PaymentProfileName>es</PaymentProfileName>
        </SellerPaymentProfile>
      </SellerProfiles>
      <eBayPlus>false</eBayPlus>
      <eBayPlusEligible>false</eBayPlusEligible>
    </Item>
    <Item>
      <ItemID>11</ItemID>
      <ListingDetails>
        <StartTime>2018-09-08T19:03:45.000Z</StartTime>
        <EndTime>2019-11-08T19:03:45.000Z</EndTime>
      </ListingDetails>
      <SellingStatus>
        <BidCount>0</BidCount>
        <CurrentPrice currencyID="USD">16.0</CurrentPrice>
        <QuantitySold>1</QuantitySold>
        <HighBidder>
          <UserID>oa</UserID>
          <UserAnonymized>false</UserAnonymized>
          <Email>r@.com</Email>
          <FeedbackScore>1933</FeedbackScore>
        </HighBidder>
        <ListingStatus>Active</ListingStatus>
      </SellingStatus>
      <Site>US</Site>
      <Title>Brinn's First Lady Gown Series Martha Jefferson Randolf</Title>
      <Quantity>2</Quantity>
      <Currency>USD</Currency>
      <ListingType>StoresFixedPrice</ListingType>
      <BestOfferDetails>
        <BestOfferCount>0</BestOfferCount>
        <BestOfferEnabled>true</BestOfferEnabled>
      </BestOfferDetails>
      <HitCounter>NoHitCounter</HitCounter>
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
          <PaymentProfileID>30</PaymentProfileID>
          <PaymentProfileName>Py</PaymentProfileName>
        </SellerPaymentProfile>
      </SellerProfiles>
      <eBayPlus>false</eBayPlus>
      <eBayPlusEligible>false</eBayPlusEligible>
    </Item>
    <Item>
      <ItemID>16</ItemID>
      <ListingDetails>
        <StartTime>2018-09-21T17:48:38.000Z</StartTime>
        <EndTime>2019-11-21T17:48:38.000Z</EndTime>
      </ListingDetails>
      <SellingStatus>
        <BidCount>0</BidCount>
        <CurrentPrice currencyID="USD">15.0</CurrentPrice>
        <QuantitySold>1</QuantitySold>
        <HighBidder>
          <UserID>s</UserID>
          <UserAnonymized>false</UserAnonymized>
          <Email>s@.com</Email>
          <FeedbackScore>5</FeedbackScore>
        </HighBidder>
        <ListingStatus>Active</ListingStatus>
      </SellingStatus>
      <Site>US</Site>
      <Title>Brinn's Musical Calendar Miss Doll September 1986 - "September Song"</Title>
      <Quantity>1</Quantity>
      <Currency>USD</Currency>
      <ListingType>StoresFixedPrice</ListingType>
      <BestOfferDetails>
        <BestOfferCount>1</BestOfferCount>
        <BestOfferEnabled>true</BestOfferEnabled>
      </BestOfferDetails>
      <HitCounter>NoHitCounter</HitCounter>
      <SellerProfiles>
        <SellerShippingProfile>
          <ShippingProfileID>10</ShippingProfileID>
          <ShippingProfileName>C2</ShippingProfileName>
        </SellerShippingProfile>
        <SellerReturnProfile>
          <ReturnProfileID>10</ReturnProfileID>
          <ReturnProfileName>Rr</ReturnProfileName>
        </SellerReturnProfile>
        <SellerPaymentProfile>
          <PaymentProfileID>30</PaymentProfileID>
          <PaymentProfileName>Py</PaymentProfileName>
        </SellerPaymentProfile>
      </SellerProfiles>
      <eBayPlus>false</eBayPlus>
      <eBayPlusEligible>false</eBayPlusEligible>
    </Item>
    <Item>
      <ItemID>10</ItemID>
      <ListingDetails>
        <StartTime>2018-09-08T18:33:47.000Z</StartTime>
        <EndTime>2019-11-08T18:33:47.000Z</EndTime>
      </ListingDetails>
      <SellingStatus>
        <BidCount>0</BidCount>
        <CurrentPrice currencyID="USD">23.0</CurrentPrice>
        <QuantitySold>1</QuantitySold>
        <HighBidder>
          <UserID>c</UserID>
          <UserAnonymized>false</UserAnonymized>
          <Email>m@.com</Email>
          <FeedbackScore>180</FeedbackScore>
        </HighBidder>
        <ListingStatus>Active</ListingStatus>
      </SellingStatus>
      <Site>US</Site>
      <Title>Brinn's American Tradition First Lady Gown Series Dolley Payne Madison</Title>
      <Quantity>2</Quantity>
      <Currency>USD</Currency>
      <ListingType>StoresFixedPrice</ListingType>
      <BestOfferDetails>
        <BestOfferCount>0</BestOfferCount>
        <BestOfferEnabled>true</BestOfferEnabled>
      </BestOfferDetails>
      <HitCounter>NoHitCounter</HitCounter>
      <SellerProfiles>
        <SellerShippingProfile>
          <ShippingProfileID>10</ShippingProfileID>
          <ShippingProfileName>C2</ShippingProfileName>
        </SellerShippingProfile>
        <SellerReturnProfile>
          <ReturnProfileID>10</ReturnProfileID>
          <ReturnProfileName>Rr</ReturnProfileName>
        </SellerReturnProfile>
        <SellerPaymentProfile>
          <PaymentProfileID>30</PaymentProfileID>
          <PaymentProfileName>Py</PaymentProfileName>
        </SellerPaymentProfile>
      </SellerProfiles>
      <eBayPlus>false</eBayPlus>
      <eBayPlusEligible>false</eBayPlusEligible>
    </Item>
  </ItemArray>
</GetSellerEventsResponse>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetSellerEventsRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <EndTimeFrom>dateTime</EndTimeFrom>
  <EndTimeTo>dateTime</EndTimeTo>
  <HideVariations>boolean</HideVariations>
  <IncludeVariationSpecifics>boolean</IncludeVariationSpecifics>
  <IncludeWatchCount>boolean</IncludeWatchCount>
  <ModTimeFrom>dateTime</ModTimeFrom>
  <ModTimeTo>dateTime</ModTimeTo>
  <NewItemFilter>boolean</NewItemFilter>
  <StartTimeFrom>dateTime</StartTimeFrom>
  <StartTimeTo>dateTime</StartTimeTo>
  <!-- Standard Input Fields -->
  <DetailLevel></DetailLevel>
  <!-- ... more DetailLevel values allowed here ... -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <OutputSelector>string</OutputSelector>
  <!-- ... more OutputSelector values allowed here ... -->
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetSellerEventsRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetSellerEventsResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <ItemArray>
    <Item>
      <BestOfferDetails>
        <BestOfferCount>int</BestOfferCount>
        <BestOfferEnabled>boolean</BestOfferEnabled>
      </BestOfferDetails>
      <BuyItNowPrice currencyID="CurrencyCodeType">
      </BuyItNowPrice>
      <Currency></Currency>
      <eBayPlus>boolean</eBayPlus>
      <eBayPlusEligible>boolean</eBayPlusEligible>
      <HitCount>long</HitCount>
      <IsSecureDescription>boolean</IsSecureDescription>
      <ItemID></ItemID>
      <ListingDetails>
        <EndTime>dateTime</EndTime>
        <StartTime>dateTime</StartTime>
      </ListingDetails>
      <ListingType></ListingType>
      <Quantity>int</Quantity>
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
        <BidCount>int</BidCount>
        <CurrentPrice currencyID="CurrencyCodeType">
        </CurrentPrice>
        <HighBidder>
          <Email>string</Email>
          <FeedbackScore>int</FeedbackScore>
          <UserAnonymized>boolean</UserAnonymized>
          <UserID></UserID>
        </HighBidder>
        <ListingStatus></ListingStatus>
        <QuantitySold>int</QuantitySold>
      </SellingStatus>
      <Site></Site>
      <Title>string</Title>
      <Variations>
        <Variation>
          <Quantity>int</Quantity>
          <SellingStatus>
            <BidCount>int</BidCount>
            <CurrentPrice currencyID="CurrencyCodeType">
            </CurrentPrice>
            <HighBidder>
              <Email>string</Email>
              <FeedbackScore>int</FeedbackScore>
              <UserAnonymized>boolean</UserAnonymized>
              <UserID></UserID>
            </HighBidder>
            <ListingStatus></ListingStatus>
            <QuantitySold>int</QuantitySold>
          </SellingStatus>
          <SKU></SKU>
          <StartPrice currencyID="CurrencyCodeType">
          </StartPrice>
          <VariationProductListingDetails>
            <EAN>string</EAN>
            <ISBN>string</ISBN>
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
      </Variations>
      <WatchCount>long</WatchCount>
    </Item>
    <!-- ... more Item nodes allowed here ... -->
  </ItemArray>
  <TimeTo>dateTime</TimeTo>
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
</GetSellerEventsResponse>
```
