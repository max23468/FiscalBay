# Changelog

## [1.12.2](https://github.com/max23468/FiscalBay/compare/v1.12.1...v1.12.2) (2026-07-21)

### Bug Fixes

* prevent VPS deploy from breaking sqlite on Python upgrade ([6ac2bdf](https://github.com/max23468/FiscalBay/commit/6ac2bdf84e6fee89594459658c13b766d825bd17))

### Maintenance

* prevent invalid PR titles (#114) ([4939cec](https://github.com/max23468/FiscalBay/commit/4939cece170a51a680df79a00fef81d5b7680267))
* retry transient GraphQL 401 in codex inbox sync ([dfe55f3](https://github.com/max23468/FiscalBay/commit/dfe55f3e0caf4d2af06c72bb4c3007f0ef03b63a))
* bump dev toolchain pins (ruff 0.15.22, coverage 7.15.2, build 1.5.0) ([95977dc](https://github.com/max23468/FiscalBay/commit/95977dcec19b9580c0d73441bbf1fc9a9fb9c58b))

### Other Changes

* Track CLAUDE.md (project instructions, mirror di AGENTS.md) ([493d304](https://github.com/max23468/FiscalBay/commit/493d304c343229eb33e510935f8ced94e62d84ca))
* Point CLAUDE.md to AGENTS.md via @import ([cbef548](https://github.com/max23468/FiscalBay/commit/cbef54837ded191838da81f01c1472285f4dcac5))

## [1.12.1](https://github.com/max23468/FiscalBay/compare/v1.12.0...v1.12.1) (2026-06-03)

### Bug Fixes

* defer Python setup validation ([d722853](https://github.com/max23468/FiscalBay/commit/d7228536086d98ebf7aeb69ff038f22be5fb6b95))
* harden Doppler secret check (#88) ([125b4c0](https://github.com/max23468/FiscalBay/commit/125b4c000f074683ae93db952b42ec02c610bd8e))
* harden CI secret handling and security docs ([297bee0](https://github.com/max23468/FiscalBay/commit/297bee0777cb690c5b0e8303582ad05d47541bc7))
* bootstrap Python 3.13 before runtime selection ([f8d1042](https://github.com/max23468/FiscalBay/commit/f8d10420a50dab02e3edf6e96c0085a9f5e14163))
* honor queued reconciliation status payloads (#110) ([7fda2ad](https://github.com/max23468/FiscalBay/commit/7fda2adf06ebb6eec0a4cc55c6e296f42b4704b4))
* increase coverage for offline order flows (#111) ([c14ae32](https://github.com/max23468/FiscalBay/commit/c14ae32bd38fc216b0bcc982909d9e18ef54d5b8))
* validate queued access status payloads ([9c65f9a](https://github.com/max23468/FiscalBay/commit/9c65f9a6821874762744468fb2f09fd30d6cd5da))
* preserve queued access state for invalid statuses (#112) ([44383a9](https://github.com/max23468/FiscalBay/commit/44383a9e3d47b5ae80c98732cd85cb2a1f86ae30))

### Maintenance

* align Linux setup with Python 3.13 runtime (#77) ([01e09a2](https://github.com/max23468/FiscalBay/commit/01e09a2f2163a2862b26ca3cb0f17be190e07b25))
* align Atlas semantic governance [skip ci] ([2ce0456](https://github.com/max23468/FiscalBay/commit/2ce0456d2f56f9f407e529bd132827e7852c785a))
* update Python tooling pins [skip ci] (#80) ([d67c912](https://github.com/max23468/FiscalBay/commit/d67c9127f0f1b962051a4fa40f0f80b3954d5b92))
* publish pending local changes (FiscalBay) (#81) ([be05702](https://github.com/max23468/FiscalBay/commit/be05702f4f2f62bfc39cdbe00e42297fe7d3cd87))
* align publish semantics across repo policy (#82) ([9ab0ce2](https://github.com/max23468/FiscalBay/commit/9ab0ce2caf0066b656f6a7467b51ab252251f6a5))
* add security hardening plan ([ac24cf5](https://github.com/max23468/FiscalBay/commit/ac24cf58aa6be1a04d053dd5f963c6f6a1a5cef0))
* address Codex feedback in security operations docs (#84) ([ce8baa2](https://github.com/max23468/FiscalBay/commit/ce8baa248b5ea7f3c0827c25b8f37ea0d0ea2959))
* resolve Codex actionable comments (#85) ([b29b35a](https://github.com/max23468/FiscalBay/commit/b29b35a96ce338895b49c725edfdf4e5bae0dd51))
* add Doppler setup checks to workflows (#87) ([5dec954](https://github.com/max23468/FiscalBay/commit/5dec954b83736f107254b0b04ac537052a1d9a3c))
* allow automatic doppler-check workflow ([29c44ff](https://github.com/max23468/FiscalBay/commit/29c44ffa07443aa0cd4328e66286796fba61323b))
* align AGENTS operating rules ([65bb3fe](https://github.com/max23468/FiscalBay/commit/65bb3fed714ec390b035fb12cf659ae3e9f131e0))
* close AGENTS decision gaps (#90) ([adc5de5](https://github.com/max23468/FiscalBay/commit/adc5de54b409919e16ee31648cb9b79454bf971c))
* chiarisci catalogo documentale agenti (#91) ([dbff3c7](https://github.com/max23468/FiscalBay/commit/dbff3c787ac7445c38da566d787ff3aa0ace3644))
* completa manutenzione catalogo (#92) ([10b1292](https://github.com/max23468/FiscalBay/commit/10b129242f95ed45923650391cf093bc8558b238))
* normalizza roadmap ([6bb36b5](https://github.com/max23468/FiscalBay/commit/6bb36b54be9e518f8751bcd1f5d78e72f333a94a))
* allinea versione roadmap ([f851a6b](https://github.com/max23468/FiscalBay/commit/f851a6bef609136a530db2f1fd0e059637aca9a0))
* normalize ADR template path (#95) ([1f9cd16](https://github.com/max23468/FiscalBay/commit/1f9cd167d7a7a7e3ac6db8d3c696e09fdc59257b))
* align context handoff (#96) ([29919ce](https://github.com/max23468/FiscalBay/commit/29919ce137478fec3baf63c8b2bfc923073a768a))
* align Python runtime to 3.13 ([ea0f12a](https://github.com/max23468/FiscalBay/commit/ea0f12acab6d9f1d428652aef54849134fab577c))
* label Codex feedback inbox (#99) ([6ea8b57](https://github.com/max23468/FiscalBay/commit/6ea8b571a798041505e159705c917495a713908e))
* preserve Codex inbox label migration ([043fd56](https://github.com/max23468/FiscalBay/commit/043fd56c14aba0fbd6c216c535c58e717cf244cf))
* remove CODEOWNERS (#101) ([ab8d86d](https://github.com/max23468/FiscalBay/commit/ab8d86d02aa3e95102aa4aeb8c0f483aa0f96586))
* align verification lanes (#102) ([691ddaf](https://github.com/max23468/FiscalBay/commit/691ddafa259b0b64c8c22ddc234d78f4baf82138))
* clarify web OAuth checks ([3afa56f](https://github.com/max23468/FiscalBay/commit/3afa56f5e3a004344893ce8056113d21d73c384f))
* clarify runtime output exclusions (#104) ([79cd4bc](https://github.com/max23468/FiscalBay/commit/79cd4bcf27679b014a0539619554d6fe021867c1))
* bump ruff from 0.15.14 to 0.15.15 (#105) ([876efda](https://github.com/max23468/FiscalBay/commit/876efdaba823bed884ca4198a1f47f4b2fd0c4d8))
* bump the github-actions group with 4 updates (#106) ([3faf4ef](https://github.com/max23468/FiscalBay/commit/3faf4efd31e0fe83a6fedcae61872d60d977d5b3))
* clarify project maturity and completion criteria (#107) ([df174d2](https://github.com/max23468/FiscalBay/commit/df174d2fea290cdb0bc872e2f79cb861a58bf22f))
* clarify brand and glossary governance (#108) ([d22e7f9](https://github.com/max23468/FiscalBay/commit/d22e7f9433d47b16169c9f81e8f603df140ac69a))
* document Superpowers operating rules (#109) ([2f92a95](https://github.com/max23468/FiscalBay/commit/2f92a959e42f53d0516c9da403f0d5370da11156))

## [1.12.0](https://github.com/max23468/FiscalBay/compare/v1.11.2...v1.12.0) (2026-05-23)

### Features

* support controlled Python runtime migration ([2dbb340](https://github.com/max23468/FiscalBay/commit/2dbb340ff3c7128a5060b5bf99025759b196a737))

### Bug Fixes

* corregge accento nel messaggio callback OAuth (#67) ([5be8328](https://github.com/max23468/FiscalBay/commit/5be8328e06039f83fae74932e0d00bbed7e28262))
* preserve Codex feedback inbox entries ([45cb921](https://github.com/max23468/FiscalBay/commit/45cb9214ca257bb900eeab3ebc3980dbea4b0bd7))
* align Codex feedback inbox workflow ([b54063f](https://github.com/max23468/FiscalBay/commit/b54063fdc48aab22704a825b3139f8dcb05b7c9d))
* preserve inbox entries on partial scans ([55994dc](https://github.com/max23468/FiscalBay/commit/55994dc04d5e59b6e1d5d541133978e83f004e35))

### Maintenance

* limit repeated bot comment checks ([55df277](https://github.com/max23468/FiscalBay/commit/55df277827d95347fbac695e304f98f4043f06ce))
* complete publish flow instructions ([2f3532a](https://github.com/max23468/FiscalBay/commit/2f3532a227a46ba52517647503f18c8df257f90e))
* split telegram command handlers ([2e848eb](https://github.com/max23468/FiscalBay/commit/2e848ebbf0fc0ac33d50487afd144ad367b0f15d))
* add Codex feedback inbox workflow ([6fe89e1](https://github.com/max23468/FiscalBay/commit/6fe89e15db71288774ee3d8a03665bb47da6d94a))
* document chat next steps policy ([387dc43](https://github.com/max23468/FiscalBay/commit/387dc4341dc8d592ad69059e3290462c5f92c23a))
* unify Codex feedback inbox (#73) ([0bc64a4](https://github.com/max23468/FiscalBay/commit/0bc64a4c5226966b3382a3e95178a7a5dd1bda4c))
* harden Codex inbox detection (#74) ([ad64aba](https://github.com/max23468/FiscalBay/commit/ad64aba1faecc98f69af70225c127391a3e70867))
* retry Codex GitHub rate limits (#75) ([12eda71](https://github.com/max23468/FiscalBay/commit/12eda7180bd6807f28171f9432c3159ee97f7359))

## [1.11.2](https://github.com/max23468/FiscalBay/compare/v1.11.1...v1.11.2) (2026-05-02)

### Bug Fixes

* migrate retry backlog before counting ([2d7b180](https://github.com/max23468/FiscalBay/commit/2d7b1807ae8f898c2adb53e4e2882ec5719acb77))

## [1.11.1](https://github.com/max23468/FiscalBay/compare/v1.11.0...v1.11.1) (2026-05-02)

### Bug Fixes

* resolve pending bot review findings ([b25a177](https://github.com/max23468/FiscalBay/commit/b25a177883da5481281dc71deb69f0f350df41da))

### Maintenance

* raise coverage gate and simplify checks ([a84561b](https://github.com/max23468/FiscalBay/commit/a84561b5022f041d53ac525cff81aae815ae13f6))
* clarify publish versus deploy policy ([d3426d8](https://github.com/max23468/FiscalBay/commit/d3426d8f41cb1dccb8f8edf7944fb49768802c17))
* clarify bot comment review scope ([92a5735](https://github.com/max23468/FiscalBay/commit/92a573504727c959ac2167bc30238975b5e568bf))
* require all-pr bot comment checks ([289129a](https://github.com/max23468/FiscalBay/commit/289129a556175a3fbd671fcce5310a947ad95a57))

## [1.11.0](https://github.com/max23468/FiscalBay/compare/v1.10.0...v1.11.0) (2026-05-01)

### Features

* add fiscal search and missing tax alerts ([060bdab](https://github.com/max23468/FiscalBay/commit/060bdabd051a8ebfc5fec041d509c14d9b48b3fe))

### Maintenance

* add release please automation ([399772a](https://github.com/max23468/FiscalBay/commit/399772a93bf6e486b42659376db6b060f8d92155))
* add conservative github automation ([d38c565](https://github.com/max23468/FiscalBay/commit/d38c565d38c43a65e41d127325168b469f517a4e))
* run release please on node 24 ([1702643](https://github.com/max23468/FiscalBay/commit/1702643163ffdc78f750fa90febac3ea8f6ed899))
* update release please to node 24 ([16791f4](https://github.com/max23468/FiscalBay/commit/16791f42292e4ff97d08c09a59651393fe42f7ed))

## [1.10.0](https://github.com/max23468/FiscalBay/compare/v1.9.0...v1.10.0) (2026-05-01)

### Features

* reintroduce lightweight github actions ci ([176d99b](https://github.com/max23468/FiscalBay/commit/176d99b63caf59f5cc229d99fb32b8f75c98df62))

## [1.9.0](https://github.com/max23468/FiscalBay/compare/v1.8.0...v1.9.0) (2026-04-29)

### Features

* improve selective onboarding ([5cc0387](https://github.com/max23468/FiscalBay/commit/5cc03873df1b1f1f21a37582006815a8684fddd4))

## [1.8.0](https://github.com/max23468/FiscalBay/compare/v1.7.0...v1.8.0) (2026-04-29)

### Features

* add tenant support snapshot ([3e89e51](https://github.com/max23468/FiscalBay/commit/3e89e518fd9b6a5143d1d49aa76ce75bb2cf6f7f))

## [1.7.0](https://github.com/max23468/FiscalBay/compare/v1.6.0...v1.7.0) (2026-04-29)

### Features

* add seller fiscal export ([e521531](https://github.com/max23468/FiscalBay/commit/e5215311412e074b0832637d2065ad8596fd314b))

## [1.6.0](https://github.com/max23468/FiscalBay/compare/v1.5.0...v1.6.0) (2026-04-28)

### Features

* add scale readiness check ([0cea3f4](https://github.com/max23468/FiscalBay/commit/0cea3f4959b503b7bc4adae378da4b0b1c5397c0))

## [1.5.0](https://github.com/max23468/FiscalBay/compare/v1.4.0...v1.5.0) (2026-04-28)

### Features

* add security operations check ([31bda1d](https://github.com/max23468/FiscalBay/commit/31bda1d91b5ebe4dc75ce2e0fc74d4907b5d88fd))

## [1.4.0](https://github.com/max23468/FiscalBay/compare/v1.3.0...v1.4.0) (2026-04-28)

### Features

* add admin operational history ([db5530e](https://github.com/max23468/FiscalBay/commit/db5530e527ebdeab74a6475d768948aefa49dcaa))

## [1.3.0](https://github.com/max23468/FiscalBay/compare/v1.2.0...v1.3.0) (2026-04-28)

### Features

* add assisted data requests ([3cc854e](https://github.com/max23468/FiscalBay/commit/3cc854e908c61df1192e5a9bd19ced49eb8b59fe))

## [1.2.0](https://github.com/max23468/FiscalBay/compare/v1.1.1...v1.2.0) (2026-04-28)

### Features

* improve disconnect and reconnect guidance ([87b1245](https://github.com/max23468/FiscalBay/commit/87b124563d7f9b7db657c8bca0856448e9f9dd2d))

## [1.1.1](https://github.com/max23468/FiscalBay/compare/v1.1.0...v1.1.1) (2026-04-28)

### Bug Fixes

* expose package release tag without git checkout ([1945fbe](https://github.com/max23468/FiscalBay/commit/1945fbe413e9361a77e5327bcdd0b4ece5787926))

## [1.1.0](https://github.com/max23468/FiscalBay/compare/v1.0.1...v1.1.0) (2026-04-28)

### Features

* expose release metadata in admin healthcheck ([3a304cc](https://github.com/max23468/FiscalBay/commit/3a304ccaf5f11ee1dec526b8ba3cd033cf2237fd))

## [1.0.1](https://github.com/max23468/FiscalBay/compare/v1.0.0...v1.0.1) (2026-04-28)

### Bug Fixes

* improve telegram order notification formatting ([d6aae5b](https://github.com/max23468/FiscalBay/commit/d6aae5bd6ee619521325e3e626944b83e540c3e0))

### Maintenance

* structure 1.x roadmap ([4370443](https://github.com/max23468/FiscalBay/commit/4370443cb1e6bbee6a2d80e7ebdeb1b1372f16fd))

## [1.0.0](https://github.com/max23468/FiscalBay/compare/v0.20.0...v1.0.0) (2026-04-28)

### Features

* declare FiscalBay 1.0 readiness ([cb5f868](https://github.com/max23468/FiscalBay/commit/cb5f868bd7fbfe56f6910fcd664c11cb25bb3690))

## [0.20.0](https://github.com/max23468/FiscalBay/compare/v0.19.0...v0.20.0) (2026-04-28)

### Features

* surface admin product metrics ([cf26404](https://github.com/max23468/FiscalBay/commit/cf26404b86a7e128e43ae5e3b83c9fa43b1ba9ce))

## [0.19.0](https://github.com/max23468/FiscalBay/compare/v0.18.1...v0.19.0) (2026-04-28)

### Features

* configure user rate limits ([db7cfbd](https://github.com/max23468/FiscalBay/commit/db7cfbd9b13805eea39fb81bb6cc88c61eebf990))

## [0.18.1](https://github.com/max23468/FiscalBay/compare/v0.18.0...v0.18.1) (2026-04-28)

### Bug Fixes

* avoid login shell in hardened services ([7781346](https://github.com/max23468/FiscalBay/commit/7781346922c27f86e131deac2dd5623e4441f8bf))

## [0.18.0](https://github.com/max23468/FiscalBay/compare/v0.17.0...v0.18.0) (2026-04-28)

### Features

* consolidate public service operations ([b4448f0](https://github.com/max23468/FiscalBay/commit/b4448f002764e1644552d31e861d323a54864332))

## [0.17.0](https://github.com/max23468/FiscalBay/compare/v0.16.0...v0.17.0) (2026-04-28)

### Features

* add VPS recovery guardrails ([c485794](https://github.com/max23468/FiscalBay/commit/c485794baf8bda71d27c1478c12791dd6e48a950))

## [0.16.0](https://github.com/max23468/FiscalBay/compare/v0.15.0...v0.16.0) (2026-04-28)

### Features

* complete application storage optimization ([3601a41](https://github.com/max23468/FiscalBay/commit/3601a41f18db3f77f70979a7ee14612e4ed8441a))

## [0.15.0](https://github.com/max23468/FiscalBay/compare/v0.14.0...v0.15.0) (2026-04-28)

### Features

* complete data lifecycle retention ([307661c](https://github.com/max23468/FiscalBay/commit/307661c051245ad0edc3387f79bbb81e0ef83388))

## [0.14.0](https://github.com/max23468/FiscalBay/compare/v0.13.4...v0.14.0) (2026-04-28)

### Features

* add Telegram fiscal id copy button ([a23a822](https://github.com/max23468/FiscalBay/commit/a23a822306ca9906cd794f42302a31a3e2b4d73f))

## [0.13.4](https://github.com/max23468/FiscalBay/compare/v0.13.3...v0.13.4) (2026-04-28)

### Bug Fixes

* use portable curl flags for DuckDNS updates ([4db1138](https://github.com/max23468/FiscalBay/commit/4db11384fc33e261614b822975e6ec4c67d1b8ff))

## [0.13.3](https://github.com/max23468/FiscalBay/compare/v0.13.2...v0.13.3) (2026-04-28)

### Bug Fixes

* improve telegram order formatting ([9a3eb47](https://github.com/max23468/FiscalBay/commit/9a3eb47957a77d2cf51bb1617f2a5698187d8c9d))
* polish fiscal metadata formatting ([aba2eda](https://github.com/max23468/FiscalBay/commit/aba2eda0baab90cdb894497d3c3c07e685cabea4))
* show order id in telegram messages ([cbf77b7](https://github.com/max23468/FiscalBay/commit/cbf77b71a0c26bced833426a565b577310cec670))
* harden VPS automation and OAuth notifications ([8779719](https://github.com/max23468/FiscalBay/commit/87797197e853e4103b4dfa10f6cb95e0d9d19cdf))
* check failed FiscalBay units in smoke deploy ([5087748](https://github.com/max23468/FiscalBay/commit/50877489444f1c3bcfb32c7cfbbd453be1f3e7df))

## [0.13.2](https://github.com/max23468/FiscalBay/compare/v0.13.1...v0.13.2) (2026-04-28)

### Bug Fixes

* isolate eBay account relink tokens ([860f12c](https://github.com/max23468/FiscalBay/commit/860f12ca2a8a3e1999148c7f8a90124830c63598))
* force eBay login during account link ([6a6c68a](https://github.com/max23468/FiscalBay/commit/6a6c68a78e45b3e92c79826bc91ed664bb33b0fe))
* skip unsupported eBay remote revocation ([b49b118](https://github.com/max23468/FiscalBay/commit/b49b118db2989e592c6f1f66d2326e894615b62b))
* recover fiscal identifiers from trading orders ([0f9922d](https://github.com/max23468/FiscalBay/commit/0f9922d81e367ccfaa61fdc13dfbdc3236959851))

## [0.13.1](https://github.com/max23468/FiscalBay/compare/v0.13.0...v0.13.1) (2026-04-28)

### Bug Fixes

* include maintenance commits in releases ([082be98](https://github.com/max23468/FiscalBay/commit/082be9841985d1bb018ccd3266a2c7b4cb8b808b))

### Maintenance

* remove release-please legacy assets ([651cce3](https://github.com/max23468/FiscalBay/commit/651cce3c6fc1981acf1580f94cb37bdf1d9fcecd))

## [0.13.0](https://github.com/max23468/FiscalBay/compare/v0.12.1...v0.13.0) (2026-04-28)

### Features

* simplify Telegram command menu ([ebddbdc](https://github.com/max23468/FiscalBay/commit/ebddbdce82b16bd372fb8d830e5ddf77a2a982ce))
* simplify release and deploy workflow ([ca3cae7](https://github.com/max23468/FiscalBay/commit/ca3cae7538a9f8f56c58b41d64fbb59ada42a80e))

## [0.12.1](https://github.com/max23468/FiscalBay/compare/v0.12.0...v0.12.1) (2026-04-28)


### Bug Fixes

* hide ping from non-admin bot commands ([518ae39](https://github.com/max23468/FiscalBay/commit/518ae39bc22cf648fe565ab4a7cea931964fcdaa))
* hide Telegram admin controls without configured admin ([071dcfc](https://github.com/max23468/FiscalBay/commit/071dcfc6468212b092192e8f141e1d3803d4515e))

## [0.12.0](https://github.com/max23468/FiscalBay/compare/v0.11.0...v0.12.0) (2026-04-28)


### Features

* add contextual Telegram keyboards ([b34eba4](https://github.com/max23468/FiscalBay/commit/b34eba4993e78fe9edcfdc996d523bfd96ef1079))
* simplify Telegram bot commands ([065ce97](https://github.com/max23468/FiscalBay/commit/065ce9751f46249ce395e2bf19e9a35cd6b2fac9))
* streamline Telegram help and menu ([48835df](https://github.com/max23468/FiscalBay/commit/48835df43a4897cdfee5c5d9ea728b5c7f2bd078))


### Bug Fixes

* restrict Telegram admin commands to configured admin ([7671182](https://github.com/max23468/FiscalBay/commit/76711827dcfe8351364e1c07b774f8b575b1d37c))

## [0.11.0](https://github.com/max23468/FiscalBay/compare/v0.10.0...v0.11.0) (2026-04-28)


### Features

* include order details in fiscal notifications ([c51867b](https://github.com/max23468/FiscalBay/commit/c51867b2ebb6df792dbf1eb675b129b6f9d4c75f))


### Bug Fixes

* guard date formatting timezone fallback ([4014b6c](https://github.com/max23468/FiscalBay/commit/4014b6cf8d1ad5721cb636b6e6e30355b0c6ffd0))

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

Questo è il changelog ufficiale delle release del progetto.

È gestito dal comando esplicito `scripts/release_now.sh`.

Per lo storico narrativo precedente all'adozione del nuovo flusso, vedere `docs/CHANGELOG_ARCHIVE.md`.
