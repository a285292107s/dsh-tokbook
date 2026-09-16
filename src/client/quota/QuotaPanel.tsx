/**
 * 订阅额度 tab：官方账户用量（宿主侧从 provider 拉取；浏览器不持有 API key）。
 *
 * 打开延迟是一等关切：tab 立即渲染最近已知的卡（宿主 TTL 或持久化快照——首帧不触达 provider），仅当已服务数据老于新鲜度预算时就地刷新。刷新绝不清空卡。无生效订阅的卡被下沉。
 *
 * @module dsh-tokbook/client/quota/QuotaPanel
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { QuotaCard, QuotaGate, QuotaView } from '../../types.ts'
import { orderQuotaProviders } from '../../quota.ts'
import { UsageGlyph } from '../icons.tsx'
import { QuotaCardView } from './QuotaCard.tsx'

/** 分段控件提供的自动刷新预设（0 = 关闭）。 */
const AUTO_PRESETS: ReadonlyArray<{ min: number; label: string }> = [
  { min: 0, label: '关闭' },
  { min: 1, label: '1 分' },
  { min: 5, label: '5 分' },
  { min: 15, label: '15 分' },
  { min: 30, label: '30 分' },
]

/** 未选择过时的间隔。 */
const DEFAULT_AUTO_MIN = 5

/**
 * 自动刷新间隔存放处。这是**视图偏好**（每台浏览器自己决定多久看一眼官方用量），不是账本数据，
 * 所以进 localStorage 而不是宿主配置：无需契约、无需重启、不同浏览器可各选各的。
 */
const AUTO_MIN_KEY = 'dsh-tokbook.quota-auto-min'

/** 读回上次选的间隔。只认预设值——存储里的旧值或坏值一律回落到默认，不让它决定控件显示什么。 */
function readAutoMinutes(): number {
  const saved = localStorage.getItem(AUTO_MIN_KEY)
  // 先判 null：`Number(null)` 是 0，而 0 是合法预设（关闭）——缺键会静默变成「关闭」。
  if (saved === null) return DEFAULT_AUTO_MIN
  const min = Number(saved)
  return AUTO_PRESETS.some((preset) => preset.min === min) ? min : DEFAULT_AUTO_MIN
}

/** 已服务的 'ok' 数据在进入 tab 触发就地刷新前允许多旧。额度窗口按分钟尺度变化，预算内的数据原样展示。 */
const QUOTA_FRESH_MS = 60_000

/** 自动跟进刷新之间的最小间隔，防止快速切 tab 打爆 provider API。 */
const QUOTA_REFRESH_COOLDOWN_MS = 30_000

export function QuotaPanel() {
  const [providers, setProviders] = useState<readonly string[] | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [autoMinutes, setAutoMinutes] = useState(readAutoMinutes)
  const [autoTicker, setAutoTicker] = useState(0)
  /** 每张卡最近一次报告的 gate，按 provider 键控。缺席意味着「尚不知道」，排序时按生效处理。 */
  const [gates, setGates] = useState<Readonly<Record<string, QuotaGate>>>({})

  // 刻意保持引用稳定：卡把它作为 prop 放进 fetch 回调的 deps，每次渲染换新函数会重建该回调并重跑挂载 effect（refetch 循环）。
  const reportGate = useCallback((provider: string, gate: QuotaGate | undefined) => {
    setGates((prev) => {
      if (prev[provider] === gate) return prev
      const next = { ...prev }
      if (gate === undefined) delete next[provider]
      else next[provider] = gate
      return next
    })
  }, [])

  // 每次挂载拉取一次已启用 route 列表。快速、不走网络。
  useEffect(() => {
    let cancelled = false
    setListError(null)
    fetch('/tokbook/quota')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<QuotaView>
      })
      .then((view) => {
        if (!cancelled) setProviders(view.providers)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setListError(err instanceof Error ? err.message : String(err))
          setProviders([])
        }
      })
    return () => { cancelled = true }
  }, [])

  // 自动刷新：按选定间隔推进 ticker（0 = 关闭）。
  useEffect(() => {
    if (autoMinutes <= 0) return
    const timer = setInterval(() => {
      setAutoTicker((t) => t + 1)
    }, autoMinutes * 60_000)
    return () => clearInterval(timer)
  }, [autoMinutes])

  // 用户选的档位立刻落盘：面板随 tab 切换/浮窗关闭卸载，组件状态活不过那一刻。
  const chooseAutoMinutes = useCallback((min: number) => {
    setAutoMinutes(min)
    localStorage.setItem(AUTO_MIN_KEY, String(min))
  }, [])

  const hasProviders = providers !== null && providers.length > 0
  // 展示顺序：退役计划在后（见 `orderQuotaProviders`）。卡报告 gate 时重新计算——宿主列表是静态的，真相一张一张到来。
  const ordered = useMemo(
    () => (providers === null ? [] : orderQuotaProviders(providers, (provider) => gates[provider])),
    [providers, gates],
  )
  return (
    <section className="dtpl-quota-sec" aria-label="订阅额度">
      <p className="dtpl-quota-intro">
        各订阅的<b>官方账户用量</b>（由插件用你配置的 key 直接向该通道方查询）。
      </p>

      {hasProviders && (
        <AutoRefreshControl value={autoMinutes} onChange={chooseAutoMinutes} />
      )}

      {listError !== null && (
        <div className="dtpl-error" role="alert">
          <p className="dtpl-error-text">额度加载失败：{listError}</p>
          <button type="button" className="dtpl-retry" onClick={() => setListError(null)}>重试</button>
        </div>
      )}

      {providers === null && listError === null
        ? (
          <div className="dtpl-skeleton" aria-hidden="true">
            <div className="dtpl-quota-sk-card dtpl-sk" />
            <div className="dtpl-quota-sk-card dtpl-sk" />
          </div>
        )
        : !hasProviders
          ? (
            <div className="dtpl-empty">
              <UsageGlyph className="dtpl-empty-ico" />
              <p className="dtpl-empty-title">尚未配置任何订阅额度查询</p>
              <p className="dtpl-empty-sub">在插件配置的 <code>plans</code> 里为 opencode-go / commandcode 提供 API key（或登录对应官方 CLI），这里就会展示官方账户用量。</p>
            </div>
          )
          : (
            <div className="dtpl-quota-cards">
              {ordered.map((provider) => (
                <QuotaCardController
                  key={provider}
                  provider={provider}
                  autoTicker={autoTicker}
                  onGate={reportGate}
                />
              ))}
            </div>
          )}
    </section>
  )
}

/** 分段自动刷新选择器：关闭 / 1 / 5 / 15 / 30 分钟。 */
function AutoRefreshControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="dtpl-quota-autorefresh">
      <span className="dtpl-quota-autorefresh-label">自动刷新</span>
      <div className="dtpl-quota-autorefresh-seg" role="group" aria-label="自动刷新间隔">
        {AUTO_PRESETS.map((preset) => (
          <button
            key={preset.min}
            type="button"
            className={`dtpl-quota-autorefresh-opt${value === preset.min ? ' dtpl-quota-autorefresh-on' : ''}`}
            aria-pressed={value === preset.min}
            onClick={() => onChange(preset.min)}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <span className="dtpl-quota-autorefresh-state">
        {value > 0 ? `每 ${value} 分钟自动刷新` : '不自动刷新'}
      </span>
    </div>
  )
}

/** 一张拥有自己数据拉取 + 刷新的卡。stale-while-revalidate：首帧返回最近已知数据，过时才就地刷新；刷新绝不清空已渲染的卡。 */
function QuotaCardController({ provider, autoTicker, onGate }: {
  provider: string
  autoTicker: number
  /** 把本卡的 gate 报告给面板，面板据此排序。必须保持引用稳定。 */
  onGate: (provider: string, gate: QuotaGate | undefined) => void
}) {
  const [card, setCard] = useState<QuotaCard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const inFlight = useRef(0)
  const lastRefreshAt = useRef(0)
  /** 已渲染的卡，供 timer effect 读取而不必依赖它（否则每次拉取都会重启 interval）。 */
  const cardRef = useRef<QuotaCard | null>(null)

  const fetchCard = useCallback((force: boolean): Promise<QuotaCard | null> => {
    const token = ++inFlight.current
    setLoading(true)
    setError(null)
    return fetch(`/tokbook/quota?provider=${encodeURIComponent(provider)}${force ? '&refresh=1' : ''}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return await res.json() as QuotaCard
      })
      .then((data) => {
        if (token !== inFlight.current) return null
        cardRef.current = data
        setCard(data)
        setError(null)
        // 在取代检查之后报告：成功但无 gate 的响应（服务端拉取失败或 key 已消失）报告 `undefined` 并删掉条目。失败的刷新永远到不了这里。
        onGate(provider, data.gate)
        return data
      })
      .catch((err: unknown) => {
        if (token !== inFlight.current) return null
        // 保留已渲染的卡——失败的刷新绝不抹掉最近已知数字（错误以卡内提示形式浮出）。
        setError(err instanceof Error ? err.message : String(err))
        return null
      })
      .finally(() => {
        if (token === inFlight.current) setLoading(false)
      })
  }, [provider, onGate])

  // 首次加载（宿主提供新鲜 TTL 或持久化最近已知卡，故不等 provider）。
  // 已服务数据老于新鲜度预算时就地刷新一次。
  useEffect(() => {
    let cancelled = false
    void fetchCard(false).then((first) => {
      if (cancelled || first === null || first.state !== 'ok' || first.fetchedAt === undefined) return
      const now = Date.now()
      if (now - first.fetchedAt <= QUOTA_FRESH_MS) return
      if (now - lastRefreshAt.current < QUOTA_REFRESH_COOLDOWN_MS) return
      lastRefreshAt.current = Date.now()
      void fetchCard(true)
    })
    return () => { cancelled = true; inFlight.current += 1 }
  }, [fetchCard])

  // 自动刷新 tick → 强制重拉本卡。非订阅卡跳过：余额只在用户消费或充值时变化，手动刷新和打开时的新鲜度刷新仍然会重 hit provider。
  const firstTick = useRef(true)
  useEffect(() => {
    if (firstTick.current) { firstTick.current = false; return }
    const gate = cardRef.current?.gate
    if (gate !== undefined && gate !== 'subscription') return
    lastRefreshAt.current = Date.now()
    void fetchCard(true)
  }, [autoTicker, fetchCard])

  return (
    <QuotaCardView
      provider={provider}
      card={card}
      error={error}
      loading={loading}
      onRefresh={() => { lastRefreshAt.current = Date.now(); void fetchCard(true) }}
    />
  )
}
