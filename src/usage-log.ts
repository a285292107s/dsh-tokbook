/**
 * Durable JSONL store of the token-book: per-local-day files, a serialized
 * append queue, and the process-wide request-id dedupe set that both the live
 * hook and the history sync share. A row lands in the day file of its event
 * time (`record.time` in local Y-M-D), never the wall clock of the append —
 * live events and history backfill share that rule.
 *
 * State scoping: the mutable dedupe/queue state is keyed by DATA DIRECTORY,
 * not by UsageLog instance, so every `UsageLog` of one directory that shares
 * THIS module copy also shares one dedupe set and one serialized append queue.
 * That covers same-process overlap: a dependency's dispose → auto-reload, a
 * second instance over service isolation, or a second `TokenUsageBook`
 * constructed while an earlier instance still has queued appends in flight
 * (all within the same loaded module object). Because the JSONL files are the
 * shared resource, the guard around them must be shared too for those writers.
 *
 * This sharing does NOT survive a module-level HMR reload: the cordis-plugin-hmr
 * host reload clears the module cache and re-imports the plugin entry, so the
 * re-created module gets a FRESH `dirs` map. An old instance being disposed
 * keeps flushing through its own (old) queue while the new instance starts its
 * own — the two do not share a dedupe set. Overlap safety across that boundary
 * comes from the disk, not from this map: the new instance re-derives its
 * dedupe set from the on-disk rows before its first write (see `UsageLog.record`),
 * so rows the old instance already landed are not re-appended; a request id
 * re-delivered while the old flush is still in flight is the residual (rare)
 * risk window.
 *
 * A process restart starts with an empty map; the first write of that directory
 * re-derives the dedupe set from the on-disk rows first (see `UsageLog.record`),
 * so a fresh process never re-appends rows that already landed.
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

/**
 * Mutable state of ONE data directory within this process: the dedupe set,
 * the serialized append queue, and the directory readiness/scanned flags.
 * Shared by every UsageLog of that directory that holds THIS module copy (see
 * the module doc) — e.g. a second instance constructed over the same loaded
 * module while the first still has appends in flight shares this state instead
 * of starting from zero. A module-level HMR reload replaces this whole map
 * (fresh module object); the disk, not this map, is the guard across that.
 */
interface DirState {
  seen: Set<string>
  queue: Promise<void>
  ready: Promise<void> | undefined
  scanned: boolean
  /** In-flight {@link DirState} rebuild; concurrent callers await it. */
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

/**
 * Forget one directory's (or every directory's) in-process state. A test /
 * restart seam: a real process restart starts with an empty map, and this
 * reproduces that so a fresh UsageLog over the same directory re-derives the
 * dedupe set from disk exactly like a restarted host would.
 */
export function resetUsageLogState(dir?: string): void {
  if (dir === undefined) dirs.clear()
  else dirs.delete(dir)
}

/**
 * Append-only per-day JSONL log with request-id dedupe.
 *
 * Ordering: every append (and a refile pass) runs on one per-directory promise
 * chain, so concurrent callers land in call order. Dedupe: a request id is
 * claimed synchronously before its append is queued; a failed append releases
 * the claim, so the row can be retried later.
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

  /** Whether a request id is already known to this directory's log. */
  has(requestId: string): boolean {
    return this.state.seen.has(requestId)
  }

  /** Settle every queued append of this directory. The chain never rejects
   * (each task absorbs its own failure), so this is the quiescence point a
   * data-directory move waits on before reading the files. */
  flush(): Promise<void> {
    return this.state.queue
  }

  /**
   * Rebuild the dedupe set from every existing day file, once per directory
   * per process (later calls are a no-op). Malformed lines are skipped;
   * unreadable files are skipped the same way; a failed listing leaves the
   * flag unset so the next call retries.
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

  /** The actual scan; {@link scan} wraps it with the in-flight guard. */
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
   * Persist one record unless its request id was already written.
   * @returns true when the row was appended, false when deduped.
   *
   * The first write of a directory in this process first loads the on-disk
   * rows into the dedupe set, so a restarted host never re-appends rows that
   * already landed. A failing listing never gates a write away — a broken data
   * directory must not drop live records — so in that (already degraded) case
   * the row is written and a later idempotent rescan cleans up. Never rejects:
   * a scan failure degrades to an unscanned write, exactly like the old
   * always-in-memory path.
   */
  record(record: UsageRecord): Promise<boolean> {
    const state = this.state
    if (state.scanned) return this.enqueue(record)
    const scan = state.scanning ?? this.beginScan()
    return scan
      .catch((error: unknown) => {
        // A scan failure (unreadable data dir) must not gate live writes away.
        this.logger.error('[tokbook] cannot rebuild dedupe set; writing without it:', error)
      })
      .then(() => this.enqueue(record))
  }

  /** Start (or await) the one-shot on-disk dedupe rebuild. Callers that must
   * not have the write gated on it use {@link record}; callers that need a
   * settled set before a batch (history sync) await {@link scan} instead. */
  private beginScan(): Promise<void> {
    const state = this.state
    const pending = this.doScan().finally(() => {
      if (state.scanning === pending) state.scanning = undefined
    })
    state.scanning = pending
    return pending
  }

  /** Claim + queue one append against the (already settled) dedupe set. */
  private enqueue(record: UsageRecord): Promise<boolean> {
    const state = this.state
    if (state.seen.has(record.requestId)) return Promise.resolve(false)
    // Claim before queueing: a concurrent call with the same id dedupes here.
    state.seen.add(record.requestId)
    const task = state.queue.then(async () => {
      await this.ensureDir()
      await this.appendOnce(record)
    })
    // A failed append must not poison the chain for later rows.
    state.queue = task.catch(() => {})
    return task
      .then(() => true)
      .catch((error: unknown) => {
        // Release the claim so a later sync can retry this row.
        state.seen.delete(record.requestId)
        this.logger.error('[tokbook] append failed:', error)
        return false
      })
  }

  /** Move rows that sit in the wrong day file onto `dayFileNameOf(record.time)`.
   * Idempotent; runs on the append queue so a live write cannot interleave. */
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

  /** Append one row, self-healing once when the directory vanished after the
   * cached creation. The destination is the local day of {@link UsageRecord.time}. */
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
