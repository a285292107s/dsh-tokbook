# Host & data contracts — dsh-tokbook

> **Doc meta** · role: contracts · language: en · status: current · last-reviewed: 2026-09-08 · supersedes: —

The single home for the facts that other code and the browser half must get
**exactly** right: host routes and their wire JSON, the plugin configuration,
the `session/event` types consumed, and the data-directory file layout.

**The code is authoritative.** Sources: `src/routes.ts`, `src/types.ts`,
`src/usage-record.ts`, `src/ledger.ts`, `src/usage-log.ts`, `src/pricing.ts`,
`src/quota-cache.ts`. This file is a checked map: `scripts/selfcheck-docs.ts`
(part of `pnpm selfcheck`) fails when the host route list below drifts from
`src/routes.ts`. If prose here and code disagree, trust the code, fix this
file, and refresh `last-reviewed`.

## Host routes

Exact routes registered on the DSH host webserver via
`ctx.webServer.register({ kind: 'exact', path, handler })`. Every handler:

- guards the method (`405` text/plain on a wrong method),
- guards same-origin (`Sec-Fetch-Site` absent, `same-origin`, or `none`
  passes; anything else → `403` text/plain),
- answers `application/json; charset=utf-8` with `cache-control: no-store`,
- wraps internal errors in `500 { "error": <message> }` — never an unhandled
  rejection,
- reads the query string inside the handler (exact routes match on pathname).

| Method | Path | Query / body | Success payload (type in `src/types.ts`) |
|---|---|---|---|
| `GET` | `/tokbook/overview` | — | `TokBookOverview` (costed summary + trend + per-model + recent + freshness) |
| `POST` | `/tokbook/rescan` | — | `RescanView` = `{ status: 'running'\|'skipped', lastSyncAt: number\|null }` |
| `GET` | `/tokbook/usage` | `range` ∈ `today` \| `yesterday` \| `last7` \| `last30` (missing/unknown → `400 {error}`) | `ProviderUsageView` |
| `GET` | `/tokbook/quota` | — | `QuotaView` = `{ providers: string[] }` — enabled plans only, no network |
| `GET` | `/tokbook/quota` | `provider=<route key>`; optional `refresh=1` bypasses the TTL cache | `QuotaCard` for that provider |
| `GET` | `/tokbook/pricing` | — | `PricingView` |
| `PUT` | `/tokbook/pricing` | JSON body ≤ 256 KiB | `200 { ok: true, view }`; invalid table → `400 { error, view }` |

Wire-shape notes (authoritative field lists live in `src/types.ts`):

- Amounts on the wire are RMB (¥) **except** fields a provider's official API
  reports in USD (`QuotaCard.usage / credits / windows.usedUsd / capUsd`).
  Cost figures convert for display via each payload's `currency` and
  `usdExchangeRate` fields.
- `range` ids are local-calendar windows named after the day files they read.
- Provider rows that never saw a provider header group under `'(未知)'`.
- Unpriced models bill ¥0 and are surfaced in `unpricedModels`.
- `PUT /tokbook/pricing` body: `{ "<exact model string>": { "inputPerMillion": number, "outputPerMillion": number, "cacheReadPerMillion"?: number, "cacheWritePerMillion"?: number } }`.
  An absent key deletes that manual override; the whole table is parsed,
  validated, and replaces `pricing.json` wholesale (a manual entry replaces the
  cloud rules for that model with flat prices).

## Configuration

`plugins.tokbook` in the profile patch, typed as `TokBookConfig` + `PlanConfig`
in `src/types.ts` (see README · Configuration for the annotated YAML):

| Key | Default | Meaning |
|---|---|---|
| `path` | `$DSH_HOME/tokbook` (`~/.dsh/tokbook`) | data directory |
| `pricingUrl` | unset | explicit cloud pricing feed URL; wins over `pricingRegion` |
| `pricingRegion` | `domestic` | mirror choice (`domestic`/`overseas`) when `pricingUrl` is unset |
| `recordCompaction` | `true` | whether compaction summarize calls are recorded and billed |
| `plans.<provider>.enabled` | unset | `false` disables a built-in plan |
| `plans.<provider>.apiKey` | unset | literal key; wins over the credentials service |
| `plans.<provider>.apiKeyEnv` | provider ref (`OPENCODE_GO_API_KEY` / `COMMANDCODE_API_KEY`) | credential name to resolve via `ctx.credentials` |

Quota plans are built in per provider route (`opencode-go`, `commandcode`) and
turn on once a usable key is found — config literal, then the provider's
credentials reference — unless `enabled: false`. No key → an `unconfigured`
card; fetch failure → an `error` card; the tab never falls back to a local
estimate.

## Session events consumed

From the durable `session/event` stream (folding logic: `src/usage-record.ts`).
One JSONL row is written per provider-billed model call:

| Event | Recorded as | Notes |
|---|---|---|
| `assistant/message` | `kind: request` | successful call; row id = message id (dedupe key); carries the provider's `usage` buckets |
| `compaction/summary` | `kind: compaction` | only when `recordCompaction` is on; billed call of its own |
| `turn/end` (reason `error`) | `kind: failure` | failed attempt — `failures` dimension only, never tokens/cost |
| `llm/retry` | `kind: failure` | failed attempt — `failures` dimension only |
| `request/context` (+ `assistant/message`) | no row | maintains the session's last-known model/provider used to attribute failure rows |

## Data directory

One directory per data set (default `$DSH_HOME/tokbook`, configurable via
`path`); **one host process writes a given directory** — on startup the host
writes an `owner.json` marker and warns when a live foreign process already
owns it. Point a second host at its own `path` instead of sharing one.

| File | Purpose | Written by | Notes |
|---|---|---|---|
| `usage-YYYY-MM-DD.jsonl` | per-day ledger of `UsageRecord` rows, one per provider-billed call | host append path | append + serialized queue; dedupe by `requestId`; a row belongs to the local calendar day of its event (`src/usage-log.ts` refile logic keeps it there) |
| `rollup.json` (+ `.tmp`) | frozen-day derived stats rollup up to day `upto` | host stats read path | missing/malformed → rebuilt from day files; unlinked and rebuilt after a sync appends rows |
| `sync-progress.json` (+ `.tmp`) | persisted per-session `revision` baseline for the incremental freshness probe | host sync | written strictly after a sync; sessions whose log could not be read are excluded |
| `owner.json` | single-writer marker `{ pid, start }` | host startup | a stale marker from a crashed process is taken over silently |
| `pricing.json` (+ `.tmp`) | hand-edited manual price overrides (wholesale replace; entries win over the cloud) | `PUT /tokbook/pricing` | absent = no manual layer; malformed entries degrade only their models to unpriced |
| `pricing.ccsa.json` (+ `.tmp`) | cloud pricing mirror fetched on startup (`pricing.ts`) | host startup | read-only reference; region/URL per config |
| `quota-<provider>.json` (+ `.tmp`) | last-known official quota card snapshot `{ savedAt, card }` | host quota fetch | only `ok` cards persisted; missing/torn/malformed reads as null |

Conventions: derived files are written atomically (temp file + rename; where
Windows rename-over-existing fails intermittently the target is unlinked
first). Day files are append-only and never rewritten.

## Invariants that keep the numbers honest

- Dedupe identity is `requestId` (`assistant` message id, or a synthesized
  `compaction:<session>:<seq>` / `failure:<session>:<seq>`); overlapping
  writers of one process share one dedupe set + one serialized append queue.
- Price changes re-price history **at read time** — no ledger/rollup rewrite.
- A quota card shows only official provider data; `unconfigured`/`error` cards
  are re-derived cheaply and never persisted as “last known”.

## Cross-references

- Semantics of the events, sync probe, and dedupe scope across a module-level
  reload: `docs/HMR.zh.md` §4.
- End-to-end story, install, and config examples: `../README.md`.
- Why these shapes exist (data model rationale): `docs/DESIGN.zh.md` (重构说明
  section) and `docs/DECISIONS.md`.
