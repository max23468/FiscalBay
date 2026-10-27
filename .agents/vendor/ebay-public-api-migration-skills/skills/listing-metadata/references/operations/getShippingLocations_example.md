# GET : getShippingLocations Samples
- [Sample 1: Retrieve the shipping locations available for the specified marketplace](#sample-1-retrieve-the-shipping-locations-available-for-the-specified-marketplace)

---

## Sample 1: Retrieve the shipping locations available for the specified marketplace

This example retrieves the shipping locations available for the `EBAY_US` marketplace.

This method returns an array with each node in the response containing the shipping locations and codes.

### Input

This method does not use a request payload. The response returns a list for the marketplace specified through the path parameter.

```http
GET https://api.ebay.com/sell/metadata/v1/shipping/marketplace/EBAY_US/get_shipping_locations
```

### Output

If the call is successful, the response body contains the shipping locations available for the marketplace specified in the request.

```json
{
    "shippingLocations": [
        {
            "description": "North and South America",
            "shippingLocation": "Americas"
        },
        {
            "description": "Europe (including UK)",
            "shippingLocation": "Europe"
        },
        {
            "description": "Asia",
            "shippingLocation": "Asia"
        },
        {
            "description": "Canada",
            "shippingLocation": "CA"
        },
        {
            "description": "United Kingdom",
            "shippingLocation": "GB"
        },
        {
            "description": "China",
            "shippingLocation": "CN"
        },
        {
            "description": "Mexico",
            "shippingLocation": "MX"
        },
        {
            "description": "Germany",
            "shippingLocation": "DE"
        },
        {
            "description": "Japan",
            "shippingLocation": "JP"
        },
        {
            "description": "Brazil",
            "shippingLocation": "BR"
        },
        {
            "description": "France",
            "shippingLocation": "FR"
        },
        {
            "description": "Australia",
            "shippingLocation": "AU"
        },
        {
            "description": "Russian Federation",
            "shippingLocation": "RU"
        },
        {
            "description": "Worldwide",
            "shippingLocation": "Worldwide"
        },
        {
            "description": "None",
            "shippingLocation": "None"
        }
    ]
}
```

---
