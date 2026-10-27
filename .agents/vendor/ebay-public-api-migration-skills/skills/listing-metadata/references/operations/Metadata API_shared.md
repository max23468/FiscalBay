---
title: Metadata API
description: "The **Metadata API** lets you retrieve metadata on eBay category policies, information on sales tax jurisdictions, and available hazardous material related label information. _Category policies_ are the eBay policies and guidelines for how you must list certain items in specific categories across the different eBay marketplaces. For example, if you are listing items with variations, you'll want to know which categories support multiple-variation listings. Another example is that you may want to know which item conditions are supported for different eBay categories. See [Finding the correct category ID and item condition for your item](/api-docs/sell/static/metadata/getting-metadata.html#s0-1-31-4-7-5-content) [](/api-docs/sell/metadata/overview.html#policies)for more information. Several countries have _sales tax jurisdictions_ where the tax rates across the different jurisdictions may vary. You can use the Metadata API to retrieve the lists of tax jurisdictions which you can then use to set up sales tax tables. See [Getting a list of tax jurisdictions](/api-docs/sell/static/metadata/getting-metadata.html#jurisdictions) for more information. Sellers have the ability to add _hazardous material related label_ information to their listings. See [Specifying hazardous material related information](/api-docs/sell/static/metadata/feature-regulatorhazmatcontainer.html) for more information."
api_version: v1.13.0
api_name: metadata_api
api_type: REST
api_group: metadata/api
source_url:
  html: https://developer.ebay.com/develop/api/metadata/api
  md: https://developer.ebay.com/develop/api/metadata/api.md
---
# Metadata API API


## Types

### AdFormatEnabledEnum
**Description:** This enumerated type contains a list of values indicating type or status of available ad formats for an eBay site or for an eBay category. | - **DISABLED**: This value indicates that the Classified Ad format feature is disabled for the site or category. - **ENABLED**: This value indicates that the Classified Ad format feature is enabled for the site or category. - **ONLY**: This value indicates that the Classified Ad format is the only listing type supported by the eBay category. This value is not applicable at the eBay site level. - **CLASSIFIED_AD_ENABLED**: This value indicates that the lead-generation Classified Ad format is the only listing type supported by the eBay category. This value is not applicable at the eBay site level. - **CLASSIFIED_AD_ONLY**: This value indicates that the lead-generation Classified Ad format is the only listing type supported by the eBay category. This value is not applicable at the eBay site level. - **LOCAL_MARKET_BEST_OFFER_ONLY**: This value indicates that eBay Motors Local Market listings are enabled for the site or category.
**Type:** object

### Amount
**Description:** The type that defines the fields for the currency and a monetary amount.
**Type:** object

**Properties:**
- **currency** (CurrencyCodeEnum)
  - The three-letter [ISO 4217](https://www.iso.org/iso-4217-currency-codes.html ) code representing the currency of the amount in the **value** field.  
  
**Restriction:** Only the currency of the marketplace is supported. For example, on the US marketplace the only currency supported is USD.
- **value** (string)
  - The monetary amount, in the currency specified by the **currency** field.

### AutomotivePartsCompatibilityPolicy
**Description:** This type contains applicable compatibility policy metadata for the leaf categories returned for the marketplace.
**Type:** object

**Properties:**
- **categoryId** (string)
  - The category ID to which the automotive parts compatibility policies apply.
- **categoryTreeId** (string)
  - A value that indicates the root node of the category tree used for the response set. Each marketplace is based on a category tree whose root node is indicated by this unique category ID value. All category policy information returned by this call pertains to the categories included below this root node of the tree.  
  
A _category tree_ is a hierarchical framework of eBay categories that begins at the root node of the tree and extends to include all the child nodes in the tree. Each child node in the tree is an eBay category that is represented by a unique **categoryId** value. Within a category tree, the root node has no parent node and _leaf nodes_ are nodes that have no child nodes.
- **compatibilityBasedOn** (CompatibilityTypeEnum)
  - Indicates whether the category supports parts compatibility by either `ASSEMBLY` or by `SPECIFICATION`.  
  
**Note:** Only categories returning the **compatibilityBasedOn** field support compatibility. Categories where all compatibility fields are missing, or where only **compatibilityBasedOn** is missing, should be considered as not supporting compatibility.
- **compatibleVehicleTypes** (array)
  - Indicates the compatibility classification of the part based on high-level vehicle types.
- **maxNumberOfCompatibleVehicles** (integer)
  - Specifies the maximum number of compatible vehicle-applications allowed per item.

### AutomotivePartsCompatibilityPolicyResponse
**Description:** The base response type of the **AutomotivePartsCompatibilityPolicy** method.
**Type:** object

**Properties:**
- **automotivePartsCompatibilityPolicies** (array)
  - A list of category IDs and the automotive parts compatibility policies for each of the listed categories.
- **warnings** (array)
  - A list of the warnings that were generated as a result of the request. This field is not returned if no warnings were generated by the request.

### CardinalityEnum
**Description:** This enumeration type is used to indicate whether a condition descriptor can have just a single value or multiple values. | - **SINGLE**: This enumeration value indicates that only a single value can be used for the condition descriptor. - **MULTI**: This enumeration value indicates that multiple values can be used for the condition descriptor.
**Type:** object

### CategoryPolicy
**Description:** This type contains applicable policy metadata for the leaf categories returned for the marketplace.
**Type:** object

**Properties:**
- **autoPayEnabled** (boolean)
  - If this field is returned as `true`, the corresponding category supports immediate payment for listings. The immediate payment feature is applicable to fixed-price listings, to auction listings with the 'Buy It Now' option enabled, and for a motor vehicle listing that requires an initial deposit. If the immediate payment feature is enabled for a listing, the buyer must pay immediately after clicking the 'Buy it Now' button.

This field is only returned when `true` (not returned when false).
- **b2bVatEnabled** (boolean)
  - If this field is returned as `true`, the corresponding category supports business-to-business (B2B) VAT listings. If this field is not present, the category does not have B2B VAT listings. This feature is applicable to the eBay Germany (DE), Austria (AT), and Switzerland (CH) sites only.

This field is only returned when `true` (not returned when false).
- **categoryId** (string)
  - The unique identifier of the eBay leaf category for which metadata is being returned.
- **categoryTreeId** (string)
  - The unique identifier of the category tree.
- **eanSupport** (ProductIdentiferEnabledEnum)
  - This enumerated value indicates whether or not European Article Numbers (EANs) are supported/required when listing products in the category.
- **expired** (boolean)
  - If this field is returned as `true`, the corresponding category is no longer a valid eBay category on the site, and items may not be listed in this category. You can use the [getExpiredCategories](/api-docs/sell/taxonomy/resources/category_tree/methods/getExpiredCategories) method (of the **Taxonomy API**) to find the leaf category that replaced the expired category.

This field is only returned when `true` (not returned when false).
- **intangibleEnabled** (boolean)
  - If this field is returned as `true`, the category supports the listing of intangible goods or services.
- **isbnSupport** (ProductIdentiferEnabledEnum)
  - This enumerated value indicates whether or not International Standard Book Numbers (ISBNs) are supported/required when listing products in the specified category.
- **lsd** (boolean)
  - If this field (Lot Size Disabled) is returned as `true`, the corresponding category does not support lot listings. A lot listing is a listing that features multiple related items that must be purchased by one buyer in one transaction.

This field is only returned when `true` (not returned when false).
- **minimumReservePrice** (number)
  - Indicates the Minimum Reserve Price for an auction listing in this category. If there is no Minimum Reserve Price, a value of `0.0` is returned in this field.
- **orpa** (boolean)
  - This field (Override Reserve Price Allowed) is returned as `true` if the eBay marketplace's default policy is to allow reserve prices for auction listings, but the corresponding category does not allow a reserve price.

**Note:** This field is not returned if the marketplace does not permit reserve prices.
- **orra** (boolean)
  - If this field (Override Reduce Reserve Allowed) is returned as `true`, the seller can reduce or remove a reserve price that had already been reduced for an active auction listing.
- **paymentMethods** (array)
  - An array that indicates the acceptable offline payment methods that can be used when listing an item for sale in the corresponding category.
- **reduceReserveAllowed** (boolean)
  - If this field (Reduce Reserve Allowed) is `true`, the corresponding leaf category allows the seller to reduce an item's reserve price. If false, this field is not returned in the response and the corresponding leaf category on the site do not normally allow sellers to reduce an item's reserve price.

This field is only returned when `true` (not returned when false).
- **reservePriceAllowed** (boolean)
  - This field indicates whether reserve prices are allowed for auction listings in this category. This field returns as `true` when the category supports reserve prices, or `false` if the eBay marketplace does not permit reserve prices or the category override blocks reserve prices (**orpa** is `true`).
- **upcSupport** (ProductIdentiferEnabledEnum)
  - This enumerated value indicates whether or not the category on the specified eBay site supports the use of Universal Product Codes (UPCs) to help create a listing.
- **valueCategory** (boolean)
  - When returned as `true`, this boolean indicates that the leaf category for the specified site is designated by eBay as a value category. Value categories can be used as a secondary category for a listing at no extra charge.
- **virtual** (boolean)
  - If this field is returned as `true`, the corresponding category is an eBay virtual category, a category in which items may not be listed.

This field is only returned when `true` (not returned when false).

### CategoryPolicyResponse
**Description:** This type contains applicable policy metadata for the leaf categories returned for the marketplace.
**Type:** object

**Properties:**
- **categoryPolicies** (array)
  - This array contains applicable policy metadata for the leaf categories returned for the marketplace specified in the path parameter **marketplace\_id** and optionally limited by only those leaf category IDs specified in the query parameter **filter**.
- **warnings** (array)
  - An array of the warnings that were generated as a result of the request. This field is not returned if no warnings were generated by the request.

### ClassifiedAdBestOfferEnabledEnum
**Description:** This enumerated type defines values that indicate whether the category supports Classified Ad Best Offers. | - **DISABLED**: This value indicates that Classified Ad Best Offer feature is disabled for most categories. - **ENABLED**: This value indicates that Classified Ad Best Offer feature is enabled for most categories. - **REQUIRED**: This value indicates that Classified Ad Best Offer feature is required for a specific category.
**Type:** object

### ClassifiedAdPaymentMethodEnabledEnum
**Description:** This enumerated type defines values that indicate whether the payment method will be displayed for a category. | - **ENABLED_WITH_CHECKOUT**: This value indicates display of the payment method and permits checkout. - **ENABLED_WITHOUT_CHECKOUT**: This value indicates display of the payment method and suppresses checkout. - **NOT_SUPPORTED**: This value indicates the payment method is not displayed.
**Type:** object

### ClassifiedAdPolicy
**Description:** This type provides fields that contain applicable Classified Ad policy metadata for the leaf categories returned for the marketplace.
**Type:** object

**Properties:**
- **adFormatEnabled** (AdFormatEnabledEnum)
  - This enumerated value indicates the type or status of available Classified Ad formats for this category.
- **categoryId** (string)
  - The unique identifier of the eBay leaf category for which metadata is being returned.
- **categoryTreeId** (string)
  - The unique identifier of the category tree.
- **classifiedAdAutoAcceptEnabled** (boolean)
  - Indicates whether the category supports the Best Offer Automatic Accept feature for Classified Ad listings.
- **classifiedAdAutoDeclineEnabled** (boolean)
  - Indicates whether the category supports the Best Offer Automatic Reject feature for Classified Ad listings.
- **classifiedAdBestOfferEnabled** (ClassifiedAdBestOfferEnabledEnum)
  - This enumerated value indicates if Best Offer is enabled, disabled, or required for Classified Ad listings in this category.
- **classifiedAdCompanyNameEnabled** (boolean)
  - Indicates whether this category supports including a company name in the seller's contact information. This element is for **For Sale By Owner** listings.
- **classifiedAdContactByAddressEnabled** (boolean)
  - Indicates whether this category supports including an address in the seller's contact information. This element is for **For Sale By Owner** listings.
- **classifiedAdContactByEmailEnabled** (boolean)
  - Indicates whether most categories support including an email address in the seller's contact information.
- **classifiedAdContactByPhoneEnabled** (boolean)
  - Indicates whether most categories support including a phone number in the seller's contact information.
- **classifiedAdCounterOfferEnabled** (boolean)
  - Indicates whether counter offers are allowed on Best offers for the category.
- **classifiedAdPaymentMethodEnabled** (ClassifiedAdPaymentMethodEnabledEnum)
  - This enumerated value indicates support for the payment method being displayed to the user for the category. Even if enabled, checkout may or may not be enabled.
- **classifiedAdPhoneCount** (integer)
  - Indicates how many contact phone numbers can be specified in contact information for the category. This element is for **For Sale By Owner** listings.
- **classifiedAdShippingMethodEnabled** (boolean)
  - Indicates if shipping methods can be specified and displayed in the **View Item** page for the category.
- **classifiedAdStreetCount** (integer)
  - Indicates how many street addresses can be specified in contact information for the category. This element is for **For Sale By Owner** listings.
- **sellerContactDetailsEnabled** (boolean)
  - Indicates whether this category supports seller-level contact information for Classified Ad listings.

### ClassifiedAdPolicyResponse
**Description:** This type contains applicable policy metadata for the leaf categories returned for the marketplace.
**Type:** object

**Properties:**
- **classifiedAdPolicies** (array)
  - This array contains applicable policy metadata for the leaf categories returned for the marketplace specified in the path parameter **marketplace\_id** and optionally limited by only those leaf category IDs specified in the query parameter **filter**.
- **warnings** (array)
  - An array of the warnings that were generated as a result of the request. This field is not returned if no warnings were generated by the request.

### Compatibility
**Description:** This type defines the property names and values that are compatible with the property name values specified in the request.
**Type:** object

**Properties:**
- **compatibilityDetails** (array)
  - This array returns a list of compatibility details associated with the specified property name(s).

### CompatibilityDetails
**Description:** This type defines the compatible property names and values associated with the product.
**Type:** object

**Properties:**
- **propertyName** (string)
  - The name of the property being described.
- **propertyValue** (string)
  - The value for the property specified in the **propertyName** field.

### CompatibilityTypeEnum
**Description:** This enumerated type defines how the compatibility details are listed on the specified category. | - **SPECIFICATIONS**: The compatibility details are listed by the specifications of the part. For example, dimensions or other defining characteristics of the part. - **ASSEMBLY**: The compatibility details are listed by by the vehicle assembly information, such as make, model, year of production, and so on.
**Type:** object

### Currency
**Description:** The type defining valid currencies for the marketplace.
**Type:** object

**Properties:**
- **code** (CurrencyCodeEnum)
  - The three-letter [ISO 4217](https://www.iso.org/iso-4217-currency-codes.html ) code returned.  
  
**Restriction:** Only the currency of the marketplace is supported. Examples: on the US marketplace, the only currency supported is the United States dollar, `USD`; on the Canadian marketplace, the only currency supported is the Canadian dollar, `CAD`.
- **description** (string)
  - The description of the returned three-letter code. For example, if the code is `USD`, the description returned would be `US Dollar`.

### CurrencyCodeEnum
**Description:** The three-letter [ISO 4217](https://www.iso.org/iso-4217-currency-codes.html ) code representing a world currency. | - **AED**: United Arab Emirates dirham - **AFN**: Afghan afghani - **ALL**: Albanian lek - **AMD**: Armenian dram - **AOA**: Angolan kwanza - **ARS**: Argentine peso - **AWG**: Aruban florin - **AZN**: Azerbaijani manat - **BAM**: Bosnia and Herzegovina convertible mark - **BBD**: Barbados dollar - **BDT**: Bangladeshi taka - **BGN**: Bulgarian lev - **BHD**: Bahraini dinar - **BIF**: Burundian franc - **BMD**: Bermudian dollar - **BND**: Brunei dollar - **BOB**: Bolivian Boliviano - **BRL**: Brazilian real - **BSD**: Bahamian dollar - **BTN**: Bhutanese ngultrum - **BWP**: Botswana pula - **BYR**: Belarusian ruble - **BZD**: Belize dollar - **CAD**: Canadian dollar - **CDF**: Congolese franc - **CLP**: Chilean peso - **CNY**: Chinese yuan renminbi - **COP**: Colombian peso - **CRC**: Costa Rican colon - **CUP**: Cuban peso - **CVE**: Cape Verde escudo - **CZK**: Czech koruna - **DJF**: Djiboutian franc - **DOP**: Dominican peso - **DZD**: Algerian dinar - **EGP**: Egyptian pound - **ERN**: Eritrean nakfa - **ETB**: Ethiopian birr - **FJD**: Fiji dollar - **FKP**: Falkland Islands pound - **GEL**: Georgian lari - **GHS**: Ghanaian cedi - **GIP**: Gibraltar pound - **DKK**: Danish krone - **GMD**: Gambian dalasi - **GNF**: Guinean franc - **GTQ**: Guatemalan quetzal - **GYD**: Guyanese dollar - **HKD**: Hong Kong dollar - **HNL**: Honduran lempira - **HRK**: Croatian kuna - **HTG**: Haitian gourde - **HUF**: Hungarian forint - **IDR**: Indonesian rupiah - **INR**: Indian rupee - **IQD**: Iraqi dinar - **IRR**: Iranian rial - **ISK**: Icelandic krona - **GBP**: British pound sterling - **JMD**: Jamaican dollar - **JOD**: Jordanian dinar - **JPY**: Japanese yen - **KES**: Kenyan shilling - **KGS**: Kyrgyzstani som - **KHR**: Cambodian riel - **KMF**: Comoro franc - **KPW**: North Korean won - **KRW**: South Korean won - **KWD**: Kuwaiti dinar - **KYD**: Cayman Islands dollar - **KZT**: Kazakhstani tenge - **LAK**: Lao kip - **LBP**: Lebanese pound - **CHF**: Swiss franc - **LKR**: Sri Lankan rupee - **LRD**: Liberian dollar - **LSL**: Lesotho loti - **LTL**: Lithuanian litas - **LYD**: Libyan dinar - **MAD**: Moroccan dirham - **MDL**: Moldovan leu - **MGA**: Malagasy ariary - **MKD**: Macedonian denar - **MMK**: Myanmar kyat - **MNT**: Mongolian tugrik - **MOP**: Macanese pataca - **MRO**: Mauritanian ouguiya - **XCD**: East Caribbean dollar - **MUR**: Mauritian rupee - **MVR**: Maldivian rufiyaa - **MWK**: Malawian kwacha - **MXN**: Mexican peso - **MYR**: Malaysian ringgit - **MZN**: Mozambican metical - **NAD**: Namibian dollar - **NGN**: Nigerian naira - **NIO**: Nicaraguan cordoba oro - **NPR**: Nepalese rupee - **OMR**: Omani rial - **PAB**: Panamanian balboa - **PEN**: Peruvian sol - **XPF**: CFP franc - **PGK**: Papua New Guinean kina - **PHP**: Philippine peso - **PKR**: Pakistani rupee - **PLN**: Polish zloty - **ILS**: Israeli new shekel - **PYG**: Paraguayan guarani - **QAR**: Qatari riyal - **RON**: Romanian leu - **RSD**: Serbian dinar - **RUB**: Russian ruble - **RWF**: Rwandan franc - **SAR**: Saudi riyal - **SBD**: Solomon Islands dollar - **SCR**: Seychelles rupee - **SDG**: Sudanese pound - **SEK**: Swedish krona - **SGD**: Singapore dollar - **SHP**: Saint Helena pound - **NOK**: Norwegian krone - **SLL**: Sierra Leonean leone - **SOS**: Somali shilling - **SRD**: Surinamese dollar - **STD**: Sao Tome and Principe dobra - **ANG**: Netherlands Antillean guilder - **SYP**: Syrian pound - **SZL**: Swazi lilangeni - **XAF**: CFA franc BEAC - **XOF**: CFA franc BCEAO - **THB**: Thai baht - **TJS**: Tajikistani somoni - **NZD**: New Zealand dollar - **TMT**: Turkmenistani manat - **TND**: Tunisian dinar - **TOP**: Tongan pa'anga - **TRY**: Turkish lira - **TTD**: Trinidad and Tobago dollar - **AUD**: Australian dollar - **TWD**: New Taiwan dollar - **TZS**: Tanzanian shilling - **UAH**: Ukrainian hryvnia - **UGX**: Ugandan shilling - **USD**: United States dollar - **UYU**: Uruguayan peso - **UZS**: Uzbekistani som - **VEF**: Venezuelan bolivar - **VND**: Vietnamese dong - **VUV**: Vanuatu vatu - **WST**: Samoan tala - **YER**: Yemeni rial - **EUR**: European Union euro - **ZAR**: South African rand - **ZMW**: Zambian kwacha - **ZWL**: Zimbabwean dollar
**Type:** object

### DescriptorUsageEnum
**Description:** This enumeration type indicates if there are any usage restrictions for the corresponding condition descriptor in the corresponding category. Currently, the only supported value is `REQUIRED`. | - **REQUIRED**: This value indicates that the usage of the condition descriptor in the corresponding category is required.
**Type:** object

### DisabledProductFilter
**Description:** This type defines the booleans used to determine if a product is excluded from eBay selling and/or review.
**Type:** object

**Properties:**
- **excludeForEbayReviews** (boolean)
  - Specifies whether to filter out products excluded for eBay reviews.  
  
If set to `true`, items excluded from eBay reviews are not returned.
- **excludeForEbaySelling** (boolean)
  - Specifies whether to filter out products excluded for eBay selling.  
  
If set to `true`, items excluded from eBay selling are not returned.

### DistanceType
**Description:** This enumeration type indicates support of local listing distances for items listed by sellers. | - **LOCAL_LISTING_DISTANCES_REGULAR**: Indicates that one or more eBay marketplaces allow dealership subscribers with a regular subscription to specify local market radius for Motors Local Market listings. - **LOCAL_LISTING_DISTANCES_SPECIALTY**: Indicates that one or more eBay marketplaces allow dealership subscribers with a specialty subscription to specify local market radius for Motors Local Market listings. - **LOCAL_LISTING_DISTANCES_NON_SUBSCRIPTION**: Indicates that one or more eBay marketplaces allow dealership subscribers without a subscription to specify local market radius for Motors Local Market listings.
**Type:** object

### ErrorDetailV3
**Description:** This type defines the elements of error and warning messages.
**Type:** object

**Properties:**
- **category** (string)
  - The category type for this error or warning. It takes an ErrorCategory object which can have one of three values:

*   `Application`: Indicates an exception or error occurred in the application code or at runtime. Examples include catching an exception in a service's business logic, system failures, or request errors from a dependency.
*   `Business`: Used when your service or a dependent service refused to continue processing on the resource because of a business rule violation such as "Seller does not ship item to Antarctica" or "Buyer ineligible to purchase an alcoholic item". Business errors are not syntactical input errors.
*   `Request`: Used when there is anything wrong with the request, such as authentication, syntactical errors, rate limiting or missing headers, bad HTTP header values, and so on.
- **domain** (string)
  - Name of the domain containing the service or application.
- **errorId** (integer)
  - A positive integer that uniquely identifies the specific error condition that occurred. Your application can use error codes as identifiers in your customized error-handling algorithms.
- **inputRefIds** (array)
  - Identifies specific request elements associated with the error, if any. inputRefId's response is format specific. For JSON, use _JSONPath_ notation.
- **longMessage** (string)
  - An expanded version of message that should be around 100-200 characters long, but is not required to be such.
- **message** (string)
  - An end user and app developer friendly device agnostic message. It explains what the error or warning is, and how to fix it (in a general sense). Its value is at most 50 characters long. If applicable, the value is localized in the end user's requested locale.
- **outputRefIds** (array)
  - Identifies specific response elements associated with the error, if any. Path format is the same as `inputRefId`.
- **parameters** (array)
  - This optional complex field type contains a list of one or more context-specific `ErrorParameter` objects, with each item in the list entry being a parameter (or input field name) that caused an error condition. Each `ErrorParameter` object consists of two fields, a `name` and a `value`.
- **subdomain** (string)
  - Name of the domain's subsystem or subdivision. For example, checkout is a subdomain in the buying domain.

### ErrorParameterV3
**Description:** This type defines error parameters.
**Type:** object

**Properties:**
- **name** (string)
  - Name of the entity that threw the error.
- **value** (string)
  - A description of the error.

### ExtendedProducerResponsibility
**Description:** A type that defines the attributes of an Extended Producer Responsibility policy.
**Type:** object

**Properties:**
- **enabledForVariations** (boolean)
  - An indication of whether the attribute can be enabled for listing variations.  
  
If the value is `true`, the attribute may be specified at the variation level.
- **name** (ExtendedProducerResponsibilityEnum)
  - The name of the attribute included in the policy.
- **usage** (GenericUsageEnum)
  - The usage guidelines for the attribute, in the specified marketplace.

### ExtendedProducerResponsibilityEnum
**Description:** An enumerated type that identifies the attributes used in Extended Producer Responsibility policies.**Note:** Extended Producer Responsibility IDs are no longer set at the listing level so category-level metadata is no longer returned for `PRODUCER_PRODUCT_ID`, `PRODUCT_DOCUMENTATION_ID`, `PRODUCT_PACKAGE_ID`, and `SHIPMENT_PACKAGE_ID`. Sellers will provide/manage these IDs at the account level by going to [Account Settings](https://accountsettings.ebay.fr/epr-fr ). | - **ECO_PARTICIPATION_FEE**: This enum value is used to identify the eco participation fee attribute. - **TAKE_BACK_POLICY**: This enum value is used to identify the take-back policy attribute. - **REPAIR_SCORE**: This enum value is used to identify the repair score attribute.
**Type:** object

### ExtendedProducerResponsibilityPolicy
**Description:** A type that defines the Extended Producer Responsibility policy.
**Type:** object

**Properties:**
- **categoryId** (string)
  - The unique identifier for the category under which the policy applies.
- **categoryTreeId** (string)
  - The unique identifier for the category tree under which the policy applies.
- **supportedAttributes** (array)
  - The details regarding the attributes included in the policy, such as their usage guidelines and whether they can be specified at the listing variation level.

### ExtendedProducerResponsibilityPolicyResponse
**Description:** A type that defines the response fields for the **getExtendedProducerResponsibilityPolicies** method.
**Type:** object

**Properties:**
- **extendedProducerResponsibilities** (array)
  - An array of response fields detailing the Extended Producer Responsibility policies supported for the specified marketplace.
- **warnings** (array)
  - A collection of warnings generated for the request.

### GenericUsageEnum
**Description:** An enumerated type that indicates whether an Extended Producer Responsibility attribute is optional, recommended, or required. | - **OPTIONAL**: This enum value indicates that the attribute is optional. - **RECOMMENDED**: This enum value indicates that the attribute is recommended. - **REQUIRED**: This enum value indicates that the attribute is required.
**Type:** object

### GeographicExposureEnum
**Description:** An enumerated type that indicates if an eBay site or category supports Motors National Listings and/or Motors Local Market listings. | - **National**: This enumeration value indicates the eBay site or category only supports Motors National Listings for the corresponding Motors dealer subscription level/type. - **LocalOnly**: This enumeration value the eBay site or category only supports Motors Local Market Listings for the corresponding Motors dealer subscription level/type. - **LocalOptional**: This enumeration value the eBay site or category supports Motors National Listings and Motors Local Market listing for the corresponding Motors dealer subscription level/type.
**Type:** object

### GetCurrenciesResponse
**Description:** This type defines the response fields specifying the default currency for the marketplace.
**Type:** object

**Properties:**
- **defaultCurrency** (Currency)
  - This field specifies the default currency used by the marketplace.
- **marketplaceId** (MarketplaceIdEnum)
  - The ID of the eBay marketplace to which the default currency applies.

### GetMinimumListingPricePoliciesResponse
**Description:** This type defines the response container for the **getMinimumListingPricePolicies** method.
**Type:** object

**Properties:**
- **minimumListingPricePolicies** (array)
  - This array returns a list of minimum listing price policies for supported types of listings on the specific marketplace

### HazardStatement
**Description:** A type that describes hazard statements for hazardous materials labels
**Type:** object

**Properties:**
- **statementId** (string)
  - The identifier of the statement. For sample values, see [Hazard statement sample values](/api-docs/sell/static/metadata/feature-regulatorhazmatcontainer.html#Hazard).
- **statementDescription** (string)
  - The description of the statement localized to the default language of the marketplace. For sample values, see [Hazard statement sample values](/api-docs/sell/static/metadata/feature-regulatorhazmatcontainer.html#Hazard).

### HazardousMaterialDetailsResponse
**Description:** A type that defines the response fields for the **getHazardousMaterialsLabels** method.
**Type:** object

**Properties:**
- **signalWords** (array)
  - This array contains available hazardous materials signal words for the specified marketplace.
- **statements** (array)
  - This array contains available hazardous materials hazard statements for the specified marketplace.
- **pictograms** (array)
  - This array contains available hazardous materials hazard pictograms for the specified marketplace.

### ItemCondition
**Description:** **Note:** In all eBay marketplaces, Condition ID 2000 now maps to an item condition of 'Certified Refurbished', and not 'Manufacturer Refurbished'. To list an item as 'Certified Refurbished', a seller must be pre-qualified by eBay for this feature. Any seller who is not eligible for this feature will be blocked if they try to create a new listing or revise an existing listing with this item condition. Any active listings on any eBay marketplace that had 'Manufacturer Refurbished' as the item condition should have been automatically updated by eBay to the 'Seller Refurbished' item condition (Condition ID 2500).  
  
Any seller that is interested in eligibility requirements to list with 'Certified Refurbished' should see the [Certified refurbished program](https://pages.ebay.com/seller-center/listing-and-marketing/certified-refurbished-program.html ) page in Seller Center.
**Type:** object

**Properties:**
- **conditionDescription** (string)
  - The human-readable label for the condition (e.g., "New"). This value is typically localized for each site.  
  
Note that the display name can vary by category. For example, the description for condition ID `1000` could be called "New: with Tags" in one category and "Brand New" in another. For details on condition IDs and descriptions, see [Item condition ID and name values](/api-docs/sell/static/metadata/condition-id-values.html).
- **conditionDescriptors** (array)
  - This array contains the possible condition descriptors and condition descriptor values applicable for the specified category. It also returns usage requirements, maximum length, cardinality, and help text.  
  
**Note:** This array is only returned for categories that support condition descriptors.
- **conditionHelpText** (string)
  - A detailed description of the condition denoted by the **conditionID** and **conditionDescription**.
- **conditionId** (string)
  - The ID value of the selected item condition. For information on the supported condition ID values, see [Item condition ID and name values](/api-docs/sell/static/metadata/condition-id-values.html).
- **usage** (UsageEnum)
  - The value returned in this field indicates if there are any usage restrictions or requirements for the corresponding item condition in the corresponding category.  
  
**Note:** Currently, the only supported value is 'RESTRICTED', and this field will only be returned for the following conditions: 2000, 2010, 2020, 2030. Sellers must be pre-approved to use any of these item conditions.

### ItemConditionDescriptor
**Description:** This type is used to display the possible condition descriptors and condition values applicable for a specified category. It also returns usage requirements, maximum length, cardinality, and help text.
**Type:** object

**Properties:**
- **conditionDescriptorConstraint** (ItemConditionDescriptorConstraint)
  - This container shows the constraints on a condition descriptor, such as the maximum length, default condition descriptor value ID, cardinality, mode, usage, and applicable descriptor IDs.
- **conditionDescriptorHelpText** (string)
  - A description of the condition descriptor that directs a user to its condition descriptor values.  
  
For example, the help text for `Card Condition` is `Select ungraded condition`.
- **conditionDescriptorId** (string)
  - The unique identification number of a condition descriptor associated with with a **conditionDescriptorName**.  
  
For example, `40001` is the ID for `Card Condition`.  
  
These IDs are used in the addItem family of calls of the **Trading API** to provide condition descriptor names for the item. These IDs are used by the inventoryItem family of calls of the **Inventory API** to provide condition descriptor names for the item.
- **conditionDescriptorName** (string)
  - The human-readable label for the condition descriptor associated with the **conditionDescriptorID**.  
  
For example, `Card Condition` is the condition descriptor name for ID `40001`
- **conditionDescriptorValues** (array)
  - This array shows the possible values that map to the corresponding **conditionDescriptorName** values. Constraint information and help text are also shown for each value.  
  
For example, The ID `40001` is ID for the condition descriptor `card condition`. The ID `400012` is the ID for the `Very Good` card condition value.

### ItemConditionDescriptorConstraint
**Description:** This type specifies the constraints on a condition descriptor, such as the maximum length, default condition descriptor value ID, cardinality, mode, usage, and applicable descriptor IDs.
**Type:** object

**Properties:**
- **applicableToConditionDescriptorIds** (array)
  - This array is returned if the corresponding condition descriptor requires that one or more other associated condition descriptors must also be specified in a listing. The condition descriptor IDs for the associated condition descriptors are returned here.  
  
For example, the `Grade` and `Grader` condition descriptors must always be specified together in a listing for Graded cards.
- **cardinality** (CardinalityEnum)
  - The value returned in this field indicates whether a condition descriptor can have a single value or multiple values.
- **defaultConditionDescriptorValueId** (string)
  - The default condition descriptor value that will be set if there are multiple values.
- **maxLength** (integer)
  - The maximum characters allowed for a condition descriptor. This field is only returned/applicable for condition descriptors that allow free text for condition descriptor values.
- **mode** (ModeEnum)
  - The value returned in this field indicates whether the supported values for a condition descriptor are predefined or if the seller manually specified the value.  
  
**Note:** `FREE_TEXT` is currently only applicable to the Certification Number condition descriptor.
- **usage** (DescriptorUsageEnum)
  - This value indicates whether or not the condition descriptor is required for the item condition. Currently, this field is only returned if the condition descriptor is required for the item condition.

### ItemConditionDescriptorValue
**Description:** This type displays the possible values for the corresponding condition descriptor, along with help text and constraint information.
**Type:** object

**Properties:**
- **conditionDescriptorValueAdditionalHelpText** (array)
  - Additional information about the the condition of the item that is not included in the **conditionDescriptorValueHelpText** field.
- **conditionDescriptorValueConstraints** (array)
  - The constraints on a condition descriptor value, such as which descriptor value IDs and Descriptor ID it is associated with.
- **conditionDescriptorValueHelpText** (string)
  - A detailed description of the condition descriptor value.
- **conditionDescriptorValueId** (string)
  - The unique identification number of a condition descriptor value associated with the **conditionDescriptorValueName**.
- **conditionDescriptorValueName** (string)
  - The human-readable label for the condition descriptor value associated with the **conditionDescriptorValueID**.

### ItemConditionDescriptorValueConstraint
**Description:** This type shows the constraints on a condition descriptor value, such as any associated condition descriptor ID and condition descriptor value IDs required for a listing.
**Type:** object

**Properties:**
- **applicableToConditionDescriptorId** (string)
  - This string is returned if the corresponding condition descriptor value requires an associated condition descriptor that must also be specified in a listing. The condition descriptor ID for the associated condition descriptors is returned here.
- **applicableToConditionDescriptorValueIds** (array)
  - This array is returned if the corresponding condition descriptor value is required for one or more associated condition descriptor values that must also be specified in a listing. The condition descriptor values IDs for the associated condition descriptor values are returned here.

### ItemConditionPolicy
**Description:** This type contains applicable item condition policy metadata for the leaf categories returned for the marketplace.
**Type:** object

**Properties:**
- **categoryId** (string)
  - The category ID to which the item-condition policy applies.
- **categoryTreeId** (string)
  - A value that indicates the root node of the category tree used for the response set. Each marketplace is based on a category tree whose root node is indicated by this unique category ID value. All category policy information returned by this call pertains to the categories included below this root node of the tree.  
  
A _category tree_ is a hierarchical framework of eBay categories that begins at the root node of the tree and extends to include all the child nodes in the tree. Each child node in the tree is an eBay category that is represented by a unique **categoryId** value. Within a category tree, the root node has no parent node and _leaf nodes_ are nodes that have no child nodes.
- **itemConditionRequired** (boolean)
  - This flag denotes whether or not you must list the item condition in a listing for the specified category. If set to `true`, you must specify an item condition for the associated category.
- **itemConditions** (array)
  - The item-condition values allowed in the category.  
  
**Note:** The ‘Seller Refurbished’ item condition (condition ID 2500) has been replaced by the 'Excellent - Refurbished', 'Very Good - Refurbished', and 'Good - Refurbished' item conditions in a select number of eBay marketplaces and categories.  
  
Similar to the ‘Certified Refurbished’ item condition (condition ID 2000), a seller’s OAuth user token will have to be used instead of an OAuth application token, since each seller must go through an application and qualification process before using any of these new refurbished item conditions in supported categories. If a seller is not qualified to use the new refurbished item conditions, these item condition values will not be returned by **getItemConditionPolicies**.

### ItemConditionPolicyResponse
**Description:** This type defines the base response fields for the **getItemConditionPolicies** method.
**Type:** object

**Properties:**
- **itemConditionPolicies** (array)
  - A list of category IDs and the policies for how to indicate an item's condition in each of the listed categories.
- **warnings** (array)
  - A list of the warnings that were generated as a result of the request. This field is not returned if no warnings were generated by the request.

### ListingDuration
**Description:** This type identifies the kind of listing and its duration periods.
**Type:** object

**Properties:**
- **durationValues** (array)
  - This array defines the supported time duration options available for the listing type.
- **listingType** (ListingTypeEnum)
  - The enumerated value returned in this field indicates the listing type for the duration value(s).

### ListingStructurePolicy
**Description:** This type contains applicable listing structure policy metadata for the leaf categories returned for the marketplace.
**Type:** object

**Properties:**
- **categoryId** (string)
  - The category ID to which the listing-structure policy applies.
- **categoryTreeId** (string)
  - A value that indicates the root node of the category tree used for the response set. Each marketplace is based on a category tree whose root node is indicated by this unique category ID value. All category policy information returned by this call pertains to the categories included below this root node of the tree.  
  
A _category tree_ is a hierarchical framework of eBay categories that begins at the root node of the tree and extends to include all the child nodes in the tree. Each child node in the tree is an eBay category that is represented by a unique **categoryId** value. Within a category tree, the root node has no parent node and _leaf nodes_ are nodes that have no child nodes.
- **variationsSupported** (boolean)
  - This flag denotes whether or not the associated category supports listings with item variations. If set to `true`, the category does support item variations.

### ListingStructurePolicyResponse
**Description:** This type defines the base response fields of the **getListingStructuresPolicies** method.
**Type:** object

**Properties:**
- **listingStructurePolicies** (array)
  - Returns a list of category IDs plus a flag indicating whether or not each listed category supports item variations.
- **warnings** (array)
  - A list of the warnings that were generated as a result of the request. This field is not returned if no warnings were generated by the request.

### ListingTypeEnum
**Description:** This enumerated type contains the selling formats for eBay listings. | - **AUCTION**: This value indicates that the corresponding leaf category supports auction listings. - **AD_TYPE**: This value indicates that the corresponding leaf category supports classified ads in a Real Estate category listings. - **PERSONAL_OFFER**: This value indicates that the corresponding leaf category supports Second chance offer made to a non-winning bidder listings. - **FIXED_PRICE_ITEM**: This value indicates that the corresponding leaf category supports fixed-price listings. - **LEAD_GENERATION**: This value indicates that the corresponding leaf category supports non-Real Estate classified ad listings (the `AD_TYPE` enumeration value represents Real Estate classified ads).
**Type:** object

### ListingTypePoliciesResponse
**Description:** This type contains the selling formats for eBay listings.
**Type:** object

**Properties:**
- **listingTypePolicies** (array)
  - This array contains applicable policy metadata for the leaf categories returned for the marketplace specified in the path parameter **marketplace\_id** and optionally limited by only those leaf category IDs specified in the query parameter **filter**.
- **warnings** (array)
  - An array of the warnings that were generated as a result of the request. This field is not returned if no warnings were generated by the request.

### ListingTypePolicy
**Description:** This type contains the policies governing the listing type by category.
**Type:** object

**Properties:**
- **categoryId** (string)
  - The unique identifier of the eBay leaf category for which metadata is being returned.
- **categoryTreeId** (string)
  - The unique identifier of the category tree.
- **digitalGoodDeliveryEnabled** (boolean)
  - A `true` value in this field indicates that the leaf category supports the listing of items (such as gift cards) that can be delivered electronically via a download link or sent to a buyer's email address.
- **listingDurations** (array)
  - An array of eBay listing types and the supported durations for the corresponding leaf category. If a specific eBay listing type does not appear for a leaf category, it indicates that the category does not support that listing type.
- **pickupDropOffEnabled** (boolean)
  - A true value in this field indicates that items listed in the category (specified in the **listingTypePolicies.categoryId** field) may be enabled with the 'Click and Collect' feature. With the 'Click and Collect' feature, a buyer can purchase certain items on an eBay site and collect them at a local store. Buyers are notified by eBay once their items are available. A false value in this field indicates that items listed in the category are not eligible for the 'Click and Collect' feature.

### LocalListingDistance
**Description:** This type contains the kind of distance and radius of the selling area for Local Market Vehicle listings.
**Type:** object

**Properties:**
- **distances** (array)
  - This array indicates the radius (in miles) of the selling area for Local Market Vehicle listings.
- **distanceType** (DistanceType)
  - This enumerated value indicates the type of local listing distances, such as non-subscription or regular, for items listed by sellers.

### MarketplaceIdEnum
**Description:** This type contains enumerated values of the standard codes that represent each of the eBay marketplaces. | - **EBAY_US**: Indicates the eBay marketplace for the United States. - **EBAY_CA**: Indicates the eBay marketplace for Canada.  
  
**Note:** When targeting the French locale of the Canadian marketplace, add the **Accept-Language** request header and pass in `fr-CA`. If this locale is not specified, the language will default to English. - **EBAY_GB**: Indicates the eBay marketplace for Great Britain (United Kingdom). - **EBAY_AU**: Indicates the eBay marketplace for Australia. - **EBAY_AT**: Indicates the eBay marketplace for Austria. - **EBAY_BE**: Indicates the eBay marketplace for Belgium.  
  
**Note:** When targeting the French locale of the Belgium marketplace, add the **Accept-Language** request header and pass in `fr-BE`. If this locale is not specified, the language will default to Dutch. - **EBAY_DE**: Indicates the eBay marketplace for Germany. - **EBAY_IT**: Indicates the eBay marketplace for Italy. - **EBAY_NL**: Indicates the eBay marketplace for The Netherlands. - **EBAY_ES**: Indicates the eBay marketplace for Spain. - **EBAY_CH**: Indicates the eBay marketplace for Switzerland. - **EBAY_TW**: Indicates the eBay marketplace for Taiwan. - **EBAY_CZ**: This marketplace is not currently supported. - **EBAY_DK**: This marketplace is not currently supported. - **EBAY_FI**: This marketplace is not currently supported. - **EBAY_FR**: Indicates the eBay marketplace for France. - **EBAY_GR**: This marketplace is not currently supported. - **EBAY_HK**: Indicates the eBay marketplace for Hong Kong. - **EBAY_HU**: This marketplace is not currently supported. - **EBAY_IN**: This marketplace is not currently supported. - **EBAY_ID**: This marketplace is not currently supported. - **EBAY_IE**: Indicates the eBay marketplace for Indicates the eBay marketplace for Ireland. - **EBAY_IL**: This marketplace is not currently supported. - **EBAY_MY**: Indicates the eBay marketplace for Malaysia. - **EBAY_NZ**: This marketplace is not currently supported. - **EBAY_NO**: This marketplace is not currently supported. - **EBAY_PH**: This marketplace is not currently supported. - **EBAY_PL**: Indicates the eBay marketplace for Poland. - **EBAY_PT**: Indicates the eBay marketplace for Portugal. - **EBAY_PR**: This marketplace is not currently supported. - **EBAY_RU**: This marketplace is not currently supported. - **EBAY_SG**: Indicates the eBay marketplace for Singapore. - **EBAY_ZA**: This marketplace is not currently supported. - **EBAY_SE**: This marketplace is not currently supported. - **EBAY_TH**: This marketplace is not currently supported. - **EBAY_VN**: This marketplace is not currently supported. - **EBAY_CN**: This marketplace is not currently supported. - **EBAY_JP**: This marketplace is not currently supported. - **EBAY_PE**: This marketplace is not currently supported. - **EBAY_HALF_US**: No longer used. - **EBAY_MOTORS_US**: Indicates the eBay marketplace is eBay Motors.
**Type:** object

### MinimumListingPricePoliciesType
**Description:** This type defines the minimum starting prices for the supported types of eBay listings
**Type:** object

**Properties:**
- **description** (string)
  - The description of the listing type for which the pricing data is intended, such as "Pricing for the auction-like listings".
- **listingType** (ListingTypeEnum)
  - This enum value indicates the listing type for which minimum starting price policies are being returned.  
  
**Note:** The only applicable values for this method are `AUCTION` and `FIXED_PRICE_ITEM`.
- **minBuyItNowPricePercent** (string)
  - The minimum percentage value that a Buy It Now price for an auction listing must be above the starting bid price for the same listing.  
  
This field is only returned and applicable for auction listings.
- **startPrice** (Amount)
  - For auction listings, this field indicates the lowest dollar value that can be set for the item's starting bid.  
  
For fixed-price listings, this field indicates the lower dollar value that can be set for the item's sale price.

### ModeEnum
**Description:** This enumeration value indicates whether a condition descriptor input is selection only or free text. | - **SELECTION_ONLY**: This enum indicates that the input is selection only. - **FREE_TEXT**: This enum indicates that the input is free text.
**Type:** object

### MotorsListingPoliciesResponse
**Description:** This type defines the base response fields of the **getMotorsListingPolicies** method.
**Type:** object

**Properties:**
- **motorsListingPolicies** (array)
  - This array contains applicable policy metadata for the leaf categories returned for the marketplace specified in the path parameter **marketplace\_id** and optionally limited by only those leaf category IDs specified in the query parameter **filter**.
- **warnings** (array)
  - An array of the warnings that were generated as a result of the request. This field is not returned if no warnings were generated by the request.

### MotorsListingPolicy
**Description:** This type contains applicable motors listing policy metadata for the leaf categories returned for the marketplace.
**Type:** object

**Properties:**
- **categoryId** (string)
  - The unique identifier of the eBay leaf category for which metadata is being returned.
- **categoryTreeId** (string)
  - The unique identifier of the category tree.
- **depositSupported** (boolean)
  - This field is returned as `true` if the corresponding category supports the use of a deposit/down payment on a motor vehicle listing. In an AddItem call, the seller can configure a down payment for a motor vehicle listing using the PaymentDetails container.
- **ebayMotorsProAdFormatEnabled** (AdFormatEnabledEnum)
  - Indicates whether or not eBay Motors Pro sellers can use classified ads in this category to sell their vehicles. This element is applicable for eBay Motors Pro users.
- **ebayMotorsProAutoAcceptEnabled** (boolean)
  - Indicates whether or not the category supports the Best Offer Auto Accept feature for eBay Motors Pro listings. This element is for eBay Motors Pro users.
- **ebayMotorsProAutoDeclineEnabled** (boolean)
  - Indicates whether or not the category allows auto-decline for Best Offers for eBay Motors Classified Ad listings. This element is for eBay Motors Pro users.
- **ebayMotorsProBestOfferEnabled** (ClassifiedAdBestOfferEnabledEnum)
  - This enumerated value indicates whether or not Best Offer features are supported for eBay Motors Classified Ad listings in this category. This element is for eBay Motors Pro users.
- **ebayMotorsProCompanyNameEnabled** (boolean)
  - Indicates whether this category supports including the company name in the seller's contact information. This element is for eBay Motors Pro users.
- **ebayMotorsProContactByAddressEnabled** (boolean)
  - Indicates whether this category supports including the address in the seller's contact information. This element is for eBay Motors Pro users.
- **ebayMotorsProContactByEmailEnabled** (boolean)
  - Indicates whether this category supports including an email address in the seller's contact information. This element is for eBay Motors Pro users.
- **ebayMotorsProContactByPhoneEnabled** (boolean)
  - Indicates whether this category supports including the telephone in the seller's contact information. This element is for eBay Motors Pro users.
- **ebayMotorsProCounterOfferEnabled** (boolean)
  - Indicates whether counter offers are allowed on Best Offers for this category in an eBay Motors Classified Ad listing. This element is for eBay Motors Pro users.
- **ebayMotorsProPaymentMethodCheckOutEnabled** (ClassifiedAdPaymentMethodEnabledEnum)
  - This enumerated value indicates whether this category supports that the payment method should be displayed to the user for this category in an eBay Motors Classified Ad listing. Even if enabled, checkout may or may not be enabled. This element is for eBay Motors Pro users.
- **ebayMotorsProPhoneCount** (integer)
  - Indicates the number of phone numbers that can be included through contact information for this category. This element is for eBay Motors Pro users.
- **ebayMotorsProSellerContactDetailsEnabled** (boolean)
  - Indicates whether this category allows seller-level contact information for eBay Motors Classified Ad listings. A value of true means seller-level contact information is available for Classified Ad listings. This element is for eBay Motors Pro users.
- **ebayMotorsProShippingMethodEnabled** (boolean)
  - Indicates if shipping options should be displayed to the user for this category in an eBay Motors Classified Ad listing. This element is for eBay Motors Pro users.
- **ebayMotorsProStreetCount** (integer)
  - This field indicates the number of street addresses allowed in contact information for this category. This element is for eBay Motors Pro users.
- **epidSupported** (boolean)
  - If returned as `true`, this indicates the category supports the use of an eBay Product ID (e.g. ePID) to identify which motorcycles and/or scooters are compatible with a motor vehicle part or accessory. ePIDs can only be used to identify motorcycles and scooters on the Germany and UK sites.
- **kTypeSupported** (boolean)
  - This field indicates whether or not the category supports the use of a K type to identify the cars and trucks compatible with a motor vehicle part or accessory. Only the AU, DE, ES, FR, IT, and UK marketplaces support the use of K types. See [Compatibility by K type](/api-docs/user-guides/static/trading-user-guide/manually-specify-compatibility.html#ktype) for more information
- **localListingDistances** (array)
  - This array shows the supported distances (in miles) for different types of Local Market subscription types in this category. Motor vehicle listings will be shown to buyers located within these proximities of the vehicle's location.
- **localMarketAdFormatEnabled** (AdFormatEnabledEnum)
  - Specifies whether this category supports Motor Local Market Classified Ad listings.
- **localMarketAutoAcceptEnabled** (boolean)
  - Specifies whether this category supports auto-accept for Best Offers for Motors Local Market Classified Ads.
- **localMarketAutoDeclineEnabled** (boolean)
  - Specifies whether this category supports auto-decline for Best Offers for Motors Local Market Classified Ads.
- **localMarketBestOfferEnabled** (ClassifiedAdBestOfferEnabledEnum)
  - Indicates if Best Offer is enabled/required for Motors Local Market Classified Ad listings in this category.
- **localMarketCompanyNameEnabled** (boolean)
  - Indicates whether the category supports the seller's company name being specified when using Motors Local Market classified ads.
- **localMarketContactByAddressEnabled** (boolean)
  - Indicates whether this category supports including the address in the seller's contact information.
- **localMarketContactByEmailEnabled** (boolean)
  - Indicates whether the category supports including an email address in the seller's contact information.
- **localMarketContactByPhoneEnabled** (boolean)
  - Indicates whether this category supports including the telephone in the seller's contact information.
- **localMarketCounterOfferEnabled** (boolean)
  - Indicates whether counter offers are allowed on Best Offers for this category for Motors Local Market Classified Ad listings.
- **localMarketNonSubscription** (boolean)
  - Indicates whether the category supports a seller creating a Motors Local Market listing without a subscription. This feature is only available to licensed vehicle dealers.
- **localMarketPaymentMethodCheckOutEnabled** (ClassifiedAdPaymentMethodEnabledEnum)
  - Indicates if the payment method should be displayed to the user for this category in an Motors Local Market Classified Ad listing. Even if enabled, checkout may or may not be enabled.
- **localMarketPhoneCount** (integer)
  - Indicates the number of phone numbers that can be included through contact information for this category.
- **localMarketPremiumSubscription** (boolean)
  - Indicates whether the category supports the Premium level subscription Motors Local Market listings. This feature is only available to licensed vehicle dealers.
- **localMarketRegularSubscription** (boolean)
  - Indicates whether the category supports the Regular level subscription to Motors Local Market listings. This feature is only available to licensed vehicle dealers.
- **localMarketSellerContactDetailsEnabled** (boolean)
  - Specifies the whether this category allows seller-level contact information for Motors Local Market Classified Ad listings.
- **localMarketShippingMethodEnabled** (boolean)
  - Indicates if shipping methods should be displayed to the user for this category in an Motors Local Market Classified Ad listing. Even if enabled, checkout may or may not be enabled.
- **localMarketSpecialitySubscription** (boolean)
  - Indicates whether the category supports the Specialty level subscription to Motors Local Market listings. This feature is only available to licensed vehicle dealers.
- **localMarketStreetCount** (integer)
  - Indicates which address option is enabled for the seller's contact information.
- **maxGranularFitmentCount** (integer)
  - Indicates the maximum number of compatible applications allowed per item when adding or revising items with compatibilities provided at the most detailed granularity. For example, in Car and Truck Parts on the US site, the most granular application would include Year, Make, Model, Trim, and Engine.
- **maxItemCompatibility** (integer)
  - Indicates the maximum number of compatible applications allowed per item when adding or revising items. This is relevant for specifying parts compatibility by application manually only. See [Specify parts compatibility manually](/api-docs/user-guides/static/trading-user-guide/manually-specify-compatibility.html) and [Managing product compatibility](/api-docs/sell/static/inventory/managing-product-compatibility.html) for more information.
- **minItemCompatibility** (integer)
  - Indicates the minimum number of required compatible applications for listing items. A value of `0` indicates it is not mandatory to specify parts compatibilities when listing.
- **nonSubscription** (GeographicExposureEnum)
  - The value in this field indicates whether the category supports Motors Local Market listings if the seller does not have a vehicle subscription.
- **premiumSubscription** (GeographicExposureEnum)
  - The value in this field indicates whether the category supports Motors Local Market listings if the seller has a Premium vehicle subscription.
- **regularSubscription** (GeographicExposureEnum)
  - The value in this field indicates whether the category supports Motors Local Market listings if the seller has a Regular vehicle subscription.
- **sellerProvidedTitleSupported** (boolean)
  - This field is returned as `true` if the corresponding category supports the use of a seller-provided title for a motor vehicle listing on the US or Canada Motors marketplaces. A seller-provided title is a descriptive title, given by the seller, that appears below eBay's pre-filled listing title for the motor vehicle. Visually, the seller-provided title is similar to a subtitle on other types of eBay listings (non-vehicle). A seller-provided title can assist in helping buyers discover the vehicle.
- **specialitySubscription** (GeographicExposureEnum)
  - The value in this field indicates whether the category supports Motors Local Market listings if the seller has a Specialty vehicle subscription.
- **vinSupported** (boolean)
  - Indicates if Vehicle Identification Number is supported.
- **vrmSupported** (boolean)
  - Indicates if Vehicle Registration Mark is supported.

### MultiCompatibilityPropertyValuesRequest
**Description:** This type defines the request fields used in the **getMultiCompatibilityPropertyValues** method.
**Type:** object

**Properties:**
- **categoryId** (string)
  - The unique identifier of the eBay leaf category for which to retrieve property values.  
  
Use the [getAutomotivePartsCompatibilityPolicies](/develop/api/sell/metadata_api#sell-metadata_api-marketplace%20-getautomotivepartscompatibilitypolicies) method to retrieve a list of categories that support parts compatibility.
- **propertyFilters** (array)
  - This array can be used to specify the compatibility properties used to limit the result set. Only values associated with the specified name-value pairs will be returned in the response.  
  
For example, if the **propertyName** is set to `Year` and the **propertyValue** is set to `2022`, only compatible vehicles from 2022 will be returned.  
  
At least one property name-value pair must be used.
- **propertyNames** (array)
  - This comma-delimited array specifies the names of the properties for which to retrieve associated property values.  
  
For example, typical vehicle property names are 'Make', 'Model', 'Year', 'Engine', and 'Trim', but will vary based on the eBay marketplace and the eBay category.

### MultiCompatibilityPropertyValuesResponse
**Description:** This type defines the response fields for the **getMultiCompatibilityPropertyValues** method.
**Type:** object

**Properties:**
- **compatibilities** (array)
  - This container defines the compatibility details associated with the specified property name value(s).
- **metadataVersion** (string)
  - The version number of the metadata. This version is upticked whenever there are compatibility name changes for the specified marketplace.

### NegotiatedPricePolicy
**Description:** This type contains applicable negotiation price policy metadata for the leaf categories returned for the marketplace.
**Type:** object

**Properties:**
- **bestOfferAutoAcceptEnabled** (boolean)
  - This flag denotes whether or not the category supports the setting of a price at which best offers are automatically accepted. If set to `true`, the category does support the setting of an automatic price for best-offers.
- **bestOfferAutoDeclineEnabled** (boolean)
  - This flag denotes whether or not the category supports the setting of an auto-decline price for best offers. If set to `true`, the category does support the setting of an automatic-decline price for best-offers.
- **bestOfferCounterEnabled** (boolean)
  - This flag denotes whether or not the category supports the setting for an automatic counter-offer on best offers. If set to `true`, the category does support the setting of an automatic counter-offer price for best-offers.
- **categoryId** (string)
  - The category ID to which the negotiated-price policies apply.
- **categoryTreeId** (string)
  - A value that indicates the root node of the category tree used for the response set. Each marketplace is based on a category tree whose root node is indicated by this unique category ID value. All category policy information returned by this call pertains to the categories included below this root node of the tree.  
  
A _category tree_ is a hierarchical framework of eBay categories that begins at the root node of the tree and extends to include all the child nodes in the tree. Each child node in the tree is an eBay category that is represented by a unique **categoryId** value. Within a category tree, the root node has no parent node and _leaf nodes_ are nodes that have no child nodes.

### NegotiatedPricePolicyResponse
**Description:** This type defines the base response fields of the **getNegotiatedPricePolicies** method.
**Type:** object

**Properties:**
- **negotiatedPricePolicies** (array)
  - A list of category IDs and the policies related to negotiated-price items for each of the listed categories.
- **warnings** (array)
  - A list of the warnings that were generated as a result of the request. This field is not returned if no warnings were generated by the request.

### PackageLimits
**Description:** The packageLimits field is used to specify the physical constraints and measurement units of packages, ensuring compliance with various shipping requirements.
**Type:** object

**Properties:**
- **dimensionUnit** (string)
  - Unit of dimensional measurement, for example `INCH` or `CENTIMETER`.
- **maxGirth** (number)
  - The maximum girth allowed for a package shipped through the corresponding shipping service, as measured in units of [dimensionUnit](/develop/api/sell/metadata_api#sell-metadata_api-shipping:marketplace%20-getshippingservices.packagelimits.dimensionunit).
- **maxHeight** (number)
  - The maximum height allowed for a package shipped through the corresponding shipping service, as measured in units of [dimensionUnit](/develop/api/sell/metadata_api#sell-metadata_api-shipping:marketplace%20-getshippingservices.packagelimits.dimensionunit).
- **maxLength** (number)
  - The maximum length allowed for a package shipped through the corresponding shipping service, as measured in units of [dimensionUnit](/develop/api/sell/metadata_api#sell-metadata_api-shipping:marketplace%20-getshippingservices.packagelimits.dimensionunit).
- **maxWeight** (number)
  - The maximum weight allowed for a package shipped through the corresponding shipping service, as measured in units of [weightUnit](/develop/api/sell/metadata_api#sell-metadata_api-shipping:marketplace%20-getshippingservices.packagelimits.weightunit).
- **maxWidth** (number)
  - The maximum width allowed for a package shipped through the corresponding shipping service, as measured in units of [dimensionUnit](/develop/api/sell/metadata_api#sell-metadata_api-shipping:marketplace%20-getshippingservices.packagelimits.dimensionunit).
- **minGirth** (number)
  - The minimum girth allowed for a package shipped through the corresponding shipping service, as measured in units of [dimensionUnit](/develop/api/sell/metadata_api#sell-metadata_api-shipping:marketplace%20-getshippingservices.packagelimits.dimensionunit).
- **minHeight** (number)
  - The minimum height allowed for a package shipped through the corresponding shipping service, as measured in units of [dimensionUnit](/develop/api/sell/metadata_api#sell-metadata_api-shipping:marketplace%20-getshippingservices.packagelimits.dimensionunit).
- **minLength** (number)
  - The minimum length allowed for a package shipped through the corresponding shipping service, as measured in units of [dimensionUnit](/develop/api/sell/metadata_api#sell-metadata_api-shipping:marketplace%20-getshippingservices.packagelimits.dimensionunit).
- **minWeight** (number)
  - The minimum weight allowed for a package shipped through the corresponding shipping service, as measured in units of [weightUnit](/develop/api/sell/metadata_api#sell-metadata_api-shipping:marketplace%20-getshippingservices.packagelimits.weightunit).
- **minWidth** (number)
  - The minimum width allowed for a package shipped through the corresponding shipping service, as measured in units of [dimensionUnit](/develop/api/sell/metadata_api#sell-metadata_api-shipping:marketplace%20-getshippingservices.packagelimits.dimensionunit).
- **weightUnit** (string)
  - Unit of weight measurement, for example `KILOGRAM` or `OUNCE`.

### Pagination
**Description:** This type defines the pagination settings for a result set.
**Type:** object

**Properties:**
- **count** (integer)
  - The number of results showing on the current page of results.
- **limit** (integer)
  - The max number of entries that can be returned on a single page.
- **offset** (integer)
  - The number of items that will be skipped in the result set before returning the first item in the paginated response.
- **total** (integer)
  - The total number of results in a result set.

### PaginationInput
**Description:** This type defines the fields used to control the pagination of the result set.
**Type:** object

**Properties:**
- **limit** (integer)
  - The max number of items, from the current result set, returned on a single page.  
  
**Note:** For **getProductCompatibilities**, the max value is 100. If no **limit** is specified, this field defaults to the max value.
- **offset** (integer)
  - The number of items that will be skipped in the result set before returning the first item in the paginated response.  
  
Combine **offset** with **limit** to control the items returned in the response. For example, if you supply an offset of 10 and a limit of 20, the first page of the response contains items 11-30 from the complete result set.  
  
**Default:** 0

### Pictogram
**Description:** A type that describes pictograms for hazardous materials labels.
**Type:** object

**Properties:**
- **pictogramId** (string)
  - The identifier of the pictogram. For sample values, see [Pictogram sample values](/api-docs/sell/static/metadata/feature-regulatorhazmatcontainer.html#Pictogra).
- **pictogramDescription** (string)
  - The description of the pictogram localized to the default language of the marketplace. For sample values, see [Pictogram sample values](/api-docs/sell/static/metadata/feature-regulatorhazmatcontainer.html#Pictogra).
- **pictogramUrl** (string)
  - The URL of the pictogram.

### ProductIdentiferEnabledEnum
**Description:** This enumerated type specifies whether a leaf category supports or requires a Universal Product Code (UPC), International Standard Book Number (ISBN), or European Article Number (EAN) for products. Collectively, these identifiers are referred to as Global Trade Item Numbers (GTINs). | - **DISABLED**: This value indicates that the corresponding Global Trade Item Number (GTIN) type is not supported for the leaf category. - **ENABLED**: This value indicates that the corresponding Global Trade Item Number (GTIN) type is supported as applicable, but not required for the leaf category - **REQUIRED**: This value indicates that the corresponding Global Trade Item Number (GTIN) type is required for the leaf category, and an Add/Revise operation will fail without this information.
**Type:** object

### ProductIdentifier
**Description:** This type defines the supported product identifiers.
**Type:** object

**Properties:**
- **ean** (string)
  - The EAN of the item, if applicable. EAN is the European Article Number, a barcode standard for retail product labeling primarily used outside of North America.
- **epid** (string)
  - The ePID (eBay Product Identifier) of the item, if applicable. ePID is a unique identifier used by eBay to track products in its catalog.  
  
Use the [getProduct](/api-docs/commerce/catalog/resources/product/methods/getProduct) method of the Catalog API to retrieve the ePID of an item.
- **isbn** (string)
  - The ISBN of the item, if applicable. ISBN is the International Standard Book Number, a unique identifier for books.
- **productId** (string)
  - The product ID of the item, if applicable. The product ID is a general term for a unique identifier assigned to a product.
- **upc** (string)
  - The UPC of the item, if applicable. UPC stands for Universal Product Code, a unique identifier for products, primarily in North America.

### ProductRequest
**Description:** This type defines the request fields for the **getProductCompatibilities** method.
**Type:** object

**Properties:**
- **applicationPropertyFilters** (array)
  - This array is used to filter the properties of an application, such as a vehicle's make or model, that will be returned in the response.  
  
Application property filters are specified as name-value pairs. Only products compatible with these name-value pairs will be returned.
- **dataset** (array)
  - This array defines the type of properties that are returned for the catalog-enabled category.  
  
For example, if you specify `Searchable`, the compatibility details will contain properties that can be used to search for products, such as make or model.  
  
**Note:** This field cannot be used alongside **dataPropertyName**. If both are used, an error will occur.  
**Valid values:**

*   `DisplayableProductDetails`: Properties for use in a user interface to describe products.
*   `DisplayableSearchResults`: Properties for use in results for product searches.
*   `Searchable`: Properties for use in searches.
*   `Sortable`: Properties that are suitable for sorting.

  
**Default:** `DisplayableSearchResults`
- **datasetPropertyName** (array)
  - This comma-delimted array can be used to define the specific property name(s) that will be returned in the response.  
  
For example, if you specify `Engine`, the result set will only contain engines that are compatible with the input criteria.  
  
**Note:** This array cannot be used alongside **dataset**. If both are used, an error will occur.
- **disabledProductFilter** (DisabledProductFilter)
  - This container can be used to specify whether or not to filter out products which are disabled for selling on eBay and/or disabled for product review.
- **paginationInput** (PaginationInput)
  - This container controls the pagination of the result set.
- **productIdentifier** (ProductIdentifier)
  - This container is used to provide unique identifier for the product. The product identifier consists of an identifier type and value, and are unique across all sites.
- **sortOrders** (array)
  - This array controls the sort order of compatibility properties.

### ProductResponse
**Description:** This type defines the response fields for the **getProductCompatibilities** method.
**Type:** object

**Properties:**
- **compatibilityDetails** (array)
  - This container provides compatibility details for the specified product.
- **pagination** (Pagination)
  - This container returns the pagination settings for the result set.

### ProductResponseCompatibilityDetails
**Description:** This type defines the compatibility details for a product.
**Type:** object

**Properties:**
- **noteDetails** (array)
  - This array returns additional comments about the corresponding product in the form of name-value pairs.
- **productDetails** (array)
  - This array returns details about the product in the form of name-value pairs.

### ProductSafetyLabelPictogram
**Description:** A type that describes pictograms for product safety labels.
**Type:** object

**Properties:**
- **pictogramDescription** (string)
  - The description of the pictogram localized to the default language of the marketplace.
- **pictogramId** (string)
  - The identifier of the pictogram.
- **pictogramUrl** (string)
  - The URL of the pictogram.

### ProductSafetyLabelStatement
**Description:** A type that describes statements for product safety labels.
**Type:** object

**Properties:**
- **statementDescription** (string)
  - The description of the statement localized to the default language of the marketplace.
- **statementId** (string)
  - The identifier of the statement.

### ProductSafetyLabelsResponse
**Description:** A type that defines the response fields for the **getProductSafetyLabels** method.
**Type:** object

**Properties:**
- **pictograms** (array)
  - This array contains a list of pictograms of product safety labels for the specified marketplace.
- **statements** (array)
  - This array contains available product safety labels statements for the specified marketplace.

### PropertyFilterInner
**Description:** This type is used to define the available compatibility property filters.
**Type:** object

**Properties:**
- **propertyName** (string)
  - The name of the property being described.  
  
For example, typical vehicle property names are 'Make', 'Model', 'Year', 'Engine', and 'Trim', but will vary based on the eBay marketplace and the eBay category. Use the [getCompatibilityPropertyNames](/develop/api/sell/metadata_api#sell-metadata_api-compatibilities%20-getcompatibilitypropertynames) method to retrieve valid property names for a specified category.
- **propertyValue** (string)
  - The value for the property specified in the **properyName** field.  
  
For example, if the **propertyName** is `Make`, then the **propertyValue** will be the specific make of the vehicle, such as `Toyota`. Use the [getCompatibilityPropertyValues](/develop/api/sell/metadata_api#sell-metadata_api-compatibilities%20-getcompatibilitypropertyvalues) to retrieve valid property values associated with a specified property name.
- **unitOfMeasurement** (string)
  - The unit of measurement of the property being described, if applicable.
- **url** (string)
  - The URL associated with the property being described, if applicable.

### PropertyNamesRequest
**Description:** This type defines the request fields for the **getCompatibilityPropertyNames** method.
**Type:** object

**Properties:**
- **categoryId** (string)
  - The unique identifier of the eBay leaf category for which to retrieve compatibility property names. This category must be a valid eBay category on the specified eBay marketplace, and the category must support parts compatibility.  
  
Use the [getAutomotivePartsCompatibilityPolicies](/develop/api/sell/metadata_api#sell-metadata_api-marketplace%20-getautomotivepartscompatibilitypolicies) method to retrieve a list of categories that support parts compatibility.
- **dataset** (array)
  - This array defines the properties that will be returned for the compatibility-enabled category.  
  
For example, if you specify `Searchable`, the compatibility details will contain properties that can be used to search for products, such as make or model.  
  
**Valid values:**

*   `DisplayableProductDetails`: Properties for use in a user interface to describe products.
*   `DisplayableSearchResults`: Properties for use in results for product searches.
*   `Searchable`: Properties for use in searches.
*   `Sortable`: Properties that are suitable for sorting.

**Default:** `DisplayableSearchResults`

### PropertyNamesResponse
**Description:** This type defines the fields returned in the **getCompatibilityPropertyNames** method.
**Type:** object

**Properties:**
- **categoryId** (string)
  - The unique identifier of the eBay category specified in the request.
- **properties** (array)
  - This array contains all of the properties for the specified category.

### PropertyNamesResponseProperties
**Description:** This type defines the properties and dataset for a specified category.
**Type:** object

**Properties:**
- **dataset** (string)
  - This field defines the types of properties are returned for the specified catalog-enabled category.  
  
**Valid values:**

*   `DisplayableProductDetails`: Properties for use in a user interface to describe products.
*   `DisplayableSearchResults`: Properties for use in results for product searches.
*   `Searchable`: Properties for use in searches.
*   `Sortable`: Properties that are suitable for sorting.
- **propertyNames** (array)
  - This array specifies the names of the properties associated with the specified category in the specified marketplace.  
  
For example, typical vehicle property names are 'Make', 'Model', 'Year', 'Engine', and 'Trim', but will vary based on the eBay marketplace and the eBay category.

### PropertyNamesResponsePropertyNameMetadata
**Description:** This type defines the property name metadata.
**Type:** object

**Properties:**
- **displaySequence** (integer)
  - The numeric value indicating the ordering position of the property.

### PropertyNamesResponsePropertyNames
**Description:** This type defines the fields associated with a property name.
**Type:** object

**Properties:**
- **propertyDisplayName** (string)
  - The display name of a property. This is the localized name of the compatible property.
- **propertyName** (string)
  - The canonical name of a property. This value is used as part of the name-value pairs used to specify compatibility.
- **propertyNameMetadata** (PropertyNamesResponsePropertyNameMetadata)
  - The metadata for a property.

### PropertyValues
**Description:** This type defines the name-value pair associated with a property value.
**Type:** object

**Properties:**
- **propertyName** (string)
  - The name of the property.  
  
For example, typical vehicle property names are 'Make', 'Model', 'Year', 'Engine', and 'Trim', but will vary based on the eBay marketplace and the eBay category.
- **propertyValue** (string)
  - The value for the property specified in the **properyName** field.  
  
For example, if the **propertyName** is `make`, then the **propertyValue** will be the specific make of the vehicle, such as `Toyota`.

### PropertyValuesRequest
**Description:** This type defines the request fields used in the **getCompatibilityPropertyValues** method.
**Type:** object

**Properties:**
- **categoryId** (string)
  - The unique identifier of the eBay leaf category for which to retrieve compatibility property values. This category must be a valid eBay category on the specified eBay marketplace, and the category must support parts compatibility.  
  
Use the [getAutomotivePartsCompatibilityPolicies](/develop/api/sell/metadata_api#sell-metadata_api-marketplace%20-getautomotivepartscompatibilitypolicies) method to retrieve a list of categories that support parts compatibility.
- **propertyFilters** (array)
  - This array can be used to specify the compatibility properties used limit the result set. Only values associated with the specified name-value pairs will be returned in the response.  
  
For example, if the **propertyName** is set to `Make` and the **propertyValue** is set to `Honda`, only compatible Honda vehicles will be returned.
- **propertyName** (string)
  - This field specifies the name of the property for which to retrieve associated property values.  
  
For example, typical vehicle property names are 'Make', 'Model', 'Year', 'Engine', and 'Trim', but will vary based on the eBay marketplace and the eBay category. Use the [getCompatibilityPropertyNames](/develop/api/sell/metadata_api#sell-metadata_api-compatibilities%20-getcompatibilitypropertynames) method to retrieve valid property names for a specified category.
- **sortOrder** (string)
  - This field specifies the sort order for the property values in the result set.  
  
**Valid values:**

*   `Ascending`
*   Descending

**Note:** If no search order is specified, values are sorted in ascending order.

### PropertyValuesResponse
**Description:** This type defines the response fields used in the **getCompatibilityPropertyValues** method.
**Type:** object

**Properties:**
- **metadataVersion** (string)
  - The version number of the metadata. This version is upticked whenever there are compatibility name changes for the specified marketplace.
- **propertyName** (string)
  - The name of the property specified in the request.
- **propertyValues** (array)
  - This array specifies the property values associated with the specified **propertyName**, in the specified category.

### RegulatoryAttribute
**Description:** A type that defines the attributes of a regulatory policy.
**Type:** object

**Properties:**
- **name** (RegulatoryAttributeEnum)
  - A unique value identifying a specific regulatory attribute.
- **usage** (GenericUsageEnum)
  - The enumeration value in this field indicates whether the corresponding attribute is recommended or required for the corresponding leaf category.

### RegulatoryAttributeEnum
**Description:** An enumerated type that indicates supported regulatory attributes. | - **HAZMAT**: Indicates hazardous materials labels support in listing flows. - **ENERGY_EFFICIENCY**: Indicates energy efficiency class support in listing flows. - **MANUFACTURER_CONTACT**: Indicates support for manufacturer contacts in listing flows. - **PRODUCT_SAFETY**: Indicates product safety support in listing flows.
**Type:** object

### RegulatoryPolicy
**Description:** A type that defines the regulatory policy.
**Type:** object

**Properties:**
- **categoryId** (string)
  - The unique identifier of the leaf category to which the corresponding policies pertain.
- **categoryTreeId** (string)
  - The unique identifier of the category tree, which reflects the specified marketplace.
- **supportedAttributes** (array)
  - A list of supported regulatory attributes for this marketplace.

### RegulatoryPolicyResponse
**Description:** A type that defines the response fields for the **getRegulatoryPolicies** method.
**Type:** object

**Properties:**
- **regulatoryPolicies** (array)
  - A list of eBay policies that define whether or not you must include required regulatory information for leaf categories on the given marketplace.
- **warnings** (array)
  - A list of the warnings that were generated as a result of the request. This field is not returned if no warnings were generated by the request.

### ReturnPolicy
**Description:** This type contains applicable return policy metadata for the leaf categories returned for the marketplace.
**Type:** object

**Properties:**
- **categoryId** (string)
  - The category ID to which the return policies apply.
- **categoryTreeId** (string)
  - A value that indicates the root node of the category tree used for the response set. Each marketplace is based on a category tree whose root node is indicated by this unique category ID value. All category policy information returned by this call pertains to the categories included below this root node of the tree.  
  
A _category tree_ is a hierarchical framework of eBay categories that begins at the root node of the tree and extends to include all the child nodes in the tree. Each child node in the tree is an eBay category that is represented by a unique **categoryId** value. Within a category tree, the root node has no parent node and _leaf nodes_ are nodes that have no child nodes.
- **domestic** (ReturnPolicyDetails)
  - This complex type defines the category policies related to domestic item returns.
- **international** (ReturnPolicyDetails)
  - This complex type defines the category policies related to international item returns.
- **required** (boolean)
  - If set to `true`, this flag indicates that you must specify a return policy for items listed in the associated category.  
  
Note that not accepting returns (setting **returnsAcceptedEnabled** to `false`) is a valid return policy.

### ReturnPolicyDetails
**Description:** This container defines the category policies that relate to domestic and international return policies (the return shipping is made via a domestic or an international shipping service, respectively).
**Type:** object

**Properties:**
- **policyDescriptionEnabled** (boolean)
  - If set to `true`, this flag indicates you can supply a detailed return policy description within your return policy (for example, by populating the **returnInstructions** field in the Account API's **createReturnPolicy**). User-supplied return policy details are allowed only in the DE, ES, FR, and IT marketplaces.  
  
**Note:** Depending on the API used to setup your return policy, return instructions are defined differently.

*   **Account v1 API**  
    When using [createReturnPolicy](/api-docs/sell/account/resources/return_policy/methods/createReturnPolicy) and [updateReturnPolicy](/api-docs/sell/account/resources/return_policy/methods/updateReturnPolicy) to create/manage business policies, use [returnInstructions](/api-docs/sell/account/resources/return_policy/methods/createReturnPolicy#request.returnInstructions) to provide both domestic and international return instructions for the business policy.
*   **Trading API or Sell Feed API**  
    When using the legacy [ReturnPolicy](/devzone/xml/docs/Reference/eBay/AddItem.html#Request.Item.ReturnPolicy) fields, use [Item.ReturnPolicyDescription](/devzone/xml/docs/Reference/eBay/AddItem.html#Request.Item.ReturnPolicy.Description) to provide both domestic and internation return instructions for the business policy.
- **refundMethods** (array)
  - A list of refund methods allowed for the associated category.  
  
**Note:** Depending on the API used to setup your return policy, available refund methods are defined differently.

*   **Account v1 API**  
    When using the [createReturnPolicy](/api-docs/sell/account/resources/return_policy/methods/createReturnPolicy) and [updateReturnPolicy](/api-docs/sell/account/resources/return_policy/methods/updateReturnPolicy) methods to create/manage business policies, use the appropriate [refundMethod](/api-docs/sell/account/resources/return_policy/methods/updateReturnPolicy#request.refundMethod) field to specify the refund method for both domestic and international returns for the business policy.
*   **Trading API or Sell Feed API**  
    When using legacy [ReturnPolicy](/devzone/xml/docs/Reference/eBay/AddItem.html#Request.Item.ReturnPolicy) fields, use [RefundOption](/devzone/xml/docs/Reference/eBay/AddItem.html#Request.Item.ReturnPolicy.RefundOption) and [InternationalRefundOption](/devzone/xml/docs/Reference/eBay/AddItem.html#Request.Item.ReturnPolicy.InternationalRefundOption) to specify the domestic and international refund method, respectively, for returns for the business policy.  
      
    Note that if **MONEY\_BACK** is returned by **getReturnPolicies**, use **MoneyBack** in [RefundOption](/devzone/xml/docs/Reference/eBay/AddItem.html#Request.Item.ReturnPolicy.RefundOption) and [InternationalRefundOption](/devzone/xml/docs/Reference/eBay/AddItem.html#Request.Item.ReturnPolicy.InternationalRefundOption).
- **returnMethods** (array)
  - A list of return methods allowed for the associated category.  
  
**Note:** Depending on the API used to setup your return policy, available return methods are defined differently.

*   **Account v1 API**  
    When using [createReturnPolicy](/api-docs/sell/account/resources/return_policy/methods/createReturnPolicy) and [updateReturnPolicy](/api-docs/sell/account/resources/return_policy/methods/updateReturnPolicy) to create/manage business policies, use [returnMethod](/api-docs/sell/account/resources/return_policy/methods/updateReturnPolicy#request.returnMethod) and [internationalOverride.returnMethod](/api-docs/sell/account/resources/return_policy/methods/createReturnPolicy#request.internationalOverride.returnMethod) to specify the domestic and international return method, respectively, for the business policy.
- **returnPeriods** (array)
  - A list of return periods allowed for the associated category.  
  
**Note:** Depending on the API used to setup your return policy, return periods are defined differently.

*   **Account v1 API**  
    When using [createReturnPolicy](/api-docs/sell/account/resources/return_policy/methods/createReturnPolicy) and [updateReturnPolicy](/api-docs/sell/account/resources/return_policy/methods/updateReturnPolicy) to create/manage business policies, use the [returnPeriod](/api-docs/sell/account/resources/return_policy/methods/createReturnPolicy#request.returnPeriod) and [internationalOverride.returnPeriod](/api-docs/sell/account/resources/return_policy/methods/createReturnPolicy#request.internationalOverride.returnPeriod) containers to set the return period(s) for the business policy. You will use the supported values returned under the `returnPeriods` array in the **getReturnPolicies** response.
*   **Trading API or Sell Feed API**  
    When using legacy [ReturnPolicy](/devzone/xml/docs/Reference/eBay/AddItem.html#Request.Item.ReturnPolicy) fields, use [ReturnsWithinOption](/devzone/xml/docs/Reference/eBay/AddItem.html#Request.Item.ReturnPolicy.ReturnsWithinOption) and [InternationalReturnsWithinOption](/devzone/xml/docs/Reference/eBay/AddItem.html#Request.Item.ReturnPolicy.InternationalReturnsWithinOption) to pass in one of the supported enum values defined in [ReturnsWithinOptionsCodeType](/devzone/xml/docs/Reference/eBay/types/ReturnsWithinOptionsCodeType.html).  
      
    For example, if a value of **30** is returned in the [returnPeriods.value](/api-docs/sell/metadata/resources/marketplace/methods/getReturnPolicies#response.returnPolicies.domestic.returnPeriods.value) field of **getReturnPolicies**, use **Days\_30** in [ReturnsWithinOption](/devzone/xml/docs/Reference/eBay/AddItem.html#Request.Item.ReturnPolicy.ReturnsWithinOption) or [InternationalReturnsWithinOption](/devzone/xml/docs/Reference/eBay/AddItem.html#Request.Item.ReturnPolicy.InternationalReturnsWithinOption).
- **returnsAcceptanceEnabled** (boolean)
  - A value of `true` in this field indicates that return policies are applicable to the corresponding leaf category.  
  
**Note:** Depending on the API used to setup your return policy, whether or not you accept returns is configured as follows:

*   **Account v1 API**  
    When using [createReturnPolicy](/api-docs/sell/account/resources/return_policy/methods/createReturnPolicy) and [updateReturnPolicy](/api-docs/sell/account/resources/return_policy/methods/updateReturnPolicy) to create/manage business policies, use [returnsAccepted](/api-docs/sell/account/resources/return_policy/methods/createReturnPolicy#request.returnsAccepted) and [internationalOverride.returnsAccepted](/api-docs/sell/account/resources/return_policy/methods/updateReturnPolicy#request.internationalOverride.returnsAccepted) to indicate whether or not you accept returns.
*   **Trading API or Sell Feed API**  
    When using legacy [ReturnPolicy](/devzone/xml/docs/Reference/eBay/AddItem.html#Request.Item.ReturnPolicy) fields, use [ReturnsAcceptedOption](/devzone/xml/docs/Reference/eBay/AddItem.html#Request.Item.ReturnPolicy.ReturnsAcceptedOption) and [InternationalReturnsAcceptedOption](/devzone/xml/docs/Reference/eBay/AddItem.html#Request.Item.ReturnPolicy.InternationalReturnsAcceptedOption) to indicate whether or not you accept returns.
- **returnShippingCostPayers** (array)
  - A list of allowed values for who pays for the return shipping cost.  
  
Note that for SNAD returns, the seller is always responsible for the return shipping cost.  
  
**Note:** Depending on the API used to setup your return policy, specifiying that the buyer or seller is responsible for paying for return shipping costs is defined differently.

*   **Account v1 API**  
    When using [createReturnPolicy](/api-docs/sell/account/resources/return_policy/methods/createReturnPolicy) and [updateReturnPolicy](/api-docs/sell/account/resources/return_policy/methods/updateReturnPolicy) to create/manage business policies, use [returnShippingCostPayer](/api-docs/sell/account/resources/return_policy/methods/createReturnPolicy#request.returnShippingCostPayer) and [internationalOverride.returnShippingCostPayer](/api-docs/sell/account/resources/return_policy/methods/createReturnPolicy#request.internationalOverride.returnShippingCostPayer) to specify if the buyer or seller is responsible for paying return shipping charges for the business policy.
*   **Trading API or Sell Feed API**  
    When using legacy [ReturnPolicy](/devzone/xml/docs/Reference/eBay/AddItem.html#Request.Item.ReturnPolicy) fields, use [ShippingCostPaidByOption](/devzone/xml/docs/Reference/eBay/AddItem.html#Request.Item.ReturnPolicy.ShippingCostPaidByOption) and [InternationalShippingCostPaidByOption](/devzone/xml/docs/Reference/eBay/AddItem.html#Request.Item.ReturnPolicy.InternationalShippingCostPaidByOption) fields to specify if the buyer or seller is responsible for paying return shipping charges for the business policy.

### ReturnPolicyResponse
**Description:** This type defines the base response fields of the **getReturnPolicies** method.
**Type:** object

**Properties:**
- **returnPolicies** (array)
  - A list of elements, where each contains a category ID and a flag that indicates whether or not listings in that category require a return policy.
- **warnings** (array)
  - A list of the warnings that were generated as a result of the request. This field is not returned if no warnings were generated by the request.

### SalesTaxJurisdiction
**Description:** A unique ID for a sales tax jurisdiction.
**Type:** object

**Properties:**
- **salesTaxJurisdictionId** (string)
  - The unique ID for a sales-tax jurisdiction.  
  

**Important!** When `countryCode` is set to `US`, IDs for all 50 states, Washington, DC, and all US territories will be returned. However, the only `salesTaxJurisdictionId` values currently supported are:

*   `AS` (American Samoa)
*   `GU` (Guam
*   `MP` Northern Mariana Islands
*   `PW (Palau)`
*   `` `VI` (US Virgin Islands) ``

### SalesTaxJurisdictions
**Description:** This complex type contains a list of sales-tax jurisdictions.
**Type:** object

**Properties:**
- **salesTaxJurisdictions** (array)
  - A list of sales-tax jurisdictions.

### ShippingCarrier
**Description:** This type provides applicable shipping carrier metadata for the marketplace.
**Type:** object

**Properties:**
- **description** (string)
  - The localized description of the shipping carrier, such as `UPS`, `FedEx`, and `USPS`.
- **shippingCarrier** (string)
  - An enumerated value describing the shipping carrier returned, for example, `UPS`, `FedEx`, and `USPS`. These values are needed when providing shipment tracking information for each specific shipping carrier.

### ShippingCarrierResponse
**Description:** This type provides applicable shipping carrier metadata for returned for the marketplace.
**Type:** object

**Properties:**
- **shippingCarriers** (array)
  - A list of shipping carriers available for the marketplace.

### ShippingExcludeLocation
**Description:** This type provides applicable locations or region codes to be excluded set by the seller.
**Type:** object

**Properties:**
- **description** (string)
  - The localized location name.
- **location** (string)
  - The location or region to be excluded. Countries are returned through [ISO 3166 codes](https://www.iso.org/iso-3166-country-codes.html). This field may also include continents and other larger geographical regions (for example, the Middle East, Southeast Asia), as well as domestic/special locations (like APO/FPO, PO Box, Alaska/Hawaii). The values returned in this field are used in fulfillment business policies (such as in [regionName](/api-docs/sell/account/resources/fulfillment_policy/methods/createFulfillmentPolicy#request.shippingOptions.shippingServices.shipToLocations.regionExcluded.regionName)) or through the [ExcludeShipToLocation](/Devzone/XML/docs/Reference/eBay/AddItem.html#Request.Item.ShippingDetails.ExcludeShipToLocation) field in an **AddItem** call.
- **region** (string)
  - The region of the excluded shipping area specified, such as:  

*   `Africa`
*   `Americas`
*   `Asia`
*   `Central America and Caribbean`
*   `Europe`
*   `Middle East`
*   `North America`
*   `Oceania`
*   `South America`
*   `Southeast Asia`

### ShippingExcludeLocationResponse
**Description:** This type provides applicable locations or region codes to be excluded.
**Type:** object

**Properties:**
- **excludeShippingLocations** (array)
  - The complete list of geographical regions, countries, domestic areas, and special locations for the specified eBay marketplace that the seller has designated as excluded shipping locations.

### ShippingHandlingTime
**Description:** This type provides applicable shipping handling time metadata.
**Type:** object

**Properties:**
- **description** (string)
  - The localized description of the maximum handling time.
- **extendedHandling** (boolean)
  - This field is only returned if its value is `true`. If returned, it indicates that the corresponding handling time is considered extended handling for the marketplace. Extended handling times may be used for freight shipping, but should generally be avoided if possible, as they might adversely affect the buying decisions of potential customers.
- **maxHandlingTime** (integer)
  - The integer value returned in this field indicates the maximum number of business days that the eBay site allows as a seller's handling time measured from when the buyer pays for the order. For example, if the **maxHandlingTime** value is set to 1 and a buyer pays for the order on a Wednesday, the seller would have to ship the item by the next day (Thursday).  
  
A **maxHandlingTime** value of `0` indicates same day handling for an item. In this case, the seller's handling time commitment depends on the order cut off time set in the seller's user preferences. This defaults to 2:00 PM local time on most eBay sites. For orders placed (and cleared payment received) before the local order cut off time, the item must be shipped by the end of the current day. For orders completed on or after the order cut off time, the item must be shipped by the end of the following day (excluding weekends and local holidays).

### ShippingHandlingTimeResponse
**Description:** This type provides applicable shipping handling times returned for the specified marketplace.
**Type:** object

**Properties:**
- **handlingTimes** (array)
  - A list of supported handling times for the marketplace.

### ShippingLocation
**Description:** This type provides applicable shipping location metadata.
**Type:** object

**Properties:**
- **description** (string)
  - The localized location name.
- **shippingLocation** (string)
  - The name or abbreviation of the shipping location or region. Countries are returned through [ISO 3166 codes](https://www.iso.org/iso-3166-country-codes.html). This field may also include continents and other larger geographical regions (for example, the Middle East, Southeast Asia), as well as domestic/special locations (like APO/FPO, PO Box, Alaska/Hawaii). The values returned in this field are used in fulfillment business policies (such as in [regionName](/api-docs/sell/account/resources/fulfillment_policy/methods/createFulfillmentPolicy#request.shippingOptions.shippingServices.shipToLocations.regionExcluded.regionName)) or through the [ExcludeShipToLocation](/Devzone/XML/docs/Reference/eBay/AddItem.html#Request.Item.ShippingDetails.ExcludeShipToLocation) field in an **AddItem** call.

### ShippingLocationResponse
**Description:** This type provides applicable shipping location metadata returned.
**Type:** object

**Properties:**
- **shippingLocations** (array)
  - The complete list of geographical regions, countries, domestic areas, and special locations for the specified eBay marketplace that can be set as shipping locations.

### ShippingPoliciesResponse
**Description:** This type provides fields applicable for shipping policy metadata for the leaf categories returned for the marketplace.
**Type:** object

**Properties:**
- **shippingPolicies** (array)
  - This array contains applicable policy metadata for the leaf categories returned for the marketplace specified in the path parameter **marketplace\_id** and optionally limited by only those leaf category IDs specified in the query parameter **filter**.
- **warnings** (array)
  - An array of the warnings that were generated as a result of the request. This field is not returned if no warnings were generated by the request.

### ShippingPolicy
**Description:** This type contains applicable shipping policy metadata for the leaf categories returned for the marketplace.
**Type:** object

**Properties:**
- **categoryId** (string)
  - The unique identifier of the eBay leaf category for which metadata is being returned.
- **categoryTreeId** (string)
  - The unique identifier of the category tree.
- **globalShippingEnabled** (boolean)
  - Indicates if the Global Shipping Program (GSP) is supported for the category.

**Note:** GSP is only supported by the eBay UK marketplace (`EBAY_GB`).
- **group1MaxFlatShippingCost** (Amount)
  - Returns the applicable max cap per shipping cost for shipping service group1.
- **group2MaxFlatShippingCost** (Amount)
  - Returns the applicable max cap per shipping cost for shipping service group2.
- **group3MaxFlatShippingCost** (Amount)
  - Returns the applicable max cap per shipping cost for shipping service group3.
- **handlingTimeEnabled** (boolean)
  - Indicates if a seller's stated handling time is enabled for a category. A handling time is generally needed for items that are shipped to the buyer, but not necessarily applicable to freight shipping or local pickup.
- **maxFlatShippingCost** (Amount)
  - The maximum cost the seller can charge for the first domestic flat-rate shipping service. Mutually exclusive with the GroupNMaxFlatShippingCost elements.
- **shippingTermsRequired** (boolean)
  - Indicates whether the category requires sellers to specify shipping details at listing time.

### ShippingService
**Description:** This type provides applicable shipping service metadata.
**Type:** object

**Properties:**
- **description** (string)
  - This field returns the localized name of the shipping service.
- **internationalService** (boolean)
  - A value of `true` indicates that the shipping service is international. An international shipping service option is required if an item is being shipped from one country (origin) to another (destination).
- **maxShippingTime** (integer)
  - This value indicates the maximum number of business days that it takes the **shippingCarrier** to ship an item using the corresponding **shippingService**.
- **minShippingTime** (integer)
  - This value indicates the minimum number of business days that it takes the **shippingCarrier** to ship an item using the corresponding **shippingService**.
- **packageLimits** (PackageLimits)
  - This container provides name-value pairs that specify physical constraints and measurement units of packages for the **shippingCarrier** and the corresponding **shippingService**. An empty container is returned if the shipping service does not have any package limits defined.
- **shippingCarrier** (string)
  - The code for the shipping carrier returned, for example, `UPS`, `FedEx`, and `USPS`.
- **shippingCategory** (string)
  - The shipping category of the shipping service including: `ECONOMY`, `STANDARD`, `EXPEDITED`, `ONE_DAY`, `PICKUP`, and other similar categories.
- **shippingCostTypes** (array)
  - A list of shipping cost types that this shipping service option supports. For example, `FLAT_RATE`, `CALCULATED`, and `FREIGHT`.
- **shippingService** (string)
  - The name of the shipping service. The shipping service named here can only be used in listings or in business policies if **validForSellingFlow** is `true`. The value returned in this field is used in listing APIs and business policies to set the shipping service.
- **validForSellingFlow** (boolean)
  - A value of `true` indicates that the **shippingService** can be set as an available shipping service in the listing or through the fulfillment business policy.

### ShippingServiceResponse
**Description:** This type provides applicable shipping service metadata returned.
**Type:** object

**Properties:**
- **shippingServices** (array)
  - A complete list of shipping service options that can be used on the marketplace for shipping items.

### SignalWord
**Description:** A type that describes signal words for hazardous materials labels.
**Type:** object

**Properties:**
- **signalWordId** (string)
  - The identifier of the signal word. For more information, see [Signal word information](/api-docs/sell/static/metadata/feature-regulatorhazmatcontainer.html#Signal).
- **signalWordDescription** (string)
  - The description of the signal word localized to the default language of the marketplace. For more information, see [Signal word information](/api-docs/sell/static/metadata/feature-regulatorhazmatcontainer.html#Signal).

### SiteVisibilityPoliciesResponse
**Description:** A type that contains eBay international site visibility policy metadata fields.
**Type:** object

**Properties:**
- **siteVisibilityPolicies** (array)
  - This array contains applicable policy metadata for the leaf categories returned for the marketplace specified in the path parameter **marketplace\_id** and optionally limited by only those leaf category IDs specified in the query parameter **filter**.
- **warnings** (array)
  - An array of the warnings that were generated as a result of the request. This field is not returned if no warnings were generated by the request.

### SiteVisibilityPolicy
**Description:** A type that contains eBay international cross border trade policy metadata fields.
**Type:** object

**Properties:**
- **categoryId** (string)
  - The unique identifier of the eBay leaf category for which metadata is being returned.
- **categoryTreeId** (string)
  - The unique identifier of the category tree.
- **crossBorderTradeAustraliaEnabled** (boolean)
  - If `true`, the category supports specifying that listings of a seller on the UK marketplace can pass in Australia as a value in a field to expose that item on the eBay Australia site (ebay.com.au). For more information, see [Cross-border trading](/api-docs/user-guides/static/trading-user-guide/cross-border-trading.html).
- **crossBorderTradeGBEnabled** (boolean)
  - If `true`, the category supports specifying that listings of a seller on the US or Canada marketplaces can pass in UK as a value in a field to expose that item on the eBay UK (ebay.co.uk) and eBay IE (ebay.ie) sites. For more information, see [Cross-border trading](/api-docs/user-guides/static/trading-user-guide/cross-border-trading.html).
- **crossBorderTradeNorthAmericaEnabled** (boolean)
  - If `true`, the category supports specifying that listings of a seller on the US or Canada marketplaces can pass in North America as a value in a field to expose that item on the eBay US (ebay.com) and eBay Canada (ebay.ca) sites (English). For more information, see [Cross-border trading](/api-docs/user-guides/static/trading-user-guide/cross-border-trading.html).

### SortOrderInner
**Description:** This type is used to provide the sort order of compatibility properties returned in the response.
**Type:** object

**Properties:**
- **sortOrder** (SortOrderProperties)
  - This container is used to define the property to be used in the sorting.
- **sortPriority** (string)
  - The priority of the specified sort order provided.  
  
For example, when a property is assigned `Sort1`, its values are sorted first. Values for the property assigned `Sort2` are sorted second, and so on.  
  
**Valid values**:

*   `Sort1`
*   `Sort2`
*   `Sort3`
*   `Sort4`
*   `Sort5`

### SortOrderProperties
**Description:** This type is used to define the property to be used in sorting.
**Type:** object

**Properties:**
- **order** (string)
  - Defines the order of the sort.  
  
**Valid values**:

*   `Ascending`
*   `Descending`
- **propertyName** (string)
  - The name of the searchable property to be used for sorting.  
  
For example, typical vehicle property names are 'Make', 'Model', 'Year', 'Engine', and 'Trim', but will vary based on the eBay marketplace and the eBay category.

### SpecificationRequest
**Description:** This type provides the properties and specifications to use to search for compatibilities.
**Type:** object

**Properties:**
- **categoryId** (string)
  - The unique identifier of the eBay leaf category for which compatibility details are being retrieved. This category must be a valid eBay category on the specified eBay marketplace, and the category must support parts compatibility for cars, trucks, or motorcycles.  
  
Use the [getAutomotivePartsCompatibilityPolicies](/develop/api/sell/metadata_api#sell-metadata_api-marketplace%20-getautomotivepartscompatibilitypolicies) method to retrieve a list of categories that support parts compatibility by specification. For the categories in the response that support compatibility by specification, you’ll see `SPECIFICATIONS` as the value for the **compatibilityBasedOn** field
- **compatibilityPropertyFilters** (array)
  - This comma-delimited array can be used to restrict the number of compatible application name-value pairs returned in the response by specifying the properties that the seller wishes to be included in the response.  
  
Only compatible applications with the specified properties will be returned. Properties that can be specified here include make, model, year, and trim.
- **dataset** (string)
  - This field can be used to define the type of properties that will be returned in the response.  
  
For example, if you specify `Searchable`, the compatibility details will contain properties that can be used to search for products, such as make or model.  
  
**Note:** This field cannot be used alongside **dataPropertyName**. If both are used, an error will occur.  
**Valid values:**

*   `DisplayableProductDetails`: Properties for use in a user interface to describe products.
*   `DisplayableSearchResults`: Properties for use in results for product searches.
*   `Searchable`: Properties for use in searches.
*   `Sortable`: Properties that are suitable for sorting.

**Default value:** `DisplayableSearchResults`
- **datasetPropertyName** (array)
  - This comma-delimited array can be used to define the specific property name(s) that will be returned in the response.  
  
For example, if you specify `Engine`, the result set will only contain engines that are compatible with the input criteria.  
  
**Note:** This array cannot be used alongside **dataset**. If both are used, an error will occur.
- **exactMatch** (boolean)
  - This boolean can be used to specify that the compatibilities returned in the response are to be defined by an exact match on the input value of specification properties.  
  
By default, an expanded compatibility match is done when it applies, such as for Load Index, where a compatible vehicle is one that has a load index requirement that is less than or equal to the input. By specifying this field as `true`, only exact matches are returned.
- **paginationInput** (PaginationInput)
  - **Important!** Pagination is not yet supported by this method. If this container is included in the request, it will be ignored.
- **sortOrders** (array)
  - This array specifies the sorting order of the compatibility properties. Any of the searchable properties can be used to specify search order. Up to 5 levels of sort order may be specified.  
  
**Note:** If no sort order is specified through this field, the default sort order of **popularity descending** is applied.
- **specifications** (array)
  - This array defines the specifications of the part, in the form of name-value pairs, for which compatible applications will be retrieved.

### SpecificationResponse
**Description:** This type defines the fields used in the **getCompatibilitiesBySpecification** response.
**Type:** object

**Properties:**
- **compatibilityDetails** (array)
  - This container returns the list of all compatible application name-value pairs for the given filter criteria.
- **pagination** (Pagination)
  - **Important!** Not currently returned. For future use.

### TimeDuration
**Description:** A complex type that specifies a period of time using a specified time-measurement unit.
**Type:** object

**Properties:**
- **unit** (TimeDurationUnitEnum)
  - A time-measurement unit that specifies a singular period of time.  
  
A span of time is defined when you apply the value specified in the **value** field to the value specified for **unit**.  
  
Time-measurement units can be YEAR, MONTH, DAY, and so on. See **TimeDurationUnitEnum** for a complete list of possible time-measurement units.
- **value** (integer)
  - An integer that represents an amount of time, as measured by the time-measurement unit specified in the **unit** field.

### TimeDurationUnitEnum
**Description:** An enum value that specifies the time-measurement unit that's used to express a time span. | - **YEAR**: Time duration is based on a number of years. - **MONTH**: Time duration is based on a number of months - **DAY**: Time duration is based on a number of days. - **HOUR**: Time duration is based on a number of hours. - **CALENDAR_DAY**: Time duration is based on a number of calendar days, including Saturday and Sunday. This time duration does not exclude holidays. - **BUSINESS_DAY**: Time duration is based on a number of business days, or 'working days' (normally Monday through Friday). This excludes Sunday and all holidays in the time duration and, depending on the location, can include or exclude Saturday. - **MINUTE**: Time duration is based on a number of minutes. - **SECOND**: Time duration is based on a number of seconds. - **MILLISECOND**: Time duration is based on a number of milliseconds.
**Type:** object

### UsageEnum
**Description:** This enumeration type contains a list of usage values for using item conditions. Currently, the only supported value is `RESTRICTED`. | - **RESTRICTED**: This value indicates that the usage of the corresponding item condition in the corresponding category is restricted to users who are eligible to use that item condition in the category. `usage:RESTRICTED` applies to items with these conditions:

*   ConditionId 2000 (CERTIFIED\_REFURBISHED)
*   ConditionId 2010 (EXCELLENT\_REFURBISHED)
*   ConditionId 2020 (VERY\_GOOD\_REFURBISHED)
*   ConditionId 2030 (GOOD\_REFURBISHED)

**Note:** Condition IDs 2010, 2020, and 2030 are only usable in the category **Cell Phones & Smartphones - 9355**. These IDs will become available beginning September 1, 2021. Sellers must be pre-approved to use these item conditions.
**Type:** object

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
*Generated on 2026-05-12T20:28:09.788Z*
