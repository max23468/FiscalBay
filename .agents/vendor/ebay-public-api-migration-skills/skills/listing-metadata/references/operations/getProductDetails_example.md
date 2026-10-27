# GET : getProductDetails Samples

## Mapped Modern Sample

## Sample 1: Get Product Details

This sample returns the details of the specified product by passing in the ePID of the product. The ePID was returned by the **search** call in the **productSummaries.epid** field. You can also use the URI that was returned in the **search** call's **productSummaries.productHref** field.

### Input

The input is the **epid** URI parameter, which specifies the ePID of the product. There is no payload with this request.

```http
GET https://api.ebay.com/commerce/catalog/v1_beta/product/232669172
```

### Output

The details are returned for the corresponding product titled "Apple iPhone 7 - 32GB - Black (Unlocked) A1660 (CDMA + GSM)." It also has aspects that are returned in the **aspects** container.

```json
{
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
				"MN8G2LL/A"
			]
		},
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
		}
	]
}
```

---
