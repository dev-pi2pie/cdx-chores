---
title: "Reject multiple serial placeholders"
created-date: 2026-02-27
status: completed
agent: codex
---

Enforced a single-serial-placeholder rule for rename templates.

Why:
- The planner only supports one serial configuration per template.
- Allowing multiple `{serial...}` placeholders silently masked malformed later tokens and rewrote later placeholders to match the first one.

What changed:
- `rename` template validation now rejects patterns containing more than one `{serial...}` placeholder.
- Added regression coverage for the rejection path.
- Updated rename guides to document the rule explicitly.
