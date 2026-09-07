/**
 * Stats computation of the token-book: read the per-day files and fold the
 * records into totals, per-day rows, per-hour rows, per-model rows, and a
 * bounded recent window — keeping one row per (day, model, rate identity) so
 * every record is billed at the rate its own timestamp resolved through (see
 * pricing.resolveRate). Frozen (pre-today) day files are served from the
 * on-disk rollup; only today's file is read on every call. Parsed day files
 * are cached in process memory (frozen files stay resident; today's file is
 * re-read when its size/mtime changes).
 *
 * @module dsh-tokbook/stats
 */

import { readdir, readFile, stat, rename, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { coerceRecord, parseRecord } from './usage-record.ts'
import {
  type CostedSummary, type CostedModelRow, type PricingTable, type ProviderRange, type RateKey, type RecentLedgerEntry, type TokenSummary,
  type UsageDayRow, type UsageHourRow, type UsageModelRow, type UsageRateRow, type UsageRecord,
  type UsageTotals, UNPRICED_KEY, totalsTokens,
} from './types.ts'
import { costOf, ratesForKey, resolveRate } from './pricing.ts'

/** Bounded recent window length: only the newest records cross the wire. */
export const RECENT_LIMIT = 20

/** One persisted-session snapshot as the staleness probe reads it: the header
 * plus, when the backend provides one, a cheap change token (a plain-header
 * `list()` fallback carries no `revision`). */
export interface PersistenceSnapshotLike {
  header: { id: string }
  revision?: unknown
}

/**
 * Build the "known synced through" signature map from a snapshot listing:
 * every snapshot that carries a change token maps `id → String(revision)`.
 * Snapshots without a revision (a plain-header `list()` fallback) are left
 * out, so a session with no change token can never be trusted fresh — it is
 * walked again on every probe (request-id dedupe keeps that idempotent).
 * Shared by the in-memory book-keeping and the on-disk sync baseline, so
 * both derive the same map from the same listing.
 */
export function snapshotBaseline(snapshots: readonly PersistenceSnapshotLike[]): Map<string, string> {
  const baseline = new Map<string, string>()
  for (const snap of snapshots) {
    if (snap.revision === undefined) continue
    baseline.set(snap.header.id, String(snap.revision))
  }
  return baseline
}

/**
 * Which persisted sessions carry work the ledger does not yet hold. Cheap —
 * it reads only per-session metadata (`listSnapshots()`'s opaque `revision`;
 * equal revisions mean an unchanged log). A session whose id has no recorded
 * signature (brand-new, or recorded by an older run that never folded it), a
 * session whose revision drifted since the recorded signature (a changed or
 * appended log), and a session with no change token at all (cannot be
 * trusted fresh) are all returned. The signature map is the union of the
 * in-memory book-keeping and the persisted cross-process baseline: after a
 * restart it is loaded from disk, so an unchanged session is NOT walked again
 * — only sessions that genuinely changed while the process was down (or are
 * new) come back stale. A session deleted from persistence drops out of the
 * change set (there is nothing left to sync) and the next baseline reset
 * removes it from the record. An empty result means the ledger is current.
 *
 * `syncedOnce` is kept for callers without a persisted baseline (first
 * install, torn baseline): when false, every snapshot is stale so the
 * fallback full walk runs and a fresh baseline can be written.
 */
export function staleSessionIds(
  syncedOnce: boolean,
  syncedBySession: ReadonlyMap<string, string>,
  snapshots: readonly PersistenceSnapshotLike[],
): string[] {
  if (!syncedOnce) return snapshots.map(snap => snap.header.id)
  const out: string[] = []
  for (const snap of snapshots) {
    const id = snap.header.id
    if (syncedBySession.get(id) === undefined) {
      out.push(id)
      continue
    }
    // No change token → we cannot tell; walk again (the dedupe makes the
    // re-fold a no-op for unchanged logs).
    if (snap.revision === undefined || syncedBySession.get(id) !== String(snap.revision)) out.push(id)
  }
  return out
}

/**
 * Whether any persisted session carries work the ledger does not yet hold —
 * the boolean form of {@link staleSessionIds} for a plain skip/-sync gate.
 */
export function isLedgerStale(
  syncedOnce: boolean,
  syncedBySession: ReadonlyMap<string, string>,
  snapshots: readonly PersistenceSnapshotLike[],
): boolean {
  return staleSessionIds(syncedOnce, syncedBySession, snapshots).length > 0
}

/** Resolves the rate identity one record was billed at. */
export type RateResolver = (record: UsageRecord) => RateKey

/** Logger face used across the stats module (duck-typed). */
export type StatsLogger = { error(...args: unknown[]): void; info?(...args: unknown[]): void }

const consoleLogger: StatsLogger = console

const DAY_FILE = /^usage-(\d{4}-\d{2}-\d{2})\.jsonl$/u

/** The date part of a day-file name, or null for a foreign name. */
export function fileDay(name: string): string | null {
  return DAY_FILE.exec(name)?.[1] ?? null
}

/** Local date key of a clock reading, matching the day-file naming convention. */
function dayKey(time: number): string {
  const date = new Date(time)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function hourKey(time: number): string {
  const date = new Date(time)
  const hour = String(date.getHours()).padStart(2, '0')
  return `${dayKey(time)}T${hour}`
}

/** Local-midnight epoch of a day key. */
function dayStart(day: string): number {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(year!, month! - 1, date!).getTime()
}

/** Local date key of an epoch offset (n days back from a reference key). */
function dayKeyOffset(day: string, back: number): string {
  const [year, month, date] = day.split('-').map(Number)
  return dayKey(new Date(year!, month! - 1, date! - back).getTime())
}

/** The inclusive local-day bounds of a Provider-usage window: the first and
 * last day key covered, given the local date of "now". `today` covers the
 * running day only; `yesterday` the previous day; `last7`/`last30` count back
 * whole calendar days including today (so a day with no records is skipped by
 * the file reader, never miscounted). */
export function rangeDayWindow(range: ProviderRange, now: () => Date = () => new Date()): { fromDay: string; toDay: string } {
  const to = dayKey(now().getTime())
  const back = range === 'yesterday' ? 2 : range === 'last7' ? 7 : range === 'last30' ? 30 : 1
  return { fromDay: dayKeyOffset(to, back - 1), toDay: range === 'yesterday' ? dayKeyOffset(to, 1) : to }
}

// ---------------------------------------------------------------------------
// Record cache (process-memory parse of day files)
// ---------------------------------------------------------------------------

interface FileEntry {
  records: UsageRecord[]
  size: number
  mtimeMs: number
}

interface DirCache {
  files: Map<string, FileEntry>
  inflight: Promise<UsageRecord[]> | undefined
}

const dirs = new Map<string, DirCache>()

function stateOf(dir: string): DirCache {
  const existing = dirs.get(dir)
  if (existing !== undefined) return existing
  const created: DirCache = { files: new Map(), inflight: undefined }
  dirs.set(dir, created)
  return created
}

/** Drop cached parses. A missing `dir` clears every directory (test seam). */
export function clearRecordCache(dir?: string): void {
  if (dir === undefined) dirs.clear()
  else dirs.delete(dir)
}

async function readDayFile(dir: string, name: string, logger: StatsLogger = consoleLogger): Promise<UsageRecord[]> {
  const text = await readFile(join(dir, name), 'utf8').catch((error: unknown) => {
    logger.error(`[tokbook] cannot read ${name}:`, error)
    return ''
  })
  const records: UsageRecord[] = []
  for (const line of text.split('\n')) {
    if (line === '') continue
    const record = parseRecord(line)
    if (record !== null) records.push(record)
  }
  return records
}

/** List the data directory's day-file names in ascending date order ([] when absent). */
export async function listDayFiles(dir: string): Promise<string[]> {
  let names: string[]
  try {
    names = await readdir(dir)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  return names.filter(name => fileDay(name) !== null).sort()
}

async function fileStamp(dir: string, name: string): Promise<{ size: number; mtimeMs: number } | null> {
  try {
    const info = await stat(join(dir, name))
    return { size: info.size, mtimeMs: info.mtimeMs }
  } catch {
    return null
  }
}

/** Load one day file through the directory cache: frozen (pre-today) files are
 * append-only history, so their first parse is the last; today's file is
 * re-read when its size/mtime changed since the cached parse. Returns the
 * cached records when the cache is warm and current, else a fresh parse. */
async function loadFileCached(cache: DirCache, dir: string, name: string, hot: boolean, logger: StatsLogger): Promise<UsageRecord[]> {
  const cached = cache.files.get(name)
  if (!hot && cached !== undefined) return cached.records
  const stamp = await fileStamp(dir, name)
  if (stamp === null) {
    cache.files.delete(name)
    return []
  }
  if (cached !== undefined && cached.size === stamp.size && cached.mtimeMs === stamp.mtimeMs) {
    return cached.records
  }
  const records = await readDayFile(dir, name, logger)
  cache.files.set(name, { records, size: stamp.size, mtimeMs: stamp.mtimeMs })
  return records
}

async function loadDir(dir: string, cache: DirCache, now: () => Date, logger: StatsLogger): Promise<UsageRecord[]> {
  const today = dayKey(now().getTime())
  const names = await listDayFiles(dir)
  const live = new Set(names)
  for (const name of cache.files.keys()) {
    if (!live.has(name)) cache.files.delete(name)
  }
  const out: UsageRecord[] = []
  for (const name of names) {
    const day = fileDay(name)!
    const hot = day >= today
    out.push(...await loadFileCached(cache, dir, name, hot, logger))
  }
  return out
}

/** Read every day file into records, serving frozen files from memory after
 * the first parse. An absent data directory yields an empty list. */
export async function readCachedRecords(dir: string, now: () => Date = () => new Date(), logger: StatsLogger = consoleLogger): Promise<UsageRecord[]> {
  const cache = stateOf(dir)
  if (cache.inflight !== undefined) return cache.inflight
  const pending = loadDir(dir, cache, now, logger).finally(() => {
    if (cache.inflight === pending) cache.inflight = undefined
  })
  cache.inflight = pending
  return pending
}

/**
 * Read the records of one inclusive local-day window `[fromDay, toDay]`, the
 * reader behind the Provider-usage tab. Only day files inside the window are
 * touched (frozen ones served from the shared parse cache), so a 7/30-day
 * window never costs a full-history decode. A data directory without the
 * window's files yields an empty list; `fromDay > toDay` also reads nothing.
 */
export async function readRecordsByDayRange(
  dir: string,
  fromDay: string,
  toDay: string,
  now: () => Date = () => new Date(),
  logger: StatsLogger = consoleLogger,
): Promise<UsageRecord[]> {
  if (fromDay > toDay) return []
  const cache = stateOf(dir)
  const today = dayKey(now().getTime())
  const names: string[] = []
  for (const name of await listDayFiles(dir)) {
    const day = fileDay(name)!
    if (day >= fromDay && day <= toDay) names.push(name)
  }
  const out: UsageRecord[] = []
  for (const name of names) {
    const hot = fileDay(name)! >= today
    out.push(...await loadFileCached(cache, dir, name, hot, logger))
  }
  return out
}

/** Populate the cache for one directory so the first stats poll is a memory hit. */
export async function warmRecordCache(dir: string, now?: () => Date, logger?: StatsLogger): Promise<void> {
  await readCachedRecords(dir, now, logger)
}

// ---------------------------------------------------------------------------
// Rollup (derived aggregate of frozen day files)
// ---------------------------------------------------------------------------

export const ROLLUP_FILE_NAME = 'rollup.json'

export interface RollupFile {
  upto: string
  total: UsageTotals
  byDay: UsageDayRow[]
  byHour: UsageHourRow[]
  byModel: UsageModelRow[]
  rateRows: UsageRateRow[]
  recent: UsageRecord[]
}

const ROLLUP_FIELDS = ['requests', 'inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens'] as const

function isTotals(value: unknown): value is UsageTotals {
  if (typeof value !== 'object' || value === null) return false
  const totals = value as Record<string, unknown>
  return ROLLUP_FIELDS.every(key => typeof totals[key] === 'number' && Number.isFinite(totals[key]))
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/u
const HOUR_KEY = /^\d{4}-\d{2}-\d{2}T\d{2}$/u

function isRateKey(value: unknown): value is RateKey {
  if (typeof value !== 'object' || value === null) return false
  const key = value as Record<string, unknown>
  return ['ruleStart', 'ruleEnd', 'tier', 'slot'].every(field => typeof key[field] === 'number' && Number.isFinite(key[field]))
}

function isRollupFile(value: unknown): value is RollupFile {
  if (typeof value !== 'object' || value === null) return false
  const rollup = value as Record<string, unknown>
  return typeof rollup.upto === 'string' && DAY_KEY.test(rollup.upto)
    && isTotals(rollup.total)
    && Array.isArray(rollup.byDay)
    && Array.isArray(rollup.byHour)
    && Array.isArray(rollup.byModel)
    && Array.isArray(rollup.rateRows)
    && Array.isArray(rollup.recent)
}

/** Load the rollup of one data directory. A missing, malformed, or invalid
 * rollup reads as null — the caller then rebuilds it from the day files. */
export async function readRollup(dir: string, logger: StatsLogger = consoleLogger): Promise<RollupFile | null> {
  let text: string
  try {
    text = await readFile(join(dir, ROLLUP_FILE_NAME), 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    logger.error('[tokbook] cannot read rollup:', error)
    return null
  }
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return null
  }
  if (!isRollupFile(value)) return null
  const recent = (value.recent as unknown[])
    .map(coerceRecord)
    .filter((record): record is UsageRecord => record !== null)
  return { ...value, recent }
}

/** Persist the rollup atomically (temp file + rename), so a crash mid-write
 * leaves either the old or the new rollup, never a torn one. The target is
 * unlinked first: Windows rename-over-existing fails intermittently. */
export async function writeRollup(dir: string, rollup: RollupFile): Promise<void> {
  const target = join(dir, ROLLUP_FILE_NAME)
  const tmp = join(dir, `${ROLLUP_FILE_NAME}.tmp`)
  await writeFile(tmp, JSON.stringify(rollup), 'utf8')
  await unlink(target).catch(() => undefined)
  await rename(tmp, target)
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

/** Zeroed totals; requests counts rows, the token buckets sum reported usage. */
export function emptyTotals(): UsageTotals {
  return {
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    compactions: 0,
    failures: 0,
  }
}

function addTotals(target: UsageTotals, source: UsageTotals): void {
  target.requests += source.requests
  target.inputTokens += source.inputTokens
  target.outputTokens += source.outputTokens
  target.cacheReadTokens += source.cacheReadTokens
  target.cacheWriteTokens += source.cacheWriteTokens
  target.compactions = (target.compactions ?? 0) + (source.compactions ?? 0)
  target.failures = (target.failures ?? 0) + (source.failures ?? 0)
  const codes = source.failuresByCode
  if (codes !== undefined) {
    const merged = target.failuresByCode ?? {}
    for (const [code, count] of Object.entries(codes)) {
      merged[code] = (merged[code] ?? 0) + count
    }
    target.failuresByCode = merged
  }
}

function dayRows(days: Map<string, UsageTotals>): UsageDayRow[] {
  return [...days.entries()]
    .map(([day, totals]) => ({ day, totals }))
    .sort((left, right) => left.day < right.day ? -1 : 1)
}

function modelRows(models: Map<string, UsageModelRow>): UsageModelRow[] {
  return [...models.values()]
    .sort((left, right) =>
      right.totals.requests - left.totals.requests || left.model.localeCompare(right.model))
}

function hourRows(hours: Map<string, UsageTotals>): UsageHourRow[] {
  return [...hours.entries()]
    .map(([key, totals]) => {
      const separator = key.indexOf('\n')
      return { hour: key.slice(0, separator), model: key.slice(separator + 1), totals }
    })
    .sort((left, right) =>
      left.hour < right.hour ? -1 : left.hour > right.hour ? 1 : left.model.localeCompare(right.model))
}

function compareKeys(left: RateKey, right: RateKey): number {
  return left.ruleStart - right.ruleStart || left.ruleEnd - right.ruleEnd
    || left.tier - right.tier || left.slot - right.slot
}

function rateRowsSorted(rows: Iterable<UsageRateRow>): UsageRateRow[] {
  return [...rows].sort((left, right) =>
    left.day < right.day ? -1 : left.day > right.day ? 1
      : left.model < right.model ? -1 : left.model > right.model ? 1
        : compareKeys(left.rate, right.rate))
}

function rateRowKey(day: string, model: string, rate: RateKey): string {
  return `${day}\n${model}\n${rate.ruleStart}-${rate.ruleEnd}-${rate.tier}-${rate.slot}`
}

function hourRowKey(hour: string, model: string): string {
  return `${hour}\n${model}`
}

/** Fold one record into totals; a record without provider usage still counts a
 * request, and a failure record counts only the `failures` dimension. */
function addUsage(totals: UsageTotals, record: UsageRecord): void {
  if (record.kind === 'failure') {
    totals.failures = (totals.failures ?? 0) + 1
    const code = record.failureCode ?? 'UNKNOWN'
    const byCode = totals.failuresByCode ?? {}
    byCode[code] = (byCode[code] ?? 0) + 1
    totals.failuresByCode = byCode
    return
  }
  totals.requests += 1
  if (record.kind === 'compaction') {
    totals.compactions = (totals.compactions ?? 0) + 1
  }
  const usage = record.usage
  if (usage === undefined) return
  totals.inputTokens += usage.inputTokens
  totals.outputTokens += usage.outputTokens
  if (usage.cacheReadTokens !== undefined) totals.cacheReadTokens += usage.cacheReadTokens
  if (usage.cacheWriteTokens !== undefined) totals.cacheWriteTokens += usage.cacheWriteTokens
}

/** Fold records into the token-summary shape, one rate row per (day, model,
 * rate identity) the resolver assigns. */
export function summarizeRecords(records: readonly UsageRecord[], resolve: RateResolver = () => ({ ruleStart: 0, ruleEnd: 0, tier: 0, slot: -1 })): TokenSummary {
  const total = emptyTotals()
  const days = new Map<string, UsageTotals>()
  const hours = new Map<string, UsageTotals>()
  const models = new Map<string, UsageModelRow>()
  const rated = new Map<string, UsageRateRow>()
  const recent: UsageRecord[] = []
  for (const record of records) {
    addUsage(total, record)
    const day = dayKey(record.time)
    const dayTotals = days.get(day) ?? emptyTotals()
    addUsage(dayTotals, record)
    days.set(day, dayTotals)
    // An unattributed failure (`model === ''`) still folds into totals and
    // byDay; it stays out of byModel / byHour — a blank table row would
    // pretend we know the route.
    if (record.model !== '') {
      const hour = hourKey(record.time)
      const hourTotals = hours.get(hourRowKey(hour, record.model)) ?? emptyTotals()
      addUsage(hourTotals, record)
      hours.set(hourRowKey(hour, record.model), hourTotals)
      const key = record.model
      let row = models.get(key)
      if (row === undefined) {
        row = { provider: record.provider ?? '', model: key, totals: emptyTotals() }
        models.set(key, row)
      }
      addUsage(row.totals, record)
      if (row.provider === '' && record.provider !== undefined) row.provider = record.provider
    }
    const rate = resolve(record)
    const rowKey = rateRowKey(day, record.model, rate)
    const cell = rated.get(rowKey)
      ?? { day, model: record.model, rate, totals: emptyTotals() }
    addUsage(cell.totals, record)
    rated.set(rowKey, cell)
    if (recent.length === RECENT_LIMIT) recent.shift()
    recent.push(record)
  }
  const byDay: UsageDayRow[] = dayRows(days)
  const byHour: UsageHourRow[] = hourRows(hours)
  const byModel: UsageModelRow[] = modelRows(models)
  recent.sort((left, right) => right.time - left.time)
  return { total, byDay, byHour, byModel, rateRows: rateRowsSorted(rated.values()), recent }
}

/** Merge two summaries into one. Order-independent and associative. */
export function mergeSummaries(left: TokenSummary, right: TokenSummary): TokenSummary {
  const total = emptyTotals()
  addTotals(total, left.total)
  addTotals(total, right.total)
  const days = new Map<string, UsageTotals>()
  const hours = new Map<string, UsageTotals>()
  const models = new Map<string, UsageModelRow>()
  const rated = new Map<string, UsageRateRow>()
  for (const row of [...left.byDay, ...right.byDay]) {
    const day = days.get(row.day) ?? emptyTotals()
    addTotals(day, row.totals)
    days.set(row.day, day)
  }
  for (const row of [...left.byHour, ...right.byHour]) {
    const key = hourRowKey(row.hour, row.model)
    const cell = hours.get(key) ?? emptyTotals()
    addTotals(cell, row.totals)
    hours.set(key, cell)
  }
  for (const row of [...left.byModel, ...right.byModel]) {
    const existing = models.get(row.model)
    const totals = existing?.totals ?? emptyTotals()
    addTotals(totals, row.totals)
    models.set(row.model, {
      provider: existing?.provider !== '' ? existing?.provider ?? row.provider : row.provider,
      model: row.model,
      totals,
    })
  }
  for (const row of [...left.rateRows, ...right.rateRows]) {
    const key = rateRowKey(row.day, row.model, row.rate)
    const cell = rated.get(key)
      ?? { day: row.day, model: row.model, rate: row.rate, totals: emptyTotals() }
    addTotals(cell.totals, row.totals)
    rated.set(key, cell)
  }
  const recent = [...left.recent, ...right.recent]
    .sort((a, b) => b.time - a.time)
    .slice(0, RECENT_LIMIT)
  return {
    total,
    byDay: dayRows(days),
    byHour: hourRows(hours),
    byModel: modelRows(models),
    rateRows: rateRowsSorted(rated.values()),
    recent,
  }
}

/** Attach the cost layer to a token-only summary: each rate row is priced at
 * the prices its rate identity resolves to under the current table. */
export function attachCosts(summary: TokenSummary & { dataDir: string }, pricing: PricingTable): CostedSummary {
  const costs = new Map<string, number>()
  let totalCost = 0
  for (const row of summary.rateRows) {
    const rules = pricing[row.model]
    if (rules === undefined) continue
    const cost = costOf(row.totals, ratesForKey(rules, row.rate))
    costs.set(row.model, (costs.get(row.model) ?? 0) + cost)
    totalCost += cost
  }
  const byModel: CostedModelRow[] = summary.byModel.map(row => ({
    provider: row.provider,
    model: row.model,
    totals: row.totals,
    cost: costs.get(row.model) ?? 0,
  }))
  const unpricedModels = summary.byModel
    .filter(row => pricing[row.model] === undefined)
    .map(row => row.model)
  return {
    dataDir: summary.dataDir,
    total: summary.total,
    totalCost,
    unpricedModels,
    pricing,
    byDay: summary.byDay,
    byHour: summary.byHour,
    byModel,
    rateRows: summary.rateRows,
    recent: summary.recent,
  }
}

/**
 * Price the recent-window ledger rows for the floating window's 最近记录
 * list: each request is billed at the rate its own timestamp and context
 * resolved to (the same `resolveRate → costOf` chain the overview's totals
 * use), so a single row's ¥ is exactly the amount the totals folded in.
 * Deliberately read-time and additive: nothing is persisted, and a price
 * table change re-prices the list on the next read. Rows that bill nothing
 * carry 0 — a failed attempt (no tokens ever billed), a request with no
 * provider-reported usage, or a model absent from the price table.
 */
export function costRecentEntries(
  recent: readonly UsageRecord[],
  pricing: PricingTable,
  resolve: RateResolver = () => UNPRICED_KEY,
): RecentLedgerEntry[] {
  return recent.map((record) => {
    const rules = pricing[record.model]
    if (rules === undefined) return { ...record, cost: 0 }
    const usage = record.usage
    if (usage === undefined) return { ...record, cost: 0 }
    const contextTokens = usage.inputTokens
      + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0)
    const { key } = resolveRate(rules, record.time, contextTokens)
    const prices = ratesForKey(rules, key)
    // Cost the four buckets as the totals layer would (absent cache buckets
    // read as 0, never NaN).
    return {
      ...record,
      cost: costOf({
        requests: 0,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cacheReadTokens: usage.cacheReadTokens ?? 0,
        cacheWriteTokens: usage.cacheWriteTokens ?? 0,
      }, prices),
    }
  })
}

/** Build the full stats payload for one data directory: the rollup over every
 * frozen day file merged with a fresh read of today's file. */
export async function buildSummary(
  dir: string,
  now: () => Date = () => new Date(),
  resolve: RateResolver = () => ({ ruleStart: 0, ruleEnd: 0, tier: 0, slot: -1 }),
  logger: StatsLogger = consoleLogger,
): Promise<TokenSummary & { dataDir: string }> {
  const today = dayKey(now().getTime())
  const rollup = (await readRollup(dir, logger)) ?? { upto: '', total: emptyTotals(), byDay: [], byHour: [], byModel: [], rateRows: [], recent: [] }
  const cold: string[] = []
  const hot: string[] = []
  for (const name of await listDayFiles(dir)) {
    const day = fileDay(name)!
    if (day <= rollup.upto) continue
    if (day < today) cold.push(name)
    else hot.push(name)
  }
  let absorbed = rollup
  if (cold.length > 0) {
    const records: UsageRecord[] = []
    for (const name of cold) records.push(...await readDayFile(dir, name, logger))
    absorbed = {
      upto: fileDay(cold[cold.length - 1]!)!,
      ...mergeSummaries(rollup, summarizeRecords(records, resolve)),
    }
    await writeRollup(dir, absorbed).catch((error: unknown) => {
      logger.error('[tokbook] cannot write rollup:', error)
    })
  }
  const fresh: UsageRecord[] = []
  for (const name of hot) fresh.push(...await readDayFile(dir, name, logger))
  return { dataDir: dir, ...mergeSummaries(absorbed, summarizeRecords(fresh, resolve)) }
}

export { totalsTokens, UNPRICED_KEY }
