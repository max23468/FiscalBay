# POST : createShippingFulfillment Samples
- [Sample 1: Create a Shipping Fulfillment](#sample-1-create-a-shipping-fulfillment)

---

## Sample 1: Create a Shipping Fulfillment

This sample creates a new shipping fulfillment with an eBay-generated fulfillment ID, containing the specified line items.

### Input

Use the **orderid** parameter to specify the order for which you are creating a shipping fulfillment. Identify the **lineItems ** included in the package, as well as the shipping information if the package has been shipped.

```http
POST https://api.ebay.com/sell/fulfillment/v1/order/6********5!2********1/shipping_fulfillment
{
    "lineItems": [
        { 
          "lineItemId": "EXAMPLE-LINE-ITEM-0001", 
          "quantity": 1 
        }
    ],
    "shippedDate": "2016-07-20T00:00:00.000Z",
    "shippingCarrierCode": "USPS",
    "trackingNumber": "EXAMPLE-TRACKING-0002"
}
```

### Output

A successful call returns an HTTP status code of `201` (Created). It also returns a location header response for the newly created shipping fulfillment resource, including its fulfillment ID: 
 https://api.ebay.com/sell/fulfillment/v1/order/6********5!2********1/shipping_fulfillment/1********6 
 **Note:** Currently, eBay uses the value of the submitted tracking number as the new fulfillment ID, but don't depend on this behavior. The fulfillment ID format is subject to change in the future.This call has no response payload.

*Sample output file not available for this operation.*

---


