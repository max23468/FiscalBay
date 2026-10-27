---
title: Finances API
description: "The **Finances API** retrieves a variety of seller transactional information, including the following: * Seller payouts for orders * Detailed information on other transaction types, including eBay shipping label purchases, buyer refunds, seller credits, and listing-related fees * Complete list of selling fees and credits during a specified date range * A detailed breakdown of order earnings and seller expenses for orders"
api_version: v1.19.0
api_name: finances_api
api_type: REST
api_group: finances/api
source_url:
  html: https://developer.ebay.com/develop/api/finances/api
  md: https://developer.ebay.com/develop/api/finances/api.md
---
# Finances API

## API Methods

### getTransactions

#### GET /transaction
**Description:** **Important!** Due to EU & UK Payments regulatory requirements, an additional security verification via Digital Signatures is required for certain API calls that are made on behalf of EU/UK sellers, including all **Finances API** methods. Please refer to [Digital Signatures for APIs](/develop/guides/digital-signatures-for-apis ) to learn more on the impacted APIs and the process to create signatures to be included in the HTTP payload.

  
**Note:** The **Finances API** does not support [Team Access](https://www.ebay.com/sellercenter/ebay-for-business/multi-user-account-access). Financial information, such as payouts or transactions, is only returned for the user that makes the call. You cannot use any of the methods in this API to return financial information for another user.  
The **getTransactions** method allows a seller to retrieve information about one or more of their monetary transactions.  
  
**Note:** For a complete list of transaction types, refer to [TransactionTypeEnum](/develop/api/sell/finances_api#sell-finances_api-transaction-gettransactions.transactiontypeenum ).  
Numerous input filters are available which can be used individually or combined to refine the data that are returned. For example:

*   `SALE` transactions for August 15, 2022;
*   `RETURN` transactions for the month of January, 2021;
*   Transactions currently in a `transactionStatus` equal to `FUNDS_ON_HOLD`.

Refer to the [filter](/develop/api/sell/finances_api#sell-finances_api-transaction-gettransactions-param-filter) field for additional information about each filter and its use.  
  
Pagination and sort query parameters are also provided that allow users to further control how monetary transactions are displayed in the response.  
  
If no monetary transactions match the input criteria, an http status code of _204 No Content_ is returned with no response payload.  
  
**Note:** Only monetary transactions that have occurred within the last five years can be retrieved.
**Parameters:**
- **X-EBAY-C-MARKETPLACE-ID** (string) *required*
  - This header identifies the seller's eBay marketplace.  
  
See [Request Headers](/develop/api/sell/request_headers#marketplace-id-values ) for the marketplace ID values.  
  
**Note:** If a marketplace ID value is not provided, the default value of `EBAY_US` is used.
- **filter** (string)
  - Numerous filters are available for the **getTransactions** method, and these filters are discussed below. One or more of these filter types can be used. If none of these filters are used, all monetary transactions occurring within the last five years are returned:

*   **transactionDate**: search for monetary transactions that occurred within a specific range of dates.  
      
    **Note:** All dates must be input using UTC format (`YYYY-MM-DDTHH:MM:SS.SSSZ`) and should be adjusted accordingly for the local timezone of the user.  
    Below is the proper syntax to use if filtering by a date range:  
      
    `https://apiz.ebay.com/sell/finances/v1/transaction?filter=transactionDate:[2024-10-23T00:00:01.000Z..2024-11-09T00:00:01.000Z]`  
      
    Only payouts from the last five years can be retrieved, so make sure the starting date is less than five years in the past from the present time. Also, the maximum date range that can be specified through this date filter is 36 months, so make sure your specified date range is no more than 36 months.
*   **transactionType**: search for a specific type of monetary transaction. For supported **transactionType** values, see [TransactionTypeEnum](/develop/api/sell/finances_api#sell-finances_api-transaction-gettransactions.transactiontypeenum).  
      
    Below is the proper syntax to use if filtering by a monetary transaction type:  
      
    `https://apiz.ebay.com/sell/finances/v1/transaction?filter=transactionType:{SALE}`
*   **transactionStatus**: this filter type is only applicable for sales orders, and allows the user to filter seller payouts in a particular state. For supported **transactionStatus** values, see [TransactionStatusEnum](/develop/api/sell/finances_api#sell-finances_api-transaction-gettransactions.transactionstatusenum).  
      
    Below is the proper syntax to use if filtering by transaction status:  
      
    `https://apiz.ebay.com/sell/finances/v1/transaction?filter=transactionStatus:{PAYOUT}`
*   **buyerUsername**: the eBay username or user ID of the buyer involved in the monetary transaction. Only monetary transactions involving this buyer are returned. Below is the proper syntax to use if filtering by a specific eBay buyer:  
      
    `https://apiz.ebay.com/sell/finances/v1/transaction?filter=buyerUsername:{buyer1234}`
*   **payoutId**: the unique identifier of a seller payout. This value is auto-generated by eBay once the seller payout is set to be processed. Only monetary transactions involving this Payout ID are returned. Below is the proper syntax to use if filtering by a specific Payout ID:  
      
    `https://apiz.ebay.com/sell/finances/v1/transaction?filter=payoutId:{5********8}`
*   **transactionId**: use this field **transactionId** and also **transactionType** to filter for a unique identifier of a monetary transaction, or an error will occur. For a sales order, the **orderId** filter should be used instead. Only the monetary transaction defined by the identifier is returned.  
      
    **Note:** This filter cannot be used alone; the **transactionType** must also be specified when filtering by transaction ID.  
    Below is the proper syntax to use if filtering by a specific transaction ID:  
      
    `https://apiz.ebay.com/sell/finances/v1/transaction?filter=transactionId:{0*-0***0-3***3}&filter=transactionType:{SALE}`
*   **orderId**: the unique identifier of a sales order. Only monetary transaction(s) associated with this **orderId** value are returned.  
      
    For any other monetary transaction, the **transactionId** filter should be used instead.  
      
    Below is the proper syntax to use if filtering by a specific order ID:  
      
    `https://apiz.ebay.com/sell/finances/v1/transaction?filter=orderId:{0*-0***0-3***3}`
*   **payoutReference**: returns the monetary transactions associated with the **payoutReference**. By using this ID as a filter parameter, the user will be able to track all monetary transactions associated with both sibling payouts, including sales and refunds, if any. This filter is **only** supported for sellers in Mainland China. Below is the proper syntax to use if filtering by **payoutReference**:  
      
    `https://apiz.ebay.com/sell/finances/v1/transaction?filter=payoutReference:{5*******3}`
- **limit** (string)
  - The number of monetary transactions to return per page of the result set. Use this parameter in conjunction with the **offset** parameter to control the pagination of the output.  
  
For example, if **offset** is set to `10` and **limit** is set to `10`, the method retrieves monetary transactions 11 thru 20 from the result set.  
  
**Note:** This feature employs a zero-based list, where the first item in the list has an offset of `0`.  
  
**Maximum:** `1000`  
**Default:** `20`
- **offset** (string)
  - This integer value indicates the actual position that the first monetary transaction returned on the current page has in the results set. So, if you wanted to view the 11th monetary transaction of the result set, you would set the **offset** value in the request to `10`.  
  
In the request, you can use the **offset** parameter in conjunction with the **limit** parameter to control the pagination of the output. For example, if **offset** is set to `30` and **limit** is set to `10`, the method retrieves transactions 31 thru 40 from the resulting collection of transactions.  
  
To avoid poor response time, use **offset** values of less than `5000`.  
  
**Note:** This feature employs a zero-based list, where the first item in the list has an offset of `0`.  
**Default:** `0` (zero)
- **sort** (string)
  - By default, monetary transactions that match the input criteria are sorted in descending order according to the transaction date (i.e, most recent transactions returned first).  
  
To view transactions in ascending order instead (i.e., oldest transactions first), you would include the **sort** query parameter and set its value to `transactionDate`. Below is the proper syntax to use if filtering by a transaction date range in ascending order:  
  
`https://apiz.ebay.com/sell/finances/v1/transaction?filter=transactionDate:[2023-10-01T00:00:01.000Z..2023-10-12T00:00:01.000Z]&sort=transactionDate`  
  
Transactions can only be sorted according to transaction date.
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope/sell.finances`

## Shared Types

Shared API-level schema and common type definitions live in [Finances API_shared.md](Finances API_shared.md).
