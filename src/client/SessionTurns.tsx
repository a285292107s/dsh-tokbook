export { type PreviewMap, type TurnPreview } from './session-shared.ts'
export { TimeBar } from './session-timing.tsx'
export { TurnChart } from './session-chart.tsx'
export { TurnBlocks } from './session-detail.tsx'

import { formatRatio, formatShare, formatTokens } from './format.ts'
import { num } from './session-wire.ts'
import { BUCKETS } from './session-shared.ts'
import type { UsageTotals } from '../types.ts'

export function MixBand({ totals, totalTokens }: { totals: UsageTotals; totalTokens: number }) {
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
