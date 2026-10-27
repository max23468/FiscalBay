# GetMyeBaySelling — Example

## Request Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>PLACEHOLDER_TOKEN</eBayAuthToken>
  </RequesterCredentials>
  <ActiveList>
    <Sort>TimeLeft</Sort>
    <Pagination>
      <EntriesPerPage>3</EntriesPerPage>
      <PageNumber>1</PageNumber>
    </Pagination>
  </ActiveList>
</GetMyeBaySellingRequest>
```

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

## Response Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Timestamp>2019-11-04T22:15:04.052Z</Timestamp>
  <Ack>Success</Ack>
  <Version>1131</Version>
  <ActiveList>
    <ItemArray>
      <Item>
        <ItemID>13</ItemID>
        <ListingDetails>
          <StartTime>2019-10-12T18:41:12.000Z</StartTime>
        </ListingDetails>
        <ListingType>Chinese</ListingType>
        <Quantity>1</Quantity>
        <ReservePrice currencyID="MYR">0.0</ReservePrice>
        <SellingStatus>
          <ConvertedCurrentPrice currencyID="USD">10.95</ConvertedCurrentPrice>
          <CurrentPrice currencyID="MYR">11.0</CurrentPrice>
          <ReserveMet>true</ReserveMet>
        </SellingStatus>
        <StartPrice currencyID="MYR">11.0</StartPrice>
        <TimeLeft>PT28M17S</TimeLeft>
        <Title>Test Auction Title</Title>
        <QuantityAvailable>1</QuantityAvailable>
      </Item>
      <Item>
        <ItemID>19</ItemID>
        <ListingDetails>
          <StartTime>2019-10-13T17:23:04.000Z</StartTime>
        </ListingDetails>
        <ListingType>Chinese</ListingType>
        <Quantity>1</Quantity>
        <PrivateNotes>6:IDNew3My notes for Relist here (#%$).</PrivateNotes>
        <ReservePrice currencyID="USD">0.0</ReservePrice>
        <SellingStatus>
          <CurrentPrice currencyID="USD">1.0</CurrentPrice>
          <ReserveMet>true</ReserveMet>
        </SellingStatus>
        <StartPrice currencyID="USD">1.0</StartPrice>
        <TimeLeft>PT28M45S</TimeLeft>
        <Title>Test for ExternalProductIdentifier</Title>
        <QuantityAvailable>1</QuantityAvailable>
      </Item>
      <Item>
        <ItemID>12</ItemID>
        <ListingDetails>
          <StartTime>2019-10-14T11:44:56.000Z</StartTime>
        </ListingDetails>
        <ListingType>Chinese</ListingType>
        <Quantity>1</Quantity>
        <PrivateNotes>7:ID99999My notes here (#%$).</PrivateNotes>
        <ReservePrice currencyID="USD">0.0</ReservePrice>
        <SellingStatus>
          <CurrentPrice currencyID="USD">1.0</CurrentPrice>
          <ReserveMet>true</ReserveMet>
        </SellingStatus>
        <StartPrice currencyID="USD">1.0</StartPrice>
        <TimeLeft>PT29M35S</TimeLeft>
        <Title>Test for ExternalProductIdentifier</Title>
        <QuantityAvailable>1</QuantityAvailable>
      </Item>
    </ItemArray>
    <PaginationResult>
      <TotalNumberOfPages>1</TotalNumberOfPages>
      <TotalNumberOfEntries>3</TotalNumberOfEntries>
    </PaginationResult>
  </ActiveList>
</GetMyeBaySellingResponse>
```
