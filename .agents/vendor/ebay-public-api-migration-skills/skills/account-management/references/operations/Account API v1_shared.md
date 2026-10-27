---
title: Account API v1
description: "The Account API v1 helps sellers configure and manage the core selling settings that power their eBay business. This API centralizes seller account configuration, including business policies (payment, fulfillment, and return), sales tax tables, custom compliance policies, and key account-level attributes like selling limits, subscriptions, and payments program status. Specifically, the API provides REST endpoints to create, update, and retrieve seller business policies, manage sales tax entries by jurisdiction, define and maintain custom policies, and access seller-level data such as advertising program eligibility, selling privileges and limits, managed payments onboarding status, and shipping rate tables. By externalizing these controls, partners and sellers can keep account settings consistent and reusable across listings, marketplaces, and tools. This API is exposed as a REST service under the `/sell/account/v1` base path. It uses standard HTTP methods and JSON payloads, allowing you to automate account configuration workflows, ensure listing policies stay in sync with your back-office systems, and build tools that keep eBay account settings aligned with your business rules. ### How to get started * Review the Account API v1 reference at: [https://developer.ebay.com/develop/api/account/api](https://developer.ebay.com/develop/api/account/api) * Sign in to your eBay developer account and use the API Explorer to exercise key operations like creating payment, fulfillment, and return policies, and retrieving existing policies and rate tables: [https://developer.ebay.com/my/api\\_test\\_tool](https://developer.ebay.com/my/api_test_tool) * Use the business policy IDs (paymentPolicyId, fulfillmentPolicyId, returnPolicyId) and rateTableId values returned by this API when creating or revising listings via the Selling APIs, so your listings always reference the correct account-level settings. * For marketplace- and category-specific constraints (for example, valid return periods or shipping regions), combine the Account API with the Metadata API to validate your configurations before applying them at scale. **NOTE:** The Account API v1 is part of the Sell APIs and is intended for managing account-level configuration, not for creating or revising individual listings. Use it together with listing-focused APIs (such as Inventory or Trading/Listing APIs) to ensure that all listings consistently follow your centralized payment, shipping, return, and tax policies across eBay marketplaces."
api_version: v1.9.3
api_name: account_api_v1
api_type: REST
api_group: account/api
source_url:
  html: https://developer.ebay.com/develop/api/account/api
  md: https://developer.ebay.com/develop/api/account/api.md
---
# Account API v1 API


## Types

### AdvertisingProgramEnum
**Description:** An enumerated type that defines the eBay advertising program for which a seller may be eligible. | - **PROMOTED_LISTINGS_STANDARD**: PROMOTED_LISTINGS_STANDARD - **PROMOTED_LISTINGS_ADVANCED**: PROMOTED_LISTINGS_ADVANCED - **OFFSITE_ADS**: OFFSITE_ADS
**Type:** object

### Amount
**Description:** A complex type that describes the value of a monetary amount as represented by a global currency. When passing in an amount in a request payload, both **currency** and **value** fields are required, and both fields are also always returned for an amount in a response field.
**Type:** object

**Properties:**
- **currency** (CurrencyCodeEnum)
  - The base currency applied to the **value** field to establish a monetary amount.  
  
The currency is represented as a 3-letter [ISO 4217](https://www.iso.org/iso-4217-currency-codes.html  "https://www.iso.org ") currency code. For example, the code for the Canadian Dollar is `CAD`.  
  
**Default:** The default currency of the eBay marketplace that hosts the listing.
- **value** (string)
  - The monetary amount in the specified **currency**.

### BulkSalesTaxInput
**Type:** object

**Properties:**
- **salesTaxInputList** (array)
  - The array of sales-tax table entries to be created or updated.

### CategoryType
**Description:** The category type discerns whether the policy applies to motor vehicle listings, or to any other items except motor vehicle listings.  
  
Each business policy can be associated with either or both categories ('MOTORS\_VEHICLES' and 'ALL\_EXCLUDING\_MOTORS\_VEHICLES'); however, return business policies are not applicable for motor vehicle listings.
**Type:** object

**Properties:**
- **default** (boolean)
  - **Note:** This field has been deprecated and is no longer used.

*   Do not include this field in any **create** or **update** method.
*   This field may be returned within the payload of a **get** method, but it can be ignored.
- **name** (CategoryTypeEnum)
  - The category type to which the policy applies (motor vehicles or non-motor vehicles).  
  
**Note:** The `MOTORS_VEHICLES` category type is not valid for return policies. eBay flows do not support the return of motor vehicles.

### CategoryTypeEnum
**Description:** An enum type that describes the category type (motor vehicles or non-motor vehicles). | - **MOTORS_VEHICLES**: MOTORS_VEHICLES - **ALL_EXCLUDING_MOTORS_VEHICLES**: ALL_EXCLUDING_MOTORS_VEHICLES
**Type:** object

### CompactCustomPolicyResponse
**Description:** The response payload for requests that return a list of custom policies.
**Type:** object

**Properties:**
- **customPolicyId** (string)
  - The unique custom policy identifier for the policy being returned.  
  
**Note:** This value is automatically assigned by the system when the policy is created.
- **label** (string)
  - Customer-facing label shown on View Item pages for items to which the policy applies. This seller-defined string is displayed as a system-generated hyperlink pointing to the seller's policy information.  
  
**Max length:** 65
- **name** (string)
  - The seller-defined name for the custom policy. Names must be unique for policies assigned to the same seller and policy type.  
  
**Note:** This field is visible only to the seller.  
**Max length:** 65
- **policyType** (CustomPolicyTypeEnum)
  - Specifies the type of Custom Policy being returned.

### CountryCodeEnum
**Description:** This enumerated type lists the two-letter [ISO 3166](https://www.iso.org/iso-3166-country-codes.html  "https://www.iso.org ") code representing a country. | - **AD**: AD - **AE**: AE - **AF**: AF - **AG**: AG - **AI**: AI - **AL**: AL - **AM**: AM - **AN**: AN - **AO**: AO - **AQ**: AQ - **AR**: AR - **AS**: AS - **AT**: AT - **AU**: AU - **AW**: AW - **AX**: AX - **AZ**: AZ - **BA**: BA - **BB**: BB - **BD**: BD - **BE**: BE - **BF**: BF - **BG**: BG - **BH**: BH - **BI**: BI - **BJ**: BJ - **BL**: BL - **BM**: BM - **BN**: BN - **BO**: BO - **BQ**: BQ - **BR**: BR - **BS**: BS - **BT**: BT - **BV**: BV - **BW**: BW - **BY**: BY - **BZ**: BZ - **CA**: CA - **CC**: CC - **CD**: CD - **CF**: CF - **CG**: CG - **CH**: CH - **CI**: CI - **CK**: CK - **CL**: CL - **CM**: CM - **CN**: CN - **CO**: CO - **CR**: CR - **CU**: CU - **CV**: CV - **CW**: CW - **CX**: CX - **CY**: CY - **CZ**: CZ - **DE**: DE - **DJ**: DJ - **DK**: DK - **DM**: DM - **DO**: DO - **DZ**: DZ - **EC**: EC - **EE**: EE - **EG**: EG - **EH**: EH - **ER**: ER - **ES**: ES - **ET**: ET - **FI**: FI - **FJ**: FJ - **FK**: FK - **FM**: FM - **FO**: FO - **FR**: FR - **GA**: GA - **GB**: GB - **GD**: GD - **GE**: GE - **GF**: GF - **GG**: GG - **GH**: GH - **GI**: GI - **GL**: GL - **GM**: GM - **GN**: GN - **GP**: GP - **GQ**: GQ - **GR**: GR - **GS**: GS - **GT**: GT - **GU**: GU - **GW**: GW - **GY**: GY - **HK**: HK - **HM**: HM - **HN**: HN - **HR**: HR - **HT**: HT - **HU**: HU - **ID**: ID - **IE**: IE - **IL**: IL - **IM**: IM - **IN**: IN - **IO**: IO - **IQ**: IQ - **IR**: IR - **IS**: IS - **IT**: IT - **JE**: JE - **JM**: JM - **JO**: JO - **JP**: JP - **KE**: KE - **KG**: KG - **KH**: KH - **KI**: KI - **KM**: KM - **KN**: KN - **KP**: KP - **KR**: KR - **KW**: KW - **KY**: KY - **KZ**: KZ - **LA**: LA - **LB**: LB - **LC**: LC - **LI**: LI - **LK**: LK - **LR**: LR - **LS**: LS - **LT**: LT - **LU**: LU - **LV**: LV - **LY**: LY - **MA**: MA - **MC**: MC - **MD**: MD - **ME**: ME - **MF**: MF - **MG**: MG - **MH**: MH - **MK**: MK - **ML**: ML - **MM**: MM - **MN**: MN - **MO**: MO - **MP**: MP - **MQ**: MQ - **MR**: MR - **MS**: MS - **MT**: MT - **MU**: MU - **MV**: MV - **MW**: MW - **MX**: MX - **MY**: MY - **MZ**: MZ - **NA**: NA - **NC**: NC - **NE**: NE - **NF**: NF - **NG**: NG - **NI**: NI - **NL**: NL - **NO**: NO - **NP**: NP - **NR**: NR - **NU**: NU - **NZ**: NZ - **OM**: OM - **PA**: PA - **PE**: PE - **PF**: PF - **PG**: PG - **PH**: PH - **PK**: PK - **PL**: PL - **PM**: PM - **PN**: PN - **PR**: PR - **PS**: PS - **PT**: PT - **PW**: PW - **PY**: PY - **QA**: QA - **RE**: RE - **RO**: RO - **RS**: RS - **RU**: RU - **RW**: RW - **SA**: SA - **SB**: SB - **SC**: SC - **SD**: SD - **SE**: SE - **SG**: SG - **SH**: SH - **SI**: SI - **SJ**: SJ - **SK**: SK - **SL**: SL - **SM**: SM - **SN**: SN - **SO**: SO - **SR**: SR - **ST**: ST - **SV**: SV - **SX**: SX - **SY**: SY - **SZ**: SZ - **TC**: TC - **TD**: TD - **TF**: TF - **TG**: TG - **TH**: TH - **TJ**: TJ - **TK**: TK - **TL**: TL - **TM**: TM - **TN**: TN - **TO**: TO - **TR**: TR - **TT**: TT - **TV**: TV - **TW**: TW - **TZ**: TZ - **UA**: UA - **UG**: UG - **UM**: UM - **US**: US - **UY**: UY - **UZ**: UZ - **VA**: VA - **VC**: VC - **VE**: VE - **VG**: VG - **VI**: VI - **VN**: VN - **VU**: VU - **WF**: WF - **WS**: WS - **YE**: YE - **YT**: YT - **ZA**: ZA - **ZM**: ZM - **ZW**: ZW
**Type:** object

### CurrencyCodeEnum
**Description:** This enumerated type lists the three-letter [ISO 4217](https://www.iso.org/iso-4217-currency-codes.html  "https://www.iso.org ") codes representing the supported world currencies. | - **AED**: AED - **AFN**: AFN - **ALL**: ALL - **AMD**: AMD - **ANG**: ANG - **AOA**: AOA - **ARS**: ARS - **AUD**: AUD - **AWG**: AWG - **AZN**: AZN - **BAM**: BAM - **BBD**: BBD - **BDT**: BDT - **BGN**: BGN - **BHD**: BHD - **BIF**: BIF - **BMD**: BMD - **BND**: BND - **BOB**: BOB - **BRL**: BRL - **BSD**: BSD - **BTN**: BTN - **BWP**: BWP - **BYR**: BYR - **BZD**: BZD - **CAD**: CAD - **CDF**: CDF - **CHF**: CHF - **CLP**: CLP - **CNY**: CNY - **COP**: COP - **CRC**: CRC - **CUP**: CUP - **CVE**: CVE - **CZK**: CZK - **DJF**: DJF - **DKK**: DKK - **DOP**: DOP - **DZD**: DZD - **EGP**: EGP - **ERN**: ERN - **ETB**: ETB - **EUR**: EUR - **FJD**: FJD - **FKP**: FKP - **GBP**: GBP - **GEL**: GEL - **GHS**: GHS - **GIP**: GIP - **GMD**: GMD - **GNF**: GNF - **GTQ**: GTQ - **GYD**: GYD - **HKD**: HKD - **HNL**: HNL - **HRK**: HRK - **HTG**: HTG - **HUF**: HUF - **IDR**: IDR - **ILS**: ILS - **INR**: INR - **IQD**: IQD - **IRR**: IRR - **ISK**: ISK - **JMD**: JMD - **JOD**: JOD - **JPY**: JPY - **KES**: KES - **KGS**: KGS - **KHR**: KHR - **KMF**: KMF - **KPW**: KPW - **KRW**: KRW - **KWD**: KWD - **KYD**: KYD - **KZT**: KZT - **LAK**: LAK - **LBP**: LBP - **LKR**: LKR - **LRD**: LRD - **LSL**: LSL - **LTL**: LTL - **LYD**: LYD - **MAD**: MAD - **MDL**: MDL - **MGA**: MGA - **MKD**: MKD - **MMK**: MMK - **MNT**: MNT - **MOP**: MOP - **MRO**: MRO - **MUR**: MUR - **MVR**: MVR - **MWK**: MWK - **MXN**: MXN - **MYR**: MYR - **MZN**: MZN - **NAD**: NAD - **NGN**: NGN - **NIO**: NIO - **NOK**: NOK - **NPR**: NPR - **NZD**: NZD - **OMR**: OMR - **PAB**: PAB - **PEN**: PEN - **PGK**: PGK - **PHP**: PHP - **PKR**: PKR - **PLN**: PLN - **PYG**: PYG - **QAR**: QAR - **RON**: RON - **RSD**: RSD - **RUB**: RUB - **RWF**: RWF - **SAR**: SAR - **SBD**: SBD - **SCR**: SCR - **SDG**: SDG - **SEK**: SEK - **SGD**: SGD - **SHP**: SHP - **SLL**: SLL - **SOS**: SOS - **SRD**: SRD - **STD**: STD - **SYP**: SYP - **SZL**: SZL - **THB**: THB - **TJS**: TJS - **TMT**: TMT - **TND**: TND - **TOP**: TOP - **TRY**: TRY - **TTD**: TTD - **TWD**: TWD - **TZS**: TZS - **UAH**: UAH - **UGX**: UGX - **USD**: USD - **UYU**: UYU - **UZS**: UZS - **VEF**: VEF - **VND**: VND - **VUV**: VUV - **WST**: WST - **XAF**: XAF - **XCD**: XCD - **XOF**: XOF - **XPF**: XPF - **YER**: YER - **ZAR**: ZAR - **ZMW**: ZMW - **ZWL**: ZWL
**Type:** object

### CustomPolicy
**Description:** This container defines a seller's custom policy identified by policy ID for the selected eBay marketplace. A successful call returns the requested policy information.
**Type:** object

**Properties:**
- **customPolicyId** (string)
  - The unique custom policy identifier for a policy.
- **description** (string)
  - Contains the seller's policy and policy terms. Buyers access this information from the View Item page for items to which the policy has been applied.  
  
**Max length:** 15,000
- **label** (string)
  - Customer-facing label shown on View Item pages for items to which the policy applies. This seller-defined string is displayed as a system-generated hyperlink pointing to the seller's policy information.  
  
**Max length:** 65
- **name** (string)
  - The seller-defined name for the custom policy. Names must be unique for policies assigned to the same seller and policy type.  
  
**Note:** This field is visible only to the seller.  
**Max length:** 65
- **policyType** (CustomPolicyTypeEnum)
  - Specifies the type of Custom Policy being returned.

### CustomPolicyCreateRequest
**Description:** This type is used by the request payload of the createCustomPolicy method to define a new custom policy for a specific marketplace.
**Type:** object

**Properties:**
- **description** (string)
  - Contains the seller's policy and policy terms.  
  
**Max length:** 15,000
- **label** (string)
  - Customer-facing label shown on View Item pages for items to which the policy applies. This seller-defined string is displayed as a system-generated hyperlink pointing to the seller's policy information.  
  
**Max length:** 65
- **name** (string)
  - The seller-defined name for the custom policy. Names must be unique for policies assigned to the same seller and policy type.  
  
**Note:** This field is visible only to the seller.  
**Max length:** 65
- **policyType** (CustomPolicyTypeEnum)
  - Specifies the type of custom policy being created.  
  
Two Custom Policy types are supported:

*   Product Compliance (PRODUCT\_COMPLIANCE)
*   Takeback (TAKE\_BACK)

### CustomPolicyRequest
**Type:** object

**Properties:**
- **description** (string)
  - Contains the seller specified policy and policy terms.  
  
**Note:** Always supply this field. If this field is not specified, any previous value is removed. Call the [getCustomPolicy](/api-docs/sell/account/resources/custom_policy/methods/getCustomPolicy) method to return the present field value for this policy.  
**Max length:** 15,000
- **label** (string)
  - Customer-facing label shown on View Item pages for items to which the policy applies. This seller-defined string is displayed as a system-generated hyperlink pointing to seller specified policy information.  
  
**Note:** Always supply this field. If this field is not specified, any previous value is removed. Call the [getCustomPolicy](/api-docs/sell/account/resources/custom_policy/methods/getCustomPolicy) method to return the present field value for this policy.  
**Max length:** 65
- **name** (string)
  - The seller-defined name for the custom policy. Names must be unique for policies assigned to the same seller and policy type.  
  
**Note:** This field is visible only to the seller.  
  
**Note:** Always supply this field. If this field is not specified, any previous value is removed. Call the [getCustomPolicy](/api-docs/sell/account/resources/custom_policy/methods/getCustomPolicy) method to return the present field value for this policy.  
**Max length:** 65

### CustomPolicyResponse
**Type:** object

**Properties:**
- **customPolicies** (array)
  - This array contains the custom policies that match the input criteria.
- **href** (string)
  - _This field is for future use._
- **limit** (integer)
  - _This field is for future use._
- **next** (string)
  - _This field is for future use._
- **offset** (integer)
  - _This field is for future use._
- **prev** (string)
  - _This field is for future use._
- **total** (integer)
  - _This field is for future use._

### CustomPolicyTypeEnum
**Description:** An enumeration type that defines the supported types of Custom Policies. | - **PRODUCT_COMPLIANCE**: PRODUCT_COMPLIANCE - **TAKE_BACK**: TAKE_BACK
**Type:** object

### Deposit
**Description:** This type is used to specify/indicate that an initial deposit is required for a motor vehicle listing.
**Type:** object

**Properties:**
- **amount** (Amount)
  - This value indicates the initial deposit amount required from the buyer in order to purchase a motor vehicle. This value can be as high as $2,000.00 if immediate payment is not required, and up to $500.00 if immediate payment is required.  
  
**Max**: `2000.0`
- **dueIn** (TimeDuration)
  - This value indicates the number of hours that the buyer has (after they commit to buy) to pay the initial deposit on a motor vehicle. Valid **dueIn** times are 24, 48, and 72 hours. `HOUR` is set as the **unit** value, and `24`, `48` or `72` are set in the **value** field.  
  
**Note**: The **dueIn** value is overridden if the seller has set the motor vehicle listing to require immediate payment. If the listing requires immediate payment, the buyer must pay the deposit immediately in order to be eligible to purchase the motor vehicle.  
  
**Min**\=24 (hours)**Max**\=72 (hours), **Default**\=48 (hours)
- **paymentMethods** (array)
  - This array is no longer applicable and should not be used since eBay now manages the electronic payment options available to buyers to pay the deposit.

### DetailsType
**Description:** This enumerated type lists the types of details that may be needed for a KYC check. | - **COMPANY_DETAILS**: COMPANY_DETAILS - **INDIVIDUAL_DETAILS**: INDIVIDUAL_DETAILS - **BANK_DETAILS**: BANK_DETAILS
**Type:** object

### Error
**Description:** This type defines the fields that can be returned in an error.
**Type:** object

**Properties:**
- **category** (string)
  - Identifies the type of erro.
- **domain** (string)
  - Name for the primary system where the error occurred. This is relevant for application errors.
- **errorId** (integer)
  - A unique number to identify the error.
- **inputRefIds** (array)
  - An array of request elements most closely associated to the error.
- **longMessage** (string)
  - A more detailed explanation of the error.
- **message** (string)
  - Information on how to correct the problem, in the end user's terms and language where applicable.
- **outputRefIds** (array)
  - An array of request elements most closely associated to the error.
- **parameters** (array)
  - An array of name/value pairs that describe details the error condition. These are useful when multiple errors are returned.
- **subdomain** (string)
  - Further helps indicate which subsystem the error is coming from. System subcategories include: Initialization, Serialization, Security, Monitoring, Rate Limiting, etc.

### ErrorDetailV3
**Description:** A container that defines the elements of error and warning messages.
**Type:** object

**Properties:**
- **category** (string)
  - The category type for this error or warning. It is a string that can have one of three values:

*   `Application`: Indicates an exception or error occurred in the application code or at runtime. Examples include catching an exception in a service's business logic, system failures, or request errors from a dependency.
*   `Business`: Used when your service or a dependent service refused to continue processing on the resource because of a business rule violation such as "Seller does not ship item to Antarctica" or "Buyer ineligible to purchase an alcoholic item". Business errors are not syntactical input errors.
*   `Request`: Used when there is anything wrong with the request, such as authentication, syntactical errors, rate limiting or missing headers, bad HTTP header values, and so on.
- **domain** (string)
  - Name of the domain ,or primary system, of the service or application where the error occurred.
- **errorId** (integer)
  - A positive integer that uniquely identifies the specific error condition that occurred. Your application can use error codes as identifiers in your customized error-handling algorithms.
- **inputRefIds** (array)
  - Identifies specific request elements associated with the error, if any. inputRefId's response is format specific. For JSON, use _JSONPath_ notation.
- **longMessage** (string)
  - A more detailed explanation of the error than given in the `message` error field.
- **message** (string)
  - Information on how to correct the problem, in the end user's terms and language where applicable. Its value is at most 50 characters long. If applicable, the value is localized in the end user's requested locale.
- **outputRefIds** (array)
  - Identifies specific response elements associated with the error, if any. Path format is the same as `inputRefId`.
- **parameters** (array)
  - This optional list of name/value pairs that contain context-specific `ErrorParameter` objects, with each item in the list being a parameter (or input field name) that caused an error condition. Each `ErrorParameter` object consists of two fields, a `name` and a `value`.
- **subdomain** (string)
  - If present, indicates the subsystem in which the error occurred.

### ErrorParameter
**Type:** object

**Properties:**
- **name** (string)
  - The object of the error.
- **value** (string)
  - The value of the object.

### ErrorParameterV3
**Description:** A complex type that indicates a parameter that caused an error and the value of the parameter which caused the error.
**Type:** object

**Properties:**
- **name** (string)
  - Name of the parameter that caused the error.
- **value** (string)
  - The value of the parameter that caused the error.

### FulfillmentPolicy
**Description:** This type is used by the **fulfillmentPolicy** response container, a container which defines a seller's fulfillment policy for a specific marketplace.
**Type:** object

**Properties:**
- **categoryTypes** (array)
  - This container indicates whether the fulfillment policy applies to motor vehicle listings, or if it applies to non-motor vehicle listings.
- **description** (string)
  - A seller-defined description of the fulfillment policy. This description is only for the seller's use, and is not exposed on any eBay pages. This field is returned if set for the policy.  
  
**Max length**: 250
- **freightShipping** (boolean)
  - If returned as `true`, the seller offers freight shipping. Freight shipping can be used for large items over 150 lbs.
- **fulfillmentPolicyId** (string)
  - A unique eBay-assigned ID for the fulfillment policy. This ID is generated when the policy is created.
- **globalShipping** (boolean)
  - **Note**: This field is only applicable for the eBay United Kingdom marketplace (`EBAY_GB`).  
If returned as `true`, eBay's Global Shipping Program will be used by the seller to ship items to international locations.  
  
eBay International Shipping is an account level setting; no field needs to be set in a Fulfillment business policy to enable eBay International Shipping. If a US seller's account is opted in to eBay International Shipping, this shipping option will be enabled automatically for all listings where international shipping is available. A US seller who is opted in to eBay International Shipping can also specify individual international shipping service options for a Fulfillment business policy.
- **handlingTime** (TimeDuration)
  - Specifies the maximum number of business days the seller commits to for preparing and shipping an order after receiving a cleared payment for the order. This time does not include the transit time it takes the shipping carrier to deliver the order.

If only local pickup or freight shipping is available for the item, this container may not get returned.
- **localPickup** (boolean)
  - If returned as `true`, local pickup is available for this policy.
- **marketplaceId** (MarketplaceIdEnum)
  - The ID of the eBay marketplace to which this fulfillment policy applies.
- **name** (string)
  - A seller-defined name for this fulfillment policy. Names must be unique for policies assigned to the same marketplace.  
  
**Max length**: 64
- **pickupDropOff** (boolean)
  - If returned as `true`, the seller offers the "Click and Collect" option.  
  
Currently, "Click and Collect" is available only to large retail merchants the eBay AU, UK, DE, FR, and IT marketplaces.
- **shippingOptions** (array)
  - This array is used to provide detailed information on the domestic and international shipping options available for the policy. A separate **ShippingOption** object covers domestic shipping service options and international shipping service options (if the seller ships to international locations).  
  
The **optionType** field indicates whether the **ShippingOption** object applies to domestic or international shipping, and the **costType** field indicates whether flat-rate shipping or calculated shipping will be used.

A separate **ShippingServices** object is used to specify cost and other details for every available domestic and international shipping service option.
- **shipToLocations** (RegionSet)
  - This container consists of the **regionIncluded** and **regionExcluded** containers, which define the geographical regions/countries/states or provinces/domestic regions where the seller does and doesn't ship to with this fulfillment policy.

### FulfillmentPolicyRequest
**Description:** This root container defines a seller's fulfillment policy for a specific marketplace and category group. This type is used when creating or updating a fulfillment business policy.
**Type:** object

**Properties:**
- **categoryTypes** (array)
  - This container is used to specify whether the fulfillment business policy applies to motor vehicle listings, or if it applies to non-motor vehicle listings.
- **description** (string)
  - A seller-defined description of the fulfillment policy. This description is only for the seller's use, and is not exposed on any eBay pages.  
  
**Max length**: 250
- **freightShipping** (boolean)
  - This field is included and set to `true` if freight shipping is available for the item. Freight shipping can be used for large items over 150 lbs.  
  
**Default**: false
- **globalShipping** (boolean)
  - **Note**: This field is only applicable for the eBay United Kingdom marketplace (`EBAY_GB`).  
This field is included and set to `true` if the seller wants to use the Global Shipping Program for international shipments. See the [Global Shipping Program](https://pages.ebay.com/help/sell/shipping-globally.html ) help topic for more details and requirements on the Global Shipping Program.  
  
A seller can use a combination of the Global Shipping Program and other international shipping services.  
  
If set to `false` or if the field is omitted, the seller has to manually specifying individual international shipping services (if the seller ships internationally), as described in [Setting up worldwide shipping](https://developer.ebay.com/api-docs/sell/static/seller-accounts/ht_shipping-worldwide.html ).  
  
Sellers opt in or out of the Global Shipping Program through the Shipping preferences in My eBay.  
  
eBay International Shipping is an account level setting; no field needs to be set in a Fulfillment business policy to enable eBay International Shipping. If a US seller's account is opted in to eBay International Shipping, this shipping option will be enabled automatically for all listings where international shipping is available. A US seller who is opted in to eBay International Shipping can also specify individual international shipping service options for a Fulfillment business policy.

**Default**: false
- **handlingTime** (TimeDuration)
  - This container is used to specify the maximum number of business days the seller commits to for preparing and shipping an order after receiving a cleared payment for the order. This time does not include the transit time it takes the shipping carrier to deliver the order.  
  
Valid values can vary by site and by category. To obtain the supported values for a site, call [GeteBayDetails](/devzone/xml/docs/reference/ebay/GeteBayDetails.html) in the Trading API with **DetailName** set to `DispatchTimeMaxDetails`, then inspect the **DispatchTimeMaxDetails** container in the response for the time values supported by the site (typical handling times are `0`, `1`, `2`, `3`, `4`, `5`, `10`, `15`, and `20`, but these can vary by site and may change over time.)

This field is conditionally required when the seller is offering one or more domestic or international shipping options, but it is not applicable when the item is only available through local pickup (`"localPickup": "true"`), or if it will be shipped through a freight shipping service (`"freightShipping": "true"`).

**Note:** Top-Rated sellers must offer same-day or one-day handling for a listing in order for that listing to receive a Top Rated Plus seal on the View Item or Search Results pages. To offer zero-day or one-day handling, set field to '0' or '1', respectively.
- **localPickup** (boolean)
  - This field should be included and set to `true` if local pickup is one of the fulfillment options available to the buyer. It is possible for the seller to make local pickup and some shipping service options available to the buyer.  
  
With local pickup, the buyer and seller make arrangements for pickup time and location.  
  
**Default**: `false`
- **marketplaceId** (MarketplaceIdEnum)
  - The ID of the eBay marketplace to which this fulfillment policy applies.
- **name** (string)
  - A seller-defined name for this fulfillment policy. Names must be unique for policies assigned to the same marketplace.  
  
**Max length**: 64
- **pickupDropOff** (boolean)
  - This field should be included and set to `true` if the seller offers the "Click and Collect" feature for an item.

To enable "Click and Collect" on a listing, a seller must be eligible for Click and Collect. Currently, Click and Collect is available to only large retail merchants selling in the eBay AU, UK, DE, FR, and IT marketplaces.

In addition to setting this field to `true`, the merchant must also do the following to enable the "Click and Collect" option on a listing:

*   Have inventory for the product at one or more physical stores tied to the merchant's account.
    
    Sellers can use the **createInventoryLocation** method in the Inventory API to associate physical stores to their account and they can then add inventory to specific store locations.
    
*   Set an immediate payment requirement on the item. The immediate payment feature requires the seller to:
    *   Set the **immediatePay** flag in the payment policy to 'true'.
    *   Have a valid store location with a complete street address.

When a merchant successfully lists an item with Click and Collect, prospective buyers within a reasonable distance from one of the merchant's stores (that has stock available) will see the "Available for Click and Collect" option on the listing, along with information on the closest store that has the item.

**Default**: false
- **shippingOptions** (array)
  - This array is used to provide detailed information on the domestic and international shipping options available for the policy.  
  
A separate **ShippingOption** object is required for domestic shipping service options and for international shipping service options (if the seller ships to international locations).

*   The **optionType** field is used to indicate whether the **ShippingOption** object applies to domestic or international shipping, and the **costType** field is used to indicate whether flat-rate shipping or calculated shipping will be used.
*   The **rateTableId** field can be used to associate a defined shipping rate table to the policy, and the **packageHandlingCost** container can be used to set a handling charge for the policy.

A separate **ShippingServices** object will be used to specify cost and other details for every available domestic and international shipping service option.
- **shipToLocations** (RegionSet)
  - This container consists of the **regionIncluded** and **regionExcluded** arrays, which are used to define the geographical regions/countries/states or provinces/domestic regions that a seller does and does not ship to for the associated fulfillment policy. Note that this container can be considered the master list of where the seller ships and does not ship, but there is also a **shipToLocations** container that can be set at the shipping service option level.  
  
**Note:** Any shipping exclusions specified through this container can be overridden by the eBay International Shipping exclusions toggle located under **Shipping Preferences** in **My eBay**. For more information on eBay International Shipping, see [eBay International Shipping program](https://www.ebay.com/help/selling/shipping-items/setting-shipping-options/ebay-international-shipping-program?id=5348).  
To retrieve the valid geographical shipping region values, two-digit country values, or special domestic regions for an eBay marketplace, call [GeteBayDetails](/devzone/xml/docs/reference/ebay/GeteBayDetails.html) with **DetailName** value set to `ExcludeShippingLocationDetails`, then review the **ExcludeShippingLocationDetails** containers in the response for the strings you use in both the **regionIncluded.regionName** and in the **regionExcluded.regionName** fields.  
  
For valid geographical region names, look for the `ExcludeShippingLocationDetails` containers in the **GeteBayDetails** response where the **Region** value is `Worldwide`, and the valid values will be shown in the corresponding **Location** fields.  
  
For valid two-digit country codes, look for `ExcludeShippingLocationDetails` in the **GeteBayDetails** response where the **Region** value is one of the defined geographical regions, and the valid values will be shown in the corresponding **Location** fields. Alternatively, you can find the two-digit country code values in the [CountryCodeEnum](/api-docs/sell/account/types/ba:CountryCodeEnum) type definition. For valid domestic region values, look for `ExcludeShippingLocationDetails` in the **GeteBayDetails** response where the **Region** value is either `Domestic Location` or `Additional Locations`, and the valid values will be shown in the corresponding **Location** fields.  
  
The `STATE_OR_PROVINCE` region type is only applicable to the US and Canada, and valid values for US states are the same [two-digit abbreviations](https://about.usps.com/who-we-are/postal-history/state-abbreviations.htm ) used by the United States Postal Service, and valid values for Canadian provinces and territories are the same [two-digit abbreviations](https://www.canadapost-postescanada.ca/cpc/en/support/articles/addressing-guidelines/symbols-and-abbreviations.page ) used by the Canada Post.

### FulfillmentPolicyResponse
**Description:** The response payload for the **getFulfillmentPolicies** method.  
  
**Note**: Pagination has not yet been enabled for **getFulfillmentPolicies**, so all of the pagination-related fields are for future use.
**Type:** object

**Properties:**
- **fulfillmentPolicies** (array)
  - A list of all of the seller's fulfillment policies defined for the specified marketplace. This array will be returned as empty if no fulfillment policies are defined for the specified marketplace.
- **href** (string)
  - This field is for future use.
- **limit** (integer)
  - This field is for future use.
- **next** (string)
  - This field is for future use.
- **offset** (integer)
  - This field is for future use.
- **prev** (string)
  - This field is for future use.
- **total** (integer)
  - The total number of fulfillment policies retrieved in the result set.  
  
If no fulfillment policies are defined for the specified marketplace, this field is returned with a value of `0`.

### InternationalReturnOverrideType
**Description:** This type defines the fields for a seller's international return policy. Sellers have the ability to set separate domestic and international return policies, but if an international return policy is not set, the same return policy settings specified for the domestic return policy are also used for returns for international buyers.
**Type:** object

**Properties:**
- **returnMethod** (ReturnMethodEnum)
  - This field sets/indicates if the seller offers replacement items to the buyer in the case of an international return. The buyer must be willing to accept a replacement item; otherwise, the seller will need to issue a refund for a return.
- **returnPeriod** (TimeDuration)
  - This container indicates the number of calendar days that the buyer has to return an item. The return period begins when the item is marked "delivered" at the buyer's specified ship-to location.  
  
You must set the value to one that's accepted by the marketplace and category where the item is listed. Most categories support 30-day and 60-day return periods. For a definitive list of return periods for one or more categories, call [getReturnPolicies](/api-docs/sell/metadata/resources/marketplace/methods/getReturnPolicies) method of the **Metadata API**.  
  
The **TimeDuration** type is used to set/indicate the return period, and you set the **unit** value to `DAY` and the **value** field to either `30` or `60` (or other value, as appropriate).  
  
Note that this value cannot be modified if the listing has bids or sales, or if the listing ends within 12 hours.  
  
This field is conditionally required if the **internationalOverride.returnsAccepted** field is set to `true`.
- **returnsAccepted** (boolean)
  - If set to `true`, the seller accepts international returns. If set to `false`, the seller does not accept international returns.  
  
This field is conditionally required if the seller chooses to have a separate international return policy.
- **returnShippingCostPayer** (ReturnShippingCostPayerEnum)
  - This field indicates who is responsible for paying for the shipping charges for returned items. The field can be set to either `BUYER` or `SELLER`.  
  
Depending on the return policy and specifics of the return, either the buyer or the seller can be responsible for the return shipping costs. Note that the seller is always responsible for return shipping costs for 'significantly not as described' (SNAD) issues.  
  
This field is conditionally required if the **internationalOverride.returnsAccepted** field is set to `true`.

### KycCheck
**Description:** This type is used to provide details about any KYC check that is applicable to the managed payments seller.
**Type:** object

**Properties:**
- **dataRequired** (DetailsType)
  - The enumeration value returned in this field categorizes the type of details needed for the KYC check. More information about the check is shown in the **detailMessage** and other applicable, corresponding fields.
- **dueDate** (string)
  - The timestamp in this field indicates the date by which the seller should resolve the KYC requirement.  
  
The timestamp in this field uses the UTC date and time format described in the [ISO 8601 Standard](https://www.iso.org/iso-8601-date-and-time-format.html). See below for this format and an example:  
  
_MM-DD-YYYY HH:MM:SS_  
`06-05-2020 10:34:18`
- **remedyUrl** (string)
  - If applicable and available, a URL will be returned in this field, and the link will take the seller to an eBay page where they can provide the requested information.
- **alert** (string)
  - This field gives a short summary of what is required from the seller. An example might be, '`Upload bank document now.`'. The **detailMessage** field will often provide more details on what is required of the seller.
- **detailMessage** (string)
  - This field gives a detailed message about what is required from the seller. An example might be, '`Please upload a bank document by 2020-08-01 to get your account back in good standing.`'.

### KycResponse
**Description:** This is the base response type of the **getKYC** method.
**Type:** object

**Properties:**
- **kycChecks** (array)
  - This array contains one or more KYC checks required from a managed payments seller. The seller may need to provide more documentation and/or information about themselves, their company, or the bank account they are using for seller payouts.  
  
If no KYC checks are currently required from the seller, this array is not returned, and the seller only receives a `204 No Content` HTTP status code.

### MarketplaceIdEnum
**Description:** This enumerated type defines the unique eBay-assigned IDs for each of the eBay marketplaces. | - **EBAY_AT**: EBAY_AT - **EBAY_AU**: EBAY_AU - **EBAY_BE**: EBAY_BE - **EBAY_CA**: EBAY_CA - **EBAY_CH**: EBAY_CH - **EBAY_CN**: EBAY_CN - **EBAY_CZ**: EBAY_CZ - **EBAY_DE**: EBAY_DE - **EBAY_DK**: EBAY_DK - **EBAY_ES**: EBAY_ES - **EBAY_FI**: EBAY_FI - **EBAY_FR**: EBAY_FR - **EBAY_GB**: EBAY_GB - **EBAY_GR**: EBAY_GR - **EBAY_HK**: EBAY_HK - **EBAY_HU**: EBAY_HU - **EBAY_ID**: EBAY_ID - **EBAY_IE**: EBAY_IE - **EBAY_IL**: EBAY_IL - **EBAY_IN**: EBAY_IN - **EBAY_IT**: EBAY_IT - **EBAY_JP**: EBAY_JP - **EBAY_MY**: EBAY_MY - **EBAY_NL**: EBAY_NL - **EBAY_NO**: EBAY_NO - **EBAY_NZ**: EBAY_NZ - **EBAY_PE**: EBAY_PE - **EBAY_PH**: EBAY_PH - **EBAY_PL**: EBAY_PL - **EBAY_PR**: EBAY_PR - **EBAY_PT**: EBAY_PT - **EBAY_RU**: EBAY_RU - **EBAY_SE**: EBAY_SE - **EBAY_SG**: EBAY_SG - **EBAY_TH**: EBAY_TH - **EBAY_TW**: EBAY_TW - **EBAY_US**: EBAY_US - **EBAY_VN**: EBAY_VN - **EBAY_ZA**: EBAY_ZA - **EBAY_HALF_US**: EBAY_HALF_US - **EBAY_MOTORS_US**: EBAY_MOTORS_US
**Type:** object

### PaymentMethod
**Description:** This type is used by the **paymentMethods** container, which is used by the seller to specify one or more offline payment methods.  
  
**Note**: eBay now controls all electronic payment methods available for a marketplace, so a seller will no longer use this type to specify any electronic payment methods.
**Type:** object

**Properties:**
- **brands** (array)
  - **Note**: This array is no longer applicable and should not be used. eBay now controls all electronic payment methods available for a marketplace, and a seller never has to specify any electronic payment methods, including any credit card brands accepted.
- **paymentMethodType** (PaymentMethodTypeEnum)
  - This array is only applicable for listings supporting offline payment methods. See the **PaymentMethodTypeEnum** type for supported offline payment method enum values. If offline payments are enabled for the policy, provide at least one offline payment method.
- **recipientAccountReference** (RecipientAccountReference)
  - **Note**: This container is no longer applicable and should not be used. eBay now controls all electronic payment methods available for a marketplace, and a seller never has to specify any electronic payment methods, including PayPal.

### PaymentMethodTypeEnum
**Description:** An enumeration type that defines the supported payment methods.  
  
**Note**: eBay manages all electronic payment methods that are available to buyers, so sellers only need to specify one or more offline payment methods for listings that support or require payment that occurs off of the eBay platform. All electronic payment method enum values are no longer applicable, and are marked as such. | - **CASH_IN_PERSON**: CASH_IN_PERSON - **CASH_ON_DELIVERY**: CASH_ON_DELIVERY - **CASH_ON_PICKUP**: CASH_ON_PICKUP - **CASHIER_CHECK**: CASHIER_CHECK - **CREDIT_CARD**: CREDIT_CARD - **ESCROW**: ESCROW - **INTEGRATED_MERCHANT_CREDIT_CARD**: INTEGRATED_MERCHANT_CREDIT_CARD - **LOAN_CHECK**: LOAN_CHECK - **MONEY_ORDER**: MONEY_ORDER - **PAISA_PAY**: PAISA_PAY - **PAISA_PAY_ESCROW**: PAISA_PAY_ESCROW - **PAISA_PAY_ESCROW_EMI**: PAISA_PAY_ESCROW_EMI - **PAYPAL**: PAYPAL - **PERSONAL_CHECK**: PERSONAL_CHECK - **OTHER**: OTHER
**Type:** object

### PaymentPolicy
**Description:** This type is used by the **paymentPolicy** response container, a container which defines a seller's payment business policy for a specific marketplace.
**Type:** object

**Properties:**
- **categoryTypes** (array)
  - This container indicates whether the payment policy applies to motor vehicle listings, or if it applies to non-motor vehicle listings.
- **deposit** (Deposit)
  - This container is applicable only if the **categoryTypes.name** field is set to `MOTORS_VEHICLES`, and is only returned if the seller requires an initial deposit on motor vehicles.  
  
The container shows the amount due for the deposit and when it is due (within 1-3 days after commitment to purchase, unless the listing requires immediate payment).

**Note:** The due date that is specified in the **deposit** container will be overridden if the payment business policy requires immediate payment (in this case, for the deposit), and the buyer commits to purchasing the motor vehicle through a fixed-price listing or through the 'Buy it Now' option of an auction listing.
- **description** (string)
  - A seller-defined description of the payment policy. This description is only for the seller's use, and is not exposed on any eBay pages.  
  
**Max length**: 250
- **fullPaymentDueIn** (TimeDuration)
  - This container applies to motor vehicles listings only and indicates when a final payment for the vehicle is due. This value is always returned if **categoryTypes** is set to `MOTORS_VEHICLES`.  
  
This container indicates the number of days that a buyer has to make their full payment to the seller and close the remaining balance on a motor vehicle transaction. The period starts when the buyer commits to buy. The valid values, as specified with **TimeDuration**, are:

*   3 DAYS
*   7 DAYS (the default)
*   10 DAYS
*   14 DAYS

A `MOTORS_VEHICLES`) payment business policy must specify at least one of the following **paymentMethods** values for the final payment:

*   CASH\_ON\_PICKUP  
      
    **Note:** This payment method is only available to sellers outside the US.
*   CASHIER\_CHECK
*   MONEY\_ORDER
*   PERSONAL\_CHECK
- **immediatePay** (boolean)
  - If this field is returned as `true`, immediate payment is required from the buyer for:

*   A fixed-price item
*   An auction item where the buyer uses the 'Buy it Now' option
*   A deposit for a motor vehicle listing

  
It is possible for the seller to set this field as `true` in the payment business policy, but it will not apply in some scenarios. For example, immediate payment is not applicable for auction listings that have a winning bidder, for buyer purchases that involve the Best Offer feature, or for transactions that happen offline between the buyer and seller.
- **marketplaceId** (MarketplaceIdEnum)
  - The ID of the eBay marketplace to which the payment business policy applies.
- **name** (string)
  - A seller-defined name for this payment policy. Names must be unique for policies assigned to the same marketplace.  
  
**Max length**: 64
- **paymentInstructions** (string)
  - Although this field may be returned for some older payment business policies, payment instructions are no longer supported by payment business policies. If this field is returned, it can be ignored and these payment instructions will not appear in any listings that use the corresponding business policy.  
  
**Max length**: 1000
- **paymentMethods** (array)
  - This container is returned to show the payment methods that are accepted for the payment business policy.  
  
Sellers do not have to specify any electronic payment methods for listings, so this array will often be returned empty unless the payment business policy is intended for motor vehicle listings or other items in categories where offline payments are required or supported.
- **paymentPolicyId** (string)
  - A unique eBay-assigned ID for a payment business policy. This ID is generated when the policy is created.

### PaymentPolicyRequest
**Description:** This root container defines a seller's payment business policy for a specific marketplace and category group. This type is used when creating or updating a payment business policy.
**Type:** object

**Properties:**
- **categoryTypes** (array)
  - This container is used to specify whether the payment business policy applies to motor vehicle listings, or if it applies to non-motor vehicle listings.
- **deposit** (Deposit)
  - This container is used if the seller wants to require an initial deposit on a motor vehicle listing. In this container, the seller sets the deposit amount and the due date for the deposit.  
  
Because eBay controls all electronic payment methods, sellers do not need to specify a payment method and the **deposit.paymentMethods** array is not needed.

**Note:** The 'due date' specified in the **deposit** container will be overridden if the payment business policy requires immediate payment (in this case, for the deposit), and the buyer commits to purchase the motor vehicle through a fixed-price listing or through the 'Buy it Now' option of an auction listing. See [immediatePay](/api-docs/sell/account/resources/payment_policy/methods/createPaymentPolicy#request.immediatePay).
- **description** (string)
  - A seller-defined description of the payment business policy. This description is only for the seller's use, and is not exposed on any eBay pages.  
  
**Max length**: 250
- **fullPaymentDueIn** (TimeDuration)
  - This container is used to specify the number of days that a buyer has to make their full payment to the seller and close the remaining balance on a motor vehicle transaction. This container must be specified for motor vehicles listings.  
  
The period starts when the buyer commits to buy. The valid values, as specified with **TimeDuration**, are:

*   `3 DAYS`
*   `7 DAYS` (the default)
*   `10 DAYS`
*   `14 DAYS`

In order for a buyer to make a full payment on a motor vehicle, at least one of the following **paymentMethods** values must be specified for the corresponding payment business policy:

*   `CASH_ON_PICKUP`
*   `CASHIER_CHECK`
*   `MONEY_ORDER`
*   `PERSONAL_CHECK`

**Default:** `7 DAYS`
- **immediatePay** (boolean)
  - This field should be included and set to `true` if the seller wants to require immediate payment from the buyer for:

*   A fixed-price item
*   An auction item where the buyer is using the 'Buy it Now' option
*   A deposit for a motor vehicle listing

  
**Default:** False
- **marketplaceId** (MarketplaceIdEnum)
  - The ID of the eBay marketplace to which this payment business policy applies.
- **name** (string)
  - A seller-defined name for this payment business policy. Names must be unique for policies assigned to the same marketplace.  
  
**Max length:** 64
- **paymentInstructions** (string)
  - **Note:** DO NOT USE THIS FIELD. Payment instructions are no longer supported by payment business policies.

A free-form string field that allows sellers to add detailed payment instructions to their listings.
- **paymentMethods** (array)
  - **Note:** This field applies only when the seller needs to specify one or more offline payment methods. eBay now manages the electronic payment options available to buyers to pay for the item.

This array is used to specify one or more offline payment methods that will be accepted for payment that occurs off of eBay's platform.

### PaymentPolicyResponse
**Description:** The response payload for the **getPaymentPolicies** method.  
  
**Note**: Pagination has not yet been enabled for **getPaymentPolicies**, so all of the pagination-related fields are for future use.
**Type:** object

**Properties:**
- **href** (string)
  - This field is for future use.
- **limit** (integer)
  - This field is for future use.
- **next** (string)
  - This field is for future use.
- **offset** (integer)
  - This field is for future use.
- **paymentPolicies** (array)
  - A list of all of the seller's payment business policies defined for the specified marketplace. This array will be returned as empty if no payment business policies are defined for the specified marketplace.
- **prev** (string)
  - This field is for future use.
- **total** (integer)
  - The total number of payment business policies retrieved in the result set.  
  
If no payment business policies are defined for the specified marketplace, this field is returned with a value of `0`.

### PaymentsProgramOnboardingResponse
**Description:** Type used by the payments program onboarding response
**Type:** object

**Properties:**
- **onboardingStatus** (PaymentsProgramOnboardingStatus)
  - This enumeration value indicates the eligibility of payment onboarding for the registered site.
- **steps** (array)
  - An array of the active process steps for payment onboarding and the status of each step. This array includes the step **name**, step **status**, and a **webUrl** to the `IN_PROGRESS` step. The step names are returned in sequential order.

### PaymentsProgramOnboardingStatus
**Description:** This enumeration value indicates the eligibility of payment onboarding for the registered site. | - **ELIGIBLE_TO_ONBOARD**: ELIGIBLE_TO_ONBOARD - **NOT_ELIGIBLE**: NOT_ELIGIBLE - **PREBOARDED**: PREBOARDED - **ONBOARDED**: ONBOARDED
**Type:** object

### PaymentsProgramOnboardingStepStatus
**Description:** The status of the present onboarding step. | - **NOT_STARTED**: NOT_STARTED - **IN_PROGRESS**: IN_PROGRESS - **COMPLETED**: COMPLETED
**Type:** object

### PaymentsProgramOnboardingSteps
**Description:** The payments program onboarding steps, status, and link.
**Type:** object

**Properties:**
- **name** (string)
  - The name of the step in the steps array. Over time, these names are subject to change as processes change. The output sample contains example step names. Review an actual call response for updated step names.
- **status** (PaymentsProgramOnboardingStepStatus)
  - This enumeration value indicates the status of the associated step.

**Note:** Only one step can be `IN_PROGRESS` at a time.
- **webUrl** (string)
  - This URL provides access to the `IN_PROGRESS` step.

### PaymentsProgramResponse
**Description:** The response object containing the sellers status with regards to the specified payment program.
**Type:** object

**Properties:**
- **marketplaceId** (MarketplaceIdEnum)
  - The ID of the eBay marketplace to which the payment program applies.
- **paymentsProgramType** (PaymentsProgramType)
  - This parameter specifies the payment program whose status is returned by the call.  
  
Currently the only supported payments program is `EBAY_PAYMENTS`.
- **status** (PaymentsProgramStatus)
  - The enumeration value returned in this field indicates whether or not the seller's account is enabled for the payments program.
- **wasPreviouslyOptedIn** (boolean)
  - If returned as `true`, the seller was at one point opted-in to the associated payment program, but they later opted out of the program. A value of `false` indicates the seller never opted-in to the program or if they did opt-in to the program, they never opted-out of it.  
  
It's important to note that the setting of this field does not indicate the seller's current status regarding the payment program. It is possible for this field to return `true` while the **status** field returns `OPTED_IN`.

### PaymentsProgramStatus
**Description:** An enumerated type defining the different possible statuses relating to whether or not a seller is opted-in to a payments program. | - **OPTED_IN**: OPTED_IN - **NOT_OPTED_IN**: NOT_OPTED_IN
**Type:** object

### PaymentsProgramType
**Description:** An enumerated type defining the supported payment programs. | - **EBAY_PAYMENTS**: EBAY_PAYMENTS
**Type:** object

### Program
**Description:** The seller program to opt in to when part of an **optInToProgram** request, or out of when part of an **optOutOfProgram** request.
**Type:** object

**Properties:**
- **programType** (ProgramTypeEnum)
  - The seller program to opt in to when part of an **optInToProgram** request, or out of when part of an **optOutOfProgram** request. When returned in an **getOptedInPrograms** response, a separate **programType** field is returned for each seller program that the seller is opted in to.

### ProgramTypeEnum
**Description:** An enumerated type defining the supported seller programs. | - **OUT_OF_STOCK_CONTROL**: OUT_OF_STOCK_CONTROL - **PARTNER_MOTORS_DEALER**: PARTNER_MOTORS_DEALER - **SELLING_POLICY_MANAGEMENT**: SELLING_POLICY_MANAGEMENT
**Type:** object

### Programs
**Description:** The base response type of the **getOptedInPrograms** method.
**Type:** object

**Properties:**
- **programs** (array)
  - An array of seller programs that the seller's account is opted in to. An empty array is returned if the seller is not opted in to any of the seller programs.

### RateTable
**Description:** This type is used to provide details about each shipping rate table that is returned in the **getRateTables** response.
**Type:** object

**Properties:**
- **countryCode** (CountryCodeEnum)
  - A two-letter [ISO 3166](https://www.iso.org/iso-3166-country-codes.html  "https://www.iso.org ") country code representing the eBay marketplace where the shipping rate table is defined.
- **locality** (ShippingOptionTypeEnum)
  - This enumeration value returned here indicates whether the shipping rate table is a domestic or international shipping rate table.
- **name** (string)
  - The seller-defined name for the shipping rate table.
- **rateTableId** (string)
  - A unique eBay-assigned ID for a seller's shipping rate table. These **rateTableId** values are used to associate shipping rate tables to fulfillment business policies or directly to listings through an add/revise/relist call in the Trading API.

### RateTableResponse
**Description:** This type is the base response of the **getRateTables** method.
**Type:** object

**Properties:**
- **rateTables** (array)
  - An array of all shipping rate tables defined for a marketplace (or all marketplaces if no **country\_code** query parameter is used). This array will be returned as empty if the seller has no defined shipping rate tables for the specified marketplace.

### RecipientAccountReference
**Description:** **Note**: This type is no longer applicable. eBay now controls all electronic payment methods available for a marketplace, and a seller never has to specify any electronic payment methods.
**Type:** object

**Properties:**
- **referenceId** (string)
  - **Note**: DO NOT USE THIS FIELD. eBay now controls all electronic payment methods available for a marketplace, and a seller never has to specify any electronic payment methods.
- **referenceType** (RecipientAccountReferenceTypeEnum)
  - **Note**: DO NOT USE THIS FIELD. eBay now controls all electronic payment methods available for a marketplace, and a seller never has to specify any electronic payment methods.

### RecipientAccountReferenceTypeEnum
**Description:** **Note**: This type is no longer applicable. eBay now controls all electronic payment methods available for a marketplace, and a seller never has to specify any electronic payment methods. | - **PAYPAL_EMAIL**: PAYPAL_EMAIL
**Type:** object

### RefundMethodEnum
**Description:** An enumerated type defining the supported refund types for buyer returns. | - **MERCHANDISE_CREDIT**: MERCHANDISE_CREDIT - **MONEY_BACK**: MONEY_BACK
**Type:** object

### Region
**Description:** This type is used to define specific shipping regions. There are four 'levels' of shipping regions, including large geographical regions (like 'Asia', 'Europe', or 'Middle East'), individual countries, US states or Canadian provinces, and special locations/domestic regions within a country (like 'Alaska/Hawaii' or 'PO Box').
**Type:** object

**Properties:**
- **regionName** (string)
  - A string that indicates the name of a region, as defined by eBay. A "region" can be either a 'world region' (e.g., the "Middle East" or "Southeast Asia"), a country (represented with a two-letter country code), a state or province (represented with a two-letter code), or a special domestic region within a country.  
  
The [GeteBayDetails](/devzone/xml/docs/reference/ebay/GeteBayDetails.html) call in the Trading API can be used to retrieve the world regions and special domestic regions within a specific country. To get these enumeration values, call **GeteBayDetails** with the **DetailName** value set to **ExcludeShippingLocationDetails**.
- **regionType** (RegionTypeEnum)
  - Reserved for future use.

### RegionSet
**Description:** This type consists of the **regionIncluded** and **regionExcluded** arrays, which indicate the areas to where the seller does and doesn't ship.
**Type:** object

**Properties:**
- **regionExcluded** (array)
  - An array of one or more **regionName** values that specify the areas to where a seller does not ship. A **regionExcluded** list should only be set in the top-level **shipToLocations** container and not within the **shippingServices.shipToLocations** container used to specify which shipping regions are serviced by each available shipping service option.

Many sellers are willing to ship to many international locations, but they may want to exclude some world regions or some countries as places they are willing to ship to.  
  
This array will be returned as empty if no shipping regions are excluded with the fulfillment business policy.  
  
**Note:** The **regionExcluded** array is not applicable for motor vehicle business policies on the US, CA, or UK marketplaces. If this array is used in a **createFulfillmentPolicy** or **updateFulfillmentPolicy** request, it will be ignored.
- **regionIncluded** (array)
  - An array of one or more **regionName** fields that specify the areas to where a seller ships.  
Each eBay marketplace supports its own set of allowable shipping locations.  
  
**Note:** The **regionIncluded** array is not applicable for motor vehicle business policies on the US, CA, or UK marketplaces. If this array is used in a **createFulfillmentPolicy** or **updateFulfillmentPolicy** request, it will be ignored.

### RegionTypeEnum
**Description:** This enumerated type defines shipping region types. **Note:** These enumeration values are not currently being used by fulfillment policy methods, but may be used in the future. | - **COUNTRY**: COUNTRY - **COUNTRY_REGION**: COUNTRY_REGION - **STATE_OR_PROVINCE**: STATE_OR_PROVINCE - **WORLD_REGION**: WORLD_REGION - **WORLDWIDE**: WORLDWIDE
**Type:** object

### ReturnMethodEnum
**Description:** This enumerated type lists the return options (other than 'money back') that a seller may offer to the buyer for a return request. | - **EXCHANGE**: EXCHANGE - **REPLACEMENT**: REPLACEMENT
**Type:** object

### ReturnPolicy
**Description:** This type is used by the **returnPolicy** response container, a container which defines a seller's return business policy for a specific marketplace.
**Type:** object

**Properties:**
- **categoryTypes** (array)
  - This container indicates which category group that the return policy applies to.  
  
**Note**: Return business policies are not applicable to motor vehicle listings, so the **categoryTypes.name** value will always be `ALL_EXCLUDING_MOTORS_VEHICLES` for return business policies.
- **description** (string)
  - A seller-defined description of the return business policy. This description is only for the seller's use, and is not exposed on any eBay pages.  
  
**Max length**: 250
- **extendedHolidayReturnsOffered** (boolean)
  - **Important!** This field is deprecated, since eBay no longer supports extended holiday returns. Any value supplied in this field is neither read nor returned.
- **internationalOverride** (InternationalReturnOverrideType)
  - This container shows the seller's international return policy settings. This container is only returned if the seller has set a separate international return policy for the business policy. International return policies are optional, even if the seller ships to international locations. If a separate international return policy is not set, all of the domestic return policy settings also apply to international orders.
- **marketplaceId** (MarketplaceIdEnum)
  - The ID of the eBay marketplace to which this return business policy applies.
- **name** (string)
  - A seller-defined name for this return business policy. Names must be unique for policies assigned to the same marketplace.  
  
**Max length:** 64
- **refundMethod** (RefundMethodEnum)
  - This field indicates the refund method offered by the seller. Its value will be `MONEY_BACK` unless the seller is enabled for **Buy online, Pickup in Store** or **Click and Collect**, and then it might be `MERCHANDISE_CREDIT`. Getting their money back for returned items is always an option for buyers, regardless of what the seller sets in this field.
- **restockingFeePercentage** (string)
  - **Important!** This field is deprecated, since eBay no longer allows sellers to charge a restocking fee for buyer remorse returns. If this field is included, it is ignored and it is no longer returned.
- **returnInstructions** (string)
  - This text-based field provides more details on seller-specified return instructions. This field is only returned if set for the return business policy.  

**Important!** This field is no longer supported on many eBay marketplaces. To see if a marketplace and eBay category does support this field, call [getReturnPolicies](/api-docs/sell/metadata/resources/marketplace/methods/getReturnPolicies) method of the **Metadata API**. Then you will look for the **policyDescriptionEnabled** field with a value of `true` for the eBay category.

  
**Max length**: 5000 (8000 for DE)
- **returnMethod** (ReturnMethodEnum)
  - This field is only returned if the seller is willing to offer a replacement item as an alternative to 'Money Back'.
- **returnPeriod** (TimeDuration)
  - This container indicates the number of calendar days that the buyer has to return an item. The return period begins when the item is marked "delivered" at the buyer's specified ship-to location.  
  
Most categories support 30-day and 60-day return periods.  
  
**Note**: Unless the seller has set a separate international return policy through the **internationalOverride** container, this return period will be valid for domestic and international returns (if the seller ships internationally).
- **returnPolicyId** (string)
  - A unique eBay-assigned ID for a return business policy. This ID is generated when the policy is created.
- **returnsAccepted** (boolean)
  - If this field is returned as `true`, the seller accepts returns. If set to `false`, the seller does not accept returns.  
  
**Note:** Top-Rated sellers must accept item returns and the **handlingTime** should be set to zero days or one day for a listing to receive a Top-Rated Plus badge on the View Item or search result pages. For more information on eBay's Top-Rated seller program, see [Becoming a Top Rated Seller and qualifying for Top Rated Plus benefits](https://pages.ebay.com/help/sell/top-rated.html ).
- **returnShippingCostPayer** (ReturnShippingCostPayerEnum)
  - This field indicates who is responsible for paying for the shipping charges for returned items. The field can be set to either `BUYER` or `SELLER`.  
  
Depending on the return policy and specifics of the return, either the buyer or the seller can be responsible for the return shipping costs. Note that the seller is always responsible for return shipping costs for SNAD-related issues.

### ReturnPolicyRequest
**Description:** This root container defines a seller's return business policy for a specific marketplace and category group. This type is used when creating or updating a return business policy.
**Type:** object

**Properties:**
- **categoryTypes** (array)
  - This container indicates which category group that the return policy applies to.  
  
**Note**: Return business policies are not applicable to motor vehicle listings, so the **categoryTypes.name** value must be set to `ALL_EXCLUDING_MOTORS_VEHICLES` for return business policies.
- **description** (string)
  - A seller-defined description of the return business policy. This description is only for the seller's use, and is not exposed on any eBay pages.  
  
**Max length**: 250
- **extendedHolidayReturnsOffered** (boolean)
  - **Important!** This field is deprecated, since eBay no longer supports extended holiday returns. Any value supplied in this field is neither read nor returned.
- **internationalOverride** (InternationalReturnOverrideType)
  - This container is used by the seller to specify a separate international return policy. If a separate international return policy is not defined by a seller, all of the domestic return policy settings will also apply to international orders.
- **marketplaceId** (MarketplaceIdEnum)
  - The ID of the eBay marketplace to which this return business policy applies.
- **name** (string)
  - A seller-defined name for this return business policy. Names must be unique for policies assigned to the same marketplace.  
  
**Max length**: 64
- **refundMethod** (RefundMethodEnum)
  - This field sets the refund method to use for returned items. Its value defaults to `MONEY_BACK` if omitted, so this field is only needed for **Buy online, Pickup in Store** or **Click and Collect** items where the seller is willing to offer merchandise credit as an additional refund method to buyers. Getting their money back for returned items is always an option for buyers, regardless of what the seller sets in this field.

**Important!** If this field is not included in a return business policy, it will default to `MONEY_BACK`.
- **restockingFeePercentage** (string)
  - **Important!** This field is deprecated, since eBay no longer allows sellers to charge a restocking fee for buyer remorse returns. If this field is included, it is ignored.
- **returnInstructions** (string)
  - This text-based field provides more details on seller-specified return instructions.  

**Important!** This field is no longer supported on many eBay marketplaces. To see if a marketplace and eBay category does support this field, call [getReturnPolicies](/api-docs/sell/metadata/resources/marketplace/methods/getReturnPolicies) method of the **Metadata API**. Then you will look for the **policyDescriptionEnabled** field with a value of `true` for the eBay category.

  
**Max length**: 5000 (8000 for DE)
- **returnMethod** (ReturnMethodEnum)
  - This field can be used if the seller is willing and able to offer a replacement item as an alternative to 'Money Back'.
- **returnPeriod** (TimeDuration)
  - This container is used to specify the number of days that the buyer has to return an item. The return period begins when the item is marked "delivered" at the buyer's specified ship-to location.  
  
You must set the value to one that's accepted by the marketplace and category where the item is listed. Most categories support 30-day and 60-day return periods.

**Note:** Eligible Parts & Accessories (P&A) listings require sellers to offer buyers free returns with a minimum return period of 30 days. See [Support for easy returns in Parts and Accessories](/api-docs/user-guides/static/trading-user-guide/ebay-motors-parts-accessories-easy-returns.html) for details.

  
For a definitive list of return periods for one or more categories, call [getReturnPolicies](/api-docs/sell/metadata/resources/marketplace/methods/getReturnPolicies) method of the **Metadata API**.  
  
The return period is set using the **TimeDuration** type, where you set **unit** to `DAY` and **value** to either `30` or `60` (or other value, as appropriate).  
  
Note that this value cannot be modified if the listing has bids or sales, or if the listing ends within 12 hours.  
  
_Required if_ **returnsAccepted** is set to `true`.
- **returnsAccepted** (boolean)
  - If set to `true`, the seller accepts returns. If set to `false`, the seller does not accept returns.  

**Note:**Top-Rated sellers must accept item returns and the **handlingTime** should be set to zero days or one day for a listing to receive a Top-Rated Plus badge on the View Item or search result pages. For more information on eBay's Top-Rated seller program, see [Becoming a Top Rated Seller and qualifying for Top Rated Plus benefits](http://pages.ebay.com/help/sell/top-rated.html ).
- **returnShippingCostPayer** (ReturnShippingCostPayerEnum)
  - This field indicates who is responsible for paying for the shipping charges for returned items. The field can be set to either `BUYER` or `SELLER`.

**Note:** Eligible Parts & Accessories (P&A) listings require sellers to offer buyers free returns with a minimum return period of 30 days. See [Support for easy returns in Parts and Accessories](/api-docs/user-guides/static/trading-user-guide/ebay-motors-parts-accessories-easy-returns.html) for details.

  
Depending on the return policy and specifics of the return, either the buyer or the seller can be responsible for the return shipping costs. Note that the seller is always responsible for return shipping costs for SNAD-related issues.  
  
This field is conditionally required if **returnsAccepted** is set to `true`.

### ReturnPolicyResponse
**Description:** The response payload for the **getReturnPolicies** method.  
  
**Note**: Pagination has not yet been enabled for **getReturnPolicies**, so all of the pagination-related fields are for future use.
**Type:** object

**Properties:**
- **href** (string)
  - This field is for future use.
- **limit** (integer)
  - This field is for future use.
- **next** (string)
  - This field is for future use.
- **offset** (integer)
  - This field is for future use.
- **prev** (string)
  - This field is for future use.
- **returnPolicies** (array)
  - A list of all of the seller's return business policies defined for the specified marketplace. This array will be returned as empty if no return business policies are defined for the specified marketplace.
- **total** (integer)
  - The total number of return business policies retrieved in the result set.  
  
If no return business policies are defined for the specified marketplace, this field is returned with a value of `0`.

### ReturnShippingCostPayerEnum
**Description:** An enumerated type that is used to indicate who is responsible for the return shipping cost. Note that the seller is always responsible for the return shipping cost of SNAD-related returns. | - **BUYER**: BUYER - **SELLER**: SELLER
**Type:** object

### SalesTax
**Description:** This type is used to provide sales tax settings for a specific tax jurisdiction.
**Type:** object

**Properties:**
- **countryCode** (CountryCodeEnum)
  - The country code enumeration value identifies the country to which this sales tax rate applies.  
  
**Note:** Sales-tax tables are available only for the US and Canada marketplaces. Therefore, the only supported values are:

*   `US`
*   `CA`
- **salesTaxJurisdictionId** (string)
  - A unique ID that identifies the sales tax jurisdiction to which the sales tax rate applies.  
  
**Note:** When the returned `countryCode` is `US`, the only supported return values for `salesTaxJurisdictionId` are:

*   `AS` (American Samoa)
*   `GU` (Guam
*   `MP` Northern Mariana Islands
*   `PW (Palau)`
*   `` `VI` (US Virgin Islands) ``
- **salesTaxPercentage** (string)
  - The sales tax rate that will be applied to sales price. The **shippingAndHandlingTaxed** value will indicate whether or not sales tax is also applied to shipping and handling charges  
  
Although it is a string, a percentage value is returned here, such as `7.75`
- **shippingAndHandlingTaxed** (boolean)
  - If returned as `true`, sales tax is also applied to shipping and handling charges, and not just the total sales price of the order.

### SalesTaxBase
**Description:** This type is used by the base request of the **createOrReplaceSalesTax**.
**Type:** object

**Properties:**
- **salesTaxPercentage** (string)
  - This field is used to set the sales tax rate for the tax jurisdiction set in the call URI. When applicable to an order, this sales tax rate will be applied to sales price. The **shippingAndHandlingTaxed** value will indicate whether or not sales tax is also applied to shipping and handling charges  
  
Although it is a string, a percentage value is set here, such as `7.75`.
- **shippingAndHandlingTaxed** (boolean)
  - This field is set to `true` if the seller wishes to apply sales tax to shipping and handling charges, and not just the total sales price of the order. Otherwise, this field's value should be set to `false`.

### SalesTaxInput
**Type:** object

**Properties:**
- **countryCode** (string)
  - This parameter specifies the two-letter [ISO 3166](https://www.iso.org/iso-3166-country-codes.html  "https://www.iso.org ") code of the country for which a sales-tax table entry is to be created or updated.  
  
**Note:** Sales-tax tables are available only for the US and Canada marketplaces. Therefore, the only supported values are:

*   `US`
*   `CA`
- **salesTaxJurisdictionId** (string)
  - This parameter specifies the ID of the tax jurisdiction for which a sales-tax table entry is to be created or updated.  
  
Valid jurisdiction IDs can be retrieved using the [getSalesTaxJurisdiction](/api-docs/sell/metadata/resources/country/methods/getSalesTaxJurisdictions) method of the Metadata API.  
  
**Note:** When `countryCode` is set to `US`, the only supported values for `jurisdictionId` are:

*   `AS` (American Samoa)
*   `GU` (Guam)
*   `MP` (Northern Mariana Islands)
*   `PW` (Palau)
*   `VI` (US Virgin Islands)
- **salesTaxPercentage** (string)
  - This parameter specifies the sales tax rate for the specified **salesTaxJurisdictionId**. When applicable to an order, this sales tax rate will be applied to the sales price. The **shippingAndHandlingTaxed** value indicates whether or not sales tax is also applied to shipping and handling charges  
  
Although it is a string, a percentage value is set here, such as `7.75`.
- **shippingAndHandlingTaxed** (boolean)
  - This parameter is set to `true` if the seller wishes to apply sales tax to shipping and handling charges and not just the total sales price of an order. Otherwise, this parameter's value should be set to `false`.

### SalesTaxes
**Description:** This type is used by the root response of the **getSalesTaxes** method.
**Type:** object

**Properties:**
- **salesTaxes** (array)
  - An array of one or more sales-tax rate entries for a specified country.  
  
If no sales-tax rate entries are set up, no response payload is returned, but an HTTP status code of `204 No Content` is returned.

### SellerEligibilityEnum
**Description:** An enumerated type that defines the seller eligibility status for a specified eBay advertising program. | - **ELIGIBLE**: ELIGIBLE - **INELIGIBLE**: INELIGIBLE
**Type:** object

### SellerEligibilityMultiProgramResponse
**Description:** The base response of the **getAdvertisingEligibility** method that contains the seller eligibility information for one or more advertising programs.
**Type:** object

**Properties:**
- **advertisingEligibility** (array)
  - An array of response fields that define the seller eligibility for eBay advertising programs.

### SellerEligibilityResponse
**Description:** A type that is used to provide the seller's eligibility status for an eBay advertising program.
**Type:** object

**Properties:**
- **programType** (AdvertisingProgramEnum)
  - The eBay advertising program for which a seller may be eligible.
- **reason** (SellerIneligibleReasonEnum)
  - The reason why a seller is ineligible for the specified eBay advertising program.  
  
This field is only returned if the seller is ineligible for the eBay advertising program.
- **status** (SellerEligibilityEnum)
  - The seller eligibility status for the specified eBay advertising program.

### SellerIneligibleReasonEnum
**Description:** An enumerated type that defines the reason why a seller is ineligible for an eBay advertising program. | - **NOT_ENOUGH_ACTIVITY**: NOT_ENOUGH_ACTIVITY - **NOT_IN_GOOD_STANDING**: NOT_IN_GOOD_STANDING - **RESTRICTED**: RESTRICTED
**Type:** object

### SellingLimit
**Description:** Type used by the **sellingLimit** container, a container that lists the monthly cap for the quantity of items sold and total sales amount allowed for the seller's account.
**Type:** object

**Properties:**
- **amount** (Amount)
  - This container shows the monthly cap for total sales amount allowed for the seller's account. This container may not be returned if a seller does not have a monthly cap for total sales amount.
- **quantity** (integer)
  - This field shows the monthly cap for total quantity sold allowed for the seller's account. This field may not be returned if a seller does not have a monthly cap for total quantity sold.

### SellingPrivileges
**Description:** This type is used by the base response of the **getPrivileges** method.
**Type:** object

**Properties:**
- **sellerRegistrationCompleted** (boolean)
  - If this field is returned as `true`, the seller's registration is completed. If this field is returned as `false`, the registration process is not complete.
- **sellingLimit** (SellingLimit)
  - This container lists the monthly cap for the quantity of items sold and total sales amount allowed for the seller's account. This container may not be returned if a seller does not have a monthly cap for total quantity sold and total sales amount.

**Note:** The selling limit value returned in **getPrivileges** may vary slightly from the value displayed in Seller Hub. The value in Seller Hub is an abbreviated figure, where rounding is applied.

### SetFulfillmentPolicyResponse
**Description:** Complex type that that gets populated with a response containing a fulfillment policy.
**Type:** object

**Properties:**
- **categoryTypes** (array)
  - This container indicates whether the fulfillment business policy applies to motor vehicle listings, or if it applies to non-motor vehicle listings.
- **description** (string)
  - A seller-defined description of the fulfillment policy. This description is only for the seller's use, and is not exposed on any eBay pages. This field is returned if set for the policy.  
  
**Max length**: 250
- **freightShipping** (boolean)
  - If returned as `true`, the seller offers freight shipping. Freight shipping can be used for large items over 150 lbs.
- **fulfillmentPolicyId** (string)
  - A unique eBay-assigned ID for a fulfillment business policy. This ID is generated when the policy is created.
- **globalShipping** (boolean)
  - **Note**: This field is only applicable for the eBay United Kingdom marketplace (`EBAY_GB`).  
This field is included and set to `true` if the seller wants to use the Global Shipping Program for international shipments. See the [Global Shipping Program](https://pages.ebay.com/help/sell/shipping-globally.html ) help topic for more details and requirements on the Global Shipping Program.  
  
A seller can use a combination of the Global Shipping Program and other international shipping services.  
  
If set to `false` or if the field is omitted, the seller has to manually specifying individual international shipping services (if the seller ships internationally), as described in [Setting up worldwide shipping](https://developer.ebay.com/api-docs/sell/static/seller-accounts/ht_shipping-worldwide.html ).  
  
Sellers opt in or out of the Global Shipping Program through the Shipping preferences in My eBay.  
  
eBay International Shipping is an account level setting; no field needs to be set in a Fulfillment business policy to enable eBay International Shipping. If a US seller's account is opted in to eBay International Shipping, this shipping option will be enabled automatically for all listings where international shipping is available. A US seller who is opted in to eBay International Shipping can also specify individual international shipping service options for a Fulfillment business policy.
- **handlingTime** (TimeDuration)
  - Specifies the maximum number of business days the seller commits to for preparing and shipping an order after receiving a cleared payment for the order. This time does not include the transit time it takes the shipping carrier to deliver the order.

If only local pickup or freight shipping is available for the item, this container may not get returned.
- **localPickup** (boolean)
  - If returned as `true`, local pickup is available for items using this policy.
- **marketplaceId** (MarketplaceIdEnum)
  - The ID of the eBay marketplace to which this fulfillment business policy applies.
- **name** (string)
  - A seller-defined name for this fulfillment business policy.  
  
**Max length**: 64
- **pickupDropOff** (boolean)
  - If returned as `true`, the seller offers the "Click and Collect" option.  
  
Currently, "Click and Collect" is available only to large retail merchants the eBay AU, UK, DE, FR, and IT marketplaces.
- **shippingOptions** (array)
  - This array is used to provide detailed information on the domestic and international shipping options available for the policy. A separate **ShippingOption** object covers domestic shipping service options and international shipping service options (if the seller ships to international locations).  
  
The **optionType** field indicates whether the **ShippingOption** object applies to domestic or international shipping, and the **costType** field indicates whether flat-rate shipping or calculated shipping will be used.

A separate **ShippingServices** object is used to specify cost and other details for every available domestic and international shipping service option.
- **shipToLocations** (RegionSet)
  - This container consists of the **regionIncluded** and **regionExcluded** containers, which define the geographical regions/countries/states or provinces/domestic regions where the seller does and doesn't ship to with this fulfillment policy.
- **warnings** (array)
  - An array of one or more errors or warnings that were generated during the processing of the request. If there were no issues with the request, this array will return empty.

### SetPaymentPolicyResponse
**Description:** Complex type that that gets populated with a response containing a payment policy.
**Type:** object

**Properties:**
- **categoryTypes** (array)
  - This container indicates whether the payment business policy applies to motor vehicle listings, or if it applies to non-motor vehicle listings.
- **deposit** (Deposit)
  - This container is only returned if the seller just created or updated a motor vehicles payment business policy and requires buyers to pay an initial deposit after they commit to buying a motor vehicle.
- **description** (string)
  - A seller-defined description of the payment business policy. This description is only for the seller's use, and is not exposed on any eBay pages. This field is returned if set for the policy.  
  
**Max length**: 250
- **fullPaymentDueIn** (TimeDuration)
  - The number of days (after the buyer commits to buy) that a buyer has to pay the remaining balance of a motor vehicle transaction. Sellers can set this value to 3, 7, 10, or 14 days.

**Note:** This value is always returned if **categoryTypes** is set to `MOTORS_VEHICLES`.
- **immediatePay** (boolean)
  - The value returned in this field will reflect the value set by the seller in the **immediatePay** request field. A value of `true` indicates that immediate payment is required from the buyer for:

*   A fixed-price item
*   An auction item where the buyer is using the 'Buy it Now' option
*   A deposit for a motor vehicle listing

  
It is possible for the seller to set this field as `true` in the payment business policy, but it will not apply in some scenarios. For example, immediate payment is not applicable for auction listings that have a winning bidder, for buyer purchases that involve the Best Offer feature, or for transactions that happen offline between the buyer and seller.
- **marketplaceId** (MarketplaceIdEnum)
  - The ID of the eBay marketplace to which this payment business policy applies.
- **name** (string)
  - A seller-defined name for this payment business policy. Names must be unique for policies assigned to the same marketplace.  
  
**Max length:** 64
- **paymentInstructions** (string)
  - **Note:** NO LONGER SUPPORTED. Although this field may be returned for some older payment business policies, payment instructions are no longer supported by payment business policies. If this field is returned, it can be ignored and these payment instructions will not appear in any listings that use the corresponding business policy.

A free-form string field that allows sellers to add detailed payment instructions to their listings.
- **paymentMethods** (array)
  - This array shows the available payment methods that the seller has set for the payment business policy.  
  
Sellers do not have to specify any electronic payment methods for listings, so this array will often be returned empty unless the payment business policy is intended for motor vehicle listings or other items in categories where offline payments are required or supported.
- **paymentPolicyId** (string)
  - A unique eBay-assigned ID for a payment business policy. This ID is generated when the policy is created.
- **warnings** (array)
  - An array of one or more errors or warnings that were generated during the processing of the request. If there were no issues with the request, this array will return empty.

### SetReturnPolicyResponse
**Description:** A complex type that is populated with a response containing a return policies.
**Type:** object

**Properties:**
- **categoryTypes** (array)
  - This field always returns `ALL_EXCLUDING_MOTORS_VEHICLES` for return business policies, since return business policies are not applicable to motor vehicle listings.
- **description** (string)
  - A seller-defined description of the return business policy. This description is only for the seller's use, and is not exposed on any eBay pages. This field is returned if set for the policy.  
  
**Max length**: 250
- **extendedHolidayReturnsOffered** (boolean)
  - **Important!** This field is deprecated, since eBay no longer supports extended holiday returns. This field should no longer be returned.
- **internationalOverride** (InternationalReturnOverrideType)
  - This container is used by the seller to specify a separate international return policy, and will only be returned if the seller has set a separate return policy for international orders. If a separate international return policy is not defined by a seller, all of the domestic return policy settings will also apply to international orders.
- **marketplaceId** (MarketplaceIdEnum)
  - The ID of the eBay marketplace to which this return business policy applies.
- **name** (string)
  - A seller-defined name for this return business policy. Names must be unique for policies assigned to the same marketplace.  
  
**Max length:** 64
- **refundMethod** (RefundMethodEnum)
  - If a seller indicates that they will accept buyer returns, this value will be `MONEY_BACK`.
- **restockingFeePercentage** (string)
  - **Important!** This field is deprecated, since eBay no longer allows sellers to charge a restocking fee for buyer remorse returns.
- **returnInstructions** (string)
  - This text-based field provides more details on seller-specified return instructions.  

**Important!** This field is no longer supported on many eBay marketplaces. To see if a marketplace and eBay category does support this field, call [getReturnPolicies](/api-docs/sell/metadata/resources/marketplace/methods/getReturnPolicies) method of the **Metadata API**. Then you will look for the **policyDescriptionEnabled** field with a value of `true` for the eBay category.

  
**Max length**: 5000 (8000 for DE)
- **returnMethod** (ReturnMethodEnum)
  - This field will be returned if the seller is willing and able to offer a replacement item as an alternative to 'Money Back'.
- **returnPeriod** (TimeDuration)
  - This container specifies the amount of days that the buyer has to return the item after receiving it. The return period begins when the item is marked "delivered" at the buyer's specified ship-to location. This container will be returned unless the business policy states that the seller does not accept returns.  

**Note:** Eligible Parts & Accessories (P&A) listings require sellers to offer buyers free returns with a minimum return period of 30 days. See [Support for easy returns in Parts and Accessories](/api-docs/user-guides/static/trading-user-guide/ebay-motors-parts-accessories-easy-returns.html) for details.
- **returnPolicyId** (string)
  - A unique eBay-assigned ID for a return business policy. This ID is generated when the policy is created.
- **returnsAccepted** (boolean)
  - If set to `true`, the seller accepts returns. If set to `false`, this field indicates that the seller does not accept returns.
- **returnShippingCostPayer** (ReturnShippingCostPayerEnum)
  - This field indicates who is responsible for paying for the shipping charges for returned items. The field can be set to either `BUYER` or `SELLER`.

**Note:** Eligible Parts & Accessories (P&A) listings require sellers to offer buyers free returns with a minimum return period of 30 days. See [Support for easy returns in Parts and Accessories](/api-docs/user-guides/static/trading-user-guide/ebay-motors-parts-accessories-easy-returns.html) for details.

  
Note that the seller is always responsible for return shipping costs for SNAD-related issues.  
  
This container will be returned unless the business policy states that the seller does not accept returns.
- **warnings** (array)
  - An array of one or more errors or warnings that were generated during the processing of the request. If there were no issues with the request, this array will return empty.

### ShippingCostTypeEnum
**Description:** An enumerated type defining the shipping cost models. | - **CALCULATED**: CALCULATED - **FLAT_RATE**: FLAT_RATE - **NOT_SPECIFIED**: NOT_SPECIFIED
**Type:** object

### ShippingOption
**Description:** This type is used by the **shippingOptions** array, which is used to provide detailed information on the domestic and international shipping options available for the policy. A separate **ShippingOption** object covers domestic shipping service options and international shipping service options (if the seller ships to international locations).
**Type:** object

**Properties:**
- **costType** (ShippingCostTypeEnum)
  - This field defines whether the shipping cost model is `FLAT_RATE` (the same rate for all buyers, or buyers within a region if shipping rate tables are used) or `CALCULATED` (the shipping rate varies by the ship-to location and size and weight of the package).  
  
This field is conditionally required if any shipping service options are specified (domestic and/or international).
- **insuranceFee** (Amount)
  - This field has been deprecated.  
  
Shipping insurance is offered only via a shipping carrier's shipping services and is no longer available via eBay shipping policies.
- **insuranceOffered** (boolean)
  - This field has been deprecated.  
  
Shipping insurance is offered only via a shipping carrier's shipping services and is no longer available via eBay shipping policies.
- **optionType** (ShippingOptionTypeEnum)
  - This field is used to indicate if the corresponding shipping service options (under **shippingServices** array) are domestic or international shipping service options. This field is conditionally required if any shipping service options are specified (domestic and/or international).
- **packageHandlingCost** (Amount)
  - This container is used if the seller adds handling charges to domestic and/or international shipments.  
  
Sellers can not specify any domestic handling charges if they offered 'free shipping' in the policy.  
  
This container will only be returned if set for the policy.
- **rateTableId** (string)
  - This field is used if the seller wants to associate a domestic or international shipping rate table to the fulfillment business policy. The [getRateTables](/api-docs/sell/account/resources/rate_table/methods/getRateTables) method can be used to retrieve shipping rate table IDs.  
  
With domestic and international shipping rate tables, the seller can set different shipping costs based on shipping regions and shipping speed/level of service (one-day, expedited, standard, economy). There are also options to add additional per-weight and handling charges.  
  
Sellers need to be careful that shipping rate tables match the corresponding shipping service options. In other words, a domestic shipping rate table must not be specified in the same container where international shipping service options are being specified, and vice versa, and the shipping speed/level of service of the provided shipping service options should match the shipping speed/level of service options that are defined in the shipping rate tables.  
  
For example, if the corresponding shipping rate table defines costs for one-day shipping services, there should be at least one one-day shipping service option specified under the **shippingServices** array.  
  
This field is returned if set.
- **shippingDiscountProfileId** (string)
  - This field is the unique identifier of a seller's domestic or international shipping discount profile. If a buyer satisfies the requirements of the discount rule, this buyer will receive a shipping discount for the order.  
  
The seller can create and manage shipping discount profiles using (Get/Set) **ShippingDiscountProfiles** calls in the **Trading API** or through the **Shipping Preferences** in **My eBay**.
- **shippingPromotionOffered** (boolean)
  - This boolean indicates whether or not the seller has set up a promotional shipping discount that will be available to buyers who satisfy the requirements of the shipping discount rule.  
  
The seller can create and manage shipping promotional discounts using (Get/Set) **ShippingDiscountProfiles** calls in the **Trading API** or through the **Shipping Preferences** in **My eBay**.
- **shippingServices** (array)
  - This array consists of the domestic or international shipping services options that are defined for the policy. The shipping service options defined under this array should match what is set in the corresponding **shippingOptions.optionType** field (which controls whether domestic or international shipping service options are being defined). If a shipping rate table is being used, the specified shipping service options should also match the shipping rate table settings (domestic or international, shipping speed/level of service, etc.)  
  
Sellers can specify up to four domestic shipping services and up to five international shipping service options by using separate **shippingService** containers for each. If the seller is using the Global Shipping Program as an international option, only a total of four international shipping service options (including GSP) can be offered.  
  
See [How to set up shipping carrier and shipping service values](/api-docs/sell/static/seller-accounts/ht_shipping-setting-shipping-carrier-and-service-values.html).  
  
To use the eBay standard envelope service (eSE), see [Using eBay standard envelope (eSE) service](/api-docs/sell/static/seller-accounts/using-the-ebay-standard-envelope-service.html).  
  
This array is conditionally required if the seller is offering one or more domestic and/or international shipping service options.

### ShippingOptionTypeEnum
**Description:** An enumerated type used to define whether the corresponding shipping service options are domestic or international shipping service options. a region that is either domestic (within the country from where the item is listed or shipped) or international (a country outside the country from where the item is listed or shipped). | - **DOMESTIC**: DOMESTIC - **INTERNATIONAL**: INTERNATIONAL
**Type:** object

### ShippingService
**Description:** This type is used by the **shippingServices** array, an array that provides details about every domestic and international shipping service option that is defined for the policy.
**Type:** object

**Properties:**
- **additionalShippingCost** (Amount)
  - This container is used by the seller to cover the use case when a single buyer purchases multiple quantities of the same line item. This cost cannot exceed the corresponding **shippingCost** value. A seller will generally set this field when he/she wants to pass on a shipping discount to the buyer if that buyer purchases multiple quantities of a line item.  
  
The seller can ship multiple quantities of the line item in the same package and pass on the shipping savings to the buyer.  
  
If this field is not set, and a buyer purchases multiple quantities of an item, the seller can technically charge the same cost set in the **shippingCost** container for each individual item, but in general, it behooves both the seller and the buyer (and saves both parties money) if they discuss combined shipping.  
  
This field is not applicable to auction listings or single-quantity, fixed-price listings.  
  
This container is returned if set.
- **buyerResponsibleForPickup** (boolean)
  - This field should be included and set to `true` for a motor vehicle listing if it will be the buyer's responsibility to pick up the purchased motor vehicle after full payment is made.  
  
This field is only applicable to motor vehicle listings. In the majority of motor vehicle listings, the seller does make the buyer responsible for pickup or shipment of the vehicle.  
  
This field is returned if set.  
  
**Default**: false
- **buyerResponsibleForShipping** (boolean)
  - This field should be included and set to `true` for a motor vehicle listing if it will be the buyer's responsibility to arrange for shipment of a motor vehicle.  
  
This field is only applicable to motor vehicle listings. In the majority of motor vehicle listings, the seller does make the buyer responsible for pickup or shipment of the vehicle.  
  
This field is returned if set.  
  
**Default**: false
- **freeShipping** (boolean)
  - This field is included and set to `true` if the seller offers a free domestic shipping option to the buyer.  
  
This field can only be included and set to `true` for the first domestic shipping service option specified in the **shippingServices** array (it is ignored if set for subsequent shipping services or for any international shipping service option).  
  
The first specified shipping service option has a **sortOrder** value of `1` or if the **sortOrderId** field is not used, it is the shipping service option that's specified first in the **shippingServices** array.  
  
This container is returned if set.
- **shippingCarrierCode** (string)
  - This field sets/indicates the shipping carrier, such as `USPS`, `FedEx`, or `UPS`. Although this field uses the **string** type, the seller must pass in a pre-defined enumeration value here.  
  
For a full list of shipping carrier enum values for a specified eBay marketplace, the [GeteBayDetails](/devzone/xml/docs/reference/ebay/GeteBayDetails.html) call of the **Trading API** can be used, and the **DetailName** field's value should be set to `ShippingCarrierDetails`. The enum values for each shipping carriers can be found in each **ShippingCarrierDetails.ShippingCarrier** field in the response payload.  
  
This field is actually optional, as the shipping carrier is also tied into the **shippingServiceCode** enum value, and that field is required for every specified shipping service option.  
  
This field is returned if set.
- **shippingCost** (Amount)
  - This container is used to set the shipping cost to ship one item using the corresponding shipping service option. This container is conditionally required if the seller is using flat-rate shipping and is not using a domestic or international shipping rate table.  
  
This container is not necessary for calculated shipping, since eBay will calculate the shipping cost and display it in the View Item page based off of the potential buyer's ship-to location.  
  
This value is automatically set to `0.0` for the first specified domestic shipping service option and if the corresponding **freeShipping** field is set to `true`.  
  
This container is returned if set for the policy.
- **shippingServiceCode** (string)
  - This field sets/indicates the domestic or international shipping service option, such as `USPSPriority`, `FedEx2Day`, or `UPS3rdDay`. Although this field uses the **string** type, the seller must pass in a pre-defined enumeration value here.  
  
For a full list of shipping service option enum values for a specified eBay marketplace, the [GeteBayDetails](/devzone/xml/docs/reference/ebay/GeteBayDetails.html) call of the **Trading API** can be used, and the **DetailName** field's value should be set to `ShippingServiceDetails`.  
  
The enum values for each shipping service option can be found in each **ShippingServiceDetails.ShippingService** field in the response payload. The seller must make sure that the shipping service option is still valid, which is indicated by a `true` value in the corresponding **ValidForSellingFlow** boolean field. International shipping service options are typically returned at the top of the response payload, and are indicated by an **InternationalService** boolean field that reads `true`.  
  
The **InternationalService** boolean field is not returned at all for domestic shipping service options.  
  
This field is required for every specified shipping service option.
- **shipToLocations** (RegionSet)
  - This container is used to set the ship-to locations applicable to the corresponding shipping service option. Although the **regionExcluded** container is defined for **RegionSet** type and could technically be used here, it is recommened that only the **regionIncluded** container be used at the shipping service level. The excluded shipping regions (if any) can instead be set up in the top-level **regionExcluded** container.  
  
The **regionIncluded** and **regionExcluded** containers define the geographical regions/countries/states or provinces/domestic regions where the seller does and doesn't ship to with this fulfillment policy.  
  
To retrieve the valid geographical shipping region values, two-digit country values, or special domestic regions for an eBay marketplace, call [GeteBayDetails](/devzone/xml/docs/reference/ebay/GeteBayDetails.html) with **DetailName** value set to `ExcludeShippingLocationDetails`, then review the **ExcludeShippingLocationDetails** containers in the response for the strings you use in the **regionIncluded.regionName** field.

*   For valid geographical region names, look for the `ExcludeShippingLocationDetails` containers in the **GeteBayDetails** response where the **Region** value is `Worldwide`, and the valid values will be shown in the corresponding **Location** fields.
*   For valid two-digit country codes, look for `ExcludeShippingLocationDetails` in the **GeteBayDetails** response where the **Region** value is one of the defined geographical regions, and the valid values will be shown in the corresponding **Location** fields. Alternatively, you can find the two-digit country code values in the [CountryCodeEnum](/api-docs/sell/account/types/ba:CountryCodeEnum) type definition.
*   For valid domestic region values, look for `ExcludeShippingLocationDetails` in the **GeteBayDetails** response where the **Region** value is either `Domestic Location` or `Additional Locations`, and the valid values will be shown in the corresponding **Location** fields.

The `STATE_OR_PROVINCE` region type is only applicable to the US and Canada, and valid values for US states are the same [two-digit abbreviations](https://about.usps.com/who-we-are/postal-history/state-abbreviations.htm ) used by the United States Postal Service, and valid values for Canadian provinces and territories are the same [two-digit abbreviations](https://www.canadapost-postescanada.ca/cpc/en/support/articles/addressing-guidelines/symbols-and-abbreviations.page ) used by the Canada Post.
- **sortOrder** (integer)
  - The integer value set in this field controls the order of the corresponding domestic or international shipping service option in the View Item and Checkout pages.  
  
If the **sortOrder** field is not supplied, the order of domestic and international shipping service options is determined by the order in which they are listed in the API call.  
  
**Min**: 1. **Max**: 4 (for domestic shipping service) or 5 (for international shipping service).
- **surcharge** (Amount)
  - **Note:** DO NOT USE THIS FIELD. Shipping surcharges for domestic shipping service options can no longer be set with fulfillment business policies, except through shipping rate tables.  
  
To do this, a seller would set up a surcharge-based shipping rate table and specify the surcharge in that table. Then, the seller would need to associate this shipping rate table to the fulfillment business policy by specifying the unique ID of the shipping rate table through the **shippingOptions.rateTableId** field. Shipping surcharges cannot be applied at all to international shipping service options.

### Subscription
**Description:** This type is used by the **getSubscription** response container, which defines the subscription types and levels for the seller account.
**Type:** object

**Properties:**
- **marketplaceId** (MarketplaceIdEnum)
  - The marketplace with which the subscription is associated.
- **subscriptionId** (string)
  - The subscription ID.
- **subscriptionLevel** (string)
  - The subscription level. For example, subscription levels for an eBay store include Starter, Basic, Featured, Anchor, and Enterprise levels.
- **subscriptionType** (SubscriptionTypeEnum)
  - The kind of entity with which the subscription is associated, such as an eBay store.
- **term** (TimeDuration)
  - The term of the subscription plan (typically in months).

### SubscriptionResponse
**Description:** This type is used by the response payload for the **getSubscription** method.  
  
**Note**: Pagination has not yet been enabled for **getSubscription**, so all of the pagination-related fields are for future use.
**Type:** object

**Properties:**
- **href** (string)
  - This field is for future use.
- **limit** (integer)
  - This field is for future use.
- **next** (string)
  - This field is for future use.
- **subscriptions** (array)
  - An array of subscriptions associated with the seller account.
- **total** (integer)
  - The total number of subscriptions displayed on the current page of results.

### SubscriptionTypeEnum
**Description:** This enumerated type lists the types of subscriptions that may be associated with a seller account, such as an eBay store subscription. | - **STORE_PLAN**: STORE_PLAN
**Type:** object

### TimeDuration
**Description:** A type used to specify a period of time using a specified time-measurement unit. Payment, return, and fulfillment business policies all use this type to specify time windows.  
  
Whenever a container that uses this type is used in a request, both of these fields are required. Similarly, whenever a container that uses this type is returned in a response, both of these fields are always returned.
**Type:** object

**Properties:**
- **unit** (TimeDurationUnitEnum)
  - These enum values represent the time measurement unit, such as `DAY`. A span of time is defined when you apply the value specified in the **value** field to the value specified for **unit**.  
  
See **TimeDurationUnitEnum** for a complete list of possible time-measurement units.
- **value** (integer)
  - An integer that represents an amount of time, as measured by the time-measurement unit specified in the **unit** field.

### TimeDurationUnitEnum
**Description:** An enumerated type that specifies the time-measurement unit that's used to express a time span. | - **YEAR**: YEAR - **MONTH**: MONTH - **DAY**: DAY - **HOUR**: HOUR - **CALENDAR_DAY**: CALENDAR_DAY - **BUSINESS_DAY**: BUSINESS_DAY - **MINUTE**: MINUTE - **SECOND**: SECOND - **MILLISECOND**: MILLISECOND
**Type:** object

### UpdatedSalesTaxEntry
**Description:** This container stores the array of sales-tax table entries that have been created or updated.
**Type:** object

**Properties:**
- **countryCode** (string)
  - The two-letter [ISO 3166](https://www.iso.org/iso-3166-country-codes.html  "https://www.iso.org ") code of the country associated with the sales-tax table entry.
- **jurisdictionId** (string)
  - The ID of the tax jurisdiction associated with the sales-tax table entry.
- **statusCode** (integer)
  - The HTTP status code for the call.  
  
**Note:** The system returns one HTTP status code regardless of the number of sales-tax table entries provided. Therefore, the same HTTP `statusCode` will be listed for all sales-tax table entries returned in the payload.

### UpdatedSalesTaxResponse
**Description:** This type is used to return the list of new and updated sales-tax table entries.
**Type:** object

**Properties:**
- **updatedSalesTaxEntries** (array)
  - The array of new and updated sales-tax table entries.

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
*Generated on 2026-05-13T00:31:07.216Z*
