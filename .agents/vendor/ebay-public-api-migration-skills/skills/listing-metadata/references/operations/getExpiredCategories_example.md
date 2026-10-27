# GET : getExpiredCategories Samples
- [Sample 1: Retrieve category mappings for expired categories](#sample-1-retrieve-category-mappings-for-expired-categories)

---

## Sample 1: Retrieve category mappings for expired categories

This sample retrieves an array of expired category IDs for the specified category tree and the corresponding active eBay leaf categories that have replaced them.

### Input

Use the **category_tree_id** path parameter to specify the category tree for which to retrieve expired leaf categories and their associated active leaf categories.

```http
GET https://api.ebay.com/commerce/taxonomy/v1/category_tree/0/get_expired_categories
```

### Output

A successful call returns an array of expired leaf categories (**fromCategoryId**), each one accompanied by the corresponding active leaf category (**toCategoryId**). Note that the response shown is only a sample of a much larger response.

```json
{
	"expiredCategories": [
		{
			"fromCategoryId": "13",
			"toCategoryId": "870"
		},
		{
			"fromCategoryId": "14",
			"toCategoryId": "262374"
		},
		{
			"fromCategoryId": "15",
			"toCategoryId": "262408"
		}
	]
}
```

---
