---
title: Catalog API
description: "The **Catalog API** allows users to search for and locate an eBay catalog product that is a direct match for the product that they wish to sell. Listing against an eBay catalog product helps insure that all listings (based off of that catalog product) have complete and accurate information. In addition to helping to create high-quality listings, another benefit to the seller of using catalog information to create listings is that much of the details of the listing will be prefilled, including the listing title, the listing description, the item specifics, and a stock image for the product (if available). Sellers will not have to enter item specifics themselves, and the overall listing process is a lot faster and easier."
api_version: v1_beta.5.3
api_name: catalog_api
api_type: REST
api_group: catalog/api
source_url:
  html: https://developer.ebay.com/develop/api/catalog/api
  md: https://developer.ebay.com/develop/api/catalog/api.md
---
# Catalog API API


## Types

### Aspect
**Description:** This type contains the name and values of a category aspect.
**Type:** object

**Properties:**
- **localizedName** (string)
  - The localized name of this category aspect.
- **localizedValues** (array)
  - A list of the localized values of this category aspect.

### AspectDistribution
**Description:** This type contains information about one category aspect that is associated with a specified category.
**Type:** object

**Properties:**
- **aspectValueDistributions** (array)
  - Contains information about one or more values of the category aspect identified by **localizedAspectName**.
- **localizedAspectName** (string)
  - The localized name of an aspect that is associated with the category identified by **dominantCategoryId**.

### AspectValueDistribution
**Description:** This type contains information about one value of a specified aspect. This value serves as a product refinement.
**Type:** object

**Properties:**
- **localizedAspectValue** (string)
  - The localized value of the category aspect identified by **refinement.aspectDistributions.localizedAspectName**.
- **matchCount** (integer)
  - The number of times the value of **localizedAspectValue** has been used for eBay product listings. By comparing this quantity to the **matchCount** for other values of the same aspect, you can present a histogram of the values to sellers, who can use that information to select which aspect value is most appropriate for their product. You can then include the user-selected value in the the **search** call's **aspect\_filter** parameter to refine your search.
- **refinementHref** (string)
  - A HATEOAS reference that further refines the search with this particular **localizedAspectValue**.

### Image
**Description:** This type contains information about a product image stored in eBay Picture Services (EPS).
**Type:** object

**Properties:**
- **height** (integer)
  - The height of the image in pixels.
- **imageUrl** (string)
  - The eBay Picture Services (EPS) URL of the image.
- **width** (integer)
  - The width of the image in pixels.

### Product
**Description:** This type contains the full details of a specified product, including information about the product's identifiers, product images, aspects, and categories.
**Type:** object

**Properties:**
- **additionalImages** (array)
  - Contains information about additional images associated with this product. For the primary image, see the **image** container.
- **aspects** (array)
  - Contains an array of the category aspects and their values that are associated with this product.
- **brand** (string)
  - The manufacturer's brand name for this product.
- **compatibilityCount** (integer)
  - The number of distinct motor vehicles that are compatible with the product.  
  
This field is only applicable for and will only be returned for Parts & Accessory products on the eBay US Motors marketplace.
- **description** (string)
  - The rich description of this product, which might contain HTML.
- **ean** (array)
  - A list of all European Article Numbers (EANs) that identify this product.
- **epid** (string)
  - The eBay product ID of this product.
- **gtin** (array)
  - A list of all GTINs that identify this product. Currently this can include EAN, ISBN, and UPC identifier types.
- **image** (Image)
  - Contains information about the primary image of this product. For more images of this product, see the **additionalImages** container.
- **isbn** (array)
  - A list of all International Standard Book Numbers (ISBNs) that identify this product.
- **mpn** (array)
  - A list of all MPN values that the manufacturer uses to identify this product.
- **otherApplicableCategoryIds** (array)
  - A list of category IDs (other than the value of **primaryCategoryId**) for all the leaf categories to which this product might belong.
- **primaryCategoryId** (string)
  - The identifier of the leaf category that eBay recommends using to list this product, based on previous listings of similar products. Products in the eBay catalog are not automatically associated with any particular category, but using an inappropriate category can make it difficult for prospective buyers to find the product. For other possible categories that might be used, see **otherApplicableCategoryIds**.
- **productWebUrl** (string)
  - The URL for this product's eBay product page.
- **title** (string)
  - The title of this product on eBay.
- **upc** (array)
  - A list of Universal Product Codes (UPCs) that identify this product.
- **version** (string)
  - The current version number of this product record in the catalog.

### ProductSearchResponse
**Description:** This type contains the specifications for the collection of products that match the search or filter criteria of a **search** call. A maximum of 200 product summaries is returned (the result set), fewer if you include the **limit** query parameter in the request.
**Type:** object

**Properties:**
- **href** (string)
  - This field is reserved for internal or future use.
- **limit** (integer)
  - The number of product summaries returned in the response. This is the _result set_, a subset of the full collection of products that match the search or filter criteria of this call. If the **limit** query parameter was included in the request, this field will have the same value.  
  
**Default:** `50`
- **next** (string)
  - This field is reserved for internal or future use.
- **offset** (integer)
  - This field is reserved for internal or future use.
- **prev** (string)
  - This field is reserved for internal or future use.
- **productSummaries** (array)
  - _Returned if_ the **fieldGroups** query parameter was omitted from the request, or if it was included with a value of `MATCHING_PRODUCTS` or `FULL`. This container provides an array of product summaries in the current result set for products that match the combination of the **q**, **category\_ids**, and **aspect\_filter** parameters that were provided in the request. Each product summary includes information about the product's identifiers, product images, aspects, the product page URL, and the **getProduct** URL for retrieving the product details.
- **refinement** (Refinement)
  - _Returned only if_ the **fieldGroups** query parameter was included in the request with a value of `ASPECT_REFINEMENTS` or `FULL`.  
  
An aspect is a property of a category, used by sellers to provide details about the items they're listing. For example, the _Cell Phones & Smartphones_ category (#9355) includes a _Storage Capacity_ aspect.  
  
This container provides information about the distribution of values of a set of category aspects. The category aspects are those associated with the category that eBay determines is most likely to cover the products that match the search criteria.
- **total** (integer)
  - This field is reserved for internal or future use.

### ProductSummary
**Description:** This type contains a summary of a specified product. The product summary includes information about the product's identifiers, product images, aspects, and the **getProduct** URL for retrieving the product details.
**Type:** object

**Properties:**
- **additionalImages** (array)
  - Contains information about additional images associated with this product. For the primary image, see the **image** container.
- **aspects** (array)
  - Contains an array of the category aspects and their values that are associated with this product.
- **brand** (string)
  - The manufacturer's brand name for this product.
- **ean** (array)
  - A list of all European Article Numbers (EANs) that identify this product.
- **epid** (string)
  - The eBay product ID of this product.
- **gtin** (array)
  - A list of all GTINs that identify this product. This includes all of the values returned in the **ean**, **isbn**, and **upc** fields.
- **image** (Image)
  - Contains information about the primary image of this product. For more images of this product, see the **additionalImages** container.
- **isbn** (array)
  - A list of all International Standard Book Numbers (ISBNs) that identify this product.
- **mpn** (array)
  - A list of all Manufacturer Product Number (MPN) values that the manufacturer uses to identify this product.
- **productHref** (string)
  - The URI of the **getProduct** call request that retrieves this product's details.
- **productWebUrl** (string)
  - The URL for this product's eBay product page.
- **title** (string)
  - The title of this product on eBay.
- **upc** (array)
  - A list of Universal Product Codes (UPCs) that identify this product.

### Refinement
**Description:** This type identifies a product category and the aspects associated with that category. Each aspect distribution container returns the distribution of values that have been used for the aspect.
**Type:** object

**Properties:**
- **aspectDistributions** (array)
  - Contains information about one or more aspects that are associated with the category identified by **dominantCategoryId**.
- **dominantCategoryId** (string)
  - The ID of the category that eBay determines is most likely to cover the products matching the search criteria.

## Rate Limits

See [API Call Limits](https://developer.ebay.com/develop/get-started/api-call-limits) on the eBay Developer Program.

## Resources

### Documentation

- [eBay Developer Program](https://developer.ebay.com/)
- [API Documentation](https://developer.ebay.com/develop/api/)
- [SDKs and Widgets](https://developer.ebay.com/develop/sdks-and-widgets)
- [Developer Community Forum](https://community.ebay.com/t5/Developer-Groups/ct-p/developergroup)

### Tools

- [API Explorer](https://developer.ebay.com/my/api_test_tool)
- [GraphQL Explorer](https://developer.ebay.com/my/graphql_explorer)

### Support

- [Developer Support](https://developer.ebay.com/support/)
- [API Status](https://developer.ebay.com/support/api-status)
- [Release Notes](https://developer.ebay.com/develop/api/release_notes/)

---
*Generated on 2026-04-10T13:41:02.009Z*
