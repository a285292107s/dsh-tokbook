/**
 * The 订阅额度 card's markup: one card's shell (identity + freshness + gauge +
 * refresh), its ok bodies and its state panels.
 *
 * Card anatomy (see `QuotaCard` in types):
 *  - header identity: a ring gauge leads on the left in place of a monogram,
 *    followed by provider + plan/account context. The ring answers one fixed
 *    question — this month's budget used (Command Code: the monthly credit
 *    pool; OpenCode Go: the official `monthly` window) — and names itself
 *    with a small visible caption beneath the number, so it never silently
 *    means a different window; a card with no monthly measure falls back to
 *    its tightest rolling window, still captioned. On the right sits the
 *    "更新于 HH:mm" freshness label driven by `fetchedAt` (the time of the
 *    official fetch, so a cached render is honest about its age), in front
 *    of the per-card refresh control (or a state chip).
 *  - ok body, top to bottom:
 *    1. one meter row per budget window (amount windows show used/cap +
 *       remaining $; percent-only windows show used % + remaining % on the
 *       same skeleton) — Command Code ends with a "本月额度" meter row built
 *       from the monthly credit pool (see `monthlyAllowanceWindow`), so every
 *       budget reads identically;
 *    2. a thin period-activity strip (completed calls / success / tokens),
 *       only when the provider reports a usage summary.
 *  - non-subscription gates: a card whose account has no in-force subscription
 *    renders a different body, because the provider's rolling windows pace an
 *    in-force plan's included monthly credits only. `gate: 'balance'` (a lapsed
 *    plan, or a pay-as-you-go account) hides the window rows, drops the ring (a
 *    balance has no denominator) and leads with the credit balance and its
 *    sources — including the top-up/free credits that outlive a plan.
 *    `gate: 'none'` (OpenCode Go: valid key, no subscription, and an endpoint
 *    that reports no balance at all) shows the state and nothing else, since
 *    there is no number this card could honestly put on screen.
 *  - unconfigured / error states: a state chip in the header + an explanatory
 *    panel (hint names the fix / reason).
 *
 * The data half (fetch, freshness budget, auto-refresh) lives in
 * `QuotaPanel.tsx`; the arithmetic these views render lives in `metrics.ts`.
 *
 * @module dsh-tokbook/client/quota/QuotaCard
 */

import { useState } from 'react'
import type { QuotaCard, QuotaWindowView } from '../../types.ts'
import { formatTokens } from '../format.ts'
import { RefreshGlyph } from '../icons.tsx'
import {
  balanceUsd, extraCreditsUsd, formatClock, money, monthlyAllowanceWindow, planContext, resetLabel,
  ringPressure, toneOf, type QuotaTone,
} from './metrics.ts'

/** The card's shell: a header (identity + freshness + gauge/chip + refresh),
 * then either the loading placeholder, an error/hint panel, or the data
 * body. */
export function QuotaCardView({ provider, card, error, loading, onRefresh }: {
  provider: string
  card: QuotaCard | null
  error: string | null
  loading: boolean
  onRefresh: () => void
}) {
  const title = card?.title ?? provider
  const ok = card !== null && card.state === 'ok'
  const ctx = ok && card !== null ? planContext(card) : ''
  const ring = ok && card !== null ? ringPressure(card) : undefined
  const state = card?.state ?? 'loading'
  // One-shot click feedback: re-trigger the pop animation on every press even
  // though the button flips to `disabled` (spinner) immediately after.
  const [popTick, setPopTick] = useState(0)

  const handleRefresh = () => {
    setPopTick((t) => t + 1)
    onRefresh()
  }

  return (
    <article className="dtpl-quota-card" data-plan={provider} data-state={state}>
      <header className="dtpl-quota-head">
        <div className="dtpl-quota-id">
          {ok && card !== null && ring !== undefined ? (
            <QuotaGauge pct={ring.pct} tone={ring.tone} cap={ring.cap} />
          ) : (
            <span className="dtpl-quota-state-gap" aria-hidden="true" />
          )}
          <span className="dtpl-quota-id-text">
            <span className="dtpl-quota-name">{title}</span>
            <span className="dtpl-quota-sub">{ok && card !== null ? `${provider}${ctx !== '' ? ` · ${ctx}` : ''}` : provider}</span>
          </span>
        </div>

        <div className="dtpl-quota-head-side">
          {ok && card !== null && card.fetchedAt !== undefined && (
            <span className="dtpl-quota-updated">更新于 {formatClock(card.fetchedAt)}</span>
          )}
          {card !== null && card.gate !== undefined && card.gate !== 'subscription' && (
            <span className="dtpl-quota-chip dtpl-quota-chip-gate">无生效订阅</span>
          )}
          {card !== null && card.state === 'unconfigured' && (
            <span className="dtpl-quota-chip dtpl-quota-chip-muted">未配置</span>
          )}
          {card !== null && card.state === 'error' && (
            <span className="dtpl-quota-chip dtpl-quota-chip-err">查询失败</span>
          )}
          <button
            type="button"
            className="dtpl-quota-refresh"
            onClick={handleRefresh}
            disabled={loading}
            aria-label={`刷新 ${title} 用量`}
            title="刷新此卡片"
          >
            {/* The wrapper owns the one-shot click pop; remounting it via `key`
                restarts the animation on every press even though the button
                flips to disabled (spinner) in the same render. The glyph
                inside keeps the rotation spinner — separate elements, so the
                two transform animations never fight. */}
            <span key={popTick} className={`dtpl-quota-refresh-anim${popTick > 0 ? ' dtpl-quota-refresh-pop' : ''}`}>
              <RefreshGlyph className={`dtpl-quota-refresh-ico${loading ? ' dtpl-spin' : ''}`} />
            </span>
          </button>
        </div>
      </header>

      {card === null && loading ? (
        <QuotaCardSkeleton />
      ) : card === null && error !== null ? (
        <div className="dtpl-quota-msg dtpl-quota-msg-err" role="alert">
          <p className="dtpl-quota-msg-title">加载失败</p>
          <p className="dtpl-quota-msg-body">{error}</p>
          <button type="button" className="dtpl-retry" onClick={onRefresh}>重试</button>
        </div>
      ) : card === null ? (
        <p className="dtpl-quota-note">暂无数据</p>
      ) : card.state !== 'ok' ? (
        <div className={`dtpl-quota-msg dtpl-quota-msg-${card.state === 'unconfigured' ? 'muted' : 'err'}`}>
          <p className="dtpl-quota-msg-title">
            {card.state === 'unconfigured' ? '未配置 API key' : '官方查询失败'}
          </p>
          {card.message !== undefined && card.message !== '' && (
            <p className="dtpl-quota-msg-body">{card.message}</p>
          )}
        </div>
      ) : (
        <>
          {/* A rendered card is never replaced by a fetch error: a failed
              in-place refresh keeps the last-known numbers and reports the
              failure as a note above them. */}
          {error !== null && (
            <p className="dtpl-quota-stale" role="status">刷新失败（{error}），当前显示上次官方数据</p>
          )}
          <QuotaCardBody card={card} />
        </>
      )}
    </article>
  )
}

/** The data body of an ok card. Top to bottom: budget-window meter rows
 * (Command Code appends its monthly-allowance meter, plus its top-up balance
 * when it has one), activity strip. The freshness label lives in the header
 * next to the refresh control. A balance-gated card gets a different body. */
function QuotaCardBody({ card }: { card: QuotaCard }) {
  if (card.gate === 'balance') return <QuotaBalanceBody card={card} />
  if (card.gate === 'none') return <QuotaNoSubscriptionBody card={card} />
  const rows = [...card.windows]
  const monthly = monthlyAllowanceWindow(card)
  if (monthly !== null) rows.push(monthly)
  return (
    <>
      {rows.length > 0 && (
        <div className="dtpl-quota-windows">
          {rows.map((window) => (
            <QuotaWindowRow key={window.id} window={window} />
          ))}
        </div>
      )}
      {card.credits !== undefined && extraCreditsUsd(card.credits) > 0 && (
        <CreditSources credits={card.credits} extraOnly />
      )}
      {card.usage !== undefined && <ActivityStrip usage={card.usage} />}
    </>
  )
}

/** Body of a `none`-gated card: no in-force subscription *and* no balance the
 *  provider's endpoint reports (OpenCode Go exposes window percentages only).
 *  There is nothing this card can put a number on, so it says the state and how
 *  to get out of it — the one thing it must not do is draw the windows, whose
 *  percentages would read as headroom the account does not have. This is the
 *  same instinct as the `unconfigured` / `error` panels, but the state is not a
 *  failure: the key is valid and the provider answered. */
function QuotaNoSubscriptionBody({ card }: { card: QuotaCard }) {
  return (
    <div className="dtpl-quota-msg dtpl-quota-msg-muted">
      <p className="dtpl-quota-msg-title">无生效中的订阅</p>
      {card.gateNote !== undefined && card.gateNote !== '' && (
        <p className="dtpl-quota-msg-body">{card.gateNote}</p>
      )}
    </div>
  )
}

/** Body of a balance-gated card: the account has no in-force subscription, so
 *  the rolling windows are not a bound it is under and are hidden, and the ring
 *  goes with them (no denominator). What replaces them is the number the
 *  provider actually gates on — the credit balance, of which top-up and free
 *  credits survive a lapsed plan and included monthly credits do not — so the
 *  sources are spelled out rather than folded into one amount the user cannot
 *  check against the billing page. */
function QuotaBalanceBody({ card }: { card: QuotaCard }) {
  return (
    <>
      <div className="dtpl-quota-balance">
        <span className="dtpl-quota-balance-v">{money(balanceUsd(card.credits))}</span>
        <span className="dtpl-quota-balance-k">按量余额</span>
      </div>
      {card.gateNote !== undefined && card.gateNote !== '' && (
        <p className="dtpl-quota-balance-note">{card.gateNote}</p>
      )}
      {card.credits !== undefined && <CreditSources credits={card.credits} />}
      {card.usage !== undefined && <ActivityStrip usage={card.usage} />}
    </>
  )
}

/** The credit sources as one compact line (`月额度 $x · 已购 $y · 赠送 $z`).
 *  These used to be fetched and then never rendered: the balance that decides
 *  whether a lapsed account can still call anything was invisible. On a
 *  balance-gated card all three are named; on an in-force card only the extras
 *  are (the included monthly pool is already the 本月额度 meter). A source the
 *  provider reports as exactly zero is left out — and a line with nothing left
 *  to say is dropped, since the balance above it already reads `$0.00`. */
function CreditSources({ credits, extraOnly = false }: {
  credits: NonNullable<QuotaCard['credits']>
  extraOnly?: boolean
}) {
  const parts: string[] = []
  const add = (label: string, value: number | undefined) => {
    if (value !== undefined && value > 0) parts.push(`${label} ${money(value)}`)
  }
  if (!extraOnly) add('月额度', credits.monthlyUsd)
  add('已购', credits.purchasedUsd)
  add('赠送', credits.freeUsd)
  if (parts.length === 0) return null
  const text = parts.join(' · ')
  return <p className="dtpl-quota-sources">{extraOnly ? `额外余额 ${text}` : text}</p>
}

/** One budget window, on one skeleton for both data shapes: label + used
 * metric on the first line, a tone meter, then remaining + reset. Money
 * windows (Command Code) show used/cap and a $-remaining; percent-only
 * windows (OpenCode Go) show used % and a remaining %. */
function QuotaWindowRow({ window }: { window: QuotaWindowView }) {
  const pct = window.usagePercent
  const tone = toneOf(pct)
  const hasAmounts = window.capUsd !== undefined && window.usedUsd !== undefined
  const metric = hasAmounts
    ? `已用 ${money(window.usedUsd!)} / ${money(window.capUsd!)}`
    : `已用 ${pct}%`
  const remaining = hasAmounts
    ? `剩 ${money(Math.max(0, (window.capUsd ?? 0) - (window.usedUsd ?? 0)))}`
    : `剩 ${Math.max(0, Math.round(100 - pct))}%`
  return (
    <div className="dtpl-quota-window" data-window={window.id} data-tone={tone}>
      <div className="dtpl-quota-window-line1">
        <span className="dtpl-quota-window-label">{window.label}</span>
        <span className="dtpl-quota-window-metric">{metric}</span>
      </div>
      <div
        className="dtpl-quota-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label={`${window.label} 已用 ${Math.round(pct)}%`}
      >
        <span className={`dtpl-quota-bar-fill dtpl-quota-tone-${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="dtpl-quota-window-line2">
        <span className="dtpl-quota-remaining">{remaining}</span>
        <span className={`dtpl-quota-reset${window.exceeded ? ' dtpl-quota-reset-limited' : ''}`}>
          {window.exceeded
            ? '已超限'
            : resetLabel(window)}
        </span>
      </div>
    </div>
  )
}

/** Optional period-activity stat strip (Command Code): completed calls +
 * success + tokens. Slimmer than the budget meters above — this answers "is
 * my usage healthy / where did the money go", not the "how much is left"
 * question the window rows own. */
function ActivityStrip({ usage }: { usage: NonNullable<QuotaCard['usage']> }) {
  const cells: Array<{ value: string; key: string; warn?: string }> = []
  if (usage.completed !== undefined) {
    cells.push({
      value: String(usage.completed),
      key: '完成请求',
      warn: usage.failed !== undefined && usage.failed > 0 ? `${usage.failed} 失败` : undefined,
    })
  }
  if (usage.successRate !== undefined) {
    cells.push({ value: `${usage.successRate}%`, key: '成功率' })
  }
  if (usage.tokensIn !== undefined || usage.tokensOut !== undefined) {
    cells.push({
      value: `${formatTokens(usage.tokensIn ?? 0)} / ${usage.tokensOut !== undefined ? formatTokens(usage.tokensOut) : '—'}`,
      key: '词元（入/出）',
    })
  }
  if (cells.length === 0) return null
  return (
    <div className="dtpl-quota-stats">
      {cells.map((cell) => (
        <div className="dtpl-quota-stat" key={cell.key}>
          <span className="dtpl-quota-stat-v">
            {cell.value}
            {cell.warn !== undefined && <i className="dtpl-quota-stat-warn">{cell.warn}</i>}
          </span>
          <span className="dtpl-quota-stat-k">{cell.key}</span>
        </div>
      ))}
    </div>
  )
}

/** Ring gauge heading the card's identity row (where the plan monogram used
 * to be). The ring stroke carries the tone and the used-% number is centered
 * *inside* the ring; the budget that % refers to (normally 本月 — see
 * `ringPressure`) is written as a small caption beneath the number, so the
 * ring never silently means a different window. The same text feeds the
 * accessible name / tooltip. */
function QuotaGauge({ pct, tone, cap }: { pct: number; tone: QuotaTone; cap: string }) {
  const p = Math.max(0, Math.min(100, pct))
  const R = 15.5
  const C = 2 * Math.PI * R
  return (
    <span
      className={`dtpl-quota-gauge dtpl-quota-tone-${tone}`}
      role="img"
      aria-label={`${cap} 已用 ${Math.round(p)}%`}
      title={`${cap} 已用 ${Math.round(p)}%`}
    >
      <svg viewBox="0 0 40 40" aria-hidden="true" className="dtpl-quota-gauge-svg">
        <circle className="dtpl-quota-gauge-track" cx="20" cy="20" r={R} />
        <circle
          className="dtpl-quota-gauge-fill"
          cx="20"
          cy="20"
          r={R}
          strokeDasharray={`${(p / 100) * C} ${C}`}
        />
      </svg>
      <span className="dtpl-quota-gauge-n" aria-hidden="true">
        <span>{Math.round(p)}<i>%</i></span>
        <span className="dtpl-quota-gauge-cap">{cap}</span>
      </span>
    </span>
  )
}

/** Loading placeholder shaped like the real card (reserved geometry). */
function QuotaCardSkeleton() {
  return (
    <div className="dtpl-quota-sk-body" aria-hidden="true">
      <div className="dtpl-quota-sk-line dtpl-sk" />
      <div className="dtpl-quota-sk-bar dtpl-sk" />
      <div className="dtpl-quota-sk-line dtpl-quota-sk-line-short dtpl-sk" />
      <div className="dtpl-quota-sk-bar dtpl-sk" />
    </div>
  )
}
