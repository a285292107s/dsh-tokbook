/**
 * 会话词元页的**用时分段语言**：把「等首 token → 生成 → 工具」这三段（以及拆不开的
 * 「模型」）画成一条比例尺。
 *
 * 这里只放**被两处以上共用**的东西：
 *   - `TimeBar` —— 画尺的组件（轮块头那条、抬头那条、图例那条都它）；
 *   - `TimeReads` —— 尺下面那串「记号 + 段名 + 数」的读数（抬头那条、轮块头那条）；
 *   - `stepSegments` / `sumSegments` —— 把一行 / 一组的用时拆成那三段；
 *   - `PHASE_LABEL` / `LEGEND_SHAPE` —— 三段的名字与图例那条示例尺的形状。
 *
 * 为什么单独成文件：这块是**设计语言**而不是 UI——它的灰阶词汇是这一页唯一的「比例」语言；
 * 它被图表（TurnChart 的块头尺）与明细（TurnBlock 的块头尺、StepRow 的步骤尺、图例）复用，
 * 而图表与明细各自有自己的交互逻辑（悬停卡片、折叠、用时表）。混在一个文件里会让这几处互相牵制。
 */

import type { SessionStepRow, StepTiming } from '../types.ts'

/** 一段的名字与长度：`kind` 决定那枚记号的明度，与真尺同源。 */
export interface TimeBarRead {
  key: string
  kind: TimeSegment['kind']
  label: string
  value: string
}

/** 相位那四段的名字。**只有一份**：图例、轮块头那串读数、步骤表都从这里取，改一个字三处一起改。 */
export const PHASE_LABEL: Record<'wait' | 'generate' | 'model' | 'tool', string> = {
  wait: '等首 token',
  generate: '生成',
  model: '模型（拆不开）',
  tool: '工具',
}

/**
 * 图例那条示例尺的**形状**。份额只是为了让三段都看得见（约 3:5:3），不是任何真实数据
 * ——它画的是「这三段长什么样」，数字在轮块头与步骤行里。改这里就等于改图例，
 * 与真尺共用同一套灰阶与同一条分隔配方，所以不会与真尺脱节。
 * 名字取 `PHASE_LABEL`：图例与读数上的字因此不可能写成两种。
 */
export const LEGEND_SHAPE: ReadonlyArray<{ kind: 'wait' | 'generate' | 'tool'; share: number; label: string }> = (
  [
    { kind: 'wait', share: 30 },
    { kind: 'generate', share: 52 },
    { kind: 'tool', share: 32 },
  ] as const
).map((phase) => ({ ...phase, label: PHASE_LABEL[phase.kind] }))

/**
 * 一段时间的**构成尺**：把几个组成按比例摊在一条线上。
 *
 * 这一页整页都在回答「时间花在哪」，而各处读数全是数字——一轮二十几步扫下来，谁也读不出
 * 哪一步几乎全在等工具。尺把那个**形状**交给眼睛，精确的数仍留给紧挨着的那串读数。
 *
 * **两种尺，差别只在有没有长度通道**：
 *   · `turn` / `hero`——**长度说的是量级，但只在轨道之内**：整条占车道的比例 = total / scale
 *     （分母由调用方给：轮与轮之间比的是哪一轮更重，抬头那条比的是「引擎工作」占会话跨度的多少）。
 *     段宽是该段占**整条**的比例；两者相乘恰好等于 value / scale，所以同一个时长在任何一条同分母
 *     的尺上都一样长。（把段宽直接写成 value/scale 是错的——百分比是相对父元素算的，那样会被再乘
 *     一次条长。）**凡是带长度通道的尺都画轨道**：不画的话，一段 145ms 的工作与一段 5 分钟的工作
 *     都只是一小截灰，读者读不出「它只占这么一点」——那正是这一条要说的事。
 *   · `step`——**没有长度通道**：整条永远铺满自己的车道，只有段宽，说的是「这一步的时间花在
 *     哪三段」，没有轨道（轨道会凭空造出一个不存在的分母）。
 *
 * 为什么步骤尺不能带长度：它的长度只能按块头那个分母（`turnScale`，全会话最重的那一轮）缩放，
 * 而看一行步骤时问的是「这一轮里哪一步慢」——分母在另一个尺度上，长度比出来的既不是眼前这个
 * 问题的答案，又把三段挤成几个像素（实测车道 289px 时最短的一段落到 4.4px，「等首 token 占了
 * 一成」于是画成一根发丝）。量级那件事本来就归右边那张等宽表管（见 session-detail 的
 * TIMING_METRICS：一列一个量，竖着扫下去就是趋势），一条尺不该抢它的活。铺满车道之后，每一行
 * 的段边界都落在同一组横坐标上，竖着扫一眼就是**趋势**；块头那条的长度仍单独承担量级，而它的
 * 段边界正好是下面各步段边界的加权平均（分段同源，见 `sumSegments`）。
 *
 * 它没有轴、没有刻度：`step` 与 `turn` 也没有自己的标签——靠与旁边那串数字的邻近关系说话，
 * 所以对读屏隐藏（那些数字才是给 AT 的版本）。**只有 `hero` 那条带段名**（`reads`）：它是整页
 * 唯一一条**两段都不带读数的**尺——上面那两个格报的是「引擎工作」与「会话跨度」两个端点，而条上
 * 浅的那一段（两者的差额）既没有名字也没有数，一根大半是浅灰的横条于是被读成**进度条**：进度条
 * 的全部含义正是「进行到几成」，而这两段都是终值。段名与段值因此必须写在条上，不在别处。
 * 灰阶是这一页唯一的「比例尺」语言，读者不必学第二遍。
 *
 * **相位靠明度、纹路与分隔认，不靠高度**。三段一律满高：高度那条通道要求读者先看出「这一段比
 * 那一段矮」，而 16px 上的 46% / 70% / 100% 在实机里读出来是「三根长短不齐的柱子拼在一起」，
 * 不像一条比例条。相位由两条**在最小可读高度上仍然成立**的通道认：三段明度各压过面板 3:1（相邻约
 * 2:1，缩小、灰阶、色觉异常下都在），段与段之间再压 1px 面板色**断开**。
 * 明度之外还有**纹路**：真实步骤行里一段常常只有二三十像素宽（实测最窄 24px，而 `max(2px, …)`
 * 的下限允许 2px 的段存在），跨段比明度需要一个共同参照，单看一段时纹路比明度可靠。四类各一条
 * 纹路——等首 token 竖细线、生成实心、工具 45° 斜纹、模型（拆不开）交叉网格；两档都过 3:1。
 * 具体值与理由写在 styles/session.ts 那四条 `data-kind` 规则旁。
 *
 * 一段都量不到时**整条不出**：空轨道会被读成「有分母、只是这一段是 0」，而事实是量不到
 * （同本页其余口径，见 docs/CONTRACTS.md §2）。
 */

/** 尺上的一段：`kind` 决定明度与纹样（见 `stepSegments`）。 */
type TimeSegment = { key: string; value: number; kind: 'model' | 'wait' | 'generate' | 'tool' | 'work' | 'idle' }

/** 一段的名字与长度：`kind` 决定那枚记号的明度，与真尺同源。 */
export interface TimeBarRead {
  key: string
  kind: TimeSegment['kind']
  label: string
  value: string
}

/**
 * 尺下面那串「记号 + 段名 + 数」。
 *
 * 记号与真尺的段共用 `data-kind` 那套灰阶（样式侧写在同一条选择器里）：改尺就改了记号，
 * 两者不可能分家。几何另给——尺上的段是满高的一块，记号是 9×10 的一小枚。
 *
 * 两处用它：抬头那条（「引擎工作 / 没在算」两段）与轮块头那条（等首 token / 生成 / 工具）。
 * 后者是因为**只有宽度没有数**的尺答不了「这一轮等了几秒、工具花了几秒」——形状给眼睛，
 * 数字给要拿它做判断的人。两处必须同一份，否则读者要学两遍哪枚记号对应哪一句。
 */
export function TimeReads({ reads }: { reads: readonly TimeBarRead[] }) {
  return (
    <span className="dtpl-tok-reads">
      {reads.map((read) => (
        <span className="dtpl-tok-read" key={read.key}>
          <span className="dtpl-tok-read-mark" data-kind={read.kind} aria-hidden="true" />
          <span>{read.label}</span>
          <b>{read.value}</b>
        </span>
      ))}
    </span>
  )
}

/**
 * 三档尺各要什么：`step` 没有分母可用（不收 `scale`，省得调用方以为自己传的是长度）；
 * `turn` 有长度、没有段名（块头那串读数就画在它下面）；`hero` **必须**带段名
 * ——名字是承重的（见上），少写一个不会报错，只会把那条尺退回进度条的读法。
 */
type TimeBarProps = { segments: readonly TimeSegment[] } & (
  | { tone: 'step' }
  | { tone: 'turn'; scale: number }
  | { tone: 'hero'; scale: number; reads: readonly TimeBarRead[] }
)

export function TimeBar(props: TimeBarProps) {
  const total = props.segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0)
  if (!(total > 0)) return null
  // 段宽 = 该段占**整条**的比例（两种尺一样）。它与条长无关，所以两种尺的段宽算法共用一条。
  const segPct = (value: number): string =>
    `${String(Math.round((Math.max(0, value) / total) * 1000) / 10)}%`
  // 长度那条通道只给 turn / hero。分母为 0（一步都没量到）时整条不出——与「量不到 ≠ 0」同口径。
  if (props.tone !== 'step' && !(props.scale > 0)) return null
  const width = props.tone === 'step'
    ? '100%'
    : `max(2px, ${String(Math.round(Math.min(1, total / props.scale) * 1000) / 10)}%)`
  const bar = (
    <span
      className="dtpl-tok-bar"
      data-tone={props.tone}
      aria-hidden="true"
      // 步骤尺铺满车道（`100%`）；turn / hero 带长度通道，下限 2px——再短的一条也看得见，
      // 一根看不见的条会被读成「这一段没有用时」，而它是有的。
      style={{ width }}
    >
      {props.segments.map((segment) => (
        <span
          key={segment.key}
          className="dtpl-tok-bar-seg"
          data-kind={segment.kind}
          // 宽度是相对**整条**的比例（见上）。高度不再分档——三段一律满高，相位由明度与段间
          // 那 1px 断开认（理由见 TimeBar 文件头）。
          // 0 值的一段不占位（首 token 恰好为 0 时那一段本来就不存在）。
          style={{ width: `max(${segment.value > 0 ? 2 : 0}px, ${segPct(segment.value)})` }}
        />
      ))}
    </span>
  )
  // 段名只给 hero（见文件头「hero 那条带段名」）：它两段的比例动辄 1:100，段名挤不进自己那一段
  // 的正下方——所以摊在整条下面，而不是像图例那样对齐到段上。
  if (props.tone !== 'hero') return bar
  return (
    <span className="dtpl-tok-hero-ratio">
      {bar}
      <TimeReads reads={props.reads} />
    </span>
  )
}

/**
 * 一组（一轮）的构成：把各步的分段**按相位分别相加**。
 *
 * 块头那条尺因此与它下面那一列步骤尺说同一套话（同一组相位、同一套灰阶、同一套段间断开）——
 * 展开后看到的那几条，正是收起时这一条的分解。否则「模型」在块头是深色、而同样的深色在
 * 步骤行里指的是「生成」，同一种颜色在同一屏上指着两段时间，读者无从知道该信哪个。
 *
 * 两条尺的**长度**不同源（块头按 `turnScale` 缩放并画轨道，步骤尺铺满车道，理由见 `TimeBar`）：
 * 块头那条的段边界是各步段边界按时间的加权平均，所以「这一轮的时间花在哪」在收起与展开
 * 两种状态下读到的是同一个形状，量级则只由块头那条的长度单独承担。
 *
 * 数字仍只由 `settleTiming` 定（那是唯一的加法）：各相位之和恒等于它报出的 `llmMs + toolMs`。
 */
export function sumSegments(rows: readonly SessionStepRow[]): { key: string; value: number; kind: 'model' | 'wait' | 'generate' | 'tool' }[] {
  const byKind = new Map<'model' | 'wait' | 'generate' | 'tool', number>()
  for (const row of rows) {
    for (const segment of stepSegments(row.timing)) {
      byKind.set(segment.kind, (byKind.get(segment.kind) ?? 0) + segment.value)
    }
  }
  // 顺序照相位先后；拆不开的 `model` 排在等/生成那两位上——它占的就是那段时间。
  return (['wait', 'generate', 'model', 'tool'] as const)
    .filter((kind) => (byKind.get(kind) ?? 0) > 0)
    .map((kind) => ({ key: kind, value: byKind.get(kind) ?? 0, kind }))
}

/**
 * 一步的构成，按**真实先后**摊开：等首 token → 生成 → 工具。
 *
 * 拆出「等首 token」这一段，因为「模型用时」是个会骗人的和：它把等待和生成加在了一起，而这两件
 * 事情的**成因完全不同**——前者在等上游排队与预填充，后者才是这个模型真正在吐字。实测（12.8 万行
 * 账本）首 token 占了模型用时的一半以上，也就是**模型那一格里一多半不是在生成**；只画「模型 +
 * 工具」两段，把这段等待藏进「模型」，恰是这一页最该说清的事。三段还各有一条独立的读数
 * （模型 / 首 token / 生成 / 工具），所以尺与表说的是同一件事。
 *
 * 相位靠**明度**编码（`wait` 最浅、`generate` 最深、`tool` 居中），段与段之间压 1px 面板色断开：
 * 三段挤在一起时，光有明度不够——相邻档在 16px 高的条上仍可能糊成一块，断开让它们先是两个
 * 各自完整的矩形。这条设计语言不借色相做分类，所以明度与断开就是全部手段（见 `TimeBar`）。
 *
 * 拆不开的两条路径都**不冒充「生成」**：
 *  - 只量到模型、量不到首 token（通道没上报流）→ 整段记 `model`，表里那一格报「—」；
 *  - 分不出组成（重试耗尽，只有整段墙钟）→ 返回空数组，那一步的形状由「用时 X · 无产出」说。
 * 硬拆一个等待时长、或把「不知道有没有等待」画成「没有等待」，都是编数（同「用量未知 ≠ 0」）。
 */
export function stepSegments(timing: StepTiming | undefined): { key: string; value: number; kind: 'model' | 'wait' | 'generate' | 'tool' }[] {
  if (timing === undefined || timing.llmMs === undefined) return []
  const segments: { key: string; value: number; kind: 'model' | 'wait' | 'generate' | 'tool' }[] = []
  const { ttftMs, decodeMs } = timing
  if (ttftMs !== undefined && decodeMs !== undefined && decodeMs > 0) {
    if (ttftMs > 0) segments.push({ key: 'wait', value: ttftMs, kind: 'wait' })
    segments.push({ key: 'generate', value: decodeMs, kind: 'generate' })
  } else {
    // 拆不开时整段记作 **model**（「模型用时，拆不开」），**不记作 generate**：
    // 「生成」这个词断言了「没有等待」，而这条路径正是「有没有等待不知道」——某些通道压根不上报
    // `stream`（实测 11,462 条），把那些步一律画成「生成」就等于替它们宣称首 token 是 0。
    // 表里那一格同时报「—」，两者口径一致。
    segments.push({ key: 'model', value: timing.llmMs, kind: 'model' })
  }
  if (timing.toolMs !== undefined && timing.toolMs > 0) {
    segments.push({ key: 'tool', value: timing.toolMs, kind: 'tool' })
  }
  return segments
}