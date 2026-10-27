---
title: Return
description: "The **Return API** lets sellers manage returns at the line-item level. It provides queries to retrieve a specific return and list seller returns, and mutations to initiate in-store returns, message buyers, approve/decline, attach or record labels, provide RMA, record receipt of returned item, and process refunds. Sellers can manage shipment labels by uploading using the **Media API** and attaching them with the **attachReturnShipmentLabel** mutation."
api_version: 1.0
api_name: sell_return
api_type: GraphQL
api_group: sell/return
source_url:
  html: https://developer.ebay.com/develop/api/sell/return
  md: https://developer.ebay.com/develop/api/sell/return.md
---

# Return API

The **Return API** lets sellers manage returns at the line-item level. It provides queries to retrieve a specific return and list seller returns, and mutations to initiate in-store returns, message buyers, approve/decline, attach or record labels, provide RMA, record receipt of returned item, and process refunds. Sellers can manage shipment labels by uploading using the **Media API** and attaching them with the **attachReturnShipmentLabel** mutation.

## GraphQL Schema Information

**Queries:** 2
**Mutations:** 11
**Types:** 1394


## Types

### ReturnActionNotPermittedError
**Description:** The error type indicates when an action is not allowed. This is used when a user attempts to perform an action they don't have permission for, or when the action is not valid in the current state.
**Type:** GraphQLObjectType

**Properties:**
- **availableActions** ([ReturnAction!])
  - A list of one or more actions that are available to the user in the current state. This can be used to guide the user on what actions they can take.
- **errorCode** (String!)
  - A machine-readable error code: \`RTRN\_ACTION\_NOT\_PERMITTED\`
- **errorMessage** (String!)
  - A human-readable error message. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters

### AddToWatchListFailure
**Description:** This type indicates that the \*\*addToWatchList\*\* mutation failed. All requested items failed to be added to the user's Watchlist. The unique identifier of each item that failed to be added to the Watchlist is returned, alongside the reason each failed. This type also returns the total number of items being watched by the user after the failed mutation and the maximum number of items they can add to their Watchlist.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A unique identifier for this specific business error type. This code can be used by clients to programmatically identify and handle different types of errors without relying on error messages, which may change over time. Each error type will always return the same \*\*errorCode\*\* value. \*\*Note\*\*: This field will always return \`WTCHL\_ALL\_FAILURE\` in this context. \*\*Maximum length\*\*: 40 characters \*\*Format\*\*: Alphanumeric characters and underscores, in UPPER\_CASE format
- **errorMessage** (String!)
  - A human-readable message describing the error. This message is intended for developers and should not be displayed directly to end users. It provides additional context about what went wrong and may include suggestions for how to resolve the issue. \*\*Maximum length\*\*: 500 characters \*\*Format\*\*: Alphanumeric characters, spaces, and common punctuation
- **failedItems** ([WatchListAddFailure!]!)
  - This array returns the unique identifier(s) of the item(s) that failed to be added to the user's Watchlist, along with the reason each failed.
- **watchListCount** (Int!)
  - The current total number of items in the user's Watchlist.
- **watchListMaximum** (Int!)
  - The maximum number of items allowed in the user's Watchlist.

### AddToWatchListPartialFailure
**Description:** This type indicates that the \*\*addToWatchList\*\* mutation partially failed. Some of the specified items were successfully added to the user's Watchlist, but one or more failed to be added. The unique identifier of each item that was successfully added to the Watchlist is returned. In addition, the unique identifier of each item that failed to be added to the Watchlist is returned, alongside the reason each failed. This type also returns the total number of items being watched by the user after the partially failed mutation and the maximum number of items they can add to their Watchlist.
**Type:** GraphQLObjectType

**Properties:**
- **addedItems** ([Item!]!)
  - This array returns the unique identifier(s) of the item(s) that were successfully added to the user's Watchlist.
- **errorCode** (String!)
  - A unique identifier for this specific business error type. This code can be used by clients to programmatically identify and handle different types of errors without relying on error messages, which may change over time. Each error type will always return the same \*\*errorCode\*\* value. \*\*Note\*\*: This field will always return \`WTCHL\_PARTIAL\_FAILURE\` in this context. \*\*Maximum length\*\*: 40 characters \*\*Format\*\*: Alphanumeric characters and underscores, in UPPER\_CASE format
- **errorMessage** (String!)
  - A human-readable message describing the error. This message is intended for developers and should not be displayed directly to end users. It provides additional context about what went wrong and may include suggestions for how to resolve the issue. \*\*Maximum length\*\*: 500 characters \*\*Format\*\*: Alphanumeric characters, spaces, and common punctuation
- **failedItems** ([WatchListAddFailure!]!)
  - This array returns the unique identifier(s) of the item(s) that failed to be added to the user's Watchlist, along with the reason each failed.
- **watchListCount** (Int!)
  - The current total number of items in the user's Watchlist.
- **watchListMaximum** (Int!)
  - The maximum number of items allowed in the user's Watchlist.

### ApproveReturnInputValidationError
**Description:** This error type indicates that one or more validation errors occurred while approving the return request.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A machine-readable error code: \`RTRN\_APPROVE\_VALIDATION\_ERROR.\`
- **errorMessage** (String!)
  - A human-readable error message describing the issue. \*\*Maximum length:\*\* 512 characters
- **violations** ([ApproveReturnInputViolation!]!)
  - This array contains details about one or more specific request violations.

### AttachReturnShipmentLabelInputValidationError
**Description:** This error type indicates that one or more validation errors occurred while attaching the return shipment label.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A machine-readable error code: \`RTRN\_ATTACH\_LABEL\_VALIDATION\_ERROR\`
- **errorMessage** (String!)
  - A human-readable error message describing the issue. \*\*Maximum length:\*\* 512 characters
- **violations** ([AttachReturnShipmentLabelInputViolation!]!)
  - This array contains details about one or more specific request violations.

### BulkUpdateInventoryFailure
**Description:** This output type is used when a \*\*bulkUpdateInventory\*\* mutation fails, and includes the identifiers of the items that failed to be updated and the error associated with the failure.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - This field shows the unique identifier of the error that was triggered, and the value should always be \`LSTNG\_BULK\_UPDATE\_INVENTORY\_FAILURE\_ERROR\`.
- **errorMessage** (String!)
  - An error message providing the reason for the failure. This text will be in English, regardless of the listing marketplace.
- **failures** ([UpdateInventoryFailure!]!)
  - This array will include the identifiers of the items that failed to be updated, and will also include the error(s) and any non-blocking warnings that were triggered for any of those items being updated.

### BulkUpdateInventoryPartialFailure
**Description:** This output type is used when a \*\*bulkUpdateInventory\*\* mutation is partially successful, where one or more items were successfully updated, but one or more other items failed to be updated. The \*\*successes\*\* array will show the identifiers of the items that were successfully updated, the \*\*failures\*\* array will show the identifiers of the items that failed to be updated, and the error fields will provide more details on the issue(s) that caused the mutation to only be partially successful.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - This field shows the unique identifier of the error that was triggered, and the value should always be \`LSTNG\_BULK\_UPDATE\_INVENTORY\_PARTIAL\_FAILURE\_ERROR\`.
- **errorMessage** (String!)
  - An error message providing the reason for the partial failure. This text will be in English, regardless of the listing marketplace.
- **failures** ([UpdateInventoryFailure!]!)
  - This array will include the identifiers of the items that failed to be updated, and will also include the error(s) and any non-blocking warnings that were triggered for any of those items that failed to be updated.
- **successes** ([UpdateInventorySuccess!]!)
  - This array will include the identifiers of the items that were successfully updated, and will also include any non-blocking warnings that were triggered for any of those items that were updated.

### BulkUpdateItemCommitmentTagsCompleteFailure
**Description:** This output type is used when a \*\*bulkUpdateItemCommitmentTags\*\* mutation fails completely, and none of the specified item commitments are updated with new custom tags or deleted custom tags. The \*\*failures\*\* array will show the identifiers of the item commitments whose custom tags failed to be updated, and the error fields will provide more details on the issue(s) that caused the mutation to fail.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The unique identifier of the error. \*\*Note\*\*: Currently this field will always show \`UPDATE\_ITEM\_COMMITMENT\_TAGS\_COMPLETE\_FAILURE\`.
- **errorMessage** (String!)
  - The developer-friendly description of the error is shown in this field.
- **failures** ([UpdateItemCommitmentError!]!)
  - This array shows the full list of item commitments that failed to be updated with new custom tags or deleted custom tags.

### BulkUpdateItemCommitmentTagsPartialFailure
**Description:** This output type is used when a \*\*bulkUpdateItemCommitmentTags\*\* mutation is partially successful, where one or more specified custom tags operations in one or more item commitments were successfully performed, but one or more other specified custom tags operations in one or more item commitments failed. The \*\*updatedItemCommitments\*\* array will display all item commitments whose custom tags were updated, the \*\*failures\*\* array will show the identifiers of the item commitments whose custom tags failed to be updated, and the error fields will provide more details on the issue(s) that caused the mutation to only be partially successful.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The unique identifier of the error. \*\*Note\*\*: Currently this field will always show \`UPDATE\_ITEM\_COMMITMENT\_TAGS\_PARTIAL\_FAILURE\`.
- **errorMessage** (String!)
  - The developer-friendly description of the error is shown in this field.
- **failures** ([UpdateItemCommitmentError!]!)
  - This array shows the full list of item commitments that failed to be updated with new custom tags or deleted custom tags.
- **updatedItemCommitments** ([ItemCommitment!]!)
  - This array shows the full list of item commitments that were successfully updated with new custom tags or deleted custom tags.

### BulkUpdateOrderTagsCompleteFailure
**Description:** This type represents a complete failure for a \*\*bulkUpdateOrderTags\*\* mutation. The return includes the orders that could not be updated with the tags specified in the request. \*\*Note:\*\* No order's tag was successfully updated.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The machine-readable error code for this business error. Value: \`UPDATE\_ORDER\_TAGS\_COMPLETE\_FAILURE\`.
- **errorMessage** (String!)
  - A human-readable description of the error message. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **failures** ([UpdateOrderError!]!)
  - This array lists one or more orders that could not be updated. \*\*Note:\*\* This list is never empty.

### BulkUpdateOrderTagsPartialFailure
**Description:** This type represents a partial success and partial failure for a \*\*bulkUpdateOrderTags\*\* mutation. The return includes both the orders that that tags were successfully updated and those that could not be updated with the tags specified in the request.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The machine-readable error code for this business error. Value: \`UPDATE\_ORDER\_TAGS\_PARTIAL\_FAILURE\`.
- **errorMessage** (String!)
  - A human-readable description of the error message. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **failures** ([UpdateOrderError!]!)
  - This array lists one or more orders that could not be updated. \*\*Note:\*\* This list is never empty.
- **updatedOrders** ([Order!]!)
  - List of orders successfully updated (may be empty).

### BulkUpdatePurchaseQuotesCompleteFailure
**Description:** This output type is used when a \*\*bulkUpdatePurchaseQuotes\*\* mutation fails, and none of the purchase quotes were successfully updated. The \*\*failures\*\* array will show the identifiers of the purchase quotes that failed to be updated, and the error fields will provide more details on the issue(s) that caused the mutation to fail.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The unique identifier of the error. \*\*Note\*\*: Currently this field will always show \`UPDATE\_QUOTES\_COMPLETE\_FAILURE\`.
- **errorMessage** (String!)
  - The developer-friendly description of the error is shown in this field.
- **failures** ([UpdatePurchaseQuoteError!]!)
  - This array contains the unique identifiers of all purchase quotes that were not successfully updated, and the error(s) that caused them not to be updated.

### BulkUpdatePurchaseQuotesPartialFailure
**Description:** This output type is used when a \*\*bulkUpdatePurchaseQuotes\*\* mutation is partially successful, where one or more purchase quotes are successfully updated, but one or more other purchase quotes failed to be updated. The \*\*updatedPurchaseQuotes\*\* array will display all purchase quotes that were successfully updated, the \*\*failures\*\* array will show the identifiers of the purchase quotes that failed to be updated (and the error(s) that led to failure), and the error fields will provide more details on the issue(s) that caused the mutation to only be partially successful.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The unique identifier of the error. \*\*Note\*\*: Currently this field will always show \`UPDATE\_QUOTES\_PARTIAL\_FAILURE\`.
- **errorMessage** (String!)
  - The developer-friendly description of the error is shown in this field.
- **failures** ([UpdatePurchaseQuoteError!]!)
  - This array contains the unique identifiers of all purchase quotes that were not updated successfully, and the error(s) that caused them not to be updated. \*\*Note\*\*: There will always be at one object in this array.
- **updatedPurchaseQuotes** ([PurchaseQuote!]!)
  - This array contains all of the successfully updated purchase quotes. \*\*Note\*\*: There will always be at one object in this array.

### CommitToPurchaseBusinessRulesViolated
**Description:** This type represents a business error that occurs due to business rule violations during the execution of a commitment action.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The globally unique error code for the \`COMMT\_BUSINESS\_RULES\_VIOLATED\` business error type.
- **errorMessage** (String!)
  - A human-readable message describing the error. This message is intended for developers and should not be displayed directly to end users. It provides additional context about what went wrong and may include suggestions for how to resolve the issue. \*\*Maximum length\*\*: 500 characters
- **violations** ([CommitmentBusinessRuleViolation!]!)
  - The specific business rules that were violated. This field can return multiple violations simultaneously.

### ContractCancellationActionNotPermittedError
**Description:** This error type provides details when a contract cancellation action is not permitted. It describes the business constraints on the contract cancellation prohibiting current user from taking the action. If an alternative action is available, it is returned in \`availableActions\`.
**Type:** GraphQLObjectType

**Properties:**
- **availableActions** ([ContractCancellationAction!])
  - Permitted actions that user could take based on the current cancellation status.
- **errorCode** (String!)
  - The globally unique error code for this business error. For this type, the value is \`CNCL\_ACTION\_NOT\_PERMITTED\_ERROR\`.
- **errorMessage** (String!)
  - A human-readable description of the error message. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters

### ContractCancellationInvalidDateRangeError
**Description:** This type indicates the specified date range exceeds the allowed limit or has invalid start or end date order.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The machine-readable error code for this business error type. For this type, the value is \`CNCL\_INVALID\_DATE\_RANGE\`
- **errorMessage** (String!)
  - A human-readable error message. For this type, the value is \`The specified date range exceeds the allowed limit or has an invalid start and end date order.\`. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters

### ContractCancellationInvalidPageSizeError
**Description:** This type indicates the specified page size exceeds the allowed limit.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The machine-readable error code for this business error type. For this type, the value is \`CNCL\_INVALID\_PAGE\_SIZE\`
- **errorMessage** (String!)
  - A human-readable error message. For this type, the value is \`The specified page size exceeds the allowed limit.\` This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **maxAllowedPageSize** (Int!)
  - The maximum allowed page size for this query.

### ContractCancellationInvalidSearchInputError
**Description:** This type indicates that the search request failed to include either the initial search input or valid page cursor information.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The machine-readable error code for this business error type. For this type, the value is \`CNCL\_INVALID\_SEARCH\_INPUT\`.
- **errorMessage** (String!)
  - A human-readable error message. For this type, the value is \`The search request must include either initial search input or valid page cursor information.\` This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters

### ContractCancellationNotFoundError
**Description:** This error type indicates the specified cancellation cannot be found.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The machine-readable error code for this business error. For this type, the value is \`CNCL\_NOT\_FOUND\_ERROR\`.
- **errorMessage** (String!)
  - A human-readable description of the error message. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **requestedContractCancellationId** (ID!)
  - The requested contract cancellation Id that was not found.

### CreateInStoreReturnInputValidationError
**Description:** This error type indicates that one or more validation errors occurred while creating the in-store return request.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A machine-readable error code: \`RTRN\_CREATE\_IN\_STORE\_VALIDATION\_ERROR.\`
- **errorMessage** (String!)
  - A human-readable error message describing the issue. \*\*Maximum length:\*\* 512 characters
- **violations** ([CreateInStoreReturnInputViolation!]!)
  - This array contains details about one or more specific request violations.

### CreateListingValidationError
**Description:** This type is used when the \*\*createListing\*\* mutation fails due to one or more blocking validation errors. A list of validation rule violations that must be fixed before retrying will be shown, and one or more non-blocking warning messages will also be shown if any were triggered during the processing of the mutation.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The unique identifier of the error. This code can be used by clients to programmatically identify and handle different types of errors without relying on error messages, which may change over time.
- **errorMessage** (String!)
  - A human-readable message describing the error. This message is intended for developers and should not be displayed directly to end users. It provides additional context about what went wrong and may include suggestions for how to resolve the issue.
- **violations** ([ListingValidationRuleViolation!]!)
  - This array contains a list of blocking validation rule violations that must be fixed before retrying.
- **warnings** ([ListingWarning!])
  - This array contains a list of non-blocking validation warnings that do not block processing but provide useful feedback for improving listings.

### CreatePurchaseQuoteBusinessError
**Description:** This type is used when a business error occurs with a \*\*createPurchaseQuote\*\* mutation.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The unique identifier of the specific error. This code can be used by clients to programmatically identify and handle different types of errors without relying on error messages, which may change over time. \*\*Maximum length\*\*: 40 characters \*\*Format\*\*: Alphanumeric characters and underscores, in UPPER\_CASE format
- **errorMessage** (String!)
  - A human-readable message describing the error. This message is intended for developers and should not be displayed directly to end users. It provides additional context about what went wrong and may include suggestions for how to resolve the issue. \*\*Maximum length\*\*: 500 characters \*\*Format\*\*: Alphanumeric characters, spaces, and common punctuation
- **retryable** (Boolean!)
  - This boolean indicates whether or not the user should try to create the purchase quote again. If this field is returned as \`true\`, the user can make another attempt to create the purchase quote.

### CreateSecondChanceListingValidationError
**Description:** This type is used when the \*\*createSecondChanceListing\*\* mutation fails due to one or more blocking validation errors. A list of validation rule violations that must be fixed before retrying will be shown, and one or more non-blocking warning messages will also be shown if any were triggered during the processing of the mutation.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The unique identifier of the error. This code can be used by clients to programmatically identify and handle different types of errors without relying on error messages, which may change over time.
- **errorMessage** (String!)
  - A human-readable message describing the error. This message is intended for developers and should not be displayed directly to end users. It provides additional context about what went wrong and may include suggestions for how to resolve the issue.
- **violations** ([ListingValidationRuleViolation!]!)
  - This array contains a list of blocking validation rule violations that must be fixed before retrying.
- **warnings** ([ListingWarning!])
  - This array contains a list of non-blocking validation warnings that do not block processing but provide useful feedback for improving listings.

### DeclineCancellationInputValidationError
**Description:** This error type is returned when the decline cancellation request contains validation rule violations.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The globally unique error code for this business error. For this type, the value is \`CNCL\_DECLINE\_REQ\_VALIDATION\_RULE\_VIOLATION\`.
- **errorMessage** (String!)
  - A human-readable description of the error message. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **violations** ([DeclineCancellationViolation!]!)
  - A list of one or more validation violations for the decline cancellation request. This list is only returned when a violation is present.

### DeclineReturnInputValidationError
**Description:** This error type indicates that one or more validation errors occurred while declining the return request.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A machine-readable error code: \`RTRN\_DECLINE\_VALIDATION\_ERROR\`
- **errorMessage** (String!)
  - A human-readable error message describing the issue. \*\*Maximum length:\*\* 512 characters
- **violations** ([DeclineReturnInputViolation!]!)
  - This array contains details about one or more specific request violations.

### EndListingValidationError
**Description:** This type is used when the \*\*endListing\*\* mutation fails due to one or more blocking validation errors. A list of validation rule violations that must be fixed before retrying will be shown, and one or more non-blocking warning messages will also be shown if any were triggered during the processing of the mutation.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The unique identifier of the error. This code can be used by clients to programmatically identify and handle different types of errors without relying on error messages, which may change over time.
- **errorMessage** (String!)
  - A human-readable message describing the error. This message is intended for developers and should not be displayed directly to end users. It provides additional context about what went wrong and may include suggestions for how to resolve the issue.
- **violations** ([ListingValidationRuleViolation!]!)
  - This array contains a list of blocking validation rule violations that must be fixed before retrying.
- **warnings** ([ListingWarning!])
  - This array contains a list of non-blocking validation warnings that do not block processing but provide useful feedback for improving listings.

### InvalidExchangeScenarioInputError
**Description:** This type is used when currency conversion fails, provides details on why it failed.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The unique identifier of the error, which will be \`INVALID\_EXCHANGE\_SCENARIO\_INPUT\` when the input is invalid.
- **errorMessage** (String!)
  - A human-readable description of the validation failure.

### ItemCommitmentCancellationEligibilityError
**Description:** This type describes the commitment-level ineligibility reasons that prevented the cancellation of an item commitment. The \`ineligibilityReasons\` field contains the specific commitment-level failure reasons, explaining why the cancellation cannot be performed at this time. \*\*Note:\*\* Clients should use \*\*errorCode\*\* and \*\*ineligibilityReasons\*\* for programmatic handling; \*\*errorMessage\*\* is intended for display.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The machine-readable error code for this business error. For this type, the value is \`CNCL\_ITEM\_COMMITMENT\_ELIGIBILITY\_ERROR\`.
- **errorMessage** (String!)
  - A human-readable description of the error message. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **ineligibilityReasons** ([ItemCommitmentCancellationIneligibilityReason!]!)
  - A list of one or more item commitment-level contract cancellation ineligibility reasons that block creation of a cancellation. For example, \`CancellationExistsConflict\` applies when the whole order is already cancelled or a cancellation is in progress. This field is required and contains at least one reason when this error is returned.

### ItemCommitmentNotFoundError
**Description:** This error type indicates that the specified item commitment cannot be found.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The globally unique error code for this business error. For this type, the value is \`ITEM\_COMMITMENT\_NOT\_FOUND\`
- **errorMessage** (String!)
  - A human-readable description of the error message. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **itemCommitmentId** (ID!)
  - The item commitment ID that was not found.

### ItemCommitmentsByIdsCompleteFailure
**Description:** This output type is used when an \*\*itemCommitmentsByIds\*\* query fails, and none of the item commitments were successfully retrieved. The \*\*failures\*\* array will show the identifiers of the item commitments that failed to be retrieved, and the error fields will provide more details on the issue(s) that caused the query to fail.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The unique identifier of the error. \*\*Note\*\*: Currently this field will always show ITEM\_COMMITMENTS\_BY\_IDS\_COMPLETE\_FAILURE.
- **errorMessage** (String!)
  - The developer-friendly description of the error is shown in this field.
- **failures** ([ItemCommitmentsByIdsError!]!)
  - This array contains the unique identifiers of all item commitments that were not successfully retrieved, and the error(s) that caused them not to be retrieved.

### ItemCommitmentsByIdsPartialFailure
**Description:** This output type is used when an \*\*itemCommitmentsByIds\*\* query is partially successful, where one or more item commitments were successfully retrieved, but one or more other item commitments failed to be retrieved. The \*\*itemCommitments\*\* array will display all item commitments that were successfully retrieved, the \*\*failures\*\* array will show the identifiers of the item commitments that failed to be retrieved, and the error fields will provide more details on the issue(s) that caused the query to only be partially successful.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The unique identifier of the error. \*\*Note\*\*: Currently this field will always show ITEM\_COMMITMENTS\_BY\_IDS\_PARTIAL\_FAILURE.
- **errorMessage** (String!)
  - The developer-friendly description of the error is shown in this field.
- **failures** ([ItemCommitmentsByIdsError!]!)
  - This array contains the unique identifiers of all item commitments that were not successfully retrieved, and the error(s) that caused them not to be retrieved. \*\*Note\*\*: There will always be at one object in this array.
- **itemCommitments** ([ItemCommitment!])
  - This array contains all of the successfully retrieved item commitments.

### MarkItemCommitmentsPaidCompleteFailure
**Description:** This output type is used when a \*\*markItemCommitmentsPaid\*\* mutation fails completely, and none of the specified item commitments are marked as paid. The \*\*failures\*\* array will show the identifiers of the item commitments that failed to be marked as paid, and the error fields will provide more details on the issue(s) that caused the mutation to fail.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The unique identifier of the error. \*\*Note\*\*: Currently this field will always show \`MARK\_ITEM\_COMMITMENTS\_PAID\_COMPLETE\_FAILURE\`.
- **errorMessage** (String!)
  - The developer-friendly description of the error is shown in this field.
- **failures** ([UpdateItemCommitmentError!]!)
  - This array shows the full list of item commitments that failed to be marked as paid.

### MarkItemCommitmentsPaidPartialFailure
**Description:** This output type is used when a \*\*markItemCommitmentsPaid\*\* mutation is partially successful, where one or more specified item commitments were successfully marked as paid, but one or more other item commitments failed to be marked as paid. The \*\*markPaidItemCommitments\*\* array will display all item commitments that were successfully marked as paid, the \*\*failures\*\* array will show the identifiers of the item commitments that failed to be marked as paid, and the error fields will provide more details on the issue(s) that caused the mutation to only be partially successful.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The unique identifier of the error. \*\*Note\*\*: Currently this field will always show \`MARK\_ITEM\_COMMITMENTS\_PAID\_PARTIAL\_FAILURE\`.
- **errorMessage** (String!)
  - The developer-friendly description of the error is shown in this field.
- **failures** ([UpdateItemCommitmentError!]!)
  - This array shows the full list of item commitments that failed to be marked as paid.
- **markPaidItemCommitments** ([ItemCommitment!]!)
  - This array shows the full list of item commitments that were successfully marked as paid.

### MarkOrdersPaidCompleteFailure
**Description:** This type represents a complete failure for a \*\*markOrdersPaid\*\* mutation. The response includes the orders that could not be marked as paid as specified in the request. \*\*Note:\*\* No orders were successfully marked as paid.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The machine-readable error code for this business error. Value: \`MARK\_ORDERS\_PAID\_COMPLETE\_FAILURE\`.
- **errorMessage** (String!)
  - A human-readable description of the error message. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **failures** ([UpdateOrderError!]!)
  - This array lists one or more orders that could not be updated. \*\*Note:\*\* This list is never empty.

### MarkOrdersPaidPartialFailure
**Description:** This type represents a partial success for a \*\*markOrdersPaid\*\* mutation. The response includes both the orders that were successfully marked as paid and those that failed to update.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The machine-readable error code for this business error. Value: \`MARK\_ORDERS\_PAID\_PARTIAL\_FAILURE\`.
- **errorMessage** (String!)
  - A human-readable description of the error message. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **failures** ([UpdateOrderError!]!)
  - A list of one or more orders that could not be updated.
- **markPaidOrders** ([Order!]!)
  - A list of one or more orders successfully marked as paid.

### MultipleLineItemReturnNotSupportedError
**Description:** This error type indicates that the request contains multiple line items that exceed the maximum allowed limit.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A machine-readable error code: \`RTRN\_MULTIPLE\_LINE\_ITEM\_NOT\_SUPPORTED.\`
- **errorMessage** (String!)
  - A human-readable error message describing the issue. \*\*Maximum length:\*\* 512 characters
- **maxAllowed** (Int!)
  - The maximum number of line items allowed in a single request. \*\*Note:\*\* Currently, only one line item is allowed per request.
- **providedCount** (Int!)
  - Number of line items provided in the request.

### MultipleRefundTermsNotAllowedError
**Description:** This error type indicates that only one refund term is allowed in the request.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A machine-readable error code: \`RTRN\_MULTIPLE\_REFUND\_TERMS\_NOT\_ALLOWED\`
- **errorMessage** (String!)
  - A human-readable error message. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **maxAllowed** (Int!)
  - Maximum number of refund terms allowed for the request.
- **providedCount** (Int!)
  - Number of partial refund terms provided in the request.

### MultipleRefundWithholdingsNotAllowedError
**Description:** This error type indicates that only one line-item refund withholding is allowed per request. A single request cannot include multiple withholdings for the same return line item.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A machine-readable error code: \`RTRN\_MULTIPLE\_REFUND\_WITHHOLD\_NOT\_ALLOWED\`
- **errorMessage** (String!)
  - A human-readable error message. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **maxAllowed** (Int!)
  - The maximum number of refund withholdings permitted in a single request.
- **providedCount** (Int!)
  - The number of refund withholdings included in the current request.

### MultipleReturnLabelsNotSupportedError
**Description:** This error type indicates that only one shipping label is supported.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A machine-readable error code: \`RTRN\_MULTIPLE\_SHIP\_LABEL\_NOT\_SUPPORTED\`
- **errorMessage** (String!)
  - A human-readable error message. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters

### OfferBusinessRulesViolated
**Description:** This type defines the business error that occurs during business rule violations while executing an offer action.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The globally unique error code for this business error type. In this case, \`OFFER\_BUSINESS\_RULES\_VIOLATED\`.
- **errorMessage** (String!)
  - The developer-friendly message explaining the error. \*\*Maximum length\*\*: 500 characters \*\*Format\*\*: Alphanumeric characters, spaces, and common punctuation
- **violations** ([OfferBusinessRuleViolation!]!)
  - A list of business rule violations that caused the offer action to fail.

### OrderCancellationEligibilityError
**Description:** This type represents order-level ineligibility reasons that prevent cancellation. The \`ineligibilityReasons\` field lists the order‑level reasons the cancellation cannot be performed at this time. \*\*Note:\*\* Clients should use \*\*errorCode\*\* and \*\*ineligibilityReasons\*\* for programmatic handling; \*\*errorMessage\*\* is intended for display.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The machine-readable error code for this business error. For this type, the value is \`CNCL\_ORDER\_ELIGIBILITY\_ERROR\`.
- **errorMessage** (String!)
  - A human-readable description of the error message. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **ineligibilityReasons** ([OrderCancellationIneligibilityReason!]!)
  - A list of one or more order-level contract cancellation ineligibility reasons that block creation of a cancellation. For example, \`CancellationExistsConflict\` applies when the whole order is already cancelled or a cancellation is in progress. This field is required and contains at least one reason when this error is returned.

### OrderInquiryActionNotPermittedError
**Description:** This type represents a business error that occurs when a caller attempts to perform an action on an order inquiry, but the action is not permitted in the inquiry’s current state or context. This error is returned when the requested operation is not allowed due to business rules, such as actor permissions, or the inquiry's lifecycle stage.
**Type:** GraphQLObjectType

**Properties:**
- **availableActions** ([OrderInquiryAction!])
  - This array returns a list of actions that are available to the user in the current state. This can be used to guide the user on what actions they can take.
- **errorCode** (String!)
  - The unique identifier for this specific error type - \`ORDER\_INQUIRY\_ACTION\_NOT\_PERMITTED\_ERROR\`.
- **errorMessage** (String!)
  - The human-readable error message for the order inquiry error. \*\*Maximum length\*\*: 500 characters \*\*Format\*\*: Alphanumeric

### OrderInquiryInvalidDateRangeError
**Description:** This type represents a business error that occurs when the specified date range exceeds the allowed limit or has an invalid start and end date order.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The unique identifier for this specific error type - \`INQRY\_INVALID\_DATE\_RANGE\`
- **errorMessage** (String!)
  - The human-readable error message for the order inquiry error. \*\*Maximum length\*\*: 512 characters \*\*Format\*\*: Alphanumeric

### OrderInquiryInvalidPageSizeError
**Description:** This type represents a business error that occurs when the specified page size exceeds the allowed limit.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The unique identifier for this specific error type - \`INQRY\_INVALID\_PAGE\_SIZE\`
- **errorMessage** (String!)
  - The human-readable error message for the order inquiry error. \*\*Maximum length\*\*: 512 characters \*\*Format\*\*: Alphanumeric
- **maxAllowedPageSize** (Int!)
  - The maximum allowed page size.
- **minAllowedPageSize** (Int!)
  - The minimum allowed page size.
- **requestedPageSize** (Int!)
  - The requested page size.

### OrderInquiryInvalidSearchInputError
**Description:** This type represents a business error that occurs when the search request must include either initial search input or page cursor information.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The unique identifier for this specific error type - \`INQRY\_INVALID\_SEARCH\_INPUT\`
- **errorMessage** (String!)
  - The human-readable error message for the order inquiry error. \*\*Maximum length\*\*: 512 characters \*\*Format\*\*: Alphanumeric

### OrderInquiryNotFoundError
**Description:** This type represents a business error that occurs when the provided order inquiry identifier does not match any known inquiry. This error is returned when the inquiry referenced in the input does not exist, is not accessible to the caller, or has been deleted.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The unique identifier for this specific error type - \`ORDER\_INQUIRY\_NOT\_FOUND\_ERROR\`.
- **errorMessage** (String!)
  - The human-readable error message for the order inquiry error. \*\*Maximum length\*\*: 500 characters \*\*Format\*\*: Alphanumeric
- **inquiryId** (ID!)
  - The unique identifier of the requested inquiry that was not found.

### OrderLineItemCancellationEligibilityError
**Description:** This type represents ineligibility reasons at different dimensions that prevent cancellation of order line item(s). The \`ineligibilityReasons\` field lists the order line item level reasons the cancellation cannot be performed at this time. \*\*Note:\*\* Clients should use \*\*errorCode\*\* and \*\*ineligibilityReasons\*\* for programmatic handling; \*\*errorMessage\*\* is intended for display.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The machine-readable error code for this business error. For this type, the value is \`CNCL\_ORDER\_LINE\_ITEM\_ELIGIBILITY\_ERROR\`.
- **errorMessage** (String!)
  - A human-readable description of the error message. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **ineligibilityReasons** ([OrderLineItemCancellationIneligibilityReason!]!)
  - A list of one or more order line items that are not eligible for cancellation. This list provides one or more ineligibility reasons, each with the specific line item IDs that are blocked.

### OrderLineItemNotFoundError
**Description:** This error type indicates that the specified line item in the request does not exist.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A machine-readable error code: \`RTRN\_ORDER\_LINE\_ITEM\_NOT\_FOUND\`
- **errorMessage** (String!)
  - A human-readable error message. \*\*Maximum length:\*\* 512 characters \*\*Format:\*\* Alphanumeric
- **requestedLineItemIds** ([ID!]!)
  - The requested line item was not found.

### OrderLineItemsByIdsCompleteFailure
**Description:** This type represents a complete failure for the \*\*orderLineItemsByIds\*\* query. \*\*Note:\*\* No line items were successfully retrieved.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The machine-readable error code for this business error. Value: \`LINE\_ITEM\_BY\_IDS\_COMPLETE\_FAILURE\`.
- **errorMessage** (String!)
  - A human-readable description of the error message. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **failures** ([LineItemsByIdsError!]!)
  - A list of one or more line items that failed to retrieve.

### OrderLineItemsByIdsPartialFailure
**Description:** This type represents a partial success and partial failure for an \*\*orderLineItemsByIds\*\* query, including line items successfully retrieved and those that could not be retrieved.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The machine-readable error code for this business error. Value: \`LINE\_ITEM\_BY\_IDS\_PARTIAL\_FAILURE\`.
- **errorMessage** (String!)
  - A human-readable description of the error message. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **failures** ([LineItemsByIdsError!]!)
  - A list of one or more line items that could not be retrieved.
- **lineItems** ([OrderLineItem!]!)
  - A list of one or more successfully retrieved order line items.

### OrderNotFoundError
**Description:** This type indicates that the specified order cannot be found.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The globally unique error code for the business error type. This field always returns: \`ORDER\_NOT\_FOUND\`.
- **errorMessage** (String!)
  - A human-readable description of the error message. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **orderId** (ID!)
  - The order ID that was not found.

### OrdersByIdsCompleteFailure
**Description:** This type represents a complete failure for the \*\*ordersByIds\*\* query, including those orders that could not be retrieved. \*\*Note:\*\* No orders were successfully retrieved.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The machine-readable error code for this business error. Value: \`ORDERS\_BY\_IDS\_COMPLETE\_FAILURE\`.
- **errorMessage** (String!)
  - A human-readable description of the error message. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **failures** ([OrdersByIdsError!]!)
  - A list of one or more orders that could not be retrieved.

### OrdersByIdsPartialFailure
**Description:** This type represents a partial success and partial failure for an \*\*ordersByIds\*\* query, including orders successfully retrieved and those that could not be retrieved.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The machine-readable error code for this business error. Value: \`ORDERS\_BY\_IDS\_PARTIAL\_FAILURE\`.
- **errorMessage** (String!)
  - A human-readable description of the error message. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **failures** ([OrdersByIdsError!]!)
  - A list of one or more orders that could not be retrieved.
- **orders** ([Order!]!)
  - A list of one or more successfully retrieved orders.

### ProcessReturnRefundInputValidationError
**Description:** This error type indicates that one or more validation errors occurred while processing the return refund.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A machine-readable error code: \`RTRN\_REFUND\_VALIDATION\_ERROR\`
- **errorMessage** (String!)
  - A human-readable error message describing the issue. \*\*Maximum length:\*\* 512 characters
- **violations** ([ProcessReturnRefundInputViolation!]!)
  - This array contains details about one or more specific request violations.

### ProposeKeepItemWithPartialRefundInputValidationError
**Description:** This error type indicates that one or more validation errors occurred while proposing the keep-item-with-partial-refund
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A machine-readable error code: \`RTRN\_PARTIAL\_REFUND\_VALIDATION\_ERROR\`
- **errorMessage** (String!)
  - A human-readable error message describing the issue. \*\*Maximum length:\*\* 512 characters
- **violations** ([ProposeKeepItemWithPartialRefundInputViolation!]!)
  - This array contains details about one or more specific request violations.

### ProvideRmaNumberInputValidationError
**Description:** This error type indicates that one or more validation errors occurred while providing the RMA number.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A machine-readable error code: \`RTRN\_PROVIDE\_RMA\_NUMBER\_VALIDATION\_ERROR\`
- **errorMessage** (String!)
  - A human-readable error message describing the issue. \*\*Maximum length:\*\* 512 characters
- **violations** ([ProvideRmaNumberInputViolation!]!)
  - This array contains details about one or more specific request violations.

### ProvideShipmentInfoForInquiryInputValidationError
**Description:** This type represents a business error that returns when one or more validation errors occurs while providing shipment information for an order inquiry.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The unique identifier for this specific error type - \`INQRY\_PROVIDE\_SHIPMENT\_INFO\_VALIDATION\_ERROR\`.
- **errorMessage** (String!)
  - The human-readable error message for the order inquiry error. \*\*Maximum length\*\*: 512 characters \*\*Format\*\*: Alphanumeric
- **violations** ([ProvideShipmentInfoForInquiryInputViolation!]!)
  - This array returns details about the specific request violations.

### PurchaseQuoteCancellationEligibilityError
**Description:** This error type describes reasons that an eligibility failure prevented the cancellation of a purchase quote. The \`ineligibilityReasons\` field contains the specific quote-level failure reasons, explaining why the cancellation cannot be performed at this time.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The globally unique error code for this business error. For this type, the value is \`CNCL\_PURCHASE\_QUOTE\_ELIGIBILITY\_ERROR\`.
- **errorMessage** (String!)
  - A human-readable description of the error message. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **ineligibilityReasons** ([PurchaseQuoteCancellationIneligibilityReason!]!)
  - A list of one or more purchase-quote level contract cancellation ineligibility reasons that prevent creation of a cancellation. For example, \`CancellationExistsConflict\` applies when the entire purchase quote is already cancelled or a cancellation is in progress. This field is required and contains at least one reason when this error is returned.

### PurchaseQuoteLineItemsByIdsCompleteFailure
**Description:** This output type is used when a \*\*purchaseQuoteLineItemsByIds\*\* query fails completely, and none of the specified purchase quote line items were successfully retrieved. The \*\*failures\*\* array will show the identifiers of the purchase quote line items that were not successfully retrieved, and the error fields will provide more details on the issue(s) that caused the query to fail.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The unique identifier of the error. \*\*Note\*\*: Currently this field will always show PURCHASE\_QUOTE\_LINE\_ITEMS\_BY\_IDS\_COMPLETE\_FAILURE.
- **errorMessage** (String!)
  - The developer-friendly description of the error is shown in this field.
- **failures** ([PurchaseQuoteLineItemsByIdsError!]!)
  - This array shows the full list of purchase quote line items that could not be retrieved and the error(s) that led to the failure.

### PurchaseQuoteLineItemsByIdsPartialFailure
**Description:** This output type is used when a \*\*purchaseQuoteLineItemsByIds\*\* query is partially successful, where one or more specified purchase quote line items were successfully retrieved, but one or more other specified purchase quote line items failed to be retrieved. The \*\*purchaseQuoteLineItems\*\* array will display all purchase quote line items that were successfully retrieved, the \*\*failures\*\* array will show the identifiers of the purchase quote line items that were not successfully retrieved, and the error fields will provide more details on the issue(s) that caused the query to only be partially successful.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The unique identifier of the error. \*\*Note\*\*: Currently this field will always show \`PURCHASE\_QUOTE\_LINE\_ITEMS\_BY\_IDS\_PARTIAL\_FAILURE\`.
- **errorMessage** (String!)
  - The developer-friendly description of the error is shown in this field.
- **failures** ([PurchaseQuoteLineItemsByIdsError!]!)
  - This array shows the full list of purchase quote line items that could not be retrieved and the error(s) that led to the failure.
- **purchaseQuoteLineItems** ([PurchaseQuoteLineItem!]!)
  - This array shows the full list of successfully retrieved purchase quote line items.

### PurchaseQuoteNotFoundError
**Description:** This error type indicates the specified purchase quote cannot be found.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The globally unique error code for this business error. For this type, the value is \`PURCHASE\_QUOTE\_NOT\_FOUND\`.
- **errorMessage** (String!)
  - A human-readable description of the error message. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **purchaseQuoteId** (ID!)
  - The purchase quote ID that was not found.

### PurchaseQuotesByIdsCompleteFailure
**Description:** This output type is used when a \*\*purchaseQuotesByIds\*\* query fails completely, and none of the specified purchase quotes were successfully retrieved. The \*\*failures\*\* array will show the identifiers of the purchase quotes that were not successfully retrieved, and the error fields will provide more details on the issue(s) that caused the query to fail.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The unique identifier of the error. \*\*Note\*\*: Currently this field will always show \`PURCHASE\_QUOTES\_BY\_IDS\_COMPLETE\_FAILURE\`.
- **errorMessage** (String!)
  - The developer-friendly description of the error is shown in this field.
- **failures** ([PurchaseQuotesByIdsError!]!)
  - This array shows the full list of purchase quotes that could not be retrieved and the error(s) that led to the failure.

### PurchaseQuotesByIdsPartialFailure
**Description:** This output type is used when a \*\*purchaseQuotesByIds\*\* query is partially successful, where one or more specified purchase quotes were successfully retrieved, but one or more other specified purchase quotes failed to be retrieved. The \*\*purchaseQuotes\*\* array will display all purchase quotes that were successfully retrieved, the \*\*failures\*\* array will show the identifiers of the purchase quotes that were not successfully retrieved, and the error fields will provide more details on the issue(s) that caused the query to only be partially successful.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The unique identifier of the error. \*\*Note\*\*: Currently this field will always show \`PURCHASE\_QUOTES\_BY\_IDS\_PARTIAL\_FAILURE\`.
- **errorMessage** (String!)
  - The developer-friendly description of the error is shown in this field.
- **failures** ([PurchaseQuotesByIdsError!]!)
  - This array shows the full list of purchase quotes that could not be retrieved and the error(s) that caused the failure.
- **purchaseQuotes** ([PurchaseQuote!]!)
  - This array shows the full list of successfully retrieved purchase quotes.

### RecordReturnLabelSentOfflineInputValidationError
**Description:** This error type indicates that one or more validation errors occurred while recording the return label as sent offline.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A machine-readable error code: \`RTRN\_RECORD\_OFFLINE\_LABEL\_VALIDATION\_ERROR\`
- **errorMessage** (String!)
  - A human-readable error message describing the issue. \*\*Maximum length:\*\* 512 characters
- **violations** ([RecordReturnLabelSentOfflineInputViolation!]!)
  - This array contains details about one or more specific request violations.

### ReferenceArgumentsNotFound
**Description:** This type defines any input arguments that contain references to data that could not be found. When a field accepts arguments that are references to other other data (typically arguments with type \`ID\`), it may return this type if any of the referenced data can't be found. This type must only be used with fields that directly accept arguments.
**Type:** GraphQLObjectType

**Properties:**
- **argumentNames** ([String!]!)
  - The names of the input fields that contain references to data that could not be found. \*\*Maximum length per item\*\*: 100 characters \*\*Format\*\*: Alphanumeric characters and underscores, matching GraphQL field names
- **errorCode** (String!)
  - A unique identifier for this specific error type. This code can be used by clients to programmatically identify and handle different types of errors without relying on error messages, which may change over time. Each error type will always return the same \*\*errorCode\*\* value. \*\*Maximum length\*\*: 40 characters \*\*Format\*\*: Alphanumeric characters and underscores, in UPPER\_CASE format
- **errorMessage** (String!)
  - A human-readable message describing the error. This message is intended for developers and should not be displayed directly to end users. It provides additional context about what went wrong and may include suggestions for how to resolve the issue. \*\*Maximum length\*\*: 500 characters \*\*Format\*\*: Alphanumeric characters, spaces, and common punctuation

### RefundAuthorizationFailedError
**Description:** This type defines the error returned when the refund did not go through because of the inability to verify authentication of your payment option. Please change your payment option and try again.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The error code associated with the error. \*\*Note:\*\* In this case, this field will return \`RFND\_AUTHORIZATION\_FAILED\_ERROR\`.
- **errorMessage** (String!)
  - The human-readable error message for the refund error. \*\*Maximum length\*\*: 512 characters \*\*Format\*\*: Alphanumeric

### RefundBlockedByPaymentDisputeError
**Description:** This type defines the error returned when there is a payment dispute opened for the entity for which refund is triggered.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The error code associated with the error. \*\*Note:\*\* In this case, this field will return \`RFND\_BLOCKED\_BY\_PAYMENT\_DISPUTE\_ERROR\`.
- **errorMessage** (String!)
  - The human-readable error message for the refund error. \*\*Maximum length\*\*: 512 characters \*\*Format\*\*: Alphanumeric

### RefundInstrumentDeclinedError
**Description:** This type defines the error returned when a refund instrument is unable to be verified. Please ensure the instrument and identification details match on your card, or change your payment option below and try refunding again.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The error code associated with the error. \*\*Note:\*\* In this case, this field will return \`RFND\_INSTRUMENT\_DECLINED\_ERROR\`.
- **errorMessage** (String!)
  - The human-readable error message for the refund error. \*\*Maximum length\*\*: 512 characters \*\*Format\*\*: Alphanumeric

### RefundInstrumentInsufficientFundsError
**Description:** This type defines the error returned when a refund fails due to insufficient funds.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The error code associated with the error. \*\*Note:\*\* In this case, this field will return \`RFND\_INSTRUMENT\_INSUFFICIENT\_FUNDS\_ERROR\`.
- **errorMessage** (String!)
  - The human-readable error message for the refund error. \*\*Maximum length\*\*: 512 characters \*\*Format\*\*: Alphanumeric

### RefundInstrumentInvalidError
**Description:** This type defines the error returned when a refund fails due to an invalid refund instrument.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The error code associated with the error. \*\*Note:\*\* In this case, this field will return \`RFND\_INSTRUMENT\_INVALID\_ERROR\`.
- **errorMessage** (String!)
  - The human-readable error message for the refund error. \*\*Maximum length\*\*: 512 characters \*\*Format\*\*: Alphanumeric

### RefundProcessingError
**Description:** This type defines the error returned when the refund cannot be processed. Please try again or contact us for help.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The error code associated with the error. \*\*Note:\*\* In this case, this field will return \`RFND\_PROCESSING\_ERROR\`.
- **errorMessage** (String!)
  - The human-readable error message for the refund error. \*\*Maximum length\*\*: 512 characters \*\*Format\*\*: Alphanumeric

### RelistListingValidationError
**Description:** This type is used when the \*\*relistListing\*\* mutation fails due to one or more blocking validation errors. A list of validation rule violations that must be fixed before retrying will be shown, and one or more non-blocking warning messages will also be shown if any were triggered during the processing of the mutation.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The unique identifier of the error. This code can be used by clients to programmatically identify and handle different types of errors without relying on error messages, which may change over time.
- **errorMessage** (String!)
  - A human-readable message describing the error. This message is intended for developers and should not be displayed directly to end users. It provides additional context about what went wrong and may include suggestions for how to resolve the issue.
- **violations** ([ListingValidationRuleViolation!]!)
  - This array contains a list of blocking validation rule violations that must be fixed before retrying.
- **warnings** ([ListingWarning!])
  - This array contains a list of non-blocking validation warnings that do not block processing but provide useful feedback for improving listings.

### RemoveFromWatchListFailure
**Description:** This type indicates that the \*\*removeFromWatchList\*\* mutation failed, and that all requested items failed to be removed for the user's Watchlist. The unique identifier of each item that failed to be removed from the Watchlist is returned, alongside the reason each failed. This type also returns the total number of items being watched by the user after the failed mutation and the maximum number of items they can add to their Watchlist.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A human-readable message describing the error. This message is intended for developers and should not be displayed directly to end users. It provides additional context about what went wrong and may include suggestions for how to resolve the issue. \*\*Maximum length\*\*: 500 characters \*\*Format\*\*: Alphanumeric characters, spaces, and common punctuation
- **errorMessage** (String!)
  - A human-readable message describing the error. This message is intended for developers and should not be displayed directly to end users. It provides additional context about what went wrong and may include suggestions for how to resolve the issue. \*\*Maximum length\*\*: 500 characters \*\*Format\*\*: Alphanumeric characters, spaces, and common punctuation
- **failedItems** ([WatchListRemoveFailure!]!)
  - This array returns the unique identifier(s) of the item(s) that failed to be added to the user's Watchlist, along with the reason each failed.
- **watchListCount** (Int!)
  - The current total number of items in the user's Watchlist.
- **watchListMaximum** (Int!)
  - The maximum number of items allowed in the user's Watchlist.

### RemoveFromWatchListPartialFailure
**Description:** This type indicates that the \*\*removedFromWatchList\*\* mutation partially failed. Some of the specified items were successfully removed from the user's Watchlist, but one or more failed to be removed. The unique identifier of each item that successfully removed from the Watchlist is returned. In addition, the unique identifier of each item that failed to be removed from the Watchlist is returned, alongside the reason each failed. This type also returns the total number of items removed from the user's Watchlist after the partially failed mutation, the current total number of items being watched by the user, and the maximum number of items they can add to their Watchlist.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A human-readable message describing the error. This message is intended for developers and should not be displayed directly to end users. It provides additional context about what went wrong and may include suggestions for how to resolve the issue. \*\*Maximum length\*\*: 500 characters \*\*Format\*\*: Alphanumeric characters, spaces, and common punctuation
- **errorMessage** (String!)
  - A human-readable message describing the error. This message is intended for developers and should not be displayed directly to end users. It provides additional context about what went wrong and may include suggestions for how to resolve the issue. \*\*Maximum length\*\*: 500 characters \*\*Format\*\*: Alphanumeric characters, spaces, and common punctuation
- **failedItems** ([WatchListRemoveFailure!]!)
  - This array returns the unique identifier(s) of the item(s) that failed to be added to the user's Watchlist, along with the reason they failed.
- **numberOfItemsUnwatched** (Int!)
  - The number of items that were successfully removed from the user's Watchlist.
- **removedItems** ([Item!]!)
  - This array returns the unique identifier(s) of the item(s) that were successfully removed from the user's Watchlist.
- **watchListCount** (Int!)
  - The current total number of items in the user's Watchlist.
- **watchListMaximum** (Int!)
  - The maximum number of items allowed in the user's Watchlist.

### RequestPurchaseQuoteBusinessError
**Description:** This type is used when a business error occurs with a \*\*requestPurchaseQuote\*\* mutation.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The unique identifier of the specific error. This code can be used by clients to programmatically identify and handle different types of errors without relying on error messages, which may change over time. \*\*Maximum length\*\*: 40 characters \*\*Format\*\*: Alphanumeric characters and underscores, in UPPER\_CASE format
- **errorMessage** (String!)
  - A human-readable message describing the error. This message is intended for developers and should not be displayed directly to end users. It provides additional context about what went wrong and may include suggestions for how to resolve the issue. \*\*Maximum length\*\*: 500 characters \*\*Format\*\*: Alphanumeric characters, spaces, and common punctuation
- **retryable** (Boolean!)
  - This boolean indicates whether or not the user should try to request the purchase quote again. If this field is returned as \`true\`, the user can make another attempt to request the purchase quote.

### ReturnCreationNotAllowedError
**Description:** This error type provides for a return creation eligibility error that denotes return creation is blocked due to eligibility issues. It provides additional details explaining why the return line item is not eligible for return.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A machine-readable return error code: \`RTRN\_CREATION\_NOT\_ALLOWED\`
- **errorMessage** (String!)
  - A human-readable error message. This alphanumeric string is not localized and may change without notice.
- **returnIneligibilityReasons** ([ReturnCreationIneligibilityReason!]!)
  - Reason describing why the line item is not eligible for return

### ReturnInvalidDateRangeError
**Description:** This error type indicates that the specified date range exceeds the allowed limit or has an invalid start and end date order.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A machine-readable error code: \`RTRN\_INVALID\_DATE\_RANGE\`.
- **errorMessage** (String!)
  - A human-readable error message. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters

### ReturnInvalidPageSizeError
**Description:** This error type indicates that the specified page size exceeds the allowed limit.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A machine-readable error code: \`RTRN\_INVALID\_PAGE\_SIZE\`.
- **errorMessage** (String!)
  - A human-readable error message. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **maxAllowedPageSize** (Int!)
  - The maximum allowed page size.
- **minAllowedPageSize** (Int!)
  - The minimum allowed page size.
- **requestedPageSize** (Int!)
  - The requested page size.

### ReturnInvalidSearchInputError
**Description:** This error type indicates that the search request must include either initial search input or page cursor information.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A machine-readable error code: \`RTRN\_INVALID\_SEARCH\_INPUT\`.
- **errorMessage** (String!)
  - A human-readable error message. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters

### ReturnLineItemNotFoundError
**Description:** This error type indicates that the specified return line item in the request does not exist.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A machine-readable error code: \`RTRN\_LINE\_ITEM\_NOT\_FOUND\`
- **errorMessage** (String!)
  - A human-readable error message. \*\*Maximum length:\*\* 512 characters \*\*Format:\*\* Alphanumeric
- **requestedLineItemIds** ([ID!]!)
  - The requested line item was not found.

### ReturnNotFoundError
**Description:** This error type indicates that the return was not found.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A machine-readable error code: \`RTRN\_NOT\_FOUND\`
- **errorMessage** (String!)
  - A human-readable error message. This alphanumeric string is not localized and may change without notice.
- **requestedReturnId** (ID!)
  - The requested Return Id that was not found.

### ReturnPreferenceNotFoundError
**Description:** This error type indicates that the associated return preference could not be found.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A machine-readable error code \`RTRN\_PREFERENCE\_NOT\_FOUND\`
- **errorMessage** (String!)
  - A human-readable error message. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters

### ReturnRefundTermsRequiredError
**Description:** This error type indicates that refund terms are required but were not provided in the request.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A machine-readable error code: \`RTRN\_REFUND\_TERMS\_REQUIRED\`
- **errorMessage** (String!)
  - A human-readable error message. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters

### ReturnRequestLineItemRequiredError
**Description:** This error type indicates that the request contains an empty line item list, which is not allowed.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A machine-readable error code: \`RTRN\_REQ\_LINE\_ITEM\_REQUIRED\`
- **errorMessage** (String!)
  - A human-readable error message. \*\*Maximum length:\*\* 512 characters \*\*Format:\*\* Alphanumeric

### ReturnRuleDuplicateRuleIdsError
**Description:** This error type is returned when the provided \*\*ruleIdsInPriorityOrder\*\* contains duplicate IDs (the input list requires unique rule IDs).
**Type:** GraphQLObjectType

**Properties:**
- **duplicateRuleIds** ([ID!]!)
  - A list of one or more duplicate rule IDs in the input list.
- **errorCode** (String!)
  - A machine-readable error code: \`RTRN\_DUPLICATE\_RULE\_IDS\_IN\_LIST\`
- **errorMessage** (String!)
  - A human-readable error message for duplicate rule Ids in the ordered list. This check avoids any bad data written to the system. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters

### ReturnRuleFeatureNotEnabledError
**Description:** This error type indicates that the return rules feature is not enabled for the seller. \*\*Note:\*\* The seller is authenticated but does not have the required feature capability enabled ramped for them.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A machine-readable error code: \`RTRN\_FEATURE\_NOT\_ENABLED\`
- **errorMessage** (String!)
  - A human-readable error message. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters

### ReturnRuleInvalidConditionsError
**Description:** This error type indicates the provided \*\*returnRuleConditionSet\*\* contains invalid condition data (for example, the categories are not leaf IDs, invalid country code, or an invalid \*\*refundRange\*\* where the minimum is less than maximum). Purpose: surface specific validation failures in the condition tree.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A machine-readable error code \`RTRN\_RULE\_INVALID\_CONDITIONS\`
- **errorMessage** (String!)
  - A human-readable error message indicating that the rule conditions are invalid. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **ruleConditionViolation** ([ReturnRuleConditionViolation!]!)
  - A list of violations providing details about each specific invalid condition found in the input.

### ReturnRuleInvalidRuleIdsError
**Description:** This error type is returned when the input includes one or more rule IDs that do not exist for this seller/marketplace (extra or invalid IDs).
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A machine-readable error code: \`RTRN\_INVALID\_RULE\_IDS\_IN\_LIST\`
- **errorMessage** (String!)
  - A human-readable error message for invalid rules in the ordered list. For example, rule IDs that do not belong to the seller. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **invalidRuleIds** ([ID!]!)
  - A list of one or more rule IDs which are not found in the seller's existing rules.

### ReturnRuleLimitExceededError
**Description:** This error type is returned when adding this rule would exceed a configured maximum number of rules (organizational or business limit).
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A machine-readable error code: \`RTRN\_RULE\_LIMIT\_EXCEEDED\`
- **errorMessage** (String!)
  - A human-readable error message indicating that the rule limit has been exceeded. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **maxAllowed** (Int!)
  - The maximum number of rules allowed for the seller on the specified marketplace.

### ReturnRuleListingGroupDuplicateListingError
**Description:** This error type is returned when the input request contains duplicate listing IDs. \*\*Note:\*\* Clients should deduplicate their list of IDs before re-sending the request.
**Type:** GraphQLObjectType

**Properties:**
- **duplicateListingIds** ([ID!]!)
  - An array of one or more listing IDs that were duplicated in the request.
- **errorCode** (String!)
  - A machine-readable error code: \`RTRN\_DUPLICATE\_LISTING\_IDS\_IN\_GROUP\`
- **errorMessage** (String!)
  - A human-readable message indicating input request contained duplicated listing IDs.

### ReturnRuleListingGroupInvalidNameError
**Description:** This error type is returned when a group with the given name already exists for this seller. \*\*Note:\*\* Only unique group names are accepted.
**Type:** GraphQLObjectType

**Properties:**
- **containsInvalidCharacters** (Boolean!)
  - Indicates whether the rule name contains invalid characters.
- **duplicateGroupName** (Boolean!)
  - Indicates whether the rule name is not unique for the seller in given listing marketplace.
- **errorCode** (String!)
  - A machine-readable error code \`RTRN\_LISTING\_GROUP\_NAME\_ERROR\`
- **errorMessage** (String!)
  - A human-readable message describing the error. \*\*Maximum length:\*\* 512 characters
- **nameConstraint** (ReturnRuleNameConstraint!)
  - This object indicates the constraints defined for return rule name input. Constraints include allowed character counts and regular expression pattern for allowed characters.

### ReturnRuleListingGroupMaxSizeExceededError
**Description:** This error type indicates that the request attempts to create or expand the listing list which would exceed the list's total item capacity. \*\*Note:\*\* To fix, clients should lower the total number of items to be added to the list.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A machine-readable error code: \`RTRN\_LISTING\_GROUP\_MAX\_SIZE\_EXCEEDED\`
- **errorMessage** (String!)
  - A human-readable message describing the capacity violation.
- **groupListingLimit** (Int!)
  - The configured maximum number of listings allowed per group.

### ReturnRuleListingGroupNotFoundError
**Description:** This error type is returned when the listing group cannot be found. This error typically occurs if the specified listing group ID (\*\*listingId\*\*) does not exist or has been deleted (returned when the append request references an unknown list).
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A machine-readable error code: \`RTRN\_LISTING\_GROUP\_NOT\_FOUND\`
- **errorMessage** (String!)
  - A human-readable error message indicating the list was not found. \*\*Maximum length:\*\* 512
- **returnRuleListingGroupId** (ID!)
  - The listing group ID from the request that could not be found.

### ReturnRuleListingGroupQuotaExceededError
**Description:** This error type is returned when a seller has reached the maximum number of listing groups allowed for their account. \*\*Note:\*\* Currently, a maximum of 20 listing groups for each seller is allowed.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A machine-readable error code: \`RTRN\_SELLER\_LISTING\_GROUP\_QUOTA\_EXCEEDED\`
- **errorMessage** (String!)
  - A human-readable message describing the quota violation.
- **maxAllowedLists** (Int!)
  - The configured maximum number of listing groups allowed for the seller.

### ReturnRuleListingIdsPerRequestLimitExceededError
**Description:** This error type indicates the request attempts to add more items than the allowed per-request limit. \*\*Note:\*\* To fix, clients should split requests into smaller batches.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A machine-readable error code: \`RTRN\_LISTING\_PER\_REQUEST\_LIMIT\_EXCEEDED\`
- **errorMessage** (String!)
  - A human-readable message describing the limit violation.
- **perRequestLimit** (Int!)
  - The configured maximum number of items allowed per request.
- **requestedCount** (Int!)
  - The number of items the client attempted to add in this request.

### ReturnRuleMissingConditionError
**Description:** This error type indicates that no conditions were provided in the rule set. \*\*Note:\*\* A rule must have at least one condition to be valid.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A machine-readable code identifying the failed condition: \`RTRN\_RULE\_MISSING\_CONDITION\`
- **errorMessage** (String!)
  - Human-readable explanation of the error. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters

### ReturnRuleMissingRuleIdsError
**Description:** This error type is returned when the input contains one or more rule IDs that do not exist among the seller's defined return rules.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A machine-readable error code: \`RTRN\_MISSING\_RULE\_IDS\_IN\_LIST\`
- **errorMessage** (String!)
  - A human-readable error message for the missing rules in the ordered list. All rules defined must be added to the priority list. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **missingRuleIds** ([ID!]!)
  - Missing rule Ids which are not found in the seller's existing rules.

### ReturnRuleNameError
**Description:** This error type indicates that the provided rule name violates allowed format, length, or characters (for example, exceeds maximum length, has disallowed characters).
**Type:** GraphQLObjectType

**Properties:**
- **containsInvalidCharacters** (Boolean!)
  - When \`true\`, this value indicates the rule name contains invalid characters.
- **duplicateRuleName** (Boolean!)
  - When \`true\`, this value indicates the rule name is not unique for the seller in given listing marketplace.
- **errorCode** (String!)
  - A machine-readable error code \`RTRN\_RULE\_NAME\_ERROR\`
- **errorMessage** (String!)
  - A human-readable error message indicating that the rule name format is invalid. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **nameConstraint** (ReturnRuleNameConstraint!)
  - This object indicates the constraints defined for return rule name input, including allowed character counts and regular expression pattern defining allowed characters.

### ReturnRuleNotFoundError
**Description:** This error type is returned to indicate the \*\*ruleIds\*\* in the input does not match any existing rule for the seller.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A machine-readable error code: \`RTRN\_RULE\_NOT\_FOUND\`
- **errorMessage** (String!)
  - A human-readable error message that the rule was not found. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **requestedRuleId** (ID!)
  - The \*\*ruleId\*\* which was not found.

### ReturnRuleStatusUpdateBlockedError
**Description:** This error type is returned when the input specifies a status of \`ENABLED\`, but the rule cannot be enabled because one or more rule conditions are invalid. This prevents activation of rules that contain invalid configurations. The rule conditions must be corrected before the rule can be enabled.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A machine-readable error code: \`RTRN\_RULE\_STATUS\_UPDATE\_BLOCKED\`
- **errorMessage** (String!)
  - A human-readable error message for blocked rule status update. This will appear when trying to enable a rule with invalid conditions. This alphanumeric string is not localized and may change without notice. Maximum length: 512 characters
- **requestedRuleId** (ID!)
  - The \*\*ruleId\*\* which was not found.

### ReturnShipmentLabelNotFoundError
**Description:** This error type denotes that the attached label document ID was not found.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A machine-readable error code: \`RTRN\_LABEL\_DOCUMENT\_NOT\_FOUND\`
- **errorMessage** (String!)
  - A human-readable error message. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **requestedDocumentId** ([ID!]!)
  - The invalid document IDs that were not found.

### ReturnShippingLabelRequiredError
**Description:** This error type indicates that the request contains an empty shipping label list, which is not allowed.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A machine-readable error code: \`RTRN\_SHIPPING\_LABEL\_REQUIRED\`
- **errorMessage** (String!)
  - A human-readable error message. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters

### ReturnToAddressRequiredError
**Description:** This error type indicates the provided \*\*returnRuleConditionSet\*\* contains invalid condition data (for example, the categories are not leaf IDs, invalid country codes, or an invalid \*\*refundRange\*\* where the minimum is less than maximum). Purpose: surface specific validation failures in the condition tree.
**Type:** GraphQLObjectType

**Properties:**
- **addressRoutingStrategy** (ReturnToAddressRoutingStrategy!)
  - A list of violations providing details about each specific invalid condition found in the input.
- **errorCode** (String!)
  - A machine-readable error code \`RTRN\_ADDRESS\_REQUIRED\_ERROR\`
- **errorMessage** (String!)
  - A human-readable error message indicating that the rule conditions are invalid. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters

### ReturnToAddressValidationError
**Description:** This error type is returned when the provided \*\*addressId\*\* is not eligible as a return address for the seller. This occurs when the \*\*addressId\*\*: - is not in the seller's eligible return addresses - does not exist - not owned by the seller
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A machine-readable error code for an incorrect \*\*addressId\*\* in the input: \`RTRN\_RULE\_ADDRESS\_INVALID\`
- **errorMessage** (String!)
  - A human-readable error message for an incorrect \*\*addressId\*\* in the input. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **invalidAddressId** (String!)
  - The returned invalid \*\*addressId\*\* submitted in the input. The \*\*addressId\*\* must be from the seller's eligible return addresses. This alphanumeric string is not localized and may change without notice. \*\*Note:\*\* To avoid this error, fetch eligible return addresses before making the mutation call. \*\*Maximum length:\*\* 512 characters

### SellerListingSearchInvalidInput
**Description:** This type represents input validation errors that may occur for seller listing search operations. This type provides user-friendly error messaging and detailed validation error information. Each validation error will display \`SELLER\_LISTING\_SEARCH\_INVALID\_INPUT\` to indicate there has been an input validation failure. The specific list of input errors that may occur during the search request validation is provided in the following table. Each error provides detailed information about what went wrong and how to fix it. | Error Type | Description | |-------------------------------------|-----------------------------------------------------------------------------| | \`ListingIdsExceedMaxError\` | when the number of listing IDs provided exceeds the maximum allowed count. | | \`SkusExceedMaxCountError\` | when the number of SKUs provided exceeds the maximum allowed count. | | \`SkusExceedMaxLengthError\` | when one or more SKUs provided exceed the maximum allowed length. | | \`PrimaryCategoryExceedMaxError\` | when the number of primary category IDs provided exceeds the maximum allowed limit.| | \`PrimaryStoreCategoryExceedMaxError\`| when the number of primary store category IDs provided exceeds the maximum allowed limit.| | \`StartDateAfterEndDateError\` | when the start date is after the end date in a date range filter. | | \`PaginationPageSizeExceedError\` | when the requested pagination exceeds the maximum allowed limit per page. | | \`PaginationTotalFetchLimitExceedError\`| when the requested pagination exceeds the maximum allowed fetch limit. |
**Type:** GraphQLObjectType

**Properties:**
- **displayableErrorMessage** (String!)
  - The human-readable error message in a localized format informing end users about the input validation error. \*\*Example:\*\* "Some of the input values provided for the seller listing search are invalid. Please correct your input and try again."
- **errorCode** (String!)
  - The machine-readable error code uniquely representing seller listing search failure. Always returns value \`SELLER\_LISTING\_SEARCH\_INVALID\_INPUT\`.
- **errorMessage** (String!)
  - The human-readable description of the seller listing search failure for API consumer developers. Clients should typically only use this field during development and must never display contents to end users. \*\*Example:\*\* "Validation failed for seller listing search input."
- **validationErrors** ([SellerListingSearchInputError!]!)
  - This array returns a list of specific input errors that occurred during the search request validation. Each error provides detailed information about what went wrong and how to fix it.

### SendOrderInquiryMessageInputValidationError
**Description:** This type represents a business error that is returned when one or more validation errors occurs while sending a message in an order inquiry.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The unique identifier for this specific error type - \`INQRY\_SEND\_MESSAGE\_VALIDATION\_ERROR\`.
- **errorMessage** (String!)
  - The human-readable error message describing the issue. \*\*Maximum length\*\*: 512 characters
- **violations** ([SendOrderInquiryMessageInputViolation!]!)
  - This array returns details about the specific request violations.

### SendReturnMessageInputValidationError
**Description:** This error type indicates that one or more validation errors occurred while sending the return message.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A machine-readable error code: \`RTRN\_SEND\_MESSAGE\_VALIDATION\_ERROR.\`
- **errorMessage** (String!)
  - A human-readable error message describing the issue. \*\*Maximum length:\*\* 512 characters
- **violations** ([SendMessageInputViolation!]!)
  - This array contains details about one or more specific request violations.

### SubmitOrderInquiryReferralInputValidationError
**Description:** This type represents a business error that is returned when one or more validation errors occurs while submitting an order inquiry referral.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The unique identifier for this specific error type - \`INQRY\_SUBMIT\_REFERRAL\_VALIDATION\_ERROR\`.
- **errorMessage** (String!)
  - The human-readable message describing the shipment info input violation. \*\*Maximum length\*\*: 512 characters
- **violations** ([SubmitOrderInquiryReferralInputViolation!]!)
  - This array returns details about the specific request violations.

### SubmitReturnReferralInputValidationError
**Description:** This error type indicates that one or more validation errors occurred while submitting the return referral.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - A machine-readable error code: \`RTRN\_SUBMIT\_REFERRAL\_VALIDATION\_ERROR\`
- **errorMessage** (String!)
  - A human-readable error message describing the issue. \*\*Maximum length:\*\* 512 characters
- **violations** ([SubmitReturnReferralInputViolation!]!)
  - This array contains details about one or more specific request violations.

### UpdateListingValidationError
**Description:** This type is used when the \*\*updateListing\*\* mutation fails due to one or more blocking validation errors. A list of validation rule violations that must be fixed before retrying will be shown, and one or more non-blocking warning messages will also be shown if any were triggered during the processing of the mutation.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The unique identifier of the error. This code can be used by clients to programmatically identify and handle different types of errors without relying on error messages, which may change over time.
- **errorMessage** (String!)
  - A human-readable message describing the error. This message is intended for developers and should not be displayed directly to end users. It provides additional context about what went wrong and may include suggestions for how to resolve the issue.
- **violations** ([ListingValidationRuleViolation!]!)
  - This array contains a list of blocking validation rule violations that must be fixed before retrying.
- **warnings** ([ListingWarning!])
  - This array contains a list of non-blocking validation warnings that do not block processing but provide useful feedback for improving listings.

### UserCustomListsFailure
**Description:** This type indicates a failed \*\*userCustomLists\*\* query. A failed query returns a business error indicating that all requested custom lists failed to be retrieved.
**Type:** GraphQLObjectType

**Properties:**
- **errorCode** (String!)
  - The globally unique error code for this business error type. This field will always return 'CSTM\_LISTS\_ALL\_FAILED' in this context. \*\*Maximum length\*\*: 40 characters
- **errorMessage** (String!)
  - The human-readable message describing why the custom lists retrieval failed. This message is intended for developers and should not be displayed directly to end users. It provides specific details about the validation failure or business rule violation. \*\*Maximum length\*\*: 500 characters \*\*Format\*\*: Alphanumeric characters, spaces, and common punctuation
- **failedCustomLists** ([CustomListFailure!]!)
  - This array returns each custom list that failed during the operation with specific reasons each failed.

### UserCustomListsPartialFailure
**Description:** This type indicates that the \*\*userCustomLists\*\* query partially failed. Some custom lists were successfully retrieved, but one or more failed to be retrieved.
**Type:** GraphQLObjectType

**Properties:**
- **customLists** ([UserCustomList!]!)
  - This array returns each custom list that was successfully retrieved.
- **errorCode** (String!)
  - The globally unique error code for this business error type. This field will always return 'CSTM\_LISTS\_PARTIAL\_FAILURE' in this context. \*\*Maximum length\*\*: 40 characters
- **errorMessage** (String!)
  - The developer-friendly message explaining the error. \*\*Maximum length\*\*: 500 characters
- **failedCustomLists** ([CustomListFailure!]!)
  - This array returns each custom list that failed to be retrieved during the operation with specific reasons for each failure.
- **totalCount** (Int!)
  - The integer value in this field indicates the total number of custom lists successfully returned in this response.

### ApproveReturnAction
**Description:** This type is used by a seller approving a return request.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable return action code: \`APPROVE\_RETURN\`
- **displayText** (String!)
  - The human-readable text for approval of the return. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### DeclineReturnAction
**Description:** This action type is used by a seller declining a return request.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable return action code: \`DECLINE\_RETURN\`.
- **displayText** (String!)
  - a human-readable text for decline return action. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### NegotiateOnReturnAction
**Description:** This action type is used by a seller to offer a partial refund to buyer with the buyer keeping the item.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable return action code: \`NEGOTIATE\_ON\_RETURN\`.
- **displayText** (String!)
  - A human-readable offer for a partial return action. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### ProcessReturnRefundAction
**Description:** This type is used by a seller issuing a refund for a completed return.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable return action code: \`PROCESS\_RETURN\_REFUND\`.
- **displayText** (String!)
  - The human readable text for issuing a return action. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### ProvideRmaNumberReturnAction
**Description:** This type represents the action of sending a Return Merchandise Authorization (RMA) number for a return shipment.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable return action code: \`PROVIDE\_RMA\_NUMBER\`.
- **displayText** (String!)
  - A human readable text for the return action of sending an RMA for a return. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### ProvideShipmentInfoReturnAction
**Description:** This type is used by a seller to provide tracking information or shipping details for a return.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable return action code: \`PROVIDE\_SHIPMENT\_INFO\`.
- **displayText** (String!)
  - The human-readable text for providing shipment information for a return action. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### RecordReturnReceivedAction
**Description:** This action type is used by a seller to notify eBay that the returned item has been received. This is applicable for non-trackable returns, such as freight shipments, where tracking information is unavailable.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable return action code: \`RECORD\_RETURN\_RECEIVED\`.
- **displayText** (String!)
  - The human-readable text for return action. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### ReturnReferralAction
**Description:** This type represents the action to refer a return case (escalate or appeal) to eBay for help or further review. The action becomes available when the participant is eligible to escalate the return, and includes the list of valid referral reasons that can be selected during submission.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable return action code: \`REFER\_RETURN\_TO\_EBAY\`.
- **displayText** (String!)
  - The human-readable text for the return action. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters
- **referralReasons** ([ReturnReferralReason!]!)
  - This list of one or more actions to refer (escalate) an order return for eBay's help or further review, becomes available when the participant is eligible to escalate the return and includes the list of valid referral reasons that may be selected by the user.

### SendMessageReturnAction
**Description:** This type is used for sending a message in a return conversation between the buyer and the seller.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable return action code: \`SEND\_MESSAGE\`.
- **displayText** (String!)
  - The human-readable text for send message return action. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### SellerOrderReturns
**Description:** This type includes the list of returned order line items and pagination information.
**Type:** GraphQLObjectType

**Properties:**
- **orderReturns** ([OrderReturn!]!)
  - This array lists one or more line items for the returned order.
- **pagination** (Pagination!)
  - This object provides pagination information for navigating through the returned page set.

### OrderReturn
**Description:** This type represents the return of an item back to the seller or eBay. A return is a post-purchase event allowing a buyer to return an item to the seller or eBay, for a refund or exchange. \*\*Note:\*\* Returns are handled at the order line item level. Each return is associated with a single line item (not the entire order).
**Type:** GraphQLObjectType

**Properties:**
- **returnId** (ID!)
  - The unique identifier of a return request.
- **buyerAvailableActions** (AvailableReturnActions)
  - This object represents actions available for the buyer on this return based on the return state and role. This field is nullable. It may be null for any of the following reasons: - the buyer is not a participant - no actions are currently available based on the return state and role - the return is in a terminal state (for example, \`CLOSED\`)
- **cases** ([PostPurchaseCase!])
  - This field is returned only when the inquiry has been referred to eBay and contains the post-purchase cases associated with this return.
- **closedAt** (DateTime)
  - The date the return request was resolved and closed.
- **refunds** ([Refund!])
  - An optional array listing refunds that are associated with the return, present if there are refunds associated with the return.
- **requestedAt** (DateTime!)
  - The date when the return was requested.
- **requester** (PostPurchaseActorRole!)
  - This value indicates which party (such as the buyer or the seller) initiated the return. Applicable values: \* \`BUYER\`: Buyer requested the return \* \`SELLER\`: Used for in-store returns \* \`EBAY\`: Indicates returns initiated by eBay Partner (Authentication Provider, Logistic Partner, eBay Admin, Customer Support, or similar)
- **returnFulfillment** (ReturnFulfillment)
  - This object provides details on the fulfillment of the return. It is optionally present only if the item needs to be returned.
- **returnLineItems** ([ReturnLineItem!]!)
  - An array listing the line items attached to this return.
- **returnNegotiation** (ReturnNegotiation)
  - This optional object provides the complete negotiation conversation for a return, present if an offer has been submitted for the return.
- **sellerAvailableActions** (AvailableReturnActions)
  - This object represents the actions available for the seller on this return based on the return state and role. This field is nullable for any of the following reasons: - the seller is not a participant - no actions are currently available based on the return state and role - the return is in a terminal state (in other words, \`CLOSED\`)
- **status** (ReturnStatus!)
  - This object indicates the status of the return in both a code and a human-readable description.
- **refundEstimate** (RefundEstimate)
  - The refund estimation for the return entity. If \*\*refundEstimate\*\* is not requested on an order, this will not be calculated and provided.

### AvailableReturnActions
**Description:** This type represents actions the user can take for a specific return. The actions include the primary response action (such as approve or provide label), and any additional context-dependent actions (such as message seller or update address). Actions available depend on the current state of the return and the user's role.
**Type:** GraphQLObjectType

**Properties:**
- **respondByAction** (ReturnRespondByAction)
  - The primary action that the user is expected to take, including the due date for completing the action. This field is present if an action is required from the user.
- **secondaryActions** ([ReturnAction!])
  - A list of one or more optional or supplementary actions the user can take in addition to the primary response.

### ReturnRespondByAction
**Description:** This type represents a required, time-sensitive, primary return action for a specific return, with a due date for completing the action. Use this type to highlight time-sensitive actions required from a buyer or seller.
**Type:** GraphQLObjectType

**Properties:**
- **respondAction** (ReturnAction!)
  - The required action.
- **responseDueAt** (DateTime!)
  - The due date for completing the action.

### PostPurchaseCase
**Description:** This type represents a review case associated with a post-purchase flow, such as an order inquiry or a return. This type captures the review status, referral reason, involved parties, decision history, and current outcome.
**Type:** GraphQLObjectType

**Properties:**
- **caseId** (ID!)
  - The unique identifier of the post-purchase case.
- **decisionHistory** ([PostPurchaseCaseDecision!]!)
  - This array returns the history of past decisions made in this case, scoped to the entity under review. \*\*Note:\*\* This list can be empty if no prior decisions exist.
- **initiator** (PostPurchaseActorRole!)
  - The actor who initiated the review request (e.g., 'BUYER', 'SELLER', 'SYSTEM').
- **latestDecision** (PostPurchaseCaseDecision)
  - The most recent decision made as part of the review. \*\*Note\*\*: This field is optional. If null, the case is still under review or no decision has been made yet.
- **reason** (PostPurchaseCaseReferralReason!)
  - The reason the case was referred for review, provided during escalation or referral.
- **status** (PostPurchaseCaseStatus!)
  - The current status of the review (e.g., 'OPEN', 'ON\_HOLD', 'CLOSED').

### PostPurchaseCaseDecision
**Description:** This type represents a party-scoped decision made as part of a post-purchase case review. Each decision applies to either the buyer or the seller and may reference a previous decision or include appeal history. This type applies to both order inquiries and returns, and captures metadata about who made the decision, when it was made, which party it favored, and any associated outcomes or review requests.
**Type:** GraphQLObjectType

**Properties:**
- **decidedAt** (DateTime!)
  - The timestamp when the decision was made.
- **decisionId** (ID!)
  - The unique identifier of the decision.
- **inFavorOf** (PostPurchaseCaseDecisionFavor!)
  - The party the decision was made in favor of (e.g., 'BUYER', 'SELLER', 'NONE').
- **note** (String)
  - An optional note or reasoning provided at the time of decision. \*\*Note\*\*: If null, no note was added. \*\*Maximum length\*\*: 512 characters \*\*Format\*\*: Alphanumeric
- **outcomes** ([PostPurchaseCaseDecisionOutcome!]!)
  - This array returns a list of one or more outcomes associated with the decision (e.g., refund granted, credit issued). This field is required and must contain at least one outcome.
- **reviewRequest** (PostPurchaseCaseDecisionReview)
  - An optional review request (appeal) submitted against this decision. \*\*Note:\*\* If returned null, no appeal has been submitted for this decision.

### CreditSellerForRefundChargeDecisionOutcome
**Description:** This type represents a decision outcome where the seller is credited for a refund charge. This type is used in cases where eBay absorbs the cost and compensates the seller.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable code indicating the type of outcome.
- **decisionAmount** (AmountSet!)
  - The credited amount paid out to the seller.
- **displayText** (String!)
  - The human-readable text of the case decision outcome. \*\*Max Length 100 characters \*\*Format\*\*: Alphanumeric

### RefundDecisionOutcome
**Description:** This type represents a refund decision outcome, including refund amount and who will be charged.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable code indicating the type of outcome.
- **decisionAmount** (AmountSet!)
  - The monetary amount of the refund issued as part of the decision.
- **displayText** (String!)
  - The human-readable text of the case decision outcome. \*\*Max Length 100 characters \*\*Format\*\*: Alphanumeric

### UpholdPreviousDecisionOutcome
**Description:** This type represents an outcome where the previous decision is upheld. This type is used when an appeal is denied or no change is made to the original resolution.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable code indicating the type of outcome.
- **displayText** (String!)
  - The human-readable text of the case decision outcome. \*\*Max Length 100 characters \*\*Format\*\*: Alphanumeric

### PostPurchaseCaseDecisionReview
**Description:** This type represents a review request (appeal) submitted against a decision made on a post-purchase case. This type applies to both order inquiries and return cases, and captures who submitted the request, when it was submitted, the referral reason, status, and any accompanying justification.
**Type:** GraphQLObjectType

**Properties:**
- **reason** (PostPurchaseCaseReferralReason!)
  - The referral reason associated with the review request.
- **requestedAt** (DateTime!)
  - The timestamp when the review request was submitted.
- **requester** (PostPurchaseActorRole!)
  - The party who submitted the review request (e.g., 'BUYER', 'SELLER').
- **requesterNote** (String)
  - An optional note or explanation provided by the requester as part of the review. \*\*Maximum length\*: 512 characters \*Format\*: Alphanumeric \*\*Note:\*\* If returned null, no additional note was supplied.

### BuyerConfirmedDelivery
**Description:** This type indicates that the buyer has confirmed receipt of the item.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable reason code: \`BUYER\_CONFIRMED\_RECEIVED\_ITEM\`.
- **displayText** (String!)
  - The human-readable text of the case referral reason. \*\*Format\*\*: Alphanumeric \*\*Maximum length\*\*: 100 characters

### ConfirmedDelivery
**Description:** This type indicates that tracking confirms the item was delivered to the correct address.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable code indicating the type of outcome.
- **displayText** (String!)
  - Human readable text of the case referral reason. \*\*Maximum length\*\*: 100 characters \*\*Format\*\*: Alphanumeric

### DamagedItemReturned
**Description:** This type indicates that the item was received damaged, likely during shipping.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable reason code: \`RECEIVED\_DAMAGED\_ITEM\`.
- **displayText** (String!)
  - A human-readable case referral reason. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### HeldAtCustoms
**Description:** This type indicates that the item is currently held at customs.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable reason code: \`HELD\_AT\_CUSTOMS\`.
- **displayText** (String!)
  - The human-readable text of the case referral reason. \*\*Maximum length\*\*: 100 characters \*\*Format\*\*: Alphanumeric

### NoRefundForReturnShipping
**Description:** This type indicates that the buyer has not received a refund for return shipping.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable reason code: \`NO\_REFUND\_FOR\_RETURN\_SHIPPING\`.
- **displayText** (String!)
  - A human-readable case referral reason. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### OtherReferral
**Description:** This type represents any other reason not covered by specific types.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable reason code: \`OTHER\_REFERRAL\`.
- **displayText** (String!)
  - The human-readable text of the case referral reason. \*\*Maximum length\*\*: 100 characters \*\*Format\*\*: Alphanumeric

### OtherReferralReason
**Description:** This type indicates any other reason not covered by specific categories.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable reason code: \`OTHER\`.
- **displayText** (String!)
  - A human-readable case referral reason. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### ReceivedEmptyBox
**Description:** This type indicates that the buyer received an empty box.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable reason code: \`RECEIVED\_EMPTY\_BOX\`.
- **displayText** (String!)
  - The human-readable text of the case referral reason. \*\*Maximum length\*\*: 100 characters \*\*Format\*\*: Alphanumeric

### RefundedBuyer
**Description:** This type indicates that the buyer was already refunded through the eBay platform.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable reason code: \`REFUNDED\_BUYER\`.
- **displayText** (String!)
  - The human-readable text of the case referral reason. \*\*Maximum length\*\*: 100 characters \*\*Format\*\*: Alphanumeric

### RefundNotReceived
**Description:** This type indicates that the buyer has not received a refund for the return.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable reason code: \`NO\_REFUND\_RECEIVED\`.
- **displayText** (String!)
  - The human-readable text of the case referral reason. \*\*Maximum length\*\*: 100 characters \*\*Format\*\*: Alphanumeric

### ReplacementSent
**Description:** This type indicates that the seller has sent a replacement item to the buyer.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable reason code: \`REPLACEMENT\_SENT\`.
- **displayText** (String!)
  - The human-readable text of the case referral reason. \*\*Maximum length\*\*: 100 characters \*\*Format\*\*: Alphanumeric

### ReturnedWrongItem
**Description:** This type indicates that the buyer returned the wrong item.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - Machine-readable reason code: \`BUYER\_RETURNED\_WRONG\_ITEM\`.
- **displayText** (String!)
  - The human-readable text of the case referral reason. \*\*Maximum length\*\*: 100 characters \*\*Format\*\*: Alphanumeric

### ReturnNotReceived
**Description:** This type indicates that the return item has not been received by the seller.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable reason code: \`RETURN\_NOT\_RECEIVED\`.
- **displayText** (String!)
  - The human-readable text of the case referral reason. \*\*Maximum length\*\*: 100 characters \*\*Format\*\*: Alphanumeric

### SellerConfirmedShipment
**Description:** This type indicates that seller confirmed the shipment.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable code indicating the type of outcome.
- **displayText** (String!)
  - The human-readable text of the case referral reason. \*\*Maximum length\*\*: 100 characters \*\*Format\*\*: Alphanumeric

### UnableToReachAgreement
**Description:** This type indicates that a participant (buyer or seller) is experiencing communication difficulties with the other party.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - Machine-readable reason code: \`UNABLE\_TO\_REACH\_AGREEMENT\`.
- **displayText** (String!)
  - The human-readable text of the case referral reason. \*\*Maximum length\*\*: 100 characters \*\*Format\*\*: Alphanumeric

### UnresponsiveTradingPartner
**Description:** This type indicates that a participant (buyer or seller) has not received a response from the other party.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - Machine-readable reason code: \`SELLER\_NO\_RESPONSE\`.
- **displayText** (String!)
  - The human-readable text of the case referral reason. \*\*Maximum length\*\*: 100 characters \*\*Format\*\*: Alphanumeric

### PostPurchaseCaseClosed
**Description:** This type indicates that the review case has been closed. This may happen after a final decision has been made (e.g., refund granted or denied), or the case may be automatically closed due to resolution or expiration of the review window. This type applies to both order inquiries and return cases.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable code for the status. In this case, 'CLOSED'.
- **displayText** (String!)
  - The human-readable text of the case status. \*\*Max length\*\*: 100 characters \*\*Format\*\*: Alphanumeric

### PostPurchaseCaseOnHold
**Description:** This type indicates that the review case is currently on hold. This typically occurs when the case is waiting for an action from a participant, such as the buyer uploading evidence or the seller providing a response. This type applies to both order inquiries and return cases.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable code for the status. In this case, 'ON\_HOLD'.
- **displayText** (String!)
  - The human-readable text of the case status. \*\*Max length\*\*: 100 characters \*\*Format\*\*: Alphanumeric

### PostPurchaseCaseOpen
**Description:** This type indicates that the review case is open and actively under evaluation. This status means the case has been referred or escalated, and is within the review window, but a final decision has not yet been made. This type applies to both order inquiries and return cases.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable code for the status. In this case, 'OPEN'.
- **displayText** (String!)
  - The human-readable text of the case status. \*\*Max length\*\*: 100 characters \*\*Format\*\*: Alphanumeric

### Refund
**Description:** This type represents a single refund that was executed on a purchase contract.
**Type:** GraphQLObjectType

**Properties:**
- **refundId** (ID!)
  - The unique identifier of the refund.
- **buyerRefundBreakdown** (BuyerRefundBreakdown!)
  - This object provides a breakdown of the refund for the buyer. This can be requested only if the user context is the buyer on the contract.
- **distributions** ([PayeeRefundDistribution!]!)
  - This array specifies how the refund was distributed to the payee. The payee could be the buyer who receives the funds from the refund, or eBay that receives the funds due to withholding for label costs or eBay coupons that funded the original payment. \*\*Note:\*\* This field cannot be accessed by a seller.
- **fundings** ([PayerRefundFunding!]!)
  - This array specifies how the refund was funded by the payer. The payer could be the seller who is funding the amount or an eBay partner funding the amount. \*\*Note\*\*: This field cannot be accessed by a buyer.
- **refundStatus** (RefundStatus!)
  - The current status of the refund.
- **sellerRefundBreakdown** (SellerRefundBreakdown!)
  - This object provides a breakdown of the refund for the seller. This can only be requested if the user context is the seller on the contract.

### BuyerRefundBreakdown
**Description:** This type represents a buyer's refund breakdown. \*\*Note\*\*: These fields can only be accessed by a buyer.
**Type:** GraphQLObjectType

**Properties:**
- **netRefundAmount** (AmountSet!)
  - The net refund amount being refunded to the buyer. This value equals the \*\*totalRefundAmount\*\* subtracted by any withholdings on the order (specified through the \*\*totalWithholdingAmount\*\* object).
- **refundPriceLines** ([PriceLineRollup!]!)
  - This array returns the list of pricelines that are being refunded.
- **totalRefundAmount** (AmountSet!)
  - The total monetary amount being refunded to the buyer.
- **totalWithholdingAmount** (AmountSet)
  - The total withholding amount applied on the refund. If this object is returned as \`null\`, there are no additional with holdings applied on refund.
- **withholdings** ([RefundWithholding!])
  - This array returns the list of withholdings applied on the refund. If this array is returned \`null\`, there are no additional with holdings applied on refund.

### SellerRefundBreakdown
**Description:** This type represents a seller's refund breakdown and provides details about the amounts the seller refunds on the contract. \*\*Note\*\*: This type provides only the seller pricelines and refund amount that seller received as part contract fulfillment, and doesn't include pricelines such as \`TAX\` or \`SERVICE\_FEE\` that the seller didn't receive in the first place. These fields can only be accessed by a seller.
**Type:** GraphQLObjectType

**Properties:**
- **credits** ([SellerRefundCredit!])
  - This array returns all types of credits applied to the refund, including: - \*\*Total fee credits\*\*. In some instances, marketplaces fees charged are credited to the seller. - \*\*Total donation credits\*\*. In some instances, the donation of sale proceeds are credited back with the refund. \*\*Note\*\*: Donations are not always credited back if the proceeds were already donated. If this array is returned \`null\`, there are no additional credits applied to refund.
- **netRefundAmount** (AmountSet!)
  - The net amount being refunded by the seller. This value equals the \*\*totalRefundAmount\*\* subtracted by any withholdings on the order (specified through the \*\*totalWithholdingAmount\*\* object) and any applicable credits (fee credits, donation credits, etc.).
- **refundPriceLines** ([PriceLineRollup!]!)
  - This array returns a list of pricelines that are being refunded by seller.
- **totalCreditAmount** (AmountSet)
  - The total amount credited for the seller. If this object is returned \`null\`, there are no additional credits applied to refund.
- **totalRefundAmount** (AmountSet!)
  - The total monetary amount being refunded by the seller.
- **totalWithholdingAmount** (AmountSet)
  - The total withholding amount applied on the refund by the seller. If this object is returned \`null\`, there are no additional withholdings applied to refund.
- **withholdings** ([RefundWithholding!])
  - This array returns a list of withholding made on the order by seller.

### ListingSubtotal
**Description:** This type defines the priceline roll up for listing sub total.
**Type:** GraphQLObjectType

**Properties:**
- **amount** (AmountSet!)
  - The monetary amount of the priceline rollup. This is the monetary value associated with the priceline item group.
- **name** (String!)
  - The human-readable name of the priceline roll up. \*\*Note\*\*: In this context, the name will always be returned as \`LISTING\_SUBTOTAL\`.
- **priceLines** ([PriceLine!]!)
  - This array returns the pricelines that are part of the rollup.

### ServiceFeeSubtotal
**Description:** This type defines the priceline rollup for service fee subtotal.
**Type:** GraphQLObjectType

**Properties:**
- **amount** (AmountSet!)
  - The monetary amount of the priceline rollup. This is the monetary value associated with the priceline item group
- **name** (String!)
  - The human-readable name of the priceline rollup. \*\*Note\*\*: In this context, the name will always be returned as \`SERVICE\_FEE\_SUBTOTAL\`.
- **priceLines** ([PriceLine!]!)
  - This array returns the pricelines that are part of the rollup.

### ShippingSubtotal
**Description:** This type defines the priceline roll up for shipping subtotal.
**Type:** GraphQLObjectType

**Properties:**
- **amount** (AmountSet!)
  - The monetary amount of the priceline rollup. This is the monetary value associated with the priceline item group
- **name** (String!)
  - The human-readable name of the priceline rollup. \*\*Note\*\*: In this context, the name will always be returned as \`SHIPPING\_SUBTOTAL\`.
- **priceLines** ([PriceLine!]!)
  - This array returns the pricelines that are part of the rollup.

### TaxSubtotal
**Description:** This type defines the priceline roll up for tax subtotal.
**Type:** GraphQLObjectType

**Properties:**
- **amount** (AmountSet!)
  - The monetary amount of the priceline rollup. This is the monetary value associated with the priceline item group
- **name** (String!)
  - The human-readable name of the priceline rollup. \*\*Note\*\*: In this context, the name will always be returned as \`TAX\_SUBTOTAL\`.
- **priceLines** ([PriceLine!]!)
  - This array returns the pricelines that are part of the rollup.

### AmountSet
**Description:** This type is used to provide a monetary amount in two different currencies. This might be needed if the buyer's and/or seller's currency is different than the currency used on the listing marketplace.
**Type:** GraphQLObjectType

**Properties:**
- **exchangeScenario** (ExchangeScenarioResult)
  - This enumeration value indicates that the monetary amount shown in the \*\*exchangeScenarioByName\*\* object is in the buyer's or seller's currency.
- **exchangeScenarioByName** (ExchangeScenarioResult)
  - The monetary amount converted to a different currency, such as the buyer's or seller's currency.
- **original** (Amount!)
  - The monetary amount in its original currency.

### ExchangeAmount
**Description:** This type is used to show a monetary amount that is converted to a different currency, such as the buyer's or seller's currency. The \*\*amount\*\* and \*\*exchangeRate\*\* values are only estimates or projections if the actual conversion has not happened yet.
**Type:** GraphQLObjectType

**Properties:**
- **amount** (Amount!)
  - The converted monetary amount in the buyer's or seller's currency. \*\*Note\*\*: This value is only an estimate or projection if the actual conversion has not happened yet.
- **exchangeAt** (DateTime)
  - The timestamp indicates when the currency conversion happened at the rate found in the \*\*exchangeRate\*\* field. \*\*Note\*\*: Will be null if currency conversion has not happened or if the timestamp is unavailable.
- **exchangeRate** (Decimal)
  - The exchange rate that was used or will be used for the currency conversion. \*\*Note\*\*: This rate fluctuates until the currency conversion has taken place, but currency conversion happens, the rate no longer changes.

### Amount
**Description:** This type is used to express a monetary amount in a specific currency.
**Type:** GraphQLObjectType

**Properties:**
- **currency** (CurrencyAlpha3Code)
  - The three-letter ISO 4217 currency code associated with this monetary amount. \*\*Format\*\*: Three-letter uppercase alphabetic code (e.g., \`USD\`, \`EUR\`, \`GBP\`)
- **value** (Decimal!)
  - The numerical value of the monetary amount in the currency specified through the \*\*currency\*\* field.

### DomesticShippingPrice
**Description:** This type defines the priceline for Domestic Shipping Price.
**Type:** GraphQLObjectType

**Properties:**
- **amount** (AmountSet!)
  - The monetary value associated with the priceline item.
- **name** (String!)
  - The human-readable priceline name. \*\*Note\*\*: In this case, the name will always be returned as \`DOMESTIC\_SHIPPING\_PRICE\`.

### DomesticShippingTax
**Description:** This type defines the priceline for Domestic Shipping Tax.
**Type:** GraphQLObjectType

**Properties:**
- **amount** (AmountSet!)
  - The monetary value associated with the priceline item.
- **name** (String!)
  - The human-readable priceline name. \*\*Note\*\*: In this case, the name will always be returned as \`DOMESTIC\_SHIPPING\_TAX\`.

### ImportTax
**Description:** This type defines the priceline for Import Tax.
**Type:** GraphQLObjectType

**Properties:**
- **amount** (AmountSet!)
  - The monetary value associated with the priceline item.
- **name** (String!)
  - The human-readable priceline name. \*\*Note\*\*: In this case, the name will always be returned as \`IMPORT\_TAX\`.

### InternationalShippingPrice
**Description:** This type defines the priceline for International Shipping Price.
**Type:** GraphQLObjectType

**Properties:**
- **amount** (AmountSet!)
  - The monetary value associated with the priceline item.
- **name** (String!)
  - The human-readable priceline name. \*\*Note\*\*: In this case, the name will always be returned as \`INTERNATIONAL\_SHIPPING\_PRICE\`.

### InternationalShippingTax
**Description:** This type defines the priceline for International Shipping Tax.
**Type:** GraphQLObjectType

**Properties:**
- **amount** (AmountSet!)
  - The monetary value associated with the priceline item.
- **name** (String!)
  - The human-readable priceline name. \*\*Note\*\*: In this case, the name will always be returned as \`INTERNATIONAL\_SHIPPING\_TAX\`.

### ItemPrice
**Description:** This type defines the priceline for Item Price.
**Type:** GraphQLObjectType

**Properties:**
- **amount** (AmountSet!)
  - The monetary value associated with the priceline item.
- **name** (String!)
  - The human-readable priceline name. \*\*Note\*\*: In this case, the name will always be returned as \`ITEM\_PRICE\`.

### ItemTax
**Description:** This type defines the priceline for Item Tax.
**Type:** GraphQLObjectType

**Properties:**
- **amount** (AmountSet!)
  - The monetary value associated with the priceline item.
- **name** (String!)
  - The human-readable priceline name. \*\*Note\*\*: In this case, the name will always be returned as \`ITEM\_TAX\`.

### RegulatoryTaxFee
**Description:** This type defines the priceline for Regulatory Tax Fee.
**Type:** GraphQLObjectType

**Properties:**
- **amount** (AmountSet!)
  - The monetary value associated with the priceline item.
- **name** (String!)
  - The human-readable priceline name. \*\*Note\*\*: In this case, the name will always be returned as \`TAX\_FEE\`.

### ServiceFee
**Description:** This type defines the priceline for Service Fee.
**Type:** GraphQLObjectType

**Properties:**
- **amount** (AmountSet!)
  - The monetary value associated with the priceline item.
- **name** (String!)
  - The human-readable priceline name. \*\*Note\*\*: In this case, the name will always be returned as \`SERVICE\_FEE\`.

### ServiceFeeTax
**Description:** This type defines the priceline for Service Fee Tax.
**Type:** GraphQLObjectType

**Properties:**
- **amount** (AmountSet!)
  - The monetary value associated with the priceline item.
- **name** (String!)
  - The human-readable priceline name. \*\*Note\*\*: In this case, the name will always be returned as \`SERVICE\_FEE\_TAX\`.

### ShippingHandlingPrice
**Description:** This type defines the priceline for shipping gandling price.
**Type:** GraphQLObjectType

**Properties:**
- **amount** (AmountSet!)
  - The monetary value associated with the priceline item.
- **name** (String!)
  - The human-readable priceline name. \*\*Note\*\*: In this case, the name will always be returned as \`DOMESTIC\_HANDLING\_PRICE\`.

### ShippingHandlingTax
**Description:** This type defines the priceline for Shipping Handling Tax.
**Type:** GraphQLObjectType

**Properties:**
- **amount** (AmountSet!)
  - The monetary value associated with the priceline item.
- **name** (String!)
  - The human-readable priceline name. \*\*Note\*\*: In this case, the name will always be returned as \`SHIPPING\_HANDLING\_TAX\`.

### ShippingPrice
**Description:** This type defines the priceline for shipping price.
**Type:** GraphQLObjectType

**Properties:**
- **amount** (AmountSet!)
  - The monetary value associated with the priceline item.
- **name** (String!)
  - The human-readable priceline name. \*\*Note\*\*: In this case, the name will always be returned as \`SHIPPING\_PRICE\`.

### ShippingTax
**Description:** This type defines the priceline for shipping tax.
**Type:** GraphQLObjectType

**Properties:**
- **amount** (AmountSet!)
  - The monetary value associated with the priceline item.
- **name** (String!)
  - The human-readable priceline name. \*\*Note\*\*: In this case, the name will always be returned as \`SHIPPING\_TAX\`.

### LabelPurchaseWithholding
**Description:** This type represents an amount being withheld from the refund due to the cost of a shipping label.
**Type:** GraphQLObjectType

**Properties:**
- **amount** (AmountSet!)
  - The monetary amount being withheld from the refund.
- **name** (String!)
  - The name of the withholding. \*\*Note\*\*: In this case, the name will always be returned as \`RETURN\_LABEL\_PURCHASE\`.

### SellerWithholding
**Description:** This type represents an amount being withheld by the seller due to issues when the item was exchanged back.
**Type:** GraphQLObjectType

**Properties:**
- **amount** (AmountSet!)
  - The monetary amount being withheld from the refund.
- **name** (String!)
  - The name of the withholding. \*\*Note\*\*: In this case, the name will always be returned as \`SELLER\_DEDUCTION\`.

### BuyerRefundDistribution
**Description:** This type provides detail about refund distributions to a buyer.
**Type:** GraphQLObjectType

**Properties:**
- **distributionExecutions** ([RefundDistributionExecution!])
  - This array returns a list of distribution execution associated with a refund made to a buyer.
- **distributionState** (RefundDistributionState!)
  - This field returns the current refund distribution state of the buyer refund.

### RefundDistributionExecution
**Description:** This type defines the distribution execution details for a refund.
**Type:** GraphQLObjectType

**Properties:**
- **amount** (AmountSet!)
  - The total monetary amount that is transferred from the source account to the destination account.
- **attemptedAt** (DateTime!)
  - The date and time when the execution was attempted, regardless success or failure.
- **completedAt** (DateTime)
  - The date and time when the execution was completed, regardless success or failure.
- **paymentMethod** (RefundPaymentMethod)
  - The payment method where funds where distributed.
- **state** (PaymentState!)
  - The state of the payment.

### RefundPaymentMethod
**Description:** This type provides details about the payment method used to process a refund.
**Type:** GraphQLObjectType

**Properties:**
- **paymentType** (PaymentMethodType!)
  - Represents the type of payment method used to process the refund.

### ApplePay
**Description:** This type is used to identify Apple Pay as the payment method.
**Type:** GraphQLObjectType

**Properties:**
- **code** (ID!)
  - The unique identifier of the Apple Pay payment method.
- **descriptiveName** (String!)
  - The descriptive name of the Apple Pay payment method.
- **displayName** (String!)
  - The display name of the Apple Pay payment method.

### CreditCard
**Description:** This type is used to identify Credit Card as the payment method.
**Type:** GraphQLObjectType

**Properties:**
- **code** (ID!)
  - The unique identifier of the credit card payment method.
- **descriptiveName** (String!)
  - The descriptive name of the credit card payment method.
- **displayName** (String!)
  - The display name of the credit card payment method.

### EbayBalance
**Description:** This type is used to identify eBay balance as the payment method.
**Type:** GraphQLObjectType

**Properties:**
- **code** (ID!)
  - The unique identifier of the eBay balance payment method.
- **descriptiveName** (String!)
  - The descriptive name of the eBay balance payment method.
- **displayName** (String!)
  - The display name of the eBay balance payment method.

### GooglePay
**Description:** This type is used to identify Google Pay as the payment method.
**Type:** GraphQLObjectType

**Properties:**
- **code** (ID!)
  - The unique identifier of the Google Pay payment method.
- **descriptiveName** (String!)
  - The descriptive name of the Google Pay payment method.
- **displayName** (String!)
  - The display name of the Google Pay payment method.

### KlarnaInstallment
**Description:** This type is used to identify KlarnaInstallment as the payment method.
**Type:** GraphQLObjectType

**Properties:**
- **code** (ID!)
  - The unique identifier of the KlarnaInstallment payment method.
- **descriptiveName** (String!)
  - The descriptive name of the KlarnaInstallment payment method.
- **displayName** (String!)
  - The display name of the KlarnaInstallment payment method.

### KlarnaInvoice
**Description:** This type is used to identify KlarnaInvoice as the payment method.
**Type:** GraphQLObjectType

**Properties:**
- **code** (ID!)
  - The unique identifier of the KlarnaInvoice payment method.
- **descriptiveName** (String!)
  - The descriptive name of the KlarnaInvoice payment method.
- **displayName** (String!)
  - The display name of the KlarnaInvoice payment method.

### PayPal
**Description:** T his type is used to identify PayPal as the payment method.
**Type:** GraphQLObjectType

**Properties:**
- **code** (ID!)
  - The unique identifier of the PayPal payment method.
- **descriptiveName** (String!)
  - The descriptive name of the PayPal payment method.
- **displayName** (String!)
  - The display name of the PayPal payment method.

### Sofort
**Description:** This type is used to identify Sofort as the payment method.
**Type:** GraphQLObjectType

**Properties:**
- **code** (ID!)
  - The unique identifier of Sofort payment method.
- **descriptiveName** (String!)
  - The descriptive name of the Sofort payment method.
- **displayName** (String!)
  - The display name of the Sofort payment method.

### UnknownPaymentMethod
**Description:** This type represents transactions that use unrecognized or unsupported payment methods.
**Type:** GraphQLObjectType

**Properties:**
- **code** (ID!)
  - The unique identifier of the payment method code for unknown payments. Value: \`UNKNOWN\`.
- **descriptiveName** (String!)
  - The descriptive name of the unknown payment method.
- **displayName** (String!)
  - The display name of the unknown payment method.

### Venmo
**Description:** This type is used to identify Venmo as the payment method.
**Type:** GraphQLObjectType

**Properties:**
- **code** (ID!)
  - The unique identifier of Venmo payment method.
- **descriptiveName** (String!)
  - The descriptive name of the Venmo payment method.
- **displayName** (String!)
  - The display name of the Venmo payment method.

### WireTransfer
**Description:** This type is used to identify wire transfer as the payment method.
**Type:** GraphQLObjectType

**Properties:**
- **code** (ID!)
  - The unique identifier of wire transfer.
- **descriptiveName** (String!)
  - The descriptive name of the wire transfer payment method.
- **displayName** (String!)
  - The display name of the wire transfer payment method.

### ZIP
**Description:** This type is used to identify ZIPPay as the payment method.
**Type:** GraphQLObjectType

**Properties:**
- **code** (ID!)
  - The unique identifier of the ZIPPay payment method.
- **descriptiveName** (String!)
  - The descriptive name of the ZIPPay payment method.
- **displayName** (String!)
  - The display name of the ZIPPay payment method.

### RefundDistributionCancelled
**Description:** This type specifies that the refund distribution has been cancelled.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable status code specifying the state of refund distribution cancellation. \*\*Note\*\*: In this case, the status code will always be returned as \`REFUND\_DISTRIBUTION\_CANCELLED\`.
- **displayText** (String!)
  - The human-readable status for refund distribution.

### RefundDistributionCompleted
**Description:** This type defines the state for refund distribution completion.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable status code specifying the state of refund distribution once it has been completed. \*\*Note\*\*: In this case, the status code will always be returned as \`REFUND\_DISTRIBUTION\_COMPLETED\`.
- **displayText** (String!)
  - The human-readable status for refund distribution.

### RefundDistributionFailed
**Description:** This type defines the state for refund distribution failure.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable status code specifying the state of refund distribution failure. \*\*Note\*\*: In this case, the status code will always be returned as \`REFUND\_DISTRIBUTION\_FAILED\`.
- **displayText** (String!)
  - The human-readable status for refund distribution.

### RefundDistributionInitiated
**Description:** This type defines the initial state of a refund distribution at the time of creation.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable status code specifying the state of refund distribution at the time of creation. \*\*Note\*\*: In this case, the status code will always be returned as \`REFUND\_DISTRIBUTION\_INITIATED\`.
- **displayText** (String!)
  - The human-readable status for refund distribution.

### RefundDistributionInProgress
**Description:** This type defines the state of a refund distribution in progress.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable status code specifying the state of refund distribution in progress. \*\*Note\*\*: In this case, the status code will always be returned as \`REFUND\_DISTRIBUTION\_IN\_PROGRESS\`.
- **displayText** (String!)
  - The human-readable status for refund distribution.

### SellerRefundFunding
**Description:** This type provides details on how the seller is funding a refund.
**Type:** GraphQLObjectType

**Properties:**
- **fundingExecutions** ([RefundFundingExecution!])
  - This array returns a list of funding execution details associated with the refund.
- **fundingState** (RefundFundingState!)
  - This object returns the funding state of the refund.

### RefundFundingExecution
**Description:** This type defines the funding execution details for a refund.
**Type:** GraphQLObjectType

**Properties:**
- **amount** (AmountSet!)
  - The total monetary amount that is transferred from the source account to the destination account.
- **attemptedAt** (DateTime!)
  - The date and time when the execution was attempted, regardless success or failure.
- **completedAt** (DateTime)
  - The date and time when the execution was completed, regardless success or failure.
- **paymentMethod** (RefundPaymentMethod)
  - The payment method that funded the refund.
- **state** (PaymentState!)
  - The state of the payment.

### RefundFundingCancelled
**Description:** This type specifies that the refund funding has been cancelled.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable status code specifying the cancelled state of the funding. \*\*Note\*\*: In this case, the status code will always be returned as \`REFUND\_FUNDING\_CANCELLED\`.
- **displayText** (String!)
  - The human-readable status for refund funding.

### RefundFundingCompleted
**Description:** This type defines the state for refund funding completion.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable status code specifying the state of the funding completion. \*\*Note\*\*: In this case, the status code will always be returned as \`REFUND\_FUNDING\_COMPLETED\`.
- **displayText** (String!)
  - The human-readable status for refund funding.

### RefundFundingFailed
**Description:** This type defines the state for refund funding failure.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable status code specifying the state of the funding failure. \*\*Note\*\*: In this case, the status code will always be returned as \`REFUND\_FUNDING\_FAILED\`.
- **displayText** (String!)
  - The human-readable status for refund funding.

### RefundFundingInitiated
**Description:** This type defines the initial state for funding at the time of funding creation.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable status code specifying the state of the funding at the time of funding creation. \*\*Note\*\*: In this case, the status code will always be returned as \`REFUND\_FUNDING\_INITIATED\`.
- **displayText** (String!)
  - The human-readable status for refund funding.

### RefundFundingInProgress
**Description:** This type defines the state for refund funding in progress.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable status code specifying the state of the funding in progress. \*\*Note\*\*: In this case, the status code will always be returned as \`REFUND\_FUNDING\_IN\_PROGRESS\`.
- **displayText** (String!)
  - The human-readable status for refund funding.

### RefundCompleted
**Description:** This type specifies that the refund is in \`COMPLETED\` status.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable status code specifying the status of the refund. \*\*Note\*\*: In this case, the status code will always be returned as \`COMPLETED\`.
- **displayText** (String!)
  - The human-readable text detailing the status of the refund.

### RefundFailed
**Description:** This type specifies that the refund is in \`FAILED\` status.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable status code specifying the status of the refund. \*\*Note\*\*: In this case, the status code will always be returned as \`FAILED\`.
- **displayText** (String!)
  - The human-readable status detailing the status of the refund.

### RefundInProgress
**Description:** This type specifies that the refund is in \`IN\_PROGRESS\` status.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable status code specifying the status of the refund. \*\*Note\*\*: In this case, the status code will always be returned as \`IN\_PROGRESS\`.
- **displayText** (String!)
  - The human-readable text detailing the status of the refund.

### RefundScheduled
**Description:** This type specifies that the refund is in \`SCHEDULED\` status.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable status code specifying the status of the refund. \*\*Note\*\*: In this case, the status code will always be returned as \`SCHEDULED\`.
- **displayText** (String!)
  - The human-readable text detailing the status of the refund.

### ReturnFulfillment
**Description:** This type represents the fulfillment details of a return. This object bridges between the user-facing return process and the underlying logistics execution. It provides the shipment-related context for a return, such as label details, addresses, and tracking data. Buyers and sellers interact primarily with high-level fulfillment states, the internal logistics components (for example, carrier tracking and events) are managed under \`logisticExecutionDetail\`.
**Type:** GraphQLObjectType

**Properties:**
- **finalDestinationAddress** (ReturnAddress!)
  - The destination address where the return package is expected to be delivered.
- **fulfillmentStatus** (ReturnFulfillmentStatus!)
  - This object represents user-friendly fulfilment states for a return. These states convey to buyers and sellers where their return stands in the fulfillment lifecycle, while also aligning with underlying logistics milestones. \*\*Note:\*\* Returns presently have one package per return line item.
- **returnFulfillmentSummary** (ReturnFulfillmentSummary)
  - The summary of the return fulfillment including the latest events for the return shipment. This provides the minimal details required for launching the return. This optional object is present only when a return shipment is initiated.
- **rmaDetails** ([RmaDetail!])
  - This object provides RMA (Return Merchandise Authorization) details for the return shipment, optionally present based on seller preference.
- **sellerFulfillmentInitiation** (ReturnFulfillmentInitiation)
  - This object provides details for initiating the return shipment and is optionally present when return fulfillment is to be initiated. It is not present if there are no action items for the seller to initiate the return fulfillment or the fulfillment has already been initiated. Included in this object are available ways to start the return, for example, a seller-provided label or other label that could be used by the buyer or eBay to initiate the return shipment, and address information.

### Address
**Description:** This type defines the address fields for a user or entity.
**Type:** GraphQLObjectType

**Properties:**
- **addressContact** (AddressContact)
  - The contact details associated with the address. Contact information is only returned in the following scenarios: - A buyer may receive the seller’s contact information for a return address to generate a return label. - A seller may receive the buyer’s contact information for a shipping address to create a forward shipping label.
- **addressId** (ID)
  - The unique public identifier of the address. This field is used primarily for Return Address records and for sharing a reference that is stable across requests. \*\*Example:\*\* 'RA-9c4b2f58-1f4e-4e72-9a4c-702d5e2b74e1'
- **addressLine1** (String)
  - The first line of the street address.
- **addressLine2** (String)
  - The second line of the street address. This field can be used for additional address information, such as a suite or apartment number. This field will only be returned if defined for the shipping address.
- **city** (String)
  - The city of the address.
- **countryCode** (CountryAlpha2Code)
  - The two-letter \[ISO 3166\](https://www.iso.org/iso-3166-country-codes.html) country code for the country of the address.
- **county** (String)
  - The county of the address.
- **postalCode** (String)
  - The postal code of the address.
- **stateOrProvince** (String)
  - The state or province of the address.

### AddressContact
**Description:** This type defines the contact information for a user or business associated with a given address.
**Type:** GraphQLObjectType

**Properties:**
- **name** (String!)
  - The name of the person or business at this address. \*\*Example:\*\* 'Jane Doe' or 'Acme Corporation'.
- **phone** (Phone)
  - The phone contact information associated with this address. If returned \`null\`, no phone number has been provided by the user or business.

### Phone
**Description:** This type stores telephone number information.
**Type:** GraphQLObjectType

**Properties:**
- **countryCode** (CountryAlpha2Code)
  - This enumerated value is the two-letter country code representing the country where the telephone number is registered.
- **dialCode** (String)
  - The numeric international calling code associated with the country where the telephone number is registered.
- **phoneNumber** (String)
  - The telephone number. Only area code, prefix, and local exchange are stored. Neither the international prefix (i.e., \`dialCode\`,) nor the country code (i.e., \`countryCode\`,) are stored. Hyphens and brackets may be included. \*\*For example:\*\* - \`4155552671\` - \`02079460000\` - \`07911234567\`
- **phoneNumberType** (String)
  - Stores the type of telephone number (e.g., mobile, landline, etc.).

### AwaitingReturnFulfillmentDetails
**Description:** This type indicates that the return shipment cannot begin because its missing required fulfillment details (for example, return label, RMA number, or seller-provided instructions). The responsible actor, usually the seller or platform, must provide these details before the shipment can proceed.
**Type:** GraphQLObjectType

**Properties:**
- **actionDueFrom** (PostPurchaseActorRole!)
  - This field contains an enumerated value that indicates the actor responsible for providing the missing fulfillment details. Typical values: \`SELLER\`, \`EBAY\`, \`BUYER\`.
- **code** (String!)
  - A machine-readable code identifying the return fulfillment status. \*\*Format:\*\* Alphanumeric with underscores \*\*Maximum length:\*\* 512 characters
- **displayText** (String!)
  - A human-readable label identifying the return fulfillment status. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### AwaitingReturnFulfillmentInitiation
**Description:** This type indicates that all required shipment details are available and the return is ready to be initiated. The sender (usually the buyer) must now take action to start the shipment, such as printing the label or scheduling a pickup.
**Type:** GraphQLObjectType

**Properties:**
- **actionDueFrom** (PostPurchaseActorRole!)
  - This field contains an enumerated value that indicates the actor responsible for providing the missing fulfillment details. Typical values: \`EBAY\`, \`BUYER\`.
- **code** (String!)
  - A machine-readable code identifying the return fulfillment status. \*\*Format:\*\* Alphanumeric with underscores \*\*Maximum length:\*\* 512 characters
- **displayText** (String!)
  - A human-readable label identifying the return fulfillment status. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### ReturnFulfillmentComplete
**Description:** This type indicates that the return shipment is currently in transit to the destination or being processed by the carrier.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable code identifying the return fulfillment status. \*\*Format:\*\* Alphanumeric with underscores \*\*Maximum length:\*\* 512 characters
- **completedAt** (DateTime!)
  - The date and time when the return shipment was completed (delivered).
- **displayText** (String!)
  - A human-readable label identifying the return fulfillment status. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### ReturnFulfillmentException
**Description:** This type indicates that the return shipment is currently in transit to the destination or being processed by the carrier.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable code identifying the return fulfillment status. \*\*Format:\*\* Alphanumeric with underscores \*\*Maximum length:\*\* 512 characters
- **displayText** (String!)
  - A human-readable label identifying the return fulfillment status. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### ReturnFulfillmentInProgress
**Description:** This type indicates that the return shipment is currently in transit to the destination or being processed by the carrier.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable code identifying the return fulfillment status. \*\*Format:\*\* Alphanumeric with underscores \*\*Maximum length:\*\* 512 characters
- **displayText** (String!)
  - A human-readable label identifying the return fulfillment status. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### ReturnFulfillmentSummary
**Description:** This type provides a summary of the return fulfillment including the latest events for the return shipment. It includes the latest events for every return shipment package.
**Type:** GraphQLObjectType

**Properties:**
- **latestPackageEvents** ([ReturnLogisticEvent!]!)
  - A list containing one or more of the latest return package events. A return supports only one package. The list provides latest events for every return shipment package.

### ReturnShipmentTrackingEvent
**Description:** This type represents an event in the tracking history of a return shipment.
**Type:** GraphQLObjectType

**Properties:**
- **occurredAt** (DateTime!)
  - The date and time when the tracking event occurred.
- **returnLineItems** ([ReturnLineItem!]!)
  - This array returns a list of return line items.
- **status** (ShippingTrackingStatus!)
  - A machine-readable status code representing the current state of the return shipment. Possible values include: \`IN\_TRANSIT\`, \`OUT\_FOR\_DELIVERY\`, \`DELIVERED\`, \`EXCEPTION\`, and similar. \*\*Maximum length:\*\* 100 characters \*\*Format:\*\* Alphanumeric with underscores
- **tracking** (ShippingCarrierTracking!)
  - The shipment tracking info associated with this tracking event.

### ReturnLineItem
**Description:** This type contains information on the order line item attached to the return.
**Type:** GraphQLObjectType

**Properties:**
- **listingRestockTasks** ([PostPurchaseListingRestockTask!])
  - The restock details for the returned listing. Present only when listing restock is requested through returns mutations. This can be a list in case we will support restock for individual listing inside one item bundle.
- **orderLineItem** (OrderLineItem!)
  - The OrderLineItem purchased.
- **requestedQuantity** (Int)
  - The number of units in the request to return. This field is optional and applies only to multi-quantity line items.
- **returnCreationDocuments** ([OrderReturnDocument!])
  - This list contains one or more documents uploaded when the return was created. Optionally present only if the requester has provided any documents during return creation.
- **returnLineItemId** (ID!)
  - The unique identifier of the return line item.
- **returnNote** (String)
  - Notes that were provided during the creation of the return. Optionally present only if the requester has provided a note.
- **returnReason** (ReturnReason!)
  - The return reason, which could change based on the return request and category of items. As new return reasons can be added in future, code so clients can handle this field gracefully. In countries where the return reason is not mandatory to provide, it will be returned as \`UNDISCLOSED\`.

### PostPurchaseListingRelistTask
**Description:** This type represents a task for relisting an item after a post-purchase event such as a cancellation or return. This tracks the automated process of making an item available for sale again.
**Type:** GraphQLObjectType

**Properties:**
- **relistStatus** (PostPurchaseRelistTaskStatus)
  - The current status of the relist task, indicating whether it's initiated, completed, or failed.
- **relistedListing** (ListingReference)
  - The listing that was created as a result of the relist operation, if the task completed successfully

### PostPurchaseRelistTaskCompleted
**Description:** This type indicates that a post-purchase relist task has been successfully completed. The original listing has been restored to active status with updated inventory.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable status code indicating the relist task is completed.
- **displayText** (String!)
  - A human-readable message confirming the relist task completion.

### PostPurchaseRelistTaskFailed
**Description:** This type indicates that a post-purchase relist task has failed to complete successfully. This may be due to inventory issues, policy violations, or system errors.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable status code indicating the relist task has failed.
- **displayText** (String!)
  - A human-readable text for relist task status. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### PostPurchaseRelistTaskInitiated
**Description:** This type indicates that a post-purchase relist task has been initiated and the system is processing the relisting request.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable status code indicating the relist task has been started.
- **displayText** (String!)
  - A human-readable relist task status. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### ListingReference
**Description:** This type is a reference to a listing, and is used to extend Listing or resolve Listing type based on the \*\*listingID\*\*.
**Type:** GraphQLObjectType

**Properties:**
- **listing** (Listing)
  - The listing corresponding to the \*\*listingId\*\*.
- **listingId** (ID!)
  - The unique identifier of the listing.

### SingleSkuListing
**Description:** This type represents a single SKU listing.
**Type:** GraphQLObjectType

**Properties:**
- **items** ([Item!]!)
  - This array contains item(s) that can be bundled as part of a listing. There will always be at least one item
- **listingId** (ID!)
  - The unique identifier of a listing.
- **itemCommitments** (ItemCommitments!)
  - This array can be used to retrieve all item commitments spawned from the corresponding listing, and meeting other search criteria. \*\*Note\*\*: The authenticated user (seller or buyer) must have a relationship to item commitments for them to be returned. \*\*Note\*\*: Other filters in addition to \*\*listingId\*\* may be used.
- **unansweredQuestions** (UnansweredQuestions)
  - Seller-scoped unanswered questions count for the listing.
- **orders** (Orders!)
  - This array returns the authenticated viewer’s order data \*\*in the context of this listing\*\*.
- **listingTerms** (ListingTerms)
  - The commercial terms such as location, shipping, returns, etc. that apply to every item in the listing unless overridden at the item level. The item level terms currently include sku, price, quantity, and extended producer responsibility (EPR) terms. \*\*Note\*\*: This field will only be null if there is an error. Please see error section of response for more details.
- **marketplace** (ListingMarketplace)
  - The unique identifier of the eBay marketplace where the listing is hosted.
- **sellerProduct** (SellerProduct)
  - This object specifies information about the seller product, such as the epid, title, description, aspects, etc.

### VariationListing
**Description:** This type is used to provide details about a multiple-variation listing.
**Type:** GraphQLObjectType

**Properties:**
- **items** ([Item!]!)
  - This array provides detailed information about one or more purchasable items within an eBay listing. Each item object will have price, quantity, and global product identifiers if applicable. Item objects within multiple-variation listings will show unique traits that differentiate them from the rest of the variations within the listing.
- **listingId** (ID!)
  - The unique identifier of a multiple-SKU listing. All purchase quotes that involve this listing, and meeting other search criteria, will be returned.
- **itemCommitments** (ItemCommitments!)
  - This array will return all item commitments spawned from the corresponding listing, and meeting other search criteria. \*\*Note\*\*: The authenticated user (seller or buyer) must have a relationship to item commitments for them to be returned. \*\*Note\*\*: Other filters in addition to \*\*listingId\*\* may be used.
- **unansweredQuestions** (UnansweredQuestions)
  - This field returns the seller-scope count of unanswered questions for the listing.
- **orders** (Orders!)
  - This array returns the authenticated viewer’s order data \*\*in the context of this listing\*\*.
- **listingTerms** (ListingTerms)
  - This object is used to provide listing terms details for the listing, including listing format, listing duration, item location, return policy, fulfillment terms, and more.
- **listingVariations** (ListingVariations)
  - This object is used to express the traits where each SKU within a multiple-variation listing differs, such as \`Color\` and \`Size\`. Each available color and each available size will be listed through the \*\*variationTraits\*\* array. If the listing featured t-shirts, each variation within that listing would have a unique color and size combination such as \`Blue, Large\`.
- **marketplace** (ListingMarketplace)
  - The marketplace identifier of the listing. See \[\`Marketplace\`\] enum for supported values. This field specifies the eBay marketplace where the listing was listed. It determines the regional settings, currency, and other marketplace-specific configurations.
- **sellerProduct** (SellerProduct)
  - This object is used to provide common product details for the listing, including product aspects, title, description, condition, images, and more.
- **sku** (String)
  - This field is used to provide a seller-defined Stock Keeping Unit (SKU) value for a multiple variation (multi-sku) listing. If the seller wants to fetch a listing by its SKU, this field must be provided. This is an optional field. If provided, the value represents the listing's SKU. The SKU for each individual variation is provided in the Item for that variation.

### Item
**Description:** This type represents an item, which is a specific, purchasable configuration within a listing. It includes a unique combination of identifying characteristics such global identifiers, listing terms, availability, price, and regulatory requirements necessary to complete a transaction. Every listing contains at least one item, providing a unified approach that works transparently across simple single-sku listings and complex multi-sku listing.
**Type:** GraphQLObjectType

**Properties:**
- **auctionDataSummary** (AuctionDataSummary)
  - When present, the item is an auction with the contained details. When absent, the item is not available as an auction.
- **itemId** (ID!)
  - This field identifies a purchasable item in a single-SKU or multiple-SKU listing.
- **itemOfferOverview** (ItemOfferOverview)
  - This object provides comprehensive access to all offer activity related to this item. This includes offer history, active offers requiring attention, current conversation statuses, and key statistics such as total offer count and the last accepted offer amount.
- **itemIdRestReference** (ID)
  - The unique REST-based identifier of a purchasable item within an eBay listing. This identifier is used in eBay REST APIs to identify a purchasable item. Format: - \`v1||\` for multisku - \`v1||0\` for single sku
- **itemSellerProduct** (ItemSellerProduct)
  - This object provides a Global Trade Item Number (GTIN) for a product or an eBay product ID (ePID) if defined for the item. For a multiple-SKU listing, the \*\*traits\*\* array is mandatory and identifies the unique traits of the variation within that multiple-SKU listing. Common unique traits within a multiple-SKU listing are \`Color\` and \`Size\`. For example, a \`Blue, Large\` shirt. Each item in a multiple-SKU listing must have a unique combination of trait values.
- **itemTerms** (ItemTerms)
  - This object provides the pricing information, available quantity, and eco-participation fee (if applicable) for a purchasable item.
- **sku** (String)
  - The seller-defined Stock-Keeping Unit (SKU) value that is used to uniquely identify a purchasable item in the listing. This field is mandatory for each variation defined for a multiple-variation listing, but it is optional for a single-SKU listing. If a seller would like the option to perform an action against a single-SKU listing using its SKU value instead of its listing ID, then they must include this value for the item.
- **userNotes** ([UserNote!]!)
  - A list of user notes associated with this item. An empty list is returned if no user notes currently exist for this item.

### AuctionDataSummary
**Description:** This type provides auction information for an item.
**Type:** GraphQLObjectType

**Properties:**
- **bidStatistics** (BidStatistics!)
  - Provides statistical data related to user-submitted bids for an auction. \*\*Note\*\*: This field excludes data related to automatic, system-generated bids.
- **bidderAuctionDetails** (BidderAuctionDetails!)
  - This object returns information about the user's bidding activity on the corresponding item. \*\*Note\*\*: If no bids have been placed yet for the auction, the qualifying bid amount that must be met or exceeded by the user to place the initial bid will be returned.
- **itemId** (ID!)
  - This is the unique identifier of the auction listing for which bidding activity information is being retrieved. This auction listing can be active or recently ended.
- **leadingBid** (BidRecord)
  - This is the current highest bid in the active or recently-completed auction listing. The leading bid may or may not belong to the user who has issued this query. The user who is issuing this call can review what their maximum bid amount is by looking at the value stored in \*\*bidderAuctionDetails\*\*.
- **reservePriceMet** (Boolean)
  - This boolean indicates if the seller-specified Reserve Price for the auction has been met. If the seller's Reserve Price has not been met by the time the auction ends, there will be no winning bidder. Possible return values and what they indicate are listed below: - \`true\`: Reserve Price for the item has been met. - \`false\`: Reserve Price for the item has not been met. - \`null\`: A Reserve Price for the item has not been set.

### BidStatistics
**Description:** This type offers insights into the bidding activity associated with an auction item.
**Type:** GraphQLObjectType

**Properties:**
- **userSubmittedBidCount** (Int!)
  - This value indicates the total number of bids submitted for the auction item, and includes all bids placed by users but excludes bids automatically generated by the system. \*\*Default:\*\* 0

### BidderAuctionDetails
**Description:** This type is used to aggregate data related to a bidder's involvement in an auction item. This type is returned for any logged in user viewing an auction item, regardless of whether they have participated in it or not. Some fields may be null if the user has not placed a bid on the auction item.
**Type:** GraphQLObjectType

**Properties:**
- **maxBid** (ConvertedAmount)
  - The current user's maximum bid price on this auction. A \`null\` value for this field indicates that the current user has not yet placed a bid on this auction.
- **minimumQualifyingBidForMaxBid** (ConvertedAmount!)
  - The minimum amount the \`bidder\` needs to place to have a valid bid on this auction item. \*\*Note:\*\* This minimum-to-bid calculation considers only confirmed bids on the auction.
- **userBiddingStatus** (BidStatus)
  - The status of the user's recent bid on this auction. This will be \`null\` if the user has not placed a bid on this auction.
- **userPowerBids** ([ConvertedAmount!]!)
  - A list of suggested bids to display to the \`bidder\` based on the current auction price.

### ConvertedAmount
**Description:** This type represents a monetary amount that may include both original and converted currency values. This type is used when displaying prices that have been converted from one currency to another.
**Type:** GraphQLObjectType

**Properties:**
- **converted** (Amount)
  - This field contains the monetary amount of the listing converted to the viewer's currency. \*\*Note:\*\* This field may be null if conversion is unavailable.
- **original** (Amount)
  - This field contains the monetary amount in the listing's original currency, before any conversion was performed.

### BidRecord
**Description:** This type represents each \`BidRecord\`, which stores information about one bid on an item. Stored information includes bid amount, the user ID of the bidder associated with the bid, and the time the bid was placed.
**Type:** GraphQLObjectType

**Properties:**
- **bidAmount** (ConvertedAmount!)
  - This field indicates the calculated bid value. This value is derived from the original bid amount and adjusted according to the auction style or other business logic. This only contains the base amount for the bid without any user context.
- **bidMetadata** (BidMetadata!)
  - This field represents metadata for the \*\*BidRecord\*\*, encapsulating things such as the date the bid was placed.
- **bidder** (User!)
  - This field indicates information about the user who placed the bid.
- **buyerBiddingSummary** (BuyerBiddingSummary!)
  - This field provides the bidder's past bidding details over a period of 30 days.

### ActiveBidMetadata
**Description:** This type defines information about active bid records (i.e., bids that have not been cancelled or retracted).
**Type:** GraphQLObjectType

**Properties:**
- **isAutomaticBid** (Boolean!)
  - This boolean indicates if the record belongs to an automatic bid: - \`true\`: The corresponding bid is an automatic bid. - \`false\`: The corresponding bid is not an automatic bid.
- **isHighestBid** (Boolean!)
  - This boolean indicates if the corresponding bid is the highest bid for the item: - \`true\`: The corresponding bid is the highest bid for the item. - \`false\`: The corresponding bid is not the highest bid for the item.
- **placedAt** (DateTime!)
  - The date and time, expressed in UTC, when the corresponding bid was placed. \*\*Format:\*\* YYYY-MM-DDTHH:MM:SS.SSSZ

### CancelledBidMetadata
**Description:** This type defines the information associated with cancelled bid records.
**Type:** GraphQLObjectType

**Properties:**
- **cancelledAt** (DateTime!)
  - The date and time, expressed in UTC, when the corresponding bid was cancelled. \*\*Format:\*\* YYYY-MM-DDTHH:MM:SS.SSSZ
- **placedAt** (DateTime!)
  - The date and time, expressed in UTC, when the corresponding bid was placed. \*\*Format:\*\* YYYY-MM-DDTHH:MM:SS.SSSZ
- **reason** (String!)
  - User-specified text indicating the reason for cancelling the corresponding bid. \*\*Note:\*\* The seller of an item will be able to view all cancellation reasons for cancelled bids associated with their own item. A bidder will only be able to view the cancellation reason associated with their own bid. \*\*Format:\*\* UTF-8 \*\*Maximum length:\*\* None \*\*Minimum length:\*\* When this field is masked it is returned as an empty, non-null string.

### RetractedBidMetadata
**Description:** This type defines the information associated with retracted bid records.
**Type:** GraphQLObjectType

**Properties:**
- **placedAt** (DateTime!)
  - The date and time, expressed in UTC, when the corresponding bid was placed. \*\*Format:\*\* \`YYYY-MM-DDTHH:MM:SS.SSSZ\`
- **reason** (String!)
  - User-specified text indicating the reason for retracting the corresponding bid. \*\*Note:\*\* The seller of an item will be able to view all retraction reasons for retracted bids associated with their own item. A bidder will only be able to view the retraction reason associated with their own bid. \*\*Format:\*\* UTF-8 \*\*Maximum Length:\*\* None \*\*Minimum Length:\*\* When this field is masked it is returned as an empty, non-null string.
- **retractedAt** (DateTime!)
  - The date and time, expressed in UTC, when the corresponding bid was retracted. \*\*Format:\*\* YYYY-MM-DDTHH:MM:SS.SSSZ

### User
**Description:** This type displays information about a registered eBay user. Some sensitive data will be masked/omitted if the eBay user for whom information is being requested is not the user issuing the query. If the person issuing the query has an existing order relationship with the user for whom information is being requested, some additional information will be returned.
**Type:** GraphQLObjectType

**Properties:**
- **shippingZone** (PrimaryShippingZone)
  - This object shows the primary shipping zone for the user. \*\*Note\*\*: Shipping zone data may be masked or omitted based on user access levels.
- **itemCommitments** (ItemCommitments!)
  - This array returns a list of the authenticated user's recent item commitments. The authenticated user must be involved in these item commitments as either the seller or the buyer. See the required scopes for both sellers and buyers below.
- **userBenefitMemberships** ([UserBenefitMembership!])
  - This array returns a list of the authenticated user's active memberships across all eBay programs. \*\*Note\*\*: An empty array will be returned if the user does not have any active membership subscriptions.
- **orders** (Orders!)
  - This array returns a list of the authenticated user's recent orders. The authenticated user must be involved in these orders as either the seller or the buyer. See the required scopes for both sellers and buyers below.
- **businessIdentityProfile** (BusinessIdentityProfile)
  - This object shows business-related information for a seller with a business account. \*\*Notes\*\*: - If the user requesting this data is not authorized to view some of the requested information, those fields containing sensitive/confidential information may be masked or will return null values. - This object will return \`null\` if the user does not have a business account.
- **businessStakeholders** ([BusinessStakeholder])
  - This object returns the legal stakeholder associated with a business profile/account. \*\*Notes:\*\* - If the user requesting this data is not authorized to view this information, this field will return a null value. - When requesting information for an individual account, this field will return a \`null\` value.
- **individualIdentityProfile** (IndividualIdentityProfile)
  - This object returns individual user information such as name, email, phone number, and address for the user for whom information is being returned. \*\*Notes:\*\* - If the user requesting this data is not authorized to view some of the requested information, those fields containing sensitive/confidential information may be masked or will return null values. - This object will return \`null\` if the user does not have this profile.
- **newUser** (Boolean)
  - This boolean field indicates if the user is a newly-registered user within the prior 30 days. \*\*Note:\*\* If the user requesting this data is not authorized to view this information, this field will return a null value. \*\*Default value:\*\* false
- **publicUserProfile** (PublicUserProfile)
  - This object shows publicly visible contact and company information for a business seller. \*\*Note:\*\* When requesting information for an individual seller, this field may return a \`null\` value.
- **registrationMarketPlace** (UserRegistrationMarketplace)
  - This enum value indicates the eBay Marketplace on which the user is registered. \*\*Note:\*\* If the user requesting this data is not authorized to view this information, this field will return a null value.
- **sellerProfile** (SellerProfile)
  - This objects shows seller-related information for the user.
- **userCreatedAt** (DateTime)
  - This timestamp indicates when the user created their account. \*\*Note:\*\* If the user requesting this data is not authorized to view this information, this field will return a null value. \*\*Format:\*\* YYYY-MM-DDTHH:MM:SS.SSSZ \*\*Example:\*\* 2025-11-04T19:09:02.768Z
- **userId** (ID!)
  - The public-facing user ID of the user. \*\*Note:\*\* Effective September 26, 2025, select developers will no longer receive username data for U.S. users through this field. Instead, an immutable user ID will be returned in its place. For more information, please refer to \[Data Handling Compliance\](https://developer.ebay.com/api-docs/static/data-handling-update.html).
- **userIdChanged** (Boolean)
  - This boolean field indicates if the user ID of the user has been changed within the prior 30 days. \*\*Note:\*\* If the user requesting this data is not authorized to view this information, this field will return a null value. \*\*Default value:\*\* false
- **userIdLastChangedAt** (DateTime)
  - This timestamp indicates when the user ID for the user was last changed. \*\*Note:\*\* If the user requesting this data is not authorized to view this information, this field will return a \`null\` value. \*\*Format:\*\* \`YYYY-MM-DDTHH:MM:SS.SSSZ\` \*\*Example:\*\* 2025-11-04T19:09:02.768Z
- **userType** (UserAccountType)
  - The type of eBay account that is associated with the user (e.g., Individual, Business, etc.). \*\*Note:\*\* If the user requesting this data is not authorized to view this information, this field will return a null value.
- **username** (String)
  - The username of the user. \*\*Note:\*\* If the user requesting this data is not authorized to view this information, this field will return a null value. \*\*Note:\*\* Effective September 26, 2025, select developers will no longer receive username data for U.S. users through this field. Instead, an immutable user ID will be returned in its place. For more information, please refer to \[Data Handling Compliance\](https://developer.ebay.com/api-docs/static/data-handling-update.html).

### PrimaryShippingZone
**Description:** This type defines the primary shipping zone information for a user's address. \*\*Data Privacy:\*\* All fields respect user access control levels. Sensitive location data may be masked for unauthorized viewers.
**Type:** GraphQLObjectType

**Properties:**
- **countryCode** (CountryAlpha2Code)
  - The two-letter ISO 3166 country code of the shipping zone. \*\*Note:\*\* This field may be omitted based on user access permissions.
- **postalCode** (String)
  - The postal code of the shipping zone. \*\*Note:\*\* This field may be omitted based on user access permissions.
- **stateOrProvince** (String)
  - The state or province of the shipping zone. \*\*Note:\*\* This field may be omitted based on user access permissions.

### PostalCodeInput
**Description:** This input type is used to configure postal code display preferences. This input allows clients to specify how postal codes should be displayed, with support for data masking based on user privileges and access levels. \*\*Default\*\*: \`DISPLAY\` \*\*Note:\*\* Postal code visibility may be restricted based on the requesting user's data access level and relationship to the data owner.
**Type:** GraphQLInputObjectType

**Properties:**
- **type** (String)
  - This field specifies how postal codes are displayed. Supported Values are: - \`"DISPLAY"\`: Display the postal code when a user has appropriate access level. \*\*Default value:\*\* \`"DISPLAY"\` \*\*Maximum length:\*\* 50 characters \*\*Format:\*\* Alphabetic \*\*Data Privacy Notes:\*\* - Postal codes may be masked or omitted if the requesting user lacks sufficient privileges to view this sensitive location data.

### ItemCommitments
**Description:** This is the base input type used for \*\*itemCommitments\*\* queries. The \*\*sellerItemCommitments\*\* object is used when queries are being made on behalf of an authenticated seller, and the \*\*buyerItemCommitments\*\* object is used when queries are being made on behalf of an authenticated buyer.
**Type:** GraphQLObjectType

**Properties:**
- **buyerItemCommitments** (PaginatedItemCommitments!)
  - This object is used to retrieve item commitments for an authenticated buyer. Filters are available to allow the user to include or exclude item commitments in specific states. A user can also retrieve item commitment(s) for a specific listing. Pagination parameters are also available that let a user control the number of item commitments returned per page of results and to retrieve a specific page of results based on a \*\*pageCursor\*\* value.
- **sellerItemCommitments** (PaginatedItemCommitments!)
  - This object is used to retrieve item commitments for an authenticated seller. Filters are available to allow the user to include or exclude item commitments in specific states. A user can also retrieve item commitment(s) for a specific listing. Pagination parameters are also available that let a user control the number of item commitments returned per page of results and to retrieve a specific page of results based on a \*\*pageCursor\*\* value.

### PaginatedItemCommitments
**Description:** This type is used to display a list of a seller's or a buyer's item commitments that match search criteria for an \*\*itemCommitments\*\* query. The \*\*pagination\*\* object will have string values that can be used to toggle to the next or previous page of results if there are multiple pages of results.
**Type:** GraphQLObjectType

**Properties:**
- **itemCommitments** ([ItemCommitment!]!)
  - This array returns a list of a seller's or a buyer's item commitments that match search criteria. If the \*\*itemCommitments\*\* query produced more than one page of results, the string values in the \*\*pagination\*\* object can be used to toggle to the next or previous page of results in a subsequent query.
- **pagination** (Pagination!)
  - This object has string values that can be used in the \*\*pageCursor\*\* field of a query to retrieve the next or previous page of results if there are multiple pages of results.

### ItemCommitment
**Description:** This type provides all details of an item commitment. An item commitment represents a buyer's confirmed intent to purchase an eBay item. This type includes key details such as the unique identifier of the item commitment, buyer information, seller information, price, and status.
**Type:** GraphQLObjectType

**Properties:**
- **itemCommitmentId** (ID!)
  - The unique identifier of an item commitment.
- **autoPaymentScheduleDetails** ([AutoPaymentScheduleDetails!])
  - This array returns any automated payment schedule details associated with the item commitment. \*\*Note\*\*: This object will only be exposed to the seller if applicable.
- **buyer** (User!)
  - The buyer who committed to purchasing the item.
- **cancellation** (ItemCommitmentCancellation)
  - This object is only returned if the item commitment has been cancelled, and includes the unique identifier of the cancellation.
- **committedMarketplace** (Marketplace!)
  - The unique identifier of the eBay marketplace where the item commitment was created.
- **createdAt** (DateTime!)
  - The exact date and time when the item commitment was initially created in the system. This marks the start of the item commitment lifecycle. \*\*Note\*\*: This object will never be returned \`null\`.
- **itemCommitmentAddOnService** (ItemCommitmentAddOnService)
  - This object shows any additional services related to the item commitment added by the buyer or seller.
- **lineItem** (ContractListingItem!)
  - This object show details of the line item associated with the item commitment, including the identifier of the item, purchase quantity, how the item was purchased, and SKU value if defined.
- **logistics** (PurchaseLogistics!)
  - This object shows detailed logistics information associated with the item commitment, describing how the purchased item(s) will be fulfilled, delivered, or made available to the buyer. \*\*Note\*\*: This object may be null or empty until the buyer selects one of the options under the \*\*logisticsOptions\*\* array.
- **logisticsOptions** ([ItemCommitmentLogisticsOptions!])
  - This array shows the set of logistics options available to the buyer for this item commitment. Each option includes method, cost, and estimated delivery time.
- **monetaryDetails** (MonetaryDetails)
  - This object shows detailed information on any and all monetary transactions that occurred for the item commitment between any combination of buyer, seller, and eBay. Each entry represents a distinct payment-related detail within the item commitment lifecycle.
- **order** (Order)
  - This field is returned with a unique identifier of an order if there is an order associated with the item commitment. Unless an item commitment is cancelled or abandoned, an item commitment will become a paid order either directly or as part of a purchase quote.
- **paymentOptions** ([ItemCommitmentPaymentOption!])
  - This array shows the payment methods available to the buyer for this item commitment.
- **purchaseQuote** ([PurchaseQuote!])
  - This array is returned if the item commitment is associated with any purchase quote, which is a collection of two or more item commitments that will be paid for with one payment.
- **refunds** ([Refund!])
  - This object is only returned if there is a refund associated with the item commitment and includes the unique identifier of the refund.
- **returns** ([OrderReturn!])
  - This object is only returned if there is a return request associated with the item commitment and includes the unique identifier of the return request.
- **seller** (User!)
  - This field represents the seller who owns the eBay listing that originated the item commitment.
- **state** (ItemCommitmentState!)
  - This object provides information on the current state of the item commitment. The information that one will see here will be dependent on the state of the item commitment.
- **tags** (PurchaseTags)
  - This object shows any custom tags added by the seller to the item commitment. \*\*Note\*\*: Custom tags can only be added by seller, so this object will only be exposed to the seller if the item commitment has one or more custom tags.
- **totals** (ItemCommitmentTotals!)
  - This object shows total sales price of the eBay item associated with the item commitment, including any deposit for a motor vehicle. These monetary values will be shown in multiple currencies if the buyer or seller use a different currency than the default currency of the eBay marketplace.
- **updatedAt** (DateTime!)
  - This object provides the exact date and time when the item commitment was last modified or updated in the system. This timestamp captures any changes made to the item commitment after initial creation, including change in state. \*\*Note\*\*: This object is guaranteed to be non-null.

### AutoPaymentScheduleDetails
**Description:** This type shows detailed information related to automated payment scheduling for an item commitment, including whether it's required, delayed, and when it's scheduled.
**Type:** GraphQLObjectType

**Properties:**
- **autoPaymentRequired** (Boolean!)
  - This boolean field indicates whether this item commitment must be processed using auto payment. If \`true\`, the item commitment is required to be processed automatically. If \`false\`, the item commitment can be handled through other payment methods and is not mandated for auto payment.
- **autoPaymentState** (AutoPaymentState!)
  - The current state of the auto payment process for this item commitment.
- **delayReason** (ID)
  - If applicable, this field provides the reason why the auto payment for this item commitment is delayed.
- **processingScheduledAt** (DateTime!)
  - This timestamp indicates the date and time when auto payment for this item commitment is scheduled to be processed.

### AutoPaymentCompleted
**Description:** This type is used to indicate that an auto payment has been successfully completed.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - The human-readable label representing this state. \*\*Maximum length\*\*: 100 characters.

### AuthenticityVerificationFailed
**Description:** This type indicates that the authenticity verification has failed.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - A human-readable label representing this state. Value: \`Failed\`.

### AuthenticityVerificationPassed
**Description:** This type indicates that the authenticity verification has passed successfully.
**Type:** GraphQLObjectType

**Properties:**
- **hasException** (Boolean!)
  - There may be legal or policy constraints that prevent the item from being labeled as fully authentic (for example, regulatory restrictions, brand rights, or compliance requirements). When \`true\`, the item has been verified as authentic but cannot be publicly marked or displayed as such.
- **hasPartialFailure** (Boolean!)
  - When \`true\`, this field indicates that the verification passed overall, but one or more checks had non-critical issues or incomplete validations (for example, a missing accessory, minor deviation from factory standards, or unverifiable subcomponent). The item is still considered authentic, and the verification report documents these partial failure details for transparency.
- **label** (String!)
  - A human-readable label representing this state. Value: \`Passed\`.

### AutoPaymentFailed
**Description:** This type is used to indicate that an auto payment has failed to process.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - The human-readable label representing this state. \*\*Maximum length\*\*: 100 characters.

### AutoPaymentScheduled
**Description:** This type is used to indicate that an auto payment is scheduled.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - The human-readable label representing this state. \*\*Maximum length\*\*: 100 characters.

### ContractCancelCompleted
**Description:** This type is used to indicate that the purchase contract cancellation process has been completed.
**Type:** GraphQLObjectType

**Properties:**
- **completedAt** (DateTime!)
  - The timestamp when the cancellation was completed.
- **label** (String!)
  - The human-readable label representing this state (e.g. \`Process Completed\`). \*\*Maximum length\*\*: 100 characters
- **refundOutcome** (String)
  - This field is returned if there is a refund associated with the purchase contract cancellation, and provides a text-based description of the refund.

### ContractCancelPending
**Description:** This type indicates that the cancellation is currently being processed by the system.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - The human-readable label representing this state (e.g. 'System Processing'). \*\*Maximum length\*\*: 100 characters.
- **startedAt** (DateTime!)
  - This timestamp indicates when the purchase contract cancellation started being processed.

### ContractCancelRejected
**Description:** This type indicates that the cancellation request has been rejected by the seller.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - The human-readable label representing this state (e.g. 'Seller Rejected'). \*\*Maximum length\*\*: 100 characters
- **reason** (String)
  - This field shows the reason why the cancellation was rejected. \*\*Note\*\*: This field is returned if a reason was given.
- **rejectedAt** (DateTime)
  - The timestamp when the cancellation was rejected, which could be null if the data is not available.

### ContractCancelRequested
**Description:** This type indicates that the buyer has requested a cancellation.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - The human-readable label representing this state (e.g. 'Buyer Requested'). \*\*Maximum length\*\*: 100 characters
- **requestedAt** (DateTime)
  - This timestamp indicates when the purchase contract cancellation was requested.

### ContractFullyRefunded
**Description:** This type details a refund that covers the entire purchase entity.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - The human-readable label representing this fully-refunded state. \*\*Maximum length\*\*: 100 characters
- **refundedAt** (DateTime!)
  - The timestamp when the refund was processed.

### ContractPartiallyRefunded
**Description:** This type is used to provide details about a partial refund issued for a purchase contract.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - The human-readable label representing this partially-refunded state. \*\*Maximum length\*\*: 100 characters
- **lineItemReferences** ([LineItemReference!])
  - This array lists specific line items involved in the refund.

### ContractReturnApproved
**Description:** This type indicates that the return request has been approved.
**Type:** GraphQLObjectType

**Properties:**
- **approvedAt** (DateTime!)
  - The timestamp when the return was approved.
- **label** (String!)
  - A human-readable label for the state.

### ContractReturnClosed
**Description:** Thie type indicates that the return process has been completed and closed, including the final outcomes such as whether a refund was issued, the item was returned, and if the return was accepted.
**Type:** GraphQLObjectType

**Properties:**
- **closedAt** (DateTime!)
  - The timestamp when the return was officially closed.
- **itemAccepted** (Boolean)
  - When \`true\`, the returned item was accepted (optional if unknown or not applicable).
- **itemReturned** (Boolean!)
  - When \`true\`, the item was physically returned.
- **label** (String!)
  - A human-readable label for the state.
- **refundIssued** (Boolean!)
  - When \`true\`, this indicates a refund was issued to the buyer.

### ContractReturnEscalated
**Description:** This type indicates that the return process has been escalated for further review or action and includes the responsible or pending party (for example, buyer, seller, customer service).
**Type:** GraphQLObjectType

**Properties:**
- **escalatedAt** (DateTime!)
  - The timestamp when the return was escalated.
- **label** (String!)
  - A human-readable label for the state.
- **pendingParty** (EscalationPendingParty!)
  - The party currently responsible for resolving the escalation (for example, buyer, seller, or customer service).

### ContractReturnInTransit
**Description:** This type indicates that the item is in transit from the buyer to the seller or warehouse and includes the dates for shipment, and optionally the delivery and inspection result.
**Type:** GraphQLObjectType

**Properties:**
- **deliveredAt** (DateTime)
  - The timestamp when the item was delivered to the return location (optional).
- **inspected** (Boolean)
  - When \`true\`, the item has been inspected upon arrival. This field may be null if not yet delivered.
- **label** (String!)
  - A human-readable label for the state.
- **shippedAt** (DateTime!)
  - The timestamp when the item was shipped by the buyer.

### ContractReturnRejected
**Description:** This type indicates that the return was rejected, including the reason for rejection.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - A human-readable label for the state.
- **reason** (String)
  - An optional reason provided for why the return was rejected.
- **rejectedAt** (DateTime!)
  - The timestamp when the return was rejected.

### ContractReturnRequested
**Description:** This type indicates that the return was requested by the buyer.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - A human-readable label for the state.
- **requestedAt** (DateTime!)
  - The timestamp when the return was initially requested.

### EscalationPendingPartyBuyer
**Description:** This type indicates the buyer is the party pending escalation.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - A human-readable label for the entity.

### EscalationPendingPartyCustomerService
**Description:** This type indicates customer service team is the party pending escalation.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - A human-readable label for the entity.

### EscalationPendingPartySeller
**Description:** This type indicates seller is the party pending escalation.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - A human-readable label for the entity.

### FulfillmentCompleted
**Description:** This type is used to indicate that fulfillment is completed.
**Type:** GraphQLObjectType

**Properties:**
- **completedAt** (DateTime)
  - This timestamp indicates the date and time when fulfillment completed.
- **label** (String!)
  - The human-readable label representing a fulfillment that has completed (e.g. "Completed"). \*\*Maximum length\*\*: 100 characters

### FulfillmentInProgress
**Description:** This type indicates that fulfillment is currently in progress.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - The human-readable label representing a fulfillment that is in progress (e.g. "In Progress"). \*\*Maximum length\*\*: 100 characters
- **startedAt** (DateTime!)
  - This timestamp indicates the date and time when fulfillment began.

### FulfillmentNotStarted
**Description:** This type indicates that fulfillment has not started.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - The human-readable label representing a fulfillment that has not started (e.g. "Not Started"). \*\*Maximum length\*\*: 100 characters

### FulfillmentPartiallyStarted
**Description:** This type is used to indicate that fulfillment has partially started, meaning that the fulfillment of some line items has started, while the fulfillment process on other line items has not started.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - The human-readable label representing a fulfillment that has partially started (e.g. "Partially Started"). \*\*Maximum length\*\*: 100 characters
- **lineItemsNotStarted** ([LineItemReference!]!)
  - This array shows the list of line items for which fulfillment has not yet started.
- **lineItemsStarted** ([LineItemReference!]!)
  - This array shows the list of line items for which fulfillment has started.

### ItemCommitmentAbandoned
**Description:** This type is used to express the state of an abandoned item commitment. An abandoned item commitment will not be fulfilled. This is a terminal, closed state, and no further action or modification is permitted.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - The human-readable label representing an abandoned item commitment (e.g. \`Abandoned\`). \*\*Maximum length\*\*: 100 characters

### ItemCommitmentActive
**Description:** This type is used to express various state details of an active item commitment.
**Type:** GraphQLObjectType

**Properties:**
- **cancelState** (ContractCancelState)
  - This object indicates the current cancellation status of the item commitment. \*\*Note\*\*: This object is only applicable and returned if the item commitment is associated with a cancellation request.
- **fulfillmentState** (LogisticsFulfillmentState!)
  - This object indicates the current fulfillment status of the item commitment.
- **fundingState** (PaymentsState!)
  - This object indicates the current payment status of the item commitment.
- **label** (String!)
  - The human-readable label representing an active item commitment (e.g. \`Active\`). \*\*Maximum length\*\*: 100 characters.
- **returnState** (ItemCommitmentReturnState)
  - This object indicates the current return status of the item commitment. \*\*Note\*\*: This object is only applicable and returned if the item commitment is associated with a return request.

### ItemCommitmentCancelled
**Description:** This type is used to express the state and details of a cancelled item commitment. A cancelled item commitment will not be fulfilled.
**Type:** GraphQLObjectType

**Properties:**
- **cancelState** (ContractCancelState)
  - This object provides details on the cancellation state of the item commitment.
- **cancelledAt** (DateTime!)
  - This timestamp indicates the date and time when the item commitment was cancelled. \*\*Note\*\*: This field is only returned for completed cancellations.
- **label** (String!)
  - The human-readable label representing a cancelled item commitment (e.g. "Cancelled"). \*\*Maximum length\*\*: 100 characters.
- **reason** (String)
  - This field shows the reason provided for the cancellation. This may be system-generated or user-specified. \*\*Note\*\*: May not be returned if no reason was given or generated.

### ItemCommitmentCompleted
**Description:** This type is used to express the state of a completed item commitment. An item commitment in this state means that the item commitment has been fulfilled and closed, and no further action or modification is expected.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - The human-readable label representing a completed item commitment (e.g. \`Completed\`). \*\*Maximum length\*\*: 100 characters.

### ItemCommitmentLocked
**Description:** This type is used to express the state of a locked item commitment. \*\*Note\*\*: An item commitment may enter a locked state during checkout when the item commitment is being validated, authorized for payment, or undergoing internal processing. The item commitment may be individually locked or indirectly locked as part of a purchase quote that is in checkout progress.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - The human-readable label representing a locked item commitment (e.g. \`Locked\`). \*\*Maximum length\*\*: 100 characters.

### ItemCommitmentReturnClosed
**Description:** This type is used to provide details about a closed return request associated with an item commitment.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - The human-readable label representing the state of the return request. \*\*Maximum length\*\*: 100 characters.

### ItemCommitmentReturnRequested
**Description:** This type is used to provide details about an open return request associated with an item commitment.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - The human-readable label representing the state of the return request. \*\*Maximum length\*\*: 100 characters.

### MonetaryExecutionPaymentState
**Description:** This type is used to indicate the paid state of a monetary execution.
**Type:** GraphQLObjectType

**Properties:**
- **id** (ID!)
  - The unique identifier of the payment state.
- **label** (String!)
  - A human-readable label for the payment state.

### MonetaryPlanActive
**Description:** This type is used to show that the monetary plan is active and can be executed or has already been executed.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - This human-readable label representing this state.

### MonetaryPlanCancelled
**Description:** This type is used to show that the monetary plan has been cancelled and will not be executed.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - The human-readable label representing this state.

### OrderAbandoned
**Description:** This type represents the state when the order was abandoned before completion.
**Type:** GraphQLObjectType

**Properties:**
- **abandonedAt** (DateTime!)
  - The date and time when the order was abandoned.
- **label** (String!)
  - A human-readable description of the order's state.
- **reason** (String)
  - The reason the order was abandoned, if available.

### OrderAdjustmentAbandoned
**Description:** This type indicates that an order adjustment was abandoned (not completed and not explicitly canceled) through a human-readable label.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - A human-readable label for the state.

### OrderAdjustmentCancelled
**Description:** This type indicates that an order adjustment was canceled and will not be applied through a human-readable label.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - A human-readable label for the state.

### OrderAdjustmentCompleted
**Description:** This type indicates that an order adjustment has been successfully applied or completed through a human-readable label.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - A human-readable label for the state.

### OrderAdjustmentCreated
**Description:** This type indicates that an order adjustment has been created and is pending processing through a human-readable label.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - A human-readable label for the state.

### OrderCancelled
**Description:** This type represents the state when the order was canceled.
**Type:** GraphQLObjectType

**Properties:**
- **cancelState** (ContractCancelState)
  - The cancellation state of the order.
- **cancelledAt** (DateTime!)
  - The date and time when the order was canceled.
- **label** (String!)
  - A human-readable description of the order's state.
- **reason** (String)
  - The reason for the cancellation, if available.

### OrderConfirmed
**Description:** This type indicates that the order was confirmed after a successful checkout. Payment has been processed and the order is ready for fulfillment.
**Type:** GraphQLObjectType

**Properties:**
- **cancelState** (ContractCancelState)
  - The cancellation state, if applicable.
- **confirmedAt** (DateTime!)
  - The date and time that the order was officially confirmed.
- **fulfillmentState** (LogisticsFulfillmentState!)
  - The current state of the fulfillment process. \*\*Note:\*\* Use this field to track logistics progress for this order.
- **fundingState** (PaymentsState!)
  - The current state of the funding process. \*\*Note:\*\* Use this field to track and manage funding.
- **label** (String!)
  - A human-readable description of the order's state.
- **paymentHoldState** (PaymentHoldState)
  - The current state of the payment hold associated with this order. \*\*Note:\*\* This field would be null if not applicable.
- **refundState** (ContractRefundState)
  - The current state of the refund process. \*\*Note:\*\* If null, no refund activity has occurred or is not applicable.
- **returnState** (ContractReturnState)
  - The current state of the return process. \*\*Note:\*\* If null, no return activity has occurred or is not applicable.

### OrderPlaced
**Description:** This type indicates that the order was created marking the start of the order lifecycle.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - A human-readable description of the order's state.

### PaymentOnHold
**Description:** This type provides details on any active payment hold.
**Type:** GraphQLObjectType

**Properties:**
- **expectedReleaseAt** (DateTime)
  - This timestamp indicates the date and time when the hold is expected to be released. This may be null when the data is not yet available.
- **holdPlacedAt** (DateTime!)
  - This timestamp indicates the date and time when the hold was placed.
- **label** (String!)
  - The human-readable label for the active payment hold. \*\*Maximum length\*\*: 100 characters
- **reason** (DisplayableId)
  - The reason for the payment hold. This field may be null if the reason is not available.

### PaymentReleased
**Description:** This type represents the state of a payment hold that has been released through a human-readable label.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - The human-readable label for the released payment hold. \*\*Maximum length\*\*: 100 characters
- **reason** (DisplayableId)
  - The reason for the payment hold. This field may be null if the reason is not available.
- **releasedAt** (DateTime)
  - This timestamp indicates the date and time when the hold was released.

### PaymentsCompleted
**Description:** This type indicates that the payment process has been completed successfully through a human-readable label.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - The human-readable label representing this state.

### PaymentsFailure
**Description:** This type indicates that the payment process has failed through a human-readable label.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - The human-readable label representing this state.

### PaymentsInProgress
**Description:** This type indicates that the payment process is currently in progress through a human-readable label.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - The human-readable label representing this state.

### PaymentsNotStarted
**Description:** This type indicates that the payment process has not yet started through a human-readable label.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - The human-readable label representing this state.

### PurchaseFlowAuction
**Description:** This type is used to indicate that the purchase contract was initiated through an auction listing with a winning bidder.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - The human-readable label representing an Auction purchase flow. Value: \`Auction\`.

### PurchaseFlowBestOffer
**Description:** This type is used to indicate that the purchase contract was initiated through a buyer-initiated offer (Best Offer) that was accepted by the seller.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - The human-readable label representing a Best Offer purchase flow. Value: \`Best Offer\`.

### PurchaseFlowBuyItNow
**Description:** This type is used to indicate that the purchase contract was initiated through a 'Buy it Now' flow, which can come from a fixed-price listing or from an auction listing with 'Buy it Now' feature enabled.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - The human-readable label representing a Buy It Now purchase flow. Value: \`Buy It Now\`.

### PurchaseFlowCommitToBuy
**Description:** This type is used to indicate that the purchase contract was initiated through a successful \*\*commitToPurchase\*\* mutation.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - The human-readable label representing a Commit to Buy purchase flow. Value: \`Commit to Buy\`.

### PurchaseFlowRequestTotal
**Description:** This type is used to indicate that the purchase contract was initiated through a Request Total purchase flow. With this flow, the seller does not have immediate payment set for the listing, and the buyer requests total cost before paying.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - The human-readable label representing a Request Total purchase flow. Value: \`Request Total\`.

### PurchaseFlowSellerInitiatedOffer
**Description:** This type is used to indicate that the purchase contract was initiated through a seller-initiated offer that was accepted by the buyer.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - The human-readable label representing a seller-initiated offer purchase flow. Value: \`Seller Initiated Offer\`.

### PurchaseQuoteActive
**Description:** This type is used to indicate that a purchase quote is active and is now pending the buyer's action.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - The human-readable label representing an active purchase quote. \*\*Maximum length\*\*: 100 characters.

### PurchaseQuoteCancelled
**Description:** This type is used to indicate that a purchase quote has been cancelled.
**Type:** GraphQLObjectType

**Properties:**
- **cancelledAt** (DateTime!)
  - This time stamp indicates when the cancellation occurred.
- **label** (String!)
  - The human-readable label representing a cancelled purchase quote. \*\*Maximum length\*\*: 100 characters
- **reason** (DisplayableId)
  - This field indicates the reason why the cancellation occurred.

### PurchaseQuoteCompleted
**Description:** This type is used to indicate that a purchase quote has been completed. Once a purchase quote is completed, it cannot transition to a different state.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - The human-readable label representing a completed purchase quote. \*\*Maximum length\*\*: 100 characters

### PurchaseQuoteInvalid
**Description:** This type is used to indicate that a purchase quote is invalid. A purchase quote can be irreversibly marked as invalid due to a system error or a business rule violation. Once marked as invalid, a purchase quote cannot be recovered or used.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - The human-readable label representing an invalid purchase quote. \*\*Maximum length\*\*: 100 characters
- **reason** (DisplayableId)
  - This field indicates the reason why the purchase quote is invalid.

### PurchaseQuoteLocked
**Description:** This type is used to indicate that a purchase quote is temporarily locked due to an in-progress operation. Updates to the purchase quote are disabled until the operation completes.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - The human-readable label representing a locked purchase quote. \*\*Maximum length\*\*: 100 characters

### PurchaseQuoteRequested
**Description:** This type is used to indicate that a purchase quote has been requested by a buyer.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - The human-readable label representing a purchase quote has been requested by a buyer. \*\*Maximum length\*\*: 100 characters.

### SellerToVault
**Description:** This type is used to provide more information when the 'Seller to Vault' fulfillment type is used to deliver the item to the buyer. With 'Seller to Vault' fulfillment, the seller ships the item to the PSA Vault, where the trading card will be authenticated before it is sent to the buyer.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - A human-readable label for the entity.

### ServiceCancelled
**Description:** This type indicates that the service was cancelled before completion. Cancellation may be the result of user action, lack of resources, or other blocking conditions.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - A human-readable label for the state (example: \`Cancelled\`).
- **reason** (String)
  - This field provides a text-based explanation of why the service was canceled. This optional field is returned if available.

### ServiceCompleted
**Description:** This type indicates that the service has finished successfully. All required tasks for this service are complete and no further action is required unless explicit follow-up is planned.
**Type:** GraphQLObjectType

**Properties:**
- **complicated** (Boolean!)
  - When \`true\`, there was unusual complexity involved in order to get the service completed.
- **label** (String!)
  - A human-readable label for the state (example: \`Completed\`).
- **modificationInvolved** (Boolean!)
  - When \`true\`, the final completed state required a modification to the original plan (for example: re-scheduling, additional steps, or scope changes).

### ServiceInProgress
**Description:** This type is used to provide details of a service that is actively being executed.
**Type:** GraphQLObjectType

**Properties:**
- **complicated** (Boolean!)
  - When \`true\`, there is unusual complexity involved in order to get the service to the next state.
- **label** (String!)
  - This value indicates the current state of the service (for example: \`InProgress\`).

### ServicePartiallyCompleted
**Description:** This type is used to provide details of a service that has been partially completed.
**Type:** GraphQLObjectType

**Properties:**
- **complicated** (Boolean!)
  - When \`true\`, the completed portion involved complex work or special handling.
- **label** (String!)
  - A human-readable label for the state (for example: \`PartiallyCompleted).

### ServicePartiallyStarted
**Description:** This type is used to provide details of a service that has been partially started.
**Type:** GraphQLObjectType

**Properties:**
- **complicated** (Boolean!)
  - When \`true\`, the started portion of the service is complex and may affect completion or downstream steps.
- **label** (String!)
  - A human-readable label for the state (for example: \`PartiallyStarted\`).

### VaultToBuyer
**Description:** This type is used to provide more information when the 'Vault to Buyer' fulfillment type is used to deliver the item to the buyer. With 'Vault to Buyer' fulfillment, the item goes from the seller's PSA Vault location to the buyer's shipping address.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - A human-readable label for the entity.

### VaultToVault
**Description:** This type is used to provide more information when the 'Vault to Vault' fulfillment type is used to deliver the item to the buyer. With 'Vault to Vault' fulfillment, the item goes from the seller's PSA Vault location to the buyer's PSA Vault location.
**Type:** GraphQLObjectType

**Properties:**
- **label** (String!)
  - A human-readable label for the entity.

### ItemCommitmentCancellation
**Description:** This type represents the cancellation of an \*\*ItemCommitment\*\* contract. The original commitment is available in the \*\*ItemCommitmentCancellation.itemCommitment\*\* field.
**Type:** GraphQLObjectType

**Properties:**
- **buyer** (User!)
  - The buyer involved in the cancellation.
- **cancellationId** (ID!)
  - The unique identifier of the item commitment cancellation.
- **closedAt** (DateTime)
  - The timestamp when the item commitment cancellation was closed. If the status is not closed, this field will not be set.
- **itemCommitment** (ItemCommitment!)
  - The original item commitment for which the order was created.
- **lineItems** ([ItemCommitmentCancellationLineItem!]!)
  - The line-level entries included in this commitment cancellation.
- **reason** (ContractCancellationReason!)
  - The reason for the cancellation.
- **refunds** ([Refund!])
  - An array of refunds resulting from this cancellation. Present only if refund processing was initiated; otherwise, null.
- **requestedAt** (DateTime!)
  - The timestamp when the cancellation was submitted.
- **requester** (PostPurchaseActorRole!)
  - The party that initiated the cancellation. For example, the \`BUYER\`.
- **requesterNote** (String)
  - The note provided with the cancellation request. Available if the requester provided a note; otherwise, null.
- **seller** (User!)
  - The seller involved in the cancellation, which may be the initiating party.
- **status** (ContractCancellationStatus!)
  - The present status of this cancellation.

### OrderCancellation
**Description:** This type represents the cancellation of an order contract. \*\*Note:\*\* The \`lineItems\` field contains a field named \`orderLineItem\` that the represents the original order line item.
**Type:** GraphQLObjectType

**Properties:**
- **buyer** (User!)
  - The buyer involved in this order cancellation.
- **cancellationId** (ID!)
  - The unique identifier of this order cancellation.
- **closedAt** (DateTime)
  - If closed, the date when the order cancellation was closed.
- **lineItems** ([OrderCancellationLineItem!]!)
  - Line-level entries included in the order cancellation. Always contains at least one line item.
- **reason** (ContractCancellationReason!)
  - The reason provided for the order cancellation.
- **refunds** ([Refund!])
  - A list of one or more refunds resulting from this order cancellation. Present only if refund processing was initiated during cancellation; otherwise, null.
- **requestedAt** (DateTime!)
  - The timestamp when the order cancellation was requested.
- **requester** (PostPurchaseActorRole!)
  - The entity that requested the order cancellation (for example, \`BUYER\`).
- **requesterNote** (String)
  - An optional note provided when requesting the order cancellation, if the requester provided a note; otherwise, null.
- **seller** (User!)
  - The seller involved in this order cancellation.
- **status** (ContractCancellationStatus!)
  - The present status of this order cancellation.

### PurchaseQuoteCancellation
**Description:** This type represents the cancellation of a \*\*PurchaseQuote\*\* contract. The original purchase quote is available in the \`purchaseQuote\` field.
**Type:** GraphQLObjectType

**Properties:**
- **buyer** (User!)
  - The buyer involved in the cancellation.
- **cancellationId** (ID!)
  - The unique identifier of this cancellation.
- **closedAt** (DateTime)
  - The timestamp when the purchase quote cancellation was closed. If the status is not closed, this field will not be set.
- **lineItems** ([PurchaseQuoteCancellationLineItem!]!)
  - A list of one or more line-level cancellation entries for this quote cancellation.
- **purchaseQuote** (PurchaseQuote!)
  - The original purchase quote being cancelled.
- **reason** (ContractCancellationReason!)
  - The reason for the cancellation, if provided.
- **refunds** ([Refund!])
  - An array of refunds resulting from this cancellation. Present only if refund processing was initiated; otherwise, null.
- **requestedAt** (DateTime!)
  - The timestamp when the cancellation was submitted.
- **requester** (PostPurchaseActorRole!)
  - The party that initiated the cancellation. For example, the \`BUYER\`.
- **requesterNote** (String)
  - The note provided with the cancellation request. Available if the requester provided a note; otherwise, null.
- **seller** (User!)
  - The seller involved in the cancellation (may have initiated).
- **status** (ContractCancellationStatus!)
  - The present status of this cancellation.

### ItemCommitmentCancellationLineItem
**Description:** This type represents the line item in an \*\*ItemCommitment\*\* cancellation. \*\*Note:\*\* This type does not expose the contract line item since the root cancellation already references the \`itemCommitment\`.
**Type:** GraphQLObjectType

**Properties:**
- **cancellationLineItemId** (ID!)
  - Unique identifier of this cancellation line item.
- **cancelledQuantity** (Int)
  - Quantity cancelled for original item commitment. This field is present only when the item commitment cancellation has been completed.
- **item** (ContractCancellationItemReference)
  - The reference for cancelled item reference. Optional present when cancellation has item.
- **requestedQuantity** (Int!)
  - Quantity requested for cancellation on original item commitment.

### OrderCancellationLineItem
**Description:** This type provides for the line item in an \*\*Order\*\* cancellation providing a direct pointer to the original order line item via \`orderLineItem\`.
**Type:** GraphQLObjectType

**Properties:**
- **cancellationLineItemId** (ID!)
  - The unique identifier of this cancellation line item.
- **cancelledQuantity** (Int)
  - The quantity cancelled for original order line item. Present only when the order cancellation is completed.
- **item** (ContractCancellationItemReference)
  - The reference for cancelled item reference.
- **orderLineItem** (OrderLineItem!)
  - The reference to the original order line item.
- **requestedQuantity** (Int!)
  - The quantity requested for cancellation on original order line item.

### PurchaseQuoteCancellationLineItem
**Description:** This type represents a line item in a \*\*PurchaseQuote\*\* cancellation. It references the original purchase quote line item through \`purchaseQuoteLineItem\`.
**Type:** GraphQLObjectType

**Properties:**
- **cancellationLineItemId** (ID!)
  - The unique identifier of this cancellation line item.
- **cancelledQuantity** (Int)
  - The quantity that was cancelled from the original purchase quote line item. Present only when the purchase quote cancellation is completed.
- **item** (ContractCancellationItemReference)
  - A reference to the cancelled item. This optional field is present only when the cancellation has the reference item.
- **purchaseQuoteLineItem** (PurchaseQuoteLineItem!)
  - A reference to the original purchase quote line item.
- **requestedQuantity** (Int!)
  - The quantity requested to be cancelled from the original purchase quote line item.

### BuyerRequestedCancellation
**Description:** This type represents the reason used by seller when the buyer requested the seller to cancel the contract.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The unique cancellation reason code for this use case. For this type, the value is \`BUYER\_REQUESTED\`.
- **displayText** (String!)
  - A human-readable description of the cancellation reason. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### ContractPlacedByMistakeCancellation
**Description:** This type indicates that the contract was placed by mistake. For example, user accidentally clicked a button and placed the contract.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The unique machine-readable contract cancellation reason code for this use case. For this type, the value is \`CONTRACT\_PLACED\_BY\_MISTAKE\`.
- **displayText** (String!)
  - A human-readable description of the cancellation reason. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### FoundCheaperPriceCancellation
**Description:** This type indicates the cancellation reason was that a cheaper price from a different seller was found.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The unique machine-readable contract cancellation reason code for this use case. For this type, the value is \`FOUND\_CHEAPER\_PRICE\`.
- **displayText** (String!)
  - A human-readable description of the cancellation reason. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### IncorrectPaymentMethodCancellation
**Description:** This type indicates the incorrect payment method that was used when the contract was created.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The unique cancellation reason code for this use case. For this type, the value is \`INCORRECT\_PAYMENT\_METHOD\`.
- **displayText** (String!)
  - A human-readable description of the cancellation reason. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### IncorrectShippingAddressCancellation
**Description:** This type indicates the incorrect shipping address was provided when the contract was created.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The unique cancellation reason code for this use case. For this type, the value is \`INCORRECT\_SHIPPING\_ADDRESS\`.
- **displayText** (String!)
  - A human-readable description of the cancellation reason. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### IncorrectShippingMethodCancellation
**Description:** This type indicates the incorrect shipping method was selected when the contract was created.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The unique cancellation reason code for this use case. For this type, the value is \`INCORRECT\_SHIPPING\_METHOD\`.
- **displayText** (String!)
  - A human-readable description of the cancellation reason. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### LateDeliveryCancellation
**Description:** This type indicates the cancellation reason is late delivery of the item.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The unique machine-readable contract cancellation reason code for this use case. For this type, the value is \`LATE\_DELIVERY\`.
- **displayText** (String!)
  - A human-readable description of the cancellation reason. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### NeedItemToBeShippedCancellation
**Description:** This type indicates that the buyer needs the item to be shipped instead of picked up. Applicable only for local pickup orders.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The unique cancellation reason code for this use case. For this type, the value is \`NEED\_ITEM\_TO\_BE\_SHIPPED\`.
- **displayText** (String!)
  - A human-readable description of the cancellation reason. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### OtherCancellation
**Description:** This type indicates that cancellation is needed for a reason not covered by a specific other type.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The unique cancellation reason code for this use case. For this type, the value is \`OTHER\`.
- **displayText** (String!)
  - A human-readable description of the cancellation reason. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### OutOfStockCancellation
**Description:** This type represents the reason used by seller when the item(s) sold under the contract are out of stock.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The unique cancellation reason code for this use case. For this type, the value is \`OUT\_OF\_STOCK\`.
- **displayText** (String!)
  - A human-readable description of the cancellation reason. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### PickupUnavailableCancellation
**Description:** This type indicates that the buyer was unable to arrange pickup for the order. Applicable only for local pickup orders.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The unique cancellation reason code for this use case. For this type, the value is \`PICKUP\_UNAVAILABLE\`.
- **displayText** (String!)
  - A human-readable description of the cancellation reason. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### RemorseCancellation
**Description:** This type indicates that the buyer cancelled due to a change of mind about the purchase.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The unique cancellation reason code for this use case. For this type, the value is \`REMORSE\`.
- **displayText** (String!)
  - A human-readable description of the cancellation reason. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### ShippingAddressIssuesCancellation
**Description:** This type represents the reason used by the seller when there are issues with the buyer's shipping address.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The unique cancellation reason code for this use case. For this type, the value is \`SHIPPING\_ADDRESS\_ISSUES\`.
- **displayText** (String!)
  - A human-readable description of the cancellation reason. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### UndisclosedCancellation
**Description:** This type indicates that cancellation reason is undisclosed to the current viewer. For example, certain cancellations created by eBay do not disclose the actual reason to sellers.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The unique cancellation reason code for this use case. For this type, the value is \`UNDISCLOSED\`.
- **displayText** (String!)
  - A human-readable description of the cancellation reason. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### UnpaidContractCancellation
**Description:** This type represents the reason used by the seller when the buyer has not completed payment after the maximum waiting period defined by eBay's policy for resolving unpaid items. For more details, refer to the policy: https://www.ebay.com/help/selling/getting-paid/resolving-unpaid-items-buyers?id=4137
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The unique cancellation reason code for this use case. For this type, the value is \`UNPAID\_CONTRACT\`.
- **displayText** (String!)
  - A human-readable description of the cancellation reason. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### ContractCancellationAwaitingActionFromSeller
**Description:** This type indicates the contract is open and pending on action from the involved party. For the seller, this can happen when the buyer submits a cancel request and seller has an action to take (for example, approve or decline). This can also occur for a post seller-initiated refund that failed.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable contract cancellation status code. For this type, the value is \`AWAITING\_ACTION\_FROM\_SELLER\`.
- **displayText** (String!)
  - A human-readable description of the contract cancellation status. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### ContractCancellationCompleted
**Description:** This type indicates that the cancellation was completed and the workflow is in an end state.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable contract cancellation status code. For this type, the value is \`COMPLETED\`.
- **displayText** (String!)
  - A human-readable message of the contract cancellation status. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### ContractCancellationDeclined
**Description:** This type indicates that the cancellation was declined and the workflow is in an end state. The cancellation did not complete successfully. Typical causes include: - Seller explicitly rejected the cancellation - System auto-declined (for example, if the item already shipped) - Refund attempts failed or were exhausted within cancellation life cycle \*\*Note:\*\* The cancellation did not complete successfully and the cancellation is at end state; no further cancellation actions can successfully complete from this state.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable contract cancellation status code. For this type, the value is \`DECLINED\`.
- **displayText** (String!)
  - A human-readable message of the contract cancellation status. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### ContractCancellationPending
**Description:** This type indicates that the cancellation is approved, and awaiting processing or a refund is in progress.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable cancellation status code. For this type, the value is \`PENDING\`.
- **displayText** (String!)
  - A human-readable description of the cancellation status. This alphanumeric string is not localized and may change without notice. Maximum length: 100 characters

### ItemCommitmentAddOnService
**Description:** This type is used to indicate extra or special features or services that were added by the buyer or seller to the item commitment.
**Type:** GraphQLObjectType

**Properties:**
- **eBayVault** (EbayVaultAddOnService)
  - This object is returned to indicate that the shipment/delivery of a trading card will involve the PSA vault.
- **exports** (ExportsAddOnService)
  - This object is returned to indicate if the eBay International Shipping program will be used by the seller to ship the item(s).
- **fulfillment** (FulfillmentAddOnService)
  - This object is returned to indicate if eBay managed shipping will be used to ship the item(s).
- **globalShipping** (GlobalShippingAddOnService)
  - This object is returned to indicate if the Global Shipping Program will be used by the seller to ship the item(s).
- **motorPurchase** (MotorPurchaseAddOnService)
  - This object is returned to indicate that the buyer of a motor vehicle is purchasing additional services for the vehicle such as financing or insurance.

### EbayVaultAddOnService
**Description:** This type is used to provide the cost and vault fulfillment type used for an item that is located within the PSA Vault.
**Type:** GraphQLObjectType

**Properties:**
- **fulfillmentType** (EbayVaultFulfillmentType!)
  - This field specifies the vault fulfillment type that will be used to deliver the item to the buyer.
- **serviceCost** (AmountSet)
  - The associated cost of the vault service. This object can be null when there is no cost associated with the fulfillment.

### ExportsAddOnService
**Description:** This type contains details about exports addon service related information.
**Type:** GraphQLObjectType

**Properties:**
- **returnManagedBy** (ID!)
  - The unique identifier of the party that will handle the return if a return happens. As of now, the only valid value is \`EBAY\`.
- **serviceLocation** (ID)
  - The location where the service is to be provided or performed.

### FulfillmentAddOnService
**Description:** This type contains detailed information on the fulfillment addon service associated with an order line item.
**Type:** GraphQLObjectType

**Properties:**
- **fulfilledBy** (ID!)
  - This field indicates the party that is handling fulfillment of the order line item.

### GlobalShippingAddOnService
**Description:** This type is used to indicate which party handles shipment through the Global Shipping Program.
**Type:** GraphQLObjectType

**Properties:**
- **poweredBy** (ID!)
  - The unique identifier of the party that will handle fulfillment through the Global Shipping Program. As of now, the only valid value is \`EBAY\`.

### MotorPurchaseAddOnService
**Description:** This type provides details when a buyer adds additional services to their motor vehicle purchase, such as financing or insurance.
**Type:** GraphQLObjectType

**Properties:**
- **buyerStep** (ID)
  - The identifier returned in this field indicates the latest step completed by the buyer in relationship to the service being provided. In no particular order, possible values include: - finance\_completed - finance\_done - finance\_failed - finance\_submitted - identity\_done - identity\_failed - identity\_started - identity\_success - identity\_updated\_address\_completed - insurance\_completed - insurance\_done - payment\_done - payment\_start - protection\_done - signature\_done - signature\_gov\_id\_failed - signature\_gov\_id\_started - signature\_gov\_id\_success - signature\_start - signature\_started - transport\_done - verification\_completed - verification\_done
- **facilitator** (ID!)
  - The unique identifier of the facilitator managing the service, such as \`EBAY\`.
- **facilitatorReferenceID** (ID!)
  - The unique identifier of the service, used for cross-system tracking.
- **sellerStep** (ID)
  - The identifier returned in this field indicates the latest step completed by the seller in relationship to the service being provided. In no particular order, possible values include: - identity\_address\_submitted - identity\_done - identity\_failed - identity\_started - identity\_success - payment\_done - payment\_start - signature\_done - signature\_start - signature\_started - title\_docs\_submitted - title\_done - title\_lender\_lessor\_submitted
- **serviceCost** (AmountSet)
  - The cost of the additional service. This object is returned if there is a cost associated with service.
- **state** (MotorPurchaseState!)
  - The current overall state of the motor purchase additional service.

### MotorPurchaseState
**Description:** This type provides details on the state of a motor purchase additional service.
**Type:** GraphQLObjectType

**Properties:**
- **displayString** (String!)
  - A human-readable string representing the current state of the motor purchase additional service. Examples include \`In Progress\`, \`Purchase Completed\`, \`Cancelled\`.
- **id** (ID!)
  - The unique identifier of the motor purchase additional service. Possible values include \`ACTIVE\`, \`COMPLETED\`, \`CANCELLED\`.

### ContractListingItem
**Description:** This type is used to show details on the line item associated with a purchase contract, including the identifier of the item, purchase quantity, how the item was purchased, and SKU value if defined.
**Type:** GraphQLObjectType

**Properties:**
- **item** (Item!)
  - The unique identifier of the purchasable item associated with this purchase contract.
- **itemSku** (ItemSku)
  - The seller-provided SKU (Stock-Keeping Unit) value of a purchasable item. This field is returned if defined in a listing.
- **purchaseFlow** (PurchaseFlowType)
  - This object will provide more information on how the item commitment was initiated. For example, the buyer won an auction, the buyer and seller came to terms on a Best Offer or seller-initiated offer, or if a \*\*commitToPurchase\*\* mutation was used on behalf of a buyer.
- **quantity** (Int!)
  - The purchase quantity of the line item associated with this purchase contract. \*\*Note\*\*: This value will always be \`1\` for an auction listing, but can be more for a fixed-price item with multiple quantity available.

### ItemSku
**Description:** This type is used to provide the seller-defined or store SKU (Stock-Keeping Unit) of a purchasable item.
**Type:** GraphQLObjectType

**Properties:**
- **sellerSku** (String)
  - The seller-defined SKU (Stock-Keeping Unit) of a purchasable item.
- **storeSku** (String)
  - The store-defined SKU (Stock-Keeping Unit) of a purchasable item.

### PurchaseLogistics
**Description:** This type is used to provide full details on the fulfillment plan(s) available to the buyer, and ultimately, the fulfillment plan that is selected by the buyer. If a fulfillment plan has not been selected by the buyer yet, the \*\*fulfillmentPlan\*\* array will show all fulfillment plans available to the buyer. If the buyer has selected a fulfillment plan, but fulfillment has not yet started, the \*\*fulfillmentPlan\*\* array will show the selected the fulfillment plan. If the buyer has selected a fulfillment plan, and fulfillment has started or is completed, the \*\*fulfillmentExecution\*\* array will show the details of the fulfillment plan, including its current state.
**Type:** GraphQLObjectType

**Properties:**
- **fulfillmentExecution** ([LogisticsFulfillmentExecution!])
  - This array shows the details of the selected fulfillment plan, including its current state.
- **fulfillmentPlan** ([LogisticsFulfillmentPlan!])
  - This array shows all fulfillment plans available to the buyer, or if a buyer has selected one, the fulfillment plan selected by the buyer, but not yet started.

### LogisticsFulfillmentExecution
**Description:** This type provides details on the selected fulfillment plan that is either in progress or completed. It includes the fulfillment type, current state, and the steps involved in fulfilling the delivery of the item.
**Type:** GraphQLObjectType

**Properties:**
- **fulfillmentState** (LogisticsFulfillmentState!)
  - This object conveys the current state of the fulfillment plan. The details shown here will vary based on the current state.
- **logisticsExecutionSteps** ([LogisticsStep!])
  - This array shows the sequence of logistics steps required to complete fulfillment. Some fulfillment plans involve multiple steps, but others involve only one step.
- **planType** (ID!)
  - The identifier displayed here will indicate the type of fulfillment plan being used. Below are some possible values that can be returned here: - \`SHIPPING\`: standard domestic or international shipping. - \`INTERMEDIATED\_SHIPPING\`: shipping that involves multiple shipping legs, with eBay or an eBay partner taking care of at least one of those shipping legs. Examples of this include Global Shipping Program, eBay International Shipping, eBay Vault, and Authenticity Guarantee. - \`STORE\_PICKUP\`: buyer picks up item at local store for a 'Buy online, pick up in store' (BOPIS) or 'Click and Collect' order. - \`PICKUP\`: local pickup. - \`DIGITAL\_DELIVERY\`: digital delivery of an item, such as a gift card.

### DigitalDeliveryStep
**Description:** This type convey details of a digital delivery logistics step involved in a fulfillment plan.
**Type:** GraphQLObjectType

**Properties:**
- **deliveryPoint** (LogisticsPoint!)
  - This object shows details of the digital delivery location, which is typically an email address.
- **handler** (DisplayableId)
  - This object shows the user-friendly description and unique identifier of the party responsible for handling this digital delivery logistics step.
- **methodName** (DisplayableId!)
  - This object shows the user-friendly description and unique identifier of the digital delivery logistics step, for example \`Email Delivery\`.
- **planOrExecution** (DigitalDeliveryPlanOrExecution!)
  - The information shown in this object is dependent on the state of the logistics step. If the logistics step has not yet started and there is no hold associated with the logistics step, it may get returned as empty or null. If the logistics step is active or completed, the state and full details for this digital delivery step will be shown.

### PickupStep
**Description:** This type convey details of a pickup logistics step involved in a fulfillment plan.
**Type:** GraphQLObjectType

**Properties:**
- **handler** (DisplayableId)
  - This object shows the user-friendly description and unique identifier of the party responsible for handling this pickup logistics step.
- **methodName** (DisplayableId!)
  - This object shows the user-friendly description and unique identifier of the pickup logistics step.
- **pickupCode** (ID)
  - The unique identifier of a store location that has the item. This ID may or may not be applicable or returned. \*\*Note\*\*: This identifier is generally applicable to Buy online, pick up in store (BOPIS) or Click and Collect orders.
- **pickupLocation** (LogisticsPoint!)
  - This object shows details on the pickup location, including the user-friendly name, location type, and a full street address.
- **planOrExecution** (PickupPlanOrExecution!)
  - The information shown in this object is dependent on the state of the logistics step. If the logistics step has not yet started and there is no hold associated with the logistics step, it may get returned as empty or \`null\`. If the logistics step is active or completed, the state and full details for this pickup step will be shown.

### ServiceStep
**Description:** This type represents a step in a service workflow connecting a participant (such as a buyer or carrier) to a \`ServicePoint\` for the service action (for example, dropping off, picking up, or transferring an item). This type describes the interaction leading to the service, not the service itself.
**Type:** GraphQLObjectType

**Properties:**
- **handler** (DisplayableId)
  - This object shows the user-friendly description and unique identifier of the party responsible for handling this logistics step.
- **methodName** (DisplayableId!)
  - This object shows the user-friendly description and unique identifier of the logistics step. For example, \`Buyer Drop Off\` or \`Carrier Pick Up\`.
- **servicePoint** (ServicePoint!)
  - This object shows the service point where this step leads to or occurs representing the physical or operational location of the service interaction.

### ShippingStep
**Description:** This type conveys the details of a shipping logistics step involved in a fulfillment plan.
**Type:** GraphQLObjectType

**Properties:**
- **estimate** (LogisticsFulfillmentEstimate)
  - This object shows the estimated delivery window for the item going from the \*\*shipFrom\*\* to the \*\*shipTo\*\* location.
- **handler** (DisplayableId)
  - This object shows the user-friendly description and unique identifier of the party responsible for handling this shipping logistics step.
- **methodName** (DisplayableId!)
  - This object shows the user-friendly description and unique identifier of the shipping logistics step.
- **planOrExecution** (ShippingPlanOrExecution!)
  - The information shown in this object is dependent on the state of the logistics step. If the logistics step has not yet started and there is no hold associated with the logistics step, it may get returned as empty or null. If the logistics step is active or completed, the state and full shipping details for this shipping step will be shown.
- **shipFrom** (LogisticsPoint)
  - This object shows details on the ship-from location, including the user-friendly name, location type, and a full street address. May be \`null\` when data is not available.
- **shipTo** (LogisticsPoint!)
  - This object shows details on the ship-to location, including the user-friendly name, location type, and a full street address.

### DisplayableId
**Description:** This type is used by multiple types that require a unique identifier and a human-readable name.
**Type:** GraphQLObjectType

**Properties:**
- **displayName** (String!)
  - A human-readable name or description. \*\*Maximum length\*\*: 100 characters
- **id** (ID!)
  - A unique identifier.

### LogisticsFulfillmentPlan
**Description:** This type provides details on an available fulfillment plan or selected fulfillment plan that has yet to be started. It includes the fulfillment type and the steps involved in fulfilling the delivery of the item.
**Type:** GraphQLObjectType

**Properties:**
- **logisticsPlanSteps** ([LogisticsStep!])
  - This array shows the sequence of logistics steps required to complete fulfillment. Some fulfillment plans involve multiple steps, but others involve only one step.
- **planType** (ID!)
  - The identifier displayed here will indicate the type of fulfillment plan available to be used or selected to be used. Below are some possible values that can be returned here: - \`SHIPPING\`: standard domestic or international shipping. - \`INTERMEDIATED\_SHIPPING\`: shipping that involves multiple shipping legs, with eBay or an eBay partner taking care of at least one of those shipping legs. Examples of this include Global Shipping Program, eBay International Shipping, eBay Vault, and Authenticity Guarantee. - \`STORE\_PICKUP\`: buyer picks up item at local store for a 'Buy online, pick up in store' (BOPIS) or 'Click and Collect' order. - \`PICKUP\`: local pickup. - \`DIGITAL\_DELIVERY\`: digital delivery of an item, such as a gift card.

### ItemCommitmentShippingLogisticsOption
**Description:** This type is used to provide details on a shipping-related logistics available to the buyer to receive the item. Information included for each shipping logistics option includes seller-specified or calculated shipping cost, both the user-friendly description and enum value associated with the shipping service, and the estimated delivery time window (in hours).
**Type:** GraphQLObjectType

**Properties:**
- **cost** (AmountSet)
  - The total shipping cost for the item if the corresponding shipping service is used. Multiple values/currencies will be shown if the buyer or seller use a different currency than the default currency of the eBay marketplace.
- **displayName** (String)
  - The user-friendly description of the shipping service option. \*\*Maximum length\*\*: 100 characters \*\*Format\*\*: Alphanumeric, and may include spaces and capitalization
- **maxDeliveryTimeInHours** (String)
  - This field will indicate the latest estimated delivery time that the buyer can expect to receive the item if the corresponding shipping service is used. The value returned here will be a positive integer value representing hours. This value will generally be in 24-hour increments indicating the longest amount of business days in which the buyer could receive the item. Estimated delivery times consider the seller's stated handling time plus the expected transit time range of the shipping service. \*\*Note\*\*: Sellers generally do not ship items until the buyer's payment has cleared, so this delivery window should really only be considered after payment has been made by the buyer.
- **minDeliveryTimeInHours** (String)
  - This field will indicate the earliest estimated delivery time that the buyer can expect to receive the item if the corresponding shipping service is used. The value returned here will be a positive integer value representing hours. This value will generally be in 24-hour increments indicating the shortest amount of business days in which the buyer could receive the item. Estimated delivery times consider the seller's stated handling time plus the expected transit time range of the shipping service. \*\*Note\*\*: Sellers generally do not ship items until the buyer's payment has cleared, so this delivery window should really only be considered after payment has been made by the buyer.
- **shippingServiceCode** (ID)
  - The enumeration value associated with the shipping service. In Listing and Business Policy APIs, the enumeration values of shipping services are specified to set the shipping services that are available to ship the item.

### MonetaryDetails
**Description:** This type is used to show detailed information for planned and executed monetary transactions that occur between payer and payee.
**Type:** GraphQLObjectType

**Properties:**
- **payeeExecution** (PayeeMonetaryExecutionUnion!)
  - This array shows the list of executed payment actions from the payee.
- **payeePlans** ([MonetaryPlan!]!)
  - This array shows the list of planned payment actions from the payee. These describe how the payee expectss to receive funds.
- **payerExecution** (PayerMonetaryExecutionUnion!)
  - This array shows the list of executed payment actions from the payer.
- **payerPlans** ([MonetaryPlan!]!)
  - This array shows the list of planned payment actions from the payer. These describe how the payer intends to send funds (for example, via card, wallet, or account).

### PayeeMarkedPaid
**Description:** This type indicates that the payee's payment was manually marked as paid by the seller.
**Type:** GraphQLObjectType

**Properties:**
- **markedAt** (DateTime)
  - This timestamp indicates when the payment was marked as paid.

### PayeeMonetaryExecution
**Description:** This type contains detailed monetary information related to the execution of a payment to the payee.
**Type:** GraphQLObjectType

**Properties:**
- **payeeBalance** (Amount)
  - The current balance associated with the payee.
- **payeeExecutions** ([MonetaryExecution!])
  - This array shows the list of payment actions that the payee is involved in.
- **receivedAmount** (Amount)
  - The total amount successfully received by the payee.
- **receivedState** (MonetaryExecutionPaymentState)
  - This object indicates whether the payee has received the expected funds.

### MonetaryExecution
**Description:** This type is used to provide details on executed payment plan(s) and the payment(s) involved in those payment plan(s).
**Type:** GraphQLObjectType

**Properties:**
- **executionOfPlans** ([MonetaryPlan!])
  - This array shows the original monetary plan(s) associated with this payment execution. \*\*Note\*\*: Can be null if the payment execution was not derived from a predefined plan.
- **payments** ([PaymentExecution!]!)
  - This array lists one or more individual payments involved in this payment execution.
- **state** (PaymentsState!)
  - The current state of the monetary execution, indicating progress or completion state of payments.

### MonetaryPlan
**Description:** This type provides details on a monetary payment plan, including scheduled payments and the overall plan state.
**Type:** GraphQLObjectType

**Properties:**
- **payments** ([PaymentPlan!]!)
  - This array shows the list of individual payment entries that make up the plan.
- **state** (MonetaryPlanState!)
  - This object shows the current state of the monetary plan (for example, \`ACTIVE\` or \`CANCELLED\`).

### PayeePaymentPlan
**Description:** This type is used to provide details about a scheduled payment plan from the perspective of the payee.
**Type:** GraphQLObjectType

**Properties:**
- **destinationAccount** (FundAccount!)
  - The destination account of the payee which will receive the payment.
- **paymentDeadline** (DateTime)
  - This timestamp indicates the deadline by which the payment must be completed. \*\*Note\*\*: May be \`null\` if no strict deadline is set.
- **paymentMethods** ([PurchasePaymentMethod!])
  - This array shows payment methods intended to fund this plan. \*\*Note\*\*: May be null if the information is unavailable.
- **scheduledFor** (DateTime)
  - This timestamp indicates the specific date and time when the payment is scheduled to occur. \*\*Note\*\*: May be \`null\` if the payment is not tied to a fixed schedule.
- **total** (AmountSet!)
  - The total amount to be transferred from the source account to the destination account under this plan.

### PayerPaymentPlan
**Description:** This type is used to provide details about a scheduled payment plan from the perspective of the payer.
**Type:** GraphQLObjectType

**Properties:**
- **paymentDeadline** (DateTime)
  - This timestamp indicates the deadline by which the payment must be completed. \*\*Note\*\*: May be \`null\` if no strict deadline is set.
- **paymentMethods** ([PurchasePaymentMethod!])
  - This array lists one or more payment methods intended to fund this plan. \*\*Note\*\*: May be \`null\` if the information is unavailable.
- **scheduledFor** (DateTime)
  - This timestamp indicates the specific date and time when the payment is scheduled to occur. \*\*Note\*\*: May be \`null\` if the payment is not tied to a fixed schedule.
- **sourceAccount** (FundAccount!)
  - The source account of the payer which will fund the payment.
- **total** (AmountSet!)
  - The total amount to be transferred from the source account to the destination account under this plan.

### PurchasePaymentMethod
**Description:** This type is used to provide details for a payment method used in a purchase transaction.
**Type:** GraphQLObjectType

**Properties:**
- **paymentType** (PaymentMethodType!)
  - This object provides more information on the payment method used.

### PayeePaymentExecution
**Description:** This type is used to provide details on executed payment(s) involved in the corresponding payment plan(s) in relationship to the payee.
**Type:** GraphQLObjectType

**Properties:**
- **attemptedAt** (DateTime)
  - This timestamp indicates the date and time when the payment execution was attempted. It is returned regardless of success or failure, but can be \`null\` if the payment execution was not attempted.
- **completedAt** (DateTime)
  - This timestamp indicates the date and time when the payment execution was completed. It is returned regardless of success or failure, but can be \`null\` if the payment execution was not completed.
- **destinationAccount** (FundAccount!)
  - The destination account of the payee which will receive the payment.
- **paymentHoldState** (PaymentHoldState)
  - This object provides details on any active or released holds on payment execution. \*\*Note\*\*: This field is null if no hold is in place.
- **paymentMethod** (PurchasePaymentMethod!)
  - The payment method that is used to fund the payment.
- **state** (PaymentsState!)
  - This object shows the current state of payment execution.
- **total** (AmountSet!)
  - The total amount that is transferred from source account to destination account.

### PayerPaymentExecution
**Description:** This type is used to provide details on executed payments within the corresponding payment plans, in relation to the payer.
**Type:** GraphQLObjectType

**Properties:**
- **attemptedAt** (DateTime)
  - This timestamp indicates the date and time when the payment execution was attempted. It is returned regardless of success or failure, but can be \`null\` if the payment execution has not started.
- **completedAt** (DateTime)
  - This timestamp indicates the date and time when the payment execution was completed. It is returned regardless of success or failure, but can be \`null\` if the payment execution has not completed.
- **paymentMethod** (PurchasePaymentMethod!)
  - The payment method that is used to fund the payment.
- **sourceAccount** (FundAccount!)
  - The source account of the payer which will fund the payment.
- **state** (PaymentsState!)
  - This object shows the current state of payment execution.
- **total** (AmountSet!)
  - The total amount transferred from the source account to the destination account.

### PayerMarkedPaid
**Description:** This type is used to indicate that the payer’s payment was manually marked as paid by the seller.
**Type:** GraphQLObjectType

**Properties:**
- **markedAt** (DateTime)
  - This timestamp indicates when when the payment was marked as paid.

### PayerMonetaryExecution
**Description:** This type shows detailed monetary information related to the execution of a payment by the payer.
**Type:** GraphQLObjectType

**Properties:**
- **paidAmount** (Amount)
  - The total amount successfully paid by the payer.
- **paidState** (MonetaryExecutionPaymentState)
  - This object indicates whether the payer's payment has been completed or is pending.
- **payerBalance** (Amount)
  - The current balance associated with the payer.
- **payerExecutions** ([MonetaryExecution!])
  - This array shows the list of payment actions carried out by the payer.

### Order
**Description:** This type defines the unique identifier of an order, which is a confirmed request by a customer to purchase one or more products or services through an e-commerce platform. It contains all relevant details required to process, fulfill, and track the transaction, including customer information, items purchased, payment details, shipping data, and state updates.
**Type:** GraphQLObjectType

**Properties:**
- **orderId** (ID)
  - The unique identifier of the order.
- **buyer** (User!)
  - The customer who placed the order. This field references the user associated with the purchase.
- **cancellations** ([CancellationAdjustment!])
  - This array returns information related to the cancellation of the order, if applicable.
- **checkoutMarketplace** (Marketplace!)
  - The site or platform where the checkout for the order was completed.
- **confirmedAt** (DateTime)
  - The timestamp when the customer completed the checkout process, which confirms the order. At this point, payment is typically processed, and if successful, the order transitions from a draft or cart state to a finalized purchase ready for fulfillment. \*\*Note:\*\* This field could be null for an order which was created but not yet confirmed and is still being processed.
- **logistics** (PurchaseLogistics!)
  - This object returns logistics information associated with the order. This information describes how the purchased items will be fulfilled, delivered, or made available to the buyer.
- **monetaryDetails** (MonetaryDetails!)
  - This object returns the monetary record associated with the order. Each entry represents a distinct payment-related detail within the order lifecycle.
- **orderAddOnService** (OrderAddOnService!)
  - This field contains all the addon services related to the order.
- **orderLineItems** ([OrderLineItem!]!)
  - This array returns a non-empty list of line items included in the order. Each line item represents an item and includes details like quantity, pricing, and other relevant information. \*\*Note:\*\* An order can contain multiple types of items.
- **orderState** (OrderState!)
  - The current state of the order providing specific details related to that state. Separate calls can make a model of the lifecycles of an order by providing the sequence of steps.
- **orderTags** (PurchaseTags)
  - This object contains all tags associated with the order.
- **paymentAdjustments** ([PaymentAdjustment!])
  - This array returns details of any post-purchase payment adjustments made to the order, such as additional charges applied to the buyer (e.g., for added shipping or corrected fees). This field is populated only when such adjustments occur.
- **placedAt** (DateTime!)
  - The timestamp when the order was initially created which marks the start of the order lifecycle. \*\*Note:\*\* This object is never null.
- **refunds** ([RefundAdjustment!])
  - This array returns information related to any refund associated with the order, if applicable.
- **returns** ([ReturnAdjustment!])
  - This array returns information related to any return associated with the order, if applicable.
- **taxes** (OrderTaxes!)
  - This object provides comprehensive tax-related information for the order.
- **totals** (OrderTotals!)
  - The full set of calculated monetary totals associated with the order, covering all relevant amounts in supported currencies.
- **updatedAt** (DateTime!)
  - The timestamp when the order was last updated. This timestamp captures changes made to order details, state, or related information. \*\*Note:\*\* This object is never null.

### CancellationAdjustment
**Description:** This type defines a cancellation adjustment. A cancellation adjustment refers to the process of modifying or updating a transaction when an order is canceled after the purchase has been made. This typically involves adjustments to the payment, inventory, and order state, reflecting that the transaction will no longer proceed as originally planned.
**Type:** GraphQLObjectType

**Properties:**
- **adjustmentId** (ID!)
  - The user-friendly ID of the adjustment.
- **cancellation** (OrderCancellation!)
  - The cancellation event associated with this adjustment.
- **createdAt** (DateTime!)
  - The creation date of the adjustment.
- **state** (OrderAdjustmentState!)
  - The state of the adjustment.
- **updatedAt** (DateTime!)
  - The last updated date-time of the adjustment.

### PaymentAdjustment
**Description:** This type defines a payment Adjustment. A payment adjustment refers to the process of modifying or correcting the amount paid for an order, typically due to issues such as pricing errors, additional charges, discounts, partial refunds, or changes in the order after the initial payment has been made.
**Type:** GraphQLObjectType

**Properties:**
- **adjustmentId** (ID!)
  - The user-friendly ID of the adjustment.
- **createdAt** (DateTime!)
  - The creation date of the adjustment.
- **externalReference** (DomainIdentifier!)
  - The reference ID from the external system initiating the payment adjustment.
- **monetaryDetails** (MonetaryDetails)
  - The monetary details, if applicable, such as any replacement fees or adjustments.
- **orderLineItems** ([OrderLineItem!]!)
  - A list of one or more affected by the payment adjustment.
- **state** (OrderAdjustmentState!)
  - The state of the adjustment.
- **updatedAt** (DateTime!)
  - The last updated date-time of the adjustment.

### RefundAdjustment
**Description:** This type defines a refund adjustment. A refund refers to the process of returning money to a customer for a purchase they made, typically due to dissatisfaction with the product or service, cancellation of the order, or a mistake in processing the transaction.
**Type:** GraphQLObjectType

**Properties:**
- **adjustmentId** (ID!)
  - The user-friendly ID of the adjustment.
- **createdAt** (DateTime!)
  - The creation date of the adjustment.
- **refund** (Refund!)
  - The refund event associated to this adjustment.
- **state** (OrderAdjustmentState!)
  - The state of the adjustment.
- **updatedAt** (DateTime!)
  - The last updated date-time of the adjustment.

### ReturnAdjustment
**Description:** This type defines the return adjustment. A return adjustment refers to the modification of a transaction or order after a customer returns a product. This adjustment typically involves updating the payment, inventory, or order state to reflect the return of goods. It ensures that the financial and inventory records are accurate after the product is returned, whether due to a defect, dissatisfaction, or change of mind.
**Type:** GraphQLObjectType

**Properties:**
- **adjustmentId** (ID!)
  - The user-friendly ID of the adjustment.
- **createdAt** (DateTime!)
  - The creation date of the adjustment.
- **return** (OrderReturn!)
  - The return event associated to this adjustment.
- **state** (OrderAdjustmentState!)
  - The state of the adjustment.
- **updatedAt** (DateTime!)
  - The last updated date-time of the adjustment.

### OrderAddOnService
**Description:** This type indicates additional optional features or services are associated with the order.
**Type:** GraphQLObjectType

**Properties:**
- **eBayPlus** (EbayPlusAddOnService)
  - This field provides information about the eBayPlus addon service.
- **exports** (ExportsAddOnService)
  - This field provides information about exports if this order has international shipping addon service.
- **globalShipping** (GlobalShippingAddOnService)
  - This field provides information about the global shipping addon service.

### EbayPlusAddOnService
**Description:** This type contains detailed information about the eBay plus addon service associated with an order line item.
**Type:** GraphQLObjectType

**Properties:**
- **poweredBy** (ID!)
  - This field identifies the party responsible for this service.

### OrderLineItem
**Description:** This type represents a single entry within an order, which can be a product, service, or other purchasable entity.
**Type:** GraphQLObjectType

**Properties:**
- **orderLineItemId** (ID!)
  - The unique identifier of an order line item.
- **buyerNotes** (String)
  - Buyer notes to the seller.
- **cancellations** ([CancellationAdjustment!])
  - Information related to the cancellation of the order line item, if applicable.
- **checkoutSource** (OrderCheckoutSource)
  - The source from which this line item originated during checkout, such as a commitment or a purchase quote, it could be null if it was through buy it now.
- **createdAt** (DateTime!)
  - The timestamp when the order line item was initially created.
- **fulfillmentExecution** ([LogisticsFulfillmentExecution!])
  - The fulfillment execution related to this line item.
- **giftSummary** (GiftSummary)
  - Detailed gift information for the line item if it was wrapped as a gift. This can be null if the item is not a gift.
- **inquiries** ([OrderInquiry!])
  - A list of inquiries associated with the line item, such as Item Not Received (INR) or other buyer-seller issues.
- **lineItem** (OrderLineItemSource!)
  - The line item purchased — can be a product, service, or other purchasable entity.
- **lineItemAddOn** (LineItemAddOnService)
  - Additional optional features or services associated with the line item.
- **lineItemTags** (PurchaseTags)
  - All tags associated with the order.
- **lineItemTotals** (OrderLineItemTotals!)
  - The full set of calculated monetary totals associated with the order line item, covering all relevant amounts in supported currencies.
- **linkedLineItems** ([LinkedLineItem!])
  - A list of line items that are related to this one through a logical or business relationship.
- **orderReference** (Order!)
  - The order to which this line item belongs.
- **priceDiscounts** ([PriceDiscount!])
  - A list of discounts applied to the line item.
- **purchaseMarketplace** (Marketplace!)
  - The marketplace from which this purchase originated.
- **refunds** ([RefundAdjustment!])
  - Information related to any refund associated with the order line item, if applicable.
- **returns** ([ReturnAdjustment!])
  - Information related to any return associated with the order line item, if applicable.
- **reward** ([OrderReward!])
  - Rewards used in this line item.
- **seller** (User!)
  - The user who listed or owns the product, service, or purchasable entity.
- **taxes** (OrderTaxes!)
  - Tax detail information for this line item.
- **updatedAt** (DateTime!)
  - The timestamp when the order line item was last updated. This timestamp captures changes made to order details, state, or related information.

### PurchaseQuote
**Description:** This type provides all details of a purchase quote. A purchase quote is a collection of two or more item commitments on one invoice that has adjusted price information and available shipping/pickup options.
**Type:** GraphQLObjectType

**Properties:**
- **purchaseQuoteId** (ID!)
  - The unique identifier of the purchase quote.
- **buyer** (User!)
  - The buyer who associated with the purchase quote.
- **cancellation** (PurchaseQuoteCancellation)
  - This object is only returned if the purchase quote has been cancelled, and includes the unique identifier of the cancellation.
- **createdAt** (DateTime!)
  - The exact date and time when the purchase quote was initially created in the system. This marks the start of the purchase quote lifecycle. \*\*Note\*\*: Guaranteed to be non-null.
- **lineItems** ([PurchaseQuoteLineItem!]!)
  - This array show details on the line items associated with the purchase quote, including the identifier of the item, purchase quantity, how the item was purchased, and SKU value if defined.
- **logisticsOptions** ([PurchaseQuoteLogisticsOption!])
  - This array shows the set of logistics options available to the buyer for this purchase quote. Each option includes method and cost.
- **messages** ([PurchaseQuoteMessage!])
  - This array will show or more messages left by the buyer or seller for their order partner regarding the purchase quote.
- **monetaryDetails** (MonetaryDetails)
  - This object shows detailed information on any and all monetary transactions that occurred for the purchase quote between any combination of buyer, seller, and eBay. Each entry represents a distinct payment-related detail within the purchase quote lifecycle.
- **order** (Order)
  - This object is returned with a unique identifier of an order if there is an order associated with the purchase quote.
- **seller** (User!)
  - The seller associated with the purchase quote.
- **shippingAddress** (PurchaseAddress!)
  - The destination address where items will be shipped.
- **state** (PurchaseQuoteState!)
  - This object provides Information on the current state of the purchase quote. The information that one will see here will be dependent on the state of the purchase quote.
- **totals** (PurchaseQuoteTotals!)
  - This object shows cost breakdown details for a purchase quote, including total cost, taxes, shipping discounts, and additional charges.
- **updatedAt** (DateTime!)
  - The exact date and time when the purchase quote was last modified or updated in the system. This timestamp captures any changes made to the purchase quote after initial creation, including change in state. \*\*Note\*\*: Guaranteed to be non-null.

### PurchaseQuoteLineItem
**Description:** This type show details on the line items associated with the purchase quote, including the identifier of the line item, purchase quantity, how the item was purchased, and SKU value if defined.
**Type:** GraphQLObjectType

**Properties:**
- **purchaseQuoteLineItemId** (ID!)
  - The unique identifier of the line item within the purchase quote.
- **cancellation** (PurchaseQuoteCancellation)
  - This object is only returned if the purchase quote line item has been cancelled, and includes the unique identifier of the cancellation.
- **lineItem** (ContractListingItem!)
  - This object shows details on the line item, including the identifier of the item, purchase quantity, how the item was purchased, and SKU value if defined.
- **lineItemSource** (PurchaseQuoteLineItemSource!)
  - This object shows the source of the purchase quote line item.
- **return** (PurchaseQuoteReturn)
  - This object is only returned if there is a return request associated with the purchase quote line item, and includes the unique identifier of the return request.
- **totals** (PurchaseQuoteTotals!)
  - This object shows cost breakdown details for a purchase quote line item, including total cost, taxes, shipping discounts, and additional charges.

### PurchaseQuoteReturn
**Description:** This type is used to show any return request that is open against a purchase quote line item.
**Type:** GraphQLObjectType

**Properties:**
- **return** ([OrderReturn])
  - This object shows the unique identifier of a return request that is open against a purchase quote line item.

### PurchaseQuoteTotals
**Description:** This type shows cost breakdown details for a purchase quote, including total cost, taxes, shipping discounts, and additional charges.
**Type:** GraphQLObjectType

**Properties:**
- **additionalCharge** (AmountSet!)
  - This object shows any additional charges for handling/processing fees that the seller may have applied to the purchase quote. The amount entered will increase the total cost for the purchase quote by this amount. \*\*Note\*\*: If the authenticated user uses a different currency than the default currency used by the eBay marketplace, this amount will also be shown in that user's currency.
- **shippingDiscount** (AmountSet!)
  - This object shows any shipping discount that the seller may have applied to the purchase quote. The amount here will reduce the cumulative shipping cost for all item commitments in the purchase quote by this amount. \*\*Note\*\*: If one or more item commitments in the purchase quote already have a shipping discount applied, the value supplied here will be an additional shipping discount. \*\*Note\*\*: If the authenticated user uses a different currency than the default currency used by the eBay marketplace, this amount will also be shown in that user's currency.
- **taxes** (OrderTaxes)
  - This object shows all of the tax details applicable to the purchase quote.
- **total** (AmountSet!)
  - This object shows the total cost for the purchase quote, including cost for all items, taxes, shipping discounts, and additional charges. \*\*Note\*\*: If the authenticated user uses a different currency than the default currency used by the eBay marketplace, this amount will also be shown in that user's currency.

### OrderTaxes
**Description:** This type shows all of the tax details applicable to the purchase quote.
**Type:** GraphQLObjectType

**Properties:**
- **eBayCollectAndRemitTax** (Boolean!)
  - This boolean field indicates whether or not one or more tax charges involved sales tax that eBay collects and remits to the applicable tax authority for the tax jurisdiction.
- **taxAddress** (PurchaseAddress)
  - This object shows the buyer's tax address on file with eBay, and can be used by the seller for tax purposes
- **taxBreakdown** ([OrderTax!])
  - This array shows the list of all taxes applied to the purchase quote, and may include sales tax, VAT, or other taxes.

### PurchaseAddress
**Description:** This type is used to provide the complete shipping or tax address of a buyer.
**Type:** GraphQLObjectType

**Properties:**
- **addressLine1** (String)
  - The first line of the street address. \*\*Maximum length\*\*: 100 characters
- **addressLine2** (String)
  - This optional field is used to provide the second line of the street address if applicable. The second line of the street address is generally used to provide apartment or suite number. \*\*Maximum length\*\*: 100 characters
- **city** (String)
  - The city of the street address. \*\*Maximum length\*\*: 50 characters
- **country** (CountryCode)
  - The two-letter code representing the country of the street address.
- **email** (String)
  - The email address associated with the street address (if applicable).
- **phone** (String)
  - The phone number associated with the street address (if applicable). \*\*Note\*\*: The value must consist of numeric characters and may include symbols such as +, -, and spaces. \*\*Maximum length\*\*: 20 characters
- **postalCode** (String)
  - The postal code of the street address.
- **stateOrProvince** (String)
  - The state or province of the street address. \*\*Maximum length\*\*: 50 characters

### OrderTax
**Description:** This type is used to provide details on each tax charge applied to a purchase contract.
**Type:** GraphQLObjectType

**Properties:**
- **name** (String!)
  - The name/type of tax.
- **salesTaxMethod** (String)
  - The sales tax method used (e.g. eBay Sales Tax Engine). \*\*Note\*\*: This field is only applicable if the tax charge was for sales tax.
- **salesTaxPercentage** (Decimal)
  - The sales tax rate that was used to calculate a sales tax charge. \*\*Note\*\*: This field is only applicable if the tax charge was for sales tax.
- **salesTaxProvinceOrState** (DisplayableId)
  - The state or province of the tax jurisdiction. \*\*Note\*\*: This field is only applicable if the tax charge was for sales tax.
- **taxAmount** (AmountSet!)
  - The amount of the tax charge. \*\*Note\*\*: If the authenticated user uses a different currency than the default currency used by the eBay marketplace, this amount will also be shown in that user's currency.

### PickupLogisticsOption
**Description:** This type shows details of a pickup logistics option.
**Type:** GraphQLObjectType

**Properties:**
- **cost** (AmountSet!)
  - This object shows the cost of the pickup logistics option. If the pickup logistics option is free to the buyer, this object will show a value of \`0.0\`. \*\*Note\*\*: If the authenticated user uses a different currency than the default currency used by the eBay marketplace, this amount will also be shown in that user's currency.
- **displayName** (String!)
  - The display name of the pickup logistics option.

### ShippingLogisticsOption
**Description:** This type shows details of a shipping logistics option, including the shipping service code, shipping carrier code, and shipping cost.
**Type:** GraphQLObjectType

**Properties:**
- **cost** (AmountSet!)
  - This object shows the cost of the shipping logistics option. If the shipping logistics option is free to the buyer, this object will show a value of \`0.0\`. \*\*Note\*\*: If the authenticated user uses a different currency than the default currency used by the eBay marketplace, this amount will also be shown in that user's currency.
- **displayName** (String!)
  - The display name of the shipping logistics option.
- **shippingCarrierCode** (ID)
  - The unique identifier of the shipping carrier. \*\*Examples\*\*: USPS, UPS, DHL
- **shippingServiceCode** (ID)
  - The unique identifier of the shipping service option. \*\*Example\*\*: UK\_RoyalMailSecondClassStandard

### PurchaseQuoteMessage
**Description:** This type show details of a message left by the buyer or seller for their order partner regarding the purchase quote.
**Type:** GraphQLObjectType

**Properties:**
- **message** (String!)
  - The full message left by the buyer or seller involved in the purchase quote.
- **sentAt** (DateTime)
  - This timestamp indicates exactly when the message was left by the buyer or seller.
- **sentByBuyer** (Boolean!)
  - This boolean field indicates whether the message was sent by the buyer.
- **sentBySeller** (Boolean!)
  - This boolean field indicates whether the message was sent by the seller.

### GiftSummary
**Description:** This type includes detailed gift information if the order or line item was wrapped as a gift. It captures elements such as the card template, gift message, image, and sender/recipient details.
**Type:** GraphQLObjectType

**Properties:**
- **cardTemplate** (String)
  - The card template, referring to the design or layout of the gift card.
- **giftMessage** (String)
  - The message included with the gift.
- **imageUrl** (String)
  - The URL of the image representing the gift.
- **recipient** ([PurchaseAddress!])
  - The recipient address details.
- **sender** ([PurchaseAddress!])
  - The address details of the sender.

### ItemNotReceivedInquiry
**Description:** This type represents an Item Not Received (INR) inquiry. The fields in this type capture the full inquiry lifecycle — from initiation through buyer and seller interactions, shipment tracking events, participants, refund processing, and final resolution. This type implements the OrderInquiry interface and specializes it for the INR Inquiry.
**Type:** GraphQLObjectType

**Properties:**
- **cases** ([PostPurchaseCase!])
  - This array returns a list of the post-purchase cases associated with this INR inquiry. \*\*Note\*\*: This array is only returned when the inquiry has been referred to eBay.
- **closedAt** (DateTime)
  - The timestamp when the INR inquiry was closed. \*\*Note\*\*: This object will be returned \`null\` if the inquiry is still open.
- **createdAt** (DateTime!)
  - The timestamp when the INR inquiry was created.
- **initiator** (PostPurchaseActorRole!)
  - The actor who originally initiated the INR inquiry (e.g., buyer).
- **inquirers** ([PostPurchaseActorRole!]!)
  - This array returns a list of all actors who have inquired about the same subject within this inquiry — starting with the original initiator, and including any other parties (e.g., buyer, seller, participant, or system) who later engaged. For example, the system might initiate the inquiry after handling time + 1 business day to prompt a seller response, and the buyer might inquire later on EDD + 1 day. Both actors would be listed here as having inquired about the same issue. \*\*Note:\*\* This field is required and will always contain at least one actor.
- **inquiryId** (ID!)
  - The unique identifier of the INR inquiry.
- **lineItems** ([OrderInquiryLineItem!]!)
  - This array returns a list of line items associated with this INR inquiry. \*\*Note:\*\* This list is guaranteed to be non-null but may be empty in certain valid cases. In most typical cases, it will contain at least one line item.
- **providedInformation** ([OrderInquiryInformation!]!)
  - This array returns a list of information or evidence provided by inquiry participants in response to system or CS requests. This includes user-submitted files, text notes, or structured responses. \*\*Note:\*\* This array may be an empty list if no additional information was provided.
- **refunds** ([Refund!])
  - This array returns a list of refunds associated with the INR inquiry. \*\*Note\*\*: This array will only be present if there are refunds associated with the inquiry.
- **requestedInformation** ([OrderInquiryInformationRequested!])
  - This array returns a list of information or evidence requests made during the inquiry lifecycle. These requests may be generated by the system or manually initiated by participants and are typically used to collect supporting documentation or clarifications from one or more involved parties (e.g., buyer or seller). Examples include requests for tracking details, signature confirmation, proof of delivery or other relevant evidence. \*\*Note\*\*: This list may be empty if no additional information was requested.
- **responder** (PostPurchaseActorRole!)
  - The user or party expected to respond to the INR inquiry (e.g., seller or eBay agent).
- **sellerAvailableActions** (OrderInquiryActions)
  - A list of actions currently available to the seller for this INR inquiry. This object may be returned \`null\` if: - The viewer is not a participant. - No actions are currently available based on the inquiry state and role. - The inquiry is in a terminal state (e.g., \`CLOSED\` or \`RESOLVED\`).
- **status** (OrderInquiryStatus!)
  - The current overall status of the INR inquiry (e.g., \`OPEN\`, \`CLOSED\`).
- **refundEstimate** (RefundEstimate)
  - The refund estimation for the inquiry entity. If \*\*refundEstimate\*\* is not requested on an order, this will not be calculated and provided.

### OrderInquiryLineItem
**Description:** This type represents a specific item in an order involved in the inquiry.
**Type:** GraphQLObjectType

**Properties:**
- **inquiryLineItemId** (ID!)
  - The unique identifier of the order inquiry line item.
- **orderLineItem** (OrderLineItem!)
  - The unique identifier of the order line item that was purchased.
- **quantity** (Int)
  - The quantity of the item under inquiry. \*\*Note\*\*: This field may be returned null if the quantity is not applicable to the inquiry context.

### OrderInquiryInformation
**Description:** This type represents a participant’s response to an information request within an inquiry. This may include document uploads, notes, tracking numbers, or any evidence submitted in response to a prior information request.
**Type:** GraphQLObjectType

**Properties:**
- **submittedAt** (DateTime!)
  - The timestamp when this information was submitted.
- **submittedInformation** ([OrderInquiryInformationProvided!]!)
  - This array returns a list of documents or files associated with the submission. \*\*Note\*\*: This array may return an empty list if the response was purely textual.
- **submitter** (PostPurchaseActorRole!)
  - The party who submitted this information.

### OrderInquiryShipmentTracking
**Description:** This type represents shipment tracking information for a fulfillment or delivery associated with the inquiry.
**Type:** GraphQLObjectType

**Properties:**
- **shippingCarrier** (ShippingCarrier!)
  - The standardized carrier code (e.g., \`UPS\`, \`USPS\`, \`FEDEX\`) associated with the shipment.
- **trackingNumber** (String!)
  - The tracking number provided by the shipping carrier. \*\*Minimum value\*\*: 1 \*\*Maximum value\*\*: 100 \*\*Format\*\*: Alphanumeric

### ShippingCarrier
**Description:** This type represents the shipping carrier details associated with a shipment or return. This type provides both the eBay-standard carrier code and, if applicable, the user-provided carrier name when the carrier is not officially supported by eBay Marketplace.
**Type:** GraphQLObjectType

**Properties:**
- **carrierCode** (String!)
  - The eBay-standard code representing the shipping carrier. This value corresponds to one of the supported eBay \`CarrierCodes\`. \*\*Note:\*\* The special value \`UNSUPPORTED\` indicates that eBay does not officially support or recognize the provided carrier.
- **unsupportedCarrierName** (String)
  - The carrier name provided by the user when eBay does not recognize the carrier. \*\*Note\*\*: This field is populated only when \*\*carrierCode\*\* is \`UNSUPPORTED\`.

### OrderInquirySignatureConfirmation
**Description:** This type represents the proof that the shipment was signed for at the time of delivery, is used as part of evidence for inquiries such as 'Item Not Received'.
**Type:** GraphQLObjectType

**Properties:**
- **signatureConfirmationProof** (OrderInquiryDocument!)
  - A document containing signature confirmation proof, such as a delivery scan or signed receipt. This field is required if signature confirmation is being submitted.
- **trackingNumber** (String!)
  - The tracking number associated with the shipment for which signature confirmation is provided. This field is required to associate the signature with a specific shipment. \*\*Minimum value\*\*: 1 \*\*Maximum value\*\*: 100 \*\*Format\*\*: Alphanumeric

### OrderInquiryDocument
**Description:** This type represents metadata about a document associated with an inquiry — such as uploaded evidence of signature confirmation, proof of shipping, or delivery.
**Type:** GraphQLObjectType

**Properties:**
- **documentId** (ID!)
  - The unique identifier of the document.
- **documentName** (String!)
  - The original or display name of the document file, as provided during upload. \*\*Minimum value\*\*: 1 \*\*Maximum value\*\*: 100 \*\*Format\*\*: Alphanumeric
- **filenameExtension** (FilenameExtension!)
  - The file name extension or format of the document (e.g., \`PDF\`, \`JPG\`, \`DOCX\`) as defined in the \*\*FilenameExtension\*\* enum.
- **uploadedAt** (DateTime!)
  - The timestamp indicating when the document was uploaded.

### ShipmentTrackingInformationRequested
**Description:** This type represents the request for shipment tracking information, such as tracking number and carrier details.
**Type:** GraphQLObjectType

**Properties:**
- **requestedAt** (DateTime!)
  - The timestamp when the shipping tracking information request was created.
- **requester** (PostPurchaseActorRole!)
  - The actor who initiated the shipping tracking information request.

### SignatureConfirmationRequested
**Description:** This type represents the request for proof of delivery information that includes signature confirmation details.
**Type:** GraphQLObjectType

**Properties:**
- **requestedAt** (DateTime!)
  - The timestamp when the proof of delivery information request was created.
- **requester** (PostPurchaseActorRole!)
  - The actor who initiated the proof of delivery information request.

### OrderInquiryActions
**Description:** This type represents the set of actions available to a participant during an inquiry. This includes the primary response action and any additional secondary actions that the participant may take before a specific due date.
**Type:** GraphQLObjectType

**Properties:**
- **respondByAction** (OrderInquiryRespondByAction)
  - This object returns the primary action that the participant is expected to take, along with the deadline by which it must be completed.
- **secondaryActions** ([OrderInquiryAction!])
  - This array returns a list of optional or supporting actions that the seller can take in addition to the primary response.

### OrderInquiryRespondByAction
**Description:** This type represents a primary inquiry action that must be taken by a certain deadline. This type is typically used to highlight time-sensitive actions required from an actor.
**Type:** GraphQLObjectType

**Properties:**
- **respondAction** (OrderInquiryAction!)
  - The action that must be taken by the due date, specified by the associated \*\*responseDueAt\*\* object.
- **responseDueAt** (DateTime!)
  - The deadline by which the action must be completed.

### OrderInquiryCloseAction
**Description:** This type represents a \`close\` action available during an inquiry.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A stable, machine-readable identifier for the \`close\` inquiry action (e.g., \`CLOSE\`).
- **displayText** (String!)
  - The human-readable text for the \`close\` inquiry action. \*\*Maximum length\*\*: 100 characters \*\*Format\*\*: Alphanumeric

### OrderInquiryProvideInfoAction
**Description:** This type represents a \`provide info\` action available during an inquiry. This action is shown when the system or participant has requested additional information (e.g., tracking details, signature confirmation) from a participant.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A stable, machine-readable identifier for the \`provide info\` inquiry action (e.g., \`PROVIDE\_INFO\`).
- **displayText** (String!)
  - The human-readable text for the 'provide info' inquiry action (e.g., \`Upload Signature\`, \`Provide Tracking Info\`). \*\*Maximum length\*\*: 100 characters \*\*Format\*\*: Alphanumeric

### OrderInquiryReferralAction
**Description:** This type represents the \`referral action\` available during an inquiry. This action becomes available when the participant is eligible to escalate the inquiry for eBay's help or further review, and includes the list of valid referral reasons that may be selected by the user.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A stable, machine-readable identifier for the \`referral\` inquiry action (e.g., \`REFER\_INQUIRY\_TO\_EBAY\`).
- **displayText** (String!)
  - The human-readable text for the \`referral\` inquiry action. \*\*Maximum length\*\*: 100 characters \*\*Format\*\*: Alphanumeric
- **referralReasons** ([OrderInquiryReferralReason!]!)
  - This array returns a list of referral reasons available for the actor when submitting a referral request. Each reason is represented as a type in the \*\*OrderInquiryReferralReason\*\* union. \*\*Note:\*\* This field is required and will always contain at least one valid reason when a referral action is available.

### OrderInquiryRefundAction
**Description:** This type represents a 'refund' action available during an inquiry.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A stable, machine-readable identifier for the \`refund\` inquiry action (e.g., \`REFUND\`).
- **displayText** (String!)
  - The human-readable text for the \`refund\` inquiry action. \*\*Maximum length\*\*: 100 characters \*\*Format\*\*: Alphanumeric

### OrderInquiryClosed
**Description:** This type represents an inquiry that is closed for the participant.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A stable, machine-readable identifier for the 'closed' inquiry status. In this case, \`CLOSED\`.
- **displayText** (String!)
  - The human-readable text of the \`closed\` inquiry status. \*\*Maximum length\*\*: 100 characters \*\*Format\*\*: Alphanumeric

### OrderInquiryOpen
**Description:** This type represents an inquiry that is open and awaiting responder action.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A stable, machine-readable identifier for the 'open' inquiry status. In this case, \`OPEN\`.
- **displayText** (String!)
  - The human-readable text of the \`open\` inquiry status. \*\*Maximum length\*\*: 100 characters \*\*Format\*\*: Alphanumeric

### RefundEstimate
**Description:** This type provides an estimation breakdown of a refund for both the buyer and seller.
**Type:** GraphQLObjectType

**Properties:**
- **buyerRefundEstimateBreakdown** (BuyerRefundEstimateBreakdown!)
  - This object returns an itemized breakdown of the refund estimate for buyer. This information can be requested only if the user context is of buyer on the contract.
- **sellerRefundEstimateBreakdown** (SellerRefundEstimateBreakdown!)
  - This object returns an itemized breakdown of the refund estimate for seller. This information can only be requested if the user context is of seller on the contract.

### BuyerRefundEstimateBreakdown
**Description:** This type represents a buyer's refund estimation breakdown.
**Type:** GraphQLObjectType

**Properties:**
- **estimatedWithholdings** ([RefundWithholding!]!)
  - This array returns a list of withholdings that can be applied on the contract. If this array is empty, no additional withholdings have been applied to the refund estimation.
- **netEstimatedRefundAmount** (AmountSet!)
  - The estimated net refund amount. This value is determined by subtracting the \*\*totalEstimatedWithholdingAmount\*\* from the \*\*totalEstimatedRefundAmount\*\*.
- **refundPriceLines** ([PriceLineRollup!]!)
  - This array returns a list of pricelines that are being refunded.
- **totalEstimatedRefundAmount** (AmountSet!)
  - The estimated total monetary amount of the refund.
- **totalEstimatedWithholdingAmount** (AmountSet)
  - The estimated total withholding amount, if there are any withholdings on the refund. \*\*Note\*\*: If this object is returned \`null\`, no withholding amount has been applied for refund estimation.

### SellerRefundEstimateBreakdown
**Description:** This type represents a seller's refund estimation breakdown and provides details about refund estimate for sellers including details like what seller gets charged on the contract. \*\*Note\*\*: This type provides only the seller pricelines and refund amount that seller received as part contract fulfillment, and doesn't include pricelines such as \`TAX\` or \`SERVICE\_FEE\` which seller didn't receive in the first place.
**Type:** GraphQLObjectType

**Properties:**
- **estimatedCredits** ([SellerRefundCredit!])
  - This array returns a list of all types of credits applied for the seller, including: - \*\*Total Fee credits\*\*: In some instances, marketplaces fees charged are credited to the seller. - \*\*Total Donation credits\*\*: In some instances, the donation of sale proceeds are credited back with the refund. \*\*Note\*\*: Donations are not always credited back if the proceeds was already donated. If this array is returned \`null\`, no additional credits are applied to the refund.
- **estimatedWithholdings** ([RefundWithholding!]!)
  - This array returns a list of withholdings that can be applied on the contract by the seller. If this array is empty, no additional withholdings have been applied on refund.
- **netEstimatedRefundAmount** (AmountSet!)
  - The estimated net refund amount. This value is derived using following formula: \*\*netEstimatedRefundAmount\*\* = \*\*totalEstimatedRefundAmount\*\* - \*\*totalEstimatedWithholdingAmount\*\* - \*\*estimatedCredits\*\*
- **refundPriceLines** ([PriceLineRollup!]!)
  - This array returns a list of pricelines that are being refunded by seller.
- **totalEstimatedCreditAmount** (AmountSet)
  - The total amount estimated as credits to the seller. \*\*Note:\*\* If this object is returned \`null\`, no additional credits been applied for refund estimation.
- **totalEstimatedRefundAmount** (AmountSet!)
  - The estimated total monetary refund amount for the seller.
- **totalEstimatedWithholdingAmount** (AmountSet)
  - The total estimated withholding amount, if there are any withholdings applied on the refund by the seller. \*\*Note:\*\* If this object is returned \`null\`, no withholding amount has been applied for refund estimation.

### DonationItem
**Description:** This type represents a snapshot of the item associated with the donation.
**Type:** GraphQLObjectType

**Properties:**
- **nonProfitOrganization** (NonProfitOrganization!)
  - The details of the non-profit organization.
- **organizationName** (String!)
  - The name of the organization receiving the donation.
- **sellerDomicile** (DisplayableId!)
  - The legal residence or principal place of business of the seller, e.g., US.

### NonProfitOrganization
**Description:** This type represents a non-profit organization.
**Type:** GraphQLObjectType

**Properties:**
- **id** (ID!)
  - The unique identifier of the non-profit organization.

### ShippingLabelItem
**Description:** This type is used to provide information about the shipping label that was created.
**Type:** GraphQLObjectType

**Properties:**
- **carrier** (String!)
  - The shipping carrier associated with this shipping label (e.g., USPS, FedEx, UPS, DHL).
- **shippingService** (String)
  - The unique identifier of the shipping service option being used for shipping.
- **trackingNumber** (String!)
  - The tracking number assigned to this shipment.

### LineItemAddOnService
**Description:** This type provides optional add-on features or services associated with an order line item.
**Type:** GraphQLObjectType

**Properties:**
- **authenticityVerification** (AuthenticityVerificationAddOnService)
  - This field is returned when a third-party authenticator performs the authentication verification inspection add-on service on the order line item. The returned value indicates if the item passed or failed the inspection.
- **eBayVault** (EbayVaultAddOnService)
  - This field provides information about the selected eBay vault program for the order. This is returned only for those items that are eligible for the eBay Vault add-on service.
- **exports** (ExportsAddOnService)
  - This field provides export details for orders using an international shipping add-on service.
- **fulfillment** (FulfillmentAddOnService)
  - This field provides details about an order line item handled by fulfillment add-on service.
- **globalShipping** (GlobalShippingAddOnService)
  - This field provides information about the Global Shipping Program.
- **motorPurchase** (MotorPurchaseAddOnService)
  - This field provides details for a line item that uses the motor purchase add-on service.

### AuthenticityVerificationAddOnService
**Description:** This type contains details about the authentication verification inspection addon service associated with an order line item.
**Type:** GraphQLObjectType

**Properties:**
- **serviceCost** (AmountSet)
  - The cost of the authenticity verification service. This field may be null if it is not available.
- **verificationState** (AuthenticityVerificationState)
  - The current state of authenticity verification. This field may be null if not started.

### PurchaseTags
**Description:** This type shows any custom tags added by the seller to the purchase contract. \*\*Note\*\*: Custom tags can only be added by seller.
**Type:** GraphQLObjectType

**Properties:**
- **sellerAcknowledged** (Boolean)
  - This boolean field indicates whether or not the seller has acknowledged the custom tags.
- **tags** ([String!])
  - This array shows the list of custom tags that have been added to the purchase contract. Up to five custom tags may be added per purchase contract.

### OrderLineItemTotals
**Description:** This type provides information about monetary totals associated with an order line item, with each field representing a distinct financial value expressed as an AmountSet type which supports multiple currencies.
**Type:** GraphQLObjectType

**Properties:**
- **lineItemTotal** (AmountSet!)
  - The total cost of all items.
- **packageHandlingTotal** (AmountSet!)
  - The total fee associated with processing, packing, and preparing a line item for shipment, separate from the actual shipping cost.
- **shippingTotal** (AmountSet!)
  - The total cost of delivering the purchased items from the seller to the customer's specified address.
- **subtotal** (AmountSet!)
  - The total cost of all items before any additional charges or discounts are applied.
- **taxTotal** (AmountSet!)
  - The total amount of tax applied to this line item. It is typically calculated based on tax laws related to the buyer’s shipping address.

### LinkedLineItem
**Description:** This type represents linked line item (a wrapper for reuse across entities).
**Type:** GraphQLObjectType

**Properties:**
- **linkedLineItem** (LineItemReference)
  - Linked line item detail information; may be null if data is not available.
- **linkedOrderId** (String!)
  - The order ID of the linked line item.
- **linkedOrderLineItemId** (String!)
  - The line item ID of the linked line item.

### PriceDiscount
**Description:** This type represents a price discount and contains the amount and its source.
**Type:** GraphQLObjectType

**Properties:**
- **amount** (AmountSet!)
  - The amount of the discount.
- **source** (PriceDiscountSource!)
  - The source of the adjustment.

### PriceDiscountSource
**Description:** This type indicates the source of the price discount.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String)
  - An optional discount code for the source.
- **domain** (String!)
  - The domain of the source.
- **message** (String)
  - An optional message from the source.
- **name** (String!)
  - The name of the source.
- **type** (String!)
  - The type of the source.

### OrderReward
**Description:** This type represents the reward information associated with an order.
**Type:** GraphQLObjectType

**Properties:**
- **bonuses** ([OrderRewardBonus!])
  - The list of bonuses included in this reward.
- **expiringAt** (DateTime)
  - The expiration date and time of the reward.
- **message** (String)
  - Additional message or note related to the reward.
- **programName** (String)
  - The name of the reward program.
- **programType** (String)
  - The type or category of the reward program.

### OrderRewardBonus
**Description:** This type represents the details of a reward bonus.
**Type:** GraphQLObjectType

**Properties:**
- **amount** (AmountSet!)
  - The monetary amount associated with this reward bonus.
- **description** (String)
  - The description or details of the reward bonus.

### OrderTotals
**Description:** This type defines a collection of monetary totals associated with an order. Each field represents a distinct financial value and is expressed as an \*\*AmountSet\*\* to support multiple currencies.
**Type:** GraphQLObjectType

**Properties:**
- **buyerRunningTotal** (AmountSet)
  - The buyer's current running total for the order. This amount reflects the cumulative cost the buyer has paid, accounting for any discounts, taxes, shipping updates, or partial refunds known at the time of calculation. It may change as further adjustments are applied.
- **orderTotal** (AmountSet!)
  - The complete cost of the order before any payments are made.
- **packageHandlingTotal** (AmountSet!)
  - The total fee associated with processing, packing, and preparing an order for shipment, separate from the actual shipping cost.
- **sellerRunningTotal** (AmountSet)
  - The seller's current running total for the order. This represents the seller's in-progress net proceeds — the amount expected to be received after deducting applicable eBay fees, taxes collected on the seller's behalf, discounts, and refunds known at the time of calculation. This value may continue to update as additional adjustments are applied.
- **shippingTotal** (AmountSet!)
  - The total cost of delivering the purchased items from the seller to the customer's specified address.
- **subtotal** (AmountSet!)
  - The total cost of all items in a customer’s shopping cart before any additional charges or discounts are applied
- **taxTotal** (AmountSet!)
  - The total amount of tax applied to an order. It is typically calculated based on tax laws related to the buyer’s shipping address.

### ItemCommitmentPaymentOption
**Description:** This type is used to shows the payment methods available to the buyer for this item commitment.
**Type:** GraphQLObjectType

**Properties:**
- **paymentMethod** (DisplayableId)
  - This object shows the enumeration value and user-friendly description of the available payment method.

### ItemCommitmentTotals
**Description:** This type is used to shows total sales price of the eBay item associated with the item commitment, including any deposit for a motor vehicle. These monetary values will be shown in multiple currencies if the buyer or seller use a different currency than the default currency of the eBay marketplace.
**Type:** GraphQLObjectType

**Properties:**
- **committedTotal** (AmountSet!)
  - The total sales price for the item. Multiple values/currencies will be shown if the buyer or seller use a different currency than the default currency of the eBay marketplace.
- **deposit** (AmountSet)
  - This object will show the amount of any deposit that the buyer is required to make as part of a motor vehicle down payment. Multiple values/currencies will be shown if the buyer or seller use a different currency than the default currency of the eBay marketplace.

### Pagination
**Description:** This type contains the string values that can be used in the \*\*pageCursor\*\* field of a query to retrieve the next or previous page of results if there are multiple pages of results.
**Type:** GraphQLObjectType

**Properties:**
- **nextCursor** (String)
  - The string value in this field can be used in the \*\*pageCursor\*\* field of a query to retrieve the next page of results if there are additional pages of results for the currently configured query. \*\*Note\*\*: This field is returned as empty if there is not an additional page of results.
- **previousCursor** (String)
  - The string value in this field can be used in the \*\*pageCursor\*\* field of a query to retrieve the previous page of results if there is a previous page of results for the currently configured query. \*\*Note\*\*: This field is returned as empty if there is no previous page of results.

### ItemCommitmentsInput
**Description:** This input type is used when retrieving item commitments for an authenticated seller or buyer. The \*\*itemCommitmentsFirstPage\*\* object is used for an initial search of item commitments, and includes parameters to retrieve item commitments in specific states and/or from a specific listing, as well as a field to control the number of item commitments retrieved per page of results. The \*\*itemCommitmentsPage\*\* object is used for a subsequent search of item commitments, and allows the user to retrieve the next or previous page of results if the query produced multiple pages of results. \*\*Note\*\*: Either the \*\*itemCommitmentsFirstPage\*\* object or the \*\*itemCommitmentsPage\*\* object may be used, but not both.
**Type:** GraphQLInputObjectType

**Properties:**
- **itemCommitmentsFirstPage** (ItemCommitmentsFirstPageInput)
  - This object is used for the initial query of item commitments, and includes parameters to retrieve item commitments in specific states and/or from a specific listing, as well as a field to control the number of item commitments retrieved per page of results.
- **itemCommitmentsPage** (PageInfoInput)
  - This object is used for a subsequent search of item commitments, and allows the user to retrieve the next or previous page of results if the query produced multiple pages of results.

### ItemCommitmentsFirstPageInput
**Description:** This type is used in a \*\*sellerItemCommitments\*\* or \*\*buyerItemCommitments\*\* query to provide one or more filters and to control the amount of item commitments that are returned per page of results.
**Type:** GraphQLInputObjectType

**Properties:**
- **filter** (ItemCommitmentsFirstFilterInput!)
  - This object is used to provide one or more filters for the query, including a \*\*listingId\*\* filter, a date range filter, and filters based on states. Sort parameters are also available.
- **maxPageSize** (Int!)
  - This field is used to control the amount of item commitments that are returned per page of results. If this field is not used, up to 200 item commitments are returned per page. \*\*Minimum value\*\*: 1 \*\*Maximum value\*\*: 200

### ItemCommitmentsFirstFilterInput
**Description:** This type is used to provide one or more filters for the query, including a \*\*listingId\*\* filter, a date range filter, and filters based on states. Sort parameters are also available.
**Type:** GraphQLInputObjectType

**Properties:**
- **dateRange** (ItemCommitmentsDateRangeInput!)
  - This object is used to set a date range filter. Only item commitments created or updated within this date range are returned.
- **filter** (ItemCommitmentsFilterInput!)
  - This object includes the filters that can be used for an \*\*itemCommitments\*\* query. The \*\*listingId\*\* field can be used to retrieve item commitment(s) for a specific listing, or one or more of the boolean fields can be used to retrieve item commitments in certain states. \*\*Note\*\*: The default value for the \*\*includeActive\*\* boolean field is \`true\`, but the default value for all other boolean fields is \`false\`.
- **sort** (ItemCommitmentsSortInput!)
  - This object is used to control how item commitments are sorted in the query response.

### ItemCommitmentsDateRangeInput
**Description:** This type is used when the \*\*dateRange\*\* filter is used in a query. A starting and ending time sets the date range, and all item commitments either created or updated within this time range are retrieved.
**Type:** GraphQLInputObjectType

**Properties:**
- **dateTimeRange** (DateTimeRangeInput!)
  - This object is used to set the time range. All item commitments either created or updated within this time range are retrieved.
- **dateType** (ItemCommitmentsDateType!)
  - The enumeration value here controls whether retrieved item commitments are item commitments that were created within this date range or updated within this date range. The supported values are: - \`CREATED\` - \`UPDATED\`

### DateTimeRangeInput
**Description:** This type is used to set the time range if a \*\*dateRange\*\* filter is used. All item commitments either created or updated within this time range are retrieved.
**Type:** GraphQLInputObjectType

**Properties:**
- **endDateTime** (DateTime!)
  - An ISO 8601 standard timestamp, using UTC time zone. All item commitments created or updated on this or before this date, and after or on the date in the \*\*startDateTime\*\* field are retrieved. \*\*Note\*\*: This date must be a later date than the date in the \*\*startDateTime\*\* field or an error will occur. \*\*Format\*\*: YYYY-MM-DDTHH:MM:SSZ \*\*Example\*\*: 2025-12-16T14:30:00Z
- **startDateTime** (DateTime!)
  - An ISO 8601 standard timestamp, using UTC time zone. All item commitments created or updated on this or after this date, and before or on the date in the \*\*endDateTime\*\* field are retrieved. \*\*Note\*\*: This date must be an earlier date than the date in the \*\*endDateTime\*\* field or an error will occur. \*\*Format\*\*: YYYY-MM-DDTHH:MM:SSZ \*\*Example\*\*: 2025-12-12T14:30:00Z

### ItemCommitmentsFilterInput
**Description:** This input type includes the filters that can be used for an \*\*itemCommitments\*\* query. The \*\*listingId\*\* field can be used to retrieve item commitment(s) for a specific listing, or one or more of the boolean fields can be used to retrieve item commitments in certain states. \*\*Note\*\*: The default value for the \*\*includeActive\*\* boolean fields is \`true\`, but the default value for all other boolean fields is \`false\`.
**Type:** GraphQLInputObjectType

**Properties:**
- **includeAbandoned** (Boolean!)
  - Include this field and set to \`true\` to include abandoned item commitments in the output, or set to \`false\` (or omit field) to exclude abandoned item commitments. \*\*Default\*\*: false
- **includeActive** (Boolean!)
  - Include this field and set to \`true\` (or omit field) to include active item commitments in the output, or set to \`false\` to exclude active item commitments. \*\*Default\*\*: true
- **includeCancelled** (Boolean!)
  - Include this field and set to \`true\` to include cancelled item commitments in the output, or set to \`false\` (or omit field) to exclude cancelled item commitments. \*\*Default\*\*: false
- **includeCompleted** (Boolean!)
  - Include this field and set to \`true\` to include completed item commitments in the output, or set to \`false\` (or omit field) to exclude completed item commitments. \*\*Default\*\*: false
- **includeLocked** (Boolean!)
  - Include this field and set to \`true\` to include locked item commitments in the output, or set to \`false\` (or omit field) to exclude locked item commitments. \*\*Default\*\*: false
- **listingId** (ID)
  - Use this field to restrict results to item commitments that are associated with a specific eBay listing.

### ItemCommitmentsSortInput
**Description:** This type is used to control how item commitments are sorted in the query response.
**Type:** GraphQLInputObjectType

**Properties:**
- **sortField** (ItemCommitmentsSortField!)
  - The enumeration value here controls whether item commitments are sorted according to creation date or last update action. The supported values are: - CREATED\_AT - UPDATED\_AT \*\*Default\*\*: CREATED\_AT
- **sortOrder** (SortOrder!)
  - The enumeration value here controls whether item commitments are sorted in descending (most recent first) or ascending order. The supported values are: - DESC - ASC \*\*Default\*\*: DESC

### PageInfoInput
**Description:** This input type is used to provide pagination parameters. These parameters control the number of results returned and navigate through paginated data.
**Type:** GraphQLInputObjectType

**Properties:**
- **maxPageSize** (Int!)
  - The maximum number of items to return per page. Used to limit the size of result sets.
- **pageCursor** (String)
  - The cursor string for pagination, used to fetch the next or previous page of results.

### UserBenefitMembership
**Description:** This type is used to show details on a user's membership to an eBay program.
**Type:** GraphQLObjectType

**Properties:**
- **expiresAt** (DateTime!)
  - This timestamp indicates when the user's membership is scheduled to expire based on the current subscription period. \*\*Format\*\*: ISO 8601 date-time string (YYYY-MM-DDTHH:mm:ss.sssZ)
- **membershipMarketplace** (UserRegistrationMarketplace!)
  - The eBay marketplace where this membership is valid.
- **programType** (UserBenefitMembershipType!)
  - The enumerated value returned in this field identifies which specific benefit program the membership record represents.

### Orders
**Description:** This type provides order views for the authenticated user, and provides cursor-based pagination for both buyer and seller order lists. Cursors represent the query state for consistent paging even under concurrent updates.
**Type:** GraphQLObjectType

**Properties:**
- **buyerOrders** (PaginatedOrders!)
  - This array retrieves a list of orders for the current user as buyer. This array requires filters and pagination info in the input, and generates a runtime cursor representing the query state for subsequent pages.
- **sellerOrders** (PaginatedOrders!)
  - This array retrieves a list of orders for the current user as seller. This array requires filters and pagination info in the input, and generates a runtime cursor representing the query state for subsequent pages.

### PaginatedOrders
**Description:** This type represents a page of orders and includes a list of orders and pagination information.
**Type:** GraphQLObjectType

**Properties:**
- **orders** ([Order!]!)
  - The list of orders in the current page.
- **pagination** (Pagination!)
  - This object includes pagination information, including the runtime cursor and page availability.

### OrdersInput
**Description:** This type contains the input for order queries. Provide exactly one field, either \`ordersFirstPage\` or \`ordersPage\`, in each request.
**Type:** GraphQLInputObjectType

**Properties:**
- **ordersFirstPage** (OrdersFirstPageInput)
  - This field contains parameters for fetching the initial page of results.
- **ordersPage** (PageInfoInput)
  - This field contains parameters for fetching subsequent pages using a cursor. \*\*Note:\*\* The \*\*maxPageSize\*\* field in \*\*PageInfoInput\*\* must be between 1 and 100, inclusive.

### OrdersFirstPageInput
**Description:** This input type provides filtering and sorting parameters for the first page of an orders query. \*\*Note:\*\* The same filters and sort order are also used when returning subsequent pages using cursor-based pagination.
**Type:** GraphQLInputObjectType

**Properties:**
- **filter** (OrdersFirstFilterInput!)
  - Filters required to fetch the first page of orders.
- **maxPageSize** (Int!)
  - The number of orders to return in the first page. Must be between 1 and 200 inclusive.

### OrdersFirstFilterInput
**Description:** This input type provides filters for fetching the first page of orders, including the required date range (which includes the type of date) and sorting criteria, and also optional filters.
**Type:** GraphQLInputObjectType

**Properties:**
- **dateRange** (OrdersDateRangeInput!)
  - The date range within to filter returned orders.
- **filter** (OrdersFilterInput!)
  - Optional additional filters to refine the results.
- **sort** (OrdersSortInput!)
  - This object specifies sorting options for preferences for the returned order list.

### OrdersDateRangeInput
**Description:** This input type filters orders by a specific \*\*dateType\*\* within the specified date-time range.
**Type:** GraphQLInputObjectType

**Properties:**
- **dateTimeRange** (DateTimeRangeInput!)
  - The date-type range to apply to the delected \*\*dateType\*\*.
- **dateType** (OrdersDateType!)
  - The order type of date to filter, such as \`CONFIRMED\` or \`UPDATED\`.

### OrdersFilterInput
**Description:** This input type defines filters to narrow the orders returned by a search. Two kinds of filters are available: - State filters: Determines whether orders in a specific state are included (\`true\`) or excluded (\`false\`) from the results. - Attribute filters: Determines whether orders are filtered by funding or fulfillment status
**Type:** GraphQLInputObjectType

**Properties:**
- **fulfilled** (Boolean)
  - Filters orders by fulfillment status: - \`true\`: Include only fulfilled orders. - \`false\`: Include only unfulfilled orders. - \`null\`: Include both fulfilled and unfulfilled orders.
- **funded** (Boolean)
  - Filters orders by funding status: - \`true\`: Include only funded orders. - \`false\`: Include only unfunded orders. - \`null\`: Include both funded and unfunded orders.
- **includeAbandoned** (Boolean!)
  - Whether to include abandoned orders. \*\*Default:\*\* \`false\`.
- **includeCancelled** (Boolean!)
  - Whether to include canceled orders. \*\*Default:\*\* \`false\`.
- **includeConfirmed** (Boolean!)
  - Whether to include confirmed orders. \*\*Default:\*\* \`true\`.
- **includePlaced** (Boolean!)
  - Whether to include orders that have been placed but not yet confirmed. \*\*Default:\*\* \`false\`
- **listingId** (ID)
  - This filter restricts results to orders associated with a specific listing ID. When \`null\`, orders from all listings are included. Use this filter to fetch orders related to a single ID.

### OrdersSortInput
**Description:** This input type specifies how the list of orders should be sorted in the response.
**Type:** GraphQLInputObjectType

**Properties:**
- **sortField** (OrdersSortField!)
  - The field by which to sort the orders (e.g., CONFIRMED\_AT).
- **sortOrder** (SortOrder!)
  - The direction of sorting: ASC for ascending, DESC for descending.

### BusinessIdentityProfile
**Description:** This type provides a seller's business related information.
**Type:** GraphQLObjectType

**Properties:**
- **businessEmail** (String)
  - The email address of the business. \*\*Note:\*\* If the user requesting this data is not authorized to view this information, this field will return a null value.
- **businessName** (String)
  - The name of the business. \*\*Note:\*\* If the user requesting this data is not authorized to view this information, this field will return a null value.
- **businessPrimaryPhone** (Phone)
  - The primary telephone number of the business. \*\*Note:\*\* If the user requesting this data is not authorized to view this information, this field will return a null value.
- **businessProfileAddress** (ProfileAddress)
  - The physical address of the business. \*\*Note:\*\* If the user requesting this data is not authorized to view this information, this field will return a null value.

### BusinessStakeholder
**Description:** This type defines the legal contact stakeholder for the business account. This field always returns only the stakeholder designated as the business's \*\*legal contact\*\*. If no legal contact exists for the account, this field returns an empty list.
**Type:** GraphQLObjectType

**Properties:**
- **firstName** (String)
  - The first name of the legal contact of the business. \*\*Note:\*\* If the user requesting this data is not authorized to view this information, this field will return a null value.
- **lastName** (String)
  - The last name of the legal contact of the business. \*\*Note:\*\* If the user requesting this data is not authorized to view this information, this field will return a null value.
- **middleName** (String)
  - The middle name of the legal contact of the business, if provided. \*\*Note:\*\* If the user requesting this data is not authorized to view this information, this field will return a null value.

### IndividualIdentityProfile
**Description:** This type stores detailed personal information for the user for whom information is being returned. \*\*Note:\*\* If the user requesting this data is not authorized to view some of the requested information, those fields containing sensitive/confidential information will be masked or return null values.
**Type:** GraphQLObjectType

**Properties:**
- **email** (String)
  - The primary personal email address associated with the user. \*\*Note:\*\* If the user requesting this data is not authorized to view this information, this field will return a null value.
- **firstName** (String)
  - The first/given name of the user. \*\*Note:\*\* If the user requesting this data is not authorized to view this information, this field will return a null value.
- **lastName** (String)
  - The last/family name of the user. \*\*Note:\*\* If the user requesting this data is not authorized to view this information, this field will return a null value.
- **middleName** (String)
  - The middle name of the user, if provided. \*\*Note:\*\* If the user requesting this data is not authorized to view this information, this field will return a null value.
- **primaryPhone** (Phone)
  - The primary personal telephone number of the user. \*\*Note:\*\* If the user requesting this data is not authorized to view this information, this field will return a null value.
- **profileAddress** (ProfileAddress)
  - The address of the user that was provided during account registration. \*\*Note:\*\* If the user requesting this data is not authorized to view this information, this field will return a null value.

### PublicUserProfile
**Description:** This type defines a business seller's publicly visible profile information.
**Type:** GraphQLObjectType

**Properties:**
- **address** (ProfileAddress)
  - The physical address of the business account. \*\*Note:\*\* If the seller does not provide this information this field may return a null value.
- **businessName** (String)
  - The business/company name for the business account. \*\*Note:\*\* If the seller does not provide this information this field may return a null value.
- **email** (String)
  - The email address of the business account. \*\*Note:\*\* If the seller does not provide this information this field may return a null value.
- **fax** (String)
  - The fax number for the business account. \*\*Note:\*\* If the seller does not provide this information this field may return a null value.
- **firstName** (String)
  - The first/given name of the user associated with the business account. \*\*Note:\*\* If the seller does not provide this information this field may return a null value.
- **governmentIssuedIds** ([GovernmentIssuedId])
  - The list of public government-issued IDs associated with the business account. \*\*Note:\*\* If the \`governmentIssuedIds\` added by the seller are not publicly visible, this field may return a null value. Supported \`govtIssuedIdTypes\` include, but are not limited to, \*\*BRN\*\*, \*\*CRN\*\*, \*\*ABRN\*\*, etc.
- **lastName** (String)
  - The last/family name of the user associated with the business account. \*\*Note:\*\* If the seller does not provide this information this field may return a null value.
- **legalInvoiceProvided** (Boolean)
  - Indicates if the business account can provide legal invoices to buyers. \*\*Note:\*\* If the seller does not provide this information this field may return a null value.
- **phone** (Phone)
  - The telephone number for the business account. In the US, the area code (3 digits), the prefix (3 digits), the line number (4 digits), and phone extension (if specified by the user,) are returned in this field. The extension can be one or more digits. Non-breaking spaces are used as delimiters between these phone number components. \*\*Note:\*\* If the seller does not provide this information this field may return a null value. \*\*Maximum length:\*\* 128 characters is allocated for this field. However, eBay only validates the content of the field (i.e., only comprise integer values and delimiters), not its length.
- **termsAndConditions** (String)
  - The Terms and Conditions associated with the business account. \*\*Note:\*\* If the seller does not provide this information this field may return a null value.

### GovernmentIssuedId
**Description:** This type stores information related to government-issued IDs associated with the business and/or user for whom information is being returned.
**Type:** GraphQLObjectType

**Properties:**
- **idType** (String)
  - The type of government-issued ID (e.g., BRN, CRN, ABRN, etc.,) associated with the user for whom information is being returned.
- **idValue** (String)
  - The government ID number corresponding to the specified type of government-issued ID.

### SellerProfile
**Description:** This type stores seller-related profile information about the user. \*\*Note:\*\* If the user requesting this data is not authorized to view some of the requested information, those fields containing sensitive/confidential information will return null values.
**Type:** GraphQLObjectType

**Properties:**
- **charityAffiliation** (CharityAffiliation)
  - This object returns information related to the seller's direct charity affiliation, if applicable. \*\*Note\*\*: This object will return \`null\` if the seller does not have a direct charity affiliation.
- **user** (User!)
  - This object returns seller-related profile information about the user.

### CharityAffiliation
**Description:** This type represents information related to the seller's charity affiliation, if applicable.
**Type:** GraphQLObjectType

**Properties:**
- **charityOrganization** (CharityOrganization!)
  - The unique identifier of the nonprofit organization associated with the seller's account. Once a nonprofit organization becomes an eBay for Charity organization, eBay creates and assigns this ID to the nonprofit organization.

### CharityOrganization
**Description:** This type represents the details of a charity organization, such as its name, identifier, and status.
**Type:** GraphQLObjectType

**Properties:**
- **charityOrganizationId** (ID!)
  - The unique identifier of the charitable organization.
- **logoImageUrl** (HttpOrHttpsUrl!)
  - The URL of the charity logo image.
- **missionStatement** (String!)
  - The untranslated (non-localized) mission statement of the charitable organization expressing its goal and objectives. \*\*Maximum length\*\*: 2044
- **name** (String!)
  - The untranslated (non-localized) name of the charitable organization. \*\*Maximum length\*\*: 800 characters
- **status** (CharityStatus!)
  - The current operational status of the charitable organization, such as whether it is active or inactive. Valid values include: \`ACTIVE\`, \`INACTIVE\`, and \`NO\_LONGER\_ACTIVE\`.

### UserAccountTypeBusiness
**Description:** This type represents an account owned by a business entity. This indicates that the user's account is a business account.
**Type:** GraphQLObjectType

**Properties:**
- **displayName** (String)
  - The human-readable label for the user's account type. In this case, this field will return \`Business\`. \*\*Note\*\*: This value is for display purposes only.

### UserAccountTypeIndividual
**Description:** This type represents an account owned by an individual user. This indicates that the user's account is an individual account.
**Type:** GraphQLObjectType

**Properties:**
- **displayName** (String)
  - The human-readable label for the user's account type. In this case, this field will return \`Individual\`. \*\*Note\*\*: This value is for display purposes only.

### BuyerBiddingSummary
**Description:** This type provides bidding details of a buyer within the last 30 days.
**Type:** GraphQLObjectType

**Properties:**
- **bidsWithSellerPercentage** (Percentage!)
  - The buyer's bidding activity with a specific seller, expressed as a percentage of their total bidding activity. This value will be rounded to the nearest whole number and will always have a non-null value. If the buyer has not placed any bids with any sellers, or has not bid on items from the given seller within the last 30 days, this field will be set to \`0\`.
- **itemBids** ([BuyerBidDetailsOnItem!]!)
  - This array shows details of the user bids at listing level and includes bid count, listing category, and most recent bid. This array is returned as empty if the user has placed no bids.
- **retractedBidCount** (Int!)
  - This integer value indicates the total number of bids that the user has retracted across all items. Returns 0 if there are no retracted bids by the buyer.
- **totalBidCount** (Int!)
  - This integer value indicates the total number of bids (from any and all eBay sellers) that the user has placed. Returns 0 if the buyer has placed no bids.
- **uniqueListingCategoryBidCount** (Int!)
  - This integer value indicates the total number of bids the user has placed for unique listing categories. Returns 0 if the buyer has placed no bids.
- **uniqueSellerBidCount** (Int!)
  - This integer value indicates the total number of bids the user has placed with unique sellers. Returns 0 if the buyer has placed no bids.

### BuyerBidDetailsOnItem
**Description:** This type stores bidding history information for a specific bidder for an auction item.
**Type:** GraphQLObjectType

**Properties:**
- **bidCount** (Int!)
  - The total number of bids the user has placed on the auction item. Returns 0 if the buyer has placed no bids.
- **category** (Category!)
  - This is the unique identifier of the eBay category in which the auction item is listed.
- **mostRecentBidAt** (DateTime!)
  - This timestamp indicates the date/time at which the user placed their most recent bid on the auction item. \*\*Format:\*\* \`YYYY-MM-DDTHH:MM:SS.SSSZ\`

### Category
**Description:** This type defines information about a specific category within the marketplace, including identifiers and hierarchical structure.
**Type:** GraphQLObjectType

**Properties:**
- **ancestors** ([Category!]!)
  - This array returns a list of one or more categories that are the ancestors of the current category. The list identifies the category's ancestry as a sequence of parent nodes, from the current node's immediate parent to the root node of the category tree. The first item in the array is the immediate ancestor, while the last element in list is the root category. \*\*Note:\*\* If this category is the root, the list will be empty.
- **categoryId** (ID!)
  - The unique identifier of the eBay category.
- **level** (Int!)
  - The level of the category in the hierarchy of the category. \*\*Note\*\*: Root categories are always at level \`0\`.
- **name** (String!)
  - The display name of the category. \*\*Note:\*\* This name is not localized.
- **id** (ID!)
  - Category Id (replaced by categoryId)
- **children** ([Category!]!)
  - This array returns a list of one or more categories that are the immediate children of the current category, as well as their children, recursively down the tree node. This array is returned in no guaranteed order. \*\*Note:\*\* If this category has no children, this list will be empty.
- **leafCategory** (Boolean!)
  - This boolean indicates whether or not the category is a leaf category. If \`true\`, this category is a leaf category in which items may be listed. If \`false\`, this category is not a leaf category.
- **parent** (Category)
  - This object returns information about this category's parent category, if applicable. If the category has no parent, this object will be returned null.

### ItemOfferOverview
**Description:** This type defines the fields that detail and summarize offer negotiation information specific to an item. Each item may have one or more negotiation threads, and each negotiation consists of multiple offers exchanged between participants. This entity provides both a summary and detailed history of those negotiations and includes information such as the total number of offers across all negotiations and the last accepted offer amount for the item.
**Type:** GraphQLObjectType

**Properties:**
- **negotiationCount** (Int!)
  - This field specifies the total number of unique negotiations for this item. \*\*Note\*\*: This count is computed at the item level and is not affected by the role of the querying user (buyer or seller).

### ItemSellerProduct
**Description:** This type is used to provide a Global Trade Item Number (GTIN) or an eBay product ID (ePID) for a product. It is also used to provide the unique traits of a variation within a multiple-SKU listing.
**Type:** GraphQLObjectType

**Properties:**
- **productIdentifiers** (ListingProductIdentifiers)
  - This object is used to display a Global Trade Item Number (GTIN) or an eBay product ID (ePID) for a product. If an eBay catalog product is found that maps to a GTIN or an ePID, product details of that eBay catalog product will be used to populate the listing. The product details in a catalog product include product title, product description, aspects, eBay leaf category, and stock photo.
- **traits** ([NameValuePair!])
  - This array of name-value pairs identify a variation's unique combination of trait values. For example, if a particular variation was the \`Red, Large\` version of the product, \`Color\` would be one of the name values with its corresponding value value being \`Red\`, and the other name value would be \`Size\` with it corresponding value value being \`Large\`.

### ListingProductIdentifiers
**Description:** This type shows any Global Trade Item Number (GTIN) values and/or an eBay Product ID (ePID) that is associated with an item. When creating or revising a listing, a GTIN or an ePID value can be provided for a product, and if the identifier is matched to an eBay catalog product, the product title, product description, item specifics, and stock photo defined for that product will be used in the resultant listing. A seller leveraging an eBay catalog product can lead to improved listing quality, discoverability, and streamlined listing creation.
**Type:** GraphQLObjectType

**Properties:**
- **ebayProduct** (Product)
  - The unique identifier of an eBay catalog product. If this field is provided, the title, description, item specifics, and stock photo defined for that eBay product will be used in the resultant listing, overriding the seller provided information. The \[search\](https://developer.ebay.com/api-docs/commerce/catalog/resources/product\_summary/methods/search) method of the \*\*Catalog API\*\* can be used to search for eBay catalog products and get their IDs.
- **globalIdentifiers** (ListingGlobalProductIdentifiers)
  - This object will show any UPC, EAN, or ISBN value for a product. One or more of these values may be explicitly specified by the seller, or they may be picked up from the eBay catalog product if one is used for the item.
- **includeEbayProductDetails** (Boolean)
  - This boolean indicates whether or not an eBay catalog product is leveraged to prefill a listing with that catalog product's details, including product title, product description, item specifics, and stock photo.

### Product
**Description:** This type defines the details of a specific catalog product such as its title, identifier, product aspects, recommended category, and links to images of the product.
**Type:** GraphQLObjectType

**Properties:**
- **epid** (Epid)
  - The unique identifier of an eBay catalog product. An ePID value can be used in eBay listing APIs to prefill a listing with product title, product description, product aspects, stock photo(s), and eBay category.
- **id** (ID!)
  - The unique identifier of an eBay catalog product. An ePID value can be used in eBay listing APIs to prefill a listing with product title, product description, product aspects, stock photo(s), and eBay category.
- **aspects** ([ProductAspect!]!)
  - This array returns a list of product aspects and values associated with this catalog product.
- **category** (Category!)
  - This object returns information about the leaf category for which eBay recommends to list this product, based on previous listings of similar products.
- **imageUrls** ([String!])
  - This array returns a list of one or more image URLs associated with this catalog product.
- **productId** (ID!)
  - The eBay product identifier (ePID) of the product.
- **title** (String!)
  - The title of the catalog product.

### ProductAspect
**Description:** This type defines the product aspect name/value pair(s) associated with a product.
**Type:** GraphQLObjectType

**Properties:**
- **aspectValues** ([String!]!)
  - A list of valid values associated with the product aspect (for example: \`Red\`, \`Green\`, and \`Blue\`).
- **displayName** (String!)
  - The name of the product aspect, localized for the specified marketplace (for example: \`Color\`).

### ListingGlobalProductIdentifiers
**Description:** This type is used to display a Global Trade Item Number (GTIN) for the item. A GTIN is a globally unique product identifier and includes UPCs, EANs, and ISBNs.
**Type:** GraphQLObjectType

**Properties:**
- **ean** (ID)
  - The European Article Number (EAN) identifier associated with the product, if any. An EAN is a 13-digit barcode standard used internationally outside of the US and Canada for retail product identification.
- **isbn** (ID)
  - The International Standard Book Number (ISBN) identifier associated with the product, if any. An ISBN is a 13-digit (modern format) or 10-digit (old format) barcode standard used internationally for book identification.
- **upc** (ID)
  - The Universal Product Code (UPC) identifier associated with the product, if any. A UPC is a 12-digit barcode standard used primarily in North America for retail product identification.

### NameValuePair
**Description:** This type is used to express name-value pairs for entities that have one name and one value. An example of an array that uses this type is the traits array which define the unique traits of SKUs within a multiple-SKU listing.
**Type:** GraphQLObjectType

**Properties:**
- **name** (String!)
  - The name of the entity, such as an aspect name.
- **value** (String!)
  - The value of the entity, such as an aspect value.

### ItemTerms
**Description:** This type is used to display quantity and pricing information for a purchasable item. All SKUs within a multiple-SKU listing must have their own quantity and price values. All SKUs may have the same price, but prices also may vary by SKU. This type is also used to provide an eco-participation fee if applicable for the item.
**Type:** GraphQLObjectType

**Properties:**
- **availability** (ListingItemAvailability)
  - This object displays the available quantity for a purchasable item. \*\*Note\*\*: This will only be null if an error has occurred.
- **extendedProducerResponsibility** (ExtendedProducerResponsibility)
  - This object displays an eco-participation fee for an item. An eco-participation fee is a mandatory charge designed to fund the recycling and proper disposal of certain products at the end of their lifecycle. Eco-participation fees are one part of the Extended Producer Responsibility regulation enforced in EU countries.
- **pricingTerms** (ListingItemPricingTerms)
  - This object displays price data for the item, including the price for a fixed price item or the \*Buy it Now\* price for an auction item. Other price fields include auction starting bid price, auction reserve price, and other settings related to discount pricing features. \*\*Note\*\*: Each item within a multiple-SKU listing can have its own price, allowing for different pricing based on traits (e.g., larger sizes might cost more than smaller ones). \*\*Note\*\*: This will only be null if an error has occurred. Please see the errors array for more details.

### ListingItemAvailability
**Description:** This type is used to display the available quantity and quantity sold for a purchasable item.
**Type:** GraphQLObjectType

**Properties:**
- **quantityAvailable** (Int)
  - The quantity available for an item. For auction listings, this value will always be 1. For a multiple-SKU listing, each item variation can have its own quantity value, allowing sellers to manage inventory for each variation independently. \*\*Note\*\*: For a multiple-SKU listing, the quantity for an item variation may be 0 if the SKU is temporarily out of stock, but a seller wishes to retain the variation and restock inventory at a later time. \*\*Note\*\*: This should not be null unless an error has occurred.
- **quantitySold** (Int)
  - The quantity of the item sold during the duration of the listing. \*\*Note\*\*: This should not be null unless an error has occurred.

### ExtendedProducerResponsibility
**Description:** This type is used to indicate an eco-participation fee for item(s) in a listing. An eco-participation fee is a mandatory charge designed to fund the recycling and proper disposal of certain products at the end of their lifecycle. Eco-participation fees are one part of the Extended Producer Responsibility regulation enforced in EU countries.
**Type:** GraphQLObjectType

**Properties:**
- **listingEcoParticipationFee** (ConvertedAmount)
  - This is the fee paid for new items to the eco-organization (for example, eco-organisme in France). It is a contribution to the financing of the disposal of the item responsibly.

### ListingItemPricingTerms
**Description:** This type is used to display price data for an item in a listing, including the price for a fixed price listing or the 'Buy it Now' price for an auction listing. Other price fields include auction starting bid price, auction reserve price, and other settings related to discount pricing features.
**Type:** GraphQLObjectType

**Properties:**
- **auctionPrice** (ListingItemAuctionPrice)
  - This object provides auction-specific price settings including starting bid price and reserve price (if set). This object does not apply for multi-sku listings.
- **fixedPrice** (ConvertedAmount)
  - This field shows the price of a fixed price item or the 'Buy it Now' price for an auction listing. This field is mandatory for fixed price listings. The 'Buy it Now' option is disabled for an auction listing as soon as that listing has a qualifying bid. The price will be in the default currency for the marketplace for this listing.
- **marketingPrice** (ListingItemMarketingPrice)
  - This object provides pricing and other settings related to the Minimum Advertised Price, Strikethrough Pricing, or eBay Outlet features. All three of these features are restricted and sellers must qualify to use them.

### ListingItemAuctionPrice
**Description:** This type is used to display auction-specific price settings for auction listings. Not applicable for multiple-SKU listings.
**Type:** GraphQLObjectType

**Properties:**
- **reservePrice** (ConvertedAmount)
  - This field shows the lowest price at which the seller is willing to sell an item in an auction listing. A small fee is charged to use this feature. If the \*\*reservePrice\*\* field value is not met or surpassed during bidding, the auction will end without a winning bidder. This price must be higher than the \*\*startingBidPrice\*\*. The price will be in the default currency for the marketplace for this listing.
- **startingBidPrice** (ConvertedAmount)
  - This field is mandatory for auction listings and sets the starting bid amount. The first bid must meet or exceed this value or it will be rejected. The price will be in the default currency for the marketplace for this listing.

### ListingItemMarketingPrice
**Description:** This type provides pricing and other settings related to the Minimum Advertised Price, Strikethrough Pricing, or eBay Outlet features. All three of these features are restricted and sellers must qualify to use them.
**Type:** GraphQLObjectType

**Properties:**
- **madeForOutletComparisonPrice** (ConvertedAmount)
  - This object displays the \*\*Made for Outlet\*\* comparison price for a listing, and can only be used if the listing will be displayed on an eBay Outlet page. This is a restricted feature that sellers must qualify to use.
- **minimumAdvertisedPrice** (ConvertedAmount)
  - This object displays the Minimum Advertised Price (MAP) for a listing. MAP is an agreement between suppliers (or manufacturers (OEM)) and the retailers (sellers) stipulating the lowest price a listing is allowed to be advertised at. Sellers can offer prices below MAP by means of other discounts. This only applies to fixed price listings and auction listings with the 'Buy It Now' option. This is a restricted feature that sellers must qualify to use.
- **minimumAdvertisedPriceExposure** (ListingMinimumAdvertisedPriceExposure)
  - This field is only applicable for the Minimum Advertised Price feature, and indicates whether the discounted price is shown to buyers prior to checkout by the buyer clicking on a link on the View Item page, or the discounted price is shown just prior to checkout when the buyer has clicked the Buy button.
- **originalRetailPrice** (ConvertedAmount)
  - This price must be provided if a qualified seller is using the Strikethrough Price feature. The \*\*originalRetailPrice\*\* value is the actual retail price set by the manufacturer (OEM). The price in this field should always be more than the price specified in the \*\*fixedPrice\*\* field.
- **soldOffEbay** (Boolean)
  - This field is only applicable for the Strikethrough Price feature, and is used to indicate whether or not the same item was being sold on another e-commerce site at the manufacturer suggested (OEM) retail price. If the Strikethrough Price feature is being used, either this field or the \*\*soldOnEbay\*\* field must be included and set to \`true\`, and it is acceptable for them both to be included and set to \`true\`.
- **soldOnEbay** (Boolean)
  - This field is only applicable for the Strikethrough Price feature, and is used to indicate whether or not the same item was being sold on an eBay marketplace at the manufacturer suggested (OEM) retail price. If the Strikethrough Price feature is being used, either this field or the \*\*soldOffEbay\*\* field must be included and set to \`true\`, and it is acceptable for them both to be included and set to \`true\`.

### UserNote
**Description:** This type represents a user's personal note on an item or order line item. User notes are private to the user and can be associated with specific items or order line items.
**Type:** GraphQLObjectType

**Properties:**
- **note** (String!)
  - The text content of the user note. This content usually contains the user's personal annotation about the item or order line item. \*\*Maximum length\*\*: 255 characters
- **orderLineItemId** (ID)
  - The unique identifier of the order line item for which the user note is attached.

### UnansweredQuestions
**Description:** This type is used to specify the number of unanswered questions that a seller has concerning a listing.
**Type:** GraphQLObjectType

**Properties:**
- **count** (Int!)
  - The integer value in this field indicates how many questions about the listing have yet to be answered by the seller.

### ListingTerms
**Description:** This type is used to provide listing terms details for the listing, including listing format, listing duration, item location, return policy, fulfillment terms, and more.
**Type:** GraphQLObjectType

**Properties:**
- **adsSellerContact** (ListingSellerContact)
  - This object is applicable to classified ad listings, and provides contact information for the seller, including days and hours when the seller accepts inquiries from potential buyers.
- **bestOfferTerms** (BestOfferTerms)
  - This object will indicate if the listing accepts Best Offers from buyers, and will also show the 'auto accept' and/or 'auto decline' price thresholds if the seller has set these thresholds.
- **buyerRestrictions** (BuyerRestrictions)
  - This object indicates whether or not a seller is blocking/disabling account-level buyer restrictions and/or has set a quantity limit per buyer threshold for a multiple-quantity, fixed price listing.
- **charity** (Charity)
  - This object is returned if the seller is donating a set percentage of each sale on the listing to a non-profit organization that is registered to receive donations on eBay's platform. The unique identifier of the charitable organization and the donation percentage is shown in this object. Note that eBay for Charity is only supported on the US, UK, DE, and CA marketplaces.
- **customPolicies** (CustomPolicies)
  - This object shows any global and/or marketplace-specific product compliance and/or takeback policies applicable for the listing.
- **fulfillmentTerms** (FulfillmentTermsPolicy)
  - This object provides details on how the item will be delivered to the buyer. The data in this object includes available shipping services, ship-to and excluded shipping locations, shipping costs, package details, and more.
- **hideParticipation** (Boolean)
  - This boolean field indicates whether or not the listing is private. With private listings, the eBay user and feedback scores for bidders and buyers are obfuscated to everyone except for the seller.
- **internationalSiteVisibility** ([CrossBorderTradingRegion!])
  - This array indicates if the seller is actively listing the item on another eBay marketplace for an additional fee. Currently, this feature can only be used on the US, Canada, UK, and Ireland marketplaces. Sellers listing on the US and Canada marketplaces can choose to also expose a listing on the UK and IE marketplaces and sellers listing on the UK and IE marketplaces can choose to also expose a listing on the US and CA marketplaces. This list will be empty if the seller has not chosen to actively display their listings on other eBay marketplaces.
- **itemLocation** (ItemLocation)
  - This object indicates where the item is physically located. Item location is mandatory as it allows eBay to calculated estimated shipping costs and also to provide an estimated delivery time window to buyers.
- **lifecycleTerms** (ListingLifecycle)
  - This object shows the duration of the listing, and will also show a timestamp indicating when in the future a scheduled listing will become active.
- **listingFormat** (ListingFormatType)
  - The enumeration value in this mandatory field indicates the format of the listing such as auction or fixed price listing. required field sets the listing format. See \*\*ListingFormatTypeMock\*\* for supported enumeration values.
- **listingFulfillmentTerms** (FulfillmentTerms)
  - This object provides fulfillment terms for a listing, including shipping cost model, available shipping services, shipping costs, handling time, combined shipping rules, and excluded shipping locations.
- **listingPaymentTerms** (PaymentTerms)
  - This object provides payment terms for a listing, including immediate payment requirement, accepted offline payment methods, and motor vehicle deposit details.
- **listingReturnTerms** (ReturnTerms)
  - This object provides return terms for a listing, including return period, refund method, and return shipping cost payer etc.
- **localListingDistance** (ListingDistance)
  - This object is applicable if the seller is selling a motor vehicle through a Motors Local Listing. The integer value in this object is the radius of the area in which the vehicle will be available and exposed to interested local buyers. The specified item location will be used as the center point for this radius.
- **lotSize** (Int)
  - The integer value in this field indicates how many distinct items are in a lot-based listing. A lot-based listing is a listing with a set of two or more similar/related items that will be sold together as one line item. An example of a lot listing might be a collection of children's clothes.
- **paymentTerms** (PaymentTermsPolicy)
  - This object provides various payment terms and information for the listing, including immediate payment requirement, offline payment methods, and motor vehicle deposit information.
- **programsSupported** ([String!])
  - This array is return to indicate any special programs associated with the listing. Currently, the only supported value is \`EBAY\_PLUS\`. eBay Plus is a premium account option for buyers, which provides benefits such as fast and free domestic shipping, and free returns on selected items. eBay will evaluate/determine whether a listing is eligible for eBay Plus.
- **regulatory** (RegulatoryInfo)
  - This object shows the various types of regulatory information that is applicable to the listing, including energy efficiency labels, hazardous material information, product safety information, and more. Based on the listing category, sellers doing business in an EU country or Northern Ireland may be legally required to provide some of this regulatory information for listings.
- **returnTerms** (ReturnTermsPolicy)
  - This object provides a domestic return policy and an international return policy (if the seller ships internationally) that is used for the listing.
- **sellerCustomData** (String)
  - This field is used by the seller to provide custom, application-specific data associated with the listing. The string specified here is stored by eBay with the listing but it is not used by eBay in any way other than that.
- **taxTerms** (TaxInfo)
  - This object provides various tax information, including VAT rates, sales tax rates to US territories and Canadian provinces, and special tax category codes.
- **totalQuantityAvailable** (Int)
  - This integer value shows the total quantity of the item available through the listing.
- **visualEnhancements** (ListingVisualEnhancements)
  - This object shows listing upgrades that have been enabled for the listing such as bold titles in search results, Gallery Plus, or an added subtitle.

### ListingSellerContact
**Description:** This type is used for classified ad listings, and provides contact information for the seller, including days and hours when the seller accepts inquiries from potential buyers.
**Type:** GraphQLObjectType

**Properties:**
- **addressLine1** (String)
  - The first line of the street address of the seller.
- **addressLine2** (String)
  - The second line of the seller's street address. This field is not always used, but can be used for secondary address information such as 'Suite Number' or 'Apt Number'.
- **companyName** (String)
  - This field shows the company name (if any) associated with the seller.
- **contactByEmailEnabled** (Boolean)
  - This boolean field indicates whether or not potential buyers can contact the seller of the listing by email.
- **country** (CountryAlpha2Code)
  - This field shows the two-letter code representing the country where the seller is located.
- **county** (String)
  - This field shows the county where the seller is located. This field is only returned if available/applicable.
- **phone** (String)
  - This field shows the seller's primary phone number. This field is only returned if provided by the seller.
- **primarySellerContactHours** (ListingSellerContactHours)
  - This object is used to provide the seller's primary support days and hours. This will generally show support hours on weekdays.
- **secondarySellerContactHours** (ListingSellerContactHours)
  - This object is used to provide the seller's secondary support days and hours. This will generally show support hours on weekends if the support hours vary on weekends.

### ListingSellerContactHours
**Description:** This type is used to specify the days and times when a seller may be contacted regarding a classified ad listing. This type is used by the \*\*primarySellerContactHours\*\* and \*\*secondarySellerContactHours\*\* objects and the days specified here should not overlap between the two. This type also has an \*\*anyTime\*\* boolean and if the value of that field is \`true\`, it means that the seller can be contacted at any time during the specified day(s).
**Type:** GraphQLObjectType

**Properties:**
- **anyTime** (Boolean)
  - This boolean field indicates whether or not the seller is available to be contacted 24 hours a day during the range of days specified.
- **supportHoursEndAt** (Time)
  - This field is used to indicate the end time of support hours for the days specified through the \*\*supportOnDays\*\* field. Military time is used here and times will be on the hour or half hour (e.g. 9:00, 9:30, etc.). The \*\*supportHoursStart\*\* and \*\*supportHoursEnd\*\* fields are always used together and the \*\*supportHoursStart\*\* value should always be earlier than the \*\*supportHoursEnd\*\* value.
- **supportHoursStartAt** (Time)
  - This field is used to indicate the start time of support hours for the days specified through the \*\*supportOnDays\*\* field. Military time is used here and times will be on the hour or half hour (e.g. 9:00, 9:30, etc.). The \*\*supportHoursStart\*\* and \*\*supportHoursEnd\*\* fields are always used together and the \*\*supportHoursStart\*\* value should always be earlier than the \*\*supportHoursEnd\*\* value.
- **supportOnDays** (SellerSupportListingDaysCode)
  - This field indicates the block of days that the support hours will apply to.

### BestOfferTerms
**Description:** This type is used to show if the seller has enabled the Best Offer feature for the listing, and if Best Offer is enabled, the auto-accept and auto-decline Best Offer price thresholds if the seller has set either of these thresholds.
**Type:** GraphQLObjectType

**Properties:**
- **acceptBestOffer** (Boolean)
  - This boolean field indicates whether or not the Best Offer feature is enabled for the listing. For auction listings, note that the Buy it Now feature is disabled as soon as an auction listing gets a qualifying bid, and all pending Best Offers or counteroffers become invalid.
- **autoAcceptThresholdAmount** (ConvertedAmount)
  - The price at which Best Offers will be automatically accepted by the seller if they meet or exceed the price. Auto-accept is an optional feature for the seller. \*\*Note\*\*: This object is only accessible to the seller of this listing
- **autoDeclineThresholdAmount** (ConvertedAmount)
  - The price at which Best Offers will be automatically declined by the seller if they are equal to or below the price. Auto-decline is an optional feature for the seller. \*\*Note\*\*: This object is only accessible to the seller of this listing

### BuyerRestrictions
**Description:** This type is used to show if the seller has disabled account-level buyer restrictions for the listing and/or they have set up a listing-level level setting where buyers have a maximum amount of quantity that they may purchase during the duration of a multiple-quantity, fixed price listing.
**Type:** GraphQLObjectType

**Properties:**
- **disableBuyerRestrictions** (Boolean)
  - This boolean field indicates whether or not the seller's account-level buyer restrictions are applicable to the listing. If this value is set \`true\`, any account-level buyer restrictions do not apply to the listing, and if the value is \`false\` (default value), any account-level buyer restrictions will apply to the listing. \*\*Note\*\*: This field is only shown to the seller (owner of the listing).
- **quantityLimitPerBuyer** (Int)
  - A mechanism to restrict the quantity of items that may be purchased by one buyer during the duration of a fixed-price listing (single or multi-variation). This is optional and can be used with an Add, Revise, or Relist call.

### Charity
**Description:** This type is used for charitable listings to show the non-profit organization that will benefit from the sale of the item, and the percentage of each sale that the organization will receive through a charitable donation. if the seller wishes to donate a set percentage of each sale on the listing to a non-profit organization \*\*Note\*\*: \*\*eBay for Charity\*\* is only supported on the US, UK, Germany, and Canada marketplaces.
**Type:** GraphQLObjectType

**Properties:**
- **charityOrganization** (CharityOrganization)
  - The unique identifier of the non-profit organization that will benefit from each sale of the item. The ID returned here can be used in the \[getCharityOrg\](https://developer.ebay.com/api-docs/commerce/charity/resources/charity\_org/methods/getCharityOrg) method to retrieve the name and more about the organization.
- **donationPercentage** (Int)
  - The integer value returned in this field indicates the percentage of the purchase price that the seller will donate to the selected non-profit organization for each sale. The integer value returned here ranges from 10 to 100 (percent) and will be in 5 percent increments, such as 10, 15, 20, 25, and all the way up to 100 (percent).

### CustomPolicies
**Description:** This type shows any global or marketplace-specific product compliance and/or takeback policies enabled for a listing.
**Type:** GraphQLObjectType

**Properties:**
- **productCompliancePolicyIds** ([ID!])
  - An array of one to six product compliance policy ID values, representing one or more product compliance policies that are applicable to the listing. Product compliance policies provide buyers with important information and disclosures about products. The product compliance policies in this array will apply to all countries where the seller ships the item. Marketplace-specific product compliance policies are indicated with the \*\*regionalProductCompliancePolicies\*\* field.
- **regionalProductCompliancePolicies** (RegionalProductCompliancePolicies)
  - The set of marketplace-specific product compliance policies that are associated with the listing. Product compliance policies provide buyers with important information and disclosures about products. For example, if you sell batteries in a country requiring disclosures that apply only to that marketplace, a marketplace-specific product compliance policy could contain this information. Each listing may have up to six (6) product compliance policies for each of the following countries: \`GB\`, \`DE\`, \`FR\`, \`IT\`, and \`ES\`. Global product compliance policies are indicated with the \*\*productCompliancePolicyIds\*\* array.
- **regionalTakeBackPolicies** (RegionalTakeBackPolicies)
  - The set of marketplace-specific take-back policies that are associated with the listing. The law in some countries may require sellers to take back a used product when the buyer buys a new product. Each marketplace may only have one specific take-back policy. A global take-back policy should be set with the \*\*takebackPolicyId\*\* field instead. Each listing may include one (1) marketplace-specific take-back policy for each of the following countries: \`GB\`, \`DE\`, \`FR\`, \`IT\`, and \`ES\`.
- **takeBackPolicyId** (ID)
  - The unique identifier of a global take-back policy. The take-back policy set with this field will apply to all countries where the seller operates. Region-specific policies are set with the \*\*regionalTakeBackPolicies\*\* field.

### RegionalProductCompliancePolicies
**Description:** This type is used to display marketplace-specific product compliance policies. Each marketplace may have up to six product compliance policies.
**Type:** GraphQLObjectType

**Properties:**
- **countryPolicies** ([CountryPolicy!])
  - Contains a country and the custom policy/policies for that country.

### CountryPolicy
**Description:** This type is used to indicate one or more marketplace-specific product compliance or takeback policies attached to the listing. Up to 6 product compliance policies may be set per marketplace, but only 1 takeback policy may be set per marketplace.
**Type:** GraphQLObjectType

**Properties:**
- **country** (CountryAlpha2Code)
  - The country for this policy.
- **policyIds** ([ID!])
  - The policy IDs specifying product compliance or take-back policy information.

### RegionalTakeBackPolicies
**Description:** This type defines the list of unique identifiers indicating the seller-created take-back policies that will be used for a listing. The law in some countries may require sellers to take back a used product when the buyer buys a new product. Each listing may include one (1) country-specific take-back policy for each of the following countries: GB, DE, FR, IT, ES. Maximum 5 policies in a listing.
**Type:** GraphQLObjectType

**Properties:**
- **countryPolicies** ([CountryPolicy!])
  - Contains a country and the take back policy/policies for that country.

### BusinessPolicy
**Description:** This type represents a seller-defined business policy (payment, shipping, or return). A business policy contains information on one policy, with the specific policy information contained in \*\*policyDetails\*\*.
**Type:** GraphQLObjectType

**Properties:**
- **businessPolicyId** (ID!)
  - The unique ID of the business policy.
- **description** (String)
  - A seller-defined description of the return business policy. This description is only for the seller's use, and is not exposed on any eBay pages. This can be null when no description was provided during policy creation. \*\*Maximum length:\*\* 250 characters
- **marketplace** (BusinessPolicyMarketplace)
  - This enumerated value indicates the marketplace where this business policy applies. This field returns null when marketplace information is not available.
- **name** (String)
  - A seller-defined name for this return business policy. Names must be unique per site and per type. \*\*Maximum length:\*\* 64 characters \*\*Occurrence:\*\* Always
- **policyDetails** (PolicyDetails)
  - Detailed information specific to the kind of business policy (return, shipping, or payment). This field returns null when policy details are not available or cannot be retrieved.

### PaymentPolicyDetails
**Description:** This type defines the seller's payment configuration for a payment policy including accepted payment methods, immediate payment requirements, and motors specific settings (for example, a deposit requirement).
**Type:** GraphQLObjectType

**Properties:**
- **acceptedPaymentMethods** ([PaymentMethods])
  - This array lists the seller's payment methods that are accepted for the payment business policy. \*\*Note:\*\* Sellers are not required to specify any electronic payment methods for listings. This array may often be returned empty unless the payment business policy is intended for motor vehicle listings or other items in categories where offline payments are required or supported. \*\*Occurrence:\*\* Always
- **depositDetails** (BusinessPolicyMotorVehicleDepositDetails)
  - This object provides motor vehicle listing deposit requirements. Applicable if the \*\*categoryTypes.name\*\* field is set to \`MOTORS\_VEHICLES\` and returned only if the seller requires an initial deposit. The object shows the amount due for the deposit and when it is due (typically within 1-3 days after commitment to purchase, unless the listing requires immediate payment). May be null when no deposit is required. \*\*Occurrence:\*\* Conditional
- **immediatePaymentRequired** (Boolean)
  - When \`true\`, this field indicates immediate payment is required from the buyer. This can occur in the following scenarios: - Fixed-price item - An auction where the buyer uses \*\*Buy It Now\*\* - A deposit for a motor vehicle \*\*Note:\*\* Immediate payment does not apply to auction listings with a winning bid, purchases involving Best Offer, or transactions completed offline. \*\*Occurrence:\*\* Always
- **motorVehiclePolicy** (Boolean)
  - This field indicates whether this payment policy applied to motor vehicles. - \`true\`: This is a motor vehicle payment policy - \`false\`: This is a standard (non-motor vehicle) payment policy
- **paymentInstructions** (String)
  - Although this field may be returned for some older payment business policies, payment instructions are no longer supported by payment business policies. If this field is returned, it can be ignored as these payment instructions will not appear in any listings that use the corresponding business policy. May be null when no instructions were provided. \*\*Maximum length:\*\* 1000 characters \*\*Occurrence:\*\* Conditional

### BusinessPolicyMotorVehicleDepositDetails
**Description:** This type defines deposit requirements for motor vehicle purchases including the deposit amount, when the deposit is due, and the deadline for full payment.
**Type:** GraphQLObjectType

**Properties:**
- **daysToMakeFullPayment** (Int)
  - This object applies to motor vehicles listings only and indicates when the final payment for the vehicle is due. This value indicates the number of days that a buyer has to make their full payment to the seller and close the remaining balance on a motor vehicle transaction. The period starts when the buyer commits to buy. May be null when not applicable or not specified. The valid values in days: \`3\` , \`7\` (default), \`10\`, \`14\` \*\*Default:\*\* \`7\` days \*\*Occurrence:\*\* Conditional
- **depositAmount** (ConvertedAmount)
  - This value indicates the initial deposit amount required from the buyer in order to purchase a motor vehicle. This value can be as high as $2,000.00 if immediate payment is not required, and up to $500.00 if immediate payment is required. May be null when no deposit amount is required. \*\*Maximum:\*\* 2000.00 \*\*Occurrence:\*\* Conditional
- **hoursToDeposit** (Int)
  - This value indicates the number of hours that the buyer has (after they commit to buy) to pay the initial deposit on a motor vehicle. Valid times are 24, 48, and 72 hours. \`HOUR\` is set as the unit value, and 24, 48 or 72 are set in the value field. If the motor vehicle listing requires immediate payment, this value is overridden and the deposit is due immediately. May be null when immediate payment is required. The valid values in hours: \`24\` hours, \`48\` hours (default), \`72\` hours \*\*Default:\*\* 48 hours \*\*Occurrence:\*\* Conditional

### ReturnPolicyDetails
**Description:** This type provides return-specific information about a seller's return policy, including options on whether returns are accepted, who pays for return shipping, and how refunds are issued.
**Type:** GraphQLObjectType

**Properties:**
- **domesticReturnOptions** (ReturnOptions!)
  - Return options for domestic returns.
- **internationalReturnOptions** (ReturnOptions!)
  - Return options for international returns.
- **returnInstructions** (String)
  - This optional text-based field provides more details on seller-specified return instructions. May be null if no instructions were provided by the seller. This field is no longer supported on many eBay marketplaces. To see if a marketplace and eBay category does support this field, call the [getReturnPolicies](https://developer.ebay.com/api-docs/sell/metadata/resources/marketplace/methods/getReturnPolicies) method of the \*\*Metadata API\*\*. \*\*Maximum length:\*\* 8000 characters

### ReturnOptions
**Description:** This type provides the business policy's options for returns including if returns are accepted, who pays for return shipping, and how refunds are issued.
**Type:** GraphQLObjectType

**Properties:**
- **refundMethod** (RefundType)
  - This field indicates the refund method offered by the seller. Its value will be \`MONEY\_BACK\` unless the seller is enabled for Buy online, Pickup in Store or Click and Collect, and then it might be \`MERCHANDISE\_CREDIT\`. Can be null when returns are not accepted or when not specified. Getting their money back for returned items is always an option for buyers, regardless of what the seller sets in this field. \*\*Occurrence\*\*: Always
- **returnPeriodInDays** (Int)
  - The number of calendar days the buyer has to return the item, starting from the date the item is recorded as delivered to the buyer's ship-to address. Most categories support 30-day and 60-day return periods. This field is present only when \*\*returnsAccepted\*\* is \`true\` and may be null when returns are not accepted or when not specified. \*\*Occurrence:\*\* Conditional
- **returnShippingPaidBy** (Invoicee)
  - This field indicates who is responsible for paying for the shipping charges for returning the item. The field can be set to either \`BUYER\` or \`SELLER\`. Present only when the \*\*returnsAccepted\*\* field is \`true\` and may be null when returns are not accepted or when not specified. Responsibility may vary based on the return reason and policy. The seller is always responsible for return shipping costs for 'significantly not as described' (SNAD) issues. \*\*Occurrence:\*\* Conditional
- **returnsAccepted** (Boolean!)
  - Indicates whether the seller accepts returns for this policy. - \`true\`: Returns are accepted - \`false\`: Returns are not accepted \*\*Occurrence:\*\* Always

### ShippingPolicyDetails
**Description:** This type provides shipping-specific details for a seller's shipping policy, including if the policy applies to motor vehicles, available domestic and international shipping options, ship-to exclusions and inclusions, handling time, and participation in special programs such as eBay's Global Shipping Program (GSP) or freight.
**Type:** GraphQLObjectType

**Properties:**
- **buyerResponsibleForShipping** (Boolean)
  - This boolean field is returned as \`true\` if the buyer is responsible for shipping or pickup of a motor vehicle.
- **domesticShippingOptions** (ShippingFulfillmentOptions)
  - This object contains shipping options for domestic deliveries under this policy. May be null or empty if domestic shipping is not offered or specified.
- **eligibleForPickupDropOff** (Boolean)
  - This field indicates whether the item is eligible for \*\*Click and Collect\*\*. This is currently available only to large retail merchants in the eBay AU, UK, DE, FR, and IT marketplaces. If returned as \`true\`, local pickup is also available for this policy.
- **excludedShipToLocations** ([ShippingLocation!])
  - This array lists shipping locations where the seller does not ship under this policy. The location may be countries, regions, states or provinces, or marketplace unique domestic regions. The supported eBay marketplace location codes are marketplace specific. - May be empty if no locations are configured - Values are not localized \*\*Example:\*\* \`\["AFG","ALB","DZA","ASM","AND","AGO","AIA"\]\`
- **globalShippingProgramParticipant** (Boolean)
  - This field applies only for the eBay United Kingdom marketplace (EBAY\_GB). If returned as true, \*\*eBay's Global Shipping Program\*\* will be used by the seller to ship items to international locations. All other sites should return \`false\` for this field.
- **handlingTime** (Int)
  - The maximum number of business days the seller commits to for preparing and shipping an order after the order is placed. This time does not include the transit time it takes the shipping carrier to deliver the order. If only local pickup or freight shipping is available for the item, this value may not get returned. May be null when not applicable or not specified.
- **includedShipToLocations** ([ShippingLocation!])
  - This array lists shipping locations where the seller ships to under this policy. The location may be continents, regions, countries, or marketplace unique domestic regions. Each eBay marketplace supports its own set of allowable shipping locations.
- **internationalShippingOptions** (ShippingFulfillmentOptions)
  - This object contains shipping options for international deliveries under this policy. May be null or empty if international shipping is not offered or specified.
- **motorVehiclePolicy** (Boolean)
  - This boolean field indicates whether or not this policy is for motor vehicle listings.

### ShippingFulfillmentOptions
**Description:** This type defines the seller's shipping configuration for a shipping policy, including shipping calculation type, available services, rate tables, discounts, and free shipping eligibility.
**Type:** GraphQLObjectType

**Properties:**
- **BusinessPolicyShippingServices** ([BusinessPolicyShippingServiceDetails])
  - The shipping services configured in the seller's Business Policies for this shipping policy, and includes service-level details and handling costs.
- **combinedShippingRuleId** (ID)
  - This field is the unique identifier of a seller's domestic or international combined shipping rule. If a buyer satisfies the requirements of the discount rule, this buyer will receive a shipping discount for the order. The seller can create and manage shipping discount profiles using the \*\*Account v2 API\*\* or through Shipping Preferences in \*\*My eBay\*\*.
- **freeShippingAvailable** (Boolean)
  - This field indicates whether the seller offers free domestic shipping as the primary domestic shipping service option. This applies to only the first domestic shipping service in \*\*shippingServices\*\* array in the \*\*ShippingFulfillmentOptions\*\* type (it is ignored if set for subsequent shipping services or for any international shipping service option). \*\*Note:\*\* Free shipping only applies to domestic shipping.
- **promotionalShipping** (Boolean)
  - This boolean indicates whether or not the seller has a promotional shipping discount set up that will be available to buyers who satisfy the requirements of the shipping discount rule. The seller can create and manage shipping promotional discounts using the \*\*Account v2 API\*\* or through Shipping Preferences in \*\*My eBay\*\*.
- **shippingRateTableId** (ID)
  - The unique identifier of a domestic or international shipping rate table associated with the fulfillment policy. With domestic and international shipping rate tables, the seller can set different shipping costs based on shipping regions and shipping speed/level of service (one-day, expedited, standard, economy). There are also options to add additional per-weight and handling charges. May be null when no rate table is used.
- **shippingType** (LogisticsOptionType)
  - This enumerated value specifies how shipping costs are calculated for this shipping policy (for example, flat-rate shipping or calculated shipping).

### BusinessPolicyShippingServiceDetails
**Description:** This type represents a single shipping service option within a seller's shipping policy, including base and additional unit costs, covered ship-to locations, optional packaging and handling fees, offered by the seller to ship an item to a buyer.
**Type:** GraphQLObjectType

**Properties:**
- **additionalUnitShippingCost** (ConvertedAmount)
  - The incremental shipping cost per additional unit of the same line item purchased by the same buyer. May be null when not applicable (for example, single-quantity listings or when the service does not charge per-unit increments).
- **includedShipToLocations** ([ShippingLocation!])
  - The set of ship-to locations supported by this shipping service option. Locations may be countries, regions, states/provinces, or marketplace-defined areas. Supported codes are marketplace-specific and are not localized. If no locations are configured for this service, the list will be empty. \*\*Note:\*\* The field is typically present, but its list may be empty. This field should not be null unless an error has occurred. See the error section of the response for more details.
- **packageHandlingCost** (ConvertedAmount)
  - The seller's packaging/handling fee for this shipping service, in addition to carrier charges. May be null if no handling fee is configured.
- **rank** (Int)
  - The display order ranking for shipping services relative to the other services (lower values appear first) in which the ShippingService appears on the View Item and Checkout page. May be null if no value is set.
- **shippingCost** (ConvertedAmount)
  - The base cost of shipping one unit using the shipping service specified in the corresponding Shipping Service field.
- **shippingServiceOptionCode** (ID)
  - The unique identifier of a shipping service option being offered by the seller to ship an item to a buyer. This is not localized and may not be directly displayed to an end user. This should not be null unless an error has occurred. See the error section of the response for more details.

### ShippingLocation
**Description:** This type is used to indicate a continent, a geographical region, a country, or a special domestic location as a shipping location or excluded shipping location.
**Type:** GraphQLObjectType

**Properties:**
- **continent** (ContinentCode)
  - The enum value returned in this field indicates the continent that is a shipping or excluded shipping location.
- **country** (CountryAlpha2Code)
  - The enum value returned in this field indicates the country that is a shipping or excluded shipping location.
- **sellerShippingRegion** (SellerShippingRegionCode)
  - The enum value returned in this field indicates the large geographical region that is a shipping or excluded shipping location, or a special domestic location that is an excluded shipping location.

### FulfillmentTerms
**Description:** This type is used to provide details on how the item will be delivered to the buyer. The data in this type includes available shipping services, ship-to and excluded shipping locations, shipping costs, package details, and more.
**Type:** GraphQLObjectType

**Properties:**
- **digitalDeliverySupported** (Boolean)
  - This field should be included and set to true if the item is a digital item that can be downloaded via a link or delivered to the buyer via email. The \[getListingTypePolicies\](https://developer.ebay.com/api-docs/sell/metadata/resources/marketplace/methods/getListingTypePolicies) method can be used to see if a leaf category supports digital delivery.
- **freeShippingAvailable** (Boolean)
  - This boolean specifies whether the seller wants to offer free shipping. To see if a specific shipping service is free, look at \*\*ShippingServiceDetails.shippingCost\*\*. If it is set to zero, the shipping is free for that service.
- **globalShippingSupported** (Boolean)
  - This field can be included and set to \`true\` if the seller wishes to use eBay's Global Shipping Program (GSP) to ship items internationally. With GSP, the seller ships the item to eBay's shipping partner, and that shipping partner handles all logistics of the international shipping leg. GSP is only available for listings on the eBay UK marketplace. eBay US has a similar program called eBay International Shipping, but there is currently no boolean field associated with this feature.
- **inStorePickupSupported** (Boolean)
  - This field is only applicable to sellers enabled to sell 'Buy online, pick up in store' (BOPIS) inventory. This field is included and set to \`true\` if the seller wishes to make the item available for pickup at a store location within close proximity to the buyer's location. See the \[In-store pickup \](https://developer.ebay.com/api-docs/sell/static/inventory/in-store-pickup.html) topic for information on setting up BOPIS, including how to create store locations and load inventory to those stores.
- **packageSpecifications** (ShippingPackageSpec)
  - This object provides information about the shipping package that will be used to ship the item, and includes package type, weight, and dimensions. Package weight is required when calculating shipping is used, and shipping services generally have dimension and weight restrictions.
- **shippingTerms** (ShippingTerms)
  - This object provides information about where the item can be shipped, the shipping cost type, the shipping services offered, the handling time, applicable shipping discounts, and more.

### ShippingPackageSpec
**Description:** This type provides information about the shipping package that will be used to ship the item, and includes package type, weight, and dimensions.
**Type:** GraphQLObjectType

**Properties:**
- **irregularPackage** (Boolean)
  - This boolean field indicates whether or not the shipping package is an irregular or non-standard shape. A shipping carrier may charge additional handling fees for an irregular package.
- **listingPackageType** (ListingPackageType)
  - The enumerated value returned in this field indicates the type of package used to ship the item.
- **listingUnitOfMeasure** (MeasurementSystem)
  - The measurement system used by the eBay marketplace for the package dimensions and weight.
- **packageDimensions** (ListingPackageDimensions)
  - This object is used to specify the dimensions of the shipping package and the unit of measurement used.
- **packageWeight** (ListingPackageWeight)
  - This object is used to specify the weight of the shipping package and the unit of measurement used to measure weight.

### ListingPackageDimensions
**Description:** This type is used to specify the dimensions of the shipping package and the unit of measurement used.
**Type:** GraphQLObjectType

**Properties:**
- **height** (Float)
  - The height (or depth) of the shipping package in the unit of measurement specified in the corresponding \*\*unit\*\* field.
- **length** (Float)
  - The length of the shipping package in the unit of measurement specified in the corresponding \*\*unit\*\* field.
- **unit** (DimensionUnitType)
  - The unit of measurement used for the dimensions of the shipping package.
- **width** (Float)
  - The width of the shipping package in the unit of measurement specified in the corresponding \*\*unit\*\* field.

### ListingPackageWeight
**Description:** This type is used to specify the weight of the shipping package according to the unit of measurement applicable to the marketplace. The weight of the shipping package is required when the listing is using the calculated shipping cost type. For English measurement system, the supported unit of measurement is pounds for \*\*majorUnit\*\* and ounces for \*\*minorUnit\*\*. For Metric measurement system, the supported unit of measurement is kilograms for \*\*majorUnit\*\* and grams for \*\*minorUnit\*\*.
**Type:** GraphQLObjectType

**Properties:**
- **majorUnit** (Int)
  - The major weight value of the shipping package according to the unit of measurement applicable to the marketplace. The major weight value is the whole number part of the weight. For English measurement system, the supported unit of measurement for \*\*majorUnit\*\* is pounds. For Metric measurement system, the supported unit of measurement for \*\*majorUnit\*\* is kilograms. \*\*Note\*\*: If the package weighs less than one pound or one kilogram, 0 may be returned as the value for this field.
- **minorUnit** (Int)
  - The minor weight value of the shipping package according to the unit of measurement applicable to the marketplace. The minor weight value is the decimal part of the weight. For English measurement system, the supported unit of measurement for \*\*minorUnit\*\* is ounces. For Metric measurement system, the supported unit of measurement for \*\*minorUnit\*\* is grams.
- **unit** (WeightUnitType)
  - The unit of measurement used for the weight of the shipping package.

### ShippingTerms
**Description:** This type provides information about where the item can be shipped, the shipping cost type, the shipping services offered, the handling time, applicable shipping discounts, and more.
**Type:** GraphQLObjectType

**Properties:**
- **buyerResponsibleForShipping** (Boolean)
  - This boolean field indicates whether the buyer is responsible for vehicle shipping/pickup.
- **excludedShipToLocations** ([ShippingLocation!])
  - This array is used to indicate the locations where the seller will not ship the item. The values in this array can be continents, large geographical regions, countries, or special domestic locations. The \*\*excludedShipToLocations\*\* and \*\*includedShipToLocations\*\* lists should not contradict one another. If there is a contradiction between the shipping exclusions and inclusions, the exclusion usually takes precedence. This means if a location is both included and excluded, it will be treated as excluded.
- **handlingTimeDuration** (ListingTimeDuration)
  - This field indicates how many business days that the seller needs to ship the item after payment is made by the buyer. The handling time is required for most categories. Top-rated sellers typically set the handling time to 0 or 1 day, but longer handling times are supported.
- **includedShipToLocations** ([ShippingLocation!])
  - This array shows the list of locations where the seller will ship the item. The values in this array can be continents, large geographical regions, or countries. The \*\*excludedShipToLocations\*\* and \*\*includedShipToLocations\*\* lists should not contradict one another. If there is a contradiction between the shipping exclusions and inclusions, the exclusion usually takes precedence. This means if a location is both included and excluded, it will be treated as excluded.
- **marketplaceShippingOptions** (ShippingOptionDetails)
  - This object provides information on shipping options for locations within the country of the marketplace, including the shipping cost type used (flat vs. calculated) and the shipping service options available to ship the item. There is also a field to specify a shipping rate table to use against the listings and fields to apply a shipping discount.
- **nonMarketplaceShippingOptions** (ShippingOptionDetails)
  - This object provides information on shipping for locations outside of the marketplace, including the shipping cost type used (flat vs. calculated) and the shipping service options available to ship the item. There is also a field to specify a shipping rate table to use against the listings and fields to apply a shipping discount.
- **shippingBusinessPolicy** (ShippingBusinessPolicy)
  - This object is used to specify the shipping policy being used as well as any shipping cost overrides that are being used.
- **shippingServices** ([ShippingServiceDetails!])
  - This array shows the list of shipping service options that are available to the buyer for shipment of the item, and the costs associated with using each one. Each available shipping service option is identified through the \*\*shippingServiceCode\*\* field.

### ShippingOptionDetails
**Description:** This type provides the shipping cost type used for calculated shipping costs.
**Type:** GraphQLObjectType

**Properties:**
- **shippingCostType** (ListingShippingCostType)
  - This field indicates the shipping cost type used for shipping. Shipping cost types include flat-rate and calculated.
- **shippingPreference** (SellerAppliedShippingPreference)
  - Shipping Preference applied by the seller which includes ratetable, discount rule and promotional discount

### SellerAppliedShippingPreference
**Description:** This entity type represents a seller-defined set of shipping preferences that are applied to a listing independently of a \`listingId\`. It exists to enable multiple subgraphs to extend the shared \`ShippingOptionDetails\` type with additional fields. The fields \`shippingRateTableId\`, \`combinedShippingRuleId\`, and \`promotionalShipping\` act as entity keys. They are used to resolve the corresponding seller-defined preferences exposed by \`shippingRateTable\`, \`combinedShippingRule\`, and \`promotionalShippingRule\`.
**Type:** GraphQLObjectType

**Properties:**
- **combinedShippingRule** (SellerCombinedShippingRule)
  - The actual seller-defined combined shipping rule associated with the provided \*\*combinedShippingRuleId\*\*. This field returns null if \*\*combinedShippingRuleId\*\* is null or invalid.
- **promotionalShippingRule** (SellerPromotionalShippingRule)
  - The actual seller-defined promotional shipping rule when \*\*promotionalShipping\*\* is 'true'. If \*\*promotionalShipping\*\* is 'false', this field is returned null.
- **shippingRateTable** (SellerShippingRateTable)
  - The actual seller-defined shipping rate table associated with the provided 'shippingRateTableId'. This field returns null if \*\*shippingRateTableId\*\* is null or invalid.

### SellerCombinedShippingRule
**Description:** This type represents the seller-defined combined shipping rule.
**Type:** GraphQLObjectType

**Properties:**
- **amount** (Amount)
  - The monetary amount of the shipping fee charged for each additional item. This field is applicable when the \*\*ruleType\*\* is \`FLAT\` and the \*\*ruleSubType\*\* is \`EachAdditionalAmount\`. This field is returned null for all other rule types and subtypes.
- **amountReduction** (Amount)
  - The monetary amount of the shipping fee to be reduced for each additional item. This field is applicable when the \*\*ruleType\*\* is \`FLAT\` and the \*\*ruleSubType\*\* is \`EachAdditionalAmountOff\`. This field is returned null for all other rule types and subtypes.
- **combinedShippingRuleId** (ID!)
  - The unique identifier of the combined shipping rule.
- **mappedActiveRuleId** (ID)
  - The unique identifier of the active successor rule, if any. This field is applicable when the \*\*ruleType\*\* is \`CALCULATED\`.
- **percentageReduction** (Decimal)
  - The percentage to reduce the shipping fee for each additional item. This value is expressed as a fractional decimal. This field is applicable when the \*\*ruleType\*\* is \`FLAT\` and the \*\*ruleSubType\*\* is \`EachAdditionalPercentOff\`. This field returns null for all other rule types and subtypes. \*\*Note\*\*: The value of this field must be between '0.00' and '0.99'. Up to two decimal places are supported.
- **ruleName** (String)
  - The seller-provided rule name.
- **ruleSubType** (String!)
  - The further classification of the rule. - When \*\*ruleType\*\* is \`CALCULATED\`, the \*\*subTypes\*\* can be \`CombinedItemWeight\`, \`IndividualItemWeight\`, \`WeightOff\`. - When \*\*ruleType\*\* is \`FLAT\`, the \*\*subTypes\*\* can be \`EachAdditionalAmount\`, \`EachAdditionalAmountOff\`, \`EachAdditionalPercentOff\`.
- **ruleType** (String!)
  - The high-level classification of the rule. This field indicates whether the rule is \`CALCULATED\` or \`FLAT\`. - \`CALCULATED\`: The shipping discount is computed dynamically based on weight or other criteria. - \`FLAT\`: A fixed discount or surcharge applied per additional item.

### SellerPromotionalShippingRule
**Description:** This type represents a promotional shipping rule configured by the seller (e.g., "Free shipping over $25").
**Type:** GraphQLObjectType

**Properties:**
- **minItemCount** (Int)
  - When provided, this field defines the minimum number of items required to enable this rule.
- **minOrderAmount** (Decimal)
  - When provided, this field defines the minimum order amount required to enable this rule.
- **promotionalShippingType** (String!)
  - The specific type of the promotional shipping rule defined by the seller.
- **shippingCost** (Decimal!)
  - The shipping cost defined for this rule.

### SellerShippingRateTable
**Description:** This type represents a seller-defined shipping rate table. A rate table is a reusable configuration (managed in the seller's Shipping Preferences UI) that defines custom shipping costs by destination region, weight, or surcharge rules. Rate tables reference Region Graph region codes (canonical / ISO-3 style) to determine applicable locations — e.g. 'USA', 'CAN', 'GBR', 'EUROPEAN\_UNION', 'WORLDWIDE'. For example: - $5 to contiguous US (regionCode: 'USA'), $10 to AK/HI, $15 to PR. - $20 to Canada (regionCode: 'CAN'), $30 to EU (regionCode: 'EUROPEAN\_UNION').
**Type:** GraphQLObjectType

**Properties:**
- **name** (String!)
  - The display name of the rate table \*\*Format\*\*: alphanumeric, spaces allowed \*\*Maximum length\*\*: 100 characters
- **shippingRateTableId** (ID!)
  - The unique numeric identifier of the shipping rate table.

### ShippingBusinessPolicy
**Description:** This type is used to indicate the shipping business policy that is being used for a listing, and if the seller is currently overriding shipping costs for any of the domestic and international shipping service options defined in the shipping business policy, the \*\*overrideShippingOptions\*\* array will provide this information.
**Type:** GraphQLObjectType

**Properties:**
- **businessPolicy** (BusinessPolicy)
  - This object shows the unique identifier of the shipping business policy.
- **overrideShippingOptions** ([OverrideShippingOptions!])
  - If the seller is currently overriding shipping costs for any of the domestic and international shipping service options defined in the shipping business policy, this array will provide this information.

### OverrideShippingOptions
**Description:** This type is used to override the shipping costs for shipping service options defined in the fulfillment business policy being used for the listing. The shipping costs provided will only affect the listing and will not update the fulfillment business policy.
**Type:** GraphQLObjectType

**Properties:**
- **additionalUnitShippingCostAmount** (ConvertedAmount)
  - The cost of shipping each additional item if the same buyer purchases multiple quantity of the same line item. If this field is null there is no additional unit shipping cost.
- **internationalShippingOption** (Boolean)
  - This field specifies whether the seller is supporting international shipping for the listing. The value of this field will be \`false\` if the shipping service is a domestic shipping service, and \`true\` if it is an international shipping service. This should not be null unless an error has occurred. Please see the error section of the response for more details
- **rank** (Int)
  - The integer value specified here identifies the shipping service in the fulfillment business policy whose cost value(s) will be overridden. This should be a positive integer from 1 to 4 if overriding a shipping service option that ships to locations within the marketplace or from 5 to 9 if overriding a shipping service option that ships to location outside of the marketplace. A rank value of \`1\` means it is the first shipping option displayed in the View Item page.
- **shippingCostAmount** (ConvertedAmount)
  - This field is used to override the shipping cost set in the fulfillment business policy for the marketplace and non-marketplace shipping service option identified through the corresponding \*\*rank\*\* field. The dollar value supplied here will be used when calculating the total shipping cost for the line item.

### ShippingServiceDetails
**Description:** This type shows the list of domestic or international shipping service options that are available to the buyer for shipment of the item, and the costs associated with using each one. Each available shipping service option is identified through the \*\*shippingServiceOptionCode\*\* field.
**Type:** GraphQLObjectType

**Properties:**
- **additionalUnitShippingCostAmount** (ConvertedAmount)
  - The cost of shipping each additional item if the same buyer purchases multiple quantity of the same line item. This field is required when creating a multiple-quantity, fixed-price listing.
- **includedShipToLocations** ([ShippingLocation!])
  - This array is the list of continents, geographical regions, and/or individual countries that the corresponding shipping service operates in.
- **listingPackageHandlingCost** (ConvertedAmount)
  - This field shows any package handling cost applied to a shipping service. It is added on top of the shipping cost for each service option. A null value means no additional cost.
- **rank** (Int)
  - An integer value that controls the order (relative to other shipping services) in which the corresponding ShippingService will appear in the View Item and Checkout page
- **shippingCostAmount** (ConvertedAmount)
  - The base cost of shipping one unit of the item using the shipping service specified in the corresponding Shipping Service field.
- **shippingService** (ListingShippingService)
  - A shipping service option being offered by the seller to ship an item to a buyer.

### ListingShippingService
**Description:** This type represents the shipping service available for a listing and includes key details such as the service code, display name, estimated delivery time range, and whether the service offers expedited delivery. \*\*Note:\*\* Delivery estimates are approximate and may vary based on item weight, origin, and destination.
**Type:** GraphQLObjectType

**Properties:**
- **shippingServiceCode** (String!)
  - The shipping service code available for the listing. \*\*Example\*\*: 'USPS\_PRIORITY123'.
- **displayName** (String)
  - The human-readable display name of this shipping service (e.g. 'USPS Priority Mail'). \*\*Format\*\*: Alphanumeric string with spaces allowed \*\*Maximum length\*\*: 50 characters
- **expeditedService** (Boolean)
  - This boolean indicates if the shipping service is considered an expedited service. An expedited service can deliver the item to a buyer's location within 1-2 business days. If 'true', this shipping service is considered an expedited service. If 'false', the shipping service is not considered an expedited service. \*\*Note\*\*: If null, the expedited status is unknown.
- **maxEstimatedDeliveryTimeHours** (Int)
  - The maximum estimated time in hours for the delivery to be completed for this service. \*\*Note\*\*: If null, maximum estimated delivery time is not provided by the carrier for this service.
- **minEstimatedDeliveryTimeHours** (Int)
  - The minimum estimated time in hours for the delivery to be completed for this service. \*\*Note\*\*: If null, minimum estimated delivery time is not provided by the carrier for this service.

### ItemLocation
**Description:** This type indicate the geographical location of the item.
**Type:** GraphQLObjectType

**Properties:**
- **country** (CountryAlpha2Code)
  - The two-letter country code, as defined in the ISO-3166 standard, must be specified in this field to indicate the country where the item is located. Please keep in mind that the item is often located in the same country as the listing marketplace, but this is not a requirement. This field will be null if there was an error. You can find more details in the errors section of the response
- **location** (String)
  - The field indicates the geographic location (city, state, or province) where the listing is physically located. This field will be empty if a postal code is provided This will be null if there was an error. You can find more details in the errors section of the response
- **postalCode** (String)
  - The postal code (ZIP code) where the listing is physically located. This may be empty if location is provided instead. Either the postal code or location will be available. This will be null if there was an error The postal/zip code format varies by region: - \*\*US\*\*: 5-digit numeric codes (e.g., 12345). - \*\*Australia\*\*: 4-digit numeric codes (e.g., 2000). - \*\*UK\*\*: Variable-length alphanumeric codes with letters and numbers (e.g., SW1A 1AA). Other regions follow local postal service standards.

### ListingLifecycle
**Description:** This type specifies the lifecycle details for the listing like the start date, end date, duration, etc.
**Type:** GraphQLObjectType

**Properties:**
- **actualEndAt** (DateTime)
  - The time that the listing actually becomes ended on eBay.
- **createdAt** (DateTime)
  - The date and time the listing was created.
- **endListingReason** (EndListingReason)
  - The reason to end the listing. It will be used to provide the reason for ending the listing. This will be null if the listing has not ended.
- **listingDurationInDays** (ListingDurationInDays)
  - This field indicates the time duration of the listing. All fixed price listings must be set to \`GTC\`(Good 'til Cancelled), but the listing duration days of auction and ad listings may vary based on marketplace and category. The \[getListingTypePolicies\](https://developer.ebay.com/api-docs/sell/metadata/resources/marketplace/methods/getListingTypePolicies) method can be used to see supported durations for each leaf category.
- **listingStatus** (ListingStatusEnum)
  - The status of the listing. Valid values: \`SCHEDULED\`, \`ACTIVE\`, \`ENDED\`
- **scheduledEndAt** (DateTime)
  - The time that the listing is supposed to be ended on eBay. This will be null if the end date has not been scheduled.
- **startAt** (DateTime)
  - A time in the future that the listing becomes active on eBay. To schedule the listing start time, specify a time in the future in GMT format. When you schedule a start time, the start time is randomized within 15-minute intervals. Randomized start times applies to the following sites: AT, BEFR, BENL, CH, DE, ES, FR, IE, IT, NL, PL, UK This will be null if the start date was not specified.

### PaymentTerms
**Description:** This type specifies the payment terms defined by seller like payment method, payment instructions, etc.
**Type:** GraphQLObjectType

**Properties:**
- **businessPolicy** (BusinessPolicy)
  - Business policy container for specifying policy ID .
- **immediatePay** (Boolean)
  - This field is set to \`true\` if the seller requires immediate payment for fixed price listings and auction listings where the 'Buy it Now' option is used. \*\*Default\*\*: false
- **listingPaymentMethods** ([ListingPaymentMethod!])
  - This array is used to specify one or more payment methods for listings that support offline transactions. Use the \[getCategoryPolicies\](https://developer.ebay.com/api-docs/sell/metadata/resources/marketplace/methods/getCategoryPolicies) method to see the payment methods supported for a leaf category. Currently the only payment methods supported are for offline payments. \*\*Note:\*\* This array will be null if there are no payment methods.
- **motorVehicleDeposit** (MotorVehicleDeposit)
  - This field is used when the seller requires a deposit to secure the purchase of a motor vehicle. The settings under this object include the amount of the deposit, when the deposit is due, and when the full payment of the motor vehicle is due.
- **paymentInstructions** (String)
  - Payment instructions (or message) from the seller to the buyer. These instructions appear on eBay's View Item page and on eBay's checkout page when the buyer pays for the item.

### MotorVehicleDeposit
**Description:** This type is used when the seller requires a deposit to secure the purchase of a motor vehicle. The settings under this object include the amount of the deposit, when the deposit is due, and when the full payment of the motor vehicle is due.
**Type:** GraphQLObjectType

**Properties:**
- **daysToMakeFullPayment** (ListingTimeDuration)
  - This field is used to set the due date (in days) for the buyer to pay off the full balance of the motor vehicle. The clock starts on the full payment due date as soon as the buyer commits to buying the vehicle by clicking the 'Buy It Now' button, by winning the auction, or by the seller accepting that buyer's Best Offer/counteroffer. The three supported values here are \`DAYS\_3\` \`DAYS\_7\`, \`DAYS\_10\`, \`DAYS\_14\`. \*\*Default\*\*: DAYS\_7
- **depositRequired** (Boolean)
  - This boolean field is included and set to \`true\` if the seller requires a deposit to secure the purchase of a motor vehicle. \*\*Default\*\*: false

### ReturnTerms
**Description:** This type is used to show the domestic return policy or an international return policy (if the seller ships internationally) that is to be used for the listing.
**Type:** GraphQLObjectType

**Properties:**
- **businessPolicy** (BusinessPolicy)
  - This field is used to specify a return business policy to use for the listing. If this field is used, none of the other fields in this container should be used since all return policy settings are configured in the business policy instead. The \[getReturnPolicies\](https://developer.ebay.com/api-docs/sell/account/resources/return\_policy/methods/getReturnPolicies) method can be used to retrieve all return business policies defined for a seller on an eBay marketplace.
- **domesticReturnTerms** (ReturnTermsDetails)
  - This object shows the seller's domestic return policy for a listing, which includes whether or not the seller accepts returns for the item and the duration of the return period. Note that if the listing only has a domestic return policy set up, but the item is shipped internationally, the settings in this object will also apply to international returns.
- **internationalReturnTerms** (ReturnTermsDetails)
  - This object shows the seller's international return policy for a listing, which includes whether or not the seller accepts international returns for the item and the duration of the return period. This object is only applicable if the seller has a separate international return policy set up for the listing.
- **returnInstructions** (String)
  - This free-form text field provides more details about a seller's return policy. Currently, this field is only supported on the Germany, Austria, France, Italy, and Spain marketplaces.

### ReturnTermsDetails
**Description:** This type is used to state the seller's domestic or international return policy for a listing, which includes whether or not the seller accepts returns for the item and the duration of the return period.
**Type:** GraphQLObjectType

**Properties:**
- **listingRefundMethod** (ListingRefundMethod)
  - The enumerated value returned here indicates how a buyer will be refunded if an item is returned. This is a mandatory field if the seller accepts returns for the item.
- **returnAccepted** (Boolean)
  - This boolean field indicates whether or not the seller allows the buyer to return the item. This field is mandatory for return policies and returned as \`true\` if the seller accepts returns for the item or \`false\` if the seller does not accept returns for the item.
- **returnDuration** (ListingTimeDuration)
  - The enumerated value returned in this field indicates the amount of time that the buyer has to return an item. The return period begins when the item is marked 'delivered' at the buyer's specified ship-to location. This field is mandatory if the seller accepts returns for the item.
- **returnShipmentInvoicee** (Invoicee)
  - The enumerated value returned here indicates either the buyer or the seller as the party who pays for return shipping charges. This is a mandatory field if the seller accepts returns for the item. \*\*Note\*\*: The seller is always responsible for return shipping costs when an item is being returned due to a Significantly not as described (SNAD) issue.

### ListingDistance
**Description:** This type is used to indicate the radius for a Motors local listing, making it available to buyers within that specified area. The seller's supplied \*\*postalCode\*\* or \*\*location\*\* field value will be used as the center point for this radius.
**Type:** GraphQLObjectType

**Properties:**
- **distance** (Int)
  - The numeric value for the radius. The unit of measurement for this value is specified in the \*\*distanceUnit\*\* field. This value defines the radius of the area around the seller's location where the listing will be visible to local buyers.
- **distanceUnit** (DistanceUnit)
  - The unit of measure for the distance.

### RegulatoryInfo
**Description:** This type is used to show various types of regulatory information for a listing, including energy efficiency labels, hazardous material information, product safety information, and more. Based on the listing category, sellers doing business in an EU country or Northern Ireland may be legally required to provide some of this regulatory information for listings.
**Type:** GraphQLObjectType

**Properties:**
- **documents** ([RegulatoryDocument!])
  - This object is used specify regulatory document ids information for the listing.
- **energyEfficiencyLabel** (EnergyEfficiencyLabel)
  - This object provides information about the energy efficiency for certain durable goods.
- **hazardousMaterial** (HazardousMaterial)
  - This object is used by the seller to provide hazardous material information for the listing.
- **manufacturer** (Manufacturer)
  - The contact details for the European manufacturer of a product.
- **productSafety** (ProductSafety)
  - This object is used by the seller to provide product safety information for the listing.
- **repairIndexScore** (Decimal)
  - This field represents the repair index for the listing.The repair index identifies the manufacturer's repair score for a product (how easy is it to repair the product). This field is a floating point value between 0 and 10
- **responsiblePersons** ([ResponsiblePerson!])
  - The contact details for the Responsible Person along with Person Type, for the a product.

### RegulatoryDocument
**Description:** This type is used to show the regulatory documents that are attached to the listing. These documents provide various types of regulatory information for a listing, including energy efficiency labels, hazardous material information, product safety information, and more. Based on the listing category, sellers doing business in an EU country or Northern Ireland may be legally required to provide some of this regulatory information for listings.
**Type:** GraphQLObjectType

**Properties:**
- **id** (ID)
  - This field specifies the document ID of the document that is associated with the listing.

### EnergyEfficiencyLabel
**Description:** This type provides information about the energy efficiency for certain durable goods
**Type:** GraphQLObjectType

**Properties:**
- **image** (ListingImage)
  - The Energy Efficiency Label image that is applicable to an item. This field is required if an Energy Efficiency Label is provided. The URL provided must be an eBay Picture Services (EPS) URL only.
- **imageDescription** (String)
  - A brief verbal summary of the information included on the Energy Efficiency Label for an item.
- **productInformationSheetUrl** (HttpsUrl)
  - The URL to the Product Information Sheet image that is applicable to an item. This field is required if an Energy Efficiency Label is provided, and the URL provided must be an eBay Picture Services (EPS) URL using 'https'.

### ListingImage
**Description:** This type is used to show the URL of an image that is attached to an eBay listing and the display order of that image in the View Item gallery. If the seller used an externally-hosted image, the URL of that image is also shown.
**Type:** GraphQLObjectType

**Properties:**
- **ebayImageUrl** (HttpsUrl)
  - The fully-qualified eBay Pictures Services (ePS) URL to an image that is attached to the listing.
- **externalImageUrl** (HttpsUrl)
  - The fully-qualified URL to an image that is hosted on an external server for which an ePS image was created for and attached to the listing. This field will only be shown to the seller and only if a URL for am image on an external server was provided when the seller created or revised the listing.
- **order** (Int)
  - Seller provided order of the picture in which the image should be displayed.

### HazardousMaterial
**Description:** This type is used by the seller to provide hazardous material information for the listing.
**Type:** GraphQLObjectType

**Properties:**
- **additionalInformation** (String)
  - Additional information seller provides about the hazardous material in this listing.
- **pictogramCodes** ([ID!])
  - This array specifies one or more pictogram codes that represent the possible hazards that a product poses. The pictograms that are stated on the product's Safety Data Sheet should be used. Use the \[getHazardousMaterialsLabels\](https://developer.ebay.com/api-docs/sell/metadata/resources/marketplace/methods/getHazardousMaterialsLabels) method to retrieve the codes that can be provided in this array. The pictogram(s) that the code(s) represent are painted on the listing. \*\*Maximum number of pictogram codes allowed\*\*: 4 pictograms
- **signalWordCode** (ID)
  - The signal word for hazardous materials in the listing. If your product contains hazardous substances or mixtures. \*\*Example Value\*\*: Danger, Warning
- **statementCodes** ([ID!])
  - This object is used by the seller to provide hazard statements for the listing. This field is required if hazmat information is supplied. This field is an empty list if there are no hazard statements. This should not be null unless an error has occurred. Please see the error section of the response for more details

### Manufacturer
**Description:** This type provides the name and contact information for the manufacturer of the item. As a part of General Product Safety Regulation (GPSR) requirements, sellers operating in, or shipping to EU-based countries or Northern Ireland are conditionally required to provide product manufacturer information in their eBay listings.
**Type:** GraphQLObjectType

**Properties:**
- **address** (BusinessEntityAddress)
  - The street address for the product manufacturer is provided in this object.
- **companyName** (String)
  - The name of the company that manufactured the product.
- **contact** (BusinessEntityContact)
  - This object is used to provide the phone number, email address, and/or the Contact/Support page URL for the product manufacturer. At least one of the three is required if manufacturer information is supplied.

### BusinessEntityAddress
**Description:** This type shows the street address for a business entity such as the product manufacturer or responsible person.
**Type:** GraphQLObjectType

**Properties:**
- **addressLine1** (String)
  - The first line of the entity's street address.
- **addressLine2** (String)
  - The second line of the entity's street address. This field is not always used, but can be used for secondary address information such as 'Suite Number' or 'Apt Number'.
- **city** (String)
  - The city of the entity's street address.
- **country** (CountryAlpha2Code)
  - The two-letter ISO 3166-1 standard abbreviation of the country of the entity's address.
- **postalCode** (String)
  - The postal code of the entity's street address.
- **stateOrProvince** (String)
  - The state or province of the entity's street address.

### BusinessEntityContact
**Description:** This type shows the contact information of a product manufacturer or an EU Responsible Person, and this information includes an email address, a phone number, and/or a contact URL. At least one of the three forms of contact for a product manufacturer or an EU Responsible Person must be provided.
**Type:** GraphQLObjectType

**Properties:**
- **contactUrl** (HttpOrHttpsUrl)
  - This field shows the entity's contact/support URL.
- **email** (String)
  - This field shows the entity's email address.
- **phone** (String)
  - This field shows the entity's phone number.

### ProductSafety
**Description:** This type is used by the seller to provide product safety information for the listing.
**Type:** GraphQLObjectType

**Properties:**
- **additionalInformation** (String)
  - Additional information seller provides about the product safety information in this listing.
- **pictogramCodes** ([ID!])
  - This field sets the pictogram code(s) for product safety Pictogram(s) for the listing. If your product contains substances or mixtures, please select the values corresponding to the hazard pictograms that are stated on your product's Safety Data Sheet. This field is an empty list if there are no pictogram codes. This should not be null unless an error has occurred. Please see the error section of the response for more details.
- **statementCodes** ([ID!])
  - This object is used by the seller to provide product safety information for the listing. This field is required if product safety information is supplied. This field is empty if there are no statement codes. This should not be null unless an error has occurred. Please see the error section of the response for more details.

### ResponsiblePerson
**Description:** This type is used to provide the name and contact information for one or more responsible persons based in the EU.
**Type:** GraphQLObjectType

**Properties:**
- **address** (BusinessEntityAddress)
  - This object shows the street address for a responsible person.
- **companyName** (String)
  - This field shows the company name associated with the responsible person.
- **contact** (BusinessEntityContact)
  - This object shows the phone number, email address, and/or the Contact/Support page URL for the responsible person. A seller must provide at least one of the three is required if a responsible person is supplied.
- **personTypes** ([String!])
  - This array shows the responsible person type, and the only supported value is \`EU\_RESPONSIBLE\_PERSON\`.

### TaxInfo
**Description:** This type shows sales tax information for an item in a specific tax jurisdiction
**Type:** GraphQLObjectType

**Properties:**
- **salesTaxApplicableToShipping** (Boolean)
  - This boolean field indicates whether or not the seller wants the sales tax rate for the jurisdiction to apply to the cumulative amount of item cost and shipping charges. This field is only applicable if the \*\*salesTaxPercentage\*\* and \*\*salesTaxJurisdictionId\*\* fields are also set.
- **salesTaxJurisdictionId** (String)
  - The unique identifier of the US territory or a Canadian province that will be charged the sales tax rate specified in the \*\*salesTaxPercentage\*\* field. The supported US territories are \`AS\` (America Samoa), \`GU\` (Guam), \`MP\` (Northern Mariana Islands), \`PW\` (Palau), and \`VI\` (US Virgin Islands). The two-letter codes for Canadian provinces can be found here on the \[Government of Canada\](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/completing-slips-summaries/financial-slips-summaries/return-investment-income-t5/provincial-territorial-codes.html) website.
- **salesTaxPercentage** (Decimal)
  - This field indicates the sales tax rate for the corresponding US territory or a Canadian province. The percentage set here will be applied to sale price as the sales tax for the order line item. This field is only applicable on the US and Canadian marketplaces.
- **salesTaxTableUsed** (Boolean)
  - This field indicates whether or not the seller has an account level sales tax table set up and wishes to use the sales tax rates set up in that table. If this field is returned as \`true\`, the values contained in the other sales tax fields (if returned) in this object will be overridden by the values set in the sales tax table. \*\*Default value\*\*: false
- **thirdPartyTaxCategoryCode** (String)
  - A tax exception category code. This field indicates a special category of tax such as a recycling fee or disposal tax. These special tax category codes can only be used by sellers who have opted into sales tax being calculated by a sales tax calculation vendor.
- **vatPercentage** (Decimal)
  - The VAT (Value-added Tax) percentage rate that will be charged to buyers when an item is purchased from the listing. VAT is not applicable to all countries, including the US. Allowed VAT percentage rates can vary by region/country, so sellers should be aware of the rates they are legally required/allowed to charge, and they are responsible for charging the correct VAT rate. Only one digit is allowed to the right of the decimal point.
- **vatRecognizedBusinessSeller** (Boolean)
  - This field is returned as \`true\` if the seller is registered on the listing site as a Business Seller and intends to use listing features that are offered to business users only. This field will always be \`true\` if the \*\*vatRestrictedToBusinessUser\*\* field is set to \`true\`.
- **vatRestrictedToBusinessUser** (Boolean)
  - This field is returned as \`true\` if a business seller wishes to make the listing exclusively available to potential buyers registered on eBay as business users. If false (or not returned), this indicates that the seller elects to offer the item to all users. This feature is only applicable to business sellers residing in Germany, Austria, or Switzerland who are listing in a B2B VAT-enabled category on the eBay Germany (DE), Austria (AT), or Switzerland (CH) sites.

### ListingVisualEnhancements
**Description:** This type is used to indicate listing upgrades enabled by the seller such as bold titles in search results, \*\*Gallery Plus\*\*, or an added subtitle.
**Type:** GraphQLObjectType

**Properties:**
- **boldTitle** (Boolean)
  - This boolean field indicates whether or not the seller is using boldface type for the listing title. If returned as \`true\`, the listing title will appear in boldtype in search results for greater visibility. This feature cannot be enabled for a motor vehicle listing. \*\*Default\*\*: false
- **galleryPlus** (Boolean)
  - This boolean field indicates whether or not the seller using the \*\*Gallery Plus\*\* feature for the listing. With \*\*Gallery Plus\*\*, a larger gallery image of the item is displayed in search results. This feature cannot be enabled for a motor vehicle listing. \*\*Default\*\*: false
- **subtitle** (String)
  - This field will be returned if the seller has included a customized subtitle for the listing. The text of that subtitle will appear in this field if set.

### SellerProduct
**Description:** This type is used to provide common product details for the listing, including product aspects, title, description, condition, images, and more.
**Type:** GraphQLObjectType

**Properties:**
- **aspects** ([NameValuesPair!])
  - An array of name-value pairs that define the product aspects. For a multiple-variation listing, only the common aspects will be specified in this array, and the pivoting aspects (aka traits) will be specified at the item variation level.
- **categories** (ListingCategory)
  - This object shows is used to provide the eBay and eBay store categories where the item is listed.
- **description** (String)
  - The full description of the product. This is a mandatory field for a listing. \*\*Note\*\*: This field may contain HTML markup and inline CSS, and may be up to 500,000 characters including the HTML and CSS tags and attributes.
- **ebayGeneratedTitle** (String)
  - The eBay-generated title of a motor vehicle listing, which will consist of the Make, Model, Year, etc. of the vehicle. This title will be shown in search results and on the View Item page. For all other listings, the seller-defined title will appear in the \*\*title\*\* field instead.
- **images** ([ListingImage!])
  - An array of images used for the listing and appearing in the listing's photo gallery. eBay listings require at least one image, so this array should never be null.
- **includesCompatibilities** (Boolean)
  - This boolean field Indicates whether or not the listing has an attached list of compatible vehicles for a Parts & Accessories item.
- **itemCompatibilities** ([ItemCompatibility!])
  - This array is used to define the motor vehicles or assemblies that are compatible with a Parts & Accessories item. This structured compatibility information helps buyers filter and find parts that are compatible with their specific vehicles. Year, Make, and Model are typical aspects used to identify a motor vehicle.
- **itemCondition** (ItemCondition)
  - This object is used to express the condition of the item(s) in this listing. A large majority of eBay categories require a condition, and this condition is specified through a numeric identifier in the \*\*conditionId\*\* field. For non-new items, the \*\*conditionDescription\*\* may be used by the seller to provide specific details about the item's condition or 'wear and tear'. The \*\*conditionDescriptor\*\* array is returned for graded and ungraded trading cards and provides condition details in a structured manner.
- **motorVehicleIdentifier** (ListingMotorVehicleIdentifier)
  - This object shows the Vehicle Identification Number (VIN) or the Vehicle Registration Mark (VRM) for the motor vehicle.
- **title** (String)
  - The title of the listing. This title will be shown in search results and on the View Item page. If the listing is for a motor vehicle, the title will be shown in the \*\*ebayGeneratedTitle\*\* field instead and will consist of the Make, Model, Year, etc. of the vehicle.
- **videos** ([Video!])
  - This array shows the unique identifier of a product video. This video ID will only be shown to the seller of the listing. The \*\*getVideo\*\* method can be used to retrieve metadata and status of the video. Currently, only one video may be added to each listing.

### NameValuesPair
**Description:** This type provides for pairs of names and values.
**Type:** GraphQLObjectType

**Properties:**
- **name** (String)
  - The name of this name-value pair.
- **values** ([String!])
  - The values of this name-value pair.

### ListingCategory
**Description:** This type provides for the category information of the item listed in current listing.
**Type:** GraphQLObjectType

**Properties:**
- **primaryCategory** (Category!)
  - The unique identifier of an eBay category. This is always required.
- **secondaryCategory** (Category)
  - The unique identifier of an eBay category. Returned only if it is specified by the seller.
- **storePrimaryCategory** (StoreCategory)
  - The unique identifier of a primary custom category in which to list the item. A custom category is a category that the seller created in their eBay Store.
- **storeSecondaryCategory** (StoreCategory)
  - The unique identifier for the secondary custom category in which to list the item. This field is set to a root-level custom category or a custom category that has no child categories (subcategories). Returned only if it is specified by the seller.

### StoreCategory
**Description:** This type is used to identify a custom store category in which to list the item.
**Type:** GraphQLObjectType

**Properties:**
- **id** (ID!)
  - The unique identifier of the eBay Store category.

### ItemCompatibility
**Description:** This type defines a list of parts compatibility information specified as name and value pairs. Describes an assembly with which a part is compatible (i.e., compatibility by application).
**Type:** GraphQLObjectType

**Properties:**
- **compatibilities** ([NameValuesPair])
  - A name-value pair describing a single compatible application. The allowed names and values are specific to the primary category in which the item is listed. For example, when listing in a \*\*Parts & Accessories\*\* category, where the applications are vehicles, the allowed names might include \*\*Year\*\*, \*\*Make\*\*, and \*\*Model\*\*, and the values would correspond to specific vehicles in eBay's catalog.
- **compatibilityNotes** (String)
  - The seller may optionally enter any notes pertaining to the parts compatibility being specified. For example, if this Compatibility information applies to a vehicle, a seller may use this field to specify the placement of the part on a vehicle or the type of vehicle a part fits.

### ItemCondition
**Description:** This type defines the fields that describe a specific item condition within a category.
**Type:** GraphQLObjectType

**Properties:**
- **category** (Category!)
  - This field returns information about the category associated with the item condition.
- **descriptors** ([ConditionDescriptor!]!)
  - This array returns the condition descriptors applicable to the specified item condition. \*\*Note:\*\* This array is only returned for categories that support condition descriptors.
- **displayName** (String!)
  - The display name for the item condition. \*\*Note\*\*: This name is localized for the specified marketplace by default. The \*\*Accept-Language\*\* header can be used to provide a translation to a different language from the marketplace default language.
- **itemConditionId** (ID!)
  - The unique identifier of the item condition.
- **shortDisplayName** (String)
  - The short display name for the item condition. This field can be returned as null if no short name is available. \*\*Note\*\*: This text is localized for the specified marketplace by default. The \*\*Accept-Language\*\* header can be used to provide a translation to a different language from the marketplace default language.
- **conditionDescription** (String)
  - This field is used to provide additional details about a non-new item's physical state, including any defects, wear, or other characteristics that affect its condition. This field can be used for all categories except those that require the \*\*conditionDescriptors\*\* array.
- **conditionDescriptors** ([ListingConditionDescriptor!])
  - This array is used to provide more item condition information through name-value pairs about single graded and ungraded trading cards in the following categories: \*Non-Sport Trading Card Singles (183050)\*, \*CCG Individual Cards (183454)\*, and \*Sports Trading Card Singles (261328)\*. Graded cards require the \*\*Grader\*\* and the \*\*Grade\*\* descriptors, while ungraded cards require a \*\*Card Condition\*\* descriptor unique to trading cards, such as 'Near mint or better'. If there are no condition descriptors, this array will be empty. This field will be null if there is an error. You can find more details in the errors section of the response.

### ConditionDescriptor
**Description:** This type is used to provide additional information, such as characteristics or attributes, about the condition of an item in a structured format.
**Type:** GraphQLObjectType

**Properties:**
- **acceptsFreeText** (Boolean!)
  - This boolean indicates whether the condition descriptor supports free text or predefined values only. If \`true\`, the descriptor allows user-entered text as values. If \`false\`, the value must be selected from the predefined list of values specified in the \*\*conditionDescriptorValues\*\* field.
- **category** (Category!)
  - This field returns information about the category associated with the item condition.
- **conditionDescriptorId** (ID!)
  - The unique identifier of the condition descriptor.
- **conditionDescriptorValues** ([ConditionDescriptorValue!]!)
  - This array returns a list of possible condition descriptor values for given condition descriptor name, applicable for the specified item condition. This field maps to the corresponding \*\*displayName\*\* field, and acts as the value for the associated condition descriptor name.
- **displayName** (String!)
  - The display name of the condition descriptor. \*\*Note:\*\* This text is localized for the specified marketplace by default. The \*\*Accept-Language\*\* header can be used to provide a translation to a different language from the marketplace default language.
- **maximumLength** (Int)
  - The maximum allowed length for user-entered text. This field is only applicable if the \*\*acceptsFreeText\*\* boolean is \`true\`. If the \*\*acceptsFreeText\*\* boolean is \`false\`, this field returns null as only predefined values are supported.
- **multipleValuesSupported** (Boolean!)
  - This boolean indicates if multiple values can be selected for this descriptor. If \`true\`, multiple values are supported for this descriptor. If \`false\`, only one value can be selected for this descriptor.
- **parentDescriptor** (ConditionDescriptor)
  - If applicable, this object returns information about the parent descriptor that can filter values based on its selected value. This object will be returned null if no parent descriptor exists.
- **required** (Boolean!)
  - This boolean indicates if the condition descriptor is required for listing submissions. If \`true\`, the condition descriptor is required for listing submission.

### ConditionDescriptorValue
**Description:** This type represents a specific value associated with a condition descriptor.
**Type:** GraphQLObjectType

**Properties:**
- **category** (Category!)
  - This field returns information about the category associated with the item condition.
- **conditionDescriptorValueId** (ID!)
  - The unique identifier for the condition descriptor value.
- **displayName** (String!)
  - The display name for the condition descriptor value. \*\*Note\*\*: This text is localized for the specified marketplace by default. The \*\*Accept-Language\*\* header can be used to provide a translation to a different language from the marketplace default language.

### ListingConditionDescriptor
**Description:** This type defines the details of the item condition descriptors and associated values.
**Type:** GraphQLObjectType

**Properties:**
- **additionalInformation** (String)
  - This field provides additional information about a condition descriptor. One example is using this field to specify the \*\*Certification Number\*\* for a graded card.
- **conditionDescriptor** (ConditionDescriptor)
  - The name of the condition descriptor.
- **conditionDescriptorValues** ([ConditionDescriptorValue!])
  - The value of the condition descriptor.

### ListingMotorVehicleIdentifier
**Description:** This type is needed for motor vehicle listings to provide the Vehicle Identification Number (VIN) or the Vehicle Registration Mark (VRM) for the motor vehicle. If this type is provided, then either vin or vrm will be present.
**Type:** GraphQLObjectType

**Properties:**
- **vin** (ID)
  - The Vehicle Identifier Number (VIN) of the motor vehicle that is to be sold. The VIN or the VRM IDs are needed for motor vehicle listings.
- **vrm** (ID)
  - The Vehicle Registration Mark (VRM) of the motor vehicle that is to be sold. The VIN or the VRM IDs are needed for motor vehicle listings.

### Video
**Description:** This type defines the fields that represent a video and its associated metadata.
**Type:** GraphQLObjectType

**Properties:**
- **videoId** (ID!)
  - The unique identifier of the video.
- **description** (String)
  - The description of the video. \*\*Note:\*\* This field returns \`null\` if the video was uploaded without a description. \*\*Maximum length\*\*: 4096 characters
- **expiresAt** (DateTime!)
  - The date and time when an unused video will expire, in ISO-8601 format (for example, \`2026-01-01T12:00:00Z\`). As long as a video is being used in an active listing, that video will remain on the server and be accessible. If a video is not being used on an active listing, its expiration date is automatically set to 30 days after the video's initial upload.
- **height** (Int)
  - The height of the video in pixels. \*\*Note:\*\* This field returns '0' if video status is \`PROCESSING\_FAILED\`.
- **moderation** (VideoModeration)
  - If applicable, this object returns the reason why the video is blocked by moderators. \*\*Note\*\*: This object returns \`null\` if the video is not blocked by eBay moderation policies.
- **playlists** ([VideoPlaylist!])
  - This array returns the playlist created for the uploaded video, which provides the streaming video URLs to play the video. \*\*Note:\*\* This array is only returned when the video status is \`LIVE\`.
- **processingFailure** (VideoProcessingFailureReason)
  - This object returns error details if video processing has failed. \*\*Note:\*\* This object is only returned when the video status is \`PROCESSING\_FAILED\`.
- **size** (Int!)
  - The size of the video file in bytes.
- **status** (VideoStatusEnum!)
  - The current status of the video processing.
- **thumbnail** (VideoThumbnail)
  - The URL of the thumbnail image of the video. \*\*Note:\*\* This object returns \`null\` if no thumbnail was provided during video upload, and video status is not \`LIVE\`.
- **title** (String)
  - The title of the video. \*\*Note:\*\* This field returns \`null\` if the video was uploaded without a title. \*\*Maximum length\*\*: 1024 characters
- **videoDuration** (Duration)
  - The duration of the video in ISO-8601 format (for example, \`PT15S\` for 15 seconds). \*\*Note:\*\* This object returns \`null\` if the status of the video is not \`LIVE\`.
- **width** (Int)
  - The width of the video in pixels. \*\*Note:\*\* This field returns \`0\` if video status is \`PROCESSING\_FAILED\`.

### VideoModeration
**Description:** This type defines the reason(s) why the specified video was blocked by moderators.
**Type:** GraphQLObjectType

**Properties:**
- **rejectReasons** ([VideoRejectReasonEnum!]!)
  - This array returns a list of one or more reasons why the video failed moderation and was blocked from being published.

### VideoPlaylist
**Description:** This type represents a streaming endpoint for a video, providing the URL to access the content. \*\*Note:\*\* This type is only applicable when a video has been successfully processed and has a status of \`LIVE\`.
**Type:** GraphQLObjectType

**Properties:**
- **playUrl** (HttpOrHttpsUrl!)
  - The playable URL for this video. \*\*Maximum length\*\*: 120 characters
- **protocol** (VideoPlaylistProtocolEnum!)
  - The streaming protocol for the video playlist. Supported protocols include \`DASH\` and \`HLS\`.

### VideoCorruptedError
**Description:** This type indicates that processing failed because the video file is corrupted or unreadable.
**Type:** GraphQLObjectType

**Properties:**
- **category** (VideoProcessingFailureCategoryEnum!)
  - The high-level error category indicating the type of failure.
- **message** (String!)
  - A non-localized error message describing the processing failure. \*\*Maximum length\*\*: 150 characters

### VideoInternalProcessingError
**Description:** This type indicates that a generic internal error occurred.
**Type:** GraphQLObjectType

**Properties:**
- **category** (VideoProcessingFailureCategoryEnum!)
  - The high-level error category indicating the type of failure.
- **message** (String!)
  - A non-localized error message describing the processing failure. \*\*Maximum length\*\*: 150 characters

### VideoInvalidInputValidationError
**Description:** This type indicates that processing failed due to invalid input data provided during upload.
**Type:** GraphQLObjectType

**Properties:**
- **category** (VideoProcessingFailureCategoryEnum!)
  - The high-level error category indicating the type of failure.
- **message** (String!)
  - A non-localized error message describing the processing failure. \*\*Maximum length\*\*: 150 characters

### VideoInvalidMediaStreamError
**Description:** This type indicates that processing failed due to an invalid video or audio codec/stream.
**Type:** GraphQLObjectType

**Properties:**
- **category** (VideoProcessingFailureCategoryEnum!)
  - The high-level error category indicating the type of failure.
- **message** (String!)
  - A non-localized error message describing the processing failure. \*\*Maximum length\*\*: 150 characters

### VideoModerationFailedError
**Description:** This type indicates that processing failed due to a system error during moderation.
**Type:** GraphQLObjectType

**Properties:**
- **category** (VideoProcessingFailureCategoryEnum!)
  - The high-level error category indicating the type of failure.
- **message** (String!)
  - A non-localized error message describing the processing failure. \*\*Maximum length\*\*: 150 characters

### VideoPlaylistGenerationError
**Description:** This type indicates that the video was processed, but the final playlist (HLS/DASH) could not be generated.
**Type:** GraphQLObjectType

**Properties:**
- **category** (VideoProcessingFailureCategoryEnum!)
  - The high-level error category indicating the type of failure.
- **message** (String!)
  - A non-localized error message describing the processing failure. \*\*Maximum length\*\*: 150 characters

### VideoProcessingTimeoutError
**Description:** This type indicates that processing took too long and was aborted by the system.
**Type:** GraphQLObjectType

**Properties:**
- **category** (VideoProcessingFailureCategoryEnum!)
  - The high-level error category indicating the type of failure.
- **message** (String!)
  - A non-localized error message describing the processing failure. \*\*Maximum length\*\*: 150 characters

### VideoSystemResourceError
**Description:** This type indicates that processing failed due to insufficient system resources (e.g., out of memory).
**Type:** GraphQLObjectType

**Properties:**
- **category** (VideoProcessingFailureCategoryEnum!)
  - The high-level error category indicating the type of failure.
- **message** (String!)
  - A non-localized error message describing the processing failure. \*\*Maximum length\*\*: 150 characters

### VideoThumbnailGenerationError
**Description:** This type indicates that processing failed during the thumbnail generation step.
**Type:** GraphQLObjectType

**Properties:**
- **category** (VideoProcessingFailureCategoryEnum!)
  - The high-level error category indicating the type of failure.
- **message** (String!)
  - A non-localized error message describing the processing failure. \*\*Maximum length\*\*: 150 characters

### VideoThumbnail
**Description:** This type represents a video thumbnail image.
**Type:** GraphQLObjectType

**Properties:**
- **imageUrl** (HttpOrHttpsUrl!)
  - The URL of the thumbnail image of the video. The URL must match the pattern \`(?i)http(s)?://i.ebayimg.com/.\*\` and be a valid eBay Picture URL.

### OrderReturnDocument
**Description:** This type represents a document associated with an order return. This can include buyer-uploaded images provided during return creation, return shipping labels, and other documents linked to the return.
**Type:** GraphQLObjectType

**Properties:**
- **documentId** (ID!)
  - A unique identifier for the document.
- **documentName** (String!)
  - The original or display name of the document as provided during upload. \*\*Format:\*\* Alphanumeric \*\*Maximum length:\*\* 100 characters
- **uploadedAt** (DateTime!)
  - The timestamp indicating when the document was uploaded.

### Counterfeit
**Description:** This type indicates the item is returned because it is counterfeit. Displays as \*\*Counterfeit\*\*.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable reason code: \`COUNTERFEIT\`.
- **displayText** (String!)
  - A human-readable description of the return reason. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### DamagedItemReceived
**Description:** This type indicates the item is returned because it was damaged when received. Displays as \*\*Damaged item received\*\*.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable reason code: \`DAMAGED\_ITEM\_RECEIVED\`.
- **displayText** (String!)
  - A human-readable description of the return reason. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### Defective
**Description:** This type indicates the item is returned because it is defective. Displays as \*\*Defective\*\*.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable reason code: \`DEFECTIVE\`.
- **displayText** (String!)
  - A human-readable description of the return reason. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### DidNotLikeItem
**Description:** This type indicates the buyer is returning the item due to personal preference (they did not like the item). Displays as \*\*Did not like item\*\*.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable reason code: \`DID\_NOT\_LIKE\_ITEM\`.
- **displayText** (String!)
  - A human-readable return reason that is intended for display only. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### FitCompatibilityIssue
**Description:** This type indicates that the Parts & Accessory item is being returned as the item does not fit the buyer's vehicle and displays as \*\*Fit compatibility issue\*\*.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable reason code: \`FIT\_COMPATIBILITY\_ISSUE\`.
- **displayText** (String!)
  - A human-readable description of the return reason. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### FoundBetterPrice
**Description:** This type indicates the item is returned because the buyer found a better price. Displays as \*\*Found better price\*\*.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable reason code: \`FOUND\_BETTER\_PRICE\`.
- **displayText** (String!)
  - A human-readable return reason that is intended for display only. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### ItemMiscategorized
**Description:** This type indicates the item is being returned to the seller after the authentication partner deemed that the item was miscategorized. Displays as \*\*Item miscategorized\*\*.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable reason code: \`ITEM\_MISCATEGORIZED\`.
- **displayText** (String!)
  - A human-readable description of the return reason. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### ItemNotPickedUp
**Description:** This type indicates the item is returned because the buyer did not pick up the item. Displays as \*\*Item not picked up\*\*.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable reason code: \`ITEM\_NOT\_PICKED\_UP\`.
- **displayText** (String!)
  - A human-readable description of the return reason. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### MissingParts
**Description:** This type indicates the item is returned because one or more parts of the item were missing. Displays as \*\*Missing parts\*\*.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable reason code: \`MISSING\_PARTS\`.
- **displayText** (String!)
  - A human-readable description of the return reason. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### NoLongerNeedItem
**Description:** This type indicates the item is returned because the buyer no longer needs the item. Displays as \*\*No longer need item\*\*.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable reason code: \`NO\_LONGER\_NEED\_ITEM\`.
- **displayText** (String!)
  - A human-readable description of the return reason. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### NotAsDescribed
**Description:** This type indicates the item is returned because it was not as described. Displays as \*\*Item not as described\*\*.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable reason code: \`NOT\_AS\_DESCRIBED\`.
- **displayText** (String!)
  - A human-readable description of the return reason. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### OrderedAccidentally
**Description:** This type indicates the item is returned because the buyer purchased it accidentally. Displays as \*\*Ordered accidentally\*\*.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable reason code: \`ORDERED\_ACCIDENTALLY\`.
- **displayText** (String!)
  - A human-readable return reason that is intended for display only. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### OrderedWrongSize
**Description:** This type indicates the item is returned because the buyer purchased the wrong size. Displays as \*\*Ordered wrong size\*\*.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable reason code: \`ORDERED\_WRONG\_SIZE\`.
- **displayText** (String!)
  - A human-readable return reason that is intended for display only. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters.

### OtherReturnReason
**Description:** This type indicates that item is being returned for other reasons not listed here, and displays as \*\*Other\*\*.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable reason code: \`OTHER\`.
- **displayText** (String!)
  - A human-readable description of the return reason. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### ReturnReasonUndisclosed
**Description:** This type indicates that customer did not disclose the reason for the return and displays as \*\*Undisclosed\*\*.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable reason code: \`UNDISCLOSED\`.
- **displayText** (String!)
  - A human-readable description of the return reason. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### WrongItemReceived
**Description:** This type indicates the item is returned because the buyer received an item that does not match the item ordered. Displays as \*\*Wrong item received\*\*.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable reason code: \`WRONG\_ITEM\_RECEIVED\`.
- **displayText** (String!)
  - A human-readable description of the return reason. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### RmaDetail
**Description:** This type provides Return Merchandise Authorization (RMA) details for the return shipment.
**Type:** GraphQLObjectType

**Properties:**
- **rmaNumber** (String)
  - The human-readable RMA number to include with the return (you can include it on the packing slip or label). \*\*Note:\*\* If the seller has waived the RMA requirement, this field may be omitted or empty. \*\*Format:\*\* Alphanumeric \*\*Maximum length:\*\* 100 characters
- **rmaRequirementWaived** (Boolean!)
  - When \`true\`, the RMA number is not required for this return; \`false\` indicates the seller requires the RMA number to be included.

### ReturnFulfillmentInitiation
**Description:** This type provides details for initiating the return shipment and is optionally present when return fulfillment is to be initiated. Included are available ways to start the return, for example, a seller-provided label or other label that could be used by the buyer or eBay to initiate the return shipment, and address information.
**Type:** GraphQLObjectType

**Properties:**
- **destinationAddress** (ReturnAddress!)
  - The address that has been provided as the return destination address for the return shipment. This address could be a seller address or a facility address if the package has to be routed to an intermediate facility before reaching final destination. Sellers and Buyers are encouraged to use this address for initiating providing the return label.
- **labelProvisionOptions** ([ReturnLabelProvisionOption!])
  - A list of one or more available options for initiating the return shipment. Available actions may vary based on the return and the actor, and include the following: - Use Platform Label - Attach Label to Return - Record Label was sent offline This list is provided only when the return label provisioning options are available for the return. It is omitted if the return label has been already provided.
- **originAddress** (ReturnAddress!)
  - The origin address from which the return shipment will be initiated. This may be the buyer's address or, if the package was routed through an intermediate facility, the facility's address. Buyers and sellers are encouraged to use this address when initiating the return.
- **provisionedLabels** ([ProvisionedReturnLabel!])
  - A list of one or more return labels provisioned to be used to send the return packages. This optionally present return label is not returned if the label is already provisioned for the return shipment.

### ProvisionedReturnLabel
**Description:** This type represents how the return label is provisioned for the return shipment.
**Type:** GraphQLObjectType

**Properties:**
- **provisionOption** (ReturnLabelProvisionOption!)
  - The return label option used to provide the return label.
- **returnLabels** ([ReturnLabel!])
  - A list of one or more return labels provided. This is optionally present label only if available and not provided offline.

### ReturnLabel
**Description:** This type provides details about the return shipment's return label.
**Type:** GraphQLObjectType

**Properties:**
- **labelDocument** (OrderReturnDocument)
  - This field contains the return label document ID. This is the unique identifier for the return shipment label document. \*\*Note:\*\* Use the \*\*Media API\*\* \[downloadPostOrderDocument\](https://developer.ebay.com/api-docs/commerce/media/resources/post\_order/methods/downloadPostOrderDocument) method to download the label. This optional field is not available during the following scenarios. - seller provides only tracking and shipping carrier code for offline methods - return label is from by the buyer
- **shippingCarrier** (ShippingCarrier!)
  - The shipping carrier used for the return shipment.
- **totalLabelCost** (AmountSet)
  - The total label cost for this return label. This optionally present field is only available when the platform label is provided.
- **trackingNumber** (String)
  - The carrier tracking number used to track the return fulfillment status for the return. This optional field will not be present if the tracking number is not provided for the return shipment. \*\*Note:\*\* Some carriers do not have trackable labels.

### ReturnNegotiation
**Description:** This type represents a complete negotiation conversation on return. Current policy supports one offer per negotiation.
**Type:** GraphQLObjectType

**Properties:**
- **latestReturnOffer** (ReturnOffer!)
  - The latest return offer made in the negotiation.

### ReturnOffer
**Description:** This type represents a single return offer made in the context of the return.
**Type:** GraphQLObjectType

**Properties:**
- **proposedTerm** ([ReturnOfferTerm!]!)
  - Offer terms proposed in the return negotiation.
- **status** (ReturnOfferStatus!)
  - The status of return offer that was made in the negotiation.

### KeepItemPartialRefundTerm
**Description:** This type provides details of the partial refund term for negotiation.
**Type:** GraphQLObjectType

**Properties:**
- **itemPriceRefundPercentage** (Int)
  - The percentage of the item's price to refund (1–99). This optional field is only present when the partial offer is specified as a percentage of the item price.
- **itemShippingPriceWaived** (Boolean)
  - This indicates whether the original outbound shipping charge is waived for this item as part of the offer. This optional field is only present when the partial offer includes waiving the shipping charge.
- **refundAmount** (AmountSet!)
  - The total refund amount computed based on the proposed term.
- **returnLineItem** (ReturnLineItem!)
  - The return line item to which these terms apply.

### ReturnOfferAccepted
**Description:** This type indicates the offer has been accepted by the offeree.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable return offer status code: \`ACCEPTED\`.
- **displayText** (String!)
  - The human-readable text for return offer status. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### ReturnOfferDeclined
**Description:** This type indicates the offer has been declined by the offeree.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable return offer status code: \`DECLINED\`.
- **displayText** (String!)
  - The human-readable text for return offer status. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### ReturnOfferExpired
**Description:** This type indicates the offer has expired due to no response from the offeree within the specified time frame.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable return offer status code: \`EXPIRED\`.
- **displayText** (String!)
  - The human-readable text for return offer status. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### ReturnOfferPending
**Description:** This type indicates the offer has been made and is awaiting offeree's response.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable return offer status code: \`PENDING\`.
- **displayText** (String!)
  - The human-readable text for return offer status. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### ReturnCancelled
**Description:** This type indicates that the return was closed without completion and is considered cancelled. Instances when this status applies: - the buyer closes the return request without shipping the item back - eBay closes the return due to timeout occurring due to the following: - an approved return was not shipped back by the buyer within the allowed time - a requested return was not approved by the seller, and the buyer did not ask eBay to step in and assist - eBay closes the return because the buyer filed an external payment dispute
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable return status code: \`CANCELLED\`.
- **displayText** (String!)
  - A human-readable return status. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### ReturnClosed
**Description:** This type indicate the return is closed (is at an end state). This typically indicates that the return lifecycle completed successfully. Instances when this status applies: - the buyer keeps the item and receives a full refund - the buyer ships the item back and receives a full refund - the buyer keeps the item and receives a partial refund after negotiating with seller The refund object provides the refund amount and breakdown, and the return shipment section provides package or shipment details.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable return status code: \`CLOSED\`.
- **displayText** (String!)
  - A human-readable return status. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### ReturnDeclined
**Description:** This type indicates the return is declined by the seller or eBay admin and it's in an end state, in both code and a human-readable description.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable code providing the return status: \`DECLINED\`.
- **displayText** (String!)
  - A human-readable description of the return status. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### ReturnOpen
**Description:** This type indicates the return is approved by the seller or eBay admin, awaiting processing, in both code and a human-readable description.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable code providing the return status: \`OPEN\`.
- **displayText** (String!)
  - A human-readable description of the return status. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### ReturnRequested
**Description:** This type indicates the return is requested by the buyer or eBay administration and is pending approval, in both code and a human-readable description.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable code providing the return status: \`REQUESTED\`.
- **displayText** (String!)
  - A human-readable description of the return status. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### SellerOrderReturnsInput
**Description:** This input type defines the payload for the \*\*sellerOrderReturns\*\* query. This type supports an initial, filtered query and cursor-based pagination for subsequent pages. Use either \*\*initialPage\*\* or \*\*pagination\*\* in a single request, but not both.
**Type:** GraphQLInputObjectType

**Properties:**
- **initialPage** (OrderReturnInitialPageInput)
  - Use this object to provide the filter and sorting parameters for retrieving the first page of results. Call using this field first to obtain a cursor before making any pagination requests. \*\*Note:\*\* Do not use both this field and \`cursor\` in a single request.
- **pagination** (PageInfoInput)
  - Use this object to provide the maximum page size and the cursor parameters for fetching additional (subsequent) pages of results. Use after returning the first page at least once. The filter and sorting parameters use the same filters and sorting as the initial request (\*\*OrderReturnInitialPageInput\*\* parameters in a previous \*\*initialPage\*\* request). This object requires the opaque \`cursor\` returned in \*\*Pagination.nextCursor\*\* or \*\*Pagination.previousCursor\*\*. \*\*Note:\*\* Do not use both this field and the \`initialPage\` field in a single request. Call using \*\*initialPage\*\* before calling using \*\*cursor\*\*.

### OrderReturnInitialPageInput
**Description:** This input type provides filtering and sorting parameters for the first page of a return query. \*\*Note:\*\* The same filters and sort order are also used when returning subsequent pages using cursor-based pagination.
**Type:** GraphQLInputObjectType

**Properties:**
- **filter** (OrderReturnFilterInput!)
  - This object specifies filtering options for order returns, including the action or status filters (such as \`AWAITING\_ACTION\_FROM\_SELLER\` or \`IN\_PROGRESS\`) and a date-range filter. If either field is omitted, the query filters using that field's default value. \*\*Default:\*\* Returns all open returns from the last 30 days that currently require immediate seller action
- **sort** (OrderReturnSortInput!)
  - This object specifies sorting options for order returns including the field to sort by such as \`REQUESTED\_AT\`, and the order of the items returned. Ascending sorts by end time from oldest to newest, while descending sorts by end time from newest to oldest. \*\*Default:\*\* Sort returned order line items by \`REQUESTED\_AT\` in ascending order (\`ASC\`)

### OrderReturnFilterInput
**Description:** This input type specifies filtering and sorting criteria used to narrow down the set of order returns. Filters are combined using a logical \*\*AND\*\*, meaning an item must satisfy every filter you provided to be included.
**Type:** GraphQLInputObjectType

**Properties:**
- **dateRange** (DateTimeRangeInput)
  - This field specifies the creation date range in which to retrieve order returns. If omitted or sent as null, the query returns using the default value. \*\*Default:\*\* Calculates and uses the last 30 days
- **presets** (OrderReturnFilterPreset!)
  - This field specifies an enumerated value to retrieve order returns that match preset filters, such as \`AWAITING\_ACTION\_FROM\_SELLER\`. If omitted, the query filters using the field's default value. \*\*Default:\*\* AWAITING\_ACTION\_FROM\_SELLER (immediate action is required by seller)

### OrderReturnSortInput
**Description:** This input type is used to define the field and sort direction used to order the returned line item results.
**Type:** GraphQLInputObjectType

**Properties:**
- **sortField** (OrderReturnSortField)
  - Specifies the field by which the order line item results are sorted. \*\*Default:\*\* Sorts by the date the return was requested
- **sortOrder** (SortOrder)
  - Specifies the sort direction of the order lines items returned in the result, either: \* \`ASC\` ascending (oldest to newest) \* \`DESC\` descending (newest to oldest) \*\*Default:\*\* \`ASC\`

### OrderReturnInput
**Description:** This input type defines the payload for the \*\*orderReturn\*\* query which specifies the return ID to return information about a specific return.
**Type:** GraphQLInputObjectType

**Properties:**
- **returnId** (ID!)
  - The unique identifier of a specific return. Use this ID to specify the information for a specific return.

### ApproveReturnInput
**Description:** This input type defines the payload for the \*\*approveReturn\*\* mutation, which allows the seller to approve a return. In order to use this mutation, the user must have permission to access and approve the specified return.
**Type:** GraphQLInputObjectType

**Properties:**
- **approvalNote** (String)
  - An optional message from the seller to the buyer regarding the overall approval. The message is stored as provided and not localized. \*\*Minimum length:\*\* 1 character \*\*Maximum length:\*\* 500 characters
- **returnId** (ID!)
  - The unique identifier of the Return to approve. This must be a valid return request that the user has permission to access and approve.

### RecordReturnLabelSentOfflineInput
**Description:** This input type defines the payload for the \*\*recordReturnLabelSentOffline\*\* mutation used to record the return label as sent for the return. Sellers or eBay partners use this mutation to indicate that they have sent the return label to the buyer.
**Type:** GraphQLInputObjectType

**Properties:**
- **offlineReturnLabelChannel** (OfflineReturnLabelChannelInput!)
  - returnLabelProvisionOfflineChannel is used to provide the channel through which the return label was provided to the buyer.
- **returnId** (ID!)
  - The unique identifier of the Return for which the return label is being marked as sent. This must be a valid return ID that the user has permission to access.
- **trackings** ([ReturnLabelTrackingInput!])
  - This field is used to provide carrier and tracking information for the return shipment label that has been sent. This is optional and if not provided indicates that the return label has been sent for untracked shipping carriers.

### ReturnLabelTrackingInput
**Description:** This type is used to provide the carrier and tracking information for the return shipment label that has been sent.
**Type:** GraphQLInputObjectType

**Properties:**
- **labelSentAt** (DateTime)
  - The date when the return shipment label was sent to the buyer. If this optional field is not provided, the current date will be used as the label sent date.
- **shippingCarrier** (ReturnShippingCarrierInput!)
  - The standardized carrier details (for example, UPS, USPS, FEDEX) for the return shipment. It is not nullable, but the entire object may be omitted if tracking info is unavailable.
- **trackingNumber** (String!)
  - The tracking number for the return shipment.

### ReturnShippingCarrierInput
**Description:** This input type specifies the shipping carrier for return fulfillment, including the eBay-standard carrier code and, when applicable, the name of an unsupported carrier.
**Type:** GraphQLInputObjectType

**Properties:**
- **carrierCode** (String!)
  - The eBay-standard carrier code for the shipping carrier which must match one of the supported eBay carrier codes for the marketplace. Use the special value \`UNSUPPORTED\` if the carrier is not supported or recognized by eBay for the marketplace. For unsupported carriers, provide the carrier name in the \*\*unsupportedCarrierName\*\* field. \*\*Note:\*\* Use the \*\*Metadata API\*\* [getShippingCarriers](\"https://developer.ebay.com/api-docs/sell/metadata/resources/shipping:marketplace/methods/getShippingCarriers\") method to retrieve \*\*shippingCarrier\*\* codes for an eBay marketplace.
- **unsupportedCarrierName** (String)
  - The carrier name as provided by the user when the carrier is not recognized by eBay Marketplace. This optional field is only applicable when \`carrierCode\` is set to \`UNSUPPORTED\`.

### ProposeKeepItemWithPartialRefundInput
**Description:** This input type defines the payload for the \*\*proposeKeepItemWithPartialRefund\*\* mutation. This type contains fields to offer a partial refund for the buyer to keep the item on an existing return, including the shipping disposition.
**Type:** GraphQLInputObjectType

**Properties:**
- **keepItemPartialRefundTerms** ([KeepItemPartialRefundTermInput!]!)
  - An array of one or more item-level partial-refund terms included in the offer. Each term applies to a specific return line item.
- **returnId** (ID!)
  - The unique identifier of the Return for which the keep-item-with-partial-refund offer is being proposed (target the return). This must be a valid return ID that the user has permission to access.

### KeepItemPartialRefundTermInput
**Description:** This type defines the terms for a partial-refund on a specific return line item in a keep-item offer.
**Type:** GraphQLInputObjectType

**Properties:**
- **itemPriceRefundPercentage** (Int!)
  - The percentage of the item's price to refund (1–99). For example, if \`20\`, this means refund the seller to refund 20% of the item price if the buyer accepts and keeps the item.
- **itemShippingPriceWaived** (Boolean!)
  - If \`true\`, the original outbound shipping charge for this item as part of the offer is waived; if \`false\`, it is not waived.
- **returnLineItemId** (ID!)
  - The unique identifier of the return line item ID to which these terms apply.

### AttachReturnShipmentLabelInput
**Description:** This input type defines the payload for the \*\*attachReturnShipmentLabel\*\* mutation is used to attach label for the return shipment.
**Type:** GraphQLInputObjectType

**Properties:**
- **returnId** (ID!)
  - The unique identifier of the Return for which the shipping label information is being provided. This must be a valid return ID that the user has permission to access.
- **returnShipmentLabels** ([ReturnShipmentLabelInput!]!)
  - This field is used to provide a return shipment label for the return shipment.

### ReturnShipmentLabelInput
**Description:** This type is used to provide the return shipment label information when a label has not been automatically selected by eBay.
**Type:** GraphQLInputObjectType

**Properties:**
- **documentId** (String!)
  - The unique identifier for the uploaded return shipment label.
- **shippingCarrier** (ReturnShippingCarrierInput!)
  - The standardized carrier details (for example, UPS, USPS, FEDEX) for the return shipment. It is not nullable, but the entire object may be omitted if tracking information is unavailable.
- **trackingNumber** (String)
  - The carrier-assigned tracking ID for the return shipment. This optional field is present only when the shipment uses a tracked shipping carrier.

### ProcessReturnRefundInput
**Description:** This input type defines the payload for the \*\*processReturnRefund\*\* mutation which is used to process refund for a return based on the refund policy for the return. If the returned item is used, altered, or damaged, eligible sellers may withhold an amount from the buyer's refund to cover loss in value.
**Type:** GraphQLInputObjectType

**Properties:**
- **returnId** (ID!)
  - The unique identifier of the Return for which the refund is being issued. This must be a valid return request that the user has permission to access.
- **returnLineItemRefundWithholdings** ([ReturnLineItemRefundWithholdInput!])
  - Use this field to specify the line-item level refund withholds for the return, including the withholding percentage and shipping cost. This field is optional. If not provided, the refund will be issued according to the return's refund policy.

### ReturnLineItemRefundWithholdInput
**Description:** This input type specifies the line-item level refund withholds for the return.
**Type:** GraphQLInputObjectType

**Properties:**
- **returnLineItemId** (ID!)
  - The identifier of the return line item for which the refund withholds are being applied.
- **withholdPercentageOnItemPrice** (Int!)
  - The percentage (1–99) to withhold from the refundable item price. The maximum allowed percentage is determined by the applicable return refund policy.
- **withholdReturnRefundReason** ([WithholdReturnRefundReasonInput!]!)
  - The reason withholding was applied to the refund amount for the return line item. This is to provide context on why the refund amount is being withheld.
- **withholdShippingCostFromRefund** (Boolean!)
  - If \`true\`, the shipping cost is withheld from the refund for this line item. Withholding of shipping cost is subject to the return refund policy and may not be permitted if the policy requires shipping costs to be refunded.

### SendReturnMessageInput
**Description:** This input type defines the payload for the \*\*sendReturnMessage\*\* mutation provides fields for responding to an existing message in a conversation, which provides communication between buyer and seller regarding a return.
**Type:** GraphQLInputObjectType

**Properties:**
- **message** (String!)
  - The reply text to include. The message is stored as provided and not localized. \*\*Maximum length:\*\* 500 characters
- **returnId** (ID!)
  - The unique identifier of the Return which to send a message. This must be a valid return ID that the user has permission to access.

### ProvideRmaNumberInput
**Description:** This input type defines the payload for the \*\*provideRmaNumber\*\* mutation which is used to provide the return merchandise account number for the return.
**Type:** GraphQLInputObjectType

**Properties:**
- **returnId** (ID!)
  - The unique identifier of the Return for which the return merchandise account number is being provided. This must be a valid return ID that the user has permission to access.
- **rmaNumber** (String)
  - The human-readable string containing return merchandise authorization (RMA) number that needs to be included in the return package slip. \*\*Format\*\*: Alphanumeric \*\*Maximum length\*\*: 100 characters
- **rmaRequirementWaived** (Boolean!)
  - If \`true\`, the seller has waived the Return merchandise authorization (RMA) number requirement for this return (the return can be processed without providing an RMA number). This setting overrides the account-level RMA preference.

### RecordReturnReceivedInput
**Description:** This input type defines the payload for the \*\*recordReturnReceived\*\* mutation which manually marks a return as received. It enables sellers and eBay partners to confirm receipt of the returned item from the buyer, typically for non-trackable returns.
**Type:** GraphQLInputObjectType

**Properties:**
- **returnId** (ID!)
  - The unique identifier of the Return which is being marked as received.

### SellerReturnPreferences
**Description:** This type defines return preferences that a seller configures to automate their return workflow. These preferences apply to \*\*listings published\*\* on a specific marketplace. Each marketplace maintains its own independent set of preferences. The options available to sellers vary depending on marketplace capabilities and policies.
**Type:** GraphQLObjectType

**Properties:**
- **listingMarketplace** (ListingMarketplace!)
  - This enumerated value indicates the marketplace where the item is \*\*listed/published\*\* (for example, EBAY\_US, EBAY\_DE, EBAY\_UK). All listings published on this marketplace inherit these preferences.
- **returnAutomationPreference** (ReturnAutomationPreference)
  - This object indicates the seller's automation preferences.
- **rmaPreference** (RmaPreference)
  - This optional field indicates whether a Return Merchandise Authorization (RMA) number must be included on the return label. It is returned only when the seller's RMA preference applies to the specified marketplace: - \`true\`: The RMA number is required on the return label - \`false\`: The RMA number is not required on the return label

### ReturnAutomationPreference
**Description:** This type details a seller's automation preferences.
**Type:** GraphQLObjectType

**Properties:**
- **eligibleReturnAddress** ([ReturnAddress!])
  - The return addresses eligible for use in the seller's automation return preferences. Addresses are available per eBay business policies.
- **listingGroups** ([ReturnRuleListingGroup!])
  - A list of seller-defined listing groups used in return automation rules. These groups can be referenced in rule conditions to target specific listings. Each group may contain a limited number of listings.
- **returnResponseRules** ([ReturnResponseRule!])
  - This list of one or more rules defines the seller-configured respond rules that determine \*\*how\*\* to respond a buyer's return request. Each rule defines the conditions and parameters for an automation decision: - \`APPROVE\_KEEP\_THE\_ITEM\`: Buyer keeps the item and return is approved with Refund. - \`APPROVE\_RETURN\_THE\_ITEM\`: Buyer is instructed to return the item The rules are evaluated in order of priority (lowest numbered first), with the first matching rule produces the approval automation outcome. This is then used to drive subsequent routing through the \*\*returnToAddressRules\*\*.
- **returnToAddressRules** ([ReturnToAddressRule!])
  - This list of one or more rules defines the seller-configured routing rules that determine \*\*where\*\* an approved return should be sent once a buyer is instructed to return the item. Each rule within this list corresponds to the \`RETURN\_TO\_ADDRESS\` automation type and specifies the conditions under which a particular return address (from the eligible address pool) should be used. These routing rules are evaluated before an approval rule (for example, \`APPROVE\_RETURN\_THE\_ITEM\`) has matched, and are prioritized by \`priority\` (lowest first). The first matching rule resolves the \`returnAddressId\` to which the buyer will be directed.

### ReturnRuleListingGroup
**Description:** This type details a group containing listing IDs defined by the seller. Each group can contain up to 5000 listing IDs.
**Type:** GraphQLObjectType

**Properties:**
- **groupName** (String!)
  - The unique seller provided name of the group. \*\*Note:\*\* No two group can have the same name. \*\*Format:\*\* Alphanumeric \*\*Maximum length:\*\* 100 characters
- **listings** ([ListingReference!]!)
  - This array contains listings that are part of this group. - each Listing can be part of multiple group. - listing IDs must be unique within the group \*\*Note:\*\* A maximum of 5000 listing can be added to a group.
- **pagination** (Pagination!)
  - Maximum of 500 listings will be returned in a single page. This value is calculated by the system.
- **returnRuleListingGroupId** (ID!)
  - A unique identifier for the listing group. This value is generated by the system when the group is created.

### ReturnResponseRule
**Description:** This type defines the automated response applied to a return request when specific conditions are met. Evaluated during the approval phase of the return workflow, based on the matching conditions in the \*\*conditionSet\*\* whether to instruct the buyer to return the item or allow the buyer to keep it as specified by the corresponding response strategy defined in \*\*responseStrategy\*\*. When the rule outcome corresponds to: - \`APPROVE\_RETURN\_THE\_ITEM\`: The buyer is instructed to return the item within the specified return window. A refund is issued once the returned item is received or validated. - \`APPROVE\_KEEP\_THE\_ITEM\`: The buyer is allowed to keep the item without returning it, and a refund is issued automatically.
**Type:** GraphQLObjectType

**Properties:**
- **conditionSet** (ReturnRuleConditionSet!)
  - The conditions associated with this rule. Each set can encapsulate multiple \*\*conditions\*\*.
- **name** (String!)
  - The unique name for the rule. No two rules can have the same name. \*\*Allowed characters\*\*: \[A-Z, a-z, 0-9, hyphen(-), underscore(\_), period(.), colon(:), comma(,), apostrophe(')\] \*\*Maximum length:\*\* 100 characters \*\*Format\*\*: Alphanumeric
- **priority** (Int!)
  - The rules are processed by ascending priority value (the lowest priority number first). Evaluation stops at the first matching rule. This means that a rule with priority 1 will always be considered before a rule with priority 5. \*\*Note:\*\* Each rule must have a unique priority number.
- **responseStrategy** (ReturnResponseStrategy!)
  - The automated response to apply when this rule matches.
- **ruleId** (ID!)
  - The unique identifier for the rule.
- **status** (SellerReturnRuleStatus!)
  - The current status of the rule. \*\*Note:\*\* Only rules with \`ENABLED\` status are applied.

### ReturnToAddressRule
**Description:** This type specifies the \*\*returnAddressRoute\*\* that determines how the return address is selected for seller-managed returns.
**Type:** GraphQLObjectType

**Properties:**
- **addressRoutingStrategy** (ReturnToAddressRoutingStrategy!)
  - The strategy for selecting the return address route.
- **conditionSet** (ReturnRuleConditionSet!)
  - This defines the set of conditions that must be met for this rule to be applied.
- **name** (String!)
  - The unique name for the rule. No two rules can have the same name. \*\*Format:\*\* Alphanumeric \*\*Maximum length:\*\* 100 characters
- **priority** (Int!)
  - The rule's priority determines its evaluation order; lower numbers are evaluated first. Each rule must have a unique priority value.
- **ruleId** (ID!)
  - The unique identifier for the rule.
- **status** (SellerReturnRuleStatus!)
  - The status of the rule: \`ENABLED\` or \`DISABLED\` \*\*Note:\*\* Only \`ENABLED\` rules are applied.

### ReturnRuleConditionSet
**Description:** This type defines the rule set which can encapsulate multiple conditions. The \*\*operator\*\* decides how the child conditions are evaluated.
**Type:** GraphQLObjectType

**Properties:**
- **conditions** ([ReturnRuleCondition!]!)
  - The list of rule conditions that belong to this set. Each element defines a specific criterion that must be evaluated against return data (for example, refund amount, item category, return reason). When evaluated, the overall truth value of this set depends on both the \*\*operator\*\* and the results of these individual conditions.
- **operator** (ReturnRuleLogicalOperator!)
  - Logical operator to apply to the child conditions.

### ReturnItemCategoryCondition
**Description:** This type restricts conditions to a specific category list.
**Type:** GraphQLObjectType

**Properties:**
- **categories** ([Category!]!)
  - A list of one or more categories referenced by this condition. \*\*Note:\*\* These needs to be eBay leaf category IDs.

### ReturnItemLocationCountryCondition
**Description:** This type restricts conditions to the item's location country. The list of countries can be provided.
**Type:** GraphQLObjectType

**Properties:**
- **itemLocationCountries** ([CountryAlpha2Code!]!)
  - The location to where the seller ships the item to the buyer.

### ReturnListingGroupCondition
**Description:** This type restricts conditions to specify to a specific listing group. Every group can have a specified number of listings.
**Type:** GraphQLObjectType

**Properties:**
- **returnRuleListingGroupId** (ID!)
  - A listing group ID referenced by this condition: - a group can have a specified number of listings - only one group can be defined per condition

### ReturnReasonCondition
**Description:** This type restricts conditions to one or more allowed return reasons.
**Type:** GraphQLObjectType

**Properties:**
- **returnReasonList** ([ReturnReason!]!)
  - One or more return reasons.

### ReturnRefundRangeCondition
**Description:** This type represents the range for total refund. The maximum refund amount (\*\*max\*\*) must be greater than the minimum refund amount (\*\*min\*\*). Both \*\*min\*\* and \*\*max\*\* are inclusive. - if only \*\*max\*\* is specified: The range is \*\*0\*\* to \*\*max\*\* - if only \*\*min\*\* is specified: The range is \*\*min\*\* to infinity - negative values will not be accepted
**Type:** GraphQLObjectType

**Properties:**
- **maxRefundAmount** (Amount)
  - The maximum refund amount.
- **minRefundAmount** (Amount!)
  - The minimum refund amount.

### ReturnShipmentOriginCountryCondition
**Description:** This type restricts conditions to return by country. The list of countries can be provided.
**Type:** GraphQLObjectType

**Properties:**
- **returnShipmentOriginCountries** ([CountryAlpha2Code!]!)
  - Teh buyer's country from which the return is initiated (initially shipped).

### ReturnRuleDisabledStatus
**Description:** This type indicates the rules with \`DISABLED\` status are inactive and ignored.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable code identifying the return as \`DISABLED\`.
- **disabledBy** (ReturnRuleDisabler!)
  - This enumerated value identifies who disabled the rule. The rule can be disabled by the seller through an API mutation or automatically by the eBay system if invalid conditions are detected during rule evaluation or execution. Rules disabled by the system cannot be re-enabled by the seller until all invalid conditions are corrected.
- **displayText** (String!)
  - The human-readable text of the rule status. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### ReturnRuleEnabledStatus
**Description:** This type indicates the rules with \`ENABLED\` status are active and evaluated.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable code identifying the return as \`ENABLED\`.
- **displayText** (String!)
  - A human-readable rule status. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### ReturnResponseKeepItemStrategy
**Description:** This type represents a return response where the buyer keeps the item and no return shipment to the seller is required.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable code identifying the rule response strategy: \`AUTO\_REFUND\_KEEP\_ITEM\`.
- **displayText** (String!)
  - A human-readable description of the rule outcome. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### ReturnResponseReturnItemStrategy
**Description:** This type represents a return response where the return request is automatically approved and the buyer must ship the item back to the seller.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable code identifying the rule response strategy: \`AUTO\_APPROVE\_RETURN\_ITEM\`.
- **displayText** (String!)
  - A human-readable description of the rule outcome. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### RmaPreference
**Description:** This type provides the Return Merchandise Authorization (RMA) preference settings.
**Type:** GraphQLObjectType

**Properties:**
- **preferenceStatus** (ReturnPreferenceStatus!)
  - This boolean indicates whether the preference status is enabled (\`true\`) or disabled (\`false\`).

### UpdateSellerRmaPreferenceInput
**Description:** This input type defines the payload for the \*\*updateSellerRmaPreference\*\* mutation, which when enabled, allows the seller to provide a Return Merchandise Authorization (RMA) number as part of the return shipment lifecycle.
**Type:** GraphQLInputObjectType

**Properties:**
- **listingMarketplace** (ListingMarketplace!)
  - This enumerated value is the marketplace where the item is \*\*listed/published\*\* (for example, \`EBAY\_US\`, EBAY\_DE\`, \`EBAY\_UK\`). All listings published on this marketplace inherit these preferences.
- **rmaPreference** (RmaPreferenceInput!)
  - If enabled, an RMA is required for returns. This setting is marketplace specific.

### RmaPreferenceInput
**Description:** This input type configures the seller's Return Merchandise Authorization (RMA) Preference.
**Type:** GraphQLInputObjectType

**Properties:**
- **preferenceStatus** (ReturnPreferenceStatus!)
  - The status of the RMA preference for returns.

### DeclineReturnInput
**Description:** This input type defines the payload for the \*\*declineReturn\*\* mutation which is used by the sender to decline a return with comments.
**Type:** GraphQLInputObjectType

**Properties:**
- **declinationNote** (String)
  - The optional text to include in the reply (from the sender to the buyer) regarding the overall decline. The message is stored as provided and not localized. \*\*Minimum length:\*\* 1 character \*\*Maximum length:\*\* 500 characters
- **returnId** (ID!)
  - The unique identifier of the Return to decline. This must be a valid return ID that the seller has permission to access.

### SubmitReturnReferralInput
**Description:** This input type defines the payload for the \*\*submitReturnReferral\*\* mutation. This type provides the input for submitting a referral (review request) on an order return. Select a reason from \`ReturnReferralAction.referralReasons\` and provide its machine-readable \`code\` as \`referralReasonCode\` (see \`PostPurchaseCaseReferralReason.code\`).
**Type:** GraphQLInputObjectType

**Properties:**
- **referralReasonCode** (String!)
  - The machine-readable reason code from a selected \`OrderReturnReferralReason\` (see \*\*PostPurchaseCaseReferralReason.code\*\*). For example, \`REFER\_RETURN\_TO\_EBAY\`.
- **returnId** (ID!)
  - The unique identifier of the return for which the referral is being submitted. This required field must reference a valid, return eligible, return ID that the user has permission to access.

### WatchListAddFailure
**Description:** This type defines the details of why a specific item failed to be added to a user's Watchlist.
**Type:** GraphQLObjectType

**Properties:**
- **item** (Item!)
  - The unique identifier of the item that failed to be added to the user's Watchlist.
- **reason** (WatchListAddFailureReason!)
  - The reason the item failed to be added to the user's Watchlist.

### UpdateInventoryFailure
**Description:** This type is used to show the identifier(s) of an item that failed to be updated with a \*\*bulkUpdateInventory\*\* mutation. An array of one or more violations will be present and an array of non-blocking warnings will also be present if any occurred.
**Type:** GraphQLObjectType

**Properties:**
- **listingItemIdentifier** (ListingItemIdentifier!)
  - This object will show either the \*\*listingId\*\* of the item's listing that failed to be updated or the \*\*sku\*\* value of the item. Which of these identifiers is returned depends on which identifier was used in the input to identify the item.
- **violations** ([ListingValidationRuleViolation!]!)
  - This array will show one or more validation rule violations that prevented the item from being successfully updated.
- **warnings** ([ListingWarning!])
  - This array will show one or more non-blocking validation warnings or issues that occurred during the update operation. \*\*Note\*\*: This array will be returned as empty if no warnings occurred.

### UpdateInventorySuccess
**Description:** This type is used to show the identifier(s) of an item that was successfully updated with a \*\*bulkUpdateInventory\*\* mutation. An array of non-blocking warnings will also be present if any occurred.
**Type:** GraphQLObjectType

**Properties:**
- **listingItemIdentifier** (ListingItemIdentifier!)
  - This object will show the \*\*listingId\*\* of the item's listing that was successfully updated, and also the \*\*sku\*\* value of the item if the \*\*sku\*\* value was used in the input to identify the item.
- **warnings** ([ListingWarning!])
  - This array will show one or more non-blocking validation warnings or issues that occurred during the update operation. \*\*Note\*\*: This array will be returned as empty if no warnings occurred.

### UpdateItemCommitmentError
**Description:** This type provides details about an error that occurred while updating an item commitment.
**Type:** GraphQLObjectType

**Properties:**
- **displayMessage** (String!)
  - A user-friendly, non-localized message describing the error.
- **errorCode** (String!)
  - The unique identifier of the error. Below are the five errors that may occur: - \`INVALID\_INPUT\`: This error indicates that the item commitment ID is not recognized. - \`NOT\_AUTHORIZED\`: This error indicates that the item commitment doesn't belong to the authenticated eBay user, so this action cannot be taken. - \`VERSION\_LOCKED\`: This error indicates that the latest version of item commitment is locked, possibly because the item commitment was being modified by another process. With this error, the user can make another attempt to update the item commitment. - \`TEMPORARILY\_NOT\_AVAILABLE\`: This error indicates that a system error occurred. This error may occur with a complete failure, and the user can try again after a short period of time. - \`DEPENDENCY\_TIME\_OUT\`: — This error indicates that a timeout occurred. With this error, the user can try again after a short period of time.
- **inputItemCommitmentId** (ID!)
  - The unique identifier of the item commitment that failed to be updated with a mutation.
- **retryable** (Boolean!)
  - This boolean indicates whether or not the user should retry a mutation to update the corresponding item commitment again. If this field is returned as \`true\`, the user can make another attempt to update the item commitment.

### UpdateOrderError
**Description:** This error type represents details about an error that occurred while updating an order.
**Type:** GraphQLObjectType

**Properties:**
- **displayMessage** (String!)
  - A human-readable description of the error message. This string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **errorCode** (String!)
  - The machine-readable error code for identifying the type of error. For this type, the available values are: - \`INVALID\_INPUT\`: The input data is invalid. (Not retryable) - \`NOT\_AUTHORIZED\`: The user is not authorized to perform this action. (Not retryable) - \`VERSION\_LOCKED\`: The order was modified by another process. (Retryable) - \`TEMPORARILY\_NOT\_AVAILABLE\`: The service is temporarily unavailable. (Retryable)
- **inputOrderId** (ID!)
  - The unique identifier of the order that failed to update.
- **retryable** (Boolean!)
  - When this boolean field is returned as \`true\`, the operation can be retried and may succeed. When returned as \`false\`, a retry will not succeed.

### UpdatePurchaseQuoteError
**Description:** This type displays the unique identifiers of all purchase quotes that were not successully updated, and the error(s) that caused them not to be updated.
**Type:** GraphQLObjectType

**Properties:**
- **displayMessage** (String!)
  - A user-friendly, non-localized message describing the error.
- **errorCode** (String!)
  - The unique identifier of the error. Below are the four errors that may occur: - INVALID\_INPUT: This error indicates that there were one or more issues with the input data in the mutation request. - TEMPORARILY\_NOT\_AVAILABLE: This error indicates that a system error occurred. This error may occur with a complete failure, and the user can try again after a short period of time. - NOT\_AUTHORIZED: The user is not authorized to perform this action and/or there is an issue with the token. - VERSION\_LOCKED: This error indicates that the purchase quote was being modified by another process at the time of the request, and the user can try again after a short period of time.
- **inputPurchaseQuoteId** (ID!)
  - The unique identifier of the purchase quote that failed to be updated.
- **retryable** (Boolean!)
  - This boolean indicates whether or not the user should try to update the corresponding purchase quote again. If this field is returned as 'true', the user can make another attempt to update the corresponding purchase quote.

### ItemCommitmentsByIdsError
**Description:** This type displays the unique identifiers of all item commitments that were not successfully retrieved, and the error(s) that caused them not to be retrieved.
**Type:** GraphQLObjectType

**Properties:**
- **displayMessage** (String!)
  - A user-friendly, non-localized message describing the error.
- **errorCode** (String!)
  - The unique identifier of the error. Below are the two errors that may occur: - INVALID\_INPUT: This error indicates that the item commitment ID is not recognized or it doesn't belong to the authenticated eBay user. - TEMPORARILY\_NOT\_AVAILABLE: This error indicates that a system error occurred. This error may occur with a complete failure, and the user can try again after a short period of time.
- **inputItemCommitmentId** (ID!)
  - The unique identifier of the item commitment that failed to be retrieved.
- **retryable** (Boolean!)
  - This boolean indicates whether or not the user should try to retrieve the corresponding item commitment again. If this field is returned as \`true\`, the user can make another attempt to retrieve the item commitment.

### LineItemsByIdsError
**Description:** This error type represents details about a specific line item retrieval failure.
**Type:** GraphQLObjectType

**Properties:**
- **displayMessage** (String!)
  - A human-readable description of the error message. This string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **errorCode** (String!)
  - The machine-readable error code for this business error. For this type, the available values are: - \`INVALID\_INPUT\`: The input data is invalid; retry will not succeed. - \`TEMPORARILY\_NOT\_AVAILABLE\`: The service is temporarily unavailable; retry may succeed.
- **inputLineItemId** (ID!)
  - The ID of the line item ID that could not be retrieved.
- **retryable** (Boolean!)
  - When \`true\`, the operation can be retried and may succeed. When \`false\`, a retry will not succeed.

### OrdersByIdsError
**Description:** This error type represents details about an order retrieval failure for an order ID.
**Type:** GraphQLObjectType

**Properties:**
- **displayMessage** (String!)
  - A human-readable description of the error message. This string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **errorCode** (String!)
  - The machine-readable error code for this business error. For this type, the available values are: - \`INVALID\_INPUT\`: The input data is invalid; retry will not succeed. - \`TEMPORARILY\_NOT\_AVAILABLE\`: The service is temporarily unavailable; retry may succeed.
- **inputOrderId** (ID!)
  - The ID of the order that could not be retrieved.
- **retryable** (Boolean!)
  - When \`true\`, the operation can be retried and may succeed. When \`false\`, a retry will not succeed.

### PurchaseQuoteLineItemsByIdsError
**Description:** This type displays the unique identifiers of all purchase quote line items that were not successfully retrieved, and the error(s) that caused them not to be retrieved.
**Type:** GraphQLObjectType

**Properties:**
- **displayMessage** (String!)
  - A user-friendly, non-localized message describing the error.
- **errorCode** (String!)
  - The unique identifier of the error. Below are the three errors that may occur: - \`INVALID\_INPUT\`: This error indicates that the purchase quote line item ID is not recognized or it doesn't belong to the authenticated eBay user. - \`TEMPORARILY\_NOT\_AVAILABLE\`: This error indicates that a system error occurred. This error may occur with a complete failure, and the user can try again after a short period of time.
- **inputPurchaseQuoteLineItemId** (ID!)
  - The unique identifier of the purchase quote line item that failed to be retrieved.
- **retryable** (Boolean!)
  - This boolean indicates whether or not the user should try to retrieve the corresponding purchase quote line item again. If this field is returned as \`true\`, the user can make another attempt to retrieve the purchase quote line item.

### PurchaseQuotesByIdsError
**Description:** This type displays the unique identifiers of all purchase quotes that were not successfully retrieved, and the error(s) that caused them not to be retrieved.
**Type:** GraphQLObjectType

**Properties:**
- **displayMessage** (String!)
  - A user-friendly, non-localized message describing the error.
- **errorCode** (String!)
  - The unique identifier of the error. Below are the three errors that may occur: - \`INVALID\_INPUT\`: This error indicates that the purchase quote ID is not recognized or it doesn't belong to the authenticated eBay user. - \`TEMPORARILY\_NOT\_AVAILABLE\`: This error indicates that a system error occurred. This error may occur with a complete failure, and the user can try again after a short period of time. - \`DEPENDENCY\_TIME\_OUTE\`: This error indicates that the request timed out, and the user can try again after a short period of time.
- **inputPurchaseQuoteId** (ID!)
  - The unique identifier of the purchase quote that failed to be retrieved.
- **retryable** (Boolean!)
  - This boolean indicates whether or not the user should try to retrieve the corresponding purchase quote again. If this field is returned as \`true\`, the user can make another attempt to retrieve the purchase quote.

### WatchListRemoveFailure
**Description:** This type defines the details of why a specific item failed to be removed from a user's Watchlist.
**Type:** GraphQLObjectType

**Properties:**
- **item** (Item!)
  - The unique identifier of the item that failed to be removed from the user's Watchlist.
- **reason** (WatchListRemoveFailureReason!)
  - The reason the item failed to be removed from the user's Watchlist.

### ReturnRuleNameConstraint
**Description:** This type defines validation constraints for the return rule name input.
**Type:** GraphQLObjectType

**Properties:**
- **allowedPattern** (String!)
  - The regular expression pattern that defines allowed characters.
- **characterLimit** (InputTextLengthRange!)
  - The minimum and maximum number of characters allowed.

### CustomListFailure
**Description:** This type defines the unique identifier of a custom list and the reason the custom list operation failed.
**Type:** GraphQLObjectType

**Properties:**
- **customListId** (ID!)
  - The unique identifier of the custom list that failed to be retrieved.
- **reason** (CustomListFailureReason!)
  - The reason the custom list failed to be retrieved.

### UserCustomList
**Description:** This type represents a user-created custom Watchlist. Custom lists allow users to organize their watched items into named collections beyond the default Watchlist.
**Type:** GraphQLObjectType

**Properties:**
- **customListId** (ID!)
  - The unique identifier for this custom list. This value can be used for referencing this specific list in subsequent operations.
- **itemCount** (Int!)
  - This integer value indicates the total number of items currently in this custom list. This count represents all items across all pages of data and not just the current page.
- **items** (CustomListItems!)
  - The paginated collection of items in this custom list. For empty lists, this field returns an empty results array.
- **name** (String!)
  - The user-defined name for this custom list. \*\*Note\*\*: Alphanumeric characters and most symbols are allowed, except for these prohibited characters: \`< > \\ / : " | ? \*\` \*\*Maximum length\*\*: 40 characters

### ShippingCarrierTracking
**Description:** This type provides carrier tracking information for a shipment.
**Type:** GraphQLObjectType

**Properties:**
- **shippingCarrier** (ShippingCarrier!)
  - The standardized carrier name associated with the forward and return shipment, examples can include UPS, USPS, and FEDEX.
- **trackingNumber** (String)
  - The tracking number for the return shipment, if the label is provided by seller. This is a common use case for some carriers in certain geographies.

### ListingVariations
**Description:** This type is used to express the traits where each SKU within a multiple-variation listing differs, such as \`Color\` and \`Size\`. Each available color and each available size will be listed through the \*\*variationTraits\*\* array. If the listing featured t-shirts, each variation within that listing would have a unique color and size combination such as \`Blue, Large\`.
**Type:** GraphQLObjectType

**Properties:**
- **imagesVaryByTrait** (ListingVariationImagesVaryByTrait)
  - This object identifies the main trait by which variations differ, and provides image URLs demonstrating the variations of this trait for each variation. For example, the varying trait may be \`Color\`, and image URLs would be provided showcasing the different color of each variation.
- **variationTraits** ([NameValuesPair!])
  - This array shows the names of the varying traits and the available values for each of these traits. For example, one trait might be \`Color\`, and all of the available colors would be specified in the corresponding \*\*values\*\* array. Another trait might be \`Size\`, and all of the available sizes would be specified in the corresponding \*\*values\*\* array. If the multiple-variation listing has two varying traits such as \`Color\` and \`Size\`, each variation would have a different combination of each of these traits, such as a \`Large, Red\` shirt.

### ServicePoint
**Description:** This type is used to convey information about a service-related logistics point involved in a fulfillment plan. An example of this would be tires being sent to a tire installer company for tires to get installed on the buyer's vehicle.
**Type:** GraphQLObjectType

**Properties:**
- **address** (PurchaseAddress)
  - The physical address associated with this service-related logistics point.
- **name** (String!)
  - The user-friendly name of the service-related logistics point (for example: \`Service Center\`).
- **serviceDetails** (ServicePointInfo!)
  - This object shows service-specific details associated with this service-related logistics point. The type and amount of data shown here will vary based on the details that are known and available.
- **type** (DisplayableId!)
  - The functional role of the service-related logistics point in the logistics flow (for example: \`SERVICE\_SITE\`, \`CUSTOMER\_HOME\`).

### LogisticsFulfillmentEstimate
**Description:** This type is used to show the estimated fulfillment windows. Estimated delivery times consider the seller's stated handling time plus the expected transit time range of the shipping service. \*\*Note\*\*: Sellers generally do not ship items until the buyer's payment has cleared, so the estimated fulfillment windows should really only be considered after payment has been made by the buyer.
**Type:** GraphQLObjectType

**Properties:**
- **earliestFulfillmentAt** (DateTime)
  - This timestamp shows the earliest estimated date and time by which fulfillment is expected to be completed.
- **latestFulfillmentAt** (DateTime)
  - This timestamp shows the latest estimated date and time by which fulfillment is expected to be completed.
- **maxFulfillmentDays** (Int)
  - The integer value in this field indicates the maximum amount of business days after the buyer's payment clears that the buyer can expect to receive the item.
- **minFulfillmentDays** (Int)
  - The integer value in this field indicates the minimum amount of business days after the buyer's payment clears that the buyer can expect to receive the item.

### DomainIdentifier
**Description:** This type defines the external reference that creates an order. For example, if an order is created by the RequestTotal, the \*\*identifier\*\*: \`1234\` and the \*\*domain\*\*: \`RequestTotal\`.
**Type:** GraphQLObjectType

**Properties:**
- **domain** (ID!)
  - The domain of the external reference.
- **identifier** (ID!)
  - The unique identifier for the external reference.

### ListingItemIdentifier
**Description:** This type is used by the response of a \*\*bulkUpdateInventory\*\* mutation to indicate which items were successfully updated and which items failed to be updated. For both the \*\*successes\*\* and \*\*failures\*\* arrays, either the \*\*listingId\*\* or \*\*sku\*\* value or both will indicate the items that were successfully updated and those that failed, respectively. \*\*On a successful update:\*\* The identifier will contain the \`listingId\` and/or \`SKU\` for the item. This may differ from the information that was provided in the input in certain cases. For example, if you provide only a \`SKU\` in the request, a successful response will include both the \`SKU\` and the corresponding \`listingId\` that the system resolved for that item. \*\*On a failed update:\*\* The identifier contains an exact echo of the \`listingId\` and/or \`SKU\` exactly as it was provided in the request for the specific item that failed. This helps you identify which input item caused the error. If a field was omitted in the input (e.g., \`listingId\` was not provided), it will also be absent (null) in this identifier.
**Type:** GraphQLObjectType

**Properties:**
- **listingId** (ID)
  - The unique identifier of the listing that was successfully updated (if returned in the \*\*successes\*\* array) or which failed to be updated (if returned in the \*\*failures\*\* array). \*\*Note\*\*: If an item was successfully updated, this field will be returned along with the \*\*sku\*\* field even if it was the \*\*sku\*\* that was used to identify the item in the input. If an item failed to be updated, this field will only be returned if it was used to identify the item in the input.
- **sku** (ID)
  - The seller-defined SKU of the item that was successfully updated (if returned in the \*\*successes\*\* array) or which failed to be updated (if returned in the \*\*failures\*\* array). \*\*Note\*\*: This field will only be returned if it was used to identify the item in the input.

### InputTextLengthRange
**Description:** This common type represents the length constraints for text input fields and is used across multiple violation types to define allowed character limits.
**Type:** GraphQLObjectType

**Properties:**
- **maxLength** (Int!)
  - The maximum number of characters allowed for input text.
- **minLength** (Int!)
  - The minimum number of characters required for input text.

### CustomListItems
**Description:** This type defines the paginated response containing items from a specific custom list and provides efficient access to large collections of custom list items.
**Type:** GraphQLObjectType

**Properties:**
- **pagination** (Pagination)
  - This object returns pagination information for navigating through multiple pages of custom list items.
- **results** ([CustomListItem!]!)
  - This array returns a list of items in the custom list. Items are ordered by the date they were added to the custom list with the most recent first. This array may be empty if the custom list has no items or if the requested page is beyond available data.

### CustomListItemsInput
**Description:** This type is used to specify the input parameters for retrieving items from a specific custom Watchlist. \*\*Note\*\*: All parameters are optional. If not provided, default values will be used.
**Type:** GraphQLInputObjectType

**Properties:**
- **pagination** (PageInfoInput)
  - This object can be used to specify optional pagination settings used to control page size and navigate through multiple pages of results. If pagination settings are not provided through this input, default pagination parameters will be applied.

### ListingVariationImagesVaryByTrait
**Description:** This type is used to identify the main trait by which SKUs within a multiple-variation listing differ, and to provide image URLs demonstrating the variations of this trait for each item variation.
**Type:** GraphQLObjectType

**Properties:**
- **traitName** (String)
  - The trait name by which pictures of the item variations vary. The specified trait will be used to determine which images to display when a buyer selects a variation in the View Item page. For example, if the trait is 'Color', then a corresponding product image in the \*\*traitValueImages\*\* array will be displayed when that color is selected in the View Item page. The trait name specified here must be one of the variation traits specified in the \*\*variationTraits\*\* array.
- **traitValueImages** ([ListingVariationTraitImage!])
  - This array contains a list of one or more image URLs for each available value of the trait. So, if the trait is \`Color\`, each of the available colors would be specified through the \*\*traitValue\*\* field, and then each color would have at least one image URL specified through the \*\*traitImages\*\* array.

### DigitalDeliveryExecution
**Description:** This type provides details about a digital delivery step in progress, and includes the digital delivery step state and completion date (if complete).
**Type:** GraphQLObjectType

**Properties:**
- **completedAt** (DateTime)
  - This timestamp shows the actual time that the digital delivery step was completed. This field is returned if applicable and available.
- **fulfillmentState** (LogisticsFulfillmentState!)
  - This object shows the current state of fulfillment that this digital delivery step is contributing towards.

### DigitalDeliveryPlan
**Description:** This type provides details about a planned digital delivery step prior to execution.
**Type:** GraphQLObjectType

**Properties:**
- **sendBy** (DateTime)
  - This timestamp shows the latest acceptable time by which the digital delivery step should be completed. This field is returned if applicable and available.

### PickupExecution
**Description:** This type provides details about a pickup step in progress, and includes the pickup step state and the list of line items associated with this pickup step.
**Type:** GraphQLObjectType

**Properties:**
- **lineItemReferences** ([LineItemReference!])
  - This array lists the line items that have been picked up or are scheduled for pickup.
- **pickedUpAt** (DateTime)
  - This timestamp shows the actual time that the pickup step was completed. This field is returned if applicable and available.
- **pickupState** (LogisticsFulfillmentState)
  - This object shows the current state of fulfillment that this pickup step is contributing towards (e.g. PENDING, COMPLETED).

### PickupPlan
**Description:** This type provides details about a planned pickup step prior to execution.
**Type:** GraphQLObjectType

**Properties:**
- **pickupBy** (DateTime)
  - This timestamp shows the latest acceptable time by which the pickup should be completed. This field is returned if applicable and available.
- **scheduledAt** (DateTime)
  - This timestamp shows the scheduled time when the pickup is expected to occur. This field is returned if applicable and available.

### ShippingExecutionList
**Description:** This type provides details about a shipping step in progress, and includes the shipping step state and the list of executions associated with this shipping step.
**Type:** GraphQLObjectType

**Properties:**
- **executions** ([ShippingExecution!]!)
  - This array shows the list of executions associated with this shipping step. Each entry describes a separate fulfillment event.
- **shippingState** (LogisticsFulfillmentState!)
  - This object shows the current state of fulfillment that this shipping step is contributing towards.

### ShippingPlan
**Description:** This type provides details about a planned shipping step prior to execution.
**Type:** GraphQLObjectType

**Properties:**
- **shippingHoldDetail** (ShippingFulfillmentHoldDetails)
  - This object is returned if there is a hold on the shipping step, and indicates when the hold is expected to be released

### CustomListItem
**Description:** This type defines an individual item within a user's custom list. This type contains the item details along with custom list-specific metadata like the price of the item when added to a custom list.
**Type:** GraphQLObjectType

**Properties:**
- **addedAt** (DateTime!)
  - The date and time this item was added to this specific custom Watchlist. \*\*Format\*\*: ISO 8601 date-time string ('YYYY-MM-DDTHH:mm:ss.sssZ') \*\*Timezone\*\*: UTC
- **item** (Item!)
  - This object returns information for an item in this custom list.

### ListingVariationTraitImage
**Description:** This type is used to provide an array of one or more image URLs for each available value of the trait. So, if the trait is \`Color\`, each of the available colors would be specified through the \*\*traitValue\*\* field, and then each color would have at least one image URL specified through the \*\*traitImages\*\* array.
**Type:** GraphQLObjectType

**Properties:**
- **traitImages** ([ListingImage!])
  - An array of one or more images that demonstrate the corresponding \*\*traitValue\*\*. For example, if the \*\*traitName\*\* is \`Color\` and the \*\*traitValue\*\* is \`Red\`, the image(s) would show a red variation of the product. Depending on the product, one image per variation may be enough, but multiple images may be specified for each \*\*traitValue\*\*. For example, it is possible that a seller would want to show the front and back of each shirt in each color.
- **traitValue** (String)
  - The trait value of the corresponding image(s) in the \*\*traitImages\*\* array. If the \*\*traitName\*\* is \`Color\`, values in this field may include Red, Blue, Green, etc. At least one of the variations within the multiple-variation listing must have this value.

### ServiceExecutionList
**Description:** This type is used to show the execution history and current status of service attempts.
**Type:** GraphQLObjectType

**Properties:**
- **executions** ([ServiceExecution!]!)
  - This array lists individual execution attempts for the service. Each entry represents a distinct attempt, including rescheduled appointments.
- **serviceState** (ServiceState!)
  - This object shows details on the current state of the service (for example, completed, failed, or rescheduled).

### ServicePlan
**Description:** This type is used to show the scheduled date and time of a planned service appointment at the service-related logistics point.
**Type:** GraphQLObjectType

**Properties:**
- **scheduledAt** (DateTime)
  - The scheduled timestamp for the planned service appointment, such as tire installation.

### ShippingExecution
**Description:** This type is used to provide details on a single shipping execution event, either completed or in progress.
**Type:** GraphQLObjectType

**Properties:**
- **deliveredAt** (DateTime)
  - This timestamp indicates when the shipment was delivered to the destination. This field is returned if the item has been delivered.
- **lineItemReferences** ([LineItemReference!])
  - This array lists the line items packaged in the shipment.
- **shippedAt** (DateTime)
  - This timestamp indicates when the shipment was sent from the origin. This field is returned if the item has been shipped.
- **shippingCarrier** (String)
  - The name of the shipping carrier handling this shipment.
- **shippingState** (LogisticsFulfillmentState!)
  - This object shows the current state of fulfillment that this shipping execution event is contributing towards.
- **trackingNumber** (String)
  - The shipment tracking number assigned by the shipping carrier. This field is returned if available.
- **trackingProvidedAt** (DateTime)
  - This timestamp indicates when tracking information was first made available.

### ShippingFulfillmentHoldDetails
**Description:** This type is used to indicate the date and time that the seller should wait for before proceeding with fulfillment.
**Type:** GraphQLObjectType

**Properties:**
- **holdUntil** (DateTime!)
  - The date and time until which the seller should hold the fulfillment before proceeding.

### ServiceExecution
**Description:** This type provides details of a service execution attempt.
**Type:** GraphQLObjectType

**Properties:**
- **completedAt** (DateTime)
  - This timestamp indicates when the service attempt was completed. \*\*Note\*\*: This field is only returned if the service attempt is in the completed state.
- **serviceState** (ServiceState!)
  - This object provides details on the current state of this specific service execution attempt.
- **startedAt** (DateTime)
  - This timestamp indicates when the service attempt began.

### ReturnNoteViolation
**Description:** This type represents the return note input violations.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable code identifying the specific rule that was violated (for example, \`RETURN\_NOTE\_VIOLATION\`).
- **constraint** (ReturnNoteConstraint!)
  - Indicates the constraints defined for return note input.
- **displayMessage** (String!)
  - A human-readable message describing the rule violation. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **exceededLength** (Boolean!)
  - Indicates whether the return note exceeded the allowed length.

### ReturnShippingCarrierNameViolation
**Description:** This type represents input violations related to the return shipping carrier name.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable code identifying the specific rule that was violated (for example. RETURN\_SHIPPING\_CARRIER\_VIOLATION).
- **constraint** (ReturnShippingCarrierConstraint!)
  - Indicates the constraints defined for return shipping carrier name input.
- **containsInvalidCharacters** (Boolean!)
  - Indicates whether the shipping carrier name contains invalid characters.
- **displayMessage** (String!)
  - A human-readable message describing the rule violation. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **exceededLength** (Boolean!)
  - Indicates whether the shipping carrier name exceeded the allowed length.

### ReturnTrackingNumberViolation
**Description:** This type represents input violations related to the return tracking number.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable code identifying the specific rule that was violated (for example. RETURN\_TRACKING\_VIOLATION).
- **constraint** (ReturnTrackingNumberConstraint!)
  - Indicates the constraints defined for return tracking number input.
- **containsInvalidCharacters** (Boolean!)
  - Indicates whether the tracking number contains invalid characters.
- **displayMessage** (String!)
  - A human-readable message describing the rule violation. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **duplicateTrackingNumber** (Boolean!)
  - Indicates whether the tracking number is already in use for another return.
- **exceededLength** (Boolean!)
  - Indicates whether the tracking number exceeded the allowed length.

### CommitmentAdultVerificationRequiredViolation
**Description:** This type defines the error returned when the buyer has not verified their age as an adult. This error occurs when purchasing items in age-restricted categories. The buyer must complete adult verification before proceeding with this purchase.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The human-readable description of the business rule that was violated. \*\*Maximum length\*\*: 250 characters

### CommitmentBuyerAccountPolicyViolation
**Description:** This type defines the error returned when the buyer has violated a policy.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The human-readable description of the business rule that was violated. \*\*Maximum length\*\*: 250 characters

### CommitmentBuyerAccountRestrictionViolation
**Description:** This type defines the error returned when the buyer's account is restricted from making commitments because the account is not fully provisioned.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The human-readable description of the business rule that was violated. \*\*Maximum length\*\*: 250 characters

### CommitmentBuyerBlockedBySellerViolation
**Description:** This type defines the error returned when the buyer is blocked by the seller from making commitments on their items.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The human-readable description of the business rule that was violated. \*\*Maximum length\*\*: 250 characters

### CommitmentBuyerEligibilityViolation
**Description:** This type defines the error returned when the buyer fails the buyer eligibility check. This includes checks such as user auth checks, fraud checks, etc.
**Type:** GraphQLObjectType

**Properties:**
- **policyViolationMessage** (String)
  - The explanatory message of the specific policy violation. \*\*Maximum length\*\*: 100 characters
- **redirectUrl** (String)
  - If the block can be remediated, this field will contain a URL to redirect the user to take a remedial action. \*\*Format\*\*: URL \*\*Maximum length\*\*: 2048 characters
- **ruleDescription** (String!)
  - The human-readable description of the business rule that was violated. \*\*Maximum length\*\*: 250 characters

### CommitmentBuyerItemCountLimitViolation
**Description:** This type defines the error indicating that the buyer has exceeded the maximum number of items allowed to be purchased from this seller.
**Type:** GraphQLObjectType

**Properties:**
- **maxItemsAllowed** (Int!)
  - The maximum number of items a buyer is allowed to buy from the seller.
- **ruleDescription** (String!)
  - The human-readable description of the business rule that was violated. \*\*Maximum length\*\*: 250 characters

### CommitmentBuyerLowFeedbackScoreViolation
**Description:** This type defines the error indicating the buyer's feedback score is below the required threshold, as determined by the seller.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The human-readable description of the business rule that was violated. \*\*Maximum length\*\*: 250 characters

### CommitmentBuyerUpiStrikeViolation
**Description:** This type defines the error returned when the buyer has an unpaid item strike (UPI).
**Type:** GraphQLObjectType

**Properties:**
- **durationInDays** (Int!)
  - The duration, in days, for which the user is blocked from buying items.
- **maxAllowedStrikes** (Int!)
  - The maximum allowed strikes a user can get before they are blocked from buying items.
- **ruleDescription** (String!)
  - The human-readable description of the business rule that was violated. \*\*Maximum length\*\*: 250 characters
- **strikeCount** (Int!)
  - The number of unpaid item strikes the user has.

### CommitmentBuyerValidationViolation
**Description:** This type defines the error returned when the user validation fails. Possible reasons include: - User account is on hold. - User account is suspended. - User account is not found. - User account is not registered.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The human-readable description of the business rule that was violated. \*\*Maximum length\*\*: 250 characters

### CommitmentDailyDealItemLimitReachedViolation
**Description:** This type defines the error indicating that the buyer has reached the maximum allowed daily deal item purchases.
**Type:** GraphQLObjectType

**Properties:**
- **alreadyBoughtQuantity** (Int!)
  - The number of Daily Deal items the buyer has already bought today.
- **maxItemsAllowed** (Int!)
  - The maximum Daily Deal items a buyer is allowed to buy in a day.
- **requestedQuantity** (Int!)
  - The number of Daily Deal items the buyer is trying to buy.
- **ruleDescription** (String!)
  - The human-readable description of the business rule that was violated. \*\*Maximum length\*\*: 250 characters

### CommitmentDefaultBusinessRuleViolation
**Description:** This type defines the generic error returned when a business rule violation does not have a more specific type.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The human-readable description of the business rule that was violated. \*\*Maximum length\*\*: 250 characters

### CommitmentHoldByResolutionViolation
**Description:** This type defines the error returned when the item is currently on hold due to a resolution process.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The human-readable description of the business rule that was violated. \*\*Maximum length\*\*: 250 characters

### CommitmentItemNotEligibleViolation
**Description:** This type defines the error returned when the item is not eligible for commitment.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The human-readable description of the business rule that was violated. \*\*Maximum length\*\*: 250 characters

### CommitmentItemSalePendingViolation
**Description:** This type defines the error returned when the sale is currently pending and cannot be committed to.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The human-readable description of the business rule that was violated. \*\*Maximum length\*\*: 250 characters

### CommitmentPriceMismatchViolation
**Description:** This type defines the error returned when the offer price is not equal to the Buy It Now price.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The human-readable description of the business rule that was violated. \*\*Maximum length\*\*: 250 characters

### CommitmentPrivacyUserAgreementNotAcceptedViolation
**Description:** This type defines the error returned when the buyer has not agreed to the privacy user agreement. This error occurs when purchasing items in categories that require user consent. The buyer must accept the privacy user agreement before proceeding with this purchase.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The human-readable description of the business rule that was violated. \*\*Maximum length\*\*: 250 characters

### CommitmentPrivateSaleViolation
**Description:** This type defines the error returned when the buyer does not have authorization to participate in a private sale.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The human-readable description of the business rule that was violated. \*\*Maximum length\*\*: 250 characters

### CommitmentSaleHasEndedViolation
**Description:** This type defines the error returned when the sale has ended or there is no available quantity.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The human-readable description of the business rule that was violated. \*\*Maximum length\*\*: 250 characters

### CommitmentSelfPurchaseViolation
**Description:** This type defines the error returned when the seller is trying to buy their own item.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The human-readable description of the business rule that was violated. \*\*Maximum length\*\*: 250 characters

### CommitmentSellerStoreOnVacationViolation
**Description:** This type defines the error returned when the seller's store is on vacation.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The human-readable description of the business rule that was violated. \*\*Maximum length\*\*: 250 characters

### CommitmentShipToLocationExclusionViolation
**Description:** This type defines the error returned when the seller does not ship to the buyer's country.
**Type:** GraphQLObjectType

**Properties:**
- **buyerShipToCountry** (String!)
  - The buyer's ship-to country that caused the violation. \*\*Maximum length\*\*: 50 characters
- **ruleDescription** (String!)
  - The human-readable description of the business rule that was violated. \*\*Maximum length\*\*: 250 characters

### ApproveContractCancellationAction
**Description:** This type, available for the seller, is used to approve cancellation action on the contract.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable cancellation action code for this use case. For this type, the value is \`APPROVE\`.
- **displayText** (String!)
  - A human-readable message explaining the cancellation action code. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### DeclineContractCancellationAction
**Description:** This type, available for the seller, is used to decline cancellation action on the contract.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable cancellation action code for this use case. For this type, the value is \`DECLINE\`.
- **displayText** (String!)
  - A human-readable message explaining the cancellation action code. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### RetryRefundContractCancellationAction
**Description:** This type, available for the seller, is used to retry refund cancellation action on the contract.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable cancellation action code for this use case. For this type, the value is \`RETRY\_REFUND\`.
- **displayText** (String!)
  - A human-readable message explaining the cancellation action code. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### StandardListingValidationRuleViolation
**Description:** This type is used to display information about operation validation errors when these errors are triggered.
**Type:** GraphQLObjectType

**Properties:**
- **additionalInformation** ([NameValuePair!])
  - This array will show a list of one or more key-value pairs providing additional, structured context for the violation. For example, for a maximum length exceeded violation, this might contain {name: \`maxLength\`, value: \`80\`}. Null values in a name-value pair indicates that no additional information is available on the violation.
- **inputPath** ([String!]!)
  - This array will show one or more string values that show the full path(s) to the input field(s) that caused the violation.
- **violationCode** (String!)
  - A unique identifier of the violation. Clients can use this code to implement custom logic.
- **violationDescription** (String!)
  - A human-readable description of the violation, intended to be displayed to an end user.

### ListingValidationWarning
**Description:** This type is used to display information about operation warnings when these warnings are triggered. With warnings, the operation will be successful or partially successfully, but there are issues that the user should be aware of and may need to address these issues at a later time.
**Type:** GraphQLObjectType

**Properties:**
- **additionalInformation** ([NameValuePair!])
  - This array will show a list of one or more key-value pairs providing additional, structured context for the warning. Null values in a name-value pair indicates that no additional information is available on the warning.
- **inputPath** ([String!]!)
  - This array will show one or more string values that show the full path(s) to the input field(s) that caused the warning.
- **warningCode** (String!)
  - A unique identifier of the warning. Clients can use this code to implement custom logic.
- **warningMessage** (String!)
  - A human-readable description of the warning, intended to be displayed to an end user.

### StandardListingWarning
**Description:** This type is used to display information about operation warnings when these warnings are triggered. With warnings, the operation will be successful or partially successfully, but there are issues that the user should be aware of and may need to address these issues at a later time.
**Type:** GraphQLObjectType

**Properties:**
- **additionalInformation** ([NameValuePair!])
  - This array will show a list of one or more key-value pairs providing additional, structured context for the warning. Null values in a name-value pair indicates that no additional information is available on the warning.
- **warningCode** (String!)
  - A unique identifier of the warning. Clients can use this code to implement custom logic.
- **warningMessage** (String!)
  - A human-readable description of the warning, intended to be displayed to an end user.

### CancellationShippedDateViolation
**Description:** This type represents the cancellation shipped date input violations, applicable only to the \*\*DeclineContractCancellation\*\* mutation. \*\*Note:\*\* The shipped date should be after order creation date but before the current date.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable code identifying the specific rule that was violated. For this type, the value is \`CNCL\_SHIPPED\_DATE\_VIOLATION\`.
- **constraint** (CancellationShippedDateConstraint!)
  - This field indicates the constraints defined for the shipped date input.
- **displayMessage** (String!)
  - A human-readable description of the rule violation. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters

### CancellationShippingCarrierCodeViolation
**Description:** This type represents cancellation shipping carrier code input violations used in the \*\*DeclineContractCancellation\*\* mutation.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - This machine-readable code identifies the specific rule that was violated. For this type, the value is \`CNCL\_SHIPPING\_CARRIER\_VIOLATION\`.
- **constraint** (CancellationShippingCarrierCodeConstraint!)
  - The constraints defined for cancellation shipping carrier code input.
- **containsInvalidCharacters** (Boolean!)
  - This boolean is returned \`true\` if the tracking number contains characters that are not allowed by the constraint.
- **displayMessage** (String!)
  - A human-readable description of the violation. \*\*Maximum length:\*\* 512 characters
- **exceededLength** (Boolean!)
  - This boolean is returned \`true\` if the field exceeds the maximum length constraint.

### CancellationTrackingNumberViolation
**Description:** This type represents the validation violations for cancellation tracking number used in the \*\*DeclineContractCancellation\*\* mutation.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - This machine-readable code identifies the specific rule that was violated. For this type, the value is \`CNCL\_TRACKING\_NUMBER\_VIOLATION\`.
- **constraint** (CancellationTrackingNumberConstraint!)
  - The constraints that apply to the cancellation tracking number.
- **containsInvalidCharacters** (Boolean!)
  - This boolean is returned \`true\` if the tracking number contains characters that are not allowed by the constraint.
- **displayMessage** (String!)
  - A human-readable description of the violation. \*\*Maximum length:\*\* 512 characters
- **exceededLength** (Boolean!)
  - This boolean is returned \`true\` if the field exceeds the maximum length constraint.

### CancellationItemCommitmentIneligible
**Description:** This type represents an ineligibility reason indicating the item commitment is not eligible.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The unique machine-readable contract cancellation reason code for this use case. For this type, the value is \`CNCL\_ITEM\_COMMITMENT\_INELIGIBLE\`.
- **displayMessage** (String!)
  - A human-readable description of the eligibility failure reason: \`This item commitment cannot be cancelled due to policy restrictions.\`. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **itemCommitmentId** (ID!)
  - The ID of the item commitment whose cancellation was blocked by item commitment level eligibility rules.

### ItemCommitmentCancellationConflictWithWindowElapsed
**Description:** This type represents an ineligibility reason indicating that the cancellation window on an item commitment had elapsed.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - Machine-readable eligibility failure reason code. For this type, the value is \`CNCL\_CANCELLATION\_WINDOW\_ELAPSED\`.
- **displayMessage** (String!)
  - Human-readable message of the eligibility failure reason. For this type, the value is \`It's too late to cancel this item commitment. Please contact the buyer to see if you can work something out.\` This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **itemCommitmentId** (ID!)
  - The ID of the item commitment whose cancellation was blocked by item commitment level eligibility rules.

### ItemCommitmentCancellationExistsConflict
**Description:** This type represents an ineligibility reason indicating that the requested item commitment already has a cancellation on file.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - Machine-readable eligibility failure reason code. For this type, the value is \`CNCL\_CANCELLATION\_EXISTS\_CONFLICT\`.
- **displayMessage** (String!)
  - Human-readable message of the eligibility failure reason. For this type, the value is \`You cannot cancel this item commitment because a cancellation exists on this contract.\` This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **itemCommitmentId** (ID!)
  - The ID of the item commitment for which cancellation is ineligible.

### ItemCommitmentCancellationReasonNotAllowed
**Description:** This type represents an ineligibility reason indicating an item commitment cancellation was blocked by an eligibility policy.
**Type:** GraphQLObjectType

**Properties:**
- **availableReasons** ([ContractCancellationReason]!)
  - The applicable cancellation reasons for current actor (user).
- **code** (String!)
  - The unique machine-readable contract cancellation reason code for this use case. For this type, the value is \`CNCL\_REASON\_NOT\_ALLOWED\`.
- **displayMessage** (String!)
  - A human-readable description of the eligibility failure reason: \`The cancellation reason you selected is not allowed by policy. Please choose a different reason and try again.\` This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **itemCommitmentId** (ID!)
  - The ID of the item commitment whose cancellation was blocked by item commitment level eligibility rules.

### BuyerOfferLimitReached
**Description:** This type defines the business rule error that occurs when a buyer has reached the offer limit.
**Type:** GraphQLObjectType

**Properties:**
- **restrictionExpiresAt** (DateTime)
  - A timestamp that indicates the moment the buyer will be able to make an offer without returning an error.
- **ruleDescription** (String!)
  - The description of the business rule failure. \*\*Maximum length\*\*: 250 characters

### CounterOfferLessThanAutoDeclinePrice
**Description:** This type defines the business rule error that occurs when a counter offer amount is less than auto decline threshold.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The description of the business rule failure. \*\*Maximum length\*\*: 250 characters

### CounterOfferNotEnabled
**Description:** This type defines the business rule error that occurs when counter offers are not enabled for this offer/item.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The description of the business rule failure. \*\*Maximum length\*\*: 250 characters

### InvalidOfferMessage
**Description:** This type defines the business rule error that occurs when an offer message includes invalid content.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The description of the business rule failure. \*\*Maximum length\*\*: 250 characters

### ItemNotEligibleForOffer
**Description:** This type defines the business rule error that occurs when offers are not enabled for this item.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The description of the business rule failure. \*\*Maximum length\*\*: 250 characters

### OfferBuyerBlockedBySeller
**Description:** This type defines the business rule error that occurs when the buyer has been blocked by the seller.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The description of the business rule failure. \*\*Maximum length\*\*: 250 characters

### OfferBuyerLowFeedbackBlock
**Description:** This type defines the business rule error that occurs when the buyer has been blocked due to low feedback.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The description of the business rule failure. \*\*Maximum length\*\*: 250 characters

### OfferBuyerNotPreApproved
**Description:** This type defines the business rule error that occurs when the buyer needs to be pre-approved by the seller
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The description of the business rule failure. \*\*Maximum length\*\*: 250 characters

### OfferBuyerUPIStrike
**Description:** This type defines the business rule error that occurs when the buyer has been blocked due to a UPI (unpaid item) policy strike.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The description of the business rule failure. \*\*Maximum length\*\*: 250 characters

### OfferBuyerWonItemCountLimitExceeded
**Description:** This type defines the business rule error that occurs when the buyer has exceeded the maximum item count limit.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The description of the business rule failure. \*\*Maximum length\*\*: 250 characters

### OfferBuyingOwnItem
**Description:** This type defines the business rule error that occurs when a seller attempts to buy their own item.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The description of the business rule failure. \*\*Maximum length\*\*: 250 characters

### OfferContentModerationBlock
**Description:** This type defines the business rule error that occurs when an offer message blocked by the content moderation policy.
**Type:** GraphQLObjectType

**Properties:**
- **blockMessage** (String)
  - A message explaining the content moderation block error. \*\*Maximum length\*\*: 100 characters
- **blockShortMessage** (String)
  - A compact message explaining the content moderation block error. \*\*Maximum length\*\*: 50 characters
- **ruleDescription** (String!)
  - The description of the business rule failure. \*\*Maximum length\*\*: 250 characters

### OfferGuestUserAccountNotAllowed
**Description:** This type defines the business rule error that occurs when a guest user attempts to submit an offer.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The description of the business rule failure. \*\*Maximum length\*\*: 250 characters

### OfferItemAlreadyPurchased
**Description:** This type defines the business rule error that occurs when an item has already been purchased.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The description of the business rule failure. \*\*Maximum length\*\*: 250 characters

### OfferItemEnded
**Description:** This type defines the business rule error that occurs when an item listing has ended.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The description of the business rule failure. \*\*Maximum length\*\*: 250 characters

### OfferItemPending
**Description:** This type defines the business rule error that occurs when an item is in pending state.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The description of the business rule failure. \*\*Maximum length\*\*: 250 characters

### OfferItemRevisionLimitExceeded
**Description:** This type defines the business rule error that occurs when an item revision limit has been exceeded and offers are not allowed.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The description of the business rule failure. \*\*Maximum length\*\*: 250 characters

### OfferLowerThanMinimumListingPrice
**Description:** This type defines the business rule error that occurs when the offer price is lower than the minimum listing price amount for the listing site.
**Type:** GraphQLObjectType

**Properties:**
- **minimumListingPrice** (Amount)
  - The minimum listing price amount for this listing.
- **ruleDescription** (String!)
  - The description of the business rule failure. \*\*Maximum length\*\*: 250 characters

### OfferMessagingNotAllowed
**Description:** This type defines the business rule error that occurs when messaging is not allowed for the offer.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The description of the business rule failure. \*\*Maximum length\*\*: 250 characters

### OfferMultiSKUNotAllowed
**Description:** This type defines the business rule error that occurs when an offer is made for a multi-SKU item.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The description of the business rule failure. \*\*Maximum length\*\*: 250 characters

### OfferNoLongerAvailable
**Description:** This type defines the business rule error that occurs when an offer is no longer available.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The description of the business rule failure. \*\*Maximum length\*\*: 250 characters

### OfferNotAllowedOnUserAccountHoldByResolution
**Description:** This type defines the business rule error that occurs when an account is on hold by a resolution, and offers are not allowed.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The description of the business rule failure. \*\*Maximum length\*\*: 250 characters

### OfferNotAllowedOnUserAccountOnHold
**Description:** This type defines the business rule error that occurs when the user's account is on hold and offers are not allowed.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The description of the business rule failure. \*\*Maximum length\*\*: 250 characters

### OfferNotAvailableForAccept
**Description:** This type defines the business rule error that occurs when the offer status cannot transition to accepted.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The description of the business rule failure. \*\*Maximum length\*\*: 250 characters

### OfferPolicyViolationError
**Description:** This type defines the business rule error that occurs when an offer is blocked by a policy violation check.
**Type:** GraphQLObjectType

**Properties:**
- **correlationId** (String)
  - The unique identifier of the correlation used for tracking the policy violation check failure. \*\*Maximum length\*\*: 40 characters \*\*Format\*\*: Alphanumeric characters and underscores
- **policyViolationMessage** (String)
  - An explanatory message of the specific policy violation check blocker. \*\*Maximum length\*\*: 100 characters
- **redirectionUrl** (String)
  - If the blocker can be remediated, this field will return a URL that redirects the user to a page explaining how to take remediating action. \*\*Format\*\*: URL \*\*Maximum length\*\*: 2048 characters
- **ruleDescription** (String!)
  - The description of the business rule failure. \*\*Maximum length\*\*: 250 characters

### OfferPriceGreaterThanBinPrice
**Description:** This type defines the business rule error that occurs when the offer price was greater than the BIN (Buy it now) price.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The description of the business rule failure. \*\*Maximum length\*\*: 250 characters

### OfferPriceMaxLimitExceeded
**Description:** This type defines the business rule error that occurs when the offer price max limit exceeded.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The description of the business rule failure. \*\*Maximum length\*\*: 250 characters

### OfferPriceNotWhole
**Description:** This type defines the business rule error that occurs when the offer price should be a whole number for this site.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The description of the business rule failure. \*\*Maximum length\*\*: 250 characters

### OfferPriceThresholdNotMet
**Description:** This type defines the business rule error that occurs when the offer price does not represent a significant discount compared to the BIN (Buy it now) price.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The description of the business rule failure. \*\*Maximum length\*\*: 250 characters

### OfferQuantityNotAvailable
**Description:** This type defines the business rule error that occurs when the offer quantity is not available.
**Type:** GraphQLObjectType

**Properties:**
- **alreadyBoughtQuantity** (Int)
  - The quantity of the item already purchased by this buyer for this listing. \*\*Unit\*\*: items (whole count) \*\*Range\*\*: non-negative integer (0+)
- **availableQuantity** (Int)
  - The quantity of the item currently available for purchase. \*\*Unit\*\*: items (whole count) \*\*Range\*\*: non-negative integer (0+)
- **offerQuantity** (Int)
  - The quantity of the item requested in the offer. \*\*Unit\*\*: items (whole count) \*\*Range\*\*: positive integer (1+)
- **perBuyerMaximumAllowedQuantity** (Int)
  - The maximum quantity of the item allowed per buyer for this listing. \*\*Unit\*\*: items (whole count) \*\*Range\*\*: positive integer (1+) when enforced; null if no per-buyer cap
- **ruleDescription** (String!)
  - The description of the business rule failure. \*\*Maximum length\*\*: 250 characters

### OfferShipToLocationExclusion
**Description:** This type defines the business rule error that occurs when the item does not ship to the buyer's location.
**Type:** GraphQLObjectType

**Properties:**
- **buyerShipToCountry** (CountryAlpha2Code)
  - The two-letter country code of the country where the buyer wants the item shipped.
- **ruleDescription** (String!)
  - The description of the business rule failure. \*\*Maximum length\*\*: 250 characters

### OfferUPIPurchaseOrderBlock
**Description:** This type defines the business rule error that occurs when the buyer has unpaid purchase orders for this item.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The description of the business rule failure. \*\*Maximum length\*\*: 250 characters

### OfferUserAccountNotActive
**Description:** This type defines the business rule error that occurs when the user's account is not active.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The description of the business rule failure. \*\*Maximum length\*\*: 250 characters

### OfferUserNotValid
**Description:** This type defines the business rule error that occurs when the attempted offer action is not done by the buyer or seller.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The description of the business rule failure. \*\*Maximum length\*\*: 250 characters

### OfferUserSuspended
**Description:** This type defines the business rule error that occurs when the user's account is suspended.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The description of the business rule failure. \*\*Maximum length\*\*: 250 characters

### PendingOffer
**Description:** This type defines the business rule error that occurs when there is an active pending offer for the item/buyer.
**Type:** GraphQLObjectType

**Properties:**
- **ruleDescription** (String!)
  - The description of the business rule failure. \*\*Maximum length\*\*: 250 characters

### CancellationOrderIneligible
**Description:** This type represents an ineligibility reason indicating the order is not eligible for cancellation.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The unique machine-readable contract cancellation reason code for this use case. For this type, the value is \`CNCL\_ORDER\_INELIGIBLE\`.
- **displayMessage** (String!)
  - A human-readable description of the eligibility failure reason: \`This order cannot be cancelled due to policy restrictions.\` This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **orderId** (ID!)
  - The ID of the order whose cancellation was blocked by order level eligibility rules.

### OrderCancellationConflictWithWindowElapsed
**Description:** This type represents an ineligibility reason indicating that the cancellation window on an order has elapsed.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - Machine-readable eligibility failure reason code. For this type, the value is \`CNCL\_CANCELLATION\_WINDOW\_ELAPSED\`.
- **displayMessage** (String!)
  - Human-readable message of the eligibility failure reason: It's too late to cancel this order. Please contact the buyer to see if you can work something out.\` This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **orderId** (ID!)
  - The ID of the order whose cancellation was blocked by order level eligibility rules.

### OrderCancellationExistsConflict
**Description:** This type represents an ineligibility reason indicating that the requested order already has a cancellation on file.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - Machine-readable eligibility failure reason code. For this type, the value is \`CNCL\_CANCELLATION\_EXISTS\_CONFLICT\`.
- **displayMessage** (String!)
  - A human-readable description of the error message of the eligibility failure reason. For this type, the value is \`You cannot cancel this order because a cancellation exists on this contract.\` This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **orderId** (ID!)
  - The ID of the order for which cancellation is ineligible.

### OrderCancellationReasonNotAllowed
**Description:** This type represents an ineligibility reason indicating a policy issue that blocked cancellation.
**Type:** GraphQLObjectType

**Properties:**
- **availableReasons** ([ContractCancellationReason]!)
  - A list of applicable cancellation reasons for current actor.
- **code** (String!)
  - The unique machine-readable contract cancellation reason code for this use case. For this type, the value is \`CNCL\_REASON\_NOT\_ALLOWED\`.
- **displayMessage** (String!)
  - A human-readable description of the eligibility failure reason: \`The cancellation reason you selected is not allowed by policy. Please choose a different reason and try again.\` This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **orderId** (ID!)
  - The ID of the order whose cancellation was blocked by order level cancellation eligibility rules.

### CancellationConflictWithDispute
**Description:** This type indicates the cancellation ineligibility failure reason was because a dispute already exists.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The unique machine-readable contract cancellation reason code for this use case. For this type, the value is \`CNCL\_DISPUTE\_EXISTS\_CONFLICT\`.
- **displayMessage** (String!)
  - A human-readable description of the eligibility failure reason: \`You cannot cancel this order because the buyer has filed a payment dispute on this order.\` This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **orderLineItemIds** ([ID!]!)
  - A list of one or more order line item IDs whose cancellation was blocked by an order line-item level eligibility rule.

### CancellationConflictWithFulfillment
**Description:** This type indicates the cancellation is ineligible due to an order fulfillment conflict.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The unique machine-readable contract cancellation reason code for this use case. For this type, the value is \`CNCL\_FULFILLMENT\_EXISTS\_CONFLICT\`.
- **displayMessage** (String!)
  - A human-readable description of the eligibility failure reason: \`You cannot cancel this order because the order fulfillment process has already started.\` This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **orderLineItemIds** ([ID!]!)
  - A list of one or more order line item IDs whose cancellation was blocked by an order line-item level eligibility rule.

### CancellationConflictWithInquiry
**Description:** This type indicates the cancellation is ineligibility because an inquiry already exists.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The unique machine-readable contract cancellation reason code for this use case. For this type, the value is \`CNCL\_INQUIRY\_EXISTS\_CONFLICT\`.
- **displayMessage** (String!)
  - A human-readable description of the eligibility failure reason: \`You cannot cancel this order because a case exists on this order\`. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **orderLineItemIds** ([ID!]!)
  - A list of one or more order line item IDs whose cancellation was blocked by an order line-item level eligibility rule.

### CancellationConflictWithPaymentIssue
**Description:** This type represents an ineligibility reason indicating a buyer payment issue that blocks cancelation eligibility.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The unique machine-readable contract cancellation reason code for this use case. For this type, the value is \`CNCL\_PAYMENT\_ISSUE\_CONFLICT\`.
- **displayMessage** (String!)
  - A human-readable description of the eligibility failure reason: \`You cannot cancel this order because there's issue with buyer's payment. Please try again shortly.\` This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **orderLineItemIds** ([ID!]!)
  - The IDs of the order line items whose cancellation was blocked by order line item level eligibility rules.

### CancellationConflictWithRefund
**Description:** This type indicates the cancellation ineligibility failure reason was because a refund already exists.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The unique machine-readable contract cancellation reason code for this use case. For this type, the value is \`CNCL\_REFUND\_EXISTS\_CONFLICT\`.
- **displayMessage** (String!)
  - A human-readable description of the eligibility failure reason: \`You cannot cancel this order because it has already been refunded.\` This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **orderLineItemIds** ([ID!]!)
  - A list of one or more order line item IDs whose cancellation was blocked by an order line-item level eligibility rule.

### CancellationConflictWithReturn
**Description:** This type represents an ineligibility reason indicating that the cancellation already existed for return on an order line item.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable eligibility failure reason code. For this type, the value is \`CNCL\_RETURN\_EXISTS\_CONFLICT\`.
- **displayMessage** (String!)
  - A human-readable message of the eligibility failure reason. For this type, the value is: \`You cannot cancel this order because the buyer has already requested a return on this order.\`. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **orderLineItemIds** ([ID!]!)
  - The IDs of the order line items whose cancellation was blocked by order line item level eligibility rules.

### ItemPriceRefundWithholdViolation
**Description:** This type represents input violations related to item price refund withholding. This indicates that the seller attempted to withhold the item price refund exceeding the allowed percentage range.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable code identifying the specific rule that was violated (for example, \`ITEM\_PRICE\_REFUND\_WITHHOLD\_VIOLATION\`).
- **constraint** (ItemPriceRefundWithholdConstraint!)
  - The constraints defined for item price refund withhold input.
- **displayMessage** (String!)
  - A human-readable message describing the rule violation. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters

### ShippingPriceRefundWithholdViolation
**Description:** This type represents input violations related to shipping price refund withholding. It indicates that the seller attempted to withhold the shipping cost when it is not allowed.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable code identifying the specific rule that was violated (for example: \`SHIPPING\_PRICE\_REFUND\_WITHHOLD\_VIOLATION\`).
- **displayMessage** (String!)
  - A human-readable message describing the rule violation. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters

### PartialRefundItemPriceViolation
**Description:** This type represents violations related to the partial refund item price.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable code identifying the specific rule that was violated (for example: \`ITEM\_PRICE\_PARTIAL\_REFUND\_VIOLATION\`).
- **constraint** (ReturnPartialRefundTermConstraint!)
  - This object defines the constraints for partial refund terms input.
- **displayMessage** (String!)
  - A human-readable message describing the rule violation. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters

### ShippingPriceWaiverViolation
**Description:** This type represents input violations related to partial refund shipping price. This indicates that the seller attempted to waive the shipping price when it is not allowed.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable code identifying the specific rule that was violated (for example, \`SHIPPING\_PRICE\_WAIVER\_VIOLATION\`).
- **displayMessage** (String!)
  - A human-readable message describing the rule violation. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters

### ReturnRmaNumberViolation
**Description:** This type represents the return RMA number input violations.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable code identifying the specific rule that was violated (for example, \`RETURN\_RMA\_NUMBER\_VIOLATION\`).
- **constraint** (ReturnRmaNumberConstraint!)
  - This object indicates the constraints defined for return RMA number input.
- **containsInvalidCharacters** (Boolean!)
  - This boolean indicates whether the return note contains invalid characters.
- **displayMessage** (String!)
  - A human-readable message describing the rule violation. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **exceededLength** (Boolean!)
  - This boolean indicates whether the return note exceeded the allowed length.

### OrderInquiryShippingCarrierNameViolation
**Description:** This type represents the order inquiry shipping carrier input field violation.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable code (for example: \`INQRY\_SHIPPING\_CARRIER\_NAME\_VIOLATION\`).
- **constraint** (OrderInquiryShippingCarrierConstraint!)
  - This object indicates the acceptable characters and length for carrier name input.
- **containsInvalidCharacters** (Boolean!)
  - This boolean indicates whether the carrier name contains invalid characters or not. If \`true\`, the carrier name contains invalid characters.
- **displayMessage** (String!)
  - The human-readable error message describing the issue. \*\*Maximum length\*\*: 512 characters
- **exceededLength** (Boolean!)
  - This boolean indicates whether the carrier name exceeded the allowed length or not. If \`true\`, the carrier name exceeds the allowed length.

### OrderInquiryTrackingNumberFieldViolation
**Description:** This type represents the order inquiry tracking number input field violation.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable code (for example: \`INQRY\_TRACKING\_NUMBER\_VIOLATION\`).
- **constraint** (OrderInquiryTrackingNumberConstraint!)
  - This object indicates the acceptable characters and length for inquiry tracking number input.
- **containsInvalidCharacters** (Boolean!)
  - This boolean indicates whether the tracking number contains invalid characters or not. If \`true\`, the tracking number contains invalid characters.
- **displayMessage** (String!)
  - The human-readable error message describing the issue. \*\*Maximum length\*\*: 512 characters
- **duplicateTrackingNumber** (Boolean!)
  - This boolean indicates whether the tracking number is already in use for another order or not. If \`true\`, the tracking number is a duplicate.
- **exceededLength** (Boolean!)
  - This boolean indicates whether the tracking number exceeded the allowed length or not. If \`true\`, the tracking number exceeds the allowed length.

### CancellationPurchaseQuoteIneligible
**Description:** This type represents an ineligibility reason indicating the purchase quote is not eligible.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The unique machine-readable contract cancellation reason code for this use case. For this type, the value is \`CNCL\_PURCHASE\_QUOTE\_INELIGIBLE\`.
- **displayMessage** (String!)
  - A human-readable description of the eligibility failure reason: \`This purchase quote cannot be cancelled due to policy restrictions.\` This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **purchaseQuoteId** (ID!)
  - The ID of the purchase quote whose cancellation was blocked by purchase quote level eligibility rules.

### PurchaseQuoteCancellationConflictWithWindowElapsed
**Description:** This type represents an ineligibility reason indicating that the cancellation window on the purchase quote has elapsed.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - Machine-readable eligibility failure reason code. For this type, the value is \`CNCL\_CANCELLATION\_WINDOW\_ELAPSED\`.
- **displayMessage** (String!)
  - Human-readable message of the eligibility failure reason. For this type, the value is: \`It's too late to cancel this purchase quote. Please contact the buyer to see if you can work something out.\` This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **purchaseQuoteId** (ID!)
  - The ID of the purchase quote whose cancellation was blocked by purchase quote level eligibility rules.

### PurchaseQuoteCancellationExistsConflict
**Description:** This type represents an ineligibility reason indicating that the requested purchase quote already has a cancellation on file.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - Machine-readable eligibility failure reason code. For this type, the value is \`CNCL\_CANCELLATION\_EXISTS\_CONFLICT\`.
- **displayMessage** (String!)
  - Human-readable message of the eligibility failure reason. For this type, the value is: \`You cannot cancel this purchase quote because a cancellation exists on this contract.\` This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **purchaseQuoteId** (ID!)
  - The ID of the purchase quote for which cancellation is ineligible.

### PurchaseQuoteCancellationReasonNotAllowed
**Description:** This type represents an ineligibility reason indicating the input purchase quote cancellation reason is not allowed by policy.
**Type:** GraphQLObjectType

**Properties:**
- **availableReasons** ([ContractCancellationReason]!)
  - This array returns a list of applicable cancellation reasons for current actor (user).
- **code** (String!)
  - The unique machine-readable contract cancellation reason code for this use case. For this type, the value is \`CNCL\_REASON\_NOT\_ALLOWED\`.
- **displayMessage** (String!)
  - A human-readable description of the eligibility failure reason: \`The cancellation reason you selected is not allowed by policy. Please choose a different reason and try again.\` This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **purchaseQuoteId** (ID!)
  - The ID of the purchase quote whose cancellation was blocked by purchase quote level eligibility rules.

### ReturnIneligibleCancellationExists
**Description:** This type represents that a line item is ineligible for return creation because a cancellation exists for this transaction.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable ineligibility code: \`CANCELLATION\_EXISTS\`
- **displayMessage** (String!)
  - A human-readable ineligibility message.
- **orderLineItem** (OrderLineItem!)
  - The line item that is ineligible for return.

### ReturnIneligibleInquiryExists
**Description:** This type indicates that the line item is ineligible for return creation because an inquiry already exists for the transaction.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable ineligibility code: \`INQUIRY\_EXISTS\`
- **displayMessage** (String!)
  - A human-readable ineligibility message.
- **orderLineItem** (OrderLineItem!)
  - Line Item that is ineligible for return.

### ReturnIneligibleInStoreReturnNotSupported
**Description:** This type represents that a line item is ineligible for return creation because in-store returns are not permitted.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable ineligibility code: \`IN\_STORE\_RETURN\_NOT\_SUPPORTED\`
- **displayMessage** (String!)
  - A human-readable ineligibility message.
- **orderLineItem** (OrderLineItem!)
  - Line Item that is ineligible for return.

### ReturnIneligiblePaymentDisputeExists
**Description:** This type represents that a line item is ineligible for return creation because a payment dispute exists for the transaction.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable ineligibility code: \`PAYMENT\_DISPUTE\_EXISTS\`
- **displayMessage** (String!)
  - A human-readable ineligibility message.
- **orderLineItem** (OrderLineItem!)
  - Line Item that is ineligible for return.

### ReturnIneligibleQuantityExceeded
**Description:** This type indicates that a line item is ineligible for return creation because requested quantity exceeds the returnable quantity.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable ineligibility code: \`QUANTITY\_EXCEEDED\`
- **displayMessage** (String!)
  - A human-readable ineligibility message.
- **orderLineItem** (OrderLineItem!)
  - Line Item that is ineligible for return
- **requestedQuantity** (Int!)
  - Quantity requested by the user.
- **returnableQuantity** (Int!)
  - Quantity that can be returned.

### ReturnIneligibleReasonNotAllowed
**Description:** This type indicates that the line item is ineligible for return creation because a requested return reason is not allowed.
**Type:** GraphQLObjectType

**Properties:**
- **allowedReasons** ([ReturnReason!]!)
  - The return reason codes that are allowed for this line item.
- **code** (String!)
  - A machine-readable ineligibility code: \`RETURN\_REASON\_NOT\_ALLOWED\`
- **displayMessage** (String!)
  - A human-readable ineligibility message.
- **orderLineItem** (OrderLineItem!)
  - This field indicates the line item that is ineligible for return.

### ReturnIneligibleRefundIssued
**Description:** This type represents that a line item is ineligible for return creation because a refund has already been issued.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable ineligibility code: \`REFUND\_ALREADY\_ISSUED\`
- **displayMessage** (String!)
  - A human-readable ineligibility message.
- **orderLineItem** (OrderLineItem!)
  - Line Item that is ineligible for return.

### ReturnIneligibleReturnExists
**Description:** This type represents that a line item is ineligible for return creation because a return already exists for the transaction.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable ineligibility code: \`RETURN\_EXISTS\`
- **displayMessage** (String!)
  - A human-readable ineligibility message.
- **orderLineItem** (OrderLineItem!)
  - Line Item that is ineligible for return.

### ReturnIneligibleReturnNotAccepted
**Description:** This type indicates that a line item is ineligible to have a return created because returns disallowed by policy (seller-specific and/or eBay policy).
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable ineligibility code: \`RETURN\_NOT\_ACCEPTED\`
- **displayMessage** (String!)
  - A human-readable ineligibility message.
- **orderLineItem** (OrderLineItem!)
  - Line Item that is ineligible for return.

### ReturnIneligibleReturnWindowElapsed
**Description:** This type represents that a line item is ineligible for return creation because the return window has elapsed.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable ineligibility code: \`RETURN\_WINDOW\_ELAPSED\`
- **displayMessage** (String!)
  - A human-readable ineligibility message.
- **orderLineItem** (OrderLineItem!)
  - Line Item that is ineligible for return.

### ReturnIneligibleTooEarly
**Description:** This type represents that a line item is ineligible for return creation because it is too early to file a return.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable ineligibility code: \`TOO\_EARLY\_TO\_REQUEST\_RETURN\`
- **displayMessage** (String!)
  - A human-readable ineligibility message.
- **orderLineItem** (OrderLineItem!)
  - Line Item that is ineligible for return.

### ReturnRuleDuplicateConditionViolation
**Description:** This type indicates that a condition is duplicated in the input rule set. A condition can appear only once in the input rule set.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable code identifying the failed condition: \`RTRN\_RULE\_DUPLICATE\_CONDITION\`.
- **displayMessage** (String!)
  - A human-readable explanation of the violation. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **duplicateCondition** ([ReturnRuleCondition!]!)
  - The duplicate condition which is provided in input conditions. A condition can appear only once in the input rule set.

### ReturnRuleItemCategoryConditionViolation
**Description:** This type indicates that there is a category condition violation. Provided category IDs must be leaf categories and category IDs must be valid/known eBay categories.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable code identifying the failed condition: \`RTRN\_INVALID\_ITEM\_CATEGORY\_CONDITION\`.
- **constraint** (ReturnRuleItemCategoryConditionConstraint!)
  - This object indicates the constraints defined for return rule item condition.
- **displayMessage** (String!)
  - A human-readable explanation of the violation. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **duplicateCategoryIds** ([ID!])
  - A list of duplicate category IDs.
- **exceedsAllowedThreshold** (Boolean!)
  - This boolean indicates that max number of categories allowed has been exceeded.
- **invalidCategoryIds** ([ID!])
  - A list of invalid or unknown category IDs.

### ReturnRuleItemLocationCountryViolation
**Description:** This violation type occurs when invalid or duplicates countries are provided in the item location countries condition: - a country can appear only once in the input rule set - country codes must be valid \*\*CountryAlpha2Code\*\*
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable code identifying the failed condition: \`RTRN\_RULE\_ITEM\_LOCATION\_CONDITION\`.
- **displayMessage** (String!)
  - A human-readable explanation of the violation. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **duplicateCountryCodes** ([CountryAlpha2Code!])
  - A list of one or more duplicate countries in item location input condition. \*\*Note:\*\* A country can appear only once in the input rule set.
- **invalidCountryCodes** ([CountryAlpha2Code!])
  - A list of one or more invalid country codes provided in item location countries input condition.

### ReturnRuleListingGroupConditionViolation
**Description:** The listing group condition violation details. The group ID must exist in seller's \*\*availableListingGroups\*\*.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable code identifying the failed condition: \`RTRN\_INVALID\_LISTING\_GROUP\_CONDITION\`.
- **displayMessage** (String!)
  - A human-readable explanation of the violation. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **invalidReturnRuleListingGroupId** (ID!)
  - The listing group ID provided in the request.

### ReturnRuleRefundRangeConditionViolation
**Description:** This type defines the refund range condition violation details: - the minimum must be less than or equal to maximum - negative values will not be accepted
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable code identifying the failed condition: \`RTRN\_INVALID\_REFUND\_RANGE\_CONDITION\`.
- **displayMessage** (String!)
  - A human-readable explanation of the violation. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **invalidRange** (Boolean)
  - When \`true\`, maximum < minimum.
- **negativeValuesProvided** (Boolean)
  - When \`true\`, \*\*minAmount\*\* or \*\*maxAmount\*\* is negative.
- **providedRefundRangeCondition** (ReturnRefundRangeCondition!)
  - The value of minimum and maximum refund values provided in input.

### ReturnRuleShipmentOriginCountryViolation
**Description:** This type defines the error that occurs when invalid or duplicates countries are provided in the shipment origin countries condition. A country can appear only once in the input rule set and country codes must be valid CountryAlpha2Code.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable code identifying the failed condition: \`RTRN\_RULE\_SHIPMENT\_ORIGIN\_CONDITION\`.
- **displayMessage** (String!)
  - A human-readable explanation of the violation. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **duplicateCountryCodes** ([CountryAlpha2Code!])
  - The duplicate country codes that are in the return-shipment origin country input condition. \*\*Note:\*\* A country can appear only once in the input rule set.
- **invalidCountryCodes** ([CountryAlpha2Code!])
  - When \`true\`, invalid country codes were provided in the shipment origin countries input condition.

### ReturnToNearestSellerAddressStrategy
**Description:** This type automatically routes returned items to the seller's nearest return address based on the buyer's location.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable code identifying the return address routing strategy: \`CLOSEST\_RETURN\_ADDRESS\_TO\_BUYER\`. \*\*Format:\*\* Alphanumeric with underscores \*\*Maximum length:\*\* 50 characters
- **displayText** (String!)
  - A human-readable return fulfillment status. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### ReturnToOriginalShipFromAddressStrategy
**Description:** This type specifies a routing strategy that directs returns to the address from which the item was originally shipped.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable code identifying the return address routing strategy: \`RETURN\_TO\_SHIP\_FROM\_ADDRESS\`. \*\*Format:\*\* Alphanumeric with underscores \*\*Maximum length:\*\* 50 characters
- **displayText** (String!)
  - A human-readable label identifying the return fulfillment status. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters

### ReturnToSpecificAddressStrategy
**Description:** This type specifies the routing strategy for returns. When set, returned items are sent to the seller's defined return address. \*\*Note: \*\*Addresses must be defined in the address book before they can be used.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable code identifying the return address routing strategy: \`USE\_SPECIFIC\_RETURN\_ADDRESS\`. \*\*Format:\*\* Alphanumeric with underscores \*\*Maximum length:\*\* 150 characters
- **displayText** (String!)
  - A human-readable label identifying the return fulfillment status. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 100 characters
- **returnAddress** (Address!)
  - The specific return address to which returns will be routed. This address was set by the seller when rule was created.

### ListingIdsExceedMaxError
**Description:** This error is returned when the number of listing IDs provided for the \*\*sellerListingSearch\*\* query exceeds the maximum allowed limit.
**Type:** GraphQLObjectType

**Properties:**
- **actualCount** (Int!)
  - The actual number of listing IDs provided.
- **errorDescription** (String!)
  - The technical description of the error for developers and debugging purposes.
- **maxAllowed** (Int!)
  - The maximum number of listing IDs allowed.
- **remedy** (String!)
  - A user-friendly suggestion on how to fix the error. This can be displayed to end users to help them correct their input.

### PaginationPageSizeExceedError
**Description:** This error is returned when the pagination limit (maxPageSize) provided for the \*\*sellerListingSearch\*\* query exceeds the maximum allowed value.
**Type:** GraphQLObjectType

**Properties:**
- **actualPageSize** (Int!)
  - The actual page size provided.
- **errorDescription** (String!)
  - The technical description of the error for developers and debugging purposes.
- **maxPageSize** (Int!)
  - The maximum page size allowed.
- **remedy** (String!)
  - A user-friendly suggestion on how to fix the error. This can be displayed to end users to help them correct their input.

### PaginationTotalFetchLimitExceedError
**Description:** This error is returned when the combination of pagination parameters provided for the \*\*sellerListingSearch\*\* query would exceed the maximum fetch limit for the search.
**Type:** GraphQLObjectType

**Properties:**
- **calculatedFetchCount** (Int!)
  - The calculated fetch count based on pagination parameters.
- **errorDescription** (String!)
  - The technical description of the error for developers and debugging purposes.
- **maxFetchLimit** (Int!)
  - The maximum number of results that can be fetched.
- **pageIndex** (Int!)
  - The page index used in the calculation.
- **pageSize** (Int!)
  - The page size used in the calculation.
- **remedy** (String!)
  - A user-friendly suggestion on how to fix the error. This can be displayed to end users to help them correct their input.

### PrimaryCategoryExceedMaxError
**Description:** This type indicates that the number of primary category IDs provided for the \*\*sellerListingSearch\*\* query exceeds the maximum allowed limit.
**Type:** GraphQLObjectType

**Properties:**
- **actualCount** (Int!)
  - The actual number of primary category IDs provided.
- **errorDescription** (String!)
  - The technical description of the error for developers and debugging purposes.
- **maxAllowed** (Int!)
  - The maximum number of primary category IDs allowed.
- **remedy** (String!)
  - A user-friendly suggestion on how to fix the error. This can be displayed to end users to help them correct their input.

### PrimaryStoreCategoryExceedMaxError
**Description:** This type indicates that the number of primary store category IDs provided for the \*\*sellerListingSearch\*\* query exceeds the maximum allowed limit.
**Type:** GraphQLObjectType

**Properties:**
- **actualCount** (Int!)
  - The actual number of primary store category IDs provided.
- **errorDescription** (String!)
  - A technical description of the error for developers and debugging purposes.
- **maxAllowed** (Int!)
  - The maximum number of primary store category IDs allowed.
- **remedy** (String!)
  - A user-friendly suggestion on how to fix the error. This can be displayed to end users to help them correct their input.

### SkusExceedMaxCountError
**Description:** This type is returned when the number of Stock Keeping Units (SKUs) provided for the \*\*sellerListingSearch\*\* query exceeds the maximum allowed count.
**Type:** GraphQLObjectType

**Properties:**
- **actualCount** (Int!)
  - The actual number of Stock Keeping Units (SKUs) provided.
- **errorDescription** (String!)
  - The technical description of the error for developers and debugging purposes.
- **maxAllowed** (Int!)
  - The maximum number of Stock Keeping Units (SKUs) allowed.
- **remedy** (String!)
  - A user-friendly suggestion on how to fix the error. This can be displayed to end users to help them correct their input.

### SkusExceedMaxLengthError
**Description:** This type is returned when one or more Stock Keeping Units (SKUs) provided for the \*\*sellerListingSearch\*\* query exceeds the maximum allowed length.
**Type:** GraphQLObjectType

**Properties:**
- **errorDescription** (String!)
  - The technical description of the error for developers and debugging purposes.
- **maxLength** (Int!)
  - The maximum length allowed for each SKU.
- **remedy** (String!)
  - A user-friendly suggestion on how to fix the error. This can be displayed to end users to help them correct their input.
- **violatingSkus** ([String!]!)
  - A list of SKUs that exceed the maximum length.

### StartDateAfterEndDateError
**Description:** This error is returned when the start date provided for the \*\*sellerListingSearch\*\* query is after the end date provided for a date range filter.
**Type:** GraphQLObjectType

**Properties:**
- **endDate** (DateTime!)
  - The provided end date.
- **errorDescription** (String!)
  - The technical description of the error for developers and debugging purposes.
- **remedy** (String!)
  - A user-friendly suggestion on how to fix the error. This can be displayed to end users to help them correct their input.
- **startDate** (DateTime!)
  - The provided start date.

### OrderInquiryMessageFieldViolation
**Description:** This type represents the order inquiry message input field violation.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable code (for example: 'INQRY\_MESSAGE\_VIOLATION').
- **constraint** (OrderInquiryMessageConstraint!)
  - This container represents the acceptable characters and length for inquiry message input.
- **containsInvalidCharacters** (Boolean!)
  - This boolean indicates whether the inquiry message contains invalid characters or not. If 'true', the message contains invalid characters.
- **displayMessage** (String!)
  - The human-readable error message describing the issue. \*\*Maximum length\*\*: 512 characters
- **exceededLength** (Boolean!)
  - This boolean indicates whether the inquiry message exceeded the allowed length or not. If 'true', the message exceeds the allowed length.

### OrderInquiryReferralViolation
**Description:** This type represents the order inquiry referral reason input field violation.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - The machine-readable code (for example: \`INQRY\_REFERRAL\_REASON\_VIOLATION\`).
- **constraint** (OrderInquiryReferralConstraint!)
  - This object defines the constraints for inquiry referral input.
- **displayMessage** (String!)
  - The human-readable error message describing the issue. \*\*Maximum length\*\*: 512 characters

### ReturnReferralReasonViolation
**Description:** This type represents the violations related to referral return reasons.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable code identifying the specific rule that was violated (for example, \`RETURN\_REFERRAL\_REASON\_VIOLATION\`).
- **constraint** (ReturnReferralConstraint!)
  - This object defines the constraints for the return referral.
- **displayMessage** (String!)
  - A human-readable message describing the rule violation. This alphanumeric string is not localized and may change without notice. \*\*Maximum length:\*\* 512 characters
- **invalidReferralReason** (Boolean!)
  - This boolean indicates whether the provided referral reason code is invalid or not recognized.

### SellerDonationCredit
**Description:** This type defines the donation credit amount credited to a seller.
**Type:** GraphQLObjectType

**Properties:**
- **creditAmount** (AmountSet!)
  - The monetary amount credited to the seller.
- **name** (String!)
  - The human-readable name for all the seller refund credits intended for consumption by an end user for \`DONATION\_CREDIT\`.

### SellerFeeCredit
**Description:** This type defines the fee credit amount credited to a seller.
**Type:** GraphQLObjectType

**Properties:**
- **creditAmount** (AmountSet!)
  - The monetary amount credited to the seller.
- **name** (String!)
  - The human-readable name for all the seller refund credits intended for consumption by an end user for \`FEE\_CREDIT\`.

### ShippingDelivered
**Description:** This type indicates that the shipment was delivered.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable code representing the current state of the shipment as \`DELIVERED\`. \*\*Format:\*\* Alphanumeric with underscores \*\*Maximum length:\*\* 100 characters
- **displayText** (String!)
  - A human-readable description of the shipment tracking status.

### ShippingInTransit
**Description:** This type indicates the shipment tracking status is in transit.
**Type:** GraphQLObjectType

**Properties:**
- **code** (String!)
  - A machine-readable code identifying the current state of the shipment as \`IN\_TRANSIT\`. \*\*Format:\*\* Alphanumeric with underscores \*\*Maximum length:\*\* 100 characters
- **displayText** (String!)
  - A human-readable description of the shipment tracking status.

### DigitalDeliveryPoint
**Description:** This type is used to convey information about a digital delivery logistics point involved in a fulfillment plan.
**Type:** GraphQLObjectType

**Properties:**
- **address** (PurchaseAddress)
  - The shipping address associated with this digital delivery logistics point, if applicable. This may be returned \`null\`.
- **name** (String!)
  - The user-friendly name of the digital delivery logistics point (for example \`Customer Email Address\`).
- **recipient** (DigitalUser!)
  - The recipient of the item via digital delivery. This will either be an email address if the item is delivered to an external address, or a public username if the item is delivered to the buyer's eBay InBox.
- **type** (DisplayableId!)
  - The functional role of the digital delivery logistics point in the logistics flow (for example, \`DIGITAL\_SOURCE\` or \`DIGITAL\_DESTINATION\`).

### PickupPoint
**Description:** This type is used to convey information about a pickup logistics point involved in a fulfillment plan.
**Type:** GraphQLObjectType

**Properties:**
- **address** (PurchaseAddress)
  - The physical address associated with this pickup logistics point.
- **name** (String!)
  - The user-friendly name of the pickup logistics point (for example, \`San Jose Warehouse\`).
- **pickupLocationId** (ID)
  - The seller-defined unique identifier for the pickup location, if applicable. \*\*Note\*\*: Only applicable for Buy online, pick up in store (BOPIS) or Click and Collect orders.
- **storeId** (ID)
  - The eBay-generated unique identifier of a store that is used for pickup of items in a Buy online, pick up in store (BOPIS) or Click and Collect order. \*\*Note\*\*: Only applicable for Buy online, pick up in store (BOPIS) or Click and Collect orders.
- **type** (DisplayableId!)
  - The functional role of the shipping point in the logistics flow (for example, \`PICKUP\`).

### ShippingPoint
**Description:** This type is used to convey information about a shipping logistics point involved in a fulfillment plan.
**Type:** GraphQLObjectType

**Properties:**
- **address** (PurchaseAddress)
  - The physical address associated with this logistics node.
- **name** (String!)
  - The user-friendly name of the shipping logistics point. (for example, \`San Jose Warehouse\`, \`Customer Home\`).
- **type** (DisplayableId!)
  - The functional role of the node in the logistics flow (e.g., \`WAREHOUSE\`, \`CUSTOMS\`, \`DESTINATION\`).

### BuyerPaymentAccount
**Description:** This type is used to define a source payment account for a payer.
**Type:** GraphQLObjectType

**Properties:**
- **domain** (ID!)
  - A unique identifier that identifies the domain or type of account for the payer.
- **identifier** (ID!)
  - The unique identifier of the payer's account.
- **user** (User)
  - The eBay user associated with this account.

### EbayLiabilityAccount
**Description:** This type represents an eBay liability account used for fund transfers.
**Type:** GraphQLObjectType

**Properties:**
- **domain** (ID!)
  - The unique identifier of the domain or type of the account. Value: \`EBAY\`.
- **identifier** (ID!)
  - A unique identifier for this liability account, used when performing fund transfers.

### EbayRevenueAccount
**Description:** This type represents an eBay revenue account used for managing and transferring funds.
**Type:** GraphQLObjectType

**Properties:**
- **domain** (ID!)
  - The unique identifier of the domain or type of the account.
- **identifier** (ID!)
  - The unique identifier of the account used for fund transfers.

### OrderExportsDutyAccount
**Description:** This type is used to show details about an exports duty account used as a destination account.
**Type:** GraphQLObjectType

**Properties:**
- **domain** (ID!)
  - The unique identifier of the domain or type of the account.
- **identifier** (ID!)
  - The unique identifier of the account used for fund transfers.

### OrderFeeAccount
**Description:** This type is used to identify a seller's financial account used to charge against for eBay listing and order-related fees.
**Type:** GraphQLObjectType

**Properties:**
- **domain** (ID!)
  - The unique identifier of the domain or type of the account.
- **identifier** (ID!)
  - The unique identifier of the account that will be charged with fees.

### OrderIncentiveAccount
**Description:** This type indicates that AU Benefit / Incentive account was used as the source account.
**Type:** GraphQLObjectType

**Properties:**
- **domain** (ID!)
  - The domain or type of the account.
- **identifier** (ID!)
  - The unique identifier of the account.
- **incentiveDetails** ([OrderIncentiveDetails!])
  - This array returns details for the incentive account.

### OrderServicePartnerAccount
**Description:** This type represents the Service Partner Account to which the order's collected service fee will be distributed.
**Type:** GraphQLObjectType

**Properties:**
- **domain** (ID!)
  - The unique identifier of the domain or type of the account.
- **identifier** (ID!)
  - The unique identifier of the account used for fund transfers.

### OrderShippingPartnerAccount
**Description:** This type represents the Shipping Partner Account to which the order's collected shipping fee will be distributed.
**Type:** GraphQLObjectType

**Properties:**
- **domain** (ID!)
  - The unique identifier of the domain or type of the account.
- **identifier** (ID!)
  - The unique identifier of the account used for fund transfers.

### OrderTaxAccount
**Description:** This type is used to identify the tax account to which the tax collected for the order will be distributed to.
**Type:** GraphQLObjectType

**Properties:**
- **domain** (ID!)
  - The unique identifier of the domain or type of the account.
- **identifier** (ID!)
  - The unique identifier of the account used for fund transfers.
- **taxJurisdiction** (OrderTaxJurisdiction!)
  - This object provides details on the tax jurisdiction.

### SellerPaymentAccount
**Description:** This type is used to identify a seller's financial account used to receive payout funds.
**Type:** GraphQLObjectType

**Properties:**
- **domain** (ID!)
  - The unique identifier of the domain or type of the account.
- **identifier** (ID!)
  - The unique identifier of the account that will receive payout funds.

### ReturnNoteConstraint
**Description:** This type represents the validation constraints defined for the return note.
**Type:** GraphQLObjectType

**Properties:**
- **characterLimit** (InputTextLengthRange!)
  - The minimum and maximum number of characters allowed.

### ReturnShippingCarrierConstraint
**Description:** This type represents the validation constraints defined for return shipping carrier name input.
**Type:** GraphQLObjectType

**Properties:**
- **characterLimit** (InputTextLengthRange!)
  - The minimum and maximum number of characters allowed.

### ReturnTrackingNumberConstraint
**Description:** This type represents the constraints defined for return tracking number input.
**Type:** GraphQLObjectType

**Properties:**
- **characterLimit** (InputTextLengthRange!)
  - The minimum and maximum number of characters allowed.

### CancellationShippedDateConstraint
**Description:** This type defines the valid date-time range within which the shipped date must fall.
**Type:** GraphQLObjectType

**Properties:**
- **fromDate** (DateTime!)
  - The earliest valid shipped date-time (inclusive). This value typically corresponds to the order creation date.
- **toDate** (DateTime!)
  - The latest valid shipped date-time (inclusive). This value typically corresponds to the current date-time.

### CancellationShippingCarrierCodeConstraint
**Description:** This type represents constraints defined for the cancellation shipping carrier code.
**Type:** GraphQLObjectType

**Properties:**
- **characterLimit** (InputTextLengthRange!)
  - The length of characters limited for cancellation shipping carrier code input.

### CancellationTrackingNumberConstraint
**Description:** This type represents the constraints defined for cancellation tracking number.
**Type:** GraphQLObjectType

**Properties:**
- **characterLimit** (InputTextLengthRange!)
  - The maximum length of characters for a cancellation tracking number.

### ItemPriceRefundWithholdConstraint
**Description:** This type represents the constraints defined for item price refund withhold input.
**Type:** GraphQLObjectType

**Properties:**
- **allowedPercentageRange** (InputPercentageRange!)
  - This object provides the allowed percentage range.

### ReturnPartialRefundTermConstraint
**Description:** This type represents the constraints defined for partial refund terms input.
**Type:** GraphQLObjectType

**Properties:**
- **allowedPercentageRange** (InputPercentageRange!)
  - This object provides the allowed percentage range.

### ReturnRmaNumberConstraint
**Description:** This type represents the validation constraints defined for Return Merchandise Authorization (RMA) number input.
**Type:** GraphQLObjectType

**Properties:**
- **characterLimit** (InputTextLengthRange!)
  - The allowed range for the number of characters (minimum and maximum) allowed for the return RMA number input.
- **rmaNumberRequired** (Boolean!)
  - When \`true\`, this value indicates an RMA number is required.

### OrderInquiryShippingCarrierConstraint
**Description:** This type represents the constraints defined for inquiry shipping carrier name input.
**Type:** GraphQLObjectType

**Properties:**
- **characterLimit** (InputTextLengthRange!)
  - The length of characters allowed for return shipping carrier input.

### OrderInquiryTrackingNumberConstraint
**Description:** This type represents the constraints defined for inquiry tracking number input.
**Type:** GraphQLObjectType

**Properties:**
- **characterLimit** (InputTextLengthRange!)
  - The length of characters allowed for inquiry tracking number input.

### ReturnRuleItemCategoryConditionConstraint
**Description:** This type indicates the constraints defined for return rule item condition.
**Type:** GraphQLObjectType

**Properties:**
- **maxAllowedCategory** (Int!)
  - The maximum number of categories allowed in the condition.

### OrderInquiryMessageConstraint
**Description:** This type represents the constraints defined for inquiry message input.
**Type:** GraphQLObjectType

**Properties:**
- **characterLimit** (InputTextLengthRange!)
  - The length of characters allowed for inquiry message input.

### OrderInquiryReferralConstraint
**Description:** This type represents the constraints defined for inquiry referral input.
**Type:** GraphQLObjectType

**Properties:**
- **validReferralReasons** ([OrderInquiryReferralReason!]!)
  - This array returns a list of valid referral reason codes that can be used when submitting a inquiry referral.

### ReturnReferralConstraint
**Description:** This type represents the constraints defined for return referral.
**Type:** GraphQLObjectType

**Properties:**
- **validReferralReasons** ([ReturnReferralReason!]!)
  - A list of valid referral reason codes that can be used when submitting a return referral.

### OrderIncentiveDetails
**Description:** This type provides loyalty offer details for gift cards, incentives, benefits, and similar promotions.
**Type:** GraphQLObjectType

**Properties:**
- **appliedOfferCode** (ID!)
  - The unique identifier of an applied offer code.
- **offerFulfillmentId** (String!)
  - The unique identifier of an offer fulfillment.
- **paymentMethod** (PurchasePaymentMethod!)
  - This object shows details on the payment method that is used to fund this offer.

### OrderTaxJurisdiction
**Description:** This type represents the tax jurisdiction for the order.
**Type:** GraphQLObjectType

**Properties:**
- **city** (String)
  - The city associated with the tax jurisdiction. \*\*Note\*\*: A null value indicates that the tax jurisdiction is not associated with a city. \*\*Maximum length\*\*: 50 characters
- **countryCode** (CountryCode)
  - The two-letter code for the country associated with the tax jurisdiction.
- **id** (ID!)
  - The unique identifier of the tax jurisdiction.
- **postalCode** (String)
  - The postal code associated with the tax jurisdiction. \*\*Note\*\*: A null value indicates that the tax jurisdiction is not associated with a postal code. \*\*Maximum length\*\*: 20 characters
- **provinceOrStateCode** (String)
  - The province or state associated with the tax jurisdiction. \*\*Note\*\*: A null value indicates that the tax jurisdiction is not associated with a province or state. \*\*Maximum length\*\*: 10 characters

### DigitalEmailUser
**Description:** This type is used to identify the email address of the recipient of a digital item.
**Type:** GraphQLObjectType

**Properties:**
- **email** (String!)
  - T he email address of the recipient of a digital item.

### DigitalSiteUser
**Description:** This type is used to identify the eBay username of the recipient of a digital item. This type is used if a digital item will be delivered to the eBay InBox of the recipient.
**Type:** GraphQLObjectType

**Properties:**
- **name** (String!)
  - The eBay username of the recipient of a digital item.

### InputPercentageRange
**Description:** This type represents the range of allowed percentage values for an input field.
**Type:** GraphQLObjectType

**Properties:**
- **maxValue** (Int!)
  - The maximum allowed value for percentage.
- **minValue** (Int!)
  - The minimum allowed value for percentage.

### PostPurchaseCaseDecisionFavor
**Description:** This enumerated type indicates who a case or appeal decision decision was in favor of. | - **BOTH**: This enum value indicates that the decision favored both parties (e.g., partial resolution). - **BUYER**: This enum value indicates that the decision favored the buyer. - **NONE**: This enum value indicates that the decision favored neither party (e.g., insufficient evidence, courtesy closure). - **SELLER**: This enum value indicates that the decision favored the seller.
**Type:** string

### PostPurchaseActorRole
**Description:** This enumerated type identifies which party performs the post-purchase action. | - **BUYER**: This enum value indicates that the actor is the buyer who made the purchase. - **EBAY**: This enum value indicates that the actor is eBay Customer Support, an eBay Partner involved in post-purchase flows, or an automated process which is triggering the post-purchase flow action. - **SELLER**: This enum value indicates that the actor is the seller who sold the item.
**Type:** string

### CurrencyAlpha3Code
**Description:** This enumerated type provides ISO 4217 three-letter currency codes. Each code represents an officially recognized national or supranational currency. \*\*Note:\*\* A supranational currency is a monetary unit issued or managed by a multi-country union or a central authority, rather than by a single country (for example, the euro). | - **AED**: This three-letter code indicates the currency is the United Arab Emirates Dirham. - **AFN**: This three-letter code indicates the currency is the Afghan Afghani. - **ALL**: This three-letter code indicates the currency is the Albanian Lek. This value replaced ALK code. - **AMD**: This three-letter code indicates the currency is the Armenian Dram. - **AOA**: This three-letter code indicates the currency is the Angolan Kwanza. - **ARS**: This three-letter code indicates the currency is the Argentine peso. - **AUD**: This three-letter code indicates the currency is the Australian dollar. - **AWG**: This three-letter code indicates the currency is the Aruban florin. - **AZN**: This three-letter code indicates the currency is the Azerbaijani manat. - **BAM**: This three-letter code indicates the currency is the Bosnia and Herzegovina Convertible Mark. - **BBD**: This three-letter code indicates the currency is the Barbadian dollar. - **BDT**: This three-letter code indicates the currency is the Bangladesh taka. - **BGN**: This three-letter code indicates the currency is the Bulgarian lev. - **BHD**: This three-letter code indicates the currency is the Bahraini dinar. - **BIF**: This three-letter code indicates the currency is the Burundian franc. - **BMD**: This three-letter code indicates the currency is the Bermudian dollar. - **BND**: This three-letter code indicates the currency is the Brunei Dollar. - **BOB**: This three-letter code indicates the currency is the Boliviano (the currency of Bolivia). - **BRL**: This three-letter code indicates the currency is the Brazilian real. - **BSD**: This three-letter code indicates the currency is the Bahamian dollar. - **BTN**: This three-letter code indicates the currency is the Bhutanese ngultrum. - **BWP**: This three-letter code indicates the currency is the Botswana Pula. - **BYN**: This three-letter code indicates the currency is the Belarusian Ruble. - **BZD**: This three-letter code indicates the currency is the Belize Dollar. - **CAD**: This three-letter code indicates the currency is the Canadian Dollar. - **CDF**: This three-letter code indicates the currency is the Congolese Franc (official currency of the Democratic Republic of the Congo) . - **CHF**: This three-letter code indicates the currency is the Swiss Franc. - **CLP**: This three-letter code indicates the currency is the Chilean peso. - **CNY**: This three-letter code indicates the currency is the Chinese yuan (also known as renminbi). - **COP**: This three-letter code indicates the currency is the Colombian Peso. - **CRC**: This three-letter code indicates the currency is the Costa Rican colon. - **CUP**: This three-letter code indicates the currency is the Cuban Peso. - **CVE**: This three-letter code indicates the currency is the Cape Verdean escudo (official currency of Cabo Verde island). - **CZK**: This three-letter code indicates the currency is the Czech Koruna. - **DJF**: This three-letter code indicates the currency is the Djiboutian franc. - **DKK**: This three-letter code indicates the currency is the Danish krone (official currency of Denmark, Greenland, and the Faroe Islands). - **DOP**: This three-letter code indicates the currency is the Dominican Peso (official currency of the Dominican Republic). - **DZD**: This three-letter code indicates the currency is the Algerian Dinar. - **EGP**: This three-letter code indicates the currency is the Egyptian Pound. - **ERN**: This three-letter code indicates the currency is the Eritrean nakfa. - **ETB**: This three-letter code indicates the currency is the Ethiopian Birr. - **EUR**: This three-letter code indicates the currency is the Euro, the currency used by countries in the European Union. - **FJD**: This three-letter code indicates the currency is the Fijian dollar. - **FKP**: This three-letter code indicates the currency is the Falkland Islands Pound, which is pegged to the British Pound Sterling (GBP). - **GBP**: This three-letter code indicates the currency is the British Pound Sterling (also known as Great British Pound). - **GEL**: This three-letter code indicates the currency is the Georgian lari. - **GHS**: This three-letter code indicates the currency is the Ghana Cedi. - **GIP**: This three-letter code indicates the currency is the Gibraltar Pound, which is pegged to the British Pound Sterling (GBP). - **GMD**: This three-letter code indicates the currency is the Gambian dalasi (official currency of The Gambia). - **GNF**: This three-letter code indicates the currency is the Guinean Franc (official currency of Guinea). - **GTQ**: This three-letter code indicates the currency is the Guatemalan Quetzal. - **GYD**: This three-letter code indicates the currency is the Guyanese Dollar. - **HKD**: This three-letter code indicates the currency is the Hong Kong dollar. - **HNL**: This three-letter code indicates the currency is the Honduran lempira. - **HTG**: This three-letter code indicates the currency is the Haitian gourde. - **HUF**: This three-letter code indicates the currency is the Hungarian forint. Hungary is a EU country, but is not using the Euro. - **IDR**: This three-letter code indicates the currency is the Indonesian Rupiah. - **ILS**: This three-letter code indicates the currency is the Israeli Shekel. - **INR**: This three-letter code indicates the currency is the Indian Rupee. - **IQD**: This three-letter code indicates the currency is the Iraqi dinar. - **IRR**: This three-letter code indicates the currency is the Iranian Rial. - **ISK**: This three-letter code indicates the currency is the Icelandic Króna. - **JMD**: This three-letter code indicates the currency is the Jamaican dollar. - **JOD**: This three-letter code indicates the currency is the Jordanian dinar. - **JPY**: This three-letter code indicates the currency is the Japanese Yen. - **KES**: This three-letter code indicates the currency is the Kenyan Shilling. - **KGS**: This three-letter code indicates the currency is the Kyrgyzstani som. - **KHR**: This three-letter code indicates the currency is the Cambodian riel. - **KMF**: This three-letter code indicates the currency is the Comoro Franc (the official currency of the Comoros islands in East Africa). - **KRW**: This three-letter code indicates the currency is the South Korean won. - **KWD**: This three-letter code indicates the currency is the Kuwaiti dinar. - **KYD**: This three-letter code indicates the currency is the Cayman Islands Dollar. - **KZT**: This three-letter code indicates the currency is the Kazakhstani tenge. - **LAK**: This three-letter code indicates the currency is the Laotian kip. - **LBP**: This three-letter code indicates the currency is the Lebanese Pound. - **LKR**: This three-letter code indicates the currency is the Sri Lankan Rupee. - **LRD**: This three-letter code indicates the currency is the Liberian Dollar. - **LSL**: This three-letter code indicates the currency is the Lesotho loti (the official currency of the Kingdom of Lesotho). - **LYD**: This three-letter code indicates the currency is the Libyan Dinar. - **MAD**: This three-letter code indicates the currency is the Moroccan Dirham. - **MDL**: This three-letter code indicates the currency is the Moldovan Leu. - **MGA**: This three-letter code indicates the currency is the Malagasy Ariary (the official currency of Madagascar). - **MKD**: This three-letter code indicates the currency is the Macedonian Denar (the official currency of North Macedonia). - **MMK**: This three-letter code indicates the currency is the Myanmar Kyat. - **MNT**: This three-letter code indicates the currency is the Mongolian Tögrög. - **MOP**: This three-letter code indicates the currency is the Macanese Pataca (the official currency of Macau). - **MRU**: This three-letter code indicates the currency is the Mauritanian ouguiya. - **MUR**: This three-letter code indicates the currency is the Mauritian rupee (the official currency of Mauritius). - **MVR**: This three-letter code indicates the currency is the Maldivian rufiyaa (the official currency of the Maldives). - **MWK**: This three-letter code indicates the currency is the Malawian Kwacha. - **MXN**: This three-letter code indicates the currency is the Mexican peso. - **MYR**: This three-letter code indicates the currency is the Malaysian Ringgit. - **MZN**: This three-letter code indicates the currency is the Mozambican metical. - **NAD**: This three-letter code indicates the currency is the Namibian Dollar. - **NGN**: This three-letter code indicates the currency is the Nigerian naira. - **NIO**: This three-letter code indicates the currency is the Nicaraguan Córdoba Oro. - **NOK**: This three-letter code indicates the currency is the Norwegian krone. - **NPR**: This three-letter code indicates the currency is the Nepalese Rupee. - **NZD**: This three-letter code indicates the currency is the New Zealand dollar. - **OMR**: This three-letter code indicates the currency is the Omani rial. - **PAB**: This three-letter code indicates the currency is the Panamanian Balboa. - **PEN**: This three-letter code indicates the currency is the Peruvian Sol. - **PGK**: This three-letter code indicates the currency is the Papua New Guinean kina. - **PHP**: This three-letter code indicates the currency is the Philippine Peso. - **PKR**: This three-letter code indicates the currency is the Pakistani Rupee. - **PLN**: This three-letter code indicates the currency is the Polish zloty. - **PYG**: This three-letter code indicates the currency is the Paraguayan guaraní. - **QAR**: This three-letter code indicates the currency is the Qatari riyal. - **RON**: This three-letter code indicates the currency is the Romanian New Leu. - **RSD**: This three-letter code indicates the currency is the Serbian dinar. - **RUB**: This three-letter code indicates the currency is the Russian Ruble. - **RWF**: This three-letter code indicates the currency is the Rwandan franc. - **SAR**: This three-letter code indicates the currency is the Saudi riyal. - **SBD**: This three-letter code indicates the currency is the Solomon Islands dollar. - **SCR**: This three-letter code indicates the currency is the Seychellois Rupee, the official currency of the Seychelles. - **SDG**: This three-letter code indicates the currency is the Sudanese Pound. - **SEK**: This three-letter code indicates the currency is the Swedish Krona. - **SGD**: This three-letter code indicates the currency is the Singapore Dollar. - **SHP**: This three-letter code indicates the currency is the Saint Helena Pound, the official currency in Saint Helena and Ascension Island . - **SLE**: This three-letter code indicates the currency is the Sierra Leonean Leone. - **SOS**: This three-letter code indicates the currency is the Somalian Shilling. - **SRD**: This three-letter code indicates the currency is the Surinamese Dollar. - **SSP**: This three-letter code indicates the currency is the South Sudanese Pound. - **STN**: This three-letter code indicates the currency is the São Tomé and Príncipe dobra. - **SYP**: This three-letter code indicates the currency is the Syrian Pound. - **SZL**: This three-letter code indicates the currency is the Eswatini Lilangeni, the official currency of Eswatini (formerly Swaziland). - **THB**: This three-letter code indicates the currency is the Thai Baht. - **TJS**: This three-letter code indicates the currency is the Tajikistani somoni. - **TMT**: This three-letter code indicates the currency is the Turkmenistan manat. - **TND**: This three-letter code indicates the currency is the Tunisian Dinar. - **TOP**: This three-letter code indicates the currency is the Tongan paʻanga. - **TRY**: This three-letter code indicates the currency is the Turkish lira. - **TTD**: This three-letter code indicates the currency is the Trinidad and Tobago Dollar. - **TWD**: This three-letter code indicates the currency is the New Taiwan dollar. - **TZS**: This three-letter code indicates the currency is the Tanzanian Shilling. - **UAH**: This three-letter code indicates the currency is the Ukrainian hryvnia. - **UGX**: This three-letter code indicates the currency is the Ugandan shilling. - **USD**: This three-letter code indicates the currency is the United States dollar. - **UYU**: This three-letter code indicates the currency is the Uruguayan peso. - **UZS**: This three-letter code indicates the currency is the Uzbekistani som. - **VES**: This three-letter code is no longer valid, and was replaced by VED to represent the Bolívar Digital, the official currency of Venezuela. - **VND**: This three-letter code indicates the currency is the Vietnamese đồng. - **VUV**: This three-letter code indicates the currency is the Vanuatu vatu. - **WST**: This three-letter code indicates the currency is the Samoan tala. - **XAF**: This three-letter code indicates the currency is the Central African CFA franc, which is the official currency for six Central African countries that form the Economic and Monetary Community of Central Africa (CEMAC). - **XCD**: This three-letter code indicates the currency is the Eastern Caribbean dollar, the official currency shared by eight island countries and territories in the Eastern Caribbean. - **XOF**: This three-letter code refers to the West African CFA franc, which is the official currency for eight West African countries that form the West African Economic and Monetary Union (UEMOA). - **XPF**: This three-letter code refers to the CFP franc (franc Pacifique or Pacific franc), the official currency used in three French overseas collectivities in the Pacific Ocean. - **YER**: This three-letter code indicates the currency is the Yemeni rial. - **ZAR**: This three-letter code indicates the currency is the South African rand. - **ZMW**: This three-letter code indicates the currency is the Zambian kwacha.
**Type:** string

### ExchangeAmountScenario
**Description:** The values in this enumeration type are used to indicate if the corresponding monetary amount is being shown in the buyer's or seller's currency. | - **BUYER_CURRENCY**: This value indicates that the corresponding monetary amount is being shown in the buyer's currency. - **SELLER_CURRENCY**: This value indicates that the corresponding monetary amount is being shown in the seller's currency.
**Type:** string

### PaymentState
**Description:** This enumerated type defines the payment state values applicable for a refund. | - **CANCELLED**: This value indicates that the payment has cancelled. - **COMPLETED**: This value indicates that the payment has been completed. - **FAILURE**: This value indicates that the payment has failed. - **IN_PROGRESS**: This value indicates that the payment is currently in progress. - **NOT_STARTED**: This value indicates that the payment process has not been started.
**Type:** string

### CountryAlpha2Code
**Description:** This enumerated type contains a list of ISO 3166 standard two-letter codes that represent countries around the world. | - **AD**: Andorra. - **AE**: United Arab Emirates. - **AF**: Afghanistan. - **AG**: Antigua and Barbuda. - **AI**: Anguilla. - **AL**: Albania. - **AM**: Armenia. - **AO**: Angola. - **AQ**: Antarctica. - **AR**: Argentina. - **AS**: American Samoa. - **AT**: Austria. - **AU**: Australia. - **AW**: Aruba. - **AX**: Aland Islands. - **AZ**: Azerbaijan. - **BA**: Bosnia and Herzegovina. - **BB**: Barbados. - **BD**: Bangladesh. - **BE**: Belgium. - **BF**: Burkina Faso. - **BG**: Bulgaria. - **BH**: Bahrain. - **BI**: Burundi. - **BJ**: Benin. - **BL**: Burundi. - **BM**: Bermuda. - **BN**: Brunei Darussalam. - **BO**: Bolivia. - **BQ**: Bonaire, Sint Eustatius and Saba. - **BR**: Brazil. - **BS**: Bahamas. - **BT**: Bhutan. - **BV**: Bouvet Island. - **BW**: Botswana. - **BY**: Belarus. - **BZ**: Belize. - **CA**: Canada. - **CC**: Cocos (Keeling) Islands. - **CD**: Congo, The Democratic Republic of the. - **CF**: Central African Republic. - **CG**: Congo. - **CH**: Switzerland. - **CI**: Cote d'Ivoire. - **CK**: Cook Islands. - **CL**: Chile. - **CM**: Cameroon. - **CN**: China. - **CO**: Colombia. - **CR**: Costa Rica. - **CV**: Cape Verde. - **CW**: Curaçao. - **CX**: Christmas Island. - **CY**: Cyprus. - **CZ**: Czech Republic. - **DE**: Germany. - **DJ**: Djibouti. - **DK**: Denmark. - **DM**: Dominica. - **DO**: Dominican Republic. - **DZ**: Algeria. - **EC**: Ecuador. - **EE**: Estonia. - **EG**: Egypt. - **EH**: Western Sahara. - **ER**: Eritrea. - **ES**: Spain. - **ET**: Ethiopia. - **FI**: Finland. - **FJ**: Fiji. - **FK**: Falkland Islands (Malvinas). - **FM**: Federated States of Micronesia. - **FO**: Faroe Islands. - **FR**: France. - **GA**: Gabon. - **GB**: United Kingdom. - **GD**: Grenada. - **GE**: Georgia. - **GF**: French Guiana. - **GG**: Guernsey. - **GH**: Ghana. - **GI**: Gibraltar. - **GL**: Greenland. - **GM**: Gambia. - **GN**: Guinea. - **GP**: Guadeloupe. - **GQ**: Equatorial Guinea. - **GR**: Greece. - **GS**: South Georgia and the South Sandwich Islands. - **GT**: Guatemala. - **GU**: Guam. - **GW**: Guinea-Bissau. - **GY**: Guyana. - **HK**: Hong Kong. - **HM**: Heard Island and McDonald Islands. - **HN**: Honduras. - **HR**: Croatia. - **HT**: Haiti. - **HU**: Hungary. - **ID**: Indonesia. - **IE**: Ireland. - **IL**: Israel. - **IM**: Isle of Man. - **IN**: India. - **IO**: British Indian Ocean Territory. - **IQ**: Iraq. - **IS**: Iceland. - **IT**: Italy. - **JE**: Jersey. - **JM**: Jamaica. - **JO**: Jordan. - **JP**: Japan. - **KE**: Kenya. - **KG**: Kyrgyzstan. - **KH**: Cambodia. - **KI**: Kiribati. - **KM**: Comoros. - **KN**: Saint Kitts and Nevis. - **KR**: Republic of Korea. - **KW**: Kuwait. - **KY**: Cayman Islands. - **KZ**: Kazakhstan. - **LA**: Lao People's Democratic Republic. - **LB**: Lebanon. - **LC**: Saint Lucia. - **LI**: Liechtenstein. - **LK**: Sri Lanka. - **LR**: Liberia. - **LS**: Lesotho. - **LT**: Lithuania. - **LU**: Luxembourg. - **LV**: Latvia. - **LY**: Libyan Arab Jamahiriya. - **MA**: Morocco. - **MC**: Monaco. - **MD**: Republic of Moldova. - **ME**: Montenegro. - **MF**: SAINT MARTIN - **MG**: Madagascar. - **MH**: Marshall Islands. - **MK**: The Former Yugoslav Republic of Macedonia. - **ML**: Mali. - **MM**: Myanmar. - **MN**: Mongolia. - **MO**: Macao. - **MP**: Northern Mariana Islands. - **MQ**: Martinique. - **MR**: Mauritania. - **MS**: Montserrat. - **MT**: Malta. - **MU**: Mauritius. - **MV**: Maldives. - **MW**: Malawi. - **MX**: Mexico. - **MY**: Malaysia. - **MZ**: Mozambique. - **NA**: Namibia. - **NC**: New Caledonia. - **NE**: Niger. - **NF**: Norfolk Island. - **NG**: Nigeria. - **NI**: Nicaragua. - **NL**: Netherlands. - **NO**: Norway. - **NP**: Nepal. - **NR**: Nauru. - **NU**: Niue. - **NZ**: New Zealand. - **OM**: Oman. - **PA**: Panama. - **PE**: Peru. - **PF**: French Polynesia. Includes Tahiti. - **PG**: Papua New Guinea. - **PH**: Philippines. - **PK**: Pakistan. - **PL**: Poland. - **PM**: Saint Pierre and Miquelon. - **PN**: Pitcairn. - **PR**: Puerto Rico. - **PS**: Palestinian territory, Occupied. - **PT**: Portugal. - **PW**: Palau. - **PY**: Paraguay. - **QA**: Qatar. - **RE**: Reunion. - **RO**: Romania. - **RS**: Serbia. - **RU**: Russian Federation. - **RW**: Rwanda. - **SA**: Saudi Arabia. - **SB**: Solomon Islands. - **SC**: Seychelles. - **SE**: Sweden. - **SG**: Singapore. - **SH**: Saint Helena. - **SI**: Slovenia. - **SJ**: Svalbard and Jan Mayen. - **SK**: Slovakia. - **SL**: Sierra Leone. - **SM**: San Marino. - **SN**: Senegal. - **SO**: Somalia. - **SR**: Suriname. - **ST**: Sao Tome and Principe. - **SV**: El Salvador. - **SX**: Sint Maarten. - **SZ**: Swaziland. - **TC**: Turks and Caicos Islands. - **TD**: Chad. - **TF**: French Southern Territories. - **TG**: Togo. - **TH**: Thailand. - **TJ**: Tajikistan. - **TK**: Tokelau. - **TL**: Tokelau. - **TM**: Turkmenistan. - **TN**: Tunisia. - **TO**: Tonga. - **TR**: Turkey. - **TT**: Trinidad and Tobago. - **TV**: Tuvalu. - **TW**: Taiwan, Province of China. - **TZ**: Tanzania, United Republic of. - **UA**: Ukraine. - **UG**: Uganda. - **UM**: United States Minor Outlying Islands. - **US**: United States. - **UY**: Uruguay. - **UZ**: Uzbekistan. - **VA**: Holy See (Vatican City state). - **VC**: Saint Vincent and the Grenadines. - **VE**: Venezuela. - **VG**: Virgin Islands, British. - **VI**: Virgin Islands, U.S. - **VN**: Vietnam. - **VU**: Vanuatu. - **WF**: Wallis and Futuna. - **WS**: Samoa. - **YE**: Yemen. - **YT**: Mayotte. - **ZA**: South Africa. - **ZM**: Zambia. - **ZW**: Zimbabwe.
**Type:** string

### BidStatus
**Description:** This enumerated type provides values for the status representing the buyer's bidding status for the given auction listing. | - **OUTBID**: The buyer has been outbid by another bid in this auction listing. - **WINNING**: The buyer has the winning bid in this auction listing.
**Type:** string

### Marketplace
**Description:** This enumerated type indicates the listing marketplace associated with the order. | - **EBAY_AT**: This value indicates that the listing marketplace is eBay Austria. - **EBAY_AU**: This value indicates that the listing marketplace is eBay Australia. - **EBAY_CA**: This value indicates that the listing marketplace is the English language version of eBay Canada marketplace. - **EBAY_CH**: This value indicates that the listing marketplace is eBay Switzerland. - **EBAY_DE**: This value indicates that the listing marketplace is eBay Germany. - **EBAY_ES**: This value indicates that the listing marketplace is eBay Spain. - **EBAY_FR**: This value indicates that the listing marketplace is eBay France. - **EBAY_GB**: This value indicates that the listing marketplace is eBay UK. - **EBAY_HK**: This value indicates that the listing marketplace is eBay Hong Kong. - **EBAY_IE**: This value indicates that the listing marketplace is eBay Ireland. - **EBAY_IT**: This value indicates that the listing marketplace is eBay Italy. - **EBAY_MY**: This value indicates that the listing marketplace is eBay Malaysia. - **EBAY_NL**: This value indicates that the listing marketplace is eBay Netherlands. - **EBAY_PH**: This value indicates that the listing marketplace is eBay Philippines. - **EBAY_PL**: This value indicates that the listing marketplace is eBay Poland. - **EBAY_SG**: This value indicates that the listing marketplace is eBay Singapore. - **EBAY_US**: This value indicates that the listing marketplace is eBay US.
**Type:** string

### FilenameExtension
**Description:** This enumerated types defines the supported document file extensions for uploads related to the inquiry process. Examples include evidence documents or shipping proofs. Only the listed formats are supported. | - **DOC**: This enum value indicates that the Microsoft Word document (.doc) format is supported. - **DOCX**: This enum value indicates that the Microsoft Word document (.docx) format is supported. - **GIF**: This enum value indicates that the GIF image format is supported. - **JPG**: This enum value indicates that the JPEG image format is supported. - **PDF**: This enum value indicates that the PDF document format is supported.
**Type:** string

### ItemCommitmentsDateType
**Description:** This enumeration type list the values that can be used in the \*\*dateType\*\* field if the user uses a date range filter in a \*\*sellerItemCommitments\*\* or \*\*buyerItemCommitments\*\* query. | - **CREATED**: If this value is used in the \*\*dateType\*\* field of a query, only item commitments created within the specified date range are returned. - **UPDATED**: If this value is used in the \*\*dateType\*\* field of a query, only item commitments updated within the specified date range are returned.
**Type:** string

### ItemCommitmentsSortField
**Description:** This enumeration type contains the sort values that may be used when configuring sorting for a \*\*sellerItemCommitments\*\* or a \*\*buyerItemCommitments\*\* query. | - **CREATED_AT**: If this value is used, item commitments are sorted according to creation date. - **UPDATED_AT**: If this value is used, item commitments are sorted according to the last time they were updated.
**Type:** string

### SortOrder
**Description:** This enumerated type provides values for the sort order used in pagination. | - **ASC**: This enum value is used to sort results of a query response in sscending order. - **DESC**: This enum value is used to sort results of a query response in descending order.
**Type:** string

### UserRegistrationMarketplace
**Description:** This enumerated type contains the values that indicate which eBay marketplace that the user created their eBay account. | - **EBAY_AT**: This enumeration value indicates the applicable marketplace is eBay Austria. - **EBAY_AU**: This enumeration value indicates the applicable marketplace is eBay Australia. - **EBAY_BE**: This enumeration value indicates the applicable marketplace is eBay Belgium. - **EBAY_CA**: This enumeration value indicates the applicable marketplace is eBay Canada. - **EBAY_CH**: This enumeration value indicates the applicable marketplace is eBay Switzerland. - **EBAY_DE**: This enumeration value indicates the applicable marketplace is eBay Germany. - **EBAY_ES**: This enumeration value indicates the applicable marketplace is eBay Spain. - **EBAY_FR**: This enumeration value indicates the applicable marketplace is eBay France. - **EBAY_GB**: This enumeration value indicates the applicable marketplace is eBay UK. - **EBAY_HK**: This enumeration value indicates the applicable marketplace is eBay Hong Kong. - **EBAY_IE**: This enumeration value indicates the applicable marketplace is eBay Ireland. - **EBAY_IT**: This enumeration value indicates the applicable marketplace is eBay Italy. - **EBAY_MY**: This enumeration value indicates the applicable marketplace is eBay Malaysia. - **EBAY_NL**: This enumeration value indicates the applicable marketplace is eBay Netherlands. - **EBAY_PH**: This enumeration value indicates the applicable marketplace is eBay Philippines. - **EBAY_PL**: This enumeration value indicates the applicable marketplace is eBay Poland. - **EBAY_SG**: This enumeration value indicates the applicable marketplace is eBay Singapore. - **EBAY_TW**: This enumeration value indicates the applicable marketplace is eBay Taiwan. - **EBAY_US**: This enumeration value indicates the applicable marketplace is eBay US.
**Type:** string

### UserBenefitMembershipType
**Description:** This enumerated type contains the values that represent eBay user benefit program types. | - **EBAY_PLUS**: This value indicates that the user is currently subscribed to the eBay Plus premium membership program. eBay Plus A subscription-based program available through the Germany and Australia eBay marketplaces which offers benefits such as: - Free shipping on eligible items - Free returns on eligible items - Exclusive deals and offers - Priority customer support
**Type:** string

### OrdersDateType
**Description:** This enumerated type represents the type of order date being referenced. | - **CONFIRMED**: This value indicates the date and time when the order was confirmed. - **UPDATED**: This value indicates the most recent date and time the order was updated.
**Type:** string

### OrdersSortField
**Description:** This enumerated type defines how orders can be sorted for pagination. | - **CONFIRMED_AT**: This value sorts by the datetime when the order was confirmed. - **UPDATED_AT**: This value sorts by the datetime when the order was last updated.
**Type:** string

### CharityStatus
**Description:** This enumerated type is used for specifying the status of a charitable organization. | - **ACTIVE**: This enum value indicates that the charitable organization is currently active and operational - **INACTIVE**: This enum value indicates that the charitable organization is currently inactive and not operational. - **NO_LONGER_ACTIVE**: This enum value indicates that the charitable organization was active in the past and is no longer active, possibly due to closure or loss of status.
**Type:** string

### ListingMinimumAdvertisedPriceExposure
**Description:** This enumerated type controls how/when the Minimum Advertised Price is exposed to the buyer. | - **DURING_CHECKOUT**: This enumeration value indicates that the buyer must add the item to his/her cart before the discounted price can be displayed. - **PRE_CHECKOUT**: This enumeration value indicates that the discounted price will only be shown to the buyer once the buyer reaches the eBay Checkout page.
**Type:** string

### SellerSupportListingDaysCode
**Description:** This enumeration type contains the values that indicate the block of days when a classified ad seller can be contacted by potential buyers to answer questions about an item. | - **EVERYDAY**: This enumeration value indicates that the corresponding support hours are effective each day of the week. If the \*\*anyTime\*\* boolean field is \`true\`, that would indicate that the seller may be contacted 24 x 7. - **WEEKDAYS**: This enumeration value indicates that the corresponding support hours are effective each weekday (Monday through Friday). - **WEEKENDS**: This enumeration value indicates that the corresponding support hours are effective on weekends (Saturday and Sunday).
**Type:** string

### BusinessPolicyMarketplace
**Description:** This enumerated type contains the values that indicate the different eBay marketplaces. | - **EBAY_AT**: This value indicates the applicable marketplace is eBay Austria. - **EBAY_AU**: This value indicates the applicable marketplace is eBay Australia. - **EBAY_BE**: This value indicates the applicable marketplace is Dutch language version of eBay Belgium. - **EBAY_CA**: This value indicates the applicable marketplace is English language version of eBay Canada. - **EBAY_CH**: This value indicates the applicable marketplace is eBay Switzerland. - **EBAY_DE**: This value indicates the applicable marketplace is eBay Germany. - **EBAY_ES**: This value indicates the applicable marketplace is eBay Spain. - **EBAY_FR**: This value indicates the applicable marketplace is eBay France. - **EBAY_GB**: This value indicates the applicable marketplace is eBay UK. - **EBAY_HK**: This value indicates the applicable marketplace is eBay Hong Kong. - **EBAY_IE**: This value indicates the applicable marketplace is eBay Ireland. - **EBAY_IT**: This value indicates the applicable marketplace is eBay Italy. - **EBAY_MY**: This value indicates the applicable marketplace is eBay Malaysia. - **EBAY_NL**: This value indicates the applicable marketplace is eBay Netherlands. - **EBAY_PH**: This value indicates the applicable marketplace is eBay Philippines. - **EBAY_PL**: This value indicates the applicable marketplace is eBay Poland. - **EBAY_SG**: This value indicates the applicable marketplace is eBay Singapore. - **EBAY_US**: This value indicates the applicable marketplace is eBay US.
**Type:** string

### PaymentMethods
**Description:** This enumerated type defines supported payment methods. | - **CASH_IN_PERSON**: This value indicates that the payment method will be cash, and the transaction will occur in-person. - **CASH_ON_PICKUP**: This value indicates that the payment method will be cash, and the transaction will occur when the buyer picks up the item. - **MONEY_ORDER**: This value indicates that the payment can be processed via money order. - **PERSONAL_CHECK**: This value indicates that a personal check is accepted for payment.
**Type:** string

### RefundType
**Description:** This enumerated type indicates the seller's return resolution options, either a refund only, or a refund or a replacement. | - **MONEY_BACK**: The seller provides refunds only when the buyer returns the product. - **MONEY_BACK_OR_REPLACEMENT**: The seller may provide either a refund or a replacement item when the buyer returns the product. The availability of a replacement item may depend on item stock and policy.
**Type:** string

### ContinentCode
**Description:** This enumerated type provides continent codes for geographic identification. \*\*Note:\*\* These codes are used to specify continents for shipping and location purposes. The values may change in future releases. | - **AFRICA**: Africa - **ASIA**: Asia - **EUROPE**: Europe - **NORTH_AMERICA**: North America - **SOUTH_AMERICA**: South America
**Type:** string

### SellerShippingRegionCode
**Description:** This enumeration type contains a list of enum values that cover large geographical regions as well as specific regions within a country. Some of these values can be used as both ship-to or excluded shipping locations in an eBay listing, and some can only be used for one or the other. | - **ADELAIDE_METRO**: This enumeration value is used to indicate that a Australia-based seller will not ship to the Adelaide Metro area. \*\*Note\*\*: This value can only be used as an excluded shipping location in an eBay Australia listing. - **ALASKA_HAWAII**: This enumeration value is used to indicate that a US-based seller will not ship to the states of Alaska or Hawaii. \*\*Note\*\*: This value can only be used as an excluded shipping location in an eBay US listing. - **AMERICAS**: This enumeration value is used to indicate that a seller will or will not ship to North America and South America. \*\*Note\*\*: This enumeration value does not include Central America, which is grouped together with the Caribbean. - **APO_FPO**: This enumeration value is used to indicate that a US-based seller will not ship to Army Post Office (APO) or a Fleet Post Office (FPO). \*\*Note\*\*: This value can only be used as an excluded shipping location in an eBay US listing. - **BRISBANE_METRO**: This enumeration value is used to indicate that a Australia-based seller will not ship to the Brisbane Metro area. \*\*Note\*\*: This value can only be used as an excluded shipping location in an eBay Australia listing. - **CENTRAL_AMERICA_AND_CARIBBEAN**: This enumeration value is used to indicate that a seller will or will not ship to countries in Central America and in the Caribbean. - **CHANNEL_ISLANDS**: This enumeration value is used to indicate that a UK-based seller will not ship to the Channel Islands. \*\*Note\*\*: This value can only be used as an excluded shipping location in an eBay UK listing. - **EUROPEAN_UNION**: This enumeration value is used to indicate that a seller will or will not ship to European countries that belong to the European Union. - **GREATER_CHINA**: This enumeration value is used to indicate that a Hong Kong-based seller will or will not ship to the Greater China area, which includes mainland China, Taiwan, Hong Kong, and Macau. \*\*Note\*\*: This value can only be used in an eBay Hong Kong listing. - **HIDDENSEE**: This enumeration value is used to indicate that a Germany-based seller will not ship to the German island of Hiddensee. \*\*Note\*\*: This value can only be used as an excluded shipping location in an eBay Germany listing. - **ISLE_OF_WIGHT**: This enumeration value is used to indicate that a UK-based seller will not ship to the Isle of Wight. \*\*Note\*\*: This value can only be used as an excluded shipping location in an eBay UK listing. - **MELBOURNE_METRO**: This enumeration value is used to indicate that a Australia-based seller will not ship to the Melbourne Metro area. \*\*Note\*\*: This value can only be used as an excluded shipping location in an eBay Australia listing. - **MIDDLE_EAST**: This enumeration value is used to indicate that a seller will or will not ship to the Middle East, which includes Turkey, Yemen, Oman, United Arab Emirates, Qatar, Saudi Arabia, Iraq, Israel, Kuwait, Lebanon, Jordan, and Bahrain. - **NONE**: This enumeration value is used if the seller does not ship the item. This value is applicable for listings that only support local pickup or for an item where the buyer is responsible for arranging shipping. - **NORDFRIESISCHE_INSELN**: This enumeration value is used to indicate that a Germany-based seller will not ship to the North Frisian Islands. \*\*Note\*\*: This value can only be used as an excluded shipping location in an eBay Germany listing. - **NORTHERN_IRELAND**: This enumeration value is used to indicate that a UK-based seller will not ship to Northern Ireland. \*\*Note\*\*: This value can only be used as an excluded shipping location in an eBay UK listing. - **NORTHERN_TERRITORY**: This enumeration value is used to indicate that a Australia-based seller will not ship to the Northern Territory region. \*\*Note\*\*: This value can only be used as an excluded shipping location in an eBay Australia listing. - **NSW_REGIONAL**: This enumeration value is used to indicate that a Australia-based seller will not ship to the New South Wales (NSW) region. \*\*Note\*\*: This value can only be used as an excluded shipping location in an eBay Australia listing. - **OCEANIA**: This enumeration value is used to indicate that a seller will or will not ship to countries/islands located in Oceania, which includes New Zealand, Micronesia, Fiji, Papua New Guinea, Solomon Islands, Marshall Islands, Nauru, Wallis and Futuna, Western Samoa, Tonga, Tuvalu, Vanuatu, Kiribati, New Caledonia, Palau, American Samoa, Niue, French Polynesia, Cook Islands, Guam, and Australia. - **OSTFRIESISCHE_INSELN**: This enumeration value is used to indicate that a Germany-based seller will not ship to the East Frisian Islands. \*\*Note\*\*: This value can only be used as an excluded shipping location in an eBay Germany listing. - **PACK_STATION**: This enumeration value is used to indicate that a Germany-based seller will not ship to a Packstation, which is an automated DHL parcel locker system. \*\*Note\*\*: This value can only be used as an excluded shipping location in an eBay Germany listing. - **PERTH_METRO**: This enumeration value is used to indicate that a Australia-based seller will not ship to the Perth Metro area. \*\*Note\*\*: This value can only be used as an excluded shipping location in an eBay Australia listing. - **PO_BOX**: This enumeration value is used to indicate that a seller will not ship to a Post Office (PO) Box. \*\*Note\*\*: This value can only be used as an excluded shipping location in a listing across all eBay marketplaces. - **QLD_FAR_NORTH**: This enumeration value is used to indicate that a Australia-based seller will not ship to Far North Queensland (QLD). \*\*Note\*\*: This value can only be used as an excluded shipping location in an eBay Australia listing. - **QLD_REGIONAL**: This enumeration value is used to indicate that a Australia-based seller will not ship to regions of Queensland (QLD) beside Far North Queensland and South East Queensland. \*\*Note\*\*: This value can only be used as an excluded shipping location in an eBay Australia listing. - **QLD_SOUTH_EAST**: This enumeration value is used to indicate that a Australia-based seller will not ship to South East Queensland (QLD). \*\*Note\*\*: This value can only be used as an excluded shipping location in an eBay Australia listing. - **REST_OF_ASIA**: This enumeration value is used to indicate that a Hong Kong-based seller will or will not ship to Asian countries outside of the Greater China area, which includes mainland China, Taiwan, Hong Kong, and Macau. \*\*Note\*\*: This value can only be used in an eBay Hong Kong listing. - **SA_REGIONAL**: This enumeration value is used to indicate that a Australia-based seller will not ship to Regional South Australia (SA). \*\*Note\*\*: This value can only be used as an excluded shipping location in an eBay Australia listing. - **SCILLY_ISLES**: This enumeration value is used to indicate that a UK-based seller will not ship to the Scilly Isles (also known as Isles of Scilly). \*\*Note\*\*: This value can only be used as an excluded shipping location in an eBay UK listing. - **SCOTTISH_HIGHLANDS**: This enumeration value is used to indicate that a UK-based seller will not ship to the Scottish Highlands. \*\*Note\*\*: This value can only be used as an excluded shipping location in an eBay UK listing. - **SCOTTISH_ISLANDS**: This enumeration value is used to indicate that a UK-based seller will not ship to the Scottish Islands. \*\*Note\*\*: This value can only be used as an excluded shipping location in an eBay UK listing. - **SOUTHEAST_ASIA**: This enumeration value is used to indicate that a seller will or will not ship to Southeast Asia, which includes Cambodia, Indonesia, Vietnam, Hong Kong, Philippines, Malaysia, Taiwan, Laos, Thailand, Singapore, Macau, and Brunei Darussalam. \*\*Note\*\*: This value should not be used by a Hong Kong-based seller. Instead, they should use GREATER\_CHINA (which includes mainland China, Taiwan, Hong Kong, and Macau) and REST\_OF\_ASIA to include or exclude other Asian countries. - **SYDNEY_METRO**: This enumeration value is used to indicate that a Australia-based seller will not ship to the Sydney Metro area. \*\*Note\*\*: This value can only be used as an excluded shipping location in an eBay Australia listing. - **TASMANIA**: This enumeration value is used to indicate that a Australia-based seller will not ship to the island state of Tasmania . \*\*Note\*\*: This value can only be used as an excluded shipping location in an eBay Australia listing. - **US_PROTECTORATES**: This enumeration value is used to indicate that a US-based seller will not ship to any of the following US protectorates: Puerto Rico, Guam, American Samoa, Northern Mariana Islands, and U.S. Virgin Islands. \*\*Note\*\*: This value can only be used as an excluded shipping location in an eBay US listing. - **VIC_REGIONAL**: This enumeration value is used to indicate that a Australia-based seller will not ship to Regional Victoria, which are areas of the Australian state of Victoria outside the greater Melbourne metropolitan area. \*\*Note\*\*: This value can only be used as an excluded shipping location in an eBay Australia listing. - **WA_REGIONAL**: This enumeration value is used to indicate that a Australia-based seller will not ship to Regional Western Australia (WA), which are areas outside the greater Perth metropolitan area. \*\*Note\*\*: This value can only be used as an excluded shipping location in an eBay Australia listing. - **WA_REMOTE**: This enumeration value is used to indicate that a Australia-based seller will not ship to Remote Western Australia (WA), which are isolated areas far from major cities, especially in the north and northeast. \*\*Note\*\*: This value can only be used as an excluded shipping location in an eBay Australia listing. - **WORLDWIDE**: This enumeration value is used as a shipping location, and covers all continents, large geographical regions, countries, and special domestic locations. \*\*Note\*\*: It is generally accompanied by numerous excluded shipping locations unless a seller truly ships everywhere.
**Type:** string

### LogisticsOptionType
**Description:** This enumerated type provides different cost or fulfillment calculation methods for a shipping option. | - **CALCULATED**: Shipping cost is calculated based on item weight, dimensions, and destination. - **FLAT**: Shipping cost is a fixed amount set by the seller and does note vary by weight, dimensions, or destination (within the defined coverage for the option). - **FREIGHT**: Shipping requires freight services due to item size, weight, or special handling. This typically applies to large or heavy items and may involve carrier scheduling. - **NOT_SPECIFIED**: Shipping type represents local pickup or an unspecified shipping calculation method, and is retained for backward compatibility with legacy systems that use \`NOT\_SPECIFIED\` to indicate local pickup.
**Type:** string

### ListingPackageType
**Description:** This enumerated type contains the shipping package type values that can be used in the \*\*packageType\*\* field. Note that supported package types will depend on the shipping service used. | - **BULKY_GOODS**: This enumeration value is used as the package type for large, heavy items that might not fit standard shipping packages and require special handling. - **CARAVAN**: This enumeration value is used as the package type for shipping mobile homes or trailers. - **CARS**: This enumeration value is used as the package type for shipping motor vehicles through an auto transport service. - **EURO_PALLET**: This enumeration value is used as the package type for freight shipping in Europe using a standardized pallet. - **EXPANDABLE_TOUGH_BAGS**: This enumeration value is used as the package type when shipping items in flexible bags that can expand to fit bulkier/unusually shaped items. - **EXTRA_LARGE_PACK**: This enumeration value is used as the package type when shipping items in a very large package. - **FURNITURE**: This enumeration value is used as the package type when shipping furniture. - **INDUSTRY_VEHICLES**: This enumeration value is used as the package type for shipping industrial vehicles and equipment, farm machinery, etc. - **LARGE_CANADA_POST_BOX**: This enumeration value is used as the package type for shipping a large shipping box offered by Canada Post. - **LARGE_CANADA_POST_BUBBLE_MAILER**: This enumeration value is used as the package type for shipping a large padded envelope offered by Canada Post. This packaging is appropriate for shipping fragile items through Canada Post. - **LARGE_ENVELOPE**: This enumeration value is used as the package type for shipping a large envelope or flat mailer. This packaging is appropriate for shipping documents or flat items. Shipping carriers often use flat rates for this package type. - **LETTER**: This enumeration value is used as the package type for shipping a standard letter envelope. This packaging is appropriate for shipping documents or flat items. Shipping carriers often use flat rates for this package type. - **MAILING_BOXES**: This enumeration value is used as the package type for shipping a standard corrugated cardboard box of various sizes. - **MEDIUM_CANADA_POST_BOX**: This enumeration value is used as the package type for shipping a medium-sized shipping box offered by Canada Post. - **MEDIUM_CANADA_POST_BUBBLE_MAILER**: This enumeration value is used as the package type for shipping a medium-sized padded envelope offered by Canada Post. This packaging is appropriate for shipping fragile items through Canada Post. - **MOTORBIKES**: This enumeration value is used as the package type for shipping motorcycles. - **NONE**: This enumeration value can be used as the package type value when the packaging type is not relevant or when the seller will determine appropriate packaging based on the item. - **ONE_WAY_PALLET**: This enumeration value is used as the package type value when a heavy/bulky item is being shipped on a pallet. - **PACKAGE_THICK_ENVELOPE**: This enumeration value is used as the package type for shipping an item in a thick protective envelope. This package type is generally used for items that need more protection than a standard envelope but don't require a box. - **PADDED_BAGS**: This enumeration value is used as the package type for shipping an item in a padded shipping bag. This package type is generally used for items that need some protection but don't require a rigid box. - **PARCEL_OR_PADDED_ENVELOPE**: This enumeration value is used as the package type for shipping a standard parcel or padded envelope. - **ROLL**: This enumeration value is used as the package type for shipping a cylindrical shipping container. This package might be one that you use to ship a poster or blueprints, - **SMALL_CANADA_POST_BOX**: This enumeration value is used as the package type for shipping a small shipping box offered by Canada Post. - **SMALL_CANADA_POST_BUBBLE_MAILER**: This enumeration value is used as the package type for shipping a small padded envelope offered by Canada Post. This packaging is appropriate for shipping fragile items through Canada Post. - **TOUGH_BAGS**: This enumeration value is used as the package type for shipping an item in a heavy-duty shipping bag. This packaging is appropriate for items that need protection but don't require the structure of a box. - **UPS_LETTER**: This enumeration value is used as the package type for shipping an item through a UPS letter envelope. - **USPS_FLAT_RATE_ENVELOPE**: This enumeration value is used as the package type for shipping an item through a USPS flat-rate envelope. - **USPS_LARGE_PACK**: This enumeration value is used as the package type for shipping an item through a USPS large package. - **VERY_LARGE_PACK**: This enumeration value is used as the package type for shipping an item in a very large package, which may require special handling. - **WINE_PAK**: This enumeration value is used as the package type for shipping wine or other glass bottles safely.
**Type:** string

### MeasurementSystem
**Description:** This enumeration type lists the measurement system that can be used to measure weight and dimensions. The measurement system selected by the seller should be the measurement system that is used in the country of the marketplace. | - **ENGLISH**: This enumeration value indicates that the English, or Imperial system will be used to measure weight and dimensions. This is typically used in the US, with pounds and ounces used for weight and feet and inches used for dimensions. - **METRIC**: This enumeration value indicates that the Metric system will be used to measure weight and dimensions. This is typically everywhere else in the world besides the US, with kilograms and grams used for weight and meters and centimeters used for dimensions.
**Type:** string

### DimensionUnitType
**Description:** This enumeration type consists of the units of measurement that are used to specify shipping package dimensions. | - **CENTIMETER**: This enumeration value indicates that the shipping package dimensions are measured in centimeters. - **FEET**: This enumeration value indicates that the shipping package dimensions are measured in feet. - **INCH**: This enumeration value indicates that the shipping package dimensions are measured in inches. - **METER**: This enumeration value indicates that the shipping package dimensions are measured in meters.
**Type:** string

### WeightUnitType
**Description:** This enumeration type consists of the units of measurement that are used to specify shipping package weight. | - **GRAM**: This enumeration value indicates that the shipping package weight is measured in grams. - **KILOGRAM**: This enumeration value indicates that the shipping package weight is measured in kilograms. - **OUNCE**: This enumeration value indicates that the shipping package weight is measured in ounces. - **POUND**: This enumeration value indicates that the shipping package weight is measured in pounds.
**Type:** string

### ListingTimeDuration
**Description:** This enumeration type contains the supported handling times for shipping items. The specified handling time in a listing indicates how quickly the seller will physically ship out the item. | - **DAYS_0**: This enumeration value is used to indicate that the handling time is zero days, which means the seller supports same-day shipping for the item. With same-day shipping, the seller commits to shipping out the item on the same business day that the order is placed, as long as the payment clears before the seller's cutoff time for the day. - **DAYS_1**: This enumeration value indicates that the time duration is one day. This value is commonly used for a 1-day handling time. - **DAYS_10**: This enumeration value indicates that the time duration is 10 days. This value can be used for the payment deadline for a motor vehicle balance. - **DAYS_14**: This enumeration value indicates that the time duration is 10 days. This value can be used for the payment deadline for a motor vehicle balance. - **DAYS_15**: This enumeration value indicates that the time duration is 15 days. - **DAYS_2**: This enumeration value indicates that the time duration is two days. This value is commonly used for a 2-day handling time. - **DAYS_20**: This enumeration value indicates that the time duration is 20 days. - **DAYS_25**: This enumeration value indicates that the time duration is 25 days. - **DAYS_3**: This enumeration value indicates that the time duration is three days. This value can be used for a 3-day handling time or for the payment deadline for a motor vehicle balance. - **DAYS_30**: This enumeration value indicates that the time duration is 30 days. This value can be used as a return period. - **DAYS_4**: This enumeration value indicates that the time duration is four days. - **DAYS_40**: This enumeration value indicates that the time duration is 40 days. - **DAYS_5**: This enumeration value indicates that the time duration is five days. - **DAYS_6**: This enumeration value indicates that the time duration is six days. - **DAYS_60**: This enumeration value indicates that the time duration is 60 days. This value can be used as a return period. - **DAYS_7**: This enumeration value indicates that the time duration is seven days. This value can be used for the payment deadline for a motor vehicle balance. - **MONTHS_1**: This enumeration value indicates that the time duration is 1 month. - **NOT_SPECIFIED**: This value should not be used as input, but it is possible that it can be returned if the time duration value could not be determined.
**Type:** string

### ListingShippingCostType
**Description:** This enumerated type contains the list of shipping cost models that can be used to ship eBay items. | - **CALCULATED**: This enumeration value indicates that the seller is using the calculated shipping model. With calculated shipping, the cost of shipping will depend on the weight of the shipping package and the distance between the item location and the buyer's shipping address. - **FLAT**: This enumeration value indicates that a flat-rate shipping cost will be used for each domestic or international shipping service option. By using a domestic or international shipping rate table for a listing, the seller can charge different flat rates based on the buyer's location and shipping speed/class. For example, a seller with a warehouse in California could charge a flat rate of $10 to ship an item to Arizona, but a flat rate of $15 to ship an item to Texas. - **FREIGHT**: This enumeration value indicates that freight shipping will be used to ship the item. US sellers can use eBay freight shipping partner, \*\*FreightQuote.com\*\*, or another freight shipping provider. \*\*FreightQuote.com\*\* can only be used for domestic shipping within the US. - **NOT_SPECIFIED**: This enumeration value indicates that a shipping cost model was not specified for the listing or is unknown.
**Type:** string

### CrossBorderTradingRegion
**Description:** This enumerated type is used to enable active cross-border trading. In active cross-border trading, sellers selling on eBay US, eBay Canada, eBay UK, and eBay Ireland marketplaces can pay a small fee to have their listing exposed on other eBay marketplaces. | - **NORTH_AMERICA**: This enumerated value is used by sellers selling on the eBay UK and eBay Ireland marketplaces if they want their listing to be exposed on North America marketplaces, including eBay US, US Motors, and eBay Canada (English and French versions) for a fee. - **UNITED_KINGDOM**: This enumerated value is used by sellers selling on the eBay US and eBay Canada (English and French versions) marketplaces if they want their listing to be exposed on eBay UK and eBay Ireland marketplaces for a fee.
**Type:** string

### EndListingReason
**Description:** This enumeration type is used to define the enumeration values that can be used/returned as a reason why a seller is ending an eBay listing before its scheduled end date. | - **END_AUCTION_AND_SELL**: This enumeration value indicates that the seller is ending an auction listing to sell the item to the current high bidder. This ending reason and action could not be taken if there were less than 12 hours before the end of the auction. - **END_ITEM_ON_ZERO_QUANTITY**: This enumeration value indicates that the seller is ending a listing due to the item being out-of-stock. - **ERROR_IN_LISTING**: This enumeration value indicates that the seller is ending a listing due to a non-price related error. - **ERROR_IN_PRICE**: This enumeration value indicates that the seller is ending a listing due to a price-related error. - **LOST**: This enumeration value indicates that the seller is ending a listing because the item is lost or broken/damaged. - **NOT_AVAILABLE**: This enumeration value indicates that the seller is ending a listing because the seller no longer wishes to sell the item. - **SOLD_VEHICLE**: This enumeration value indicates that the seller is ending a classified ad listing because the item has been sold. This value only applies to motor vehicle classified ad listings.
**Type:** string

### ListingDurationInDays
**Description:** This enumeration type contains the listing duration values that can be used for listings. Supported listing duration times can vary be eBay marketplace, eBay category, and listing type. | - **DAYS_1**: This enumeration value indicates that the listing duration is one day (24 hours). This duration time is common for auction listings. - **DAYS_10**: This enumeration value indicates that the listing duration is ten days. This duration time is common for auction listings. - **DAYS_120**: This enumeration value indicates that the listing duration is 120 days. - **DAYS_14**: This enumeration value indicates that the listing duration is 14 days. - **DAYS_21**: This enumeration value indicates that the listing duration is 21 days. - **DAYS_3**: This enumeration value indicates that the listing duration is three days. This duration time is common for auction listings. - **DAYS_30**: This enumeration value indicates that the listing duration is 30 days. This duration time is common for classified ad listings. - **DAYS_5**: This enumeration value indicates that the listing duration is five days. This duration time is common for auction listings. - **DAYS_60**: This enumeration value indicates that the listing duration is 60 days. - **DAYS_7**: This enumeration value indicates that the listing duration is seven days. This duration time is common for auction listings. - **DAYS_90**: This enumeration value indicates that the listing duration is 90 days. - **GTC**: This enumeration value indicates that the listing will remain active until it is cancelled by the seller or the item is sold out (without the seller have Out of Stock option enabled). \`GTC\` stands for \*Good 'Til Cancelled\*. All fixed-price listings must have \`GTC\` set as their listing duration. As long as the listing has inventory, eBay will automatically renew the listing each month. Note that insertion fees may apply with renewal each month.
**Type:** string

### ListingStatusEnum
**Description:** This enumerated type contains the values that indicate the current status of a listing. | - **ACTIVE**: This enumeration value indicates that the listing is currently active. - **ENDED**: This enumeration value indicates that the listing has ended. - **SCHEDULED**: This enumeration value indicates that the listing is scheduled to become active at a future date.
**Type:** string

### ListingFormatType
**Description:** This enumeration type contains the list of available listing formats used for eBay listings. | - **AUCTION**: This enumeration value indicates that the listing is an auction listing. In an auction listing, prospective buyers engage in a competitive bidding process. In addition to the competitive bidding process, a seller may also enable the 'Buy it Now' feature or they can accept Best Offers, but not both at the same time. Once an auction listing has a qualifying bid, either the 'Buy it Now' feature (if set) or the Best Offer feature (if set) is disabled for the duration of the listing. Although listing durations may vary by eBay marketplace and category, typical listing durations for auctions are 1, 3, 5, 7, and 10 days. - **CLASSIFIED_AD**: This enumeration value indicates that the listing is a classified ad listing. Limited eBay categories support classified ad listings, and the actual sales transaction, if one occurs, will happen off of eBay's platform. Since classified ads do not generate revenue for eBay through the Final Value Fee, eBay will charge a higher insertion fee upfront. The amount of this fee varies based on the eBay category. - **FIXED_PRICE**: This enumeration value indicates that the listing is a fixed price listing. In a fixed price listing, the 'Buy it Now' price is set, although it is still possible for the seller to enable the Best Offer feature and accept/decline Best Offers from prospective buyers. The different versions of fixed-price listings include a single item with a quantity of \`1\`, multiple quantity of an identical item, or a multiple-variation listing where slightly different variations of the same item are made available for sale.
**Type:** string

### ListingPaymentMethod
**Description:** This enumerated type consists of the offline payment methods that sellers can specify as available payment methods if the sales transaction happens off an eBay. Note that availability of specific offline payment methods may vary by eBay marketplace and category. The \[getCategoryPolicies\](https://developer.ebay.com/api-docs/sell/metadata/resources/marketplace/methods/getCategoryPolicies) method can be used to see which payment methods are supported by a leaf category. | - **CASH_ON_DELIVERY**: This enumeration value specifies/indicates that 'Cash on Delivery' is a payment method accepted by the seller for a sales transaction that happens off of eBay's platform. With this option, the shipping carrier collects payment from the buyer at the time of delivery and forwards it to the seller. - **CASH_ON_PICKUP**: This enumeration value specifies/indicates that cash is a payment method accepted by the seller for a sales transaction that happens off of eBay's platform between the buyer and seller (e.g. Local Pickup). - **MONEY_ORDER_CASHIERS_CHECK**: This enumeration value specifies/indicates that a money order or a cashier's/bank check is a payment method accepted by the seller for a sales transaction that happens off of eBay's platform between the buyer and seller (e.g. Motor Vehicle sale). - **PAYMENT_SEE_DESCRIPTION**: This enumeration value specifies/indicates that for motor vehicle listings, the seller will provide custom payment instructions to buyers. The seller's payment instructions will appear on the eBay listing page and during checkout, allowing the seller to specify alternative payment arrangements for motor vehicle purchases. - **PERSONAL_CHECK**: This enumeration value specifies/indicates that a personal check is a payment method accepted by the seller for a sales transaction that happens off of eBay's platform between the buyer and seller (e.g. motor vehicle sale).
**Type:** string

### ListingRefundMethod
**Description:** This enumerated type consists of the refund methods that can be used in case of a returned item. | - **MONEY_BACK**: This value indicates that the buyer will receive their money back when an item is returned. - **MONEY_BACK_OR_REPLACEMENT**: This value indicates that the buyer can either receive their money back when an item is returned, or the seller can send them a replacement item if there was something wrong with the original item. A seller can offer this if they have a replacement item available, but it is the buyer's choice what they prefer.
**Type:** string

### DistanceUnit
**Description:** This enumeration type defines the supported units for measurement of distance . | - **MILES**: This enumeration value indicates that distance is measured in miles.
**Type:** string

### ListingMarketplace
**Description:** This enumeration type contains the list of eBay marketplaces in which listings may be created. | - **EBAY_AT**: This enumeration value indicates the applicable marketplace is eBay Austria. - **EBAY_AU**: This enumeration value indicates the applicable marketplace is eBay Australia. - **EBAY_BE**: This enumeration value indicates the applicable marketplace is Dutch language version of eBay Belgium. - **EBAY_CA**: This enumeration value indicates the applicable marketplace is English language version of eBay Canada. - **EBAY_CH**: This enumeration value indicates the applicable marketplace is eBay Switzerland. - **EBAY_DE**: This enumeration value indicates the applicable marketplace is eBay Germany. - **EBAY_ES**: This enumeration value indicates the applicable marketplace is eBay Spain. - **EBAY_FR**: This enumeration value indicates the applicable marketplace is eBay France. - **EBAY_GB**: This enumeration value indicates the applicable marketplace is eBay UK. - **EBAY_HK**: This enumeration value indicates the applicable marketplace is eBay Hong Kong. - **EBAY_IE**: This enumeration value indicates the applicable marketplace is eBay Ireland. - **EBAY_IT**: This enumeration value indicates the applicable marketplace is eBay Italy. - **EBAY_MY**: This enumeration value indicates the applicable marketplace is eBay Malaysia. - **EBAY_NL**: This enumeration value indicates the applicable marketplace is eBay Netherlands. - **EBAY_PH**: This enumeration value indicates the applicable marketplace is eBay Philippines. - **EBAY_PL**: This enumeration value indicates the applicable marketplace is eBay Poland. - **EBAY_SG**: This enumeration value indicates the applicable marketplace is eBay Singapore. - **EBAY_US**: This enumeration value indicates the applicable marketplace is eBay US.
**Type:** string

### VideoRejectReasonEnum
**Description:** This enumerated type indicates the reason for moderation failure. | - **BLURRED**: This enum value indicates that the video is blocked because some parts are blurry and cannot be seen clearly. - **DIRECTS_OFF_EBAY**: This enum value indicates that the video is blocked because it leads buyers away from the eBay site. Refer to eBay's \[Offering to buy or sell outside of eBay policy\](https://www.ebay.com/help/policies/payment-policies/offering-buy-sell-outside-ebay-policy?id=4272) for details. - **DISTORTED_AUDIO**: This enum value indicates that the video is blocked because the audio playback is distorted. - **FREEZES**: This enum value indicates that the video is blocked because some parts appear frozen and do not play correctly. - **INAPPROPRIATE_DEPICTION**: This enum value indicates that the video is blocked due to an inappropriate depiction of minors. Refer to eBay's \[Protecting minors policy\](https://www.ebay.com/help/policies/prohibited-restricted-items/protecting-minors-policy?id=5057) for details. - **MAX_LENGTH_EXCEEDED**: This enum value indicates that the video is blocked because the Maximum length has been exceeded. - **NUDITY**: This enum value indicates that the video is blocked because it contains nudity. Refer to eBay's \[Adult items policy\](https://www.ebay.com/help/policies/prohibited-restricted-items/adult-items-policy?id=4278) for details. - **OFFENSIVE_CONTENT**: This enum value indicates that the video is blocked because it contains offensive content. Refer to eBay's \[Offensive materials policy\](https://www.ebay.com/help/policies/prohibited-restricted-items/offensive-materials-policy?id=4324) for details. - **OTHER_POLICY_VIOLATION**: This enum value indicates that the video is blocked due to some other specific or atypical policy violation. - **PIXELATED**: This enum value indicates that the video is blocked because some parts are pixelated and cannot be seen clearly.
**Type:** string

### VideoPlaylistProtocolEnum
**Description:** This enumerated type indicates the protocol for the video playlist. Supported protocols are \`DASH\` (Dynamic Adaptive Streaming over HTTP) and \`HLS\` (HTTP Live Streaming). | - **DASH**: This enum value indicates the protocol for the video playlist is \`DASH\` (Dynamic Adaptive Streaming over HTTP). - **HLS**: This enum value indicates the protocol for the video playlist is \`HLS\` (HTTP Live Streaming).
**Type:** string

### VideoProcessingFailureCategoryEnum
**Description:** This enumerated type represents the categories of video processing failures. | - **INTERNAL**: This enum value indicates that video processing failed due to a server or system error during processing of the video. - **REQUEST**: This enum value indicates that video processing failed due to invalid request parameters or data during video upload.
**Type:** string

### VideoStatusEnum
**Description:** This enumerated type indicates the video's status. Typically a video will progress through the following states: \`PENDING\_UPLOAD\` -> \`PROCESSING\` -> \`LIVE\`. A video may also enter terminal states such as \`PROCESSING\_FAILED\` or \`BLOCKED\` depending on various conditions, instead of reaching \`LIVE\`. New status values may be added in the future; clients should handle unknown values gracefully. | - **BLOCKED**: This enum value indicates that the video is blocked. A video might be \`BLOCKED\` if it contains malware, or if it is blocked by the video moderation feature. - **LIVE**: This enum value indicates that the video is live. When the status of the video is \`LIVE\`, this indicates the file has been processed and uploaded successfully. The playlist providing URLs for the video streaming protocols is generated when processing completes successfully. - **PENDING_UPLOAD**: This enum value indicates that the video is pending upload. The video is being associated with a video ID and has not been uploaded yet. - **PROCESSING**: This enum value indicates that the video upload is processing. After a video upload is successfully completed, the status will show as \`PROCESSING\` until the video reaches one of the terminal states of \`LIVE\`, \`BLOCKED\`, or \`PROCESSING\_FAILED\`. - **PROCESSING_FAILED**: This enum value indicates that the video failed to process. Videos can fail to process for a number of reasons such as the file being corrupted, the file being too large, or the file's size doesn't match what was provided in the metadata. Refer to the error messages to determine the cause of the video's failure to upload.
**Type:** string

### ReturnLabelProvisionOption
**Description:** This enumerated type is used to provide the return label options for the return shipment label. | - **ATTACH_LABEL_TO_RETURN**: This enum value indicates that the seller attaches the return label to the return. \*\*Note:\*\* Use the \*\*Media API\*\* \[downloadPostOrderDocument\](https://developer.ebay.com/api-docs/commerce/media/resources/post\_order/methods/downloadPostOrderDocument) method to download the label. - **RECORD_LABEL_SENT_OFFLINE**: This enum value indicates that the seller has sent the return label to the buyer offline. - **USE_PLATFORM_LABEL**: This enum value indicates that the platform provides the return shipping label.
**Type:** string

### OrderReturnFilterPreset
**Description:** This enumerated type provides preset filters to use when filtering OrderReturns. | - **AWAITING_ACTION_FROM_BUYER**: This value indicates that the OrderReturn is awaiting a buyer action. This indicates any of the following actions: - awaiting initiation of return shipment - awaiting response to a price reduction offer - **AWAITING_ACTION_FROM_EBAY**: This value indicates that the OrderReturn is referred to eBay and awaiting eBay decision and action. - **AWAITING_ACTION_FROM_SELLER**: This value indicates that the OrderReturn is awaiting a seller action. This indicates any of the following actions: - awaiting approval of OrderReturn - awaiting to provide return fulfillment details to buyer - awaiting providing a refund after return fulfillment is complete - **CLOSED**: This value indicates that the OrderReturn is closed. This indicates any of the following actions: - Return Resolved with Return Shipment and Refund (or) with Refund only - Return Cancelled by Buyer (or) by eBay - Return Declined by Seller (or) by eBay - **IN_PROGRESS**: This value indicates that the OrderReturn is open, but have no pending actions to the buyer or the seller.
**Type:** string

### OrderReturnSortField
**Description:** This enumerated type defines the sorting order for the returned orders. | - **REQUESTED_AT**: Sort by the date the return was requested.
**Type:** string

### OfflineReturnLabelChannelInput
**Description:** This enumerated type defines how the return label was provided to the buyer. | - **COMMUNICATED_TO_BUYER**: This value indicates the label was provided to the buyer through an offline channel (for example, email or printed separately). - **RETURN_LABEL_IN_THE_BOX**: This value indicates the return label was included in the box with the item.
**Type:** string

### WithholdReturnRefundReasonInput
**Description:** This enumerated type provides context for the refund adjustment or deduction applied in accordance with the applicable return policy. | - **RETURNED_IN_DAMAGED_CONDITION**: This enumeration value indicates that item was returned in a damaged condition, which has resulted in a loss of value. - **RETURNED_IN_USED_CONDITION**: This enumeration value indicates that item was returned in a used condition, which has resulted in a loss of value. - **RETURNED_WITH_MISSING_PARTS**: This enumeration value indicates that item was returned with missing parts, which has resulted in a loss of value.
**Type:** string

### ReturnRuleLogicalOperator
**Description:** This enumerated type specifies how to combine multiple child conditions into a single result. | - **AND**: This enum value indicates that conditions will combined using a logical \*\*AND\*\*. All child conditions must be true.
**Type:** string

### ReturnPreferenceStatus
**Description:** An enumerated type that indicates whether the seller's Return Merchandise Authorization (RMA) number requirement is enabled or disabled. | - **DISABLED**: This enum value indicates the seller's RMA requirement is inactive (returns do not require an RMA). - **ENABLED**: This enum value indicates the seller's RMA requirement is active (returns require an RMA).
**Type:** string

### ReturnRuleDisabler
**Description:** This enumerated type identifies which party disabled the automation return rule. | - **SELLER**: This value indicates the rule was disabled by the \`SELLER\`. - **SYSTEM**: This value indicates the rule was disabled by the \`SYSTEM\`.
**Type:** string

### WatchListAddFailureReason
**Description:** This enumerated type contains the reasons why an item might fail to be added to a user's Watchlist. | - **ITEM_ALREADY_WATCHED**: This enum value indicates that the item is already in the user's Watchlist. - **ITEM_NOT_ACTIVE**: This enum value indicates that the listing is not part of an active listing and cannot be added to a Watchlist. - **ITEM_NOT_FOUND**: This enum value indicates that the specified item ID cannot be found. - **WATCHLIST_FULL**: This enum value indicates that the user's Watchlist is full and no further items can be added at this time.
**Type:** string

### WatchListRemoveFailureReason
**Description:** This enumerated type contains the reason an item failed to be removed from a user's Watchlist. | - **ITEM_NOT_WATCHED**: The item is not currently in the user's Watchlist.
**Type:** string

### CustomListFailureReason
**Description:** This enumerated type contains the reason a custom list operation failed. | - **CUSTOM_LIST_NOT_FOUND**: The specified custom list cannot be found.
**Type:** string

### DateTime
**Description:** An RFC-3339 compliant date-time scalar for precise timestamp representation. \*\*Format\*\*: ISO 8601 format following RFC-3339 specifications (YYYY-MM-DDThh:mm:ss.sssZ or with timezone offset). \*\*Usage\*\*: Used for representing exact moments in time including timezone information. \*\*Example\*\*: '2023-04-01T14:30:00.000Z' or '2023-04-01T10:30:00-04:00' \*\*Note\*\*: At runtime, this scalar converts to \*\*java.time.OffsetDateTime\*\* objects, preserving timezone information.
**Type:** scalar

### Decimal
**Description:** A scalar representing precise decimal numeric values. \*\*Format\*\*: String-encoded decimal value with arbitrary precision (e.g., \`10.99\`, \`1000.00\`, \`0.001\`). \*\*Usage\*\*: Used for monetary amounts, measurements, and other values requiring decimal precision. \*\*Example\*\*: \`19.99\` for a price, \`1.75\` for a weight or measurement. \*\*Note\*\*: Preserves exact decimal representation without floating-point rounding errors, making it suitable for financial calculations and other precision-sensitive values.
**Type:** scalar

### CountryCode
**Description:** This scalar type is used to specify/indicate countries in the API. Countries are represented with the two-letter country codes that are defined in the \*\*ISO 3166-1 alpha-2\*\* standard.
**Type:** scalar

### HttpOrHttpsUrl
**Description:** A scalar representing a valid HTTP or HTTPS URL string value.
**Type:** scalar

### Percentage
**Description:** A percentage value that must be between 0 and 100 inclusive. Represents a whole number percentage.
**Type:** scalar

### Epid
**Description:** This type represents the eBay Product ID (e.g. ePID), which is the unique identifier of an eBay catalog product.
**Type:** scalar

### Time
**Description:** An RFC-3339 compliant time scalar for representing time-of-day without a date component. \*\*Format\*\*: ISO 8601 time format following RFC-3339 (hh:mm:ss.sssZ or with timezone offset). \*\*Usage\*\*: Used when only the time of day is relevant, independent of the date. \*\*Example\*\*: \`14:30:00.000Z\` or \`10:30:00-04:00\` \*\*Note\*\*: At runtime, this scalar converts to \*\*java.time.OffsetTime\*\* objects, preserving timezone information.
**Type:** scalar

### Invoicee
**Description:** A scalar representing the payee for a transaction. \*\*Format\*\*: String-encoded identifier for the payee. \*\*Usage\*\*: Used to specify the payee in various transaction contexts. Example: \`BUYER\` for the buyer and \`SELLER\` for the seller.
**Type:** scalar

### HttpsUrl
**Description:** A scalar representing a valid HTTPS URL string value that enforces secure URL protocols. \*\*Format\*\*: Must begin with 'https://' followed by a valid domain name and optional path components. - Protocol must be HTTPS (not HTTP) - Must contain a valid domain name - May include an optional port number - May include optional path, query parameters, and fragments - Special characters in the URL must be properly encoded
**Type:** scalar

### Duration
**Description:** This scalar represents the duration in ISO-8601 format. For example, \`PT1H30M\` for 1 hour and 30 minutes.
**Type:** scalar

## Rate Limits

See [API Call Limits](https://developer.ebay.com/develop/get-started/api-call-limits) on the eBay Developer Program.

## Resources

### Documentation

- [eBay Developer Program](https://developer.ebay.com/)
- [API Documentation](https://developer.ebay.com/develop/api/)
- [SDKs and Widgets](https://developer.ebay.com/develop/sdks-and-widgets)
- [Developer Community Forum](https://community.ebay.com/t5/Developer-Groups/ct-p/developergroup)

### Tools

- [API Explorer](https://developer.ebay.com/my/api_test_tool)
- [GraphQL Explorer](https://developer.ebay.com/my/graphql_explorer)

### Support

- [Developer Support](https://developer.ebay.com/support/)
- [API Status](https://developer.ebay.com/support/api-status)
- [Release Notes](https://developer.ebay.com/develop/api/release_notes/)

---
*Generated on 2026-05-05T06:16:18.822Z*
