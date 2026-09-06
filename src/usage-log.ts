/**
 * Durable JSONL store of the token-book: per-local-day files, a serialized
 * append queue, and the process-wide request-id dedupe set that both the live
 * hook and the history sync share. A row lands in the day file of its event
 * time (`record.time` in local Y-M-D), never the wall clock of the append —
 * live events and history backfill share that rule.
 *
 * @module dsh-tokbook/usage-log
 */

import { appendFile, mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseRecord, serializeRecord } from './usage-record.ts'
import type { UsageRecord } from './types.ts'

const DAY_FILE = /^usage-\d{4}-\d{2}-\d{2}\.jsonl$/u

/** Test for this store's per-day file names; the migration shares the naming contract. */
export { DAY_FILE }

/** Day-file name for a local-time date, e.g. `usage-2026-01-15.jsonl`. */
export function dayFileName(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `usage-${year}-${month}-${day}.jsonl`
}

/** Day-file name of a record's event time, matching {@link dayFileName}. */
export function dayFileNameOf(time: number): string {
  return dayFileName(new Date(time))
}

function dayFilePath(dir: string, time: number): string {
  return join(dir, dayFileNameOf(time))
}

/** Append-only per-day JSONL log with request-id dedupe.
 *
 * Ordering: every append (and a refile pass) runs on one promise chain, so
 * concurrent callers land in call order. Dedupe: a request id is claimed
 * synchronously before its append is queued; a failed append releases the
 * claim, so the row can be retried later. */
export class UsageLog {
  private readonly seen = new Set<string>()
  private queue: Promise<void> = Promise.resolve()
  private ready: Promise<void> | undefined
  /** Whether {@link scan} has rebuilt the dedupe set this process. Only the
   * live hook and the sync write rows — both through this instance's `seen` —
   * so one rebuild per process is sufficient and later calls are a no-op. */
  private scanned = false
  private readonly dir: string
  private readonly logger: { error(...args: unknown[]): void }

  constructor(dir: string, logger: { error(...args: unknown[]): void } = console) {
    this.dir = dir
    this.logger = logger
  }

  /** Whether a request id is already known to this log. */
  has(requestId: string): boolean {
    return this.seen.has(requestId)
  }

  /** Settle every queued append. The chain never rejects (each task absorbs
   * its own failure), so this is the quiescence point a data-directory move
   * waits on before reading the files. */
  flush(): Promise<void> {
    return this.queue
  }

  /** Rebuild the dedupe set from every existing day file, once per process
   * (later calls are a no-op — see {@link UsageLog.scanned}). Malformed lines
   * are skipped; unreadable files are skipped the same way; a failed listing
   * leaves the flag unset so the next call retries. */
  async scan(): Promise<void> {
    if (this.scanned) return
    this.ready ??= mkdir(this.dir, { recursive: true }).then(() => undefined)
    await this.ready
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
        this.seen.add(record.requestId)
      }
    }
    this.scanned = true
  }

  /** Persist one record unless its request id was already written.
   * @returns true when the row was appended, false when deduped. */
  record(record: UsageRecord): Promise<boolean> {
    if (this.seen.has(record.requestId)) return Promise.resolve(false)
    // Claim before queueing: a concurrent call with the same id dedupes here.
    this.seen.add(record.requestId)
    const task = this.queue.then(async () => {
      await this.ensureDir()
      await this.appendOnce(record)
    })
    // A failed append must not poison the chain for later rows.
    this.queue = task.catch(() => {})
    return task
      .then(() => true)
      .catch((error: unknown) => {
        // Release the claim so a later sync can retry this row.
        this.seen.delete(record.requestId)
        this.logger.error('[tokbook] append failed:', error)
        return false
      })
  }

  /** Move rows that sit in the wrong day file onto `dayFileNameOf(record.time)`.
   * Idempotent; runs on the append queue so a live write cannot interleave. */
  refileByEventDay(): Promise<number> {
    let moved = 0
    const task = this.queue.then(async () => {
      await this.ensureDir()
      moved = await refileDayFiles(this.dir, this.logger)
    })
    this.queue = task.catch(() => {})
    return task.then(() => moved).catch((error: unknown) => {
      this.logger.error('[tokbook] refile by event day failed:', error)
      return 0
    })
  }

  private async ensureDir(): Promise<void> {
    this.ready ??= mkdir(this.dir, { recursive: true }).then(() => undefined)
    await this.ready
  }

  /** Append one row, self-healing once when the directory vanished after the
   * cached creation. The destination is the local day of {@link UsageRecord.time}. */
  private async appendOnce(record: UsageRecord): Promise<void> {
    const path = dayFilePath(this.dir, record.time)
    try {
      await appendFile(path, `${serializeRecord(record)}\n`, { flag: 'a' })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      this.ready = undefined
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

/** Redistribute parsed rows onto the day file their event time names.
 * Malformed lines stay in the source file so a bad row is never dropped. */
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
