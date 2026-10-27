# POST : getCompatibilitySearchValuesBulk Samples

## Mapped Modern Sample

## Sample 1: Retrieve product compatibility values associated with multiple property names

This method will retrieve product compatibility property values for the specified property names, in the specified category.

### Input

The category ID for which to retrieve compatibility property names must be provided in the request body. In addition, the property names for which to retrieve property values must be specified through the **propertyNames** field in the request. The **propertyFilters** array can also be input to specify the compatibility properties used to limit the result set. Only values associated with the specified name-value pairs will be returned in the response.

In this sample, all property values associated with the `Make`, `Model`, `Year` property names (in the specified category) will be returned in the response, as long as they are associated with the **Year-2022** name-value pair specified in the **propertyFilters** field.

```http
POST https://api.ebay.com/sell/metadata/v1/compatibilities/get_multi_compatibility_property_values
{
	"categoryId": "179679",
	"propertyFilters": [
		{
			"propertyName": "Year",
			"propertyValue": "2022"
		}
	],
	"propertyNames": [
		"Make",
		"Model",
		"Year"
	]
}
```

### Output

If the call is successful, all property values (within the confines of the specified **propertyFilters**) for the specified property names are returned.

Note that the response shown is only a sample of a much larger response.

```json
{
	"metadataVersion": "721",
	"compatibilities": [
		{
			"compatibilityDetails": [
				{
					"propertyName": "Make",
					"propertyValue": "IC Corporation"
				},
				{
	  "propertyName": "Model",
	  "propertyValue": "CE School Bus"
	},
	{
	  "propertyName": "Year",
	  "propertyValue": "2022"
	}
			]
		},
		{
			"compatibilityDetails": [
				{
					"propertyName": "Make",
					"propertyValue": "IC Corporation"
				},
				{
	  "propertyName": "Model",
	  "propertyValue": "RE School Bus"
	},
	{
	  "propertyName": "Year",
	  "propertyValue": "2022"
	}
			]
		},
		{
			"compatibilityDetails": [
				{
	  "propertyName": "Make",
	  "propertyValue": "IC Corporation"
				},
	{
	  "propertyName": "Model",
	  "propertyValue": "CE Commercial"
	},
	{
	  "propertyName": "Year",
	  "propertyValue": "2022"
	}
			]
		}
	]
}
```

---
