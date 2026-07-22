---
id: TASK-5
title: tmux TASK-8 の cache 読み込み時バリデーション修正をコピー同期で受け取る
status: Done
assignee: []
created_date: "2026-07-20 10:25"
updated_date: "2026-07-20 21:57"
labels:
  - fix
dependencies: []
priority: high
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## 背景

2026-07-13〜20 の表示凍結インシデント (旧 1.1.1 が書いた未来 timestamp の毒 cache、
応急処置済み) の恒久対応。cache 読み込み時バリデーション (`nextRetryAt` を
now+10分に clamp、`timestamp > now` は stale 扱い) は canonical である
tmux-usage-limits TASK-8 で実装される。本タスクはその受け取り。

パッケージ化 (TASK-4) を待たない。暫定はコピー同期の現行運用に載せる決定
(2026-07-20、cc-statusline セッション)。

## 手順

1. tmux-usage-limits TASK-8 完了後、`src/usage-limits-core.ts` をコピー同期
2. md5 が tmux 側と一致することを確認
3. bun test 全パス確認、コミット・リリース

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 usage-limits-core.ts が tmux 側と md5 一致している (同期元: tmux-usage-limits TASK-8 実装時点の src/usage-limits-core.ts、同期コミット 519ec39 / PR #5)
- [x] #2 毒 cache fixture のテストを含め bun test が全パスしている (PR #5 の CI 全パス)
- [x] #3 リリース済みである (v1.2.0、release commit 4de421d)

<!-- AC:END -->
