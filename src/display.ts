#!/usr/bin/env bun
// title daemon から使う表示変換と herdr socket 書き込み。
import { homedir } from "os";
import { getUsageStatus } from "./engine.ts";

export const REFRESH_MS = 60_000;

// tmux 書式トークンだけを除去したプレーンテキスト (tmux status-right の見た目のテキスト再現)
export function stripTmux(s: string): string {
  return s.replace(/#\[[^\]]*\]/g, "");
}

export async function fetchRaw(): Promise<string> {
  return (await getUsageStatus()).trim();
}

// 外側ターミナルのウィンドウタイトルに tmux 表示のテキスト版を常時表示する。
// socket API client.window_title.set (herdr.dev/docs/socket-api/: newline-delimited
// JSON、"Set or clear the foreground client's outer terminal window title")。
// CLI ラッパーが無いため raw socket を直接叩く。
// タイトルバーはプロポーショナルフォントで点字ゲージの字間が崩れるため、ゲージを除いた
// テキスト ("CC5: 55% (7/6 01:10|2h20m) …") にする。
// title-daemon.ts が呼ぶ。herdr ウィンドウが複数ある場合、
// どのフォアグラウンドクライアントがこのタイトルを受け取るかは未定義 (単一ユーザー運用のため許容)。
export function titleText(raw: string): string {
  return stripTmux(raw)
    .replace(/[⠀-⣿]+/g, "")
    .replace(/ {2,}/g, " ")
    .trim();
}

export async function setWindowTitle(raw: string): Promise<void> {
  const title = titleText(raw);
  const sock = process.env.HERDR_SOCKET_PATH ?? `${homedir()}/.config/herdr/herdr.sock`;
  try {
    const conn = await Bun.connect({
      unix: sock,
      socket: { data() {}, error() {} },
    });
    conn.write(
      `${JSON.stringify({ id: "usage-limits:title", method: "client.window_title.set", params: { title: title || null } })}\n`,
    );
    setTimeout(() => conn.end(), 500);
  } catch {
    // herdr 不在時 (単体実行時など) は黙って諦める
  }
}
