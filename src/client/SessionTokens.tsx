import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { settleTiming } from '../types.ts'
import type { SessionStepRow, SessionUsageView, UsageTotals } from '../types.ts'
import { QUERY_SESSION, ROUTE_SESSION } from '../route-paths.ts'
import { formatDateTime, formatDuration, formatMoney, formatShare, formatTokens } from './format.ts'
import { UsageGlyph } from './icons.tsx'
import { ledgerClockSupported, subscribeLedgerChanges } from './ledger-clock.ts'
import { SubagentSection } from './session-subagents.tsx'
import { MixBand, TurnBlocks, type PreviewMap, type TurnPreview } from './SessionTurns.tsx'
import { PHASE_LABEL, TimeBar, sumSegments } from './session-timing.tsx'
import { BUCKETS } from './session-shared.ts'
import { num, readSessionView } from './session-wire.ts'

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
  sessionId: string
  useProjection?: <T>(key: string) => T | undefined
}

export function SessionTokens({ sessionId, useProjection }: SessionTokensProps) {
  const [loaded, setLoaded] = useState<{ sessionId: string; view: SessionUsageView } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const view = loaded !== null && loaded.sessionId === sessionId ? loaded.view : lastViewOf(sessionId)

  useEffect(() => {
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
  }, [sessionId, reload])

  const previews = indexPreviews(useProjection?.<readonly TurnPreview[]>('turnOutline'))

  return (
    <div className="dtpl-tok" data-plugin="dsh-tokbook">
      <div className="dtpl-tok-scroll">
        <div className="dtpl-tok-col">
          {error !== null && (
            <div className="dtpl-tok-error" role="alert">
              <p className="dtpl-tok-error-text">本会话词元加载失败：{error}</p>
              <button type="button" className="dtpl-tok-retry" onClick={() => setReload((round) => round + 1)}>重试</button>
            </div>
          )}
          {view === null
            ? (error === null ? <div className="dtpl-tok-sk" aria-hidden="true" /> : null)
            : isEmptyView(view)
              ? (
                <EmptyCard
                  title="这个会话还没有入账的计费调用"
                  sub="账本一行就是一次模型调用。先聊几句就会有记录；安装前的历史记录到侧栏的「词元账本」页里点「重新扫描」补上。"
                />
              )
              : <Body view={view} previews={previews} />}
        </div>
      </div>
    </div>
  )
}

function EmptyCard({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="dtpl-tok-empty">
      <UsageGlyph className="dtpl-tok-empty-ico" />
      <p className="dtpl-tok-empty-title">{title}</p>
      <p className="dtpl-tok-empty-sub">{sub}</p>
    </div>
  )
}

type BlockStyle = CSSProperties & Record<'--dtpl-tok-i', number>

function Block({ i, children }: { i: number; children: ReactNode }) {
  return <div className="dtpl-tok-block" style={{ '--dtpl-tok-i': i } as BlockStyle}>{children}</div>
}

function toolWord(name: string): string {
  return name === '' ? '未具名工具' : name
}

function spanAside(view: SessionUsageView): string | null {
  const first = recordTime(view.firstAt)
  const last = recordTime(view.lastAt)
  return first === '—' && last === '—' ? null : `${first} → ${last}`
}

type TimingExtreme = { key: string; label: string; where: string; figure: string }

function timingExtremes(groups: readonly { label: string; rows: readonly SessionStepRow[] }[]): {
  extremes: readonly TimingExtreme[]
  untimed: number
} {
  let untimed = 0
  let toolCalls = 0
  let slowest: { where: string; ms: number } | null = null
  let slowTool: { where: string; ms: number } | null = null
  let busiest: { where: string; steps: number } | null = null
  for (const group of groups) {
    if (group.rows.length > 0 && (busiest === null || group.rows.length > busiest.steps)) {
      busiest = { where: group.label, steps: group.rows.length }
    }
    for (const row of group.rows) {
      const timing = row.timing
      if (timing === undefined) {
        untimed += 1
        continue
      }
      toolCalls += timing.toolCalls ?? 0
      const at = row.step === undefined ? group.label : `${group.label} 第 ${String(row.step)} 步`
      if (timing.wallMs !== undefined && (slowest === null || timing.wallMs > slowest.ms)) {
        slowest = { where: at, ms: timing.wallMs }
      }
      const slow = timing.slowTool
      if (slow !== undefined && (slowTool === null || slow.ms > slowTool.ms)) {
        slowTool = { where: toolWord(slow.name), ms: slow.ms }
      }
      if (timing.llmMs === undefined) untimed += 1
    }
  }
  const extremes: TimingExtreme[] = []
  if (slowest !== null) {
    extremes.push({ key: 'slowest', label: '最慢一步', where: slowest.where, figure: formatDuration(slowest.ms) })
  }
  if (slowTool !== null) {
    extremes.push({ key: 'slowtool', label: '最慢工具', where: slowTool.where, figure: formatDuration(slowTool.ms) })
  }
  if (busiest !== null) {
    extremes.push({ key: 'busiest', label: '最忙一轮', where: busiest.where, figure: `${String(busiest.steps)} 步` })
  }
  if (toolCalls > 0) extremes.push({ key: 'calls', label: '工具调用', where: '', figure: `${String(toolCalls)} 次` })
  return { extremes, untimed }
}

function SessionTiming({ view }: { view: SessionUsageView }) {
  const workMs = view.workMs!
  const spanMs = view.spanMs!
  const idleMs = spanMs - workMs
  const groups: { label: string; rows: readonly SessionStepRow[] }[] = view.turns.map((group) => ({
    label: `第 ${String(group.turn)} 轮`, rows: group.rows,
  }))
  if (view.betweenTurns !== null) groups.push({ label: '轮间', rows: view.betweenTurns.rows })
  if (view.unattributed.length > 0) groups.push({ label: '轮次未知', rows: view.unattributed })
  const segments = sumSegments(groups.flatMap((group) => [...group.rows]))
  const { extremes, untimed } = timingExtremes(groups)
  const aside = spanAside(view)
  const ledger = workMs > 0 && idleMs >= 0
    ? `会话跨度 ${formatDuration(spanMs)} = 引擎工作 ${formatDuration(workMs)} + 没在算 ${formatDuration(idleMs)}`
    : `会话跨度 ${formatDuration(spanMs)}｜引擎工作 ${untimed > 0 ? `${String(untimed)} 步未计时，无法合计` : '没有量到用时'}`
  return (
    <section className="dtpl-tok-sec" aria-label="会话用时">
      <div className="dtpl-tok-sec-h">
        <h2 className="dtpl-tok-sec-k">会话用时</h2>
        {aside !== null && <span className="dtpl-tok-sec-aside">{aside}</span>}
      </div>
      <p className="dtpl-tok-time-k">引擎工作</p>
      <div className="dtpl-tok-time-lead">
        <span className="dtpl-tok-time-num">{formatDuration(workMs)}</span>
        <span className="dtpl-tok-time-pct">占会话跨度 {formatShare(workMs, spanMs)} · 共 {view.turns.length} 轮 / {countSteps(view)} 步</span>
      </div>
      {segments.length > 0
        ? (
          <div className="dtpl-tok-time-track">
            <TimeBar
              tone="hero"
              scale={workMs}
              segments={segments}
              reads={segments.map((segment) => ({
                key: segment.key,
                kind: segment.kind,
                label: PHASE_LABEL[segment.kind],
                value: formatDuration(segment.value),
              }))}
            />
          </div>
        )
        : <p className="dtpl-tok-time-gap">拆不开：这个会话没有量到模型与工具的起止事件。</p>}
      <p className="dtpl-tok-time-eq">{ledger}</p>
      {extremes.length > 0 && (
        <div className="dtpl-tok-time-marks">
          {extremes.map((extreme) => (
            <span className="dtpl-tok-time-mark" key={extreme.key}>
              {extreme.label}
              {extreme.where !== '' && <span className="dtpl-tok-time-where">{extreme.where}</span>}
              <b>{extreme.figure}</b>
            </span>
          ))}
        </div>
      )}
      {untimed > 0 && (
        <p className="dtpl-tok-time-gap">
          还有 <b>{String(untimed)}</b> 步量不到起止事件{segments.length > 0 ? '，上面那条构成尺不含它们' : ''}。
        </p>
      )}
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

function Hero({ view }: { view: SessionUsageView }) {
  const todayShare = view.todaySpend > 0 ? formatShare(view.spend, view.todaySpend) : null
  const parts = BUCKETS.map((bucket) => `${bucket.label} ${formatTokens(num(view.total[bucket.key]))}`)
  return (
    <section className="dtpl-tok-sec" aria-label="本会话词元与花费">
      <div className="dtpl-tok-sec-h">
        <h2 className="dtpl-tok-sec-k">词元与花费</h2>
      </div>
      <div className="dtpl-tok-hero">
        <div className="dtpl-tok-hero-row">
          <div className="dtpl-tok-hero-lead">
            <span className="dtpl-tok-hero-num"><CountUp value={view.totalTokens} format={formatTokens} /></span>
            <span className="dtpl-tok-hero-sub">{parts.join(' · ')}</span>
          </div>
          <div className="dtpl-tok-hero-facts">
            <div className="dtpl-tok-hero-fact">
              <span className="dtpl-tok-hero-fact-k">实际支出</span>
              <span className="dtpl-tok-hero-fact-v">{formatMoney(view.spend)}</span>
            </div>
            <div className="dtpl-tok-hero-fact">
              <span className="dtpl-tok-hero-fact-k">订阅价值</span>
              <span className="dtpl-tok-hero-fact-v">{formatMoney(view.subscriptionValue)}</span>
            </div>
            {todayShare !== null && (
              <div className="dtpl-tok-hero-fact">
                <span className="dtpl-tok-hero-fact-k">占今日消费</span>
                <span className="dtpl-tok-hero-fact-v">{todayShare}</span>
              </div>
            )}
          </div>
        </div>
        <MixBand totals={view.total} totalTokens={view.totalTokens} />
      </div>
    </section>
  )
}

function Body({ view, previews }: { view: SessionUsageView; previews: PreviewMap }) {
  return (
    <>
      {view.workMs !== undefined && view.spanMs !== undefined && (
        <Block i={0}><SessionTiming view={view} /></Block>
      )}
      <Block i={1}><Hero view={view} /></Block>
      <Block i={2}>
        <TurnBlocks
          turns={view.turns}
          betweenTurns={view.betweenTurns}
          unattributed={view.unattributed}
          previews={previews}
          providerLabels={view.providerLabels}
        />
      </Block>
      {view.subagents !== undefined && (
        <Block i={3}>
          <SubagentSection view={view.subagents} sessionTokens={view.totalTokens} />
        </Block>
      )}
      <Block i={4}><Foot total={view.total} unpriced={view.unpriced} timing={hasTiming(view)} /></Block>
    </>
  )
}

function Foot({ total, unpriced, timing }: { total: UsageTotals; unpriced: readonly string[]; timing: boolean }) {
  return (
    <footer className="dtpl-tok-foot">
      <p className="dtpl-tok-foot-facts">
        <span>用量未知 <b>{total.usageUnknown ?? 0}</b> 次</span>
        <span>失败 <b>{total.failures ?? 0}</b> 次</span>
        <span>价格未知 <b>{unpriced.length}</b> 个 (通道, 模型)</span>
      </p>
      {timing && (
        <p className="dtpl-tok-note">
          用时都来自会话日志的事件时刻（本机墙钟，不是计费时长）：一步的墙钟就是「模型 + 工具」
          两段，工具并行时取并集。没量到起止事件的步骤写「未计时」，不折算成 0。
        </p>
      )}
      {unpriced.length > 0 && (
        <p className="dtpl-tok-note">价格未知：{unpriced.join(' · ')}——这些行按 ¥0 计</p>
      )}
    </footer>
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
