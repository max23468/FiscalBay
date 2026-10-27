# SetNotificationPreferences - API Reference - Trading API

- Source URL: https://developer.ebay.com/devzone/xml/docs/Reference/ebay/SetNotificationPreferences.html

## Overview

Manages notification and alert preferences for a user or an application.

This call is part of eBay Platform Notifications. A successful request subscribes a user or application to selected notification events and configures where those notifications are delivered.

## Usage Details

- `SetNotificationPreferences` sets up event notifications based on the event types and preferences passed in the request.
- It is part of the broader Platform Notifications capability and is related to the Client Alerts API.
- eBay recommends pairing notifications with periodic polling for the underlying business APIs. For example, after subscribing to `AuctionCheckoutComplete`, continue polling `GetOrders`.
- Your endpoint should return HTTP `200 OK` when notifications are delivered. After repeated unacknowledged deliveries, eBay may stop sending notifications.
- Platform Notifications guidance: https://developer.ebay.com/api-docs/static/platform-notifications-landing.html

## Request Prototype

```xml
<?xml version="1.0" encoding="utf-8"?>
<SetNotificationPreferencesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
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
  <ErrorLanguage>string</ErrorLanguage>
  <MessageID>string</MessageID>
  <Version>string</Version>
  <WarningLevel>WarningLevelCodeType</WarningLevel>
</SetNotificationPreferencesRequest>
```

## Key Input Fields

- `ApplicationDeliveryPreferences` controls application-level delivery behavior, including URLs, enablement flags, payload version, and device type.
- `ApplicationDeliveryPreferences.AlertEmail` sets the alert email address and must use the format `mailto://youremailaddress@yoursite.com`.
- `ApplicationDeliveryPreferences.ApplicationURL` is the endpoint that receives Platform Notifications and must be a well-formed `https://` URL.
- `ApplicationDeliveryPreferences.DeliveryURLDetails` allows defining up to 25 named delivery URLs with per-URL enabled or disabled status.
- `DeliveryURLName` associates a user token with one or more named delivery URLs.
- `EventProperty` carries per-event properties such as `TimeLeft`.
- `UserData.ExternalUserData` stores caller-defined XML-safe user metadata that can be echoed in notifications.
- `UserDeliveryPreferenceArray.NotificationEnable` enables or disables specific notification events.
- `ErrorLanguage`, `MessageID`, `Version`, and `WarningLevel` behave like the standard Trading API request controls.

## Response Prototype

```xml
<?xml version="1.0" encoding="utf-8"?>
<SetNotificationPreferencesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
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
  <Timestamp>dateTime</Timestamp>
  <Version>string</Version>
</SetNotificationPreferencesResponse>
```

## Output

This call has no call-specific output fields. The response consists of the standard Trading API response fields such as:

- `Ack`
- `Build`
- `CorrelationID`
- `Errors`
- `Timestamp`
- `Version`

## Detail Controls

This call does not support varying detail levels. `DetailLevel` does not need to be passed.

## Samples

Dedicated sample markdown for this call is bundled here:

- `sources/api-usage-examples/legacy/Trading API_SetNotificationPreferences.md`

### Basic Call

Sets alert and notification preferences.

Description: a seller subscribes to notifications so SOAP notifications can be emailed when listing-related events occur, including `ItemListed`, `BidReceived`, `EndOfAuction`, and `Feedback`.

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

```xml
<?xml version="1.0" encoding="UTF-8"?>
<SetNotificationPreferencesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Timestamp>2019-11-06T22:45:39.924Z</Timestamp>
  <Ack>Success</Ack>
  <Version>1127</Version>
  <Build>E1127_CORE_APINOTIFY_19078619_R1</Build>
</SetNotificationPreferencesResponse>
```
