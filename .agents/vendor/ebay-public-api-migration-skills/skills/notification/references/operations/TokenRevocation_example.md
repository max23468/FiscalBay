# TokenRevocation legacy SOAP body example

```xml
<soapenv:Body> <GetTokenStatusResponse xmlns="urn:ebay:apis:eBLBaseComponents"> <Timestamp>2008-03-18T23:37:44.055Z</Timestamp> <Ack>Success</Ack> <CorrelationID>EXAMPLE_CORRELATION_ID</CorrelationID> <Version>557</Version> <Build>EXAMPLE_BUILD</Build> <NotificationEventName>TokenRevocation</NotificationEventName> <RecipientUserID>example-recipient</RecipientUserID> <TokenStatus> <Status>RevokedByeBay</Status> <EIASToken>PLACEHOLDER_TOKEN</EIASToken> <ExpirationTime>2008-04-04T13:30:38.000Z</ExpirationTime> <RevocationTime>2008-03-18T21:30:40.000Z</RevocationTime> </TokenStatus> </GetTokenStatusResponse> </soapenv:Body>
```
