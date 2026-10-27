# GetStore — Example

## Request Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetStoreRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken></eBayAuthToken></RequesterCredentials>
  <LevelLimit>1</LevelLimit></GetStoreRequest>
```

## Response Example

```xml
<?xml version="1.0" encoding="UTF-8"?>
<GetStoreResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Timestamp>2019-11-05T22:27:50.267Z</Timestamp>
  <Ack></Ack>
  <Version>1131</Version>
  <Build></Build>
  <Store>
    <Name>A T</Name>
    <URLPath>Invalid Request</URLPath>
    <URL>http://www.ebay.com/str/as</URL>
    <SubscriptionLevel></SubscriptionLevel>
    <Logo></Logo>
    <Theme>
      <ThemeID>10</ThemeID>
      <ColorScheme>
        <ColorSchemeID>1000005</ColorSchemeID>
        <Color>
          <Primary>0C04B8</Primary>
          <Secondary></Secondary>
          <Accent>0099FF</Accent></Color>
        <Font>
          <NameColor></NameColor>
          <TitleColor></TitleColor>
          <DescColor>333333</DescColor></Font></ColorScheme></Theme>
    <HeaderStyle></HeaderStyle>
    <HomePage>0</HomePage>
    <ItemListLayout></ItemListLayout>
    <ItemListSortOrder></ItemListSortOrder>
    <CustomHeaderLayout></CustomHeaderLayout>
    <ExportListings>false</ExportListings>
    <CustomCategories>
      <CustomCategory>
        <CategoryID>1</CategoryID>
        <Name></Name>
        <Order>0</Order></CustomCategory>
      <CustomCategory>
        <CategoryID>24574768010</CategoryID>
        <Name></Name>
        <Order>1</Order></CustomCategory>
      <CustomCategory>
        <CategoryID>24574769010</CategoryID>
        <Name>Collector Plates</Name>
        <Order>2</Order></CustomCategory>
      <CustomCategory>
        <CategoryID>25337304010</CategoryID>
        <Name></Name>
        <Order>3</Order></CustomCategory>
      <CustomCategory>
        <CategoryID>26230204010</CategoryID>
        <Name>Christmas Items</Name>
        <Order>4</Order></CustomCategory></CustomCategories>
    <CustomListingHeader>
      <DisplayType></DisplayType>
      <Logo>true</Logo>
      <SearchBox>false</SearchBox>
      <LinkToInclude>
        <LinkID>0</LinkID>
        <Order>1</Order>
        <LinkType></LinkType></LinkToInclude>
      <LinkToInclude>
        <LinkID>0</LinkID>
        <Order>2</Order>
        <LinkType></LinkType></LinkToInclude>
      <LinkToInclude>
        <LinkID>0</LinkID>
        <Order>3</Order>
        <LinkType></LinkType></LinkToInclude>
      <LinkToInclude>
        <LinkID>0</LinkID>
        <Order>4</Order>
        <LinkType></LinkType></LinkToInclude>
      <LinkToInclude>
        <LinkID>0</LinkID>
        <Order>5</Order>
        <LinkType></LinkType></LinkToInclude>
      <AddToFavoriteStores>true</AddToFavoriteStores>
      <SignUpForStoreNewsletter>true</SignUpForStoreNewsletter></CustomListingHeader>
    <MerchDisplay></MerchDisplay>
    <LastOpenedTime>2018-07-12T21:04:50.000Z</LastOpenedTime>
    <TitleWithCompatibility>true</TitleWithCompatibility></Store></GetStoreResponse>
```
