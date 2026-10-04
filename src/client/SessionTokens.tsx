/**
 * 词元 tab —— 对话视图环的第三个视图（标签「词元」），**单会话 · 全生命周期**的词元与钱。
 *
 * 数据只走一条来源：`GET /tokbook/session`（宿主按轮次/步骤分好组的账本）。本页不读会话投影里
 * 的任何用量读数——那些各有归属（见 docs/CONTEXT.md），投影只用来取轮次的文字预览。
 */

import { useEffect, useState } from 'react'
import type { SessionStepRow, SessionUsageGroup, SessionUsageView, UsageTotals } from '../types.ts'
import { QUERY_SESSION, ROUTE_SESSION } from '../route-paths.ts'
import { formatDateTime, formatMoney, formatRatio, formatShare, formatTokens } from './format.ts'
import { UsageGlyph } from './icons.tsx'
import { SessionShell } from './SessionShell.tsx'
import { MixSection, TurnBlocks, TurnChart, num, type PreviewMap, type TurnPreview } from './SessionTurns.tsx'

/** 轮询步长。这一页每拉一次，宿主都要全量读账本 + 读该会话日志做 join（实测 0.6–1.1s），
 *  所以步长取 15s：切进这一页本来就立刻拉一次，盯着的会话晚十几秒落屏可以接受，
 *  而 5s 会让宿主拿约 1/5 的时间服务同一份数据。 */
const POLL_MS = 15_000

export interface SessionTokensProps {
  /** 会话标识（session 作用域 slot 由宿主解析后注入；`inject` 也回同一份）。 */
  sessionId?: string
  /** 会话投影读取面：只用来取轮次预览。缺席（非宿主渲染方）时预览整块不出。 */
  useProjection?: <T>(key: string) => T | undefined
}

export function SessionTokens({ sessionId, useProjection }: SessionTokensProps) {
  const [view, setView] = useState<SessionUsageView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const usable = typeof sessionId === 'string' && sessionId !== ''

  useEffect(() => {
    if (!usable) return
    const url = `${ROUTE_SESSION}?${QUERY_SESSION}=${encodeURIComponent(sessionId)}`
    // 卸载 / 换会话 / 手动重试都中止在飞的那一次：这条路由每拉一次宿主都要全量读账本 +
    // 读该会话日志做 join（0.6–1.1s），让它为一份已经没人看的数据跑完没有意义。
    const controller = new AbortController()
    /** 单调请求号：只有最新一次响应的结果允许落屏。 */
    let latest = 0
    /** 在飞的那一次请求号（0 = 没有在飞）。一次可能比 15s 步长还慢，所以一轮在飞时跳过该 tick。 */
    let pending = 0
    // 失败**不清屏**：宿主抖动或一次 404 不该把已经读到的那份账本换成一页空白。
    const load = (): void => {
      if (pending !== 0) return
      // 页面在后台时整个不发：没人在看这份读数，而它对宿主很重。
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
          const next = readView(raw)
          if (next === null) {
            setError('响应不是一份会话词元视图')
            return
          }
          setView(next)
          setError(null)
        })
        .catch((err: unknown) => {
          // 被中止（关页 / 换会话 / 重试）不是一次失败，也不该由一个陈旧的响应落屏。
          if (controller.signal.aborted || token !== latest) return
          setError(err instanceof Error ? err.message : String(err))
        })
        .finally(() => {
          if (pending === token) pending = 0
        })
    }
    // 回到可见补一次：隐藏期间跳过的那个 tick 不能等下下个 15s。
    const onVisibility = (): void => { if (!document.hidden) load() }
    load()
    const timer = setInterval(load, POLL_MS)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      controller.abort()
      clearInterval(timer)
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

/** 抬头 + 三个节 + 脚注；顺序就是版面顺序。 */
function Body({ view, previews }: { view: SessionUsageView; previews: PreviewMap }) {
  const tokens = view.totalTokens
  const billedInput = view.total.inputTokens + view.total.cacheReadTokens + view.total.cacheWriteTokens
  const hitRate = formatRatio(view.total.cacheReadTokens, billedInput)
  // 今日消费为 0 时这一行整句不出：0 做分母的百分比只是一句噪音。
  const todayShare = view.todaySpend > 0 ? formatShare(view.spend, view.todaySpend) : null
  return (
    <>
      <div className="dtpl-tok-head">
        <span className="dtpl-hero-head"><span className="dtpl-total-k">本会话四桶合计</span></span>
        <span className="dtpl-hero-figure"><span className="dtpl-total-num">{formatTokens(tokens)}</span></span>
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
          <span className="dtpl-hero-fact">缓存命中率 <b>{hitRate === null ? '—' : `${hitRate}%`}</b></span>
          <i aria-hidden="true">·</i>
          <span className="dtpl-hero-fact">共 <b>{view.turns.length}</b> 轮 / <b>{countSteps(view)}</b> 步</span>
          <i aria-hidden="true">·</i>
          <span className="dtpl-hero-fact">首记 <b>{recordTime(view.firstAt)}</b></span>
          <i aria-hidden="true">·</i>
          <span className="dtpl-hero-fact">末记 <b>{recordTime(view.lastAt)}</b></span>
        </span>
      </div>
      <MixSection totals={view.total} totalTokens={tokens} />
      <TurnChart turns={view.turns} />
      <TurnBlocks
        turns={view.turns}
        betweenTurns={view.betweenTurns}
        unattributed={view.unattributed}
        previews={previews}
      />
      <Footer total={view.total} unpriced={view.unpriced} />
    </>
  )
}

/**
 * 脚注：这一页的三种降级事实。它们是**读法**不是错误——账本照记，只是这几个数说不全
 * （口径见 docs/CONTRACTS.md §2），所以走中性墨色、不借状态色。
 */
function Footer({ total, unpriced }: { total: UsageTotals; unpriced: readonly string[] }) {
  return (
    <div className="dtpl-tok-foot">
      <span className="dtpl-hero-facts">
        <span className="dtpl-hero-fact">用量未知 <b>{total.usageUnknown ?? 0}</b> 次</span>
        <i aria-hidden="true">·</i>
        <span className="dtpl-hero-fact">失败 <b>{total.failures ?? 0}</b> 次</span>
        <i aria-hidden="true">·</i>
        <span className="dtpl-hero-fact">未定价 <b>{unpriced.length}</b> 个 (通道, 模型)</span>
      </span>
      {unpriced.length > 0 && (
        <p className="dtpl-tok-note">未定价：{unpriced.join(' · ')}——这些行按 ¥0 计</p>
      )}
    </div>
  )
}

function recordTime(epochMs: number): string {
  return epochMs > 0 ? formatDateTime(epochMs) : '—'
}

/** 步数从载荷自己数：一轮的行数 + 轮间 + 轮次未知（一行就是一次计费调用）。 */
function countSteps(view: SessionUsageView): number {
  let steps = view.unattributed.length
  if (view.betweenTurns !== null) steps += view.betweenTurns.rows.length
  for (const group of view.turns) steps += group.rows.length
  return steps
}

/** 一条账本行都没有：不是「0 词元」，是这一页无话可说。 */
function isEmptyView(view: SessionUsageView): boolean {
  return view.total.requests === 0
    && (view.total.failures ?? 0) === 0
    && view.turns.length === 0
    && view.betweenTurns === null
    && view.unattributed.length === 0
}

/**
 * 投影里的轮次条目按轮次号建索引。投影缺席、不是数组、条目缺字段都只让**预览**少一行，
 * 数字部分照常——预览是补充，不是这一页的读数。
 */
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

function readView(raw: unknown): SessionUsageView | null {
  if (typeof raw !== 'object' || raw === null) return null
  const source = raw as Partial<SessionUsageView>
  return {
    sessionId: typeof source.sessionId === 'string' ? source.sessionId : '',
    updatedAt: num(source.updatedAt),
    firstAt: num(source.firstAt),
    lastAt: num(source.lastAt),
    total: readTotals(source.total),
    totalTokens: num(source.totalTokens),
    spend: num(source.spend),
    subscriptionValue: num(source.subscriptionValue),
    unpriced: Array.isArray(source.unpriced)
      ? source.unpriced.filter((key): key is string => typeof key === 'string')
      : [],
    turns: readGroups(source.turns).filter((group) => group.turn !== null),
    betweenTurns: readGroup(source.betweenTurns),
    unattributed: readRows(source.unattributed),
    todaySpend: num(source.todaySpend),
  }
}

function readTotals(raw: unknown): UsageTotals {
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<UsageTotals>
  return {
    requests: num(source.requests),
    inputTokens: num(source.inputTokens),
    outputTokens: num(source.outputTokens),
    cacheReadTokens: num(source.cacheReadTokens),
    cacheWriteTokens: num(source.cacheWriteTokens),
    compactions: num(source.compactions),
    failures: num(source.failures),
    usageUnknown: num(source.usageUnknown),
  }
}

function readGroups(raw: unknown): SessionUsageGroup[] {
  if (!Array.isArray(raw)) return []
  const groups: SessionUsageGroup[] = []
  for (const item of raw) {
    const group = readGroup(item)
    if (group !== null) groups.push(group)
  }
  return groups
}

function readGroup(raw: unknown): SessionUsageGroup | null {
  if (typeof raw !== 'object' || raw === null) return null
  const source = raw as Partial<SessionUsageGroup>
  return {
    turn: typeof source.turn === 'number' ? source.turn : null,
    totals: readTotals(source.totals),
    tokens: num(source.tokens),
    spend: num(source.spend),
    subscriptionValue: num(source.subscriptionValue),
    rows: readRows(source.rows),
  }
}

/**
 * 一行账本。**只认 requestId 是字符串**的那一半（它是去重键、也是 React 的 key）；其余字段
 * 缺一个就填一个中性值，让渲染层不必到处判 undefined。`usage` 保留原样——它缺席本身就是
 * 「用量未知」这件事（口径见 docs/CONTRACTS.md §2）。
 */
function readRows(raw: unknown): SessionStepRow[] {
  if (!Array.isArray(raw)) return []
  const rows: SessionStepRow[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const source = item as Partial<SessionStepRow>
    if (typeof source.requestId !== 'string') continue
    const bucket = source.bucket === 'subscription' || source.bucket === 'unpriced' ? source.bucket : 'spend'
    rows.push({
      requestId: source.requestId,
      time: num(source.time),
      model: typeof source.model === 'string' ? source.model : '',
      provider: typeof source.provider === 'string' ? source.provider : '',
      kind: source.kind,
      failureCode: source.failureCode,
      usage: source.usage,
      tokens: num(source.tokens),
      step: typeof source.step === 'number' ? source.step : undefined,
      bucket,
      cost: num(source.cost),
    })
  }
  return rows
}
