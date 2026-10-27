# UploadSiteHostedPictures — Example

## Request Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<UploadSiteHostedPicturesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>PLACEHOLDER_TOKEN</eBayAuthToken>
  </RequesterCredentials>
  <WarningLevel>High</WarningLevel>
  <ExternalPictureURL>https://...com/////.jpg</ExternalPictureURL>
  <PictureName>Developer Page Banner</PictureName>
</UploadSiteHostedPicturesRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<UploadSiteHostedPicturesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <ebl:eBayAuthToken xmlns:ebl="urn:ebay:apis:eBLBaseComponents">TOKEN</ebl:eBayAuthToken>
  </RequesterCredentials>
  <PictureName>Gall-Peters projection map</PictureName>
  <PictureSet>Standard</PictureSet>
</UploadSiteHostedPicturesRequest>
```

## Response Example

```xml
<?xml version="1.0" encoding="UTF-8"?>
<UploadSiteHostedPicturesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Timestamp>2019-11-07T18:44:10.323Z</Timestamp>
  <Ack>Success</Ack>
  <Version>4</Version>
  <Build>mediasvcs-4.4.14_20190831081631969</Build>
  <PictureSystemVersion>2</PictureSystemVersion>
  <SiteHostedPictureDetails>
    <PictureName>Developer Page Banner</PictureName>
    <PictureSet>Standard</PictureSet>
    <PictureFormat>JPG</PictureFormat>
    <FullURL>http://..///=//8/$_.?7</FullURL>
    <BaseURL>http://..///=//8/$_</BaseURL>
    <PictureSetMember>
      <MemberURL>http:///$_0.JPG</MemberURL>
      <PictureHeight>24</PictureHeight>
      <PictureWidth>96</PictureWidth>
    </PictureSetMember>
    <PictureSetMember>
      <MemberURL>http:///$_1.JPG</MemberURL>
      <PictureHeight>100</PictureHeight>
      <PictureWidth>400</PictureWidth>
    </PictureSetMember>
    <PictureSetMember>
      <MemberURL>http:///$_2.JPG</MemberURL>
      <PictureHeight>50</PictureHeight>
      <PictureWidth>200</PictureWidth>
    </PictureSetMember>
    <PictureSetMember>
      <MemberURL>http:///$_2.JPG</MemberURL>
      <PictureHeight>125</PictureHeight>
      <PictureWidth>500</PictureWidth>
    </PictureSetMember>
    <PictureSetMember>
      <MemberURL>http:///$_4.JPG</MemberURL>
      <PictureHeight>16</PictureHeight>
      <PictureWidth>64</PictureWidth>
    </PictureSetMember>
    <PictureSetMember>
      <MemberURL>http:///$_5.JPG</MemberURL>
      <PictureHeight>75</PictureHeight>
      <PictureWidth>300</PictureWidth>
    </PictureSetMember>
    <PictureSetMember>
      <MemberURL>http:///$_9.JPG</MemberURL>
      <PictureHeight>32</PictureHeight>
      <PictureWidth>32</PictureWidth>
    </PictureSetMember>
    <ExternalPictureURL>https://...com/////.jpg</ExternalPictureURL>
    <UseByDate>2018-11-20T23:18:20.326Z</UseByDate>
  </SiteHostedPictureDetails>
</UploadSiteHostedPicturesResponse>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<UploadSiteHostedPicturesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <ebl:eBayAuthToken xmlns:ebl="urn:ebay:apis:eBLBaseComponents">TOKEN</ebl:eBayAuthToken>
  </RequesterCredentials>
  <PictureName>Gall-Peters projection map</PictureName>
  <PictureSet>Standard</PictureSet>
</UploadSiteHostedPicturesRequest>
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<UploadSiteHostedPicturesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <PictureSystemVersion>int</PictureSystemVersion>
  <SiteHostedPictureDetails>
    <BaseURL>anyURI</BaseURL>
    <ExternalPictureURL>anyURI</ExternalPictureURL>
    <FullURL>anyURI</FullURL>
    <PictureFormat></PictureFormat>
    <PictureName>string</PictureName>
    <PictureSet></PictureSet>
    <PictureSetMember>
      <MemberURL>anyURI</MemberURL>
      <PictureHeight>int</PictureHeight>
      <PictureWidth>int</PictureWidth>
    </PictureSetMember>
    <!-- ... more PictureSetMember nodes allowed here ... -->
    <UseByDate>dateTime</UseByDate>
  </SiteHostedPictureDetails>
  <!-- Standard Output Fields -->
  <Ack></Ack>
  <Build>string</Build>
  <CorrelationID>string</CorrelationID>
  <Errors>
    <ErrorClassification></ErrorClassification>
    <ErrorCode>token</ErrorCode>
    <ErrorParameters ParamID="string">
      <Value>string</Value>
    </ErrorParameters>
    <!-- ... more ErrorParameters nodes allowed here ... -->
    <LongMessage>string</LongMessage>
    <SeverityCode></SeverityCode>
    <ShortMessage>string</ShortMessage>
  </Errors>
  <!-- ... more Errors nodes allowed here ... -->
  <HardExpirationWarning>string</HardExpirationWarning>
  <Timestamp>dateTime</Timestamp>
  <Version>string</Version>
</UploadSiteHostedPicturesResponse>
```
