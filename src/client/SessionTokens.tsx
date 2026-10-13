/**
 * 词元 tab —— 对话视图环的第三个视图（标签「词元」），**单会话 · 全生命周期**的词元与钱。
 *
 * 数据只走一条来源：`GET /tokbook/session`（宿主按轮次/步骤分好组的账本）。本页不读会话投影里
 * 的任何用量读数——那些各有归属（见 docs/CONTEXT.md），投影只用来取轮次的文字预览。
 */

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { SessionUsageView, UsageTotals } from '../types.ts'
import { QUERY_SESSION, ROUTE_SESSION } from '../route-paths.ts'
import { formatDateTime, formatDuration, formatMoney, formatShare, formatTokens } from './format.ts'
import { UsageGlyph } from './icons.tsx'
import { SessionShell } from './SessionShell.tsx'
import { MixBand, TimeBar, TurnBlocks, TurnChart, num, type PreviewMap, type TurnPreview } from './SessionTurns.tsx'
import { readSessionView } from './session-wire.ts'

/** 轮询步长。这一页每拉一次，宿主都要读账本并把该会话日志整份读来 join——成本随
 *  该会话日志长度增长（本机小会话实测约 0.1s），所以步长取 15s：切进这一页本来就
 *  立刻拉一次，盯着的会话晚十几秒落屏可以接受，而 5s 只会让同一份数据三倍频地做。 */
const POLL_MS = 15_000

/**
 * 上一次读到的视图，按会话留着最近几份。宿主只渲染**活动**的那个视图，所以切走再
 * 切回是整块重挂载；没有这份缓存时每次都要从骨架屏开始等一次宿主（那一趟要读账本
 * 加该会话日志的 join）。留着旧数只为**先画出来**，后台那次拉取照常把它换成新的。
 *
 * 上界按条数给：一份视图随会话长度可达数千行，不设界会在长时间开着的页里越攒越大。
 */
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
  /** 会话标识（session 作用域 slot 由宿主解析后注入；`inject` 也回同一份）。 */
  sessionId?: string
  /** 会话投影读取面：只用来取轮次预览。缺席（非宿主渲染方）时预览整块不出。 */
  useProjection?: <T>(key: string) => T | undefined
}

export function SessionTokens({ sessionId, useProjection }: SessionTokensProps) {
  /** 最近一次**这次挂载**读到的视图；它属于哪个会话一并记下，换会话即作废。 */
  const [loaded, setLoaded] = useState<{ sessionId: string; view: SessionUsageView } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const usable = typeof sessionId === 'string' && sessionId !== ''
  // 没有本次挂载的读数时先画上一次读到的那份（见 `lastViews`）；两者都没有才是骨架屏。
  const view = loaded !== null && loaded.sessionId === sessionId ? loaded.view : lastViewOf(sessionId)

  useEffect(() => {
    if (!usable) return
    // `usable` 已把 sessionId 收窄成非空串；取出来给下面的续体用（响应回来时 props 可能已变）。
    const target = sessionId
    const url = `${ROUTE_SESSION}?${QUERY_SESSION}=${encodeURIComponent(target)}`
    // 卸载 / 换会话 / 手动重试都中止在飞的那一次：这条路由每拉一次宿主都要读账本 +
    // 把该会话日志整份读来做 join，让它为一份已经没人看的数据跑完没有意义。
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

/** 一页读数里只能挂在 style 上的自定义属性（React 的 CSSProperties 不收 `--*`）。 */
type BlockStyle = CSSProperties & Record<'--dtpl-tok-i', number>

/**
 * 版面上的一层：入场时依次升起，错开半拍（配方的节奏写在 styles/session.ts 的 `.dtpl-tok-col > *`）。
 * 序号在这里给，不去改每一块的根——它们各有自己的 class 与语义。
 */
function Block({ i, children }: { i: number; children: ReactNode }) {
  return <div className="dtpl-tok-block" style={{ '--dtpl-tok-i': i } as BlockStyle}>{children}</div>
}

/**
 * 会话时间：引擎工作 / 会话跨度 / 首记 / 末记，外加那条比值尺。
 *
 * 与「四桶合计」那块**必须分开**：用量块问的是「算了多少钱」，这四个数问的是「时间花在哪、
 * 花了多久」——两种问句并进一串读数，读者会把 3 小时的引擎工作读成第三桶的份额。
 * 而且比值尺只在两个时长并排时才成立：它上面那串事实一变，它就没着落了。
 *
 * 缺时间数据时整块不出（老会话 / 宿主没接上计时时长），与本页其余口径一致。
 */
function SessionTiming({ workMs, spanMs, firstAt, lastAt }: { workMs: number; spanMs: number; firstAt: number; lastAt: number }) {
  return (
    <section aria-label="会话时间">
      <h2 className="dtpl-sec-title">会话时间</h2>
      <div className="dtpl-tok-timing">
        {/* 引擎工作与会话跨度是这一块的主角，升成与「词元构成」同一套读数格（标签在上、
            大号等宽数字在下）：这两个数必须**并排**——单看哪个都不说明问题，差额才是
            这一页要说的事——没在算的那些时间（等输入、等外部、会话挂起）。 */}
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
        {/* 「引擎工作」与「会话跨度」那条比值，画出来才成立：14 小时的跨度里只有 5 分钟在算，
            这两个数看不出来，一根 0.7% 宽的实心条一眼就是。条**没有**第三个数要报——它只是
            那两个数之间的关系，所以它自己不配标签，读屏走上面那两个读数格。
            所以 `scale` 就给跨度本身：分母正是它，两段之和占满整条。 */}
        {spanMs > workMs && (
          <span className="dtpl-tok-hero-bar">
            <TimeBar
              tone="hero"
              scale={spanMs}
              segments={[
                { key: 'work', value: workMs, kind: 'work' },
                { key: 'idle', value: spanMs - workMs, kind: 'idle' },
              ]}
            />
          </span>
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

/** 抬头（含构成的分解）+ 三个节 + 脚注；顺序就是版面顺序。 */
/**
 * 主角数字的**入场计数**：从 0 数到它的值。
 *
 * 只在**首次挂载**播一次（切会话整页重挂，正好重播；15s 轮询刷新不重挂，不会反复数）。
 * 不是装饰——它让读者的注意力先落在「这个数在长」而不是「这个数是 1.5M」，
 * 长完那一瞬的定格比静止的数字多一层「这数有分量」的质感。
 * 缓动用 ease-out：开头快、末尾减速，像仪表的指针弹到读数，而不是匀速扫。
 */
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
  // 今日消费为 0 时这一行整句不出：0 做分母的百分比只是一句噪音。
  const todayShare = view.todaySpend > 0 ? formatShare(view.spend, view.todaySpend) : null
  return (
    <>
      {/* 抬头面板 = 合计 + 它的分解，一块框装一件事。原先「词元构成」是下面的另一个区块：
          抬头报「四桶合计 1.5M」，紧接着一条分区词 + 32px 块间距宣布换话题，然后才给出
          加起来正好是那个数的四桶——标签许下的承诺被版面拆掉了，读者要在两块之间自己接。
          浮窗那张「今日词元」卡早就是同一配方（合计 → 一条分区线 → 它拆出来的四桶），
          这一页没有理由例外。构成带自己不出框（见 MixBand）。 */}
      <Block i={0}>
        <div className="dtpl-tok-head">
          <span className="dtpl-total-k">本会话四桶合计</span>
          <span className="dtpl-hero-figure">
            <span className="dtpl-total-num"><CountUp value={tokens} format={formatTokens} /></span>
          </span>
          {/* 参照带：与合计同单位的钱、以及这次会话的规模。缓存命中率不在这里——它是
              「构成的读法」，跟着构成那一块走（见 MixBand）。 */}
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
      {/* 会话时间单列一块：用量块问「算了多少钱」，这四个数问「时间花在哪、花了多久」——
          两种问句并进一串读数，3 小时的引擎工作会被读成第三桶的份额。缺时间数据时整块不出。 */}
      {view.workMs !== undefined && view.spanMs !== undefined && (
        <Block i={1}>
          <SessionTiming
            workMs={view.workMs}
            spanMs={view.spanMs}
            firstAt={view.firstAt}
            lastAt={view.lastAt}
          />
        </Block>
      )}
      <Block i={2}><TurnChart turns={view.turns} previews={previews} /></Block>
      <Block i={3}>
        <TurnBlocks
          turns={view.turns}
          betweenTurns={view.betweenTurns}
          unattributed={view.unattributed}
          previews={previews}
        />
      </Block>
      <Block i={4}><Footer total={view.total} unpriced={view.unpriced} timing={hasTiming(view)} /></Block>
    </>
  )
}

/**
 * 脚注：这一页的三种降级事实。它们是**读法**不是错误——账本照记，只是这几个数说不全
 * （口径见 docs/CONTRACTS.md §2），所以走中性墨色、不借状态色。
 */
function Footer({ total, unpriced, timing }: { total: UsageTotals; unpriced: readonly string[]; timing: boolean }) {
  return (
    <div className="dtpl-tok-foot">
      <span className="dtpl-hero-facts">
        <span className="dtpl-hero-fact">用量未知 <b>{total.usageUnknown ?? 0}</b> 次</span>
        <i aria-hidden="true">·</i>
        <span className="dtpl-hero-fact">失败 <b>{total.failures ?? 0}</b> 次</span>
        <i aria-hidden="true">·</i>
        <span className="dtpl-hero-fact">未定价 <b>{unpriced.length}</b> 个 (通道, 模型)</span>
      </span>
      {timing && (
        <p className="dtpl-tok-note">
          用时都来自会话日志的事件时刻（本机墙钟，不是计费时长）：一步的墙钟就是「模型 + 工具」
          两段，工具并行时取并集。没量到起止事件的步骤写「未计时」，不折算成 0。
        </p>
      )}
      {unpriced.length > 0 && (
        <p className="dtpl-tok-note">未定价：{unpriced.join(' · ')}——这些行按 ¥0 计</p>
      )}
    </div>
  )
}

function recordTime(epochMs: number): string {
  return epochMs > 0 ? formatDateTime(epochMs) : '—'
}

/** 这一页有没有可比的时间读数。一行都没量到时，脚注里那条口径说明只是噪音。 */
function hasTiming(view: SessionUsageView): boolean {
  return view.workMs !== undefined || view.spanMs !== undefined
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
