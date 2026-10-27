# POST : getCompatibilitySearchValues Samples

## Mapped Modern Sample

## Sample 1: Retrieve product compatibility values associated with a property name

This method will retrieve product compatibility property values for a specified property name, in the specified category.

### Input

The category ID for which to retrieve compatibility property names must be provided in the request body. In addition, the property name for which to retrieve property values must be specified through the **propertyName** field in the request. The **propertyFilters** array can also be input to specify the compatibility properties used to limit the result set. Only values associated with the specified name-value pairs will be returned in the response.

In this sample, all property values associated with the `Model` property name (in the specified category) will be returned in the response, as long as they are associated with the **Make-Honda** name-value pair specified in the **propertyFilters** field.

```http
POST https://api.ebay.com/sell/metadata/v1/compatibilities/get_compatibility_property_values
{
	"categoryId": "33559",
	"propertyName": "Model",
	"propertyFilters": [
		{
			"propertyName": "Make",
			"propertyValue": "Honda"
		}
	],
	"sortOrder": "Ascending"
}
```

### Output

If the call is successful, all property values (within the confines of the specified **propertyFilters**) for the specified property name are returned.

```json
{
	"metadataVersion": "721",
	"propertyName": "Model",
	"propertyValues": [
		"600",
		"Accord",
		"Accord Crosstour",
		"BR-V",
		"City",
		"Civic",
		"Civic del Sol",
		"Clarity",
		"Clarity Plug-In Hybrid",
		"CR-V",
		"CR-Z",
		"Crosstour",
		"CRX",
		"Element",
		"EV Plus",
		"Fit",
		"HR-V",
		"Insight",
		"Odyssey",
		"Passport",
		"Pilot",
		"Prelude",
		"Prologue",
		"Ridgeline",
		"S2000",
		"Wagovan"
	]
}
```

---
