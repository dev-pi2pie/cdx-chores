---
title: "XML Validator Migration: Dependency Footprint and Compatibility"
created-date: 2026-10-17
status: draft
agent: codex
---

## Purpose and Decision

Review replacing the deprecated `XMLValidator` in `fast-xml-parser@5.11.2` with `SyntaxValidator` from `fast-xml-validator@1.4.2`.

**Draft the migration to the public `SyntaxValidator` API while retaining `XMLParser`.** The implementation plan accounts for the additional dependency tree and changes in input acceptance documented below. This review found no announced removal deadline or current failure requiring immediate migration.

Runtime code and dependencies remain unchanged. This research stays in `draft` until implementation and application verification provide supporting evidence in the [unified job record](../plans/jobs/2026-10-17-xml-validator-migration.md).

## Deprecation Timeline

- **2026-05-06:** Upstream added the `XMLValidator` deprecation annotation in commit `42fa3c3`.[^deprecation-commit]
- **2026-05-12:** The annotation first shipped in `fast-xml-parser@5.8.0`; it is absent from the published `5.7.3` types. The release notes did not explicitly mention it.[^deprecation-release]
- **2026-06-04:** This repository adopted `5.8.0` in commit `ba5d0c6a`, introducing the annotation here; see the [dependency maintenance record](../plans/jobs/2026-06-04-reliable-dependency-maintenance-pass.md).

## Dependency Footprint

A scratch copy of the repository manifest and lockfile, with `fast-xml-validator@1.4.2` added, produced **seven additional package versions**, with no existing package records changed or removed.

| Added package | Version | Published license notice |
| --- | --- | --- |
| `fast-xml-validator` | `1.4.2` | Present |
| `detailed-xml-validator` | `2.2.0` | Present |
| `@nodable/flexible-xml-parser` | `1.11.3` | Present |
| `@nodable/compact-builder` | `2.0.0` | Absent |
| `@nodable/base-output-builder` | `2.0.0` | Absent |
| `@nodable/entities` | `2.2.0` | Absent |
| `is-unsafe` | `1.0.1` | Present |

The added archives total **474,217 compressed bytes / 1,640,584 unpacked bytes**: approximately **463 KiB / 1.56 MiB**. These are package file sizes, not runtime memory or startup measurements.[^validator-registry][^detailed-registry][^flexible-registry]

The extra stack comes through the required `detailed-xml-validator` dependency: it uses another XML parser and two builders, which introduce older `@nodable/entities` and `is-unsafe` majors alongside our existing versions. The shared matcher, naming, and number-parsing dependencies reuse existing locked versions. No native addons or install lifecycle hooks were found in the additions.

Importing only `SyntaxValidator` does not avoid this footprint. The public ESM entry statically imports the business validator, the CommonJS bundle contains both validators, and the package exposes no supported syntax-only subpath. Our build externalizes runtime dependencies.[^validator-entry]

All added manifests declare MIT licensing, but the three packages marked absent also lack the full MIT permission text in their inspected files. Adoption would extend the existing entity-package notice limitation.[^compact-registry][^base-registry][^entities-registry]

## Compatibility Findings

Upstream deprecates both `XMLValidator` and the validation argument to `XMLParser.parse`; using `parse(xml, true)` would retain a deprecated API.[^parser-types]

The replacement returns `true` on success and **throws on invalid XML**, whereas the old validator returns an error object. Callers must preserve their current application errors and fallback behavior.[^validator-source][^validator-types]

| Behavior | Review result | Migration requirement |
| --- | --- | --- |
| Literal control characters; names such as `<a:b:c/>` | Old validator accepts; replacement rejects. | Treat stricter rejection as an explicit behavior change. |
| Declaration with `encoding` before `version` | Replacement rejects by default. | Use `xmlDeclaraion: { argPosition: false }` to preserve tolerance; the spelling is upstream's API. |
| Multiple roots | Both accept by default, despite the replacement types documenting otherwise. | Configure the intended policy explicitly and retain extraction's root checks. |
| Duplicate DOCTYPE declarations | Old validator accepts; replacement rejects. | Retain application declaration rejection before validation. |
| Ampersands, named references, CDATA, namespace bindings | Neither validator covers all existing extraction rules. | Keep DOCX preprocessing and independent checks. |
| Basic valid XML, mismatched tags, duplicate attributes | Acceptance/rejection agrees. | Translate replacement exceptions into existing application errors. |

The replacement is therefore a bounded migration with observable behavior changes, rather than a direct import rename.

## Affected Code

Seven validation calls appear across five files:

| File | Calls | Contract to preserve |
| --- | ---: | --- |
| `src/docx/xml.ts` | 1 | Budget checks first; validate an ampersand-normalized copy; parse the whitespace-normalized original; preserve `docx_xml_invalid` and root/CDATA rules. |
| `src/adapters/docx/ooxml-metadata-parser.ts` | 2 | Malformed optional properties return `undefined`. |
| `src/adapters/docx/ooxml-part-discovery.ts` | 2 | Malformed metadata discovery falls back to other part paths. |
| `scripts/testing/reports/report-files.ts` | 1 | Preserve `Malformed test report XML.` and file-identity checks. |
| `scripts/testing/reports/report-validation.ts` | 1 | Preserve declaration rejection, report errors, and structural/count checks. |

An untranslated validator exception from extraction would become `docx_initial_reader_error` in `src/docx/reader.ts`, losing the existing diagnostic. The metadata adapters already catch validation failures.

A migration must also add the validator to the reader dependency list in `scripts/docx-candidate/package-inspect.mjs` and verify installed consumer resolution. Keep `XMLParser` and its existing options.

## Review Evidence

Reviewed on 2026-10-17 using an isolated dependency-resolution experiment and 27 synthetic XML cases on Node 26.5.0 and Bun 1.4.3. ESM/CommonJS results agreed within each validator; observed compatibility differences are recorded above. Repository dependencies were unchanged.

These findings cover dependency footprint and standalone validator behavior. Application integration and distribution compatibility have not been verified.

## Related Plans

- [XML validator migration](../plans/plan-2026-10-17-xml-validator-migration.md): draft implementation and validation steps.

## Related Research

- [DOCX extraction and Mammoth replacement](research-2026-10-16-docx-extraction-and-mammoth-replacement.md): current reader baseline, frozen fixtures, packaging checks, and existing entity-package notice limitation.

## References

[^deprecation-commit]: [Upstream commit adding the deprecation](https://github.com/NaturalIntelligence/fast-xml-parser/commit/42fa3c3af8e0d59e9fe213785a1b204b39338d2b).
[^deprecation-release]: [Fast XML Parser v5.8.0 release](https://github.com/NaturalIntelligence/fast-xml-parser/releases/tag/v5.8.0); the published `5.7.3` and `5.8.0` type declarations were compared directly.
[^parser-types]: [Fast XML Parser v5.11.2 types](https://github.com/NaturalIntelligence/fast-xml-parser/blob/v5.11.2/src/fxp.d.ts).
[^validator-registry]: [fast-xml-validator 1.4.2 metadata](https://registry.npmjs.org/fast-xml-validator/1.4.2).
[^validator-entry]: [Standalone validator public entry](https://github.com/NaturalIntelligence/fast-xml-validator/blob/335fcafafea64d9f651756c44836fc5c9efe1b0d/src/fxv.js).
[^validator-source]: [SyntaxValidator implementation](https://github.com/NaturalIntelligence/fast-xml-validator/blob/335fcafafea64d9f651756c44836fc5c9efe1b0d/src/SyntaxValidator.js).
[^validator-types]: [Standalone validator types](https://github.com/NaturalIntelligence/fast-xml-validator/blob/335fcafafea64d9f651756c44836fc5c9efe1b0d/src/fxv.d.ts).
[^detailed-registry]: [detailed-xml-validator 2.2.0 metadata](https://registry.npmjs.org/detailed-xml-validator/2.2.0).
[^flexible-registry]: [flexible-xml-parser 1.11.3 metadata](https://registry.npmjs.org/@nodable%2Fflexible-xml-parser/1.11.3).
[^base-registry]: [base-output-builder 2.0.0 metadata](https://registry.npmjs.org/@nodable%2Fbase-output-builder/2.0.0).
[^compact-registry]: [compact-builder 2.0.0 metadata](https://registry.npmjs.org/@nodable%2Fcompact-builder/2.0.0).
[^entities-registry]: [entities 2.2.0 metadata](https://registry.npmjs.org/@nodable%2Fentities/2.2.0).
