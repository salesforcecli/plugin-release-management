# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [1.7.1](https://github.com/salesforcecli/plugin-release-management/compare/v1.7.0...v1.7.1) (2021-02-26)

## [1.7.0](https://github.com/salesforcecli/plugin-release-management/compare/v1.6.3...v1.7.0) (2021-02-26)


### Features

* run version script ([a6edaa5](https://github.com/salesforcecli/plugin-release-management/commit/a6edaa50c514d1374da605115acd32ee42c39338))

### [1.6.3](https://github.com/salesforcecli/plugin-release-management/compare/v1.6.2...v1.6.3) (2021-02-22)


### Bug Fixes

* use correct stable channel ([#42](https://github.com/salesforcecli/plugin-release-management/issues/42)) ([2be3040](https://github.com/salesforcecli/plugin-release-management/commit/2be3040b3ffff2dea64c4b9829237b3fef7e7a60))

### [1.6.2](https://github.com/salesforcecli/plugin-release-management/compare/v1.6.1...v1.6.2) (2021-02-20)


### Bug Fixes

* update prepack script ([c0b05e9](https://github.com/salesforcecli/plugin-release-management/commit/c0b05e9b29a278be605e4ea5a95bf962c413135d))

### [1.6.1](https://github.com/salesforcecli/plugin-release-management/compare/v1.6.0...v1.6.1) (2021-02-20)


### Bug Fixes

* update package.json ([4cc8cee](https://github.com/salesforcecli/plugin-release-management/commit/4cc8cee600d138e7f677b67a881c64d108017cbc))

## [1.6.0](https://github.com/salesforcecli/plugin-release-management/compare/v1.5.1...v1.6.0) (2021-02-19)


### Features

* add cli:versions:inspect command [skip-validate-pr] ([#39](https://github.com/salesforcecli/plugin-release-management/issues/39)) ([2178468](https://github.com/salesforcecli/plugin-release-management/commit/21784680f0125c23ecb50b45f6862fa8b80c5b5d))

### [1.5.1](https://github.com/salesforcecli/plugin-release-management/compare/v1.5.0...v1.5.1) (2021-02-04)


### Bug Fixes

* fetch git tags before searching for latest ([#37](https://github.com/salesforcecli/plugin-release-management/issues/37)) ([8d7e0ec](https://github.com/salesforcecli/plugin-release-management/commit/8d7e0ec1419bd9c4cb4b2078538838000eeb2f18))

## [1.5.0](https://github.com/salesforcecli/plugin-release-management/compare/v1.4.3...v1.5.0) (2021-02-03)


### Features

* remove fingerprint checks ([#18](https://github.com/salesforcecli/plugin-release-management/issues/18)) ([6befa55](https://github.com/salesforcecli/plugin-release-management/commit/6befa55ac257c15bd47f17652619d4fa0a7f91b7))

### [1.4.3](https://github.com/salesforcecli/plugin-release-management/compare/v1.4.2...v1.4.3) (2021-02-03)


### Bug Fixes

* strip tsconfig comments before parsing as JSON ([#36](https://github.com/salesforcecli/plugin-release-management/issues/36)) ([3e16f1c](https://github.com/salesforcecli/plugin-release-management/commit/3e16f1cd4bfdaf47adafede43857f237311040a2))

### [1.4.2](https://github.com/salesforcecli/plugin-release-management/compare/v1.4.1...v1.4.2) (2021-01-29)


### Bug Fixes

* throw error if git push fails ([1db3252](https://github.com/salesforcecli/plugin-release-management/commit/1db3252e92dffc5491b09056c3c23e188008e3c3))

### [1.4.1](https://github.com/salesforcecli/plugin-release-management/compare/v1.4.0...v1.4.1) (2021-01-28)


### Bug Fixes

* exclude merge commits when determinin if release is necessary ([02f2bc0](https://github.com/salesforcecli/plugin-release-management/commit/02f2bc0cf8706ca3c723b939d9b305dc23e48cbe))

## [1.4.0](https://github.com/salesforcecli/plugin-release-management/compare/v1.3.0...v1.4.0) (2021-01-28)


### Features

* check commit messages to see if a new version needs to be published ([#13](https://github.com/salesforcecli/plugin-release-management/issues/13)) ([555a29d](https://github.com/salesforcecli/plugin-release-management/commit/555a29d03b7a689f7212e98775682442396c953a))

## [1.3.0](https://github.com/salesforcecli/plugin-release-management/compare/v1.2.1...v1.3.0) (2021-01-28)


### Features

* 🎸 @W-8712470@ add env var for target registry ([#10](https://github.com/salesforcecli/plugin-release-management/issues/10)) ([1dd1dbe](https://github.com/salesforcecli/plugin-release-management/commit/1dd1dbe2a62fba992ec50b65eae95ef4bae2f0c7))

### [1.2.1](https://github.com/salesforcecli/plugin-release-management/compare/v1.2.0...v1.2.1) (2021-01-19)


### Bug Fixes

* update [@typescript-eslint](https://github.com/typescript-eslint) packages when testing new ts version ([4f2abc9](https://github.com/salesforcecli/plugin-release-management/commit/4f2abc97531b2765e8cb4e668c28ecaafe1a68ab))

## [1.2.0](https://github.com/salesforcecli/plugin-release-management/compare/v1.1.2...v1.2.0) (2021-01-14)


### Features

* add typescript:update command ([a1660e5](https://github.com/salesforcecli/plugin-release-management/commit/a1660e5d8c28dbb6626b56c3cd21c8642e9ec322))

### [1.1.2](https://github.com/salesforcecli/plugin-release-management/compare/v1.1.1...v1.1.2) (2020-12-11)


### Bug Fixes

* add ability to pin deps to specified version ([8abed1b](https://github.com/salesforcecli/plugin-release-management/commit/8abed1bec002089281f30273d43752b39e480355))

### [1.1.1](https://github.com/salesforcecli/plugin-release-management/compare/v1.1.0...v1.1.1) (2020-12-10)

## [1.1.0](https://github.com/salesforcecli/plugin-release-management/compare/v1.0.0...v1.1.0) (2020-11-24)


### Features

* add 3 new commands and a new flag ([fbc7355](https://github.com/salesforcecli/plugin-release-management/commit/fbc735567a19e80b30a52f8715b07250f1d52941))


### Bug Fixes

* failing unit test ([eea1ce2](https://github.com/salesforcecli/plugin-release-management/commit/eea1ce27ce3b8d41aba2310ca64ced64ad54e140))
* lerna release ([ae79097](https://github.com/salesforcecli/plugin-release-management/commit/ae7909766f70b865cdf659c3132ac499cb008f40))

## 1.0.0 (2020-11-13)


### Features

* add npm:package:release and npm:lerna:release ([781775c](https://github.com/salesforcecli/plugin-release-management/commit/781775c6271d3746c7c25047eeecdc0d4af5982c))

### 0.0.9 (2020-11-13)

### Features

- add npm:package:release and npm:lerna:release ([be8d5b6](https://github.com/salesforcecli/plugin-release-management/commit/be8d5b62d5e484257297e92cf30fcbb4829c1f34))

### [0.0.8](https://github.com/salesforcecli/plugin-release-management/compare/v0.0.7...v0.0.8) (2020-11-10)

### Bug Fixes

- polling ([8708f04](https://github.com/salesforcecli/plugin-release-management/commit/8708f042ea75bc81fa0d2a1a9d7b187cdd9d949e))

### [0.0.7](https://github.com/salesforcecli/plugin-release-management/compare/v0.0.6...v0.0.7) (2020-11-10)

### Bug Fixes

- update polling fn ([3ab1fc5](https://github.com/salesforcecli/plugin-release-management/commit/3ab1fc517f3d89e85a19e24dfea04f884e8c5f16))

### [0.0.6](https://github.com/salesforcecli/plugin-release-management/compare/v0.0.5...v0.0.6) (2020-11-10)

### Bug Fixes

- git branch logic ([47254d6](https://github.com/salesforcecli/plugin-release-management/commit/47254d699b1ac8bc60e1bced363736c14f17eda0))

### [0.0.5](https://github.com/salesforcecli/plugin-release-management/compare/v0.0.4...v0.0.5) (2020-11-10)

### Bug Fixes

- unsafe perm ([fd4f127](https://github.com/salesforcecli/plugin-release-management/commit/fd4f1273fa9c2381ef70659d6a5f705ab4e8ed33))

### [0.0.4](https://github.com/salesforcecli/plugin-release-management/compare/v0.0.3...v0.0.4) (2020-11-10)

### Bug Fixes

- git branch logic ([d001b82](https://github.com/salesforcecli/plugin-release-management/commit/d001b821a48e1f818323b5371bc670c5fc2b7d59))

### [0.0.3](https://github.com/salesforcecli/plugin-release-management/compare/v0.0.2...v0.0.3) (2020-11-10)

### Bug Fixes

- failed tests ([094dfaf](https://github.com/salesforcecli/plugin-release-management/commit/094dfaf5194305314197e949d85e8772659548f1))
- write npmrc file before publish ([a3eaddf](https://github.com/salesforcecli/plugin-release-management/commit/a3eaddfcf32e1e51ed031202d14a1b6dd4252567))

### [0.0.2](https://github.com/salesforcecli/plugin-release-management/compare/v0.0.1...v0.0.2) (2020-11-10)

### Bug Fixes

- add --set-upstream to git push command ([5c2c9ff](https://github.com/salesforcecli/plugin-release-management/commit/5c2c9ff455dd93b92468dc1d373c6bc0c8eec32f))

### 0.0.1 (2020-11-10)

### Features

- support lerna ([788e766](https://github.com/salesforcecli/plugin-release-management/commit/788e7667b4c1457b375734af3d89aade5c0d4dcf))

### Bug Fixes

- bugs ([5717147](https://github.com/salesforcecli/plugin-release-management/commit/5717147146b82155bfd2a74fef33728cb2443886))
