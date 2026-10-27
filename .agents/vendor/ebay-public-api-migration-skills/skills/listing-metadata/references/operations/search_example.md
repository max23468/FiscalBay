# GET : search Samples

**API:** Catalog
**Type:** REST GET
**Endpoint:** `https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=drone&limit=3`
**Method:** GET
**Operation Name:** `search`

---

## Description

This sample returns a set of eBay products that match the keyword.

---

**Note:** This operation has 6 sample variations.

---

## Sample 1

### Response Sample

```json
{
    "productSummaries": [
        {
            "epid": "237137365",
            "gtin": [
                "0814838014791"
            ],
            "aspects": [
                {
                    "localizedName": "Leading Role",
                    "localizedValues": [
                        "SEAN Bean",
                        "Mary Mccormack",
                        "Patrick Sabongui",
                        "Joel Moore"
                    ]
                },
                {
                    "localizedName": "Director",
                    "localizedValues": [
                        "Jason Bourque"
                    ]
                },
                {
                    "localizedName": "Format",
                    "localizedValues": [
                        "Blu-ray Disc"
                    ]
                }
            ],
            "ean": [
                "0814838014791"
            ],
            "upc": [
                "0814838014791"
            ],
            "productHref": "https://api.ebay.com/commerce/catalog/v1_beta/product/237137365",
            "title": "Drone (Blu-ray Disc, 2017)",
            "productWebUrl": "https://www.latest.ebay.com/p/Drone+%28Blu%2Dray+Disc%2C+2017%29/237137365?src=urllib"
        },
        {
            "epid": "210388958",
            "gtin": [
                "9780578128801"
            ],
            "image": {
                "imageUrl": "https://i.ebayimg.com/00/s/NTAwWDMxMw==/z/nx4AAOSwLGtZs-57/$_6.JPG?set_id=89040003C1"
            },
            "aspects": [
                {
                    "localizedName": "Publication Year",
                    "localizedValues": [
                        "2013"
                    ]
                },
                {
                    "localizedName": "Language",
                    "localizedValues": [
                        "English"
                    ]
                },
                {
                    "localizedName": "Format",
                    "localizedValues": [
                        "Hardcover"
                    ]
                }
            ],
            "ean": [
                "9780578128801"
            ],
            "isbn": [
                "9780578128801"
            ],
            "productHref": "https://api.ebay.com/commerce/catalog/v1_beta/product/210388958",
            "title": "Uav and Drone Entrepreneurship by Jerry Lemieux (2013, Hardcover)",
            "productWebUrl": "https://www.latest.ebay.com/p/Uav+and+Drone+Entrepreneurship+by+Jerry+Lemieux+%282013%2C+Hardcover%29/210388958?src=urllib"
        },
        {
            "epid": "219437621",
            "gtin": [
                "0630509346929"
            ],
            "brand": "Hasbro",
            "mpn": [
                "B3926"
            ],
            "image": {
                "imageUrl": "https://i.ebayimg.com/00/s/NDAwWDQwMA==/z/1c4AAOSws4JW8XvW/$_6.JPG?set_id=89040003C1"
            },
            "aspects": [
                {
                    "localizedName": "Brand",
                    "localizedValues": [
                        "Hasbro"
                    ]
                },
                {
                    "localizedName": "MPN",
                    "localizedValues": [
                        "B3926"
                    ]
                },
                {
                    "localizedName": "Character Family",
                    "localizedValues": [
                        "Star Wars"
                    ]
                },
                {
                    "localizedName": "Recommended Age Range",
                    "localizedValues": [
                        "4+"
                    ]
                },
                {
                    "localizedName": "Size",
                    "localizedValues": [
                        "7in."
                    ]
                },
                {
                    "localizedName": "Year",
                    "localizedValues": [
                        "2015"
                    ]
                },
                {
                    "localizedName": "Type",
                    "localizedValues": [
                        "Action Figure Collection"
                    ]
                }
            ],
            "ean": [
                "0630509346929"
            ],
            "upc": [
                "0630509346929"
            ],
            "productHref": "https://api.ebay.com/commerce/catalog/v1_beta/product/219437621",
            "title": "Hasbro The Force Awakens BB-8 Droid Action Figure",
            "productWebUrl": "https://www.latest.ebay.com/p/Hasbro+The+Force+Awakens+BB%2D8+Droid+Action+Figure/219437621?src=urllib"
        }
    ],
    "limit": 3
}
```

---


## Sample 2

### Response Sample

```json
{
    "productSummaries": [
        {
            "epid": "220023094",
            "gtin": [
                "0887276135649"
            ],
            "brand": "Samsung",
            "mpn": [
                "SM-G930VZDAVZW"
            ],
            "image": {
                "imageUrl": "https://i.ebayimg.com/00/s/NTAwWDMxMA==/z/9S4AAOSwUM5aCBzt/$_6.JPG?set_id=89040003C1"
            },
            "aspects": [
                {
                    "localizedName": "Brand",
                    "localizedValues": [
                        "Samsung"
                    ]
                },
                {
                    "localizedName": "MPN",
                    "localizedValues": [
                        "SMG930VZDAVZW"
                    ]
                },
                {
                    "localizedName": "Processor",
                    "localizedValues": [
                        "Quad Core"
                    ]
                },
                {
                    "localizedName": "Color",
                    "localizedValues": [
                        "Gold"
                    ]
                },
                {
                    "localizedName": "Network",
                    "localizedValues": [
                        "Verizon"
                    ]
                },
                {
                    "localizedName": "Storage Capacity",
                    "localizedValues": [
                        "32GB"
                    ]
                },
                {
                    "localizedName": "Screen Size",
                    "localizedValues": [
                        "5.1\""
                    ]
                },
                {
                    "localizedName": "Style",
                    "localizedValues": [
                        "Bar"
                    ]
                },
                {
                    "localizedName": "Camera Resolution",
                    "localizedValues": [
                        "12.0MP"
                    ]
                },
                {
                    "localizedName": "Model",
                    "localizedValues": [
                        "Samsung Galaxy S7"
                    ]
                },
                {
                    "localizedName": "Memory Card Type",
                    "localizedValues": [
                        "MicroSD"
                    ]
                },
                {
                    "localizedName": "Network Technology",
                    "localizedValues": [
                        "GSM"
                    ]
                }
            ],
            "ean": [
                "0887276135649"
            ],
            "upc": [
                "0887276135649"
            ],
            "productHref": "https://api.ebay.com/commerce/catalog/v1_beta/product/220023094",
            "title": "Samsung Galaxy S7 SM-G930 - 32GB - Gold Platinum (Verizon) Smartphone ",
            "productWebUrl": "https://www.latest.ebay.com/p/Samsung+Galaxy+S7+SM%2DG930+%2D+32GB+%2D+Gold+Platinum+%28Verizon%29+Smartphone/220023094?src=urllib"
        },
        {
            "epid": "220053197",
            "gtin": [
                "0887276155449"
            ],
            "brand": "Samsung",
            "mpn": [
                "SM-G930VZKAVZW"
            ],
            "image": {
                "imageUrl": "https://i.ebayimg.com/00/s/NjU2WDM4Mw==/z/bVQAAOSwAItZkv8X/$_6.JPG?set_id=89040003C1"
            },
            "aspects": [
                {
                    "localizedName": "Brand",
                    "localizedValues": [
                        "Samsung"
                    ]
                },
                {
                    "localizedName": "MPN",
                    "localizedValues": [
                        "SMG930VZKAVZW"
                    ]
                },
                {
                    "localizedName": "Processor",
                    "localizedValues": [
                        "Quad Core"
                    ]
                },
                {
                    "localizedName": "Color",
                    "localizedValues": [
                        "Black"
                    ]
                },
                {
                    "localizedName": "Network",
                    "localizedValues": [
                        "Verizon"
                    ]
                },
                {
                    "localizedName": "Storage Capacity",
                    "localizedValues": [
                        "32GB"
                    ]
                },
                {
                    "localizedName": "Screen Size",
                    "localizedValues": [
                        "5.1\""
                    ]
                },
                {
                    "localizedName": "Style",
                    "localizedValues": [
                        "Bar"
                    ]
                },
                {
                    "localizedName": "Camera Resolution",
                    "localizedValues": [
                        "12.0MP"
                    ]
                },
                {
                    "localizedName": "Lock Status",
                    "localizedValues": [
                        "Network Locked"
                    ]
                },
                {
                    "localizedName": "Model",
                    "localizedValues": [
                        "Samsung Galaxy S7"
                    ]
                },
                {
                    "localizedName": "Memory Card Type",
                    "localizedValues": [
                        "MicroSD"
                    ]
                },
                {
                    "localizedName": "Bundle Listing",
                    "localizedValues": [
                        "No"
                    ]
                },
                {
                    "localizedName": "Network Technology",
                    "localizedValues": [
                        "GSM"
                    ]
                }
            ],
            "ean": [
                "0887276155449"
            ],
            "upc": [
                "0887276155449"
            ],
            "productHref": "https://api.ebay.com/commerce/catalog/v1_beta/product/220053197",
            "title": "Samsung Galaxy S7 SM-G930 - 32GB - Black Onyx (Verizon) Smartphone",
            "productWebUrl": "https://www.latest.ebay.com/p/Samsung+Galaxy+S7+SM%2DG930+%2D+32GB+%2D+Black+Onyx+%28Verizon%29+Smartphone/220053197?src=urllib"
        },
        {
            "epid": "235346440",
            "gtin": [
                "0887276218830"
            ],
            "brand": "Samsung",
            "mpn": [
                "SM-G950UZKAXAA"
            ],
            "image": {
                "imageUrl": "https://i.ebayimg.com/00/s/OTI3WDQ4NA==/z/EWQAAOSwU8hY45KT/$_6.JPG?set_id=89040003C1"
            },
            "additionalImages": [
                {
                    "imageUrl": "https://i.ebayimg.com/00/s/MTYwMFg4MDA=/z/HngAAOSwuxFY0nWj/$_6.JPG?set_id=89040003C1"
                },
                {
                    "imageUrl": "https://i.ebayimg.com/00/s/MTYwMFg3NDc=/z/dM0AAOSwPbBZddSp/$_6.JPG?set_id=89040003C1"
                }
            ],
            "aspects": [
                {
                    "localizedName": "Brand",
                    "localizedValues": [
                        "Samsung"
                    ]
                },
                {
                    "localizedName": "MPN",
                    "localizedValues": [
                        "SMG950UZKAXAA"
                    ]
                },
                {
                    "localizedName": "Processor",
                    "localizedValues": [
                        "Octa Core"
                    ]
                },
                {
                    "localizedName": "Color",
                    "localizedValues": [
                        "Black"
                    ]
                },
                {
                    "localizedName": "Network",
                    "localizedValues": [
                        "Unlocked"
                    ]
                },
                {
                    "localizedName": "Storage Capacity",
                    "localizedValues": [
                        "64GB"
                    ]
                },
                {
                    "localizedName": "Screen Size",
                    "localizedValues": [
                        "5.8\""
                    ]
                },
                {
                    "localizedName": "Style",
                    "localizedValues": [
                        "Bar"
                    ]
                },
                {
                    "localizedName": "Camera Resolution",
                    "localizedValues": [
                        "12.0MP"
                    ]
                },
                {
                    "localizedName": "Lock Status",
                    "localizedValues": [
                        "Factory Unlocked"
                    ]
                },
                {
                    "localizedName": "Model",
                    "localizedValues": [
                        "Samsung Galaxy S8"
                    ]
                },
                {
                    "localizedName": "Memory Card Type",
                    "localizedValues": [
                        "MicroSD"
                    ]
                },
                {
                    "localizedName": "Bundle Listing",
                    "localizedValues": [
                        "No"
                    ]
                },
                {
                    "localizedName": "Network Technology",
                    "localizedValues": [
                        "LTE"
                    ]
                }
            ],
            "ean": [
                "0887276218830"
            ],
            "upc": [
                "0887276218830"
            ],
            "productHref": "https://api.ebay.com/commerce/catalog/v1_beta/product/235346440",
            "title": "Samsung Galaxy S8 SM-G950U - 64GB - Midnight Black (Unlocked) Smartphone",
            "productWebUrl": "https://www.latest.ebay.com/p/Samsung+Galaxy+S8+SM%2DG950U+%2D+64GB+%2D+Midnight+Black+%28Unlocked%29+Smartphone/235346440?src=urllib"
        }
    ],
    "limit": 3
}
```

---


## Sample 3

### Response Sample

```json
{
    "productSummaries": [
        {
            "epid": "225209639",
            "gtin": [
                "0190198071798",
                "0400055803586"
            ],
            "brand": "Apple",
            "mpn": [
                "MN9D2LL/A"
            ],
            "image": {
                "imageUrl": "https://i.ebayimg.com/00/s/NjgwWDU5Ng==/z/eRcAAOSwLF1X454V/$_6.JPG?set_id=89040003C1"
            },
            "additionalImages": [
                {
                    "imageUrl": "https://i.ebayimg.com/00/s/MTYwMFg4MDA=/z/l58AAOSw-YVXmbwB/$_6.JPG?set_id=89040003C1"
                }
            ],
            "aspects": [
                {
                    "localizedName": "Brand",
                    "localizedValues": [
                        "Apple"
                    ]
                },
                {
                    "localizedName": "MPN",
                    "localizedValues": [
                        "MN9D2LLA"
                    ]
                },
                {
                    "localizedName": "Processor",
                    "localizedValues": [
                        "Quad Core"
                    ]
                },
                {
                    "localizedName": "Color",
                    "localizedValues": [
                        "Black"
                    ]
                },
                {
                    "localizedName": "Network",
                    "localizedValues": [
                        "AT&T"
                    ]
                },
                {
                    "localizedName": "Storage Capacity",
                    "localizedValues": [
                        "32GB"
                    ]
                },
                {
                    "localizedName": "Screen Size",
                    "localizedValues": [
                        "4.7\""
                    ]
                },
                {
                    "localizedName": "Style",
                    "localizedValues": [
                        "Bar"
                    ]
                },
                {
                    "localizedName": "Camera Resolution",
                    "localizedValues": [
                        "12.0MP"
                    ]
                },
                {
                    "localizedName": "Model",
                    "localizedValues": [
                        "Apple iPhone 7"
                    ]
                },
                {
                    "localizedName": "Memory Card Type",
                    "localizedValues": [
                        "Built-In Memory"
                    ]
                },
                {
                    "localizedName": "Model Number",
                    "localizedValues": [
                        "A1778 (GSM Only)"
                    ]
                }
            ],
            "ean": [
                "0190198071798",
                "0400055803586"
            ],
            "upc": [
                "0190198071798",
                "0400055803586"
            ],
            "productHref": "https://api.ebay.com/commerce/catalog/v1_beta/product/225209639",
            "title": "Apple iPhone 7 - 32GB - Black (AT&T) A1778 (GSM)",
            "productWebUrl": "https://www.ebay.com/p/Apple-iPhone-7-32GB-Black-AT-T-A1778-GSM/225209639"
        },
        {
            "epid": "224725522",
            "gtin": [
                "0190198072214"
            ],
            "brand": "Apple",
            "mpn": [
                "MNAY2LL/A"
            ],
            "image": {
                "imageUrl": "https://i.ebayimg.com/00/s/NjgwWDU5Ng==/z/eRcAAOSwLF1X454V/$_6.JPG?set_id=89040003C1"
            },
            "additionalImages": [
                {
                    "imageUrl": "https://i.ebayimg.com/00/s/MTYwMFg4MDA=/z/l58AAOSw-YVXmbwB/$_6.JPG?set_id=89040003C1"
                }
            ],
            "aspects": [
                {
                    "localizedName": "Brand",
                    "localizedValues": [
                        "Apple"
                    ]
                },
                {
                    "localizedName": "MPN",
                    "localizedValues": [
                        "MNAY2LLA"
                    ]
                },
                {
                    "localizedName": "Processor",
                    "localizedValues": [
                        "Quad Core"
                    ]
                },
                {
                    "localizedName": "Color",
                    "localizedValues": [
                        "Black"
                    ]
                },
                {
                    "localizedName": "Network",
                    "localizedValues": [
                        "Sprint"
                    ]
                },
                {
                    "localizedName": "Storage Capacity",
                    "localizedValues": [
                        "32GB"
                    ]
                },
                {
                    "localizedName": "Screen Size",
                    "localizedValues": [
                        "4.7\""
                    ]
                },
                {
                    "localizedName": "Style",
                    "localizedValues": [
                        "Bar"
                    ]
                },
                {
                    "localizedName": "Camera Resolution",
                    "localizedValues": [
                        "12.0MP"
                    ]
                },
                {
                    "localizedName": "Model",
                    "localizedValues": [
                        "Apple iPhone 7"
                    ]
                },
                {
                    "localizedName": "Memory Card Type",
                    "localizedValues": [
                        "Built-In Memory"
                    ]
                },
                {
                    "localizedName": "Bundle Listing",
                    "localizedValues": [
                        "No"
                    ]
                },
                {
                    "localizedName": "Model Number",
                    "localizedValues": [
                        "A1660 (CDMA + GSM)"
                    ]
                }
            ],
            "ean": [
                "0190198072214"
            ],
            "upc": [
                "0190198072214"
            ],
            "productHref": "https://api.ebay.com/commerce/catalog/v1_beta/product/224725522",
            "title": "Apple iPhone 7 - 32GB - Black (Sprint) A1660 (CDMA + GSM)",
            "productWebUrl": "https://www.ebay.com/p/Apple-iPhone-7-32GB-Black-Sprint-A1660-CDMA-GSM/224725522"
        },
        {
            "epid": "225208146",
            "gtin": [
                "0190198071934"
            ],
            "brand": "Apple",
            "mpn": [
                "MN9U2LL/A"
            ],
            "image": {
                "imageUrl": "https://i.ebayimg.com/00/s/NjgwWDU5Ng==/z/eRcAAOSwLF1X454V/$_6.JPG?set_id=89040003C1"
            },
            "additionalImages": [
                {
                    "imageUrl": "https://i.ebayimg.com/00/s/MTYwMFg4MDA=/z/l58AAOSw-YVXmbwB/$_6.JPG?set_id=89040003C1"
                }
            ],
            "aspects": [
                {
                    "localizedName": "Brand",
                    "localizedValues": [
                        "Apple"
                    ]
                },
                {
                    "localizedName": "MPN",
                    "localizedValues": [
                        "MN9U2LLA"
                    ]
                },
                {
                    "localizedName": "Processor",
                    "localizedValues": [
                        "Quad Core"
                    ]
                },
                {
                    "localizedName": "Color",
                    "localizedValues": [
                        "Black"
                    ]
                },
                {
                    "localizedName": "Network",
                    "localizedValues": [
                        "T-Mobile"
                    ]
                },
                {
                    "localizedName": "Storage Capacity",
                    "localizedValues": [
                        "32GB"
                    ]
                },
                {
                    "localizedName": "Screen Size",
                    "localizedValues": [
                        "4.7\""
                    ]
                },
                {
                    "localizedName": "Style",
                    "localizedValues": [
                        "Bar"
                    ]
                },
                {
                    "localizedName": "Camera Resolution",
                    "localizedValues": [
                        "12.0MP"
                    ]
                },
                {
                    "localizedName": "Model",
                    "localizedValues": [
                        "Apple iPhone 7"
                    ]
                },
                {
                    "localizedName": "Memory Card Type",
                    "localizedValues": [
                        "Built-In Memory"
                    ]
                },
                {
                    "localizedName": "Model Number",
                    "localizedValues": [
                        "A1778 (GSM Only)"
                    ]
                }
            ],
            "ean": [
                "0190198071934"
            ],
            "upc": [
                "0190198071934"
            ],
            "productHref": "https://api.ebay.com/commerce/catalog/v1_beta/product/225208146",
            "title": "Apple iPhone 7 - 32GB - Black (T-Mobile) A1778 (GSM)",
            "productWebUrl": "https://www.ebay.com/p/Apple-iPhone-7-32GB-Black-T-Mobile-A1778-GSM/225208146"
        }
    ],
    "limit": 3
}
```

---


## Sample 4

### Response Sample

```json
{
    "productSummaries": [
        {
            "epid": "241111787",
            "gtin": [
                "0642892801039",
                "0813917020203"
            ],
            "brand": "Nest",
            "mpn": [
                "T3017US"
            ],
            "image": {
                "imageUrl": "https://i.ebayimg.com/00/s/MTUwMFgxNTAw/z/sLoAAOSw5KtaaHY5/$_6.JPG?set_id=89040003C1"
            },
            "aspects": [
                {
                    "localizedName": "Brand",
                    "localizedValues": [
                        "Nest"
                    ]
                },
                {
                    "localizedName": "Model",
                    "localizedValues": [
                        "Nest Learning Thermostat (3rd Generation)"
                    ]
                },
                {
                    "localizedName": "MPN",
                    "localizedValues": [
                        "T3017US"
                    ]
                },
                {
                    "localizedName": "User Interface",
                    "localizedValues": [
                        "Digital"
                    ]
                },
                {
                    "localizedName": "Connected Home Compatibility",
                    "localizedValues": [
                        "Nest"
                    ]
                },
                {
                    "localizedName": "Connected Home Protocol",
                    "localizedValues": [
                        "Wi-Fi"
                    ]
                },
                {
                    "localizedName": "Color",
                    "localizedValues": [
                        "White"
                    ]
                }
            ],
            "ean": [
                "0642892801039",
                "0813917020203"
            ],
            "upc": [
                "0642892801039",
                "0813917020203"
            ],
            "productHref": "https://api.ebay.com/commerce/catalog/v1_beta/product/241111787",
            "title": "Nest 3rd Generation Learning White Programmable Thermostat"
        },
        {
            "epid": "241104405",
            "gtin": [
                "0813917020203"
            ],
            "brand": "Nest",
            "mpn": [
                "T3017US_2PK"
            ],
            "image": {
                "imageUrl": "https://i.ebayimg.com/00/s/MjU5WDUwMA==/z/aFUAAOSwIVhaLp6e/$_6.JPG?set_id=89040003C1"
            },
            "aspects": [
                {
                    "localizedName": "Brand",
                    "localizedValues": [
                        "Nest"
                    ]
                },
                {
                    "localizedName": "Model",
                    "localizedValues": [
                        "Nest Learning Thermostat (3rd Generation)"
                    ]
                },
                {
                    "localizedName": "MPN",
                    "localizedValues": [
                        "T3017US2PK"
                    ]
                },
                {
                    "localizedName": "User Interface",
                    "localizedValues": [
                        "Digital"
                    ]
                },
                {
                    "localizedName": "Connected Home Compatibility",
                    "localizedValues": [
                        "Nest"
                    ]
                },
                {
                    "localizedName": "Connected Home Protocol",
                    "localizedValues": [
                        "Wi-Fi"
                    ]
                },
                {
                    "localizedName": "Color",
                    "localizedValues": [
                        "White"
                    ]
                }
            ],
            "ean": [
                "0813917020203"
            ],
            "upc": [
                "0813917020203"
            ],
            "productHref": "https://api.ebay.com/commerce/catalog/v1_beta/product/241104405",
            "title": "Nest 3rd Generation Learning White Programmable Thermostat 2 Pack"
        }
    ],
    "limit": 50
}
```

---


## Sample 5

### Response Sample

```json
{
    "productSummaries": [
        {
            "epid": "241986095",
            "gtin": [
                "0829610001272"
            ],
            "brand": "Roku",
            "mpn": [
                "3710RW"
            ],
            "image": {
                "imageUrl": "https://i.ebayimg.com/00/s/MjgwWDcyNw==/z/Mr4AAOSw3EVaaHZV/$_6.JPG?set_id=89040003C1"
            },
            "aspects": [
                {
                    "localizedName": "Brand",
                    "localizedValues": [
                        "Roku"
                    ]
                },
                {
                    "localizedName": "Model",
                    "localizedValues": [
                        "Roku Express+ 3710"
                    ]
                },
                {
                    "localizedName": "MPN",
                    "localizedValues": [
                        "3710RW"
                    ]
                },
                {
                    "localizedName": "Media Streaming",
                    "localizedValues": [
                        "Home Network Media"
                    ]
                },
                {
                    "localizedName": "Features",
                    "localizedValues": [
                        "Picture Viewing"
                    ]
                },
                {
                    "localizedName": "Max. Resolution",
                    "localizedValues": [
                        "1080p"
                    ]
                },
                {
                    "localizedName": "Media Input Connectivity",
                    "localizedValues": [
                        "HDMI",
                        "USB",
                        "Wi-Fi"
                    ]
                },
                {
                    "localizedName": "Audio/Video Outputs",
                    "localizedValues": [
                        "Composite Video RCA",
                        "HDMI"
                    ]
                },
                {
                    "localizedName": "Color",
                    "localizedValues": [
                        "Black"
                    ]
                }
            ],
            "ean": [
                "0829610001272"
            ],
            "upc": [
                "0829610001272"
            ],
            "productHref": "https://api.ebay.com/commerce/catalog/v1_beta/product/241986095",
            "title": "Roku Express+ (5th Generation) media streamer (3710RW)"
        }
    ],
    "limit": 50
}
```

---


## Sample 6

### Response Sample

```json
{
    "refinement": {
        "aspectDistributions": [
            {
                "localizedAspectName": "Features",
                "aspectValueDistributions": [
                    {
                        "localizedAspectValue": "3G Data Capable",
                        "matchCount": 17586,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CFeatures%3A%7B3G+Data+Capable%7D"
                    },
                    {
                        "localizedAspectValue": "4G Data Capable",
                        "matchCount": 17412,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CFeatures%3A%7B4G+Data+Capable%7D"
                    },
                    {
                        "localizedAspectValue": "Bluetooth Enabled",
                        "matchCount": 17206,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CFeatures%3A%7BBluetooth+Enabled%7D"
                    },
                    {
                        "localizedAspectValue": "Fingerprint Sensor",
                        "matchCount": 12357,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CFeatures%3A%7BFingerprint+Sensor%7D"
                    },
                    {
                        "localizedAspectValue": "GPS",
                        "matchCount": 11085,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CFeatures%3A%7BGPS%7D"
                    },
                    {
                        "localizedAspectValue": "Internet Browser",
                        "matchCount": 9934,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CFeatures%3A%7BInternet+Browser%7D"
                    },
                    {
                        "localizedAspectValue": "Touchscreen",
                        "matchCount": 10326,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CFeatures%3A%7BTouchscreen%7D"
                    },
                    {
                        "localizedAspectValue": "Wi-Fi Capable",
                        "matchCount": 10104,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CFeatures%3A%7BWi-Fi+Capable%7D"
                    },
                    {
                        "localizedAspectValue": "4K Video Recording",
                        "matchCount": 5357,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CFeatures%3A%7B4K+Video+Recording%7D"
                    },
                    {
                        "localizedAspectValue": "Accelerometer",
                        "matchCount": 6384,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CFeatures%3A%7BAccelerometer%7D"
                    },
                    {
                        "localizedAspectValue": "Air Gesture",
                        "matchCount": 1339,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CFeatures%3A%7BAir+Gesture%7D"
                    },
                    {
                        "localizedAspectValue": "ANT+",
                        "matchCount": 170,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CFeatures%3A%7BANT%2B%7D"
                    },
                    {
                        "localizedAspectValue": "Dual Rear Cameras",
                        "matchCount": 558,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CFeatures%3A%7BDual+Rear+Cameras%7D"
                    },
                    {
                        "localizedAspectValue": "Dual SIM",
                        "matchCount": 430,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CFeatures%3A%7BDual+SIM%7D"
                    },
                    {
                        "localizedAspectValue": "Front Camera",
                        "matchCount": 1485,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CFeatures%3A%7BFront+Camera%7D"
                    },
                    {
                        "localizedAspectValue": "Geotagging",
                        "matchCount": 656,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CFeatures%3A%7BGeotagging%7D"
                    },
                    {
                        "localizedAspectValue": "Global Ready",
                        "matchCount": 5708,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CFeatures%3A%7BGlobal+Ready%7D"
                    },
                    {
                        "localizedAspectValue": "High Capacity Battery (5000 mAh or More)",
                        "matchCount": 110,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CFeatures%3A%7BHigh+Capacity+Battery+%285000+mAh+or+More%29%7D"
                    },
                    {
                        "localizedAspectValue": "Iris Scanning",
                        "matchCount": 52,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CFeatures%3A%7BIris+Scanning%7D"
                    },
                    {
                        "localizedAspectValue": "Music Player",
                        "matchCount": 8476,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CFeatures%3A%7BMusic+Player%7D"
                    },
                    {
                        "localizedAspectValue": "Near Field Communication",
                        "matchCount": 3222,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CFeatures%3A%7BNear+Field+Communication%7D"
                    },
                    {
                        "localizedAspectValue": "Proximity Sensor",
                        "matchCount": 367,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CFeatures%3A%7BProximity+Sensor%7D"
                    },
                    {
                        "localizedAspectValue": "Push to Talk",
                        "matchCount": 639,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CFeatures%3A%7BPush+to+Talk%7D"
                    },
                    {
                        "localizedAspectValue": "QWERTY Keyboard",
                        "matchCount": 1066,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CFeatures%3A%7BQWERTY+Keyboard%7D"
                    },
                    {
                        "localizedAspectValue": "Rear Camera",
                        "matchCount": 1172,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CFeatures%3A%7BRear+Camera%7D"
                    },
                    {
                        "localizedAspectValue": "Rugged",
                        "matchCount": 26,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CFeatures%3A%7BRugged%7D"
                    },
                    {
                        "localizedAspectValue": "Speakerphone",
                        "matchCount": 9858,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CFeatures%3A%7BSpeakerphone%7D"
                    },
                    {
                        "localizedAspectValue": "TTY Compatible",
                        "matchCount": 2741,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CFeatures%3A%7BTTY+Compatible%7D"
                    },
                    {
                        "localizedAspectValue": "Voice-Activated Dialing",
                        "matchCount": 4985,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CFeatures%3A%7BVoice-Activated+Dialing%7D"
                    },
                    {
                        "localizedAspectValue": "Water-Resistant",
                        "matchCount": 525,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CFeatures%3A%7BWater-Resistant%7D"
                    },
                    {
                        "localizedAspectValue": "Wireless Charging",
                        "matchCount": 355,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CFeatures%3A%7BWireless+Charging%7D"
                    }
                ]
            },
            {
                "localizedAspectName": "Network",
                "aspectValueDistributions": [
                    {
                        "localizedAspectValue": "AT&T",
                        "matchCount": 14763,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CNetwork%3A%7BAT%26T%7D"
                    },
                    {
                        "localizedAspectValue": "Sprint",
                        "matchCount": 6862,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CNetwork%3A%7BSprint%7D"
                    },
                    {
                        "localizedAspectValue": "T-Mobile",
                        "matchCount": 5021,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CNetwork%3A%7BT-Mobile%7D"
                    },
                    {
                        "localizedAspectValue": "Verizon",
                        "matchCount": 10122,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CNetwork%3A%7BVerizon%7D"
                    },
                    {
                        "localizedAspectValue": "Unlocked",
                        "matchCount": 23959,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CNetwork%3A%7BUnlocked%7D"
                    },
                    {
                        "localizedAspectValue": "Bell Mobility",
                        "matchCount": 73,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CNetwork%3A%7BBell+Mobility%7D"
                    },
                    {
                        "localizedAspectValue": "Boost Mobile",
                        "matchCount": 581,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CNetwork%3A%7BBoost+Mobile%7D"
                    },
                    {
                        "localizedAspectValue": "Cricket",
                        "matchCount": 379,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CNetwork%3A%7BCricket%7D"
                    },
                    {
                        "localizedAspectValue": "Fido",
                        "matchCount": 24,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CNetwork%3A%7BFido%7D"
                    },
                    {
                        "localizedAspectValue": "MetroPCS",
                        "matchCount": 198,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CNetwork%3A%7BMetroPCS%7D"
                    },
                    {
                        "localizedAspectValue": "Rogers Wireless",
                        "matchCount": 74,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CNetwork%3A%7BRogers+Wireless%7D"
                    },
                    {
                        "localizedAspectValue": "SaskTel",
                        "matchCount": 41,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CNetwork%3A%7BSaskTel%7D"
                    },
                    {
                        "localizedAspectValue": "Straight Talk",
                        "matchCount": 751,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CNetwork%3A%7BStraight+Talk%7D"
                    },
                    {
                        "localizedAspectValue": "Telus",
                        "matchCount": 103,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CNetwork%3A%7BTelus%7D"
                    },
                    {
                        "localizedAspectValue": "TracFone",
                        "matchCount": 390,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CNetwork%3A%7BTracFone%7D"
                    },
                    {
                        "localizedAspectValue": "U.S. Cellular",
                        "matchCount": 247,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CNetwork%3A%7BU.S.+Cellular%7D"
                    },
                    {
                        "localizedAspectValue": "Videotron",
                        "matchCount": 25,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CNetwork%3A%7BVideotron%7D"
                    },
                    {
                        "localizedAspectValue": "Virgin Mobile",
                        "matchCount": 162,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CNetwork%3A%7BVirgin+Mobile%7D"
                    },
                    {
                        "localizedAspectValue": "Not Specified",
                        "matchCount": 22,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CNetwork%3A%7BNot+Specified%7D"
                    }
                ]
            },
            {
                "localizedAspectName": "Model",
                "aspectValueDistributions": [
                    {
                        "localizedAspectValue": "iPhone 6s",
                        "matchCount": 9211,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel%3A%7BiPhone+6s%7D"
                    },
                    {
                        "localizedAspectValue": "iPhone 6",
                        "matchCount": 11677,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel%3A%7BiPhone+6%7D"
                    },
                    {
                        "localizedAspectValue": "iPhone 7",
                        "matchCount": 5678,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel%3A%7BiPhone+7%7D"
                    },
                    {
                        "localizedAspectValue": "iPhone 7 Plus",
                        "matchCount": 4216,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel%3A%7BiPhone+7+Plus%7D"
                    },
                    {
                        "localizedAspectValue": "iPhone 6s Plus",
                        "matchCount": 5022,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel%3A%7BiPhone+6s+Plus%7D"
                    },
                    {
                        "localizedAspectValue": "iPhone SE",
                        "matchCount": 3260,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel%3A%7BiPhone+SE%7D"
                    },
                    {
                        "localizedAspectValue": "iPhone X",
                        "matchCount": 1070,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel%3A%7BiPhone+X%7D"
                    },
                    {
                        "localizedAspectValue": "iPhone 6 Plus",
                        "matchCount": 6532,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel%3A%7BiPhone+6+Plus%7D"
                    },
                    {
                        "localizedAspectValue": "iPhone 8 Plus",
                        "matchCount": 813,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel%3A%7BiPhone+8+Plus%7D"
                    },
                    {
                        "localizedAspectValue": "iPhone 5s",
                        "matchCount": 5547,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel%3A%7BiPhone+5s%7D"
                    },
                    {
                        "localizedAspectValue": "iPhone 5c",
                        "matchCount": 2858,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel%3A%7BiPhone+5c%7D"
                    },
                    {
                        "localizedAspectValue": "iPhone 4s",
                        "matchCount": 2285,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel%3A%7BiPhone+4s%7D"
                    },
                    {
                        "localizedAspectValue": "iPhone 5",
                        "matchCount": 2205,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel%3A%7BiPhone+5%7D"
                    },
                    {
                        "localizedAspectValue": "iPhone 4",
                        "matchCount": 2060,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel%3A%7BiPhone+4%7D"
                    },
                    {
                        "localizedAspectValue": "iPhone 8",
                        "matchCount": 613,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel%3A%7BiPhone+8%7D"
                    },
                    {
                        "localizedAspectValue": "iPhone 3GS",
                        "matchCount": 488,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel%3A%7BiPhone+3GS%7D"
                    },
                    {
                        "localizedAspectValue": "iPhone 3G",
                        "matchCount": 264,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel%3A%7BiPhone+3G%7D"
                    },
                    {
                        "localizedAspectValue": "iPhone 1st Generation",
                        "matchCount": 168,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel%3A%7BiPhone+1st+Generation%7D"
                    },
                    {
                        "localizedAspectValue": "HTC One",
                        "matchCount": 1,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel%3A%7BHTC+One%7D"
                    },
                    {
                        "localizedAspectValue": "Samsung Galaxy S5",
                        "matchCount": 1,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel%3A%7BSamsung+Galaxy+S5%7D"
                    },
                    {
                        "localizedAspectValue": "Sony Ericsson Xperia X10 mini",
                        "matchCount": 1,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel%3A%7BSony+Ericsson+Xperia+X10+mini%7D"
                    },
                    {
                        "localizedAspectValue": "Not Specified",
                        "matchCount": 11,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel%3A%7BNot+Specified%7D"
                    }
                ]
            },
            {
                "localizedAspectName": "Storage Capacity",
                "aspectValueDistributions": [
                    {
                        "localizedAspectValue": "256GB",
                        "matchCount": 2879,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CStorage+Capacity%3A%7B256GB%7D"
                    },
                    {
                        "localizedAspectValue": "128GB",
                        "matchCount": 9387,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CStorage+Capacity%3A%7B128GB%7D"
                    },
                    {
                        "localizedAspectValue": "64GB",
                        "matchCount": 14766,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CStorage+Capacity%3A%7B64GB%7D"
                    },
                    {
                        "localizedAspectValue": "32GB",
                        "matchCount": 8868,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CStorage+Capacity%3A%7B32GB%7D"
                    },
                    {
                        "localizedAspectValue": "16GB",
                        "matchCount": 24938,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CStorage+Capacity%3A%7B16GB%7D"
                    },
                    {
                        "localizedAspectValue": "8GB",
                        "matchCount": 3113,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CStorage+Capacity%3A%7B8GB%7D"
                    },
                    {
                        "localizedAspectValue": "4GB",
                        "matchCount": 17,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CStorage+Capacity%3A%7B4GB%7D"
                    },
                    {
                        "localizedAspectValue": "1GB",
                        "matchCount": 1,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CStorage+Capacity%3A%7B1GB%7D"
                    },
                    {
                        "localizedAspectValue": "512MB",
                        "matchCount": 1,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CStorage+Capacity%3A%7B512MB%7D"
                    },
                    {
                        "localizedAspectValue": "128MB",
                        "matchCount": 2,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CStorage+Capacity%3A%7B128MB%7D"
                    },
                    {
                        "localizedAspectValue": "Not Specified",
                        "matchCount": 9,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CStorage+Capacity%3A%7BNot+Specified%7D"
                    }
                ]
            },
            {
                "localizedAspectName": "Color",
                "aspectValueDistributions": [
                    {
                        "localizedAspectValue": "Black",
                        "matchCount": 10434,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CColor%3A%7BBlack%7D"
                    },
                    {
                        "localizedAspectValue": "Gold",
                        "matchCount": 12103,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CColor%3A%7BGold%7D"
                    },
                    {
                        "localizedAspectValue": "Gray",
                        "matchCount": 17350,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CColor%3A%7BGray%7D"
                    },
                    {
                        "localizedAspectValue": "Red",
                        "matchCount": 441,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CColor%3A%7BRed%7D"
                    },
                    {
                        "localizedAspectValue": "Rose Gold",
                        "matchCount": 6495,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CColor%3A%7BRose+Gold%7D"
                    },
                    {
                        "localizedAspectValue": "Silver",
                        "matchCount": 11851,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CColor%3A%7BSilver%7D"
                    },
                    {
                        "localizedAspectValue": "White",
                        "matchCount": 3438,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CColor%3A%7BWhite%7D"
                    },
                    {
                        "localizedAspectValue": "Blue",
                        "matchCount": 689,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CColor%3A%7BBlue%7D"
                    },
                    {
                        "localizedAspectValue": "Green",
                        "matchCount": 387,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CColor%3A%7BGreen%7D"
                    },
                    {
                        "localizedAspectValue": "Pink",
                        "matchCount": 490,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CColor%3A%7BPink%7D"
                    },
                    {
                        "localizedAspectValue": "Yellow",
                        "matchCount": 296,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CColor%3A%7BYellow%7D"
                    },
                    {
                        "localizedAspectValue": "Not Specified",
                        "matchCount": 7,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CColor%3A%7BNot+Specified%7D"
                    }
                ]
            },
            {
                "localizedAspectName": "Model Number",
                "aspectValueDistributions": [
                    {
                        "localizedAspectValue": "A1522 (GSM Only)",
                        "matchCount": 2756,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BA1522+%28GSM+Only%29%7D"
                    },
                    {
                        "localizedAspectValue": "A1533 (GSM Only)",
                        "matchCount": 3334,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BA1533+%28GSM+Only%29%7D"
                    },
                    {
                        "localizedAspectValue": "A1549 (GSM Only)",
                        "matchCount": 4771,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BA1549+%28GSM+Only%29%7D"
                    },
                    {
                        "localizedAspectValue": "A1586 (CDMA + GSM)",
                        "matchCount": 4196,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BA1586+%28CDMA+%2B+GSM%29%7D"
                    },
                    {
                        "localizedAspectValue": "A1633 (CDMA + GSM)",
                        "matchCount": 4520,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BA1633+%28CDMA+%2B+GSM%29%7D"
                    },
                    {
                        "localizedAspectValue": "A1687 (CDMA + GSM)",
                        "matchCount": 2885,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BA1687+%28CDMA+%2B+GSM%29%7D"
                    },
                    {
                        "localizedAspectValue": "A1688 (CDMA + GSM)",
                        "matchCount": 4693,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BA1688+%28CDMA+%2B+GSM%29%7D"
                    },
                    {
                        "localizedAspectValue": "A1778 (GSM Only)",
                        "matchCount": 3167,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BA1778+%28GSM+Only%29%7D"
                    },
                    {
                        "localizedAspectValue": "A1203 (GSM Only)",
                        "matchCount": 168,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BA1203+%28GSM+Only%29%7D"
                    },
                    {
                        "localizedAspectValue": "A1241 (GSM Only)",
                        "matchCount": 264,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BA1241+%28GSM+Only%29%7D"
                    },
                    {
                        "localizedAspectValue": "A1303 (GSM Only)",
                        "matchCount": 492,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BA1303+%28GSM+Only%29%7D"
                    },
                    {
                        "localizedAspectValue": "A1332 (GSM Only)",
                        "matchCount": 729,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BA1332+%28GSM+Only%29%7D"
                    },
                    {
                        "localizedAspectValue": "A1349 (CDMA Only)",
                        "matchCount": 1326,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BA1349+%28CDMA+Only%29%7D"
                    },
                    {
                        "localizedAspectValue": "A1387 (CDMA + GSM)",
                        "matchCount": 2280,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BA1387+%28CDMA+%2B+GSM%29%7D"
                    },
                    {
                        "localizedAspectValue": "A1428 (GSM Only)",
                        "matchCount": 1430,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BA1428+%28GSM+Only%29%7D"
                    },
                    {
                        "localizedAspectValue": "A1429 (CDMA + GSM)",
                        "matchCount": 773,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BA1429+%28CDMA+%2B+GSM%29%7D"
                    },
                    {
                        "localizedAspectValue": "A1429 (GSM Only)",
                        "matchCount": 3,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BA1429+%28GSM+Only%29%7D"
                    },
                    {
                        "localizedAspectValue": "A1453 (CDMA + GSM)",
                        "matchCount": 668,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BA1453+%28CDMA+%2B+GSM%29%7D"
                    },
                    {
                        "localizedAspectValue": "A1456 (CDMA + GSM)",
                        "matchCount": 607,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BA1456+%28CDMA+%2B+GSM%29%7D"
                    },
                    {
                        "localizedAspectValue": "A1457 (GSM Only)",
                        "matchCount": 17,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BA1457+%28GSM+Only%29%7D"
                    },
                    {
                        "localizedAspectValue": "A1507 (GSM Only)",
                        "matchCount": 3,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BA1507+%28GSM+Only%29%7D"
                    },
                    {
                        "localizedAspectValue": "A1522 (CDMA + GSM)",
                        "matchCount": 1106,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BA1522+%28CDMA+%2B+GSM%29%7D"
                    },
                    {
                        "localizedAspectValue": "A1524 (CDMA + GSM)",
                        "matchCount": 2667,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BA1524+%28CDMA+%2B+GSM%29%7D"
                    },
                    {
                        "localizedAspectValue": "A1532 (CDMA + GSM)",
                        "matchCount": 793,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BA1532+%28CDMA+%2B+GSM%29%7D"
                    },
                    {
                        "localizedAspectValue": "A1532 (GSM Only)",
                        "matchCount": 1455,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BA1532+%28GSM+Only%29%7D"
                    },
                    {
                        "localizedAspectValue": "A1533 (CDMA + GSM)",
                        "matchCount": 1317,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BA1533+%28CDMA+%2B+GSM%29%7D"
                    },
                    {
                        "localizedAspectValue": "A1549 (CDMA + GSM)",
                        "matchCount": 2588,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BA1549+%28CDMA+%2B+GSM%29%7D"
                    },
                    {
                        "localizedAspectValue": "A1634 (CDMA + GSM)",
                        "matchCount": 2137,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BA1634+%28CDMA+%2B+GSM%29%7D"
                    },
                    {
                        "localizedAspectValue": "A1660 (CDMA + GSM)",
                        "matchCount": 2511,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BA1660+%28CDMA+%2B+GSM%29%7D"
                    },
                    {
                        "localizedAspectValue": "A1661 (CDMA + GSM)",
                        "matchCount": 2068,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BA1661+%28CDMA+%2B+GSM%29%7D"
                    },
                    {
                        "localizedAspectValue": "A1662 (CDMA + GSM)",
                        "matchCount": 2565,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BA1662+%28CDMA+%2B+GSM%29%7D"
                    },
                    {
                        "localizedAspectValue": "A1723 (CDMA + GSM)",
                        "matchCount": 693,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BA1723+%28CDMA+%2B+GSM%29%7D"
                    },
                    {
                        "localizedAspectValue": "A1784 (GSM Only)",
                        "matchCount": 2150,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BA1784+%28GSM+Only%29%7D"
                    },
                    {
                        "localizedAspectValue": "A1863 (CDMA + GSM)",
                        "matchCount": 234,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BA1863+%28CDMA+%2B+GSM%29%7D"
                    },
                    {
                        "localizedAspectValue": "A1864 (CDMA + GSM)",
                        "matchCount": 343,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BA1864+%28CDMA+%2B+GSM%29%7D"
                    },
                    {
                        "localizedAspectValue": "A1865 (CDMA + GSM)",
                        "matchCount": 441,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BA1865+%28CDMA+%2B+GSM%29%7D"
                    },
                    {
                        "localizedAspectValue": "A1897 (GSM Only)",
                        "matchCount": 470,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BA1897+%28GSM+Only%29%7D"
                    },
                    {
                        "localizedAspectValue": "A1901 (GSM Only)",
                        "matchCount": 629,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BA1901+%28GSM+Only%29%7D"
                    },
                    {
                        "localizedAspectValue": "A1905 (GSM Only)",
                        "matchCount": 379,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BA1905+%28GSM+Only%29%7D"
                    },
                    {
                        "localizedAspectValue": "Not Specified",
                        "matchCount": 353,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CModel+Number%3A%7BNot+Specified%7D"
                    }
                ]
            },
            {
                "localizedAspectName": "Processor",
                "aspectValueDistributions": [
                    {
                        "localizedAspectValue": "Single Core",
                        "matchCount": 2935,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CProcessor%3A%7BSingle+Core%7D"
                    },
                    {
                        "localizedAspectValue": "Dual Core",
                        "matchCount": 48576,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CProcessor%3A%7BDual+Core%7D"
                    },
                    {
                        "localizedAspectValue": "Quad Core",
                        "matchCount": 9874,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CProcessor%3A%7BQuad+Core%7D"
                    },
                    {
                        "localizedAspectValue": "Hexa Core",
                        "matchCount": 2494,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CProcessor%3A%7BHexa+Core%7D"
                    },
                    {
                        "localizedAspectValue": "Quad+Quad Core",
                        "matchCount": 1,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CProcessor%3A%7BQuad%2BQuad+Core%7D"
                    },
                    {
                        "localizedAspectValue": "Octa Core",
                        "matchCount": 1,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CProcessor%3A%7BOcta+Core%7D"
                    },
                    {
                        "localizedAspectValue": "Not Specified",
                        "matchCount": 100,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CProcessor%3A%7BNot+Specified%7D"
                    }
                ]
            },
            {
                "localizedAspectName": "Bundle Listing",
                "aspectValueDistributions": [
                    {
                        "localizedAspectValue": "No",
                        "matchCount": 30698,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CBundle+Listing%3A%7BNo%7D"
                    },
                    {
                        "localizedAspectValue": "Yes",
                        "matchCount": 4516,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CBundle+Listing%3A%7BYes%7D"
                    },
                    {
                        "localizedAspectValue": "Not Specified",
                        "matchCount": 28767,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CBundle+Listing%3A%7BNot+Specified%7D"
                    }
                ]
            },
            {
                "localizedAspectName": "Camera Resolution",
                "aspectValueDistributions": [
                    {
                        "localizedAspectValue": "8.0 - 11.9MP",
                        "matchCount": 99,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CCamera+Resolution%3A%7B8.0+-+11.9MP%7D"
                    },
                    {
                        "localizedAspectValue": "12.0 - 15.9MP",
                        "matchCount": 59,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CCamera+Resolution%3A%7B12.0+-+15.9MP%7D"
                    },
                    {
                        "localizedAspectValue": "2.0 - 4.9MP",
                        "matchCount": 15,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CCamera+Resolution%3A%7B2.0+-+4.9MP%7D"
                    },
                    {
                        "localizedAspectValue": "5.0 - 7.9MP",
                        "matchCount": 16,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CCamera+Resolution%3A%7B5.0+-+7.9MP%7D"
                    },
                    {
                        "localizedAspectValue": "Not Specified",
                        "matchCount": 40,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CCamera+Resolution%3A%7BNot+Specified%7D"
                    }
                ]
            },
            {
                "localizedAspectName": "Brand",
                "aspectValueDistributions": [
                    {
                        "localizedAspectValue": "BlackBerry",
                        "matchCount": 1,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CBrand%3A%7BBlackBerry%7D"
                    },
                    {
                        "localizedAspectValue": "Apple",
                        "matchCount": 63975,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CBrand%3A%7BApple%7D"
                    },
                    {
                        "localizedAspectValue": "Casio",
                        "matchCount": 1,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CBrand%3A%7BCasio%7D"
                    },
                    {
                        "localizedAspectValue": "HTC",
                        "matchCount": 1,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CBrand%3A%7BHTC%7D"
                    },
                    {
                        "localizedAspectValue": "LG",
                        "matchCount": 1,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CBrand%3A%7BLG%7D"
                    },
                    {
                        "localizedAspectValue": "Samsung",
                        "matchCount": 1,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CBrand%3A%7BSamsung%7D"
                    },
                    {
                        "localizedAspectValue": "Sony Ericsson",
                        "matchCount": 1,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CBrand%3A%7BSony+Ericsson%7D"
                    }
                ]
            },
            {
                "localizedAspectName": "Operating System",
                "aspectValueDistributions": [
                    {
                        "localizedAspectValue": "Android",
                        "matchCount": 108,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2COperating+System%3A%7BAndroid%7D"
                    },
                    {
                        "localizedAspectValue": "iOS",
                        "matchCount": 63402,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2COperating+System%3A%7BiOS%7D"
                    },
                    {
                        "localizedAspectValue": "Aliyun OS",
                        "matchCount": 1,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2COperating+System%3A%7BAliyun+OS%7D"
                    },
                    {
                        "localizedAspectValue": "Fire OS",
                        "matchCount": 1,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2COperating+System%3A%7BFire+OS%7D"
                    },
                    {
                        "localizedAspectValue": "Windows Phone 7",
                        "matchCount": 3,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2COperating+System%3A%7BWindows+Phone+7%7D"
                    },
                    {
                        "localizedAspectValue": "Not Specified",
                        "matchCount": 466,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2COperating+System%3A%7BNot+Specified%7D"
                    }
                ]
            },
            {
                "localizedAspectName": "Style",
                "aspectValueDistributions": [
                    {
                        "localizedAspectValue": "Bar",
                        "matchCount": 63927,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CStyle%3A%7BBar%7D"
                    },
                    {
                        "localizedAspectValue": "Not Specified",
                        "matchCount": 26,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CStyle%3A%7BNot+Specified%7D"
                    }
                ]
            },
            {
                "localizedAspectName": "Contract",
                "aspectValueDistributions": [
                    {
                        "localizedAspectValue": "Prepaid",
                        "matchCount": 509,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CContract%3A%7BPrepaid%7D"
                    },
                    {
                        "localizedAspectValue": "Without Contract",
                        "matchCount": 27486,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CContract%3A%7BWithout+Contract%7D"
                    },
                    {
                        "localizedAspectValue": "With Contract",
                        "matchCount": 213,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CContract%3A%7BWith+Contract%7D"
                    },
                    {
                        "localizedAspectValue": "Not Specified",
                        "matchCount": 35773,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CContract%3A%7BNot+Specified%7D"
                    }
                ]
            },
            {
                "localizedAspectName": "Screen Size",
                "aspectValueDistributions": [
                    {
                        "localizedAspectValue": "3.9\" & Under",
                        "matchCount": 58,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CScreen+Size%3A%7B3.9%22+%26+Under%7D"
                    },
                    {
                        "localizedAspectValue": "4.5-4.9\"",
                        "matchCount": 56,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CScreen+Size%3A%7B4.5-4.9%22%7D"
                    },
                    {
                        "localizedAspectValue": "4.0-4.4\"",
                        "matchCount": 55,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CScreen+Size%3A%7B4.0-4.4%22%7D"
                    },
                    {
                        "localizedAspectValue": "5.5-5.9\"",
                        "matchCount": 27,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CScreen+Size%3A%7B5.5-5.9%22%7D"
                    },
                    {
                        "localizedAspectValue": "Not Specified",
                        "matchCount": 37,
                        "refinementHref": "https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?q=iphone&fieldgroups=ASPECT_REFINEMENTS&aspect_filter=categoryId%3A9355%2CScreen+Size%3A%7BNot+Specified%7D"
                    }
                ]
            }
        ],
        "dominantCategoryId": "9355"
    }
}
```

---

