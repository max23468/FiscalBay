# CheckoutBuyerRequestsTotal

- Source URL: https://developer.ebay.com/api-docs/static/pn_buyer-requests-total.html

## Description

This notification is sent to a subscribed seller when a buyer/winning bidder is requesting a total price before paying for the item. This notification is applicable for auction listings and for fixed-price listings that do not require immediate payment. For fixed-price items, a CheckoutBuyerRequestsTotal notification would be received by the seller before a FixedPriceTransaction notification. For auction items, a CheckoutBuyerRequestsTotal notification would be received by the seller after an EndOfAuction notification, but before an AuctionCheckoutComplete notification. A CheckoutBuyerRequestsTotal notification may be sent multiple times for the same listing if a buyer requests a total more than once. Data Fields Returned API Call that displays this notification: GetItemTransactions with default detail level The data fields returned by the CheckoutBuyerRequestsTotal notification are the same as those returned by GetItemTransactions with default details requested. Refer to the GetItemTransactions call reference documentation for additional information. Refer to SOAP Message Body for information about the standard elements returned for all notifications.
