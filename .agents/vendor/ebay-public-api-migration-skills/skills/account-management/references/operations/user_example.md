# user
**API:** User
**Type:** GraphQL Query
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Query
**Operation Name:** `user`
---

## Description

This sample **user** user retrieves account information on an eBay user.

---

## Response Sample

```json
{
    "data": {
        "user": {
            "username": "fr*****************************b9",
            "userId": "h*********c",
            "registrationMarketPlace": "EBAY_FR",
            "userCreatedAt": "2026-01-07T00:25:18.000Z",
            "userIdChanged": false,
            "newUser": true,
            "userIdLastChangedAt": null,
            "userType": {
                "displayString": "INDIVIDUAL"
            },
            "userStatus": {
                "displayString": "CONFIRMED"
            },
            "individualIdentityProfile": {
                "firstName": "F********s",
                "lastName": "U**r",
                "middleName": null,
                "email": "e*******************@***************.com",
                "profileAddress": {
                    "addressLine1": "34*************on",
                    "addressLine2": null,
                    "city": "Paris",
                    "stateOrProvince": "IDF",
                    "postalCode": "7***9",
                    "countryCode": "FR"
                },
                "primaryPhone": {
                    "dialCode": "33",
                    "countryCode": "FR",
                    "phoneNumber": "0********9",
                    "phoneNumberType": "MOBILE"
                }
            }
        }
    }
}
```
