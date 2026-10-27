# Case To Inquiry Or Return

Use this rule for traditional case-management rows such as `GetCase`, `IssueCaseRefund`, `AppealCaseDecision`, `ProvideCaseShipmentInfo`, and `SearchCases`.

## Rule

- First classify the case as an INR inquiry path or a return path.
- Route inquiry cases to Order Inquiry API.
- Route return cases to Return API.
- Do not preserve the traditional case-management object as a standalone modern domain concept when the bundled guidance merges it into inquiry and return flows.

## Practical Mapping

- `GetCase` -> `orderInquiry` or `orderReturn`
- `IssueCaseRefund` -> `processOrderInquiryRefund` or `processReturnRefund`
- `AppealCaseDecision` -> `submitOrderInquiryReferral` or `submitReturnReferral`
- `ProvideCaseShipmentInfo` -> `provideShipmentInfoForItemNotReceivedInquiry`
- `SearchCases` -> `sellerOrderInquiries` or `sellerOrderReturns`

