# ItemRemovedFromWatchList

- Source URL: https://developer.ebay.com/api-docs/static/pn_item-removed-from-watch-list.html

## Description

eBay sends an ItemRemovedFromWatchList notification to third parties subscribed on the buyer's behalf whenever a buyer removes an item from their watchlist. The typical flow of events is: A third party subscribes to the ItemRemovedFromWatchList notification on behalf of a buyer. The buyer removes an item from their watchlist. eBay sends the ItemRemovedFromWatchList notification to the third party, indicating that the item has been removed from the watchlist. eBay also sends ItemRemovedFromWatchList notifications to the third party for all items the buyer removes, either through the eBay sites or programmatically from an API or SDK. Data Fields Returned API Call that displays this notification: GetItem with default detail level The data fields the ItemRemovedFromWatchList notification returns are the same as those returned by GetItemResponse with default details requested. Refer to the GetItem call reference documentation for additional information. Refer to SOAP Message Body for information about the standard elements returned for all notifications.
