# DELETE : deleteStoreCategory Samples
- [Sample 1: Delete a category from an eBay Store](#sample-1-delete-a-category-from-an-ebay-store)

---

## Sample 1: Delete a category from an eBay Store

The seller can delete a category from an eBay Store.

### Input

The following sample shows how to delete category from an eBay store. Any listings listed under the deleted category are moved under the category specified with ** listingDestinationCategoryId **.

```http
DELETE https://api.ebay.com/sell/stores/v1/store/categories/1**1

{
    "listingDestinationCategoryId": "2*****2"
}
```

### Output

If the call is successful, a category is deleted from an eBay store and the **getStoreTask** URI is returned in the Location response header.

*Sample output file not available for this operation.*

---

