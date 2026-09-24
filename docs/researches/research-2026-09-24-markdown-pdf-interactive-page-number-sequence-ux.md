---
title: "Interactive Markdown PDF Page-Number Sequence UX"
created-date: 2026-09-24
status: draft
agent: codex
---

## Goal

Record the current Interactive gap for authoring `pageNumbers.start` and
`pageNumbers.increment`, and explore how to make the sequence understandable
without settling a new prompt flow yet. The Profile schema and renderer already
support both fields. This research covers Profile `formal-guide` and Codex
Assistant Profile/Project preparation reached from Interactive `to-pdf` or
`pdf-recipes`.

## Current Situation

| Surface | Current behavior |
| --- | --- |
| Profile and renderer | The Profile accepts a non-negative integer `start` and a positive integer `increment`. `{page}` and `{pages}` use that logical sequence. Direct `md to-pdf` and Interactive's one-render prompt can only override whether numbering is enabled; the other values stay Profile-owned. [^usage] |
| Profile `formal-guide` | Numbering ON asks for body or whole-document numbering, a label, and a position. The collector couples `scope` and `countFrom` and writes `start: 1`, `increment: 1`, including when its answers are revised. [^formal-guide] |
| Codex Assistant Profile/Project setup | Structured page information can be unspecified, OFF, or ON. ON uses the same guided questions and writes `1`/`1`; signal validation rejects other values. An explicit ON choice is applied after the base/Codex decision, so it also replaces a base Profile's custom sequence. [^codex-page-information] |
| Reviews and reports | When numbering is enabled, the prepared Profile review displays its effective start and increment, but the structured setup does not ask for them. The optional report records requested ON values as `1`/`1` and records the final Profile values separately. [^review-report] |
| Direct Profile helper | `md pdf-profile codex` can recommend these fields through its bounded patch contract. That route depends on the resulting candidate; Profile YAML or JSON is the explicit way to set exact values today. [^direct-helper] |

For example, a base Profile can contain `start: 5` and `increment: 2`. If a
user selects an explicit ON answer in Codex Assistant to enable numbering or
revise its label, that answer produces `1` and `1` in the prepared Profile. The
user can see the effective values in candidate review but cannot keep or edit
the custom sequence within that guided answer. Leaving page information
unspecified avoids this explicit override; the prepared Profile still needs
review because other preparation may affect its values.

The [Interactive usage guide](../guides/markdown-pdf-interactive-usage.md) now
cautions readers about the Codex Assistant behavior. It already documents
Formal Guide's fixed values and the Profile editing route. The
[Markdown PDF usage guide](../guides/markdown-pdf-usage.md#page-number-sequence-and-visibility)
remains the source of truth for sequence meaning, valid values, and renderer
behavior.

## Why Revisit The UX

The earlier [Interactive page-number UX research](research-2026-08-14-markdown-pdf-interactive-page-number-and-page-chrome-ux.md)
shortened an overlong prompt flow by moving detailed sequence fields into
Profile YAML or JSON. The completed [Codex page-information research](research-2026-09-22-markdown-pdf-interactive-codex-page-information.md)
reused those guided choices and explicitly left custom start and increment
outside its scope. That kept ordinary setup concise. The newer structured Codex
path also creates a base-Profile revision case where an explicit ON answer
replaces custom sequence values. The guide caution makes the present behavior
visible; the authoring and revision experience still needs exploration.

## Questions To Explore

- Which user tasks require a different first number or step, and how often do
  they arise during fresh authoring versus base-Profile revision?
- When someone changes only the label, position, or ON state, what should
  happen to an existing custom sequence? How should the choice be shown before
  it replaces Profile values?
- Can the sequence remain out of the ordinary prompt path while still being
  discoverable and editable when needed? Compare a conditional sequence choice
  with editing the Profile after candidate review.
- What should setup review, consent, candidate review, and the optional report
  display if custom values become explicit answers? Keep page-number policy in
  the Profile and the one-render prompt limited to enablement.
- Which cases demonstrate the selected UX clearly: `start: 0`, a non-unit
  increment, cover/ToC counting, OFF then ON, and Profile versus Project
  preparation?

No prompt design, implementation plan, or release target is chosen here. Once
the interaction and validation evidence support a direction, record the
decision and create a linked plan if implementation work is needed.

## References

[^usage]: [Markdown PDF Usage](../guides/markdown-pdf-usage.md#page-number-sequence-and-visibility) and [Interactive Markdown PDF Usage](../guides/markdown-pdf-interactive-usage.md).
[^formal-guide]: [Formal Guide collection](../../src/cli/interactive/markdown/formal-guide/collection.ts) and [prompts](../../src/cli/interactive/markdown/formal-guide/prompts.ts).
[^codex-page-information]: [Codex page-information collection](../../src/cli/interactive/markdown/codex-page-information.ts), [signal validation](../../src/cli/markdown-pdf/profile-codex/page-information-signals.ts), and [materialization](../../src/cli/markdown-pdf/profile-codex/page-information-materialization.ts).
[^review-report]: [Profile authoring review](../../src/cli/markdown-pdf/profile-authoring-review.ts) and [Codex report page information](../../src/cli/markdown-pdf/codex-report/page-information.ts).
[^direct-helper]: [Markdown PDF Codex Profile Helper](../guides/markdown-pdf-codex-profile-helper.md#supported-profile-patch-boundary).
