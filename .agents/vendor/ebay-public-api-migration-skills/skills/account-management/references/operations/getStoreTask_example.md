# GET : getStoreTask Samples
- [Sample 1: Get the processing status of a specific async task.](#sample-1-get-the-processing-status-of-a-specific-async-task)

---

## Sample 1: Get the processing status of a specific async task.

The seller can retrieve information about the processing status of the store async task.

### Input

This call does not use request payload.

```http
GET https://api.ebay.com/sell/stores/v1/store/tasks/1*3
```

### Output

If the call is successful, eBay returns an HTTP status code of **200 OK** and processing status of the store async task.

```json
{    
    "task": {
        "id": "1*3",
        "type": "ADD_STORE_CATEGORY",
        "status": "COMPLETED",
        "message": "Added category successfully."
    }
}
```

---

