# AddOrder — Example

## Request Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<AddOrderRequest xmlns="urn:ebay:apis:eBLBaseComponents">
	<RequesterCredentials>
		<eBayAuthToken>A3</eBayAuthToken>
	</RequesterCredentials>
	<Order>
		<CreatingUserRole>Seller</CreatingUserRole>
		<Total currencyID="USD">36.00</Total>
		<TransactionArray>
			<Transaction>
				<Item>
					<ItemID>15</ItemID>
				</Item>
				<TransactionID>0</TransactionID>
			</Transaction>
			<Transaction>
				<Item>
					<ItemID>18</ItemID>
				</Item>
				<TransactionID>0</TransactionID>
			</Transaction>
		</TransactionArray>
	</Order>
</AddOrderRequest>
```

## Response Example

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<AddOrderResponse xmlns="urn:ebay:apis:eBLBaseComponents">
	<Timestamp>2015-12-10T16:09:47.540Z</Timestamp>
	<Ack>Success</Ack>
	<Version>967</Version>
	<Build>e967_core_Bundled_5642307_R1</Build>
	<OrderID>86</OrderID>
	<CreatedTime>2015-12-10T16:09:47.000Z</CreatedTime>
</AddOrderResponse>
```
