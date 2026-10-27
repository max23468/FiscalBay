---
title: Finances API
description: "The **Finances API** retrieves a variety of seller transactional information, including the following: * Seller payouts for orders * Detailed information on other transaction types, including eBay shipping label purchases, buyer refunds, seller credits, and listing-related fees * Complete list of selling fees and credits during a specified date range * A detailed breakdown of order earnings and seller expenses for orders"
api_version: v1.19.0
api_name: finances_api
api_type: REST
api_group: finances/api
source_url:
  html: https://developer.ebay.com/develop/api/finances/api
  md: https://developer.ebay.com/develop/api/finances/api.md
---
# Finances API API


## Types

### Amount
**Description:** This type is used to express the dollar value and currency used for any transaction retrieved with the **Finances API**, including an order total, a seller payout, a buyer refund, or a seller credit.
**Type:** object

**Properties:**
- **convertedFromCurrency** (CurrencyCodeEnum)
  - The three-letter [ISO 4217](https://www.iso.org/iso-4217-currency-codes.html ) code representing the currency of the amount in the **convertedFromValue** field. This value is the pre-conversion currency.  
  
This field is only returned if/when currency conversion was applied by eBay.
- **convertedFromValue** (string)
  - The monetary amount before any conversion is performed, in the currency specified by the **convertedFromCurrency** field. This value is the pre-conversion amount. The **value** field contains the converted amount of this value, in the currency specified by the **currency** field.  
  
This field is only returned if/when currency conversion was applied by eBay.
- **convertedToCurrency** (CurrencyCodeEnum)
  - **Note:** This field is only applicable for Mainland China sellers with an available CNY Bank payment instrument. This response can **only** have a value of `CNY`.  
The three-letter [ISO 4217](https://www.iso.org/iso-4217-currency-codes.html ) code representing the currency of the amount in the **convertedToValue** field.  
  
This field is only returned for payouts to bank accounts when currency conversion was applied by eBay.
- **convertedToValue** (string)
  - **Note:** This field is only applicable for Mainland China sellers with an available CNY Bank payment instrument. This response **only** returns value in CNY.  
The monetary value after any conversion is performed, in the currency specified by the **convertedToCurrency** field. This value is the converted amount.  
  
The field is only returned for payouts to bank accounts when currency conversion was applied by eBay.
- **currency** (CurrencyCodeEnum)
  - A three-letter ISO 4217 code that indicates the currency of the amount in the **value** field. This field is always returned with any container using **Amount** type.  
  
**Default**: The currency of the authenticated user's country.
- **exchangeRate** (string)
  - The exchange rate used for the monetary conversion. This field shows the exchange rate used to convert the dollar value in the **value** field from the dollar value in the **convertedFromValue** field.  
  
For sellers in mainland China, this field shows the exchange rate to convert the dollar value in the **value** field to the CNY value in the **convertedToValue** field.  
  
This field is only returned when eBay does a currency version, and a currency conversion is generally needed if the buyer is viewing, or has purchased an item on an international site.  
  
This field is only returned if/when currency conversion was applied by eBay.
- **value** (string)
  - The monetary amount, in the currency specified by the **currency** field. This field is always returned with any container using **Amount** type.

### BalanceAdjustment
**Description:** This type is used by the **balanceAdjustment** container, which shows the seller payout balance that will be applied toward the charges outlined in the **charges** array.
**Type:** object

**Properties:**
- **adjustmentAmount** (Amount)
  - The seller payout balance amount that will be applied toward the charges outlined in the **charges** array.
- **adjustmentType** (BookingEntryEnum)
  - The enumeration value returned here indicates if the charge is a `DEBIT` or a `CREDIT` to the seller. Generally, all transfer transaction types are going to be `DEBIT`, since the money is being transferred from the seller to eBay.

### BillingActivityLineItem
**Description:** This type defines the fees, credits, and promotional offers applied to a seller's account.
**Type:** object

**Properties:**
- **amount** (Amount)
  - This container shows the amount of the fee or credit. The value and currency are always returned. If the buyer is in one country and purchases from an eBay marketplace that uses a different currency, the response also includes the converted-from and converted-to fields, along with the exchange rate.
- **billingTransactionDate** (string)
  - This timestamp indicates the date/time when eBay processed the transaction.
- **billingTransactionId** (string)
  - This field provides a unique identifier of the billing transaction. If a seller wants to view details on a specific billing transaction, they can use the **actvityId** filter and pass in a specific **billingTransactionId** value.
- **bookingEntry** (string)
  - The value returned in this field will indicate if the billing transaction is a debit against the seller's account, or a credit. A debit is much more prevalent than a credit, but sometimes a listing fee will get reversed and they will get a credit for this fee. Possible values:  

*   `DEBIT`
*   `CREDIT`
- **feeType** (string)
  - This field describes the type of fee associated with the transaction. An example value is `FinalValueFeeFixedFeePerOrder`.
- **feeTypeDescription** (string)
  - This field contains the human-readable description of the fee type associated with the transaction. For example, `Final Value Fee`.
- **listingId** (string)
  - The unique identifier of the eBay listing associated with the billing transaction. This field is returned if the fee is associated with a listing.
- **orderId** (string)
  - The unique identifier of the eBay order associated with the billing transaction. This field is returned if the fee is associated with an order.
- **promotionalOffers** (array)
  - A list of seller promotional offers applicable for the billing transaction.

### BillingActivityResponse
**Description:** This type is the base response type used by the **getBillingActivities** method.
**Type:** object

**Properties:**
- **billingActivities** (array)
  - A list of billing activity entries that meet the filter criteria. Billing activity will include fees, credits, and promotional offers applied to the seller's account.
- **count** (integer)
  - An integer representing the number of billing activity items returned in this response page.
- **limit** (integer)
  - The value of the **limit** parameter. This is the maximum number of line items, as filtered, of billing transactions to return per page from the result set.
- **next** (string)
  - The URI for the next page of results starting with the resource name. This URI is returned if there is an additional page of results in the result set.
- **offset** (integer)
  - The value of the **offset** parameter. This field indicates how many results were skipped in the response. If an **offset** parameter was not included in the request, this value will default to `0`, returning the first page of results.
- **prev** (string)
  - The URI for the previous page of results starting with the resource name. This URI is returned if there is a previous page of results in the result set.
- **total** (integer)
  - The total number of billing transactions available that match the filter criteria.

**Note:** When the **total** value exceeds the **limit** value, there are multiple pages of results.

### BookingEntryEnum
**Description:** This enumerated type contains the values used to indicate whether the dollar value of a monetary transaction is a positive or negative value. | - **CREDIT**: This enumeration value indicates that the dollar value of the monetary transaction is a credit to the seller's account. Typically, the `SALE` and `CREDIT` transaction types are credits to the seller's account. For sales proceeds in the `FUNDS_ON_HOLD` state, the dollar value shown in the **onHoldAmount** will also show as seller credit. - **DEBIT**: This enumeration value indicates that the dollar value of the monetary transaction is a debit to the seller's account. Typically, the `REFUND`, `DISPUTE`, `SHIPPING_LABEL`, and `TRANSFER` transaction types are debits to the seller's account. Note that the shipping label functionality will initially only be available to a select number of sellers.
**Type:** object

### Buyer
**Description:** This type is used to express details about the buyer associated with an order. At this time, the only field in this type is the eBay user ID of the buyer, but more fields may get added at a later date.
**Type:** object

**Properties:**
- **username** (string)
  - The eBay user ID of the order's buyer.  
  
**Note:** Effective September 26, 2025, select developers will no longer receive username data for U.S. users through this field. Instead, an immutable user ID will be returned in its place. For more information, please refer to [Data Handling Compliance](/api-docs/static/data-handling-update.html).

### BuyerWithId
**Description:** This type defines identifying information about the buyer associated with an order.
**Type:** object

**Properties:**
- **userId** (string)
  - The public user id of the buyer
- **username** (string)
  - The username of the buyer.  
  
**Note:** Effective September 26, 2025, select developers will no longer receive username data for U.S. users through this field. Instead, an immutable user ID will be returned in its place. For more information, please refer to [Data Handling Compliance](/api-docs/static/data-handling-update.html).

### Charge
**Description:** This type is used by the **charge** container, which is an array of one or more charges related to the transfer.
**Type:** object

**Properties:**
- **cancellationId** (string)
  - The unique identifier of an order cancellation. This field is only applicable and returned if the charge is related to an order cancellation.
- **caseId** (string)
  - The unique identifier of a case filed against an order. This field is only applicable and returned if the charge is related to a case filed against an order.
- **chargeNetAmount** (Amount)
  - This container shows the net amount of the charge, which is the total amount of the charge minus the total amount of fees credited towards this refund as per eBay policy. It is possible for there to be multiple charges from multiple orders with one transfer. The net aggregate amount for all charges found in the **charges** array can be found in the **transferDetail.totalChargeNetAmount** container.
- **inquiryId** (string)
  - The unique identifier of an Item Not Received (INR) inquiry filed against an order. This field is only applicable and returned if the charge is related to has an INR inquiry filed against the order.
- **orderId** (string)
  - The unique identifier of the order that is associated with the charge.
- **paymentDisputeId** (string)
  - The unique identifier of a third-party payment dispute filed against an order. This occurs when the buyer files a dispute against the order with their payment provider, and then the dispute comes into eBay's system. This field is only applicable and returned if the charge is related to a third-party payment dispute filed against an order.
- **refundId** (string)
  - The unique identifier of a buyer refund associated with the charge.
- **returnId** (string)
  - The unique identifier of an order return. This field is only applicable and returned if the charge is related to an order that was returned by the buyer.

### CurrencyCodeEnum
**Description:** This enumerated type lists the three-letter [ISO 4217](https://www.iso.org/iso-4217-currency-codes.html  "https://www.iso.org ") code representing the supported world currencies. | - **AED**: United Arab Emirates dirham - **AFN**: Afghan afghani - **ALL**: Albanian lek - **AMD**: Armenian dram - **AOA**: Angolan kwanza - **ARS**: Argentine peso - **AWG**: Aruban florin - **AZN**: Azerbaijani manat - **BAM**: Bosnia and Herzegovina convertible mark - **BBD**: Barbados dollar - **BDT**: Bangladeshi taka - **BGN**: Bulgarian lev - **BHD**: Bahraini dinar - **BIF**: Burundian franc - **BMD**: Bermudian dollar - **BND**: Brunei dollar - **BOB**: Bolivian Boliviano - **BRL**: Brazilian real - **BSD**: Bahamian dollar - **BTN**: Bhutanese ngultrum - **BWP**: Botswana pula - **BYR**: Belarusian ruble - **BZD**: Belize dollar - **CAD**: Canadian dollar - **CDF**: Congolese franc - **CLP**: Chilean peso - **CNY**: Chinese yuan renminbi - **COP**: Colombian peso - **CRC**: Costa Rican colon - **CUP**: Cuban peso - **CVE**: Cape Verde escudo - **CZK**: Czech koruna - **DJF**: Djiboutian franc - **DOP**: Dominican peso - **DZD**: Algerian dinar - **EGP**: Egyptian pound - **ERN**: Eritrean nakfa - **ETB**: Ethiopian birr - **FJD**: Fiji dollar - **FKP**: Falkland Islands pound - **GEL**: Georgian lari - **GHS**: Ghanaian cedi - **GIP**: Gibraltar pound - **DKK**: Danish krone - **GMD**: Gambian dalasi - **GNF**: Guinean franc - **GTQ**: Guatemalan quetzal - **GYD**: Guyanese dollar - **HKD**: Hong Kong dollar - **HNL**: Honduran lempira - **HRK**: Croatian kuna - **HTG**: Haitian gourde - **HUF**: Hungarian forint - **IDR**: Indonesian rupiah - **INR**: Indian rupee - **IQD**: Iraqi dinar - **IRR**: Iranian rial - **ISK**: Icelandic krona - **GBP**: British pound sterling - **JMD**: Jamaican dollar - **JOD**: Jordanian dinar - **JPY**: Japanese yen - **KES**: Kenyan shilling - **KGS**: Kyrgyzstani som - **KHR**: Cambodian riel - **KMF**: Comoro franc - **KPW**: North Korean won - **KRW**: South Korean won - **KWD**: Kuwaiti dinar - **KYD**: Cayman Islands dollar - **KZT**: Kazakhstani tenge - **LAK**: Lao kip - **LBP**: Lebanese pound - **CHF**: Swiss franc - **LKR**: Sri Lankan rupee - **LRD**: Liberian dollar - **LSL**: Lesotho loti - **LTL**: Lithuanian litas - **LYD**: Libyan dinar - **MAD**: Moroccan dirham - **MDL**: Moldovan leu - **MGA**: Malagasy ariary - **MKD**: Macedonian denar - **MMK**: Myanmar kyat - **MNT**: Mongolian tugrik - **MOP**: Macanese pataca - **MRO**: Mauritanian ouguiya - **XCD**: East Caribbean dollar - **MUR**: Mauritian rupee - **MVR**: Maldivian rufiyaa - **MWK**: Malawian kwacha - **MXN**: Mexican peso - **MYR**: Malaysian ringgit - **MZN**: Mozambican metical - **NAD**: Namibian dollar - **NGN**: Nigerian naira - **NIO**: Nicaraguan cordoba oro - **NPR**: Nepalese rupee - **OMR**: Omani rial - **PAB**: Panamanian balboa - **PEN**: Peruvian sol - **XPF**: CFP franc - **PGK**: Papua New Guinean kina - **PHP**: Philippine peso - **PKR**: Pakistani rupee - **PLN**: Polish zloty - **ILS**: Israeli new shekel - **PYG**: Paraguayan guarani - **QAR**: Qatari riyal - **RON**: Romanian leu - **RSD**: Serbian dinar - **RUB**: Russian ruble - **RWF**: Rwandan franc - **SAR**: Saudi riyal - **SBD**: Solomon Islands dollar - **SCR**: Seychelles rupee - **SDG**: Sudanese pound - **SEK**: Swedish krona - **SGD**: Singapore dollar - **SHP**: Saint Helena pound - **NOK**: Norwegian krone - **SLL**: Sierra Leonean leone - **SOS**: Somali shilling - **SRD**: Surinamese dollar - **STD**: Sao Tome and Principe dobra - **ANG**: Netherlands Antillean guilder - **SYP**: Syrian pound - **SZL**: Swazi lilangeni - **XAF**: CFA franc BEAC - **XOF**: CFA franc BCEAO - **THB**: Thai baht - **TJS**: Tajikistani somoni - **NZD**: New Zealand dollar - **TMT**: Turkmenistani manat - **TND**: Tunisian dinar - **TOP**: Tongan pa'anga - **TRY**: Turkish lira - **TTD**: Trinidad and Tobago dollar - **AUD**: Australian dollar - **TWD**: New Taiwan dollar - **TZS**: Tanzanian shilling - **UAH**: Ukrainian hryvnia - **UGX**: Ugandan shilling - **USD**: United States dollar - **UYU**: Uruguayan peso - **UZS**: Uzbekistani som - **VEF**: Venezuelan bolivar - **VND**: Vietnamese dong - **VUV**: Vanuatu vatu - **WST**: Samoan tala - **YER**: Yemeni rial - **EUR**: European Union euro - **ZAR**: South African rand - **ZMW**: Zambian kwacha - **ZWL**: Zimbabwean dollar
**Type:** object

### DiscountDetail
**Description:** This type shows the amount of the promotional offer.
**Type:** object

**Properties:**
- **amount** (Amount)
  - This container shows the amount of the promotion. The value and currency are always returned. If the buyer is in one country and purchases from an eBay marketplace that uses a different currency, the response also includes the converted-from and converted-to fields, and the exchange rate.
- **offerType** (string)
  - The type of promotional discount applied through the activity's promotional offer **amount**. Examples include offer types such as `ETRS` (eBay Top Rated Seller) and `PROMOTION`.

### EarningsSummary
**Description:** This type defines a summarized view of earnings information derived from one order. It defines fields that provides a summarized view of earnings information derived from one order including aggregated financial values for gross amount, expenses, earnings, and refunds.
**Type:** object

**Properties:**
- **expenses** (Expense)
  - This container provides the total expenses associated with an order, including:  

*   Fees and fee credits (transaction fees, other fees, and ad fees)
*   Shipping labels
*   Donations

It is used by both the **getOrderEarnings** and **getOrderEarningsById** methods.

**Note:** Expenses are always in the seller's payout currency. Conversion-related fields (such as **exchangeRate** or converted from/to fields) in this container do not apply to the **order\_earnings** resource.
- **grossAmount** (Amount)
  - This container shows the gross amount before any eBay deductions. This amount includes the item subtotal, buyer-paid shipping and handling, and seller-collected tax paid by the buyer.  

**Note:** This amount does not include any taxes or fees that eBay collects from the buyer.

**Note:** Gross amount is always in the seller's payout currency. Conversion-related fields (such as **exchangeRate** or converted from/to fields) in this container do not apply to the **order\_earnings** resource.
- **orderEarnings** (Amount)
  - This container shows your earnings after deducting expenses and any refunds from your gross amount.

**Note:** Order earnings are always in the seller's payout currency. Conversion-related fields (such as **exchangeRate** or converted from/to fields) in this container do not apply to the **order\_earnings** resource.
- **refunds** (Amount)
  - This container includes refunds for returns, cases, cancellations, requests, and disputes. It does not include fee credits.  

**Note:** Refunds are always in the seller's payout currency. Conversion-related fields (such as **exchangeRate** or converted from/to fields) in this container do not apply to the **order\_earnings** resource.

### Expense
**Description:** This type defines provides the total expenses associated with an order. Expenses represent cost components that reduce the seller's gross earnings and may include deductions such as marketplace fees, eBay shipping labels, and donations, applied during order processing.
**Type:** object

**Properties:**
- **currency** (CurrencyCodeEnum)
  - This field shows the three-letter currency code that represents the currency used for all of the order expenses
- **donations** (array)
  - This array shows the amount(s) of one or more donations that are submitted to eBay charity organizations for one or more orders.  

**Note:** Donations are always tied to specific items. When an item is listed with a charity contribution (for example, 10%), the donation is calculated per item at the time of sale. Order earnings factor in only the items within the order that are eligible for donation.
- **marketplaceFees** (array)
  - This array shows the type and amount(s) of marketplace fees that were charged against one or more orders.
- **shippingLabels** (Amount)
  - This container shows the total amount paid by the seller for eBay shipping labels for one or more orders.  

**Note:** Charges and credits for shipping labels purchased with non-eBay payment methods (for example, PayPal) are excluded from the order earnings calculation.
- **value** (string)
  - This field shows the total expenses including charges and credits associated for one or more orders based on the order creation time period chosen.

### Fee
**Description:** This type is used for provide information about a fee that is charged against an order.
**Type:** object

**Properties:**
- **amount** (Amount)
  - The monetary amount charged for the fee.
- **feeJurisdiction** (FeeJurisdiction)
  - This type defines the jurisdiction associated with a fee. It identifies the geographic or regulatory context under which a specific fee is applied to an order.
- **feeMemo** (string)
  - A descriptive message that provides additional context about the fee applied to the order.
- **feeType** (FeeTypeEnum)
  - The enumeration value returned here indicates the type of fee that was deducted from the seller payout.

### FeeJurisdiction
**Description:** This type defines the jurisdiction information associated with a fee, identifying the geographic or regulatory region under which the fee is applied.
**Type:** object

**Properties:**
- **regionName** (string)
  - The name of the region to which the fee applies.  
  
The set of valid **regionName** values returned is determined by the corresponding **regionType** value.  
  
**Note:** Currently supported **regionName** values are standard two-character country or state codes.  
  
Typical examples include:

*   **MX** (Mexico)
*   **IN** (India)
*   **US** (United States)
*   **CA** (California)
*   **VT** (Vermont)
*   **ME** (Maine)
- **regionType** (RegionTypeEnum)
  - This enumeration value indicates the type of region that the fee jurisdiction represents, such as a country or a state.

### FeeTypeEnum
**Description:** This enumerated type shows the fees that are automatically deducted from seller payouts. | - **BELOW_STANDARD_FEE**: This fee is charged to Below Standard sellers in addition to the `FINAL_VALUE_FEE`, and is based on a percentage of the order line item cost. - **BELOW_STANDARD_SHIPPING_FEE**: This fee is charged to Below Standard sellers in addition to the `FINAL_VALUE_FEE`, and is based on a percentage of the shipping cost for an order line item.  
  
**Note**: This fee is bundled with the `BELOW_STANDARD_FEE` and not returned separately. - **FINAL_VALUE_FEE_FIXED_PER_ORDER**: This fee is a fixed-cost fee charged by eBay for every order (regardless of how many line items are in the order). This fee can vary by country. - **FINAL_VALUE_FEE**: This final value fee is charged to Above Standard and Top-rated sellers, and is based on a percentage of the order line item cost. The percentage varies by eBay category. - **INTERNATIONAL_FEE**: This fee is an international fee associated with an order line item if the seller's eBay registered address country is different than the buyer's registered address or delivery address. This fee is calculated as a percentage of the total amount of the order line item. - **HIGH_ITEM_NOT_AS_DESCRIBED_FEE**: This fee may apply if a seller has a high number of 'not as described' claims, and is based on a percentage of the order line item cost. - **HIGH_ITEM_NOT_AS_DESCRIBED_SHIPPING_FEE**: This fee may apply if a seller has a high number of 'not as described' claims, and is based on a percentage of the shipping cost for the order line item.  
  
**Note**: This fee is bundled with the `HIGH_ITEM_NOT_AS_DESCRIBED_FEE` and not returned separately. - **PAYMENT_PROCESSING_FEE**: This is a payment processing fee charged for each order.  
  
**Note**: This fee is bundled with the `FINAL_VALUE_FEE_FIXED_PER_ORDER` and not returned separately. - **FINAL_VALUE_SHIPPING_FEE**: This final value fee is charged to Above Standard and Top-rated sellers, and is based on a percentage of the shipping cost for the order line item. The percentage varies by eBay category.  
  
**Note**: This fee is bundled with the `FINAL_VALUE_FEE` and not returned separately. - **INSERTION_FEE**: This enumeration value indicates that the account entry is an insertion fee for a listing. - **BOLD_FEE**: This enumeration value indicates that the account entry is a listing upgrade fee or credit for a listing title in boldface font. - **FINANCE_FEE**: This enumeration value indicates that the account entry is a finance charge to the user's account. A finance charge may be applicable if the user's monthly invoice balance is not paid in full by the due date. - **CATEGORY_FEATURED_FEE**: This enumeration value indicates that the account entry is a credit for a listing upgrade fee for featuring the listing on an eBay category page relevant to the item.  
  
**Note**: This feature is no longer available to most marketplaces and sellers. - **NSFCHECK_FEE**: This enumeration value indicates that the account entry is a fee charged by eBay when the seller's check does not clear due to insufficient funds. - **PROMOTIONAL_CREDIT**: This enumeration value indicates that the account entry is a promotional credit issued by eBay. - **GALLERY_FEE**: This enumeration value indicates that the account entry is a fee charged or credit issued by eBay for listing an item in the Picture Gallery. A buyer sees a picture of the item when browsing a category, before moving to the item's listing page. - **FEATURED_GALLERY_FEE**: This enumeration value indicates that the account entry is a fee charged or credit issued by eBay for listing an item in the Featured section at the top of the Picture Gallery page. - **RESERVE_PRICE_FEE**: This enumeration value indicates that the account entry is a fee charged or a credit refunded to the seller for a reserve price that was set for an auction listing. - **IPIXPHOTO_FEE**: This enumeration value is no longer applicable as the iPix photo feature is no longer available on any eBay marketplace. - **LARGE_PICTURE_FEE**: This enumeration value indicates that the account entry is a fee charged by eBay for a super-sized picture in a listing. - **EBAY_STORE_SUBSCRIPTION_FEE**: This enumeration value indicates that the account entry is a monthly subscription fee charged or a credit issued toward the user's eBay Store. - **BUY_IT_NOW_FEE**: This enumeration value indicates that the account entry is a fee charged or a credit issued by eBay if the seller uses the 'Buy It Now' feature on an auction listing. - **SUBTITLE_FEE**: This enumeration value indicates the account entry is a fee charged to the seller for adding a subtitle to a listing or a credit issued from eBay to compensate the seller for a subtitle fee. Subtitles allow sellers to provide more keywords and/or descriptive information, and may increase buyers' interest. - **INTERNATIONAL_LISTING_FEE**: This enumeration value indicates that the account entry is a 'cross-border trade' fee or credit, where the seller pays an additional listing fee to have his/her listing surface in the search on another eBay marketplace. - **PRO_PACK_BUNDLE_FEE**: This enumeration value indicates the account entry is a credit towards the fee charged to the seller for using the Pro Pack Bundle feature pack (currently available to US and Canada eBay motor vehicle sellers). - **MARKETPLACE_RESEARCH_PRO_SUBSCRIPTION_FEE**: This enumeration value indicates that the account entry is a fee or a credit toward a fee for a Terapeak Research pro subscription. - **VEHICLE_LOCAL_SUBSCRIPTION_FEE**: This enumeration value indicates that the account entry is a monthly subscription fee or a credit toward a monthly subscription fee charged for a National Vehicle subscription. - **VEHICLE_LOCAL_INSERTION_FEE**: This enumeration value indicates that the account entry is an insertion fee or a credit for a Motors local listing. - **VALUE_PACK_BUNDLE_FEE**: This enumeration value indicates the account entry is a fee charged or a credit towards the fee charged by eBay to the seller for using the Value Pack Bundle feature pack. - **PRO_PACK_PLUS_BUNDLE_FEE**: This enumeration value indicates the account entry is a fee charged by eBay to the seller for using the Pro Pack Plus Bundle feature pack. - **GALLERY_PLUS_FEE**: This enumeration value indicates that the account entry is a fee charged or a credit towards a fee charged by eBay for listing an item with the Gallery Plus feature. - **EBAY_MOTORS_PRO_FEE**: This enumeration value indicates that the account entry is an eBay Motors Pro fee or a credit towards an eBay Motors Pro fee. Applies to eBay Motors Pro registered dealers only. - **PRIVATE_LISTING_FEE**: This enumeration value indicates that the account entry is a fee for a private listing or a credit towards a fee charged. With a private listing, bidders/buyers remain anonymous to other eBay users (besides the seller). - **AUCTION_END_EARLY_FEE**: This enumeration value indicates that the account entry is a fee charged to the seller's account if the seller ends an auction (with bids) early or a credit issued by eBay to the seller's account if a duplicate auction listing is ended administratively by eBay. A seller is only eligible for this credit if the auction listing had zero bids and was never surfaced in Search. - **STORE_SUBSCRIPTION_EARLY_TERMINATION_FEE**: This enumeration value indicates that the account entry is a fee charged or a credit toward a fee charged for early termination of an eBay Stores subscription. - **AD_FEE**: This enumeration value indicates that the account entry is a fee charged or a credit issued for an Ad on eBay. This Ad fee is charged only for sellers who sign up to create Promoted Listings campaigns. When sellers advertise their listings, the listings are displayed on the search results pages based on buyer search query. When a buyer clicks on an ad and then goes on to purchase that same item within 30 days of click, the seller is charged an Ad fee. The Ad fee that is charged is at the rate set by seller themselves. They choose the bid percentage for each item listing. - **EBAY_PLUS_SUBSCRIPTION_FEE**: This enumeration value indicates that the account entry is an annual subscription fee charged a credit toward an annual subscription fee for an eBay Plus subscription. - **VEHICLE_SUBSCRIPTION_FEE**: This enumeration value indicates that the account entry is a monthly subscription fee charged a credit toward a monthly subscription fee for a National Vehicle subscription. - **CO_FUNDING_COUPON_FEE**: This enumeration value indicates that eBay is billing the seller or giving credit to the seller for a co-funding charge. - **PAYMENT_DISPUTE_FEE**: This enumeration value indicates the credit is a charge or a seller reimbursement for an eBay payment dispute fee. - **PREMIUM_AD_FEES**: This enumeration value indicates the invoice charged or the credit issued was for a Premium Ad Fee. - **VEHICLES_BASIC_PACKAGE_FEE**: This enumeration value indicates the invoice charged or the credit issued was for a Vehicles Listing Basic Package fee. - **VEHICLES_PLUS_PACKAGE_FEE**: This enumeration value indicates the invoice charged or the credit issued was for a Vehicles Listing Plus Package fee. - **VEHICLES_PREMIUM_PACKAGE_FEE**: This enumeration value indicates the invoice charged or the credit issued was for a Vehicles Listing Premium Package fee. - **DEPOSIT_PROCESSING_FEE**: This fee is charged to a seller when they sell a motor vehicle and require a deposit from the buyer. This fee is based on a percentage of the deposit paid and is automatically deducted from the seller's payout. - **EXPRESS_PAYOUT_FEE**: This is the fee charged by eBay when a seller requests a payout through a debit card.  
  
**Note**: If the requested payout to a debit card fails, the `EXPRESS_PAYOUT_FEE` will be credited back to the seller's account and a separate `NON_SALE_CHARGE` transaction is created. - **TAX_DEDUCTION_AT_SOURCE**: This enumeration value indicates the account entry is the tax amount automatically deducted from a seller's payout.  
  
For example, sellers in India are charged `TAX_DEDUCTION_AT_SOURCE` which is automatically deducted. - **INCOME_TAX_WITHHOLDING**: This enumeration value indicates the account entry is the required income tax amount deducted from a seller's payout.  
  
For example, sellers in Mexico are charged `INCOME_TAX_WITHHOLDING` which is automatically deducted. - **VAT_WITHHOLDING**: This enumeration value indicates that the account entry is the required VAT amount deducted from the seller's payout.  
  
For example, sellers in Mexico are charged `VAT_WITHHOLDING` which is automatically deducted. - **BANK_PAYOUT_FEE**: This enumeration value indicates that a fee is charged by eBay when a seller requests a payout through a bank account.  
  
**Note**: `BANK_PAYOUT_FEE` is only applicable for CNY sellers and when the **payoutInstrumentType** is `BANK`. - **CHARITY_DONATION**: This enumeration value indicates the charitable donations against a sale. - **REGULATORY_OPERATING_FEE**: This enumeration value indicates that a fee is charged by eBay to cover the costs associated with complying with regulatory requirements in specific marketplaces.  
  
**Note**: Currently, this fee is only applicable in the following marketplaces: United Kingdom, Italy, France, Spain, Austria, Belgium (Dutch), Poland, Ireland, and Switzerland. - **OTHER_FEES**: This enumeration value may be returned if the fee type cannot be determined, or has not been classified.
**Type:** object

### FundingSource
**Description:** This type defines the source of funds used to finance a transfer, such as available seller funds, a credit card, or a bank account.
**Type:** object

**Properties:**
- **brand** (string)
  - The brand name of the credit card or the name of the financial institution that is the source of payment. This field may not be populated for other funding sources.
- **memo** (string)
  - This field provides a note about the funding source. If the seller's credit card or bank account is the funding source, this field might contain the last four digits of the credit card or bank account. This field may also be returned as null.
- **type** (string)
  - The string value returned here indicates the funding source. Possible values include the following:

*   `AVAILABLE_FUNDS`: transfer is funded with seller payout funds
*   `CREDIT_CARD`: transfer is funded with seller's credit card
*   `BANK`: transfer is funded with a direct debit to seller's bank account on file with eBay
*   `PAY_UPON_INVOICE`: eBay will bill the seller for the transfer on the monthly invoice

### OrderEarning
**Description:** This type defines the earnings details for a single order. It includes information associated with the order, such as an informatiuon about the buyer, an order summary, and an order earnings summary.
**Type:** object

**Properties:**
- **buyer** (BuyerWithId)
  - Information about the buyer associated with the order. Includes buyer name and public user id.
- **orderCreationDate** (string)
  - The date the order was created and payment was successful.
- **orderEarningsSummary** (EarningsSummary)
  - This container defines a summarized view of earnings information derived from one order. It provides aggregated financial values for order earnings, gross amount, expenses, and refunds. Order earnings includes earnings after deducting expenses and refunds from the gross amount.
- **orderId** (string)
  - The unique identifier of the order.
- **orderLastModifiedDate** (string)
  - The date when the order was last modified.
- **orderSummary** (OrderSummary)
  - The container for order cost details, including line item subtotal, shipping and handling, seller-collected taxes, and any seller applied discounts. Always provided in the listing currency.

### OrderEarningFee
**Description:** This type is used to show the fee type and amount of the marketplace fee or donation.
**Type:** object

**Properties:**
- **amount** (Amount)
  - The monetary amount of the expense.
- **feeType** (FeeTypeEnum)
  - The classification of the fee applied to the order.

### OrderEarnings
**Description:** The base response type of the **getOrderEarnings** method, which includes pagination output fields and a collection of orders that match the request criteria.
**Type:** object

**Properties:**
- **href** (string)
  - The URI for the current page of results.
- **limit** (integer)
  - The maximum number of order earnings records returned in a single page of results.
- **next** (string)
  - The URI for the next page of results. This field is only returned if there is a next page of results to retrieve.
- **offset** (integer)
  - The number of order earnings records skipped before returning the current page of results.
- **orders** (array)
  - The list of order earnings records returned in the current page of results. This array will be returned as empty if no orders match the request criteria.
- **prev** (string)
  - The URI for the previous page of results. This field is only returned if there is a previous page of results to retrieve.
- **total** (integer)
  - The total number of order earnings records that match the request criteria.

### OrderEarningsSummary
**Description:** The base response type for the **getOrderEarningsSummary** method, which includes aggregate order earnings, expenses, gross amount, and order count for orders created within the date range and included in the summary.
**Type:** object

**Properties:**
- **expenses** (Amount)
  - The aggregate amount of expenses for all orders included in the summary.  

**Note:** Expenses are always in the seller's payout currency. Conversion-related fields (such as **exchangeRate**) in this container do not apply to the **order\_earnings** resource.
- **grossAmount** (Amount)
  - The aggregate gross amount for all orders included in the order earnings summary. This amount equals the item subtotal plus shipping and handling, and any seller-collected taxes paid by the buyer, minus any seller-offered discount.  

**Note:** Gross amount is always in the seller's payout currency. Conversion-related fields (such as **exchangeRate**) in this container do not apply to the **order\_earnings** resource.
- **orderCount** (integer)
  - The total number of orders included in the summary.
- **orderEarnings** (Amount)
  - The aggregate earnings amount for all orders included in the summary, which includes the amount of order earnings after deducting expenses and any refunds from the gross amount.

**Note:** Order earnings are always in the seller's payout currency. Conversion-related fields (such as **exchangeRate**) in this container do not apply to the **order\_earnings** resource.
- **refunds** (Amount)
  - The aggregate amount of all refunds issued for the orders included in the summary.  

**Note:** Refunds include gross refunds, gross claims, and gross payment disputes.

**Note:** Refunds are always in the seller's payout currency. Conversion-related fields (such as **exchangeRate**) in this container do not apply to the **order\_earnings** resource.

### OrderLineItem
**Description:** This type is used to show the fees and donations that are deducted from a seller payout for each line item in an order.
**Type:** object

**Properties:**
- **donations** (array)
  - The list of donations applied to the line item.  
  
**Note:** Currently, this array is only returned if the seller chooses to donate a percentage of the sales proceeds to a charitable organization registered with the eBay for Charity program.
- **feeBasisAmount** (Amount)
  - This amount is the order's total amount and equals what the buyer has paid. This value includes **transactions.amount**, **totalFeeAmount**, **eBayCollectedTaxAmount**, and shipping charges (if any).
- **lineItemId** (string)
  - The unique identifier of an order line item.
- **marketplaceFees** (array)
  - An array of all fees accrued for the order line item and deducted from a seller payout.

### OrderSummary
**Description:** This type provides order cost details, including line item subtotal, shipping and handling, seller-collected taxes, and any seller applied discounts. Always provided in the listing currency.
**Type:** object

**Properties:**
- **discounts** (Amount)
  - The total amount of item-level promotions or discounts offered by the seller for a sale (order).
- **itemSubtotal** (Amount)
  - The sum of the listing price(s) for all items in the order, before applying any seller discounts.
- **sellerCollectedTaxes** (Amount)
  - The total amount of [tax collected by the seller](https://www.ebay.com/help/selling/fees-credits-invoices/taxes-import-charges?id=4121) on all sold items for the order.
- **shippingAndHandlingCosts** (Amount)
  - The total amount collected from the buyer to cover shipping and handling for all items in the order.

### Payout
**Description:** This type is used to express the details of one seller payout that is returned with the **getPayout** or **getPayouts** methods.
**Type:** object

**Properties:**
- **amount** (Amount)
  - This is the total amount of the seller payout. The container shows the dollar amount of the payout and the currency used. The value of the payout is always shown, even if the payout has failed.
- **bankReference** (string)
  - This field contains additional information provided by the bank and passed on by the payment processor; e.g., the manner in which the transaction will appear on the seller's bank statement. The field is returned only when provided by the bank and processor.
- **lastAttemptedPayoutDate** (string)
  - This timestamp indicates the date/time when eBay last attempted to process a seller payout but it failed. This field is only returned if a seller payout fails, and the **payoutStatus** value shows `RETRYABLE_FAILED` or `TERMINAL_FAILED`. A seller can filter on the **lastAttemptedPayoutDate** in a **getPayouts** request.
- **payoutDate** (string)
  - This timestamp indicates when the seller payout began processing. The following format is used: `YYYY-MM-DDTHH:MM:SS.SSSZ`. For example, `2015-08-04T19:09:02.768Z`. This field is still returned even if the payout was pending but failed (**payoutStatus** value shows `RETRYABLE_FAILED` or `TERMINAL_FAILED`).
- **payoutId** (string)
  - The unique identifier of the seller payout. This identifier is generated once eBay begins processing the payout to the seller's bank account.
- **payoutInstrument** (PayoutInstrument)
  - This container provides details about the seller's account that received (or is scheduled to receive) the payout. This container is still returned even if the payout failed.
- **payoutMemo** (string)
  - This field contains information provided by upstream components, based on internal and external commitments. A typical message would contain the expected arrival time of the payout.
- **payoutReference** (string)
  - This field contains the unique identifier for the Payout Reference. In split-payout cases, this is the unique identifier reference (not true payout). This field is only returned and will show the associated true(actual) payout id(s) when sellers in Mainland China enable split payouts between a Payoneer account and/or a bank account.  
  
**Note:** Split-payout functionality will **only** be available to mainland China sellers.
- **payoutStatus** (PayoutStatusEnum)
  - This enumeration value indicates the current status of the seller payout. For a successful payout, the value returned will be `SUCCEEDED`. See the **PayoutStatusEnum** type for more details on each payout status value.
- **payoutStatusDescription** (string)
  - This field provides more details about the current status of payout. The description returned here will correspond with enumeration value returned in the **payoutStatus** field. The following shows what description text might appear based on the different **payoutStatus** values:

*   `INITIATED`: _Preparing to send_
*   `SUCCEEDED`: _Funds sent_
*   `REVERSED`: _Waiting to retry : Money rejected by seller's bank_
*   `RETRYABLE_FAILED`: _Waiting to retry_
*   `TERMINAL_FAILED`: _Payout failed_
- **totalAmount** (Amount)
  - This container indicates the sum of a seller's net payout amount plus the `EXPRESS_PAYOUT_FEE` charged by eBay. The is expressed as a numeric value and the currency used.
- **totalFee** (Amount)
  - This container indicates the amount of the `EXPRESS_PAYOUT_FEE` charged by eBay when a seller requests payout to a debit card. The fee is expressed as a numeric value and the currency used.
- **totalFeeDetails** (array)
  - This array indicates all payout fees associated with a payout, including the fee type, amount, value, and currency.
- **transactionCount** (integer)
  - This integer value indicates the number of monetary transactions (all orders, refunds, and credits, etc.) that have occurred with the corresponding payout. Its value should always be at least `1`, since there is at least one order per seller payout.  
  
For split payouts, each of the two sibling payouts would be considered its own transaction. Because of this, if a seller had a payout for one order, but split the order between two accounts, the value would be `2` instead of `1`.  
  
**Note:** Split-payout functionality is **only** applicable to mainland China sellers.

### PayoutDetails
**Description:** This type provide payout details for a split-payout case. This type is only applicable for split payouts.
**Type:** object

**Properties:**
- **payoutIds** (array)
  - This array indicates the list of true(actual) payout ids associated with a split payout. These values can be used as a path parameter for the **getPayout** method to retrieve details on the associated payouts.
- **payoutReference** (string)
  - This field contains the unique identifier for the Payout Reference. In split-payout cases, this is the unique identifier reference (not true payout). This field is only returned and will show the associated true(actual) payout id(s) when sellers in Mainland China enable split payouts between a Payoneer account and/or a bank account. This value can be used by the **filter** query parameter of the **getPayouts** method to get the monetary details of each true(actual) payout associated with the payoutReference.  
  
**Note:**Split-payout functionality will **only** be available to mainland China sellers.

### PayoutInstrument
**Description:** This type is used to provide details about one or two of the seller's accounts that are enabled to receive payouts.
**Type:** object

**Properties:**
- **accountLastFourDigits** (string)
  - This value is the last four digits of the account that the seller uses to receive the payout. This may be the last four digits of a bank account, a debit card, or a payment processor account such as Payoneer.
- **instrumentType** (string)
  - This value indicates the type of account that received the payout. The value returned in this field may be:  

*   `BANK`: indicates that the payout was made to a seller's bank account.
*   `CARD`: indicates that the payout went to a seller's debit card
*   The name of a digital wallet provider or payment processor (e.g., `PAYONEER`)

**Note:** Only Payoneer is currently supported for sellers in mainland China. Card payouts are not currently available for sellers in mainland China.
- **nickname** (string)
  - When **instrumentType** returns `BANK`, this value is the seller-provided nickname that the seller uses to represent the bank account that receives the payout.  
  
When **instrumentType** returns `CARD`, this value is the debit card network for the debit card that receives the payout.  
  
When **instrumentType** returns a provider of digital wallet or payment processing services, the value returned is the name of the service provider (e.g., `PAYONEER`).  
  
**Note:** Card payouts are not currently available for sellers in mainland China.
- **payoutPercentage** (string)
  - This value indicates the current payout percentage allocated to a payout instrument. For example, `50` indicates that 50% of the payout goes to the instrument.  
  
This field will be returned even when 100% of the payout funds are going to one payout instrument.  
  
This field is only returned to sellers in mainland China.

### PayoutStatusEnum
**Description:** This enumeration type lists the different possible states of an eBay payout to a seller's account. | - **INITIATED**: This enumeration value indicates that a payout was initiated. - **SUCCEEDED**: This enumeration value indicates a successful payout. - **REVERSED**: This enumeration value indicates that the payout was reversed. - **RETRYABLE_FAILED**: This enumeration value indicates that a payout failed, but eBay will try to process it again. - **TERMINAL_FAILED**: This enumeration value indicates that a payout failed, and it will not be tried again.
**Type:** object

### PayoutSummaryResponse
**Description:** This type is the base response type of the **getPayoutSummary** method, and contains the total count of seller payouts (that match the input criteria), the total count of monetary transactions (order payment, buyer refunds, or seller credits) associated with those payouts, and the total value of those seller payouts.
**Type:** object

**Properties:**
- **amount** (Amount)
  - This container shows the total value (and currency type used) of the seller payouts that match the input criteria. This field is not returned if there are no payouts that match the input criteria.
- **payoutCount** (integer)
  - This integer value indicates the total count of payouts to the seller that match the input criteria. This field is always returned, even if there are no payouts that match the input criteria (its value will show `0`).
- **transactionCount** (integer)
  - This integer value indicates the total count of monetary transactions (order payments, buyer refunds, and seller credits) associated with the payouts that match the input criteria. This field is always returned, even if there are no payouts that match the input criteria (its value will show `0`). If there is at least one payout that matches the input criteria, the value in this field will be at least `1`.

### Payouts
**Description:** This type is the base response type of the **getPayouts** method, and contains an array of one or more payouts (that match the input criteria), the total count of payouts in the response, and various pagination data for the results set.
**Type:** object

**Properties:**
- **href** (string)
  - The URI of the **getPayouts** call request that produced the current page of the result set.
- **limit** (integer)
  - The maximum number of payouts that may be returned per page of the result set. The **limit** value can be passed in as a query parameter, or if omitted, its value defaults to `20`.  
  
**Note:** If this is the last or only page of the result set, the page may contain fewer payouts than the **limit** value. To determine the number of pages in a result set, divide the **total** value (total number of payouts matching input criteria) by this **limit** value, and then round up to the next integer. For example, if the **total** value was `120` (120 total payouts) and the **limit** value was `50` (show 50 payouts per page), the total number of pages in the result set is three, so the seller would have to make three separate **getPayouts** calls to view all payouts matching the input criteria.  
  
**Maximum:** `200`  
**Default:** `20`
- **next** (string)
  - The **getPayouts** call URI to use if you wish to view the next page of the result set.  
  
This field is only returned if there is a next page of results to view based on the current input criteria.
- **offset** (integer)
  - This integer value indicates the actual position that the first payout returned on the current page has in the results set. So, if you wanted to view the 11th payout of the result set, you would set the **offset** value in the request to `10`.  
  
In the request, you can use the **offset** parameter in conjunction with the **limit** parameter to control the pagination of the output. For example, if **offset** is set to `30` and **limit** is set to `10`, the call retrieves payouts 31 thru 40 from the resulting collection of payouts.  
  
**Note:** This feature employs a zero-based list, where the first item in the list has an offset of `0`.  
  
**Default:** `0` (zero)
- **payouts** (array)
  - An array of one or more payouts that match the input criteria. Details for each payout include the unique identifier of the payout, the status of the payout, the amount of the payout, and the number of monetary transactions associated with the payout.
- **prev** (string)
  - The **getPayouts** call URI to use if you wish to view the previous page of the result set.  
  
This field is only returned if there is a previous page of results to view based on the current input criteria.
- **total** (integer)
  - This integer value is the total number of payouts in the results set based on the current input criteria. Based on the total number of payouts that match the criteria, and on the **limit** and **offset** values, there may be additional pages in the results set.

### Reference
**Description:** This field is returned for NON\_SALE\_CHARGE transactions that contain non-transactional seller fees.
**Type:** object

**Properties:**
- **referenceId** (string)
  - The identifier of the transaction as specified by the **referenceType**. For example, with a **referenceType** of **item\_id**, the **referenceId** refers to a unique item. This item may have several `NON_SALE_CHARGE` transactions.
- **referenceType** (ReferenceTypeEnum)
  - An enumeration value that identifies the reference type associated with the **referenceId**.

### ReferenceTypeEnum
**Description:** An enumerated type that identifies the type of reference ID provided. | - **CANCELLATION_ID**: This enumeration value indicates that the ID provided refers to the unique identifier of a cancellation. - **CASE_ID**: This enumeration value indicates that the ID provided refers to the unique identifier of a case. - **INVOICE**: This enumeration value indicates that the ID provided refers to the unique identifier of an invoice. It indicates that the seller will be billed by invoice, and fees will not be deducted from the payout.  
  
**Note**: This enumeration value applies only to `NON_SALE_CHARGE transactions`. - **ITEM_ID**: This enumeration value indicates that the ID provided refers to the unique identifier of an item. It is used to identify listing-related fees.  
  
**Note**: This enumeration value applies only to NON\_SALE\_CHARGE transactions. - **ORDER_ID**: This enumeration value indicates that the ID provided refers to the unique identifier of an order.  
  
**Note**: This enumeration value applies only to sales/transactions-related fees. - **PAYMENTS_DISPUTE_ID**: This enumeration value indicates that the ID provided refers to the unique identifier of a payment dispute. - **REFUND_ID**: This enumeration value indicates that the ID provided refers to the unique identifier of a refund. - **LOAN_REPAYMENT_ID**: This enumeration value indicates that the ID provided refers to the unique identifier of a repayment transaction.  
  
**Note**: This is an externally assigned reference ID. It cannot be used to filter transactions. - **RETURN_ID**: This enumeration value indicates that the ID provided refers to the unique identifier of a return. - **PAYOUT_ID**: This enumeration value indicates that the ID provided refers to the unique identifier of a payout.
**Type:** object

### RegionTypeEnum
**Description:** An enumerated value indicating the type of governing jurisdiction requiring the fee to be deducted from a seller's payout. | - **COUNTRY**: Indicates the governing jurisdiction is a country. - **STATE_OR_PROVINCE**: Indicates the governing jurisdiction is a state or province.
**Type:** object

### SellerFundsSummaryResponse
**Description:** This type is used by the response payload of the **getSellerFundsSummary** method. All of the funds returned in **getSellerFundsSummary** are funds that have not yet been paid to the seller through a seller payout. If there are no funds that are pending, on hold, or being processed for the seller's account, no response payload is returned, and an http status code of `204 - No Content` is returned instead.
**Type:** object

**Properties:**
- **availableFunds** (Amount)
  - This field represents the total amount of order funds that are available for a payout, but processing for a seller payout has not yet begun. If a seller wants to get more details on sales transactions that have yet to be processed, the seller can use the **getTransactions** method, and use the **transactionStatus** filter with its value set to `FUNDS_AVAILABLE_FOR_PAYOUT`.  
  
This container will return 0.0 with the appropriate payout currency if there are no funds available to be processed for a payout.
- **fundsOnHold** (Amount)
  - This field represents the total amount of order funds on hold. Seller payment holds can occur for different reasons. If a seller wants to get more details on sales transactions where funds are currently on hold, the seller can use the **getTransactions** method, and use the **transactionStatus** filter with its value set to `FUNDS_ON_HOLD`.  
  
This container will return 0.0 with the appropriate payout currency if there are no seller payment holds that will eventually be processed for a payout.
- **processingFunds** (Amount)
  - This field represents the total amount of order funds being prepared and processed for a seller payout. If a seller wants to get more details on sales transactions that are being processed, the seller can use the **getTransactions** method, and use the **transactionStatus** filter with its value set to `FUNDS_PROCESSING`.  
  
This container will return 0.0 with the appropriate payout currency if there are no funds available to be processed for a payout.
- **totalFunds** (Amount)
  - This field represents the total amount of order funds still due to be distributed to the seller through a seller payout. This field should equal the sum of the amounts returned in the following fields:  

*   **processingFunds**
*   **availableFunds**
*   **fundsOnHold**

  
If no payout funds are due to the seller, a `204 - No Content` status code will be returned along with an empty payload.

### Tax
**Description:** This type defines tax information associated with a transaction.
**Type:** object

**Properties:**
- **taxType** (TaxTypeEnum)
  - The type of tax applied to the transaction.
- **amount** (Amount)
  - The monetary amount of the tax applied.

### TaxTypeEnum
**Description:** This enumerated type lists the type of taxes that can be charged against monetary transactions. | - **VAT**: VAT is Value-Added Tax.
**Type:** object

### Transaction
**Description:** This type is used to express the details of one of the following monetary transactions: a buyer's payment for an order, a refund to the buyer for a returned item or cancelled order, or a credit issued by eBay to the seller's account.
**Type:** object

**Properties:**
- **amount** (Amount)
  - This container shows the dollar value and currency type of the monetary transaction. This field is always returned even when eBay has yet to initiate a payout for the order.
- **bookingEntry** (BookingEntryEnum)
  - The enumeration value returned in this field indicates if the monetary transaction amount is a (`CREDIT`) or a (`DEBIT`) to the seller's account. Typically, the `SALE` and `CREDIT` transaction types are credits to the seller's account, and the `REFUND`, `DISPUTE`, `SHIPPING_LABEL`, and `TRANSFER` transaction types are debits to the seller's account.
- **buyer** (Buyer)
  - This is the unique eBay user ID for the buyer who purchased the order. This field is not returned for `TRANSFER` monetary transaction types.
- **eBayCollectedTaxAmount** (Amount)
  - This is the amount of sales tax that has been collected by eBay for an order.  
  
**Note:** Sales tax applies only to `SALE` and `REFUND` transactions (**transactionType**).
- **feeJurisdiction** (FeeJurisdiction)
  - This container stores information about region-specific fees that are charged to sellers.  
  
This is returned for fees (i.e., **FeeTypeEnum** values,) that are mandated by a seller's governing jurisdiction.  
  
For example:

*   `INCOME_TAX_WITHHOLDING`
*   `TAX_DEDUCTION_AT_SOURCE`
*   `VAT_WITHHOLDING`
- **feeType** (FeeTypeEnum)
  - The enumeration value returned in this field indicates the type of fee that was deducted from the seller payout.
- **orderId** (string)
  - The unique identifier of the eBay order associated with the monetary transaction.
- **orderLineItems** (array)
  - This array either shows the order line item transactional fees related to a `SALE` transaction and deducted from the payout associated with that order, or it shows the transactional fee credits going back to the seller in the case of a `REFUND` transaction.  
  
**Note:** In certain circumstances, transactional fees like `FINAL_VALUE_FEE` and `FINAL_VALUE_FEE_FIXED_PER_ORDER` are not deducted from a seller payout, but instead they are billed to the seller's account as "non-sale charges". When this happens, the `SALE` transaction entity will not have these fees under the **orderLineItems** array, but they will appear as separate `NON_SALE_CHARGE` transactions. When this happens, and you want to see those transactional fees for the order, one thing you can do is make another call to **getTransactions** and filter against the **orderId**. In the response, you will see the `SALE` transaction and the `NON_SALE_CHARGE` transactions applied against the order. See [Sample 6: Get transactional fees for an order](/api-docs/sell/finances/resources/transaction/methods/getTransactions#s0-1-28-4-7-5-6-Gettransactionalfeesforanorder-5) and [Sample 10: Get non-sale charges for an order](/api-docs/sell/finances/resources/transaction/methods/getTransactions#s0-1-28-4-7-5-6-Getnon-salechargesforanorder-9) for examples.
- **paymentsEntity** (string)
  - This string value indicates the entity that is processing the payment.
- **payoutDetails** (PayoutDetails)
  - This container provides the payout details for a split-payout case. This container is only returned for split-payout use cases.
- **payoutId** (string)
  - The unique identifier of the seller payout associated with the monetary transaction. This identifier is generated once eBay begins processing the payout for the corresponding order. This field will not be returned if eBay has not yet begun processing the payout for an order.  
  
This value can be used by the **filter** query parameter to get monetary transactions associated with the true(actual) payout associated with the **PayoutId**.  
  
**Note:** In case of a split payout, always pick the first true(actual) payout id.
- **references** (array)
  - This field contains reference information for the transaction fee. This includes an ID and the type of ID provided (such as item ID).
- **salesRecordReference** (string)
  - The Sales Record Number associated with a sales order. Sales Record Numbers are Selling Manager/Selling Manager Pro identifiers that are created at order checkout.  
  
**Note:** For all orders originating after February 1, 2020, a value of `0` will be returned in this field. The Sales Record Number field has also been removed from Seller Hub. Instead of **salesRecordReference**, depend on **orderId** instead as the identifier of the order. The **salesRecordReference** field has been scheduled for deprecation, and a date for when this field will no longer be returned at all will be announced soon.
- **taxes** (array)
  - This array shows the tax type and amount applicable to the transaction.  
  
**Note:** Currently, this array is only returned for tax charged against a purchased eBay shipping label.
- **totalFeeAmount** (Amount)
  - This amount is the total amount of selling fees paid for order. A breakdown of fees for each order line item can be found in the **orderLineItems** array.  
  
This field is even returned if it is `0.0` (no fees deducted from seller payout).
- **totalFeeBasisAmount** (Amount)
  - This amount is the total amount for the order before selling fees are deducted from the seller payout associated with the order.
- **transactionDate** (string)
  - This timestamp indicates when the monetary transaction (order purchase, buyer refund, seller credit) occurred. The following (UTC) format is used: `YYYY-MM-DDTHH:MM:SS.SSSZ`. For example, `2015-08-04T19:09:02.768Z`.
- **transactionId** (string)
  - This field, when combined with the [transactionType](#response.transactions.transactionType) field, provide a unique identifier of the monetary transaction. A monetary transaction can be a sales order, an order refund to the buyer, a credit to the seller's account, a debit to the seller for the purchase of a shipping label, or a transaction where eBay recouped money from the seller if the seller lost a buyer-initiated payment dispute.
- **transactionMemo** (string)
  - This field applies to shipping label transactions, sales transactions where payout is on hold, and non-sale charge fees. The following are examples of how the field is used for each transaction type:

*   **Shipping label purchase**: the **transactionMemo** field gives details about a purchase, a refund, or a price adjustment to the cost of the shipping label.
*   **Sales transactions with funds on hold**: the **transactionMemo** field provides information on the reason for the hold or when the hold will be released (e.g., "Funds on hold. Estimated release on Jun 1").
*   **Non-sale charge fees**: the **transactionMemo** field will provide the type of fee that was charged, such as Promoted Offsite Fee.

This field is only returned if applicable/available.
- **transactionStatus** (TransactionStatusEnum)
  - This enumeration value indicates the current status of the seller payout associated with the monetary transaction. See the `TransactionStatusEnum` type for more information on the different states.
- **transactionType** (TransactionTypeEnum)
  - This enumeration value indicates the type of monetary transaction. Examples of monetary transactions include a buyer's payment for an order, a refund to the buyer for a returned item or cancelled order, or a credit issued by eBay to the seller's account. For a complete list of monetary transaction types within the **Finances API**, see the [TransactionTypeEnum](/api-docs/sell/finances/types/pay:TransactionTypeEnum) type.

### TransactionStatusEnum
**Description:** This enumeration type lists the different possible states of a monetary transaction, including payouts to sellers, refunds to buyers, and credits to a seller's account.

**Note:** The enumerations **COMPLETED** and **FAILED** apply to monetary transactions with the **transactionType** of `TRANSFER`. They only apply to monetary transactions where eBay is billing the seller for reimbursement of a charge. An example of a transfer is a seller reimbursing eBay for a buyer refund. | - **FUNDS_ON_HOLD**: This enumeration value indicates that the funds for the monetary transaction are currently being held. - **FUNDS_PROCESSING**: This enumeration value indicates that the monetary transaction is being processed. - **FUNDS_AVAILABLE_FOR_PAYOUT**: This enumeration value indicates that the corresponding transaction is available for a seller payout. - **PAYOUT**: This enumeration value indicates that the corresponding transaction has been paid out to the seller's account. - **COMPLETED**: This enumeration value indicates that the corresponding transaction has completed and funds have been transferred to eBay. No additional action is required. See **Note**. - **FAILED**: This enumeration value indicates that the corresponding transaction failed and funds have not been transferred to eBay. This does not indicate release of seller's responsibilities for required reimbursement. See **Note**.
**Type:** object

### TransactionSummaryResponse
**Description:** This type is the base response type of the **getTransactionSummary** method, and based on the filters that are used in the **getTransactionSummary** call URI, the response may include total count and amount of the seller's sales and credits, total count and amount of buyer refunds, and total count and amount of seller payment holds.
**Type:** object

**Properties:**
- **adjustmentAmount** (Amount)
  - Total adjustment amount for given payee within a specified period.
- **adjustmentBookingEntry** (BookingEntryEnum)
  - The credit debit sign indicator for adjustment.
- **adjustmentCount** (integer)
  - Total adjustment count for given payee within a specified period.
- **balanceTransferAmount** (Amount)
  - The total balance transfer amount for given payee within the specified period.
- **balanceTransferBookingEntry** (BookingEntryEnum)
  - The credit debit sign indicator for the balance transfer.
- **balanceTransferCount** (integer)
  - The total balance transfer count for given payee within the specified period.
- **creditAmount** (Amount)
  - This amount is the total dollar value of all the seller's sales and/or credits that match the input criteria.  
  
**Note:** Unless the **transactionType** filter is used in the request to retrieve a specific type of monetary transaction, the **creditCount** and **creditAmount** fields account for both order sales and seller credits (the count and value is not distinguished between the two monetary transaction types).  
If there are no sales/credits (**creditCount**\=`0`), this container is not returned.
- **creditBookingEntry** (BookingEntryEnum)
  - The enumeration value indicates whether the dollar amount in the **creditAmount** field is a charge (debit) to the seller or a credit. Typically, the enumeration value returned here will be `CREDIT`.
- **creditCount** (integer)
  - This integer value indicates the total number of the seller's sales and/or credits that match the input criteria.  
  
**Note:** Unless the **transactionType** filter is used in the request to retrieve a specific type of monetary transaction (sale, buyer refund, or seller credit), the **creditCount** and **creditAmount** fields account for both order sales and seller credits (the count and value is not distinguished between the two monetary transaction types).  
This field is generally returned, even if `0`, but it will not be returned if a **transactionType** filter is used, and its value is set to either `REFUND`, `DISPUTE`, or `SHIPPING_LABEL`.
- **disputeAmount** (Amount)
  - This amount is the total dollar value associated with any existing payment disputes that have been initiated by one or more buyers. Only the orders that match the input criteria are considered. The Payment Disputes methods in the Fulfillment API can be used by the seller to retrieve more information about any payment disputes.  
  
If there are no payment disputes (**disputeCount**\=`0`), this container is not returned.
- **disputeBookingEntry** (BookingEntryEnum)
  - The enumeration value indicates whether the dollar amount in the **disputeAmount** field is a charge (debit) to the seller or a credit. Typically, the enumeration value returned here will be `DEBIT`, but its possible that `CREDIT` could be returned if the seller contested one or more payment disputes and won the dispute.
- **disputeCount** (integer)
  - This integer value indicates the total number of payment disputes that have been initiated by one or more buyers. Only the orders that match the input criteria are considered. The Payment Disputes methods in the Fulfillment API can be used by the seller to retrieve more information about any payment disputes.  
  
This field is generally returned, even if `0`, but it will not be returned if a **transactionType** filter is used, and its value is set to any value other than `DISPUTE`.
- **loanRepaymentAmount** (Amount)
  - The sum of all `LOAN_REPAYMENT` transactions (i.e., debit and credit,) that match the input criteria.  
  
For example, within a specified `transactionDate` range, three `LOAN_REPAYMENT` transactions are identified:

*   DEBIT of 15.00 USD
*   DEBIT of 10.00 USD
*   CREDIT of 5.00 USD

  
The net amount of these three transactions is a _DEBIT of 20.00 USD_ to the seller's account. Therefore, the value returned for `loanRepaymentAmount` will be **20.00 USD**.  
  
**Note:** For this example:

*   The value returned for `loanRepaymentCount` will be **3**
*   The `loanRepaymentBookingEntry` will be **DEBIT**

  
If there are no transactions that match the input criteria (i.e., `loanRepaymentCount`\=**0**,) this container is not returned.
- **loanRepaymentBookingEntry** (BookingEntryEnum)
  - The enumeration value indicates whether the `loanRepaymentAmount` is a `DEBIT` against, or a `CREDIT` to, the sellers's account.  
  
For most `loanRepaymentAmount` transactions, `loanRepaymentBookingEntry` will be **DEBIT**. However, if a loan repayment transaction is reversed, that transaction will be shown as a **CREDIT**.
- **loanRepaymentCount** (integer)
  - This integer value indicates the total number of `LOAN_REPAYMENT` transactions (i.e., `DEBIT` and `CREDIT`,) that match the input criteria.  
  
This field is generally returned even if it equals **0**. However it will not be returned if a `transactionType` filter is used and its value has been set to any enumeration value other than `LOAN_REPAYMENT`.
- **nonSaleChargeAmount** (Amount)
  - The total non-sale charge amount for given payee within a specified period.
- **nonSaleChargeBookingEntry** (BookingEntryEnum)
  - The credit/debit sign indicator for the non-sale charge.
- **nonSaleChargeCount** (integer)
  - The total non-sale charge count for given payee within a specified period.
- **onHoldAmount** (Amount)
  - This amount is the total dollar value of order sales where the associated funds are on hold. Only the orders that match the input criteria are considered.  
  
If there are no seller payment holds (**onHoldCount**\=`0`), this container is not returned.
- **onHoldBookingEntry** (BookingEntryEnum)
  - The enumeration value indicates whether the dollar amount in the **onHoldAmount** field is a charge (debit) to the seller or a credit. Typically, the enumeration value returned here will be `CREDIT`, since on-hold funds should eventually be released as part of a payout to the seller once the hold is cleared.
- **onHoldCount** (integer)
  - This integer value indicates the total number of order sales where the associated funds are on hold. Only the orders that match the input criteria are considered.  
  
This field is generally returned, even if `0`, but it will not be returned if a **transactionStatus** filter is used, and its value is set to any value other than `FUNDS_ON_HOLD`.
- **purchaseAmount** (Amount)
  - **Note:** The `PURCHASE` transaction type is currently only applicable in the US marketplace.  
This amount is the total dollar value of all the purchases that have been initiated by a seller using spendable funds that match the input criteria.  
  
If there are no transactions that match the input criteria (i.e., `**purchaseCount**=0`), this container will not be returned.
- **purchaseBookingEntry** (BookingEntryEnum)
  - **Note:** The `PURCHASE` transaction type is currently only applicable in the US marketplace.  
This enumeration value indicates whether the dollar amount in the **purchase** field is a charge (debit) to the seller or a credit.
- **purchaseCount** (integer)
  - **Note:** The `PURCHASE` transaction type is currently only applicable in the US marketplace.  
This integer value indicates the total number of purchases that have been initiated by a seller using spendable funds that match the input criteria.  
  
This field is generally returned, even if it equals `0`. However, it will not be returned if a `transactionType` filter is used and its value has been set to any enumeration value other than `PURCHASE`.
- **refundAmount** (Amount)
  - This amount is the total dollar value of buyer refunds that match the input criteria.  
  
If there are no refunds (**refundCount**\=`0`), this container is not returned.
- **refundBookingEntry** (BookingEntryEnum)
  - The enumeration value indicates whether the dollar amount in the **refundAmount** field is a charge (debit) to the seller or a credit. Typically, the enumeration value returned here will be `DEBIT` since this a refund from the seller to the buyer.
- **refundCount** (integer)
  - This integer value indicates the total number of buyer refunds that match the input criteria.  
  
This field is generally returned, even if `0`, but it will not be returned if a **transactionType** filter is used, and its value is set to any value other than `REFUND`.
- **shippingLabelAmount** (Amount)
  - This is the total dollar value of the eBay shipping labels purchased by the seller.  
  
**Note:** eBay SHIPPING\_LABEL transactions paid through PayPal are not currently supported by the Finances API, so those transactions will not be reflected in the amounts returned in this container.
- **shippingLabelBookingEntry** (BookingEntryEnum)
  - The enumeration value indicates whether the dollar amount in the **shippingLabelAmount** field is a charge (debit) to the seller or a credit. Typically, the enumeration value returned here will be `DEBIT`, as eBay will charge the seller when eBay shipping labels are purchased, but it can be `CREDIT` if the seller was refunded for a shipping label or was possibly overcharged for a shipping label.  
  
**Note:** eBay SHIPPING\_LABEL transactions paid through PayPal are not currently supported by the Finances API, so those transactions will not be reflected in this field.
- **shippingLabelCount** (integer)
  - This is the total number of eBay shipping labels purchased by the seller. The count returned here may depend on the specified input criteria.  
  
**Note:** eBay SHIPPING\_LABEL transactions paid through PayPal are not currently supported by the Finances API, so those transactions will not be reflected in the count returned in this container.
- **transferAmount** (Amount)
  - This amount is the total dollar value of buyer refund transfers that match the input criteria.  
  
If there are no transfers (**refundCount**\=`0`), this container is not returned.
- **transferBookingEntry** (BookingEntryEnum)
  - The enumeration value indicates whether the dollar amount in the **transferAmount** field is a charge (debit) to the seller or a credit. Typically, the enumeration value returned here will be `DEBIT` since this a seller reimbursement to eBay for buyer refunds.
- **transferCount** (integer)
  - This integer value indicates the total number of buyer refund transfers that match the input criteria.  
  
This field is generally returned, even if `0`, but it will not be returned if a **transactionType** filter is used, and its value is set to any value other than `TRANSFER`.
- **withdrawalAmount** (Amount)
  - This amount is the total dollar value of on-demand payouts (withdrawals) that match the input criteria.  
  
If there are no withdrawals (**withdrawalCount**\=`0`), this container is not returned.
- **withdrawalBookingEntry** (BookingEntryEnum)
  - The enumeration value indicates whether the dollar amount in the **withdrawalAmount** field is a charge (debit) to the seller or a credit. Typically, the enumeration value returned here will be `DEBIT` since this transaction involves a debit to the seller's available payout funds.
- **withdrawalCount** (integer)
  - This integer value indicates the total number of on-demand payouts (withdrawals) that match the input criteria.  
  
This field is generally returned, even if `0`, but it will not be returned if a **transactionType** filter is used, and its value is set to any value other than `WITHDRAWAL`.

### TransactionTypeEnum
**Description:** This enumeration type defines the type of monetary transactions retrieved with the **getTransactions** method. | - **SALE**: This enumeration value indicates that the monetary transaction type is the sale of an order. - **REFUND**: This enumeration value indicates that the monetary transaction type is a buyer refund. - **CREDIT**: This enumeration value indicates that the monetary transaction type is a credit to the seller's account. - **DISPUTE**: This enumeration value indicates that the monetary transaction type involves a payment dispute between the buyer and seller. - **SHIPPING_LABEL**: This enumeration value indicates that the monetary transaction type involves eBay billing the seller for the purchase of an eBay shipping label. Note that the shipping label functionality will initially only be available to a select number of sellers.  
  
**Note**: eBay shipping label transactions paid through PayPal are not currently supported by the Finances API, and will not be returned in the response. - **TRANSFER**: This enumeration value indicates that the monetary transaction type involves a seller transferring money to eBay for reimbursement of a charge. For example, when a seller reimburses eBay for a buyer refund. - **NON_SALE_CHARGE**: This enumeration value indicates that the monetary transaction involves a non-transactional fee billed to the seller by eBay. These fees can include listing and listing upgrade fees, eBay store or other subscription fees, and ad fees. - **ADJUSTMENT**: This enumeration value indicates that the monetary transaction type is an adjustment (credit or debit) to the seller's account. - **WITHDRAWAL**: This enumeration value indicates that the monetary transaction type is an on-demand payout to the seller's account. If funds are available, a seller can request an on-demand payout.  
  
**Note**: On-demand payout is not available for sellers who are already on a **daily** payout schedule. In order to initiate an on-demand payout, a seller must be on a **weekly**, **bi-weekly**, or **monthly** payout schedule. - **LOAN_REPAYMENT**: This enumeration value indicates that the monetary transaction type is a loan repayment transaction.  
  
**Note**: eBay Seller Capital financing is only available in select marketplaces. Refer to [Marketplace availability for eBay Seller Capital funding program](/api-docs/sell/finances/overview.html#loans) for current marketplace eligibility. - **PURCHASE**: This enumeration value indicates that the monetary transaction type is the purchase of an item by a seller using spendable funds.  
  
**Note**: This transaction type is currently only applicable in the US marketplace.
**Type:** object

### Transactions
**Description:** This is the base response type of the **getTransactions** method. The **getTransactions** response includes details on one or more monetary transactions that match the input criteria, as well as pagination data.
**Type:** object

**Properties:**
- **href** (string)
  - The URI of the **getTransactions** method request that produced the current page of the result set.
- **limit** (integer)
  - The maximum number of monetary transactions that may be returned per page of the result set. The **limit** value can be passed in as a query parameter, or if omitted, its value defaults to `20`.  
  
**Note:** If this is the last or only page of the result set, the page may contain fewer monetary transactions than the **limit** value. To determine the number of pages in a result set, divide the **total** value (total number of monetary transactions matching input criteria) by this **limit** value, and then round up to the next integer. For example, if the **total** value was `120` (120 total monetary transactions) and the **limit** value was `50` (show 50 monetary transactions per page), the total number of pages in the result set is three, so the seller would have to make three separate **getTransactions** calls to view all monetary transactions matching the input criteria.  
  
**Maximum:** `200`  
**Default:** `20`
- **next** (string)
  - The **getTransactions** method URI to use if you wish to view the next page of the result set.  
  
This field is only returned if there is a next page of results to view based on the current input criteria.
- **offset** (integer)
  - This integer value indicates the actual position that the first monetary transaction returned on the current page has in the results set. So, if you wanted to view the 11th monetary transaction of the result set, you would set the **offset** value in the request to `10`.  
  
In the request, you can use the **offset** parameter in conjunction with the **limit** parameter to control the pagination of the output. For example, if **offset** is set to `30` and **limit** is set to `10`, the method retrieves monetary transactions 31 thru 40 from the resulting collection of monetary transactions.  
  
**Note:** This feature employs a zero-based list, where the first item in the list has an offset of `0`.  
  
**Default:** `0` (zero)
- **prev** (string)
  - The **getTransactions** method URI to use if you wish to view the previous page of the result set.  
  
This field is only returned if there is a previous page of results to view based on the current input criteria.
- **total** (integer)
  - This integer value is the total amount of monetary transactions in the result set based on the current input criteria. Based on the total number of monetary transactions that match the criteria, and on the **limit** and **offset** values, there may be additional pages in the results set.
- **transactions** (array)
  - An array of one or more monetary transactions that match the input criteria. Details for each monetary transaction may include the unique identifier of the order associated with the monetary transaction, the status of the transaction, the amount of the order, the order's buyer, and the unique identifier of the payout (if a payout has been initiated/issued for the order).

### Transfer
**Description:** This type is the base response type used by `TRANSFER` transaction type that is returned in the response.
**Type:** object

**Properties:**
- **fundingSource** (FundingSource)
  - This container provides details about the seller's funding source to reimburse eBay for the transfer, such as a bank account, a credit card, or available seller payout funds.
- **transactionDate** (string)
  - This timestamp indicates the date/time of the transfer. The following (UTC) format is used: `YYYY-MM-DDTHH:MM:SS.SSSZ`. For example, `2020-08-04T19:09:02.768Z`
- **transferAmount** (Amount)
  - The amount of the transfer being deducted from the funding source.
- **transferDetail** (TransferDetail)
  - This container provides more details about the transfer, including details on the charge(s) associated with the transfer. Multiple charges can be addressed with one transfer.
- **transferId** (string)
  - The unique identifier of the `TRANSFER` transaction type. This is the same value that was passed into the end of the call URI.

### TransferDetail
**Description:** This type is used by the **transferDetail** container, which provides more details about the transfer and the charge(s) associated with the transfer.
**Type:** object

**Properties:**
- **balanceAdjustment** (BalanceAdjustment)
  - This container shows the seller payout balance that will be applied toward the charges outlined in the **charges** array.
- **charges** (array)
  - This container is an array of one or more charges related to the transfer. Charges can be related to an order cancellation, order return, case, payment dispute, etc.
- **totalChargeNetAmount** (Amount)
  - This container shows the total amount that the seller owes for all of the charges outlined in the **charges** array.

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
*Generated on 2026-04-28T18:03:58.140Z*
