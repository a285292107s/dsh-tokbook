import { useId } from 'react'
import type { SessionUsageView, UsageTotals } from '../types.ts'
import { totalsTokens } from '../types.ts'
import { formatShare, formatTokens } from './format.ts'
import { UsageGlyph } from './icons.tsx'
import { Dial, DialFigure } from './dial.tsx'
import { SessionOverlay, modelLabelOf, type OverlayCard } from './SessionOverlay.tsx'

type BucketKey = 'inputTokens' | 'cacheReadTokens' | 'cacheWriteTokens' | 'outputTokens'

type BucketKind = 'input' | 'cache-read' | 'cache-write' | 'output'

interface TokenBucket {
  key: BucketKey
  label: string
  kind: BucketKind
}

const BUCKETS: readonly TokenBucket[] = [
  { key: 'inputTokens', label: '未缓存输入', kind: 'input' },
  { key: 'cacheReadTokens', label: '缓存读取', kind: 'cache-read' },
  { key: 'cacheWriteTokens', label: '缓存写入', kind: 'cache-write' },
  { key: 'outputTokens', label: '输出', kind: 'output' },
]

function tokenSegments(totals: UsageTotals): TokenBucket[] {
  return BUCKETS.filter((bucket) => totals[bucket.key] > 0)
}

function TokenDial({ tokens, totals }: { tokens?: number; totals: UsageTotals }) {
  const fillKey = `dtpl-ttk-${useId().replaceAll(':', '')}`
  const segments = tokens === undefined ? [] : tokenSegments(totals)
  const breakdown = BUCKETS
    .map((bucket) => `${bucket.label} ${formatTokens(totals[bucket.key])}`)
    .join(' · ')
  return (
    <Dial
      title={tokens === undefined
        ? '用量未知：这一轮的计费调用都没有上报词元'
        : `词元合计：${formatTokens(tokens)}（${breakdown}）`}
      segments={segments.map((bucket) => ({
        key: bucket.key,
        value: totals[bucket.key],
        fill: bucket.kind === 'output' ? 'currentColor' : `url(#${fillKey}-${bucket.kind})`,
      }))}
      defs={(
        <>
          <pattern id={`${fillKey}-input`} width="4" height="4" patternUnits="userSpaceOnUse">
            <rect width="4" height="4" fill="currentColor" fillOpacity="0.52" />
            <rect width="1.5" height="4" fill="currentColor" fillOpacity="0.66" />
          </pattern>
          <pattern id={`${fillKey}-cache-read`} width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="currentColor" fillOpacity="0.72" />
            <rect width="6" height="1.5" fill="currentColor" fillOpacity="0.88" />
          </pattern>
          <pattern id={`${fillKey}-cache-write`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="currentColor" fillOpacity="0.72" />
            <rect width="1.5" height="6" fill="currentColor" fillOpacity="0.88" />
          </pattern>
        </>
      )}
      center={tokens === undefined
        ? <span className="dtpl-dial-note">用量未知</span>
        : <DialFigure text={formatTokens(tokens)} />}
    />
  )
}

function TokenLedger({ totals }: { totals: UsageTotals }) {
  const total = totalsTokens(totals)
  return (
    <div className="dtpl-ttk-buckets">
      {BUCKETS.map((bucket) => (
        <div className="dtpl-ttk-bucket" key={bucket.key}>
          <span className="dtpl-tok-read-mark" data-kind={bucket.kind} aria-hidden="true" />
          <span className="dtpl-ttk-bucket-name">{bucket.label}</span>
          <b className="dtpl-ttk-bucket-value">{formatTokens(totals[bucket.key])}</b>
          <span className="dtpl-ttk-bucket-share">{formatShare(totals[bucket.key], total)}</span>
        </div>
      ))}
    </div>
  )
}

function tokenCards(view: SessionUsageView): OverlayCard[] {
  const labels = view.providerLabels ?? {}
  const cards: OverlayCard[] = []
  for (const group of view.turns) {
    if (group.turn === null) continue
    const totals = group.totals
    const unknown = totals.usageUnknown ?? 0
    const failed = totals.failures ?? 0
    const tokens = group.rows.some((row) => row.usage !== undefined) ? totalsTokens(totals) : undefined
    const model = modelLabelOf(group.rows, labels)
    cards.push({
      key: `turn:${String(group.turn)}`,
      turn: group.turn,
      meta: `${String(group.rows.length)} 步${unknown === 0 ? '' : ` · ${String(unknown)} 步用量未知`}${failed === 0 ? '' : ` · 含 ${String(failed)} 次失败`}${model.count > 1 ? ` · ${String(model.count)} 个模型` : ''}`,
      model,
      leading: <TokenDial tokens={tokens} totals={totals} />,
      body: tokens === undefined
        ? <p className="dtpl-ov-gap">用量未知：这一轮的计费调用都没有上报词元。</p>
        : <TokenLedger totals={totals} />,
    })
  }
  return cards.reverse()
}

export interface SessionTokensEntryProps {
  sessionId?: string
}

export function SessionTokensEntry({ sessionId }: SessionTokensEntryProps) {
  return (
    <SessionOverlay
      sessionId={sessionId}
      triggerTitle="查看本会话每轮词元"
      triggerLabel="词元"
      triggerIcon={<UsageGlyph className="dtpl-tok-entry-ico" />}
      panelTitle="每轮词元"
      panelLabel="每轮词元"
      emptyText="这个会话还没有可归属轮次的计费调用。"
      footnote="只计上报用量的步 · 最新在前 · 不含轮间/轮次未知/子代理"
      skeletonClass="dtpl-ttk-sk"
      cards={tokenCards}
    />
  )
}
