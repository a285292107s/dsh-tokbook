import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { QuotaCard, QuotaWindowView } from '../../types.ts'
import { formatTokens } from '../format.ts'
import { RefreshGlyph } from '../icons.tsx'
import {
  balanceUsd, extraCreditsUsd, formatClock, headStateWord, money, monthlyAllowanceWindow, planContext, resetLabel,
  ringPressure, toneOf, type QuotaTone,
} from './metrics.ts'

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
  const idle = headStateWord(card)
  const [popTick, setPopTick] = useState(0)

  const handleRefresh = () => {
    setPopTick((t) => t + 1)
    onRefresh()
  }

  return (
    <article className="dtpl-quota-card">
      <header className="dtpl-quota-head">
        <div className="dtpl-quota-id">
          {card !== null && ring !== undefined ? (
            <QuotaGauge pct={ring.pct} tone={ring.tone} cap={ring.cap} />
          ) : (
            <QuotaIdleRing word={idle.word} alert={idle.alert} />
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
          <button
            type="button"
            className="dtpl-quota-refresh"
            onClick={handleRefresh}
            disabled={loading}
            aria-label={`刷新 ${title} 用量`}
            title="刷新此卡片"
          >
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
        <div
          className={`dtpl-quota-msg dtpl-quota-msg-${card.state === 'unconfigured' ? 'muted' : 'err'}`}
          role={card.state === 'error' ? 'alert' : undefined}
        >
          <p className="dtpl-quota-msg-title">
            {card.state === 'unconfigured' ? '未配置 API key' : '官方查询失败'}
          </p>
          {card.message !== undefined && card.message !== '' && (
            <p className="dtpl-quota-msg-body">{card.message}</p>
          )}
        </div>
      ) : (
        <>
          {error !== null && (
            <p className="dtpl-quota-stale" role="status">刷新失败（{error}），当前显示上次官方数据</p>
          )}
          <QuotaCardBody card={card} />
        </>
      )}
    </article>
  )
}

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

function QuotaWindowRow({ window }: { window: QuotaWindowView }) {
  const pct = window.usagePercent
  const tone = toneOf(pct)
  const hasAmounts = window.capUsd !== undefined && window.usedUsd !== undefined
  const metric = hasAmounts
    ? `已用 ${money(window.usedUsd!)} / ${money(window.capUsd!)}`
    : `已用 ${pct}%`
  const remaining = hasAmounts
    ? `剩余 ${money(Math.max(0, (window.capUsd ?? 0) - (window.usedUsd ?? 0)))}`
    : `剩余 ${Math.max(0, Math.round(100 - pct))}%`
  return (
    <div className="dtpl-quota-window" data-tone={tone}>
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

const GAUGE_R = 15.5
const GAUGE_C = 2 * Math.PI * GAUGE_R

function GaugeRing({ arc }: { arc?: number }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className="dtpl-quota-gauge-svg">
      <circle className="dtpl-quota-gauge-track" cx="20" cy="20" r={GAUGE_R} />
      {arc !== undefined && (
        <circle
          className="dtpl-quota-gauge-fill"
          cx="20"
          cy="20"
          r={GAUGE_R}
          strokeDasharray={`${arc} ${GAUGE_C}`}
          style={{ '--dtpl-arc': `${arc}px` } as CSSProperties}
        />
      )}
    </svg>
  )
}

function QuotaIdleRing({ word, alert }: { word: string; alert: boolean }) {
  return (
    <span className={`dtpl-quota-gauge dtpl-quota-gauge-idle${alert ? ' dtpl-quota-tone-danger' : ''}`}>
      <GaugeRing />
      <span className="dtpl-quota-gauge-n">
        <span className="dtpl-quota-gauge-word">{word}</span>
      </span>
    </span>
  )
}

function QuotaGauge({ pct, tone, cap }: { pct: number; tone: QuotaTone; cap: string }) {
  const p = Math.max(0, Math.min(100, pct))
  return (
    <span
      className={`dtpl-quota-gauge dtpl-quota-tone-${tone}`}
      role="img"
      aria-label={`${cap} 已用 ${Math.round(p)}%`}
      title={`${cap} 已用 ${Math.round(p)}%`}
    >
      <GaugeRing arc={(p / 100) * GAUGE_C} />
      <span className="dtpl-quota-gauge-n" aria-hidden="true">
        <span>{Math.round(p)}<i>%</i></span>
        <span className="dtpl-quota-gauge-cap">{cap}</span>
      </span>
    </span>
  )
}

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
