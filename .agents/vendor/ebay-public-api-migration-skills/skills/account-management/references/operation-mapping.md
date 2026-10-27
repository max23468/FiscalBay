# Account Management Operation Mapping

## Identity And User Profile

### GetUser -> user / getUser
Purpose:

- Retrieve account-profile information for an eBay user, including seller and identity details when scope and access allow it.

Modern API:

- GraphQL query `user` in the User API.
- REST `GET /commerce/identity/v1/user/` in the Identity API.

Key Differences:

- The traditional SOAP call can retrieve the caller's own user data or, with constrained conditions, another user's details. Modern GraphQL and Identity flows are strongly OAuth-scope-driven.
- GraphQL `user` is selection-set based and can return structured business or individual identity containers.
- Identity REST `getUser` is authenticated-user oriented and returns the account profile through a fixed REST resource.
- The bundled REST example now includes both an `INDIVIDUAL` variant and a `BUSINESS` variant, making the scope-shaped response split explicit in the support files.

Request Payload Transformation:

- Traditional: [GetUser_example.md](operations/GetUser_example.md)
- Modern: [createOrReplaceUserNote_example.md](operations/createOrReplaceUserNote_example.md), [deleteUserNote_example.md](operations/deleteUserNote_example.md), [user_example.md](operations/user_example.md), [getUser_rest_example.md](operations/getUser_rest_example.md)




Response Payload Transformation:

- Traditional: [GetUser_example.md](operations/GetUser_example.md)
- Modern: [createOrReplaceUserNote_example.md](operations/createOrReplaceUserNote_example.md), [deleteUserNote_example.md](operations/deleteUserNote_example.md), [user_example.md](operations/user_example.md), [getUser_rest_example.md](operations/getUser_rest_example.md)




Migration Guide:

- user query of User API
  **Key behaviors/changes**:

  *   Data may only be retrieved for the eBay user associated with OAuth token
  *   More extensive data returned for Business account users
  *   Returned data is controlled by different OAuth scopes
  *   Feedback metrics, Feature Eligibility, Scheduling Info, Seller Payment Address, and Top Rated Seller info not being migrated

- getUser method of Identity API
  **Key behaviors/changes**:

  *   Data may only be retrieved for the eBay user associated with OAuth token
  *   More extensive data returned for Business account users
  *   Returned data is controlled by different OAuth scopes
  *   Less extensive data returned than user query of User API

References:

- Full traditional doc extract: `references/operations/GetUser_doc.md`
- Full modern GraphQL doc extract: `references/operations/user_doc.md`
- Full modern GraphQL example: `references/operations/user_example.md`
- Full modern REST doc extract: `references/operations/getUser_rest_doc.md`
- Full modern REST example with individual and business variants: `references/operations/getUser_rest_example.md`

### GetUserContactDetails -> No replacement
Purpose:

- Retrieve another eBay user's contact details in the limited traditional cases where traditional permitted that data to be returned.

Modern API:

- No validated modern replacement.

Key Differences:

- The CSV explicitly states that retrieving another user's PII is not supported in modern APIs.
- Preserve the `No replacement` outcome instead of proposing a substitute.

Migration Guide:

- **None**; to be decommissioned

This call retrieves Personally Identifiable Information (PII) for another eBay user, and that will not be supported.in modern APIs

References:

- Full traditional doc extract: `references/operations/GetUserContactDetails_doc.md`

## Preference And Account Settings

### GetUserPreferences -> getUserPreferences
Purpose:

- Retrieve seller account and preference settings for the authenticated caller.

Modern API:

- REST `GET /sell/account/v2/user_preferences`

Key Differences:

- Traditional SOAP retrieval is flag-driven and returns only the preference groups explicitly requested.
- Modern REST returns a JSON preferences object; use `fieldgroups=ALL` to retrieve the full supported set.

Request Payload Transformation:

- Traditional: [GetUserPreferences_example.md](operations/GetUserPreferences_example.md)
- Modern: [getUserPreferences_rest_example.md](operations/getUserPreferences_rest_example.md)

The traditional call uses many boolean `Show*` flags to select which preference groups are returned. Only groups with a corresponding flag set to `true` are included in the response.

Example request (fields taken from the bundled traditional doc page):

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetUserPreferencesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ShowBidderNoticePreferences>true</ShowBidderNoticePreferences>
  <ShowCombinedPaymentPreferences>true</ShowCombinedPaymentPreferences>
  <ShowDispatchCutoffTimePreferences>true</ShowDispatchCutoffTimePreferences>
  <ShoweBayPLUSPreference>true</ShoweBayPLUSPreference>
  <ShowEmailShipmentTrackingNumberPreference>true</ShowEmailShipmentTrackingNumberPreference>
  <ShowEndOfAuctionEmailPreferences>true</ShowEndOfAuctionEmailPreferences>
  <ShowGlobalShippingProgramListingPreference>true</ShowGlobalShippingProgramListingPreference>
  <ShowGlobalShippingProgramPreference>true</ShowGlobalShippingProgramPreference>
  <ShowOutOfStockControlPreference>true</ShowOutOfStockControlPreference>
  <ShowOverrideGSPServiceWithIntlServicePreference>true</ShowOverrideGSPServiceWithIntlServicePreference>
  <ShowPickupDropoffPreferences>true</ShowPickupDropoffPreferences>
  <ShowPurchaseReminderEmailPreferences>true</ShowPurchaseReminderEmailPreferences>
  <ShowRequiredShipPhoneNumberPreference>true</ShowRequiredShipPhoneNumberPreference>
  <ShowSellerExcludeShipToLocationPreference>true</ShowSellerExcludeShipToLocationPreference>
  <ShowSellerFavoriteItemPreferences>true</ShowSellerFavoriteItemPreferences>
  <ShowSellerPaymentPreferences>true</ShowSellerPaymentPreferences>
  <ShowSellerProfilePreferences>true</ShowSellerProfilePreferences>
  <ShowSellerReturnPreferences>true</ShowSellerReturnPreferences>
  <ShowUnpaidItemAssistanceExclusionList>true</ShowUnpaidItemAssistanceExclusionList>
  <ShowUnpaidItemAssistancePreference>true</ShowUnpaidItemAssistancePreference>
</GetUserPreferencesRequest>
```


Response Payload Transformation:

- Traditional: [GetUserPreferences_example.md](operations/GetUserPreferences_example.md)
- Modern: [getUserPreferences_rest_example.md](operations/getUserPreferences_rest_example.md)

- SOAP returns selected preference containers (based on `Show*` flags).

Example is validated by the bundled usage example:

```json
{
  "combinedPaymentPreferences": {
    "combinedPaymentOption": "DISCOUNT_SPECIFIED"
  },
  "shippingCarrierRatePreferences": {
    "upsRateOption": "UPS_ON_DEMAND_RATES",
    "fedexRateOption": "FEDEX_COUNTER"
  },
  "endOfAuctionEmailPreferences": {
    "templateText": "template Text test ",
    "logoUrl": "http://end*********/****/i***e.jpg",
    "emailCustomized": true,
    "textCustomized": true,
    "logoCustomized": false
  },
  "emailShipmentTrackingNumberPreference": false,
  "requiredShipPhoneNumberPreference": true,
  "itemsAwaitingPaymentPreferences": {
    "delayBeforeCancellingCommitment": 32,
    "optInStatus": true,
    "autoRelist": true,
    "excludedUsers": [
      "p************1"
    ]
  },
  "sellerExcludeShipToLocationPreferences": {
    "excludeShipToLocations": [
      "Invalid"
    ]
  },
  "purchaseReminderEmailPreferences": true,
  "sellerProfilePreferences": {
    "sellerProfileOptedIn": true
  },
  "offerGlobalShippingProgramPreference": false,
  "dispatchCutoffTimePreference": {
    "cutoffTime": "06:00:00.000Z"
  },
  "globalShippingProgramListingPreference": false,
  "overrideGspServiceWithIntlServicePreference": false,
  "pickupDropoffSellerPreference": false,
  "outOfStockControlPreference": true
}
```

Key field renames (SOAP → REST):

| Traditional SOAP field | Modern REST field |
|---|---|
| `UnpaidItemAssistancePreferences` | `itemsAwaitingPaymentPreferences` |
| `DelayBeforeOpeningDispute` | `delayBeforeCancellingCommitment` |
| `ExcludedUser` (repeating XML element) | `excludedUsers` (JSON array) |
| `SellerPaymentPreferences` | `shippingCarrierRatePreferences` |

Migration Guide:

- getUserPreferences method of Account API v2
  **Key behaviors/changes**:

  *   The default behavior is to retrieve all seller preferences. The boolean fields in traditional API call are replaced by a fieldgroups query parameter that supports multiple comma-delimited values.
  *   The ShowBidderNoticePreferences boolean will not be migrated as feature is no longer supported.
  *   The ShoweBayPLUSPreference boolean will not be migrated as seller no longer has control over eBay Plus eligibility.
  *   The ShowSellerFavoriteItemPreferences boolean will not be migrated as feature is no longer supported.
  *   The ShowSellerPaymentPreferences boolean field will be repurposed and renamed to shippingCarrierRatePreferences as traditional payment method preferences are no longer applicable with eBay-managed payments, but FedEx and UPS shipping rate options still apply.
  *   The ShowSellerProfilePreferences boolean will be migrated, but only the Business Policies opt-in boolean field will be returned and not individual business policies. The **Account v1 API** can be used to retrieve individual business policies.
  *   The ShowSellerReturnPreferences boolean will not be migrated as opt-in to eBay-manager returns is no longer optional.

References:

- Full traditional doc extract: `references/operations/GetUserPreferences_doc.md`
- Full modern doc extract: `references/operations/getUserPreferences_rest_doc.md`
- Full modern example: `references/operations/getUserPreferences_rest_example.md`

### SetUserPreferences -> setUserPreferences
Purpose:

- Update seller account and preference settings for the authenticated caller.

Modern API:

- REST `PATCH /sell/account/v2/user_preferences`

Key Differences:

- Traditional SOAP updates preference groups in one traditional call.
- The modern mapping now has a method-specific bundled REST doc page and usage example that validate the request payload shape and `204 No Content` success behavior.

Request Payload Transformation:

- Traditional: [SetUserPreferences_example.md](operations/SetUserPreferences_example.md)
- Modern: [setUserPreferences_rest_example.md](operations/setUserPreferences_rest_example.md)

Example request (fields taken from the bundled traditional doc page):

```xml
<?xml version="1.0" encoding="utf-8"?>
<SetUserPreferencesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <GlobalShippingProgramListingPreference>true</GlobalShippingProgramListingPreference>
  <OutOfStockControlPreference>true</OutOfStockControlPreference>
</SetUserPreferencesRequest>
```


Response Payload Transformation:

- Traditional: [SetUserPreferences_example.md](operations/SetUserPreferences_example.md)
- Modern: [setUserPreferences_rest_example.md](operations/setUserPreferences_rest_example.md)



Migration Guide:

- setUserPreferences method of Account API v2
  **Key behaviors/changes**:

  *   The name of UnpaidItemAssistancePreferences container changed to itemsAwaitingPaymentPreferences as Unpaid Item cases no longer exist.
  *   The name of SellerPaymentPreferences container changed to shippingCarrierRatePreferences since only shipping carrier rates are controlled by seller.
  *   The BidderNoticePreferences container will not be migrated as the feature is no longer supported.
  *   The OverrideGSPserviceWithIntlService container will not be migrated as the preference is no longer supported.
  *   The SellerFavoriteItemPreferences container will not be migrated as the feature is no longer supported.

References:

- Full traditional doc extract: `references/operations/SetUserPreferences_doc.md`
- Full modern doc extract: `references/operations/setUserPreferences_rest_doc.md`
- Full modern example: `references/operations/setUserPreferences_rest_example.md`

## Store Profile And Category Management

### GetStore -> getStore / getStoreCategories
Purpose:

- Retrieve store profile information and store-category hierarchy for the seller's eBay Store.

Modern API:

- REST `GET /sell/stores/v1/store`
- REST `GET /sell/stores/v1/store/categories`

Key Differences:

- One traditional call becomes two read paths in the Stores API.
- Modern store profile data and category hierarchy are separated into different resources.

Request Payload Transformation:

- Traditional: [GetStore_example.md](operations/GetStore_example.md)
- Modern: [getStore_rest_example.md](operations/getStore_rest_example.md), [getStoreCategories_example.md](operations/getStoreCategories_example.md)

Example request (from bundled traditional doc page):

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetStoreRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <LevelLimit>1</LevelLimit>
</GetStoreRequest>
```


Response Payload Transformation:

- Traditional: [GetStore_example.md](operations/GetStore_example.md)
- Modern: [getStore_rest_example.md](operations/getStore_rest_example.md), [getStoreCategories_example.md](operations/getStoreCategories_example.md)

Example response fields (from the bundled traditional doc extract):

```xml
<GetStoreResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Store>
    <Name>string</Name>
    <Description>string</Description>
    <LastOpenedTime>dateTime</LastOpenedTime>
    <Logo>
      <URL>anyURI</URL>
    </Logo>
    <URL>anyURI</URL>
    <URLPath>string</URLPath>
    <CustomCategories>
      <CustomCategory>
        <CategoryID>long</CategoryID>
        <Name>string</Name>
        <Order>int</Order>
      </CustomCategory>
    </CustomCategories>
  </Store>
</GetStoreResponse>
```


Migration Guide:
- GetStore (Retrieve name, description, logo, URL, and last opened time) -> getStore method of Stores API
- GetStore (Retrieve the full eBay store category hierarchy.) -> getStoreCategories method of Stores API

References:

- Full traditional doc extract: `references/operations/GetStore_doc.md`
- Full modern doc extracts: `references/operations/getStore_rest_doc.md`, `references/operations/getStoreCategories_doc.md`
- Full modern examples: `references/operations/getStore_rest_example.md`, `references/operations/getStoreCategories_example.md`

### GetStoreCategoryUpdateStatus -> getStoreTask / getStoreTasks
Purpose:

- Check the processing status of store-category update tasks.

Modern API:

- REST `GET /sell/stores/v1/store/tasks/{task_id}`
- REST `GET /sell/stores/v1/store/tasks`

Key Differences:

- Traditional status retrieval maps cleanly into task-by-id and task-collection reads.
- Modern task resources expose asynchronous processing as first-class Stores API behavior.

Request Payload Transformation:

- Traditional: [GetStoreCategoryUpdateStatus_example.md](operations/GetStoreCategoryUpdateStatus_example.md)
- Modern: [getStoreTask_example.md](operations/getStoreTask_example.md), [getStoreTasks_example.md](operations/getStoreTasks_example.md)



Response Payload Transformation:

- Traditional: [GetStoreCategoryUpdateStatus_example.md](operations/GetStoreCategoryUpdateStatus_example.md)
- Modern: [getStoreTask_example.md](operations/getStoreTask_example.md), [getStoreTasks_example.md](operations/getStoreTasks_example.md)



Migration Guide:

- getStoreTask method of Stores API

  **Key behaviors/changes**:

  *   A **taskId** value is returned in the **Location** response header for an add, move, rename, and delete operation and getStoreTask takes this ID as a path parameter.
  *   getStoreTasks is an additional method that returns all recent completed, pending and failed tasks

References:

- Full traditional doc extract: `references/operations/GetStoreCategoryUpdateStatus_doc.md`
- Full modern doc extracts: `references/operations/getStoreTask_doc.md`, `references/operations/getStoreTasks_doc.md`
- Full modern examples: `references/operations/getStoreTask_example.md`, `references/operations/getStoreTasks_example.md`

### SetStoreCategories -> addStoreCategory / moveStoreCategory / renameStoreCategory / deleteStoreCategory
Purpose:

- Change the seller's store-category hierarchy by adding, moving, renaming, or deleting store categories.

Modern API:

- REST `addStoreCategory`
- REST `moveStoreCategory`
- REST `renameStoreCategory`
- REST `deleteStoreCategory`

Key Differences:

- The traditional `Action` field becomes separate action-specific REST operations.
- Large category changes may still become asynchronous tasks that require later status checks.

Request Payload Transformation:

- Traditional: [SetStoreCategories_example.md](operations/SetStoreCategories_example.md)
- Modern: [addStoreCategory_example.md](operations/addStoreCategory_example.md), [moveStoreCategory_example.md](operations/moveStoreCategory_example.md), [renameStoreCategory_example.md](operations/renameStoreCategory_example.md), [deleteStoreCategory_example.md](operations/deleteStoreCategory_example.md)


**REST (after) — Add category:**

```http
POST https://api.ebay.com/sell/stores/v1/store/categories
Content-Type: application/json

{
    "categoryName": "cat_1*1",
    "destinationParentCategoryId": "1*3",
    "listingDestinationCategoryId": "4*6"
}
```

**REST (after) — Move category:**

```http
POST https://api.ebay.com/sell/stores/v1/store/categories/move_category
Content-Type: application/json

{
    "categoryId": "3***1",
    "destinationParentCategoryId": "4*****1",
    "listingDestinationCategoryId": "1******1"
}
```

**REST (after) — Rename category:**

```http
PUT https://api.ebay.com/sell/stores/v1/store/categories/1***8
Content-Type: application/json

{
    "categoryName": "TechnoGadgets"
}
```

**REST (after) — Delete category:**

```http
DELETE https://api.ebay.com/sell/stores/v1/store/categories/1**1
Content-Type: application/json

{
    "listingDestinationCategoryId": "2*****2"
}
```

Response Payload Transformation:

- Traditional: [SetStoreCategories_example.md](operations/SetStoreCategories_example.md)
- Modern: [addStoreCategory_example.md](operations/addStoreCategory_example.md), [moveStoreCategory_example.md](operations/moveStoreCategory_example.md), [renameStoreCategory_example.md](operations/renameStoreCategory_example.md), [deleteStoreCategory_example.md](operations/deleteStoreCategory_example.md)


- All four operations return the **getStoreTask** URI in the `Location` response header (e.g., `/sell/stores/v1/store/tasks/{taskId}`).
- Call `getStoreTask` or `getStoreTasks` to poll for the task status. Sample response from `getStoreTask` is documented in `references/operations/getStoreTask_example.md`.
- No JSON body is returned in the initial response for add/move/delete; rename is also asynchronous and follows the same pattern.

Migration Guide:

- addStoreCategory method of Stores API

  **Key behaviors/changes**:

  *   The destinationParentCategoryId field is used to specify the parent store category that the new category will belong to. If this field is omitted, the new category becomes a top-level store category
  *   The listingDestinationCategoryId field is needed if the specified parent category is a leaf category with active listings, and those active listings will be moved to the category specified here. If this field is omitted, the active listings in the parent category move to the new category
  *   This operation is processed asynchronously and a getStoreTask URI with the task ID is returned in the Location response header so that the user can check status after the add operation

- moveStoreCategory method of Stores API

  **Key behaviors/changes**:

  *   The destinationParentCategoryId field is used to specify the parent store category that the category will move to. If this field is omitted, the category becomes a top-level store category
  *   The listingDestinationCategoryId field is needed if the category being moved is a leaf category with active listings but will become a non-leaf category after this move. Those active listings will be moved to the category specified here.
  *   This operation is processed asynchronously and a getStoreTask URI with the task ID is returned in the Location response header so that the user can check status after the move operation

- renameStoreCategory method of Stores API

  **Key behaviors/changes**:

  *   The store category to rename is specified through the **category_id** path parameter
  *   The new name of the category is specified through the categoryName field
  *   This name change is processed synchronously if the operation is successful

- deleteStoreCategory method of Stores API

  **Key behaviors/changes**:

  *   The store category to delete is specified through the **category_id** path parameter
  *   The listingDestinationCategoryId field is needed if the category being deleted or any existing child categories are leaf categories with active listings. Those active listings will be moved to the category specified here.
  *   This operation is processed asynchronously and a getStoreTask URI with the task ID is returned in the **Location** response header so that the user can check status after the move operation

References:

- Full traditional doc extract: `references/operations/SetStoreCategories_doc.md`
- Full modern doc extracts: `references/operations/addStoreCategory_doc.md`, `references/operations/moveStoreCategory_doc.md`, `references/operations/renameStoreCategory_doc.md`, `references/operations/deleteStoreCategory_doc.md`
- Full modern examples: `references/operations/addStoreCategory_example.md`, `references/operations/moveStoreCategory_example.md`, `references/operations/renameStoreCategory_example.md`, `references/operations/deleteStoreCategory_example.md`

## Billing And Tax Settings

### GetAccount -> getBillingActivities / getTransactions
Purpose:

- Retrieve seller account billing data, invoice-adjacent records, and transaction detail.

Modern API:

- REST `GET /sell/finances/v1/billing_activity`
- REST `GET /sell/finances/v1/transaction`

Key Differences:

- One traditional call is split between billing-activity views and detailed transaction-ledger views.
- Modern finance retrieval is REST and can require digital signatures for EU/UK domiciled sellers.

Request Payload Transformation:

- Traditional: [GetAccount_example.md](operations/GetAccount_example.md)
- Modern: [getBillingActivities_example.md](operations/getBillingActivities_example.md), [getTransactions_example.md](operations/getTransactions_example.md)



Response Payload Transformation:

- Traditional: [GetAccount_example.md](operations/GetAccount_example.md)
- Modern: [getBillingActivities_example.md](operations/getBillingActivities_example.md), [getTransactions_example.md](operations/getTransactions_example.md)



Migration Guide:

- getBillingActivities method of Finances API
  **Key behaviors/changes**:

  *   Can filter by order ID, listing ID, and/or date range.
  *   The getTransactions method of Finances API can also be used to retrieve listing fees.
  *   Fees can only be sorted by transaction date in descending or ascending order.

References:

- Full traditional doc extract: `references/operations/GetAccount_doc.md`
- Full modern doc extracts: `references/operations/getBillingActivities_doc.md`, `references/operations/getTransactions_doc.md`
- Full modern examples: `references/operations/getBillingActivities_example.md`, `references/operations/getTransactions_example.md`

### GetTaxTable -> getSalesTax / getSalesTaxes
Purpose:

- Retrieve the seller's configured sales-tax settings for one jurisdiction or for all jurisdictions in a country.

Modern API:

- REST `GET /sell/account/v1/sales_tax/{countryCode}/{jurisdictionId}`
- REST `GET /sell/account/v1/sales_tax?country_code=<country>`

Key Differences:

- One traditional tax-table retrieval splits into a jurisdiction-level read and a country-table read.
- The source bundle includes method-specific REST doc extracts and usage examples for both mapped reads.

Request Payload Transformation:

- Traditional: [GetTaxTable_example.md](operations/GetTaxTable_example.md)
- Modern: [getSalesTax_example.md](operations/getSalesTax_example.md), [getSalesTaxes_example.md](operations/getSalesTaxes_example.md)



Response Payload Transformation:

- Traditional: [GetTaxTable_example.md](operations/GetTaxTable_example.md)
- Modern: [getSalesTax_example.md](operations/getSalesTax_example.md), [getSalesTaxes_example.md](operations/getSalesTaxes_example.md)



Migration Guide:

- getSalesTaxes method of Account v1 API
  **Key behaviors/changes**:

  *   Instead of a Site ID header value, an ISO Country Code is passed in through the country_code query parameter.
  *   Only 5 US territories and Canadian provinces support seller-provided sales tax rates, so only values supported in country_code are US and CA.
  *   getSalesTax method of Account v1 API can get sales tax rate settings for a specific tax jurisdiction by passing in a {countryCode) value and a (jurisdictionId} value.

References:

- Full traditional doc extract: `references/operations/GetTaxTable_doc.md`
- Full modern doc extracts: `references/operations/getSalesTax_doc.md`, `references/operations/getSalesTaxes_doc.md`
- Full modern examples: `references/operations/getSalesTax_example.md`, `references/operations/getSalesTaxes_example.md`

### SetTaxTable -> bulkCreateOrReplaceSalesTax / createOrReplaceSalesTax
Purpose:

- Configure or update the seller's sales-tax settings across one or more jurisdictions.

Modern API:

- REST `POST /sell/account/v1/bulk_create_or_replace_sales_tax`
- REST `PUT /sell/account/v1/sales_tax/{countryCode}/{jurisdictionId}`

Key Differences:

- The traditional write flow splits into a bulk update path and a single-jurisdiction update path.
- The bundled source set includes method-specific REST doc extracts and usage examples for both the bulk and single-jurisdiction write paths.

Request Payload Transformation:

- Traditional: [SetTaxTable_example.md](operations/SetTaxTable_example.md)
- Modern: [bulkCreateOrReplaceSalesTax_example.md](operations/bulkCreateOrReplaceSalesTax_example.md), [createOrReplaceSalesTax_example.md](operations/createOrReplaceSalesTax_example.md)



Response Payload Transformation:

- Traditional: [SetTaxTable_example.md](operations/SetTaxTable_example.md)
- Modern: [bulkCreateOrReplaceSalesTax_example.md](operations/bulkCreateOrReplaceSalesTax_example.md), [createOrReplaceSalesTax_example.md](operations/createOrReplaceSalesTax_example.md)



Migration Guide:

- createOrReplaceSalesTax method of Account v1 API

  **Key behaviors/changes**:

  *   The {countryCode) and (jurisdictionId} path parameters identify the tax jurisdiction where sales tax settings will be added or modified.
  *   The getSalesTaxJurisdiction method of the Metadata API can be used to retrieve valid tax jurisdictions for US or Canada
  *   The two request fields, salesTaxPercentage and shippingAndHandlingTaxed, must be included even if one of the field's value may not be changing

- bulkCreateOrReplaceSalesTax method of Account v1 API

  **Key behaviors/changes**:

  *   A separate node under the salesTaxInputList array is needed for each tax jurisdiction that will get new or modified sales tax settings
  *   The countryCode field identifies the country and the salesTaxJurisdictionId field identifies the tax jurisdiction where sales tax settings will be added or modified.
  *   The getSalesTaxJurisdiction method of the Metadata API can be used to retrieve valid tax jurisdictions for US or Canada
  *   The two other request fields, salesTaxPercentage and shippingAndHandlingTaxed, must be included even if one of the field's value may not be changing

References:

- Full traditional doc extract: `references/operations/SetTaxTable_doc.md`
- Full modern doc extracts: `references/operations/bulkCreateOrReplaceSalesTax_doc.md`, `references/operations/createOrReplaceSalesTax_doc.md`
- Full modern examples: `references/operations/bulkCreateOrReplaceSalesTax_example.md`, `references/operations/createOrReplaceSalesTax_example.md`

## Shipping Discount Programs

### GetShippingDiscountProfiles -> getCombinedShippingRules
Purpose:

- Retrieve the seller's configured shipping-discount profiles and combined-shipping settings.

Modern API:

- REST `GET /sell/account/v2/combined_shipping_rules`

Key Differences:

- The traditional discount-profile read maps to a combined-shipping-rules resource in Account API v2.
- The bundled source set includes a method-specific modern doc extract and a usage example for the combined-shipping read.

Request Payload Transformation:

- Traditional: [GetShippingDiscountProfiles_example.md](operations/GetShippingDiscountProfiles_example.md)
- Modern: [getCombinedShippingRules_example.md](operations/getCombinedShippingRules_example.md)



Response Payload Transformation:

- Traditional: [GetShippingDiscountProfiles_example.md](operations/GetShippingDiscountProfiles_example.md)
- Modern: [getCombinedShippingRules_example.md](operations/getCombinedShippingRules_example.md)



Migration Guide:

- getCombinedShippingRules method of Account API v2
  **Key behaviors/changes**:

  *   Instead of a Site ID header value, the eBay marketplace is passed in through the **X-EBAY-C-MARKETPLACE-ID** header.
  *   With the exception of the name change from Discount Profile to Shipping Rule, the data returned in the new method is very similar to GetShippingDiscountProfiles.

References:

- Full traditional doc extract: `references/operations/GetShippingDiscountProfiles_doc.md`
- Full modern doc extract: `references/operations/getCombinedShippingRules_doc.md`
- Full modern example: `references/operations/getCombinedShippingRules_example.md`

### SetShippingDiscountProfiles -> createCalculatedShippingRules / createFlatShippingRules / createPromotionalShippingRule / updateCalculatedShippingRules / updateCombinedPayments / updateFlatShippingRules / updatePromotionalShippingRule
Purpose:

- Create, update, or otherwise maintain shipping-discount and combined-payment rules for the seller account.

Modern API:

- REST `createCalculatedShippingRules`
- REST `createFlatShippingRules`
- REST `createPromotionalShippingRule`
- REST `updateCalculatedShippingRules`
- REST `updateCombinedPayments`
- REST `updateFlatShippingRules`
- REST `updatePromotionalShippingRule`

Key Differences:

- One traditional profile-maintenance call splits by rule type and by action.
- The source bundle now includes method-specific REST doc pages and usage examples for each combined-shipping write operation.

Request Payload Transformation:

- Traditional: [SetShippingDiscountProfiles_example.md](operations/SetShippingDiscountProfiles_example.md)
- Modern: [createCalculatedShippingRules_example.md](operations/createCalculatedShippingRules_example.md), [createFlatShippingRules_example.md](operations/createFlatShippingRules_example.md), [createPromotionalShippingRule_example.md](operations/createPromotionalShippingRule_example.md), [updateCalculatedShippingRules_example.md](operations/updateCalculatedShippingRules_example.md), [updateCombinedPayments_example.md](operations/updateCombinedPayments_example.md), [updateFlatShippingRules_example.md](operations/updateFlatShippingRules_example.md), [updatePromotionalShippingRule_example.md](operations/updatePromotionalShippingRule_example.md)



Response Payload Transformation:

- Traditional: [SetShippingDiscountProfiles_example.md](operations/SetShippingDiscountProfiles_example.md)
- Modern: [createCalculatedShippingRules_example.md](operations/createCalculatedShippingRules_example.md), [createFlatShippingRules_example.md](operations/createFlatShippingRules_example.md), [createPromotionalShippingRule_example.md](operations/createPromotionalShippingRule_example.md), [updateCalculatedShippingRules_example.md](operations/updateCalculatedShippingRules_example.md), [updateCombinedPayments_example.md](operations/updateCombinedPayments_example.md), [updateFlatShippingRules_example.md](operations/updateFlatShippingRules_example.md), [updatePromotionalShippingRule_example.md](operations/updatePromotionalShippingRule_example.md)



Migration Guide:

- createCalculatedShippingRules method of Account API v2
  **Key behaviors/changes**:

  *   Instead of a Site ID header value, the eBay marketplace is passed in through the **X-EBAY-C-MARKETPLACE-ID** header.
  *   With the exception of the name change from Discount Profile to Shipping Rule, the request data in the new method is very similar to SetShippingDiscountProfiles for calculated shipping discounts.

- createFlatShippingRules method of Account API v2
  **Key behaviors/changes**:

  *   Instead of a Site ID header value, the eBay marketplace is passed in through the **X-EBAY-C-MARKETPLACE-ID** header.
  *   With the exception of the name change from Discount Profile to Shipping Rule, the request data in the new method is very similar to SetShippingDiscountProfiles for flat shipping discounts.

- createPromotionalShippingRule method of Account API v2
  **Key behaviors/changes**:

  *   Instead of a Site ID header value, the eBay marketplace is passed in through the **X-EBAY-C-MARKETPLACE-ID** header.
  *   With the exception of the name change from Discount Profile to Shipping Rule, the request data in the new method is very similar to SetShippingDiscountProfiles for promotional shipping discounts.

- updateCalculatedShippingRules method of Account API v2
  **Key behaviors/changes**:

  *   Instead of a Site ID header value, the eBay marketplace is passed in through the **X-EBAY-C-MARKETPLACE-ID** header.
  *   The shipping rule(s) to update are identified through the combinedShippingRuleId field.
  *   This method is a complete replacement, so all applicable fields should be passed in even if their values are not changing.
  *   With the exception of the name change from Discount Profile to Shipping Rule, the request data in the new method is very similar to SetShippingDiscountProfiles for calculated shipping discounts.

- updateFlatShippingRules method of Account API v2
  **Key behaviors/changes**:

  *   Instead of a Site ID header value, the eBay marketplace is passed in through the **X-EBAY-C-MARKETPLACE-ID** header.
  *   The shipping rule(s) to update are identified through the combinedShippingRuleId field.
  *   This method is a complete replacement, so all applicable fields should be passed in even if their values are not changing.
  *   With the exception of the name change from Discount Profile to Shipping Rule, the request data in the new method is very similar to SetShippingDiscountProfiles for flat shipping discounts.

- updatePromotionalShippingRule method of Account API v2
  **Key behaviors/changes**:

  *   Instead of a Site ID header value, the eBay marketplace is passed in through the **X-EBAY-C-MARKETPLACE-ID** header.
  *   This method is a complete replacement, so all applicable fields should be passed in even if their values are not changing.
  *   With the exception of the name change from Discount Profile to Shipping Rule, the request data in the new method is very similar to SetShippingDiscountProfiles for promotional shipping discounts.

- updateCombinedPayments method of Account API v2
  **Key behaviors/changes**:

  *   Instead of a Site ID header value, the eBay marketplace is passed in through the **X-EBAY-C-MARKETPLACE-ID** header.

References:

- Full traditional doc extract: `references/operations/SetShippingDiscountProfiles_doc.md`
- Full modern doc extracts: `references/operations/createCalculatedShippingRules_doc.md`, `references/operations/createFlatShippingRules_doc.md`, `references/operations/createPromotionalShippingRule_doc.md`, `references/operations/updateCalculatedShippingRules_doc.md`, `references/operations/updateCombinedPayments_doc.md`, `references/operations/updateFlatShippingRules_doc.md`, `references/operations/updatePromotionalShippingRule_doc.md`
- Full modern examples: `references/operations/createCalculatedShippingRules_example.md`, `references/operations/createFlatShippingRules_example.md`, `references/operations/createPromotionalShippingRule_example.md`, `references/operations/updateCalculatedShippingRules_example.md`, `references/operations/updateCombinedPayments_example.md`, `references/operations/updateFlatShippingRules_example.md`, `references/operations/updatePromotionalShippingRule_example.md`

## Bidder And Buying Activity

### GetAllBidders -> itemBiddingActivity
Purpose:

- Retrieve bidder activity for one active or recently ended auction listing.

Modern API:

- GraphQL query `itemBiddingActivity` in the Auction API (per authoritative CSV mapping).

Key Differences:

- The traditional call is auction-listing scoped and exposes seller-focused bidder details through a traditional response container, while the modern query returns auction data under a GraphQL object graph.
- Bid histories are split into active, cancelled, and retracted bid collections, each with pagination controls.
- OAuth scopes and requested selection sets control how much bidder detail is returned, rather than traditional-era include flags.

Request Payload Transformation:

- Traditional: [GetAllBidders_example.md](operations/GetAllBidders_example.md)
- Modern: [itemBiddingActivity_example.md](operations/itemBiddingActivity_example.md)

Response Payload Transformation:

- Traditional: [GetAllBidders_example.md](operations/GetAllBidders_example.md)
- Modern: [itemBiddingActivity_example.md](operations/itemBiddingActivity_example.md)

Related Patterns:

- [operations/GetAllBidders_doc.md](operations/GetAllBidders_doc.md)
- [operations/itemBiddingActivity_doc.md](operations/itemBiddingActivity_doc.md)
- [operations/itemBiddingActivity_example.md](operations/itemBiddingActivity_example.md)

Migration Guide:

- **itemBiddingActivity** query of **Auction API**
- Key things to know about `itemBiddingActivity` query:
  - The modern API family here is the Auction API, and answers should name that family explicitly when mapping `GetAllBidders`.
  - This query can be used by any eBay user, but the owner of the listing will get the most extensive data returned in the response.
  - The **itemId** field is used to identify the auction item for which to retrieve bidding activity.
  - This query **does not have** equivalent fields to the `IncludeBiddingSummary` and `CallMode` fields in `GetAllBidders`, but the data to be retrieved in all GraphQL queries can be fully customized, so a user will just specify the objects they'd like to see in the response, including **activeBidHistoryRecords**, **cancelledBidHistoryRecords**, etc.
  - The data available to return is controlled by OAuth scopes. See the documentation for more information.

### GetBidderList -> userBiddingActivity
Purpose:

- Retrieve items the user is currently bidding on, and items the user has won or purchased.

Modern API:

- GraphQL query `userBiddingActivity` in the Auction API (per authoritative CSV mapping).

Key Differences:

- Traditional `GetBidderList` returns a large `BidItemArray` with optional end-time filters and a `GranularityLevel` control.
- Modern GraphQL is selection-set based; you choose the fields you need.

Request Payload Transformation:

- Traditional: [GetBidderList_example.md](operations/GetBidderList_example.md)
- Modern: [userBiddingActivity_example.md](operations/userBiddingActivity_example.md)

- See traditional doc extract for the full request shape, including filters like `ActiveItemsOnly`, end-time range, and pagination.

- See modern GraphQL schema/doc for the supported `userBiddingActivity` inputs and pagination model.

Response Payload Transformation:

- Traditional: [GetBidderList_example.md](operations/GetBidderList_example.md)
- Modern: [userBiddingActivity_example.md](operations/userBiddingActivity_example.md)

- `BidItemArray.Item[]` contains listing details, status, pricing, shipping, and other item-level containers.

- Returns only the selected fields in the GraphQL query.

Migration Guide:

- userBiddingActivity query of Auction API
  **Key behaviors/changes**:

  *   This query can only retrieve bidding activity for the eBay user associated with the OAuth token.
  *   ActiveItemsOnly filter equivalent will not be available.
  *   Pagination control is available.

References:

- Full traditional doc extract: `references/operations/GetBidderList_doc.md`
- Local modern doc extract: `references/operations/userBiddingActivity_doc.md`
- Local modern example: `references/operations/userBiddingActivity_example.md`

## User Notes

### SetUserNotes -> createOrReplaceUserNote / deleteUserNote
Purpose:

- Add, update, or delete private “My eBay” notes attached to items or order line items.

Modern API:

- GraphQL mutation `createOrReplaceUserNote` (User Note API)
- GraphQL mutation `deleteUserNote` (User Note API)

Key Differences:

- Traditional `SetUserNotes` uses `Action` with `AddOrUpdate` vs `Delete`.
- Modern GraphQL splits this into two mutations.

Request Payload Transformation:

- Traditional: [SetUserNotes_example.md](operations/SetUserNotes_example.md)
- Modern: [createOrReplaceUserNote_example.md](operations/createOrReplaceUserNote_example.md), [deleteUserNote_example.md](operations/deleteUserNote_example.md)

- See traditional doc extract for the full request shape (e.g., `Action`, `ItemID`, `NoteText`, `OrderLineItemID`, `TransactionID`).

**GraphQL (after) – create/replace:**

```graphql
mutation CreateOrReplaceUserNote($input: CreateOrReplaceUserNoteInput!) {
  createOrReplaceUserNote(input: $input) {
    __typename
    ... on CreateOrReplaceUserNoteSuccess {
      userNote {
        note
      }
    }
    ... on ReferenceArgumentsNotFound {
      errorCode
      errorMessage
      argumentNames
    }
  }
}

# Variables:
{
  "input": {
    "itemId": "2********4-5********2",
    "userNote": "Perfect size and color!"
  }
}
```

**GraphQL (after) – delete:**

```graphql
mutation DeleteUserNote($input: DeleteUserNoteInput!) {
  deleteUserNote(input: $input) {
    __typename
    ... on DeleteUserNoteSuccess {
      userNote {
        note
      }
    }
    ... on ReferenceArgumentsNotFound {
      errorCode
      errorMessage
      argumentNames
    }
  }
}

# Variables
{
  "input": {
    "itemId": "2********4-5*********2"
  }
}
```

Response Payload Transformation:

- Traditional: [SetUserNotes_example.md](operations/SetUserNotes_example.md)
- Modern: [createOrReplaceUserNote_example.md](operations/createOrReplaceUserNote_example.md), [deleteUserNote_example.md](operations/deleteUserNote_example.md)


**GraphQL (after) – create/replace success:**

```json
{
  "data": {
    "createOrReplaceUserNote": {
      "__typename": "CreateOrReplaceUserNoteSuccess",
      "userNote": {
        "note": "Perfect size and color!"
      }
    }
  }
}
```

**GraphQL (after) – delete success:**

```json
{
  "data": {
    "deleteUserNote": {
      "__typename": "DeleteUserNoteSuccess",
      "userNote": {
        "note": "Perfect size and color!"
      }
    }
  }
}
```

**GraphQL (after) – error case:**

```json
{
  "data": {
    "createOrReplaceUserNote": {
      "__typename": "ReferenceArgumentsNotFound",
      "errorCode": "ARGUMENTS_NOT_FOUND",
      "errorMessage": "The specified itemId or orderLineItemId were not found.",
      "argumentNames": ["itemId"]
    }
  }
}
```

Migration Guide:

- createOrReplaceUserNote method of User Note API
(Add or update note)

  **Key behaviors/changes**:

  *   A purchasable item in a single or multiple-variation listing is identified through the itemid field.
  *   A line item is identified through the orderlineitemid field.
  *   If a user note already exists for the specified itemid or orderlineitemid, that note will be overwritten with the new note.
  *   A SKU value is not supported.

- deleteUserNote method of User Note API
(Delete note)

  **Key behaviors/changes**:

  *   A purchasable item in a single or multiple-variation listing is identified through the itemid field.
  *   A line item is identified through the orderlineitemid field.

References:

- Full traditional doc extract: `references/operations/SetUserNotes_doc.md`
- Modern doc extract: `references/operations/createOrReplaceUserNote_doc.md`
- Modern example: `references/operations/createOrReplaceUserNote_example.md`
- Modern doc extract: `references/operations/deleteUserNote_doc.md`
- Modern example: `references/operations/deleteUserNote_example.md`