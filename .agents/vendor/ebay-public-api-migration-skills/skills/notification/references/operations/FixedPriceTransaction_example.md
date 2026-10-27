# FixedPriceTransaction legacy SOAP body example

**Source URLs:**
- https://developer.ebay.com/api-docs/static/pn_fixed-price-transaction.html
- https://developer.ebay.com/devzone/xml/docs/reference/ebay/GetItemTransactions.html

The legacy notification page says this notification returns the same payload shape
as `GetItemTransactions` with `ReturnAll` detail level, but it does not publish a
populated sample. The SOAP body below is adapted from the official
`GetItemTransactions` samples for a completed fixed-price sale.

```xml
<soapenv:Body>
	<GetItemTransactionsResponse xmlns="urn:ebay:apis:eBLBaseComponents">
		<Timestamp>2019-11-04T21:42:14.767Z</Timestamp>
		<Ack>Success</Ack>
		<Version>1129</Version>
		<Build>E1129_CORE_APIXO_19090105_R1</Build>
		<NotificationEventName>FixedPriceTransaction</NotificationEventName>
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
			<AutoPay>true</AutoPay>
			<Currency>USD</Currency>
			<ItemID>110011001101</ItemID>
			<ListingDetails>
				<ViewItemURL>https://www.ebay.com/itm/110011001101</ViewItemURL>
			</ListingDetails>
			<ListingType>StoresFixedPrice</ListingType>
			<PrivateListing>false</PrivateListing>
			<Quantity>1</Quantity>
			<Seller>
				<UserID>seller-example</UserID>
				<FeedbackScore>57</FeedbackScore>
			</Seller>
			<SellingStatus>
				<CurrentPrice currencyID="USD">27.0</CurrentPrice>
				<QuantitySold>1</QuantitySold>
				<ListingStatus>Completed</ListingStatus>
			</SellingStatus>
			<Site>US</Site>
			<Title>Example fixed-price purchase</Title>
		</Item>
		<TransactionArray>
			<Transaction>
				<AmountPaid currencyID="USD">36.15</AmountPaid>
				<AdjustmentAmount currencyID="USD">0.0</AdjustmentAmount>
				<ConvertedAdjustmentAmount currencyID="USD">0.0</ConvertedAdjustmentAmount>
				<Buyer>
					<UserID>buyer-example</UserID>
					<FeedbackScore>58</FeedbackScore>
				</Buyer>
				<ShippingDetails>
					<ShippingServiceUsed>USPSPriority</ShippingServiceUsed>
					<ShipmentTrackingDetails>
						<ShippingCarrierUsed>USPS</ShippingCarrierUsed>
						<ShipmentTrackingNumber>9400111899223856923456</ShipmentTrackingNumber>
					</ShipmentTrackingDetails>
				</ShippingDetails>
				<ConvertedAmountPaid currencyID="USD">36.15</ConvertedAmountPaid>
				<ConvertedTransactionPrice currencyID="USD">20.0</ConvertedTransactionPrice>
				<CreatedDate>2019-10-02T21:01:06.000Z</CreatedDate>
				<QuantityPurchased>1</QuantityPurchased>
				<Status>
					<eBayPaymentStatus>NoPaymentFailure</eBayPaymentStatus>
					<CheckoutStatus>CheckoutComplete</CheckoutStatus>
					<LastTimeModified>2019-10-08T17:56:11.000Z</LastTimeModified>
					<PaymentMethodUsed>CreditCard</PaymentMethodUsed>
					<CompleteStatus>Complete</CompleteStatus>
					<BuyerSelectedShipping>true</BuyerSelectedShipping>
					<PaymentHoldStatus>None</PaymentHoldStatus>
				</Status>
				<TransactionID>220022002201</TransactionID>
				<TransactionPrice currencyID="USD">20.0</TransactionPrice>
				<BestOfferSale>true</BestOfferSale>
				<ShippingServiceSelected>
					<ShippingService>USPSPriority</ShippingService>
					<ShippingServiceCost currencyID="USD">16.15</ShippingServiceCost>
				</ShippingServiceSelected>
				<PaidTime>2019-10-04T02:12:07.000Z</PaidTime>
				<ShippedTime>2019-10-04T23:37:00.000Z</ShippedTime>
				<TransactionSiteID>US</TransactionSiteID>
				<Platform>eBay</Platform>
				<OrderLineItemID>110011001101-220022002201</OrderLineItemID>
				<IntangibleItem>false</IntangibleItem>
			</Transaction>
		</TransactionArray>
	</GetItemTransactionsResponse>
</soapenv:Body>
```
