# GetAdFormatLeads — Example

## Request Example

```xml
<GetAdFormatLeadsRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>A3</eBayAuthToken>
  </RequesterCredentials>
  <ItemID>41</ItemID>
  <DetailLevel>ReturnAll</DetailLevel>
</GetAdFormatLeadsRequest>
```


## Response Example

```xml
<GetAdFormatLeadsResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Timestamp>2019-11-04T17:52:10.895Z</Timestamp>
  <Ack>Success</Ack>
  <Version>1131</Version>
  <Build>E1131_CORE_API6_19105226_R1</Build>
  <AdFormatLead>
    <AdditionalInformation>Are the neighbors noisy?</AdditionalInformation>
    <Email>a@.com</Email>
    <SubmittedTime>2019-09-02T02:55:43.000Z</SubmittedTime>
  </AdFormatLead>
</GetAdFormatLeadsResponse>
```

