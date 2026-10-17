/**
 * dsh-tokbook 的 stats 计算：读各分日文件，折成 totals、按日 / 按小时 /
 * 按 (provider, model) 行——并保留一行 (日, 模型, provider, rate 身份)。
 * 已冻结的分日文件从落盘 rollup 提供；只有今日文件每次调用都读。解析后的
 * 分日文件缓存在进程内存。
 */

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

/** 与 sync.ts 的 `PersistenceSnapshotLike` 同形——变更令牌与 `cwd` 的外部事实
 *  记在那份注释里。 */
export interface PersistenceSnapshotLike {
  header: { id: string; cwd?: string }
  revision?: unknown
}

/**
 * 从快照 listing 构建「已同步到哪」的签名映射：每个带变更令牌的快照映射
 * `id → String(revision)`。没有 revision 的快照被跳过——没有令牌就永远不可
 * 信任为「新鲜」（处理与其理由见 {@link staleSessionIds} 的行内注释）。
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
 * 哪些持久化会话带着账本尚未持有的工作。廉价——只读每会话元数据。
 * 会话 id 无记录签名、revision 相对记录签名漂移、以及完全没有变更令牌的
 * 会话都会返回。`syncedOnce` 为 false 时每个快照都算陈旧（首次安装、基线撕裂）。
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
    // 无变更令牌 → 无法判断；再走一遍（去重使对未变日志的重折叠为空操作）。
    if (snap.revision === undefined || syncedBySession.get(id) !== String(snap.revision)) out.push(id)
  }
  return out
}

/** {@link staleSessionIds} 的布尔形，供朴素的 skip/-sync 门使用。 */
export function isLedgerStale(
  syncedOnce: boolean,
  syncedBySession: ReadonlyMap<string, string>,
  snapshots: readonly PersistenceSnapshotLike[],
): boolean {
  return staleSessionIds(syncedOnce, syncedBySession, snapshots).length > 0
}

/** 解析一条记录计费所依据的 rate 身份。 */
export type RateResolver = (record: UsageRecord) => RateKey

/** stats 模块使用的 logger 面（duck-typed）。 */
export type StatsLogger = { error(...args: unknown[]): void; info?(...args: unknown[]): void }

const consoleLogger: StatsLogger = console

/** 归日一律走共享的那一份 `dayKeyOf`（`price-format.ts`）：读路径别处也按本地日
 *  挑行（如会话页的今日支出），两份实现漂移就是同一笔金额在两张脸上对不上。 */
function hourKey(time: number): string {
  const date = new Date(time)
  const hour = String(date.getHours()).padStart(2, '0')
  return `${dayKeyOf(time)}T${hour}`
}

function dayKeyOffset(day: string, back: number): string {
  const [year, month, date] = day.split('-').map(Number)
  return dayKeyOf(new Date(year!, month! - 1, date! - back).getTime())
}

/** 用量窗口的本地日闭区间：给定「现在」的本地日期，返回覆盖的首日与末日键。
 *  `today` 只盖当日；`yesterday` 盖前一天；`last7`/`last30` 向前数整个日历日
 *  （含今日）；`all` = 全账本，`fromDay` 为**空串**（不设下界，`readRecordsByDayRange`
 *  据此读全部日文件）。 */
export function rangeDayWindow(range: ProviderRange, now: () => Date = () => new Date()): { fromDay: string; toDay: string } {
  const to = dayKeyOf(now().getTime())
  if (range === 'all') return { fromDay: '', toDay: to }
  const back = range === 'yesterday' ? 2 : range === 'last7' ? 7 : range === 'last30' ? 30 : 1
  return { fromDay: dayKeyOffset(to, back - 1), toDay: range === 'yesterday' ? dayKeyOffset(to, 1) : to }
}

// ---------------------------------------------------------------------------
// 记录缓存（分日文件的进程内存解析）
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

/** 丢弃缓存的解析。省略 `dir` 清空所有目录（测试缝）。 */
export function clearRecordCache(dir?: string): void {
  if (dir === undefined) dirs.clear()
  else dirs.delete(dir)
}

/** 读一个分日文件并解析。**读失败返回 null，绝不返回「空」**——两者必须可分：
 *  「这天没有记录」是事实，「这天读不到」是未知，把后者折叠成前者会让这一天永久
 *  少算（见 {@link loadFileStamped}）。读失败仍留一条 error 日志。 */
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

/** 列出数据目录中按日期升序的分日文件名（目录不存在时为 []）。 */
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

/** 经目录缓存加载一个分日文件：解析结果按 `size:mtimeMs` 版本缓存——版本没变就复用
 *  内存里那份，变过就重读。**不把「今日之前」当成不可变**（往日会被追加），冻结日
 *  同样过一次版本核对——一次 `stat`，省下的是整份解码；道理见 docs/CONTRACTS.md §2。 */
async function loadFileCached(cache: DirCache, dir: string, name: string, logger: StatsLogger): Promise<UsageRecord[]> {
  return (await loadFileStamped(cache, dir, name, logger)).records
}

/** {@link loadFileCached} 的带版本形：版本核对与解码在同一次 `stat` 里做完，所以
 *  折叠要记下自己所依据的文件版本时不必为同一份文件再 `stat` 一遍。
 *
 *  `stamp` 为 null = 这一次**没读到内容**（读失败，或 stat 不到）：记录降级为空，
 *  但版本戳缺席，折叠因此不会把这一天记进 `files`，下一次读就会因「水位线之内的
 *  文件不在 files 里」整份作废重折 → 自愈。 */
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
    // 读失败：降级为空（一个被占用的文件不该让整个概览 500），但**不缓存、也不
    // 返回版本戳**——按文件真实的 size:mtimeMs 缓存这个空结果、再把它记进折叠的
    // `files`，会让折叠在文件未变时永远自称「最新」，这一天就一直读 0，不会自愈。
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

/** 读入所有分日文件为记录，未变过的文件从内存提供。数据目录不存在时返回空列表。 */
export async function readCachedRecords(dir: string, logger: StatsLogger = consoleLogger): Promise<UsageRecord[]> {
  const cache = stateOf(dir)
  if (cache.inflight !== undefined) return cache.inflight
  const pending = loadDir(dir, cache, logger).finally(() => {
    if (cache.inflight === pending) cache.inflight = undefined
  })
  cache.inflight = pending
  return pending
}

/**
 * 读闭区间 `[fromDay, toDay]` 内的记录——Provider 用量 tab 背后的读取器。
 * 只碰窗口内的分日文件（冻结文件走共享解析缓存），故 7/30 天窗口从不付出全史
 * 解码的代价。
 */
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

/** 预热一个目录的缓存，使首次 stats 轮询是内存命中。 */
export async function warmRecordCache(dir: string, logger?: StatsLogger): Promise<void> {
  await readCachedRecords(dir, logger)
}

// ---------------------------------------------------------------------------
// Rollup（冻结分日文件的派生聚合）
// ---------------------------------------------------------------------------

export const ROLLUP_FILE_NAME = 'rollup.json'

/** 折叠格式版本。10：价表去掉生效时间轴，`RateKey` 不再带 `from`——旧折叠的 rate 行
 *  按旧身份回查（价格表里已没有那根轴）会整批落空，读成价格未知（¥0），故必须 +1 强制重建。 */
export const ROLLUP_SCHEMA_VERSION = 10

export interface RollupFile {
  schemaVersion: number
  upto: string
  /** 折叠所依据的价文件签名；不符整份作废、从日文件重建（docs/CONTRACTS.md §2）。
   *  空 = 无价文件。 */
  pricingRevision: string
  /** 折进去的每一天分日文件**当时的版本**（`size:mtimeMs`）。折叠为何得自己记
   *  文件版本，见 docs/CONTRACTS.md §2 的 `rollup.json` 条（天级水位线 `upto`
   *  看不见往日被追加）。 */
  files: Record<string, string>
  /** 折进去的记录里最大的事件时刻（epoch ms；`null` = 折进去的日子里一条记录都没有）。
   *  概览的 `lastEventAt` 由它出，读路径因此不必为求一个 max 物化整本账。 */
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

/** 折叠记下的文件版本表：键必须是本存储的分日文件名，值为非空版本串。 */
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

/** 折叠是否仍与磁盘上的分日文件相符：它折进去的每一天都还在、且版本没变，
 *  水位线之内也没有冒出折叠时还不存在的日文件。不相符就整份丢弃重折——
 *  为何逐版本核对而非只认 `upto`，见 docs/CONTRACTS.md §2。 */
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

/** 加载一个数据目录的 rollup。缺失、畸形或价签名不符都读作 null——调用方
 *  随后从分日文件重建。 */
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

/** 原子落盘 rollup（临时文件 + rename），写中崩溃只会留下旧的或新的，绝非
 * 撕裂的。先 unlink 目标：Windows 覆盖 rename 间歇失败。盖上当前 schema 版本，
 * 旧格式 rollup 读作不存在并重建。 */
export async function writeRollup(dir: string, rollup: RollupFile): Promise<void> {
  const target = join(dir, ROLLUP_FILE_NAME)
  const tmp = join(dir, `${ROLLUP_FILE_NAME}.tmp`)
  await writeFile(tmp, JSON.stringify({ ...rollup, schemaVersion: ROLLUP_SCHEMA_VERSION }), 'utf8')
  await unlink(target).catch(() => undefined)
  await rename(tmp, target)
}

// ---------------------------------------------------------------------------
// 聚合
// ---------------------------------------------------------------------------

/** 置零的 totals。 */
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

/** 一条记录在聚合身份中的 provider 键（'' = 未归属，界面上显示「(未知)」）。 */
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

/** 把一条记录折入 totals：失败记录只进 `failures` 维度；用量未知的记录仍计
 *  入 `requests` 并另计 `usageUnknown`（未知 ≠ 0，口径见 docs/CONTRACTS.md §2）。 */
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
    // 通道没回报用量（多为中途取消的请求）：调用确实发生了，所以计入次数，
    // 但没有 token 可加——单独计数，绝不把它当成一次零消耗的调用。
    totals.usageUnknown = (totals.usageUnknown ?? 0) + 1
    return
  }
  totals.inputTokens += usage.inputTokens
  totals.outputTokens += usage.outputTokens
  if (usage.cacheReadTokens !== undefined) totals.cacheReadTokens += usage.cacheReadTokens
  if (usage.cacheWriteTokens !== undefined) totals.cacheWriteTokens += usage.cacheWriteTokens
}

/** 纯 token 聚合 + 账本最大事件时刻（`null` = 没有记录）。概览的 `lastEventAt`
 *  取自它，所以折叠是唯一需要扫全部记录时刻的地方。 */
export interface SummaryWithLastEvent extends TokenSummary {
  lastEventAt: number | null
}

/** 把记录折成 token-summary 形状：resolver 指定的每个 (日, 模型, provider,
 * rate 身份) 一行 rate 行，每个 (provider, model) 一行模型行——同一 model 串被
 * 两个 provider 计费时**不得**合并，因为价格与计费性质是 provider 特有的。 */
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
    // 未归属失败（`model === ''`）仍计入 totals 与 byDay；不进 byModel / byHour
    // ——空白表格行会假装我们知道 route。
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

/** 合并两个 summary 为一个。与顺序无关、可结合。 */
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

/** 给纯 token summary 叠上成本层：每个 rate 行按 (route, model, rate 身份) 在
 *  当前价表回查定价——身份规则见 docs/CONTRACTS.md §2，改价无需重建即可重算
 *  历史。每行金额落入其 route 计费性质命名的桶（分桶规则同样在 §2）。表无法
 *  定价的行计 ¥0，其 model 串进入 `unpricedModels`——覆盖无人定价的
 *  (route, model)，以及按美元报价却没设汇率的通道。 */
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
      // 未归属失败的空白 model 串不进，与它不进 byModel 一致。
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

/** 分日文件版本的比较键，与缓存判新旧用的是同一对字段。 */
function stampKey(stamp: { size: number; mtimeMs: number }): string {
  return `${String(stamp.size)}:${String(stamp.mtimeMs)}`
}

/** 构建一个数据目录的完整 stats 载荷：所有冻结分日文件的 rollup 合并今日文件
 *  的新鲜读取。
 *
 *  `pricingRevision` 是调用方解析 rate 所依据的价文件签名；签名不符或折叠依据
 *  的分日文件版本对不上（往日被追加、被删）都使整份 rollup 作废重折——规则见
 *  docs/CONTRACTS.md §2。 */
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
  // 折叠的版本核对只看得见水位线之内的文件：水位线之外的文件会在下面装载时各取
  // 一次版本（冷文件顺手把版本记进新折叠），这里不为它们白取一遍。
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
