# AskSellerQuestion

- Source URL: https://developer.ebay.com/api-docs/static/pn_ask-seller-question.html

## Description

eBay sends an AskSellerQuestion notification when a user asks a question about one of a seller's active listings. Platform Choice A seller requests to receive this notification by issuing a SetNotificationsPreference call. By default, these notifications are sent via API ("Platform"). Alternatively, users can choose to be notified via text message("SMS"). Data Fields Returned API Call that displays this notification: GetMemberMessages The data fields returned by the AskSellerQuestion notification are the same as those returned by GetMemberMessages . Refer to the GetMemberMessages call reference documentation for additional information. Most of the useful information in the body of this notification is nested within the MemberMessage.MemberMessageExchange property. Key properties include: Item.ItemID : Item ID of the item the user asked a question about Question.QuestionType : Type of question being asked Question.SenderID : User who sent the question Question.Body : Text of the question being asked CreationDate : Time the question was created (the time it was sent) Refer to SOAP Message Body for information about the standard elements returned for all notifications.
