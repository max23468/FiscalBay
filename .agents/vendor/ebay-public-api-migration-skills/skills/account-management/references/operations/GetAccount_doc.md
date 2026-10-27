# GetAccount - Traditional API (SOAP)

> **Call Name:** GetAccount
> **API Type:** SOAP XML traditional API
> **API Version:** Not specified in source
> **Service:** Traditional

---

## Metadata

| Property | Value |
|----------|-------|
| **Call Type** | Core |
| **Deprecated** | No |
| **Replacement** | See Migration Path section |
| **Rate Limit** | Not specified in source |
| **Supported Sites** | Not specified in source |

---

## Description

Use this call to retrieve a seller's invoice data for their eBay account, including the account's summary data.

**Purpose:**
Use this call to retrieve a seller's invoice data for their eBay account, including the account's summary data.

**Use Cases:**
- Retrieves seller account and billing information.

**Important Notes:**
- Retrieves seller account and billing information.

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
X-EBAY-API-COMPATIBILITY-LEVEL: Not specified in source
X-EBAY-API-CALL-NAME: GetAccount
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
<GetAccountRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <AccountEntrySortType></AccountEntrySortType>
  <AccountHistorySelection></AccountHistorySelection>
  <BeginDate>dateTime</BeginDate>
  <Currency></Currency>
  <EndDate>dateTime</EndDate>
  <ExcludeBalance>boolean</ExcludeBalance>
  <ExcludeSummary>boolean</ExcludeSummary>
  <IncludeConversionRate>boolean</IncludeConversionRate>
  <IncludeNettedEntries>boolean</IncludeNettedEntries>
  <ItemID></ItemID>
  <OrderID>string</OrderID>
  <Pagination>
    <EntriesPerPage>int</EntriesPerPage>
    <PageNumber>int</PageNumber>
  </Pagination>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <OutputSelector>string</OutputSelector>
  <!-- ... more OutputSelector values allowed here ... -->
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetAccountRequest>
```

### Request Fields

#### Core Fields (Required)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| None identified | - | No | No always-required request fields were explicitly labeled in the extracted source. |

#### Optional Fields

| Field Path | Type | Default | Description | Constraints |
|------------|------|---------|-------------|-------------|
| InvoiceDate | dateTime | Not specified in source | Since SpecifiedInvoice is no longer supported, this field is no longer applicable and should not be used. If this field is included, it will be ignored. | Not specified in source |
| Pagination | PaginationType | Not specified in source | This container is used to control how many account entries are returned on each page of data in the response. PaginationType is used by numerous Traditional API calls, and the default and maximum values for the EntriesPerPage field differs with each call. For the GetAccount call, the default value is 500 (account entries) per page, and maximum allowed value is 2000 (account entries) per page. | Not specified in source |
| ExcludeBalance | boolean | Not specified in source | By default, the current balance of the user's account will not be returned in the call response. To retrieve the current balance of their account, the user should include the ExcludeBalance flag in the request and set its value to 'false'. The current balance on the account will be shown in the AccountSummary.CurrentBalance field in the call response. | Not specified in source |
| ExcludeSummary | boolean | Not specified in source | Specifies whether to return account summary information in an AccountSummary node. Default is true, to return AccountSummary. | Not specified in source |
| IncludeConversionRate | boolean | Not specified in source | Specifies whether to retrieve the rate used for the currency conversion for usage transactions. | Not specified in source |
| IncludeNettedEntries | boolean | Not specified in source | Include this field and set it to true to retrieve the total net amount of all charges/fees that have been deducted from seller payouts instead of being invoiced to the seller. The total net amount of any seller credits related to these fees is also shown. These fees and credit amounts will be shown in the AccountSummary.NettedTransactionSummary container in the response. | Not specified in source |
| AccountEntrySortType | AccountEntrySortTypeCodeType | Not specified in source | Specifies how account entries should be sorted in the response, by an element and then in ascending or descending order. | Not specified in source |
| Currency | CurrencyCodeType | Not specified in source | Specifies the currency used in the account report. Do not specify Currency in the request unless the following conditions are met. First, the user has or had multiple accounts under the same UserID. Second, the account identified in the request uses the currency you specify in the request. An error is returned if no account is found that uses the currency you specify in the request. | Not specified in source |
| ItemID | ItemIDType | Not specified in source | Specifies the item ID for which to return account entries. If ItemID is used, all other filters in the request are ignored. If the specified item does not exist or if the requesting user is not the seller of the item, an error is returned. | Not specified in source |

#### Conditional Fields

| Field Path | Type | Condition | Description |
|------------|------|-----------|-------------|
| AccountHistorySelection | AccountHistorySelectionCodeType | Conditionally | Specifies the report format in which to return account entries. |
| BeginDate | dateTime | Conditionally | This field is used to retrieve all account entries dating back to the timestamp passed into this BeginDate field up until the timestamp passed into the EndDate field. The BeginDate value can not be set back any further than four months into the past. The allowed date formats are YYYY-MM-DD and YYYY-MM-DD HH:mm:ss The BeginDate value must be less than or equal to the EndDate value. The user might use the same values in both fields if that user wanted to retrieve all account entries from a specific day (if YYYY-MM-DD format used) or wanted to retrieve a specific account entry (if YYYY-MM-DD HH:mm:ss format used). This field is only applicable if the AccountHistorySelection value is set to 'BetweenSpecifiedDates'; otherwise, this field will be ignored. fiedDates' is used, both the BeginDate and EndDate must be included. |
| EndDate | dateTime | Conditionally | This field is used to retrieve all account entries dating up to the timestamp passed into this EndDate field dating back to the timestamp passed into the BeginDate field. The EndDate value can not be set for a future date. The allowed date formats are YYYY-MM-DD and YYYY-MM-DD HH:mm:ss The EndDate value must be more than or equal to the BeginDate value. The user might use the same values in both fields if that user wanted to retrieve all account entries from a specific day (if YYYY-MM-DD format used) or wanted to retrieve a specific account entry (if YYYY-MM-DD HH:mm:ss format used). This field is only applicable if the AccountHistorySelection value is set to 'BetweenSpecifiedDates'; otherwise, this field will be ignored. If 'BetweenSpecifiedDates' is used, both the BeginDate and EndDate must be included. |
| OrderID | string | Conditionally | The unique identifier of an eBay order. This field must be included if the value of the AccountHistorySelection filter is set to OrderId . A user can filter by order ID to see if there are specific account entries related to a specific eBay order. It is possible that no account entries will be found directly related to the specified order ID, and if this is the case, no AccountEntries container will be returned, and the ack value will still be Success . Note: Note that the unique identifier of a 'non-immediate payment' order will change as it goes from an unpaid order to a paid order. Due to this scenario, all calls that accept Order ID values as request filters/parameters, including the GetAccount call, will support the identifiers for both unpaid and paid orders. Sellers can check to see if an order has been paid by looking for a value of 'Complete' in the CheckoutStatus.Status field in the response of GetOrders call, or in the Status.CompleteStatus field in the response of GetItemTransactions or GetSellerTransactions call. Sellers should not fulfill orders until buyer has made payment. |

## Response Structure

### XML Schema

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetAccountResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <AccountEntries>
    <AccountEntry>
      <AccountDetailsEntryType></AccountDetailsEntryType>
      <Balance currencyID="CurrencyCodeType">
      </Balance>
      <ConversionRate currencyID="CurrencyCodeType">
      </ConversionRate>
      <Date>dateTime</Date>
      <Description>string</Description>
      <DiscountDetail>
        <Discount>
          <Amount currencyID="CurrencyCodeType">
          </Amount>
          <DiscountType>string</DiscountType>
        </Discount>
        <!-- ... more Discount nodes allowed here ... -->
      </DiscountDetail>
      <GrossDetailAmount currencyID="CurrencyCodeType">
      </GrossDetailAmount>
      <ItemID></ItemID>
      <Memo>string</Memo>
      <NetDetailAmount currencyID="CurrencyCodeType">
      </NetDetailAmount>
      <Netted>boolean</Netted>
      <OrderId>string</OrderId>
      <OrderLineItemID>string</OrderLineItemID>
      <ReceivedTopRatedDiscount>boolean</ReceivedTopRatedDiscount>
      <RefNumber>string</RefNumber>
      <Title>string</Title>
      <TransactionID>string</TransactionID>
      <VATPercent>decimal</VATPercent>
    </AccountEntry>
    <!-- ... more AccountEntry nodes allowed here ... -->
  </AccountEntries>
  <AccountID>string</AccountID>
  <AccountSummary>
    <AccountState></AccountState>
    <AdditionalAccount>
      <AccountCode>string</AccountCode>
      <Balance currencyID="CurrencyCodeType">
      </Balance>
      <Currency></Currency>
    </AdditionalAccount>
    <!-- ... more AdditionalAccount nodes allowed here ... -->
    <AmountPastDue currencyID="CurrencyCodeType">
    </AmountPastDue>
    <BankAccountInfo>string</BankAccountInfo>
    <BankModifyDate>dateTime</BankModifyDate>
    <BillingCycleDate>int</BillingCycleDate>
    <CreditCardExpiration>dateTime</CreditCardExpiration>
    <CreditCardInfo>string</CreditCardInfo>
    <CreditCardModifyDate>dateTime</CreditCardModifyDate>
    <CurrentBalance currencyID="CurrencyCodeType">
    </CurrentBalance>
    <InvoiceBalance currencyID="CurrencyCodeType">
    </InvoiceBalance>
    <InvoiceCredit currencyID="CurrencyCodeType">
    </InvoiceCredit>
    <InvoiceDate>dateTime</InvoiceDate>
    <InvoiceNewFee currencyID="CurrencyCodeType">
    </InvoiceNewFee>
    <InvoicePayment currencyID="CurrencyCodeType">
    </InvoicePayment>
    <LastAmountPaid currencyID="CurrencyCodeType">
    </LastAmountPaid>
    <LastPaymentDate>dateTime</LastPaymentDate>
    <NettedTransactionSummary>
      <TotalNettedChargeAmount currencyID="CurrencyCodeType">
      </TotalNettedChargeAmount>
      <TotalNettedCreditAmount currencyID="CurrencyCodeType">
      </TotalNettedCreditAmount>
    </NettedTransactionSummary>
    <PastDue>boolean</PastDue>
    <PaymentMethod></PaymentMethod>
  </AccountSummary>
  <Currency></Currency>
  <EntriesPerPage>int</EntriesPerPage>
  <FeeNettingStatus></FeeNettingStatus>
  <HasMoreEntries>boolean</HasMoreEntries>
  <PageNumber>int</PageNumber>
  <PaginationResult>
    <TotalNumberOfEntries>int</TotalNumberOfEntries>
    <TotalNumberOfPages>int</TotalNumberOfPages>
  </PaginationResult>
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
</GetAccountResponse>
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
| AccountID | string | Always | Specifies the seller's unique account number. |
| FeeNettingStatus | FeenettingStatusCodeType | Always | This enumeration value indicates the current status of the seller's account for the fee netting mechanism. If the Enabled value is returned, the seller may include the IncludeNettedEntries field in the request to retrieve the total net amount of all charges/fees that have been deducted from seller payouts instead of being invoiced to the seller. The total net amount of any seller credits related to these fees is also shown in the AccountSummary.NettedTransactionSummary container in the response. |
| AccountSummary | AccountSummaryType | Conditionally | Contains summary data for the seller's account, such as the overall balance, bank account and credit card information, and amount and date of any past due balances. Can also contain data for one or more additional accounts, if the user has changed country of residence. |
| Currency | CurrencyCodeType | Always | Indicates the currency used for monetary amounts in the report. |
| AccountEntries | AccountEntriesType | Conditionally | This container holds an array of account entries. The account entries that are returned are dependent on the selection that the user made in the AccountHistorySelection field in the call request. Each AccountEntry container consists of one credit, one debit, or one administrative action on the account. It is possible that no AccountEntry containers will be returned if no account entries exist since the last invoice (if LastInvoice value is used), between the specified dates (if BetweenSpecifiedDates value is used), or no entries exist for an order (if OrderId value is used). |
| PaginationResult | PaginationResultType | Always | This container shows the total number of account entries and the total number of account entry pages that exist based on the filters used in the GetAccount call request. The total number of account entry pages is partly controlled by the Pagination.EntriesPerPage value that is set in the request. |
| HasMoreEntries | boolean | Conditionally | If this boolean value is returned as 'true', there are more account entries to view on one or more pages of data. To view additional entries, the user would have to make additional GetAccount calls and increment the value of the Pagination.PageNumber field by '1' to view additional pages of account entries. |
| EntriesPerPage | int | Always | This integer value indicates the number of account entries that are being returned per virtual page of data. This value will be the same value passed into the Pagination.EntriesPerPage field in the request. |
| PageNumber | int | Always | This integer value indicates the current page number of account entries that is currently being shown. This value will be the same value passed into the Pagination.PageNumber field in the request. |

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

### GetAccountRequestType

**Description:** Returns a seller's invoice data for their eBay account, including the account's summary data.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| AccountHistorySelection | AccountHistorySelectionCodeType | [0..1] | Specifies the report format in which to return account entries. |
| InvoiceDate | dateTime | [0..1] | Since SpecifiedInvoice is no longer supported, this field is no longer applicable and should not be used. If this field is included, it will be ignored. |
| BeginDate | dateTime | [0..1] | This field is used to retrieve all account entries dating back to the timestamp passed into this BeginDate field up until the timestamp passed into the EndDate field. The BeginDate value can not be set back any further than four months into the past. The allowed date formats are YYYY-MM-DD and YYYY-MM-DD HH:mm:ss The BeginDate value must be less than or equal to the EndDate value. The user might use the same values in both fields if that user wanted to retrieve all account entries from a specific day (if YYYY-MM-DD format used) or wanted to retrieve a specific account entry (if YYYY-MM-DD HH:mm:ss format used). This field is only applicable if the AccountHistorySelection value is set to 'BetweenSpecifiedDates'; otherwise, this field will be ignored. fiedDates' is used, both the BeginDate and EndDate must be included. |
| EndDate | dateTime | [0..1] | This field is used to retrieve all account entries dating up to the timestamp passed into this EndDate field dating back to the timestamp passed into the BeginDate field. The EndDate value can not be set for a future date. The allowed date formats are YYYY-MM-DD and YYYY-MM-DD HH:mm:ss The EndDate value must be more than or equal to the BeginDate value. The user might use the same values in both fields if that user wanted to retrieve all account entries from a specific day (if YYYY-MM-DD format used) or wanted to retrieve a specific account entry (if YYYY-MM-DD HH:mm:ss format used). This field is only applicable if the AccountHistorySelection value is set to 'BetweenSpecifiedDates'; otherwise, this field will be ignored. If 'BetweenSpecifiedDates' is used, both the BeginDate and EndDate must be included. |
| Pagination | PaginationType | [0..1] | This container is used to control how many account entries are returned on each page of data in the response. PaginationType is used by numerous Traditional API calls, and the default and maximum values for the EntriesPerPage field differs with each call. For the GetAccount call, the default value is 500 (account entries) per page, and maximum allowed value is 2000 (account entries) per page. |
| ExcludeBalance | boolean | [0..1] | By default, the current balance of the user's account will not be returned in the call response. To retrieve the current balance of their account, the user should include the ExcludeBalance flag in the request and set its value to 'false'. The current balance on the account will be shown in the AccountSummary.CurrentBalance field in the call response. |
| ExcludeSummary | boolean | [0..1] | Specifies whether to return account summary information in an AccountSummary node. Default is true, to return AccountSummary. |
| IncludeConversionRate | boolean | [0..1] | Specifies whether to retrieve the rate used for the currency conversion for usage transactions. |
| IncludeNettedEntries | boolean | [0..1] | Include this field and set it to true to retrieve the total net amount of all charges/fees that have been deducted from seller payouts instead of being invoiced to the seller. The total net amount of any seller credits related to these fees is also shown. These fees and credit amounts will be shown in the AccountSummary.NettedTransactionSummary container in the response. |
| AccountEntrySortType | AccountEntrySortTypeCodeType | [0..1] | Specifies how account entries should be sorted in the response, by an element and then in ascending or descending order. |
| Currency | CurrencyCodeType | [0..1] | Specifies the currency used in the account report. Do not specify Currency in the request unless the following conditions are met. First, the user has or had multiple accounts under the same UserID. Second, the account identified in the request uses the currency you specify in the request. An error is returned if no account is found that uses the currency you specify in the request. |
| ItemID | ItemIDType | [0..1] | Specifies the item ID for which to return account entries. If ItemID is used, all other filters in the request are ignored. If the specified item does not exist or if the requesting user is not the seller of the item, an error is returned. |
| OrderID | string | [0..1] | The unique identifier of an eBay order. This field must be included if the value of the AccountHistorySelection filter is set to OrderId . A user can filter by order ID to see if there are specific account entries related to a specific eBay order. It is possible that no account entries will be found directly related to the specified order ID, and if this is the case, no AccountEntries container will be returned, and the ack value will still be Success . Note: Note that the unique identifier of a 'non-immediate payment' order will change as it goes from an unpaid order to a paid order. Due to this scenario, all calls that accept Order ID values as request filters/parameters, including the GetAccount call, will support the identifiers for both unpaid and paid orders. Sellers can check to see if an order has been paid by looking for a value of 'Complete' in the CheckoutStatus.Status field in the response of GetOrders call, or in the Status.CompleteStatus field in the response of GetItemTransactions or GetSellerTransactions call. Sellers should not fulfill orders until buyer has made payment. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<GetAccountRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Input Fields -->
  <AccountEntrySortType></AccountEntrySortType>
  <AccountHistorySelection></AccountHistorySelection>
  <BeginDate>dateTime</BeginDate>
  <Currency></Currency>
  <EndDate>dateTime</EndDate>
  <ExcludeBalance>boolean</ExcludeBalance>
  <ExcludeSummary>boolean</ExcludeSummary>
  <IncludeConversionRate>boolean</IncludeConversionRate>
  <IncludeNettedEntries>boolean</IncludeNettedEntries>
  <ItemID></ItemID>
  <OrderID>string</OrderID>
  <Pagination>
    <EntriesPerPage>int</EntriesPerPage>
    <PageNumber>int</PageNumber>
  </Pagination>
  <!-- Standard Input Fields -->
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <OutputSelector>string</OutputSelector>
  <!-- ... more OutputSelector values allowed here ... -->
  <Version>string</Version>
  <WarningLevel></WarningLevel>
</GetAccountRequest>
```

### GetAccountResponseType

**Description:** Returns information about an eBay seller's own account.

| Field | Type | Occurrence | Description |
|-------|------|------------|-------------|
| AccountID | string | [0..1] | Specifies the seller's unique account number. |
| FeeNettingStatus | FeenettingStatusCodeType | [0..1] | This enumeration value indicates the current status of the seller's account for the fee netting mechanism. If the Enabled value is returned, the seller may include the IncludeNettedEntries field in the request to retrieve the total net amount of all charges/fees that have been deducted from seller payouts instead of being invoiced to the seller. The total net amount of any seller credits related to these fees is also shown in the AccountSummary.NettedTransactionSummary container in the response. |
| AccountSummary | AccountSummaryType | [0..1] | Contains summary data for the seller's account, such as the overall balance, bank account and credit card information, and amount and date of any past due balances. Can also contain data for one or more additional accounts, if the user has changed country of residence. |
| Currency | CurrencyCodeType | [0..1] | Indicates the currency used for monetary amounts in the report. |
| AccountEntries | AccountEntriesType | [0..1] | This container holds an array of account entries. The account entries that are returned are dependent on the selection that the user made in the AccountHistorySelection field in the call request. Each AccountEntry container consists of one credit, one debit, or one administrative action on the account. It is possible that no AccountEntry containers will be returned if no account entries exist since the last invoice (if LastInvoice value is used), between the specified dates (if BetweenSpecifiedDates value is used), or no entries exist for an order (if OrderId value is used). |
| PaginationResult | PaginationResultType | [0..1] | This container shows the total number of account entries and the total number of account entry pages that exist based on the filters used in the GetAccount call request. The total number of account entry pages is partly controlled by the Pagination.EntriesPerPage value that is set in the request. |
| HasMoreEntries | boolean | [0..1] | If this boolean value is returned as 'true', there are more account entries to view on one or more pages of data. To view additional entries, the user would have to make additional GetAccount calls and increment the value of the Pagination.PageNumber field by '1' to view additional pages of account entries. |
| EntriesPerPage | int | [0..1] | This integer value indicates the number of account entries that are being returned per virtual page of data. This value will be the same value passed into the Pagination.EntriesPerPage field in the request. |
| PageNumber | int | [0..1] | This integer value indicates the current page number of account entries that is currently being shown. This value will be the same value passed into the Pagination.PageNumber field in the request. |

**XML Example:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<GetAccountResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <!-- Call-specific Output Fields -->
  <AccountEntries>
    <AccountEntry>
      <AccountDetailsEntryType></AccountDetailsEntryType>
      <Balance currencyID="CurrencyCodeType">
      </Balance>
      <ConversionRate currencyID="CurrencyCodeType">
      </ConversionRate>
      <Date>dateTime</Date>
      <Description>string</Description>
      <DiscountDetail>
        <Discount>
          <Amount currencyID="CurrencyCodeType">
          </Amount>
          <DiscountType>string</DiscountType>
        </Discount>
        <!-- ... more Discount nodes allowed here ... -->
      </DiscountDetail>
      <GrossDetailAmount currencyID="CurrencyCodeType">
      </GrossDetailAmount>
      <ItemID></ItemID>
      <Memo>string</Memo>
      <NetDetailAmount currencyID="CurrencyCodeType">
      </NetDetailAmount>
      <Netted>boolean</Netted>
      <OrderId>string</OrderId>
      <OrderLineItemID>string</OrderLineItemID>
      <ReceivedTopRatedDiscount>boolean</ReceivedTopRatedDiscount>
      <RefNumber>string</RefNumber>
      <Title>string</Title>
      <TransactionID>string</TransactionID>
      <VATPercent>decimal</VATPercent>
    </AccountEntry>
    <!-- ... more AccountEntry nodes allowed here ... -->
  </AccountEntries>
  <AccountID>string</AccountID>
  <AccountSummary>
    <AccountState></AccountState>
    <AdditionalAccount>
      <AccountCode>string</AccountCode>
      <Balance currencyID="CurrencyCodeType">
      </Balance>
      <Currency></Currency>
    </AdditionalAccount>
    <!-- ... more AdditionalAccount nodes allowed here ... -->
    <AmountPastDue currencyID="CurrencyCodeType">
    </AmountPastDue>
    <BankAccountInfo>string</BankAccountInfo>
    <BankModifyDate>dateTime</BankModifyDate>
    <BillingCycleDate>int</BillingCycleDate>
    <CreditCardExpiration>dateTime</CreditCardExpiration>
    <CreditCardInfo>string</CreditCardInfo>
    <CreditCardModifyDate>dateTime</CreditCardModifyDate>
    <CurrentBalance currencyID="CurrencyCodeType">
    </CurrentBalance>
    <InvoiceBalance currencyID="CurrencyCodeType">
    </InvoiceBalance>
    <InvoiceCredit currencyID="CurrencyCodeType">
    </InvoiceCredit>
    <InvoiceDate>dateTime</InvoiceDate>
    <InvoiceNewFee currencyID="CurrencyCodeType">
    </InvoiceNewFee>
    <InvoicePayment currencyID="CurrencyCodeType">
    </InvoicePayment>
    <LastAmountPaid currencyID="CurrencyCodeType">
    </LastAmountPaid>
    <LastPaymentDate>dateTime</LastPaymentDate>
    <NettedTransactionSummary>
      <TotalNettedChargeAmount currencyID="CurrencyCodeType">
      </TotalNettedChargeAmount>
      <TotalNettedCreditAmount currencyID="CurrencyCodeType">
      </TotalNettedCreditAmount>
    </NettedTransactionSummary>
    <PastDue>boolean</PastDue>
    <PaymentMethod></PaymentMethod>
  </AccountSummary>
  <Currency></Currency>
  <EntriesPerPage>int</EntriesPerPage>
  <FeeNettingStatus></FeeNettingStatus>
  <HasMoreEntries>boolean</HasMoreEntries>
  <PageNumber>int</PageNumber>
  <PaginationResult>
    <TotalNumberOfEntries>int</TotalNumberOfEntries>
    <TotalNumberOfPages>int</TotalNumberOfPages>
  </PaginationResult>
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
</GetAccountResponse>
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

1. Account information is scoped to the authenticated seller.

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

1. Review the request and response XML samples from source before using this operation in production.
2. Prefer the mapped modern API in the Migration Path section when planning new integrations.
3. Keep generated documentation aligned with extracted WSDL metadata and avoid filling gaps with assumptions.

---

## Migration Path

### New API Equivalent

| SOAP Operation | New API | Type |
|----------------|---------|------|
| GetAccount | Finance API getBillingActivitiesgetTransactions | GET |

---

*Source: `src-skills/api-guide-generator/references/jsonl-docs/developer_ebay_com_devzone_xml_docs_reference_ebay_getaccount_html.jsonl`; `.trace_artifacts/extract_wsdl_getaccount.txt` | Generated: 2026-03-26 | Template Version: 1.0.0*
