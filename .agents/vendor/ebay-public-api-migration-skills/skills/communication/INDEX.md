# Communication Operation Index

Validated operation inventory derived from the canonical Communication rows in `sources/api-mapping.csv` and `sources/api-mapping/communication.csv`.

## Validated Mappings

| Traditional operation | Status | Modern API family | Modern method or endpoint | Notes |
| --- | --- | --- | --- | --- |
| GetItemsAwaitingFeedback | REST | Feedback API | `GET /commerce/feedback/v1/awaiting_feedback` | Retrieve pending buyer or seller feedback work and rating templates. |
| LeaveFeedback | REST | Feedback API | `POST /commerce/feedback/v1/feedback` | Submit feedback for a completed order line item. |
| RespondToFeedback | REST | Feedback API | `POST /commerce/feedback/v1/respond_to_feedback` | Reply to existing feedback from the order partner. |
| GetFeedback | REST | Feedback API | `GET /commerce/feedback/v1/feedback` | Retrieve detailed feedback entries and filters. |
| GetFeedback | REST | Feedback API | `GET /commerce/feedback/v1/feedback_rating_summary` | Retrieve aggregated seller rating metrics. |
| AddMemberMessageAAQToPartner | REST | Message API | `POST /commerce/message/v1/send_message` | Ask-a-question flow becomes conversation-based messaging. |
| AddMemberMessageRTQ | REST | Message API | `POST /commerce/message/v1/send_message` | Reply-to-question uses the same message send method. |
| AddMemberMessagesAAQToBidder | REST | Message API | `POST /commerce/message/v1/send_message` | Bidder outreach collapses into the same message send method. |
| GetMemberMessages | REST | Message API | `GET /commerce/message/v1/conversation/{conversation_id}` | Retrieve one known conversation. |
| GetMemberMessages | REST | Message API | `GET /commerce/message/v1/conversation` | Retrieve matching conversations and discover IDs. |
| GetMyMessages | REST | Message API | `GET /commerce/message/v1/conversation/{conversation_id}` | Retrieve one known conversation. |
| GetMyMessages | REST | Message API | `GET /commerce/message/v1/conversation` | Retrieve inbox conversations by filter. |
| ReviseMyMessages | REST | Message API | `POST /commerce/message/v1/conversation/update_conversation` | Update one conversation's status or read state. |
| ReviseMyMessages | REST | Message API | `POST /commerce/message/v1/bulk_update_conversation` | Update multiple conversation statuses in batch. |
| DeleteMyMessages | REST | Message API | `POST /commerce/message/v1/conversation/update_conversation` | Delete or archive at the conversation level. |
| ReviseMyMessagesFolders | No replacement | None | None | Folder management not supported in modern public APIs. |
| GetMessagePreferences | No replacement | None | None | Custom Ask Seller Question subjects are not supported. |
| SetMessagePreferences | No replacement | None | None | Custom Ask Seller Question subjects are not supported. |
