/**
 * 统计口径 tab。只留值得记住的事实；实现管道在 README，不在此 tab。
 *
 * @module dsh-tokbook/client/MethodDoc
 */

import type { TokBookOverview } from '../types.ts'
import { formatDateTime } from './format.ts'

export function MethodDoc({ overview }: { overview: TokBookOverview | null }) {
  return (
    <section className="dtpl-doc" aria-label="统计口径">
      <div className="dtpl-doc-lede">
        <p>本插件<b>不估算</b>：每个数字都来自<b>本机保存的对话记录</b>。</p>
        <p>向模型提问时，提供这条接入通道的一方（本页叫<b>通道</b>，代码与文档里写作 provider，如 <code>deepseek-official</code>、<code>commandcode</code>）会回报这次消耗了多少词元。</p>
        <p>两个角色要分开：<b>模型厂商</b>是做出模型、定官方价的那一方；<b>通道</b>是你从哪接入、按什么方式付费的那条路。同一家公司可以兼任两者（DeepSeek 官方 API），也可以只是通道（Command Code 卖 DeepSeek 模型，但不是 DeepSeek）。</p>
        <p>本插件照实记录、逐条累加——不是模型厂商官网上的账户数据。</p>
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
        <div className="dtpl-doc-fact dtpl-doc-fact-key">
          <span className="dtpl-doc-fact-k">完整度</span>
          <span className="dtpl-doc-fact-v"><b className="dtpl-doc-fact-big">≈95%</b><span className="dtpl-doc-fact-tail"> 正常使用下</span></span>
        </div>
      </div>

      <section className="dtpl-doc-sec">
        <h2 className="dtpl-doc-title"><span className="dtpl-doc-idx">1</span>词元分四桶</h2>
        <p className="dtpl-doc-sub">
          厂商按 <b>词元（token）</b>计费——可以理解为模型读写的最小文字单位。
        </p>
        <p className="dtpl-doc-sub">
          一次请求的用量被拆成四类、互不重复，加起来就是「词元合计」：
        </p>
        <div className="dtpl-doc-buckets">
          <Bucket name="未命中输入" desc="你发过去、但没命中缓存的文字量。" />
          <Bucket name="缓存读取" desc="命中了缓存、不必重新计算的文字量，费率更低。" />
          <Bucket name="缓存写入" desc="写入缓存的文字量；多数厂商不上报，多为 0。" />
          <Bucket name="输出" desc="模型回复的全部文字（含思考过程）。" />
        </div>
        <div className="dtpl-doc-eq" role="note">
          <span className="dtpl-doc-eq-lead">词元合计</span>
          <span className="dtpl-doc-eq-op">=</span>
          <span className="dtpl-doc-eq-term">未命中输入</span>
          <span className="dtpl-doc-eq-op">+</span>
          <span className="dtpl-doc-eq-term">缓存读取</span>
          <span className="dtpl-doc-eq-op">+</span>
          <span className="dtpl-doc-eq-term">缓存写入</span>
          <span className="dtpl-doc-eq-op">+</span>
          <span className="dtpl-doc-eq-term">输出</span>
        </div>
        <p className="dtpl-doc-sub">
          输入侧三桶还派生出一个数字：<b>缓存命中率</b> = 缓存读取 ÷（未命中输入 + 缓存读取 + 缓存写入）。越高，同样的词元越便宜——命中的那部分按低得多的费率计费。分母取<b>全部输入侧词元</b>（与 DSH 会话统计同口径）；只有真正零遗漏才显示 100%，部分命中会退到一位小数显示，不会被四舍五入凑成满命中。
        </p>
        <p className="dtpl-doc-sub">
          金额 = 按每模型价格表（每百万词元多少元）逐条计价后累加。价格表存在本机、
          可能跟不上厂商最新费率——所以<b>金额是近似值</b>，词元数不受影响。
        </p>
        <p className="dtpl-doc-sub">
          计价按 <b>(通道, 模型)</b> 双维解析：同一个模型串在官方 API 与订阅通道里的
          计费性质不同。时刻上分两级——先取该记录时间戳落在哪一段<b>调价段</b>（生效时间精确到整点），
          再取该段内该时刻落在哪个<b>峰谷时段</b>（星期几 + 几点到几点）；没被任何时段覆盖的
          时间按该段的<b>全天价</b>算。金额分成两个桶——
          <b>实际支出</b>（按量通道真金白银的花费）与 <b>订阅价值</b>（订阅通道的这些用量若按量付费
          本来要花的钱，<b>不是现金</b>，也不会混入上方支出数字）。
        </p>
        <p className="dtpl-doc-sub">
          价格表页<b>行内那四个数字改的是「当前生效那一段的全天价」</b>——改它等于重算用这段价
          计费的全部历史。要从现在起调价，请用行尾 ▸ 里的「＋ 加一段价（调价史）」新增一段。
          某段历史原来的时段或生效时间被改掉、删掉后，那些记录会回到<b>价格未知</b>（¥0）并
          在概览里列出来，不会被悄悄按邻近的价计算。
        </p>
      </section>

      <section className="dtpl-doc-sec">
        <h2 className="dtpl-doc-title"><span className="dtpl-doc-idx">2</span>记了哪些调用</h2>
        <ul className="dtpl-doc-scope">
          <li><span className="dtpl-doc-chip">计入</span>对话中每次向模型发起请求、并成功收到回复——一次一记。</li>
          <li><span className="dtpl-doc-chip">计入</span>自动总结——对话太长时自动压缩上文，那次总结也按一次请求计费并记录（可在配置中关闭）。</li>
          <li><span className="dtpl-doc-chip dtpl-doc-chip-off">仅计次数</span>失败请求——没收到回复，不计词元、不抬高总量。</li>
          <li><span className="dtpl-doc-chip dtpl-doc-chip-off">回填</span>历史——安装前的旧记录、或当时漏记的，会按原始记录自动补齐。</li>
        </ul>
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
                <span className="dtpl-doc-gap-item-desc">已经发出去、但没等到厂商回复的那部分文字，厂商可能照常计费，本账本却拿不到用量。这类调用仍计入请求次数，并在概览里单独报出「<b>N 次调用没上报用量</b>」——计入次数、不冒充 0 词元，金额也因此按 ¥0 计（<b>不是免费</b>）。</span>
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
                <span className="dtpl-doc-gap-item-name">缓存写入常为 0</span>
                <span className="dtpl-doc-gap-item-desc">多数厂商不单独报「写入缓存」这项，所以它通常为 0，不是记漏；少数厂商（如 Anthropic）会报，对比时注意。</span>
              </li>
              <li>
                <span className="dtpl-doc-gap-item-name">记账维度不同</span>
                <span className="dtpl-doc-gap-item-desc">本账本按「这台设备上的会话」记账，账单按「账号」汇总；同一个账号在多台设备 / 多个工具里使用时，两边必然对不齐。</span>
              </li>
              <li>
                <span className="dtpl-doc-gap-item-name">金额是估算</span>
                <span className="dtpl-doc-gap-item-desc">本机价格表跟不上厂商最新费率时，金额会偏离（词元数不受影响）。改价只影响本机账本，不会回写厂商账单。</span>
              </li>
            </ul>
          </article>
        </div>
      </section>

      <section className="dtpl-doc-sec">
        <h2 className="dtpl-doc-title"><span className="dtpl-doc-idx">4</span>怎么核对</h2>
        <p className="dtpl-doc-sub">
          登录模型厂商的官网（如 DeepSeek 开放平台），<b>按天导出用量</b>，
          与本页「近 14 天趋势」对比。
        </p>
        <p className="dtpl-doc-sub">
          左侧是本账本，右侧是平台导出的字段：
        </p>
        <div className="dtpl-doc-map">
          <div className="dtpl-doc-map-row">
            <span><b>未命中输入</b></span>
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
        <p className="dtpl-doc-map-note">未命中输入、缓存读取、输出正好对应平台导出的三个字段。</p>
        <p className="dtpl-doc-map-note">除「会话标题」和「中途取消的请求」两类外，应逐日吻合。</p>
      </section>

      <div className="dtpl-doc-quota">
        <p><b>小提示：</b>旁边的「订阅额度」页用的是<b>另一套数据</b>。</p>
        <p>它用你的账号凭据直接向厂商查询<b>官方用量</b>（含你在其它设备上的消费），与本页的本机账本不同。</p>
      </div>

      {overview !== null && overview.dataDir !== '' && (
        <div className="dtpl-doc-data">
          <p className="dtpl-doc-data-line">
            账本已记录 <b>{overview.records}</b> 条原始记录，分布在 <b>{overview.files}</b> 个按天文件中。
          </p>
          <p className="dtpl-doc-data-line">
            最新一条记录于 <b>{overview.lastEventAt === null ? '—' : formatDateTime(overview.lastEventAt)}</b>。
          </p>
          <p className="dtpl-doc-data-dir">数据目录：<code>{overview.dataDir}</code></p>
        </div>
      )}

      <p className="dtpl-doc-foot">以上口径基于当前 DSH 版本源码核对。</p>
    </section>
  )
}

function Bucket({ name, desc }: { name: string; desc: string }) {
  return (
    <div className="dtpl-doc-bucket">
      <span className="dtpl-doc-bucket-name">{name}</span>
      <span className="dtpl-doc-bucket-desc">{desc}</span>
    </div>
  )
}
