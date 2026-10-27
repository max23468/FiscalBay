# Get Shipment Tracking Info

- API Type: REST
- Operation: GET `/post-order/v2/return/{returnId}/tracking`
- Base URL: `https://api.ebay.com`
- Sandbox: Not supported in the source
- Source: [Post-Order API - Get Shipment Tracking Info](https://developer.ebay.com/Devzone/post-order/post-order_v2_return-returnid_tracking__get.html)

## Description

This method retrieves shipment tracking activity for a specific return request.

The response includes the carrier, tracking number, current tracking status, and the scan-history events that show where and when the returned package moved through the carrier network.

## When To Use

Use this method when you already know the return request ID and need carrier tracking details for that return shipment.

Typical partner-facing use cases:

- Retrieve the latest delivery status for a return shipment
- Show the full scan history for a returned package
- Correlate tracking activity to a specific Post-Order return

## Request

### Endpoint

```http
GET https://api.ebay.com/post-order/v2/return/{returnId}/tracking?carrier_used=string&tracking_number=string
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `returnId` | string | Yes | The unique eBay-assigned ID of the return request whose tracking activity is being retrieved. |

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `carrier_used` | string | Yes | Shipping carrier used for the returned package. |
| `tracking_number` | string | Yes | Tracking number of the returned package. |

### HTTP Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | This call uses standard authorization tokens. |

### Authentication Notes

- All requests made to eBay REST operations require the `Authorization` HTTP header.
- This call uses standard authorization tokens.

### Request Body

This call has no request payload.

## Response

### Response Type

The response payload is `GetTrackingHistoryResponse`.

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `carrierUsed` | `string` | Carrier name associated with the shipment. |
| `trackingNumber` | `string` | Tracking number for the shipment. |
| `trackingStatus` | `string` | Current delivery state, such as `IN_TRANSIT` or `DELIVERED`. |
| `scanHistory` | `array of ScanDetailType` | One or more carrier scan events for the returned package. |
| `scanHistory.eventCity` | `string` | City where the scan event occurred. |
| `scanHistory.eventStateOrProvince` | `string` | State or province where the scan event occurred. |
| `scanHistory.eventPostalCode` | `string` | Postal code of the scan location. |
| `scanHistory.eventCode` | `string` | Event code reported by the carrier. |
| `scanHistory.eventDesc` | `string` | Human-readable description of the carrier event. |
| `scanHistory.eventStatus` | `string` | Delivery or movement status tied to the event. |
| `scanHistory.eventTime` | `DateTime` | Timestamp when the carrier event occurred. |

## Response Behavior

- The top-level tracking fields summarize the shipment.
- `scanHistory` contains the detailed event stream for the package.
- `trackingStatus` may be absent if the carrier has not exposed a current status.

## Example

### Request

```http
GET https://api.ebay.com/post-order/v2/return/5********2/tracking?carrier_used=USPS&tracking_number=0**************3
Authorization: Bearer <access-token>
```

### Response Excerpt

```json
{
  "carrierUsed": "USPS",
  "trackingNumber": "0**************3",
  "trackingStatus": "DELIVERED",
  "scanHistory": [
    {
      "eventStatus": "DELIVERED",
      "eventDesc": "Delivered",
      "eventTime": {
        "value": "2015-04-11T12:46:00.000-07:00"
      },
      "eventCity": "SACRAMENTO",
      "eventStateOrProvince": "CA",
      "eventPostalCode": "9***4",
      "eventCode": "UNKNOWN"
    }
  ]
}
```

