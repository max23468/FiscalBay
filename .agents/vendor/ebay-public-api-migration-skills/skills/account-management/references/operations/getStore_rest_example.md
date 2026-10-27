# GET : getStore_rest Samples
- [Sample 1: Get information for an eBay Store](#sample-1-get-information-for-an-ebay-store)

---

## Sample 1: Get information for an eBay Store

The seller can retrieve information about their active eBay store.

### Input

This call does not use request payload.

```http
GET https://api.ebay.com/sell/stores/v1/store
```

### Output

If the call is successful, eBay returns an HTTP status code of **200 OK** and information about the eBay store.

```json
{
    "lastOpenedTime": "2018-07-12T21:04:50.000Z",
    "name": "A***** T*****",
    "url": "https://www.ebay.com/str/a*****s",
    "urlPath": "a*****s",
    "description": "A United States store",
    "logo": {
        "url": "https://www.ebay.com/**"
    }
}
```

---

