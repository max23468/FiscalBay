# GET : getItemConditionPolicies Samples
- [Sample 1: Get the eBay category policies regarding item conditions](#sample-1-get-the-ebay-category-policies-regarding-item-conditions)
- [Sample 2: Get the eBay category policies regarding item conditions with condition descriptors](#sample-2-get-the-ebay-category-policies-regarding-item-conditions-with-condition-descriptors)

---

## Sample 1: Get the eBay category policies regarding item conditions

This example retrieves the policies for two specific categories, 90638 and 181923.

This method returns a list of leaf categories from the category tree of the specified marketplace. Each node in the response shows the policies that govern how to list item condition in each of the returned categories.

### Input

This method does not use a request payload.

By default, this method returns the leaf nodes of the entire category tree for the specified marketplace. When you retrieve the entire tree, be sure to get the result as a GZIP file (see the top of the call page for syntax). To limit the response, specify up to 50 category IDs using the **filter** query parameter.

Note that you must URL-encode the category ID **filter** parameter value. This example uses the parameter: `filter=categoryIds:{181923|90638}`.

Additionally, this example uses an OAuth token created with the **client credentials grant flow**; however, Certified Refurbished-eligible sellers must use an OAuth token created with the **authorization code grant flow** in order to retrieve the Certified Refurbished condition (condition ID 2000) for the relevant categories.

```http
GET https://api.ebay.com/sell/metadata/v1/marketplace/EBAY_US/get_item_condition_policies?filter=categoryIds%3A%7B181923%7C90638%7D
```

### Output

If the call is successful, the response body contains the policies for specifying item conditions for items listed in the categories specified in the request.

```json
{
    "itemConditionPolicies": [
        {
            "categoryTreeId": "0",
            "categoryId": "90638",
            "itemConditionRequired": false,
            "itemConditions": [
                {
                    "conditionId": "2750",
                    "conditionDescription": "Like New"
                },
                {
                    "conditionId": "7000",
                    "conditionDescription": "For parts or not working"
                },
                {
                    "conditionId": "6000",
                    "conditionDescription": "Acceptable"
                },
                {
                    "conditionId": "5000",
                    "conditionDescription": "Good"
                },
                {
                    "conditionId": "4000",
                    "conditionDescription": "Very Good"
                },
                {
                    "conditionId": "3000",
                    "conditionDescription": "Used"
                },
                {
                    "conditionId": "2500",
                    "conditionDescription": "Seller refurbished"
                },
                {
                    "conditionId": "1750",
                    "conditionDescription": "New with defects"
                },
                {
                    "conditionId": "1500",
                    "conditionDescription": "New other (see details)"
                },
                {
                    "conditionId": "1000",
                    "conditionDescription": "New"
                }
            ]
        },
        {
            "categoryTreeId": "0",
            "categoryId": "181923",
            "itemConditionRequired": true,
            "itemConditions": [
                {
                    "conditionId": "1000",
                    "conditionDescription": "New"
                },
                {
                    "conditionId": "1500",
                    "conditionDescription": "New other (see details)"
                },
                {
                    "conditionId": "2500",
                    "conditionDescription": "Seller refurbished"
                },
                {
                    "conditionId": "3000",
                    "conditionDescription": "Used"
                },
                {
                    "conditionId": "7000",
                    "conditionDescription": "For parts or not working"
                }
            ]
        }
    ]
}
```

---

## Sample 2: Get the eBay category policies regarding item conditions with condition descriptors

This examples retrieves the policies, along with the condition descriptors, for a specified eBay category, in this case 183050.

 This method returns a list of leaf categories from the category tree of the specified marketplace. Each node in the response shows the policies that govern how to list item condition the returned categories using condition descriptors.

Note that condition descriptors are only returned for the following supported categories: Non-Sport Trading Card Singles, CCG Individual Card, Sports Trading Card Singles

### Input

This method does not use a request payload.

By default, this method returns the leaf nodes for the entire category tree for the specified marketplace. When you retrieve the entire tree, be sure to get the result as a GZIP file (see the top of the call page for syntax). To limit the response, specify up to 50 category IDs using the filter query parameter.

Note that you must URL-encode the category ID **filter** parameter value. This example uses the parameter: `filter=categoryIds:{183050}`.

```http
GET https://api.ebay.com/sell/metadata/v1/marketplace/EBAY_US/get_item_condition_policies?filter=categoryIds%3A%7B183050%7D
```

### Output

If the call is successful, the response body contains the policies for specifying item conditions using condition descriptors for items listed in the category specified in the request.

```json
{
    "itemConditionPolicies":
    [
        {
            "categoryTreeId": "0",
            "categoryId": "183050",
            "itemConditionRequired": false,
            "itemConditions":
            [
                {
                    "conditionId": "2750",
                    "conditionDescription": "Graded",
                    "conditionHelpText": "Professionally graded",
                    "conditionDescriptors":
                    [
                        {
                            "conditionDescriptorId": "27501",
                            "conditionDescriptorName": "Professional Grader",
                            "conditionDescriptorHelpText": "Select a grader",
                            "conditionDescriptorConstraint":
                            {
                                "defaultConditionDescriptorValueId": "275010",
                                "cardinality": "SINGLE",
                                "mode": "SELECTION_ONLY",
                                "usage": "REQUIRED"
                            },
                            "conditionDescriptorValues":
                            [
                                {
                                    "conditionDescriptorValueId": "275010",
                                    "conditionDescriptorValueName": "Professional Sports Authenticator (PSA)"
                                },
                                {
                                    "conditionDescriptorValueId": "275011",
                                    "conditionDescriptorValueName": "Beckett Collectors Club Grading (BCCG)"
                                },
                                {
                                    "conditionDescriptorValueId": "275012",
                                    "conditionDescriptorValueName": "Beckett Vintage Grading (BVG)"
                                },
                                {
                                    "conditionDescriptorValueId": "275013",
                                    "conditionDescriptorValueName": "Beckett Grading Services (BGS)"
                                },
                                {
                                    "conditionDescriptorValueId": "275015",
                                    "conditionDescriptorValueName": "Certified Guaranty Company (CGC)"
                                },
                                {
                                    "conditionDescriptorValueId": "275016",
                                    "conditionDescriptorValueName": "Sportscard Guaranty Corporation (SGC)"
                                },
                                {
                                    "conditionDescriptorValueId": "275017",
                                    "conditionDescriptorValueName": "K Sportscard Authentication (KSA)"
                                },
                                {
                                    "conditionDescriptorValueId": "275018",
                                    "conditionDescriptorValueName": "Gem Mint Authentication (GMA)"
                                },
                                {
                                    "conditionDescriptorValueId": "275019",
                                    "conditionDescriptorValueName": "Hybrid Grading Approach (HGA)"
                                },
                                {
                                    "conditionDescriptorValueId": "2750110",
                                    "conditionDescriptorValueName": "International Sports Authentication (ISA)"
                                },
                                {
                                    "conditionDescriptorValueId": "2750112",
                                    "conditionDescriptorValueName": "Gold Standard Grading (GSG)"
                                },
                                {
                                    "conditionDescriptorValueId": "2750113",
                                    "conditionDescriptorValueName": "Platin Grading Service (PGS)"
                                },
                                {
                                    "conditionDescriptorValueId": "2750114",
                                    "conditionDescriptorValueName": "MNT Grading (MNT)"
                                },
                                {
                                    "conditionDescriptorValueId": "2750115",
                                    "conditionDescriptorValueName": "Technical Authentication & Grading (TAG)"
                                },
                                {
                                    "conditionDescriptorValueId": "2750116",
                                    "conditionDescriptorValueName": "Rare Edition (Rare)"
                                },
                                {
                                    "conditionDescriptorValueId": "2750117",
                                    "conditionDescriptorValueName": "Revolution Card Grading (RCG)"
                                },
                                {
                                    "conditionDescriptorValueId": "2750120",
                                    "conditionDescriptorValueName": "Card Grading Australia (CGA)"
                                },
                                {
                                    "conditionDescriptorValueId": "2750123",
                                    "conditionDescriptorValueName": "Other"
                                }
                            ]
                        },
                        {
                            "conditionDescriptorId": "27502",
                            "conditionDescriptorName": "Grade",
                            "conditionDescriptorHelpText": "Select a grade",
                            "conditionDescriptorConstraint":
                            {
                                "defaultConditionDescriptorValueId": "275020",
                                "cardinality": "SINGLE",
                                "mode": "SELECTION_ONLY",
                                "usage": "REQUIRED",
                                "applicableToConditionDescriptorIds":
                                [
                                    "27501"
                                ]
                            },
                            "conditionDescriptorValues":
                            [
                                {
                                    "conditionDescriptorValueId": "275020",
                                    "conditionDescriptorValueName": "10",
                                    "conditionDescriptorValueConstraints":
                                    [
                                        {
                                            "applicableToConditionDescriptorId": "27501",
                                            "applicableToConditionDescriptorValueIds":
                                            [
                                                "275010",
                                                "275011",
                                                "275012",
                                                "275013",
                                                "275016",
                                                "275017",
                                                "275018",
                                                "275019",
                                                "2750110",
                                                "2750112",
                                                "2750113",
                                                "2750114",
                                                "2750115",
                                                "2750116",
                                                "2750117",
                                                "2750120",
                                                "275015",
                                                "2750123"
                                            ]
                                        }
                                    ]
                                },
                                {
                                    "conditionDescriptorValueId": "275021",
                                    "conditionDescriptorValueName": "9.5",
                                    "conditionDescriptorValueConstraints":
                                    [
                                        {
                                            "applicableToConditionDescriptorId": "27501",
                                            "applicableToConditionDescriptorValueIds":
                                            [
                                                "275011",
                                                "275012",
                                                "275013",
                                                "275016",
                                                "275017",
                                                "275019",
                                                "2750112",
                                                "2750113",
                                                "2750114",
                                                "2750116",
                                                "2750117",
                                                "2750120",
                                                "275015",
                                                "2750123"
                                            ]
                                        }
                                    ]
                                }
                            ]
                        },
                        {
                            "conditionDescriptorId": "27503",
                            "conditionDescriptorName": "Certification Number",
                            "conditionDescriptorHelpText": "Enter certification number ",
                            "conditionDescriptorConstraint":
                            {
                                "maxLength": 20,
                                "defaultConditionDescriptorValueId": "null",
                                "cardinality": "SINGLE",
                                "mode": "FREE_TEXT"
                            }
                        }
                    ]
                },
                {
                    "conditionId": "3000",
                    "conditionDescription": "Used"
                },
                {
                    "conditionId": "4000",
                    "conditionDescription": "Ungraded",
                    "conditionHelpText": "Not in original packaging or professionally graded",
                    "conditionDescriptors":
                    [
                        {
                            "conditionDescriptorId": "40001",
                            "conditionDescriptorName": "Card Condition",
                            "conditionDescriptorHelpText": "Select ungraded condition ",
                            "conditionDescriptorConstraint":
                            {
                                "defaultConditionDescriptorValueId": "400010",
                                "cardinality": "SINGLE",
                                "mode": "SELECTION_ONLY",
                                "usage": "REQUIRED"
                            },
                            "conditionDescriptorValues":
                            [
                                {
                                    "conditionDescriptorValueId": "400010",
                                    "conditionDescriptorValueName": "Near mint or better",
                                    "conditionDescriptorValueHelpText": "Comparable to a fresh pack",
                                    "conditionDescriptorValueAdditionalHelpText":
                                    [
                                        "Minor corner and edge wear"
                                    ]
                                },
                                {
                                    "conditionDescriptorValueId": "400011",
                                    "conditionDescriptorValueName": "Excellent",
                                    "conditionDescriptorValueHelpText": "Has clearly visible signs of wear",
                                    "conditionDescriptorValueAdditionalHelpText":
                                    [
                                        "Moderate edge chipping",
                                        "Moderate surface scuffing",
                                        "Fuzzy corners"
                                    ]
                                },
                                {
                                    "conditionDescriptorValueId": "400012",
                                    "conditionDescriptorValueName": "Very good",
                                    "conditionDescriptorValueHelpText": "Has moderate-to-heavy damage all over",
                                    "conditionDescriptorValueAdditionalHelpText":
                                    [
                                        "Moderate discoloration",
                                        "Moderate creasing",
                                        "Moderate to heavy edge chipping",
                                        "Rounding and soft corner"
                                    ]
                                },
                                {
                                    "conditionDescriptorValueId": "400013",
                                    "conditionDescriptorValueName": "Poor",
                                    "conditionDescriptorValueHelpText": "Is extremely worn and displays flaws all over",
                                    "conditionDescriptorValueAdditionalHelpText":
                                    [
                                        "Heavily worn and rounded corners",
                                        "Major creasing",
                                        "Moderate discoloration",
                                        "Major border wear"
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    ]
}
```

---

