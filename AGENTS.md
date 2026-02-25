# AGENTS.md

This document provides essential context for any agent working in this repository.

---

## Development Environment

- Project type: CLI application and package utils functions
- Development tooling: Bun
- Bundling tooling: Tsdown
- Runtime target: Node.js
- Language: TypeScript

Assumptions:

- Code may use Bun for development speed and tooling
- Runtime behavior MUST remain compatible with Node.js

---

## Documentation Conventions

All meaningful agent work SHOULD be documented.

### Date Policy

- Use `created-date` for when the document first begins.
- Use `modified-date` only when a later update is made.
- Keep `created-date` unchanged after initial creation.
- All dates are UTC calendar dates in `YYYY-MM-DD`.
- Do not include time-of-day or timezone suffix in front-matter date fields.
- When local and UTC dates differ, use the UTC date.

### Plan Documents

Location:

```text
docs/plans/plan-YYYY-MM-DD-<short-title>.md
```

Notes:

- Do not create or edit `docs/plan.md`.
- Use the creation date and a short, kebab-case title.

Front-matter format:

```yaml
---
title: "<plan title>"
created-date: YYYY-MM-DD
modified-date: YYYY-MM-DD # optional
status: draft | active | completed
agent: <agent name>
---
```

---

### Research Documents

Use research docs for exploratory work that is not yet ready for a plan but may inform one.

Location:

```text
docs/researches/research-YYYY-MM-DD-<short-title>.md
```

Notes:

- Use the creation date and a short, kebab-case title.
- Keep all research docs inside `docs/researches/` (not directly under `docs/`).
- Keep scope focused on a single topic or question.
- If research becomes actionable, create a plan doc and link to it.

Front-matter format:

```yaml
---
title: "<research title>"
created-date: YYYY-MM-DD
modified-date: YYYY-MM-DD # optional
status: draft | in-progress | completed
agent: <agent name>
---
```

Suggested sections:

- Goal
- Milestone Goal (optional but recommended)
- Key Findings
- Implications or Recommendations
- Open Questions (optional)
- References (use footnote-style links)

Optional metadata:

- `milestone: v0.1.0` (or another release milestone) for feature-track research.

Traceability:

- Research docs should include a short "Related Plans" section when applicable, with links to plan docs.
- Plan docs should include a short "Related Research" section when applicable, with links to research docs.
- Use those exact section titles for consistency.
- Omit the section if there are no relevant links.

---

### Job Records

For concrete tasks or implementations, create a job record.

Location:

```text
docs/plans/jobs/YYYY-MM-DD-<short-title>.md
```

Front-matter format:

```yaml
---
title: "<job title>"
created-date: YYYY-MM-DD
modified-date: YYYY-MM-DD # optional
status: draft | in-progress | completed | blocked
agent: <agent name>
---
```

---

### Path Reference Policy (Default + Exceptions)

- Use repository-relative paths for repository files in documentation (for example: `.github/workflows/release.yml`, `docs/plans/jobs/...`, `src/...`).
- Do not include real machine-specific absolute paths that may reveal local user/home details from the current environment.
- When useful for explanation, sanitized OS-specific absolute-path examples are allowed (for example: `/Users/alice/...`, `/home/alice/...`, `C:\Users\Alice\...`, `$HOME/.config/...`, `%USERPROFILE%\...`).
- Prefer placeholder usernames like `alice` or `bob` in examples.
- Keep this case-by-case: prefer clarity for behavior/docs examples, but avoid disclosing actual local paths.
- This policy applies to plan, research, and job documents, including summaries, change lists, and verification notes.

---

### Status Meanings

- `draft` — idea or exploration, not executed
- `active` — current plan being worked on
- `in-progress` — task implementation ongoing
- `completed` — work finished
- `blocked` — waiting on decision or dependency

---

## Writing Guidelines

- Prefer clarity over verbosity
- Record _what changed_ and _why_
- Avoid repeating information already in other documents
- Assume future agents will read this without prior context

---

## Philosophy

> This file exists to reduce guesswork for the next agent.
