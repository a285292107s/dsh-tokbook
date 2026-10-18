import { readdir, readFile, stat, rename, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { dayKeyOf } from './price-format.ts'
import { dayOfFileName } from './usage-log.ts'
import { parseRecord } from './usage-record.ts'
import {
  type BillingMap, type CostedSummary, type CostedModelRow, type PricingTable, type ProviderRange, type RateKey, type TokenSummary,
  type UsageDayRow, type UsageHourRow, type UsageModelRow, type UsageRateRow, type UsageRecord,
  type UsageTotals, UNPRICED_KEY,
} from './types.ts'
import { billingOf, costOf, priceOfKey } from './pricing.ts'

export interface PersistenceSnapshotLike {
  header: { id: string; cwd?: string; parentSession?: string; origin?: 'subagent' }
  revision?: unknown
}

export function snapshotBaseline(snapshots: readonly PersistenceSnapshotLike[]): Map<string, string> {
  const baseline = new Map<string, string>()
  for (const snap of snapshots) {
    if (snap.revision === undefined) continue
    baseline.set(snap.header.id, String(snap.revision))
  }
  return baseline
}

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
    if (snap.revision === undefined || syncedBySession.get(id) !== String(snap.revision)) out.push(id)
  }
  return out
}

export function isLedgerStale(
  syncedOnce: boolean,
  syncedBySession: ReadonlyMap<string, string>,
  snapshots: readonly PersistenceSnapshotLike[],
): boolean {
  return staleSessionIds(syncedOnce, syncedBySession, snapshots).length > 0
}

export type RateResolver = (record: UsageRecord) => RateKey

export type StatsLogger = { error(...args: unknown[]): void; info?(...args: unknown[]): void }

const consoleLogger: StatsLogger = console

function hourKey(time: number): string {
  const date = new Date(time)
  const hour = String(date.getHours()).padStart(2, '0')
  return `${dayKeyOf(time)}T${hour}`
}

function dayKeyOffset(day: string, back: number): string {
  const [year, month, date] = day.split('-').map(Number)
  return dayKeyOf(new Date(year!, month! - 1, date! - back).getTime())
}

export function rangeDayWindow(range: ProviderRange, now: () => Date = () => new Date()): { fromDay: string; toDay: string } {
  const to = dayKeyOf(now().getTime())
  if (range === 'all') return { fromDay: '', toDay: to }
  const back = range === 'yesterday' ? 2 : range === 'last7' ? 7 : range === 'last30' ? 30 : 1
  return { fromDay: dayKeyOffset(to, back - 1), toDay: range === 'yesterday' ? dayKeyOffset(to, 1) : to }
}

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

export function clearRecordCache(dir?: string): void {
  if (dir === undefined) dirs.clear()
  else dirs.delete(dir)
}

async function readDayFile(dir: string, name: string, logger: StatsLogger = consoleLogger): Promise<UsageRecord[] | null> {
  let text: string
  try {
    text = await readFile(join(dir, name), 'utf8')
  } catch (error) {
    logger.error(`[tokbook] cannot read ${name}:`, error)
    return null
  }
  const records: UsageRecord[] = []
  for (const line of text.split('\n')) {
    if (line === '') continue
    const record = parseRecord(line)
    if (record !== null) records.push(record)
  }
  return records
}

export async function listDayFiles(dir: string): Promise<string[]> {
  let names: string[]
  try {
    names = await readdir(dir)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  return names.filter(name => dayOfFileName(name) !== null).sort()
}

async function fileStamp(dir: string, name: string): Promise<{ size: number; mtimeMs: number } | null> {
  try {
    const info = await stat(join(dir, name))
    return { size: info.size, mtimeMs: info.mtimeMs }
  } catch {
    return null
  }
}

async function loadFileCached(cache: DirCache, dir: string, name: string, logger: StatsLogger): Promise<UsageRecord[]> {
  return (await loadFileStamped(cache, dir, name, logger)).records
}

async function loadFileStamped(
  cache: DirCache,
  dir: string,
  name: string,
  logger: StatsLogger,
): Promise<{ records: UsageRecord[]; stamp: string | null }> {
  const cached = cache.files.get(name)
  const info = await fileStamp(dir, name)
  if (info === null) {
    cache.files.delete(name)
    return { records: [], stamp: null }
  }
  if (cached !== undefined && cached.size === info.size && cached.mtimeMs === info.mtimeMs) {
    return { records: cached.records, stamp: stampKey(info) }
  }
  const records = await readDayFile(dir, name, logger)
  if (records === null) {
    cache.files.delete(name)
    return { records: [], stamp: null }
  }
  cache.files.set(name, { records, size: info.size, mtimeMs: info.mtimeMs })
  return { records, stamp: stampKey(info) }
}

async function loadDir(dir: string, cache: DirCache, logger: StatsLogger): Promise<UsageRecord[]> {
  const names = await listDayFiles(dir)
  const live = new Set(names)
  for (const name of cache.files.keys()) {
    if (!live.has(name)) cache.files.delete(name)
  }
  const out: UsageRecord[] = []
  for (const name of names) {
    out.push(...await loadFileCached(cache, dir, name, logger))
  }
  return out
}

export async function readCachedRecords(dir: string, logger: StatsLogger = consoleLogger): Promise<UsageRecord[]> {
  const cache = stateOf(dir)
  if (cache.inflight !== undefined) return cache.inflight
  const pending = loadDir(dir, cache, logger).finally(() => {
    if (cache.inflight === pending) cache.inflight = undefined
  })
  cache.inflight = pending
  return pending
}

export async function readRecordsByDayRange(
  dir: string,
  fromDay: string,
  toDay: string,
  logger: StatsLogger = consoleLogger,
): Promise<UsageRecord[]> {
  if (fromDay > toDay) return []
  const cache = stateOf(dir)
  const names: string[] = []
  for (const name of await listDayFiles(dir)) {
    const day = dayOfFileName(name)!
    if (day >= fromDay && day <= toDay) names.push(name)
  }
  const out: UsageRecord[] = []
  for (const name of names) {
    out.push(...await loadFileCached(cache, dir, name, logger))
  }
  return out
}

export async function warmRecordCache(dir: string, logger?: StatsLogger): Promise<void> {
  await readCachedRecords(dir, logger)
}

export const ROLLUP_FILE_NAME = 'rollup.json'

export const ROLLUP_SCHEMA_VERSION = 10

export interface RollupFile {
  schemaVersion: number
  upto: string
  pricingRevision: string
  files: Record<string, string>
  lastEventAt: number | null
  total: UsageTotals
  byDay: UsageDayRow[]
  byHour: UsageHourRow[]
  byModel: UsageModelRow[]
  rateRows: UsageRateRow[]
}

const ROLLUP_FIELDS = ['requests', 'inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens'] as const

function isTotals(value: unknown): value is UsageTotals {
  if (typeof value !== 'object' || value === null) return false
  const totals = value as Record<string, unknown>
  return ROLLUP_FIELDS.every(key => typeof totals[key] === 'number' && Number.isFinite(totals[key]))
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/u

function isFileStamps(value: unknown): value is Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  return Object.entries(value as Record<string, unknown>).every(([name, stamp]) =>
    dayOfFileName(name) !== null && typeof stamp === 'string' && stamp !== '')
}

function isRollupFile(value: unknown): value is RollupFile {
  if (typeof value !== 'object' || value === null) return false
  const rollup = value as Record<string, unknown>
  return rollup.schemaVersion === ROLLUP_SCHEMA_VERSION
    && typeof rollup.upto === 'string' && DAY_KEY.test(rollup.upto)
    && typeof rollup.pricingRevision === 'string'
    && isFileStamps(rollup.files)
    && (rollup.lastEventAt === null
      || (typeof rollup.lastEventAt === 'number' && Number.isFinite(rollup.lastEventAt)))
    && isTotals(rollup.total)
    && Array.isArray(rollup.byDay)
    && Array.isArray(rollup.byHour)
    && Array.isArray(rollup.byModel)
    && Array.isArray(rollup.rateRows)
}

export function rollupIsCurrent(rollup: RollupFile, stamps: ReadonlyMap<string, string>): boolean {
  for (const [name, stamp] of Object.entries(rollup.files)) {
    if (stamps.get(name) !== stamp) return false
  }
  for (const name of stamps.keys()) {
    const day = dayOfFileName(name)
    if (day === null || day > rollup.upto) continue
    if (rollup.files[name] === undefined) return false
  }
  return true
}

export async function readRollup(
  dir: string,
  logger: StatsLogger = consoleLogger,
  pricingRevision: string = '',
): Promise<RollupFile | null> {
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
  if (value.pricingRevision !== pricingRevision) return null
  return value
}

export async function writeRollup(dir: string, rollup: RollupFile): Promise<void> {
  const target = join(dir, ROLLUP_FILE_NAME)
  const tmp = join(dir, `${ROLLUP_FILE_NAME}.tmp`)
  await writeFile(tmp, JSON.stringify({ ...rollup, schemaVersion: ROLLUP_SCHEMA_VERSION }), 'utf8')
  await unlink(target).catch(() => undefined)
  await rename(tmp, target)
}

function emptyTotals(): UsageTotals {
  return {
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    compactions: 0,
    failures: 0,
    usageUnknown: 0,
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
  target.usageUnknown = (target.usageUnknown ?? 0) + (source.usageUnknown ?? 0)
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
  return (left.slot?.start ?? -1) - (right.slot?.start ?? -1)
}

function rateRowsSorted(rows: Iterable<UsageRateRow>): UsageRateRow[] {
  return [...rows].sort((left, right) =>
    left.day < right.day ? -1 : left.day > right.day ? 1
      : left.model < right.model ? -1 : left.model > right.model ? 1
        : left.provider < right.provider ? -1 : left.provider > right.provider ? 1
          : compareKeys(left.rate, right.rate))
}

function providerKey(provider: string | undefined): string {
  return provider ?? ''
}

function modelMapKey(provider: string | undefined, model: string): string {
  return `${providerKey(provider)}\n${model}`
}

function rateRowKey(day: string, model: string, provider: string | undefined, rate: RateKey): string {
  const slot = rate.unpriced === true
    ? 'unpriced'
    : rate.slot === undefined || rate.slot === null ? '-' : `${String(rate.slot.start)}:${rate.slot.days}`
  return `${day}\n${model}\n${providerKey(provider)}\n${slot}`
}

function hourRowKey(hour: string, model: string): string {
  return `${hour}\n${model}`
}

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
  if (usage === undefined) {
    totals.usageUnknown = (totals.usageUnknown ?? 0) + 1
    return
  }
  totals.inputTokens += usage.inputTokens
  totals.outputTokens += usage.outputTokens
  if (usage.cacheReadTokens !== undefined) totals.cacheReadTokens += usage.cacheReadTokens
  if (usage.cacheWriteTokens !== undefined) totals.cacheWriteTokens += usage.cacheWriteTokens
}

export interface SummaryWithLastEvent extends TokenSummary {
  lastEventAt: number | null
}

export function summarizeRecords(records: readonly UsageRecord[], resolve: RateResolver = () => UNPRICED_KEY): SummaryWithLastEvent {
  const total = emptyTotals()
  const days = new Map<string, UsageTotals>()
  const hours = new Map<string, UsageTotals>()
  const models = new Map<string, UsageModelRow>()
  const rated = new Map<string, UsageRateRow>()
  let lastEventAt: number | null = null
  for (const record of records) {
    if (lastEventAt === null || record.time > lastEventAt) lastEventAt = record.time
    addUsage(total, record)
    const day = dayKeyOf(record.time)
    const dayTotals = days.get(day) ?? emptyTotals()
    addUsage(dayTotals, record)
    days.set(day, dayTotals)
    if (record.model !== '') {
      const hour = hourKey(record.time)
      const hourTotals = hours.get(hourRowKey(hour, record.model)) ?? emptyTotals()
      addUsage(hourTotals, record)
      hours.set(hourRowKey(hour, record.model), hourTotals)
      const key = modelMapKey(record.provider, record.model)
      let row = models.get(key)
      if (row === undefined) {
        row = { provider: record.provider ?? '', model: record.model, totals: emptyTotals() }
        models.set(key, row)
      }
      addUsage(row.totals, record)
    }
    const rate = resolve(record)
    const rowKey = rateRowKey(day, record.model, record.provider, rate)
    const cell = rated.get(rowKey)
      ?? { day, model: record.model, provider: record.provider ?? '', rate, totals: emptyTotals() }
    addUsage(cell.totals, record)
    rated.set(rowKey, cell)
  }
  const byDay: UsageDayRow[] = dayRows(days)
  const byHour: UsageHourRow[] = hourRows(hours)
  const byModel: UsageModelRow[] = modelRows(models)
  return { total, byDay, byHour, byModel, rateRows: rateRowsSorted(rated.values()), lastEventAt }
}

export function mergeSummaries(left: SummaryWithLastEvent, right: SummaryWithLastEvent): SummaryWithLastEvent {
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
    const key = modelMapKey(row.provider, row.model)
    const existing = models.get(key)
    const totals = existing?.totals ?? emptyTotals()
    addTotals(totals, row.totals)
    models.set(key, {
      provider: row.provider,
      model: row.model,
      totals,
    })
  }
  for (const row of [...left.rateRows, ...right.rateRows]) {
    const key = rateRowKey(row.day, row.model, row.provider, row.rate)
    const cell = rated.get(key)
      ?? { day: row.day, model: row.model, provider: row.provider, rate: row.rate, totals: emptyTotals() }
    addTotals(cell.totals, row.totals)
    rated.set(key, cell)
  }
  const later = left.lastEventAt === null ? right.lastEventAt
    : right.lastEventAt === null ? left.lastEventAt
      : Math.max(left.lastEventAt, right.lastEventAt)
  return {
    total,
    byDay: dayRows(days),
    byHour: hourRows(hours),
    byModel: modelRows(models),
    rateRows: rateRowsSorted(rated.values()),
    lastEventAt: later,
  }
}

export function attachCosts(
  summary: TokenSummary & { dataDir: string },
  pricing: PricingTable,
  billing: BillingMap = {},
): CostedSummary {
  const costs = new Map<string, number>()
  const spend = new Map<string, number>()
  const value = new Map<string, number>()
  const daySpend = new Map<string, number>()
  const dayValue = new Map<string, number>()
  const unpriced = new Set<string>()
  let totalCost = 0
  let totalSpend = 0
  let totalValue = 0
  for (const row of summary.rateRows) {
    const prices = priceOfKey(pricing, row.provider, row.model, row.rate)
    if (prices === null) {
      if (row.model !== '') unpriced.add(row.model)
      continue
    }
    const cost = costOf(row.totals, prices)
    const key = modelMapKey(row.provider, row.model)
    costs.set(key, (costs.get(key) ?? 0) + cost)
    if (billingOf(billing, row.provider) === 'subscription') {
      value.set(key, (value.get(key) ?? 0) + cost)
      dayValue.set(row.day, (dayValue.get(row.day) ?? 0) + cost)
      totalValue += cost
    } else {
      spend.set(key, (spend.get(key) ?? 0) + cost)
      daySpend.set(row.day, (daySpend.get(row.day) ?? 0) + cost)
      totalSpend += cost
    }
    totalCost += cost
  }
  const byModel: CostedModelRow[] = summary.byModel.map(row => {
    const key = modelMapKey(row.provider, row.model)
    const cost = costs.get(key) ?? 0
    return {
      provider: row.provider,
      model: row.model,
      totals: row.totals,
      cost,
      spend: spend.get(key) ?? 0,
      subscriptionValue: value.get(key) ?? 0,
    }
  })
  const unpricedModels = [...unpriced]
  const byDay: UsageDayRow[] = summary.byDay.map(row => ({
    day: row.day,
    totals: row.totals,
    spend: daySpend.get(row.day) ?? 0,
    subscriptionValue: dayValue.get(row.day) ?? 0,
  }))
  return {
    dataDir: summary.dataDir,
    total: summary.total,
    totalCost,
    spend: totalSpend,
    subscriptionValue: totalValue,
    unpricedModels,
    pricing,
    byDay,
    byHour: summary.byHour,
    byModel,
    rateRows: summary.rateRows,
  }
}

function stampKey(stamp: { size: number; mtimeMs: number }): string {
  return `${String(stamp.size)}:${String(stamp.mtimeMs)}`
}

export async function buildSummary(
  dir: string,
  now: () => Date = () => new Date(),
  resolve: RateResolver = () => UNPRICED_KEY,
  logger: StatsLogger = consoleLogger,
  options: { pricingRevision?: string } = {},
): Promise<SummaryWithLastEvent & { dataDir: string }> {
  const pricingRevision = options.pricingRevision ?? ''
  const today = dayKeyOf(now().getTime())
  const cache = stateOf(dir)
  const names = await listDayFiles(dir)
  const stored = await readRollup(dir, logger, pricingRevision)
  const stamps = new Map<string, string>()
  if (stored !== null) {
    for (const name of names) {
      if (dayOfFileName(name)! > stored.upto) continue
      const stamp = await fileStamp(dir, name)
      if (stamp !== null) stamps.set(name, stampKey(stamp))
    }
  }
  const rollup = stored !== null && rollupIsCurrent(stored, stamps)
    ? stored
    : { schemaVersion: ROLLUP_SCHEMA_VERSION, upto: '', pricingRevision, files: {}, total: emptyTotals(), byDay: [], byHour: [], byModel: [], rateRows: [], lastEventAt: null }
  const cold: string[] = []
  const hot: string[] = []
  for (const name of names) {
    const day = dayOfFileName(name)!
    if (day <= rollup.upto) continue
    if (day < today) cold.push(name)
    else hot.push(name)
  }
  let absorbed = rollup
  if (cold.length > 0) {
    const records: UsageRecord[] = []
    const files: Record<string, string> = { ...rollup.files }
    for (const name of cold) {
      const file = await loadFileStamped(cache, dir, name, logger)
      if (file.stamp !== null) files[name] = file.stamp
      records.push(...file.records)
    }
    absorbed = {
      upto: dayOfFileName(cold[cold.length - 1]!)!,
      schemaVersion: ROLLUP_SCHEMA_VERSION,
      pricingRevision,
      files,
      ...mergeSummaries(rollup, summarizeRecords(records, resolve)),
    }
    await writeRollup(dir, absorbed).catch((error: unknown) => {
      logger.error('[tokbook] cannot write rollup:', error)
    })
  }
  const fresh: UsageRecord[] = []
  for (const name of hot) fresh.push(...await loadFileCached(cache, dir, name, logger))
  return { dataDir: dir, ...mergeSummaries(absorbed, summarizeRecords(fresh, resolve)) }
}
