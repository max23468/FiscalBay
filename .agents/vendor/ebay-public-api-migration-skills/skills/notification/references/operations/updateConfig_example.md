# PUT : updateConfig Samples

- [Sample 1: Creates a new configuration or updates a previously created configuration](#sample-1-creates-a-new-configuration-or-updates-a-previously-created-configuration)

---

## Sample 1: Creates a new configuration or updates a previously created configuration

This sample creates a new configuration.

### Input

The input is public_key_id.

```http
PUT https://api.ebay.com/commerce/notification/v1/config
{
    "alertEmail": "t****@********t.com"
}
```

### Output

A successful call returns the HTTP status code `204 No content`. This method has no response payload.

---