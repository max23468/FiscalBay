# ItemWon

- Source URL: https://developer.ebay.com/api-docs/static/pn_item-won.html

## Description

eBay sends an ItemWon notification to a subscribed buyer when the buyer has won an auction item due to having the highest bid when the auction listing closed. The typical flow of events is: A third party subscribes to the ItemWon notification on behalf of a buyer. The buyer wins an item sold by auction by having the highest bid when the listing ends. eBay sends the ItemWon notification to the third party, indicating the user just won an auction item. Data Fields Returned API Call that displays this notification: GetItem with default detail level The data fields returned by the ItemWon notification are the same as those returned by GetItemResponse with default details requested. Refer to the GetItem call reference documentation for additional information. Refer to SOAP Message Body for information about the standard elements returned for all notifications.
