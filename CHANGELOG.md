# Changelog

## [0.10.0](https://github.com/max23468/FiscalBay/compare/v0.9.2...v0.10.0) (2026-04-28)


### Features

* add local automation without GitHub Actions ([3f0264c](https://github.com/max23468/FiscalBay/commit/3f0264c413490f4d7cc0582dc526ffa3c7f4e46f))
* add public FiscalBay landing page ([d8ffb49](https://github.com/max23468/FiscalBay/commit/d8ffb49e3f0884e8d42e25fb8a2b01ab32de053d))
* add VPS release-please automation ([b5cc004](https://github.com/max23468/FiscalBay/commit/b5cc0045a6d07fa5f76022b4477748a6cb34cb1d))
* automate full VPS release pipeline ([f38e376](https://github.com/max23468/FiscalBay/commit/f38e37687490ce2d3184d869a730771b906ed1e8))
* expose OAuth branding pages ([331a814](https://github.com/max23468/FiscalBay/commit/331a814e77837796ab78187fbc469b9409546ba2))


### Bug Fixes

* clear stale runtime errors after successful cycles ([25beaaa](https://github.com/max23468/FiscalBay/commit/25beaaabd936eb5ad830b6471764a55a123f9f20))
* harden VPS release automation ([151c93f](https://github.com/max23468/FiscalBay/commit/151c93facc905888f9f900809835d6538eac1db2))
* keep public site Telegram-first ([adfe267](https://github.com/max23468/FiscalBay/commit/adfe267756a18bab9316a3792fb646a68f6dc217))
* proxy public favicon assets ([41ead72](https://github.com/max23468/FiscalBay/commit/41ead727789fba8194614e1d80eeee183b832c1a))
* separate deploy smoke from upstream health ([13997b2](https://github.com/max23468/FiscalBay/commit/13997b258c52044ee0d3121278113085108740b4))
* serve public site favicons ([07c1ec4](https://github.com/max23468/FiscalBay/commit/07c1ec4d1c2f2758cca051f1faf5be900a76105c))
* use accented OAuth invalid-link copy ([28ad40b](https://github.com/max23468/FiscalBay/commit/28ad40be450cca1d2f8a2799e49a16e9fd76615e))

## [0.9.2](https://github.com/max23468/FiscalBay/compare/v0.9.1...v0.9.2) (2026-04-26)


### Bug Fixes

* gracefully fallback when ebay order detail rejects order id ([49abe31](https://github.com/max23468/FiscalBay/commit/49abe3190fa1119d52a411b6e47bc81f7639de36))
* normalize buyer tax identifier alias fields ([ef9705a](https://github.com/max23468/FiscalBay/commit/ef9705a4a37f90e040568531b8b5057f4b9c2d26))
* read buyer tax identifiers from alternate ebay payload shapes ([904c076](https://github.com/max23468/FiscalBay/commit/904c0769a717d3271a3d7f9d508e041dbc7348da))
* retry detail lookup with legacyOrderId before summary fallback ([a8a0118](https://github.com/max23468/FiscalBay/commit/a8a0118a597b90ea233d1d3617ee60adf8bf1fe2))

## [0.9.1](https://github.com/max23468/FiscalBay/compare/v0.9.0...v0.9.1) (2026-04-26)


### Bug Fixes

* correct single-order diagnostic shell error handling ([846ec53](https://github.com/max23468/FiscalBay/commit/846ec538a68a5edce3031cb496258b6b77a93bf2))

## [0.9.0](https://github.com/max23468/FiscalBay/compare/v0.8.1...v0.9.0) (2026-04-26)


### Features

* Add Docker, SQLite, and expanded eBay field extraction ([f255664](https://github.com/max23468/FiscalBay/commit/f2556649098f186df9bab8c8d551c0fbfccab361))
* add eBay identity check to VPS diagnostic workflow ([495249f](https://github.com/max23468/FiscalBay/commit/495249f827529a474aed601392d06cd51110d35b))
* add single-order raw payload diagnostic to VPS workflow ([25978d9](https://github.com/max23468/FiscalBay/commit/25978d951fa7b4bd2f95e8802ec158d9bc9a5873))
* add support for Telegram message threads and update command documentation ([645c342](https://github.com/max23468/FiscalBay/commit/645c342f76efc4aa8ab5c26fb3bcac949a9a558b))
* add VPS workflow option to enforce identity scope ([9946cf8](https://github.com/max23468/FiscalBay/commit/9946cf81760db4448e7fe785402a98c63982057c))
* capture VPS EBAY_SCOPES in diagnostics artifact ([2869c73](https://github.com/max23468/FiscalBay/commit/2869c733fbaf198fe2d2263fe0eba19e55342f09))
* complete phase 1 runtime and onboarding flow ([210c8f6](https://github.com/max23468/FiscalBay/commit/210c8f6650648312a02e816816022dfbcc15334a))
* complete phase 2 admin guardrails ([1d3193b](https://github.com/max23468/FiscalBay/commit/1d3193b473e4c9af3003e0a5407d271c22fce1f0))
* enhance telegram bot UI with improved formatting, order links, and emoji styling ([2fbc29c](https://github.com/max23468/FiscalBay/commit/2fbc29c0820f3ff301e3430457b4be099996c9db))
* finalize FiscalBay branding system ([#30](https://github.com/max23468/FiscalBay/issues/30)) ([fb36938](https://github.com/max23468/FiscalBay/commit/fb3693863bb6751e67a69c9b3b05bbb59f2e2e51))
* improve final oauth onboarding ux ([68cfc5c](https://github.com/max23468/FiscalBay/commit/68cfc5ce6d8decd7eec1a0320d7a6457975bd004))
* improve Telegram bot product and admin workflows ([#38](https://github.com/max23468/FiscalBay/issues/38)) ([efc85e4](https://github.com/max23468/FiscalBay/commit/efc85e420ce40272974ba34de1818c87bd8f2d1e))
* notify admin when a new Telegram user is first seen ([3e3df11](https://github.com/max23468/FiscalBay/commit/3e3df11c6c06910550e4ce2255e02b4dd4e9724b))
* refine phase 1 account and notification UX ([153c0cb](https://github.com/max23468/FiscalBay/commit/153c0cbe7242a2236a224e2d792adaf5c07a963f))
* support fiscal identifiers and migrate runtime metrics ([3559031](https://github.com/max23468/FiscalBay/commit/3559031391f3c2840a130b2ed3426f0204cfbdf4))
* support TELEGRAM_ALLOWED_CHAT_IDS=* for admin approval flow ([008c83b](https://github.com/max23468/FiscalBay/commit/008c83b0829a8cfea9c41abdd9587f9e8849ec03))
* update bot responses to enhance user experience with localized messages ([a4aa1db](https://github.com/max23468/FiscalBay/commit/a4aa1db660b3110f359656ba6ecf449978ecb65f))


### Bug Fixes

* align deploy automation with fiscalbay ([fbd7744](https://github.com/max23468/FiscalBay/commit/fbd7744dde7031a94aea2d8933056cdd83f77908))
* avoid redundant telegram branding sync ([#35](https://github.com/max23468/FiscalBay/issues/35)) ([3e84ebc](https://github.com/max23468/FiscalBay/commit/3e84ebc98f6d1d746b899547ae8a5590cd0c9ac9))
* avoid shell quoting break in python runtime check ([929689d](https://github.com/max23468/FiscalBay/commit/929689d0d7e0e37c3d19a410f83d15e75b26b495))
* improve /ordine feedback for invalid eBay order ids ([4141855](https://github.com/max23468/FiscalBay/commit/4141855f11c6c419031509117dc39b1c352cf1fc))
* include identity scope in default eBay scopes ([01314b4](https://github.com/max23468/FiscalBay/commit/01314b41947ee688eb4b9cbbbce90e2a1db84187))
* keep identity diagnostic non-blocking on scope errors ([60f0df1](https://github.com/max23468/FiscalBay/commit/60f0df11b689059d7ea190305d5b11e5f51a3ae6))
* keep legacy VPS secrets for deploy ([1996140](https://github.com/max23468/FiscalBay/commit/1996140dc771196d328acbf7803a8f29061f2693))
* keep VPS diagnostics running when one step fails ([bd83f83](https://github.com/max23468/FiscalBay/commit/bd83f8376ec6407431dd0c7542146786bbf6458c))
* keep VPS order diagnostic working when identity scope is unsupported ([cac3f58](https://github.com/max23468/FiscalBay/commit/cac3f58b02ec4096e71822b487ed426d3b74819a))
* log release please outputs safely ([d73a3d2](https://github.com/max23468/FiscalBay/commit/d73a3d2aaf5d7cab32f1b2e0ee6ee23329669cde))
* pass debug_order_id into VPS single-order diagnostic ([3fd0039](https://github.com/max23468/FiscalBay/commit/3fd0039729056b4a66dc1cfa574c90f4f65b24c1))
* preserve VPS runtime files during sync ([834069a](https://github.com/max23468/FiscalBay/commit/834069a136e0c039f55e934928b4c2caa9645c86))
* prevent release asset upload cancellation ([#23](https://github.com/max23468/FiscalBay/issues/23)) ([eb8abb2](https://github.com/max23468/FiscalBay/commit/eb8abb2afd68d025dbe3335479762d9bd132535f))
* quote EBAY_SCOPES when updating VPS env ([70b4b20](https://github.com/max23468/FiscalBay/commit/70b4b20fd811efa1d107d471b0f882f14d93ab50))
* quote production environment in identity diagnostic ([77408c1](https://github.com/max23468/FiscalBay/commit/77408c15a33ad6c523f72c0cfdba70c0a57fc457))
* refine empty admin views ([ffb247c](https://github.com/max23468/FiscalBay/commit/ffb247c5e2b506466038f31fef205c6907210f73))
* refresh cached tenant account status after oauth success ([1d5a6ea](https://github.com/max23468/FiscalBay/commit/1d5a6ea2fa20830a767b64a426d9b8d1ebf4b033))
* remove admin ping side effects from runtime contact sync ([c8c2405](https://github.com/max23468/FiscalBay/commit/c8c24054f2719059eb6d41309ff6187481f4d5bf))
* remove telegram avatar edge halo ([#37](https://github.com/max23468/FiscalBay/issues/37)) ([b70c9b8](https://github.com/max23468/FiscalBay/commit/b70c9b8e1cb4bb6ba4714b4575a7a98cdff71421))
* report OAuth scopes in VPS identity diagnostic ([847abf4](https://github.com/max23468/FiscalBay/commit/847abf46dc8112ae91aaf7fdbf579549232c844d))
* restore valid YAML for VPS diagnostic workflow ([7216e29](https://github.com/max23468/FiscalBay/commit/7216e29591fb8b385c3bd81d81da0d9ab93302e6))
* retry smoke check after bot restart ([#33](https://github.com/max23468/FiscalBay/issues/33)) ([1cc181d](https://github.com/max23468/FiscalBay/commit/1cc181d92d69f2b2b27375ef6b9ce42638b7ce7c))
* run VPS diagnostic under fiscalbay user context ([d1cd048](https://github.com/max23468/FiscalBay/commit/d1cd04899746f381fc00acb8fb3a4e20b0631df9))
* run VPS diagnostic with supported python runtime ([1cf4a4c](https://github.com/max23468/FiscalBay/commit/1cf4a4ca52c9a20c4b812196295c86e2d9e03ea2))
* run VPS install script with sudo ([eda23c8](https://github.com/max23468/FiscalBay/commit/eda23c873eedf780de5f765a6c30f7cf3ab0af34))
* satisfy phase 2 lint checks ([a66ef59](https://github.com/max23468/FiscalBay/commit/a66ef5910b96dd1927d8992c43fd3ec8855d9758))
* sort telegram bot test imports ([#31](https://github.com/max23468/FiscalBay/issues/31)) ([b27862a](https://github.com/max23468/FiscalBay/commit/b27862aab227050493f33a3fe097732bd647150a))
* strengthen order payload typing and clean lint issues ([a1de331](https://github.com/max23468/FiscalBay/commit/a1de331a02a9b0be3643a4bffd949d2d0fb388f3))
* update systemd bot entrypoint ([496265c](https://github.com/max23468/FiscalBay/commit/496265c467d921ddf3c9d05047b12e6aecd201e5))
* use dedicated token for release please publishing ([#41](https://github.com/max23468/FiscalBay/issues/41)) ([bf09419](https://github.com/max23468/FiscalBay/commit/bf09419c036b68718bd7199604cd7f835a47f384))
* use tenant runtime state in healthcheck ([97ea9e4](https://github.com/max23468/FiscalBay/commit/97ea9e4447b7ef09195c59b7c941e43b95cde804))

## [0.8.1](https://github.com/max23468/FiscalBay/compare/v0.8.0...v0.8.1) (2026-04-26)


### Bug Fixes

* pass debug_order_id into VPS single-order diagnostic ([3fd0039](https://github.com/max23468/FiscalBay/commit/3fd0039729056b4a66dc1cfa574c90f4f65b24c1))

## [0.8.0](https://github.com/max23468/FiscalBay/compare/v0.7.0...v0.8.0) (2026-04-26)


### Features

* add eBay identity check to VPS diagnostic workflow ([495249f](https://github.com/max23468/FiscalBay/commit/495249f827529a474aed601392d06cd51110d35b))
* add single-order raw payload diagnostic to VPS workflow ([25978d9](https://github.com/max23468/FiscalBay/commit/25978d951fa7b4bd2f95e8802ec158d9bc9a5873))
* add VPS workflow option to enforce identity scope ([9946cf8](https://github.com/max23468/FiscalBay/commit/9946cf81760db4448e7fe785402a98c63982057c))
* capture VPS EBAY_SCOPES in diagnostics artifact ([2869c73](https://github.com/max23468/FiscalBay/commit/2869c733fbaf198fe2d2263fe0eba19e55342f09))
* notify admin when a new Telegram user is first seen ([3e3df11](https://github.com/max23468/FiscalBay/commit/3e3df11c6c06910550e4ce2255e02b4dd4e9724b))


### Bug Fixes

* avoid shell quoting break in python runtime check ([929689d](https://github.com/max23468/FiscalBay/commit/929689d0d7e0e37c3d19a410f83d15e75b26b495))
* improve /ordine feedback for invalid eBay order ids ([4141855](https://github.com/max23468/FiscalBay/commit/4141855f11c6c419031509117dc39b1c352cf1fc))
* include identity scope in default eBay scopes ([01314b4](https://github.com/max23468/FiscalBay/commit/01314b41947ee688eb4b9cbbbce90e2a1db84187))
* keep identity diagnostic non-blocking on scope errors ([60f0df1](https://github.com/max23468/FiscalBay/commit/60f0df11b689059d7ea190305d5b11e5f51a3ae6))
* keep VPS order diagnostic working when identity scope is unsupported ([cac3f58](https://github.com/max23468/FiscalBay/commit/cac3f58b02ec4096e71822b487ed426d3b74819a))
* quote EBAY_SCOPES when updating VPS env ([70b4b20](https://github.com/max23468/FiscalBay/commit/70b4b20fd811efa1d107d471b0f882f14d93ab50))
* quote production environment in identity diagnostic ([77408c1](https://github.com/max23468/FiscalBay/commit/77408c15a33ad6c523f72c0cfdba70c0a57fc457))
* refresh cached tenant account status after oauth success ([1d5a6ea](https://github.com/max23468/FiscalBay/commit/1d5a6ea2fa20830a767b64a426d9b8d1ebf4b033))
* remove admin ping side effects from runtime contact sync ([c8c2405](https://github.com/max23468/FiscalBay/commit/c8c24054f2719059eb6d41309ff6187481f4d5bf))
* report OAuth scopes in VPS identity diagnostic ([847abf4](https://github.com/max23468/FiscalBay/commit/847abf46dc8112ae91aaf7fdbf579549232c844d))
* restore valid YAML for VPS diagnostic workflow ([7216e29](https://github.com/max23468/FiscalBay/commit/7216e29591fb8b385c3bd81d81da0d9ab93302e6))
* run VPS diagnostic under fiscalbay user context ([d1cd048](https://github.com/max23468/FiscalBay/commit/d1cd04899746f381fc00acb8fb3a4e20b0631df9))
* run VPS diagnostic with supported python runtime ([1cf4a4c](https://github.com/max23468/FiscalBay/commit/1cf4a4ca52c9a20c4b812196295c86e2d9e03ea2))

## [0.7.0](https://github.com/max23468/FiscalBay/compare/v0.6.1...v0.7.0) (2026-04-26)


### Features

* support TELEGRAM_ALLOWED_CHAT_IDS=* for admin approval flow ([008c83b](https://github.com/max23468/FiscalBay/commit/008c83b0829a8cfea9c41abdd9587f9e8849ec03))

## [0.6.1](https://github.com/max23468/FiscalBay/compare/v0.6.0...v0.6.1) (2026-04-20)


### Bug Fixes

* use dedicated token for release please publishing ([#41](https://github.com/max23468/FiscalBay/issues/41)) ([bf09419](https://github.com/max23468/FiscalBay/commit/bf09419c036b68718bd7199604cd7f835a47f384))

## [0.6.0](https://github.com/max23468/FiscalBay/compare/v0.5.0...v0.6.0) (2026-04-20)


### Features

* improve Telegram bot product and admin workflows ([#38](https://github.com/max23468/FiscalBay/issues/38)) ([efc85e4](https://github.com/max23468/FiscalBay/commit/efc85e420ce40272974ba34de1818c87bd8f2d1e))

## [0.5.0](https://github.com/max23468/FiscalBay/compare/v0.4.0...v0.5.0) (2026-04-20)

### Features

* supporta identificativi fiscali generici nel bot e nella CLI

### Bug Fixes

* migra le metriche SQLite dal naming legacy `orders_with_cf`

## [0.4.0](https://github.com/max23468/FiscalBay/compare/v0.3.0...v0.4.0) (2026-04-20)


### Features

* finalize FiscalBay branding system ([#30](https://github.com/max23468/FiscalBay/issues/30)) ([fb36938](https://github.com/max23468/FiscalBay/commit/fb3693863bb6751e67a69c9b3b05bbb59f2e2e51))


### Bug Fixes

* align deploy automation with fiscalbay ([fbd7744](https://github.com/max23468/FiscalBay/commit/fbd7744dde7031a94aea2d8933056cdd83f77908))
* keep legacy VPS secrets for deploy ([1996140](https://github.com/max23468/FiscalBay/commit/1996140dc771196d328acbf7803a8f29061f2693))

## [0.3.0](https://github.com/max23468/FiscalBay/compare/v0.2.0...v0.3.0) (2026-04-19)


### Features

* complete phase 1 runtime and onboarding flow ([210c8f6](https://github.com/max23468/FiscalBay/commit/210c8f6650648312a02e816816022dfbcc15334a))
* complete phase 2 admin guardrails ([1d3193b](https://github.com/max23468/FiscalBay/commit/1d3193b473e4c9af3003e0a5407d271c22fce1f0))
* improve final oauth onboarding ux ([68cfc5c](https://github.com/max23468/FiscalBay/commit/68cfc5ce6d8decd7eec1a0320d7a6457975bd004))
* refine phase 1 account and notification UX ([153c0cb](https://github.com/max23468/FiscalBay/commit/153c0be7242a2236a224e2d792adaf5c07a963f))


### Bug Fixes

* preserve VPS runtime files during sync ([834069a](https://github.com/max23468/FiscalBay/commit/834069a136e0c039f55e934928b4c2caa9645c86))
* prevent release asset upload cancellation ([#23](https://github.com/max23468/FiscalBay/issues/23)) ([eb8abb2](https://github.com/max23468/FiscalBay/commit/eb8abb2afd68d025dbe3335479762d9bd132535f))
* refine empty admin views ([ffb247c](https://github.com/max23468/FiscalBay/commit/ffb247c5e2b506466038f31fef205c6907210f73))
* run VPS install script with sudo ([eda23c8](https://github.com/max23468/FiscalBay/commit/eda23c873eedf780de5f765a6c30f7cf3ab0af34))
* satisfy phase 2 lint checks ([a66ef59](https://github.com/max23468/FiscalBay/commit/a66ef5910b96dd1927d8992c43fd3ec8855d9758))
* update systemd bot entrypoint ([496265c](https://github.com/max23468/FiscalBay/commit/496265c467d921ddf3c9d05047b12e6aecd201e5))

## [0.2.0](https://github.com/max23468/FiscalBay/compare/v0.1.0...v0.2.0) (2026-04-18)


### Features

* Add Docker, SQLite, and expanded eBay field extraction ([f255664](https://github.com/max23468/FiscalBay/commit/f2556649098f186df9bab8c8d551c0fbfccab361))
* add support for Telegram message threads and update command documentation ([645c342](https://github.com/max23468/FiscalBay/commit/645c342f76efc4aa8ab5c26fb3bcac949a9a558b))
* enhance telegram bot UI with improved formatting, order links, and emoji styling ([2fbc29c](https://github.com/max23468/FiscalBay/commit/2fbc29c0820f3ff301e3430457b4be099996c9db))
* update bot responses to enhance user experience with localized messages ([a4aa1db](https://github.com/max23468/FiscalBay/commit/a4aa1db660b3110f359656ba6ecf449978ecb65f))


### Bug Fixes

* strengthen order payload typing and clean lint issues ([a1de331](https://github.com/max23468/FiscalBay/commit/a1de331a02a9b0be3643a4bffd949d2d0fb388f3))
* use tenant runtime state in healthcheck ([97ea9e4](https://github.com/max23468/FiscalBay/commit/97ea9e4447b7ef09195c59b7c941e43b95cde804))

## Changelog

Questo e' il changelog ufficiale delle release del progetto.

E' gestito automaticamente da `release-please` a partire dalla prossima release GitHub.

Per lo storico narrativo precedente all'adozione del nuovo flusso, vedere `docs/CHANGELOG.md`.
