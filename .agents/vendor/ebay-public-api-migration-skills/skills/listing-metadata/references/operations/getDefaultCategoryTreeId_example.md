# GET : getDefaultCategoryTreeId Samples
- [Sample 1: Get a default category tree ID](#sample-1-get-a-default-category-tree-id)

---

## Sample 1: Get a default category tree ID

This sample identifies the eBay category tree that is used by default by a given eBay marketplace.

### Input

Use the **marketplace_id** query parameter to specify the eBay marketplace for which to retrieve the category tree ID. For a list of supported marketplaces and their IDs, see Marketplaces with Default Category Trees.

```http
GET https://api.ebay.com/commerce/taxonomy/v1/get_default_category_tree_id?marketplace_id=EBAY_AT
```

### Output

A successful call returns the category tree's ID and version.

```json
{
	"categoryTreeId": "16",
	"categoryTreeVersion": "86"
}
```

---
