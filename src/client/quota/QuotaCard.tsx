/**
 * 订阅额度卡的标记：壳（身份 + 新鲜度 + 仪表 + 刷新）、ok 正文与状态面板。
 * 环指代哪个预算由 `metrics.ts` 的 `ringPressure` 决定；没有读数时环只画轨道、中心改写
 * 状态词，形状与位置都不换。正文按 gate 分（余额没有分母，不画环）。
 *
 * 数据半区在 `QuotaPanel.tsx`；算术在 `metrics.ts`。
 */

import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { QuotaCard, QuotaWindowView } from '../../types.ts'
import { formatTokens } from '../format.ts'
import { RefreshGlyph } from '../icons.tsx'
import {
  balanceUsd, extraCreditsUsd, formatClock, headStateWord, money, monthlyAllowanceWindow, planContext, resetLabel,
  ringPressure, toneOf, type QuotaTone,
} from './metrics.ts'

/** 卡的壳：头部（身份 + 新鲜度 + 仪表/标签 + 刷新），然后是加载占位、错误/提示面板或数据正文。 */
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
  // 一次性点击反馈：按钮立刻切到 `disabled`（spinner）后，每次按下仍能重新触发弹出动画。
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
            {/* `key` remount 让每次按下都重启弹出；spinner 在内层图标上，与弹出互不干涉。 */}
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
        // `role="alert"` 只给**真的出错**那一支：未配置是提示，不是错误，把它当告警播报会造假。
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

/** ok 卡的数据正文；余额门控的卡获得不同正文。 */
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

/** `none` 门控卡的正文：无生效订阅且 provider 端点不报任何余额。绝不能画窗口——那些百分比会被读成账户并不拥有的余量。 */
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

/** 余额门控卡的正文：滚动窗口不是它承受的约束故隐藏；余额来源逐项列出（充值 / 免费额度在计划过期后存活，见 `metrics.ts`）。 */
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

/** 额度来源的一行紧凑展示。余额门控卡列出全部三项；生效订阅卡只列额外项。 */
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

/** 一个预算窗口，两种数据形状共用同一骨架：金额窗口显示已用/上限 + $ 剩余；仅百分比窗口显示已用 % + 剩余 %。 */
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

/** 可选的周期活动统计条：完成请求 + 成功率 + 词元。回答「用量健康吗」，不是窗口行的「还剩多少」。 */
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

/** 两种环形态共用的几何。分开写就会漂——而「两只环长得一样」正是这两只环存在的理由。 */
const GAUGE_R = 15.5
const GAUGE_C = 2 * Math.PI * GAUGE_R

/** 环本体：外圈轨道 + 可选弧。两种形态共用，几何常量在上面。弧长经 --dtpl-arc 交给入场动效（shared 片段的描边扫入 keyframe）。 */
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

/** 环**没有读数**的形态：同一只 44×44 的轨道环，中心换写状态词。环的**形状**因此不随状态换语言，
 *  而词写在数字该在的位置上，不会被误读成「已用 0%」。
 *  中心是普通文本，读屏照读，不用 aria 名称。 */
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

/** 卡身份行的环形仪表；百分比指代的预算以小标题写在数字下方（指代哪个窗口由 `ringPressure` 定）。 */
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

/** 形状像真卡的加载占位（预留几何）。 */
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
