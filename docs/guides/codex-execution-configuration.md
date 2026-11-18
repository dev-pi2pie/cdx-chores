---
title: "Codex Execution Configuration"
created-date: 2026-09-05
modified-date: 2026-11-18
status: completed
agent: codex
---

## Choose Model, Provider, Reasoning, And Speed

The Codex helper commands in the table below accept these execution options. The benchmark also accepts them with the differences described under Command Scope.

| Option                              | When omitted                          | When supplied                          |
| ----------------------------------- | ------------------------------------- | -------------------------------------- |
| `--codex-model <model>`             | Inherit model selection from Codex    | Request the supplied model ID          |
| `--codex-provider <provider-id>`    | Inherit provider selection from Codex | Request the supplied provider ID       |
| `--codex-reasoning-effort <effort>` | Request `low`                         | Request the supplied recognized effort |
| `--codex-speed <speed>`              | Inherit the configured speed           | Request `standard`, `fast`, or `ultrafast` |

Inheritance means the configuration loaded by the helper's Codex process. A selection in another terminal or desktop session is not automatically forwarded. A model-only override leaves provider resolution to Codex; a provider-only override leaves model resolution to Codex. These options do not rewrite configuration or enable a Codex workflow by themselves.

The helper default `low` overrides an inherited reasoning value; it is not a cap. Accepted efforts are `minimal`, `low`, `medium`, `high`, `xhigh`, `max`, `ultra`, and `persistent`. Use exact lowercase values without surrounding whitespace. `inherit` and `none` are not accepted effort options. Acceptance by this CLI does not establish support by the chosen model or provider.

Model and provider IDs are case-sensitive. The CLI trims surrounding whitespace and rejects empty IDs. On helper commands, each option may appear only once. For benchmark repetition rules, see [Command Scope](#command-scope). The CLI rejects invalid explicit values before running the command.

Speed selects the requested service tier. Use `standard` to override an inherited Fast or Ultrafast setting. Tier availability depends on the model, provider, and account or workspace. Reasoning effort is configured independently.

## Command Scope

| Command                                       | Requests controlled                                             |
| --------------------------------------------- | --------------------------------------------------------------- |
| `rename file`, `rename batch`, `batch-rename` | Enabled image/document analyzers, including batches and retries |
| `data query codex`                            | SQL drafting                                                    |
| `data stack`                                  | Existing `--codex-assist` requests, which require `--dry-run`   |
| `md pdf-profile codex`                        | Profile drafting                                                |
| `md pdf-template codex`                       | Template drafting and repair                                    |
| `md pdf-project codex`                        | Profile, template, and repair phases                            |
| `interactive`                                 | All Codex helper requests in that session                       |
| `codex-bench`                                 | Fresh benchmark warm-ups and measured trials                    |

Place execution options after the adopted command. Root and parent commands do not accept them. Direct `data query --codex-suggest-headers` and `data extract --codex-suggest-headers` / `--codex-suggest-shape` keep inherited model/provider selection and the `low` helper default. Direct `rename cleanup` and deterministic Markdown commands also do not expose these options.

`codex-bench` inherits reasoning effort from Codex when the effort flag is omitted. It accepts repeated model and speed flags for a matrix, or repeated `--case MODEL=SPEED` entries for exact pairs. Provider and reasoning effort each take one value for the invocation. See [Codex Benchmark](codex-benchmark.md) for examples and how to read the results.

The PDF `--profile` option retains its rendering-profile meaning. There is no `--codex-profile`, `--codex-fast`, or `--oss` option in `cdx-chores`. Provider definitions and authentication are configured through Codex, rather than through provider URLs, credentials, or profile loaders in this tool.

The following examples use illustrative IDs. Replace them with selections supported by your Codex configuration and provider:

```sh
cdx-chores rename batch ./photos --codex --dry-run \
  --codex-model model-a --codex-provider company-proxy \
  --codex-reasoning-effort medium

cdx-chores data query codex ./sales.csv \
  --intent "Summarize sales by region" --print-sql \
  --codex-model model-a --codex-reasoning-effort high

cdx-chores md pdf-template codex ./report.md --dry-run \
  --intent "Compact report with clear headings" \
  --codex-provider company-proxy --codex-reasoning-effort medium
```

Interactive selections are validated at startup and retained through menu visits, requests, retries, repairs, and regeneration:

```sh
cdx-chores interactive --codex-model model-a \
  --codex-provider company-proxy --codex-reasoning-effort medium
```

Existing consent prompts still control whether Codex runs. A new session resolves its own settings; starting Interactive mode without a command uses the defaults. Selections are not saved in generated profiles, templates, data plans, or recovery artifacts. Writing an already prepared result does not require a new Codex request merely because execution options are present.

## Retain Codex Sessions

Use `--session-retention keep|archive|delete` after an adopted command, including the explicit `interactive` command. The default, `keep`, leaves its sessions in active history. `archive` moves them out of active history and keeps their rollouts. `delete` permanently removes the sessions and any descendant threads. The policy applies to threads created by the command. One-shot helpers release a thread after capturing its result, and multi-turn helpers release it after its final use, including retries, repairs, and regeneration. Benchmark warm-ups and measured trials follow the same policy after the completed turn's rollout readback or its deadline.

Archive and delete use the selected Codex CLI's app-server. Archive is documented as of Codex CLI 0.61.0 and delete was introduced in 0.140.0. Both modes were verified with Codex 0.170.0, the benchmark's verified app-server baseline. Cleanup failures preserve captured results and report the affected thread. Benchmark cleanup failures also return exit status 1. [Retention version evidence](../researches/research-2026-11-18-codex-cli-benchmark.md#session-retention)

## Failures And Manual Reruns

An unknown provider, rejected model or effort, missing authentication, or unsupported request capability surfaces through the workflow's existing error, warning, or report path. Existing partial results and deterministic fallback remain workflow-owned. The tool does not silently switch model, provider, or effort, and it does not retry with the effort override omitted. This applies equally to a rejected default `low` and a rejected explicit effort.

Existing workflow retries retain the same explicit selections. After inspecting the failure and confirming a supported combination, start a new invocation with that explicit selection. For example, if the first illustrative request fails because its selection is unsupported:

```sh
cdx-chores data query codex ./sales.csv \
  --intent "Summarize sales by region" --print-sql \
  --codex-model model-a --codex-provider company-proxy \
  --codex-reasoning-effort high
```

A manual rerun could use a combination you have confirmed is supported:

```sh
cdx-chores data query codex ./sales.csv \
  --intent "Summarize sales by region" --print-sql \
  --codex-model model-b --codex-provider company-proxy \
  --codex-reasoning-effort medium
```

Changing model or reasoning effort does not change timeout policy. See [Codex Timeouts, Retries, And Recovery](./codex-timeouts-retries-and-recovery.md) for per-attempt deadlines, rename retries, and repair/regeneration lifecycles.

## Inspect Configuration And Catalog Metadata

```sh
cdx-chores codex-info
cdx-chores codex-info --details
cdx-chores codex-info --json
cdx-chores codex-info models
cdx-chores codex-info models --details
cdx-chores codex-info models --json
cdx-chores codex-info providers
cdx-chores codex-info providers --details
cdx-chores codex-info providers --json
```

Put output options after the invoked command: use `codex-info models --json`, not `codex-info --json models`. `--details` and `--json` are mutually exclusive and are rejected together before discovery starts.

| View                   | Default human output                                                                              | Additional details                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `codex-info`           | Configured model/provider, helper reasoning default, catalog recommendation, coverage/scope notes | Configured reasoning effort and invocation context                                           |
| `codex-info models`    | Provider context, model IDs, reasoning efforts, advertised speed tiers, configured/recommended markers | Available descriptions, input modalities, catalog reasoning and tier defaults, and invocation context |
| `codex-info providers` | Configured provider, definition IDs, selection markers, coverage/scope notes                      | Available display names and invocation context                                               |

Invocation context includes the working directory, Codex home, home source, and Codex CLI version. Human output uses restrained headings and ID/selection emphasis on eligible terminals. `NO_COLOR` (including an empty value), global `--no-color`, disabled runtime color, and redirected stdout disable styling. JSON remains unstyled. See [CLI Output And Color](./cli-output-and-color.md) for the shared policy.

Discovery inherits `CODEX_HOME` dynamically for each invocation, as does helper execution. The CLI executable can be selected independently through `CDX_CHORES_CODEX_PATH`. See [Environment Variables](./environment-variables.md) for defaults, edge cases, authentication ownership, and examples. Configuration is resolved for the invocation's working directory; reports from different directories or environments can differ.

These commands inspect information without generating content or writing configuration. They accept no model/provider/reasoning selection overrides and do not supply settings to later helper requests. There is no Interactive entry or provider selection picker for discovery.

### Interpret The Results

Configured selection, catalog recommendation, and helper reasoning default are separate values. An unspecified configured model/provider is not inferred from the catalog. `[catalog recommended]` does not mean that model is configured. Unknown or absent reasoning metadata does not prove that reasoning is disabled or unsupported. The catalog can report efforts outside the helper CLI's accepted effort set.

Model results are Codex's picker-visible catalog metadata. Advertised tiers and catalog defaults describe the catalog. Provider acceptance requires a request through that provider. Changing provider selection can leave the catalog unchanged. A configured model absent from the catalog remains visible as an unlisted selection with unknown capabilities.

Provider results list configured definitions, sorted by case-sensitive ID, with only the exact configured selection marked. Current coverage is `configured-only`: built-in provider IDs are not enumerated. No configured selection causes no automatic choice, and an unlisted selection does not imply lack of support.

For example, a setup with built-in OpenAI plus definitions named `company-proxy` and `local-gateway` produces this plain output when the reported selection is `openai`:

```text
Codex providers

Configured provider: openai
Source: configured definitions only; built-ins not enumerated.
Credentials and request support are not verified.

company-proxy
local-gateway
Configured provider openai is unlisted; absence does not imply lack of support.
```

Selecting `company-proxy` instead changes the header and adds `[configured]` to that row. It does not add an OpenAI row. If all three IDs are returned as configured definitions, all three are listed. Provider discovery does not query each backend or associate a verified model list with each definition.

### Dependencies, Errors, And JSON

All views require Codex startup and a successful configuration read. Overview and model views also require every catalog page. Provider listing does not request the model catalog, so an unrelated catalog failure does not prevent it from succeeding. Discovery may contact Codex services for metadata; it is not guaranteed to work offline.

Discovery has a separate 30-second overall deadline covering startup and all required reads. It exposes no `--codex-timeout` flag. A required read or protocol failure exits nonzero with a sanitized error and no report on stdout; it does not emit partial JSON or a truncated catalog. A successful empty list is a valid result.

JSON uses `schemaVersion: 1` and curated fields for context, configured selection, helper default, provider coverage/definitions, and catalog metadata. In the providers view, model/catalog fields are `null` because they were not requested; an empty model array in other views means the requested catalog was successfully empty. Optional unavailable metadata uses `null`. Raw configuration, provider connection/authentication fields, and arbitrary configuration layers are excluded from output. External control characters are escaped while parsed JSON values are preserved.

## Related Guides

- [Codex Benchmark](codex-benchmark.md)
- [Environment Variables](./environment-variables.md)
- [Codex Timeouts, Retries, And Recovery](./codex-timeouts-retries-and-recovery.md)
- [CLI Output And Color](./cli-output-and-color.md)
- [Rename Scope And Codex Capability Guide](./rename-scope-and-codex-capability-guide.md)
