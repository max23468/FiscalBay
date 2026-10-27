# GET : getItemAspectsForCategory Samples
- [Sample 1: Get aspects for a leaf category](#sample-1-get-aspects-for-a-leaf-category)
- [Sample 2: Get the expected required by date for an aspect](#sample-2-get-the-expected-required-by-date-for-an-aspect)

---

## Sample 1: Get aspects for a leaf category

This sample returns an array of aspects that are appropriate or necessary for accurately describing items in the specified leaf category.

### Input

Use the **category_tree_id** path parameter to specify the category tree, and use the **category_id** query parameter to specify the leaf category for which to retrieve associated aspects.

```http
GET https://api.ebay.com/commerce/taxonomy/v1/category_tree/0/get_item_aspects_for_category?category_id=67726
```

### Output

A successful call returns a list of the aspects associated with category `67726`, including each aspect's data type, format, entry mode, cardinality, and support. It also returns a list of valid values for each aspect, including any constraints on the applicability of each value.

```json
{
    "aspects": [
        {
            "localizedAspectName": "Brand",
            "aspectConstraint": {
                "aspectDataType": "STRING",
                "itemToAspectCardinality": "SINGLE",
                "aspectMode": "FREE_TEXT",
                "aspectRequired": false,
                "aspectUsage": "OPTIONAL",
                "aspectEnabledForVariations": false
            },
            "aspectValues": [
                {
                    "localizedValue": "Unbranded"
                },
                {
                    "localizedValue": "Handmade"
                },
                {
                    "localizedValue": "Affinity"
                },
                {
                    "localizedValue": "Agatha"
                },
                {
                    "localizedValue": "Aigner"
                },
                {
                    "localizedValue": "ALEX AND ANI"
                },
                {
                    "localizedValue": "ALOR"
                },
                {
                    "localizedValue": "Alwand Vahan"
                },
                {
                    "localizedValue": "Ann King"
                },
                {
                    "localizedValue": "Apart"
                },
                {
                    "localizedValue": "Argos"
                },
                {
                    "localizedValue": "ArtCarved"
                },
                {
                    "localizedValue": "Asprey"
                },
                {
                    "localizedValue": "Audemars Piguet"
                },
                {
                    "localizedValue": "Baccarat"
                },
                {
                    "localizedValue": "Beaverbrooks"
                },
                {
                    "localizedValue": "Belle Étoile"
                },
                {
                    "localizedValue": "Blue Nile"
                },
                {
                    "localizedValue": "Bogner"
                },
                {
                    "localizedValue": "Boodles"
                },
                {
                    "localizedValue": "Boucheron"
                },
                {
                    "localizedValue": "Brighton"
                },
                {
                    "localizedValue": "Buccellati"
                },
                {
                    "localizedValue": "Bucherer"
                },
                {
                    "localizedValue": "Bvlgari"
                },
                {
                    "localizedValue": "Bunz"
                },
                {
                    "localizedValue": "Carolyn Pollack"
                },
                {
                    "localizedValue": "Carrera y Carrera"
                },
                {
                    "localizedValue": "Cartier"
                },
                {
                    "localizedValue": "CHANEL"
                },
                {
                    "localizedValue": "Chapelle"
               },
                {
                    "localizedValue": "Charles & Colvard"
                },
                {
                    "localizedValue": "Charlotte"
                },
                {
                    "localizedValue": "Charon"
                },
                {
                    "localizedValue": "Charriol"
                },
                {
                    "localizedValue": "Chaumet"
                },
                {
                    "localizedValue": "Chopard"
                },
                {
                    "localizedValue": "CHRIST"
                },
                {
                    "localizedValue": "Christchurch"
                },
                {
                    "localizedValue": "Dior"
                },
                {
                    "localizedValue": "Clogau"
                },
                {
                    "localizedValue": "Coach"
                },
                {
                    "localizedValue": "Damiani"
                },
                {
                    "localizedValue": "David Yurman"
                },
                {
                    "localizedValue": "Diamondforgood"
                },
                {
                    "localizedValue": "Diamonique"
                },
                {
                    "localizedValue": "DKNY"
                },
                {
                    "localizedValue": "Dogeared"
                },
                {
                    "localizedValue": "Dolce&Gabbana"
                },
                {
                    "localizedValue": "Dyrberg/Kern"
                },
                {
                    "localizedValue": "Effy"
                },
                {
                    "localizedValue": "Epiphany"
                },
                {
                    "localizedValue": "Ernest Jones"
                },
                {
                    "localizedValue": "Esprit"
                },
                {
                    "localizedValue": "Estate"
                },
                {
                    "localizedValue": "F. Hinds"
                },
                {
                    "localizedValue": "Fabergé"
                },
                {
                    "localizedValue": "Florence"
                },
                {
                    "localizedValue": "Fope"
                },
                {
                    "localizedValue": "Fossil"
                },
                {
                    "localizedValue": "Fraser Hart"
                },
                {
                    "localizedValue": "Galaxy Gold Products"
                },
                {
                    "localizedValue": "Gems TV"
                },
                {
                    "localizedValue": "Georg Jensen"
                },
                {
                    "localizedValue": "Givenchy"
                },
                {
                    "localizedValue": "Goldsmiths"
                },
                {
                    "localizedValue": "Gucci"
                },
                {
                    "localizedValue": "GUESS"
                },
                {
                    "localizedValue": "GURHAN"
                },
                {
                    "localizedValue": "H. Samuel"
                },
                {
                    "localizedValue": "Harry Winston"
                },
                {
                    "localizedValue": "Hearts On Fire"
                },
                {
                    "localizedValue": "Helzberg"
                },
                {
                    "localizedValue": "HERMÈS"
                },
                {
                    "localizedValue": "Hidalgo"
                },
                {
                    "localizedValue": "HUGO BOSS"
                },
                {
                    "localizedValue": "INSIGNUM"
                },
                {
                    "localizedValue": "IPPOLITA"
                },
                {
                    "localizedValue": "Jabel"
                },
                {
                    "localizedValue": "Jaeger"
                },
                {
                    "localizedValue": "James Avery"
                },
                {
                    "localizedValue": "Jane Seymour"
                },
                {
                    "localizedValue": "Janis Savitt"
                },
                {
                    "localizedValue": "Jared"
                },
                {
                    "localizedValue": "JAVDA"
                },
                {
                    "localizedValue": "Mine Finds by Jay King"
                },
                {
                    "localizedValue": "Jean Dousset"
                },
                {
                    "localizedValue": "JETTE"
                },
               {
                    "localizedValue": "John Hardy"
                },
                {
                    "localizedValue": "JOOP!"
                },
                {
                    "localizedValue": "Judith Ripka"
                },
                {
                    "localizedValue": "Kabana"
                },
                {
                    "localizedValue": "Kabiri"
                },
                {
                    "localizedValue": "Kay Jewelers"
                },
                {
                    "localizedValue": "Keepsake"
                },
                {
                    "localizedValue": "Kieselstein-Cord"
                },
                {
                    "localizedValue": "Konstantino"
                },
                {
                    "localizedValue": "Kwiat"
                },
                {
                    "localizedValue": "Lady Heart"
                },
                {
                    "localizedValue": "Lagos"
                },
                {
                    "localizedValue": "Lalique"
                },
                {
                    "localizedValue": "Lapponia"
                },
                {
                    "localizedValue": "Leslie Davis"
                },
                {
                    "localizedValue": "Le Vian"
                },
                {
                    "localizedValue": "Links of London"
                },
                {
                    "localizedValue": "Lois Hill"
                },
                {
                    "localizedValue": "Lola Rose"
                },
                {
                    "localizedValue": "Louis Vuitton"
                },
                {
                    "localizedValue": "M & M"
                },
                {
                    "localizedValue": "Maik Malo"
                },
                {
                    "localizedValue": "Mappin & Webb"
                },
                {
                    "localizedValue": "Marc O'Polo"
                },
                {
                    "localizedValue": "Mauboussin"
                },
                {
                    "localizedValue": "Mexx"
                },
               {
                    "localizedValue": "Michaela Frey"
                },
                {
                    "localizedValue": "Michael Dawkins"
                },
                {
                    "localizedValue": "Mikimoto"
                },
                {
                    "localizedValue": "Miss Selfridge"
                },
                {
                    "localizedValue": "Montblanc"
                },
                {
                    "localizedValue": "MORE & MORE"
                },
                {
                    "localizedValue": "Nathaniel Jewelry"
                },
                {
                    "localizedValue": "Neil Lane"
                },
                {
                    "localizedValue": "Niessing"
                },
                {
                    "localizedValue": "Nomination"
                },
                {
                    "localizedValue": "Old Florence"
                },
                {
                    "localizedValue": "OMEGA"
                },
                {
                    "localizedValue": "Oravo"
                },
                {
                    "localizedValue": "OTTO KERN"
                },
                {
                    "localizedValue": "PANDORA"
                },
                {
                    "localizedValue": "Pascal"
                },
                {
                    "localizedValue": "PASQUALE BRUNI"
                },
                {
                    "localizedValue": "Patek Philippe"
                },
                {
                    "localizedValue": "PIA"
                },
                {
                    "localizedValue": "Piaget"
                },
                {
                    "localizedValue": "Pierre Cardin"
                },
                {
                    "localizedValue": "Pierre Lang"
                },
                {
                    "localizedValue": "Pomellato"
                },
                {
                    "localizedValue": "Pompeii3"
                },
                {
                    "localizedValue": "Ponte Vecchio"
                },
                {
                    "localizedValue": "Pricegems"
                },
                {
                    "localizedValue": "Quinn"
                },
                {
                    "localizedValue": "Ralph Lauren"
                },
                {
                    "localizedValue": "Rarities"
                },
                {
                    "localizedValue": "REEDS Jewelers"
                },
                {
                    "localizedValue": "Ritani"
                },
                {
                    "localizedValue": "Robert Lee Morris"
                },
                {
                    "localizedValue": "Roberto Coin"
                },
                {
                    "localizedValue": "Rolex"
                },
                {
                    "localizedValue": "Ross Simons"
                },
                {
                    "localizedValue": "s.Oliver"
                },
                {
                    "localizedValue": "SCOTT KAY"
                },
                {
                    "localizedValue": "Shamballa Jewels"
                },
                {
                    "localizedValue": "Shiree Odiz"
                },
                {
                    "localizedValue": "Silpada"
                },
                {
                    "localizedValue": "Simon G."
                },
                {
                    "localizedValue": "Skulpturen"
                },
                {
                    "localizedValue": "Sonia B. Designs"
                },
                {
                    "localizedValue": "Stephen Dweck"
                },
                {
                    "localizedValue": "Stephen Webster"
                },
                {
                    "localizedValue": "Streichholzetuis"
                },
                {
                    "localizedValue": "SWAG"
                },
                {
                    "localizedValue": "Swarovski"
                },
                {
                    "localizedValue": "Tacori"
                },
                {
                    "localizedValue": "TASAKI"
                },
                {
                    "localizedValue": "Technibond"
                },
                {
                    "localizedValue": "Teufel"
                },
                {
                    "localizedValue": "Theo Fennell"
                },
                {
                    "localizedValue": "Thomas Sabo"
                },
                {
                    "localizedValue": "Tiffany & Co."
                },
                {
                    "localizedValue": "Tommy Hilfiger"
                },
                {
                    "localizedValue": "TOM TAILOR"
                },
                {
                    "localizedValue": "Van Cleef & Arpels"
                },
                {
                    "localizedValue": "Verragio"
                },
                {
                    "localizedValue": "Versace"
                },
                {
                    "localizedValue": "Victoria Wieck"
                },
                {
                    "localizedValue": "Vivienne Westwood"
                },
                {
                    "localizedValue": "Warren James"
                },
                {
                    "localizedValue": "Wempe"
                },
                {
                    "localizedValue": "YOUGOLDA"
                },
                {
                    "localizedValue": "Zales"
                }
            ]
        },
        {
            "localizedAspectName": "Metal",
            "aspectConstraint": {
                "aspectDataType": "STRING",
                "itemToAspectCardinality": "SINGLE",
                "aspectMode": "FREE_TEXT",
                "aspectRequired": false,
                "aspectUsage": "RECOMMENDED",
                "aspectEnabledForVariations": false
            },
            "aspectValues": [
                {
                    "localizedValue": "Alloy"
                },
                {
                    "localizedValue": "Aluminum"
                },
                {
                    "localizedValue": "Brass"
                },
                {
                    "localizedValue": "Brass plated"
                },
                {
                    "localizedValue": "Bronze"
                },
                {
                    "localizedValue": "Ceramic"
                },
                {
                    "localizedValue": "Copper"
                },
                {
                    "localizedValue": "Fine Silver"
                },
                {
                    "localizedValue": "Gold Bonded"
                },
                {
                    "localizedValue": "Mixed Metals"
                },
                {
                    "localizedValue": "Multi-Tone Gold"
                },
                {
                    "localizedValue": "Nickel"
                },
                {
                    "localizedValue": "Palladium"
                },
                {
                    "localizedValue": "Pewter"
                },
                {
                    "localizedValue": "Platinum"
                },
                {
                    "localizedValue": "Platinum Flashed"
                },
                {
                    "localizedValue": "Platinum Plated"
                },
                {
                    "localizedValue": "Rhodium"
                },
                {
                    "localizedValue": "Rhodium Flashed"
                },
                {
                    "localizedValue": "Rhodium Plated"
                },
                {
                    "localizedValue": "Rose Gold"
                },
                {
                    "localizedValue": "Rose Gold Filled"
                },
                {
                    "localizedValue": "Rose Gold Flashed"
                },
                {
                    "localizedValue": "Rose Gold Plated"
                },
                {
                    "localizedValue": "Silver Plated"
                },
                {
                    "localizedValue": "Stainless Steel"
                },
                {
                    "localizedValue": "Sterling Silver"
                },
                {
                    "localizedValue": "Surgical Steel"
                },
                {
                    "localizedValue": "Tibetan Silver"
                },
                {
                    "localizedValue": "Titanium"
                },
                {
                    "localizedValue": "Titanium Plated"
                },
                {
                    "localizedValue": "Tungsten"
                },
                {
                    "localizedValue": "White Gold"
                },
                {
                    "localizedValue": "White Gold Filled"
                },
                {
                    "localizedValue": "White Gold Flashed"
                },
                {
                    "localizedValue": "White Gold Plated"
                },
                {
                    "localizedValue": "Yellow Gold"
                },
                {
                    "localizedValue": "Yellow Gold Filled"
                },
                {
                    "localizedValue": "Yellow Gold Flashed"
                },
                {
                    "localizedValue": "Yellow Gold Plated"
                },
                {
                    "localizedValue": "Unknown"
                }
            ]
        },
        {
            "localizedAspectName": "Base Metal",
            "aspectConstraint": {
                "aspectDataType": "STRING",
                "itemToAspectCardinality": "SINGLE",
                "aspectMode": "SELECTION_ONLY",
                "aspectRequired": false,
                "aspectUsage": "OPTIONAL",
                "aspectEnabledForVariations": false
            },
            "aspectValues": [
                {
                    "localizedValue": "Alloy",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Aluminum",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Brass",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Bronze",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Copper",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Fine Silver, 925 parts per 1000",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Fine Silver, 950 parts per 1000",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Fine Silver, 999 parts per 1000",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Iridium",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Mixed Metals",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Multi-Tone Gold, 9k",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Multi-Tone Gold, 10k",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Multi-Tone Gold, 14k",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Multi-Tone Gold, 18k",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Multi-Tone Gold, 20k",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Osmium",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Palladium, 850 parts per 1000",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Palladium, 900 parts per 1000",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Palladium, 950 parts per 1000",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Pewter",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Platinum, 850 parts per 1000",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Platinum, 900 parts per 1000",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Platinum, 950 parts per 1000",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Rhodium",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Rose Gold, 9k",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Rose Gold, 10k",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Rose Gold, 14k",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Rose Gold, 18k",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Rose Gold, 20k",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Ruthenium",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Sterling Silver, 925 parts per 1000",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Sterling Silver, 950 parts per 1000",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                               "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Sterling Silver, 999 parts per 1000",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Surgical Steel",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Tibetan Silver",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Titanium",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Tungsten",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "White Gold, 9k",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "White Gold, 10k",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "White Gold, 14k",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "White Gold, 18k",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Yellow Gold, 9k",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Yellow Gold, 10k",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Yellow Gold, 14k",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Yellow Gold, 18k",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Yellow Gold, 20k",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Yellow Gold, 22k",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Yellow Gold, 24k",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Not Applicable",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Unknown",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Titanium Plated",
                                "White Gold Plated",
                                "White Gold Flashed",
                                "White Gold Filled",
                                "Yellow Gold Plated",
                                "Yellow Gold Flashed",
                                "Yellow Gold Filled",
                                "Gold Bonded",
                                "Brass plated",
                                "Platinum Flashed",
                                "Platinum Plated",
                                "Rhodium Plated",
                                "Rhodium Flashed",
                                "Rose Gold Plated",
                                "Silver Plated",
                                "Rose Gold Filled",
                                "Rose Gold Flashed"
                            ]
                        }
                    ]
                }
            ]
        },
        {
            "localizedAspectName": "Style",
            "aspectConstraint": {
                "aspectDataType": "STRING",
                "itemToAspectCardinality": "SINGLE",
                "aspectMode": "FREE_TEXT",
                "aspectRequired": false,
                "aspectUsage": "RECOMMENDED",
                "aspectEnabledForVariations": false
            },
            "aspectValues": [
                {
                    "localizedValue": "Band"
                },
                {
                    "localizedValue": "Bow"
                },
                {
                    "localizedValue": "Braided"
                },
                {
                    "localizedValue": "Cameo"
                },
                {
                    "localizedValue": "Claddagh"
                },
                {
                    "localizedValue": "Class/School"
                },
                {
                    "localizedValue": "Claw Ring"
                },
                {
                    "localizedValue": "Cluster"
                },
                {
                    "localizedValue": "Cocktail"
                },
                {
                    "localizedValue": "Daisy"
                },
                {
                    "localizedValue": "Dome"
                },
               {
                    "localizedValue": "Eternity"
                },
                {
                    "localizedValue": "Feather"
                },
                {
                    "localizedValue": "Friendship"
                },
                {
                    "localizedValue": "Halo"
                },
                {
                    "localizedValue": "Hinged"
                },
                {
                    "localizedValue": "Journey"
                },
                {
                    "localizedValue": "Masonic"
                },
                {
                    "localizedValue": "Memorial"
                },
                {
                    "localizedValue": "Military"
                },
                {
                    "localizedValue": "Mood"
                },
                {
                    "localizedValue": "Puzzle"
                },
                {
                    "localizedValue": "Ring Harness"
                },
                {
                    "localizedValue": "Rolling"
                },
                {
                    "localizedValue": "Signet"
                },
                {
                    "localizedValue": "Solitaire"
                },
                {
                    "localizedValue": "Solitaire with Accents"
                },
                {
                    "localizedValue": "Spinner"
                },
                {
                    "localizedValue": "Stackable"
                },
                {
                    "localizedValue": "Statement"
                },
                {
                    "localizedValue": "Three-Stone"
                },
                {
                    "localizedValue": "Wrap"
                }
            ]
        },
        {
            "localizedAspectName": "Metal Purity",
            "aspectConstraint": {
                "aspectDataType": "STRING",
                "itemToAspectCardinality": "SINGLE",
                "aspectMode": "SELECTION_ONLY",
                "aspectRequired": false,
                "aspectUsage": "RECOMMENDED",
                "aspectEnabledForVariations": false
            },
            "aspectValues": [
                {
                    "localizedValue": "9k",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Multi-Tone Gold",
                                "White Gold",
                                "Yellow Gold",
                                "Rose Gold"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "10k",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Multi-Tone Gold",
                                "White Gold",
                                "Yellow Gold",
                                "Rose Gold"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "14k",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Multi-Tone Gold",
                                "White Gold",
                                "Yellow Gold",
                                "Rose Gold"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "18k",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Multi-Tone Gold",
                                "White Gold",
                                "Yellow Gold",
                                "Rose Gold"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "20k",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Multi-Tone Gold",
                                "Yellow Gold",
                                "Rose Gold"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "22k",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Yellow Gold"
                           ]
                        }
                    ]
                },
                {
                    "localizedValue": "24k",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Yellow Gold"
                            ]
                        }
                    ]
                },
               {
                    "localizedValue": "850 parts per 1000",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Palladium",
                                "Platinum"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "900 parts per 1000",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Palladium",
                                "Platinum"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "925 parts per 1000",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Fine Silver",
                                "Sterling Silver"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "950 parts per 1000",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Fine Silver",
                                "Palladium",
                                "Sterling Silver",
                                "Platinum"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "999 parts per 1000",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Fine Silver",
                                "Sterling Silver"
                            ]
                        }
                    ]
                },
                {
                    "localizedValue": "Unknown",
                    "valueConstraints": [
                        {
                            "applicableForLocalizedAspectName": "Metal",
                            "applicableForLocalizedAspectValues": [
                                "Fine Silver",
                                "Palladium",
                                "Sterling Silver",
                                "Multi-Tone Gold",
                                "White Gold",
                                "Platinum",
                                "Yellow Gold",
                                "Rose Gold"
                            ]
                        }
                    ]
                }
            ]
        },
        {
            "localizedAspectName": "Ring Size",
            "aspectConstraint": {
                "aspectDataType": "STRING",
                "itemToAspectCardinality": "SINGLE",
                "aspectMode": "FREE_TEXT",
                "aspectRequired": false,
                "aspectUsage": "OPTIONAL",
                "aspectEnabledForVariations": false
            },
            "aspectValues": [
                {
                    "localizedValue": "Less than 3"
                },
                {
                    "localizedValue": "3"
                },
                {
                    "localizedValue": "4"
                },
                {
                    "localizedValue": "4.5"
                },
                {
                    "localizedValue": "5"
                },
                {
                    "localizedValue": "5.5"
                },
                {
                    "localizedValue": "6"
                },
                {
                    "localizedValue": "6.25"
                },
                {
                    "localizedValue": "6.5"
                },
                {
                    "localizedValue": "6.75"
                },
                {
                    "localizedValue": "7"
                },
                {
                    "localizedValue": "7.5"
                },
                {
                    "localizedValue": "8"
                },
                {
                    "localizedValue": "8.5"
                },
                {
                    "localizedValue": "9"
                },
                {
                    "localizedValue": "9.5"
                },
                {
                    "localizedValue": "10"
                },
                {
                    "localizedValue": "10.5"
                },
                {
                    "localizedValue": "11"
                },
                {
                    "localizedValue": "11.5"
                },
                {
                    "localizedValue": "12"
                },
                {
                    "localizedValue": "12.5"
                },
                {
                    "localizedValue": "13"
                },
                {
                    "localizedValue": "13.5"
                },
                {
                    "localizedValue": "14 and greater"
                },
                {
                    "localizedValue": "3.25"
                },
                {
                    "localizedValue": "3.5"
                },
                {
                    "localizedValue": "3.75"
                },
                {
                    "localizedValue": "4.25"
                },
                {
                    "localizedValue": "4.75"
                },
                {
                    "localizedValue": "5.25"
                },
                {
                    "localizedValue": "5.75"
                },
                {
                    "localizedValue": "7.25"
                },
                {
                    "localizedValue": "7.75"
                },
                {
                    "localizedValue": "8.25"
                },
                {
                    "localizedValue": "8.75"
                },
                {
                    "localizedValue": "9.25"
                },
                {
                    "localizedValue": "9.75"
                },
                {
                    "localizedValue": "10.25"
                },
                {
                   "localizedValue": "10.75"
                },
                {
                    "localizedValue": "11.25"
                },
                {
                    "localizedValue": "11.75"
                },
                {
                    "localizedValue": "12.25"
                },
                {
                    "localizedValue": "12.75"
                }
            ]
        },
        {
            "localizedAspectName": "Sizable",
            "aspectConstraint": {
                "aspectDataType": "STRING",
                "itemToAspectCardinality": "MULTI",
                "aspectMode": "SELECTION_ONLY",
                "aspectRequired": false,
                "aspectUsage": "OPTIONAL",
                "aspectEnabledForVariations": false
            },
            "aspectValues": [
                {
                    "localizedValue": "Yes"
                }
            ]
        },
        {
            "localizedAspectName": "Total Carat Weight (TCW)",
            "aspectConstraint": {
                "aspectDataType": "STRING",
                "itemToAspectCardinality": "SINGLE",
                "aspectMode": "FREE_TEXT",
                "aspectRequired": false,
                "aspectUsage": "OPTIONAL",
                "aspectEnabledForVariations": false
            }
        },
        {
            "localizedAspectName": "Main Stone Shape",
            "aspectConstraint": {
                "aspectDataType": "STRING",
                "itemToAspectCardinality": "SINGLE",
                "aspectMode": "FREE_TEXT",
                "aspectRequired": false,
                "aspectUsage": "RECOMMENDED",
                "aspectEnabledForVariations": false
            },
            "aspectValues": [
                {
                    "localizedValue": "Asscher"
                },
                {
                    "localizedValue": "Baguette"
                },
                {
                    "localizedValue": "Briolette"
                },
                {
                    "localizedValue": "Cabochon"
                },
                {
                    "localizedValue": "Cushion"
                },
                {
                    "localizedValue": "Emerald"
                },
                {
                    "localizedValue": "Heart"
                },
                {
                    "localizedValue": "Marquise"
                },
                {
                    "localizedValue": "Oval"
                },
                {
                    "localizedValue": "Pear"
                },
                {
                    "localizedValue": "Princess"
                },
                {
                    "localizedValue": "Radiant"
                },
                {
                    "localizedValue": "Round"
                },
                {
                    "localizedValue": "Trillion"
                }
            ]
        },
        {
            "localizedAspectName": "Diamond Color",
            "aspectConstraint": {
                "aspectDataType": "STRING",
                "itemToAspectCardinality": "SINGLE",
                "aspectMode": "FREE_TEXT",
                "aspectRequired": false,
                "aspectUsage": "OPTIONAL",
                "aspectEnabledForVariations": false
            },
            "aspectValues": [
                {
                    "localizedValue": "D"
                },
                {
                    "localizedValue": "E"
                },
                {
                    "localizedValue": "F"
                },
                {
                    "localizedValue": "G"
                },
                {
                    "localizedValue": "H"
                },
                {
                    "localizedValue": "I"
                },
                {
                    "localizedValue": "J"
                },
                {
                    "localizedValue": "K - M"
                },
                {
                    "localizedValue": "N - R"
                },
                {
                    "localizedValue": "S - W"
                },
                {
                    "localizedValue": "Fancy Color"
                },
                {
                    "localizedValue": "Not Applicable"
                }
            ]
        },
        {
            "localizedAspectName": "Main Stone Creation",
            "aspectConstraint": {
                "aspectDataType": "STRING",
                "itemToAspectCardinality": "MULTI",
                "aspectMode": "FREE_TEXT",
                "aspectRequired": false,
                "aspectUsage": "OPTIONAL",
                "aspectEnabledForVariations": false
            },
            "aspectValues": [
                {
                    "localizedValue": "Lab-Created"
                },
                {
                    "localizedValue": "Natural"
                },
                {
                    "localizedValue": "Simulated"
                },
                {
                    "localizedValue": "Treated"
                },
                {
                    "localizedValue": "Unknown"
                }
            ]
        },
        {
            "localizedAspectName": "Clarity",
            "aspectConstraint": {
                "aspectDataType": "STRING",
                "itemToAspectCardinality": "SINGLE",
                "aspectMode": "FREE_TEXT",
                "aspectRequired": false,
                "aspectUsage": "OPTIONAL",
                "aspectEnabledForVariations": false
            },
            "aspectValues": [
                {
                    "localizedValue": "FL"
                },
                {
                    "localizedValue": "IF"
                },
                {
                    "localizedValue": "VVS1"
                },
                {
                    "localizedValue": "VVS2"
                },
                {
                    "localizedValue": "VS1"
                },
                {
                    "localizedValue": "VS2"
                },
                {
                    "localizedValue": "SI1"
                },
                {
                    "localizedValue": "SI2"
                },
                {
                    "localizedValue": "I1"
                },
                {
                    "localizedValue": "I2"
                },
                {
                    "localizedValue": "I3"
                }
            ]
        },
        {
            "localizedAspectName": "Fancy Diamond Color",
            "aspectConstraint": {
                "aspectDataType": "STRING",
                "itemToAspectCardinality": "SINGLE",
                "aspectMode": "FREE_TEXT",
                "aspectRequired": false,
                "aspectUsage": "RECOMMENDED",
                "aspectEnabledForVariations": false
            },
            "aspectValues": [
                {
                    "localizedValue": "Black"
                },
                {
                    "localizedValue": "Blue"
                },
                {
                    "localizedValue": "Brown"
                },
                {
                    "localizedValue": "Canary"
                },
                {
                    "localizedValue": "Champagne"
                },
                {
                    "localizedValue": "Cognac"
                },
                {
                   "localizedValue": "Fire"
                },
                {
                    "localizedValue": "Gold"
                },
                {
                    "localizedValue": "Gray"
                },
                {
                    "localizedValue": "Green"
                },
                {
                    "localizedValue": "Orange"
                },
                {
                    "localizedValue": "Pink"
                },
                {
                    "localizedValue": "Purple"
                },
                {
                    "localizedValue": "Red"
                },
                {
                    "localizedValue": "White"
                },
                {
                    "localizedValue": "Yellow"
                },
                {
                    "localizedValue": "Not Applicable"
                }
            ]
        },
        {
            "localizedAspectName": "Cut",
            "aspectConstraint": {
                "aspectDataType": "STRING",
                "itemToAspectCardinality": "SINGLE",
                "aspectMode": "FREE_TEXT",
                "aspectRequired": false,
                "aspectUsage": "OPTIONAL",
                "aspectEnabledForVariations": false
            },
            "aspectValues": [
                {
                    "localizedValue": "Ideal"
                },
                {
                    "localizedValue": "Excellent"
                },
                {
                    "localizedValue": "Very Good"
                },
                {
                    "localizedValue": "Good"
                },
                {
                    "localizedValue": "Fair"
                },
                {
                    "localizedValue": "Poor"
                }
            ]
        },
        {
            "localizedAspectName": "Main Stone Treatment",
            "aspectConstraint": {
                "aspectDataType": "STRING",
                "itemToAspectCardinality": "MULTI",
                "aspectMode": "FREE_TEXT",
                "aspectRequired": false,
                "aspectUsage": "OPTIONAL",
                "aspectEnabledForVariations": false
            },
            "aspectValues": [
                {
                    "localizedValue": "Not Enhanced"
                },
                {
                    "localizedValue": "Bleaching"
                },
                {
                    "localizedValue": "Coating"
                },
                {
                    "localizedValue": "Diffusion"
                },
                {
                    "localizedValue": "Dyeing"
                },
                {
                    "localizedValue": "Filling"
                },
                {
                    "localizedValue": "Heat & Pressure"
                },
                {
                    "localizedValue": "Heating"
                },
                {
                    "localizedValue": "Impregnating"
                },
                {
                    "localizedValue": "Irradiation"
                },
                {
                    "localizedValue": "Lasering"
                },
                {
                    "localizedValue": "Oiling/Resin"
                },
                {
                    "localizedValue": "Routinely Enhanced"
                },
                {
                    "localizedValue": "Waxing/Oiling Opaque Stones"
                },
                {
                    "localizedValue": "Unknown"
                }
            ]
        },
        {
            "localizedAspectName": "Occasion",
            "aspectConstraint": {
                "aspectDataType": "STRING",
                "itemToAspectCardinality": "SINGLE",
                "aspectMode": "FREE_TEXT",
                "aspectRequired": false,
                "aspectUsage": "OPTIONAL",
                "aspectEnabledForVariations": false
            },
            "aspectValues": [
                {
                    "localizedValue": "Anniversary"
                },
                {
                    "localizedValue": "Birthday"
                },
                {
                    "localizedValue": "Christening"
                },
                {
                    "localizedValue": "Christmas"
                },
                {
                    "localizedValue": "Confirmation/Communion"
                },
                {
                    "localizedValue": "Engagement"
                },
                {
                    "localizedValue": "Father's Day"
                },
                {
                    "localizedValue": "Graduation"
                },
                {
                    "localizedValue": "Mother's Day"
                },
                {
                    "localizedValue": "Valentine's Day"
                },
                {
                    "localizedValue": "Wedding"
                }
            ]
        },
        {
            "localizedAspectName": "Secondary Stone",
            "aspectConstraint": {
                "aspectDataType": "STRING",
                "itemToAspectCardinality": "MULTI",
                "aspectMode": "FREE_TEXT",
                "aspectRequired": false,
                "aspectUsage": "OPTIONAL",
                "aspectEnabledForVariations": false
            },
            "aspectValues": [
                {
                    "localizedValue": "Abalone Shell"
                },
                {
                    "localizedValue": "Agate"
                },
                {
                    "localizedValue": "Alexandrite"
                },
                {
                    "localizedValue": "Almandine Garnet"
                },
                {
                    "localizedValue": "Amazonite"
                },
                {
                    "localizedValue": "Amber"
                },
                {
                    "localizedValue": "Amethyst"
                },
                {
                    "localizedValue": "Ametrine"
                },
                {
                    "localizedValue": "Ammolite"
                },
                {
                    "localizedValue": "Ammonite"
                },
                {
                    "localizedValue": "Andalusite"
                },
                {
                    "localizedValue": "Apatite"
                },
                {
                    "localizedValue": "Aquamarine"
                },
                {
                    "localizedValue": "Aragonite"
                },
                {
                    "localizedValue": "Aventurine"
                },
                {
                    "localizedValue": "Axinite"
                },
                {
                    "localizedValue": "Azurite"
                },
                {
                    "localizedValue": "Beryl"
                },
                {
                    "localizedValue": "Black Opals"
                },
                {
                    "localizedValue": "Bloodstone/Heliotrope"
                },
                {
                    "localizedValue": "Boulder Opals"
                },
                {
                    "localizedValue": "Bronzite"
                },
                {
                    "localizedValue": "Calcite"
                },
                {
                    "localizedValue": "Carnelian"
                },
                {
                    "localizedValue": "Cat's Eye Quartz"
                },
                {
                    "localizedValue": "Chalcedony"
                },
                {
                    "localizedValue": "Charoite"
                },
                {
                    "localizedValue": "Chrome Diopside"
                },
                {
                    "localizedValue": "Chrysoberyl"
                },
                {
                    "localizedValue": "Chrysocolla"
                },
                {
                    "localizedValue": "Chrysoprase"
                },
                {
                    "localizedValue": "Citrine"
                },
                {
                    "localizedValue": "Coral"
                },
                {
                    "localizedValue": "Cubic Zirconia"
                },
                {
                    "localizedValue": "Demantoid Garnet"
                },
                {
                    "localizedValue": "Diamond"
                },
                {
                    "localizedValue": "Diaspore"
                },
                {
                    "localizedValue": "Diopside"
                },
                {
                    "localizedValue": "Doublet Opals"
                },
                {
                    "localizedValue": "Emerald"
                },
                {
                    "localizedValue": "Feldspar"
                },
                {
                    "localizedValue": "Fire Opals"
                },
                {
                    "localizedValue": "Fluorite"
                },
                {
                    "localizedValue": "Goldstone"
                },
                {
                    "localizedValue": "Green Amethyst (Prasiolite) Quartz"
                },
                {
                    "localizedValue": "Grossular Garnet"
                },
                {
                    "localizedValue": "Hematite"
               },
                {
                    "localizedValue": "Hessonite Garnet"
                },
                {
                    "localizedValue": "Hiddenite"
                },
                {
                    "localizedValue": "Howlite"
                },
                {
                    "localizedValue": "Iolite"
                },
                {
                    "localizedValue": "Jadeite"
                },
                {
                    "localizedValue": "Jasper"
                },
                {
                    "localizedValue": "Jet"
                },
                {
                    "localizedValue": "Kornerupine"
                },
                {
                    "localizedValue": "Kunzite"
                },
                {
                    "localizedValue": "Kyanite"
                },
                {
                    "localizedValue": "Labradorite"
                },
                {
                    "localizedValue": "Lapis Lazuli"
                },
                {
                    "localizedValue": "Larimar/Pectolite"
                },
                {
                    "localizedValue": "Lemon Quartz"
                },
                {
                    "localizedValue": "Lepidolite"
                },
                {
                    "localizedValue": "London Blue Topaz"
                },
                {
                    "localizedValue": "Madeira Citrine"
                },
                {
                    "localizedValue": "Magnesite"
                },
                {
                    "localizedValue": "Malachite"
                },
                {
                    "localizedValue": "Malaya Garnet"
                },
                {
                    "localizedValue": "Mandarin Garnet"
                },
                {
                    "localizedValue": "Man-Made Glass"
                },
                {
                    "localizedValue": "Marcasite"
                },
                {
                    "localizedValue": "Mint Tourmaline"
                },
                {
                    "localizedValue": "Moissanite"
                },
                {
                    "localizedValue": "Moldavite"
                },
                {
                    "localizedValue": "Mookaite"
                },
                {
                    "localizedValue": "Moonstone"
                },
                {
                    "localizedValue": "Morganite"
                },
                {
                    "localizedValue": "Mother of Pearl & Abalone"
                },
                {
                    "localizedValue": "Nephrite"
                },
                {
                    "localizedValue": "Obsidian"
                },
                {
                    "localizedValue": "Onyx"
                },
                {
                    "localizedValue": "Opalite"
                },
                {
                    "localizedValue": "Pearl"
                },
                {
                    "localizedValue": "Peridot"
                },
                {
                    "localizedValue": "Pietersite"
                },
                {
                    "localizedValue": "Prehnite"
                },
                {
                    "localizedValue": "Pyrite"
                },
                {
                    "localizedValue": "Pyrope Garnet"
                },
                {
                    "localizedValue": "Rainbow Calsilica"
                },
                {
                    "localizedValue": "Rhinestone"
                },
                {
                    "localizedValue": "Rhodochrosite"
                },
                {
                    "localizedValue": "Rhodolite Garnet"
                },
                {
                    "localizedValue": "Rhodonite"
               },
                {
                    "localizedValue": "Rhyolite"
                },
                {
                    "localizedValue": "Rock Crystal (Colorless) Quartz"
                },
                {
                    "localizedValue": "Rose Quartz"
                },
                {
                    "localizedValue": "Ruby"
                },
                {
                    "localizedValue": "Ruby in Fuchsite"
                },
                {
                    "localizedValue": "Ruby in Zoisite"
                },
                {
                    "localizedValue": "Rutilated Quartz"
                },
                {
                    "localizedValue": "Sandstone"
                },
                {
                    "localizedValue": "Sapphire"
                },
                {
                    "localizedValue": "Scapolite"
                },
                {
                    "localizedValue": "Seraphinite"
                },
                {
                    "localizedValue": "Serpentine"
                },
                {
                    "localizedValue": "Shattuckite"
                },
                {
                    "localizedValue": "Smoky Quartz"
                },
                {
                    "localizedValue": "Sodalite"
                },
                {
                    "localizedValue": "Spessartine Garnet"
                },
                {
                    "localizedValue": "Sphalerite"
                },
                {
                    "localizedValue": "Sphene/Titanite"
                },
                {
                    "localizedValue": "Spinel"
                },
                {
                    "localizedValue": "Strontium Titanate"
                },
                {
                    "localizedValue": "Sugilite"
                },
                {
                    "localizedValue": "Sunstone"
                },
                {
                    "localizedValue": "Swedish Slag"
                },
                {
                    "localizedValue": "Tanzanite"
                },
                {
                    "localizedValue": "Tashmarine Diopside"
                },
                {
                    "localizedValue": "Tiger's Eye"
                },
                {
                    "localizedValue": "Topaz"
                },
                {
                    "localizedValue": "Tourmaline"
                },
                {
                    "localizedValue": "Triplet Opals"
                },
                {
                    "localizedValue": "Tsavorite Garnet"
                },
                {
                    "localizedValue": "Turquoise"
                },
                {
                    "localizedValue": "Unakite"
                },
                {
                    "localizedValue": "White/Precious Opals"
                },
                {
                    "localizedValue": "Yttrium Aluminium Garnet"
                },
                {
                    "localizedValue": "Zandrite"
                },
                {
                    "localizedValue": "Zircon"
                },
                {
                    "localizedValue": "Not Applicable"
                }
            ]
        },
        {
            "localizedAspectName": "Country/Region of Manufacture",
            "aspectConstraint": {
                "aspectDataType": "STRING",
                "itemToAspectCardinality": "SINGLE",
                "aspectMode": "SELECTION_ONLY",
                "aspectRequired": false,
                "aspectUsage": "OPTIONAL",
                "aspectEnabledForVariations": false
            },
            "aspectValues": [
                {
                    "localizedValue": "Unknown"
                },
                {
                    "localizedValue": "Afghanistan"
                },
                {
                    "localizedValue": "Albania"
                },
                {
                    "localizedValue": "Algeria"
                },
                {
                    "localizedValue": "American Samoa"
                },
                {
                    "localizedValue": "Andorra"
                },
                {
                    "localizedValue": "Angola"
                },
                {
                    "localizedValue": "Anguilla"
                },
                {
                    "localizedValue": "Antarctica"
                },
                {
                    "localizedValue": "Antigua and Barbuda"
                },
                {
                    "localizedValue": "Argentina"
                },
                {
                    "localizedValue": "Armenia"
                },
                {
                    "localizedValue": "Aruba"
                },
                {
                    "localizedValue": "Australia"
                },
                {
                    "localizedValue": "Austria"
                },
                {
                    "localizedValue": "Azerbaijan"
                },
                {
                    "localizedValue": "Bahamas"
                },
               {
                    "localizedValue": "Bahrain"
                },
                {
                    "localizedValue": "Bangladesh"
                },
                {
                    "localizedValue": "Barbados"
                },
                {
                    "localizedValue": "Belarus"
                },
                {
                    "localizedValue": "Belgium"
                },
                {
                    "localizedValue": "Belize"
                },
                {
                    "localizedValue": "Benin"
                },
                {
                    "localizedValue": "Bermuda"
                },
                {
                    "localizedValue": "Bhutan"
                },
                {
                    "localizedValue": "Bolivia"
                },
                {
                    "localizedValue": "Bosnia and Herzegovina"
                },
                {
                    "localizedValue": "Botswana"
                },
                {
                    "localizedValue": "Bouvet Island"
                },
                {
                    "localizedValue": "Brazil"
                },
                {
                    "localizedValue": "British Indian Ocean Territory"
                },
                {
                    "localizedValue": "Brunei Darussalam"
                },
                {
                    "localizedValue": "Bulgaria"
                },
                {
                    "localizedValue": "Burkina Faso"
                },
                {
                    "localizedValue": "Burundi"
                },
                {
                    "localizedValue": "Cambodia"
                },
                {
                    "localizedValue": "Cameroon"
                },
                {
                    "localizedValue": "Canada"
                },
                {
                    "localizedValue": "Cape Verde"
                },
                {
                    "localizedValue": "Cayman Islands"
                },
                {
                    "localizedValue": "Central African Republic"
                },
                {
                    "localizedValue": "Chad"
                },
                {
                    "localizedValue": "Chile"
                },
                {
                    "localizedValue": "China"
                },
                {
                    "localizedValue": "Christmas Island"
                },
                {
                    "localizedValue": "Cocos (Keeling) Islands"
                },
                {
                    "localizedValue": "Colombia"
                },
                {
                    "localizedValue": "Comoros"
                },
                {
                    "localizedValue": "Congo"
                },
                {
                    "localizedValue": "Congo, The Democratic Republic of the"
                },
                {
                    "localizedValue": "Cook Islands"
                },
                {
                    "localizedValue": "Costa Rica"
                },
                {
                    "localizedValue": "Cote d'Ivoire"
                },
                {
                    "localizedValue": "Croatia"
                },
                {
                    "localizedValue": "Cyprus"
                },
                {
                    "localizedValue": "Czech Republic"
                },
                {
                    "localizedValue": "Denmark"
                },
                {
                    "localizedValue": "Djibouti"
                },
                {
                    "localizedValue": "Dominica"
                },
                {
                    "localizedValue": "Dominican Republic"
                },
                {
                    "localizedValue": "Ecuador"
                },
                {
                    "localizedValue": "Egypt"
                },
                {
                    "localizedValue": "El Salvador"
                },
                {
                    "localizedValue": "Equatorial Guinea"
                },
                {
                    "localizedValue": "Eritrea"
                },
                {
                    "localizedValue": "Estonia"
                },
                {
                    "localizedValue": "Ethiopia"
                },
                {
                    "localizedValue": "Falkland Islands (Malvinas)"
                },
                {
                    "localizedValue": "Faroe Islands"
                },
                {
                    "localizedValue": "Fiji"
                },
                {
                    "localizedValue": "Finland"
                },
                {
                    "localizedValue": "France"
                },
                {
                    "localizedValue": "French Guiana"
                },
                {
                    "localizedValue": "French Polynesia Includes Tahiti"
                },
                {
                    "localizedValue": "French Southern Territories"
                },
                {
                    "localizedValue": "Gabon"
                },
                {
                    "localizedValue": "Gambia"
                },
                {
                    "localizedValue": "Georgia"
                },
                {
                    "localizedValue": "Germany"
                },
                {
                    "localizedValue": "Ghana"
                },
                {
                    "localizedValue": "Gibraltar"
                },
                {
                    "localizedValue": "Greece"
                },
                {
                    "localizedValue": "Greenland"
               },
                {
                    "localizedValue": "Grenada"
                },
                {
                    "localizedValue": "Guadeloupe"
                },
                {
                    "localizedValue": "Guam"
                },
                {
                    "localizedValue": "Guatemala"
                },
                {
                    "localizedValue": "Guernsey"
                },
                {
                    "localizedValue": "Guinea"
                },
                {
                    "localizedValue": "Guinea-Bissau"
                },
                {
                    "localizedValue": "Guyana"
                },
                {
                    "localizedValue": "Haiti"
                },
                {
                    "localizedValue": "Heard Island and Mcdonald Islands"
                },
                {
                    "localizedValue": "Holy See (Vatican City State)"
                },
                {
                    "localizedValue": "Honduras"
                },
                {
                    "localizedValue": "Hong Kong"
                },
                {
                    "localizedValue": "Hungary"
                },
                {
                    "localizedValue": "Iceland"
                },
                {
                    "localizedValue": "India"
                },
                {
                    "localizedValue": "Indonesia"
                },
                {
                    "localizedValue": "Iraq"
                },
                {
                    "localizedValue": "Ireland"
                },
                {
                    "localizedValue": "Israel"
                },
                {
                    "localizedValue": "Italy"
                },
                {
                    "localizedValue": "Jamaica"
                },
                {
                    "localizedValue": "Japan"
                },
                {
                    "localizedValue": "Jersey"
                },
                {
                    "localizedValue": "Jordan"
                },
                {
                    "localizedValue": "Kazakhstan"
                },
                {
                    "localizedValue": "Kenya"
                },
                {
                    "localizedValue": "Kiribati"
                },
                {
                    "localizedValue": "Korea, Republic of"
                },
                {
                    "localizedValue": "Kuwait"
                },
                {
                    "localizedValue": "Kyrgyzstan"
                },
                {
                    "localizedValue": "Lao People's Democratic Republic"
                },
                {
                    "localizedValue": "Latvia"
                },
                {
                    "localizedValue": "Lebanon"
                },
                {
                    "localizedValue": "Lesotho"
                },
                {
                    "localizedValue": "Liberia"
                },
                {
                    "localizedValue": "Libyan Arab Jamahiriya"
                },
                {
                    "localizedValue": "Liechtenstein"
                },
                {
                    "localizedValue": "Lithuania"
                },
                {
                    "localizedValue": "Luxembourg"
                },
                {
                    "localizedValue": "Macao"
                },
                {
                    "localizedValue": "Macedonia, the Former Yugoslav Republic of"
                },
                {
                    "localizedValue": "Madagascar"
                },
                {
                    "localizedValue": "Malawi"
                },
                {
                    "localizedValue": "Malaysia"
                },
                {
                    "localizedValue": "Maldives"
                },
                {
                    "localizedValue": "Mali"
                },
                {
                    "localizedValue": "Malta"
                },
                {
                    "localizedValue": "Marshall Islands"
                },
                {
                    "localizedValue": "Martinique"
                },
                {
                    "localizedValue": "Mauritania"
                },
                {
                    "localizedValue": "Mauritius"
                },
                {
                    "localizedValue": "Mayotte"
                },
                {
                    "localizedValue": "Mexico"
                },
                {
                    "localizedValue": "Micronesia, Federated States of"
                },
                {
                    "localizedValue": "Moldova, Republic of"
                },
                {
                    "localizedValue": "Monaco"
                },
                {
                    "localizedValue": "Mongolia"
                },
                {
                    "localizedValue": "Montenegro"
                },
                {
                    "localizedValue": "Montserrat"
                },
                {
                    "localizedValue": "Morocco"
                },
                {
                    "localizedValue": "Mozambique"
                },
                {
                    "localizedValue": "Namibia"
                },
                {
                    "localizedValue": "Nauru"
                },
                {
                    "localizedValue": "Nepal"
                },
                {
                    "localizedValue": "Netherlands"
                },
                {
                    "localizedValue": "Netherlands Antilles"
                },
                {
                    "localizedValue": "New Caledonia"
                },
                {
                    "localizedValue": "New Zealand"
                },
                {
                    "localizedValue": "Nicaragua"
                },
                {
                    "localizedValue": "Niger"
                },
                {
                    "localizedValue": "Nigeria"
                },
                {
                    "localizedValue": "Niue"
                },
                {
                    "localizedValue": "Norfolk Island"
                },
                {
                    "localizedValue": "Northern Mariana Islands"
                },
                {
                    "localizedValue": "Norway"
                },
                {
                    "localizedValue": "Oman"
                },
                {
                    "localizedValue": "Pakistan"
                },
                {
                    "localizedValue": "Palau"
                },
                {
                    "localizedValue": "Palestinian Territories"
                },
                {
                    "localizedValue": "Panama"
                },
                {
                    "localizedValue": "Papua New Guinea"
                },
                {
                    "localizedValue": "Paraguay"
                },
                {
                    "localizedValue": "Peru"
                },
                {
                    "localizedValue": "Philippines"
                },
                {
                    "localizedValue": "Pitcairn"
                },
                {
                    "localizedValue": "Poland"
                },
                {
                    "localizedValue": "Portugal"
                },
                {
                    "localizedValue": "Puerto Rico"
                },
                {
                    "localizedValue": "Qatar"
                },
                {
                    "localizedValue": "Reunion"
                },
                {
                    "localizedValue": "Romania"
                },
                {
                    "localizedValue": "Russian Federation"
                },
                {
                    "localizedValue": "Rwanda"
                },
                {
                    "localizedValue": "Saint Helena"
                },
                {
                    "localizedValue": "Saint Kitts and Nevis"
                },
                {
                    "localizedValue": "Saint Lucia"
                },
                {
                    "localizedValue": "Saint Pierre and Miquelon"
                },
                {
                    "localizedValue": "Saint Vincent and the Grenadines"
                },
                {
                    "localizedValue": "Samoa"
                },
                {
                    "localizedValue": "San Marino"
                },
                {
                    "localizedValue": "Sao Tome and Principe"
                },
                {
                    "localizedValue": "Saudi Arabia"
                },
                {
                    "localizedValue": "Senegal"
                },
                {
                    "localizedValue": "Serbia"
                },
                {
                    "localizedValue": "Seychelles"
                },
                {
                    "localizedValue": "Sierra Leone"
                },
                {
                    "localizedValue": "Singapore"
                },
                {
                    "localizedValue": "Slovakia"
                },
                {
                    "localizedValue": "Slovenia"
                },
                {
                    "localizedValue": "Solomon Islands"
                },
                {
                    "localizedValue": "Somalia"
                },
                {
                    "localizedValue": "South Africa"
                },
                {
                    "localizedValue": "South Georgia and the South Sandwich Islands"
                },
                {
                    "localizedValue": "Spain"
                },
                {
                    "localizedValue": "Sri Lanka"
                },
                {
                    "localizedValue": "Suriname"
                },
                {
                    "localizedValue": "Svalbard and Jan Mayen"
                },
                {
                    "localizedValue": "Swaziland"
                },
                {
                    "localizedValue": "Sweden"
                },
                {
                    "localizedValue": "Switzerland"
                },
                {
                    "localizedValue": "Taiwan"
                },
                {
                    "localizedValue": "Tajikistan"
                },
                {
                    "localizedValue": "Tanzania, United Republic of"
                },
                {
                    "localizedValue": "Thailand"
                },
                {
                    "localizedValue": "Togo"
                },
                {
                    "localizedValue": "Tokelau"
                },
                {
                    "localizedValue": "Tonga"
                },
                {
                    "localizedValue": "Trinidad and Tobago"
                },
                {
                    "localizedValue": "Tunisia"
                },
                {
                    "localizedValue": "Turkey"
                },
                {
                    "localizedValue": "Turkmenistan"
                },
                {
                    "localizedValue": "Turks and Caicos Islands"
                },
                {
                    "localizedValue": "Tuvalu"
                },
                {
                    "localizedValue": "Uganda"
                },
                {
                    "localizedValue": "Ukraine"
                },
                {
                    "localizedValue": "United Arab Emirates"
                },
                {
                    "localizedValue": "United Kingdom"
                },
                {
                    "localizedValue": "United States"
                },
                {
                    "localizedValue": "Uruguay"
                },
                {
                    "localizedValue": "Uzbekistan"
                },
                {
                    "localizedValue": "Vanuatu"
                },
                {
                    "localizedValue": "Venezuela"
                },
                {
                    "localizedValue": "Vietnam"
                },
                {
                    "localizedValue": "Virgin Islands, British"
                },
                {
                    "localizedValue": "Virgin Islands, U S"
                },
                {
                    "localizedValue": "Wallis and Futuna"
                },
                {
                    "localizedValue": "Western Sahara"
                },
                {
                    "localizedValue": "Yemen"
                },
                {
                    "localizedValue": "Zambia"
                },
                {
                    "localizedValue": "Zimbabwe"
                }
            ]
        },
        {
            "localizedAspectName": "Total Carat Weight",
            "aspectConstraint": {
                "aspectDataType": "STRING",
                "itemToAspectCardinality": "SINGLE",
                "aspectMode": "FREE_TEXT",
                "aspectRequired": false,
                "aspectUsage": "OPTIONAL",
                "aspectEnabledForVariations": false
            },
            "aspectValues": [
                {
                    "localizedValue": "0.24 & Under"
                },
                {
                    "localizedValue": "0.25 - 0.32"
                },
                {
                    "localizedValue": "0.33 - 0.49"
                },
                {
                    "localizedValue": "0.50 - 0.74"
                },
                {
                    "localizedValue": "0.75 - 0.99"
                },
                {
                    "localizedValue": "1.00 - 1.24"
                },
                {
                    "localizedValue": "1.25 - 1.49"
                },
                {
                    "localizedValue": "1.50 - 1.74"
                },
                {
                    "localizedValue": "1.75 - 1.99"
                },
                {
                    "localizedValue": "10.00 & Over"
                },
                {
                    "localizedValue": "2.00 - 4.99"
                },
                {
                    "localizedValue": "5.00 - 9.99"
                }
            ]
        }
    ]
}
```

---

## Sample 2: Get the expected required by date for an aspect

This sample retrieves an array of aspects for the specified leaf category, including the expected date after which aspects will be required.
	 **Note: ** The category specified in this sample is a *test* category used for example purposes only.

### Input

Use the **category_tree_id** path parameter to specify the category tree, and use the **category_id** query parameter to specify the leaf category for which the associated aspects should be retrieved.

```http
GET https://api.ebay.com/commerce/taxonomy/v1/category_tree/0/get_item_aspects_for_category?category_id=178090
```

### Output

A successful call returns a list of aspects associated with category `178090`, including the expected date after which each aspect will be required, if available.

```json
{
   "aspects":[
      {
         "localizedAspectName":"Game",
         "aspectConstraint":{
            "aspectDataType":"STRING",
            "itemToAspectCardinality":"SINGLE",
            "aspectMode":"FREE_TEXT",
            "aspectRequired":true,
            "aspectUsage":"RECOMMENDED",
            "aspectEnabledForVariations":true
         },
         "aspectValues":[
            {
               "localizedValue":"Anachronism"
            },
            {
               "localizedValue":"Basket Ball"
            },
            {
               "localizedValue":"Battle Spirits"
            },
            {
               "localizedValue":"Bleach"
            },
            {
               "localizedValue":"Blood Wars"
            },
            {
               "localizedValue":"Cardfight Vangaurd"
            },
            {
               "localizedValue":"Soccer"
            },
            {
               "localizedValue":"Swimming"
            },
            {
               "localizedValue":"Tennis"
            },
            {
               "localizedValue":"Volley Ball"
            }
         ]
      },
      {
         "localizedAspectName":"PBC Test Modfier 3",
         "aspectConstraint":{
            "aspectDataType":"STRING",
            "itemToAspectCardinality":"SINGLE",
            "aspectMode":"FREE_TEXT",
            "aspectRequired":true,
            "aspectUsage":"RECOMMENDED",
            "aspectEnabledForVariations":true
         },
         "aspectValues":[
            {
               "localizedValue":"Test Value 1"
            },
            {
               "localizedValue":"Test Value 2"
            }
         ]
      },
      {
         "localizedAspectName":"Autograph Format",
         "aspectConstraint":{
            "aspectDataType":"STRING",
            "itemToAspectCardinality":"SINGLE",
            "aspectMode":"FREE_TEXT",
            "aspectRequired":true,
            "aspectUsage":"RECOMMENDED",
            "aspectEnabledForVariations":true
         },
         "aspectValues":[
            {
               "localizedValue":"Hard Signed",
               "valueConstraints":[
                  {
                     "applicableForLocalizedAspectName":"Modified Product",
                     "applicableForLocalizedAspectValues":[
                        "Yes"
                     ]
                  }
               ]
            },
            {
               "localizedValue":"Sticker",
               "valueConstraints":[
                  {
                     "applicableForLocalizedAspectName":"Modified Product",
                     "applicableForLocalizedAspectValues":[
                        "Yes"
                     ]
                  }
               ]
            }
         ]
      },
      {
         "localizedAspectName":"A Is Modified",
         "aspectConstraint":{
            "aspectDataType":"STRING",
            "itemToAspectCardinality":"SINGLE",
            "aspectMode":"FREE_TEXT",
            "aspectRequired":true,
            "aspectUsage":"RECOMMENDED",
            "aspectEnabledForVariations":false
         }
      },
      {
         "localizedAspectName":"Brand",
         "aspectConstraint":{
            "aspectDataType":"STRING",
            "itemToAspectCardinality":"SINGLE",
            "aspectMode":"FREE_TEXT",
            "aspectRequired":false,
            "aspectUsage":"RECOMMENDED",
            "aspectEnabledForVariations":false,
            "expectedRequiredByDate":"2020-02-18T00:00:00.000Z"
         }
      },
      {
         "localizedAspectName":"PBC Test Modifier 1",
         "aspectConstraint":{
            "aspectDataType":"STRING",
            "itemToAspectCardinality":"SINGLE",
            "aspectMode":"FREE_TEXT",
            "aspectRequired":false,
            "aspectUsage":"RECOMMENDED",
            "aspectEnabledForVariations":true,
            "expectedRequiredByDate":"2020-02-18T12:00:00.000Z"
         },
         "aspectValues":[
            {
               "localizedValue":"Test Value 1"
            },
            {
               "localizedValue":"Test Value 2"
            }
         ]
      },
      {
         "localizedAspectName":"Is Autographed",
         "aspectConstraint":{
            "aspectDataType":"STRING",
            "itemToAspectCardinality":"SINGLE",
            "aspectMode":"FREE_TEXT",
            "aspectRequired":false,
            "aspectUsage":"RECOMMENDED",
            "aspectEnabledForVariations":true,
            "expectedRequiredByDate":"2020-02-18T12:00:00.000Z"
         },
         "aspectValues":[
            {
               "localizedValue":"Yes",
               "valueConstraints":[
                  {
                     "applicableForLocalizedAspectName":"Modified Product",
                     "applicableForLocalizedAspectValues":[
                        "Yes"
                     ]
                  }
               ]
            }
         ]
      },
      {
         "localizedAspectName":"PBC Test Modfier 2",
         "aspectConstraint":{
            "aspectDataType":"STRING",
            "itemToAspectCardinality":"MULTI",
            "aspectMode":"FREE_TEXT",
            "aspectRequired":false,
            "aspectUsage":"RECOMMENDED",
            "aspectEnabledForVariations":true,
            "expectedRequiredByDate":"2020-05-19T21:00:00.000Z"
         },
         "aspectValues":[
            {
               "localizedValue":"Test Value 1",
               "valueConstraints":[
                  {
                     "applicableForLocalizedAspectName":"PBC Test Modifier 1",
                     "applicableForLocalizedAspectValues":[
                        "Test Value 1"
                     ]
                  }
               ]
            },
            {
               "localizedValue":"Test Value 2",
               "valueConstraints":[
                  {
                     "applicableForLocalizedAspectName":"PBC Test Modifier 1",
                     "applicableForLocalizedAspectValues":[
                        "Test Value 1"
                     ]
                  }
               ]
            },
            {
               "localizedValue":"Test Value 3",
               "valueConstraints":[
                  {
                     "applicableForLocalizedAspectName":"PBC Test Modifier 1",
                     "applicableForLocalizedAspectValues":[
                        "Test Value 1"
                     ]
                  }
               ]
            },
            {
               "localizedValue":"Test Value 4",
               "valueConstraints":[
                  {
                     "applicableForLocalizedAspectName":"PBC Test Modifier 1",
                     "applicableForLocalizedAspectValues":[
                        "Test Value 1"
                     ]
                  }
               ]
            }
         ]
      },
      {
         "localizedAspectName":"Rarity",
         "aspectConstraint":{
            "aspectDataType":"STRING",
            "itemToAspectCardinality":"SINGLE",
            "aspectMode":"FREE_TEXT",
            "aspectRequired":false,
            "aspectUsage":"RECOMMENDED",
            "aspectEnabledForVariations":true,
            "expectedRequiredByDate":"2020-05-19T21:00:00.000Z"
         },
         "aspectValues":[
            {
               "localizedValue":"Common"
            },
            {
               "localizedValue":"Uncommon"
            },
            {
               "localizedValue":"1"
            }
         ]
      },
      {
         "localizedAspectName":"A Test1 D1",
         "aspectConstraint":{
            "aspectDataType":"STRING",
            "itemToAspectCardinality":"SINGLE",
            "aspectMode":"FREE_TEXT",
            "aspectRequired":false,
            "aspectUsage":"RECOMMENDED",
            "aspectEnabledForVariations":true,
            "expectedRequiredByDate":"2020-05-19T21:00:00.000Z"
         }
      },
      {
         "localizedAspectName":"A Is AutoG",
         "aspectConstraint":{
            "aspectDataType":"STRING",
            "itemToAspectCardinality":"SINGLE",
            "aspectMode":"FREE_TEXT",
            "aspectRequired":false,
            "aspectUsage":"RECOMMENDED",
            "aspectEnabledForVariations":false,
            "expectedRequiredByDate":"2020-02-18T00:00:00.000Z"
         }
      },
      {
         "localizedAspectName":"A Test1",
         "aspectConstraint":{
            "aspectDataType":"STRING",
            "itemToAspectCardinality":"SINGLE",
            "aspectMode":"FREE_TEXT",
            "aspectRequired":false,
            "aspectUsage":"RECOMMENDED",
            "aspectEnabledForVariations":false,
            "expectedRequiredByDate":"2020-05-19T21:00:00.000Z"
         }
      },
      {
         "localizedAspectName":"Is Bundle",
         "aspectConstraint":{
            "aspectDataType":"STRING",
            "itemToAspectCardinality":"SINGLE",
            "aspectMode":"FREE_TEXT",
            "aspectRequired":false,
            "aspectUsage":"RECOMMENDED",
            "aspectEnabledForVariations":true
         },
         "aspectValues":[
            {
               "localizedValue":"Yes"
            },
            {
               "localizedValue":"No"
            }
         ]
      },
      {
         "localizedAspectName":"A Mod Details",
         "aspectConstraint":{
            "aspectDataType":"STRING",
            "itemToAspectCardinality":"SINGLE",
            "aspectMode":"FREE_TEXT",
            "aspectRequired":false,
            "aspectUsage":"OPTIONAL",
            "aspectEnabledForVariations":true
         }
      },
      {
         "localizedAspectName":"Bundle Details",
         "aspectConstraint":{
            "aspectDataType":"STRING",
            "itemToAspectCardinality":"SINGLE",
            "aspectMode":"FREE_TEXT",
            "aspectRequired":false,
            "aspectUsage":"OPTIONAL",
            "aspectEnabledForVariations":true
         }
      },
      {
         "localizedAspectName":"Modified Product",
         "aspectConstraint":{
            "aspectDataType":"STRING",
            "itemToAspectCardinality":"SINGLE",
            "aspectMode":"FREE_TEXT",
            "aspectRequired":false,
            "aspectUsage":"OPTIONAL",
            "aspectEnabledForVariations":true
         },
         "aspectValues":[
            {
               "localizedValue":"Yes"
            },
            {
               "localizedValue":"No"
            }
         ]
      },
      {
         "localizedAspectName":"Modification Details",
         "aspectConstraint":{
            "aspectDataType":"STRING",
            "itemToAspectCardinality":"SINGLE",
            "aspectMode":"FREE_TEXT",
            "aspectRequired":false,
            "aspectUsage":"OPTIONAL",
            "aspectEnabledForVariations":true
         }
      },
      {
         "localizedAspectName":"California Prop 65 Warning",
         "aspectConstraint":{
            "aspectDataType":"STRING",
            "itemToAspectCardinality":"SINGLE",
            "aspectMode":"FREE_TEXT",
            "aspectRequired":false,
            "aspectUsage":"OPTIONAL",
            "aspectEnabledForVariations":false,
            "aspectMaxLength":800,
            "aspectApplicableTo":[
               "ITEM"
            ]
         }
      }
   ]
}
```

---

