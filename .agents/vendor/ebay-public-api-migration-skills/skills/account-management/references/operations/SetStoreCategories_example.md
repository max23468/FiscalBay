# SetStoreCategories — Example

## Request Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<SetStoreCategoriesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken></eBayAuthToken></RequesterCredentials>
  <Action></Action>
  <StoreCategories>
    <CustomCategory>
      <CategoryID>19227</CategoryID>
      <Name>Portable Audio</Name></CustomCategory>
    <CustomCategory>
      <CategoryID>19228</CategoryID>
      <Name>Techno Gadgets</Name></CustomCategory></StoreCategories></SetStoreCategoriesRequest>
```

## Response Example

```xml
<?xml version="1.0" encoding="UTF-8"?>
<SetStoreCategoriesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Timestamp>2019-11-07T18:21:15.735Z</Timestamp>
  <Ack></Ack>
  <Version>1131</Version>
  <Build></Build>
  <TaskID>0</TaskID>
  <Status></Status></SetStoreCategoriesResponse>
```
