# GetNotificationsUsage Samples

**Source API:** Trading API

**Source URL:** https://developer.ebay.com/devzone/xml/docs/reference/ebay/GetNotificationsUsage.html

The official reference page does not publish a populated sample under
`Samples`, but it does include XML request and response prototypes. The example
below is adapted from those official prototypes so the request shape and key
response fields remain locally available in this skill package.

- [Sample 1: Review Notification Usage For An Item And Time Range](#sample-1-review-notification-usage-for-an-item-and-time-range)

---

## Sample 1: Review Notification Usage For An Item And Time Range

Retrieves notification usage history for a specific item over a bounded time
range. The official documentation notes that detailed notification information
is only returned when `ItemID` is supplied.

### Input

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetNotificationsUsageRequest xmlns="urn:ebay:apis:eBLBaseComponents">
	<RequesterCredentials>
		<eBayAuthToken>A*******3</eBayAuthToken>
	</RequesterCredentials>
	<StartTime>2026-05-13T00:00:00.000Z</StartTime>
	<EndTime>2026-05-14T00:00:00.000Z</EndTime>
	<ItemID>110011001100</ItemID>
	<ErrorLanguage>en_US</ErrorLanguage>
	<WarningLevel>High</WarningLevel>
	<Version>1453</Version>
</GetNotificationsUsageRequest>
```

### Output

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetNotificationsUsageResponse xmlns="urn:ebay:apis:eBLBaseComponents">
	<EndTime>2026-05-14T00:00:00.000Z</EndTime>
	<MarkUpMarkDownHistory>
		<MarkUpMarkDownEvent>
			<Reason>Automatic monitoring restored notification delivery.</Reason>
			<Time>2026-05-13T10:15:00.000Z</Time>
			<Type>MarkUp</Type>
		</MarkUpMarkDownEvent>
	</MarkUpMarkDownHistory>
	<NotificationDetailsArray>
		<NotificationDetails>
			<DeliveryStatus>Delivered</DeliveryStatus>
			<DeliveryTime>2026-05-13T11:00:12.000Z</DeliveryTime>
			<DeliveryURL>https://example.com/notifications</DeliveryURL>
			<DeliveryURLName>primary-endpoint</DeliveryURLName>
			<ExpirationTime>2026-05-16T11:00:12.000Z</ExpirationTime>
			<Retries>0</Retries>
			<Type>ItemListed</Type>
		</NotificationDetails>
	</NotificationDetailsArray>
	<NotificationStatistics>
		<DeliveredCount>1</DeliveredCount>
		<ErrorCount>0</ErrorCount>
		<ExpiredCount>0</ExpiredCount>
		<QueuedNewCount>0</QueuedNewCount>
		<QueuedPendingCount>0</QueuedPendingCount>
	</NotificationStatistics>
	<StartTime>2026-05-13T00:00:00.000Z</StartTime>
	<Ack>Success</Ack>
	<Version>1453</Version>
	<Build>E1453_CORE_APINOTIFY_00000000_R1</Build>
	<Timestamp>2026-05-14T00:00:01.000Z</Timestamp>
</GetNotificationsUsageResponse>
```

### Notes

- The official reference says `GetNotificationsUsage` can query up to 72 hours
  back from the call time.
- The official reference says detailed `NotificationDetailsArray` entries are
  only returned when `ItemID` is specified.
- The official reference says the call is limited to 50 calls per application
  per hour.

---
