# ItemClosed

- Source URL: https://developer.ebay.com/api-docs/static/pn_item-closed.html
- Packaged modern topic doc: [LISTING_doc.md](./LISTING_doc.md)

## Description

eBay sends an ItemClosed notification to all subscribed parties of interest when a fixed-price listing ends without sales, or when an auction listing ends with no winning bidder. This notification is sent shortly after the ItemUnsold notification is sent to the seller. The typical flow of events is: A third party subscribes to the ItemClosed notification on behalf of a buyer or seller. The item closes with an ItemUnsold event. eBay sends the ItemClosed notification to the third party, indicating the item has closed. Data Fields Returned API Call that displays this notification: GetItem with default detail level The data fields returned by the ItemClosed notification are the same as those returned by GetItemResponse with default details requested. Refer to the GetItem call reference documentation for additional information. Refer to SOAP Message Body for information about the standard elements returned for all notifications.

## Migration guidance

Migrate `ItemClosed` to the modern `LISTING` topic and use
`notification.data.reason = ENDED` to identify the listing-end event.
