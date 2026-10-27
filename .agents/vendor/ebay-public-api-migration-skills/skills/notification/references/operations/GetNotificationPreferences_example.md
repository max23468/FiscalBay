# GetNotificationPreferences Samples

**Source API:** Trading API

- [Sample 1: Application-Level Request](#sample-1-application-level-request)
- [Sample 2: User-Level](#sample-2-user-level)

---

## Sample 1: Application-Level Request

This sample GetNotificationPreferences request with a PreferenceLevel value of Application returns information about the notification preferences.

### Input

This is a sample GetNotificationPreferences request with a PreferenceLevel value of Application.

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetNotificationPreferencesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
	<RequesterCredentials>
		<eBayAuthToken>A*******3</eBayAuthToken>
	</RequesterCredentials>
	<PreferenceLevel>Application</PreferenceLevel>
</GetNotificationPreferencesRequest>
```

### Output

This is a sample GetNotificationPreferences response with a PreferenceLevel value of Application.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<GetNotificationPreferencesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
	<Timestamp>2019-11-04T22:20:48.456Z</Timestamp>
	<Ack>Success</Ack>
	<Version>1127</Version>
	<Build>E1127_CORE_APINOTIFY_19078619_R1</Build>
	<ApplicationDeliveryPreferences>
		<ApplicationEnable>Enable</ApplicationEnable>
		<AlertEmail>mailto://r*****@******.com</AlertEmail>
		<AlertEnable>Enable</AlertEnable>
		<NotificationPayloadType>eBLSchemaSOAP</NotificationPayloadType>
		<DeviceType>Platform</DeviceType>
		<PayloadEncodingType>JSON</PayloadEncodingType>
		<PayloadVersion>1113</PayloadVersion>
	</ApplicationDeliveryPreferences>
</GetNotificationPreferencesResponse>
```

---

## Sample 2: User-Level

This is a sample request and response for user-level notification preferences.

### Input

This sample GetNotificationPreferences request with a PreferenceLevel value of User returns information about the user's subscribed events. It returns

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetNotificationPreferencesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
	<RequesterCredentials>
		<eBayAuthToken>A*******3</eBayAuthToken>
	</RequesterCredentials>
	<ErrorLanguage>en_US</ErrorLanguage>
	<WarningLevel>High</WarningLevel>
	<!-- Set the Preference Level to Application or User -->
	<PreferenceLevel>User</PreferenceLevel>
</GetNotificationPreferencesRequest>
```

### Output

This is a sample GetNotificationPreferences response with a PreferenceLevel value of User.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<GetNotificationPreferencesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
	<Timestamp>2019-11-04T22:22:38.137Z</Timestamp>
	<Ack>Success</Ack>
	<Version>1127</Version>
	<Build>E1127_CORE_APINOTIFY_19078619_R1</Build>
	<UserDeliveryPreferenceArray>
		<NotificationEnable>
			<EventType>OutBid</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>EndOfAuction</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>AuctionCheckoutComplete</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>CheckoutBuyerRequestsTotal</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>Feedback</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>FixedPriceTransaction</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>SecondChanceOffer</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>AskSellerQuestion</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>ItemListed</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>BestOffer</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>ItemRevised</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>WatchedItemEndingSoon</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>MyMessageseBayMessageHeader</EventType>
			<EventEnable>Disable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>MyMessagesM2MMessageHeader</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>INRBuyerRespondedToDispute</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>AccountSuspended</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>ItemSold</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>ItemSuspended</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>ItemClosed</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>ItemExtended</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>ItemRevisedAddCharity</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>ItemAddedToWatchList</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>BidPlaced</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>ItemRemovedFromWatchList</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>ItemAddedToBidGroup</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>ItemRemovedFromBidGroup</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>BidReceived</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>ItemWon</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>ItemLost</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>ItemUnsold</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>FeedbackLeft</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>FeedbackStarChanged</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>BestOfferPlaced</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>CounterOfferReceived</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>BestOfferDeclined</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>FeedbackReceived</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>TokenRevocation</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>ItemsCanceled</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>ItemMarkedShipped</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>ItemMarkedPaid</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>MyMessagesHighPriorityMessage</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>SavedSearchResult</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>EBPMyResponseDue</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>EBPOtherPartyResponseDue</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
	</UserDeliveryPreferenceArray>
</GetNotificationPreferencesResponse>
```
