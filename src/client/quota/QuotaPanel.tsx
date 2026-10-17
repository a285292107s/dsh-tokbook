/**
 * 订阅额度 tab：官方账户用量（宿主侧从 provider 拉取；浏览器不持有 API key）。
 *
 * 打开延迟是一等关切：tab 立即渲染最近已知的卡，仅当已服务数据老于新鲜度预算时就地刷新；
 * 刷新绝不清空卡。无生效订阅的卡被下沉。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { QuotaCard, QuotaGate, QuotaView } from '../../types.ts'
import { QUERY_PROVIDER, QUERY_REFRESH, ROUTE_QUOTA } from '../../route-paths.ts'
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
  try {
    const saved = localStorage.getItem(AUTO_MIN_KEY)
    // 先判 null：`Number(null)` 是 0，而 0 是合法预设（关闭）——缺键会静默变成「关闭」。
    if (saved === null) return DEFAULT_AUTO_MIN
    const min = Number(saved)
    return AUTO_PRESETS.some((preset) => preset.min === min) ? min : DEFAULT_AUTO_MIN
  } catch {
    // 隐私模式等拿不到存储：回落到默认间隔。
    return DEFAULT_AUTO_MIN
  }
}

/**
 * 额度列表载荷的形状判定：渲染只解引用 `providers`（每项进请求 query、又当 React key），
 * 所以只认「字符串数组」。不合法就走面板**已有的**错误态（错误条 + 重试），绝不把半成品塞进
 * state——渲染期抛错会让这一条 list 型 slot 被宿主摘掉（浮窗从此打不开）。
 * 判据按 host 的组装处与类型：`QuotaView.providers`（`src/types.ts`）、路由原样 JSON 作答
 * （`src/routes.ts` 的额度 route）。只给符号名，不写行号——行号每改一次就错一次。
 */
function readProviderList(raw: unknown): string[] | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { providers } = raw as Partial<QuotaView>
  if (!Array.isArray(providers) || !providers.every((item): item is string => typeof item === 'string')) return null
  return providers
}

/**
 * 单张额度卡载荷的形状判定：只覆盖渲染**真正会无条件解引用**的字段——`state`（决定走哪一支正文）
 * 与 `windows`（`ringPressure` 对它 `find` / `for…of`；正文里 `[...card.windows]`），以及窗口条目
 * 本身与 `credits` / `usage` 这两个**在场就必须是对象**的可选字段（渲染用 `!== undefined` 判在场、
 * 随后直接读属性，几处都没有可选链，`null` 会过关再抛）。其余可选字段与 `gate` / `title` /
 * `message` 等一律不收紧。判据按 host 的卡的组装处与类型：`QuotaCard`（`src/types.ts`）。
 */
function readQuotaCard(raw: unknown): QuotaCard | null {
  if (typeof raw !== 'object' || raw === null) return null
  const card = raw as Partial<QuotaCard>
  if (typeof card.state !== 'string') return null
  if (!Array.isArray(card.windows)) return null
  for (const window of card.windows) {
    if (typeof window !== 'object' || window === null) return null
  }
  if (card.credits !== undefined && (typeof card.credits !== 'object' || card.credits === null)) return null
  if (card.usage !== undefined && (typeof card.usage !== 'object' || card.usage === null)) return null
  return card as QuotaCard
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

  // 每次挂载（以及按下「重试」）拉取一次已启用 route 列表。快速、不走网络。
  // 拉取开始把 providers 清回 null：一次失败留下的空列表若被留下，第二笔在飞期间就会被读成
  // 「尚未配置」——而真相是还没读到。
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let cancelled = false
    setListError(null)
    setProviders(null)
    fetch(ROUTE_QUOTA)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<unknown>
      })
      .then((raw) => {
        if (cancelled) return
        const list = readProviderList(raw)
        // 形状不对按一次读失败处理：错误态是重试的入口，而半成品进 state 会让渲染期抛错。
        if (list === null) throw new Error('响应不是一份额度列表')
        setProviders(list)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setListError(err instanceof Error ? err.message : String(err))
          setProviders([])
        }
      })
    return () => { cancelled = true }
  }, [reload])

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
    try {
      localStorage.setItem(AUTO_MIN_KEY, String(min))
    } catch {
      // 存不下不影响这一次选择，只是下次打开回到默认间隔。
    }
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
          <button type="button" className="dtpl-retry" onClick={() => setReload((count) => count + 1)}>重试</button>
        </div>
      )}

      {/* 错误时不再补一句「尚未配置」——那句话说的是「你没配置」，而真相是这一次没读到。 */}
      {listError !== null
        ? null
        : providers === null
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
                <p className="dtpl-empty-sub">在插件配置的 <code>plans</code> 里为 opencode-go / commandcode 提供 API key，或在本机 Models 页填好该通道的 key，这里就会展示官方账户用量。</p>
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
    return fetch(`${ROUTE_QUOTA}?${QUERY_PROVIDER}=${encodeURIComponent(provider)}${force ? `&${QUERY_REFRESH}=1` : ''}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = readQuotaCard(await res.json() as unknown)
        // 形状不对按一次失败的刷新处理：走下面的 catch，保留已渲染的卡（错误以卡内提示浮出），
        // 绝不把半成品塞进 state——渲染期抛错会让这一条 slot 被宿主摘掉（浮窗从此打不开）。
        if (data === null) throw new Error('响应不是一份额度卡')
        return data
      })
      .then((data) => {
        if (token !== inFlight.current) return null
        cardRef.current = data
        setCard(data)
        setError(null)
        // 在取代检查之后报告：成功但无 gate 的响应（服务端拉取失败或 key 已消失）报告
        // `undefined` 并删掉条目。
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
