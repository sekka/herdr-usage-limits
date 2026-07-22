---
id: TASK-4
title: usage-limits-core を共有パッケージリポ参照に切り替える
status: Done
assignee: []
created_date: '2026-07-20 10:00'
updated_date: '2026-07-21 23:35'
labels:
  - refactor
dependencies: []
priority: high
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## 背景

`src/usage-limits-core.ts` は tmux-usage-limits とバイト同一のコピー (2026-07-20 diff 確認)。
共有パッケージリポ新設の方針が決定済み。詳細な背景と手順は tmux-usage-limits の TASK-7
を正とする (パッケージリポ新設自体はそちらで実施)。

## 修正方針

1. 共有パッケージリポ完成後、git dependency をリリースタグに pin して参照する
2. `src/usage-limits-core.ts` のコピーを削除し、import を package 参照へ切り替える
3. engine.ts / display.ts (herdr 固有部分) は本リポに残す
4. `scripts/sync-core.sh` (tmux リポの隣接 checkout を前提にした cross-repo cp) を削除する —
   これが現存する唯一のリポ間 build 依存であり、パッケージ参照への切り替えで役目を終える
   (2026-07-20 依存棚卸し調査。cc-statusline TASK-10 参照)

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 src/usage-limits-core.ts が削除され、タグ pin の git dependency 参照になっている
- [x] #2 bun test が全パスし、herdr title 表示の実挙動が変わらないことを確認している
- [x] #3 scripts/sync-core.sh が削除され、README の sync 記述も更新されている
<!-- AC:END -->
