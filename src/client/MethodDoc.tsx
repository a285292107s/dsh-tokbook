/**
 * 统计口径 tab。只留值得记住的事实；实现管道在 README，不在此 tab。
 */

import type { TokBookOverview } from '../types.ts'
import { formatDateTime } from './format.ts'

/**
 * 「记了哪些调用」判定表：一行一种**用户看得见的情况**，后两列是两个维度的判定。
 * 口径真源是 `src/stats.ts` 的 `addUsage`（规则另见 CONTRACTS §2）；这里只做白话转写，
 * 不引入第三套说法——改口径先改那里。
 */
interface JudgeRow {
  /** 用户视角的一句话情况。 */
  what: string
  /** 这句情况的来由或做法。 */
  detail: string
  requests: string
  tokens: string
  /** 省略 = true（有数，描边芯片）；false = 静默芯片（这个维度没有数可加）。 */
  requestsOn?: boolean
  tokensOn?: boolean
}

const JUDGE_ROWS: readonly JudgeRow[] = [
  {
    what: '你发问、模型回复了',
    detail: '对话里每一次正常问答，一次一记。',
    requests: '计 1 次',
    tokens: '四桶累加',
  },
  {
    what: '对话太长，系统自动压缩上文',
    detail: '这次总结本身也是一次计费调用，所以另记一次「压缩」（可在配置里关掉）。',
    requests: '计 1 次',
    tokens: '四桶累加',
  },
  {
    what: '你中途停止，或这次调用没回报用量',
    detail: '厂商可能照常计费，账本却拿不到数字：计入次数，词元记为未知——不按 0 计，金额也因此按 ¥0 计（不是免费）。',
    requests: '计 1 次',
    tokens: '未知',
    tokensOn: false,
  },
  {
    what: '请求失败了（报错、自动重试）',
    detail: '仍留一条失败记录、单独计数，在用量明细里报出「N 失败」；不抬高总量，也不被悄悄丢掉。',
    requests: '不计入',
    tokens: '不计入',
    requestsOn: false,
    tokensOn: false,
  },
]

export function MethodDoc({ overview }: { overview: TokBookOverview | null }) {
  return (
    <section className="dtpl-doc" aria-label="统计口径">
      <div className="dtpl-doc-lede">
        <p>本插件<b>不估算</b>：每个数字都来自<b>本机保存的对话记录</b>——只存在本机，不上传。</p>
        <p><b>通道</b>（代码与文档里写作 provider）是你从哪接入、按什么方式付费的那条路，如 <code>deepseek-official</code>、<code>commandcode</code>；<b>模型厂商</b>是做出模型、定官方价的那一方。同一家公司可以兼任两者（DeepSeek 官方 API），也可以只是通道（Command Code 卖 DeepSeek 模型，但不是 DeepSeek）。</p>
        <p>向模型提问时，通道会回报这次消耗了多少词元。本页记的就是这些回报、逐条累加——<b>不是</b>模型厂商官网上的账户数据。</p>
      </div>

      {/* `role="group"` 不是装饰：`aria-label` 落在**没有角色**的 div 上，浏览器不会把它
          暴露给读屏（generic 角色不支持命名），这一组事实就等于没有名字。 */}
      <div className="dtpl-doc-facts" role="group" aria-label="口径速览">
        <div className="dtpl-doc-fact">
          <span className="dtpl-doc-fact-k">来源</span>
          <span className="dtpl-doc-fact-v">本机对话记录，逐条统计</span>
        </div>
        <div className="dtpl-doc-fact">
          <span className="dtpl-doc-fact-k">精度</span>
          <span className="dtpl-doc-fact-v">单条照实记录，无舍入</span>
        </div>
        <div className="dtpl-doc-fact">
          <span className="dtpl-doc-fact-k">范围</span>
          {/* 这一格钉的是**哪个工具**这一维（别的 AI 工具、直连脚本都看不到）；**哪台设备**
              那一维由第 3 节的「记账维度不同」负责，两处不复述同一个轴。
              「只记」两字不能省：省掉这一格就与上一格「来源」是同一件事，边界消失。 */}
          <span className="dtpl-doc-fact-v">只记 DeepSeek Harness 的会话记录</span>
        </div>
      </div>

      <section className="dtpl-doc-sec">
        <h2 className="dtpl-doc-title"><span className="dtpl-doc-idx">1</span>词元分四桶</h2>
        {/* 金额 / 计价 / 怎么改价不在这一节：前者在 §3「差额从哪来」，后两者是价格表 tab
            自己的操作。 */}
        <p className="dtpl-doc-sub">
          厂商按 <b>词元（token）</b>计费——可以理解为模型读写的最小文字单位。一次请求的用量被拆成
          <b>四类、互不重复</b>，加起来就是「词元合计」：
        </p>
        <div className="dtpl-doc-buckets">
          <Bucket name="未缓存输入" desc="你发过去、但没命中缓存的文字量。" />
          <Bucket name="缓存读取" desc="命中了缓存、不必重新计算的文字量，费率更低。" />
          <Bucket name="缓存写入" desc="写入缓存的文字量；多数厂商不上报，多为 0。" />
          <Bucket name="输出" desc="模型回复的全部文字（含思考过程）。" />
        </div>
      </section>

      <section className="dtpl-doc-sec">
        <h2 className="dtpl-doc-title"><span className="dtpl-doc-idx">2</span>记了哪些调用</h2>
        <p className="dtpl-doc-sub">
          按<b>你会遇到的情况</b>对照，每一行只回答两件事：算不算一次请求、有没有词元可加。
        </p>
        <table className="dtpl-doc-judge">
          <thead>
            <tr>
              <th scope="col">你会遇到的情况</th>
              <th scope="col">请求次数</th>
              <th scope="col">词元用量</th>
            </tr>
          </thead>
          <tbody>
            {JUDGE_ROWS.map((row) => (
              <tr key={row.what}>
                {/* 情况是**行表头**：它命名的是这一行，不是某一列。 */}
                <th scope="row">
                  <span className="dtpl-doc-judge-what">{row.what}</span>
                  <span className="dtpl-doc-judge-detail">{row.detail}</span>
                </th>
                <td><Judge value={row.requests} on={row.requestsOn} /></td>
                <td><Judge value={row.tokens} on={row.tokensOn} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="dtpl-doc-judge-note">
          安装前的旧对话、以及当时漏记的调用，会按原始记录<b>自动补录</b>，判定口径与上表完全一致。
        </p>
      </section>

      <section className="dtpl-doc-sec">
        <h2 className="dtpl-doc-title"><span className="dtpl-doc-idx">3</span>差额从哪来</h2>
        <div className="dtpl-doc-gap">
          <article className="dtpl-doc-gap-card dtpl-doc-gap-warn">
            <h3 className="dtpl-doc-gap-title">账本会比账单少：没记到的</h3>
            <ul className="dtpl-doc-gap-list">
              <li>
                <span className="dtpl-doc-gap-item-name">自动生成的会话标题</span>
                <span className="dtpl-doc-gap-item-desc">给新对话起标题的小请求没有走常规记录通道，本账本拿不到那次用量。每个新会话发生一次，是最大的固定漏项。</span>
              </li>
              <li>
                <span className="dtpl-doc-gap-item-name">中途取消 / 出错的请求</span>
                <span className="dtpl-doc-gap-item-desc"><b>中途取消</b>：文字已经发出去了，厂商可能照常计费，本账本拿不到用量——按上表记为「未知」，并在用量明细的通道卡上单独报出「<b>N 次没上报用量</b>」。<b>最终失败的尝试</b>：只计失败次数、不计词元；厂商若照样收费，这里也会对不上。</span>
              </li>
              <li>
                <span className="dtpl-doc-gap-item-name">不走会话记录的调用</span>
                <span className="dtpl-doc-gap-item-desc">其它插件或脚本直接调用模型时，本账本同样看不到。</span>
              </li>
            </ul>
            <p className="dtpl-doc-gap-sum">同一请求不会重复计数，可以放心反复扫描——但「重新扫描」只能补齐日志里有的调用，补不回这些根本没进日志的。</p>
          </article>
          <article className="dtpl-doc-gap-card">
            <h3 className="dtpl-doc-gap-title">对不上 ≠ 记错：统计方式不同</h3>
            <ul className="dtpl-doc-gap-list">
              <li>
                <span className="dtpl-doc-gap-item-name">记账维度不同</span>
                <span className="dtpl-doc-gap-item-desc">本账本按「这台设备上的会话」记账，账单按「账号」汇总；同一个账号在多台设备 / 多个工具里使用时，两边必然对不齐。</span>
              </li>
              {/* 金额与计价只在这里说一次。价格表页怎么改价、行内四个数字改的是哪一份价,
                  不在这里教——那是价格表 tab 的界面本身(四档价 + 峰谷时段),
                  文档只留用户对账时用得上的结论。 */}
              <li>
                <span className="dtpl-doc-gap-item-name">金额是现价刻度</span>
                <span className="dtpl-doc-gap-item-desc">按你在价格表页写的<b>当前价</b>(¥ / 百万词元)逐条折算后累加;同一个模型串在不同<b>通道</b>可以是不同的价。一份价管全部历史,所以它衡量的是「最近用掉的词元值多少钱」——<b>不是</b>当时那笔账单(厂商改过价,历史那几天的金额就按现价重算)。刻度只在够近的窗口里成立:金额只在近 30 天及更短的窗口里给,<b>全部账本</b>只给词元。</span>
              </li>
              <li>
                <span className="dtpl-doc-gap-item-name">两个金额桶，不是一笔支出</span>
                <span className="dtpl-doc-gap-item-desc"><b>实际支出</b>是按量通道按现价折算的钱；<b>订阅价值</b>是订阅通道这些用量若按量付费本来要花的钱，<b>不是现金</b>。没定价的记录记 ¥0，并列为<b>价格未知</b>——不是免费；改价只影响本机账本，不会回写厂商账单。</span>
              </li>
            </ul>
          </article>
        </div>
      </section>

      <section className="dtpl-doc-sec">
        <h2 className="dtpl-doc-title"><span className="dtpl-doc-idx">4</span>怎么核对</h2>
        <p className="dtpl-doc-sub">
          登录模型厂商的官网（如 DeepSeek 开放平台），<b>按天导出用量</b>，
          与「用量总览」的<b>近 14 天趋势</b>逐日对比。
        </p>
        <p className="dtpl-doc-sub">
          左侧是本账本，右侧是平台导出的字段：
        </p>
        <div className="dtpl-doc-map">
          <div className="dtpl-doc-map-row">
            <span><b>未缓存输入</b></span>
            <span className="dtpl-doc-map-arrow">↔</span>
            <span><code>prompt_cache_miss_tokens</code></span>
          </div>
          <div className="dtpl-doc-map-row">
            <span><b>缓存读取</b></span>
            <span className="dtpl-doc-map-arrow">↔</span>
            <span><code>prompt_cache_hit_tokens</code></span>
          </div>
          <div className="dtpl-doc-map-row">
            <span><b>输出</b></span>
            <span className="dtpl-doc-map-arrow">↔</span>
            <span><code>completion_tokens</code></span>
          </div>
        </div>
        <p className="dtpl-doc-map-note">未缓存输入、缓存读取、输出正好对应平台导出的三个字段。</p>
        <p className="dtpl-doc-map-note">除第 3 节列的那几类漏项外，应逐日吻合。</p>
      </section>

      <div className="dtpl-doc-quota">
        <p><b>另一个 tab：「订阅额度」</b>用的是<b>另一套数据</b>。</p>
        <p>它用你的账号凭据直接向厂商查询<b>账户级官方用量</b>（含你在其它设备上的消费），与本页的本机账本刻意不混用。</p>
      </div>

      {overview !== null && overview.dataDir !== '' && (
        <div className="dtpl-doc-data">
          <p className="dtpl-doc-data-line">
            账本已记录 <b>{overview.records}</b> 次调用，最近一次在 <b>{overview.lastEventAt === null ? '—' : formatDateTime(overview.lastEventAt)}</b>。
          </p>
          <p className="dtpl-doc-data-dir">数据目录：<code>{overview.dataDir}</code></p>
        </div>
      )}

      <p className="dtpl-doc-foot">以上口径基于当前 DSH 版本源码核对。</p>
    </section>
  )
}

/** 判定芯片：描边 = 这个维度有数，静默 = 没有数可加。两种形状，不是两种颜色。 */
function Judge({ value, on = true }: { value: string; on?: boolean }) {
  return <span className={on ? 'dtpl-doc-chip' : 'dtpl-doc-chip dtpl-doc-chip-off'}>{value}</span>
}

function Bucket({ name, desc }: { name: string; desc: string }) {
  return (
    <div className="dtpl-doc-bucket">
      <span className="dtpl-doc-bucket-name">{name}</span>
      <span className="dtpl-doc-bucket-desc">{desc}</span>
    </div>
  )
}
