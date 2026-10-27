---
title: Charity API
description: "The eBay **Charity API** provides buyers and sellers a formal way to search for supported charitable organizations and charitable organization details. **Note:** The **Charity API** is supported only in the UK and US marketplaces. For more information about using RESTful APIs, see [Get started with eBay APIs](/develop/guides-v2/get-started-with-ebay-apis/get-started-with-ebay-apis#overview) and [Using eBay RESTful APIs](/develop/guides-v2/using-ebay-restful-apis/using-ebay-restful-apis#overview). #### Sandbox vs. Production data The data in the eBay Sandbox environment is static. It can be limited in scope and quantity, and is sometimes simulated or mock data. As a result, you should not depend on data in the Production environment to have the same limitations. Use good coding practices to anticipate the wider range and variability of data that your application is likely to encounter."
api_version: v1.2.1
api_name: charity_api
api_type: REST
api_group: charity/api
source_url:
  html: https://developer.ebay.com/develop/api/charity/api
  md: https://developer.ebay.com/develop/api/charity/api.md
---
# Charity API API


## Types

### Address
**Description:** The physical location of the item.
**Type:** object

**Properties:**
- **city** (string)
  - The city of the charitable organization.
- **stateOrProvince** (string)
  - The state or province of the charitable organization.
- **postalCode** (string)
  - The postal code of the charitable organization.
- **country** (CountryCodeEnum)
  - The two-letter [ISO 3166](https://www.iso.org/iso-3166-country-codes.html ) standard of the country of the address.

### CharityOrg
**Description:** The full location, ID, logo and other details of the charity organization.
**Type:** object

**Properties:**
- **charityOrgId** (string)
  - The ID of the charitable organization.
- **description** (string)
  - The description of the charitable organization.
- **location** (Location)
  - The location details of the charitable organization.
- **logoImage** (Image)
  - The logo of the charitable organization.
- **missionStatement** (string)
  - The mission statement of the charitable organization.
- **name** (string)
  - The name of the charitable organization.
- **registrationId** (string)
  - The registration ID for the charitable organization.  
  
**Note:** For the US marketplace, this is the EIN.
- **website** (string)
  - The link to the website for the charitable organization.

### CharitySearchResponse
**Description:** A single set of search results, with information for accessing other sets.
**Type:** object

**Properties:**
- **charityOrgs** (array)
  - The list of charitable organizations that match the search criteria.
- **href** (string)
  - The relative path to the current set of results.
- **limit** (integer)
  - The number of items, from the result set, returned in a single page.  
  
**Valid Values:** `1-100`  
  
**Default:** `20`
- **next** (string)
  - The relative path to the next set of results.
- **offset** (integer)
  - The number of items that will be skipped in the result set. This is used with the **limit** field to control the pagination of the output.  
  
For example, if the **offset** is set to `0` and the **limit** is set to `10`, the method will retrieve items 1 through 10 from the list of items returned. If the **offset** is set to `10` and the **limit** is set to `10`, the method will retrieve items 11 through 20 from the list of items returned.  
  
**Valid Values:** `0-10,000`  
  
**Default:** `0`
- **prev** (string)
  - The relative path to the previous set of results.
- **total** (integer)
  - The total number of matches for the search criteria.

### CountryCodeEnum
**Description:** The two-letter [ISO 3166](https://www.iso.org/iso-3166-country-codes.html ) standard of the country of the address. | - **AD**: Indicates the country is Andorra. - **AE**: Indicates the country is United Arab Emirates. - **AF**: Indicates the country is Afghanistan. - **AG**: Indicates the country is Antigua and Barbuda. - **AI**: Indicates the country is Anguilla. - **AL**: Indicates the country is Albania. - **AM**: Indicates the country is Armenia. - **AN**: Indicates the country is Netherlands Antilles. - **AO**: Indicates the country is Angola. - **AQ**: Indicates the country is Antarctica. - **AR**: Indicates the country is Argentina. - **AS**: Indicates the country is American Samoa. - **AT**: Indicates the country is Austria. - **AU**: Indicates the country is Australia. - **AW**: Indicates the country is Aruba. - **AX**: Indicates the country is Aland Islands\*\*: - **AZ**: Indicates the country is Azerbaijan. - **BA**: Indicates the country is Bosnia and Herzegovina. - **BB**: Indicates the country is Barbados. - **BD**: Indicates the country is Bangladesh. - **BE**: Indicates the country is Belgium. - **BF**: Indicates the country is Burkina Faso. - **BG**: Indicates the country is Bulgaria. - **BH**: Indicates the country is Bahrain. - **BI**: Indicates the country is Burundi. - **BJ**: Indicates the country is Benin. - **BL**: Indicates the country is Saint Barthelemy. - **BM**: Indicates the country is Bermuda. - **BN**: Indicates the country is Brunei Darussalam. - **BO**: Indicates the country is Bolivia. - **BQ**: Indicates the country is Bonaire, Sint Eustatius, and Saba. - **BR**: Indicates the country is Brazil. - **BS**: Indicates the country is Bahamas. - **BT**: Indicates the country is Bhutan. - **BV**: Indicates the country is Bouvet Island. - **BW**: Indicates the country is Botswana. - **BY**: Indicates the country is Belarus. - **BZ**: Indicates the country is Belize. - **CA**: Indicates the country is Canada. - **CC**: Indicates the country is Cocos (Keeling) Islands. - **CD**: Indicates the country is The Democratic Republic of the Congo. - **CF**: Indicates the country is Central African Republic. - **CG**: Indicates the country is Congo. - **CH**: Indicates the country is Switzerland. - **CI**: Indicates the country is Cote d'Ivoire. - **CK**: Indicates the country is Cook Islands. - **CL**: Indicates the country is Chile. - **CM**: Indicates the country is Cameroon. - **CN**: Indicates the country is China. - **CO**: Indicates the country is Colombia. - **CR**: Indicates the country is Costa Rica. - **CU**: Indicates the country is Cuba. - **CV**: Indicates the country is Cape Verde. - **CW**: Indicates the country is Curacao. - **CX**: Indicates the country is Christmas Island. - **CY**: Indicates the country is Cyprus. - **CZ**: Indicates the country is Czech Republic. - **DE**: Indicates the country is Germany. - **DJ**: Indicates the country is Djibouti. - **DK**: Indicates the country is Denmark. - **DM**: Indicates the country is Dominica. - **DO**: Indicates the country is Dominican Republic. - **DZ**: Indicates the country is Algeria. - **EC**: Indicates the country is Ecuador. - **EE**: Indicates the country is Estonia. - **EG**: Indicates the country is Egypt. - **EH**: Indicates the country is Western Sahara. - **ER**: Indicates the country is Eritrea. - **ES**: Indicates the country is Spain. - **ET**: Indicates the country is Ethiopia. - **FI**: Indicates the country is Finland. - **FJ**: Indicates the country is Fiji. - **FK**: Indicates the country is Falkland Islands (Malvinas). - **FM**: Indicates the country is Federated States of Micronesia. - **FO**: Indicates the country is Faroe Islands. - **FR**: Indicates the country is France. - **GA**: Indicates the country is Gabon. - **GB**: Indicates the country is United Kingdom. - **GD**: Indicates the country is Grenada. - **GE**: Indicates the country is Georgia. - **GF**: Indicates the country is French Guiana. - **GG**: Indicates the country is Guernsey. - **GH**: Indicates the country is Ghana. - **GI**: Indicates the country is Gibraltar. - **GL**: Indicates the country is Greenland. - **GM**: Indicates the country is Gambia. - **GN**: Indicates the country is Guinea. - **GP**: Indicates the country is Guadeloupe. - **GQ**: Indicates the country is Equatorial Guinea. - **GR**: Indicates the country is Greece. - **GS**: Indicates the country is South Georgia and the South Sandwich Islands. - **GT**: Indicates the country is Guatemala. - **GU**: Indicates the country is Guam. - **GW**: Indicates the country is Guinea-Bissau. - **GY**: Indicates the country is Guyana. - **HK**: Indicates the country is Hong Kong. - **HM**: Indicates the country is Heard Island and McDonald Islands. - **HN**: Indicates the country is Honduras. - **HR**: Indicates the country is Croatia. - **HT**: Indicates the country is Haiti. - **HU**: Indicates the country is Hungary. - **ID**: Indicates the country is Indonesia. - **IE**: Indicates the country is Ireland. - **IL**: Indicates the country is Israel. - **IM**: Indicates the country is Isle of Man. - **IN**: Indicates the country is India. - **IO**: Indicates the country is British Indian Ocean Territory. - **IQ**: Indicates the country is Iraq. - **IR**: Indicates the country is Islamic Republic of Iran. - **IS**: Indicates the country is Iceland. - **IT**: Indicates the country is Italy. - **JE**: Indicates the country is Jersey. - **JM**: Indicates the country is Jamaica. - **JO**: Indicates the country is Jordan. - **JP**: Indicates the country is Japan. - **KE**: Indicates the country is Kenya. - **KG**: Indicates the country is Kyrgyzstan. - **KH**: Indicates the country is Cambodia. - **KI**: Indicates the country is Kiribati. - **KM**: Indicates the country is Comoros. - **KN**: Indicates the country is Saint Kitts and Nevis. - **KP**: Indicates the country is Democratic People's Republic of Korea. - **KR**: Indicates the country is Republic of Korea. - **KW**: Indicates the country is Kuwait. - **KY**: Indicates the country is Cayman Islands. - **KZ**: Indicates the country is Kazakhstan. - **LA**: Indicates the country is Lao People's Democratic Republic. - **LB**: Indicates the country is Lebanon. - **LC**: Indicates the country is Saint Lucia. - **LI**: Indicates the country is Liechtenstein. - **LK**: Indicates the country is Sri Lanka. - **LR**: Indicates the country is Liberia. - **LS**: Indicates the country is Lesotho. - **LT**: Indicates the country is Lithuania. - **LU**: Indicates the country is Luxembourg. - **LV**: Indicates the country is Latvia. - **LY**: Indicates the country is Libyan Arab Jamahiriya. - **MA**: Indicates the country is Morocco. - **MC**: Indicates the country is Monaco. - **MD**: Indicates the country is Republic of Moldova. - **ME**: Indicates the country is Montenegro. - **MF**: Indicates the country is Saint Martin (French part). - **MG**: Indicates the country is Madagascar. - **MH**: Indicates the country is Marshall Islands. - **MK**: Indicates the country is The Former Yugoslav Republic of Macedonia. - **ML**: Indicates the country is Mali. - **MM**: Indicates the country is Myanmar. - **MN**: Indicates the country is Mongolia. - **MO**: Indicates the country is Macao. - **MP**: Indicates the country is Northern Mariana Islands. - **MQ**: Indicates the country is Martinique. - **MR**: Indicates the country is Mauritania. - **MS**: Indicates the country is Montserrat. - **MT**: Indicates the country is Malta. - **MU**: Indicates the country is Mauritius. - **MV**: Indicates the country is Maldives. - **MW**: Indicates the country is Malawi. - **MX**: Indicates the country is Mexico. - **MY**: Indicates the country is Malaysia. - **MZ**: Indicates the country is Mozambique. - **NA**: Indicates the country is Namibia. - **NC**: Indicates the country is New Caledonia. - **NE**: Indicates the country is Niger. - **NF**: Indicates the country is Norfolk Island. - **NG**: Indicates the country is Nigeria. - **NI**: Indicates the country is Nicaragua. - **NL**: Indicates the country is Netherlands. - **NO**: Indicates the country is Norway. - **NP**: Indicates the country is Nepal. - **NR**: Indicates the country is Nauru. - **NU**: Indicates the country is Niue. - **NZ**: Indicates the country is New Zealand. - **OM**: Indicates the country is Oman. - **PA**: Indicates the country is Panama. - **PE**: Indicates the country is Peru. - **PF**: Indicates the country is French Polynesia. Includes Tahiti. - **PG**: Indicates the country is Papua New Guinea. - **PH**: Indicates the country is Philippines. - **PK**: Indicates the country is Pakistan. - **PL**: Indicates the country is Poland. - **PM**: Indicates the country is Saint Pierre and Miquelon. - **PN**: Indicates the country is Pitcairn. - **PR**: Indicates the country is Puerto Rico. - **PS**: Indicates the country is Palestinian territory Occupied. - **PT**: Indicates the country is Portugal. - **PW**: Indicates the country is Palau. - **PY**: Indicates the country is Paraguay. - **QA**: Indicates the country is Qatar. - **RE**: Indicates the country is Reunion. - **RO**: Indicates the country is Romania. - **RS**: Indicates the country is Serbia. - **RU**: Indicates the country is Russian Federation. - **RW**: Indicates the country is Rwanda. - **SA**: Indicates the country is Saudi Arabia. - **SB**: Indicates the country is Solomon Islands. - **SC**: Indicates the country is Seychelles. - **SD**: Indicates the country is Sudan. - **SE**: Indicates the country is Sweden. - **SG**: Indicates the country is Singapore. - **SH**: Indicates the country is Saint Helena. - **SI**: Indicates the country is Slovenia. - **SJ**: Indicates the country is Svalbard and Jan Mayen. - **SK**: Indicates the country is Slovakia. - **SL**: Indicates the country is Sierra Leone. - **SM**: Indicates the country is San Marino. - **SN**: Indicates the country is Senegal. - **SO**: Indicates the country is Somalia. - **SR**: Indicates the country is Suriname. - **ST**: Indicates the country is Sao Tome and Principe. - **SV**: Indicates the country is El Salvador. - **SX**: Indicates the country is Sint Maarten (Dutch part). - **SY**: Indicates the country is Syrian Arab Republic. - **SZ**: Indicates the country is Swaziland. - **TC**: Indicates the country is Turks and Caicos Islands. - **TD**: Indicates the country is Chad. - **TF**: Indicates the country is French Southern Territories. - **TG**: Indicates the country is Togo. - **TH**: Indicates the country is Thailand. - **TJ**: Indicates the country is Tajikistan. - **TK**: Indicates the country is Tokelau. - **TL**: Indicates the country is Timor-Leste. - **TM**: Indicates the country is Turkmenistan. - **TN**: Indicates the country is Tunisia. - **TO**: Indicates the country is Tonga. - **TR**: Indicates the country is Turkey. - **TT**: Indicates the country is Trinidad and Tobago. - **TV**: Indicates the country is Tuvalu. - **TW**: Indicates the country is Taiwan. - **TZ**: Indicates the country is Tanzania. - **UA**: Indicates the country is Ukraine. - **UG**: Indicates the country is Uganda. - **UM**: Indicates the country is United States Minor Outlying Islands. - **US**: Indicates the country is United States. - **UY**: Indicates the country is Uruguay. - **UZ**: Indicates the country is Uzbekistan. - **VA**: Indicates the country is Holy See (Vatican City state). - **VC**: Indicates the country is Saint Vincent and the Grenadines. - **VE**: Indicates the country is Venezuela. - **VG**: Indicates the country is British Virgin Islands. - **VI**: Indicates the country is the U.S. Virgin Islands. - **VN**: Indicates the country is Vietnam. - **VU**: Indicates the country is Vanuatu. - **WF**: Indicates the country is Wallis and Futuna. - **WS**: Indicates the country is Samoa. - **YE**: Indicates the country is Yemen. - **YT**: Indicates the country is Mayotte. - **ZA**: Indicates the country is South Africa. - **ZM**: Indicates the country is Zambia. - **ZW**: Indicates the country is Zimbabwe.
**Type:** object

### GeoCoordinates
**Description:** Defines the format of a geographic coordinate.
**Type:** object

**Properties:**
- **latitude** (number)
  - The latitude component of the geographic coordinate.
- **longitude** (number)
  - The longitude component of the geographic coordinate.

### Image
**Description:** The logo of the charitable organization.
**Type:** object

**Properties:**
- **height** (string)
  - The height of the logo image.
- **imageUrl** (string)
  - The URL to the logo image location.
- **width** (string)
  - The width of the logo image.

### Location
**Type:** object

**Properties:**
- **address** (Address)
  - The address of the charitable organization.
- **geoCoordinates** (GeoCoordinates)
  - The geo-coordinates of the charitable organization.

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
*Generated on 2026-04-10T13:24:12.690Z*
