---
id: TASK-7
title: ensure-title-daemon.sh の起動/停止ガードを堅牢化する
status: To Do
assignee: []
created_date: "2026-07-22 12:10"
labels:
  - tech-debt
dependencies: []
priority: medium
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## 背景

herdr-tab-title TASK-1 (2026-07-22 完了、branch fix/ensure-daemon-guards) で scripts/ensure-daemon.sh の起動/停止ガード欠陥を修正した。scripts/ensure-title-daemon.sh は同一の弱いガードを共有している (diff 確認済み。差分は依存インストールのロック処理のみ) ため横展開が必要。

## 対象 (scripts/ensure-title-daemon.sh)

- 起動ガードが非原子的: PID 確認→起動→PID 保存が分離。同時実行で二重起動し、最後に保存した PID のみ追跡される。mkdir ベースの原子的ロック (stale 判定: PID 生存 + mtime) で直列化する
- PID 存在確認だけで対象同定していない: PID 再利用時に kill -0 が無関係プロセスを生存と誤判定。ps -o command= でデーモン本体であることを確認する。**注意: このリポジトリの実プロセスは src/title-daemon.ts** — 参照実装の PROCESS_MATCH 既定値 `run.ts` をそのまま持ち込まず、既定値を `title-daemon.ts` にする (テスト用 override 環境変数を置く場合も既定値も合わせる)
- stop が終了確認前に pidfile 削除: SIGTERM 後の終了を待たず pidfile を消すため、停止失敗でも「停止済み」扱いになる。終了を一定時間ポーリングで確認後にのみ削除し、生存時は非ゼロ終了で pidfile を保持する

stale lock 判定の移植時は commit 356b29a の判定順序に合わせる: lock 内 PID が有効かつ死んでいれば即 stale、PID が欠損・不正のときのみ mtime (LOCK_STALE_SECONDS) で判定。

## 参照実装

herdr-tab-title の scripts/ensure-daemon.sh (commit 356b29a) と scripts/ensure-daemon.test.ts をベースに移植する。macOS 注意点: SIGSTOP 中のプロセスへ未捕捉 SIGTERM を送ると即終了するため、TERM 生存デーモンのテストは perl の $SIG{TERM}='IGNORE' fixture を使う。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 tab-title 側の修正を現行コードへ移植し (プロセス同定は title-daemon.ts)、依存インストールロックとの整合を確認した
- [ ] #2 bun test (ensure-title-daemon 対象のテストファイル) で次の 4 ケースが pass: 並行 start で単一起動 / pidfile の無関係 PID をデーモンと誤認しない / stop は終了確認後に pidfile 削除 / TERM 無視デーモンで stop が非ゼロ終了し pidfile 保持
- [ ] #3 実機で start/stop 動作が pass
- [ ] #4 ローカルレビューゲート通過

<!-- AC:END -->
