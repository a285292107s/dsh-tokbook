# AGENTS.md

dsh-tokbook is a cross-session **token-usage ledger** plugin for DeepSeek Harness
(DSH): the host half records one row per provider-billed model call into a
per-day JSONL ledger and serves costed aggregates, and the browser half renders
them (summary, per-provider, pricing table, subscription-quota tabs) from a
sidebar footer button + shell overlay window.

These notes keep agent behavior aligned with how this repo actually works. More
specific instructions win; when a task enters one of the areas below, read the
linked file before changing code.

## Working with the maintainer (standing preferences)

This repo has exactly one maintainer — me — developing with AI assistance. The
three rules below are defaults for every task unless I say otherwise:

1. **Clarify intent before acting — don't guess.** When I give you a task,
   first analyze my intent: the outcome I want and the constraints that apply.
   If anything material is unclear — scope, target, tradeoffs, what "done"
   looks like — ask me directly and make sure we share the same picture before
   you change anything. Only mechanical, unambiguous work proceeds without
   asking.

2. **Reason from first principles.** Start from the underlying goal and what
   is actually true in this repo (code, data, constraints), not from familiar
   recipes or habits. State your assumptions; question inherited choices —
   including earlier AI decisions and docs — when they no longer earn their
   keep, and say so instead of silently following them.

3. **One maintainer, AI-assisted — no over-defensive design.** Prefer the
   simplest design that meets the need. Do not add speculative structure:
   abstractions for futures that may not come, defensive code for scenarios
   that have not happened, unrequested config knobs, or extra tests/checks
   beyond what is needed. Protections that exist for observed reasons (the
   ledger's single-writer and dedupe invariants) stay; do not add new ones
   nobody asked for. When a simpler option trades away only a speculative
   safeguard, take the simpler option.

> 原话(维护者):① 先分析意图;不清晰时**不要猜测,向我提问**,确保认知同步;
> ② **从第一性原理出发**思考;③ 单人维护 + AI 辅助开发,**不做过度防御性设计**。

## Package manager & commands

This is a single pnpm package (`pnpm-workspace.yaml` only pins the esbuild
build). Install with `pnpm install`.

| Command         | What it runs |
| --------------- | ------------ |
| `pnpm build`    | `tsc -b` (emits `lib/types/*.d.ts`), then esbuild bundles `lib/index.js` (host) + `lib/client.js` (browser) |
| `pnpm typecheck`| `tsc --noEmit` — checks `src/` only; `scripts/` is not compiled |
| `pnpm watch`    | `tsc -b --watch` — types only; run `pnpm build` to refresh the bundles |
| `pnpm smoke` / `pnpm selfcheck` / `pnpm test` | pure-logic + invariant self-checks, executed with `node --experimental-strip-types` |

The `scripts/*.ts` files are executed directly with Node's type stripping, never
compiled by tsc, so they are only type-checked when they actually run.

## Working with the source

- Source of truth is `src/`: the host half lives in `src/*.ts`, the browser half
  in `src/client/*.tsx`. The overall file layout is documented in README.
- `lib/` is generated build output and gitignored — edit `src/`, then run
  `pnpm build`. Never hand-edit or commit `lib/`.
- After a build, host changes hot-swap through the profile's
  `cordis-plugin-hmr` row; browser changes arrive on page refresh. See
  README (Dev / HMR) and `docs/HMR.zh.md` for the exact guarantees.
- The browser bundle keeps DSH baseline modules (react, cordis, `dsh-client-*`)
  external. If you add a client-side dependency, keep `BASELINE_EXTERNALS` in
  `scripts/build-client.mjs` in sync with DSH's client platform module list
  (README · Build section).
- The client entry must not gain a `default` export — the cordis loader breaks
  on it (`docs/DESIGN.zh.md` §7.4).

## Deeper context (read before touching that area)

- `README.md` — end-to-end project scope, layout, install/dev flow,
  configuration, status. Read this first.
- `docs/INDEX.md` — the map of this repo's docs (role · status · when to read).
  Consult the entry for the area you touch before changing code that has a doc
  contract (routes, config, events, data files).

Contracts that must match code live in `docs/CONTRACTS.md`, and durable
architecture decisions in `docs/DECISIONS.md` — update them **in the same
commit** as the code change; `scripts/selfcheck-docs.ts` (part of `pnpm
selfcheck`) fails when they drift.

Domain docs under `docs/*.zh.md` are Chinese; code, README, contracts,
decisions and this file are English. Documentation can drift — when a doc
conflicts with the code, trust the code and fix the doc.

## Keeping this file small

This file is loaded into context on every request, so it stays minimal on
purpose. Guidance that applies to one domain only belongs in a linked doc
above (or a nested AGENTS.md), not here — add a breadcrumb, not the rule.
