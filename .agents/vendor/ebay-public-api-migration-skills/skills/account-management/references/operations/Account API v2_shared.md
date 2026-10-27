---
title: Account API v2
description: "The Account API v2 helps sellers manage their shipping logistics, seller preferences, and payout settings through a single set of REST endpoints. This API focuses on shipping rate tables and combined-shipping discounts, seller-level preferences (like combined payments, same-day shipping cut-off times, and unpaid item handling), and, for eligible sellers in mainland China, configuring split payouts across two payment instruments. Specifically, the API lets you define and maintain shipping rate tables by marketplace and region, including service-level categories, per-item or weight-based rates, and regional surcharges. It also supports creating and updating combined-shipping rules (calculated, flat, and promotional) that control how shipping and handling fees are discounted when buyers purchase multiple items in a single order. In addition, you can read and update seller preferences such as combined payment settings, dispatch cut-off time for same-day shipping, unpaid item automation, and carrier rate options, as well as retrieve and adjust payout split percentages across two active payout instruments in supported regions. This API is exposed as a REST service under the `/sell/account/v2` base path, using standard HTTP methods and JSON payloads. It is designed to be used alongside listing and order APIs so you can centralize rate tables, shipping discounts, and payout rules at the account level and apply them consistently across all your eBay listings and marketplaces. ### How to get started * Review the Account API v2 reference: [https://developer.ebay.com/develop/api/account/api](https://developer.ebay.com/develop/api/account/api) * Sign in to your eBay developer account and use the API Explorer to test key operations such as managing rate tables, combined-shipping rules, user preferences, and payout settings in your chosen environment: [https://developer.ebay.com/my/api\\_test\\_tool](https://developer.ebay.com/my/api_test_tool) * Use the `rateTableId`, `rateId`, and combined-shipping rule configurations returned by this API when creating or updating listings so that shipping costs and discounts are driven from centrally managed tables and rules rather than per-listing overrides. * For marketplace-specific behaviors—such as Global Shipping Program availability, carrier rate options, and supported rate calculation types—combine Account API v2 with metadata and shipping documentation to validate configurations before rolling them out broadly. **NOTE:** Some features in Account API v2 are marketplace- or region-specific—for example, Global Shipping Program and carrier rate preferences are limited to certain marketplaces, and split payout configuration is currently supported only for eligible sellers in mainland China. Be sure to check marketplace constraints when designing cross-market integrations."
api_version: 2.2.0
api_name: account_api_v2
api_type: REST
api_group: account/api
source_url:
  html: https://developer.ebay.com/develop/api/account/api
  md: https://developer.ebay.com/develop/api/account/api.md
---
# Account API v2 API


## Types

### Amount
**Description:** A complex type that describes the value of a monetary amount as represented by a global currency.
**Type:** object

**Properties:**
- **currency** (CurrencyCodeEnum)
  - The base currency applied to the **value** field to establish a monetary amount.  
  
The currency is represented as a 3-letter ISO 4217 currency code. For example, the code for the Canadian Dollar is `CAD`.
- **value** (string)
  - The monetary amount in the specified **currency**.

### CalculatedHandlingRuleType
**Description:** This type defines the structure for calculated handling fee discounts applicable when combining multiple orders.
**Type:** object

**Properties:**
- **combinedShippingRuleType** (CombinedShippingRuleTypeHandlingEnum)
  - This enumeration value specifies the type of combined-shipping rule applied to handling fees (for example, weight-based, flat-rate, or percentage-based calculation method).
- **eachAdditionalAmount** (Amount)
  - This container specifies the additional monetary charge applied for each extra item included in a combined shipment.  
  
**Note:** This request field is only applicable for the **createFlatShippingRules** and **updateFlatShippingRules** methods. If used in the request for the **createCalculatedShippingRules** or **updateCalculatedShippingRules** methods, an error will occur.
- **eachAdditionalAmountOffShippingCost** (Amount)
  - This container represents the fixed monetary discount deducted from the total shipping cost for each additional item in a combined shipment.  
  
**Note:** This request field is only applicable for the **createFlatShippingRules** and **updateFlatShippingRules** methods. If used in the request for the **createCalculatedShippingRules** or **updateCalculatedShippingRules** methods, an error will occur.
- **eachAdditionalPercentOffShippingCost** (number)
  - This integer specifies the percentage discount applied to the total shipping cost for each additional item in a combined shipment.  
  
**Note:** This request field is only applicable for the **createFlatShippingRules** and **updateFlatShippingRules** methods. If used in the request for the **createCalculatedShippingRules** or **updateCalculatedShippingRules** methods, an error will occur.
- **orderHandlingAmount** (Amount)
  - This container represents the handling fee charged for processing a combined order, if applicable.

### CalculatedShippingRuleType
**Description:** This type describes calculated discount rules determining total shipping cost reductions for combined items.
**Type:** object

**Properties:**
- **combinedShippingRules** (array)
  - This array lists the discount rules applied to combined shipments, detailing calculation methods and rule identifiers.  
  
When used by a create call, there won't be any rule ID.
- **combinedShippingRuleType** (CombinedShippingRuleTypeEnum)
  - This container defines the type of combined-shipping rule applied to calculate discounts, such as weight-based, percentage-based, or flat-rate models.

### CombinedPaymentOptionEnum
**Description:** This enum type defines the available options for handling combined payments when a seller allows multiple line items from the same buyer to be paid for with a single payment. See `CombinedPaymentOptionEnum` for a description of each value. | - **NO_COMBINED_PAYMENT**: NO_COMBINED_PAYMENT - **DISCOUNT_SPECIFIED**: DISCOUNT_SPECIFIED - **SPECIFY_DISCOUNT_LATER**: SPECIFY_DISCOUNT_LATER
**Type:** object

### CombinedPaymentPeriodEnum
**Description:** This enumerated type defines the allowable time durations (e.g., 3, 7, 14 days) within which multiple unpaid items may be merged into a combined invoice. | - **DAYS_14**: DAYS_14 - **DAYS_3**: DAYS_3 - **DAYS_30**: DAYS_30 - **DAYS_5**: DAYS_5 - **DAYS_7**: DAYS_7 - **INELIGIBLE**: INELIGIBLE
**Type:** object

### CombinedPaymentPreferencesType
**Description:** This container is used to change the combined payment option. Sellers have the option to combine multiple line items from the same buyer into a combined invoice that can be paid for with one payment. See CombinedPaymentOptionEnum for a description of each value.
**Type:** object

**Properties:**
- **combinedPaymentOption** (CombinedPaymentOptionEnum)
  - This enum type defines the available options for handling combined payments when a seller allows multiple line items from the same buyer to be paid for with a single payment. See `CombinedPaymentOptionEnum` for a description of each value.

### CombinedShippingRule
**Description:** This container defines a discount profile schema for combined shipping, including rule IDs, names, and applicable weight or amount reductions.  
  
**Note:** This field is not applicable for the create rule use case.
**Type:** object

**Properties:**
- **combinedShippingRuleId** (string)
  - This field represents the unique identifier for the combined-shipping discount profile, used to reference or update a specific rule configuration.  
  
**Note:** This request field is only applicable for **update** methods to specify the rule configuration being updated. If used in the request of a **create** method, an error will occur.
- **combinedShippingRuleName** (string)
  - This field specifies the unique name identifying the combined shipping discount profile within the seller’s account.
- **eachAdditionalAmount** (Amount)
  - This container defines the additional monetary charge applied for each extra item when multiple items are shipped together.
- **eachAdditionalAmountOffShippingCost** (Amount)
  - This container defines the fixed discount amount deducted from the total shipping cost for each additional item.
- **eachAdditionalPercentOffShippingCost** (number)
  - This integer specifies the percentage discount applied to the total shipping cost for each additional item in the combined order.
- **mappedCombinedShippingRuleId** (string)
  - This field specifies the unique ID that links this combined-shipping rule to another related rule in the seller’s account.
- **weightOffTotalWeight** (MeasureType)
  - This container specifies the total weight reduction applied when combining multiple items into one shipment.  
  
**Note:** This request field is only applicable for the **createCalculatedShippingRules** and **updateCalculatedShippingRules** methods. If used in the request for the **createFlatShippingRules** or **updateFlatShippingRules** methods, an error will occur.

### CombinedShippingRuleTypeEnum
**Description:** This enumeration type defines the available types of combined-shipping rules, such as weight-based, cost-based, or flat-rate discount models. | - **COMBINED_ITEM_WEIGHT**: COMBINED_ITEM_WEIGHT - **EACH_ADDITIONAL_AMOUNT**: EACH_ADDITIONAL_AMOUNT - **EACH_ADDITIONAL_AMOUNT_OFF**: EACH_ADDITIONAL_AMOUNT_OFF - **EACH_ADDITIONAL_PERCENT_OFF**: EACH_ADDITIONAL_PERCENT_OFF - **INDIVIDUAL_ITEM_WEIGHT**: INDIVIDUAL_ITEM_WEIGHT - **MAXIMUM_SHIPPING_COST_PER_ORDER**: MAXIMUM_SHIPPING_COST_PER_ORDER - **SHIPPING_COST_X_FOR_AMOUNT_Y**: SHIPPING_COST_X_FOR_AMOUNT_Y - **SHIPPING_COST_X_FOR_ITEM_COUNT_N**: SHIPPING_COST_X_FOR_ITEM_COUNT_N - **WEIGHT_OFF**: WEIGHT_OFF
**Type:** object

### CombinedShippingRuleTypeHandlingEnum
**Description:** This enumeration type calculates all valid handling discount rule types that govern how combined order handling costs are applied. | - **COMBINED_HANDLING_FEE**: COMBINED_HANDLING_FEE - **EACH_ADDITIONAL_AMOUNT**: EACH_ADDITIONAL_AMOUNT - **EACH_ADDITIONAL_AMOUNT_OFF**: EACH_ADDITIONAL_AMOUNT_OFF - **EACH_ADDITIONAL_PERCENT_OFF**: EACH_ADDITIONAL_PERCENT_OFF - **INDIVIDUAL_HANDLING_FEE**: INDIVIDUAL_HANDLING_FEE
**Type:** object

### CreateCalculatedShippingRulesRequest
**Description:** This type defines the structure of a request to create calculated shipping rules, including handling, duration, and rule type details.
**Type:** object

**Properties:**
- **calculatedHandlingRule** (CalculatedHandlingRuleType)
  - This container defines the calculated handling fee rules applied to combined orders, specifying how handling costs are determined or discounted  
  
This container is based on combined-shipping parameters.
- **calculatedShippingRule** (CalculatedShippingRuleType)
  - This container defines the calculated shipping rule applied to combined orders, detailing how shipping discounts or costs are computed  
  
This container is based on item count, total weight, or order value.
- **combinedDuration** (CombinedPaymentPeriodEnum)
  - This enumerated value specifies the time window during which multiple unpaid orders can be combined into a single payment or invoice, represented by using one of the values in [CombinedPaymentPeriodEnum](/api-docs/sell/account/v2/types/api:CombinedPaymentPeriodEnum ) .

### CreateFlatShippingRulesRequest
**Description:** This type represents a request to configure flat-rate combined shipping rules with specified durations and conditions.
**Type:** object

**Properties:**
- **combinedDuration** (CombinedPaymentPeriodEnum)
  - This enumerated value specifies the time window during which multiple unpaid orders can be combined into a single payment or invoice, represented by using one of the values in [CombinedPaymentPeriodEnum](/api-docs/sell/account/v2/types/api:CombinedPaymentPeriodEnum ).
- **flatShippingRule** (FlatShippingRuleType)
  - This container defines the flat-rate combined-shipping rule, which applies a fixed shipping cost for multiple items shipped together.

### CreatePromotionalShippingRuleRequest
**Description:** This type represents the request schema for creating promotional shipping rules with combined payment durations.
**Type:** object

**Properties:**
- **combinedDuration** (CombinedPaymentPeriodEnum)
  - This container specifies the time window during which multiple unpaid orders can be combined into a single payment or invoice, represented by using one of the values in [CombinedPaymentPeriodEnum](/api-docs/sell/account/v2/types/api:CombinedPaymentPeriodEnum ).
- **promotionalShippingRule** (PromotionalShippingRuleType)
  - This container defines the promotional combined-shipping rule that offers discounts or free shipping based on order value, item count, or other qualifying conditions.

### CurrencyCodeEnum
**Description:** This enumerated type lists the three-letter [ISO 4217](https://www.iso.org/iso-4217-currency-codes.html  "https://www.iso.org ") codes representing the supported world currencies. | - **AED**: AED - **AFN**: AFN - **ALL**: ALL - **AMD**: AMD - **ANG**: ANG - **AOA**: AOA - **ARS**: ARS - **AUD**: AUD - **AWG**: AWG - **AZN**: AZN - **BAM**: BAM - **BBD**: BBD - **BDT**: BDT - **BGN**: BGN - **BHD**: BHD - **BIF**: BIF - **BMD**: BMD - **BND**: BND - **BOB**: BOB - **BRL**: BRL - **BSD**: BSD - **BTN**: BTN - **BWP**: BWP - **BYR**: BYR - **BZD**: BZD - **CAD**: CAD - **CDF**: CDF - **CHF**: CHF - **CLP**: CLP - **CNY**: CNY - **COP**: COP - **CRC**: CRC - **CUP**: CUP - **CVE**: CVE - **CZK**: CZK - **DJF**: DJF - **DKK**: DKK - **DOP**: DOP - **DZD**: DZD - **EGP**: EGP - **ERN**: ERN - **ETB**: ETB - **EUR**: EUR - **FJD**: FJD - **FKP**: FKP - **GBP**: GBP - **GEL**: GEL - **GHS**: GHS - **GIP**: GIP - **GMD**: GMD - **GNF**: GNF - **GTQ**: GTQ - **GYD**: GYD - **HKD**: HKD - **HNL**: HNL - **HRK**: HRK - **HTG**: HTG - **HUF**: HUF - **IDR**: IDR - **ILS**: ILS - **INR**: INR - **IQD**: IQD - **IRR**: IRR - **ISK**: ISK - **JMD**: JMD - **JOD**: JOD - **JPY**: JPY - **KES**: KES - **KGS**: KGS - **KHR**: KHR - **KMF**: KMF - **KPW**: KPW - **KRW**: KRW - **KWD**: KWD - **KYD**: KYD - **KZT**: KZT - **LAK**: LAK - **LBP**: LBP - **LKR**: LKR - **LRD**: LRD - **LSL**: LSL - **LTL**: LTL - **LYD**: LYD - **MAD**: MAD - **MDL**: MDL - **MGA**: MGA - **MKD**: MKD - **MMK**: MMK - **MNT**: MNT - **MOP**: MOP - **MRO**: MRO - **MUR**: MUR - **MVR**: MVR - **MWK**: MWK - **MXN**: MXN - **MYR**: MYR - **MZN**: MZN - **NAD**: NAD - **NGN**: NGN - **NIO**: NIO - **NOK**: NOK - **NPR**: NPR - **NZD**: NZD - **OMR**: OMR - **PAB**: PAB - **PEN**: PEN - **PGK**: PGK - **PHP**: PHP - **PKR**: PKR - **PLN**: PLN - **PYG**: PYG - **QAR**: QAR - **RON**: RON - **RSD**: RSD - **RUB**: RUB - **RWF**: RWF - **SAR**: SAR - **SBD**: SBD - **SCR**: SCR - **SDG**: SDG - **SEK**: SEK - **SGD**: SGD - **SHP**: SHP - **SLL**: SLL - **SOS**: SOS - **SRD**: SRD - **STD**: STD - **SYP**: SYP - **SZL**: SZL - **THB**: THB - **TJS**: TJS - **TMT**: TMT - **TND**: TND - **TOP**: TOP - **TRY**: TRY - **TTD**: TTD - **TWD**: TWD - **TZS**: TZS - **UAH**: UAH - **UGX**: UGX - **USD**: USD - **UYU**: UYU - **UZS**: UZS - **VEF**: VEF - **VND**: VND - **VUV**: VUV - **WST**: WST - **XAF**: XAF - **XCD**: XCD - **XOF**: XOF - **XPF**: XPF - **YER**: YER - **ZAR**: ZAR - **ZMW**: ZMW - **ZWL**: ZWL
**Type:** object

### DispatchCutoffTimePreferencesType
**Description:** This container is used to change the order cut-off time for same-day shipping.
**Type:** object

**Properties:**
- **cutoffTime** (string)
  - This field indicates the dispatch cut-off time in Zulu format (`HH:mm:ss.SSSZ`) - 24-hour format with milliseconds and Z timezone indicator.  
**Note**: Despite the Z that is returned in the timestamp, the cut-off time is actually based on the default timezone of the eBay marketplace for the seller.  
**Note**: If an eBay listing supports same-day shipping, and an order is paid for before the cut-off time, the seller is expected to ship the order out that same business day.

### EndOfAuctionEmailPreferencesType
**Description:** This container shows the seller's preferences for the end-of-auction email sent to the winning bidder.
**Type:** object

**Properties:**
- **emailCustomized** (boolean)
  - This boolean field indicates whether or not the seller is using a customized email to send to winning bidders.
- **logoCustomized** (boolean)
  - This boolean field indicates whether or not the seller is using a customized logo in the emails that are sent to winning bidders.
- **logoType** (EndOfAuctionLogoTypeEnum)
  - This enum indicates the type of logo that is used in the email that is sent to winning bidders. See EndOfAuctionLogoTypeEnum type for descriptions of the different logo types.
- **logoUrl** (string)
  - This field shows the URL path to a seller’s custom logo image that is being used in the email sent to winning bidders. This field is only returned if the seller is using a customized logo in emails.
- **templateText** (string)
  - This field shows the body text that is being used if the seller is sending customized emails to winning bidders. The template text has a maximum limit of 1000 characters.
- **textCustomized** (boolean)
  - This boolean field indicates whether or not the seller is using customized text in the emails that are sent to winning bidders.

### EndOfAuctionLogoTypeEnum
**Description:** This enum type defines the supported logo types that can be used in end-of-auction emails sent to winning bidders. | - **WINNING_BIDDER_NOTICE**: WINNING_BIDDER_NOTICE - **STORE**: STORE - **CUSTOMIZED**: CUSTOMIZED - **NONE**: NONE
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

### ErrorParameter
**Type:** object

**Properties:**
- **name** (string)
  - The object of the error.
- **value** (string)
  - The value of the object.

### FedexRateOptionEnum
**Description:** This enum type defines the FedEx shipping rate options that are available to the seller. | - **FEDEX_STANDARD_LIST**: FEDEX_STANDARD_LIST - **FEDEX_COUNTER**: FEDEX_COUNTER
**Type:** object

### FlatShippingRuleType
**Description:** This type defines the flat-rate combined-shipping rule, which applies a fixed shipping cost for multiple items shipped together.
**Type:** object

**Properties:**
- **combinedShippingRules** (array)
  - This array specifies the type of combined-shipping rule applied, such as flat-rate or cost-based.
- **combinedShippingRuleType** (CombinedShippingRuleTypeEnum)
  - This container defines the type of discount rule applied (e.g., percentage-based, fixed-rate).

### GetCombinedShippingRulesPublicApiResponse
**Description:** The base response type of the **getCombinedShippingRules** method.  
  
All of a seller's calculated, flat, and promotional shipping discount rules defined for an eBay marketplace will be returned in the response, along with the current combined duration value.
**Type:** object

**Properties:**
- **calculatedHandlingRule** (CalculatedHandlingRuleType)
  - This container will show one or more calculated shipping rules set up for that seller on that ebay marketplace.  
  
**Note:** This will not be returned if a calculated handling rule is not set up for that seller on that eBay marketplace.
- **calculatedShippingRule** (CalculatedShippingRuleType)
  - This container specifies the type of combined-shipping rule applied, such as flat-rate, weight-based, or cost-based.
- **combinedDuration** (CombinedPaymentPeriodEnum)
  - This field is represented by one of the values in the [CombinedPaymentPeriodEnum](/api-docs/sell/account/v2/types/api:CombinedPaymentPeriodEnum ).
- **flatShippingRule** (FlatShippingRuleType)
  - This container will show one or more flat shipping rules set up for that seller on that eBay marketplace.
- **promotionalShippingRule** (PromotionalShippingRuleType)
  - This container shows the promotional shipping rule that is currently set up on the seller's account for the eBay marketplace.  
  
This container will not be returned if no promotional shipping rule is currently set up on the seller's account for the eBay marketplace.

### GetItemsAwaitingPaymentPreferencesType
**Description:** This container represents the seller's preferences for the list of items that are awaiting payment.
**Type:** object

**Properties:**
- **autoRelist** (boolean)
  - This boolean indicates if the item should be automatically relisted.
- **delayBeforeCancellingCommitment** (integer)
  - This integer indicates the delay in days before cancelling the buyer's commitment.
- **excludedUsers** (array)
  - This string returns the list of sellers excluded from unpaid item assistance.
- **optInStatus** (boolean)
  - This boolean indicates if the unpaid item assistance is opted in.

### GetUserPreferencesResponse
**Description:** This type defines the responses for the getUserPreferences method.
**Type:** object

**Properties:**
- **combinedPaymentPreferences** (CombinedPaymentPreferencesType)
  - This container returns the combined payment preferences when the `COMBINED_PAYMENT` value is included through the **fieldgroups** query parameter or when **fieldgroups**\=`ALL`. It indicates if the seller allows multiple line items from the same buyer to be combined.
- **dispatchCutoffTimePreference** (DispatchCutoffTimePreferencesType)
  - This container is returned when the `DISPATCH_CUTOFF_TIME` value is included through the **fieldgroups** query parameter or when **fieldgroups**\=`ALL`.
- **emailShipmentTrackingNumberPreference** (boolean)
  - This boolean field indicates whether or not the seller’s account is configured to automatically send an email to buyers with the shipment tracking number for an order.
- **endOfAuctionEmailPreferences** (EndOfAuctionEmailPreferencesType)
  - This container allows sellers to customize the email sent to buyers immediately after an auction listing is won.
- **globalShippingProgramListingPreference** (boolean)
  - This boolean field indicates whether or not the seller’s new listings on the eBay marketplace will automatically use the Global Shipping Program for international shipping. This field is returned when the `GLOBAL_SHIPPING_PROGRAM` value is included through the **fieldgroups** query parameter or when **fieldgroups**\=`ALL`.  
**Note**: The Global Shipping Program is only available for the eBay UK marketplace, and the seller must be opted into the program.
- **itemsAwaitingPaymentPreferences** (GetItemsAwaitingPaymentPreferencesType)
  - This container shows the seller’s preferences for automatically handling unpaid line items.
- **offerGlobalShippingProgramPreference** (boolean)
  - This boolean field indicates whether or not the seller is opted into the Global Shipping Program on the eBay marketplace.  
**Note**: The Global Shipping Program is only available for the eBay UK marketplace.
- **outOfStockControlPreference** (boolean)
  - This boolean field indicates whether or not the seller is opted into the Out-of-Stock feature. With this feature, a multiple quantity fixed price listing that runs out of stock will be hidden from eBay search but kept alive. Once the sellers add quantity to the listing, the listing will become active and available again.
- **overrideGspServiceWithIntlServicePreference** (boolean)
  - This boolean field indicates whether or not the seller specifies an international shipping service to a particular country for a given listing, the specified service will take precedence and be the listing's default international shipping option for buyers in that country, rather than the Global Shipping Program.  
**Note**: The Global Shipping Program is only available for the eBay UK marketplace.
- **pickupDropoffSellerPreference** (boolean)
  - This boolean field indicates whether or not the seller is opted into the Click & Collect feature.  
**Note**: The Click & Collect feature is only available on the eBay UK, Australia, and Germany marketplaces.
- **purchaseReminderEmailPreferences** (boolean)
  - This boolean field indicates whether or not the seller’s account is configured to have eBay send occasional purchase reminder emails for unpaid line items.
- **requiredShipPhoneNumberPreference** (boolean)
  - This boolean field indicates whether or not the buyer is required to provide a shipping phone number during checkout.
- **sellerExcludeShipToLocationPreferences** (SellerExcludeShipToLocationPreferencesType)
  - This container shows the list of locations that the seller does not ship to. This list of shipping locations can only be updated in My eBay through Shipping Preferences and not with the `setUserPreferences` method.
- **sellerProfilePreferences** (SellerProfilePreferencesType)
  - This container is returned when the `SELLER_PROFILE` value is included through the **fieldgroups** query parameter or when **fieldgroups**\=`ALL`.
- **shippingCarrierRatePreferences** (ShippingCarrierRatePreferencesType)
  - This container indicates the FedEx, UPS, and US Post Office shipping rate types that are available to the seller. This container is returned when the `SHIPPING_CARRIER_RATE` value is included through the **fieldgroups** query parameter or when **fieldgroups**\=`ALL`.  
**Note**: This container is only applicable to the eBay US marketplace.

### InstrumentStatusEnum
**Description:** This enumeration type lists the different possible instrument statuses that can be returned with the **getPayoutSettings** method.  
  
**Note:** Payout splits can only be modified for accounts in `ACTIVE` state. | - **PENDING**: PENDING - **ACTIVE**: ACTIVE - **VERIFICATION_FAILED**: VERIFICATION_FAILED - **INACTIVE**: INACTIVE
**Type:** object

### MarketplaceIdEnum
**Description:** This enumerated type defines the unique eBay-assigned IDs for each of the eBay marketplaces. | - **EBAY_AT**: EBAY_AT - **EBAY_AU**: EBAY_AU - **EBAY_BE**: EBAY_BE - **EBAY_CA**: EBAY_CA - **EBAY_CH**: EBAY_CH - **EBAY_CN**: EBAY_CN - **EBAY_CZ**: EBAY_CZ - **EBAY_DE**: EBAY_DE - **EBAY_DK**: EBAY_DK - **EBAY_ES**: EBAY_ES - **EBAY_FI**: EBAY_FI - **EBAY_FR**: EBAY_FR - **EBAY_GB**: EBAY_GB - **EBAY_GR**: EBAY_GR - **EBAY_HK**: EBAY_HK - **EBAY_HU**: EBAY_HU - **EBAY_ID**: EBAY_ID - **EBAY_IE**: EBAY_IE - **EBAY_IL**: EBAY_IL - **EBAY_IN**: EBAY_IN - **EBAY_IT**: EBAY_IT - **EBAY_JP**: EBAY_JP - **EBAY_MY**: EBAY_MY - **EBAY_NL**: EBAY_NL - **EBAY_NO**: EBAY_NO - **EBAY_NZ**: EBAY_NZ - **EBAY_PE**: EBAY_PE - **EBAY_PH**: EBAY_PH - **EBAY_PL**: EBAY_PL - **EBAY_PR**: EBAY_PR - **EBAY_PT**: EBAY_PT - **EBAY_RU**: EBAY_RU - **EBAY_SE**: EBAY_SE - **EBAY_SG**: EBAY_SG - **EBAY_TH**: EBAY_TH - **EBAY_TW**: EBAY_TW - **EBAY_US**: EBAY_US - **EBAY_VN**: EBAY_VN - **EBAY_ZA**: EBAY_ZA - **EBAY_HALF_US**: EBAY_HALF_US - **EBAY_MOTORS_US**: EBAY_MOTORS_US
**Type:** object

### MeasureType
**Description:** This type displays measurement type with value, unit, and measurement system.
**Type:** object

**Properties:**
- **unit** (WeightUnitOfMeasureEnum)
  - This field defines the unit of measure (e.g., kilograms, pounds) associated with the value field.
- **value** (string)
  - This field defines the numeric value representing the measurement, weight, in the specified unit.

### PayoutInstrument
**Description:** This type is used to provide details about one or two of the seller's accounts that are enabled to receive payouts.
**Type:** object

**Properties:**
- **accountLastFourDigits** (string)
  - The last four digits of the account that the seller uses to receive payouts. This may be the last four digits of a bank account or a payment processor account such as Payoneer.
- **instrumentId** (string)
  - The unique reference identifier for a payout instrument. The **instrumentId** is needed to change the split-payout percentages through an **updatePayoutPercentage** request.
- **instrumentStatus** (InstrumentStatusEnum)
  - The status of a payout instrument. Valid payout instrument statuses include:  

*   `PENDING:` This status indicates that the account must be verified before it can be used.
*   `ACTIVE:`This status indicates that payouts are enabled on this account.
*   `VERIFICATION_FAILED:` This status indicates that verification has failed for this account and payouts are disabled.
*   `INACTIVE:` This status indicates that this account has become inactive and payouts are disabled.

  
See **InstrumentStatusEnum** for more details on each instrument status value.  
  
**Note:** Payment accounts can only receive payouts if the status of a payout instrument is `ACTIVE`.
- **instrumentType** (string)
  - The type of account that received payouts. The value returned in this field may be:  

*   `BANK`: Indicates that the payout was made to a seller's bank account.
*   `CARD` (**Not Currently Available**): Indicates that the payout went to a seller's debit card.
*   The name of a digital wallet provider or payment processor (e.g., `PAYONEER`)

  
**Note:** Only Payoneer is currently supported for sellers in mainland China. Card payouts are not currently available for sellers in mainland China.
- **nickname** (string)
  - When **instrumentType** returns `BANK`, this value is the seller-provided nickname that the seller uses to represent the bank account that receives the payout.  
  
When **instrumentType** returns `CARD`, this value is the debit card network for the debit card that receives the payout.  
  
When **instrumentType** returns a provider of digital wallet or payment processing services, the value returned is the name of the service provider (e.g., `PAYONEER`)  
  
**Note:** Only Payoneer is currently supported for sellers in mainland China. Card payouts are not currently available for sellers in mainland China.
- **payoutPercentage** (string)
  - The current payout percentage allocated to an instrument. For example, `50` indicates that 50% of the payout goes to the instrument.

### PayoutSettingsResponse
**Description:** The base response type of the **getPayoutSettings** method.
**Type:** object

**Properties:**
- **payoutInstruments** (array)
  - This array provides details about the seller's accounts defined for the seller's account.  
  
Payment accounts can only receive payouts if the status of the payout instrument is `ACTIVE`.

### PromotionalShippingRuleType
**Description:** This type is used to represent a promotional shipping rule set up by the seller on an eBay marketplace.
**Type:** object

**Properties:**
- **combinedShippingRuleType** (CombinedShippingRuleTypeEnum)
  - This field specifies the type of combined-shipping rule applied, such as flat-rate or cost-based, as defined in the [CombinedShippingRuleTypeEnum](/api-docs/sell/account/v2/types/api:CombinedShippingRuleTypeEnum).
- **itemCount** (integer)
  - This integer indicates the quantity of items that must be purchased by the buyer in order for that buyer to qualify for the promotional discount.
- **orderAmount** (Amount)
  - This container specifies the minimum order amount required to qualify for the associated discount or promotional rule.
- **shippingCost** (Amount)
  - This container represents the total shipping cost or discounted shipping charge for the combined order.

### Rate
**Description:** This container details shipping rate information identified by a unique rate ID. A successful call returns the requested shipping rate information.
**Type:** object

**Properties:**
- **additionalCost** (Amount)
  - An additional shipping cost added to the base shipping rate (i.e., **shippingCost**).  
  
This amount applies only to the following **rateTableBasis** options:

*   **WEIGHT**: This is a cost per unit weight and is calculated using the weight of the item(s) being shipped.
*   **SURCHARGE**: This is a flat amount that is added to the base shipping rate.

This field is returned only when it is applicable to the specified rate ID.
- **rateId** (string)
  - The unique identifier for rate information.  
  
**Note:** This is a string that is automatically assigned by the system when a rate object is created.
- **shippingCategory** (ShippingCategoryEnum)
  - Indicates the level of shipping service to which the shipping rate information applies.  
  
Available shipping categories are:

*   **ONE\_DAY**: _This option is not supported when **shippingOptionType** is INTERNATIONAL._
*   **EXPEDITED**
*   **STANDARD**
*   **ECONOMY**
*   **EXPRESS**: _This option is supported only when **MarketplaceId** is `EBAY_DE` (Germany)_
- **shippingCost** (Amount)
  - Specifies the base shipping rate for an item.  
  
This amount applies only to the following **rateTableBasis** options:

*   **ITEM**: This is a flat rate shipping cost per item being shipped.
*   **WEIGHT**: This is a cost per unit weight and is calculated using the weight of the item(s) being shipped.
- **shippingRegionNames** (array)
  - An array of Region names to which the shipping rate information applies.  
  
Returned values may be:

*   Geographical Regions (e.g., `Worldwide`, `Europe`, and `Middle East`)
*   Individual countries identified by a two-letter code such as `US` (United States), `CA` (Canada), and `GB` (United Kingdom)
*   US states and/or Canadian provinces identified by a two-letter code such as `NY` (New York) or `SK` (Saskatchewan)
*   Domestic Regions such as `AK/HI` (Alaska/Hawaii)
- **shippingServiceCode** (string)
  - An enum value that indicates the shipping service used for the specified shipping rate. These enum values align with **ShippingService** metadata returned by a **GeteBayDetails** call with **DetailName** set to `shippingServiceDetails`.

### RateTableDetails
**Description:** This container includes all information pertaining to a shipping rate table. A successful call returns the requested shipping rate information.
**Type:** object

**Properties:**
- **marketplaceId** (MarketplaceIdEnum)
  - Identifies the eBay marketplace to which the shipping rate table applies.
- **name** (string)
  - The seller-defined name for the shipping rate table. Names must be unique for each table assigned to the same seller, shippingOptionType, and eBay marketplace.  
  
**Max length:** 50
- **rates** (array)
  - An array of rate objects associated with the specified shipping rate table. Each rate object is identified by a unique system-generated ID and defines specific shipping rate information.
- **rateTableBasis** (ShippingRateCalculationEnum)
  - The rate calculation type provides three methods of calculating the shipping cost based on the seller's selection/input:

*   **ITEM**: Specifies the flat rate shipping cost that buyers in the specified shipping region will pay. When this option is selected, information specified in the rate table overrides all shipping options/costs that are specified at the listing level. Buyers in the specified regions will only see the services provided in the rate table. Buyers in other regions that are not specified in the rate table will see the shipping services associated with the listing.
*   **WEIGHT**: Seller can provide minimum shipping cost and an additional shipping cost per pound. The additional cost will be calculated based on the weight the seller provide at the time of listing. Buyers will see the total shipping cost and won’t see these calculations. Buyers in the specified regions will only see the services provided in the rate table. Buyers in other regions that were not specified in the rate table, will see the shipping services associated with the listing.
*   **SURCHARGE**: Lists surcharges for buyers within specified regions, or indicates a flat amount added to the shipping cost specified within an item's listing. Buyers will see only the total shipping cost as well as shipping services associated with the item's listing. If a SURCHARGE is specified in the rate table for certain regions, buyers in those regions will see the (shipping cost + SURCHARGE) total.
- **rateTableId** (string)
  - A unique, system-generated ID assigned to the shipping rate table when it is initially created.
- **shippingOptionType** (ShippingOptionTypeEnum)
  - The region serviced by the shipping rate table. Valid values are:

*   **DOMESTIC**: Indicates that the shipping rate table applies to shipping destinations within the country in which an item has been listed (i.e., the _source_ country).
*   **INTERNATIONAL**: Indicates that the shipping rate table applies to shipping destinations outside of the country in which an item has been listed.

### RateTableUpdate
**Description:** This type is used by the request payload of the **updateShippingCost** method to pass updated shipping cost information for a rate table identified by **rateTableId**.
**Type:** object

**Properties:**
- **rates** (array)
  - An array of rate objects for which **shippingCost** and/or **additionalCost** are to be updated.

### RateUpdate
**Description:** This container defines the updated shipping cost information for a rate object identified by **rateId**.  
  
To view a list of all rate objects and corresponding **rateID** values, issue **getRateTable** for the rate table identified by **rateTableId**.
**Type:** object

**Properties:**
- **additionalCost** (Amount)
  - An additional shipping cost added to the base shipping rate (i.e., **shippingCost**).  
  
This amount applies only to the following **rateTableBasis** options:

*   **WEIGHT**: This is a cost per unit weight and is calculated using the weight of the item(s) being shipped.
*   **SURCHARGE**: This is a flat amount that is added to the base shipping rate.

This field is returned only when it is applicable to the specified rate ID.
- **rateId** (string)
  - The identifier for the rate object.  
  
**Note:** This is a string automatically assigned by the system when the rate object is created. It cannot be changed or updated.
- **shippingCost** (Amount)
  - This is the base shipping rate for an item.  
  
This amount applies only to the following **rateTableBasis** options:

*   **ITEM**: This is a flat rate shipping cost per item being shipped.
*   **WEIGHT**: This is a cost per unit weight and is calculated using the weight of the item(s) being shipped.

### SellerExcludeShipToLocationPreferencesType
**Description:** This container represents the list of locations that the seller wants to exclude from shipping.
**Type:** object

**Properties:**
- **excludeShipToLocations** (array)
  - This array shows the list of locations that the seller does not ship to. Excluded locations may include continents and large geographical areas. For example, 'Middle East', individual countries represented by two-letter codes, or special locations within a country such as 'Alaska/Hawaii' or 'PO Box'.

### SellerProfilePreferencesType
**Description:** This container indicates whether or not the seller is opted into Business Policies. If a seller is opted into Business Policies, they must use Payment,Return, and Shipping business policies instead of individual payment, return, and shipping fields.
**Type:** object

**Properties:**
- **sellerProfileOptedIn** (boolean)
  - This boolean indicates whether the seller has opted in to seller profiles.

### SetItemsAwaitingPaymentPreferencesType
**Description:** This container represents the seller's preferences for the items that are awaiting payment.
**Type:** object

**Properties:**
- **autoRelist** (boolean)
  - This boolean field is included if the seller wishes to toggle the setting that controls whether or not the line item should be automatically relisted when cancelled. For this field to be set to `true`, the `optInStatus` field should also be `true`.  
**Note**: If the line item was part of an auction listing or a single-quantity fixed price listing, a new listing will actually be created. If the line item was part of a multiple-quantity fixed price listing, eBay will only adjust the quantity based on the cancelled line item’s quantity.
- **delayBeforeCancellingCommitment** (integer)
  - This integer field is included if the seller wishes to set or change the number of business days without payment that must elapse before the line item is cancelled. This is a required field if the optInStatus field is `true`.  
**Note**: The supported integer values (representing business days) varies by eBay marketplace.
- **excludedUsers** (array)
  - This array is used if the seller wishes to exclude one or more eBay users from the unpaid item assistance mechanism. The seller would need to manually cancel any unpaid line items for all users on this list. This array will not be returned if there are no users on the excluded users list.  
**Note**: The eBay public username is used for each excluded user, and a comma is used to delimit each user in the array.
- **optInStatus** (boolean)
  - This boolean field is included if the seller wishes to toggle the setting that controls whether or not the seller is opted into the unpaid item assistance mechanism. If the seller is not opted in, no other fields under `itemsAwaitingPaymentPreferences` are applicable.
- **removeAllExcludedUsers** (boolean)
  - This boolean field is included and set to `true` if the seller wishes to remove all eBay users from the current excluded users list. If this field is included and set to `true`, the `excludedUsers` array should not be included.

### SetUserPreferencesRequest
**Description:** This type defines the request fields for the seller preferences configuration for eBay services.
**Type:** object

**Properties:**
- **combinedPaymentPreferences** (CombinedPaymentPreferencesType)
  - This container is included if the seller wishes to allow combined invoices if the buyer has multiple unpaid orders from the same seller.
- **dispatchCutoffTimePreference** (DispatchCutoffTimePreferencesType)
  - This container is included if the seller wishes to set or modify the order cut-off time for same-day shipping.
- **emailShipmentTrackingNumberPreference** (boolean)
  - This field is included if the seller wishes to enable or disable the setting that will automatically email the buyer with the tracking number when it becomes available.
- **endOfAuctionEmailPreferences** (EndOfAuctionEmailPreferencesType)
  - This container is included if the seller wishes to change one or more of the end of auction email preferences.
- **globalShippingProgramListingPreference** (boolean)
  - This boolean field is included if the seller wishes to toggle the setting that controls whether or not the seller’s new listings on the eBay UK marketplace will automatically use the Global Shipping Program for international shipping.  
**Note**: The Global Shipping Program is only available for the eBay UK marketplace, and the seller must be opted into the program, that is `offerGlobalShippingProgramPreference = true`
- **itemsAwaitingPaymentPreferences** (SetItemsAwaitingPaymentPreferencesType)
  - This container is included if the seller wishes to change one or more of the items awaiting payment preferences.
- **outOfStockControlPreference** (boolean)
  - This boolean field is included if the seller wishes to toggle the setting that controls whether or not the seller is opted into the Out-of-Stock feature. With this feature, a multiple quantity fixed price listing that runs out of stock will be hidden from eBay search but kept alive. Once the sellers add quantity to the listing, the listing will become active and available again.
- **purchaseReminderEmailPreferences** (boolean)
  - This boolean field is included if the seller wishes to toggle the setting that controls whether or not the buyer is expected to provide a shipping phone number upon checkout. Some shipping carriers require the receiver's phone number.
- **requiredShipPhoneNumberPreference** (boolean)
  - This boolean indicates whether the seller wishes to require phone numbers for shipping or not.
- **shippingCarrierRatePreferences** (ShippingCarrierRatePreferencesType)
  - This container is included if the seller wishes to add or modify a FedEx, UPS, and/or US Post Office shipping rate type that is available to the seller.  
**Note**: This container is only applicable to the eBay US marketplace.

### ShippingCarrierRatePreferencesType
**Description:** This field is included if the seller wishes to add or modify the shipping carrier rate type that is available to the seller. This field is only returned if set.  
**Note**: This container is only applicable to the eBay US marketplace.
**Type:** object

**Properties:**
- **fedexRateOption** (FedexRateOptionEnum)
  - This enum is included if the seller wishes to add or modify the FedEx shipping carrier rate.  
**Note**: This preference is only applicable to the eBay US marketplace.
- **upsRateOption** (UPSRateOptionEnum)
  - This enum is included if the seller wishes to add or modify the UPS shipping carrier rate.  
**Note**: This preference is only applicable to the eBay US marketplace.

### ShippingCategoryEnum
**Description:** An enum that defines the available levels of shipping service. | - **ONE_DAY**: ONE_DAY - **EXPEDITED**: EXPEDITED - **STANDARD**: STANDARD - **ECONOMY**: ECONOMY - **EXPRESS**: EXPRESS
**Type:** object

### ShippingOptionTypeEnum
**Description:** An enum defining a region that is either domestic (within the country from where the item is listed or shipped) or international (a country outside the country from where the item is listed or shipped). | - **DOMESTIC**: DOMESTIC - **INTERNATIONAL**: INTERNATIONAL
**Type:** object

### ShippingRateCalculationEnum
**Description:** An enum that specifies the how a shipping rate is calculated. | - **ITEM**: ITEM - **WEIGHT**: WEIGHT - **SURCHARGE**: SURCHARGE
**Type:** object

### UPSRateOptionEnum
**Description:** This enum type defines the UPS shipping rate options that are available to the seller. | - **UPS_DAILY_RATES**: UPS_DAILY_RATES - **UPS_ON_DEMAND_RATES**: UPS_ON_DEMAND_RATES
**Type:** object

### UpdateCalculatedShippingRulesRequest
**Description:** This type is used to update calculated shipping rules.
**Type:** object

**Properties:**
- **calculatedHandlingRule** (CalculatedHandlingRuleType)
  - This container specifies the calculated handling rule that determines how handling fees are automatically computed based on order weight, quantity, or value in a combined shipment.
- **calculatedShippingRule** (CalculatedShippingRuleType)
  - This container defines the calculated shipping rule that determines shipping costs or discounts based on factors such as total weight, price, or item count in a combined order.
- **combinedDuration** (CombinedPaymentPeriodEnum)
  - This enumerated value specifies the duration within which multiple unpaid orders may be combined into a single invoice, represented by one of the values in [CombinedPaymentPeriodEnum](/api-docs/sell/account/v2/types/api:CombinedPaymentPeriodEnum).

### UpdateCombinedPaymentsRequest
**Description:** This type is used to update the combined payment duration
**Type:** object

**Properties:**
- **combinedDuration** (CombinedPaymentPeriodEnum)
  - This field specifies the duration within which multiple unpaid orders may be combined into a single invoice.  
  
One of the values in [CombinedPaymentPeriodEnum](/api-docs/sell/account/v2/types/api:CombinedPaymentPeriodEnum) must be used in this field.

### UpdateFlatShippingRulesRequest
**Description:** This type defines a request to update flat shipping rules.
**Type:** object

**Properties:**
- **combinedDuration** (CombinedPaymentPeriodEnum)
  - This field specifies the duration within which multiple unpaid orders may be combined into a single invoice.  
  
One of the values in [CombinedPaymentPeriodEnum](/api-docs/sell/account/v2/types/api:CombinedPaymentPeriodEnum) must be used in this field.
- **flatShippingRule** (FlatShippingRuleType)
  - This container defines the flat-rate combined-shipping rule, which applies a fixed shipping cost for multiple items shipped together.

### UpdatePayoutPercentage
**Description:** This type allows the user to change the payout percentages for two active payment instruments.
**Type:** object

**Properties:**
- **instrumentId** (string)
  - The unique reference identifier for a payout instrument. This value is returned in the [getPayoutSettings](/api-docs/sell/account/v2/resources/payout_settings/methods/getPayoutSettings) response and is needed to change split-payout percentages through an **updatePayoutPercentage** request.
- **payoutPercentage** (string)
  - The user-defined payout percentage allocated to this instrument. For example, `50` indicates that 50% of the payout goes to this instrument.  
  
The split-payout percentage **must** be a positive integer value from 0-100. The values of two instruments **must** always add up to 100%. If the values do not equal 100, the call will fail.

### UpdatePayoutPercentageRequest
**Description:** This type is used by the request payload of the **updatePayoutPercentage** method to allow a seller to configure the split-payout percentages for two payout instruments.
**Type:** object

**Properties:**
- **payoutInstruments** (array)
  - This array allows the seller to set the payout split percentages for two accounts enabled to receive payouts.

### UpdatePromotionalShippingRuleRequest
**Description:** This type defines a request to update promotional shipping rule.
**Type:** object

**Properties:**
- **combinedDuration** (CombinedPaymentPeriodEnum)
  - This container specifies the duration within which multiple unpaid orders may be combined into a single invoice.  
  
One of the values in [CombinedPaymentPeriodEnum](/api-docs/sell/account/v2/types/api:CombinedPaymentPeriodEnum) must be used in this field.
- **promotionalShippingRule** (PromotionalShippingRuleType)
  - This container specifies the promotional shipping rule that offers discounts or free-shipping options based on defined order thresholds, item counts, or marketplace conditions.

### WeightUnitOfMeasureEnum
**Description:** This enumeration type defines the supported weight measurement units (e.g., kilograms, pounds, ounces) used in shipping calculations and rule configurations. | - **POUND**: POUND - **KILOGRAM**: KILOGRAM - **OUNCE**: OUNCE - **GRAM**: GRAM
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
*Generated on 2026-05-13T00:37:08.775Z*
