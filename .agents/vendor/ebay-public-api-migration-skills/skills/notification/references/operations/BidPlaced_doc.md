# BidPlaced

- Source URL: https://developer.ebay.com/api-docs/static/pn_bid-placed.html

## Description

eBay sends a BidPlaced notification to third parties subscribed on the buyer's behalf whenever a buyer places a bid on an auction item. The typical flow of events is: A third party subscribes to the BidPlaced notification on behalf of a buyer. The buyer bids on an auction item. eBay sends the BidPlaced notification to the third party, indicating that the buyer has bid on an auction item. eBay also sends BidPlaced notifications to the third party for all auction items the buyer bids on, either through the eBay sites or programmatically from an API or SDK. Data Fields Returned API Call that displays this notification: GetItem with default detail level The data fields returned by the BidPlaced notification are the same as those returned by GetItemResponse with default details requested. Refer to the GetItem call reference documentation for additional information. Refer to SOAP Message Body for information about the standard elements returned for all notifications.
