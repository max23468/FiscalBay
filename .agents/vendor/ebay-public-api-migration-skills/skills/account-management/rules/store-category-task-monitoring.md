# Store Category Task Monitoring

Use this rule when migrating `GetStore`, `GetStoreCategoryUpdateStatus`, or `SetStoreCategories`.

## Rules

- Split `GetStore` into two read paths when needed: `getStore` for store profile metadata and `getStoreCategories` for store-category retrieval.
- Split `SetStoreCategories` by action. Use `addStoreCategory`, `moveStoreCategory`, `renameStoreCategory`, or `deleteStoreCategory` instead of trying to mirror the traditional `Action` field in one REST call.
- Preserve the asynchronous behavior documented in the traditional response. A store-category update may return a task identifier that must be checked with `getStoreTask` or `getStoreTasks`.
- When a traditional flow previously relied on one synchronous SOAP response, modern code should be ready to poll for task completion when the category change is large enough to be processed asynchronously.

## Workflow Notes

- Start with [references/operation-mapping.md](../references/operation-mapping.md) for the split mapping.
- Use [references/operations/GetStoreCategoryUpdateStatus_doc.md](../references/operations/GetStoreCategoryUpdateStatus_doc.md) when you need the traditional task semantics.
- Use the Stores API task support files to separate single-task lookup from task-list retrieval.