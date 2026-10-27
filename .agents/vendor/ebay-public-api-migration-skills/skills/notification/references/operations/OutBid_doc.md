# OutBid

- Source URL: https://developer.ebay.com/api-docs/static/pn_outbid.html

## Description

An Outbid notification is sent to a subscribed buyer when another buyer has outbid (placed a higher maximum bid) the subscribed buyer on an auction listing, and the subscribed buyer is no longer the current high bidder. Platform Choice When a user requests, via the notification preferences web page, to be notified of this event, the default is for the notification to be sent via API ("Platform"). The user can choose instead to be notified via wireless ("SMS"). Data Fields Returned API Call that displays this notification: GetItem with default detail level The data fields returned by the Outbid notification are the same as those returned by GetItem with default details requested. Refer to the GetItem call reference documentation for additional information. Refer to SOAP Message Body for information about the standard elements returned for all notifications.
