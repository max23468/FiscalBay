# markItemCommitmentsPaid

**API:** Item Commitment
**Type:** GraphQL Mutation
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Mutation
**Operation Name:** `markItemCommitmentsPaid`

---

## Description

This sample **markItemCommitmentsPaid** mutation marks item commitments as paid.

---

## Request Payload

```graphql
mutation MarkItemCommitmentsPaid($input: MarkItemCommitmentsPaidInput!) {
  markItemCommitmentsPaid(input: $input) {
    ... on MarkItemCommitmentsPaidSuccess {
      markPaidItemCommitments {
        itemCommitmentId
      }
    }
    ... on MarkItemCommitmentsPaidPartialFailure {
      errorCode
      errorMessage
      markPaidItemCommitments {
        itemCommitmentId
      }
      failures {
        inputItemCommitmentId
        errorCode
        displayMessage
        retryable
      }
    }
    ... on MarkItemCommitmentsPaidCompleteFailure {
      errorCode
      errorMessage
      failures {
        inputItemCommitmentId
        errorCode
        displayMessage
        retryable
      }
    }
  }
}

# Variables

{
  "input": {
    "itemCommitmentIds": ["24-0**-0****27"]
  }
}
```

---

## Response Sample

```json
{
    "data": {
        "markItemCommitmentsPaid": {
            "markPaidItemCommitments": [
                {
                    "itemCommitmentId": "24-0**-0****27"
                }
            ]
        }
    }
}
```
