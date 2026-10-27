# POST : addStoreCategory Samples
- [Sample 1: Add new category to an eBay Store](#sample-1-add-new-category-to-an-ebay-store)

---

## Sample 1: Add new category to an eBay Store

The seller can add category to their active eBay Store.

### Input

The following sample shows how to add single category to your store. The Store category ID is assigned automatically. The added category appears under the category set with **destinationParentCategoryId**. If there are listings under the specified parent category, they are moved to the category specified with **listingDestinationCategoryId**.

```http
POST https://api.ebay.com/sell/stores/v1/store/categories

{
    "categoryName": "cat_1*1",
    "destinationParentCategoryId": "1*3",
    "listingDestinationCategoryId": "4*6"
}
```

### Output

If the call is successful, a category is added to an eBay Store and the **getStoreTask** URI is returned in the Location response header.

*Sample output file not available for this operation.*

---

