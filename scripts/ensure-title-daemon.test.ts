import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ensureDaemon = join(import.meta.dir, "ensure-title-daemon.sh");
const processes = new Set<number>();
const directories = new Set<string>();

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function waitUntil(predicate: () => boolean, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const poll = () => {
      if (predicate()) return resolve();
      if (Date.now() >= deadline) return reject(new Error("condition timed out"));
      setTimeout(poll, 20);
    };
    poll();
  });
}

async function exitedPid(): Promise<number> {
  const child = Bun.spawn(["/bin/sh", "-c", "exit 0"]);
  const pid = child.pid;
  expect(await child.exited).toBe(0);
  await waitUntil(() => !processIsAlive(pid));
  return pid;
}

function fixture(options: { ignoreTerm?: boolean } = {}) {
  const stateDir = mkdtempSync(join(tmpdir(), "ensure-title-daemon-test-"));
  directories.add(stateDir);
  const command = join(stateDir, "title-daemon.ts");
  const starts = join(stateDir, "starts");
  const onTerm = options.ignoreTerm ? "$SIG{'TERM'} = 'IGNORE';\n" : "";
  writeFileSync(
    command,
    `#!/usr/bin/perl\n${onTerm}open my $starts, ">>", $ENV{STARTS_FILE} or die $!;\nprint $starts "$$\\n";\nclose $starts;\nwhile (1) { sleep 1; }\n`,
  );
  chmodSync(command, 0o755);
  return {
    stateDir,
    command,
    starts,
    env: {
      ...process.env,
      HERDR_PLUGIN_STATE_DIR: stateDir,
      ENSURE_TITLE_DAEMON_TEST_CMD: command,
      ENSURE_TITLE_DAEMON_STOP_WAIT_SECONDS: "1",
      ENSURE_TITLE_DAEMON_PROCESS_MATCH: "title-daemon.ts",
      STARTS_FILE: starts,
    },
  };
}

async function staleDaemonLock(f: ReturnType<typeof fixture>) {
  const lockDir = join(f.stateDir, "title-daemon.lock");
  mkdirSync(lockDir);
  const pid = await exitedPid();
  writeFileSync(join(lockDir, "pid"), `${pid}\n`);
  const old = new Date(Date.now() - 60_000);
  utimesSync(lockDir, old, old);
  return { lockDir, pid };
}

function run(env: Record<string, string | undefined>, action?: "stop") {
  return Bun.spawnSync(["/bin/sh", ensureDaemon, ...(action ? [action] : [])], {
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
}

function shellFunctions(): string {
  const script = readFileSync(ensureDaemon, "utf8");
  const mainStart = "\nif [ \"${1:-}\" = \"stop\" ]; then";
  const index = script.indexOf(mainStart);
  if (index === -1) throw new Error("ensure-title-daemon main section not found");
  return script.slice(0, index);
}

function trackedPid(stateDir: string): number {
  const pid = Number(readFileSync(join(stateDir, "title-daemon.pid"), "utf8").trim());
  processes.add(pid);
  return pid;
}

afterEach(() => {
  for (const pid of processes) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {}
  }
  processes.clear();
  for (const directory of directories) rmSync(directory, { recursive: true, force: true });
  directories.clear();
});

describe("ensure-title-daemon.sh", () => {
  test("同時 start でも daemon を一つだけ起動する", async () => {
    const f = fixture();
    const first = Bun.spawn(["/bin/sh", ensureDaemon], { env: f.env });
    const second = Bun.spawn(["/bin/sh", ensureDaemon], { env: f.env });

    expect(await first.exited).toBe(0);
    expect(await second.exited).toBe(0);
    const pid = trackedPid(f.stateDir);
    await waitUntil(() => existsSync(f.starts) && readFileSync(f.starts, "utf8").trim().length > 0);

    expect(readFileSync(f.starts, "utf8").trim().split("\n")).toHaveLength(1);
    expect(processIsAlive(pid)).toBe(true);
  });

  test("別プロセスの PID を daemon と誤認せず start する", async () => {
    const f = fixture();
    const unrelated = Bun.spawn(["/bin/sleep", "30"]);
    processes.add(unrelated.pid);
    writeFileSync(join(f.stateDir, "title-daemon.pid"), `${unrelated.pid}\n`);

    expect(run(f.env).exitCode).toBe(0);
    const daemonPid = trackedPid(f.stateDir);
    await waitUntil(() => existsSync(f.starts));

    expect(daemonPid).not.toBe(unrelated.pid);
    expect(processIsAlive(unrelated.pid)).toBe(true);
  });

  test("stop は終了確認後に pidfile を削除する", async () => {
    const f = fixture();
    expect(run(f.env).exitCode).toBe(0);
    const pid = trackedPid(f.stateDir);
    await waitUntil(() => existsSync(f.starts));

    const stopped = run(f.env, "stop");

    expect(stopped.exitCode).toBe(0);
    await waitUntil(() => !processIsAlive(pid));
    expect(existsSync(join(f.stateDir, "title-daemon.pid"))).toBe(false);
  });

  test("SIGTERM 後も生存する daemon では pidfile を残して失敗する", async () => {
    // SIGTERM を無視する daemon で「TERM 後も生存」を決定的に再現する
    // (SIGSTOP は macOS では未捕捉 TERM で即終了するため使えない)
    const f = fixture({ ignoreTerm: true });
    expect(run(f.env).exitCode).toBe(0);
    const pid = trackedPid(f.stateDir);
    await waitUntil(() => existsSync(f.starts));
    expect(processIsAlive(pid)).toBe(true);

    const stopped = run(f.env, "stop");

    // pidfile 保持と非ゼロ終了が本質。stderr 文言は補助的な確認として最後に置く
    expect(stopped.exitCode).not.toBe(0);
    expect(processIsAlive(pid)).toBe(true);
    expect(readFileSync(join(f.stateDir, "title-daemon.pid"), "utf8").trim()).toBe(`${pid}`);
    expect(stopped.stderr.toString()).toContain("daemon did not stop");
  });

  test("ready 判定に失敗した daemon は終了を確認してから pidfile を消す", async () => {
    // PROCESS_MATCH を意図的に外して「起動済みだが ready と判定されない」状態を作る。
    // ここで終了確認前に pidfile を消すと、次の start が別 daemon を起こして多重起動する
    const f = fixture({ ignoreTerm: true });
    const env = {
      ...f.env,
      ENSURE_TITLE_DAEMON_PROCESS_MATCH: "definitely-not-present",
      ENSURE_TITLE_DAEMON_READY_WAIT_SECONDS: "1",
      ENSURE_TITLE_DAEMON_STOP_WAIT_SECONDS: "1",
    };

    const started = run(env);

    expect(started.exitCode).not.toBe(0);
    expect(started.stderr.toString()).toContain("did not become ready");
    expect(existsSync(f.starts)).toBe(true);
    const pid = Number(readFileSync(f.starts, "utf8").trim().split("\n")[0]);
    processes.add(pid);
    expect(processIsAlive(pid)).toBe(false);
    expect(existsSync(join(f.stateDir, "title-daemon.pid"))).toBe(false);
  });

  test("未知の kill 診断では生存 lock を奪取しない", async () => {
    const f = fixture();
    const lockDir = join(f.stateDir, "title-daemon.lock");
    mkdirSync(lockDir);
    writeFileSync(join(lockDir, "pid"), `${await exitedPid()}\n`);
    const releaseMarker = join(f.stateDir, "released");
    const statusFile = join(f.stateDir, "steal-status");
    const harness = `${shellFunctions()}
kill() {
  echo 'unknown diagnostic' >&2
  return 1
}
release_lock() {
  printf 'released\\n' >"$RELEASE_MARKER"
  rm -f "$LOCK_PID_FILE" 2>/dev/null || true
  rmdir "$LOCK_DIR" 2>/dev/null || true
}
steal_lock_if_stale
printf '%s\\n' "$?" >"$STATUS_FILE"
`;

    const result = Bun.spawnSync(["/bin/sh"], {
      env: {
        ...f.env,
        RELEASE_MARKER: releaseMarker,
        STATUS_FILE: statusFile,
      },
      stdin: new TextEncoder().encode(harness),
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(result.exitCode).toBe(0);
    expect(readFileSync(statusFile, "utf8").trim()).toBe("1");
    expect(existsSync(releaseMarker)).toBe(false);
    expect(existsSync(lockDir)).toBe(true);
  });

  test("install lock は未知の kill 診断でも生存 PID を stale にしない", async () => {
    const f = fixture();
    const installLockDir = join(f.stateDir, "install-lock");
    mkdirSync(installLockDir);
    writeFileSync(join(installLockDir, "pid"), `${await exitedPid()}\n`);
    const statusFile = join(f.stateDir, "install-stale-status");
    const harness = `${shellFunctions()}
INSTALL_LOCK_DIR="$TEST_INSTALL_LOCK_DIR"
INSTALL_LOCK_PID_FILE="$INSTALL_LOCK_DIR/pid"
kill() {
  echo 'unknown diagnostic' >&2
  return 1
}
install_lock_is_stale
printf '%s\\n' "$?" >"$STATUS_FILE"
`;

    const result = Bun.spawnSync(["/bin/sh"], {
      env: {
        ...f.env,
        STATUS_FILE: statusFile,
        TEST_INSTALL_LOCK_DIR: installLockDir,
      },
      stdin: new TextEncoder().encode(harness),
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(result.exitCode).toBe(0);
    expect(readFileSync(statusFile, "utf8").trim()).toBe("1");
    expect(existsSync(installLockDir)).toBe(true);
  });

  test("install lock は死んだ PID の期限切れ lock を stale にする", async () => {
    const f = fixture();
    const installLockDir = join(f.stateDir, "install-lock");
    mkdirSync(installLockDir);
    writeFileSync(join(installLockDir, "pid"), `${await exitedPid()}\n`);
    const old = new Date(Date.now() - 180_000);
    utimesSync(installLockDir, old, old);
    const statusFile = join(f.stateDir, "install-stale-status");
    const harness = `${shellFunctions()}
INSTALL_LOCK_DIR="$TEST_INSTALL_LOCK_DIR"
INSTALL_LOCK_PID_FILE="$INSTALL_LOCK_DIR/pid"
INSTALL_LOCK_STALE_SECONDS=1
install_lock_is_stale
printf '%s\\n' "$?" >"$STATUS_FILE"
`;

    const result = Bun.spawnSync(["/bin/sh"], {
      env: {
        ...f.env,
        STATUS_FILE: statusFile,
        TEST_INSTALL_LOCK_DIR: installLockDir,
      },
      stdin: new TextEncoder().encode(harness),
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(result.exitCode).toBe(0);
    expect(readFileSync(statusFile, "utf8").trim()).toBe("0");
  });

  test("死んだ PID の期限切れ lock を奪取して daemon を起動する", async () => {
    const f = fixture();
    const staleLock = await staleDaemonLock(f);

    expect(run({ ...f.env, ENSURE_TITLE_DAEMON_LOCK_STALE_SECONDS: "1" }).exitCode).toBe(0);
    const daemonPid = trackedPid(f.stateDir);
    await waitUntil(() => existsSync(f.starts) && readFileSync(f.starts, "utf8").trim().length > 0);

    const starts = readFileSync(f.starts, "utf8").trim().split("\n");
    expect(starts).toEqual([`${daemonPid}`]);
    expect(Number.isInteger(staleLock.pid)).toBe(true);
    expect(processIsAlive(daemonPid)).toBe(true);
    expect(existsSync(join(f.stateDir, "title-daemon.lock"))).toBe(false);
  });
});
