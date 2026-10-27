---
title: Identity API
description: "The **Identity API** returns data for an authenticated user (user access token) based on the OAuth scopes provided. Non-confidential information, such as eBay `userID` is returned using the default scope. Confidential data for an individual, such as address, email, phone, etc. are returned based on the OAuth scope you use in the call. For business users, all the public business information is returned using the default OAuth scope. The Identity API can be used to let users log into your app or site using eBay, which frees you from needing to store and protect user's PII (Personal Identifiable Information) data."
api_version: v2.0.0
api_name: identity_api
api_type: REST
api_group: identity/api
source_url:
  html: https://developer.ebay.com/develop/api/identity/api
  md: https://developer.ebay.com/develop/api/identity/api.md
---
# Identity API API


## Types

### AccountTypeEnum
**Description:** An enumerated type for the values that represent the user's eBay account type. | - **INDIVIDUAL**: Indicates the eBay user's account is not a business but for an individual. - **BUSINESS**: Indicates the eBay user's account is for a business.
**Type:** object

### Address
**Description:** The type that defines the fields for an address.
**Type:** object

**Properties:**
- **addressLine1** (string)
  - The first line of the street address.
- **addressLine2** (string)
  - The second line of the street address. This field is not always used, but can be used for 'Suite Number' or 'Apt Number'.
- **city** (string)
  - The city of the address.
- **country** (CountryCodeEnum)
  - The two-letter [ISO 3166](https://www.iso.org/iso-3166-country-codes.html) standard of the country of the address.
- **county** (string)
  - The county of the address.
- **postalCode** (string)
  - The postal code of the address.
- **stateOrProvince** (string)
  - The state or province of the address.

### BusinessAccount
**Description:** The type that defines the fields for the business account information.
**Type:** object

**Properties:**
- **address** (Address)
  - The container that returns the address of the business account.
- **doingBusinessAs** (string)
  - An additional name that is used for their business on eBay. The business name is returned in the **name** field.
- **email** (string)
  - The email address of the business account.
- **name** (string)
  - The business name associated with the user's eBay account.
- **primaryContact** (Contact)
  - The container that returns the contact details of the person who is the primary contact for this account.
- **primaryPhone** (Phone)
  - The container that returns the primary phone number for the business account.
- **secondaryPhone** (Phone)
  - The container that returns the secondary phone number for the business account.
- **website** (string)
  - The business website address associated with the eBay account.

### Contact
**Description:** The type that defines the fields for the information of the contact person for the account.
**Type:** object

**Properties:**
- **firstName** (string)
  - The first name of the contact person.
- **lastName** (string)
  - The last name of the contact person.

### CountryCodeEnum
**Description:** The two-letter ISO 3166 standard code representing a country. | - **AD**: Indicates the country is Andorra. - **AE**: Indicates the country is United Arab Emirates. - **AF**: Indicates the country is Afghanistan. - **AG**: Indicates the country is Antigua and Barbuda. - **AI**: Indicates the country is Anguilla. - **AL**: Indicates the country is Albania. - **AM**: Indicates the country is Armenia. - **AN**: Indicates the country is Netherlands Antilles. - **AO**: Indicates the country is Angola. - **AQ**: Indicates the country is Antarctica. - **AR**: Indicates the country is Argentina. - **AS**: Indicates the country is American Samoa. - **AT**: Indicates the country is Austria. - **AU**: Indicates the country is Australia. - **AW**: Indicates the country is Aruba. - **AX**: Indicates the country is Aland Islands - **AZ**: Indicates the country is Azerbaijan. - **BA**: Indicates the country is Bosnia and Herzegovina. - **BB**: Indicates the country is Barbados. - **BD**: Indicates the country is Bangladesh. - **BE**: Indicates the country is Belgium. - **BF**: Indicates the country is Burkina Faso. - **BG**: Indicates the country is Bulgaria. - **BH**: Indicates the country is Bahrain. - **BI**: Indicates the country is Burundi. - **BJ**: Indicates the country is Benin. - **BL**: Indicates the country is Saint Barthelemy. - **BM**: Indicates the country is Bermuda. - **BN**: Indicates the country is Brunei Darussalam. - **BO**: Indicates the country is Bolivia. - **BQ**: Indicates the country is Bonaire, Sint Eustatius, and Saba. - **BR**: Indicates the country is Brazil. - **BS**: Indicates the country is Bahamas. - **BT**: Indicates the country is Bhutan. - **BV**: Indicates the country is Bouvet Island. - **BW**: Indicates the country is Botswana. - **BY**: Indicates the country is Belarus. - **BZ**: Indicates the country is Belize. - **CA**: Indicates the country is Canada. - **CC**: Indicates the country is Cocos (Keeling) Islands. - **CD**: Indicates the country is The Democratic Republic of the Congo. - **CF**: Indicates the country is Central African Republic. - **CG**: Indicates the country is Congo. - **CH**: Indicates the country is Switzerland. - **CI**: Indicates the country is Cote d'Ivoire. - **CK**: Indicates the country is Cook Islands. - **CL**: Indicates the country is Chile. - **CM**: Indicates the country is Cameroon. - **CN**: Indicates the country is China. - **CO**: Indicates the country is Colombia. - **CR**: Indicates the country is Costa Rica. - **CU**: Indicates the country is Cuba. - **CV**: Indicates the country is Cape Verde. - **CW**: Indicates the country is Curacao. - **CX**: Indicates the country is Christmas Island. - **CY**: Indicates the country is Cyprus. - **CZ**: Indicates the country is Czech Republic. - **DE**: Indicates the country is Germany. - **DJ**: Indicates the country is Djibouti. - **DK**: Indicates the country is Denmark. - **DM**: Indicates the country is Dominica. - **DO**: Indicates the country is Dominican Republic. - **DZ**: Indicates the country is Algeria. - **EC**: Indicates the country is Ecuador. - **EE**: Indicates the country is Estonia. - **EG**: Indicates the country is Egypt. - **EH**: Indicates the country is Western Sahara. - **ER**: Indicates the country is Eritrea. - **ES**: Indicates the country is Spain. - **ET**: Indicates the country is Ethiopia. - **FI**: Indicates the country is Finland. - **FJ**: Indicates the country is Fiji. - **FK**: Indicates the country is Falkland Islands (Malvinas). - **FM**: Indicates the country is Federated States of Micronesia. - **FO**: Indicates the country is Faroe Islands. - **FR**: Indicates the country is France. - **GA**: Indicates the country is Gabon. - **GB**: Indicates the country is United Kingdom. - **GD**: Indicates the country is Grenada. - **GE**: Indicates the country is Georgia. - **GF**: Indicates the country is French Guiana. - **GG**: Indicates the country is Guernsey. - **GH**: Indicates the country is Ghana. - **GI**: Indicates the country is Gibraltar. - **GL**: Indicates the country is Greenland. - **GM**: Indicates the country is Gambia. - **GN**: Indicates the country is Guinea. - **GP**: Indicates the country is Guadeloupe. - **GQ**: Indicates the country is Equatorial Guinea. - **GR**: Indicates the country is Greece. - **GS**: Indicates the country is South Georgia and the South Sandwich Islands. - **GT**: Indicates the country is Guatemala. - **GU**: Indicates the country is Guam. - **GW**: Indicates the country is Guinea-Bissau. - **GY**: Indicates the country is Guyana. - **HK**: Indicates the country is Hong Kong. - **HM**: Indicates the country is Heard Island and McDonald Islands. - **HN**: Indicates the country is Honduras. - **HR**: Indicates the country is Croatia. - **HT**: Indicates the country is Haiti. - **HU**: Indicates the country is Hungary. - **ID**: Indicates the country is Indonesia. - **IE**: Indicates the country is Ireland. - **IL**: Indicates the country is Israel. - **IM**: Indicates the country is Isle of Man. - **IN**: Indicates the country is India. - **IO**: Indicates the country is British Indian Ocean Territory. - **IQ**: Indicates the country is Iraq. - **IR**: Indicates the country is Islamic Republic of Iran. - **IS**: Indicates the country is Iceland. - **IT**: Indicates the country is Italy. - **JE**: Indicates the country is Jersey. - **JM**: Indicates the country is Jamaica. - **JO**: Indicates the country is Jordan. - **JP**: Indicates the country is Japan. - **KE**: Indicates the country is Kenya. - **KG**: Indicates the country is Kyrgyzstan. - **KH**: Indicates the country is Cambodia. - **KI**: Indicates the country is Kiribati. - **KM**: Indicates the country is Comoros. - **KN**: Indicates the country is Saint Kitts and Nevis. - **KP**: Indicates the country is Democratic People's Republic of Korea. - **KR**: Indicates the country is Republic of Korea. - **KW**: Indicates the country is Kuwait. - **KY**: Indicates the country is Cayman Islands. - **KZ**: Indicates the country is Kazakhstan. - **LA**: Indicates the country is Lao People's Democratic Republic. - **LB**: Indicates the country is Lebanon. - **LC**: Indicates the country is Saint Lucia. - **LI**: Indicates the country is Liechtenstein. - **LK**: Indicates the country is Sri Lanka. - **LR**: Indicates the country is Liberia. - **LS**: Indicates the country is Lesotho. - **LT**: Indicates the country is Lithuania. - **LU**: Indicates the country is Luxembourg. - **LV**: Indicates the country is Latvia. - **LY**: Indicates the country is Libyan Arab Jamahiriya. - **MA**: Indicates the country is Morocco. - **MC**: Indicates the country is Monaco. - **MD**: Indicates the country is Republic of Moldova. - **ME**: Indicates the country is Montenegro. - **MF**: Indicates the country is Saint Martin (French part). - **MG**: Indicates the country is Madagascar. - **MH**: Indicates the country is Marshall Islands. - **MK**: Indicates the country is The Former Yugoslav Republic of Macedonia. - **ML**: Indicates the country is Mali. - **MM**: Indicates the country is Myanmar. - **MN**: Indicates the country is Mongolia. - **MO**: Indicates the country is Macao. - **MP**: Indicates the country is Northern Mariana Islands. - **MQ**: Indicates the country is Martinique. - **MR**: Indicates the country is Mauritania. - **MS**: Indicates the country is Montserrat. - **MT**: Indicates the country is Malta. - **MU**: Indicates the country is Mauritius. - **MV**: Indicates the country is Maldives. - **MW**: Indicates the country is Malawi. - **MX**: Indicates the country is Mexico. - **MY**: Indicates the country is Malaysia. - **MZ**: Indicates the country is Mozambique. - **NA**: Indicates the country is Namibia. - **NC**: Indicates the country is New Caledonia. - **NE**: Indicates the country is Niger. - **NF**: Indicates the country is Norfolk Island. - **NG**: Indicates the country is Nigeria. - **NI**: Indicates the country is Nicaragua. - **NL**: Indicates the country is Netherlands. - **NO**: Indicates the country is Norway. - **NP**: Indicates the country is Nepal. - **NR**: Indicates the country is Nauru. - **NU**: Indicates the country is Niue. - **NZ**: Indicates the country is New Zealand. - **OM**: Indicates the country is Oman. - **PA**: Indicates the country is Panama. - **PE**: Indicates the country is Peru. - **PF**: Indicates the country is French Polynesia. Includes Tahiti. - **PG**: Indicates the country is Papua New Guinea. - **PH**: Indicates the country is Philippines. - **PK**: Indicates the country is Pakistan. - **PL**: Indicates the country is Poland. - **PM**: Indicates the country is Saint Pierre and Miquelon. - **PN**: Indicates the country is Pitcairn. - **PR**: Indicates the country is Puerto Rico. - **PS**: Indicates the country is Palestinian territory Occupied. - **PT**: Indicates the country is Portugal. - **PW**: Indicates the country is Palau. - **PY**: Indicates the country is Paraguay. - **QA**: Indicates the country is Qatar. - **RE**: Indicates the country is Reunion. - **RO**: Indicates the country is Romania. - **RS**: Indicates the country is Serbia. - **RU**: Indicates the country is Russian Federation. - **RW**: Indicates the country is Rwanda. - **SA**: Indicates the country is Saudi Arabia. - **SB**: Indicates the country is Solomon Islands. - **SC**: Indicates the country is Seychelles. - **SD**: Indicates the country is Sudan. - **SE**: Indicates the country is Sweden. - **SG**: Indicates the country is Singapore. - **SH**: Indicates the country is Saint Helena. - **SI**: Indicates the country is Slovenia. - **SJ**: Indicates the country is Svalbard and Jan Mayen. - **SK**: Indicates the country is Slovakia. - **SL**: Indicates the country is Sierra Leone. - **SM**: Indicates the country is San Marino. - **SN**: Indicates the country is Senegal. - **SO**: Indicates the country is Somalia. - **SR**: Indicates the country is Suriname. - **ST**: Indicates the country is Sao Tome and Principe. - **SV**: Indicates the country is El Salvador. - **SX**: Indicates the country is Sint Maarten (Dutch part). - **SY**: Indicates the country is Syrian Arab Republic. - **SZ**: Indicates the country is Swaziland. - **TC**: Indicates the country is Turks and Caicos Islands. - **TD**: Indicates the country is Chad. - **TF**: Indicates the country is French Southern Territories. - **TG**: Indicates the country is Togo. - **TH**: Indicates the country is Thailand. - **TJ**: Indicates the country is Tajikistan. - **TK**: Indicates the country is Tokelau. - **TL**: Indicates the country is Timor-Leste. - **TM**: Indicates the country is Turkmenistan. - **TN**: Indicates the country is Tunisia. - **TO**: Indicates the country is Tonga. - **TR**: Indicates the country is Turkey. - **TT**: Indicates the country is Trinidad and Tobago. - **TV**: Indicates the country is Tuvalu. - **TW**: Indicates the country is Taiwan. - **TZ**: Indicates the country is Tanzania. - **UA**: Indicates the country is Ukraine. - **UG**: Indicates the country is Uganda. - **UM**: Indicates the country is United States Minor Outlying Islands. - **US**: Indicates the country is United States. - **UY**: Indicates the country is Uruguay. - **UZ**: Indicates the country is Uzbekistan. - **VA**: Indicates the country is Holy See (Vatican City state). - **VC**: Indicates the country is Saint Vincent and the Grenadines. - **VE**: Indicates the country is Venezuela. - **VG**: Indicates the country is British Virgin Islands. - **VI**: Indicates the country is the U.S. Virgin Islands. - **VN**: Indicates the country is Vietnam. - **VU**: Indicates the country is Vanuatu. - **WF**: Indicates the country is Wallis and Futuna. - **WS**: Indicates the country is Samoa. - **YE**: Indicates the country is Yemen. - **YT**: Indicates the country is Mayotte. - **ZA**: Indicates the country is South Africa. - **ZM**: Indicates the country is Zambia. - **ZW**: Indicates the country is Zimbabwe.
**Type:** object

### IndividualAccount
**Description:** The type that defines the fields for the information of an individual account.
**Type:** object

**Properties:**
- **email** (string)
  - The eBay user's registration email address.
- **firstName** (string)
  - The eBay user's first name.
- **lastName** (string)
  - The eBay user's last name.
- **primaryPhone** (Phone)
  - The container that returns the eBay user's primary phone number information.
- **registrationAddress** (Address)
  - The container that returns the eBay user's address information.
- **secondaryPhone** (Phone)
  - The container that returns the eBay user's secondary phone number information.

### MarketplaceIdEnum
**Description:** An enumerated type for the values that represent the unique eBay-assigned IDs for each of the eBay marketplaces. | - **EBAY_AT**: Indicates the eBay marketplace for Austria (https://www.ebay.at). - **EBAY_AU**: Indicates the eBay marketplace for Australia (https://www.ebay.com.au). - **EBAY_BE**: Indicates the eBay marketplace for Belgium (https://www.ebay.be/). - **EBAY_CA**: Indicates the eBay marketplace for Canada (https://www.ebay.ca). - **EBAY_CH**: Indicates the eBay marketplace for Switzerland (https://www.ebay.ch). - **EBAY_CN**: Reserved for future use. - **EBAY_CZ**: Reserved for future use. - **EBAY_DE**: Indicates the eBay marketplace for Germany (https://www.ebay.de). - **EBAY_DK**: Reserved for future use. - **EBAY_ES**: Indicates the eBay marketplace for Spain (https://www.ebay.es). - **EBAY_FI**: Reserved for future use. - **EBAY_FR**: Indicates the eBay marketplace for France (https://www.ebay.fr). - **EBAY_GB**: Indicates the eBay marketplace for Great Britain (https://www.ebay.co.uk). - **EBAY_GR**: Reserved for future use. - **EBAY_HK**: Indicates the eBay marketplace for Hong Kong (https://www.ebay.com.hk). - **EBAY_HU**: Reserved for future use. - **EBAY_ID**: Reserved for future use. - **EBAY_IE**: Indicates the eBay marketplace for Ireland (https://www.ebay.ie). - **EBAY_IL**: Reserved for future use. - **EBAY_IN**: Indicates the eBay marketplace for India (https://www.ebay.in). - **EBAY_IT**: Indicates the eBay marketplace for Italy (https://www.ebay.it). - **EBAY_JP**: Reserved for future use. - **EBAY_MY**: Indicates the eBay marketplace for Malaysia (https://www.ebay.com.my). - **EBAY_NL**: Indicates the eBay marketplace for the Netherlands (https://www.ebay.nl). - **EBAY_NO**: Reserved for future use. - **EBAY_NZ**: Reserved for future use. - **EBAY_PE**: Reserved for future use. - **EBAY_PH**: Indicates the eBay marketplace for the Philippines (https://www.ebay.ph). - **EBAY_PL**: Indicates the eBay marketplace for Poland (https://www.ebay.pl). - **EBAY_PR**: Reserved for future use. - **EBAY_PT**: Reserved for future use. - **EBAY_RU**: Reserved for future use. - **EBAY_SE**: Reserved for future use. - **EBAY_SG**: Indicates the eBay marketplace for Singapore (https://www.ebay.com.sg). - **EBAY_TH**: Indicates the eBay marketplace for Thailand (https://info.ebay.co.th). - **EBAY_TW**: Indicates the eBay marketplace for Taiwan (https://www.ebay.com.tw). - **EBAY_US**: Indicates the eBay marketplace for the United States (https://www.ebay.com). - **EBAY_VN**: Indicates the eBay marketplace for Vietnam (https://www.ebay.vn). - **EBAY_ZA**: Reserved for future use. - **EBAY_HALF_US**: No longer used. - **EBAY_MOTORS_US**: Indicates the parent category for "Auto Parts and Vehicles" on the EBAY\_US marketplace (https://www.ebay.com/motors).
**Type:** object

### Phone
**Description:** The type that defines the fields for the details of a phone.
**Type:** object

**Properties:**
- **countryCode** (string)
  - The two-letter [ISO 3166](https://www.iso.org/iso-3166-country-codes.html) standard of the country to which the phone number belongs.
- **number** (string)
  - The numeric string representing the phone number.
- **phoneType** (string)
  - The type of phone service.  
  
**Valid Values:** MOBILE or LAND\_LINE  
  
Code so that your app gracefully handles any future changes to this list.

### UserResponse
**Description:** The type that defines the fields for the **getUser** method.
**Type:** object

**Properties:**
- **accountType** (AccountTypeEnum)
  - Indicates the user account type. This is determined when the user registers with eBay. If they register for a business account, this value will be `BUSINESS`. If they register for a private account, this value will be `INDIVIDUAL`. This designation is required by the tax laws in the following countries:

*   EBAY\_AT
*   EBAY\_BE
*   EBAY\_CH
*   EBAY\_DE
*   EBAY\_ES
*   EBAY\_FR
*   EBAY\_GB
*   EBAY\_IE
*   EBAY\_IT
*   EBAY\_PL

  
**Valid Values:** `BUSINESS` or `INDIVIDUAL`  
  
Code so that your app gracefully handles any future changes to this list.
- **businessAccount** (BusinessAccount)
  - The container that returns the business account information of the user.
- **individualAccount** (IndividualAccount)
  - The account information of the user.
- **registrationMarketplaceId** (MarketplaceIdEnum)
  - The eBay site on which the account is registered.
- **status** (UserStatusEnum)
  - Indicates the user's account status. Possible values: `CONFIRMED`, `UNCONFIRMED`, `ACCOUNTONHOLD` and `UNDETERMINED`.
- **userId** (string)
  - The eBay immutable user ID of the user's account and can always be used to identify the user.
- **username** (string)
  - The user name, which was specified by the user when they created the account.  
  
**Note:** This value can be changed by the user.  
**Note:** Effective September 26, 2025, select developers will no longer receive username data for U.S. users through this field. Instead, an immutable user ID will be returned in its place. For more information, please refer to [Data Handling Compliance](/api-docs/static/data-handling-update.html).

### UserStatusEnum
**Description:** An enumerated type for the values that represent the status of the user's account. | - **CONFIRMED**: Indicates the user's account has been verified by eBay. - **UNCONFIRMED**: Indicates the user's account has not been verified by eBay. - **ACCOUNTONHOLD**: Indicates the user's account has been put on hold by eBay. - **UNDETERMINED**: Indicates the user's account is not in any of the other states.
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
*Generated on 2026-04-10T14:28:06.546Z*
