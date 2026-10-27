---
title: Taxonomy API
description: "The Taxonomy API enables you to assist both sellers and buyers: * It helps sellers to determine the best eBay category under which to offer each inventory item for sale in a selected eBay marketplace. It helps sellers to select the categories of items to include in a campaign or promotion. It also provides information about the aspects to include when defining an inventory item in a given category. For more information, see the [Selling Integration Guide](/api-docs/sell/static/selling-ig-landing.html). * It helps buyers to determine the appropriate categories in which to browse or search for the items they're looking to purchase in a particular eBay marketplace. For more information, see the [Buying Integration Guide](/api-docs/buy/static/buying-ig-landing.html)."
api_version: v1.1.1
api_name: taxonomy_api
api_type: REST
api_group: taxonomy/api
source_url:
  html: https://developer.ebay.com/develop/api/taxonomy/api
  md: https://developer.ebay.com/develop/api/taxonomy/api.md
---
# Taxonomy API API


## Types

### AncestorReference
**Description:** This type contains information about one of the ancestors of a suggested category. An ordered list of these references describes the path from the suggested category to the root of the category tree it belongs to.
**Type:** object

**Properties:**
- **categoryId** (string)
  - The unique identifier of the eBay ancestor category.  
  
**Note:** The root node of a full default category tree includes the **categoryId** field, but its value should not be relied upon. It provides no useful information for application development.
- **categoryName** (string)
  - The name of the ancestor category identified by **categoryId**.
- **categorySubtreeNodeHref** (string)
  - The href portion of the **getCategorySubtree** call that retrieves the subtree below the ancestor category node.
- **categoryTreeNodeLevel** (integer)
  - The absolute level of the ancestor category node in the hierarchy of its category tree.  
  
**Note:** The root node of any full category tree is always at level `0`.

### Aspect
**Description:** This type contains information about an item attribute (for example, color) that is appropriate or necessary for accurately describing items in a particular leaf category. Sellers are required or encouraged to provide one or more values of this aspect when offering an item in that category on eBay.
**Type:** object

**Properties:**
- **aspectConstraint** (AspectConstraint)
  - Information about the formatting, occurrence, and support of this aspect.
- **aspectValues** (array)
  - A list of valid values for this aspect (for example: `Red`, `Green`, and `Blue`), along with any constraints on those values.
- **localizedAspectName** (string)
  - The localized name of this aspect (for example: `Colour` on the eBay UK site).  
  
**Note:** This name is always localized for the specified marketplace.
- **relevanceIndicator** (RelevanceIndicator)
  - The relevance of this aspect. This field is returned if eBay has data on how many searches have been performed for listings in the category using this item aspect.  
  
**Note:** This container is restricted to applications that have been granted permission to access this feature. You must submit an [App Check ticket](https://developer.ebay.com/my/support/tickets?tab=app-check ) to request this access. In the App Check form, add a note to the **Application Title/Summary** and/or **Application Details** fields that you want access to 'Buyer Demand Data' in the Taxonomy API.

### AspectAdvancedDataTypeEnum
**Description:** This enumerated type indicates any additional requirements associated with the data type of an aspect.  
  
Currently, the only supported value is `NUMERIC_RANGE`. | - **NUMERIC_RANGE**: This enum value indicates that the aspect value must be in numeric range format.
**Type:** object

### AspectConstraint
**Description:** This type contains information about the formatting, occurrence, and support of an aspect.
**Type:** object

**Properties:**
- **aspectApplicableTo** (array)
  - This value indicate if the aspect identified by the **aspects.localizedAspectName** field is a product aspect (relevant to catalog products in the category) or an item/instance aspect, which is an aspect whose value will vary based on a particular instance of the product.
- **aspectDataType** (AspectDataTypeEnum)
  - The data type of this aspect.
- **aspectEnabledForVariations** (boolean)
  - A value of `true` indicates that this aspect can be used to help identify item variations.
- **aspectFormat** (string)
  - _Returned only if_ the value of **aspectDataType** identifies a data type that requires specific formatting. Currently, this field provides formatting hints as follows:

*   **DATE**: `YYYY`, `YYYYMM`, `YYYYMMDD`
*   **NUMBER**: `int32`, `double`
- **aspectMaxLength** (integer)
  - The maximum length of the item/instance aspect's value. The seller must make sure not to exceed this length when specifying the instance aspect's value for a product. This field is only returned for instance aspects.
- **aspectMode** (AspectModeEnum)
  - The manner in which values of this aspect must be specified by the seller (as free text or by selecting from available options).
- **aspectRequired** (boolean)
  - A value of `true` indicates that this aspect is required when offering items in the specified category.
- **aspectUsage** (AspectUsageEnum)
  - The enumeration value returned in this field will indicate if the corresponding aspect is recommended or optional.  
  
**Note:** This field is always returned, even for hard-mandated/required aspects (where **aspectRequired**: `true`). The value returned for required aspects will be `RECOMMENDED`, but they are actually required and a seller will be blocked from listing or revising an item without these aspects.
- **expectedRequiredByDate** (string)
  - The expected date after which the aspect will be required.  
  
**Note:** The value returned in this field specifies only an approximate date, which may not reflect the actual date after which the aspect is required.
- **itemToAspectCardinality** (ItemToAspectCardinalityEnum)
  - Indicates whether this aspect can accept single or multiple values for items in the specified category.  
  
**Note:** Up to 30 values can be supplied for aspects that accept multiple values.
- **aspectAdvancedDataType** (AspectAdvancedDataTypeEnum)
  - Indicates additional data type requirements for the aspect. For example, `NUMERIC_RANGE` indicates that the aspect value must be in numeric range format.  
  
**Note:** Currently only `NUMERIC_RANGE` is supported.

### AspectDataTypeEnum
**Description:** This enumerated type contains a list of the available data types that can be specified as required for an aspect's values. | - **DATE**: This enum value indicates that the data type used for the product aspect value is a date. Dates can be expressed in different formats, so see the corresponding **aspectFormat** field for the required syntax/structure of date values for the product aspect value. - **NUMBER**: This enum value indicates that the data type used for the product aspect value is a a numeric value. Numeric values can be expressed in different formats, so see the corresponding **aspectFormat** field for the required syntax/structure of number values for the product aspect value. - **STRING**: This enum value indicates that the data type used for the product aspect value is a string. - **STRING_ARRAY**: This enum value is reserved for internal or future use.
**Type:** object

### AspectMetadata
**Description:** This type is the container type for the response payload of the **getItemAspectsForCategory** call.
**Type:** object

**Properties:**
- **aspects** (array)
  - A list of item aspects (for example, color) that are appropriate or necessary for accurately describing items in a particular leaf category. Each category has a different set of aspects and different requirements for aspect values. Sellers are required or encouraged to provide one or more acceptable values for each aspect when offering an item in that category on eBay.

### AspectModeEnum
**Description:** This enumerated type contains a list of the possible modes in which values of a product brand or aspect must be specified by the seller. | - **FREE_TEXT**: This enum value indicates that the seller can either select from a set of provided values, or manually enter a new value. - **SELECTION_ONLY**: This enum value indicates that the seller must select from a set of provided values.
**Type:** object

### AspectUsageEnum
**Description:** This enumerated type is used to indicate whether an aspect is recommended or optional. | - **RECOMMENDED**: This enum value is returned if the corresponding aspect is either required (**aspectRequired**: `true`) or recommended for the listing category. If a recommended aspect is not hard-mandated/required (**aspectRequired**: `false`), it is still highly recommended that the seller pass in the aspect name/value pair(s) if the aspect information is applicable and known, as this will ensure that the product listing is as complete and accurate as possible. It is also a good idea to pass in recommended aspects as these aspects may become mandated in the future. - **OPTIONAL**: This enum value indicates that the corresponding aspect is optional for the listing category. Like this enumeration value alludes to, it is optional that you pass in this aspect name/value pair, but if the aspect information is applicable and known, it is still a very good idea to pass in optional aspects, as this will ensure that the product listing is as complete and accurate as possible.
**Type:** object

### AspectValue
**Description:** This type contains a valid value for an aspect, along with any constraints on the occurrence of that value.
**Type:** object

**Properties:**
- **localizedValue** (string)
  - The localized value of this aspect.  
  
**Note:** This value is always localized for the specified marketplace.
- **valueConstraints** (array)
  - _Not returned if_ the value of the **localizedValue** field can always be selected for this aspect of the specified category.  
  
Contains a list of the dependencies that identify when the value of the **localizedValue** field is available for the current aspect. Each dependency specifies the values of another aspect of the same category (a _control_ aspect), for which the current value of the current aspect can also be selected by the seller.  
  
**Example:** A shirt is available in three sizes and three colors, but only the Small and Medium sizes come in Green. Thus for the Color aspect, the value Green is constrained by its dependency on Size (the control aspect). Only when the Size aspect value is Small or Medium, can the Color aspect value of Green be selected by the seller.

### BaseCategoryTree
**Description:** This type contains identifying information for the category tree associated with a particular eBay marketplace.
**Type:** object

**Properties:**
- **categoryTreeId** (string)
  - The unique identifier of the eBay category tree for the specified marketplace.
- **categoryTreeVersion** (string)
  - The version of the category tree identified by **categoryTreeId**. It's a good idea to cache this value for comparison so you can determine if this category tree has been modified in subsequent calls.

### Category
**Description:** This type contains information about a particular eBay category.
**Type:** object

**Properties:**
- **categoryId** (string)
  - The unique identifier of the eBay category within its category tree.  
  
**Note:** The root node of a full default category tree includes the **categoryId** field, but its value should not be relied upon. It provides no useful information for application development.
- **categoryName** (string)
  - The name of the category identified by **categoryId**.

### CategoryAspect
**Description:** This type defines information about a category and the aspects used to describe items in that category.
**Type:** object

**Properties:**
- **category** (Category)
  - The details that are appropriate or necessary to accurately define the category.
- **aspects** (array)
  - A list of aspect metadata that is used to describe the items in a particular leaf category.

### CategorySubtree
**Description:** This type contains information about a particular subtree of a specified eBay category tree. A category subtree consists of a non-root node of the category tree, and all of its descendants down to the leaf nodes.
**Type:** object

**Properties:**
- **categorySubtreeNode** (CategoryTreeNode)
  - Contains details of all nodes of the category subtree hierarchy below a specified node. This is a recursive structure.
- **categoryTreeId** (string)
  - The unique identifier of the eBay category tree to which this subtree belongs.
- **categoryTreeVersion** (string)
  - The version of the category tree identified by **categoryTreeId**. It's a good idea to cache this value for comparison so you can determine if this category tree has been modified in subsequent calls.

### CategorySuggestion
**Description:** This type contains information about a suggested category tree leaf node that corresponds to keywords provided in the request. It includes details about each of the category's ancestor nodes extending up to the root of the category tree.
**Type:** object

**Properties:**
- **category** (Category)
  - Contains details about the suggested category.
- **categoryTreeNodeAncestors** (array)
  - An ordered list of category references that describes the location of the suggested category in the specified category tree. The list identifies the category's ancestry as a sequence of parent nodes, from the current node's immediate parent to the root node of the category tree.  
  
**Note:** The root node of a full default category tree includes **categoryId** and **categoryName** fields, but their values should not be relied upon. They provide no useful information for application development.
- **categoryTreeNodeLevel** (integer)
  - The absolute level of the category tree node in the hierarchy of its category tree.  
  
**Note:** The root node of any full category tree is always at level `**0**`.
- **relevancy** (string)
  - This field is reserved for internal or future use.

### CategorySuggestionResponse
**Description:** This type contains an array of suggested category tree nodes that are considered by eBay to most closely correspond to the keywords provided in a query string, from a specified category tree.
**Type:** object

**Properties:**
- **categorySuggestions** (array)
  - Contains details about one or more suggested categories that correspond to the provided keywords. The array of suggested categories is sorted in order of eBay's confidence of the relevance of each category (the first category is the most relevant).  
  
**Important:** This call is not supported in the Sandbox environment. It will return a response payload in which the **categoryName** fields contain random or boilerplate text regardless of the query submitted.
- **categoryTreeId** (string)
  - The unique identifier of the eBay category tree from which suggestions are returned.
- **categoryTreeVersion** (string)
  - The version of the category tree identified by **categoryTreeId**. It's a good idea to cache this value for comparison so you can determine if this category tree has been modified in subsequent calls.

### CategoryTree
**Description:** This type contains information about all nodes of a specified eBay category tree.
**Type:** object

**Properties:**
- **applicableMarketplaceIds** (array)
  - A list of one or more identifiers of the eBay marketplaces that use this category tree.
- **categoryTreeId** (string)
  - The unique identifier of this eBay category tree.
- **categoryTreeVersion** (string)
  - The version of this category tree. It's a good idea to cache this value for comparison so you can determine if this category tree has been modified in subsequent calls.
- **rootCategoryNode** (CategoryTreeNode)
  - Contains details of all nodes of the category tree hierarchy, starting with the root node and down to the leaf nodes. This is a recursive structure.  
  
**Note:** The root node of a full default category tree includes the **categoryId** field, but its value should not be relied upon. It provides no useful information for application development.

### CategoryTreeNode
**Description:** This type contains information about all nodes of a category tree or subtree hierarchy, including and below the specified **Category**, down to the leaf nodes. It is a recursive structure.
**Type:** object

**Properties:**
- **category** (Category)
  - Contains details about the current category tree node.
- **categoryTreeNodeLevel** (integer)
  - The absolute level of the current category tree node in the hierarchy of its category tree.  
  
**Note:** The root node of any full category tree is always at level `**0**`.
- **childCategoryTreeNodes** (array)
  - An array of one or more category tree nodes that are the immediate children of the current category tree node, as well as their children, recursively down to the leaf nodes.  
  
_Returned only if_ the current category tree node is not a leaf node (the value of **leafCategoryTreeNode** is `false`).
- **leafCategoryTreeNode** (boolean)
  - A value of `true` indicates that the current category tree node is a leaf node (it has no child nodes). A value of `false` indicates that the current node has one or more child nodes, which are identified by the **childCategoryTreeNodes** array.  
  
_Returned only if_ the value of this field is `true`.
- **parentCategoryTreeNodeHref** (string)
  - The href portion of the **getCategorySubtree** call that retrieves the subtree below the parent of this category tree node.  
  
_Not returned if_ the current category tree node is the root node of its tree.

### CompatibilityProperty
**Description:** This type is used by the **compatibilityProperties** array that is returned in the **getCompatibilityProperties** call. The **compatibilityProperties** container consists of an array of all compatible vehicle properties applicable to the specified eBay marketplace and eBay category ID.
**Type:** object

**Properties:**
- **name** (string)
  - This is the actual name of the compatible vehicle property as it is known on the specified eBay marketplace and in the eBay category. This is the string value that should be used in the **compatibility\_property** and **filter** query parameters of a **getCompatibilityPropertyValues** request URI.  
  
Typical vehicle properties are 'Make', 'Model', 'Year', 'Engine', and 'Trim', but will vary based on the eBay marketplace and the eBay category.
- **localizedName** (string)
  - This is the localized name of the compatible vehicle property. The language that is used will depend on the user making the call, or based on the language specified if the **Content-Language** HTTP header is used.  
  
In some instances, the string value in this field may be the same as the string in the corresponding **name** field.

### CompatibilityPropertyValue
**Description:** This type is used by the **compatibilityPropertyValues** array that is returned in the **getCompatibilityPropertyValues** response. The **compatibilityPropertyValues** array contains all compatible vehicle property values that match the specified eBay marketplace, specified eBay category, and filters in the request. If the **compatibility\_property** parameter value in the request is 'Trim', each value returned in each **value** field will be a different vehicle trim, applicable to any filters that are set in the filter query parameter of the request, and also based on the eBay marketplace and category specified in the call request.
**Type:** object

**Properties:**
- **value** (string)
  - Each **value** field shows one applicable compatible vehicle property value. The values that are returned will depend on the specified eBay marketplace, specified eBay category, and filters in the request.

### ExpiredCategories
**Description:** This type is used by the **getExpiredCategories** response to indicate any eBay leaf categories in the specified category tree that have expired and the currently active leaf categories that have replaced them.
**Type:** object

**Properties:**
- **expiredCategories** (array)
  - An array of expired category ID(s) for the requested category tree, and the currently active category ID(s) that have replaced them.

### ExpiredCategory
**Description:** This type defines the expired category ID for the requested category tree, and the currently active category ID that has replaced it.
**Type:** object

**Properties:**
- **fromCategoryId** (string)
  - The unique identifier of the expired eBay leaf category.
- **toCategoryId** (string)
  - The unique identifier of the currently active eBay leaf category that has replaced the expired leaf category.  
  
**Note:** More than one **fromCategoryID** value may map into the same **toCategoryID** value, as multiple eBay categories may be consolidated into one new, expanded category.

### GetCategoriesAspectResponse
**Description:** The base response type of the **fetchItemAspects** method.
**Type:** object

**Properties:**
- **categoryTreeId** (string)
  - The unique identifier of the eBay category tree being requested.
- **categoryTreeVersion** (string)
  - The version of the category tree that is returned in the **categoryTreeId** field.
- **categoryAspects** (array)
  - An array of aspects that are appropriate or necessary for accurately describing items in a particular leaf category.

### GetCompatibilityMetadataResponse
**Description:** This type is used by the base response of the **getCompatibilityProperties** method.
**Type:** object

**Properties:**
- **compatibilityProperties** (array)
  - This container consists of an array of all compatible vehicle properties applicable to the specified eBay marketplace and eBay category ID.

### GetCompatibilityPropertyValuesResponse
**Description:** The base response type of the **getCompatibilityPropertyValues** method.
**Type:** object

**Properties:**
- **compatibilityPropertyValues** (array)
  - This array contains all compatible vehicle property values that match the specified eBay marketplace, specified eBay category, and filters in the request. If the **compatibility\_property** parameter value in the request is 'Trim', each value returned in each **value** field will be a different vehicle trim, applicable to any filters that are set in the filter query parameter of the request, and also based on the eBay marketplace and category specified in the call request.

### ItemToAspectCardinalityEnum
**Description:** This enumerated type indicates whether a given aspect can accept single or multiple values for items in a given category. | - **MULTI**: This enum value indicates that multiple values can be specified for this aspect of the category. - **SINGLE**: This enum value indicates that only a single value can be specified for this aspect of the category.
**Type:** object

### RelevanceIndicator
**Description:** The relevance of this aspect. This field is returned if eBay has data on how many searches have been performed for listings in the category using this item aspect.  
  
**Note:** This container is restricted to applications that have been granted permission to access this feature. You must submit an [App Check ticket](https://developer.ebay.com/my/support/tickets?tab=app-check ) to request this access. In the App Check form, add a note to the **Application Title/Summary** and/or **Application Details** fields that you want access to 'Buyer Demand Data' in the Taxonomy API.
**Type:** object

**Properties:**
- **searchCount** (integer)
  - The number of recent searches (based on 30 days of data) for the aspect.

### ValueConstraint
**Description:** This type contains a list of the dependencies that identify when a particular value is available for a given aspect of a given category. Each dependency specifies the values of another aspect of the same category (the _control_ aspect), for which the given value of the given aspect can also be selected by the seller. This container consists of constraint information for the corresponding product aspect value.
**Type:** object

**Properties:**
- **applicableForLocalizedAspectName** (string)
  - The name of the control aspect on which the current aspect value depends.
- **applicableForLocalizedAspectValues** (array)
  - Contains a list of the values of the control aspect on which this aspect's value depends. When the control aspect has any of the specified values, the current value of the current aspect will also be available.

## Rate Limits

See [API Call Limits](https://developer.ebay.com/develop/get-started/api-call-limits) on the eBay Developer Program.

## Resources

### Documentation

- [eBay Developer Program](https://developer.ebay.com/)
- [API Documentation](https://developer.ebay.com/develop/api/)
- [SDKs and Widgets](https://developer.ebay.com/develop/sdks-and-widgets)
- [Developer Community Forum](https://community.ebay.com/t5/Developer-Groups/ct-p/developergroup)

### Tools

- [API Explorer](https://developer.ebay.com/my/api_test_tool)
- [GraphQL Explorer](https://developer.ebay.com/my/graphql_explorer)

### Support

- [Developer Support](https://developer.ebay.com/support/)
- [API Status](https://developer.ebay.com/support/api-status)
- [Release Notes](https://developer.ebay.com/develop/api/release_notes/)

---
*Generated on 2026-04-14T02:05:05.174Z*
