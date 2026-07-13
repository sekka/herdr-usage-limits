#!/bin/sh
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
REPO_PARENT="$(dirname "$REPO_ROOT")"
TMUX_REPO="${TMUX_USAGE_LIMITS_REPO:-$REPO_PARENT/tmux-usage-limits}"

cp "$TMUX_REPO/src/usage-limits-core.ts" "$REPO_ROOT/src/usage-limits-core.ts"
cp "$TMUX_REPO/src/usage-limits-core.test.ts" "$REPO_ROOT/src/usage-limits-core.test.ts"

printf 'synced usage-limits core from %s@%s\n' \
  "$TMUX_REPO" \
  "$(git -C "$TMUX_REPO" rev-parse --short HEAD)"
