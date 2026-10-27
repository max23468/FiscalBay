# GET : getCategoryTree Samples
- [Sample 1: Get a complete category tree](#sample-1-get-a-complete-category-tree)

---

## Sample 1: Get a complete category tree

This sample retrieves the complete content of the specified category tree.

### Input

Use the **category_tree_id** path parameter to specify the category tree to retrieve. It is not necessary to specify an eBay marketplace.

```http
GET https://api.ebay.com/commerce/taxonomy/v1/category_tree/0
```

### Output

A successful call returns the complete category tree specified, from the root node to all leaf nodes of the tree. In this sample, the returned category tree contains almost 20,000 categories, so the response shown here has most of the nodes removed for easier viewing.

```json
{
	"categoryTreeId": "0",
	"categoryTreeVersion": "117",
	"rootCategoryNode": {
		"category": {
			"categoryId": "0",
			"categoryName": "Root"
		},
		"childCategoryTreeNodes": [
			{
				"category": {
					"categoryId": "1",
					"categoryName": "Collectibles"
				},
				"parentCategoryTreeNodeHref": "https://api.ebay.com/commerce/taxonomy/v1/category_tree/0/get_category_subtree?category_id=1",
				"childCategoryTreeNodes": [
					{
						"category": {
							"categoryId": "34",
							"categoryName": "Advertising"
						},
						"parentCategoryTreeNodeHref": "https://api.ebay.com/commerce/taxonomy/v1/category_tree/0/get_category_subtree?category_id=34",
						"childCategoryTreeNodes": [
							{
								"category": {
									"categoryId": "36",
									"categoryName": "Soda"
								},
								"parentCategoryTreeNodeHref": "https://api.ebay.com/commerce/taxonomy/v1/category_tree/0/get_category_subtree?category_id=36",
								"childCategoryTreeNodes": [
									{
										"category": {
											"categoryId": "13600",
											"categoryName": "Coca-Cola"
										},
										"parentCategoryTreeNodeHref": "https://api.ebay.com/commerce/taxonomy/v1/category_tree/0/get_category_subtree?category_id=13600",
										"childCategoryTreeNodes": [
											{
												"category": {
													"categoryId": "38",
													"categoryName": "Other Coca-Cola Ads"
												},
												"parentCategoryTreeNodeHref": "https://api.ebay.com/commerce/taxonomy/v1/category_tree/0/get_category_subtree?category_id=38",
												"categoryTreeNodeLevel": 5,
												"leafCategoryTreeNode": true
											},
												 ...
										],
										"categoryTreeNodeLevel": 4
									},
										 ...
								],
								"categoryTreeNodeLevel": 3
							},
								 ...
						],
						"categoryTreeNodeLevel": 2
					},
						 ...
				],
				"categoryTreeNodeLevel": 1
			},
				 ...
			{
				"category": {
					"categoryId": "172008",
					"categoryName": "Gift Cards & Coupons"
				},
				"parentCategoryTreeNodeHref": "https://api.ebay.com/commerce/taxonomy/v1/category_tree/0/get_category_subtree?category_id=172008",
				"childCategoryTreeNodes": [
					 ...
				],
				"categoryTreeNodeLevel": 1
			}
		],
		"categoryTreeNodeLevel": 0
	},
	"applicableMarketplaceIds": []
}
```

---
