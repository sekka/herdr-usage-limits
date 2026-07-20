# herdr-usage-limits

Claude Code / Codex usage-limit window-title display for [herdr](https://herdr.dev).

Example output:

```text
CC5:⣿⣿⣿⣀⣀ 61% (20:54|1h0m) CCW:⣿⣄⣀⣀⣀ 22% (7/14 14:34|18h40m) CCF:⣿⣿⣿⣦⣀ 71% (7/14 01:06|5h12m)
```

Gauge = utilization. `(reset time|time remaining)` shows the reset point and remaining time, `?` marks stale cache, and `CX5`/`CXW` appear when Codex usage data is available.

## Features

- Updates the outer terminal window title through a daemon.
- Reuses the same usage-limit parsing behavior as `tmux-usage-limits`.

## Requirements

- [herdr](https://herdr.dev) `>= 0.7.4`
- [bun](https://bun.sh) on `PATH`
- macOS for Keychain fallback through `security`
- A logged-in Claude Code and/or Codex CLI

## Install

Install the plugin. New workspaces start the title daemon automatically; run the action once for an already-open session:

```sh
herdr plugin install sekka/herdr-usage-limits
herdr plugin action invoke start-title-daemon --plugin dotfiles.usage-limits
```

Pin to a released version with `--ref`:

```sh
herdr plugin install sekka/herdr-usage-limits --ref v0.1.0
```

For local development, link a working copy:

```sh
git clone https://github.com/sekka/herdr-usage-limits
herdr plugin link ./herdr-usage-limits
```

The plugin ID is `dotfiles.usage-limits`, which differs from the repository name and is kept stable for existing key bindings. Use the plugin ID with `herdr plugin ... --plugin <id>` commands.

## Usage

Start the title daemon again if it is not already running:

```sh
herdr plugin action invoke start-title-daemon --plugin dotfiles.usage-limits
```

## Configuration

There are currently no public plugin configuration options. Runtime state is managed by herdr plugin directories and the helper scripts in `scripts/`.

## Security disclosure

- **This plugin reads Claude Code and Codex credentials from their standard local credential files and may fall back to macOS Keychain lookup.**
- **It sends bearer tokens to Anthropic/OpenAI usage endpoints used by the local CLIs to calculate usage limits.**
- **Some usage API behavior is not a stable public plugin API; response schema or availability may change.**
- **The title daemon keeps local runtime state under herdr-managed plugin directories.**

## How it works

`src/engine.ts` handles credentials, cache freshness, usage API calls, stale output, 429 backoff, and tmux-formatted output. `src/display.ts` converts that output for the outer terminal title and writes it to herdr's socket API.

`src/title-daemon.ts` keeps the title updated without an open pane. `scripts/ensure-title-daemon.sh` is the herdr lifecycle helper. `scripts/sync-core.sh` is the only cross-repo sync path and copies vendored core from `tmux-usage-limits` into this repo.

## Troubleshooting

- Empty output usually means `bun` is not on `PATH`, credentials are unavailable, or the API request failed before a cache was available.
- If the title stops updating, invoke `start-title-daemon` again.

## Development

Run the unit tests:

```sh
bun test
```

Run the local verification harness:

```sh
./verify/verify.sh
```

Releases are automated by [release-please](https://github.com/googleapis/release-please) through `.github/workflows/release-please.yml`. Land Conventional Commits on `master`; release-please maintains the release PR, changelog, tag, and GitHub Release.

## Uninstall

Stop the daemon and uninstall the plugin:

```sh
herdr plugin action invoke stop-title-daemon --plugin dotfiles.usage-limits
herdr plugin uninstall dotfiles.usage-limits
```

If the daemon was already stopped, uninstalling the plugin is sufficient.

## License

[MIT](LICENSE) (c) sekka
