#!/bin/sh
# title-daemon の起動保証 / 停止。pidfile は HERDR_PLUGIN_STATE_DIR に置く。
STATE_DIR="${HERDR_PLUGIN_STATE_DIR:?HERDR_PLUGIN_STATE_DIR not set}"
PIDFILE="$STATE_DIR/title-daemon.pid"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
INSTALL_STAMP="$REPO_ROOT/node_modules/.install-stamp"
INSTALL_LOCK_DIR="$REPO_ROOT/node_modules/.install-lock"
INSTALL_LOCK_PID_FILE="$INSTALL_LOCK_DIR/pid"
INSTALL_LOCK_STALE_SECONDS=120
INSTALL_WAIT_SECONDS=30

if [ "${1:-}" = "stop" ]; then
  [ -f "$PIDFILE" ] && kill "$(cat "$PIDFILE")" 2>/dev/null
  rm -f "$PIDFILE"
  exit 0
fi

# 既に生きていれば何もしない
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  exit 0
fi

can_run_bun() {
  [ -n "$1" ] && [ -x "$1" ] && "$1" --version >/dev/null 2>&1
}

resolve_bun() {
  # herdr の GUI 起動だと mise shims が PATH に無いことがあるため bun を明示解決する
  preferred="$HOME/.local/share/mise/shims/bun"
  if can_run_bun "$preferred"; then
    printf '%s\n' "$preferred"
    return 0
  fi

  fallback="$(command -v bun 2>/dev/null || true)"
  if [ "$fallback" != "$preferred" ] && can_run_bun "$fallback"; then
    printf '%s\n' "$fallback"
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
    ''|*[!0-9]*)
      ;;
    *)
      kill_error="$(kill -0 "$lock_pid" 2>&1)" && return 1
      case "$kill_error" in
        *"Operation not permitted"*|*"not permitted"*) return 1 ;;
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

BUN="$(resolve_bun)" || exit 1
if ! ensure_dependencies; then
  echo "usage-limits dependency install failed" >&2
  exit 1
fi

nohup "$BUN" "$REPO_ROOT/src/title-daemon.ts" >/dev/null 2>&1 &
echo $! >"$PIDFILE"
