# GetUser - Traditional API (SOAP)

> **Call Name:** GetUser
> **API Type:** SOAP XML traditional API
> **API Version:** 1123
> **Service:** Traditional

---

## Metadata

| Property | Value |
|----------|-------|
| **Call Type** | Core |
| **Deprecated** | No |
| **Replacement** | user query of the User API |
| **Rate Limit** | Not specified in source |
| **Supported Sites** | Not specified in source |

---

## Description

Use this call to retrieve data for a single, registered eBay user.

**Purpose:**
Use this call to retrieve data for a single, registered eBay user.

**Use Cases:**
- Retrieve data for a single registered eBay user.
- Retrieve the authenticated user's own user account data.
- Retrieve another user's data when you know the UserID or have a concluded shared ItemID.

**Important Notes:**
- Sensitive user data may be masked or omitted when the returned user is not the caller.
- Passing a concluded ItemID shared by the requester and target user can reveal additional data such as email address under allowed conditions.
- If UserID is omitted, eBay returns data for the requesting user.
- GetUser returns site-specific and non-site-specific information.

---

## Authentication

### Required Credentials

| Method | Description |
|--------|-------------|
| **eBayAuthToken** | Required in `RequesterCredentials` element |
| **App ID** | Not specified in source |
| **Dev ID** | Not specified in source |
| **Cert ID** | Not specified in source |

### HTTP Headers

```http
X-EBAY-API-SITEID: Not specified in source
X-EBAY-API-COMPATIBILITY-LEVEL: 1123
X-EBAY-API-CALL-NAME: GetUser
X-EBAY-API-DEV-NAME: Not specified in source
X-EBAY-API-APP-NAME: Not specified in source
X-EBAY-API-CERT-NAME: Not specified in source
Content-Type: text/xml; charset=utf-8
```

---

## Request Structure

### Endpoint

```
POST https://api.ebay.com/ws/api.dll
```

### XML Schema

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetUserRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <IncludeFeatureEligibility>boolean</IncludeFeatureEligibility>
  <ItemID></ItemID>
  <UserID>string</UserID>
  <!-- Standard Input Fields -->
  <DetailLevel></DetailLevel>
  <!-- ... more DetailLevel values allowed here ... -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetUserRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| None identified | - | No | No always-required request fields were explicitly labeled in the extracted source. |

#### Optional Fields

| Field Path | Type | Default | Description | Constraints |
|------------|------|---------|-------------|-------------|
| UserID | string | Not specified in source | Specify the user whose data you want returned by the call. If not specified, eBay returns data pertaining to the requesting user (as specified with the eBayAuthToken value). | Not specified in source |
| IncludeFeatureEligibility | boolean | Not specified in source | If the IncludeFeatureEligibility flag is included and set to 'true', the call response will include a QualifiesForSelling flag which indicates if the eBay user is eligible to sell on eBay, and a IncludeFeatureEligibility container which indicates which selling features are available to the user. | Not specified in source |

#### Conditional Fields

| Field Path | Type | Condition | Description |
|------------|------|-----------|-------------|
| ItemID | ItemIDType | Conditionally | Specify the ItemID value for a successfully concluded listing in which the requestor and target user were participants (one as seller and the other as buyer). Necessary to return certain data (like an email address). Not necessary if the requestor is retrieving their own data. |

## Response Structure

### XML Schema

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetUserResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <User>
    <AboutMePage>boolean</AboutMePage>
    <BusinessRole></BusinessRole>
    <eBayGoodStanding>boolean</eBayGoodStanding>
    <eBayWikiReadOnly>boolean</eBayWikiReadOnly>
    <EIASToken>string</EIASToken>
    <Email>string</Email>
    <EnterpriseSeller>boolean</EnterpriseSeller>
    <FeedbackPrivate>boolean</FeedbackPrivate>
    <FeedbackRatingStar></FeedbackRatingStar>
    <FeedbackScore>int</FeedbackScore>
    <IDVerified>boolean</IDVerified>
    <Membership>
      <Program>
        <ExpiryDate>dateTime</ExpiryDate>
        <ProgramName>string</ProgramName>
        <Site></Site>
      </Program>
      <!-- ... more Program nodes allowed here ... -->
    </Membership>
    <NewUser>boolean</NewUser>
    <PositiveFeedbackPercent>float</PositiveFeedbackPercent>
    <QualifiesForSelling>boolean</QualifiesForSelling>
    <RegistrationAddress>
      <CityName>string</CityName>
      <CompanyName>string</CompanyName>
      <Country></Country>
      <CountryName>string</CountryName>
      <Name>string</Name>
      <Phone>string</Phone>
      <PostalCode>string</PostalCode>
      <StateOrProvince>string</StateOrProvince>
      <Street>string</Street>
      <Street1>string</Street1>
      <Street2>string</Street2>
    </RegistrationAddress>
    <RegistrationDate>dateTime</RegistrationDate>
    <SellerInfo>
      <AllowPaymentEdit>boolean</AllowPaymentEdit>
      <CharityAffiliationDetails>
        <CharityAffiliationDetail>
          <AffiliationType></AffiliationType>
          <CharityID>string</CharityID>
          <LastUsedTime>dateTime</LastUsedTime>
        </CharityAffiliationDetail>
        <!-- ... more CharityAffiliationDetail nodes allowed here ... -->
      </CharityAffiliationDetails>
      <CharityRegistered>boolean</CharityRegistered>
      <CheckoutEnabled>boolean</CheckoutEnabled>
      <CIPBankAccountStored>boolean</CIPBankAccountStored>
      <DomesticRateTable>boolean</DomesticRateTable>
      <FeatureEligibility>
        <QualifiedForAuctionOneDayDuration>boolean</QualifiedForAuctionOneDayDuration>
        <QualifiedForFixedPriceOneDayDuration>boolean</QualifiedForFixedPriceOneDayDuration>
        <QualifiesForBuyItNow>boolean</QualifiesForBuyItNow>
        <QualifiesForBuyItNowMultiple>boolean</QualifiesForBuyItNowMultiple>
        <QualifiesForVariations>boolean</QualifiesForVariations>
      </FeatureEligibility>
      <GoodStanding>boolean</GoodStanding>
      <InternationalRateTable>boolean</InternationalRateTable>
      <PaymentMethod></PaymentMethod>
      <QualifiesForB2BVAT>boolean</QualifiesForB2BVAT>
      <RecoupmentPolicyConsent>
        <Site></Site>
        <!-- ... more Site values allowed here ... -->
      </RecoupmentPolicyConsent>
      <RegisteredBusinessSeller>boolean</RegisteredBusinessSeller>
      <SafePaymentExempt>boolean</SafePaymentExempt>
      <SchedulingInfo>
        <MaxScheduledItems>int</MaxScheduledItems>
        <MaxScheduledMinutes>int</MaxScheduledMinutes>
        <MinScheduledMinutes>int</MinScheduledMinutes>
      </SchedulingInfo>
      <SellerBusinessType></SellerBusinessType>
      <SellerLevel></SellerLevel>
      <SellerPaymentAddress>
        <CityName>string</CityName>
        <Country></Country>
        <CountryName>string</CountryName>
        <InternationalName>string</InternationalName>
        <InternationalStateAndCity>string</InternationalStateAndCity>
        <InternationalStreet>string</InternationalStreet>
        <Name>string</Name>
        <Phone>string</Phone>
        <PostalCode>string</PostalCode>
        <StateOrProvince>string</StateOrProvince>
        <Street1>string</Street1>
        <Street2>string</Street2>
      </SellerPaymentAddress>
      <StoreOwner>boolean</StoreOwner>
      <StoreSite></StoreSite>
      <StoreURL>anyURI</StoreURL>
      <TopRatedSeller>boolean</TopRatedSeller>
      <TopRatedSellerDetails>
        <TopRatedProgram></TopRatedProgram>
        <!-- ... more TopRatedProgram values allowed here ... -->
      </TopRatedSellerDetails>
      <TransactionPercent>float</TransactionPercent>
    </SellerInfo>
    <Site></Site>
    <Status></Status>
    <TUVLevel>int</TUVLevel>
    <UniqueNegativeFeedbackCount>int</UniqueNegativeFeedbackCount>
    <UniqueNeutralFeedbackCount>int</UniqueNeutralFeedbackCount>
    <UniquePositiveFeedbackCount>int</UniquePositiveFeedbackCount>
    <UserID></UserID>
    <UserIDChanged>boolean</UserIDChanged>
    <UserIDLastChanged>dateTime</UserIDLastChanged>
    <UserSubscription></UserSubscription>
    <!-- ... more UserSubscription values allowed here ... -->
    <VATID>string</VATID>
    <VATStatus></VATStatus>
  </User>
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
</GetUserResponse>
```

### Response Fields

#### System Fields (Always Returned)

| Field Path | Type | Description |
|------------|------|-------------|
| Timestamp | dateTime | Not specified in source |
| Ack | AckCodeType | Not specified in source |
| Version | string | Not specified in source |
| Build | string | Not specified in source |
| CorrelationID | string | Not specified in source |

#### Data Fields

| Field Path | Type | Occurrence | Description |
|------------|------|------------|-------------|
| User | UserType | Always | This container consists of detailed information about the user specified in the call request (through the UserID field) or the eBay user account that is tied to the eBayAuthToken value that is passed in the call request. Some sensitive data will be masked/omitted if the returned eBay user is not the person making the GetUser call. More information on another eBay user will be revealed to the person making the call if that person has an order relationship for an eBay listing specified in the ItemID field of the call request. |

#### Error Fields (On Failure)

| Field Path | Type | Description |
|------------|------|-------------|
| Errors.ShortMessage | string | Brief error description |
| Errors.LongMessage | string | Detailed error explanation |
| Errors.ErrorCode | int | Numeric error code |
| Errors.SeverityCode | ErrorSeverityCodeType | Error/Warning |
| Errors.ErrorClassification | ErrorClassificationCodeType | RequestError/SystemError |
| Errors.ErrorParameters | NameValueListType[] | Additional error context |

## Complex Types Reference

### GetUserRequestType

**Description:** Retrieves data pertaining to a single eBay user. Callers can use this call to return their own user data or the data of another eBay user. Unless the caller passes in an ItemID value that identifies a current or past common order, not all data (like email addresses) will be returned in the response.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| ItemID | ItemIDType | [0..1] | Specify the ItemID value for a successfully concluded listing in which the requestor and target user were participants (one as seller and the other as buyer). Necessary to return certain data (like an email address). Not necessary if the requestor is retrieving their own data. |
| UserID | string | [0..1] | Specify the user whose data you want returned by the call. If not specified, eBay returns data pertaining to the requesting user (as specified with the eBayAuthToken value). |
| IncludeFeatureEligibility | boolean | [0..1] | If the IncludeFeatureEligibility flag is included and set to 'true', the call response will include a QualifiesForSelling flag which indicates if the eBay user is eligible to sell on eBay, and a IncludeFeatureEligibility container which indicates which selling features are available to the user. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<GetUserRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <IncludeFeatureEligibility>boolean</IncludeFeatureEligibility>
  <ItemID></ItemID>
  <UserID>string</UserID>
  <!-- Standard Input Fields -->
  <DetailLevel></DetailLevel>
  <!-- ... more DetailLevel values allowed here ... -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetUserRequest>
```

### GetUserResponseType

**Description:** Base response of the GetUser call. This response includes detailed information about the user, including Feedback data, eBay registration date, selling feature eligibility, valid subsriptions, etc.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| User | UserType | [0..1] | This container consists of detailed information about the user specified in the call request (through the UserID field) or the eBay user account that is tied to the eBayAuthToken value that is passed in the call request. Some sensitive data will be masked/omitted if the returned eBay user is not the person making the GetUser call. More information on another eBay user will be revealed to the person making the call if that person has an order relationship for an eBay listing specified in the ItemID field of the call request. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<GetUserResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <User>
    <AboutMePage>boolean</AboutMePage>
    <BusinessRole></BusinessRole>
    <eBayGoodStanding>boolean</eBayGoodStanding>
    <eBayWikiReadOnly>boolean</eBayWikiReadOnly>
    <EIASToken>string</EIASToken>
    <Email>string</Email>
    <EnterpriseSeller>boolean</EnterpriseSeller>
    <FeedbackPrivate>boolean</FeedbackPrivate>
    <FeedbackRatingStar></FeedbackRatingStar>
    <FeedbackScore>int</FeedbackScore>
    <IDVerified>boolean</IDVerified>
    <Membership>
      <Program>
        <ExpiryDate>dateTime</ExpiryDate>
        <ProgramName>string</ProgramName>
        <Site></Site>
      </Program>
      <!-- ... more Program nodes allowed here ... -->
    </Membership>
    <NewUser>boolean</NewUser>
    <PositiveFeedbackPercent>float</PositiveFeedbackPercent>
    <QualifiesForSelling>boolean</QualifiesForSelling>
    <RegistrationAddress>
      <CityName>string</CityName>
      <CompanyName>string</CompanyName>
      <Country></Country>
      <CountryName>string</CountryName>
      <Name>string</Name>
      <Phone>string</Phone>
      <PostalCode>string</PostalCode>
      <StateOrProvince>string</StateOrProvince>
      <Street>string</Street>
      <Street1>string</Street1>
      <Street2>string</Street2>
    </RegistrationAddress>
    <RegistrationDate>dateTime</RegistrationDate>
    <SellerInfo>
      <AllowPaymentEdit>boolean</AllowPaymentEdit>
      <CharityAffiliationDetails>
        <CharityAffiliationDetail>
          <AffiliationType></AffiliationType>
          <CharityID>string</CharityID>
          <LastUsedTime>dateTime</LastUsedTime>
        </CharityAffiliationDetail>
        <!-- ... more CharityAffiliationDetail nodes allowed here ... -->
      </CharityAffiliationDetails>
      <CharityRegistered>boolean</CharityRegistered>
      <CheckoutEnabled>boolean</CheckoutEnabled>
      <CIPBankAccountStored>boolean</CIPBankAccountStored>
      <DomesticRateTable>boolean</DomesticRateTable>
      <FeatureEligibility>
        <QualifiedForAuctionOneDayDuration>boolean</QualifiedForAuctionOneDayDuration>
        <QualifiedForFixedPriceOneDayDuration>boolean</QualifiedForFixedPriceOneDayDuration>
        <QualifiesForBuyItNow>boolean</QualifiesForBuyItNow>
        <QualifiesForBuyItNowMultiple>boolean</QualifiesForBuyItNowMultiple>
        <QualifiesForVariations>boolean</QualifiesForVariations>
      </FeatureEligibility>
      <GoodStanding>boolean</GoodStanding>
      <InternationalRateTable>boolean</InternationalRateTable>
      <PaymentMethod></PaymentMethod>
      <QualifiesForB2BVAT>boolean</QualifiesForB2BVAT>
      <RecoupmentPolicyConsent>
        <Site></Site>
        <!-- ... more Site values allowed here ... -->
      </RecoupmentPolicyConsent>
      <RegisteredBusinessSeller>boolean</RegisteredBusinessSeller>
      <SafePaymentExempt>boolean</SafePaymentExempt>
      <SchedulingInfo>
        <MaxScheduledItems>int</MaxScheduledItems>
        <MaxScheduledMinutes>int</MaxScheduledMinutes>
        <MinScheduledMinutes>int</MinScheduledMinutes>
      </SchedulingInfo>
      <SellerBusinessType></SellerBusinessType>
      <SellerLevel></SellerLevel>
      <SellerPaymentAddress>
        <CityName>string</CityName>
        <Country></Country>
        <CountryName>string</CountryName>
        <InternationalName>string</InternationalName>
        <InternationalStateAndCity>string</InternationalStateAndCity>
        <InternationalStreet>string</InternationalStreet>
        <Name>string</Name>
        <Phone>string</Phone>
        <PostalCode>string</PostalCode>
        <StateOrProvince>string</StateOrProvince>
        <Street1>string</Street1>
        <Street2>string</Street2>
      </SellerPaymentAddress>
      <StoreOwner>boolean</StoreOwner>
      <StoreSite></StoreSite>
      <StoreURL>anyURI</StoreURL>
      <TopRatedSeller>boolean</TopRatedSeller>
      <TopRatedSellerDetails>
        <TopRatedProgram></TopRatedProgram>
        <!-- ... more TopRatedProgram values allowed here ... -->
      </TopRatedSellerDetails>
      <TransactionPercent>float</TransactionPercent>
    </SellerInfo>
    <Site></Site>
    <Status></Status>
    <TUVLevel>int</TUVLevel>
    <UniqueNegativeFeedbackCount>int</UniqueNegativeFeedbackCount>
    <UniqueNeutralFeedbackCount>int</UniqueNeutralFeedbackCount>
    <UniquePositiveFeedbackCount>int</UniquePositiveFeedbackCount>
    <UserID></UserID>
    <UserIDChanged>boolean</UserIDChanged>
    <UserIDLastChanged>dateTime</UserIDLastChanged>
    <UserSubscription></UserSubscription>
    <!-- ... more UserSubscription values allowed here ... -->
    <VATID>string</VATID>
    <VATStatus></VATStatus>
  </User>
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
</GetUserResponse>
```

---

## Enumerations

Not specified in source

---

## Error Codes

| Error Code | Short Message | Description | Resolution |
|------------|---------------|-------------|------------|
| Source does not provide call-specific error codes | Source does not provide call-specific error codes | The extracted JSONL and WSDL content define the Errors container but do not include a call-specific error code table. | Use runtime Traditional API error payloads together with the documented request rules for troubleshooting. |

---

## Business Rules & Constraints

### Field-Level Constraints

#### Request fields
- **Max Length:** Not specified in source
- **Min Length:** Not specified in source
- **Pattern:** Not specified in source
- **Allowed Values:** Not specified in source unless noted in field descriptions
- **Dependencies:** See request-field descriptions and operation-level rules below

### Operation-Level Rules

1. **ItemID is conditionally needed for richer third-party data**
   - Description: ItemID is necessary to return certain data such as email address when the requester is retrieving another user's data.
   - Applies when: When requesting data for another user and needing protected fields.
   - Impact: Without a qualifying ItemID, some sensitive data remains hidden.

2. **UserID defaults to caller**
   - Description: If UserID is omitted, the call returns data for the authenticated user.
   - Applies when: When no target user is specified.
   - Impact: The response is scoped to the requester's own account.

3. **Feature eligibility is opt-in**
   - Description: IncludeFeatureEligibility must be true to return selling-eligibility detail.
   - Applies when: When checking selling-feature eligibility.
   - Impact: The related eligibility container is not returned otherwise.

### Revision Restrictions (If applicable)

| Condition | Allowed Changes | Prohibited Changes |
|-----------|-----------------|-------------------|
| Source does not provide a separate revision-restrictions table for this call | See operation-level rules and field descriptions | Not specified in source |

---

## Rate Limits & Throttling

| Metric | Limit | Window | Notes |
|--------|-------|--------|-------|
| API Calls | Not specified in source | Not specified in source | No long-window quota is explicitly provided in the extracted source. |
| Frequency | Not specified in source | Not specified in source | Not specified in source |

**Throttling Behavior:**
Not specified in source

---

## Best Practices

1. **Use UserID for explicit targeting**
   - Pass UserID whenever you want to retrieve a specific user's profile data rather than the caller's own data.

2. **Provide ItemID when relationship-based fields matter**
   - If you need fields such as email address for another user, use a qualifying concluded ItemID.

3. **Test both self and third-party retrieval paths**
   - The source explicitly recommends testing both self and other-user retrieval behavior in Sandbox.

4. **Inspect the returned User container directly**
   - The response concentrates user details in the User container for downstream storage or display.

---

## Migration Path

### New API Equivalent

| SOAP Operation | New API | Type |
|----------------|---------|------|
| GetUser | User API user | Query |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_getuser_html.jsonl`; `.trace_artifacts/extract_wsdl_getuser.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
