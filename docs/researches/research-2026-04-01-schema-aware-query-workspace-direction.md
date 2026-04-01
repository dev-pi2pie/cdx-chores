---
title: "Schema-aware query workspace direction"
created-date: 2026-04-01
status: draft
agent: codex
milestone: v0.1.0
---

## Goal

Capture a future design route for schema-aware query workspaces without changing the current `data query` workspace contract before the `v0.1.0` stable release.

## Milestone Goal

Answer one design-direction question at research level only:

- if the product later wants natural SQL such as `select * from public.users`, what workspace model would support that coherently
- and how should that future route relate to the current flat alias-based `--relation` contract

## Related Research

- `docs/researches/research-2026-03-31-multi-source-query-workspace-contract.md`
- `docs/researches/research-2026-03-31-workspace-file-alias-reservation-reconsideration.md`
- `docs/researches/research-2026-03-30-interactive-data-query-followup-ux.md`

## Related Plans

- `docs/plans/plan-2026-03-31-data-query-workspace-implementation.md`
- `docs/plans/plan-2026-03-31-data-query-workspace-alias-followup.md`

Status note:

- this document is intentionally forward-looking and does not propose a `v0.1.0` implementation change
- the current stable direction remains the flat workspace model with simple SQL aliases such as `events=analytics.events`

## Problem

The current workspace contract is explicit and stable, but it becomes slightly awkward when backend object selectors are schema-qualified or otherwise dotted.

Today the preferred workspace form is:

```text
--relation events=analytics.events
```

That keeps SQL simple:

```sql
select * from events
```

However, a future product direction may prefer SQL that preserves backend namespace structure directly:

```sql
select * from analytics.events
select * from public.users
```

That preference raises a deeper design question:

- should future work continue to flatten all bound objects into one alias workspace
- or should the workspace itself become schema-aware so dotted SQL keeps its normal SQL meaning

## Scope

This research is about future workspace semantics for multi-schema or namespace-qualified sources.

It is not about:

- changing `v0.1.0` direct CLI behavior
- relaxing current alias validation in the current release slice
- implementing SQL rewriting of user queries
- defining remote-connection support in detail

## Key Findings

### 1. The current UX friction is real, but it does not by itself require a schema-aware redesign

The current interactive prompt can show a dotted backend selector such as `analytics.events` in a relation-name field even though the validator requires a simple SQL identifier.

That is a prompt-level mismatch inside the current flat workspace model.

Implication:

- the current UX can become friendlier without changing the public SQL contract
- but that small UX issue also reveals a broader long-term design question about dotted source names

### 2. Literal dotted aliases in a flat workspace are technically possible, but they would change the public SQL contract materially

A flat workspace could bind a relation whose literal SQL name is `"analytics.events"`.

That would require user SQL like:

```sql
select * from "analytics.events"
```

instead of:

```sql
select * from analytics.events
```

because unquoted `analytics.events` is parsed as qualified access rather than one identifier.

Implication:

- allowing dotted relation names in a flat workspace is not just a parser-tolerance decision
- it would force quoted-identifier behavior into manual SQL, examples, prompts, and troubleshooting
- that is a larger product change than freeing explicit workspace `file`

### 3. If the product wants natural dotted SQL, schema-aware workspace is the coherent model

If users should be able to write:

```sql
select * from analytics.events
select * from public.users
```

without quoted literal identifiers, then the workspace itself should preserve namespace structure rather than flattening everything into one alias list.

Conceptually, the workspace would expose:

- schema `analytics` with relation `events`
- schema `public` with relation `users`

instead of exposing flat aliases such as:

- `events`
- `users`

Implication:

- schema-aware workspace matches normal SQL interpretation of dotted names
- it avoids the need to teach users that dots in relation names must be quoted
- it is a more coherent answer to multi-schema growth than literal dotted aliases in a flat workspace

### 4. Schema-aware workspace would solve collision pressure more cleanly than alias derivation

In a flat workspace, these backend objects collide at the leaf-name level:

- `sales.orders`
- `archive.orders`

The current alias model resolves that by requiring distinct aliases such as:

```text
--relation sales_orders=sales.orders
--relation archive_orders=archive.orders
```

A schema-aware workspace could instead preserve both objects naturally:

```sql
select * from sales.orders
select * from archive.orders
```

Implication:

- schema-aware workspace reduces alias-invention pressure
- it keeps collisions aligned with SQL namespace structure rather than solving them only through CLI alias naming

### 5. Schema-aware workspace is a bigger design change than the current release should absorb

Supporting schema-aware workspace would likely require decisions about:

- how many namespace levels are preserved
- how relation binding flags map to schemas and objects
- whether flat aliases and schema-aware bindings can coexist
- how interactive source selection presents namespace structure
- how Codex drafting and schema introspection describe bound objects
- how future selectors such as `catalog.schema.table` should behave

Implication:

- this is appropriate as post-`v0.1.0` design work
- it should not be mixed into the current release hardening pass

### 6. The current flat alias contract should remain the stable baseline until a later plan deliberately replaces or extends it

The current model remains coherent:

- backend selector identifies the source object
- SQL alias identifies the bound workspace relation

Example:

```text
--relation users=public.users
--relation events=analytics.events
```

with SQL:

```sql
select users.id, events.event_type
from users
join events on users.id = events.user_id
```

Implication:

- `v0.1.0` can stay disciplined and stable
- future schema-aware work should be additive and deliberate rather than implied by ad hoc parser flexibility

## Candidate Models

### Model A: Keep flat workspace with simple aliases

Pattern:

```text
--relation users=public.users
--relation events=analytics.events
```

SQL:

```sql
select * from users
select * from events
```

Strengths:

- simple SQL for users
- current implementation direction already exists
- easy to document and validate

Weaknesses:

- alias naming overhead grows with more schemas
- collisions are solved only by explicit alias invention

### Model B: Keep flat workspace but allow literal dotted relation names

Pattern:

```text
--relation analytics.events
```

SQL:

```sql
select * from "analytics.events"
```

Strengths:

- preserves backend object spelling directly
- avoids alias collisions between dotted selectors

Weaknesses:

- quoted identifiers become part of normal user SQL
- unquoted dotted SQL means something different
- higher teaching and support cost than the current contract

### Model C: Introduce schema-aware workspace

Pattern:

- bind backend objects into preserved namespace structure rather than a flat alias list

SQL:

```sql
select * from analytics.events
select * from public.users
```

Strengths:

- matches normal SQL semantics for dotted names
- scales better to multi-schema growth
- handles leaf-name collisions naturally

Weaknesses:

- larger CLI and workspace-model redesign
- needs explicit decisions about compatibility with flat aliases and deeper selector depth

## Recommendation

For `v0.1.0`:

- keep Model A as the current stable contract
- do not broaden the current release into quoted dotted aliases or schema-aware workspace

For future design exploration:

- treat Model C as the more coherent long-term route if the product wants natural dotted SQL
- avoid Model B as the default future direction unless the product explicitly wants quoted literal identifiers to become part of normal usage

## Suggested Follow-up

After `v0.1.0`, if workspace SQL ergonomics becomes a priority, the next research or plan should answer these questions explicitly:

- should schema-aware workspace supplement the flat alias model or replace it
- what CLI surface should bind preserved-schema objects
- how should `catalog.schema.table` depth behave
- can flat aliases and schema-aware bindings coexist in one invocation
- how should interactive prompting suggest or display namespace-preserving bindings
- how should Codex drafting describe schema-aware relations in prompts and generated SQL expectations

## Open Questions

- Should schema-aware workspace be limited to two-part names such as `schema.table`, or should it plan for deeper selectors from the beginning
- Should single-source mode stay bound to the logical table `file` even if workspace mode later becomes schema-aware
- Should future schema-aware support remain limited to file-backed catalogs first, or should it be designed together with future connection-backed sources
