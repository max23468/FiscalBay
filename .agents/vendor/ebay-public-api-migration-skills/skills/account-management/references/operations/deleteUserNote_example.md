# deleteUserNote
**API:** User Note
**Type:** GraphQL Mutation
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Mutation
**Operation Name:** `deleteUserNote`
---

## Description

This sample **deleteUserNote** mutation deletes a user note associated with an item, specified by its **itemId**value.

---

## Request Payload

```graphql
mutation DeleteUserNote($input: DeleteUserNoteInput!) {
  deleteUserNote(input: $input) {
    __typename
    ... on DeleteUserNoteSuccess {
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

#  Variables
{
  "input": {
    "itemId": "2********4-5*********2"
  }
}
```

---

## Response Sample

```json
{
    "data": {
        "deleteUserNote": {
            "__typename": "DeleteUserNoteSuccess",
            "userNote": {
        "note": "Purchased it. Great condition!"
            }
        }
    }
}
```
