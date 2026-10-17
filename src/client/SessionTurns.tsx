/**
 * 会话词元页的**公共 API 面**（barrel）。
 *
 * 这一页原本是一整块 1028 行的文件，混着四样东西：图表（TurnChart + 悬停卡片）、
 * 明细表（TurnBlocks + 折叠块 + 步骤行）、用时分段语言（TimeBar + stepSegments）、
 * 以及图例形状常数。按关注点拆成了 `session-timing` / `session-chart` / `session-detail`
 * 三个文件，本文件只做两件事：
 *   1. 保留 `SessionTokens` 需要的那一份导入面，让调用方不用知道它们分在几个文件里；
 *   2. 留下 `MixBand`——SessionTokens 直接渲染的「词元构成」视图。
 *
 * 拆分的取舍：不拆的话这一页的**第一个交互**（柱子悬停卡片）与**最后一条明细行**的
 * 用时表共用同一份分母算式，而它们的生命周期完全不同——卡片的定位逻辑只在挂载时跑一次，
 * 用时表的列集合按整块算一次。拆开之后各改各的，不会互相牵制。
 */

export { type PreviewMap, type TurnPreview } from './session-shared.ts'
export { TimeBar } from './session-timing.tsx'
export { TurnChart } from './session-chart.tsx'
export { TurnBlocks } from './session-detail.tsx'

import { formatRatio, formatShare, formatTokens } from './format.ts'
import { num } from './session-wire.ts'
import { BUCKETS } from './session-shared.ts'
import type { UsageTotals } from '../types.ts'

/**
 * 词元构成：四个读数格。它是**抬头面板的下半段**，不是独立的一节。
 *
 * 它出的四个数与抬头那个数是一条恒等式：合计 = 未缓存输入 + 缓存读取 + 缓存写入 + 输出。
 * 中间插一条分区词、再隔一段 32px 的块间距，等于在一个本来没有边界的地方画出一条边界——
 * 读者刚读完「合计 1.5M」，下一眼要看的正是它由什么组成。所以这一块**自己不出框、不带分区词**，
 * 只出一条分区线：框归抬头那块面板（理由与量法见 SessionTokens）。这与浮窗那张「今日词元」卡
 * 是同一配方——读数、分区线、它拆出来的四桶，都在同一个框里。
 *
 * **这里不放四桶分段条。** 抬头那个 72px 的数字才是这一页的第一读数，而一条横贯整行的实心
 * 条面积是数字的好几倍，读者先看到的是条不是数。它想说的比例**四个格里的「占 X%」已经逐格
 * 说完了**——条没有增加任何信息。反过来，这一块的层级就是「合计 → 它的四格读数」，与浮窗那张
 * 卡一致（那张卡的四桶格下方也没有条）。
 *
 * 缓存命中率跟着这一块走、不住在抬头的参照带里：它是**构成的读法**（缓存读取占计费输入多少），
 * 与它下面那四个格说的是同一件事。放进「实际支出 / 订阅价值 / 轮数」那串里，它是个混了单位的例外。
 *
 * 与浮窗总览的四个读数格逐字同一套词（未缓存输入 / 缓存读取 / 缓存写入 / 输出），两处对得上号。
 * 未缓存输入排最前：它才是「计费输入」里没被复用的那一部分。
 *
 * 这四个格的类名带 `dtpl-stat-` 前缀，与用量总览（LedgerView）那几个格（`.dtpl-k` /
 * `.dtpl-stat .dtpl-v` / `.dtpl-stat-pct`）**不抢名字**——改一处影响另一处是隐性耦合，
 * 而这两处的读数长一样、却不在同一个组件树里。前缀也把「标签 / 读数 / 份额」三格的
 * 关系写在名字里，不必回样式表就知道谁是谁。
 */
export function MixBand({ totals, totalTokens }: { totals: UsageTotals; totalTokens: number }) {
  // 计费输入 = 未缓存输入 + 缓存读取 + 缓存写入（不含输出）；命中率的分母就是它。
  const billedInput = num(totals.inputTokens) + num(totals.cacheReadTokens) + num(totals.cacheWriteTokens)
  const hitRate = formatRatio(num(totals.cacheReadTokens), billedInput)
  return (
    <section className="dtpl-tok-mix-band" aria-label="词元构成">
      <p className="dtpl-tok-note">
        <span>计费输入 = 未缓存输入 + 缓存读取 + 缓存写入</span>
        <span className="dtpl-tok-mix-hit">缓存命中率 <b>{hitRate === null ? '—' : `${hitRate}%`}</b></span>
      </p>
      <div className="dtpl-grid">
        {BUCKETS.map((bucket) => (
          <div className="dtpl-stat" key={bucket.key} role="listitem">
            <span className="dtpl-stat-k">{bucket.label}</span>
            <span className="dtpl-stat-v">{formatTokens(num(totals[bucket.key]))}</span>
            <span className="dtpl-stat-p">占 {formatShare(num(totals[bucket.key]), totalTokens)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}