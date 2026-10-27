# GET : getExcludeShippingLocations Samples
- [Sample 1: Retrieve the excluded shipping locations for the specified marketplace](#sample-1-retrieve-the-excluded-shipping-locations-for-the-specified-marketplace)

---

## Sample 1: Retrieve the excluded shipping locations for the specified marketplace

This example retrieves a list of the excluded shipping locations for the `EBAY_US` marketplace.

This method returns an array with each node in the response containing the excluded shipping locations returned.

### Input

This method does not use a request payload. The response returns a list for the marketplace specified through the path parameter.

```http
GET https://api.ebay.com/sell/metadata/v1/shipping/marketplace/EBAY_US/get_exclude_shipping_locations
```

### Output

If the call is successful, the response body contains the excluded shipping locations for the marketplace specified in the request.

Note that the response shown is only a sample of a much larger response.

```json
{
    "excludeShippingLocations": [
        {
            "description": "Alaska/Hawaii",
            "location": "Alaska/Hawaii",
            "region": "Domestic Location"
        },
        {
            "description": "APO/FPO",
            "location": "APO/FPO",
            "region": "Domestic Location"
        },
        {
            "description": "US Protectorates",
            "location": "US Protectorates",
            "region": "Domestic Location"
        },
        {
            "description": "Africa",
            "location": "Africa",
            "region": "Worldwide"
        },
        {
            "description": "Algeria",
            "location": "DZ",
            "region": "Africa"
        },
        {
            "description": "Asia",
            "location": "Asia",
            "region": "Worldwide"
        },
        {
            "description": "China",
            "location": "CN",
            "region": "Asia"
        },
        {
            "description": "Europe",
            "location": "Europe",
            "region": "Worldwide"
        },
        {
            "description": "Germany",
            "location": "DE",
            "region": "Europe"
        },
        {
            "description": "North America",
            "location": "North America",
            "region": "Worldwide"
        },
        {
            "description": "Canada",
            "location": "CA",
            "region": "North America"
        },
        {
            "description": "Worldwide",
            "location": "Worldwide",
            "region": "Worldwide"
        },
        {
            "description": "PO Box",
            "location": "PO Box",
            "region": "Additional Locations"
        }
    ]
}
```

---
