---
title: "Environment Variables"
created-date: 2026-09-05
status: completed
agent: codex
---

## Scope

This guide covers environment variables consumed by `cdx-chores` and the
Codex environment it inherits. Set variables in the calling shell or process;
the tool does not load a `.env` file or provide its own configuration file.
There are no environment aliases for the model, provider, reasoning, or
timeout options. See [Codex Execution Configuration](./codex-execution-configuration.md)
for those command options and their precedence.

## Codex Home And Executable

| Variable                | Owner        | Behavior                                                                                                                                                                                |
| ----------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CODEX_HOME`            | Codex        | Selects Codex's configuration and state directory; normally `~/.codex`. The tool forwards its current value unchanged to execution and discovery.                                       |
| `CDX_CHORES_CODEX_PATH` | `cdx-chores` | Overrides the Codex executable for SDK helpers and `codex-info`. Surrounding whitespace is trimmed; unset, empty, or whitespace-only values use the installed SDK's bundled executable. |

`CODEX_HOME` identifies a directory containing `config.toml`, not the path to
that file. It is independent of the executable override and does not select a
Codex profile. Each invocation uses its current environment, so different
calls can use different homes without restarting the tool. Discovery also
sends its working directory to Codex, allowing Codex to resolve applicable
project configuration. Codex owns configuration precedence and path
resolution. [Codex configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)

For the bundled CLI, unset or empty `CODEX_HOME` uses the normal default.
Nonempty values are literal paths: whitespace-only values are not treated as
unset, and relative paths resolve in the child process's working directory.
The selected directory must exist. Prefer an existing absolute path;
`codex-info --details` reports the resolved home and whether the selection
came from the environment or the default.

The local auth-file inspection helper separately trims `CODEX_HOME` before
checking for `auth.json`, falling back to the normal home when the trimmed
value is empty. That local check can therefore disagree with Codex for paths
containing surrounding whitespace. It does not change the environment sent
to the child process.

Use an executable file path for `CDX_CHORES_CODEX_PATH`, not a shell command
with arguments. Invalid paths fail when inspected or launched. The override
changes the executable only; it does not change authentication, model,
provider, or home selection. A replacement executable must support the
protocol used by the requested command.

For example, on a POSIX shell with an existing alternate Codex home:

```sh
env CODEX_HOME="$HOME/.config/codex-work" cdx-chores codex-info --details
env CDX_CHORES_CODEX_PATH=/opt/tools/codex cdx-chores codex-info providers
```

On PowerShell, environment assignments apply to subsequent commands in the
current process:

```powershell
$env:CODEX_HOME = Join-Path $HOME '.config/codex-work'
cdx-chores codex-info --details
Remove-Item Env:CODEX_HOME
```

These examples assume that the selected directory or executable already
exists. The PowerShell cleanup removes the override; restore a previous
value instead if one was already set.

## Authentication Environment

| Variable                                   | Local interpretation                             | Execution behavior                                                                                                                                                                     |
| ------------------------------------------ | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CODEX_API_KEY`                            | A nonempty trimmed value is an auth signal.      | Inherited unchanged for Codex execution; Codex documents this API-key override for `exec` and the TypeScript SDK. It is not a general authentication override for every Codex command. |
| `OPENAI_API_KEY`                           | A nonempty trimmed value is also an auth signal. | Inherited unchanged; the tool does not copy it into `CODEX_API_KEY` or an SDK `apiKey` option.                                                                                         |
| A provider's configured `env_key` variable | Not inspected as a generic local auth signal.    | Inherited for Codex to resolve according to that provider's configuration.                                                                                                             |

Unset, empty, or whitespace-only API-key values do not count as local auth
signals. A signal, or the presence of `auth.json`, does not establish that a
credential is valid or usable by the chosen provider. The local inspection
does not inspect the OS keyring, read credential contents, or authenticate a
request. Helper requests and `codex-info` do not depend on this inspection.

The SDK inherits the process environment, and this tool supplies neither an
SDK environment replacement nor an explicit SDK API key. `CODEX_API_KEY` can
be supplied for one helper invocation; its documented execution scope does
not establish authentication behavior for the `app-server` used by
`codex-info`. [Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)

Codex owns actual credential selection. Its supported login flow can use an existing
`OPENAI_API_KEY` through `printenv OPENAI_API_KEY | codex login --with-api-key`;
merely setting that variable is not the same operation as logging in.
Credentials may be stored in a file under `CODEX_HOME` or in the OS keyring,
depending on Codex configuration. [Codex authentication](https://learn.chatgpt.com/docs/auth)

Custom provider configuration can name an environment variable with
`model_providers.<id>.env_key`. Providers with `requires_openai_auth = true`
use OpenAI authentication instead, ignoring `env_key`. Configure these rules
in Codex; `cdx-chores` adds no competing credential precedence.
[Codex configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)

Other inherited Codex variables, including additional authentication and
network settings, remain Codex-owned. See the
[official environment-variable catalog](https://learn.chatgpt.com/docs/config-file/environment-variables)
for their supported values and command scopes.

## Color

| Variable      | Accepted value                             | Default and effect                                                                                                                   |
| ------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `NO_COLOR`    | Any value, including an empty string       | When present, disables shared CLI color styling. When absent, styling is eligible only on the target TTY with runtime color enabled. |
| `FORCE_COLOR` | Not interpreted by the shared color policy | Does not override `NO_COLOR`, global `--no-color`, disabled runtime color, or a redirected target stream.                            |

The global `--no-color` option also disables styling. Stdout and stderr are
evaluated independently; JSON and saved artifacts stay unstyled. For
example, both commands below produce plain human output:

```sh
env NO_COLOR= cdx-chores codex-info models
cdx-chores --no-color codex-info providers
```

See [CLI Output And Color](./cli-output-and-color.md) for stream routing and
the complete presentation contract.

## Interactive Path Prompts

These tool-owned variables affect interactive path entry, not command-line
path arguments or filesystem validation.

| Variable                                       | Accepted values     | Default | Effect                                                                                                                          |
| ---------------------------------------------- | ------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `CDX_CHORES_PATH_PROMPT_MODE`                  | `auto`, `simple`    | `auto`  | `simple` forces the plain input prompt. Unknown or empty values select `auto`.                                                  |
| `CDX_CHORES_DISABLE_PATH_AUTOCOMPLETE`         | Boolean             | `false` | `true` disables the advanced autocomplete prompt and selects simple input.                                                      |
| `CDX_CHORES_PATH_AUTOCOMPLETE_MIN_CHARS`       | Nonnegative integer | `1`     | Minimum input length for suggestions; explicit path prefixes can trigger suggestions earlier. `0` removes the length threshold. |
| `CDX_CHORES_PATH_AUTOCOMPLETE_MAX_SUGGESTIONS` | Nonnegative integer | `12`    | Caps suggestions; `0` returns none.                                                                                             |
| `CDX_CHORES_PATH_AUTOCOMPLETE_INCLUDE_HIDDEN`  | Boolean             | `false` | Includes hidden entries in generic suggestions; explicit dot-prefix input can still find matching hidden entries when `false`.  |

Mode and boolean values are trimmed and case-insensitive. Booleans accept
`1`, `true`, `yes`, or `on`, and `0`, `false`, `no`, or `off`. Unset, empty,
or unrecognized booleans use their defaults. Numeric values use JavaScript
numeric conversion and must resolve to nonnegative integers; unset, empty,
negative, fractional, or nonnumeric values use their defaults.

Simple mode or disabled autocomplete takes precedence over suggestion
settings. Auto mode also requires a working directory and TTY input/output;
otherwise the simple prompt is used. See
[Interactive Path Prompt UX](./interactive-path-prompt-ux.md) for keyboard
behavior and fallback handling.

```sh
env CDX_CHORES_PATH_PROMPT_MODE=simple cdx-chores interactive
env CDX_CHORES_PATH_AUTOCOMPLETE_MAX_SUGGESTIONS=6 cdx-chores interactive
```

## Home Directory Display

The tool reads trimmed `HOME`, falling back to Node's home-directory lookup,
to replace a matching home prefix with `$HOME` in displayed DuckDB extension
cache paths. This display helper does not choose or relocate the extension
cache; cache locations come from DuckDB. Changing `HOME` can also affect
inherited third-party behavior, so use `CODEX_HOME` when the intended change
is only Codex's configuration location.

## Implementation References

- [Codex execution and local inspection](../../src/adapters/codex/shared.ts)
- [Codex discovery environment](../../src/adapters/codex/discovery/index.ts)
  and [executable resolution](../../src/adapters/codex/discovery/executable.ts)
- [Shared color policy](../../src/cli/colors.ts)
- [Path-prompt environment parsing](../../src/cli/prompts/path-config.ts)
  and [prompt selection](../../src/cli/prompts/path.ts)
- [DuckDB path display](../../src/cli/duckdb/extensions.ts)
