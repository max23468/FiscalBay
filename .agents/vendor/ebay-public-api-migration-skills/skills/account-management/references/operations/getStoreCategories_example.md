# GET : getStoreCategories Samples
- [Sample 1: Get information about an eBay Store Category hierarchy](#sample-1-get-information-about-an-ebay-store-category-hierarchy)

---

## Sample 1: Get information about an eBay Store Category hierarchy

The seller can retrieve information about an eBay Store Category hierarchy.

### Input

This call does not use request payload.

```http
GET https://api.ebay.com/sell/stores/v1/store/categories
```

### Output

If the call is successful, eBay returns an HTTP status code of **200 OK** and information about the eBay Store Category hierarchy.

```json
{
    "storeCategories": [
        {
            "categoryId": "*",
            "categoryname": "1****r",
            "order": "0",
            "level": 1,
            "childrenCategories": [
                {
                    "categoryId": "2*****",
                    "categoryname": "D******2",
                    "order": "0",
                    "level": 2,
                    "childrenCategories": [
                        {
                            "categoryId": "3*****",
                            "categoryname": "D******3",
                            "order": "0",
                            "level": 3
                        }
                    ]
                }
            ]
        },
        {
            "categoryId": "2******0",
            "categoryname": "D******s",
            "order": "1",
            "level": 1
        }
    ]
}
```

---

