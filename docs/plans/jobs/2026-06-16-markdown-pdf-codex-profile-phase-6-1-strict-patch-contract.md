---
title: "Markdown PDF Codex profile Phase 6.1 strict patch contract"
created-date: 2026-06-16
status: completed
agent: codex
---

## Scope

Replace the Markdown PDF Codex profile helper's open `accepted_fields` structured output with a strict patch contract that the Codex structured-output API accepts before generation starts.

## Failure Cause

After the Phase 6 working-directory hotfix, direct Codex-assisted runs reached the real structured-output request and failed with `invalid_json_schema`:

```text
In context=('properties', 'accepted_fields'), 'additionalProperties' is required to be supplied and to be false.
```

The bug happened because the first adapter implementation asked Codex for `accepted_fields: { type: "object" }` and then validated the object after Codex returned. Strict structured-output validation rejects that open object before Codex can generate a response.

`data query` avoided this by using a closed object with fixed fields. `data stack` avoided this by using closed recommendation objects with enum-backed patch paths. Phase 6.1 aligns `md pdf-profile codex` with the `data stack` pattern.

## Fix

- Replaced `accepted_fields` with `accepted_patches`.
- Defined enum-backed Markdown PDF profile leaf patch paths.
- Kept patch operations to `replace` only.
- Limited patch values to bounded primitives or string arrays so the schema has no open nested object.
- Applied patches deterministically to the selected candidate profile.
- Required patch parent objects to already exist so `replace` patches cannot silently add new nested profile sections.
- Preserved final `validateMarkdownPdfProfileShape` validation and added profile normalization validation before reporting success.
- Updated the Codex prompt to request patches instead of arbitrary profile fragments.
- Updated the Codex report artifact to version 3 and record accepted patches.
- Added regression coverage proving the output schema no longer exposes the old open `accepted_fields` object.

## Evidence

- `bun test test/adapters-codex-markdown-pdf-profile.test.ts test/cli-actions-md-to-pdf-profile-codex-action.test.ts test/cli-actions-md-to-pdf-commands.test.ts test/cli-actions-md-to-pdf-profile.test.ts test/cli-actions-md-to-pdf-profile-codex-phase2.test.ts`
  - 76 pass, 0 fail
  - covers strict schema shape, request working-directory forwarding, accepted patch application, invalid patch rejection, fallback modes, action reports, failure reports, command wiring, profile normalization, and candidate/signal helpers
- `bun run format:check`
  - all matched files use the correct format
- `bun run lint`
  - completed successfully
- `git diff --check`
  - completed successfully
- `bun run build`
  - completed successfully
- `node dist/esm/bin.mjs md pdf-profile codex README.md --intent "clean pdf with a proper cover page" --dry-run`
  - sandboxed smoke reached Codex initialization and then stopped before a remote structured-output response on the sandbox app-server permission error: `failed to initialize in-process app-server client: Operation not permitted`
- Escalated unsandboxed live verification was rejected by policy because it would disclose README-derived signals and the intent text to the external Codex service.
  - The full live Codex-assisted request therefore remains unverified in this run.

## Notes

- The patch surface is intentionally leaf-level for Phase 6.1. This keeps the structured-output schema simple and avoids reopening arbitrary nested profile fragments.
- The report artifact version was bumped because the success payload now records `acceptedPatches` instead of `acceptedFields`.
- Prism review found that the first patch application draft could silently create missing parent objects. The implementation was tightened so replace patches require an existing parent object, and regression coverage was added.
- Telescope review found that the first job record overstated live verification. The evidence now records the sandbox and policy limits instead of claiming a full external Codex response was exercised.

## Required-Property Follow-Up

The next live run exposed a second strict structured-output schema rule:

```text
In context=(), 'required' is required to be supplied and to be an array including every key in properties. Missing 'fallback_reason'.
```

The follow-up fix keeps `fallback_reason` in the schema as a required string field. Codex should return an empty string when no fallback reason applies, and the adapter normalizes blank values back to an omitted decision/report value.

Additional focused evidence:

- `bun test test/adapters-codex-markdown-pdf-profile.test.ts test/cli-actions-md-to-pdf-profile-codex-action.test.ts test/cli-actions-md-to-pdf-commands.test.ts test/cli-actions-md-to-pdf-profile.test.ts test/cli-actions-md-to-pdf-profile-codex-phase2.test.ts`
  - 76 pass, 0 fail
  - covers the all-properties-required schema rule, blank `fallback_reason` normalization, prompt wording, action fixtures that mirror the stricter schema, command wiring, profile normalization, and candidate/signal helpers
- `bun run format:check`
  - all matched files use the correct format
- `bun run lint`
  - completed successfully
- `git diff --check`
  - completed successfully
- `bun run build`
  - completed successfully
- `node dist/esm/bin.mjs md pdf-profile codex README.md --intent "clean pdf with a proper cover page" --dry-run`
  - used `--dry-run` without report flags, so no profile or report artifact was written
  - sandboxed smoke still stops before a remote structured-output response on the app-server permission error: `failed to initialize in-process app-server client: Operation not permitted`
