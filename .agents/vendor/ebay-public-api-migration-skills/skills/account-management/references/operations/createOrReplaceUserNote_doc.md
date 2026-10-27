---
title: User Note
description: "The **User Note API** enables buyers and sellers to create and delete notes related to listings. These notes are only for the personal use of the eBay user that creates them, and these notes are not exposed publicly on any eBay pages."
api_version: 1.0
api_name: user_note
api_type: GraphQL
api_group: user/note
source_url:
  html: https://developer.ebay.com/develop/api/user/note
  md: https://developer.ebay.com/develop/api/user/note.md
---
# User Note API

The **User Note API** enables buyers and sellers to create and delete notes related to listings. These notes are only for the personal use of the eBay user that creates them, and these notes are not exposed publicly on any eBay pages.

## GraphQL Schema Information

**Mutations:** 2
**Types:** 1394

## Mutations

### createOrReplaceUserNote

This mutation is used to create a new user note or replace an existing user note for an item or order line item. A user note is a small piece of text that can be used by both buyers and sellers to attach additional information to an item or order line item. For example, user notes can be attached to an item a user is selling, an item a user is bidding on, or an order line item that was purchased. The item ID or Order line item ID value must be specified to identify the item or order line item for which a user note is being created or replaced, as well as the text content of the user note. The specified item ID or order line item ID will create a new user note; if a note already exists for an ID, it will be replaced. If the mutation succeeds, the new (or updated) user note will be returned. If the mutation fails, an array of errors indicating why the user note could not be created or updated is returned.

**Returns:** `CreateOrReplaceUserNoteOutput`

**Arguments:**
- **input** (CreateOrReplaceUserNoteInput)

**OAuth scope**

This request requires an access token created with the **Authorization Code Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Authorization Code Grant:**

- `https://api.ebay.com/oauth/api_scope/commerce.usernote`

## Shared Types

Shared API-level schema and common type definitions live in [User Note API_shared.md](User Note API_shared.md).
