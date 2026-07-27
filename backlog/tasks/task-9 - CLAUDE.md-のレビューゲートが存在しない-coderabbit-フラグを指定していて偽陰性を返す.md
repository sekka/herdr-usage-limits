---
id: TASK-9
title: CLAUDE.md のレビューゲートが存在しない coderabbit フラグを指定していて偽陰性を返す
status: To Do
assignee: []
created_date: '2026-07-27 08:04'
updated_date: '2026-07-27 08:04'
labels: []
dependencies: []
priority: high
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 事象 (2026-07-27)

CLAUDE.md の "Definition of done — local review gate" が指定するコマンド

    coderabbit review --base master --agent --type all

の `--type all` は CodeRabbit CLI v0.7.0 に存在しないフラグ。一次情報で確認済み:

```
$ coderabbit review --help
Options:
  --committed              Review only committed changes
  --uncommitted            Review staged changes and tracked edits
  --include-untracked      Also review files that have not been added to Git
  ...
$ coderabbit --version
0.7.0
```

`--type` はオプション一覧に無い。にもかかわらず CLI はエラーを出さず exit 0 で完走する。

## 影響 — ゲートが偽陰性を返す

`--type all` が「committed + staged + unstaged を全部見る」つもりで書かれているが、
実際は無視され、既定の tracked changes のみがレビュー対象になる。**未追跡ファイルは
一切レビューされないまま exit 0 / 0 findings が返る**。

実測: dotfiles TASK-244 のレビューで、新規追加した2ファイル (未追跡) が
`--type all` 付きの実行では 0 findings。`--include-untracked` に直して再実行したところ
major 1件が出た。ゲートを通ったのに実際は見られていなかった。

新規ファイルを追加する変更ほどレビューが必要なのに、そこだけ素通しになる。

## やること

CLAUDE.md のゲート記述を実在するフラグに直す。

- `--type all` を `--include-untracked` に置換する
  (`--include-untracked` は tracked changes に加えて未追跡も見るので、意図に一致する)
- 「--agent で structured findings」「--type all で committed + staged + unstaged を網羅」
  という説明文も実際の挙動に合わせて書き直す
- ついでに、CLI がバージョン差で未知フラグを黙って無視する点を注記する。将来同じ形の
  偽陰性を踏まないよう、ゲートを更新するときは `coderabbit review --help` で
  フラグの実在を確認する旨を1行入れる

## 関連

同じゲート記述を持つリポが他にもあれば横展開する。
`grep -rn 'type all' ~/src/github.com/sekka/*/CLAUDE.md` で洗い出すこと。
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
横展開の実測 (2026-07-27): 同じ記述を持つのは3リポ。
- /Users/kei/src/github.com/sekka/herdr-usage-limits/CLAUDE.md:14
- /Users/kei/src/github.com/sekka/herdr-tab-title/CLAUDE.md:14
- /Users/kei/src/github.com/sekka/tmux-usage-limits/CLAUDE.md:14
いずれも同一文面。3つとも直すこと。
<!-- SECTION:NOTES:END -->
