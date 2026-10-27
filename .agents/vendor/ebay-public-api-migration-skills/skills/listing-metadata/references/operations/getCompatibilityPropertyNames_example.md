# POST : getCompatibilityPropertyNames Samples
- [Sample 1: Retrieve product compatibility names for a category](#sample-1-retrieve-product-compatibility-names-for-a-category)

---

## Sample 1: Retrieve product compatibility names for a category

This method will retrieve product compatibility property names for a specified compatibility-enabled category.

### Input

The category ID for which to retrieve compatibility property names must be provided in the request body. The **dataSet** array can also be set to define the properties that will be returned.

In this sample, `DisplayableSearchResults` is defined, which means that only properties for use in results for product searches are returned.

```http
POST https://api.ebay.com/sell/metadata/v1/compatibilities/get_compatibility_property_names
{
  "categoryId": "179679",
  "dataset": [
    "DisplayableSearchResults"
  ]
}
```

### Output

If the call is successful, all property names (within the confines of the specified **dataSet**) for the specified category are returned, along with the associated metadata and the display name of the property.

```json
{
  "categoryId": "179679",
  "properties": [
    {
      "propertyNames": [
        {
          "propertyName": "Year",
          "propertyNameMetadata": {
            "displaySequence": 1
          },
          "propertyDisplayName": "Year"
        },
        {
          "propertyName": "Make",
          "propertyNameMetadata": {
            "displaySequence": 2
          },
          "propertyDisplayName": "Make"
        },
        {
          "propertyName": "Model",
          "propertyNameMetadata": {
            "displaySequence": 3
          },
          "propertyDisplayName": "Model"
        },
        {
          "propertyName": "Trim",
          "propertyNameMetadata": {
            "displaySequence": 4
          },
          "propertyDisplayName": "Trim"
        },
        {
          "propertyName": "Engine",
          "propertyNameMetadata": {
            "displaySequence": 5
          },
          "propertyDisplayName": "Engine"
        },
        {
          "propertyName": "FitmentComments",
          "propertyNameMetadata": {
            "displaySequence": 6
          },
          "propertyDisplayName": "Compatibility Notes"
        }
      ],
      "dataset": "DisplayableSearchResults"
    }
  ]
}
```

---
