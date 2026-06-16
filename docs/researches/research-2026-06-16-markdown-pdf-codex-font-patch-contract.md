---
title: "Markdown PDF Codex font patch contract"
created-date: 2026-06-16
status: complete
agent: codex
---

## Goal

Define a strict structured-output contract for Codex-assisted Markdown PDF font adaptation that supports flexible profile font maps without reopening arbitrary profile objects.

This research supports Phase 6.5 of `docs/plans/plan-2026-06-15-markdown-pdf-codex-profile-helper.md`.

## Why This Research

The current `md pdf-profile codex` helper uses enum-backed JSON Pointer paths for every accepted profile patch. That works for fixed profile leaves such as `/cover/fields/title` and `/pageNumbers/position`.

It is a poor fit for profile font maps:

- `fonts.body` accepts `default` and language tags such as `zh-Hant`, `ja`, `en-US`, or other valid language-tag keys.
- `fonts.code` supports both `default` and the documented `symbols` key.
- `fonts.heading` and `fonts.pageChrome` are effectively default-only for the current renderer.
- strict path enums can only expose keys that were listed before Codex runs.

Adding a few CJK paths to the normal patch enum would only solve the examples in `markdown-pdf-usage.md`. It would still block valid language keys that the profile schema already accepts.

## Previous Contract

Before this branch, normal accepted patches could look like this:

```json
{
  "op": "replace",
  "path": "/fonts/body/default",
  "value": "Source Serif 4"
}
```

The path is an enum. Because the language key is embedded in the path, every supported language would need a separate enum entry.

## Settled Direction

Use a dedicated font patch array instead of encoding font map keys into normal JSON Pointer paths.

Recommended structured output:

```json
{
  "accepted_patches": [
    {
      "op": "replace",
      "path": "/cover/fields/title",
      "value": "{title}"
    }
  ],
  "accepted_font_patches": [
    {
      "op": "replace-font",
      "role": "body",
      "key": "ja",
      "value": "Noto Serif JP"
    }
  ]
}
```

`accepted_patches` remains the contract for fixed profile leaves.

`accepted_font_patches` becomes the contract for font map writes.

## Implementation Outcome

The dedicated font patch contract landed through
`docs/plans/plan-2026-06-16-markdown-pdf-codex-font-patch-contract.md`.

Implemented behavior:

- `accepted_font_patches` is a required strict structured-output array.
- `accepted_patches` no longer accepts `/fonts/...` JSON Pointer paths.
- Font patches validate role/key combinations at runtime.
- `body` font keys support `default` and profile-valid language tags.
- `code` font keys support `default` and `symbols`.
- `heading` and `pageChrome` font keys support `default`.
- Generated profiles still serialize font decisions as normal `fonts` YAML or JSON.
- Codex diagnostic reports expose `acceptedFontPatches` separately from normal `acceptedPatches`.
- The Markdown PDF Codex report artifact version is `4`.

## Strict Schema Shape

Strict structured output can support this as a closed object shape:

```text
accepted_font_patches[]
  op: enum ["replace-font"]
  role: enum ["body", "heading", "code", "pageChrome"]
  key: string
  value: string
```

The schema remains strict because:

- the root object has `additionalProperties: false`
- each font patch object has `additionalProperties: false`
- all font patch object properties are required
- `role` and `op` are finite enums
- `key` and `value` are strings validated by runtime rules after parsing

Runtime validation should own language-tag semantics. The JSON schema should not attempt to encode every valid language tag.

## Runtime Validation Rules

Font patch validation should be role-aware:

| Role | Allowed keys |
| --- | --- |
| `body` | `default` or a valid language tag accepted by profile validation |
| `code` | `default` or `symbols` |
| `heading` | `default` |
| `pageChrome` | `default` |

Value rules:

- `value` must be a non-empty string after trimming.
- Generic CSS families such as `serif`, `sans-serif`, and `monospace` remain valid when they are intentionally selected.
- `sans` and `mono` should not be treated as aliases.
- Font coverage facts may produce warnings, but incomplete coverage should not make the structured response schema-invalid.

## Application Rules

Font patches should apply after selecting the base candidate and before final profile validation:

```text
base = selectedCandidate.fullProfile
profile = applyAcceptedPatches(base, accepted_patches)
profile = applyAcceptedFontPatches(profile, accepted_font_patches)
validate(profile)
normalize(profile)
write(profile + profile identity metadata)
```

All font writes should materialize missing plain-object parents under `fonts` as needed:

```yaml
fonts:
  body:
    ja: "Noto Serif JP"
  code:
    symbols: "JetBrainsMono Nerd Font"
```

Font patches must fail closed for scalar parents, array parents, unsupported roles, unsupported role/key combinations, empty values, deletion, reset semantics, and arbitrary object values.

## Report And Replay Shape

Codex diagnostic reports should record font patches separately from normal accepted patches:

```json
{
  "acceptedPatches": [],
  "acceptedFontPatches": [
    {
      "op": "replace-font",
      "role": "body",
      "key": "zh-Hant",
      "value": "Noto Serif TC"
    }
  ]
}
```

This keeps replay and review readable:

- normal layout/profile changes remain JSON Pointer patches
- font decisions remain role/key assignments
- future guides can explain font choices without exposing dynamic pointer paths

The report artifact version should be bumped when `acceptedFontPatches` is added.

## Prompt Direction

Codex should receive bounded instructions:

- use `accepted_font_patches` for every font write
- do not use normal `accepted_patches` for `/fonts/...`
- choose font patches only when document signals, font hints, or base-profile refinement justify the change
- prefer exact discovered font family names when available
- report unavailable or weak font evidence through warnings instead of inventing unsupported fields

## Non-Goals

- no arbitrary nested profile object output
- no broad `--style-hint`
- no new language-specific CLI flags
- no renderer changes for font fallback behavior
- no local cover image support
- no template generation

## Implementation Notes

- The report artifact version was bumped to `4`.
- Existing normal `/fonts/...` patch paths were removed from `accepted_patches`, so there is one font-write contract.
- Prompt and tests include flexible language-key and code-symbol font cases so the contract is visibly not CJK-only.

## Related Docs

- `docs/plans/plan-2026-06-15-markdown-pdf-codex-profile-helper.md`
- `docs/plans/plan-2026-06-16-markdown-pdf-codex-font-patch-contract.md`
- `docs/guides/markdown-pdf-usage.md`
- `docs/researches/research-2026-06-10-markdown-pdf-codex-profile-and-interactive-flow.md`
