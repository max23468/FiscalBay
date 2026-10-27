# POST : moveStoreCategory Samples
- [Sample 1: Move single category of a user's eBay Store](#sample-1-move-single-category-of-a-users-ebay-store)

---

## Sample 1: Move single category of a user's eBay Store

The seller can move single category of a user's eBay store.

### Input

The following sample moves one category underneath a new parent category in an eBay store category structure.

```http
POST https://api.ebay.com/sell/stores/v1/store/categories/move_category

{
    "categoryId": "3***1",
    "listingDestinationCategoryId": "1******1",
    "destinationParentCategoryId": "4*****1"
}
```

### Output

If the call is successful, a single category of a user's eBay Store is moved.

*Sample output file not available for this operation.*

---

