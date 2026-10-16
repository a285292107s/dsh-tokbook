# dsh-tokbook

> **Doc meta** · role: entry · language: en · status: current · last-reviewed: 2026-10-16 · supersedes: —

A **cross-session token-usage ledger for DeepSeek Harness (DSH)**.

Every billed model call the harness makes is folded into one row in a local, per-day JSONL ledger, and
aggregated with costs. A button in the sidebar footer opens an overlay with five tabs: today's usage
and a 14-day trend, account-level subscription quota, per-window usage detail, the price table, and a
page that states plainly what the numbers do not include.

![The tokbook overlay](docs/assets/overlay-overview.png)

> **The UI is in Chinese (zh-CN).** The plugin is built by and for a Chinese-speaking DSH user, so tab
> labels, hints and the method page are not translated. Everything the plugin stores is plain
> JSON / JSONL in a directory you choose, so the data is readable regardless.

## Install

You need DSH (`dsh --version`) and **pnpm** on your `PATH`.

```sh
dsh plugin --profile web add github:a285292107s/dsh-tokbook
```

The repo ships source, not build output: `lib/` is a build artifact, so pnpm builds the package during
install through its `prepare` script. pnpm refuses to run a dependency's build script until you allow
it, so the first run stops and prints the exact key it wants. Add that key to the profile's
`pnpm-workspace.yaml` and run the same command again:

```yaml
# $DSH_HOME/profiles/web/pnpm-workspace.yaml — use the exact key pnpm printed
allowBuilds:
  dsh-tokbook: true
```

Then mount the plugin. It is a plain external plugin, not a `dsh.bundle` layer, so the profile has to
name it in `cordis.patch.yml`:

```yaml
# $DSH_HOME/profiles/web/cordis.patch.yml
- insert:
    - id: tokbook
      name: 'dsh-tokbook'
      config:                     # every key is optional; see Configuration
        path: D:/data/tokbook
```

Restart `dsh web` and refresh the browser. The entry button appears at the bottom of the sidebar
(`sidebar.footer.action`), and the overlay itself is a shell overlay.

To install from a local checkout instead, use `dsh plugin --profile web add .`.

## The ledger

The host half listens to the persisted `session/event` stream and writes one JSONL row per billed
model call into the data directory (default `$DSH_HOME/tokbook/`, override with `path`). Two rules
shape everything the plugin reports:

- **Only real billed calls are recorded.** A row comes from one of four event kinds:
  `assistant/message` (using its `usage`), `compaction/summary`, `llm/retry` (scheduling a retry is a
  failed attempt), and `turn/end` with `reason.kind === 'error'`. A call the provider never reported
  usage for **still gets a row and still counts as a request** — it just adds nothing to the four token
  buckets. **Unknown is not zero**: nothing is estimated.
- **You write the prices yourself.** One `pricing.json` maps route → exact model string → one current
  price. Amounts are split into **actual spend** (`metered` routes) and **subscription value**
  (`subscription` routes, i.e. what you avoided paying — not cash), and are never merged into a single
  "cost" number.

Because a price is a single current value, an amount answers *what the tokens I have used recently
would cost now* — not what the invoice said at the time. That is why money is only reported for
windows of 30 days or less; the all-time view reports tokens only. Tokens are facts and stay true
forever; prices do not.

## The five tabs

1. **用量总览 / Overview** — today's totals, the token composition, and a 14-day trend.
2. **订阅额度 / Subscription quota** — account-level official usage, fetched from the provider's own
   account API with your key. This reflects every tool and device sharing the subscription, which a
   local ledger cannot see. Covers Command Code and OpenCode Go.
3. **用量明细 / Usage detail** — a window (today / yesterday / last 7 days / last 30 days / all) crossed
   with three breakdowns: by model, by workspace, by provider route. Money appears only in the windows
   that carry it.
4. **价格表 / Pricing** — one model per screen: choose a route and a model, then write that model's
   current price (four tiers plus optional peak/off-peak slots). The FX rate and the statutory-holiday
   calendar live here too.
5. **统计口径 / Method** — the reporting method: what is not estimated, what is missing, and how the
   numbers reconcile.

Prices can also be filled from [models.dev](https://models.dev/api.json), a public USD catalogue. The
**lookup** button fuzzy-searches the currently selected model name and lets you pick one candidate;
the **sync** button fills gaps for USD-priced routes that the ledger has actually billed. Only
first-party catalogue entries are trusted, and a hand-written price is never overwritten.

## Configuration

Configuration lives under `config:` on the profile's mount row. Every key is optional:

```yaml
config:
  path: D:/data/tokbook        # default: $DSH_HOME/tokbook (or ~/.dsh/tokbook)
  recordCompaction: true       # default true — record compaction/summarize calls as rows
  plans:
    opencode-go:               # keyed by provider route
      enabled: false           # a plan is used as soon as a usable API key exists, unless disabled
      apiKey: '...'            # literal key, checked first
      apiKeyEnv: OPENCODE_GO_API_KEY   # else a credential reference name; defaults to the route's own
```

To change the config of an already-mounted row you can write a second patch that targets `id: tokbook`
— it **replaces** that row's `config` wholesale rather than merging, so restate every key you want to
keep.

### Official account usage

The quota tab pulls account-level subscription usage from the provider's own API with your key.

- **No key → an `unconfigured` card; a failed fetch → an `error` card.** Neither ever falls back to a
  local estimate, and the browser half never holds your key.
- **A key without an active subscription is not an error.** Providers that report only a balance get a
  `balance` card; those that report window percentages without a subscription (for example OpenCode Go
  answering `403` for a valid key with no Go plan) get a `none` card. A gate is only ever derived from
  an endpoint that actually answered — a timeout or a `5xx` is *unknown*, never "no subscription".
- The dot on the sidebar button comes from the last successful on-disk snapshot and never calls a
  provider API by itself.

## Where the data lives

Default `$DSH_HOME/tokbook/`, and it is **one writer per data directory**: on startup the host writes
an `owner.json` marker with its pid and start time, and warns instead of taking over if a live foreign
process owns the directory. A stale marker left by a crash is taken over silently. **If you run a
second host, point it at its own `path`.** Deleting `pricing.json` leaves the ledger intact but makes
every row read as price-unknown (¥0), so back it up if you care about the amounts.

## Known gaps

- Quota plans hold a single API key per provider route; there is no multi-account rotation.
- `assistant/attempt` (an attempt that ended without producing a visible message) is not projected, so
  a failed attempt whose adapter only reported `usage` on the attempt stream is not recorded. Pairing
  attempts by retry lifecycle is a separate task (`src/usage-record.ts` carries the same note).
- The cloud pricing mirror (reference price table, vendor grouping, wrapped route aliases) was removed
  wholesale and is to be redone as a separate task.
- The price-effective timeline was removed: the table holds current prices only, which is why amounts
  are limited to windows of 30 days or less.

## Development

Source of truth is `src/` — host in `src/*.ts`, browser in `src/client/*.tsx`. `lib/` is a gitignored
build artifact; never edit or commit it.

```sh
pnpm install
pnpm build        # tsc emits lib/types/**/*.d.ts, then esbuild bundles host + client
pnpm typecheck    # types of src/ only — a lighter alternative to a full build
pnpm test         # smoke (pure logic) + selfcheck (ledger invariants) + selfcheck:ui (UI static bans)
```

`pnpm build` is a product, not a check: you only need it when you want to see a `src/` change inside a
host or the preview bench. To look at the UI without starting DSH, `pnpm ledger` serves the same page
shell and client bundle against a real ledger directory; run it without `--ledger` and it degrades into
a fixture preview bench (`?dark=1`, `?tab=`, `?quota=`), with the whole bench's shape chosen per
process by `TOKBOOK_MODE=empty|err|sync|syncerr`.

The Chinese README ([`README.zh.md`](README.zh.md)) is the maintainer's document: it carries the full
`src/` layout tree, the build internals, and the development loop. Further reading starts at
[`docs/INDEX.md`](docs/INDEX.md) — the contracts that keep the numbers honest are in
[`docs/CONTRACTS.md`](docs/CONTRACTS.md), and the reasoning behind the shape is in
[`docs/DESIGN.md`](docs/DESIGN.md). Repository docs are written in Chinese.

## License

[MIT](LICENSE)
