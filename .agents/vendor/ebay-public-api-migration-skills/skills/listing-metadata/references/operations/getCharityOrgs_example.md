# GET : getCharityOrgs Samples

**API:** Charity
**Type:** REST GET
**Endpoint:** `https://api.ebay.com/commerce/charity/v1/charity_org/?q=red cross&limit=3`
**Method:** GET
**Operation Name:** `getCharityOrgs`

---

## Description

**Search for Charitable Organizations by Query** This sample retrieves paginated search results containing the charitable organizations that match the query string.

---

## Response Sample

```json
{
    "charityOrgs": [
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
        },
        {
            "charityOrgId": "71139",
            "name": "Disaster Services of America",
            "missionStatement": "Disaster Services of America, a humanitarian organization led by volunteers, provides relief to victims of disaster and helps people prevent, prepare for, and respond to emergencies.\r\n\r\nIt makes no discrimination as to nationality, race, religious beliefs, class or political opinions. It is guided solely by their needs, and to give priority to the most urgent cases of distress.",
            "description": "Donate to those that have lost everything. Please give now.",
            "website": "http://www.togetherforall.org",
            "logoImage": {
                "imageUrl": "https://i.ebayimg.com/00/s/NDc4WDQ4MA==/z/qV8AAOSwgaZeicG3/$_1.JPG?set_id=8800005007"
            },
            "location": {
                "address": {
                    "city": "Paragould",
                    "stateOrProvince": "AR"
                },
                "geoCoordinates": {
                    "latitude": 36.0528,
                    "longitude": -90.504
                }
            },
            "registrationId": "452796514"
        },
        {
            "charityOrgId": "119513",
            "name": "Disaster Relief Organization",
            "missionStatement": "We bring fresh water, food, clothing, and temporary shelter for people and pets without the basic necessities. We are first responders and are on site before FEMA, Red Cross, or government declares it a disaster and responds. Your support today will help others when they need it most.",
            "description": "Help those that can't help themselves with disaster strikes!",
            "website": "http://www.disasterrecover.org",
            "logoImage": {
                "imageUrl": "https://i.ebayimg.com/00/s/MTEzWDkwMA==/z/oFIAAOSwel9eib4v/$_1.PNG?set_id=8800005007"
            },
            "location": {
                "address": {
                    "city": "Medford",
                    "stateOrProvince": "OR"
                },
                "geoCoordinates": {
                    "latitude": 42.3115,
                    "longitude": -122.8221
                }
            },
            "registrationId": "352588364"
        }
    ],
    "total": 4348,
    "href": "https://api.ebay.com/commerce/charity/v1/charity_org?q=red+cross&offset=0&limit=3",
    "next": "https://api.ebay.com/commerce/charity/v1/charity_org?q=red+cross&offset=3&limit=3",
    "limit": 3,
    "offset": 0
}
```
