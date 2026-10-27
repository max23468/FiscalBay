# Listing Management Operation Mapping

This file is the authoritative operation-level mapping reference for the full Listing Management domain.

## Media and image upload

### UploadSiteHostedPictures -> createImageFromFile + createImageFromUrl + getImage
Purpose:

- Upload listing images to eBay Picture Services and retrieve the resulting stored image reference.

Modern API:

- REST methods `createImageFromFile`, `createImageFromUrl`, and `getImage` in Media API.

Key Differences:

- The traditional SOAP call combined upload and EPS result handling in one call surface, but the modern migration is split across separate REST methods.
- Use `createImageFromFile` when the integration has the binary image locally and `createImageFromUrl` when the integration already hosts the image at an HTTPS URL.
- Capture the `Location` response header from `createImageFromFile` or `createImageFromUrl` to persist the returned `image_id`, then use `getImage` to retrieve the EPS URL and expiration details when needed.
- `createImageFromFile` and `createImageFromUrl` require the `https://api.ebay.com/oauth/api_scope/sell.inventory` scope and are documented as user-level short-duration limited to 50 requests per 5 seconds.

Request Payload Transformation:

- Traditional: [UploadSiteHostedPictures_example.md](operations/UploadSiteHostedPictures_example.md)
- Modern: [createImageFromFile_example.md](operations/createImageFromFile_example.md), [createImageFromUrl_example.md](operations/createImageFromUrl_example.md), [getImage_example.md](operations/getImage_example.md)



Response Payload Transformation:

- Traditional: [UploadSiteHostedPictures_example.md](operations/UploadSiteHostedPictures_example.md)
- Modern: [createImageFromFile_example.md](operations/createImageFromFile_example.md), [createImageFromUrl_example.md](operations/createImageFromUrl_example.md), [getImage_example.md](operations/getImage_example.md)



Related Patterns:

- Full traditional doc extract: [operations/UploadSiteHostedPictures_doc.md](operations/UploadSiteHostedPictures_doc.md)
- Full modern doc extract: [operations/createImageFromUrl_doc.md](operations/createImageFromUrl_doc.md)
- Full modern example: [operations/createImageFromUrl_example.md](operations/createImageFromUrl_example.md)
- Full modern doc extract: [operations/getImage_doc.md](operations/getImage_doc.md)

Migration Guide:

- **createImageFromFile** method of **Media API**
- Key things to know about `createImageFromFile` method:
  - With this method, an image is uploaded to the seller’s account using multipart/form-data, and a successful operation will return an `imageUrl` field with the eBay Picture Service (EPS) URL that can be used in add/revise/relist operation.
  - A successful operation will also return the `getImage` URI in the Location header. The **imageId** value for the uploaded image will be included in the `getImage` URI, and it is strongly recommended that developers save/store this `getImage` URI or **imageId** value because `getImage` will need to be called to get the `imageUrl`, and this is the URL that is needed to add an image to a listing.
  - The image formats supported are **JPG**, **GIF**, **PNG**, **BMP**, **TIFF**, **AVIF**, **HEIC**, and **WEBP**.
- **createImageFromUrl** method of **Media API**
- Key things to know about `createImageFromUrl` method:
  - With this method, an `imageUrl` is provided (must use ‘https’ protocol) in the request payload that is a URL to a seller-hosted image that eBay will download from that URL and create an EPS version of the image and upload to the seller’s account. A successful operation will return an `imageUrl` field with the eBay Picture Service (EPS) URL that can be used in add/revise/relist operation.
  - A successful operation will also return the `getImage` URI in the Location header. The **imageId** value for the uploaded image will be included in the `getImage` URI, and it is strongly recommended that developers save/store this `getImage` URI or **imageId** value because `getImage` will need to be called to get the `imageUrl`, and this is the URL that is needed to add an image to a listing.
  - The image formats supported are **JPG**, **GIF**, **PNG**, **BMP**, **TIFF**, **AVIF**, **HEIC**, and **WEBP**.

### ExtendSiteHostedPictures (Decommissioned) -> No replacement
Purpose:

- Extend the duration of hosted pictures on the traditional eBay Picture Services (EPS) surface.

Modern API:

- No replacement (operation is decommissioned).

Key Differences:

- Traditional EPS allowed explicitly extending picture hosting duration.
- This row is explicitly decommissioned in the authoritative inventory and has no replacement.
- The modern Media API does not expose an "extend" operation for hosted images; expiration and availability are managed by the platform instead of by a seller-triggered extension call.

Related Patterns:

- Traditional context: [operations/UploadSiteHostedPictures_doc.md](operations/UploadSiteHostedPictures_doc.md)
- Modern context: [operations/getImage_doc.md](operations/getImage_doc.md)

Migration Guide:

- eBay no longer supports extending the life of unused EPS URLs beyond 30 days, so answer this row as decommissioned with no replacement rather than inventing a direct successor call.

## Create and validate listings

### VerifyAddItem -> createListing
Purpose:

- Validate an auction-style (or non-fixed-price) listing creation request without committing the listing.

Modern API:

- GraphQL mutation `createListing` (Listing API) with `options.operationMode=VALIDATE`.

Key Differences:

- Uses the same modern mutation as `AddItem`, but runs it in `VALIDATE` mode.

Request Payload Transformation:

- Traditional: [VerifyAddItem_example.md](operations/VerifyAddItem_example.md)
- Modern: [createListing_example.md](operations/createListing_example.md)




Response Payload Transformation:

- Traditional: [VerifyAddItem_example.md](operations/VerifyAddItem_example.md)
- Modern: [createListing_example.md](operations/createListing_example.md)



Related Patterns:

- [../rules/mode-verify-to-validate.md](../rules/mode-verify-to-validate.md)
- Full traditional doc extract: [operations/VerifyAddItem_doc.md](operations/VerifyAddItem_doc.md)
- Full modern doc extract: [operations/createListing_doc.md](operations/createListing_doc.md)
- Full modern example: [operations/createListing_example.md](operations/createListing_example.md)

Migration Guide:

- **createListing** mutation of the **Listing API**
- Key things to know about `createListing` mutation:
  - The `marketplace` field is required to specify the listing marketplace.
  - The `listingFormat` field controls whether the listing will be an **auction**, **fixed price**, or **classified ad** listing.
  - The `listingDurationInDays` field controls the **duration** of the listing.
  - The `title` field sets the **title** of the listing.
  - The `description` field sets the **description** of the listing.
  - The `categories` object is used to provide the **primary listing category**, and optionally, the **secondary listing category**, **primary eBay store category** and **secondary eBay store category**.
  - The `imageUrls` array is used to provide one or more **images** for the listing.
  - The `itemCondition` object is used to set the **condition** of the item.
  - The `product.aspects` array is used to set the aspect name-value pairs (aka **item specifics**) for the product.
  - The `items` array is used to set the **price** and **quantity** of an item, as well as any Global Trade Item Numbers (**GTINs**) and/or an eBay Product ID (**ePID**) for a product. If any of these product IDs are input, eBay can attempt to match the product ID to an eBay catalog product and prefill the listing with the catalog product's details.
  - For a **multiple-SKU listing** (aka multiple-variation listing), each variation within the listing will be defined within the `items` array, and a `sku` value and the unique `traits` for each variation are required.
  - For a **multiple-SKU listing**, the `listingVariations` object is used to provide information on each unique variation within the listing.
  - The **location** of the item is specified through the `itemLocation` object.
  - For sellers opted into Business Policies, Payment, Shipping/Fulfillment, and Return Policy business policies must be used; payment fields are set through the `paymentTerms` object, shipping fields through the `shippingTerms` object, and return policy fields through the `returnTerms` object.
  - The `options` field can be used to validate the input without actually creating the listing. The `options` field is included and set to `VALIDATE` to run the operation in validation mode. This is an alternative to using the `VerifyAddFixedPriceItem` or `VerifyAddItem` calls.
- **Note**: Initially, the `createListing` mutation will only support the creation of one listing per operation. If you need the ability to create listings in bulk, the Sell Feed API can be considered.

### VerifyAddFixedPriceItem -> createListing
Purpose:

- Validate a fixed-price listing creation request without committing the listing.

Modern API:

- GraphQL mutation `createListing` (Listing API) with `options.operationMode=VALIDATE`.

Key Differences:

- Verify calls map to the same mutation as execution, using `options.operationMode=VALIDATE`.
- Validation results are returned as `CreateListingValidationSuccess` (or a validation error type) rather than traditional-style `Fees`/`Errors` containers.

Request Payload Transformation:

- Traditional: [VerifyAddFixedPriceItem_example.md](operations/VerifyAddFixedPriceItem_example.md)
- Modern: [createListing_example.md](operations/createListing_example.md)




Response Payload Transformation:

- Traditional: [VerifyAddFixedPriceItem_example.md](operations/VerifyAddFixedPriceItem_example.md)
- Modern: [createListing_example.md](operations/createListing_example.md)



Response Payload Transformation:

- Traditional: [VerifyAddFixedPriceItem_example.md](operations/VerifyAddFixedPriceItem_example.md)
- Modern: [createListing_example.md](operations/createListing_example.md)



Related Patterns:

- [../rules/mode-verify-to-validate.md](../rules/mode-verify-to-validate.md)
- Full traditional doc extract: [operations/VerifyAddFixedPriceItem_doc.md](operations/VerifyAddFixedPriceItem_doc.md)
- Full traditional doc extract: [operations/VerifyAddItem_doc.md](operations/VerifyAddItem_doc.md)
- Full modern doc extract: [operations/createListing_doc.md](operations/createListing_doc.md)
- Full modern example: [operations/createListing_example.md](operations/createListing_example.md)

Migration Guide:

- **createListing** mutation of the **Listing API**
- Key things to know about `createListing` mutation:
  - The `marketplace` field is required to specify the listing marketplace.
  - The `listingFormat` field controls whether the listing will be an **auction**, **fixed price**, or **classified ad** listing.
  - The `listingDurationInDays` field controls the **duration** of the listing.
  - The `title` field sets the **title** of the listing.
  - The `description` field sets the **description** of the listing.
  - The `categories` object is used to provide the **primary listing category**, and optionally, the **secondary listing category**, **primary eBay store category** and **secondary eBay store category**.
  - The `imageUrls` array is used to provide one or more **images** for the listing.
  - The `itemCondition` object is used to set the **condition** of the item.
  - The `product.aspects` array is used to set the aspect name-value pairs (aka **item specifics**) for the product.
  - The `items` array is used to set the **price** and **quantity** of an item, as well as any Global Trade Item Numbers (**GTINs**) and/or an eBay Product ID (**ePID**) for a product. If any of these product IDs are input, eBay can attempt to match the product ID to an eBay catalog product and prefill the listing with the catalog product's details.
  - For a **multiple-SKU listing** (aka multiple-variation listing), each variation within the listing will be defined within the `items` array, and a `sku` value and the unique `traits` for each variation are required.
  - For a **multiple-SKU listing**, the `listingVariations` object is used to provide information on each unique variation within the listing.
  - The **location** of the item is specified through the `itemLocation` object.
  - For sellers opted into Business Policies, Payment, Shipping/Fulfillment, and Return Policy business policies must be used; payment fields are set through the `paymentTerms` object, shipping fields through the `shippingTerms` object, and return policy fields through the `returnTerms` object.
  - The `options` field can be used to validate the input without actually creating the listing. The `options` field is included and set to `VALIDATE` to run the operation in validation mode. This is an alternative to using the `VerifyAddFixedPriceItem` or `VerifyAddItem` calls.
- **Note**: Initially, the `createListing` mutation will only support the creation of one listing per operation. If you need the ability to create listings in bulk, the Sell Feed API can be considered.

### AddFixedPriceItem -> createListing
Purpose:

- Create one fixed-price listing.

Modern API:

- GraphQL mutation `createListing`

Key Differences:

- Traditional request structure is normalized into modern listing product, items, and terms objects.
- Fixed-price modern input uses explicit listing format and modern lifecycle terms.
- The migration guide notes that `createListing` initially supports one listing per operation, even though traditional had both single and batch create families.

Request Payload Transformation:

- Traditional: [AddFixedPriceItem_example.md](operations/AddFixedPriceItem_example.md)
- Modern: [createListing_example.md](operations/createListing_example.md)




Response Payload Transformation:

- Traditional: [AddFixedPriceItem_example.md](operations/AddFixedPriceItem_example.md)
- Modern: [createListing_example.md](operations/createListing_example.md)



Related Patterns:

- [operations/AddFixedPriceItem_doc.md](operations/AddFixedPriceItem_doc.md)
- [operations/createListing_example.md](operations/createListing_example.md)
- [../rules/variation-to-items.md](../rules/variation-to-items.md)

Migration Guide:

- **createListing** mutation of the **Listing API**
- Key things to know about `createListing` mutation:
  - The `marketplace` field is required to specify the listing marketplace.
  - The `listingFormat` field controls whether the listing will be an **auction**, **fixed price**, or **classified ad** listing.
  - The `listingDurationInDays` field controls the **duration** of the listing.
  - The `title` field sets the **title** of the listing.
  - The `description` field sets the **description** of the listing.
  - The `categories` object is used to provide the **primary listing category**, and optionally, the **secondary listing category**, **primary eBay store category** and **secondary eBay store category**.
  - The `imageUrls` array is used to provide one or more **images** for the listing.
  - The `itemCondition` object is used to set the **condition** of the item.
  - The `product.aspects` array is used to set the aspect name-value pairs (aka **item specifics**) for the product.
  - The `items` array is used to set the **price** and **quantity** of an item, as well as any Global Trade Item Numbers (**GTINs**) and/or an eBay Product ID (**ePID**) for a product. If any of these product IDs are input, eBay can attempt to match the product ID to an eBay catalog product and prefill the listing with the catalog product's details.
  - For a **multiple-SKU listing** (aka multiple-variation listing), each variation within the listing will be defined within the `items` array, and a `sku` value and the unique `traits` for each variation are required.
  - For a **multiple-SKU listing**, the `listingVariations` object is used to provide information on each unique variation within the listing.
  - The **location** of the item is specified through the `itemLocation` object.
  - For sellers opted into Business Policies, Payment, Shipping/Fulfillment, and Return Policy business policies must be used; payment fields are set through the `paymentTerms` object, shipping fields through the `shippingTerms` object, and return policy fields through the `returnTerms` object.
  - The `options` field can be used to validate the input without actually creating the listing. The `options` field is included and set to `VALIDATE` to run the operation in validation mode. This is an alternative to using the `VerifyAddFixedPriceItem` or `VerifyAddItem` calls.
- **Note**: Initially, the `createListing` mutation will only support the creation of one listing per operation. If you need the ability to create listings in bulk, the Sell Feed API can be considered.

### AddItem -> createListing
Purpose:

- Create one listing across supported listing formats.

Modern API:

- GraphQL mutation `createListing`

Key Differences:

- The modern mutation uses explicit listing format and marketplace fields instead of traditional-era request conventions.
- Title, description, categories, and condition move into the modern product shape.
- The migration guide notes that quantity, pricing, and any variation traits move under `listingItems.items`, while catalog identifiers stay with product or item product data.

Request Payload Transformation:

- Traditional: [AddItem_example.md](operations/AddItem_example.md)
- Modern: [createListing_example.md](operations/createListing_example.md)




Response Payload Transformation:

- Traditional: [AddItem_example.md](operations/AddItem_example.md)
- Modern: [createListing_example.md](operations/createListing_example.md)



Related Patterns:

- [operations/AddItem_doc.md](operations/AddItem_doc.md)
- [operations/createListing_doc.md](operations/createListing_doc.md)

Migration Guide:

- **createListing** mutation of the **Listing API**
- Key things to know about `createListing` mutation:
  - The `marketplace` field is required to specify the listing marketplace.
  - The `listingFormat` field controls whether the listing will be an **auction**, **fixed price**, or **classified ad** listing.
  - The `listingDurationInDays` field controls the **duration** of the listing.
  - The `title` field sets the **title** of the listing.
  - The `description` field sets the **description** of the listing.
  - The `categories` object is used to provide the **primary listing category**, and optionally, the **secondary listing category**, **primary eBay store category** and **secondary eBay store category**.
  - The `imageUrls` array is used to provide one or more **images** for the listing.
  - The `itemCondition` object is used to set the **condition** of the item.
  - The `product.aspects` array is used to set the aspect name-value pairs (aka **item specifics**) for the product.
  - The `items` array is used to set the **price** and **quantity** of an item, as well as any Global Trade Item Numbers (**GTINs**) and/or an eBay Product ID (**ePID**) for a product. If any of these product IDs are input, eBay can attempt to match the product ID to an eBay catalog product and prefill the listing with the catalog product's details.
  - For a **multiple-SKU listing** (aka multiple-variation listing), each variation within the listing will be defined within the `items` array, and a `sku` value and the unique `traits` for each variation are required.
  - For a **multiple-SKU listing**, the `listingVariations` object is used to provide information on each unique variation within the listing.
  - The **location** of the item is specified through the `itemLocation` object.
  - For sellers opted into Business Policies, Payment, Shipping/Fulfillment, and Return Policy business policies must be used; payment fields are set through the `paymentTerms` object, shipping fields through the `shippingTerms` object, and return policy fields through the `returnTerms` object.
  - The `options` field can be used to validate the input without actually creating the listing. The `options` field is included and set to `VALIDATE` to run the operation in validation mode. This is an alternative to using the `VerifyAddFixedPriceItem` or `VerifyAddItem` calls.
- **Note**: Initially, the `createListing` mutation will only support the creation of one listing per operation. If you need the ability to create listings in bulk, the Sell Feed API can be considered.

### AddItems -> createListing
Purpose:

- Create multiple listings in one traditional request.

Modern API:

- GraphQL mutation `createListing`, repeated once per listing.

Key Differences:

- Initial GraphQL support creates one listing per operation.
- Traditional batch create behavior does not have validated one-call parity in this package.
- The migration guide explicitly notes that `createListing` initially supports only one listing per operation.

Request Payload Transformation:

- Traditional: [AddItems_example.md](operations/AddItems_example.md)
- Modern: [createListing_example.md](operations/createListing_example.md)


**GraphQL (after, repeated once per listing):**

```graphql
mutation CreateListing($input: CreateListingInput!) {
  createListing(input: $input) {
    __typename
    ... on CreateListingSuccess {
      listing {
        listingId
      }
    }
  }
}
```


Response Payload Transformation:

- Traditional: [AddItems_example.md](operations/AddItems_example.md)
- Modern: [createListing_example.md](operations/createListing_example.md)



Related Patterns:

- [operations/AddItems_doc.md](operations/AddItems_doc.md)
- [operations/createListing_doc.md](operations/createListing_doc.md)

Migration Guide:

- **createListing** mutation of the **Listing API**
- Key things to know about `createListing` mutation:
  - The `marketplace` field is required to specify the listing marketplace.
  - The `listingFormat` field controls whether the listing will be an **auction**, **fixed price**, or **classified ad** listing.
  - The `listingDurationInDays` field controls the **duration** of the listing.
  - The `title` field sets the **title** of the listing.
  - The `description` field sets the **description** of the listing.
  - The `categories` object is used to provide the **primary listing category**, and optionally, the **secondary listing category**, **primary eBay store category** and **secondary eBay store category**.
  - The `imageUrls` array is used to provide one or more **images** for the listing.
  - The `itemCondition` object is used to set the **condition** of the item.
  - The `product.aspects` array is used to set the aspect name-value pairs (aka **item specifics**) for the product.
  - The `items` array is used to set the **price** and **quantity** of an item, as well as any Global Trade Item Numbers (**GTINs**) and/or an eBay Product ID (**ePID**) for a product. If any of these product IDs are input, eBay can attempt to match the product ID to an eBay catalog product and prefill the listing with the catalog product's details.
  - For a **multiple-SKU listing** (aka multiple-variation listing), each variation within the listing will be defined within the `items` array, and a `sku` value and the unique `traits` for each variation are required.
  - For a **multiple-SKU listing**, the `listingVariations` object is used to provide information on each unique variation within the listing.
  - The **location** of the item is specified through the `itemLocation` object.
  - For sellers opted into Business Policies, Payment, Shipping/Fulfillment, and Return Policy business policies must be used; payment fields are set through the `paymentTerms` object, shipping fields through the `shippingTerms` object, and return policy fields through the `returnTerms` object.
  - The `options` field can be used to validate the input without actually creating the listing. The `options` field is included and set to `VALIDATE` to run the operation in validation mode. This is an alternative to using the `VerifyAddFixedPriceItem` or `VerifyAddItem` calls.
- **Note**: Initially, the `createListing` mutation will only support the creation of one listing per operation. If you need the ability to create listings in bulk, the Sell Feed API can be considered.

## Revise, relist, and description fallback

### AddToItemDescription -> Fallback guidance via updateListing
Purpose:

- Append new text to an active listing description in the traditional flow.

Modern API:

- Fallback guidance through GraphQL mutation `updateListing`

Key Differences:

- The canonical inventory keeps this as no validated direct parity replacement.
- The modern mutation updates the listing description as a full field value instead of appending text to the existing description.
- You need to send the final description content you want stored on the listing.
- This package does not claim that traditional append-only behaviors such as an automatic separator or the 12-hour remaining-time rule carry forward to the modern mutation.

Request Payload Transformation:

- Traditional: [AddToItemDescription_example.md](operations/AddToItemDescription_example.md)
- Modern: [updateListing_example.md](operations/updateListing_example.md)




Response Payload Transformation:

- Traditional: [AddToItemDescription_example.md](operations/AddToItemDescription_example.md)
- Modern: [updateListing_example.md](operations/updateListing_example.md)



Related Patterns:

- [operations/AddToItemDescription_doc.md](operations/AddToItemDescription_doc.md)
- [operations/updateListing_doc.md](operations/updateListing_doc.md)

Migration Guide:

- **None**.
- The capability of the `AddToItemDescription` call to append text to the existing description is not being migrated, so there is no validated direct parity replacement. If the user still needs an approximation, replace the full text in the `description` field of the `updateListing` mutation instead of claiming append-only behavior.

### VerifyRelistItem -> relistListing
Purpose:

- Validate a relist request before execution.

Modern API:

- GraphQL mutation `relistListing`

Key Differences:

- Modern validation is handled through `options.operationMode=VALIDATE`.
- Unchanged product data and most listing terms carry over from the ended listing unless explicitly modified.

Request Payload Transformation:

- Traditional: [VerifyRelistItem_example.md](operations/VerifyRelistItem_example.md)
- Modern: [relistListing_example.md](operations/relistListing_example.md)




Response Payload Transformation:

- Traditional: [VerifyRelistItem_example.md](operations/VerifyRelistItem_example.md)
- Modern: [relistListing_example.md](operations/relistListing_example.md)



Related Patterns:

- [../rules/mode-verify-to-validate.md](../rules/mode-verify-to-validate.md)
- [../rules/full-replacement-arrays.md](../rules/full-replacement-arrays.md)
- [operations/VerifyRelistItem_doc.md](operations/VerifyRelistItem_doc.md)

Migration Guide:

- **relistListing** mutation of the **Listing API**
- Key things to know about `relistListing` mutation:
  - The `listingIdentifier` object is used to identify the listing to be relisted.
  - Only fields that are changing need to be included in the mutation.
  - For arrays in the mutation, a complete replacement is done, so all values and/or name value pairs must be included, and not just the ones that are being added or changed. An example of this would be the `imageUrls` array and the `product.aspects` array. Behavior can vary slightly based on the array, so be sure to check reference documentation to read about behavior of arrays.
  - To replicate the behavior of `VerifyRelistItem`, the `operationMode` field must be included and set to `VALIDATE`.

### RelistFixedPriceItem -> relistListing
Purpose:

- Relist a recently ended fixed-price listing.

Modern API:

- GraphQL mutation `relistListing`

Key Differences:

- Only changed fields need to be sent, but changed arrays must be restated in full.
- A successful relist still behaves like a new listing lifecycle event.

Request Payload Transformation:

- Traditional: [RelistFixedPriceItem_example.md](operations/RelistFixedPriceItem_example.md)
- Modern: [relistListing_example.md](operations/relistListing_example.md)




Response Payload Transformation:

- Traditional: [RelistFixedPriceItem_example.md](operations/RelistFixedPriceItem_example.md)
- Modern: [relistListing_example.md](operations/relistListing_example.md)



Related Patterns:

- [../rules/full-replacement-arrays.md](../rules/full-replacement-arrays.md)
- [../rules/listing-lifecycle-restrictions.md](../rules/listing-lifecycle-restrictions.md)
- [operations/RelistFixedPriceItem_doc.md](operations/RelistFixedPriceItem_doc.md)

Migration Guide:

- **relistListing** mutation of the **Listing API**
- Key things to know about `relistListing` mutation:
  - The `listingIdentifier` object is used to identify the listing to be relisted.
  - Only fields that are changing need to be included in the mutation.
  - For arrays in the mutation, a complete replacement is done, so all values and/or name value pairs must be included, and not just the ones that are being added or changed. An example of this would be the `imageUrls` array and the `product.aspects` array. Behavior can vary slightly based on the array, so be sure to check reference documentation to read about behavior of arrays.
  - To replicate the behavior of `VerifyRelistItem`, the `operationMode` field must be included and set to `VALIDATE`.

### RelistItem -> relistListing
Purpose:

- Relist a recently ended listing.

Modern API:

- GraphQL mutation `relistListing`

Key Differences:

- Relist flows converge on one mutation regardless of the specific traditional relist call family.
- Keep the answer on the `relistListing` path rather than drifting back to generic `createListing` guidance.
- Relisting can include modified listing content in the same request.

Request Payload Transformation:

- Traditional: [RelistItem_example.md](operations/RelistItem_example.md)
- Modern: [relistListing_example.md](operations/relistListing_example.md)




Response Payload Transformation:

- Traditional: [RelistItem_example.md](operations/RelistItem_example.md)
- Modern: [relistListing_example.md](operations/relistListing_example.md)



Related Patterns:

- [../rules/full-replacement-arrays.md](../rules/full-replacement-arrays.md)
- [operations/RelistItem_doc.md](operations/RelistItem_doc.md)
- [operations/relistListing_example.md](operations/relistListing_example.md)

Migration Guide:

- **relistListing** mutation of the **Listing API**
- Key things to know about `relistListing` mutation:
  - The `listingIdentifier` object is used to identify the listing to be relisted.
  - This remains a relist lifecycle call, not a generic create flow, even when you change fields during relisting.
  - Only fields that are changing need to be included in the mutation.
  - For arrays in the mutation, a complete replacement is done, so all values and/or name value pairs must be included, and not just the ones that are being added or changed. An example of this would be the `imageUrls` array and the `product.aspects` array. Behavior can vary slightly based on the array, so be sure to check reference documentation to read about behavior of arrays.
  - To replicate the behavior of `VerifyRelistItem`, the `operationMode` field must be included and set to `VALIDATE`.

### ReviseFixedPriceItem -> updateListing
Purpose:

- Revise an active fixed-price listing.

Modern API:

- GraphQL mutation `updateListing`

Key Differences:

- Use this path for broader fixed-price listing revision, not for price-and-quantity-only updates.
- `ReviseInventoryStatus` remains the dedicated `bulkUpdateInventory` path when the task is only price and quantity changes.
- Only changed fields need to be included at the top level.
- Arrays such as image URLs and aspects are complete replacements.

Request Payload Transformation:

- Traditional: [ReviseFixedPriceItem_example.md](operations/ReviseFixedPriceItem_example.md)
- Modern: [updateListing_example.md](operations/updateListing_example.md)




Response Payload Transformation:

- Traditional: [ReviseFixedPriceItem_example.md](operations/ReviseFixedPriceItem_example.md)
- Modern: [updateListing_example.md](operations/updateListing_example.md)



Related Patterns:

- [../rules/full-replacement-arrays.md](../rules/full-replacement-arrays.md)
- [operations/ReviseFixedPriceItem_doc.md](operations/ReviseFixedPriceItem_doc.md)
- [operations/updateListing_doc.md](operations/updateListing_doc.md)

Migration Guide:

- **updateListing** mutation of the **Listing API**
- Key things to know about `updateListing` mutation:
  - The `listingIdentifier` object is used to identify the listing to be updated.
  - This mutation is the correct target when the fixed-price revision is broader than the `ReviseInventoryStatus` price-and-quantity-only scope.
  - Only fields that are changing need to be included in the mutation.
  - For arrays in the mutation, a complete replacement is done, so all values and/or name value pairs must be included, and not just the ones that are being added or changed. An example of this would be the `imageUrls` array and the `product.aspects` array. Behavior can vary slightly based on the array, so be sure to check reference documentation to read about behavior of arrays.
  - Some changes to auction listings will not be allowed when the listing is scheduled to end within 12 hours, and some changes to fixed price listings are not allowed if that particular listing has already had one or more sales. The Revise a listing help topic is a very good resource to view these restrictions on revisions.

### ReviseItem -> updateListing
Purpose:

- Revise an active listing.

Modern API:

- GraphQL mutation `updateListing`

Key Differences:

- Listing identity moves into the modern identifier object.
- Traditional `DeletedField` patterns should be translated into explicit final-state payload design.

Request Payload Transformation:

- Traditional: [ReviseItem_example.md](operations/ReviseItem_example.md)
- Modern: [updateListing_example.md](operations/updateListing_example.md)




Response Payload Transformation:

- Traditional: [ReviseItem_example.md](operations/ReviseItem_example.md)
- Modern: [updateListing_example.md](operations/updateListing_example.md)



Related Patterns:

- [../rules/full-replacement-arrays.md](../rules/full-replacement-arrays.md)
- [operations/ReviseItem_doc.md](operations/ReviseItem_doc.md)
- [operations/updateListing_example.md](operations/updateListing_example.md)

Migration Guide:

- **updateListing** mutation of the **Listing API**
- Key things to know about `updateListing` mutation:
  - The `listingIdentifier` object is used to identify the listing to be updated.
  - Only fields that are changing need to be included in the mutation.
  - For arrays in the mutation, a complete replacement is done, so all values and/or name value pairs must be included, and not just the ones that are being added or changed. An example of this would be the `imageUrls` array and the `product.aspects` array. Behavior can vary slightly based on the array, so be sure to check reference documentation to read about behavior of arrays.
  - Some changes to auction listings will not be allowed when the listing is scheduled to end within 12 hours, and some changes to fixed price listings are not allowed if that particular listing has already had one or more sales. The Revise a listing help topic is a very good resource to view these restrictions on revisions.

### ReviseInventoryStatus -> bulkUpdateInventory
Purpose:

- Update price and quantity for active fixed-price listings with a focused inventory mutation.

Modern API:

- GraphQL mutation `bulkUpdateInventory`

Key Differences:

- The modern mapping is a dedicated inventory update path, not a general listing revision.
- This path is for price and quantity changes rather than broader content edits.

Request Payload Transformation:

- Traditional: [ReviseInventoryStatus_example.md](operations/ReviseInventoryStatus_example.md)
- Modern: [bulkUpdateInventory_example.md](operations/bulkUpdateInventory_example.md)




Response Payload Transformation:

- Traditional: [ReviseInventoryStatus_example.md](operations/ReviseInventoryStatus_example.md)
- Modern: [bulkUpdateInventory_example.md](operations/bulkUpdateInventory_example.md)



Related Patterns:

- [../rules/inventory-bulk-update.md](../rules/inventory-bulk-update.md)
- [operations/ReviseInventoryStatus_doc.md](operations/ReviseInventoryStatus_doc.md)
- [operations/bulkUpdateInventory_doc.md](operations/bulkUpdateInventory_doc.md)

Migration Guide:

- **bulkUpdateInventory** mutation of the **Listing API**
- Key things to know about `bulkUpdateInventory` mutation:
  - The price and/or quantity of up to four items in fixed price listings can be updated with this mutation.

## End listings

### EndFixedPriceItem -> endListing
Purpose:

- End a fixed-price listing.

Modern API:

- GraphQL mutation `endListing`

Key Differences:

- Traditional listing-type distinctions collapse into the same modern end mutation.
- The end reason remains a required business input.

Request Payload Transformation:

- Traditional: [EndFixedPriceItem_example.md](operations/EndFixedPriceItem_example.md)
- Modern: [endListing_example.md](operations/endListing_example.md)




Response Payload Transformation:

- Traditional: [EndFixedPriceItem_example.md](operations/EndFixedPriceItem_example.md)
- Modern: [endListing_example.md](operations/endListing_example.md)



Related Patterns:

- [../rules/field-end-listing.md](../rules/field-end-listing.md)
- [operations/EndFixedPriceItem_doc.md](operations/EndFixedPriceItem_doc.md)
- [operations/endListing_example.md](operations/endListing_example.md)

Migration Guide:

- **endListing** mutation of the **Listing API**
- Key things to know about `endListing` mutation:
  - The `listingIdentifier` object is used to identify the listing to end.
  - The reason why the seller is ending the listing should be provided in the `endListingReason` field.
- **Note**: Initially, the `endListing` mutation will only support the ending of one listing per operation. If you need the ability to end listings in bulk, the Sell Feed API can be considered. See the Ending listings in bulk using Sell Feed API section in the Listing Management Guide for more details on ending listings in bulk.

### EndItem -> endListing
Purpose:

- End a listing across supported listing types.

Modern API:

- GraphQL mutation `endListing`

Key Differences:

- Traditional request identifiers map into the modern listing identifier object.
- The modern mutation keeps the reason as structured input rather than a loose traditional field.

Request Payload Transformation:

- Traditional: [EndItem_example.md](operations/EndItem_example.md)
- Modern: [endListing_example.md](operations/endListing_example.md)




Response Payload Transformation:

- Traditional: [EndItem_example.md](operations/EndItem_example.md)
- Modern: [endListing_example.md](operations/endListing_example.md)



Related Patterns:

- [../rules/field-end-listing.md](../rules/field-end-listing.md)
- [operations/EndItem_doc.md](operations/EndItem_doc.md)
- [operations/endListing_doc.md](operations/endListing_doc.md)

Migration Guide:

- **endListing** mutation of the **Listing API**
- Key things to know about `endListing` mutation:
  - The `listingIdentifier` object is used to identify the listing to end.
  - The reason why the seller is ending the listing should be provided in the `endListingReason` field.
- **Note**: Initially, the `endListing` mutation will only support the ending of one listing per operation. If you need the ability to end listings in bulk, the Sell Feed API can be considered. See the Ending listings in bulk using Sell Feed API section in the Listing Management Guide for more details on ending listings in bulk.

### EndItems -> endListing
Purpose:

- End multiple listings in one traditional request.

Modern API:

- GraphQL mutation `endListing`, repeated once per listing.

Key Differences:

- The modern mapping does not validate a separate batch end mutation in this package.
- `endListing` initially supports ending one listing per operation, so bulk-ending requires orchestration or a Sell Feed API flow.
- Request batching and correlation move into orchestration code unless you adopt the Sell Feed API for bulk ending.

Request Payload Transformation:

- Traditional: [EndItems_example.md](operations/EndItems_example.md)
- Modern: [endListing_example.md](operations/endListing_example.md)


**GraphQL (after, repeated once per listing):**

```graphql
mutation EndListing($input: EndListingInput!) {
  endListing(input: $input) {
    listing {
      listingId
    }
  }
}
```


Response Payload Transformation:

- Traditional: [EndItems_example.md](operations/EndItems_example.md)
- Modern: [endListing_example.md](operations/endListing_example.md)



Related Patterns:

- [../rules/field-end-listing.md](../rules/field-end-listing.md)
- [operations/EndItems_doc.md](operations/EndItems_doc.md)
- [operations/endListing_example.md](operations/endListing_example.md)

Migration Guide:

- **endListing** mutation of the **Listing API**
- Key things to know about `endListing` mutation:
  - The `listingIdentifier` object is used to identify the listing to end.
  - The reason why the seller is ending the listing should be provided in the `endListingReason` field.
- **Note**: Initially, the `endListing` mutation will only support the ending of one listing per operation. If you need the ability to end listings in bulk, the Sell Feed API can be considered. See the Ending listings in bulk using Sell Feed API section in the Listing Management Guide for more details on ending listings in bulk.

## Seller retrieval and search

Shared GraphQL context:

- Required scope for seller retrieval and search: `https://api.ebay.com/oauth/api_scope/sell.listing.read`
- `sellerListings` is the direct one-list lookup query and takes `input: SellerListingsInput!`.
- `sellerListingSearch` is the documented top-level search query; state-specific criteria are applied on returned branches such as `activeListings(searchInput: ...)`, `endedListings(searchInput: ...)`, or `scheduledListings(searchInput: ...)`.

### GetItem -> sellerListings
Purpose:

- Retrieve one seller-controlled listing for inspection or post-create validation.

Modern API:

- GraphQL query `sellerListings`

Key Differences:

- The validated mapping is seller-side listing retrieval.
- Discovery APIs outside this Listing Management package are not included here.

Request Payload Transformation:

- Traditional: [GetItem_example.md](operations/GetItem_example.md)
- Modern: [sellerListingSearch_example.md](operations/sellerListingSearch_example.md), [sellerListings_example.md](operations/sellerListings_example.md)




Response Payload Transformation:

- Traditional: [GetItem_example.md](operations/GetItem_example.md)
- Modern: [sellerListingSearch_example.md](operations/sellerListingSearch_example.md), [sellerListings_example.md](operations/sellerListings_example.md)



Related Patterns:

- [operations/GetItem_doc.md](operations/GetItem_doc.md)
- [operations/sellerListings_doc.md](operations/sellerListings_doc.md)

Migration Guide:

- **sellerListings** query of the **Listing API**
- Key things to know about `sellerListings` query:
  - The `listingId` field is used to identify the listing to retrieve.
  - Initially, only one listing may be retrieved per operation.

### GetMyeBaySelling -> sellerListingSearch
Purpose:

- Retrieve the authenticated seller's active, sold, unsold, scheduled, and summary-oriented selling views.

Modern API:

- GraphQL query `sellerListingSearch`

Key Differences:

- My eBay-specific response buckets become modern active, ended, and scheduled listing search result groups.
- Modern search is filter-driven instead of using `ActiveList`, `SoldList`, `UnsoldList`, and `ScheduledList` include containers.
- The Listing API search is seller-authenticated and returns only the calling seller's listings.

Request Payload Transformation:

- Traditional: [GetMyeBaySelling_example.md](operations/GetMyeBaySelling_example.md)
- Modern: [sellerListingSearch_example.md](operations/sellerListingSearch_example.md)



Response Payload Transformation:

- Traditional: [GetMyeBaySelling_example.md](operations/GetMyeBaySelling_example.md)
- Modern: [sellerListingSearch_example.md](operations/sellerListingSearch_example.md)



Related Patterns:

- [operations/GetMyeBaySelling_doc.md](operations/GetMyeBaySelling_doc.md)
- [operations/sellerListingSearch_doc.md](operations/sellerListingSearch_doc.md)
- [operations/sellerListingSearch_example.md](operations/sellerListingSearch_example.md)

Migration Guide:

- **sellerListingSearch** query of the **Listing API**
- Key things to know about `sellerListingSearch` query:
  - Three different date range filters are available. Use `startAtRange` filter to search for listings that started within a date range, use `modifiedAtRange` filter to search for listings that were last modified within a date range, and use `endAtRange` filter to search for listings that were ended within a date range.
  - The `formatType` filter is used to retrieve only listings of a specific format.
  - The `primaryCategoryIds` array is used to retrieve only listings listed in one or more specific eBay categories.
  - The `listingIds` and `skus` arrays are used to retrieve one or more specific listings. If these filters are used, other filters should not be used.
  - Pagination and sort options are available.
  - In the response, listings that match the filter criteria are categorized into `activeListings`, `endedListings`, and `scheduledListings` arrays.

### GetSellerList -> sellerListingSearch
Purpose:

- Retrieve the authenticated seller's listings over a start-time or end-time range with optional category, SKU, variation, and pagination filters.

Modern API:

- GraphQL query `sellerListingSearch`

Key Differences:

- Required start-time or end-time ranges become modern search filter inputs instead of top-level SOAP request fields.
- Category, SKU, listing ID, pagination, and sort criteria become search input filters and pagination controls.
- The modern response groups results by active, ended, or scheduled status instead of returning one traditional `ItemArray` shape.

Request Payload Transformation:

- Traditional: [GetSellerList_example.md](operations/GetSellerList_example.md)
- Modern: [sellerListingSearch_example.md](operations/sellerListingSearch_example.md)



Response Payload Transformation:

- Traditional: [GetSellerList_example.md](operations/GetSellerList_example.md)
- Modern: [sellerListingSearch_example.md](operations/sellerListingSearch_example.md)



Related Patterns:

- [operations/GetSellerList_doc.md](operations/GetSellerList_doc.md)
- [operations/sellerListingSearch_doc.md](operations/sellerListingSearch_doc.md)
- [operations/sellerListingSearch_example.md](operations/sellerListingSearch_example.md)

Migration Guide:

- **sellerListingSearch** query of the **Listing API**
- Key things to know about `sellerListingSearch` query:
  - Three different date range filters are available. Use `startAtRange` filter to search for listings that started within a date range, use `modifiedAtRange` filter to search for listings that were last modified within a date range, and use `endAtRange` filter to search for listings that were ended within a date range.
  - The `formatType` filter is used to retrieve only listings of a specific format.
  - The `primaryCategoryIds` array is used to retrieve only listings listed in one or more specific eBay categories.
  - The `listingIds` and `skus` arrays are used to retrieve one or more specific listings. If these filters are used, other filters should not be used.
  - Pagination and sort options are available.
  - In the response, listings that match the filter criteria are categorized into `activeListings`, `endedListings`, and `scheduledListings` arrays.

### GetSellerEvents -> sellerListingSearch
Purpose:

- Retrieve seller listings that started, ended, or were modified within a recent time window.

Modern API:

- GraphQL query `sellerListingSearch`

Key Differences:

- Start, end, or modified time filters become distinct modern date-range filters instead of one traditional call surface.
- Event-oriented polling becomes modern filtered seller listing search rather than a dedicated event stream API.
- Modern search still returns grouped listing results rather than a generic event response container.
- The response shape is GraphQL search data with grouped `activeListings`, `endedListings`, and `scheduledListings` arrays plus pagination, not a traditional seller-event wrapper.

Request Payload Transformation:

- Traditional: [GetSellerEvents_example.md](operations/GetSellerEvents_example.md)
- Modern: [sellerListingSearch_example.md](operations/sellerListingSearch_example.md)



Response Payload Transformation:

- Traditional: [GetSellerEvents_example.md](operations/GetSellerEvents_example.md)
- Modern: [sellerListingSearch_example.md](operations/sellerListingSearch_example.md)



Related Patterns:

- [operations/GetSellerEvents_doc.md](operations/GetSellerEvents_doc.md)
- [operations/sellerListingSearch_doc.md](operations/sellerListingSearch_doc.md)
- [operations/sellerListingSearch_example.md](operations/sellerListingSearch_example.md)

Migration Guide:

- **sellerListingSearch** query of the **Listing API**
- Key things to know about `sellerListingSearch` query:
  - Three different date range filters are available. Use `startAtRange` filter to search for listings that started within a date range, use `modifiedAtRange` filter to search for listings that were last modified within a date range, and use `endAtRange` filter to search for listings that were ended within a date range.
  - The `formatType` filter is used to retrieve only listings of a specific format.
  - The `primaryCategoryIds` array is used to retrieve only listings listed in one or more specific eBay categories.
  - The `listingIds` and `skus` arrays are used to retrieve one or more specific listings. If these filters are used, other filters should not be used.
  - Pagination and sort options are available.
  - In the response, listings that match the filter criteria are categorized into `activeListings`, `endedListings`, and `scheduledListings` arrays.
  - Answer GetSellerEvents questions with that grouped sellerListingSearch response shape at a high level, including grouped arrays and pagination, instead of describing a traditional event container.

## Second-chance listings

### VerifyAddSecondChanceItem -> createSecondChanceListing
Purpose:

- Validate a second-chance listing offer before execution.

Modern API:

- GraphQL mutation `createSecondChanceListing`

Key Differences:

- Validation is handled with `options.operationMode=VALIDATE`.
- The modern payload centers on listing identity, recipient user, and listing terms.

Request Payload Transformation:

- Traditional: [VerifyAddSecondChanceItem_example.md](operations/VerifyAddSecondChanceItem_example.md)
- Modern: [createSecondChanceListing_example.md](operations/createSecondChanceListing_example.md)




Response Payload Transformation:

- Traditional: [VerifyAddSecondChanceItem_example.md](operations/VerifyAddSecondChanceItem_example.md)
- Modern: [createSecondChanceListing_example.md](operations/createSecondChanceListing_example.md)



Related Patterns:

- [../rules/mode-verify-to-validate.md](../rules/mode-verify-to-validate.md)
- [operations/VerifyAddSecondChanceItem_doc.md](operations/VerifyAddSecondChanceItem_doc.md)
- [operations/createSecondChanceListing_doc.md](operations/createSecondChanceListing_doc.md)

Migration Guide:

- **createSecondChanceListing** mutation of the **Listing API**
- Key things to know about `createSecondChanceListing` mutation:
  - The `listingIdentifier` object is used to identify the ended auction listing where the seller will propose a Second Chance Offer to a competitive bidder on that listing.
  - The price and duration is specified in the `listingTerms` object.
  - The user is identified through the `recipientUserId` field.
  - To replicate the behavior of `VerifyAddSecondChanceItem`, the `operationMode` field must be included and set to `VALIDATE`.

### AddSecondChanceItem -> createSecondChanceListing
Purpose:

- Create a Second Chance Offer listing for a bidder on an ended auction listing.

Modern API:

- GraphQL mutation `createSecondChanceListing`

Key Differences:

- The traditional flow converges on one GraphQL mutation.
- The primary modern inputs are listing identity, recipient user, duration, optional seller message, and optional fixed price.

Request Payload Transformation:

- Traditional: [AddSecondChanceItem_example.md](operations/AddSecondChanceItem_example.md)
- Modern: [createSecondChanceListing_example.md](operations/createSecondChanceListing_example.md)




Response Payload Transformation:

- Traditional: [AddSecondChanceItem_example.md](operations/AddSecondChanceItem_example.md)
- Modern: [createSecondChanceListing_example.md](operations/createSecondChanceListing_example.md)



Related Patterns:

- [operations/AddSecondChanceItem_doc.md](operations/AddSecondChanceItem_doc.md)
- [operations/createSecondChanceListing_example.md](operations/createSecondChanceListing_example.md)

Migration Guide:

- **createSecondChanceListing** mutation of the **Listing API**
- Key things to know about `createSecondChanceListing` mutation:
  - The `listingIdentifier` object is used to identify the ended auction listing where the seller will propose a Second Chance Offer to a competitive bidder on that listing.
  - The price and duration is specified in the `listingTerms` object.
  - The user is identified through the `recipientUserId` field.
  - To replicate the behavior of `VerifyAddSecondChanceItem`, the `operationMode` field must be included and set to `VALIDATE`.

## Residual and confirmation-required rows

### GetDescriptionTemplates -> No replacement
Purpose:

- Retrieve traditional Listing Designer layout and theme templates.

Modern API:

- Mentioned operation/endpoint either could be decommed or already migrated and available in REST(GQL) apis.

Key Differences:

- The bundled traditional doc and pilot guidance both indicate that Listing Designer templates are no longer supported.
- Do not manufacture a Metadata API or Listing API replacement for a removed presentation-layer capability.

Related Patterns:

- [operations/GetDescriptionTemplates_doc.md](operations/GetDescriptionTemplates_doc.md)

Migration Guide:

- **None**.
- This API retrieves a gallery of decorative Listing Designer templates created by eBay, but these are no longer supported.
