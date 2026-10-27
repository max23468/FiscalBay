# BestOfferDeclined

- Source URL: https://developer.ebay.com/api-docs/static/pn_best-offer-declined.html

## Description

eBay sends a BestOfferDeclined notification to third parties subscribed on the buyer's behalf whenever a seller rejects the buyer's Best Offer. The typical flow of events is: A third party subscribes to the BestOfferDeclined notification on behalf of a buyer. The buyer's Best Offer is rejected by the seller. eBay sends the BestOfferDeclined notification to the third party, indicating the buyer's Best Offer was rejected. eBay also sends BestOfferDeclined notifications to the third party each time a seller rejects a Best Offer placed by the buyer, either through the eBay site or programmatically from an API or SDK. Data Fields Returned API Call that displays this notification: GetBestOffers with ReturnAll detail level The data fields returned by the BestOfferDeclined notification are the same as those returned by GetBestOfferResponse with ReturnAll details requested. Refer to the GetBestOffers call reference documentation for additional information. Refer to SOAP Message Body for information about the standard elements returned for all notifications.
