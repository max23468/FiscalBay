# GET : getConfig Samples

- [Sample 1: Retrieves a previously created configuration](#sample-1-retrieves-a-previously-created-configuration)

---

## Sample 1: Retrieves a previously created configuration

This sample retrieves a previously created configuration.

### Input

There are no inputs for this sample.

```http
GET https://api.ebay.com/commerce/notification/v1/config
```

### Output

If the call is successful, the configured alert email address is returned.

```json
{
    "alertEmail": "t****@********t.com"
}
```

---