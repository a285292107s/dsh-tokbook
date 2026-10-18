import type { SessionStepRow, UsageFields } from '../types.ts'

export function hasPricedRow(rows: readonly SessionStepRow[]): boolean {
  return rows.some((row) => row.bucket !== 'unpriced')
}

export const BUCKETS: ReadonlyArray<{ key: keyof UsageFields; label: string }> = [
  { key: 'inputTokens', label: '未缓存输入' },
  { key: 'cacheReadTokens', label: '缓存读取' },
  { key: 'cacheWriteTokens', label: '缓存写入' },
  { key: 'outputTokens', label: '输出' },
]

export interface TurnPreview {
  turn: number
  prompt: string
  response: string
}

export type PreviewMap = ReadonlyMap<number, TurnPreview>