# Docs index — dsh-tokbook

> **Doc meta** · role: index · language: en (+zh hints) · status: current · last-reviewed: 2026-09-08 · supersedes: —

The map of every documentation file in this repo. Read the entry for the area
you are about to touch, then read only that file. This file exists so that
[`AGENTS.md`](../AGENTS.md) and your first hop can stay small: the root file
carries breadcrumbs, this file carries the tree, the leaves carry the detail.

## The tree

| File | Role | Lang | Status | Read when |
|---|---|---|---|---|
| [`AGENTS.md`](../AGENTS.md) | identity | en | current | every task — loaded into context automatically |
| [`README.md`](../README.md) | entry + operations | en | current | first stop: scope, layout, build, install, configuration |
| `docs/INDEX.md` | map (this file) | en | current | navigating the docs |
| [`docs/CONTRACTS.md`](CONTRACTS.md) | contracts | en | current | touching host routes, wire JSON shapes, config keys, session events, or data-directory files — update it in the same commit; `scripts/selfcheck-docs.ts` enforces the route list |
| [`docs/DECISIONS.md`](DECISIONS.md) | decisions (ADR log) | en | current | changing architecture or landing a durable decision — append an entry in the same commit |
| [`docs/DESIGN.zh.md`](DESIGN.zh.md) | reason / background | zh-CN | current | “why”: DSH mechanism background, first-phase frame, second-phase rewrite notes, hard constraints. The 阅读指南 at its top separates history from the present |
| [`docs/HMR.zh.md`](HMR.zh.md) | lessons / reference | zh-CN | current | HMR mechanics and module-reload dedupe scope — read before touching the ledger / dedupe paths |
| [`docs/LESSONS.zh.md`](LESSONS.zh.md) | lessons | zh-CN | current | pitfalls when changing client styles, the client bundle, the build, or browser verification |
| [`docs/skills.md`](skills.md) / [`docs/skills.zh.md`](skills.zh.md) | reference | en / zh-CN | current | a change that touches the DSH skill system or `.dsh/skills` |
| [`docs/archive/PLAN.provider-pricing.zh.md`](archive/PLAN.provider-pricing.zh.md) | process (archived) | zh-CN | superseded | history of the pricing/quota upgrade plan — its phases have landed; do not implement from it |

## Doc meta convention

Every tracked doc carries a one-line blockquote directly under its H1:

```
> **Doc meta** · role: <identity|entry|index|contracts|decisions|reason|lessons|reference|process> · language: <en|zh-CN> · status: <current|superseded|draft> · last-reviewed: <YYYY-MM-DD> · supersedes: <file | —>
```

- `role` = which documentation layer the file belongs to (see the tree).
- `status` = whether the file describes the present (`current`), describes
  something already replaced (`superseded`), or is unfinished (`draft`). A
  process/plan that has landed becomes `superseded` and moves to `docs/archive/`.
- `last-reviewed` = the last date the file was checked against the current
  tree. Refresh it when you edit the file — normally in the same commit as the
  code change it documents.

`scripts/selfcheck-docs.ts` (part of `pnpm selfcheck`) fails when a tracked doc
lacks the meta line, when the CONTRACTS route list drifts from `src/routes.ts`,
or when a link in this file points nowhere.

## Language policy

Code-adjacent layers are English — identity, entry, contracts, decisions, this
map. Narrative layers keep their existing language: the Chinese design/lesson
docs stay Chinese. One new doc = one language; do not mix voices inside a file.

## Doc lifecycle rule

Code that changes an interface (a route, config key, event, data-file name, or
pricing rule) lands **in the same commit** as the update to `docs/CONTRACTS.md`;
a durable architecture decision appends to `docs/DECISIONS.md`; a plan that has
landed is archived as `superseded`. No doc may silently lag the code: if a doc
cannot be kept true, remove or archive it instead of letting it poison context
later.
