# SetNotificationPreferences Samples

**Source API:** Trading API

- [Sample 1: Basic Call](#sample-1-basic-call)

---

## Sample 1: Basic Call

Sets alert and notification preferences.

### Description

Seller m***************r sets her notification preferences so that she can get SOAP notifications emailed to her when her listings undergo events. She wants notifications that confirm her items are listed and that tell her when a buyer has bid on a listed item, that an auction has ended, and that the buyer has left feedback on the sale.

### Input

```xml
<?xml version="1.0" encoding="utf-8"?>
<SetNotificationPreferencesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
	<RequesterCredentials>
		<eBayAuthToken>A*******3</eBayAuthToken>
	</RequesterCredentials>
	<ApplicationDeliveryPreferences>
		<AlertEmail>mailto://a****@*****************.com</AlertEmail>
		<AlertEnable>Enable</AlertEnable>
		<ApplicationEnable>Enable</ApplicationEnable>
		<ApplicationURL>https://m****************.com</ApplicationURL>
		<DeviceType>Platform</DeviceType>
	</ApplicationDeliveryPreferences>
	<UserDeliveryPreferenceArray>
		<NotificationEnable>
			<EventType>BidReceived</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>Feedback</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>EndOfAuction</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
		<NotificationEnable>
			<EventType>ItemListed</EventType>
			<EventEnable>Enable</EventEnable>
		</NotificationEnable>
	</UserDeliveryPreferenceArray>
</SetNotificationPreferencesRequest>
```

### Output

```xml
<?xml version="1.0" encoding="UTF-8"?>
<SetNotificationPreferencesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
	<Timestamp>2019-11-06T22:45:39.924Z</Timestamp>
	<Ack>Success</Ack>
	<Version>1127</Version>
	<Build>E1127_CORE_APINOTIFY_19078619_R1</Build>
</SetNotificationPreferencesResponse>
```

---
