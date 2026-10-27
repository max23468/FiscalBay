# Escalate Return

- API Type: REST
- Operation: POST `/post-order/v2/return/{returnId}/escalate`
- Base URL: `https://api.ebay.com`
- Sandbox: Not supported in the source
- Source: [Post-Order API - Escalate Return](https://developer.ebay.com/Devzone/post-order/post-order_v2_return-returnid_escalate__post.html)

## Description

This method escalates a return request into a case.

The source says the escalation reason and an accompanying comment can be included in the request payload. If escalation succeeds, a `caseId` is returned.

## When To Use

Use this method when a buyer or seller can no longer resolve the return within the standard return workflow and wants eBay to open a case.

## Request

### Endpoint

```http
POST https://api.ebay.com/post-order/v2/return/{returnId}/escalate
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `returnId` | string | Yes | The unique return request identifier to escalate. |

### HTTP Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | This call uses standard authorization tokens. |

### Authentication Notes

- All requests made to eBay REST operations require the authorization HTTP header for authentication.
- This call uses standard authorization tokens.

### Request Body

The request payload uses `EscalateRequest`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `comments` | `Text` | No | Optional note explaining why the return is being escalated. |
| `reason` | `string` | No | Escalation reason. Recommended by the source. |

## Response

### Response Type

The response payload is `EscalateResponse`.

### Key Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `caseId` | `string` | Unique identifier of the newly created case. |
| `caseUrl` | `string` | URL where case details can be viewed, when returned. |

## Example

### Request

```http
POST https://api.ebay.com/post-order/v2/return/5********9/escalate
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "reason": "SELLER_NO_RESPONSE",
  "comments": {
    "content": "The seller did not respond to my return request."
  }
}
```

### Response Excerpt

```json
{
  "caseId": "5********7"
}
```

## Notes

- Public sample IDs are masked by the source.
- Migration mapping may point to newer GraphQL return referral flows, but this page documents the original traditional return escalation endpoint.

## Related Operations

- `GET /post-order/v2/return/{returnId}` to inspect the return before escalating
- `GET /post-order/v2/casemanagement/{caseId}` to inspect the resulting case
