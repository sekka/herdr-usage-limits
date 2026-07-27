#!/bin/sh
# title-daemon の起動保証 / 停止。pidfile は HERDR_PLUGIN_STATE_DIR に置く。
STATE_DIR="${HERDR_PLUGIN_STATE_DIR:?HERDR_PLUGIN_STATE_DIR not set}"
PIDFILE="$STATE_DIR/title-daemon.pid"
LOCK_DIR="$STATE_DIR/title-daemon.lock"
LOCK_PID_FILE="$LOCK_DIR/pid"
LOCK_STALE_SECONDS="${ENSURE_TITLE_DAEMON_LOCK_STALE_SECONDS:-30}"
LOCK_WAIT_SECONDS="${ENSURE_TITLE_DAEMON_LOCK_WAIT_SECONDS:-5}"
STOP_WAIT_SECONDS="${ENSURE_TITLE_DAEMON_STOP_WAIT_SECONDS:-5}"
PROCESS_MATCH="${ENSURE_TITLE_DAEMON_PROCESS_MATCH:-title-daemon.ts}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
INSTALL_STAMP="$REPO_ROOT/node_modules/.install-stamp"
INSTALL_LOCK_DIR="$REPO_ROOT/node_modules/.install-lock"
INSTALL_LOCK_PID_FILE="$INSTALL_LOCK_DIR/pid"
INSTALL_LOCK_STALE_SECONDS=120
INSTALL_WAIT_SECONDS=30

release_lock() {
  rm -f "$LOCK_PID_FILE" 2>/dev/null || true
  rmdir "$LOCK_DIR" 2>/dev/null || true
}

lock_is_stale() {
  lock_pid=""
  if [ -f "$LOCK_PID_FILE" ]; then
    lock_pid="$(cat "$LOCK_PID_FILE")"
  fi

  case "$lock_pid" in
  '' | *[!0-9]*)
    ;;
  *)
    kill -0 "$lock_pid" 2>/dev/null && return 1
    return 0
    ;;
  esac

  lock_mtime="$(stat -f %m "$LOCK_DIR" 2>/dev/null)" || return 1
  now="$(date +%s)" || return 1
  [ $((now - lock_mtime)) -ge "$LOCK_STALE_SECONDS" ]
}

acquire_lock() {
  waited=0
  while [ "$waited" -lt "$LOCK_WAIT_SECONDS" ]; do
    if mkdir "$LOCK_DIR" 2>/dev/null; then
      if printf '%s\n' "$$" >"$LOCK_PID_FILE"; then
        return 0
      fi
      release_lock
      return 1
    fi

    if lock_is_stale; then
      release_lock
      waited=$((waited + 1))
      continue
    fi

    sleep 1
    waited=$((waited + 1))
  done

  return 1
}

read_daemon_pid() {
  daemon_pid=""
  if [ -f "$PIDFILE" ]; then
    daemon_pid="$(cat "$PIDFILE")"
  fi
  case "$daemon_pid" in
  '' | *[!0-9]*) return 1 ;;
  esac
  printf '%s\n' "$daemon_pid"
}

is_process_running() {
  daemon_pid="$1"
  case "$daemon_pid" in
  '' | *[!0-9]*) return 1 ;;
  esac

  kill -0 "$daemon_pid" 2>/dev/null || return 1
  daemon_state="$(ps -p "$daemon_pid" -o state= 2>/dev/null)" || return 1
  case "$daemon_state" in
  Z*) return 1 ;;
  esac
  return 0
}

is_daemon_process() {
  daemon_pid="$1"
  is_process_running "$daemon_pid" || return 1
  daemon_command="$(ps -p "$daemon_pid" -o command= 2>/dev/null)" || return 1
  case "$daemon_command" in
  *"$PROCESS_MATCH"*) return 0 ;;
  *) return 1 ;;
  esac
}

stop_daemon() {
  daemon_pid="$(read_daemon_pid)" || {
    rm -f "$PIDFILE"
    return 0
  }
  if ! is_daemon_process "$daemon_pid"; then
    rm -f "$PIDFILE"
    return 0
  fi

  if ! kill "$daemon_pid" 2>/dev/null; then
    return 1
  fi

  waited=0
  while [ "$waited" -lt "$STOP_WAIT_SECONDS" ]; do
    if ! is_process_running "$daemon_pid"; then
      rm -f "$PIDFILE"
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
  done

  echo "daemon did not stop" >&2
  return 1
}

can_run_bun() {
  [ -n "$1" ] && [ -x "$1" ] && "$1" --version >/dev/null 2>&1
}

resolve_bun() {
  # Herdr plugin commands can run with a minimal PATH, so probe common installer
  # locations before falling back to PATH.
  if [ -n "${BUN_INSTALL:-}" ]; then
    candidate="$BUN_INSTALL/bin/bun"
    if can_run_bun "$candidate"; then
      printf '%s\n' "$candidate"
      return 0
    fi
  fi

  for candidate in \
    "${HOME:-}/.bun/bin/bun" \
    "${HOME:-}/.local/share/mise/shims/bun" \
    "/opt/homebrew/bin/bun" \
    "/usr/local/bin/bun" \
    "/run/current-system/sw/bin/bun" \
    "${HOME:-}/.nix-profile/bin/bun"; do
    if can_run_bun "$candidate"; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  candidate="$(command -v bun 2>/dev/null || true)"
  if can_run_bun "$candidate"; then
    printf '%s\n' "$candidate"
    return 0
  fi

  echo "bun not found" >&2
  return 1
}

release_install_lock() {
  rm -f "$INSTALL_LOCK_PID_FILE" 2>/dev/null || true
  rmdir "$INSTALL_LOCK_DIR" 2>/dev/null || true
}

bun_lock_checksum() {
  checksum="$(shasum -a 256 "$REPO_ROOT/bun.lock")" || return 1
  printf '%s\n' "${checksum%% *}"
}

dependencies_are_current() {
  expected="$1"
  actual=""
  if [ -f "$INSTALL_STAMP" ]; then
    actual="$(cat "$INSTALL_STAMP")"
  fi

  [ -d "$REPO_ROOT/node_modules/usage-limits-core" ] && [ "$actual" = "$expected" ]
}

install_lock_is_stale() {
  if [ ! -d "$INSTALL_LOCK_DIR" ]; then
    return 1
  fi

  lock_pid=""
  if [ -f "$INSTALL_LOCK_PID_FILE" ]; then
    lock_pid="$(cat "$INSTALL_LOCK_PID_FILE")"
  fi

  case "$lock_pid" in
  '' | *[!0-9]*)
    ;;
  *)
    kill_error="$(kill -0 "$lock_pid" 2>&1)" && return 1
    case "$kill_error" in
    *"Operation not permitted"* | *"not permitted"*) return 1 ;;
    *) return 0 ;;
    esac
    ;;
  esac

  lock_mtime="$(stat -f %m "$INSTALL_LOCK_DIR" 2>/dev/null)" || return 1
  now="$(date +%s)" || return 1
  [ $((now - lock_mtime)) -ge "$INSTALL_LOCK_STALE_SECONDS" ]
}

acquire_install_lock() {
  if mkdir -p "$REPO_ROOT/node_modules" 2>/dev/null && mkdir "$INSTALL_LOCK_DIR" 2>/dev/null; then
    if ! printf '%s\n' "$$" >"$INSTALL_LOCK_PID_FILE"; then
      release_install_lock
      return 1
    fi
    return 0
  fi

  if install_lock_is_stale; then
    release_install_lock
    if mkdir "$INSTALL_LOCK_DIR" 2>/dev/null; then
      if ! printf '%s\n' "$$" >"$INSTALL_LOCK_PID_FILE"; then
        release_install_lock
        return 1
      fi
      return 0
    fi
  fi

  return 1
}

wait_for_dependencies() {
  expected="$1"
  waited=0
  while [ "$waited" -lt "$INSTALL_WAIT_SECONDS" ]; do
    sleep 1
    waited=$((waited + 1))
    if dependencies_are_current "$expected"; then
      return 0
    fi
  done

  return 1
}

ensure_dependencies() {
  if [ ! -f "$REPO_ROOT/package.json" ] || [ ! -f "$REPO_ROOT/bun.lock" ]; then
    return 1
  fi

  lock_checksum="$(bun_lock_checksum)" || return 1
  if dependencies_are_current "$lock_checksum"; then
    return 0
  fi

  if ! acquire_install_lock; then
    wait_for_dependencies "$lock_checksum"
    return $?
  fi

  if dependencies_are_current "$lock_checksum"; then
    release_install_lock
    return 0
  fi

  if "$BUN" install --cwd "$REPO_ROOT" --frozen-lockfile --silent >/dev/null 2>&1; then
    if ! printf '%s\n' "$lock_checksum" >"$INSTALL_STAMP"; then
      release_install_lock
      return 1
    fi
    release_install_lock
    return 0
  fi

  release_install_lock
  return 1
}

if [ "${1:-}" = "stop" ]; then
  if ! acquire_lock; then
    echo "daemon lock unavailable" >&2
    exit 1
  fi
  trap 'release_lock' 0 1 2 15
  stop_daemon
  exit $?
fi

# 既に生きていれば何もしない (ロック取得前の高速パス。権威ある判定はロック内で再度行う)
daemon_pid="$(read_daemon_pid)" || daemon_pid=""
if is_daemon_process "$daemon_pid"; then
  exit 0
fi

# 依存インストールは daemon ロックの外で行う。install lock 側で既に直列化されており、
# 冷えたインストールは LOCK_WAIT_SECONDS を超えるため、daemon ロック内に置くと
# 同時起動のもう一方が「daemon lock unavailable」で失敗する。
if [ -z "${ENSURE_TITLE_DAEMON_TEST_CMD:-}" ]; then
  BUN="$(resolve_bun)" || exit 1
  if ! ensure_dependencies; then
    echo "usage-limits dependency install failed" >&2
    exit 1
  fi
fi

if ! acquire_lock; then
  echo "daemon lock unavailable" >&2
  exit 1
fi
trap 'release_lock' 0 1 2 15

daemon_pid="$(read_daemon_pid)" || daemon_pid=""
if is_daemon_process "$daemon_pid"; then
  exit 0
fi
rm -f "$PIDFILE"

# ENSURE_TITLE_DAEMON_TEST_CMD はテスト専用の起動対象差し替え (引数なしの実行ファイル1つ)。
# bun test 以外で設定しないこと。設定時は ENSURE_TITLE_DAEMON_PROCESS_MATCH も対象に合わせること
if [ -n "${ENSURE_TITLE_DAEMON_TEST_CMD:-}" ]; then
  nohup "$ENSURE_TITLE_DAEMON_TEST_CMD" >/dev/null 2>&1 &
else
  nohup "$BUN" "$REPO_ROOT/src/title-daemon.ts" >/dev/null 2>&1 &
fi
daemon_pid=$!
if ! printf '%s\n' "$daemon_pid" >"$PIDFILE"; then
  kill "$daemon_pid" 2>/dev/null || true
  exit 1
fi
