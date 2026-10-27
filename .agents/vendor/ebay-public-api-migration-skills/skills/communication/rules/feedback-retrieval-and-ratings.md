# Feedback Retrieval And Ratings

## Rule

Traditional feedback retrieval splits into two modern shapes: detailed feedback entries and aggregate rating summaries.

## What Changes

- Use `getFeedback` for individual feedback entries, line-item filtering, comment filtering, images, role filtering, and AI-topic filtering.
- Use `getFeedbackRatingSummary` for aggregated seller metrics such as communication, delivery, or overall experience summaries.
- Use `getItemsAwaitingFeedback` to discover which line items still need feedback from the current user.

## Migration Impact

- Feedback is modernized around order-line-item context, not only around users and summary totals.
- Seller-rating detail becomes more explicit and filterable.
- A single `GetFeedback` migration may require both detailed-entry retrieval and rating-summary retrieval depending on the traditional use case.

## Verified Public Guidance

- The pilot guide explicitly splits `GetFeedback` into `getFeedback` and `getFeedbackRatingSummary`.
- The Feedback API docs describe `getFeedback` as entry retrieval and `getFeedbackRatingSummary` as aggregated metrics.
- Usage examples confirm concrete REST query shapes for both methods.