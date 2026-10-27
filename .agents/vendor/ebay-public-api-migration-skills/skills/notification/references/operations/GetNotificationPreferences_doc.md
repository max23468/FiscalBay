# GetNotificationPreferences - API Reference - Trading API

- Source URL: https://developer.ebay.com/devzone/xml/docs/Reference/ebay/GetNotificationPreferences.html

## Overview

Retrieves the requesting application's notification preferences.

Details are only returned for events for which a preference has been set. For example, if notification for `EndOfAuction` was enabled and later disabled, the response still returns that event preference as disabled.

See the Platform Notifications Guide:

- https://developer.ebay.com/api-docs/static/platform-notifications-landing.html

## Request Prototype

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetNotificationPreferencesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
	<PreferenceLevel>NotificationRoleCodeType</PreferenceLevel>
	<ErrorLanguage>string</ErrorLanguage>
	<MessageID>string</MessageID>
	<OutputSelector>string</OutputSelector>
	<!-- ... more OutputSelector values allowed here ... -->
	<Version>string</Version>
	<WarningLevel>WarningLevelCodeType</WarningLevel>
</GetNotificationPreferencesRequest>
```

## Key Input Fields

- `PreferenceLevel` is required and selects which preference set to retrieve. Supported values include `Application`, `Event`, `User`, and `UserData`. Default is `Application`.
- `ErrorLanguage` localizes returned error strings.
- `MessageID` is echoed back in `CorrelationID` when provided.
- `OutputSelector` limits the response payload to selected fields.
- `Version` is required for SOAP and otherwise controlled by the compatibility header for XML API calls.
- `WarningLevel` controls warnings for unrecognized or deprecated request elements.

## Response Prototype

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetNotificationPreferencesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
	<ApplicationDeliveryPreferences>
		<AlertEmail>anyURI</AlertEmail>
		<AlertEnable>EnableCodeType</AlertEnable>
		<ApplicationEnable>EnableCodeType</ApplicationEnable>
		<ApplicationURL>anyURI</ApplicationURL>
		<DeliveryURLDetails>
			<DeliveryURL>anyURI</DeliveryURL>
			<DeliveryURLName>string</DeliveryURLName>
			<Status>EnableCodeType</Status>
		</DeliveryURLDetails>
		<!-- ... more DeliveryURLDetails nodes allowed here ... -->
		<DeviceType>DeviceTypeCodeType</DeviceType>
		<NotificationPayloadType>NotificationPayloadTypeCodeType</NotificationPayloadType>
		<PayloadVersion>string</PayloadVersion>
	</ApplicationDeliveryPreferences>
	<DeliveryURLName>string</DeliveryURLName>
	<EventProperty>
		<EventType>NotificationEventTypeCodeType</EventType>
		<Name>NotificationEventPropertyNameCodeType</Name>
		<Value>string</Value>
	</EventProperty>
	<!-- ... more EventProperty nodes allowed here ... -->
	<UserData>
		<ExternalUserData>string</ExternalUserData>
	</UserData>
	<UserDeliveryPreferenceArray>
		<NotificationEnable>
			<EventEnable>EnableCodeType</EventEnable>
			<EventType>NotificationEventTypeCodeType</EventType>
		</NotificationEnable>
		<!-- ... more NotificationEnable nodes allowed here ... -->
	</UserDeliveryPreferenceArray>
	<Ack>AckCodeType</Ack>
	<Build>string</Build>
	<CorrelationID>string</CorrelationID>
	<Errors>
		<ErrorClassification>ErrorClassificationCodeType</ErrorClassification>
		<ErrorCode>token</ErrorCode>
		<ErrorParameters ParamID="string">
			<Value>string</Value>
		</ErrorParameters>
		<LongMessage>string</LongMessage>
		<SeverityCode>SeverityCodeType</SeverityCode>
		<ShortMessage>string</ShortMessage>
	</Errors>
	<ExternalUserData>string</ExternalUserData>
	<HardExpirationWarning>string</HardExpirationWarning>
	<Timestamp>dateTime</Timestamp>
	<Version>string</Version>
</GetNotificationPreferencesResponse>
```

## Key Output Fields

- `ApplicationDeliveryPreferences` returns application-level delivery settings such as alert email, delivery URLs, device type, payload type, and payload version.
- `DeliveryURLName` returns the application delivery URL name associated with the user.
- `EventProperty` returns per-event property name/value data, currently relevant for wireless scenarios such as `TimeLeft`.
- `UserData.ExternalUserData` returns caller-supplied user-specific payload metadata.
- `UserDeliveryPreferenceArray.NotificationEnable` returns one enabled or disabled preference per notification event that has been set.
- Standard output fields include `Ack`, `Build`, `CorrelationID`, `Errors`, `Timestamp`, and `Version`.

## Detail Controls

This call does not support varying detail levels. `DetailLevel` does not need to be passed.

## Samples

Dedicated sample markdown for this call is bundled here:

- `sources/api-usage-examples/legacy/Trading API_GetNotificationPreferences.md`

### Application-Level Request

This sample returns application-level notification preferences.

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetNotificationPreferencesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
	<RequesterCredentials>
		<eBayAuthToken>A*******3</eBayAuthToken>
	</RequesterCredentials>
	<PreferenceLevel>Application</PreferenceLevel>
</GetNotificationPreferencesRequest>
```

### User-Level Request

This sample returns the user's subscribed notification events.

```xml
<?xml version="1.0" encoding="utf-8"?>
<GetNotificationPreferencesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
	<RequesterCredentials>
		<eBayAuthToken>A*******3</eBayAuthToken>
	</RequesterCredentials>
	<ErrorLanguage>en_US</ErrorLanguage>
	<WarningLevel>High</WarningLevel>
	<PreferenceLevel>User</PreferenceLevel>
</GetNotificationPreferencesRequest>
```
