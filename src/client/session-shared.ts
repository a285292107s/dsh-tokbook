/**
 * 会话词元页里**被图表与明细两处共用**的常量与类型。
 *
 * 单独成文件是因为它们**不是**展示层的东西：`BUCKETS` 是四桶的展示顺序与名字（与浮窗总览
 * 的四个读数格逐字同一套词，两处对得上号），`TurnPreview` / `PreviewMap` 是会话投影里那两栏
 * （提问 / 回答预览）的形状。这三样被 `session-chart`（悬停卡片里列四桶、卡片里那两行预览）
 * 与 `session-detail`（块头预览、步骤行 hover 审计里列四桶）同时引用——放在 barrel 里会与那
 * 两个文件形成循环导入，所以这里单列一层。
 */

import type { SessionStepRow, UsageFields } from '../types.ts'

/**
 * 这一组的 ¥0 是不是**量出来的零**：只要有一行走到计价路径，¥0 就是读数（现价刻度下的零）。
 * 一行都没走到 = 整组价格未知，那个 ¥0 是未知的占位（见 docs/CONTRACTS.md §2），
 * 把它报成「¥0.00 实际支出」等于把未知印成读数——行里写的是「价格未知」，两处就打架了。
 */
export function hasPricedRow(rows: readonly SessionStepRow[]): boolean {
  return rows.some((row) => row.bucket !== 'unpriced')
}

/**
 * 四桶的展示顺序与名字——与浮窗总览的四个读数格逐字同一套词，两处对得上号。
 * 未缓存输入排最前：它才是「计费输入」里没被复用的那一部分。
 */
export const BUCKETS: ReadonlyArray<{ key: keyof UsageFields; label: string }> = [
  { key: 'inputTokens', label: '未缓存输入' },
  { key: 'cacheReadTokens', label: '缓存读取' },
  { key: 'cacheWriteTokens', label: '缓存写入' },
  { key: 'outputTokens', label: '输出' },
]

/** `turnOutline` 投影里本页用得到的两栏（真源见 `@deepseek-ai/dsh-session-turn-outline`）。 */
export interface TurnPreview {
  turn: number
  prompt: string
  response: string
}

/** 轮次号 → 预览文本；投影拿不到时是空表，预览整块不出。 */
export type PreviewMap = ReadonlyMap<number, TurnPreview>