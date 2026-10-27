# GET : getVeroReasonCodes Samples
- [Sample 1: Retrieve all VeRo reason codes on a specific marketplace](#sample-1-retrieve-all-vero-reason-codes-on-a-specific-marketplace)

---

## Sample 1: Retrieve all VeRo reason codes on a specific marketplace

This method can be used to retrieve all the VeRO reason codes on a specified marketplace, as well as the details and IDs of each of these codes.

### Input

The **X-EBAY-C-MARKETPLACE-ID** header can be used to specify the eBay marketplace for which to retrieve VeRO reason codes.

In this sample, all VeRO codes in the `EBAY_US` marketplace are returned.

Note: the bundled example text references the marketplace header even though the raw HTTP snippet below only preserves the request line.

```http
GET https://api.ebay.com/commerce/vero/v1/vero_reason_code
```

### Output

If the call is successful, an array of VeRO reason codes on the specified marketplace is returned. Each code will be returned with an associated **briefText**, **detailedText**, and **veroReasonCodeId** value.

```json
{
    "veroReasonCodes": [
        {
            "marketplaceId": "EBAY_US",
            "reasonCodeDetails": [
                {
                    "briefText": "Other infringement",
                    "detailedText": "Other - Provide details information in additional information box below.",
                    "veroReasonCodeId": "9052"
                },
                {
                    "briefText": "Other infringement",
                    "detailedText": "Item(s) infringes a valid and enforceable patent (can only be used if injunction information has already been provided to eBay). Provide patent information in additional information box below.",
                    "veroReasonCodeId": "9048"
                },
                {
                    "briefText": "Other infringement",
                    "detailedText": "Item(s) infringes a registered design right (available in Europe, Asia, Australia and New Zealand only). Provide design right information in additional information box below.",
                    "veroReasonCodeId": "9049"
                },
                {
                    "briefText": "Copyright - listing content infringement",
                    "detailedText": "Listing(s) contains unlawful copy of copyrighted image and text.",
                    "veroReasonCodeId": "9047"
                },
                {
                    "briefText": "Copyright - listing content infringement",
                    "detailedText": "Listing(s) contains unlawful copy of copyrighted text.",
                    "veroReasonCodeId": "9045"
                },
                {
                    "briefText": "Copyright - listing content infringement",
                    "detailedText": "Listing(s) contains unlawful copy of copyrighted image.",
                    "veroReasonCodeId": "9046"
                },
                {
                    "briefText": "Trademark - item infringement",
                    "detailedText": "Item(s) is a counterfeit product which infringes a trademark. Provide trademark information in additional information box below.",
                    "veroReasonCodeId": "9036"
                },
                {
                    "briefText": "Copyright - item infringement",
                    "detailedText": "Software is offered for sale in violation of an enforceable license agreement. (eBay will not process reports seeking to prohibit the sale of genuine unopened software).",
                    "veroReasonCodeId": "9040"
                },
                {
                    "briefText": "Copyright - item infringement",
                    "detailedText": "Item(s) is a counterfeit product which infringes a copyright.",
                    "veroReasonCodeId": "9042"
                },
                {
                    "briefText": "Other infringement",
                    "detailedText": "Listing(s) content violates a celebrity's right of publicity",
                    "veroReasonCodeId": "9051"
                },
                {
                    "briefText": "Other infringement",
                    "detailedText": "Item(s) violates a celebrity's right of publicity",
                    "veroReasonCodeId": "9050"
                },
                {
                    "briefText": "Trademark - listing content infringement",
                    "detailedText": "Listing(s) contains unlawful use of trademark. Provide trademark information in additional information box below.",
                    "veroReasonCodeId": "9038"
                }
            ]
        }
    ]
}
```

---