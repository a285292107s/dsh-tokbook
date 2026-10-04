/**
 * token-book 的持久 JSONL 存储：按本地日的分文件、每目录一条串行追加队列，以及 live
 * hook 与 history sync 共享的进程级 request-id 去重集。一行落在其事件时间的分日文件
 * （`record.time` 的本地 Y-M-D），绝不是追加时的墙钟。
 *
 * 可变的去重/队列状态按**数据目录**键控而非按实例键控；这份共享**不跨**模块级 HMR
 * reload，跨该边界的重叠安全来自磁盘而非内存 Map。边界语义见 `docs/HMR.md` §4，
 * 去重身份与单写者口径见 `docs/CONTRACTS.md` §2/§3。
 */

import { appendFile, mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseRecord, serializeRecord } from './usage-record.ts'
import type { UsageRecord } from './types.ts'

const DAY_FILE = /^usage-(\d{4}-\d{2}-\d{2})\.jsonl$/u

/** 本存储的分日文件名测试；stats 的读路径与 migration 共享这一份命名契约。 */
export { DAY_FILE }

export function dayOfFileName(name: string): string | null {
  return DAY_FILE.exec(name)?.[1] ?? null
}

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

/** 本进程内某数据目录的可变状态；持有**本模块副本**的该目录所有 UsageLog 共享（边界见文件头）。 */
interface DirState {
  seen: Set<string>
  queue: Promise<void>
  ready: Promise<void> | undefined
  scanned: boolean
  /** 在途的 {@link DirState} 重建；并发调用方 await 它。 */
  scanning: Promise<void> | undefined
  /** 扫描时尾部没有换行的分日文件名（上个进程写一半崩了）。对这类文件追加时必须
   *  先补一个换行，否则新行会被拼到那半行后面（见 {@link UsageLog.appendOnce}）。 */
  torn: Set<string>
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
    torn: new Set(),
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
    await this.ensureDir()
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
      // 尾部不带换行的文件 = 上个进程写一半崩了留下的半行：记下来，下一次追加先补一个
      // 换行，免得新行被拼到它后面（见 appendOnce）。反过来，良构的尾巴要清掉标记，
      // 使这个集合始终等于「尾行撕裂的那些日文件」。
      if (text !== '' && !text.endsWith('\n')) state.torn.add(name)
      else state.torn.delete(name)
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
   * 扫描失败降级为未扫描写入。
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
      const result = await refileDayFiles(this.dir, this.logger)
      // 被重写（或整份搬空而删掉）的文件尾一定是良构的，清掉它们的撕裂标记。
      for (const name of result.rewritten) state.torn.delete(name)
      moved = result.moved
    })
    state.queue = task.catch(() => {})
    return task.then(() => moved).catch((error: unknown) => {
      this.logger.error('[tokbook] refile by event day failed:', error)
      return 0
    })
  }

  /** 建好数据目录（成功结果按目录缓存）。失败**不得**被永久记住——缓存的 rejected
   *  promise 会让本进程之后的每一次写入都失败到重启为止；这里清掉缓存、把拒绝照旧
   *  抛给调用方，于是障碍解除后的下一次写入自己就能恢复。 */
  private async ensureDir(): Promise<void> {
    const state = this.state
    if (state.ready === undefined) {
      const attempt = mkdir(this.dir, { recursive: true }).then(() => undefined)
      state.ready = attempt
      try {
        await attempt
      } catch (error) {
        if (state.ready === attempt) state.ready = undefined
        throw error
      }
      return
    }
    await state.ready
  }

  /** 追加一行；ready 缓存后目录消失时自愈一次。 */
  private async appendOnce(record: UsageRecord): Promise<void> {
    const path = dayFilePath(this.dir, record.time)
    const line = `${serializeRecord(record)}\n`
    // 该日文件尾部撕裂（上个进程写到一半崩了）时直接追加会把新行拼到那半行后面：两个
    // 身份合成一条非法 JSON 行，已完整写入的那条记录就从所有聚合里消失。先补一个换行
    // 把半行封成它自己那一条坏行，新行因此是可解析的独立行——仍然是纯追加、绝不重写。
    const wasTorn = this.state.torn.delete(dayFileNameOf(record.time))
    try {
      await appendFile(path, `${wasTorn ? '\n' : ''}${line}`, { flag: 'a' })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      // 目录整个没了：它里面那个撕裂文件也一起没了，重试不必再补换行。
      this.state.ready = undefined
      await this.ensureDir()
      await appendFile(path, line, { flag: 'a' })
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

/** 原子重写一个分日文件：解析成功的记录在前，`malformed` 里的畸形行原文原样跟在后面
 *  （日文件平时只追加，只有 refile 这个显式整理动作会重写它）。两者都空 → 删掉该文件。 */
async function rewriteDayFile(
  dir: string,
  name: string,
  records: UsageRecord[],
  malformed: string[] = [],
): Promise<void> {
  const target = join(dir, name)
  if (records.length === 0 && malformed.length === 0) {
    await unlink(target).catch(() => undefined)
    return
  }
  const tmp = join(dir, `${name}.tmp`)
  await writeFile(tmp, `${[...records.map(serializeRecord), ...malformed].join('\n')}\n`, 'utf8')
  await unlink(target).catch(() => undefined)
  await rename(tmp, target)
}

/** 把已解析的行重新分配到其事件时间命名的分日文件。畸形行留在源文件，坏行
 *  绝不被丢掉。 */
async function refileDayFiles(
  dir: string,
  logger: { error(...args: unknown[]): void },
): Promise<{ moved: number; rewritten: Set<string> }> {
  let names: string[]
  try {
    names = (await readdir(dir)).filter(name => DAY_FILE.test(name)).sort()
  } catch (error) {
    logger.error('[tokbook] cannot list data dir ' + dir + ':', error)
    return { moved: 0, rewritten: new Set() }
  }
  let moved = 0
  const rewritten = new Set<string>()
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
      // 接收文件原有的畸形行也要原样带过去：它和源文件里的坏行是同一种事实，
      // 「坏行绝不被丢掉」对两者同样成立。
      const targetLines = await readDayLines(dir, target, logger)
      const existing = targetLines
        .map(line => line.record)
        .filter((record): record is UsageRecord => record !== null)
      const malformed = targetLines.filter(line => line.record === null).map(line => line.raw)
      const seen = new Set(existing.map(record => record.requestId))
      const appended = records.filter(record => !seen.has(record.requestId))
      await rewriteDayFile(dir, target, [...existing, ...appended], malformed)
      rewritten.add(target)
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
    rewritten.add(source)
  }
  return { moved, rewritten }
}
