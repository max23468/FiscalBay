# Changelog

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
