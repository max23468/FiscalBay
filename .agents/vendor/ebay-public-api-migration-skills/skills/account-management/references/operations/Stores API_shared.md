---
title: Stores API
description: "Thie **Stores API** provides stores-related resources for third-party developers. These resources let you retrieve basic store information such as store name, description, store url, return store category hierarchy, add/rename/move/delete a single user's eBay store category, and retrieve the processing status of these tasks. The Stores API resource methods require an access token created with the [authorization code grant](https://developer.ebay.com/api-docs/static/oauth-authorization-code-grant.html) flow. See each method for their respective OAuth scopes."
api_version: 1
api_name: stores_api
api_type: REST
api_group: stores/api
source_url:
  html: https://developer.ebay.com/develop/api/stores/api
  md: https://developer.ebay.com/develop/api/stores/api.md
---
# Stores API API


## Types

### AddStoreCategoryRequestType
**Description:** The base request type of the **addStoreCategory** method. It is used to provide the name and location for the new category.
**Type:** object

**Properties:**
- **categoryName** (string)
  - The seller-specified name of the custom category.  
  
**Maximum Length:** 35
- **destinationParentCategoryId** (string)
  - This field is used to specify the parent category to which the new category belongs. To specify the new category as a top-level category, set the value of this field to -999, or just omit this field, as the default value is -999.  
  
The **getStoreCategories** method can be used to retrieve store category IDs.  
  
**Default: ROOT** category ID **(-999)** if it's null.
- **listingDestinationCategoryId** (string)
  - If the store category specified as the **destinationParentCategoryId** is a leaf category with active listings, those listings are moved to the store category identified through this **listingDestinationCategoryId**. If this field is omitted, the new store category being added under the parent category inherits those listings.  
  
The **getStoreCategories** method can be used to retrieve store category IDs.  
  
**Default:** Newly added category ID if it's null.

### DeleteStoreCategoryRequestType
**Description:** The base request type of the **deleteStoreCategory** method. It is used to provide a new category home for the listings that are currently in the store category to be deleted.
**Type:** object

**Properties:**
- **listingDestinationCategoryId** (string)
  - This field is only needed if the category to be deleted or any of its children categories have one or more active listings. The operation will fail otherwise. All active listings in or under the category to be deleted will be moved to the store category specified in this field.  
  
The **getStoreCategories** method can be used to retrieve store category IDs.  
  
**Default: OTHER** category ID **(1)** if it's null.

### GetStoreCategoriesResponseType
**Description:** The base response type of the **getStoreCategories** method. This type provides the entire category hierarchy for the store.
**Type:** object

**Properties:**
- **storeCategories** (array)
  - An array of top-level categories defined for the eBay store. A childrenCategories array is used for second and third-level categories, if defined for the store.

### GetStoreResponseType
**Description:** The base response type of the **getStore** method. It is used to describe a seller's eBay store and includes the eBay Store name, the description of the store, and the URL to the eBay Store.
**Type:** object

**Properties:**
- **description** (string)
  - The seller-provided description of the eBay Store.  
  
**Maximum length:** 300
- **lastOpenedTime** (string)
  - Indicates the time the store was last opened or reopened.
- **logo** (StoreLogoType)
  - This container provides information about a store logo.
- **name** (string)
  - The name of the eBay store. The name is shown at the top of the store page.  
  
**Maximum length:** 35
- **url** (string)
  - The complete URL of the user's store.
- **urlPath** (string)
  - The relative URL path of the store.  
  
**Maximum length:** 58

### GetStoreTaskResponseType
**Description:** The base response type of the **getStoreTask** method.
**Type:** object

**Properties:**
- **task** (StoreTaskType)
  - This container provides detailed information about the status of the store task.

### GetStoreTasksResponseType
**Description:** The base response type of the **getStoreTasks** method.
**Type:** object

**Properties:**
- **task** (array)
  - This array provides detailed information about the status of one or more store tasks.

### MoveStoreCategoryRequestType
**Description:** The base request type of the **moveStoreCategory** method. It is used to provide the name of the category to be moved and its new location.
**Type:** object

**Properties:**
- **categoryId** (string)
  - The unique identifier of an eBay Store's custom category. eBay auto-generates this identifier when a seller establishes a custom store category. This category ID should not be confused with an eBay category ID. This is the category that is moved.
- **destinationParentCategoryId** (string)
  - This field is the new parent category of the category to be moved. If the category is being moved to level 1 category, set this value to **\-999**.
- **listingDestinationCategoryId** (string)
  - This field is only needed if the category to be moved is a leaf category with listings, but a category that becomes a non-leaf category after the move. The listings of the category to be moved are moved to the category specified in this field.

### RenameStoreCategoryRequestType
**Description:** The base request type of the **renameStoreCategory** method. It is used to rename a customized eBay Store category.
**Type:** object

**Properties:**
- **categoryName** (string)
  - The seller-specified name of the custom category. This is the new name of the category specified through path parameter.  
  
**Maximum Length:** 35

### StoreCategoryType
**Description:** This type is used to provide details about a customized eBay Store category.
**Type:** object

**Properties:**
- **categoryId** (string)
  - Unique identifier of an eBay Store's custom category. eBay auto-generates this identifier when a seller establishes a custom store category. This category ID should not be confused with an eBay category ID.
- **categoryName** (string)
  - The seller-specified name of the custom category.
- **childrenCategories** (array)
  - This array is returned to show second and third-level store categories. eBay Stores support up to three category levels.
- **level** (integer)
  - The level indicates the category level of the category tree.  
  
**Note:** Three levels of store categories are supported. All categories belonging to the same parent should have the same level.
- **order** (integer)
  - The order in which the custom store category appears in the list of store categories when the eBay store is visited.

### StoreLogoType
**Description:** This type is used to provide url of the seller's store logo.
**Type:** object

**Properties:**
- **url** (string)
  - The URL of the seller's store logo.

### StoreTaskStatusEnum
**Description:** This enumerated type is used to provide the processing status of a task. | - **COMPLETED**: The category changes completed successfully. - **FAILED**: The category changes failed. - **PENDING**: The category changes that have not started.
**Type:** object

### StoreTaskType
**Description:** This type is used to provide details about the status of the store task.
**Type:** object

**Properties:**
- **id** (string)
  - The unique identifier of an eBay store task.
- **message** (string)
  - This field provides a textual description on the status of the task and could help the user troubleshoot any issues if there is an issue with eBay creating the task.
- **status** (StoreTaskStatusEnum)
  - The enumeration value here indicates the processing status of the task. See the **StoreTaskStatusEnum** type for more information on supported status values.
- **type** (StoreTaskTypeEnum)
  - The enumeration value indicates the task type.

### StoreTaskTypeEnum
**Description:** This enumerated type is used to provide the kind of store task being performed. | - **ADD_STORE_CATEGORY**: Add a single category to the store. - **MOVE_STORE_CATEGORY**: Move a single category from one place in the store category structure to another. - **DELETE_STORE_CATEGORY**: Delete a single category from the store.
**Type:** object

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
*Generated on 2026-04-14T02:06:53.286Z*
