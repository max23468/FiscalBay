# createOrReplaceUserNote
**API:** User Note
**Type:** GraphQL Mutation
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Mutation
**Operation Name:** `createOrReplaceUserNote`
---

## Description

This sample **createOrReplaceUserNote** mutation creates a user note for an item, specified by its **itemId **value.

---

## Request Payload

```graphql
mutation CreateOrReplaceUserNote($input: CreateOrReplaceUserNoteInput!) {
  createOrReplaceUserNote(input: $input) {
    __typename
    ... on CreateOrReplaceUserNoteSuccess {
      userNote {
        note
      }
    }
    ... on ReferenceArgumentsNotFound {
      errorCode
      errorMessage
      argumentNames
    }
  }
}

# Variables:
{
  "input": {
    "itemId": "2********4-5********2",
    "userNote": "Perfect size and color!"
  }
}
```

---

## Response Sample

```json
{
    "data": {
        "createOrReplaceUserNote": {
            "__typename": "CreateOrReplaceUserNoteSuccess",
            "userNote": {
        "note": "Purchased it. Great condition!"
            }
        }
    }
}
```
