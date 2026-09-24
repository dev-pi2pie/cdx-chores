---
title: "Page-information report and cover-intent fixes"
created-date: 2026-09-24
status: in-progress
agent: codex
---

## Scope

Starting commit: `4d5909fa1be48148912802b331e504c5bce970e8`.

- Accept valid inherited `pageNumbers.start: 0` in final diagnostic-report metadata while keeping guided number-ON requests starting at 1.
- Prevent weak cover-keyword matches from overriding validated model decisions; retain explicit image/base-Profile constraints and recognized cover-conflict checks.

## Verification

Regression tests and independently authored synthetic smoke resources cover both findings. The smoke uses injected model responses and the built Node CLI, with real Pandoc and WeasyPrint rendering. No private resources are copied or identified here.

### Zero-start report checkpoint

- Final report metadata accepts zero, matching the Profile contract. Guided number-ON requests still require start 1.
- Regression coverage saves and reloads Profile and Project artifacts with inherited start zero, numbering enabled or disabled, repeating content OFF, and diagnostic reports.
- Focused report unit tests: 5 passed. Focused helper application tests: 10 passed. TypeScript, lint, formatting, build, and `git diff --check` passed.

Cover-intent implementation, synthetic PDF smoke, full validation, checkpoint commit references, and final commit-range review remain pending.
