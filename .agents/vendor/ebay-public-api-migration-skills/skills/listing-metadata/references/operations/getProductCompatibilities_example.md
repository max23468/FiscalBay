# POST : getProductCompatibilities Samples
- [Sample 1: Retrieve item compatibility details for a product](#sample-1-retrieve-item-compatibility-details-for-a-product)

---

## Sample 1: Retrieve item compatibility details for a product

This method will retrieve all available item compatibility details for a specified product.

### Input

The product identifier of the item for which to retrieve compatibility details must be provided in the request body. In this sample, the **epid** of the item is provided.

Various filters to constrain the result set are available for this method. In this sample, the **applicationPropertyFilters** array is set so that only parts compatible with Chrysler model vehicles from the year 2005 will be returned. The **dataset** array can also be also set; in this sample, `DisplayableSearchResults` is defined, which means that properties for use in results for product searches are returned.

```http
POST https://api.ebay.com/sell/metadata/v1/compatibilities/get_product_compatibilities
{
  "productIdentifier": {
    "epid": "13001480987"
  },
  "applicationPropertyFilters": [
    {
      "propertyName": "Year",
      "propertyValue": "2005"
    },
    {
      "propertyName": "Make",
      "propertyValue": "Chrysler"
    }
  ],
  "dataset": [
    "DisplayableSearchResults"
  ],
  "sortOrders": [
    {
      "sortOrder": {
        "propertyName": "Make",
        "order": "Ascending"
      },
       "sortPriority": "Sort1"
    }
  ],
  "paginationInput": {
    "offset": "0",
    "limit": "100"
  }
}
```

### Output

If the call is successful, item compatiblity details for the specified product are returned (within the confines of the provided filters).

Note that the response shown is only a sample of a much larger response.

```json
{
  "pagination": {
    "total": 7,
    "count": 7,
    "offset": 0,
    "limit": 100
  },
  "compatibilityDetails": [
    {
      "productDetails": [
        {
          "propertyName": "Engine - Liter_Display",
	  "propertyValue": "3.3L"
        },
        {
	  "propertyName": "Engine",
	  "propertyValue": "3.3L 3301CC 201Cu. In. V6 GAS OHV Naturally Aspirated"
        },
        {
          "propertyName": "Submodel",
          "propertyValue": "LX"
        },
        {
	  "propertyName": "Make",
	  "propertyValue": "Chrysler"
        },
        {
	  "propertyName": "Trim",
	  "propertyValue": "LX Mini Passenger Van 4-Door"
        },
        {
	  "propertyName": "Year",
	  "propertyValue": "2005"
        },
        {
	  "propertyName": "Model",
	  "propertyValue": "Town & Country"
        }
      ],
      "noteDetails": [
        {
	  "propertyName": "Mfrlabel",
	  "propertyValue": "ThermoQuiet Reman Loaded Caliper w/ Ceramic Pads"
        },
        {
	  "propertyName": "Position",
	  "propertyValue": "Front Left"
        },
        {
	  "propertyName": "Note",
	  "propertyValue": "FWD, Front Disc, Rear Drum, 4-Wheel ABS"
        },
        {
	  "propertyName": "PartType",
	  "propertyValue": "Disc Brake Caliper"
        }
      ]
    },
    {
      "productDetails": [
        {
	  "propertyName": "Engine - Liter_Display",
	  "propertyValue": "3.8L"
        },
        {
	  "propertyName": "Engine",
	  "propertyValue": "3.8L 3778CC 231Cu. In. V6 GAS OHV Naturally Aspirated"
        },
        {
	  "propertyName": "Submodel",
	  "propertyValue": "LX"
	},
	{
	  "propertyName": "Make",
	  "propertyValue": "Chrysler"
	},
	{
	  "propertyName": "Trim",
	  "propertyValue": "LX Mini Passenger Van 4-Door"
	},
	{
	  "propertyName": "Year",
	  "propertyValue": "2005"
	},
	{
	  "propertyName": "Model",
	  "propertyValue": "Town & Country"
	}
      ],
      "noteDetails": [
        {
	  "propertyName": "Mfrlabel",
	  "propertyValue": "ThermoQuiet Reman Loaded Caliper w/ Ceramic Pads"
	},
	{
	  "propertyName": "Position",
	  "propertyValue": "Front Left"
	},
	{
	  "propertyName": "Note",
	  "propertyValue": "FWD, Front Disc, Rear Drum, 4-Wheel ABS"
	},
	{
	  "propertyName": "PartType",
	  "propertyValue": "Disc Brake Caliper"
	}
      ]
    }
  ]
}
```

---
