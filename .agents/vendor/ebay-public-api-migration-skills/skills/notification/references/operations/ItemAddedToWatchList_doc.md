# ItemAddedToWatchList

- Source URL: https://developer.ebay.com/api-docs/static/pn_item-added-to-watch-list.html

## Description

eBay sends an ItemAddedToWatchList notification to third parties subscribed on the buyer's behalf whenever a buyer adds an item to their watch list. The typical flow of events is: A third party subscribes to the ItemAddedToWatchList notification on behalf of a buyer. The buyer adds an item to their watch list. eBay sends the ItemAddedToWatchList notification to the third party, indicating the item was just added to the watch list. eBay also sends ItemAddedToWatchList notifications to the third party for all items the buyer adds, either through the eBay sites or programmatically from an API or SDK. Data Fields Returned API Call that displays this notification: GetItem with default detail level The data fields returned by the ItemAddedToWatchList notification are the same as those returned by GetItemResponse with default details requested. Refer to the GetItem call reference documentation for additional information. Refer to SOAP Message Body for information about the standard elements returned for all notifications.
