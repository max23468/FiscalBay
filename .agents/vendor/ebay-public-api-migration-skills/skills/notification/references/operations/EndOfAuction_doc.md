# EndOfAuction

- Source URL: https://developer.ebay.com/api-docs/static/pn_end-of-auction.html

## Description

The EndOfAuction notification is sent to all subscribed bidders of an auction item and to the subscribed seller of the auction item as soon as the auction listing ends with or without a winning bidder. This notification will also be sent to subscribed bidders and the subscribed seller if a buyer ends the auction as a result of using the auction listing's Buy It Now feature. Platform Choice When a user requests, via the notification preferences web page, to be notified of this event, the default is for the notification to be sent via API ("Platform"). The user can choose instead to be notified via wireless ("SMS"). Data Fields Returned API Call that displays this notification: GetItemTransactions with ReturnAll detail level The data fields returned by the EndOfAuction notification are the same as those for the GetItemTransactions call with ReturnAll details requested. Refer to the GetItemTransactions call reference documentation for additional information. Refer to SOAP Message Body for information about the standard elements returned for all notifications. Example In this example, example seller is notified that her listing of "Example listing title" has ended with a successful bid from example buyer . Sample EndOfAuction Notification
