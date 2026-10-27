# GET : getShippingServices Samples
- [Sample 1: Retrieve the eBay shipping services metadata for the specified marketplace](#sample-1-retrieve-the-ebay-shipping-services-metadata-for-the-specified-marketplace)

---

## Sample 1: Retrieve the eBay shipping services metadata for the specified marketplace

This example retrieves the eBay shipping services for the `EBAY_US` marketplace.

This method returns an array with each node in the response containing metadata for the shipping services returned.

### Input

This method does not use a request payload. The response returns a list for the marketplace specified through the path parameter.

```http
GET https://api.ebay.com/sell/metadata/v1/shipping/marketplace/EBAY_US/get_shipping_services
```

### Output

If the call is successful, the response body contains the eBay shipping service metadata for the marketplace specified in the request.

Note that the response shown is only a sample of a much larger response.

```json
{
    "shippingServices": [
        {
            "description": "eBay Standard Envelope for eligible items up to $20",
            "internationalService": false,
            "shippingCarrier": "EBAY_SEND",
            "shippingService": "US_eBayStandardEnvelope",
            "maxShippingTime": 6,
            "minShippingTime": 3,
            "shippingCategory": "STANDARD",
            "validForSellingFlow": true,
            "shippingCostTypes": [
                "CALCULATED",
                "FLAT"
            ],
            "packageLimits": {
                "maxWeight": 3.0,
                "minWeight": 0.0,
                "weightUnit": "OUNCE",
                "maxLength": 11.5,
                "maxWidth": 6.13,
                "maxHeight": 1.0,
                "dimensionUnit": "INCH"
            }
        },
        {
            "description": "USPS Ground Advantage",
            "internationalService": false,
            "shippingCarrier": "USPS",
            "shippingService": "USPSParcel",
            "maxShippingTime": 5,
            "minShippingTime": 2,
            "shippingCategory": "STANDARD",
            "validForSellingFlow": true,
            "shippingCostTypes": [
                "CALCULATED",
                "FLAT"
            ],
            "packageLimits": {
                "maxWeight": 1120.0,
                "minWeight": 0.0,
                "weightUnit": "OUNCE",
                "dimensionUnit": "INCH"
            }
        },
        {
            "description": "USPS Priority Mail",
            "internationalService": false,
            "shippingCarrier": "USPS",
            "shippingService": "USPSPriority",
            "maxShippingTime": 4,
            "minShippingTime": 1,
            "shippingCategory": "EXPEDITED",
            "validForSellingFlow": true,
            "shippingCostTypes": [
                "CALCULATED",
                "FLAT"
            ],
            "packageLimits": {
                "maxWeight": 1120.0,
                "minWeight": 0.0,
                "weightUnit": "OUNCE",
                "dimensionUnit": "INCH"
            }
        },
        {
            "description": "UPS Ground",
            "internationalService": false,
            "shippingCarrier": "UPS",
            "shippingService": "UPSGround",
            "maxShippingTime": 5,
            "minShippingTime": 1,
            "shippingCategory": "STANDARD",
            "validForSellingFlow": true,
            "shippingCostTypes": [
                "CALCULATED",
                "FLAT"
            ],
            "packageLimits": {
                "maxWeight": 2400.0,
                "minWeight": 0.0,
                "weightUnit": "OUNCE",
                "maxLength": 108.0,
                "dimensionUnit": "INCH"
            }
        },
        {
            "description": "FedEx Ground or FedEx Home Delivery",
            "internationalService": false,
            "shippingCarrier": "FEDEX",
            "shippingService": "FedExHomeDelivery",
            "maxShippingTime": 5,
            "minShippingTime": 1,
            "shippingCategory": "STANDARD",
            "validForSellingFlow": true,
            "shippingCostTypes": [
                "CALCULATED",
                "FLAT"
            ],
            "packageLimits": {
                "maxWeight": 2400.0,
                "minWeight": 0.0,
                "weightUnit": "OUNCE",
                "maxLength": 108.0,
                "dimensionUnit": "INCH"
            }
        }
    ]
}
```

---
