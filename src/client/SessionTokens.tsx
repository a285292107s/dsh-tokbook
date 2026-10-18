import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { SessionUsageView, UsageTotals } from '../types.ts'
import { QUERY_SESSION, ROUTE_SESSION } from '../route-paths.ts'
import { formatDateTime, formatDuration, formatMoney, formatShare, formatTokens } from './format.ts'
import { UsageGlyph } from './icons.tsx'
import { ledgerClockSupported, subscribeLedgerChanges } from './ledger-clock.ts'
import { SessionShell } from './SessionShell.tsx'
import { SubagentSection } from './session-subagents.tsx'
import { MixBand, TimeBar, TurnBlocks, TurnChart, type PreviewMap, type TurnPreview } from './SessionTurns.tsx'
import { readSessionView } from './session-wire.ts'

const POLL_MS = 15_000

const lastViews = new Map<string, SessionUsageView>()
const LAST_VIEWS_MAX = 8

function lastViewOf(sessionId: string | undefined): SessionUsageView | null {
  return sessionId === undefined ? null : lastViews.get(sessionId) ?? null
}

function rememberView(sessionId: string, view: SessionUsageView): void {
  lastViews.delete(sessionId)
  lastViews.set(sessionId, view)
  for (const oldest of lastViews.keys()) {
    if (lastViews.size <= LAST_VIEWS_MAX) break
    lastViews.delete(oldest)
  }
}

export interface SessionTokensProps {
  sessionId?: string
  useProjection?: <T>(key: string) => T | undefined
}

export function SessionTokens({ sessionId, useProjection }: SessionTokensProps) {
  const [loaded, setLoaded] = useState<{ sessionId: string; view: SessionUsageView } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const usable = typeof sessionId === 'string' && sessionId !== ''
  const view = loaded !== null && loaded.sessionId === sessionId ? loaded.view : lastViewOf(sessionId)

  useEffect(() => {
    if (!usable) return
    const target = sessionId
    const url = `${ROUTE_SESSION}?${QUERY_SESSION}=${encodeURIComponent(target)}`
    const controller = new AbortController()
    let latest = 0
    let pending = 0
    const load = (): void => {
      if (pending !== 0) return
      if (document.hidden) return
      const token = ++latest
      pending = token
      fetch(url, { signal: controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return res.json() as Promise<unknown>
        })
        .then((raw) => {
          if (controller.signal.aborted || token !== latest) return
          const next = readSessionView(raw)
          if (next === null) {
            setError('响应不是一份会话词元视图')
            return
          }
          setLoaded({ sessionId: target, view: next })
          rememberView(target, next)
          setError(null)
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted || token !== latest) return
          setError(err instanceof Error ? err.message : String(err))
        })
        .finally(() => {
          if (pending === token) pending = 0
        })
    }
    const onVisibility = (): void => { if (!document.hidden) load() }
    load()
    document.addEventListener('visibilitychange', onVisibility)
    const unsubscribe = subscribeLedgerChanges(() => { load() })
    const timer = setInterval(() => { if (!ledgerClockSupported()) load() }, POLL_MS)
    return () => {
      controller.abort()
      clearInterval(timer)
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [usable, sessionId, reload])

  const previews = indexPreviews(useProjection?.<readonly TurnPreview[]>('turnOutline'))

  if (!usable) {
    return (
      <SessionShell>
        <EmptyCard
          title="没有拿到会话标识"
          sub="这一页按会话读账本；宿主没有给出会话标识时，读不到任何东西。"
        />
      </SessionShell>
    )
  }
  return (
    <SessionShell>
      {error !== null && (
        <div className="dtpl-error" role="alert">
          <p className="dtpl-error-text">本会话词元加载失败：{error}</p>
          <button type="button" className="dtpl-retry" onClick={() => setReload((round) => round + 1)}>重试</button>
        </div>
      )}
      {view === null
        ? (error === null ? <div className="dtpl-sk dtpl-tok-sk" aria-hidden="true" /> : null)
        : isEmptyView(view)
          ? (
            <EmptyCard
              title="这个会话还没有入账的计费调用"
              sub="账本一行就是一次模型调用。先聊几句就会有记录；安装前的历史记录可以在侧栏的账本浮窗里点「重新扫描」补上。"
            />
          )
          : <Body view={view} previews={previews} />}
    </SessionShell>
  )
}

function EmptyCard({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="dtpl-empty">
      <UsageGlyph className="dtpl-empty-ico" />
      <p className="dtpl-empty-title">{title}</p>
      <p className="dtpl-empty-sub">{sub}</p>
    </div>
  )
}

type BlockStyle = CSSProperties & Record<'--dtpl-tok-i', number>

function Block({ i, children }: { i: number; children: ReactNode }) {
  return <div className="dtpl-tok-block" style={{ '--dtpl-tok-i': i } as BlockStyle}>{children}</div>
}

function SessionTiming({ workMs, spanMs, firstAt, lastAt }: { workMs: number; spanMs: number; firstAt: number; lastAt: number }) {
  const idleMs = spanMs - workMs
  return (
    <section aria-label="会话时间">
      <h2 className="dtpl-sec-title">会话时间</h2>
      <div className="dtpl-tok-timing">
        <div className="dtpl-tok-timing-grid">
          <div className="dtpl-stat" role="listitem">
            <span className="dtpl-stat-k">引擎工作</span>
            <span className="dtpl-stat-v">{formatDuration(workMs)}</span>
          </div>
          <div className="dtpl-stat" role="listitem">
            <span className="dtpl-stat-k">会话跨度</span>
            <span className="dtpl-stat-v">{formatDuration(spanMs)}</span>
          </div>
        </div>
        {idleMs > 0 && (
          <TimeBar
            tone="hero"
            scale={spanMs}
            reads={[
              { key: 'work', kind: 'work', label: '引擎工作', value: formatDuration(workMs) },
              { key: 'idle', kind: 'idle', label: '没在算', value: formatDuration(idleMs) },
            ]}
            segments={[
              { key: 'work', value: workMs, kind: 'work' },
              { key: 'idle', value: idleMs, kind: 'idle' },
            ]}
          />
        )}
        <span className="dtpl-hero-facts">
          <span className="dtpl-hero-fact">首记 <b>{recordTime(firstAt)}</b></span>
          <i aria-hidden="true">·</i>
          <span className="dtpl-hero-fact">末记 <b>{recordTime(lastAt)}</b></span>
        </span>
      </div>
    </section>
  )
}

function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const [current, setCurrent] = useState(0)
  const raf = useRef(0)
  useEffect(() => {
    if (!(value > 0)) {
      setCurrent(0)
      return
    }
    const start = performance.now()
    const from = current
    const tick = (now: number): void => {
      const progress = Math.min((now - start) / 1200, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCurrent(from + (value - from) * eased)
      if (progress < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [value])
  return <span>{format(current)}</span>
}

function Body({ view, previews }: { view: SessionUsageView; previews: PreviewMap }) {
  const tokens = view.totalTokens
  const todayShare = view.todaySpend > 0 ? formatShare(view.spend, view.todaySpend) : null
  return (
    <>
      <Block i={0}>
        <div className="dtpl-tok-head">
          <span className="dtpl-total-k">本会话四桶合计</span>
          <span className="dtpl-hero-figure">
            <span className="dtpl-total-num"><CountUp value={tokens} format={formatTokens} /></span>
          </span>
          <span className="dtpl-hero-facts">
            {todayShare !== null && (
              <>
                <span className="dtpl-hero-fact">本会话占今日消费 <b>{todayShare}</b></span>
                <i aria-hidden="true">·</i>
              </>
            )}
            <span className="dtpl-hero-fact">实际支出 <b>{formatMoney(view.spend)}</b></span>
            {view.subscriptionValue > 0 && (
              <>
                <i aria-hidden="true">·</i>
                <span className="dtpl-hero-fact">订阅价值 <b>{formatMoney(view.subscriptionValue)}</b></span>
              </>
            )}
            <i aria-hidden="true">·</i>
            <span className="dtpl-hero-fact">共 <b>{view.turns.length}</b> 轮 / <b>{countSteps(view)}</b> 步</span>
          </span>
          <MixBand totals={view.total} totalTokens={tokens} />
        </div>
      </Block>
      {view.subagents !== undefined && (
        <Block i={1}>
          <SubagentSection view={view.subagents} sessionTokens={tokens} />
        </Block>
      )}
      {view.workMs !== undefined && view.spanMs !== undefined && (
        <Block i={2}>
          <SessionTiming
            workMs={view.workMs}
            spanMs={view.spanMs}
            firstAt={view.firstAt}
            lastAt={view.lastAt}
          />
        </Block>
      )}
      <Block i={3}><TurnChart turns={view.turns} previews={previews} /></Block>
      <Block i={4}>
        <TurnBlocks
          turns={view.turns}
          betweenTurns={view.betweenTurns}
          unattributed={view.unattributed}
          previews={previews}
        />
      </Block>
      <Block i={5}><Footer total={view.total} unpriced={view.unpriced} timing={hasTiming(view)} /></Block>
    </>
  )
}

function Footer({ total, unpriced, timing }: { total: UsageTotals; unpriced: readonly string[]; timing: boolean }) {
  return (
    <div className="dtpl-tok-foot">
      <span className="dtpl-hero-facts">
        <span className="dtpl-hero-fact">用量未知 <b>{total.usageUnknown ?? 0}</b> 次</span>
        <i aria-hidden="true">·</i>
        <span className="dtpl-hero-fact">失败 <b>{total.failures ?? 0}</b> 次</span>
        <i aria-hidden="true">·</i>
        <span className="dtpl-hero-fact">价格未知 <b>{unpriced.length}</b> 个 (通道, 模型)</span>
      </span>
      {timing && (
        <p className="dtpl-tok-note">
          用时都来自会话日志的事件时刻（本机墙钟，不是计费时长）：一步的墙钟就是「模型 + 工具」
          两段，工具并行时取并集。没量到起止事件的步骤写「未计时」，不折算成 0。
        </p>
      )}
      {unpriced.length > 0 && (
        <p className="dtpl-tok-note">价格未知：{unpriced.join(' · ')}——这些行按 ¥0 计</p>
      )}
    </div>
  )
}

function recordTime(epochMs: number): string {
  return epochMs > 0 ? formatDateTime(epochMs) : '—'
}

function hasTiming(view: SessionUsageView): boolean {
  return view.workMs !== undefined || view.spanMs !== undefined
}

function countSteps(view: SessionUsageView): number {
  let steps = view.unattributed.length
  if (view.betweenTurns !== null) steps += view.betweenTurns.rows.length
  for (const group of view.turns) steps += group.rows.length
  return steps
}

function isEmptyView(view: SessionUsageView): boolean {
  return view.total.requests === 0
    && (view.total.failures ?? 0) === 0
    && view.turns.length === 0
    && view.betweenTurns === null
    && view.unattributed.length === 0
}

function indexPreviews(outline: readonly TurnPreview[] | undefined): PreviewMap {
  const previews = new Map<number, TurnPreview>()
  if (!Array.isArray(outline)) return previews
  for (const entry of outline) {
    if (typeof entry !== 'object' || entry === null) continue
    const { turn, prompt, response } = entry
    if (typeof turn !== 'number') continue
    previews.set(turn, {
      turn,
      prompt: typeof prompt === 'string' ? prompt : '',
      response: typeof response === 'string' ? response : '',
    })
  }
  return previews
}
