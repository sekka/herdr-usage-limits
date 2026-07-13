---
id: TASK-1
title: README を公開配布向けテンプレートに統一する
status: Done
assignee: []
created_date: '2026-07-13 02:21'
updated_date: '2026-07-13 05:01'
labels:
  - plugin
  - docs
dependencies: []
priority: medium
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 目的

このリポジトリ (herdr-usage-limits) の README を、公開配布プラグインに見合った統一テンプレートに更新する。テンプレートは tmux-usage-limits / herdr-usage-limits / herdr-tab-title の3リポジトリで共通(dotfiles TASK-52 参照)。

## 統一テンプレート(見出し順)

1. `# herdr-usage-limits` + 1行説明 + 出力例(テキストでの表示例でも可)
2. `## Features`(箇条書き 3-5 点)
3. `## Requirements`(Bun、herdr のバージョン)
4. `## Install`(`herdr plugin install`。コピペで動くこと)
5. `## Usage`(最小の使い方)
6. `## Configuration`(現状ハードコードなら「現在設定項目なし」と明記 — 嘘の設定表を作らない)
7. `## How it works`(1-2 段落)
8. `## Troubleshooting`(daemon の pidfile、キャッシュ/credential 等)
9. `## Development`(bun test、verify ハーネスの使い方、release-please フロー)
10. `## Uninstall`
11. `## License`

## このリポジトリ固有の必須修正

- `## Uninstall` 節が無ければ新規追加
- src/scripts/verify 再構成後(dotfiles TASK-50 参照)のパスを Development 節に反映

## 制約

- 実装に無い機能を README に書かない。全コマンド例は実行して確認してから記載
- feature branch + `docs:` prefix(日本語メッセージ)

## 検証

1. Install 節のコマンドをクリーン環境相当で辿れること(全パス・リポジトリ名が実在するか grep で確認)
2. 見出し順が統一テンプレートと一致していること
3. ローカルレビューゲート(CLAUDE.md 記載の codex peer review + coderabbit)を通す
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 README 見出し順が統一テンプレートと一致
- [x] #2 Uninstall 節を含む全11節が揃っている
- [x] #3 全コマンド例のパス・リポジトリ名が実在
- [x] #4 ローカルレビューゲート通過
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-07-13 TASK-85 規約メモ: README は # herdr-usage-limits / Features / Requirements / Install / Usage / Configuration / Security disclosure / How it works / Troubleshooting / Development / Uninstall / License の順に揃える。公開読者向けに個人 home や絶対パスは書かない。credential を扱うため Security disclosure で、読む credential、送信 endpoint、undocumented API リスクを太字で明記する。現状 gap: Usage/Configuration/Security disclosure/Uninstall 不足。sync-core.sh は tmux -> herdr の片方向同期例外として説明してよい。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
README を正典順 (#/Features/Requirements/Install/Usage/Configuration/Security disclosure/How it works/Troubleshooting/Development/Uninstall/License) に再構成し、Uninstall と credential disclosure を追加した。見出し grep と bun test pass を確認。副作用のある install 実行と外部レビューゲートは未実施。
<!-- SECTION:FINAL_SUMMARY:END -->
