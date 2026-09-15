/**
 * dsh-tokbook 的最小客户端契约类型：插件被授予的宿主接缝，以及跨 surface 共享的视图契约。
 *
 * browser bundle 复用 DSH 基线模块表，不得运行时 import 任何 `@deepseek-ai/*` client 包（bundle 纯净性门禁）。因此 `ctx.slots` 在此本地声明。
 *
 * @module dsh-tokbook/client
 */

import type { Context } from '@deepseek-ai/cordis'

/** 插件用到的 `slots.register` 选项子集。 */
export interface SlotRegisterOptions {
  /** 目标 SlotMap 键。 */
  name: string
  /** 列表型 slot 的唯一 id（叠加注册）。 */
  id?: string
  /** 列表 slot 内的排序权重。 */
  order?: number
  /** `t` prop 的 locale 命名空间占位（scaffold 尚未接线）。 */
  locale?: string
  /** 注册方私有、由组件消费的注入份额。 */
  inject?: (...args: never[]) => Record<string, unknown>
  /** 声明的子 slot（本插件不声明）。 */
  children?: Record<string, unknown>
}

/** 插件用到的 slots 服务子集。 */
export interface SlotsService {
  inject(name: string, callback: () => (() => void) | Iterable<() => void>): () => void
  register(options: SlotRegisterOptions, component: unknown): () => void
}

/** 插件被授予的 client Context；仅含 `slots`。 */
export type TokBookContext = Context & { slots: SlotsService }
