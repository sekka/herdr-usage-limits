---
id: TASK-8
title: ensure-title-daemon.sh の kill -0 EPERM 判定を LC_ALL=C でロケール非依存にする
status: Done
assignee: []
created_date: "2026-07-27 07:19"
labels: []
dependencies: []
priority: medium
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## 背景

TASK-9 (herdr-tab-title へのガード逆展開、2026-07-27) の CodeRabbit レビューで major 1件が出た。
本リポの scripts/ensure-title-daemon.sh にも同じパターンが残っている。TASK-7 で master へ
merge 済みのため、本リポ側は別途対応が要る。

## 指摘

`lock_is_stale` および install lock 側の同等関数で、`kill -0` の EPERM 判定を stderr の
文字列 "not permitted" のマッチで行っている。この文字列はロケール依存でありうる。
ロケールが変わって一致しなくなると、別ユーザーが持つ生存中の lock を「死亡 = stale」と
即断し (`*) return 0`)、mtime 判定へ落ちずに正常な lock を剥がす。

該当行 (scripts/ensure-title-daemon.sh):

- 35行目 `kill_error="$(kill -0 "$lock_pid" 2>&1)" && return 1` (daemon lock)
- 269行目 同上 (install lock)

## 実測 (2026-07-27)

このマシンでは再現しない。macOS の /bin/sh (bash 3.2) は NLS 無しでビルドされており、
`locale -a` に ja_JP が4件あるにもかかわらずメッセージは変わらなかった。

```
=== default ===  /bin/sh: line 0: kill: (1) - Operation not permitted
=== ja_JP ===    /bin/sh: line 0: kill: (1) - Operation not permitted
=== C ===        /bin/sh: line 0: kill: (1) - Operation not permitted
```

よってバグではなく hardening。将来 shell が差し替わった場合に効く。

## やること

両行を `LC_ALL=C kill -0 ...` にする。herdr-tab-title 側では同じ修正を TASK-9 のブランチで
適用済み (`kill_error="$(LC_ALL=C kill -0 "$lock_pid" 2>&1)" && return 1`)。

`/bin/sh -n` と `bun test` を通し、ローカルレビューゲート (codex peer + CodeRabbit) を経ること。
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

独立レビュー (reviewer-judgment fallback、CodeRabbit findings 0) → PASS。

レビュアーは `LC_ALL=C` 前置がシェル組み込みコマンドに対して no-op でないことを実測で確認した。
`LANG=ja_JP.UTF-8 LC_ALL=ja_JP.UTF-8` 環境下で、前置なしの bash 自身のプリアンブルは日本語
(`1 行:`)、`LC_ALL=C kill -0 1` を付けると英語 (`line 1:`) になる — bash は一時的な環境変数
代入を通常の組み込みコマンドの実行中だけ適用する。

ただし本チケットが狙う不具合自体は素の macOS では再現しない。`C`, `de_DE.UTF-8`,
`fr_FR.UTF-8`, `zh_CN.UTF-8`, `ja_JP.UTF-8`, `ja_JP.eucJP` の全ロケールでマッチ対象文字列
`Operation not permitted` は常に英語のままだった。これは macOS libSystem の `strerror(3)` が
これらロケール向けの翻訳カタログを持たないため。ローカライズされるのは bash 自身の
"line N" プリアンブルのみ。

結論: 本修正は defense-in-depth (Homebrew の gettext カタログ、bash 以外の `/bin/sh`、将来
翻訳する libc など) であり、ここで観測された不具合の修正ではない。exit status のセマンティクス
には影響しない — 前置は `kill` の終了コードを変えない。
