import { describe, expect, test } from "bun:test";
import { stripTmux, titleText } from "./display.ts";

describe("stripTmux", () => {
  test("書式トークンだけ除去し、点字ゲージ等の文字は残す (tmux表示のテキスト再現)", () => {
    const raw = "#[fg=colour240]CC5:#[default]#[fg=yellow]⣿⣿⣀⣀⣀#[default] #[fg=white]41%#[default]";
    expect(stripTmux(raw)).toBe("CC5:⣿⣿⣀⣀⣀ 41%");
  });

  test("トークンなしはそのまま", () => {
    expect(stripTmux("CC5 41%")).toBe("CC5 41%");
  });
});

describe("titleText", () => {
  test("点字ゲージを除去する (タイトルバーはプロポーショナルフォントで崩れるため)", () => {
    const raw =
      "#[fg=colour240]CC5:#[default]#[fg=yellow]⣿⣿⣷⣀⣀#[default] #[fg=white]55%#[default] #[fg=colour240](7/6 01:10|2h20m)#[default] CCW:⣿⣷⣀⣀⣀ 38% (7/6 06:00|7h10m)";
    expect(titleText(raw)).toBe("CC5: 55% (7/6 01:10|2h20m) CCW: 38% (7/6 06:00|7h10m)");
  });

  test("stale 表示 (?と(Xm ago)) は残す", () => {
    expect(titleText("CC5?:⣿⣀⣀⣀⣀ 12% (5m ago)")).toBe("CC5?: 12% (5m ago)");
  });
});
