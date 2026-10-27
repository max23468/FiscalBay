# RespondToBestOffer — Example

## Request Example

```xml
<RespondToBestOfferRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <Action>Counter</Action>
  <BestOfferID>900000001235</BestOfferID>
  <ItemID>220000000001</ItemID>
  <CounterOfferPrice currencyID="USD">30.00</CounterOfferPrice>
  <CounterOfferQuantity>2</CounterOfferQuantity>
  <SellerResponse>I can do 15 dollars each for two units.</SellerResponse>
</RespondToBestOfferRequest>
```


## Response Example

```xml
<RespondToBestOfferResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Ack>Success</Ack>
  <RespondToBestOffer>
    <BestOffer>
      <CallStatus>Success</CallStatus>
    </BestOffer>
  </RespondToBestOffer>
</RespondToBestOfferResponse>
```

