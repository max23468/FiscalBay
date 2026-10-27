# GET : getCategorySuggestions Samples
- [Sample 1: Get category suggestions for a product](#sample-1-get-category-suggestions-for-a-product)

---

## Sample 1: Get category suggestions for a product

This sample retrieves an array of categories selected from the specified category tree which are considered by eBay to most closely correspond to the query string provided.

### Input

Use the **category_tree_id** path parameter to specify the category tree, and use the **q** query parameter to provide a free form string of search terms related to the product for which you want category suggestions.

```http
GET https://api.ebay.com/commerce/taxonomy/v1/category_tree/0/get_category_suggestions?q=iphone
```

### Output

A successful call returns an array of categories, each one accompanied by details about each of the category's ancestor nodes, extending from its immediate parent up to the root of the category tree.

```json
{
	"categorySuggestions": [
		{
			"category": {
				"categoryId": "9355",
				"categoryName": "Cell Phones & Smartphones"
			},
			"categoryTreeNodeLevel": 2,
			"categoryTreeNodeAncestors": [
				{
					"categoryId": "15032",
					"categoryName": "Cell Phones & Accessories",
					"categoryTreeNodeLevel": 1,
					"categorySubtreeNodeHref": "https://api.ebay.com/commerce/taxonomy/v1/category_tree/0/get_category_subtree?category_id=15032"
				}
			]
		},
		{
			"category": {
				"categoryId": "12",
				"categoryName": "Other Antiques"
			},
			"categoryTreeNodeLevel": 2,
			"categoryTreeNodeAncestors": [
				{
					"categoryId": "20081",
					"categoryName": "Antiques",
					"categoryTreeNodeLevel": 1,
					"categorySubtreeNodeHref": "https://api.ebay.com/commerce/taxonomy/v1/category_tree/0/get_category_subtree?category_id=20081"
				}
			]
		},
		{
			"category": {
				"categoryId": "20349",
				"categoryName": "Cases, Covers & Skins"
			},
			"categoryTreeNodeLevel": 3,
			"categoryTreeNodeAncestors": [
				{
					"categoryId": "9394",
					"categoryName": "Cell Phone Accessories",
					"categoryTreeNodeLevel": 2,
					"categorySubtreeNodeHref": "https://api.ebay.com/commerce/taxonomy/v1/category_tree/0/get_category_subtree?category_id=9394"
				},
				{
					"categoryId": "15032",
					"categoryName": "Cell Phones & Accessories",
					"categoryTreeNodeLevel": 1,
					"categorySubtreeNodeHref": "https://api.ebay.com/commerce/taxonomy/v1/category_tree/0/get_category_subtree?category_id=15032"
				}
			]
		}
	],
	"categoryTreeId": "0",
	"categoryTreeVersion": "117"
}
```

---
