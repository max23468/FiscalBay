# GET : getStoreTasks Samples
- [Sample 1: Get all the current async tasks](#sample-1-get-all-the-current-async-tasks)

---

## Sample 1: Get all the current async tasks

The seller can retrieve all the current async tasks.

### Input

This call does not use request payload.

```http
GET https://api.ebay.com/sell/stores/v1/store/tasks
```

### Output

If the call is successful, eBay returns an HTTP status code of **200 OK** and all the current async tasks.

```json
{    
    "tasks": [
        {
            "id": "1*3",
            "type": "ADD_STORE_CATEGORY",
            "status": "PENDING",
            "message": "Pending"
        },
        {
            "id": "4*6",
            "type": "MOVE_STORE_CATEGORY",
            "status": "PENDING",
            "message": "Pending"
        }
    ]
}
```

---

