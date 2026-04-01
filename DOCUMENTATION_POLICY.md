# DOCUMENTATION_POLICY.md

Repository-wide policy for plans, research docs, job records, and related documentation lifecycle decisions.

---

## Documentation Conventions

All meaningful agent work SHOULD be documented.

### Date Policy

- Use `created-date` for when the document first begins.
- Use `modified-date` only when a later substantive update is made.
- Keep `created-date` unchanged after initial creation.
- All dates are UTC calendar dates in `YYYY-MM-DD`.
- Do not include time-of-day or timezone suffix in front-matter date fields.
- When local and UTC dates differ, use the UTC date.
- `modified-date` records the last meaningful content revision, not routine file movement.
- Moving a doc into `archive/` does not by itself require changing `modified-date`.
- Link rewrites made only because a doc moved into `archive/` do not by themselves require changing `modified-date`.
- If an archive pass also changes the document's substance, such as status guidance, conclusions, recommendations, or other reader-facing content, then update `modified-date`.

### Documentation Lifecycle Policy

This repository separates document lifecycle state from document storage location.

- `status` answers what state the work is in.
- archive location answers whether the document is still a primary working document.

Do not use archive location as a substitute for clear status.
Do not use `completed` to mean "implemented" unless the document type itself is an implementation record.

Recommended structure:

```text
docs/
  researches/
    research-YYYY-MM-DD-<short-title>.md
    archive/
      research-YYYY-MM-DD-<short-title>.md
  plans/
    plan-YYYY-MM-DD-<short-title>.md
    jobs/
      YYYY-MM-DD-<short-title>.md
    archive/
      plan-YYYY-MM-DD-<short-title>.md
```

Archive scope rules:

- only research docs and top-level plan docs may move into `archive/`
- job records should remain in `docs/plans/jobs/` even when related research or plan docs are archived
- do not create `docs/plans/archive/jobs/` in the first documentation reorganization pass
- revisit job-record archiving only if the active job list becomes meaningfully hard to work with

Archive link-handling rules:

- do not leave broken repository-relative links when moving a doc into `archive/`
- update all affected links to the new archive path
- internal historical docs, including job records and related research/plan sections, may link to archived docs directly
- guide docs and other user-facing reference docs should prefer non-archived current docs over archived ones
- if a guide doc still mentions an archived doc, label it clearly as historical context or historical reference
- historical labeling is required only for guide docs and other user-facing reference docs, not for archived docs or job-record traceability links
- when a doc is archived because it is `superseded`, add a short status note that points readers to the newer primary doc when applicable

### Archived Follow-Up Rule

When new work is related to an archived doc:

- create a new current doc for the new issue, fix, or follow-up
- link back to the archived doc as historical context
- do not reopen the archived doc as the main working document
- update the archived doc only if a short status note is needed to prevent reader confusion
- change `modified-date` on the archived doc only when its reader-facing content changes

Archived docs explain what was known then. New current docs explain what is known now.

Use a short `Historical Context` or `Related Historical Docs` section in the new doc when the archived doc is materially relevant.

### Plan Documents

Location:

```text
docs/plans/plan-YYYY-MM-DD-<short-title>.md
docs/plans/archive/plan-YYYY-MM-DD-<short-title>.md
```

Notes:

- Do not create or edit `docs/plan.md`.
- Use the creation date and a short, kebab-case title.
- Keep active and current-reference plans in `docs/plans/`.
- Move only historical non-primary plan docs into `docs/plans/archive/`.

Front-matter format:

```yaml
---
title: "<plan title>"
created-date: YYYY-MM-DD
modified-date: YYYY-MM-DD # optional
status: draft | active | completed | blocked | cancelled | superseded
agent: <agent name>
---
```

Plan status guidance:

- `draft` — proposed work not yet started
- `active` — current execution plan being worked on
- `completed` — the planned work is finished
- `blocked` — the plan is still intended, but execution cannot currently proceed
- `cancelled` — the plan was intentionally stopped and is not expected to resume
- `superseded` — a newer plan replaced this plan as the main execution path

Plan archive guidance:

- move a plan into `docs/plans/archive/` when its status is `cancelled` or `superseded`
- keep `draft`, `active`, and `blocked` plans in `docs/plans/`
- keep `completed` plans in `docs/plans/` while they still serve as useful current references
- marking a plan `completed` does not by itself move it to `docs/plans/archive/`
- archive a completed plan only after a separate later review confirms it is mature enough to stop being a primary working reference

---

### Research Documents

Use research docs for exploratory work that is not yet ready for a plan but may inform one.

Location:

```text
docs/researches/research-YYYY-MM-DD-<short-title>.md
docs/researches/archive/research-YYYY-MM-DD-<short-title>.md
```

Notes:

- Use the creation date and a short, kebab-case title.
- Keep all research docs inside `docs/researches/` or `docs/researches/archive/` (not directly under `docs/`).
- Keep scope focused on a single topic or question.
- If research becomes actionable, create a plan doc and link to it.
- A newly created research doc should default to `draft` unless it is explicitly backfilling research that was already completed before the doc was written.

Front-matter format:

```yaml
---
title: "<research title>"
created-date: YYYY-MM-DD
modified-date: YYYY-MM-DD # optional
status: draft | in-progress | completed | blocked | cancelled | superseded
agent: <agent name>
---
```

Research status guidance:

- `draft` — early research, hypothesis collection, or initial analysis that is not yet settled
- `in-progress` — active investigation is currently underway
- `completed` — the research question is sufficiently answered and the conclusions are accepted as the current working direction
- `blocked` — the research should continue, but cannot currently proceed because of a dependency, decision, or missing prerequisite
- `cancelled` — the research direction was intentionally stopped and is not expected to continue
- `superseded` — a newer research or plan doc replaced this doc as the main reference

Important rule:

- `completed` for research means the research is finished
- `completed` for research does not require implementation to exist
- if implementation is deferred or never happens, the research may still remain `completed` if the question itself was answered
- marking a research doc `completed` does not by itself move it to `docs/researches/archive/`
- archive a completed research doc only after a separate later review confirms it is mature enough to stop being a primary working reference

Research archive guidance:

- move a research doc into `docs/researches/archive/` when its status is `cancelled` or `superseded`
- keep `draft`, `in-progress`, and `blocked` research docs in `docs/researches/`
- keep `completed` research docs in `docs/researches/` while they still serve as primary or current references
- do not archive a completed research doc only because implementation landed
- archive it only after a separate later review confirms it is no longer a primary working reference

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

Notes:

- Keep all job records in `docs/plans/jobs/`.
- Do not add a job-record archive location in the first documentation reorganization pass.
- Job records are execution history and should remain easy to audit from one stable location.

Front-matter format:

```yaml
---
title: "<job title>"
created-date: YYYY-MM-DD
modified-date: YYYY-MM-DD # optional
status: draft | in-progress | completed | blocked | cancelled
agent: <agent name>
---
```

Job status guidance:

- `draft` — job was created but execution has not started
- `in-progress` — execution is currently underway
- `completed` — the job work is finished
- `blocked` — the job should continue later, but cannot proceed now
- `cancelled` — the job was intentionally stopped and will not continue

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

Use these rules when choosing between similar statuses:

- use `blocked` when the same doc is still expected to resume
- use `cancelled` when the direction is intentionally stopped
- use `superseded` when a newer document should be treated as the main reference
- use `completed` when the document's own purpose is finished, even if downstream implementation is still pending
