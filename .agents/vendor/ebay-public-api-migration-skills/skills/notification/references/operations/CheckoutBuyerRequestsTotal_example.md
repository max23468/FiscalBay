# CheckoutBuyerRequestsTotal legacy SOAP body example

**Source URLs:**
- https://developer.ebay.com/api-docs/static/pn_buyer-requests-total.html
- https://developer.ebay.com/devzone/xml/docs/reference/ebay/GetItemTransactions.html

The legacy notification page says this notification returns the same payload shape
as `GetItemTransactions` with default detail level, but it does not publish a
populated sample. The SOAP body below is adapted from the official
`GetItemTransactions` samples and the documented `BuyerRequestsTotal`
`CheckoutStatus` value.

```xml
<soapenv:Body>
	<GetItemTransactionsResponse xmlns="urn:ebay:apis:eBLBaseComponents">
		<Timestamp>2019-11-04T21:42:14.767Z</Timestamp>
		<Ack>Success</Ack>
		<Version>1129</Version>
		<Build>E1129_CORE_APIXO_19090105_R1</Build>
		<NotificationEventName>CheckoutBuyerRequestsTotal</NotificationEventName>
		<RecipientUserID>seller-example</RecipientUserID>
		<PaginationResult>
			<TotalNumberOfPages>1</TotalNumberOfPages>
			<TotalNumberOfEntries>1</TotalNumberOfEntries>
		</PaginationResult>
		<HasMoreTransactions>false</HasMoreTransactions>
		<TransactionsPerPage>100</TransactionsPerPage>
		<PageNumber>1</PageNumber>
		<ReturnedTransactionCountActual>1</ReturnedTransactionCountActual>
		<Item>
			<AutoPay>false</AutoPay>
			<Currency>USD</Currency>
			<ItemID>110011001100</ItemID>
			<ListingDetails>
				<ViewItemURL>https://www.ebay.com/itm/110011001100</ViewItemURL>
			</ListingDetails>
			<ListingType>FixedPriceItem</ListingType>
			<PrivateListing>false</PrivateListing>
			<Quantity>1</Quantity>
			<SellingStatus>
				<CurrentPrice currencyID="USD">20.0</CurrentPrice>
				<QuantitySold>1</QuantitySold>
				<ListingStatus>Active</ListingStatus>
			</SellingStatus>
			<Site>US</Site>
			<Title>Example item awaiting seller total</Title>
		</Item>
		<TransactionArray>
			<Transaction>
				<AmountPaid currencyID="USD">0.0</AmountPaid>
				<AdjustmentAmount currencyID="USD">0.0</AdjustmentAmount>
				<ConvertedAdjustmentAmount currencyID="USD">0.0</ConvertedAdjustmentAmount>
				<Buyer>
					<UserID>buyer-example</UserID>
					<FeedbackScore>58</FeedbackScore>
				</Buyer>
				<CreatedDate>2019-10-10T20:49:45.000Z</CreatedDate>
				<QuantityPurchased>1</QuantityPurchased>
				<Status>
					<eBayPaymentStatus>NoPaymentFailure</eBayPaymentStatus>
					<CheckoutStatus>BuyerRequestsTotal</CheckoutStatus>
					<LastTimeModified>2019-10-10T20:55:00.000Z</LastTimeModified>
					<PaymentMethodUsed>None</PaymentMethodUsed>
					<CompleteStatus>Incomplete</CompleteStatus>
					<BuyerSelectedShipping>false</BuyerSelectedShipping>
					<PaymentHoldStatus>None</PaymentHoldStatus>
				</Status>
				<TransactionID>220022002200</TransactionID>
				<TransactionPrice currencyID="USD">20.0</TransactionPrice>
				<BestOfferSale>false</BestOfferSale>
				<ShippingServiceSelected>
					<ShippingService>USPSPriority</ShippingService>
					<ShippingServiceCost currencyID="USD">0.0</ShippingServiceCost>
				</ShippingServiceSelected>
				<TransactionSiteID>US</TransactionSiteID>
				<Platform>eBay</Platform>
				<IntangibleItem>false</IntangibleItem>
			</Transaction>
		</TransactionArray>
	</GetItemTransactionsResponse>
</soapenv:Body>
```
