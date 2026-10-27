# GET : getCategorySubtree Samples
- [Sample 1: Get a subtree of a category tree](#sample-1-get-a-subtree-of-a-category-tree)

---

## Sample 1: Get a subtree of a category tree

This sample retrieves the complete content of a subtree of an eBay category tree, using the category tree node that contains the specified category as the root of the desired subtree.

### Input

Use the **category_tree_id** path parameter to specify the category tree, and use the **category_id** query parameter to specify the category in the category node at the top of the subtree being requested.

```http
GET https://api.ebay.com/commerce/taxonomy/v1/category_tree/0/get_category_subtree?category_id=11450
```

### Output

A successful call returns the complete category subtree specified, from the specified category node to all leaf nodes of the subtree. In this sample, the returned category subtree contains almost 600 categories, so the response shown here has most of the nodes removed for easier viewing.

```json
{
	"categoryTreeId": "0",
	"categoryTreeVersion": "117",
	"categoryNode": {
		"category": {
			"categoryId": "11450",
			"categoryName": "Clothing, Shoes & Accessories"
		},
		"parentCategoryTreeNodeHref": "https://api.ebay.com/commerce/taxonomy/v1/category_tree/0/get_category_subtree?category_id=11450",
		"childCategoryTreeNodes": [
			{
				"category": {
					"categoryId": "1059",
					"categoryName": "Men's Clothing"
				},
				"parentCategoryTreeNodeHref": "https://api.ebay.com/commerce/taxonomy/v1/category_tree/0/get_category_subtree?category_id=1059",
				"childCategoryTreeNodes": [
					{
						"category": {
							"categoryId": "313",
							"categoryName": "Other Men's Clothing"
						},
						"parentCategoryTreeNodeHref": "https://api.ebay.com/commerce/taxonomy/v1/category_tree/0/get_category_subtree?category_id=313",
						"categoryTreeNodeLevel": 3,
						"leafCategoryTreeNode": true
					},
						 ...
					{
						"category": {
							"categoryId": "155183",
							"categoryName": "Sweats & Hoodies"
						},
						"parentCategoryTreeNodeHref": "https://api.ebay.com/commerce/taxonomy/v1/category_tree/0/get_category_subtree?category_id=155183",
						"categoryTreeNodeLevel": 3,
						"leafCategoryTreeNode": true
					}
				],
				"categoryTreeNodeLevel": 2
			},
			{
				"category": {
					"categoryId": "3034",
					"categoryName": "Women's Shoes"
				},
				"parentCategoryTreeNodeHref": "https://api.ebay.com/commerce/taxonomy/v1/category_tree/0/get_category_subtree?category_id=3034",
				"childCategoryTreeNodes": [
					 ...
				],
				"categoryTreeNodeLevel": 2
			},
			{
				"category": {
					"categoryId": "3082",
					"categoryName": "Baby & Toddler Clothing"
				},
				"parentCategoryTreeNodeHref": "https://api.ebay.com/commerce/taxonomy/v1/category_tree/0/get_category_subtree?category_id=3082",
					 ...
				],
				"categoryTreeNodeLevel": 2
			},
				 ...
			{
				"category": {
					"categoryId": "175759",
					"categoryName": "Vintage"
				},
				"parentCategoryTreeNodeHref": "https://api.ebay.com/commerce/taxonomy/v1/category_tree/0/get_category_subtree?category_id=175759",
				"childCategoryTreeNodes": [
					 ...
				],
				"categoryTreeNodeLevel": 2
			}
		],
		"categoryTreeNodeLevel": 1
	}
}
```

---
