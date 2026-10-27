# CounterOfferReceived

- Source URL: https://developer.ebay.com/api-docs/static/pn_counter-offer-recd.html

## Description

The CounterOfferReceived notification is sent to a subscribing buyer when a seller makes a counter offer to the buyer's Best Offer. This notification is applicable to Best Offer-enabled listings. The typical flow of events is: A buyer subscribes to the CounterOfferReceived notification. The buyer receives a counteroffer from a seller in response to a Best Offer the buyer placed. eBay sends the CounterOfferReceived notification to the buyer, indicating the buyer received a counteroffer from the seller. Data Fields Returned API Call that displays this notification: GetBestOffers with ReturnAll detail level The data fields returned by the CounterOfferReceived notification are the same as those returned by GetBestOfferResponse with ReturnAll details requested. Refer to the GetBestOffers call reference documentation for additional information. Refer to SOAP Message Body for information about the standard elements returned for all notifications.
