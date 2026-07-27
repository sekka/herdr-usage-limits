import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

function fixture(options: { ignoreTerm?: boolean } = {}) {
  const stateDir = mkdtempSync(join(tmpdir(), "ensure-title-daemon-test-"));
  directories.add(stateDir);
  const command = join(stateDir, "title-daemon.ts");
  const starts = join(stateDir, "starts");
  const onTerm = options.ignoreTerm ? "$SIG{'TERM'} = 'IGNORE';\n" : "";
  writeFileSync(
    command,
    `#!/usr/bin/perl\n${onTerm}open my $starts, ">>", $ENV{STARTS_FILE} or die $!;\nprint $starts "started\\n";\nclose $starts;\nwhile (1) { sleep 1; }\n`,
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
      ENSURE_TITLE_DAEMON_PROCESS_MATCH: "perl",
      STARTS_FILE: starts,
    },
  };
}

function run(env: Record<string, string | undefined>, action?: "stop") {
  return Bun.spawnSync(["/bin/sh", ensureDaemon, ...(action ? [action] : [])], {
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
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
    await waitUntil(() => existsSync(f.starts));

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
});
