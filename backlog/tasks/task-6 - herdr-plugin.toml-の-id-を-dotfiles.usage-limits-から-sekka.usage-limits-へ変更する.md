---
id: TASK-6
title: herdr-plugin.toml の id を dotfiles.usage-limits から sekka.usage-limits へ変更する
status: Done
assignee: []
created_date: '2026-07-20 10:35'
updated_date: '2026-07-20 21:40'
labels:
  - refactor
dependencies: []
priority: medium
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

実作業のうち本リポ分。**全体仕様の正は cc-statusline-usage-limits の TASK-9**
(dotfiles TASK-308 から移設)。herdr-tab-title 側にも同種タスクあり。

- `herdr-plugin.toml` の id を `sekka.usage-limits` へ変更
- 自 id 参照 (`--plugin dotfiles.usage-limits` 等のスクリプト・README) を更新
- 注意: dotfiles 側 setup/herdr-plugins.txt の plugin_id 列と同一コミット群で
  同期変更しないと is_registered が外れ毎回再インストールを試みる壊れ方をする —
  移行手順・dotfiles 側変更箇所は cc-statusline TASK-9 参照

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 herdr-plugin.toml の id が sekka.usage-limits になり、自 id 参照が残っていない (grep 0 hit)
- [x] #2 herdr 上で旧 id uninstall → 新 id 登録済みで動作確認している (cc-statusline TASK-9 AC#3 の本リポ分)
<!-- AC:END -->
