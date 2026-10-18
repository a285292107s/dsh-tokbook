import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { QuotaCard, QuotaGate, QuotaView } from '../../types.ts'
import { QUERY_PROVIDER, QUERY_REFRESH, ROUTE_QUOTA } from '../../route-paths.ts'
import { orderQuotaProviders } from '../../quota.ts'
import { UsageGlyph } from '../icons.tsx'
import { QuotaCardView } from './QuotaCard.tsx'

const AUTO_PRESETS: ReadonlyArray<{ min: number; label: string }> = [
  { min: 0, label: '关闭' },
  { min: 1, label: '1 分' },
  { min: 5, label: '5 分' },
  { min: 15, label: '15 分' },
  { min: 30, label: '30 分' },
]

const DEFAULT_AUTO_MIN = 5

const AUTO_MIN_KEY = 'dsh-tokbook.quota-auto-min'

function readAutoMinutes(): number {
  try {
    const saved = localStorage.getItem(AUTO_MIN_KEY)
    if (saved === null) return DEFAULT_AUTO_MIN
    const min = Number(saved)
    return AUTO_PRESETS.some((preset) => preset.min === min) ? min : DEFAULT_AUTO_MIN
  } catch {
    return DEFAULT_AUTO_MIN
  }
}

function readProviderList(raw: unknown): string[] | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { providers } = raw as Partial<QuotaView>
  if (!Array.isArray(providers) || !providers.every((item): item is string => typeof item === 'string')) return null
  return providers
}

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

const QUOTA_FRESH_MS = 60_000

const QUOTA_REFRESH_COOLDOWN_MS = 30_000

export function QuotaPanel() {
  const [providers, setProviders] = useState<readonly string[] | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [autoMinutes, setAutoMinutes] = useState(readAutoMinutes)
  const [autoTicker, setAutoTicker] = useState(0)
  const [gates, setGates] = useState<Readonly<Record<string, QuotaGate>>>({})

  const reportGate = useCallback((provider: string, gate: QuotaGate | undefined) => {
    setGates((prev) => {
      if (prev[provider] === gate) return prev
      const next = { ...prev }
      if (gate === undefined) delete next[provider]
      else next[provider] = gate
      return next
    })
  }, [])

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

  useEffect(() => {
    if (autoMinutes <= 0) return
    const timer = setInterval(() => {
      setAutoTicker((t) => t + 1)
    }, autoMinutes * 60_000)
    return () => clearInterval(timer)
  }, [autoMinutes])

  const chooseAutoMinutes = useCallback((min: number) => {
    setAutoMinutes(min)
    try {
      localStorage.setItem(AUTO_MIN_KEY, String(min))
    } catch {
    }
  }, [])

  const hasProviders = providers !== null && providers.length > 0
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

function QuotaCardController({ provider, autoTicker, onGate }: {
  provider: string
  autoTicker: number
  onGate: (provider: string, gate: QuotaGate | undefined) => void
}) {
  const [card, setCard] = useState<QuotaCard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const inFlight = useRef(0)
  const lastRefreshAt = useRef(0)
  const cardRef = useRef<QuotaCard | null>(null)

  const fetchCard = useCallback((force: boolean): Promise<QuotaCard | null> => {
    const token = ++inFlight.current
    setLoading(true)
    setError(null)
    return fetch(`${ROUTE_QUOTA}?${QUERY_PROVIDER}=${encodeURIComponent(provider)}${force ? `&${QUERY_REFRESH}=1` : ''}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = readQuotaCard(await res.json() as unknown)
        if (data === null) throw new Error('响应不是一份额度卡')
        return data
      })
      .then((data) => {
        if (token !== inFlight.current) return null
        cardRef.current = data
        setCard(data)
        setError(null)
        onGate(provider, data.gate)
        return data
      })
      .catch((err: unknown) => {
        if (token !== inFlight.current) return null
        setError(err instanceof Error ? err.message : String(err))
        return null
      })
      .finally(() => {
        if (token === inFlight.current) setLoading(false)
      })
  }, [provider, onGate])

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
