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

Testing scratch-space note:

- Prefer `examples/playground/` for isolated manual smoke-test artifacts and temporary local test files (instead of creating ad-hoc temp folders at the repository root).

---

## Documentation Policy

All meaningful agent work SHOULD be documented.

Repository-wide documentation rules now live in [DOCUMENTATION_POLICY.md](DOCUMENTATION_POLICY.md).

That policy covers:

- date and front-matter rules
- document locations and naming
- status meanings
- archive scope and link-handling rules
- traceability rules for plans, research docs, and job records

Stable release-note authoring rules now live in [RELEASE_NOTES_POLICY.md](RELEASE_NOTES_POLICY.md).

That policy covers:

- `CHANGELOGS/` naming and stable-tag matching rules
- stable release-note override behavior and fallback behavior
- release-note body structure expectations
- stable curation guidance for iterative commit history
- contributor acknowledgment rules

---

## Writing Guidelines

- Prefer clarity over verbosity
- Record _what changed_ and _why_
- Avoid repeating information already in other documents
- Assume future agents will read this without prior context

---

## Philosophy

> This file exists to reduce guesswork for the next agent.
