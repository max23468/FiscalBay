# GetTokenStatus — Example

## Request Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetTokenStatusRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>A3</eBayAuthToken>
  </RequesterCredentials>
</GetTokenStatusRequest>
```


## Response Example

```xml
<?xml version="1.0" encoding="UTF-8"?>
<GetTokenStatusResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Timestamp>2019-11-05T22:42:33.852Z</Timestamp>
  <Ack>Success</Ack>
  <Version>1123</Version>
  <Build>E1123_CORE_APISIGNIN_19059235_R1</Build>
  <TokenStatus>
    <Status>Active</Status>
    <EIASToken>n=</EIASToken>
    <ExpirationTime>2021-04-27T17:44:46.000Z</ExpirationTime>
  </TokenStatus>
</GetTokenStatusResponse>
```

