# Changelog

## [1.2.0](https://github.com/sekka/herdr-usage-limits/compare/v1.1.1...v1.2.0) (2026-07-20)


### Features

* サイドバーに usage metadata token を報告する ([ebc11aa](https://github.com/sekka/herdr-usage-limits/commit/ebc11aa9ff5e0fd56773ab71242aa60670867b3e))


### Bug Fixes

* tmux canonical の cache 読み込みバリデーションをコピー同期で受領する (M1) ([a21fe17](https://github.com/sekka/herdr-usage-limits/commit/a21fe174e8fdef6022eef90334566cce1d9f163d))
* tmux の cache 読み込みバリデーションを同期する ([519ec39](https://github.com/sekka/herdr-usage-limits/commit/519ec39dc1ded6413fb85b5a517a7b614268827c))
* usage detail token の欠落と省略を直す ([0c3a688](https://github.com/sekka/herdr-usage-limits/commit/0c3a68847dc1edd4eb58b6733a24b8a0ad08b01a))

## [1.1.1](https://github.com/sekka/herdr-usage-limits/compare/v1.1.0...v1.1.1) (2026-07-13)


### Bug Fixes

* percent の % 記号色を gray に揃える ([77ea840](https://github.com/sekka/herdr-usage-limits/commit/77ea840c42113fa7e1db159a8953a573c0c9dc71))
* tmuxBraille に 0-100 clamp を追加し範囲外入力の crash を防ぐ ([5227cff](https://github.com/sekka/herdr-usage-limits/commit/5227cff21bb249868a7cb4e1390713d5498d10d1))
* usage-limits core を tmux から同期(同期 fetch 経路ガード) ([e49431b](https://github.com/sekka/herdr-usage-limits/commit/e49431bbe8092904475e3ad71028a2f0c946f319))

## [1.1.0](https://github.com/sekka/herdr-usage-limits/compare/v1.0.0...v1.1.0) (2026-07-13)


### Features

* usage limits core を同期 ([9a75313](https://github.com/sekka/herdr-usage-limits/commit/9a75313d03f951ef09519f98a71769e5ed08ad2e))


### Bug Fixes

* engine の実行権限を維持 ([2737438](https://github.com/sekka/herdr-usage-limits/commit/2737438f97420b60da44eb435b748727e8688d7c))
* malformed JSON でも stale cache を保持 ([a9d6c72](https://github.com/sekka/herdr-usage-limits/commit/a9d6c72f6ea132c2191fcc8787220533f3bb36a8))

## 1.0.0 (2026-07-11)


### Features

* herdr usage-limits プラグインを分離リポジトリとして新規作成 ([47b7564](https://github.com/sekka/herdr-usage-limits/commit/47b75646b6427f274b59df8440ac14ba7f656462))


### Bug Fixes

* release-please manifest を 0.0.0 に是正し初回リリースを v0.1.0 にする ([ddd5719](https://github.com/sekka/herdr-usage-limits/commit/ddd57194340ba12218703b32330aa02cc0d426bf))
