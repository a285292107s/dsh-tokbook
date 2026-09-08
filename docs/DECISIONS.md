# Decisions (ADR log) — dsh-tokbook

> **Doc meta** · role: decisions · language: en · status: current · last-reviewed: 2026-09-08 · supersedes: —

Durable architecture decisions, newest last. Each entry states the decision,
the context that forced it, and what it supersedes. Keep this log current the
same way you keep contracts current: **a landed decision appends an entry in
the same commit as the code**. Full reasoning lives in `docs/DESIGN.zh.md`
(Chinese); entries here are the pointer + the essence.

Dates are the commit/development dates the decision landed (git history);
items that exist only in the working tree are marked “working tree”.

---

### D-001 · 2026-09-06 · Ship as an external dual-half Cordis plugin

**Status: current**

**Context.** dsh-tokbook must extend the `web` profile without touching the DSH
repo. DSH features are Cordis plugins with an optional client half; external
packages cannot use the monorepo `clientBundle()` preset and cannot contribute a
generated Typert remote.

**Decision.** One package, two halves:

- host half (`src/*.ts`) — listens to the durable `session/event` stream and
  owns all data;
- browser half (`src/client/*.tsx`) — pure slot registration:
  `sidebar.footer.action` trigger + `shell.overlay` floating window;
- host→browser data travels over feature-owned exact-Fetch routes
  (`ctx.webServer.register({ kind: 'exact', ... })`);
- the client bundle replicates the lazy-CJS factory and **never adds a
  `default` export** on the client entry (the cordis loader's
  `exports.default ?? exports` would mask `.inject` and break with
  “without inject”).

Rationale + DSH mechanism background: `docs/DESIGN.zh.md` §3–§8.

---

### D-002 · 2026-09-06/07 · Per-request ledger rows instead of per-session aggregates

**Status: current.** **Supersedes:** the first-phase “per-session aggregation”
frame in `docs/DESIGN.zh.md` §5 (its “重构说明” section records the change).

**Context.** DSH's built-in per-session projections are coarse: they cannot
answer per-day/per-request questions and cannot survive a format change without
a rebuild. The reference project `dsh-token-usage` models one row per request.

**Decision.**

- Record **one JSONL row per provider-billed model call** — `assistant/message`
  rows keyed by message id (dedupe), plus `compaction/summary` and failed
  attempts (`turn/end` error, `llm/retry`) as `kind: failure` (counted, never
  billed).
- Persist per **local calendar day**: `usage-YYYY-MM-DD.jsonl`, append +
  serialized queue + process-level `requestId` dedupe.
- **One writing process per data directory**, enforced by an `owner.json`
  marker (single-writer guard — rollup/cache/refile races are the risk).
- Backfill first-start + manual re-sync by replaying `sessionPersistence`
  snapshots (idempotent, dedupe-safe), probed incrementally across restarts via
  a persisted `sync-progress.json` baseline.

Current shapes: `docs/CONTRACTS.md`. Exact dedupe scope across a module-level
HMR reload: `docs/HMR.zh.md` §4.

---

### D-003 · 2026-09-07/08 · Cost layer + pricing table; quota from official APIs only

**Status: current** (partially in the working tree). **Supersedes:** the
first-phase scope note “no cost / cost belongs to a later phase” in
`docs/DESIGN.zh.md` §1 and §11 (the “成本折算” risk row).

**Context.** The ledger must answer “what did this cost”, which DSH never
computes; and the 订阅额度 tab must reflect subscription value shared across
tools — which a local ledger cannot.

**Decision.**

- Pricing = ¥/M per-model table merging a **cloud mirror**
  (`pricing.ccsa.json`, synced on startup from `pricingRegion`/`pricingUrl`)
  with a hand-edited **`pricing.json`** whose entries win wholesale.
- Each record resolves a rule chain **time rule → context tier → peak slot**
  (context ≈ input + cacheRead + cacheWrite) into a `RateKey` that stores
  identity, never prices — so a price edit re-prices history at read time
  without a ledger/rollup rebuild.
- A 价格表 tab edits the manual layer through `GET/PUT /tokbook/pricing`.
- Quota cards fetch each provider's **official account usage** (Command Code
  CLI account endpoints; OpenCode Go `/zen/go/v1/usage`) — never a local
  estimate; durable last-known `ok` cards in `quota-<provider>.json`;
  `unconfigured`/`error` cards are re-derived, never persisted.

Landing: provider-usage + quota in commit `5e2c86f` (2026-09-07); the pricing
manual-edit tab is in the working tree as of 2026-09-08.

---

## How to add an entry

1. Give it the next `D-NNN`, today's date (or the commit date), and a status.
2. One paragraph: context, decision, what it supersedes. Point to the code
   (`docs/CONTRACTS.md`) and the deeper rationale (a DESIGN section) instead of
   repeating them.
3. If the decision replaces an earlier one, set the earlier entry's status to
   `superseded` and link here — in the same commit as the code.
