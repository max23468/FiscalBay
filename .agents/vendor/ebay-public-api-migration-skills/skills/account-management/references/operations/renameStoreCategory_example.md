# PUT : renameStoreCategory Samples
- [Sample 1: Rename the category of a user's eBay store.](#sample-1-rename-the-category-of-a-users-ebay-store)

---

## Sample 1: Rename the category of a user's eBay store.

The seller can rename an existing eBay store category.

### Input

The following sample renames one existing eBay store category.

```http
PUT https://api.ebay.com/sell/stores/v1/store/categories/1***8

{    
    "categoryName": "TechnoGadgets"
}
```

### Output

If the call is successful, the store category is renamed and the **getStoreTask** URI is returned in the Location response header.

*Sample output file not available for this operation.*

---

