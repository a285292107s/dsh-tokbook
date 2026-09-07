# dsh-tokbook

A cross-session **token-usage ledger** plugin for DeepSeek Harness (DSH). The
host half records **one row per provider-billed model call** — the
`assistant/message` provider `usage` (plus compaction summarize calls and
failed attempts) — as a durable per-day JSONL ledger, then serves an
aggregated, **costed** overview. The browser half shows it via a **sidebar
footer button** (route A: `sidebar.footer.action`) that opens a **floating
window** (`shell.overlay`) with summary cards (tokens **and cost**), a daily
token trend chart, a per-model breakdown with cost — a per-provider tab
(one card per provider route, its models' tokens/cost inside a selectable
今日 / 昨天 / 近7天 / 近30天 window) — and a 订阅额度 tab that shows each
configured subscription's **official account usage** (Command Code / OpenCode
Go), fetched from the provider's own API with your key.

Design rationale, tech selection, and the two sidebar approaches are documented
in [`docs/DESIGN.zh.md`](docs/DESIGN.zh.md). The data model follows the
[dsh-token-usage](https://github.com/LaoYueHanNi/dsh-token-usage) reference:
per-request rows instead of per-session aggregates, plus a ¥/M price table with
a "time rule → context tier → peak slot" rate chain.

## Layout

```
src/
  index.ts            host: TokenUsageBook service (ctx.tokbook) + live hook
  types.ts            shared domain types (type-only)
  ledger.ts           data-directory resolution
  usage-record.ts     per-call record model + session-event projections
  usage-log.ts        per-day JSONL store (append/dedupe/refile)
  sync.ts             first-start + manual history backfill (idempotent)
  sync-state.ts       first-run marker
  stats.ts            aggregation (totals/byDay/byHour/byModel/recent) + rollup + cache
  pricing.ts          price table (cloud mirror + manual), resolveRate chain, costOf
  by-provider.ts      pure provider-card aggregation (Provider-usage tab)
  quota.ts            official-quota normalization + built-in plan identity
  quota-official.ts   key resolution + per-provider official usage fetchers
  routes.ts           host exact-Fetch routes  /tokbook/overview, /tokbook/rescan,
                      /tokbook/usage?range=…, /tokbook/quota
  client/
    index.ts          client: apply(ctx), registers the two slots
    contract.ts       minimal client ctx/slots types
    store.ts          shared button↔overlay view store
    styles.ts         injected stylesheet (DSH tokens)
    FooterButton.tsx  sidebar.footer.action trigger
    QuotaPanel.tsx    订阅额度 tab (official usage cards)
    LedgerOverlay.tsx shell.overlay floating window (costed summary + trend +
                      per-model + per-provider + quota tabs)
scripts/
  build-client.mjs    builds lib/index.js + lib/client.js (lazy-CJS)
  smoke.ts            pure-logic smoke test of aggregation + pricing + quota
```

## Build

```sh
pnpm install      # installs @deepseek-ai/cordis, react, esbuild, typescript
pnpm build        # tsc emits lib/types/*.d.ts, then esbuild bundles host+client
pnpm smoke        # pure-logic smoke test of the aggregation + pricing math
```

Outputs:

- `lib/index.js` — host half (node ESM, bare imports external)
- `lib/client.js` — browser half, the lazy-CJS factory:
  `window.__ModuleLoader__.load({ id, factory: (require) => { ... } })`
- `lib/types/**/*.d.ts` — declarations

The client bundle externalizes the DSH baseline (`react`, `react-dom`, cordis,
`dsh-client-store`, `dsh-client-ui-slots`, `dsh-client-ui-primitives`); keep
`BASELINE_EXTERNALS` in `scripts/build-client.mjs` in sync with DSH's
`packages/client/web/src/platform.ts`.

## Install into a DSH web profile

```sh
dsh plugin --profile web add .            # or a git/tarball/path specifier
# then ensure the row is mounted in $DSH_HOME/profiles/web/cordis.patch.yml
```

If the package is not installed as a bundle (it is a plain plugin, not a
`dsh.bundle` layer), add an insert row to the profile patch (see
[`cordis.patch.example.yml`](cordis.patch.example.yml)):

```yaml
- insert:
    - id: tokbook
      name: 'dsh-tokbook'
```

Then `dsh web` and refresh the browser. Client-half changes hot-reload (hard
refresh to pick the new `rev`), host-half changes need a restart.

## Dev against a source checkout

```sh
pnpm watch                                # rebuild on change
dsh web --patch /abs/path/to/tokbook/dev/cordis.yml   # host half only
```

> A `--patch` overlay loads only the host half (module resolution cannot reach
> package-level client declarations); to exercise the browser half, install into
> a profile as described above.

## How it records tokens

The host listens to the durable `session/event` stream and folds each
provider-billed model call into one JSONL row, persisted per local day under
`$DSH_HOME/tokbook/` (configurable via `path`):

- **`assistant/message`** — a successful model request, with the provider's
  reported `usage` (`inputTokens` / `outputTokens` / `cacheReadTokens` /
  `cacheWriteTokens`). Row id = the message id (dedupe key).
- **`compaction/summary`** — a context-compaction summarize call (a billed
  provider call of its own), recorded when `recordCompaction` is on.
- **`turn/end`** (reason `error`) and **`llm/retry`** — failed attempts, counted
  in the `failures` dimension (no tokens, so they never inflate token totals).

On first startup the plugin backfills the history of requests that happened
before installation (idempotent, deduped by row id); a **re-scan button** in
the floating window forces an authoritative re-sync. Reads also self-correct
with a **cheap on-demand probe**: each overview read first asks
`sessionPersistence.listSnapshots()` for per-session metadata (an opaque
`revision` token; equal means unchanged; a plain-header `list()` is accepted
as a fallback), and only when the persisted log has work the ledger does not
already hold — a new/changed session, or one never folded — does it re-sync
through `inspect(id)` (request-id dedupe makes that idempotent).

The probe is **incremental across restarts**: after each successful sync the
per-session change tokens are persisted (`sync-progress.json` in the data
directory), so a restarted process inherits the previous run's signature
instead of walking every session log on the first open. Only sessions whose
log actually changed while the process was down (or brand-new ones) are
re-walked; when nothing changed the first open costs a metadata listing only.
The baseline is written strictly after a sync, and sessions whose log could
not be read are excluded from it, so the fallback full walk (missing/torn
baseline, first install) re-runs idempotently and then rewrites a fresh one.
So the floating window reflects real persisted usage even when the live hook
missed an event, at almost no cost when nothing changed; the live hook is the
fast path that keeps the ledger current between opens. One unreadable session
log is skipped and counted, never fatal.

The floating window splits its data-status facts by reader: the pinned window
footer always shows the **freshness state** (re-sync state · newest-record
time), visible at any scroll position and also when the ledger is empty; the
**plumbing diagnostics** (record count, day-file count, data directory) live in
the 统计口径 tab's 数据文件状态 section — so when a figure is 0 the cause is
visible (whether records are being captured at all), without pipe facts
cluttering the scroll of usage content.

## Cost

Each record is priced at its own timestamp through a ¥/M per-model price table:
base rates, then a **time-rule → context tier → peak slot** chain. The context
size for tier matching is approximated by the request's input-side tokens
(input + cacheRead + cacheWrite). Cache buckets bill at their own rate when the
table provides one, else at the plain input rate.

The table merges two sources (cloud mirror synced on startup, and a hand-edited
`pricing.json` whose entries always win wholesale):

```json
{ "deepseek-chat": { "inputPerMillion": 2, "outputPerMillion": 8, "cacheReadPerMillion": 0.5 } }
```

Default location: `$DSH_HOME/tokbook/`. A malformed file degrades the affected
models to unpriced (¥0) without breaking the page. Unpriced models are listed in
the floating window.

## Configuration

```yml
plugins:
  tokbook:
    path: D:/data/tokbook        # default: $DSH_HOME/tokbook (or ~/.dsh/tokbook)
    pricingRegion: overseas      # default: domestic (gitee mirror)
    pricingUrl: https://...      # optional explicit feed URL; wins over region
    recordCompaction: true       # default: true — record compaction calls
    # Quota plans keyed by provider route. opencode-go and commandcode are
    # built in: the tab fetches each subscription's OFFICIAL account usage
    # (never a local estimate — a subscription key is shared across tools).
    # A plan is attempted unless enabled:false. The API key is resolved from
    # the DSH credentials service under the provider's reference name
    # (OPENCODE_GO_API_KEY / COMMANDCODE_API_KEY — the same reference the
    # provider's Models/settings page writes when you store the key there),
    # or from an explicit literal below. No key found → "unconfigured" card.
    plans:
      opencode-go:
        # apiKey: user_...               # literal key (wins; optional)
        enabled: false                   # disable this built-in plan
      commandcode:
        # apiKeyEnv: COMMANDCODE_API_KEY # credential ref (provider default)
        # enabled: false                  # disable this built-in plan
```

### Official account usage (订阅额度 tab)

A fourth floating-window tab shows **account-level subscription usage fetched
from each provider's own account API** with your key — so it reflects *all*
tools/devices sharing the subscription, which a local token ledger cannot.

- **Command Code** — queries the account endpoints the official `cmd` CLI uses
  (`/alpha/whoami`, `/alpha/usage/summary`, `/alpha/billing/credits`,
  `/alpha/billing/subscriptions`): window `used/cap/exceeded/resetAt` in USD,
  monthly credit pool, plan + usage summary.
- **OpenCode Go** — queries the official usage endpoint
  (`GET https://opencode.ai/zen/go/v1/usage`): 5h/weekly/monthly windows as
  percent + reset (the endpoint reports no dollar amounts, so that card is
  percent-only).

No key → `unconfigured` card with a hint; fetch failure → `error` card with the
reason; neither falls back to a local estimate. The browser first fetches the
enabled-provider list (`GET /tokbook/quota` — fast, no network), then loads
each provider's card independently via `GET /tokbook/quota?provider=<key>`:
**a card renders the moment its own data arrives**, so one slow/failing
provider never blocks the others. The tab opens on a **stale-while-revalidate**
flow: the host serves the provider's durable *last-known* card instantly (a
per-provider JSON snapshot in the data dir, refreshed after every successful
fetch), and only refreshes from the provider API when that data is older than
a freshness budget — the refresh then updates the numbers in place, never
behind a blank skeleton. The in-memory card is additionally cached for 30s and
the browser never holds the key.

## Status / WIRE notes

Implemented in this scaffold (see `docs/DESIGN.zh.md`):

- **Per-request, durable ledger**: live `session/event` fold → per-day JSONL,
  deduped by request id, with first-run + manual history backfill.
- **Multi-dimensional stats**: totals, per-day, per-hour, per-model, and
  per-(day, model, rate) cells; a frozen-day rollup and a process-memory parse
  cache; the recent window.
- **Cost**: ¥/M price table (cloud mirror + manual overrides), rule-chain rate
  resolution, per-request cost, per-model cost, unpriced-model surfacing.
- **Browser half**: sidebar footer button + shell overlay floating window with
  summary cards (tokens + cost), a 4-bucket split, a daily trend chart, a
  per-model breakdown with cost, the recent records, and a **per-provider tab**:
  one card per provider route with its models' tokens/cost, switchable over
  今日 / 昨天 / 近7天 / 近30天 (a dedicated exact route
  `GET /tokbook/usage?range=…` reads only the window's day files).
- **订阅额度 (quota) tab**: per-plan **official account usage** fetched
  host-side from each provider's own endpoints (`GET /tokbook/quota`) — Command
  Code via its CLI account endpoints (windows + credits + plan), OpenCode Go
  via `/zen/go/v1/usage` (percent + reset). No local estimation; no key → an
  `unconfigured` hint card.

Remaining gaps / planned upgrades:

- The `session/event` / `sessionPersistence` / `webServer` service faces are
  locally typed; tighten against the real `@deepseek-ai/*` type packages once
  wired as devDependencies. (The event payload shapes and the persistence
  surface have been verified against the DSH v11.9.0 source: listing uses
  `sessionPersistence.listSnapshots()` — `{ header, revision }` per session,
  with a plain-header `list()` fallback — and each session's events are read
  through `inspect(id)` → `{ meta, events }`.)
- The overview is a snapshot per open; live SSE push is a follow-up.
- The cloud pricing sync fires on startup (best-effort); exposure of the
  pricing mirror as a settings card is not yet wired.
- Quota is an official fetch served stale-while-revalidate: a 30s in-memory
  TTL plus a durable per-provider last-known snapshot, refreshed in place when
  the client sees data older than its freshness budget. No multi-account
  rotation (one key per plan) yet. A persistent "urgency" indicator on the
  sidebar trigger (color dot by the tightest window) needs event-driven
  updates.
