# GET : getProduct Samples

**API:** Catalog
**Type:** REST GET
**Endpoint:** `https://api.ebay.com/commerce/catalog/v1_beta/product/232669172`
**Method:** GET
**Operation Name:** `getProduct`

---

## Description

This sample returns the details of the specified product by passing in the ePID of the product. The ePID was returned by the **search** call in the **productSummaries.epid** field. You can also use the URI that was returned in the **search** call's **productSummaries.productHref** field.

---

## Response Sample

```json
{
    "aspects": [
        {
            "localizedName": "Matching MPN",
            "localizedValues": [
                "MN8G2LL/A",
                "MNAC2LL/A",
                "MNAY2LL/A"
            ]
        },
        {
            "localizedName": "Model Number",
            "localizedValues": [
                "A1660 (CDMA + GSM)"
            ]
        },
        {
            "localizedName": "Network",
            "localizedValues": [
                "Unlocked"
            ]
        },
        {
            "localizedName": "Family Line",
            "localizedValues": [
                "Apple iPhone"
            ]
        },
        {
            "localizedName": "Model",
            "localizedValues": [
                "7"
            ]
        },
        {
            "localizedName": "UPC",
            "localizedValues": [
                "190198072078"
            ]
        },
        {
            "localizedName": "Type",
            "localizedValues": [
                "Smartphone"
            ]
        },
        {
            "localizedName": "Storage Capacity",
            "localizedValues": [
                "32GB"
            ]
        },
        {
            "localizedName": "Color",
            "localizedValues": [
                "Black"
            ]
        },
        {
            "localizedName": "Network Generation",
            "localizedValues": [
                "2G",
                "3G",
                "4G"
            ]
        },
        {
            "localizedName": "Network Technology",
            "localizedValues": [
                "CDMA / EVDO Rev. A",
                "GSM / EDGE / UMTS / HSPA+ / DC-HSDPA / FDD-LTE / TD-LTE",
                "TD-SCDMA"
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
            "localizedName": "Connectivity",
            "localizedValues": [
                "Bluetooth",
                "NFC",
                "USB",
                "WiFi"
            ]
        },
        {
            "localizedName": "Supported Flash Memory Cards",
            "localizedValues": [
                "Built-In Memory"
            ]
        },
        {
            "localizedName": "Battery Type",
            "localizedValues": [
                "Lithium Ion"
            ]
        },
        {
            "localizedName": "Battery Capacity",
            "localizedValues": [
                "1960 mAh"
            ]
        },
        {
            "localizedName": "Battery Talk Time",
            "localizedValues": [
                "Up to 840 min"
            ]
        },
        {
            "localizedName": "Battery Standby Time",
            "localizedValues": [
                "Up to 240 hr"
            ]
        },
        {
            "localizedName": "Display Technology",
            "localizedValues": [
                "Retina HD with 3D Touch"
            ]
        },
        {
            "localizedName": "Screen Size",
            "localizedValues": [
                "4.7\""
            ]
        },
        {
            "localizedName": "Display Resolution",
            "localizedValues": [
                "1334x750"
            ]
        },
        {
            "localizedName": "Touch Screen",
            "localizedValues": [
                "Yes"
            ]
        },
        {
            "localizedName": "Bluetooth",
            "localizedValues": [
                "Yes"
            ]
        },
        {
            "localizedName": "Digital Camera",
            "localizedValues": [
                "Yes"
            ]
        },
        {
            "localizedName": "GPS",
            "localizedValues": [
                "Yes"
            ]
        },
        {
            "localizedName": "QWERTY Physical Keyboard",
            "localizedValues": [
                "No"
            ]
        },
        {
            "localizedName": "Email Access",
            "localizedValues": [
                "Yes"
            ]
        },
        {
            "localizedName": "Internet Browser",
            "localizedValues": [
                "Yes"
            ]
        },
        {
            "localizedName": "Speakerphone",
            "localizedValues": [
                "Yes"
            ]
        },
        {
            "localizedName": "Height",
            "localizedValues": [
                "5.44 in."
            ]
        },
        {
            "localizedName": "Depth",
            "localizedValues": [
                "0.28 in."
            ]
        },
        {
            "localizedName": "Width",
            "localizedValues": [
                "2.64 in."
            ]
        },
        {
            "localizedName": "Weight",
            "localizedValues": [
                "4.87 oz"
            ]
        },
        {
            "localizedName": "Release Date",
            "localizedValues": [
                "2016"
            ]
        }
    ],
    "title": "Apple iPhone 7 - 32GB - Black (Unlocked) A1660 (CDMA + GSM)",
    "description": "This iPhone 7 is a factory unlocked Apple smartphone with an 4.7 inches multitouch Display and a water restistant case which protects against spills and splashes. It is powered by quad-core processor, a six-core grasphic processor, has an internal 32 GB memory card with 2 GB RAM and the upgradable operating system iOS 10.0.1. A fingerprint sensor, Siri voice control system, audio, video and document editors are only some of the features. The build-in lithium-ion battery enables up to 14 hours of talk time/mobile data usage or up to 40 hours music play. The 12MP HDR-camera comes with phase detection autofocus, touch focus and smile detection and permits simultaneous 8MP image and 4k video recording. The phone measures 138.3 x 67.1 x 7.1 mm, weighs 138g and requires an Nano-SIM.",
    "image": {
        "imageUrl": "https://i.ebayimg.com/00/s/NjgwWDU5Ng==/z/6T0AAOSwWxNYpDWn/$_6.JPG?set_id=89040003C1"
    },
    "gtin": [
        "0190198072078"
    ],
    "mpn": [
        "MN8G2LL/A"
    ],
    "ean": [
        "0190198072078"
    ],
    "upc": [
        "0190198072078"
    ],
    "brand": "Apple",
    "epid": "232669172",
    "productWebUrl": "https://www.ebay.com/p/Apple+iPhone+7+%2D+32GB+%2D+Black+%28Unlocked%29+A1660+%28CDMA+%2B+GSM%29/232669172",
    "primaryCategoryId": "9355",
    "otherApplicableCategoryIds": [
        "9355"
    ]
}
```
