# GetAccount — Example

## Request Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetAccountRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>A3</eBayAuthToken>
  </RequesterCredentials>
  <AccountEntrySortType>AccountEntryFeeTypeAscending</AccountEntrySortType>
  <AccountHistorySelection>LastInvoice</AccountHistorySelection>
</GetAccountRequest>
```

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

## Response Example

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
