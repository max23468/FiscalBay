# GET : getCharityOrg Samples

**API:** Charity
**Type:** REST GET
**Endpoint:** `https://api.ebay.com/commerce/charity/v1/charity_org/302`
**Method:** GET
**Operation Name:** `getCharityOrg`

---

## Description

**Retrieve Charitable Organization Details ** This sample retrieves detailed information for a supported charitable organization based on its charity ID.

---

## Response Sample

```json
{
    "charityOrgId": "302",
    "name": "American Red Cross",
    "missionStatement": "Help the American Red Cross continue to deliver its lifesaving mission nationwide due\r\nto this public health emergency. \r\n\r\nThe American Red Cross name and emblem are used with its permission, which in no way constitutes an endorsement, express or implied, of any product, service, company, opinion or political position. ",
    "description": "Help the American Red Cross continue to deliver its lifesaving mission.",
    "website": "http://www.redcross.org",
    "logoImage": {
        "imageUrl": "https://i.ebayimg.com/00/s/MjE0WDQ3MQ==/z/LeYAAOSwxv1eicOA/$_1.JPG?set_id=8800005007"
    },
    "location": {
        "address": {
            "city": "Washington",
            "stateOrProvince": "DC"
        },
        "geoCoordinates": {
            "latitude": 38.8964,
            "longitude": -77.0457
        }
    },
    "registrationId": "530196605"
}
```
