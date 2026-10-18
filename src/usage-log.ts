import { appendFile, mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseRecord, serializeRecord } from './usage-record.ts'
import type { UsageRecord } from './types.ts'

const DAY_FILE = /^usage-(\d{4}-\d{2}-\d{2})\.jsonl$/u

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

export function dayFileNameOf(time: number): string {
  return dayFileName(new Date(time))
}

function dayFilePath(dir: string, time: number): string {
  return join(dir, dayFileNameOf(time))
}

interface DirState {
  seen: Set<string>
  queue: Promise<void>
  ready: Promise<void> | undefined
  scanned: boolean
  scanning: Promise<void> | undefined
  torn: Set<string>
  generation: number
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
    generation: 0,
  }
  dirs.set(dir, created)
  return created
}

export function ledgerGeneration(dir: string): number {
  return stateOf(dir).generation
}

export function resetUsageLogState(dir?: string): void {
  if (dir === undefined) dirs.clear()
  else dirs.delete(dir)
}

export class UsageLog {
  private readonly dir: string
  private readonly logger: { error(...args: unknown[]): void }
  private readonly state: DirState

  constructor(dir: string, logger: { error(...args: unknown[]): void } = console) {
    this.dir = dir
    this.logger = logger
    this.state = stateOf(dir)
  }

  has(requestId: string): boolean {
    return this.state.seen.has(requestId)
  }

  flush(): Promise<void> {
    return this.state.queue
  }

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

  record(record: UsageRecord): Promise<boolean> {
    const state = this.state
    if (state.scanned) return this.enqueue(record)
    const scan = state.scanning ?? this.beginScan()
    return scan
      .catch((error: unknown) => {
        this.logger.error('[tokbook] cannot rebuild dedupe set; writing without it:', error)
      })
      .then(() => this.enqueue(record))
  }

  private beginScan(): Promise<void> {
    const state = this.state
    const pending = this.doScan().finally(() => {
      if (state.scanning === pending) state.scanning = undefined
    })
    state.scanning = pending
    return pending
  }

  private enqueue(record: UsageRecord): Promise<boolean> {
    const state = this.state
    if (state.seen.has(record.requestId)) return Promise.resolve(false)
    state.seen.add(record.requestId)
    const task = state.queue.then(async () => {
      await this.ensureDir()
      await this.appendOnce(record)
      state.generation += 1
    })
    state.queue = task.catch(() => {})
    return task
      .then(() => true)
      .catch((error: unknown) => {
        state.seen.delete(record.requestId)
        this.logger.error('[tokbook] append failed:', error)
        return false
      })
  }

  refileByEventDay(): Promise<number> {
    let moved = 0
    const state = this.state
    const task = state.queue.then(async () => {
      await this.ensureDir()
      const result = await refileDayFiles(this.dir, this.logger)
      for (const name of result.rewritten) state.torn.delete(name)
      moved = result.moved
      if (moved > 0) state.generation += 1
    })
    state.queue = task.catch(() => {})
    return task.then(() => moved).catch((error: unknown) => {
      this.logger.error('[tokbook] refile by event day failed:', error)
      return 0
    })
  }

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

  private async appendOnce(record: UsageRecord): Promise<void> {
    const path = dayFilePath(this.dir, record.time)
    const line = `${serializeRecord(record)}\n`
    const wasTorn = this.state.torn.delete(dayFileNameOf(record.time))
    try {
      await appendFile(path, `${wasTorn ? '\n' : ''}${line}`, { flag: 'a' })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
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
