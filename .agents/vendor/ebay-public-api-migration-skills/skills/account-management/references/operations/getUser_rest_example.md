# GET : getUser_rest Samples

**API:** Identity API
**Type:** REST GET
**Endpoint:** `https://apiz.ebay.com/commerce/identity/v1/user/`
**Method:** GET
**Operation Name:** `getUser`

---

## Description

This sample returns the user's public account profile information.

---

**Note:** This operation has 2 sample variations.

---

## Sample 1

### Response Sample

```json
{
    "userId": "0**********y",
    "username": "t********r",
    "accountType": "INDIVIDUAL",
    "registrationMarketplaceId": "EBAY_US"
}
```

---


## Sample 2

### Response Sample

```json
{
    "userId": "0***********y",
    "username": "e**************r",
    "accountType": "BUSINESS",
    "registrationMarketplaceId": "EBAY_US",
    "businessAccount": {
        "name": "E*********r",
        "email": "e**************r@e*.com",
        "doingBusinessAs": "T*************r",
        "primaryPhone": {
            "countryCode": "US",
            "number": "0********0",
            "phoneType": "MOBILE"
        }
    },
    "address": {
        "addressLine1": "2***************e",
        "addressLine2": "A***********5",
        "city": "San Jose",
        "stateOrProvince": "CA",
        "postalCode": "9***5",
        "country": "US"
    },
    "primaryContact": {
        "firstName": "E*******y",
        "lastName": "U*******r"
    }
}
```

---

