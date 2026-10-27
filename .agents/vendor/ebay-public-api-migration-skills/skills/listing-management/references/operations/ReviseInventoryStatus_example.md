# ReviseInventoryStatus — Example

## Request Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<ReviseInventoryStatusRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>PLACEHOLDER_TOKEN</eBayAuthToken>
  </RequesterCredentials>
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <InventoryStatus>
    <ItemID>17</ItemID>
    <Quantity>20</Quantity>
  </InventoryStatus>
  <InventoryStatus>
    <SKU>c2</SKU>
    <ItemID>14</ItemID>
    <Quantity>20</Quantity>
  </InventoryStatus>
  <InventoryStatus>
    <ItemID>15</ItemID>
    <StartPrice>9.95</StartPrice>
  </InventoryStatus>
  <InventoryStatus>
    <SKU>c2</SKU>
    <ItemID>16</ItemID>
    <StartPrice>19.95</StartPrice>
    <Quantity>80</Quantity>
  </InventoryStatus>
</ReviseInventoryStatusRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<ReviseInventoryStatusRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <InventoryStatus>
    <ItemID></ItemID>
    <Quantity>int</Quantity>
    <SKU></SKU>
    <StartPrice></StartPrice>
  </InventoryStatus>
  <!-- ... more InventoryStatus nodes allowed here ... -->
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</ReviseInventoryStatusRequest>
```

## Response Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<ReviseInventoryStatusResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Timestamp>2019-11-06T20:34:31.906Z</Timestamp>
  <Ack>Success</Ack>
  <Version>1131</Version>
  <Build>E1131_UNI_API5_19098188_R1</Build>
  <InventoryStatus>
    <SKU></SKU>
    <ItemID>17</ItemID>
    <StartPrice>8.95</StartPrice>
    <Quantity>20</Quantity>
  </InventoryStatus>
  <InventoryStatus>
    <SKU>1A</SKU>
    <ItemID>14</ItemID>
    <StartPrice>11.95</StartPrice>
    <Quantity>20</Quantity>
  </InventoryStatus>
  <InventoryStatus>
    <SKU>1B</SKU>
    <ItemID>15</ItemID>
    <StartPrice>9.95</StartPrice>
    <Quantity>37</Quantity>
  </InventoryStatus>
  <InventoryStatus>
    <SKU>1C</SKU>
    <ItemID>16</ItemID>
    <StartPrice>19.95</StartPrice>
    <Quantity>80</Quantity>
  </InventoryStatus>
</ReviseInventoryStatusResponse>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<ReviseInventoryStatusRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <InventoryStatus>
    <ItemID></ItemID>
    <Quantity>int</Quantity>
    <SKU></SKU>
    <StartPrice></StartPrice>
  </InventoryStatus>
  <!-- ... more InventoryStatus nodes allowed here ... -->
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</ReviseInventoryStatusRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<ReviseInventoryStatusResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <Fees>
    <Fee>
      <Fee currencyID="CurrencyCodeType">
      </Fee>
      <Name>string</Name>
      <PromotionalDiscount currencyID="CurrencyCodeType">
      </PromotionalDiscount>
    </Fee>
    <!-- ... more Fee nodes allowed here ... -->
    <ItemID></ItemID>
  </Fees>
  <!-- ... more Fees nodes allowed here ... -->
  <InventoryStatus>
    <ItemID></ItemID>
    <SKU></SKU>
  </InventoryStatus>
  <!-- ... more InventoryStatus nodes allowed here ... -->
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
</ReviseInventoryStatusResponse>
```
