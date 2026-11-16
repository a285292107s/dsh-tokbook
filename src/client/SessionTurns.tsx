export { type PreviewMap, type TurnPreview } from './session-shared.ts'
export { TimeBar } from './session-timing.tsx'
export { TurnBlocks } from './session-detail.tsx'

import { formatRatio, formatShare, formatTokens } from './format.ts'
import { BUCKETS } from './session-shared.ts'
import { num } from './session-wire.ts'
import type { UsageTotals } from '../types.ts'

export function MixBand({ totals, totalTokens }: { totals: UsageTotals; totalTokens: number }) {
  const billedInput = num(totals.inputTokens) + num(totals.cacheReadTokens) + num(totals.cacheWriteTokens)
  const hitRate = formatRatio(num(totals.cacheReadTokens), billedInput)
  return (
    <section className="dtpl-tok-mix" aria-label="词元构成">
      <div className="dtpl-tok-mix-bar" aria-hidden="true">
        {BUCKETS.map((bucket) => {
          const value = num(totals[bucket.key])
          const width = totalTokens > 0 ? (value / totalTokens) * 100 : 0
          return (
            <span
              key={bucket.key}
              className="dtpl-tok-mix-seg"
              data-bucket={bucket.key}
              style={{ width: `${String(width)}%`, minWidth: value > 0 ? '2px' : '0' }}
            />
          )
        })}
      </div>
      <div className="dtpl-tok-mix-cells">
        {BUCKETS.map((bucket) => {
          const value = num(totals[bucket.key])
          return (
            <div className="dtpl-tok-mix-cell" key={bucket.key}>
              <span className="dtpl-tok-mix-k">
                <i className="dtpl-tok-mix-mark" data-bucket={bucket.key} aria-hidden="true" />
                {bucket.label}
              </span>
              <span className="dtpl-tok-mix-v">{formatTokens(value)}</span>
              <span className="dtpl-tok-mix-p">占 {formatShare(value, totalTokens)}</span>
            </div>
          )
        })}
      </div>
      <p className="dtpl-tok-mix-note">
        <span>计费输入 = 未缓存输入 + 缓存读取 + 缓存写入</span>
        <span className="dtpl-tok-mix-hit">缓存命中率 <b>{hitRate === null ? '—' : `${hitRate}%`}</b></span>
      </p>
    </section>
  )
}
