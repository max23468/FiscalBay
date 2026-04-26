# Changelog

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

## [0.3.0](https://github.com/max23468/eBayCF/compare/v0.2.0...v0.3.0) (2026-04-19)


### Features

* complete phase 1 runtime and onboarding flow ([210c8f6](https://github.com/max23468/eBayCF/commit/210c8f6650648312a02e816816022dfbcc15334a))
* complete phase 2 admin guardrails ([1d3193b](https://github.com/max23468/eBayCF/commit/1d3193b473e4c9af3003e0a5407d271c22fce1f0))
* improve final oauth onboarding ux ([68cfc5c](https://github.com/max23468/eBayCF/commit/68cfc5ce6d8decd7eec1a0320d7a6457975bd004))
* refine phase 1 account and notification UX ([153c0cb](https://github.com/max23468/eBayCF/commit/153c0cbe7242a2236a224e2d792adaf5c07a963f))


### Bug Fixes

* preserve VPS runtime files during sync ([834069a](https://github.com/max23468/eBayCF/commit/834069a136e0c039f55e934928b4c2caa9645c86))
* prevent release asset upload cancellation ([#23](https://github.com/max23468/eBayCF/issues/23)) ([eb8abb2](https://github.com/max23468/eBayCF/commit/eb8abb2afd68d025dbe3335479762d9bd132535f))
* refine empty admin views ([ffb247c](https://github.com/max23468/eBayCF/commit/ffb247c5e2b506466038f31fef205c6907210f73))
* run VPS install script with sudo ([eda23c8](https://github.com/max23468/eBayCF/commit/eda23c873eedf780de5f765a6c30f7cf3ab0af34))
* satisfy phase 2 lint checks ([a66ef59](https://github.com/max23468/eBayCF/commit/a66ef5910b96dd1927d8992c43fd3ec8855d9758))
* update systemd bot entrypoint ([496265c](https://github.com/max23468/eBayCF/commit/496265c467d921ddf3c9d05047b12e6aecd201e5))

## [0.2.0](https://github.com/max23468/eBayCF/compare/v0.1.0...v0.2.0) (2026-04-18)


### Features

* Add Docker, SQLite, and expanded eBay field extraction ([f255664](https://github.com/max23468/eBayCF/commit/f2556649098f186df9bab8c8d551c0fbfccab361))
* add support for Telegram message threads and update command documentation ([645c342](https://github.com/max23468/eBayCF/commit/645c342f76efc4aa8ab5c26fb3bcac949a9a558b))
* enhance telegram bot UI with improved formatting, order links, and emoji styling ([2fbc29c](https://github.com/max23468/eBayCF/commit/2fbc29c0820f3ff301e3430457b4be099996c9db))
* update bot responses to enhance user experience with localized messages ([a4aa1db](https://github.com/max23468/eBayCF/commit/a4aa1db660b3110f359656ba6ecf449978ecb65f))


### Bug Fixes

* strengthen order payload typing and clean lint issues ([a1de331](https://github.com/max23468/eBayCF/commit/a1de331a02a9b0be3643a4bffd949d2d0fb388f3))
* use tenant runtime state in healthcheck ([97ea9e4](https://github.com/max23468/eBayCF/commit/97ea9e4447b7ef09195c59b7c941e43b95cde804))

## Changelog

Questo e' il changelog ufficiale delle release del progetto.

E' gestito automaticamente da `release-please` a partire dalla prossima release GitHub.

Per lo storico narrativo precedente all'adozione del nuovo flusso, vedere `docs/CHANGELOG.md`.
