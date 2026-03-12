---
title: "PDF backend research follow-up for install constraints"
created-date: 2026-03-11
status: completed
agent: codex
---

## Goal

Adjust the revised PDF backend research so it reflects the current install preference: `imagemagick` is available, but `qpdf` should not be treated as part of the present launch assumption.

## What Changed

- kept the research doc in `draft` status because implementation has not started
- revised the `qpdf` section to position it as a later optional structural fallback rather than a current fallback expectation
- removed `qpdf` from the launch mapping for `pdf merge` and `pdf split`
- changed the capability framing so `qpdf` is only an optional future fallback if installed later
- kept `pdfcpu` as the sole current default for `pdf merge` and `pdf split`
- kept `mutool` ahead of `magick` for PDF image workflows
- clarified that installed `magick` still does not move into the primary launch backend set

## Verification

- confirmed local `magick` availability
- confirmed `qpdf` is not currently installed
- reviewed the research doc to ensure it no longer implies a near-term `qpdf` requirement

## Related Research

- `docs/researches/research-2026-02-25-pdf-backend-comparison-for-merge-split-and-image-workflows.md`
