# RELEASE_NOTES_POLICY.md

Repository-wide policy for stable release notes authored under `CHANGELOGS/`.

---

## Purpose

Stable release notes may be authored manually as committed source instead of always being generated from commit history.

When `CHANGELOGS/<tag>.md` exists for a stable tag, the stable release workflow uses that file as the final GitHub release body.

When no matching file exists, the repository falls back to `scripts/generate-stable-release-notes.sh`.

## Scope

- this policy applies only to stable release notes
- prerelease notes continue to follow the existing prerelease workflow
- `CHANGELOGS/` should contain release-note bodies keyed by stable tag

Tracked directory note:

- keep `CHANGELOGS/.gitkeep` only as the empty-directory tracking file until a real stable release note is added

## Naming Contract

- stable release-note files must live under `CHANGELOGS/`
- filename must exactly match the stable tag plus `.md`
- expected pattern: `CHANGELOGS/v<major>.<minor>.<patch>.md`
- example: `CHANGELOGS/v0.1.1.md`

Non-examples:

- `CHANGELOGS/0.1.1.md`
- `CHANGELOGS/release-v0.1.1.md`
- `CHANGELOGS/v0.1.1-beta.1.md`

## CI Contract

The release-note script owns file lookup and non-empty override validation only.

- if `CHANGELOGS/<tag>.md` exists and contains non-whitespace content, use it as the full stable release body
- if the matching file does not exist, fall back to generated stable notes
- if the matching file exists but is empty or whitespace-only, fail the stable release-notes step

Human review remains responsible for the editorial quality of the note body before release.

## Content Contract

Release-note override files are final publishable markdown bodies.

- do not use YAML front matter
- do not treat these files as plan or research docs
- keep the note complete on its own rather than as a partial fragment

Expected stable note shape:

```md
## What's Changed

### New Features
- ...

### Bug Fixes
- ...

### Contributors
- Welcome @new-contributor for their first contribution.
- Thanks @existing-contributor

### Changelog
Full Changelog: https://github.com/dev-pi2pie/cdx-chores/compare/v0.1.0...v0.1.1
```

Structure rules:

- keep `## What's Changed`
- grouped `### <section>` subsections are optional
- extra curated content is allowed when useful
- keep a trailing `### Changelog` section
- when the repository is known, the last line of the file should be:
  - `Full Changelog: https://github.com/<owner>/<repo>/compare/<previous-stable-version>...<current-stable-version>`
- only fall back to the plain compare-range form when a repository URL cannot be resolved
  - `Full Changelog: <previous-stable-version>...<current-stable-version>`

Generated fallback note guidance:

- generated stable release notes should use the same GitHub compare URL form when a previous stable tag is known and the repository can be resolved
- this keeps the generated fallback output aligned with the manual override policy

## Stable Curation Rules

Stable release notes describe the final shipped behavior across the stable release range, not a raw replay of commit titles.

### Candidate selection

- use conventional-commit `feat` and `fix` entries as the primary candidate pool
- skip `docs`, `test`, `style`, and `chore` commits as release-note items by default
- re-include a non-`feat` or non-`fix` change only when it materially changes shipped user-facing behavior

### Editorial synthesis

- collapse iterative commit sequences into final shipped outcomes
- if later commits narrow, fix, or partially revert an earlier feature claim, write the note for the final shipped contract
- do not mirror noisy intermediate commit wording when the end state is materially different

### Evidence sources

When commit subjects alone are misleading, confirm the shipped contract with:

- `README.md`
- public guides under `docs/guides/`
- implementation job records under `docs/plans/jobs/`
- related research or plan docs only when they clarify what actually shipped

## Contributors

Use a `Contributors` section when contributor acknowledgment is useful for the release.

Contributor rules:

- use commit authors in the stable release range as the baseline source of truth
- normalize contributors by git author email when available; fall back to author name only when email is unavailable
- deduplicate contributors before rendering the section
- exclude obvious bot identities
- exclude AI-agent identities
- treat "earlier repo history" as commits reachable before the current stable release range begins
- if a contributor does not appear in that earlier repo history, treat them as a new contributor
- give new contributors a welcome-style note
- list returning contributors without the welcome-style note
- when an identity is ambiguous, prefer explicit human editorial judgment over automatic guessing

## Review Workflow

Recommended stable release-note workflow:

1. Generate the candidate stable notes from the current script.
2. Review `README.md` and public guides for current stable-version wording.
3. Review `feat` and `fix` commits since the previous stable tag.
4. Collapse iterative commit clusters into final shipped outcomes.
5. Add a `Contributors` section when appropriate.
6. Save the curated body as `CHANGELOGS/<current-stable-tag>.md`.
7. Review the file before the release enters CI.
