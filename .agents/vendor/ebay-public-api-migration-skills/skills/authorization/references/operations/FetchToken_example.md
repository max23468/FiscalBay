# FetchToken — Example

## Request Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<FetchTokenRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <SessionID>YourSessionIDHere</SessionID>
</FetchTokenRequest>
```


## Response Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<FetchTokenResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Timestamp>2019-11-04T17:42:00.657Z</Timestamp>
  <Ack>Success</Ack>
  <Version>1123</Version>
  <Build>E1123_CORE_APISIGNIN_19059235_R1</Build>
  <eBayAuthToken>YourAuthToken</eBayAuthToken>
  <HardExpirationTime>2020-05-03T20:36:32.000Z</HardExpirationTime>
</FetchTokenResponse>
```

