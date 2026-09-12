/**
 * Minimal client-side contract types for dsh-tokbook: the host seams the
 * plugin is granted, plus the view contracts shared between surfaces.
 *
 * The browser bundle reuses the DSH baseline module table (react, cordis,
 * store, ui-slots, ui-primitives) and must NOT runtime-import a
 * `@deepseek-ai/*` client package (bundle-purity gate). So `ctx.slots` is typed
 * locally here with only the members the plugin uses; tighten against the real
 * `@deepseek-ai/dsh-client-ui-slots` types (via `import type`) when wiring the
 * type graph as devDependencies.
 *
 * A type that one surface *produces* for another to *consume* belongs here
 * rather than next to the consumer: the producer would otherwise import the
 * consumer, which is the dependency direction reversed.
 *
 * @module dsh-tokbook/client
 */

import type { Context } from '@deepseek-ai/cordis'

/** The subset of `slots.register` options the plugin uses. */
export interface SlotRegisterOptions {
  /** The target SlotMap key. */
  name: string
  /** Unique id for list-valued slots (additive). */
  id?: string
  /** Sort order within a list slot. */
  order?: number
  /** Locale namespace seat for the `t` prop (not wired yet in this scaffold). */
  locale?: string
  /** Registrant-private injected share consumed by the component. */
  inject?: (...args: never[]) => Record<string, unknown>
  /** Declared child slots (this plugin declares none). */
  children?: Record<string, unknown>
}

/** The subset of the slots service the plugin uses. */
export interface SlotsService {
  inject(name: string, callback: () => (() => void) | Iterable<() => void>): () => void
  register(options: SlotRegisterOptions, component: unknown): () => void
}

/** The client Context the plugin is granted; keep it to `slots` only. */
export type TokBookContext = Context & { slots: SlotsService }

/** A cross-tab request to open the 价格表 tab on one filter. Produced by the
 *  overview (its 价格未知 note) and consumed by the pricing panel, so it is
 *  stated here — where both surfaces can reach it — instead of on either one. */
export type PricingFocus = 'unpriced' | null
