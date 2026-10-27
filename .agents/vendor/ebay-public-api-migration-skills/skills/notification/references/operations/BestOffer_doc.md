# BestOffer

- Source URL: https://developer.ebay.com/api-docs/static/pn_best-offer.html

## Description

eBay sends a BestOffer notification when a bidder makes an offer on a listing that is enabled for the Best Offer feature. The notification is not sent to the buyer or seller, but only to a third party such as an eBay development partner. The flow of events is this: A third party subscribes to the BestOffer notification on behalf of a seller who has opted a listing into the Best Offer feature. eBay sends a notification to the third party each time a bidder makes an offer on that listing. Data Fields Returned API Call that displays this notification: GetBestOffers The data fields returned by the BestOffer notification are the same as those returned by GetBestOffersResponse . Refer to the GetBestOffers call reference documentation for additional information. Refer to SOAP Message Body for information about the standard elements returned for all notifications.
