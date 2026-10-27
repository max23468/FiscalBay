# GET : getShippingCarriers Samples
- [Sample 1: Retrieve the eBay shipping carriers available for the specified marketplace](#sample-1-retrieve-the-ebay-shipping-carriers-available-for-the-specified-marketplace)

---

## Sample 1: Retrieve the eBay shipping carriers available for the specified marketplace

This example retrieves the eBay shipping carriers available for the `EBAY_US` marketplace.

This method returns an array with each node in the response containing the available shipping carriers returned.

### Input

This method does not use a request payload. The response returns a list for the marketplace specified through the path parameter.

```http
GET https://api.ebay.com/sell/metadata/v1/shipping/marketplace/EBAY_US/get_shipping_carriers
```

### Output

If the call is successful, the response body contains the available shipping carriers available for the marketplace specified in the request.

Note that the response shown is only a sample of a much larger response.

```json
{
    "shippingCarriers": [
        {
            "description": "UPS",
            "shippingCarrier": "UPS"
        },
        {
            "description": "USPS",
            "shippingCarrier": "USPS"
        },
        {
            "description": "DHL Express International",
            "shippingCarrier": "DHL Express International"
        },
        {
            "description": "FedEx",
            "shippingCarrier": "FedEx"
        },
        {
            "description": "Canada Post",
            "shippingCarrier": "Canada Post"
        },
        {
            "description": "eBay Standard Delivery",
            "shippingCarrier": "eBay Standard Delivery"
        }
    ]
}
```

---
