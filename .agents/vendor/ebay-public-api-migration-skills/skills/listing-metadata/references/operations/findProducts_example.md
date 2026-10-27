# GET : findProducts Samples


## Mapped Modern Sample

- [Sample 1: Search for Products by Keyword](#sample-1-search-for-products-by-keyword)
- [Sample 2: Search for Products by Category](#sample-2-search-for-products-by-category)
- [Sample 3: Search for Aspect Refinements Based on a Keyword](#sample-3-search-for-aspect-refinements-based-on-a-keyword)
- [Sample 4: Search for Products Based on a Keyword and Filtered by Aspect](#sample-4-search-for-products-based-on-a-keyword-and-filtered-by-aspect)
- [Sample 5: Search for Products Based on a GTIN](#sample-5-search-for-products-based-on-a-gtin)
- [Sample 6: Search for Products Based on an MPN](#sample-6-search-for-products-based-on-an-mpn)

---

## Sample 1: Search for Products by Keyword

This sample returns a set of eBay products that match the keyword.

### Input

The inputs are the query parameters **q**, which is the keyword, and **limit**.
 There is no payload with this request.

```http
GET https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=drone&limit=3
```

### Output

If the call is successful, 3 product summaries will be returned in the result set.

```json
{
	"productSummaries": [
		{
			"epid": "237137365",
			"gtin": [
				"0814838014791"
			],
			"aspects": [
				{
					"localizedName": "Leading Role",
					"localizedValues": [
						"SEAN Bean",
						"Mary Mccormack",
						"Patrick Sabongui",
						"Joel Moore"
					]
				},
				{
					"localizedName": "Director",
					"localizedValues": [
						"Jason Bourque"
					]
				},
				{
					"localizedName": "Format",
					"localizedValues": [
						"Blu-ray Disc"
					]
				}
			],
			"ean": [
				"0814838014791"
			],
			"upc": [
				"0814838014791"
			],
			"productHref": "https://api.ebay.com/commerce/catalog/v1_beta/product/237137365",
			"title": "Drone (Blu-ray Disc, 2017)",
			"productWebUrl": "https://www.latest.ebay.com/p/Drone+%28Blu%2Dray+Disc%2C+2017%29/237137365?src=urllib"
		},
		{
			"epid": "210388958",
			"gtin": [
				"9780578128801"
			],
			"image": {
				"imageUrl": "https://i.ebayimg.com/00/s/NTAwWDMxMw==/z/nx4AAOSwLGtZs-57/$_6.JPG?set_id=89040003C1"
			},
			"aspects": [
				{
					"localizedName": "Publication Year",
					"localizedValues": [
						"2013"
					]
				},
				{
					"localizedName": "Language",
					"localizedValues": [
						"English"
					]
				},
				{
					"localizedName": "Format",
					"localizedValues": [
						"Hardcover"
					]
				}
			],
			"ean": [
				"9780578128801"
			],
			"isbn": [
				"9780578128801"
			],
			"productHref": "https://api.ebay.com/commerce/catalog/v1_beta/product/210388958",
			"title": "Uav and Drone Entrepreneurship by Jerry Lemieux (2013, Hardcover)",
			"productWebUrl": "https://www.latest.ebay.com/p/Uav+and+Drone+Entrepreneurship+by+Jerry+Lemieux+%282013%2C+Hardcover%29/210388958?src=urllib"
		},
		{
			"epid": "219437621",
			"gtin": [
				"0630509346929"
			],
			"brand": "Hasbro",
			"mpn": [
				"B3926"
			],
			"image": {
				"imageUrl": "https://i.ebayimg.com/00/s/NDAwWDQwMA==/z/1c4AAOSws4JW8XvW/$_6.JPG?set_id=89040003C1"
			},
			"aspects": [
				{
					"localizedName": "Brand",
					"localizedValues": [
						"Hasbro"
					]
				},
				{
					"localizedName": "MPN",
					"localizedValues": [
						"B3926"
					]
				},
				{
					"localizedName": "Character Family",
					"localizedValues": [
						"Star Wars"
					]
				},
				{
					"localizedName": "Recommended Age Range",
					"localizedValues": [
						"4+"
					]
				},
				{
					"localizedName": "Size",
					"localizedValues": [
						"7in."
					]
				},
				{
					"localizedName": "Year",
					"localizedValues": [
						"2015"
					]
				},
				{
					"localizedName": "Type",
					"localizedValues": [
						"Action Figure Collection"
					]
				}
			],
			"ean": [
				"0630509346929"
			],
			"upc": [
				"0630509346929"
			],
			"productHref": "https://api.ebay.com/commerce/catalog/v1_beta/product/219437621",
			"title": "Hasbro The Force Awakens BB-8 Droid Action Figure",
			"productWebUrl": "https://www.latest.ebay.com/p/Hasbro+The+Force+Awakens+BB%2D8+Droid+Action+Figure/219437621?src=urllib"
		}
	],
	"limit": 3
}
```

---
