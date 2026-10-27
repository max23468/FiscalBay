# BestOfferPlaced

- Source URL: https://developer.ebay.com/api-docs/static/pn_best-offer-placed.html

## Description

eBay sends a BestOfferPlaced notification to third parties subscribed on the buyer's behalf whenever a buyer places a Best Offer. A buyer can place a Best Offer by making an initial Best Offer or by countering a counteroffer. The typical flow of events is: A third party subscribes to the BestOfferPlaced notification on behalf of a buyer. The buyer places a Best Offer or counters a counteroffer. eBay sends the BestOfferPlaced notification to the third party, indicating the buyer placed a Best Offer. eBay also sends BestOfferPlaced notifications to the third party each time a buyer places a Best Offer, either through the eBay site or programmatically from an API or SDK. Data Fields Returned API Call that displays this notification: GetBestOffers with ReturnAll detail level The data fields returned by the BestOfferPlaced notification are the same as those returned by GetBestOffersResponse with ReturnAll details requested. Refer to the GetBestOffers call reference documentation for additional information. Refer to SOAP Message Body for information about the standard elements returned for all notifications.
