# POST : getCompatibilitiesBySpecification Samples
- [Sample 1: Retrieve compatible applications for a part](#sample-1-retrieve-compatible-applications-for-a-part)

---

## Sample 1: Retrieve compatible applications for a part

This method will retrieve the compatible vehicles for a part based on the provided specification.

### Input

The category ID for which to retrieve compatibility property names must be provided in the request body. In addition, the specifications for which to retrieve compatible vehicles for the part must be specified through the **specifications** array in the request. The size of the result set can be filtered by using the **compatibilityPropertyFilters** and **dataSet** arrays to specify the properties to be returned.

In this sample, the user wishes to find compatible vehicles for the tires specified through the **specifications** container. The results are then filtered down to only the vehicles that are compatible with the vehicle properties specified in the **compatibilityPropertyFilters** container.

```http
POST https://api.ebay.com/sell/metadata/v1/compatibilities/get_compatibilities_by_specification
{
  "categoryId": "179679",
  "datasetPropertyName":["Trim","Engine"],
  "compatibilityPropertyFilters": [
    {
      "propertyName": "Model",
      "propertyValue": "V8 Vantage"
    },
    {
      "propertyName": "Make",
      "propertyValue": "Aston Martin"
    },
    {
      "propertyName": "Year",
      "propertyValue": "2009"
    }
  ],
  "exactMatch": null,
  "specifications": [
    {
      "propertyName": "Rim Width",
      "propertyValue": "9.5"
    },
    {
      "propertyName": "Rim Diameter",
      "propertyValue": "19"
    },
    {
      "propertyName": "Bolt Pattern",
      "propertyValue": "5x114.3"
    },
    {
      "propertyName": "Offset",
      "propertyValue": "40"
    }
  ]
}
```

### Output

If the call is successful, all compatible vehicles for the specification are returned (within the confines of the specified filters).

In this sample, only vehicles with the specified trim and engine are compatible with the provided specifications.

```json
{
    "compatibilities": [
        {
            "compatibilityDetails": [
                {
                    "propertyName": "Engine",
                    "propertyValue": "4.7L 4735CC 289Cu. In. V8 GAS DOHC Naturally Aspirated"
                },
                {
                    "propertyName": "Trim",
                    "propertyValue": "Base Convertible 2-Door"
                }
            ]
        }
    ]
}
```

---

