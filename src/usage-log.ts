/**
 * token-book 的持久 JSONL 存储：按本地日的分文件、串行追加队列，以及 live hook
 * 与 history sync 共享的进程级 request-id 去重集。一行落在其事件时间的分日文件
 * （`record.time` 的本地 Y-M-D），绝不是追加时的墙钟。
 *
 * 状态作用域：可变的去重/队列状态按**数据目录**键控，而非按 UsageLog 实例——
 * 同一目录、且共享**本模块副本**的所有 `UsageLog` 也共享一个去重集与一个串行
 * 追加队列。这种共享**不能**跨过模块级 HMR reload：cordis-plugin-hmr 宿主
 * reload 清空模块缓存并重新 import 插件入口，重建的模块得到一份**全新的** `dirs`
 * 映射。跨该边界的重叠安全来自磁盘，而非本映射：新实例在首次写入前从磁盘行
 * 重建去重集。进程重启以空映射开始；该目录的首次写入会先从磁盘行重建去重集。
 *
 * @module dsh-tokbook/usage-log
 */

import { appendFile, mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseRecord, serializeRecord } from './usage-record.ts'
import type { UsageRecord } from './types.ts'

const DAY_FILE = /^usage-\d{4}-\d{2}-\d{2}\.jsonl$/u

/** 本存储的分日文件名测试；migration 共享命名契约。 */
export { DAY_FILE }

export function dayFileName(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `usage-${year}-${month}-${day}.jsonl`
}

/** 记录事件时间的分日文件名，与 {@link dayFileName} 一致。 */
export function dayFileNameOf(time: number): string {
  return dayFileName(new Date(time))
}

function dayFilePath(dir: string, time: number): string {
  return join(dir, dayFileNameOf(time))
}

/**
 * 本进程内**一个**数据目录的可变状态：去重集、串行追加队列、目录就绪/已扫描
 * 标志。持有**本模块副本**的该目录的所有 UsageLog 共享。模块级 HMR reload
 * 替换整个映射；跨该边界的守卫是磁盘，不是本映射。
 */
interface DirState {
  seen: Set<string>
  queue: Promise<void>
  ready: Promise<void> | undefined
  scanned: boolean
  /** 在途的 {@link DirState} 重建；并发调用方 await 它。 */
  scanning: Promise<void> | undefined
}

const dirs = new Map<string, DirState>()

function stateOf(dir: string): DirState {
  const existing = dirs.get(dir)
  if (existing !== undefined) return existing
  const created: DirState = {
    seen: new Set(),
    queue: Promise.resolve(),
    ready: undefined,
    scanned: false,
    scanning: undefined,
  }
  dirs.set(dir, created)
  return created
}

/** 忘掉一个（或全部）目录的进程内状态。测试 / 重启缝：真实进程重启以空映射
 *  开始，本函数复现这一点。 */
export function resetUsageLogState(dir?: string): void {
  if (dir === undefined) dirs.clear()
  else dirs.delete(dir)
}

/**
 * 带 request-id 去重的按日 append-only JSONL 日志。
 *
 * 顺序：每次追加（以及 refile）都跑在每目录的一条 promise 链上。去重：request
 * id 在追加入队前同步认领；追加失败会释放认领，行可在稍后重试。
 */
export class UsageLog {
  private readonly dir: string
  private readonly logger: { error(...args: unknown[]): void }
  private readonly state: DirState

  constructor(dir: string, logger: { error(...args: unknown[]): void } = console) {
    this.dir = dir
    this.logger = logger
    this.state = stateOf(dir)
  }

  /** 该目录的日志是否已知某 request id。 */
  has(requestId: string): boolean {
    return this.state.seen.has(requestId)
  }

  /** 结算该目录所有排队的追加。链从不 reject（每个任务吸收自身失败）。 */
  flush(): Promise<void> {
    return this.state.queue
  }

  /**
   * 从所有已有分日文件重建去重集，每目录每进程一次（后续调用为空操作）。畸形
   * 行跳过；不可读文件同样跳过；listing 失败时标志不置位，下次调用会重试。
   */
  async scan(): Promise<void> {
    const state = this.state
    if (state.scanned) return
    if (state.scanning !== undefined) {
      await state.scanning
      return
    }
    const pending = this.doScan().finally(() => {
      if (state.scanning === pending) state.scanning = undefined
    })
    state.scanning = pending
    await pending
  }

  /** 实际扫描；{@link scan} 用在途守卫包一层。 */
  private async doScan(): Promise<void> {
    const state = this.state
    state.ready ??= mkdir(this.dir, { recursive: true }).then(() => undefined)
    await state.ready
    let names: string[]
    try {
      names = await readdir(this.dir)
    } catch (error) {
      this.logger.error('[tokbook] cannot list data dir ' + this.dir + ':', error)
      return
    }
    for (const name of names) {
      if (!DAY_FILE.test(name)) continue
      const text = await readFile(join(this.dir, name), 'utf8').catch((error: unknown) => {
        this.logger.error(`[tokbook] cannot read ${name}:`, error)
        return ''
      })
      for (const line of text.split('\n')) {
        if (line === '') continue
        const record = parseRecord(line)
        if (record === null) {
          this.logger.error(`[tokbook] skipping malformed line in ${name}: ${line.slice(0, 120)}`)
          continue
        }
        state.seen.add(record.requestId)
      }
    }
    state.scanned = true
  }

  /**
   * 持久化一条记录，除非其 request id 已写过。
   * @returns 行已追加为 true；去重掉为 false。
   *
   * 本进程对某目录的首次写入先加载磁盘行到去重集，因此重启宿主从不重追加
   * 已落地的行。listing 失败绝不能挡住写入——坏数据目录不得丢掉实时记录——
   * 故在该（已降级）情形下行仍写出，稍后的幂等 rescan 会清理。从不 reject：
   * 扫描失败降级为未扫描写入，与旧的常驻内存路径一致。
   */
  record(record: UsageRecord): Promise<boolean> {
    const state = this.state
    if (state.scanned) return this.enqueue(record)
    const scan = state.scanning ?? this.beginScan()
    return scan
      .catch((error: unknown) => {
        // 扫描失败（不可读数据目录）不得挡住实时写入。
        this.logger.error('[tokbook] cannot rebuild dedupe set; writing without it:', error)
      })
      .then(() => this.enqueue(record))
  }

  /** 启动（或等待）一次性的磁盘去重重建。不得让写入被它挡住的调用方用
   *  {@link record}；批量前需要已结算集合的（history sync）改为 await
   *  {@link scan}。 */
  private beginScan(): Promise<void> {
    const state = this.state
    const pending = this.doScan().finally(() => {
      if (state.scanning === pending) state.scanning = undefined
    })
    state.scanning = pending
    return pending
  }

  /** 对着（已结算的）去重集认领 + 排队一次追加。 */
  private enqueue(record: UsageRecord): Promise<boolean> {
    const state = this.state
    if (state.seen.has(record.requestId)) return Promise.resolve(false)
    // 入队前认领：带同一 id 的并发调用在此去重。
    state.seen.add(record.requestId)
    const task = state.queue.then(async () => {
      await this.ensureDir()
      await this.appendOnce(record)
    })
    // 追加失败不得毒化后续行的链。
    state.queue = task.catch(() => {})
    return task
      .then(() => true)
      .catch((error: unknown) => {
        // 释放认领，稍后的 sync 可以重试该行。
        state.seen.delete(record.requestId)
        this.logger.error('[tokbook] append failed:', error)
        return false
      })
  }

  /** 把落在错误分日文件中的行挪到 `dayFileNameOf(record.time)`。
   *  幂等；跑在追加队列上，实时写入无法交错。 */
  refileByEventDay(): Promise<number> {
    let moved = 0
    const state = this.state
    const task = state.queue.then(async () => {
      await this.ensureDir()
      moved = await refileDayFiles(this.dir, this.logger)
    })
    state.queue = task.catch(() => {})
    return task.then(() => moved).catch((error: unknown) => {
      this.logger.error('[tokbook] refile by event day failed:', error)
      return 0
    })
  }

  private async ensureDir(): Promise<void> {
    const state = this.state
    state.ready ??= mkdir(this.dir, { recursive: true }).then(() => undefined)
    await state.ready
  }

  /** 追加一行；缓存创建后目录消失时自愈一次。目标是
   *  {@link UsageRecord.time} 的本地日。 */
  private async appendOnce(record: UsageRecord): Promise<void> {
    const path = dayFilePath(this.dir, record.time)
    try {
      await appendFile(path, `${serializeRecord(record)}\n`, { flag: 'a' })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      this.state.ready = undefined
      await this.ensureDir()
      await appendFile(path, `${serializeRecord(record)}\n`, { flag: 'a' })
    }
  }
}

interface DayLine {
  record: UsageRecord | null
  raw: string
}

async function readDayLines(dir: string, name: string, logger: { error(...args: unknown[]): void }): Promise<DayLine[]> {
  const text = await readFile(join(dir, name), 'utf8').catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.error(`[tokbook] cannot read ${name}:`, error)
    }
    return ''
  })
  const lines: DayLine[] = []
  for (const raw of text.split('\n')) {
    if (raw === '') continue
    lines.push({ record: parseRecord(raw), raw })
  }
  return lines
}

async function rewriteDayFile(dir: string, name: string, records: UsageRecord[]): Promise<void> {
  const target = join(dir, name)
  if (records.length === 0) {
    await unlink(target).catch(() => undefined)
    return
  }
  const tmp = join(dir, `${name}.tmp`)
  await writeFile(tmp, `${records.map(serializeRecord).join('\n')}\n`, 'utf8')
  await unlink(target).catch(() => undefined)
  await rename(tmp, target)
}

/** 把已解析的行重新分配到其事件时间命名的分日文件。畸形行留在源文件，坏行
 *  绝不被丢掉。 */
async function refileDayFiles(dir: string, logger: { error(...args: unknown[]): void }): Promise<number> {
  let names: string[]
  try {
    names = (await readdir(dir)).filter(name => DAY_FILE.test(name)).sort()
  } catch (error) {
    logger.error('[tokbook] cannot list data dir ' + dir + ':', error)
    return 0
  }
  let moved = 0
  for (const source of names) {
    const lines = await readDayLines(dir, source, logger)
    const stay: UsageRecord[] = []
    const stray: string[] = []
    const leave = new Map<string, UsageRecord[]>()
    for (const line of lines) {
      if (line.record === null) {
        stray.push(line.raw)
        continue
      }
      const target = dayFileNameOf(line.record.time)
      if (target === source) {
        stay.push(line.record)
        continue
      }
      const bucket = leave.get(target) ?? []
      bucket.push(line.record)
      leave.set(target, bucket)
      moved += 1
    }
    if (leave.size === 0) continue
    for (const [target, records] of leave) {
      const existing = (await readDayLines(dir, target, logger))
        .map(line => line.record)
        .filter((record): record is UsageRecord => record !== null)
      const seen = new Set(existing.map(record => record.requestId))
      const appended = records.filter(record => !seen.has(record.requestId))
      await rewriteDayFile(dir, target, [...existing, ...appended])
    }
    if (stray.length > 0) {
      const target = join(dir, source)
      const body = `${stay.map(serializeRecord).join('\n')}${stay.length > 0 ? '\n' : ''}${stray.join('\n')}\n`
      const tmp = join(dir, `${source}.tmp`)
      await writeFile(tmp, body, 'utf8')
      await unlink(target).catch(() => undefined)
      await rename(tmp, target)
    } else {
      await rewriteDayFile(dir, source, stay)
    }
  }
  return moved
}
