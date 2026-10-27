# Appeal Case Decision

- API Type: REST
- Operation: POST `/post-order/v2/casemanagement/{caseId}/appeal`
- Base URL: `https://api.ebay.com`
- Sandbox: Not supported in the source
- Source: [Post-Order API - Appeal Case Decision](https://developer.ebay.com/devzone/post-order/post-order_v2_casemanagement-caseid_appeal__post.html)

## Description

Buyers and sellers can use this method to appeal a case decision that was not ruled in their favor by eBay customer support.

The `caseId` path parameter identifies the INR or return case being appealed. The optional `comments` container lets the caller explain why the case decision should be reconsidered.

## When To Use

Use this method when an existing Post-Order case has already been decided and the buyer or seller wants to file a formal appeal.

Typical partner-facing use cases:

- File an appeal for a return-related case
- File an appeal for an INR-related case
- Attach a short explanatory note to the appeal request

## Request

### Endpoint

```http
POST https://api.ebay.com/post-order/v2/casemanagement/{caseId}/appeal
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `caseId` | string | Yes | The unique identifier of the case being appealed. The case ID is required as part of the URI. |

### HTTP Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | This call uses standard authorization tokens. |
| `Accept-Language` | Conditional | Influences how localized text is interpreted when `comments.language` is omitted. |

### Authentication Notes

- All requests made to eBay REST operations require the `Authorization` HTTP header.
- This call uses standard authorization tokens.

### Request Body

The request payload is `AppealRequest`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `comments` | `Text` | No | Optional explanatory note about why the appeal is being made. |
| `comments.content` | `string` | Conditional | The actual text of the appeal note. |
| `comments.language` | `string` | Conditional | Two-letter language code for `comments.content`. |
| `comments.translatedFromContent` | `string` | Conditional | Original text before localization, when translation is involved. |
| `comments.translatedFromLanguage` | `string` | Conditional | Language code for `comments.translatedFromContent`. |

## Response

### Response Type

This call has no response payload.

### Response Behavior

- A successful call returns HTTP `200`.
- No response body is returned when the appeal is accepted for processing.

## Example

### Request

```http
POST https://api.ebay.com/post-order/v2/casemanagement/5********7/appeal
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "comments": {
    "content": "I am not happy with this case decision."
  }
}
```

### Response

Successful responses return HTTP `200` with no payload.

