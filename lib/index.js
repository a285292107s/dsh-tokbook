// src/index.ts
import { Service } from "@deepseek-ai/cordis";

// src/types.ts
var UNPRICED_KEY = { unpriced: true };
var PROVIDER_RANGES = ["today", "yesterday", "last7", "last30", "all"];
function settleTiming(rows) {
  let llmMs = 0;
  let toolMs = 0;
  for (const row of rows) {
    llmMs += row.timing?.llmMs ?? 0;
    toolMs += row.timing?.toolMs ?? 0;
  }
  return { llmMs, toolMs };
}
function totalsTokens(totals) {
  return totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens + totals.outputTokens;
}

// src/config.ts
function validateConfig(config) {
  const unknown = Object.keys(config).find((key) => key !== "path" && key !== "recordCompaction" && key !== "plans");
  if (unknown !== void 0) {
    throw new Error(`TokBookConfig: unknown key "${unknown}"`);
  }
  if (config.path !== void 0 && typeof config.path !== "string") {
    throw new Error('TokBookConfig: "path" must be a string');
  }
  if (config.recordCompaction !== void 0 && typeof config.recordCompaction !== "boolean") {
    throw new Error('TokBookConfig: "recordCompaction" must be a boolean');
  }
  if (config.plans !== void 0 && (typeof config.plans !== "object" || config.plans === null || Array.isArray(config.plans))) {
    throw new Error('TokBookConfig: "plans" must be a record keyed by provider route');
  }
}
function coercePlanConfig(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return void 0;
  const raw = value;
  const out = {};
  if (typeof raw.enabled === "boolean") out.enabled = raw.enabled;
  if (typeof raw.apiKey === "string" && raw.apiKey !== "") out.apiKey = raw.apiKey;
  if (typeof raw.apiKeyEnv === "string" && raw.apiKeyEnv !== "") out.apiKeyEnv = raw.apiKeyEnv;
  return out;
}
function coercePlansConfig(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === "") continue;
    const coerced = coercePlanConfig(entry);
    if (coerced !== void 0) out[key] = coerced;
  }
  return out;
}

// src/ledger.ts
import { join } from "node:path";
import { homedir } from "node:os";
import { mkdir, readFile, writeFile } from "node:fs/promises";
function defaultDataDir(configPath) {
  if (configPath !== void 0 && configPath !== "") return configPath;
  const envHome = process.env.DSH_HOME;
  const base = typeof envHome === "string" && envHome.trim() !== "" ? envHome : join(homedir(), ".dsh");
  return join(base, "tokbook");
}
var OWNER_FILE = "owner.json";
function pidIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}
async function warnIfForeignOwner(dir, logger = console) {
  try {
    const text = await readFile(join(dir, OWNER_FILE), "utf8");
    const marker = JSON.parse(text);
    if (typeof marker !== "object" || marker === null) return false;
    const { pid, startedAt } = marker;
    if (typeof pid !== "number" || pid === process.pid) return false;
    if (pidIsAlive(pid)) {
      logger.warn?.(
        `[tokbook] data directory ${dir} is owned by live process ${String(pid)} (started ${new Date(startedAt ?? 0).toISOString()}). Two hosts writing one ledger directory are not supported: rollup/cache/refile races can corrupt derived stats. Point the second instance at its own \`path\`, or stop the first.`
      );
      return true;
    }
    logger.info?.(`[tokbook] data directory ${dir} has a stale owner marker (pid ${String(pid)} is gone); this instance takes over.`);
    return false;
  } catch {
    return false;
  }
}
async function writeOwnerMarker(dir) {
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, OWNER_FILE), JSON.stringify({ pid: process.pid, startedAt: Date.now() }), "utf8");
  } catch {
  }
}

// src/usage-log.ts
import { appendFile, mkdir as mkdir2, readdir, readFile as readFile2, rename, unlink, writeFile as writeFile2 } from "node:fs/promises";
import { join as join2 } from "node:path";

// src/usage-record.ts
function isCount(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
function stableId(value) {
  return typeof value === "string" && value !== "" ? value : void 0;
}
function failureKey(sessionId, event, discriminator) {
  return discriminator !== void 0 ? `failure:${sessionId}:${discriminator}` : `failure:${sessionId}:${String(event.seq)}`;
}
function projectUsage(usage) {
  if (usage === void 0) return void 0;
  if (!isCount(usage.inputTokens) || !isCount(usage.outputTokens)) return void 0;
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    ...isCount(usage.cacheReadTokens) ? { cacheReadTokens: usage.cacheReadTokens } : {},
    ...isCount(usage.cacheWriteTokens) ? { cacheWriteTokens: usage.cacheWriteTokens } : {}
  };
}
function recordFromMessage(event, sessionId) {
  const usage = projectUsage(event.data?.usage);
  return {
    requestId: event.data.message.id,
    time: event.time,
    sessionId,
    model: event.data.message.source.model,
    ...event.data.message.source.provider !== void 0 ? { provider: event.data.message.source.provider } : {},
    ...usage !== void 0 ? { usage } : {}
  };
}
function recordFromCompaction(event, sessionId) {
  const usage = projectUsage(event.data?.usage);
  const compactionId = stableId(event.data?.compactionId);
  return {
    requestId: `compaction:${sessionId}:${compactionId ?? String(event.seq)}`,
    time: event.time,
    sessionId,
    model: event.data.model ?? "",
    ...event.data.provider !== void 0 ? { provider: event.data.provider } : {},
    ...usage !== void 0 ? { usage } : {},
    kind: "compaction"
  };
}
function failureRow(event, sessionId, model, code, discriminator) {
  return {
    requestId: failureKey(sessionId, event, discriminator),
    time: event.time,
    sessionId,
    model,
    kind: "failure",
    ...code !== void 0 && code !== "" ? { failureCode: code } : {}
  };
}
function recordFromTurnEnd(event, sessionId, model) {
  if (event.data?.reason?.kind !== "error") return null;
  const turn = event.data.turn;
  return failureRow(
    event,
    sessionId,
    model,
    event.data.reason.error?.code,
    isCount(turn) ? `turn:${String(turn)}` : void 0
  );
}
function recordFromRetry(event, sessionId, model) {
  const retryId = stableId(event.data?.retryId);
  const retry = event.data?.retry;
  const discriminator = retryId === void 0 ? void 0 : isCount(retry) ? `retry:${retryId}:${String(retry)}` : `retry:${retryId}`;
  return failureRow(event, sessionId, model, event.data?.failure?.code, discriminator);
}
function recordOfEvent(event, sessionId, lastModel, recordCompaction = true) {
  switch (event.type) {
    case "assistant/message":
      return recordFromMessage(event, sessionId);
    case "compaction/summary":
      return recordCompaction ? recordFromCompaction(event, sessionId) : null;
    case "turn/end":
      return recordFromTurnEnd(event, sessionId, lastModel);
    case "llm/retry":
      return recordFromRetry(event, sessionId, lastModel);
    default:
      return null;
  }
}
function modelOfEvent(event) {
  if (event.type === "request/context") return event.data?.model;
  if (event.type === "assistant/message") return event.data?.message?.source.model;
  return void 0;
}
function providerOfEvent(event) {
  if (event.type === "request/context") return event.data?.provider;
  if (event.type === "assistant/message") return event.data?.message?.source.provider;
  if (event.type === "llm/retry") return event.data?.provider;
  return void 0;
}
function normalizeCount(value) {
  return isCount(value) ? value : void 0;
}
function isUsageFields(value) {
  if (typeof value !== "object" || value === null) return false;
  const fields = value;
  return isCount(fields.inputTokens) && isCount(fields.outputTokens);
}
function isRecord(value) {
  if (typeof value !== "object" || value === null) return false;
  const record = value;
  return typeof record.requestId === "string" && isCount(record.time) && typeof record.sessionId === "string" && typeof record.model === "string" && (record.usage === void 0 || record.usage === null || isUsageFields(record.usage));
}
function coerceRecord(value) {
  if (!isRecord(value)) return null;
  const record = value;
  const isFailure = record.kind === "failure";
  const kind = record.kind === "compaction" ? { kind: "compaction" } : isFailure ? { kind: "failure" } : {};
  const failureCode = isFailure && typeof record.failureCode === "string" && record.failureCode !== "" ? { failureCode: record.failureCode } : {};
  const provider = typeof record.provider === "string" && record.provider !== "" ? { provider: record.provider } : {};
  if (record.usage === void 0 || record.usage === null) {
    return {
      requestId: record.requestId,
      time: record.time,
      sessionId: record.sessionId,
      model: record.model,
      ...kind,
      ...failureCode,
      ...provider
    };
  }
  const fields = record.usage;
  const cacheRead = normalizeCount(fields.cacheReadTokens);
  const cacheWrite = normalizeCount(fields.cacheWriteTokens);
  return {
    requestId: record.requestId,
    time: record.time,
    sessionId: record.sessionId,
    model: record.model,
    ...kind,
    ...failureCode,
    ...provider,
    usage: {
      inputTokens: fields.inputTokens,
      outputTokens: fields.outputTokens,
      ...cacheRead !== void 0 ? { cacheReadTokens: cacheRead } : {},
      ...cacheWrite !== void 0 ? { cacheWriteTokens: cacheWrite } : {}
    }
  };
}
function parseRecord(line) {
  let value;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  return coerceRecord(value);
}
function serializeRecord(record) {
  return JSON.stringify(record);
}

// src/usage-log.ts
var DAY_FILE = /^usage-(\d{4}-\d{2}-\d{2})\.jsonl$/u;
function dayOfFileName(name2) {
  return DAY_FILE.exec(name2)?.[1] ?? null;
}
function dayFileName(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `usage-${year}-${month}-${day}.jsonl`;
}
function dayFileNameOf(time) {
  return dayFileName(new Date(time));
}
function dayFilePath(dir, time) {
  return join2(dir, dayFileNameOf(time));
}
var dirs = /* @__PURE__ */ new Map();
function stateOf(dir) {
  const existing = dirs.get(dir);
  if (existing !== void 0) return existing;
  const created = {
    seen: /* @__PURE__ */ new Set(),
    queue: Promise.resolve(),
    ready: void 0,
    scanned: false,
    scanning: void 0,
    torn: /* @__PURE__ */ new Set(),
    generation: 0
  };
  dirs.set(dir, created);
  return created;
}
function ledgerGeneration(dir) {
  return stateOf(dir).generation;
}
var UsageLog = class {
  dir;
  logger;
  state;
  constructor(dir, logger = console) {
    this.dir = dir;
    this.logger = logger;
    this.state = stateOf(dir);
  }
  has(requestId) {
    return this.state.seen.has(requestId);
  }
  flush() {
    return this.state.queue;
  }
  async scan() {
    const state = this.state;
    if (state.scanned) return;
    if (state.scanning !== void 0) {
      await state.scanning;
      return;
    }
    const pending = this.doScan().finally(() => {
      if (state.scanning === pending) state.scanning = void 0;
    });
    state.scanning = pending;
    await pending;
  }
  async doScan() {
    const state = this.state;
    await this.ensureDir();
    let names;
    try {
      names = await readdir(this.dir);
    } catch (error) {
      this.logger.error("[tokbook] cannot list data dir " + this.dir + ":", error);
      return;
    }
    for (const name2 of names) {
      if (!DAY_FILE.test(name2)) continue;
      const text = await readFile2(join2(this.dir, name2), "utf8").catch((error) => {
        this.logger.error(`[tokbook] cannot read ${name2}:`, error);
        return "";
      });
      if (text !== "" && !text.endsWith("\n")) state.torn.add(name2);
      else state.torn.delete(name2);
      for (const line of text.split("\n")) {
        if (line === "") continue;
        const record = parseRecord(line);
        if (record === null) {
          this.logger.error(`[tokbook] skipping malformed line in ${name2}: ${line.slice(0, 120)}`);
          continue;
        }
        state.seen.add(record.requestId);
      }
    }
    state.scanned = true;
  }
  record(record) {
    const state = this.state;
    if (state.scanned) return this.enqueue(record);
    const scan = state.scanning ?? this.beginScan();
    return scan.catch((error) => {
      this.logger.error("[tokbook] cannot rebuild dedupe set; writing without it:", error);
    }).then(() => this.enqueue(record));
  }
  beginScan() {
    const state = this.state;
    const pending = this.doScan().finally(() => {
      if (state.scanning === pending) state.scanning = void 0;
    });
    state.scanning = pending;
    return pending;
  }
  enqueue(record) {
    const state = this.state;
    if (state.seen.has(record.requestId)) return Promise.resolve(false);
    state.seen.add(record.requestId);
    const task = state.queue.then(async () => {
      await this.ensureDir();
      await this.appendOnce(record);
      state.generation += 1;
    });
    state.queue = task.catch(() => {
    });
    return task.then(() => true).catch((error) => {
      state.seen.delete(record.requestId);
      this.logger.error("[tokbook] append failed:", error);
      return false;
    });
  }
  refileByEventDay() {
    let moved = 0;
    const state = this.state;
    const task = state.queue.then(async () => {
      await this.ensureDir();
      const result = await refileDayFiles(this.dir, this.logger);
      for (const name2 of result.rewritten) state.torn.delete(name2);
      moved = result.moved;
      if (moved > 0) state.generation += 1;
    });
    state.queue = task.catch(() => {
    });
    return task.then(() => moved).catch((error) => {
      this.logger.error("[tokbook] refile by event day failed:", error);
      return 0;
    });
  }
  async ensureDir() {
    const state = this.state;
    if (state.ready === void 0) {
      const attempt = mkdir2(this.dir, { recursive: true }).then(() => void 0);
      state.ready = attempt;
      try {
        await attempt;
      } catch (error) {
        if (state.ready === attempt) state.ready = void 0;
        throw error;
      }
      return;
    }
    await state.ready;
  }
  async appendOnce(record) {
    const path = dayFilePath(this.dir, record.time);
    const line = `${serializeRecord(record)}
`;
    const wasTorn = this.state.torn.delete(dayFileNameOf(record.time));
    try {
      await appendFile(path, `${wasTorn ? "\n" : ""}${line}`, { flag: "a" });
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      this.state.ready = void 0;
      await this.ensureDir();
      await appendFile(path, line, { flag: "a" });
    }
  }
};
async function readDayLines(dir, name2, logger) {
  const text = await readFile2(join2(dir, name2), "utf8").catch((error) => {
    if (error.code !== "ENOENT") {
      logger.error(`[tokbook] cannot read ${name2}:`, error);
    }
    return "";
  });
  const lines = [];
  for (const raw of text.split("\n")) {
    if (raw === "") continue;
    lines.push({ record: parseRecord(raw), raw });
  }
  return lines;
}
async function rewriteDayFile(dir, name2, records, malformed = []) {
  const target = join2(dir, name2);
  if (records.length === 0 && malformed.length === 0) {
    await unlink(target).catch(() => void 0);
    return;
  }
  const tmp = join2(dir, `${name2}.tmp`);
  await writeFile2(tmp, `${[...records.map(serializeRecord), ...malformed].join("\n")}
`, "utf8");
  await unlink(target).catch(() => void 0);
  await rename(tmp, target);
}
async function refileDayFiles(dir, logger) {
  let names;
  try {
    names = (await readdir(dir)).filter((name2) => DAY_FILE.test(name2)).sort();
  } catch (error) {
    logger.error("[tokbook] cannot list data dir " + dir + ":", error);
    return { moved: 0, rewritten: /* @__PURE__ */ new Set() };
  }
  let moved = 0;
  const rewritten = /* @__PURE__ */ new Set();
  for (const source of names) {
    const lines = await readDayLines(dir, source, logger);
    const stay = [];
    const stray = [];
    const leave = /* @__PURE__ */ new Map();
    for (const line of lines) {
      if (line.record === null) {
        stray.push(line.raw);
        continue;
      }
      const target = dayFileNameOf(line.record.time);
      if (target === source) {
        stay.push(line.record);
        continue;
      }
      const bucket = leave.get(target) ?? [];
      bucket.push(line.record);
      leave.set(target, bucket);
      moved += 1;
    }
    if (leave.size === 0) continue;
    for (const [target, records] of leave) {
      const targetLines = await readDayLines(dir, target, logger);
      const existing = targetLines.map((line) => line.record).filter((record) => record !== null);
      const malformed = targetLines.filter((line) => line.record === null).map((line) => line.raw);
      const seen = new Set(existing.map((record) => record.requestId));
      const appended = records.filter((record) => !seen.has(record.requestId));
      await rewriteDayFile(dir, target, [...existing, ...appended], malformed);
      rewritten.add(target);
    }
    if (stray.length > 0) {
      const target = join2(dir, source);
      const body = `${stay.map(serializeRecord).join("\n")}${stay.length > 0 ? "\n" : ""}${stray.join("\n")}
`;
      const tmp = join2(dir, `${source}.tmp`);
      await writeFile2(tmp, body, "utf8");
      await unlink(target).catch(() => void 0);
      await rename(tmp, target);
    } else {
      await rewriteDayFile(dir, source, stay);
    }
    rewritten.add(source);
  }
  return { moved, rewritten };
}

// src/sync-state.ts
import { mkdir as mkdir3, readFile as readFile3, rename as rename2, unlink as unlink2, writeFile as writeFile3 } from "node:fs/promises";
import { dirname, join as join3 } from "node:path";
var MARKER = "initialized.marker";
var PROGRESS_FILE = "sync-progress.json";
var PROGRESS_TMP = "sync-progress.json.tmp";
async function isInitialized(dir) {
  try {
    await readFile3(join3(dir, MARKER), "utf8");
    return true;
  } catch {
    return false;
  }
}
async function markInitialized(dir) {
  const target = join3(dir, MARKER);
  const tmp = join3(dir, `${MARKER}.tmp`);
  await mkdir3(dirname(target), { recursive: true });
  await writeFile3(tmp, `${Date.now()}
`, "utf8");
  await unlink2(target).catch(() => void 0);
  await rename2(tmp, target);
}
function isProgressFile(value) {
  if (typeof value !== "object" || value === null) return false;
  const raw = value;
  if (typeof raw.syncedAt !== "number" || !Number.isFinite(raw.syncedAt)) return false;
  const sessions = raw.sessions;
  if (typeof sessions !== "object" || sessions === null || Array.isArray(sessions)) return false;
  return Object.entries(sessions).every(([id, rev]) => id !== "" && typeof rev === "string" && rev !== "");
}
async function readSyncProgress(dir) {
  let text;
  try {
    text = await readFile3(join3(dir, PROGRESS_FILE), "utf8");
  } catch {
    return null;
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  return isProgressFile(value) ? value : null;
}
async function writeSyncProgress(dir, progress) {
  const target = join3(dir, PROGRESS_FILE);
  const tmp = join3(dir, PROGRESS_TMP);
  await mkdir3(dirname(target), { recursive: true });
  await writeFile3(tmp, JSON.stringify(progress), "utf8");
  await unlink2(target).catch(() => void 0);
  await rename2(tmp, target);
}

// src/sync.ts
async function readSessionEvents(persistence, id) {
  if (typeof persistence.inspect === "function") {
    return (await persistence.inspect(id)).events;
  }
  if (typeof persistence.open !== "function") {
    throw new Error("sessionPersistence exposes neither inspect() nor open()");
  }
  const handle = await persistence.open(id, "read");
  try {
    const cut = typeof handle.inheritedEventCount === "number" && handle.inheritedEventCount > 0 ? handle.inheritedEventCount : 0;
    return (await handle.read(cut)).events;
  } finally {
    await handle.close?.();
  }
}
function normalizeSnapshot(value) {
  if (typeof value !== "object" || value === null) return null;
  const raw = value;
  const header = typeof raw.header === "object" && raw.header !== null ? raw.header : raw;
  if (typeof header.id !== "string" || header.id === "") return null;
  return {
    header: {
      id: header.id,
      ...typeof header.cwd === "string" && header.cwd !== "" ? { cwd: header.cwd } : {},
      ...typeof header.parentSession === "string" && header.parentSession !== "" ? { parentSession: header.parentSession } : {},
      ...header.origin === "subagent" ? { origin: header.origin } : {}
    },
    ...raw.revision !== void 0 ? { revision: raw.revision } : {}
  };
}
async function listPersistenceSnapshots(persistence, logger = console) {
  if (typeof persistence.list === "function") {
    try {
      return (await persistence.list()).map(normalizeSnapshot).filter((snap) => snap !== null);
    } catch (error) {
      logger.error("[tokbook] list() failed, falling back to listSnapshots():", error);
    }
  }
  if (typeof persistence.listSnapshots !== "function") {
    throw new Error("sessionPersistence exposes neither list() nor listSnapshots()");
  }
  return (await persistence.listSnapshots()).map(normalizeSnapshot).filter((snap) => snap !== null);
}
async function syncHistory(deps, options = {}) {
  await deps.log.scan();
  const listed = options.snapshots ?? await listPersistenceSnapshots(deps.persistence);
  const wanted = options.sessionIds !== void 0 ? new Set(options.sessionIds) : void 0;
  const sessions = wanted === void 0 ? listed : listed.filter((session) => wanted.has(session.header.id));
  let added = 0;
  let skipped = 0;
  let failedSessions = 0;
  const total = sessions.length;
  let processed = 0;
  options.onTick?.({ processed, total, added, skipped, failedSessions });
  const logger = deps.logger ?? console;
  for (const session of sessions) {
    const id = session.header.id;
    let sessionFailed = false;
    const fail = (error) => {
      if (sessionFailed) return;
      sessionFailed = true;
      failedSessions += 1;
      deps.onSessionFailure?.(id, error);
    };
    try {
      const events = await readSessionEvents(deps.persistence, id);
      let model = "";
      let provider;
      for (const event of events) {
        try {
          const revealedModel = modelOfEvent(event);
          if (revealedModel !== void 0) model = revealedModel;
          const revealedProvider = providerOfEvent(event);
          if (revealedProvider !== void 0) provider = revealedProvider;
          const record = recordOfEvent(event, id, model, deps.recordCompaction !== false);
          if (record === null) continue;
          if (provider !== void 0 && record.provider === void 0) record.provider = provider;
          if (await deps.log.record(record)) added += 1;
          else skipped += 1;
        } catch (error) {
          logger.error(`[tokbook] cannot fold ${event.type} (seq ${String(event.seq)}) in session ${id}:`, error);
          fail(error);
          continue;
        }
      }
    } catch (error) {
      fail(error);
    }
    processed += 1;
    options.onTick?.({ processed, total, added, skipped, failedSessions });
  }
  return { added, skipped, failedSessions };
}
async function autoSyncIfNeeded(deps, dir) {
  if (await isInitialized(dir)) return null;
  const result = await syncHistory(deps);
  await markInitialized(dir);
  return result;
}

// src/stats.ts
import { readdir as readdir2, readFile as readFile5, stat, rename as rename4, unlink as unlink3, writeFile as writeFile5 } from "node:fs/promises";
import { join as join5 } from "node:path";

// src/price-format.ts
var PRICING_BILLING_KEY = "$billing";
var PRICING_CALENDAR_KEY = "$calendar";
var PRICING_CURRENCY_KEY = "$currency";
var PRICING_FX_KEY = "$fx";
var MAX_ROUTE_LENGTH = 128;
var MAX_MODEL_LENGTH = 256;
var DATE_RE = /^\d{4}-\d{2}-\d{2}$/u;
var DAY_SETS = ["daily", "weekdays", "workdays", "weekends"];
function dayKeyOf(ms) {
  const at = new Date(ms);
  const month = String(at.getMonth() + 1).padStart(2, "0");
  const day = String(at.getDate()).padStart(2, "0");
  return `${String(at.getFullYear())}-${month}-${day}`;
}
function hourOfDay(ms) {
  return new Date(ms).getHours();
}
function weekdayOf(ms) {
  return new Date(ms).getDay();
}
function dayStartMs(date) {
  if (!DATE_RE.test(date)) return null;
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  const at = new Date(year, month - 1, day);
  if (at.getFullYear() !== year || at.getMonth() !== month - 1 || at.getDate() !== day) return null;
  return at.getTime();
}
function dayIndex(date) {
  if (dayStartMs(date) === null) return null;
  return Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) / 864e5;
}
function dayKeyOfIndex(index) {
  const at = new Date(index * 864e5);
  const month = String(at.getUTCMonth() + 1).padStart(2, "0");
  const day = String(at.getUTCDate()).padStart(2, "0");
  return `${String(at.getUTCFullYear())}-${month}-${day}`;
}
function isValidHolidayRange(range) {
  const start = dayIndex(range.start);
  const end = dayIndex(range.end);
  return start !== null && end !== null && start <= end;
}
function holidayDates(range) {
  const start = dayIndex(range.start);
  const end = dayIndex(range.end);
  if (start === null || end === null || start > end) return [];
  const dates = [];
  for (let index = start; index <= end; index += 1) dates.push(dayKeyOfIndex(index));
  return dates;
}
function holidaySet(calendar) {
  const dates = /* @__PURE__ */ new Set();
  for (const ranges of Object.values(calendar)) {
    for (const range of ranges) {
      if (!isValidHolidayRange(range)) continue;
      for (const date of holidayDates(range)) dates.add(date);
    }
  }
  return dates;
}
function yearOfDate(date) {
  return DATE_RE.test(date) ? date.slice(0, 4) : null;
}
function isYearKey(year) {
  return /^\d{4}$/u.test(year);
}
function isHourRange(range) {
  return Number.isInteger(range.start) && Number.isInteger(range.end) && range.start >= 0 && range.start < range.end && range.end <= 24;
}
function hourRangesOverlap(left, right) {
  return left.start < right.end && right.start < left.end;
}
function isWeekend(weekday) {
  return weekday === 0 || weekday === 6;
}
function daySetsIntersect(left, right) {
  if (left === "daily" || right === "daily") return true;
  if (left === right) return true;
  const pair = left === "workdays" ? right : right === "workdays" ? left : null;
  return pair === "weekdays";
}
function daySetCovers(days, weekday, date, holidays) {
  if (days === "daily") return true;
  if (isWeekend(weekday)) return days === "weekends";
  if (days === "weekends") return false;
  return days === "weekdays" || !holidays.has(date);
}
function slotCovers(slot, ms, holidays) {
  const hour = hourOfDay(ms);
  return hour >= slot.start && hour < slot.end && daySetCovers(slot.days, weekdayOf(ms), dayKeyOf(ms), holidays);
}
function slotsOverlap(left, right) {
  return hourRangesOverlap(left, right) && daySetsIntersect(left.days, right.days);
}

// src/pricing.ts
import { mkdir as mkdir4, readFile as readFile4, rename as rename3, writeFile as writeFile4 } from "node:fs/promises";
import { dirname as dirname2, join as join4 } from "node:path";
var PRICING_FILE = "pricing.json";
function isRate(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
async function readTextFile(dir, name2, logger) {
  try {
    const text = await readFile4(join4(dir, name2), "utf8");
    return { text: text.charCodeAt(0) === 65279 ? text.slice(1) : text };
  } catch (error) {
    const missing = error.code === "ENOENT";
    if (!missing) logger.error(`[tokbook] cannot read ${name2}:`, error);
    return { text: null, missing };
  }
}
function revisionOf(text) {
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) + hash + text.charCodeAt(index) | 0;
  }
  return `${(hash >>> 0).toString(16)}:${String(text.length)}`;
}
function parseJson(text, name2, logger) {
  try {
    return JSON.parse(text);
  } catch (error) {
    logger.error(`[tokbook] ${name2} is not valid JSON; the whole price table is read as empty, so every amount is \xA50`, error);
    return null;
  }
}
function coerceRates(raw) {
  if (!isRate(raw.inputPerMillion) || !isRate(raw.outputPerMillion)) return null;
  return {
    inputPerMillion: raw.inputPerMillion,
    outputPerMillion: raw.outputPerMillion,
    ...isRate(raw.cacheReadPerMillion) ? { cacheReadPerMillion: raw.cacheReadPerMillion } : {},
    ...isRate(raw.cacheWritePerMillion) ? { cacheWritePerMillion: raw.cacheWritePerMillion } : {}
  };
}
function coerceSlotRates(raw) {
  const rates = {
    ...isRate(raw.inputPerMillion) ? { inputPerMillion: raw.inputPerMillion } : {},
    ...isRate(raw.outputPerMillion) ? { outputPerMillion: raw.outputPerMillion } : {},
    ...isRate(raw.cacheReadPerMillion) ? { cacheReadPerMillion: raw.cacheReadPerMillion } : {},
    ...isRate(raw.cacheWritePerMillion) ? { cacheWritePerMillion: raw.cacheWritePerMillion } : {}
  };
  return Object.keys(rates).length === 0 ? null : rates;
}
function coerceSlot(raw) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const slot = raw;
  const rates = coerceSlotRates(slot);
  if (rates === null) return null;
  if (typeof slot.start !== "number" || typeof slot.end !== "number") return null;
  if (!isHourRange({ start: slot.start, end: slot.end })) return null;
  let days = "daily";
  if (slot.days !== void 0) {
    const named = DAY_SETS.find((item) => item === slot.days);
    if (named === void 0) return null;
    days = named;
  }
  return { days, start: slot.start, end: slot.end, rates };
}
function normalizeSlots(slots) {
  const out = [];
  for (const slot of [...slots].sort((left, right) => left.start - right.start || DAY_SETS.indexOf(left.days) - DAY_SETS.indexOf(right.days))) {
    if (out.some((kept) => slotsOverlap(kept, slot))) continue;
    out.push(slot);
  }
  return out;
}
var LEGACY_FROM_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:00)?$/u;
function coerceLegacySegment(raw) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const segment = raw;
  const rates = coerceRates(segment);
  if (rates === null) return null;
  const text = segment.from;
  let from = "";
  if (text !== void 0 && text !== null && text !== "") {
    if (typeof text !== "string" || !LEGACY_FROM_RE.test(text) || dayStartMs(text.slice(0, 10)) === null) return null;
    from = text;
  }
  const slots = Array.isArray(segment.slots) ? normalizeSlots(segment.slots.map(coerceSlot).filter((slot) => slot !== null)) : [];
  return { from, entry: { rates, ...slots.length > 0 ? { slots } : {} } };
}
function coerceLegacySegments(list) {
  let best = null;
  for (const item of list) {
    const segment = coerceLegacySegment(item);
    if (segment === null) return null;
    if (best === null || segment.from > best.from) best = segment;
  }
  return best === null ? null : best.entry;
}
function coerceEntry(raw) {
  if (Array.isArray(raw)) return coerceLegacySegments(raw);
  if (typeof raw !== "object" || raw === null) return null;
  const entry = raw;
  const rates = coerceRates(entry);
  if (rates === null) return null;
  const slots = Array.isArray(entry.slots) ? normalizeSlots(entry.slots.map(coerceSlot).filter((slot) => slot !== null)) : [];
  return {
    rates,
    ...slots.length > 0 ? { slots } : {}
  };
}
function coerceHolidayRange(raw) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const range = raw;
  if (typeof range.start !== "string" || typeof range.end !== "string") return null;
  const parsed = { start: range.start, end: range.end };
  return isValidHolidayRange(parsed) ? parsed : null;
}
function coerceCalendar(raw, logger = console) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const calendar = {};
  for (const [year, ranges] of Object.entries(raw)) {
    if (!isYearKey(year) || !Array.isArray(ranges)) continue;
    const yearStart = dayIndex(`${year}-01-01`);
    const yearEnd = dayIndex(`${year}-12-31`);
    if (yearStart === null || yearEnd === null) continue;
    const dates = [];
    for (const item of ranges) {
      const range = coerceHolidayRange(item);
      if (range === null) continue;
      const start = dayIndex(range.start);
      const end = dayIndex(range.end);
      const from = Math.max(start, yearStart);
      const to = Math.min(end, yearEnd);
      if (from > to) {
        logger.warn?.(`[tokbook] ${PRICING_CALENDAR_KEY} \u7684\u300C${year}\u300D\u6709\u4E00\u6BB5\u5047\u671F\uFF08${range.start} ~ ${range.end}\uFF09\u6574\u6BB5\u90FD\u4E0D\u5728\u8FD9\u4E00\u5E74\u91CC\uFF0C\u8BFB\u8DEF\u5F84\u4E22\u6389\u5B83`);
        continue;
      }
      if (from !== start || to !== end) {
        logger.warn?.(`[tokbook] ${PRICING_CALENDAR_KEY} \u7684\u300C${year}\u300D\u6709\u4E00\u6BB5\u5047\u671F\u8DE8\u51FA\u4E86\u8FD9\u4E00\u5E74\uFF08${range.start} ~ ${range.end}\uFF09\uFF0C\u8BFB\u8DEF\u5F84\u628A\u5B83\u5939\u6210 ${dayKeyOfIndex(from)} ~ ${dayKeyOfIndex(to)}`);
      }
      dates.push(...holidayDates({ start: dayKeyOfIndex(from), end: dayKeyOfIndex(to) }));
    }
    const kept = mergeHolidayDates(dates);
    if (kept.length > 0) calendar[year] = kept;
  }
  return calendar;
}
function mergeHolidayDates(dates) {
  const indexes = [...new Set(dates)].map(dayIndex).filter((index) => index !== null);
  indexes.sort((left, right) => left - right);
  const ranges = [];
  for (const index of indexes) {
    const last = ranges[ranges.length - 1];
    if (last !== void 0 && index - (dayIndex(last.end) ?? index) === 1) last.end = dayKeyOfIndex(index);
    else ranges.push({ start: dayKeyOfIndex(index), end: dayKeyOfIndex(index) });
  }
  return ranges;
}
function coerceFx(raw) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return void 0;
  const value = raw.cnyPerUsd;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? { cnyPerUsd: value } : void 0;
}
function coerceCurrency(raw) {
  const currency = {};
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return currency;
  for (const [route, value] of Object.entries(raw)) {
    if (route !== "" && value === "USD") currency[route] = "USD";
  }
  return currency;
}
function coercePriceFile(value, logger = console) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    logger.error(`[tokbook] ${PRICING_FILE} is not a JSON object; treating it as empty`);
    return { table: {}, billing: {}, currency: {}, calendar: {}, revision: "" };
  }
  const raw = value;
  const table = {};
  const billing = {};
  const calendar = coerceCalendar(raw[PRICING_CALENDAR_KEY], logger);
  const currency = coerceCurrency(raw[PRICING_CURRENCY_KEY]);
  const fx = coerceFx(raw[PRICING_FX_KEY]);
  const rawBilling = raw[PRICING_BILLING_KEY];
  if (typeof rawBilling === "object" && rawBilling !== null && !Array.isArray(rawBilling)) {
    for (const [route, nature] of Object.entries(rawBilling)) {
      if (route === "") continue;
      if (nature === "metered" || nature === "subscription") billing[route] = nature;
    }
  }
  for (const [route, models] of Object.entries(raw)) {
    if (route === "" || route.startsWith("$")) continue;
    if (typeof models !== "object" || models === null || Array.isArray(models)) continue;
    const priced = {};
    for (const [model, raw2] of Object.entries(models)) {
      if (model === "") continue;
      const entry = coerceEntry(raw2);
      if (entry === null) {
        logger.error(`[tokbook] ${PRICING_FILE} \u7684\u300C${route}\u300D/\u300C${model}\u300D\u8BFB\u4E0D\u61C2\uFF08\u65E2\u4E0D\u662F\u300C\u56DB\u6863\u4EF7 + \u53EF\u9009 slots\u300D\u7684\u5BF9\u8C61\uFF0C\u4E5F\u4E0D\u662F\u65E7\u7684\u4EF7\u6BB5\u6570\u7EC4\uFF09\uFF1B\u6574\u4E2A (\u8DEF\u7531, \u6A21\u578B) \u8BFB\u4F5C\u4EF7\u683C\u672A\u77E5`);
        continue;
      }
      priced[model] = entry;
    }
    if (Object.keys(priced).length > 0) table[route] = priced;
  }
  return { table, billing, currency, calendar, ...fx !== void 0 ? { fx } : {}, revision: "" };
}
function emptyPriceFile() {
  return { table: {}, billing: {}, currency: {}, calendar: {}, revision: "" };
}
async function readPriceFile(dir, logger = console) {
  const read = await readTextFile(dir, PRICING_FILE, logger);
  if (read.text === null) {
    if (read.missing) {
      const backup = await readTextFile(dir, `${PRICING_FILE}.bak`, logger);
      if (backup.text !== null) {
        const recovered = parseJson(backup.text, `${PRICING_FILE}.bak`, logger);
        if (recovered !== null) {
          logger.warn?.(`[tokbook] ${PRICING_FILE} \u4E0D\u5B58\u5728\uFF1B\u5DF2\u4ECE ${PRICING_FILE}.bak \u6062\u590D\uFF0C\u8BF7\u786E\u8BA4\u540E\u91CD\u65B0\u4FDD\u5B58\u4E00\u6B21`);
          return { ...coercePriceFile(recovered, logger), revision: revisionOf(backup.text) };
        }
      }
    }
    return emptyPriceFile();
  }
  const raw = parseJson(read.text, PRICING_FILE, logger);
  if (raw === null) return { ...emptyPriceFile(), revision: revisionOf(read.text) };
  return { ...coercePriceFile(raw, logger), revision: revisionOf(read.text) };
}
var SLOT_FIELDS = /* @__PURE__ */ new Set([
  "days",
  "start",
  "end",
  "inputPerMillion",
  "outputPerMillion",
  "cacheReadPerMillion",
  "cacheWritePerMillion"
]);
function parseSlot(value, where) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, error: `${where}\u5FC5\u987B\u662F\u5BF9\u8C61\uFF08start + end + \u8981\u8986\u76D6\u7684\u6863\u4F4D\u5355\u4EF7\uFF09` };
  }
  const raw = value;
  const extra = Object.keys(raw).find((key) => !SLOT_FIELDS.has(key));
  if (extra !== void 0) return { ok: false, error: `${where}\u542B\u672A\u77E5\u5B57\u6BB5\u300C${extra}\u300D` };
  let days = "daily";
  if (raw.days !== void 0) {
    if (typeof raw.days !== "string" || !DAY_SETS.includes(raw.days)) {
      return { ok: false, error: `${where}\u7684 days \u5FC5\u987B\u662F "daily" / "weekdays" / "weekends"` };
    }
    days = raw.days;
  }
  if (typeof raw.start !== "number" || typeof raw.end !== "number" || !isHourRange({ start: raw.start, end: raw.end })) {
    return { ok: false, error: `${where}\u7684\u65F6\u6BB5\u5FC5\u987B\u662F\u6574\u6570\u6574\u70B9\uFF0C\u4E14 0 \u2264 start < end \u2264 24\uFF0824 = \u5F53\u5929\u7ED3\u675F\uFF09` };
  }
  for (const key of ["inputPerMillion", "outputPerMillion", "cacheReadPerMillion", "cacheWritePerMillion"]) {
    if (raw[key] !== void 0 && !isRate(raw[key])) {
      return { ok: false, error: `${where}\u7684 ${key} \u5FC5\u987B\u662F\u975E\u8D1F\u6570\u5B57\uFF08\u8981\u6CBF\u7528\u57FA\u51C6\u4EF7\u5C31\u522B\u5199\u5B83\uFF09` };
    }
  }
  const rates = coerceSlotRates(raw);
  if (rates === null) {
    return { ok: false, error: `${where}\u81F3\u5C11\u8981\u5199\u4E00\u6863\u4EF7\uFF08\u8F93\u5165 / \u8F93\u51FA / \u7F13\u5B58\u8BFB / \u7F13\u5B58\u5199\uFF09\uFF0C\u5426\u5219\u6574\u6761\u65F6\u6BB5\u7B49\u4E8E\u57FA\u51C6\u4EF7` };
  }
  return { ok: true, slot: { days, start: raw.start, end: raw.end, rates } };
}
function parseEntry(value, where) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, error: `${where}\u5FC5\u987B\u662F\u5BF9\u8C61\uFF08\u56DB\u6863\u5355\u4EF7 + \u53EF\u9009 slots\uFF09` };
  }
  const raw = value;
  const known = /* @__PURE__ */ new Set(["inputPerMillion", "outputPerMillion", "cacheReadPerMillion", "cacheWritePerMillion", "slots"]);
  const extra = Object.keys(raw).find((key) => !known.has(key));
  if (extra !== void 0) {
    const hint = extra === "from" ? "\uFF1A\u4EF7\u8868\u6CA1\u6709\u751F\u6548\u65F6\u95F4\u4E86\uFF0C\u6574\u4EFD\u4EF7\u5C31\u662F\u5F53\u524D\u4EF7" : "";
    return { ok: false, error: `${where}\u542B\u672A\u77E5\u5B57\u6BB5\u300C${extra}\u300D${hint}` };
  }
  if (!isRate(raw.inputPerMillion) || !isRate(raw.outputPerMillion)) {
    return { ok: false, error: `${where}\u7F3A\u5C11\u5408\u6CD5\u7684 inputPerMillion / outputPerMillion\uFF08\u975E\u8D1F\u6570\u5B57\uFF09` };
  }
  if (raw.cacheReadPerMillion !== void 0 && !isRate(raw.cacheReadPerMillion)) {
    return { ok: false, error: `${where}\u7684 cacheReadPerMillion \u5FC5\u987B\u662F\u975E\u8D1F\u6570\u5B57` };
  }
  if (raw.cacheWritePerMillion !== void 0 && !isRate(raw.cacheWritePerMillion)) {
    return { ok: false, error: `${where}\u7684 cacheWritePerMillion \u5FC5\u987B\u662F\u975E\u8D1F\u6570\u5B57` };
  }
  const slots = [];
  if (raw.slots !== void 0) {
    if (!Array.isArray(raw.slots)) return { ok: false, error: `${where}\u7684 slots \u5FC5\u987B\u662F\u6570\u7EC4` };
    for (let index = 0; index < raw.slots.length; index += 1) {
      const parsed = parseSlot(raw.slots[index], `${where}\u7B2C ${String(index + 1)} \u4E2A\u4F8B\u5916\u65F6\u6BB5`);
      if (!parsed.ok) return { ok: false, error: parsed.error };
      const clash = slots.find((kept) => slotsOverlap(kept, parsed.slot));
      if (clash !== void 0) {
        return {
          ok: false,
          error: `${where}\u7684\u4F8B\u5916\u65F6\u6BB5\u91CD\u53E0\uFF1A${clash.start}\u2013${clash.end} \u4E0E ${parsed.slot.start}\u2013${parsed.slot.end} \u4F1A\u5728\u540C\u4E00\u65F6\u523B\u540C\u65F6\u751F\u6548`
        };
      }
      slots.push(parsed.slot);
    }
  }
  return {
    ok: true,
    entry: {
      rates: {
        inputPerMillion: raw.inputPerMillion,
        outputPerMillion: raw.outputPerMillion,
        ...raw.cacheReadPerMillion !== void 0 ? { cacheReadPerMillion: raw.cacheReadPerMillion } : {},
        ...raw.cacheWritePerMillion !== void 0 ? { cacheWritePerMillion: raw.cacheWritePerMillion } : {}
      },
      ...slots.length > 0 ? { slots: normalizeSlots(slots) } : {}
    }
  };
}
function parseCalendar(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, error: `${PRICING_CALENDAR_KEY} \u5FC5\u987B\u662F\u5BF9\u8C61\uFF08\u5E74\u4EFD \u2192 \u653E\u5047\u65E5\u533A\u95F4\u6570\u7EC4\uFF09` };
  }
  const calendar = {};
  for (const [year, ranges] of Object.entries(value)) {
    if (!isYearKey(year)) return { ok: false, error: `${PRICING_CALENDAR_KEY} \u7684\u5E74\u4EFD\u952E\u5FC5\u987B\u662F\u56DB\u4F4D\u6570\u5B57\uFF1A${year}` };
    if (!Array.isArray(ranges)) {
      return { ok: false, error: `${PRICING_CALENDAR_KEY} \u7684\u300C${year}\u300D\u5FC5\u987B\u662F\u533A\u95F4\u6570\u7EC4\uFF08\u6BCF\u9879 { start, end }\uFF09` };
    }
    const dates = [];
    for (let index = 0; index < ranges.length; index += 1) {
      const where = `${PRICING_CALENDAR_KEY} \u7684\u300C${year}\u300D\u7B2C ${String(index + 1)} \u6BB5`;
      const raw = ranges[index];
      if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
        return { ok: false, error: `${where}\u5FC5\u987B\u662F\u5BF9\u8C61\uFF08start + end\uFF09` };
      }
      const range = raw;
      const extra = Object.keys(range).find((key) => key !== "start" && key !== "end");
      if (extra !== void 0) return { ok: false, error: `${where}\u542B\u672A\u77E5\u5B57\u6BB5\u300C${extra}\u300D` };
      if (typeof range.start !== "string" || typeof range.end !== "string") {
        return { ok: false, error: `${where}\u7684 start / end \u5FC5\u987B\u662F YYYY-MM-DD` };
      }
      if (!isValidHolidayRange({ start: range.start, end: range.end })) {
        return { ok: false, error: `${where}\u7684\u65E5\u671F\u4E0D\u5408\u6CD5\uFF08\u4E24\u7AEF\u90FD\u8981\u662F\u771F\u5B9E\u65E5\u671F\uFF0C\u4E14 start \u2264 end\uFF09\uFF1A${range.start} ~ ${range.end}` };
      }
      if (yearOfDate(range.start) !== year || yearOfDate(range.end) !== year) {
        return { ok: false, error: `${where}\u8DE8\u51FA\u4E86 ${year} \u5E74\uFF1A\u4E00\u6BB5\u5047\u671F\u5FC5\u987B\u843D\u5728\u5B83\u6240\u5C5E\u7684\u90A3\u4E00\u5E74\u91CC` };
      }
      dates.push(...holidayDates({ start: range.start, end: range.end }));
    }
    const merged = mergeHolidayDates(dates);
    if (merged.length > 0) calendar[year] = merged;
  }
  return { ok: true, calendar };
}
function parseFx(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, error: `${PRICING_FX_KEY} \u5FC5\u987B\u662F\u5BF9\u8C61\uFF08{ cnyPerUsd: 1 \u7F8E\u5143\u7B49\u4E8E\u591A\u5C11\u5143 }\uFF09` };
  }
  const raw = value;
  const extra = Object.keys(raw).find((key) => key !== "cnyPerUsd");
  if (extra !== void 0) return { ok: false, error: `${PRICING_FX_KEY} \u542B\u672A\u77E5\u5B57\u6BB5\u300C${extra}\u300D` };
  if (raw.cnyPerUsd === void 0) return { ok: true };
  if (typeof raw.cnyPerUsd !== "number" || !Number.isFinite(raw.cnyPerUsd) || raw.cnyPerUsd <= 0) {
    return { ok: false, error: `${PRICING_FX_KEY} \u7684 cnyPerUsd \u5FC5\u987B\u662F\u5927\u4E8E 0 \u7684\u6570\u5B57\uFF081 \u7F8E\u5143\u7B49\u4E8E\u591A\u5C11\u5143\uFF09` };
  }
  return { ok: true, fx: { cnyPerUsd: raw.cnyPerUsd } };
}
function parseCurrency(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, error: `${PRICING_CURRENCY_KEY} \u5FC5\u987B\u662F\u5BF9\u8C61\uFF08\u8DEF\u7531 \u2192 "CNY" | "USD"\uFF09` };
  }
  const currency = {};
  for (const [route, raw] of Object.entries(value)) {
    if (route === "") return { ok: false, error: `${PRICING_CURRENCY_KEY} \u4E0B\u5B58\u5728\u7A7A\u8DEF\u7531\u540D` };
    if (route.startsWith("$")) {
      return { ok: false, error: `${PRICING_CURRENCY_KEY} \u4E0B\u7684\u952E\u5FC5\u987B\u662F\u901A\u9053\u8DEF\u7531\u540D\uFF0C\u4E0D\u80FD\u4EE5\u300C$\u300D\u5F00\u5934\uFF1A${route}` };
    }
    if (raw !== "CNY" && raw !== "USD") {
      return { ok: false, error: `\u300C${route}\u300D\u7684\u62A5\u4EF7\u5E01\u79CD\u5FC5\u987B\u662F "CNY" \u6216 "USD"` };
    }
    if (raw === "USD") currency[route] = "USD";
  }
  return { ok: true, currency };
}
function parsePriceInput(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, error: "\u4EF7\u683C\u8868\u5FC5\u987B\u662F JSON \u5BF9\u8C61\uFF08\u8DEF\u7531 \u2192 \u6A21\u578B\u4E32 \u2192 \u4EF7\u6BB5\u6570\u7EC4\uFF09" };
  }
  const raw = value;
  const table = {};
  const billing = {};
  const currency = {};
  let calendar = {};
  let fx;
  for (const [route, models] of Object.entries(raw)) {
    if (route.startsWith("$")) {
      if (route === PRICING_CALENDAR_KEY) {
        const parsed = parseCalendar(models);
        if (!parsed.ok) return { ok: false, error: parsed.error };
        calendar = parsed.calendar;
        continue;
      }
      if (route === PRICING_FX_KEY) {
        const parsed = parseFx(models);
        if (!parsed.ok) return { ok: false, error: parsed.error };
        fx = parsed.fx;
        continue;
      }
      if (route === PRICING_CURRENCY_KEY) {
        const parsed = parseCurrency(models);
        if (!parsed.ok) return { ok: false, error: parsed.error };
        for (const [key, value2] of Object.entries(parsed.currency)) currency[key] = value2;
        continue;
      }
      if (route !== PRICING_BILLING_KEY) {
        return {
          ok: false,
          error: `\u672A\u77E5\u4FDD\u7559\u952E\u300C${route}\u300D\uFF08\u53EA\u652F\u6301 ${PRICING_BILLING_KEY} / ${PRICING_CALENDAR_KEY} / ${PRICING_CURRENCY_KEY} / ${PRICING_FX_KEY}\uFF09`
        };
      }
      if (typeof models !== "object" || models === null || Array.isArray(models)) {
        return { ok: false, error: `${PRICING_BILLING_KEY} \u5FC5\u987B\u662F\u5BF9\u8C61\uFF08\u8DEF\u7531 \u2192 "metered" | "subscription"\uFF09` };
      }
      for (const [key, nature] of Object.entries(models)) {
        if (key === "") return { ok: false, error: `${PRICING_BILLING_KEY} \u4E0B\u5B58\u5728\u7A7A\u8DEF\u7531\u540D` };
        if (nature !== "metered" && nature !== "subscription") {
          return { ok: false, error: `\u300C${key}\u300D\u7684\u8BA1\u8D39\u6027\u8D28\u5FC5\u987B\u662F "metered" \u6216 "subscription"` };
        }
        billing[key] = nature;
      }
      continue;
    }
    if (route === "") return { ok: false, error: "\u5B58\u5728\u7A7A\u901A\u9053\u8DEF\u7531\u540D" };
    if (route.length > MAX_ROUTE_LENGTH) return { ok: false, error: `\u901A\u9053\u8DEF\u7531\u540D\u8FC7\u957F\uFF1A${route.slice(0, 40)}\u2026` };
    if (typeof models !== "object" || models === null || Array.isArray(models)) {
      return { ok: false, error: `\u300C${route}\u300D\u5FC5\u987B\u662F\u5BF9\u8C61\uFF08\u6A21\u578B\u4E32 \u2192 \u8BE5\u6A21\u578B\u7684\u4EF7\uFF09` };
    }
    const priced = {};
    for (const [model, raw2] of Object.entries(models)) {
      const where = `\u300C${route}\u300D\u7684\u300C${model}\u300D`;
      if (model === "") return { ok: false, error: `\u300C${route}\u300D\u4E0B\u5B58\u5728\u7A7A\u6A21\u578B\u4E32` };
      if (model.length > MAX_MODEL_LENGTH) return { ok: false, error: `\u6A21\u578B\u4E32\u8FC7\u957F\uFF1A${model.slice(0, 40)}\u2026` };
      const parsed = parseEntry(raw2, where);
      if (!parsed.ok) return { ok: false, error: parsed.error };
      priced[model] = parsed.entry;
    }
    if (Object.keys(priced).length > 0) table[route] = priced;
  }
  for (const route of Object.keys(currency)) {
    if (fx === void 0) {
      return {
        ok: false,
        error: `\u300C${route}\u300D\u6309\u7F8E\u5143\u62A5\u4EF7\uFF08${PRICING_CURRENCY_KEY}\uFF09\uFF0C\u4F46\u6587\u4EF6\u91CC\u6CA1\u6709\u53EF\u7528\u7684 ${PRICING_FX_KEY} \u6C47\u7387\uFF1A\u7F8E\u5143\u4EF7\u6362\u7B97\u4E0D\u6210\u4EBA\u6C11\u5E01`
      };
    }
  }
  return { ok: true, file: { table, billing, currency, calendar, ...fx !== void 0 ? { fx } : {}, revision: "" } };
}
function slotBody(slot) {
  return {
    days: slot.days,
    start: slot.start,
    end: slot.end,
    inputPerMillion: slot.rates.inputPerMillion,
    outputPerMillion: slot.rates.outputPerMillion,
    ...slot.rates.cacheReadPerMillion !== void 0 ? { cacheReadPerMillion: slot.rates.cacheReadPerMillion } : {},
    ...slot.rates.cacheWritePerMillion !== void 0 ? { cacheWritePerMillion: slot.rates.cacheWritePerMillion } : {}
  };
}
function priceFileBody(file) {
  const body = {};
  const billingRoutes = Object.keys(file.billing).sort((left, right) => left.localeCompare(right));
  if (billingRoutes.length > 0) {
    const billing = {};
    for (const route of billingRoutes) billing[route] = file.billing[route];
    body[PRICING_BILLING_KEY] = billing;
  }
  const calendarYears = Object.keys(file.calendar).sort((left, right) => left.localeCompare(right));
  if (calendarYears.length > 0) {
    const calendar = {};
    for (const year of calendarYears) {
      calendar[year] = mergeHolidayDates((file.calendar[year] ?? []).flatMap((range) => holidayDates(range)));
    }
    body[PRICING_CALENDAR_KEY] = calendar;
  }
  const usdRoutes = Object.keys(file.currency).filter((route) => file.currency[route] === "USD").sort((left, right) => left.localeCompare(right));
  if (usdRoutes.length > 0) {
    const currency = {};
    for (const route of usdRoutes) currency[route] = "USD";
    body[PRICING_CURRENCY_KEY] = currency;
  }
  if (file.fx !== void 0) body[PRICING_FX_KEY] = { cnyPerUsd: file.fx.cnyPerUsd };
  for (const route of Object.keys(file.table).sort((left, right) => left.localeCompare(right))) {
    const models = file.table[route];
    const priced = {};
    for (const model of Object.keys(models).sort((left, right) => left.localeCompare(right))) {
      const entry = models[model];
      const slots = entry.slots ?? [];
      priced[model] = {
        inputPerMillion: entry.rates.inputPerMillion,
        outputPerMillion: entry.rates.outputPerMillion,
        ...entry.rates.cacheReadPerMillion !== void 0 ? { cacheReadPerMillion: entry.rates.cacheReadPerMillion } : {},
        ...entry.rates.cacheWritePerMillion !== void 0 ? { cacheWritePerMillion: entry.rates.cacheWritePerMillion } : {},
        ...slots.length > 0 ? { slots: slots.map(slotBody) } : {}
      };
    }
    if (Object.keys(priced).length > 0) body[route] = priced;
  }
  return body;
}
async function writePriceFile(dir, file, logger = console) {
  const target = join4(dir, PRICING_FILE);
  const tmp = join4(dir, `${PRICING_FILE}.tmp`);
  const backup = join4(dir, `${PRICING_FILE}.bak`);
  try {
    await mkdir4(dirname2(target), { recursive: true });
    await writeFile4(tmp, `${JSON.stringify(priceFileBody(file), null, 2)}
`, "utf8");
    await rename3(target, backup).catch(() => void 0);
    await rename3(tmp, target);
  } catch (error) {
    logger.error(`[tokbook] cannot write ${PRICING_FILE}:`, error);
    throw error;
  }
}
function entryAt(table, route, model) {
  if (route === void 0 || route === "") return null;
  return table[route]?.[model] ?? null;
}
var NO_HOLIDAYS = /* @__PURE__ */ new Set();
function slotAt(entry, timeMs, holidays = NO_HOLIDAYS) {
  for (const slot of entry.slots ?? []) {
    if (slotCovers(slot, timeMs, holidays)) return slot;
  }
  return null;
}
function slotRefAt(entry, timeMs, holidays) {
  const slot = slotAt(entry, timeMs, holidays);
  return slot === null ? null : { start: slot.start, days: slot.days };
}
function rateKeyAt(table, route, model, timeMs, holidays = NO_HOLIDAYS) {
  const entry = entryAt(table, route, model);
  return entry === null ? UNPRICED_KEY : { slot: slotRefAt(entry, timeMs, holidays) };
}
function priceOfKey(table, route, model, key) {
  if (key.unpriced === true) return null;
  const entry = entryAt(table, route, model);
  if (entry === null) return null;
  const ref = key.slot;
  if (ref === void 0 || ref === null) return entry.rates;
  const slot = (entry.slots ?? []).find((item) => item.start === ref.start && item.days === ref.days);
  return slot === void 0 ? null : { ...entry.rates, ...slot.rates };
}
function billingOf(billing, route) {
  if (route === void 0 || route === "") return "metered";
  return billing[route] ?? "metered";
}
function costOf(totals, prices) {
  const M = 1e6;
  const cacheRead = prices.cacheReadPerMillion ?? prices.inputPerMillion;
  const cacheWrite = prices.cacheWritePerMillion ?? prices.inputPerMillion;
  return (totals.inputTokens * prices.inputPerMillion + totals.outputTokens * prices.outputPerMillion + totals.cacheReadTokens * cacheRead + totals.cacheWriteTokens * cacheWrite) / M;
}
function scaledRates(rates, rate) {
  return {
    inputPerMillion: rates.inputPerMillion * rate,
    outputPerMillion: rates.outputPerMillion * rate,
    ...rates.cacheReadPerMillion !== void 0 ? { cacheReadPerMillion: rates.cacheReadPerMillion * rate } : {},
    ...rates.cacheWritePerMillion !== void 0 ? { cacheWritePerMillion: rates.cacheWritePerMillion * rate } : {}
  };
}
function cnyTable(table, currency, fx) {
  const usdRoutes = Object.keys(currency).filter((route) => currency[route] === "USD");
  if (usdRoutes.length === 0) return table;
  const rate = fx === void 0 ? 0 : fx.cnyPerUsd;
  const out = { ...table };
  for (const route of usdRoutes) {
    const models = table[route];
    if (models === void 0) continue;
    if (!(rate > 0)) {
      delete out[route];
      continue;
    }
    const scaled = {};
    for (const [model, entry] of Object.entries(models)) {
      scaled[model] = {
        rates: scaledRates(entry.rates, rate),
        ...entry.slots !== void 0 ? { slots: entry.slots.map((slot) => ({ ...slot, rates: scaledRates(slot.rates, rate) })) } : {}
      };
    }
    out[route] = scaled;
  }
  return out;
}

// src/stats.ts
function snapshotBaseline(snapshots) {
  const baseline = /* @__PURE__ */ new Map();
  for (const snap of snapshots) {
    if (snap.revision === void 0) continue;
    baseline.set(snap.header.id, String(snap.revision));
  }
  return baseline;
}
function staleSessionIds(syncedOnce, syncedBySession, snapshots) {
  if (!syncedOnce) return snapshots.map((snap) => snap.header.id);
  const out = [];
  for (const snap of snapshots) {
    const id = snap.header.id;
    if (syncedBySession.get(id) === void 0) {
      out.push(id);
      continue;
    }
    if (snap.revision === void 0 || syncedBySession.get(id) !== String(snap.revision)) out.push(id);
  }
  return out;
}
var consoleLogger = console;
function hourKey(time) {
  const date = new Date(time);
  const hour = String(date.getHours()).padStart(2, "0");
  return `${dayKeyOf(time)}T${hour}`;
}
function dayKeyOffset(day, back) {
  const [year, month, date] = day.split("-").map(Number);
  return dayKeyOf(new Date(year, month - 1, date - back).getTime());
}
function rangeDayWindow(range, now = () => /* @__PURE__ */ new Date()) {
  const to = dayKeyOf(now().getTime());
  if (range === "all") return { fromDay: "", toDay: to };
  const back = range === "yesterday" ? 2 : range === "last7" ? 7 : range === "last30" ? 30 : 1;
  return { fromDay: dayKeyOffset(to, back - 1), toDay: range === "yesterday" ? dayKeyOffset(to, 1) : to };
}
var dirs2 = /* @__PURE__ */ new Map();
function stateOf2(dir) {
  const existing = dirs2.get(dir);
  if (existing !== void 0) return existing;
  const created = { files: /* @__PURE__ */ new Map(), inflight: void 0 };
  dirs2.set(dir, created);
  return created;
}
async function readDayFile(dir, name2, logger = consoleLogger) {
  let text;
  try {
    text = await readFile5(join5(dir, name2), "utf8");
  } catch (error) {
    logger.error(`[tokbook] cannot read ${name2}:`, error);
    return null;
  }
  const records = [];
  for (const line of text.split("\n")) {
    if (line === "") continue;
    const record = parseRecord(line);
    if (record !== null) records.push(record);
  }
  return records;
}
async function listDayFiles(dir) {
  let names;
  try {
    names = await readdir2(dir);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  return names.filter((name2) => dayOfFileName(name2) !== null).sort();
}
async function fileStamp(dir, name2) {
  try {
    const info = await stat(join5(dir, name2));
    return { size: info.size, mtimeMs: info.mtimeMs };
  } catch {
    return null;
  }
}
async function loadFileCached(cache, dir, name2, logger) {
  return (await loadFileStamped(cache, dir, name2, logger)).records;
}
async function loadFileStamped(cache, dir, name2, logger) {
  const cached = cache.files.get(name2);
  const info = await fileStamp(dir, name2);
  if (info === null) {
    cache.files.delete(name2);
    return { records: [], stamp: null };
  }
  if (cached !== void 0 && cached.size === info.size && cached.mtimeMs === info.mtimeMs) {
    return { records: cached.records, stamp: stampKey(info) };
  }
  const records = await readDayFile(dir, name2, logger);
  if (records === null) {
    cache.files.delete(name2);
    return { records: [], stamp: null };
  }
  cache.files.set(name2, { records, size: info.size, mtimeMs: info.mtimeMs });
  return { records, stamp: stampKey(info) };
}
async function loadDir(dir, cache, logger) {
  const names = await listDayFiles(dir);
  const live = new Set(names);
  for (const name2 of cache.files.keys()) {
    if (!live.has(name2)) cache.files.delete(name2);
  }
  const out = [];
  for (const name2 of names) {
    out.push(...await loadFileCached(cache, dir, name2, logger));
  }
  return out;
}
async function readCachedRecords(dir, logger = consoleLogger) {
  const cache = stateOf2(dir);
  if (cache.inflight !== void 0) return cache.inflight;
  const pending = loadDir(dir, cache, logger).finally(() => {
    if (cache.inflight === pending) cache.inflight = void 0;
  });
  cache.inflight = pending;
  return pending;
}
async function readRecordsByDayRange(dir, fromDay, toDay, logger = consoleLogger) {
  if (fromDay > toDay) return [];
  const cache = stateOf2(dir);
  const names = [];
  for (const name2 of await listDayFiles(dir)) {
    const day = dayOfFileName(name2);
    if (day >= fromDay && day <= toDay) names.push(name2);
  }
  const out = [];
  for (const name2 of names) {
    out.push(...await loadFileCached(cache, dir, name2, logger));
  }
  return out;
}
async function warmRecordCache(dir, logger) {
  await readCachedRecords(dir, logger);
}
var ROLLUP_FILE_NAME = "rollup.json";
var ROLLUP_SCHEMA_VERSION = 10;
var ROLLUP_FIELDS = ["requests", "inputTokens", "outputTokens", "cacheReadTokens", "cacheWriteTokens"];
function isTotals(value) {
  if (typeof value !== "object" || value === null) return false;
  const totals = value;
  return ROLLUP_FIELDS.every((key) => typeof totals[key] === "number" && Number.isFinite(totals[key]));
}
var DAY_KEY = /^\d{4}-\d{2}-\d{2}$/u;
function isFileStamps(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.entries(value).every(([name2, stamp]) => dayOfFileName(name2) !== null && typeof stamp === "string" && stamp !== "");
}
function isRollupFile(value) {
  if (typeof value !== "object" || value === null) return false;
  const rollup = value;
  return rollup.schemaVersion === ROLLUP_SCHEMA_VERSION && typeof rollup.upto === "string" && DAY_KEY.test(rollup.upto) && typeof rollup.pricingRevision === "string" && isFileStamps(rollup.files) && (rollup.lastEventAt === null || typeof rollup.lastEventAt === "number" && Number.isFinite(rollup.lastEventAt)) && isTotals(rollup.total) && Array.isArray(rollup.byDay) && Array.isArray(rollup.byHour) && Array.isArray(rollup.byModel) && Array.isArray(rollup.rateRows);
}
function rollupIsCurrent(rollup, stamps) {
  for (const [name2, stamp] of Object.entries(rollup.files)) {
    if (stamps.get(name2) !== stamp) return false;
  }
  for (const name2 of stamps.keys()) {
    const day = dayOfFileName(name2);
    if (day === null || day > rollup.upto) continue;
    if (rollup.files[name2] === void 0) return false;
  }
  return true;
}
async function readRollup(dir, logger = consoleLogger, pricingRevision = "") {
  let text;
  try {
    text = await readFile5(join5(dir, ROLLUP_FILE_NAME), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    logger.error("[tokbook] cannot read rollup:", error);
    return null;
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRollupFile(value)) return null;
  if (value.pricingRevision !== pricingRevision) return null;
  return value;
}
async function writeRollup(dir, rollup) {
  const target = join5(dir, ROLLUP_FILE_NAME);
  const tmp = join5(dir, `${ROLLUP_FILE_NAME}.tmp`);
  await writeFile5(tmp, JSON.stringify({ ...rollup, schemaVersion: ROLLUP_SCHEMA_VERSION }), "utf8");
  await unlink3(target).catch(() => void 0);
  await rename4(tmp, target);
}
function emptyTotals() {
  return {
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    compactions: 0,
    failures: 0,
    usageUnknown: 0
  };
}
function addTotals(target, source) {
  target.requests += source.requests;
  target.inputTokens += source.inputTokens;
  target.outputTokens += source.outputTokens;
  target.cacheReadTokens += source.cacheReadTokens;
  target.cacheWriteTokens += source.cacheWriteTokens;
  target.compactions = (target.compactions ?? 0) + (source.compactions ?? 0);
  target.failures = (target.failures ?? 0) + (source.failures ?? 0);
  target.usageUnknown = (target.usageUnknown ?? 0) + (source.usageUnknown ?? 0);
  const codes = source.failuresByCode;
  if (codes !== void 0) {
    const merged = target.failuresByCode ?? {};
    for (const [code, count] of Object.entries(codes)) {
      merged[code] = (merged[code] ?? 0) + count;
    }
    target.failuresByCode = merged;
  }
}
function dayRows(days) {
  return [...days.entries()].map(([day, totals]) => ({ day, totals })).sort((left, right) => left.day < right.day ? -1 : 1);
}
function modelRows(models) {
  return [...models.values()].sort((left, right) => right.totals.requests - left.totals.requests || left.model.localeCompare(right.model));
}
function hourRows(hours) {
  return [...hours.entries()].map(([key, totals]) => {
    const separator = key.indexOf("\n");
    return { hour: key.slice(0, separator), model: key.slice(separator + 1), totals };
  }).sort((left, right) => left.hour < right.hour ? -1 : left.hour > right.hour ? 1 : left.model.localeCompare(right.model));
}
function compareKeys(left, right) {
  return (left.slot?.start ?? -1) - (right.slot?.start ?? -1);
}
function rateRowsSorted(rows) {
  return [...rows].sort((left, right) => left.day < right.day ? -1 : left.day > right.day ? 1 : left.model < right.model ? -1 : left.model > right.model ? 1 : left.provider < right.provider ? -1 : left.provider > right.provider ? 1 : compareKeys(left.rate, right.rate));
}
function providerKey(provider) {
  return provider ?? "";
}
function modelMapKey(provider, model) {
  return `${providerKey(provider)}
${model}`;
}
function rateRowKey(day, model, provider, rate) {
  const slot = rate.unpriced === true ? "unpriced" : rate.slot === void 0 || rate.slot === null ? "-" : `${String(rate.slot.start)}:${rate.slot.days}`;
  return `${day}
${model}
${providerKey(provider)}
${slot}`;
}
function hourRowKey(hour, model) {
  return `${hour}
${model}`;
}
function addUsage(totals, record) {
  if (record.kind === "failure") {
    totals.failures = (totals.failures ?? 0) + 1;
    const code = record.failureCode ?? "UNKNOWN";
    const byCode = totals.failuresByCode ?? {};
    byCode[code] = (byCode[code] ?? 0) + 1;
    totals.failuresByCode = byCode;
    return;
  }
  totals.requests += 1;
  if (record.kind === "compaction") {
    totals.compactions = (totals.compactions ?? 0) + 1;
  }
  const usage = record.usage;
  if (usage === void 0) {
    totals.usageUnknown = (totals.usageUnknown ?? 0) + 1;
    return;
  }
  totals.inputTokens += usage.inputTokens;
  totals.outputTokens += usage.outputTokens;
  if (usage.cacheReadTokens !== void 0) totals.cacheReadTokens += usage.cacheReadTokens;
  if (usage.cacheWriteTokens !== void 0) totals.cacheWriteTokens += usage.cacheWriteTokens;
}
function summarizeRecords(records, resolve = () => UNPRICED_KEY) {
  const total = emptyTotals();
  const days = /* @__PURE__ */ new Map();
  const hours = /* @__PURE__ */ new Map();
  const models = /* @__PURE__ */ new Map();
  const rated = /* @__PURE__ */ new Map();
  let lastEventAt = null;
  for (const record of records) {
    if (lastEventAt === null || record.time > lastEventAt) lastEventAt = record.time;
    addUsage(total, record);
    const day = dayKeyOf(record.time);
    const dayTotals = days.get(day) ?? emptyTotals();
    addUsage(dayTotals, record);
    days.set(day, dayTotals);
    if (record.model !== "") {
      const hour = hourKey(record.time);
      const hourTotals = hours.get(hourRowKey(hour, record.model)) ?? emptyTotals();
      addUsage(hourTotals, record);
      hours.set(hourRowKey(hour, record.model), hourTotals);
      const key = modelMapKey(record.provider, record.model);
      let row = models.get(key);
      if (row === void 0) {
        row = { provider: record.provider ?? "", model: record.model, totals: emptyTotals() };
        models.set(key, row);
      }
      addUsage(row.totals, record);
    }
    const rate = resolve(record);
    const rowKey = rateRowKey(day, record.model, record.provider, rate);
    const cell = rated.get(rowKey) ?? { day, model: record.model, provider: record.provider ?? "", rate, totals: emptyTotals() };
    addUsage(cell.totals, record);
    rated.set(rowKey, cell);
  }
  const byDay = dayRows(days);
  const byHour = hourRows(hours);
  const byModel = modelRows(models);
  return { total, byDay, byHour, byModel, rateRows: rateRowsSorted(rated.values()), lastEventAt };
}
function mergeSummaries(left, right) {
  const total = emptyTotals();
  addTotals(total, left.total);
  addTotals(total, right.total);
  const days = /* @__PURE__ */ new Map();
  const hours = /* @__PURE__ */ new Map();
  const models = /* @__PURE__ */ new Map();
  const rated = /* @__PURE__ */ new Map();
  for (const row of [...left.byDay, ...right.byDay]) {
    const day = days.get(row.day) ?? emptyTotals();
    addTotals(day, row.totals);
    days.set(row.day, day);
  }
  for (const row of [...left.byHour, ...right.byHour]) {
    const key = hourRowKey(row.hour, row.model);
    const cell = hours.get(key) ?? emptyTotals();
    addTotals(cell, row.totals);
    hours.set(key, cell);
  }
  for (const row of [...left.byModel, ...right.byModel]) {
    const key = modelMapKey(row.provider, row.model);
    const existing = models.get(key);
    const totals = existing?.totals ?? emptyTotals();
    addTotals(totals, row.totals);
    models.set(key, {
      provider: row.provider,
      model: row.model,
      totals
    });
  }
  for (const row of [...left.rateRows, ...right.rateRows]) {
    const key = rateRowKey(row.day, row.model, row.provider, row.rate);
    const cell = rated.get(key) ?? { day: row.day, model: row.model, provider: row.provider, rate: row.rate, totals: emptyTotals() };
    addTotals(cell.totals, row.totals);
    rated.set(key, cell);
  }
  const later = left.lastEventAt === null ? right.lastEventAt : right.lastEventAt === null ? left.lastEventAt : Math.max(left.lastEventAt, right.lastEventAt);
  return {
    total,
    byDay: dayRows(days),
    byHour: hourRows(hours),
    byModel: modelRows(models),
    rateRows: rateRowsSorted(rated.values()),
    lastEventAt: later
  };
}
function attachCosts(summary, pricing, billing = {}) {
  const costs = /* @__PURE__ */ new Map();
  const spend = /* @__PURE__ */ new Map();
  const value = /* @__PURE__ */ new Map();
  const daySpend = /* @__PURE__ */ new Map();
  const dayValue = /* @__PURE__ */ new Map();
  const unpriced = /* @__PURE__ */ new Set();
  let totalCost = 0;
  let totalSpend = 0;
  let totalValue = 0;
  for (const row of summary.rateRows) {
    const prices = priceOfKey(pricing, row.provider, row.model, row.rate);
    if (prices === null) {
      if (row.model !== "") unpriced.add(row.model);
      continue;
    }
    const cost = costOf(row.totals, prices);
    const key = modelMapKey(row.provider, row.model);
    costs.set(key, (costs.get(key) ?? 0) + cost);
    if (billingOf(billing, row.provider) === "subscription") {
      value.set(key, (value.get(key) ?? 0) + cost);
      dayValue.set(row.day, (dayValue.get(row.day) ?? 0) + cost);
      totalValue += cost;
    } else {
      spend.set(key, (spend.get(key) ?? 0) + cost);
      daySpend.set(row.day, (daySpend.get(row.day) ?? 0) + cost);
      totalSpend += cost;
    }
    totalCost += cost;
  }
  const byModel = summary.byModel.map((row) => {
    const key = modelMapKey(row.provider, row.model);
    const cost = costs.get(key) ?? 0;
    return {
      provider: row.provider,
      model: row.model,
      totals: row.totals,
      cost,
      spend: spend.get(key) ?? 0,
      subscriptionValue: value.get(key) ?? 0
    };
  });
  const unpricedModels = [...unpriced];
  const byDay = summary.byDay.map((row) => ({
    day: row.day,
    totals: row.totals,
    spend: daySpend.get(row.day) ?? 0,
    subscriptionValue: dayValue.get(row.day) ?? 0
  }));
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
    rateRows: summary.rateRows
  };
}
function stampKey(stamp) {
  return `${String(stamp.size)}:${String(stamp.mtimeMs)}`;
}
async function buildSummary(dir, now = () => /* @__PURE__ */ new Date(), resolve = () => UNPRICED_KEY, logger = consoleLogger, options = {}) {
  const pricingRevision = options.pricingRevision ?? "";
  const today = dayKeyOf(now().getTime());
  const cache = stateOf2(dir);
  const names = await listDayFiles(dir);
  const stored = await readRollup(dir, logger, pricingRevision);
  const stamps = /* @__PURE__ */ new Map();
  if (stored !== null) {
    for (const name2 of names) {
      if (dayOfFileName(name2) > stored.upto) continue;
      const stamp = await fileStamp(dir, name2);
      if (stamp !== null) stamps.set(name2, stampKey(stamp));
    }
  }
  const rollup = stored !== null && rollupIsCurrent(stored, stamps) ? stored : { schemaVersion: ROLLUP_SCHEMA_VERSION, upto: "", pricingRevision, files: {}, total: emptyTotals(), byDay: [], byHour: [], byModel: [], rateRows: [], lastEventAt: null };
  const cold = [];
  const hot = [];
  for (const name2 of names) {
    const day = dayOfFileName(name2);
    if (day <= rollup.upto) continue;
    if (day < today) cold.push(name2);
    else hot.push(name2);
  }
  let absorbed = rollup;
  if (cold.length > 0) {
    const records = [];
    const files = { ...rollup.files };
    for (const name2 of cold) {
      const file = await loadFileStamped(cache, dir, name2, logger);
      if (file.stamp !== null) files[name2] = file.stamp;
      records.push(...file.records);
    }
    absorbed = {
      upto: dayOfFileName(cold[cold.length - 1]),
      schemaVersion: ROLLUP_SCHEMA_VERSION,
      pricingRevision,
      files,
      ...mergeSummaries(rollup, summarizeRecords(records, resolve))
    };
    await writeRollup(dir, absorbed).catch((error) => {
      logger.error("[tokbook] cannot write rollup:", error);
    });
  }
  const fresh = [];
  for (const name2 of hot) fresh.push(...await loadFileCached(cache, dir, name2, logger));
  return { dataDir: dir, ...mergeSummaries(absorbed, summarizeRecords(fresh, resolve)) };
}

// src/window-usage.ts
import { resolve as resolvePath } from "node:path";
var UNKNOWN_PROVIDER = "(\u672A\u77E5)";
var UNATTRIBUTED_ID = "";
var UNATTRIBUTED_TITLE = "\u672A\u5F52\u5C5E";
function providerKeyOf(record) {
  return record.provider !== void 0 && record.provider !== "" ? record.provider : UNKNOWN_PROVIDER;
}
function pathKey(path) {
  const normalized = resolvePath(path);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}
function emptyTotals2() {
  return {
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    compactions: 0,
    failures: 0,
    usageUnknown: 0
  };
}
function addUsage2(totals, record) {
  if (record.kind === "failure") {
    totals.failures = (totals.failures ?? 0) + 1;
    const code = record.failureCode ?? "UNKNOWN";
    const byCode = totals.failuresByCode ?? {};
    byCode[code] = (byCode[code] ?? 0) + 1;
    totals.failuresByCode = byCode;
    return;
  }
  totals.requests += 1;
  if (record.kind === "compaction") totals.compactions = (totals.compactions ?? 0) + 1;
  const usage = record.usage;
  if (usage === void 0) {
    totals.usageUnknown = (totals.usageUnknown ?? 0) + 1;
    return;
  }
  totals.inputTokens += usage.inputTokens;
  totals.outputTokens += usage.outputTokens;
  if (usage.cacheReadTokens !== void 0) totals.cacheReadTokens += usage.cacheReadTokens;
  if (usage.cacheWriteTokens !== void 0) totals.cacheWriteTokens += usage.cacheWriteTokens;
}
function bucketsOf(usage) {
  return {
    requests: 0,
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    cacheReadTokens: usage?.cacheReadTokens ?? 0,
    cacheWriteTokens: usage?.cacheWriteTokens ?? 0
  };
}
function emptyMoney() {
  return { cost: 0, spend: 0, subscriptionValue: 0 };
}
function addMoney(into, cost, nature) {
  into.cost += cost;
  if (nature === "subscription") into.subscriptionValue += cost;
  else into.spend += cost;
}
function aggregateWindow(records, workspaces, cwdOf, pricing, resolve, billing = {}) {
  const providers = /* @__PURE__ */ new Map();
  const byPath = /* @__PURE__ */ new Map();
  const byId = /* @__PURE__ */ new Map();
  if (workspaces !== null) {
    for (const workspace of workspaces) {
      byId.set(workspace.id, workspace);
      if (workspace.path !== "") byPath.set(pathKey(workspace.path), workspace);
    }
  }
  const owner = /* @__PURE__ */ new Map();
  const workspaceAcc = /* @__PURE__ */ new Map();
  for (const record of records) {
    const key = providerKeyOf(record);
    let provider = providers.get(key);
    if (provider === void 0) {
      provider = { provider: key, totals: emptyTotals2(), money: emptyMoney(), models: /* @__PURE__ */ new Map(), unpriced: /* @__PURE__ */ new Set() };
      providers.set(key, provider);
    }
    addUsage2(provider.totals, record);
    let workspace = null;
    if (workspaces !== null) {
      let hit = owner.get(record.sessionId);
      if (hit === void 0) {
        const cwd = cwdOf(record.sessionId);
        hit = cwd === void 0 || cwd === "" ? null : byPath.get(pathKey(cwd)) ?? null;
        owner.set(record.sessionId, hit);
      }
      const workspaceKey = hit?.id ?? UNATTRIBUTED_ID;
      let acc = workspaceAcc.get(workspaceKey);
      if (acc === void 0) {
        acc = { totals: emptyTotals2(), money: emptyMoney(), lastAt: record.time };
        workspaceAcc.set(workspaceKey, acc);
      } else if (record.time > acc.lastAt) {
        acc.lastAt = record.time;
      }
      addUsage2(acc.totals, record);
      workspace = acc;
    }
    let model = null;
    if (record.model !== "") {
      let row = provider.models.get(record.model);
      if (row === void 0) {
        row = { model: record.model, totals: emptyTotals2(), money: emptyMoney(), billing: billingOf(billing, record.provider) };
        provider.models.set(record.model, row);
      }
      addUsage2(row.totals, record);
      model = row;
    }
    const prices = priceOfKey(pricing, record.provider, record.model, resolve(record));
    if (prices === null) {
      if (record.model !== "") provider.unpriced.add(record.model);
      continue;
    }
    const nature = billingOf(billing, record.provider);
    const cost = costOf(bucketsOf(record.usage), prices);
    addMoney(provider.money, cost, nature);
    if (workspace !== null) addMoney(workspace.money, cost, nature);
    if (model !== null) addMoney(model.money, cost, nature);
  }
  const cards = [];
  const byModel = [];
  for (const provider of providers.values()) {
    if (provider.totals.requests === 0) continue;
    const models = [...provider.models.values()].sort((left, right) => totalsTokens(right.totals) - totalsTokens(left.totals) || right.totals.requests - left.totals.requests || left.model.localeCompare(right.model)).map((row) => ({
      model: row.model,
      totals: row.totals,
      tokens: totalsTokens(row.totals),
      cost: row.money.cost,
      spend: row.money.spend,
      subscriptionValue: row.money.subscriptionValue,
      billing: row.billing
    }));
    for (const row of models) {
      byModel.push({
        provider: provider.provider,
        model: row.model,
        totals: row.totals,
        cost: row.cost,
        spend: row.spend,
        subscriptionValue: row.subscriptionValue
      });
    }
    cards.push({
      provider: provider.provider,
      tokens: models.reduce((sum, row) => sum + row.tokens, 0),
      cost: provider.money.cost,
      spend: provider.money.spend,
      subscriptionValue: provider.money.subscriptionValue,
      unpricedModels: [...provider.unpriced],
      models,
      requests: provider.totals.requests,
      compactions: provider.totals.compactions ?? 0,
      usageUnknown: provider.totals.usageUnknown ?? 0
    });
  }
  cards.sort((left, right) => right.tokens - left.tokens || right.requests - left.requests || left.provider.localeCompare(right.provider));
  if (workspaces === null) return { providers: cards, byWorkspace: [], byModel };
  const named = [];
  let unattributed = null;
  for (const [key, acc] of workspaceAcc) {
    if (acc.totals.requests === 0) continue;
    const workspace = byId.get(key);
    const row = {
      id: key,
      title: workspace?.title ?? UNATTRIBUTED_TITLE,
      path: workspace?.path ?? "",
      totals: acc.totals,
      tokens: totalsTokens(acc.totals),
      spend: acc.money.spend,
      subscriptionValue: acc.money.subscriptionValue,
      lastAt: acc.lastAt
    };
    if (key === UNATTRIBUTED_ID) unattributed = row;
    else named.push(row);
  }
  named.sort((left, right) => right.lastAt - left.lastAt || right.tokens - left.tokens || left.title.localeCompare(right.title));
  return {
    providers: cards,
    byWorkspace: unattributed === null ? named : [...named, unattributed],
    byModel
  };
}

// src/holiday-cn.ts
import { mkdir as mkdir5, readFile as readFile6, rename as rename5, unlink as unlink4, writeFile as writeFile6 } from "node:fs/promises";
import { dirname as dirname3, join as join6 } from "node:path";
import { randomUUID } from "node:crypto";
var HOLIDAY_CN_BASE = "https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master";
var HOLIDAY_CN_TIMEOUT_MS = 1e4;
var HOLIDAY_CACHE_FILE = "holiday-cn.json";
var HOLIDAY_REFRESH_DAYS = 1;
var EMPTY_HOLIDAY_CACHE = { years: {} };
function isRange(value) {
  if (typeof value !== "object" || value === null) return false;
  const raw = value;
  return typeof raw.start === "string" && typeof raw.end === "string";
}
async function readHolidayCache(dir) {
  let text;
  try {
    text = await readFile6(join6(dir, HOLIDAY_CACHE_FILE), "utf8");
  } catch {
    return EMPTY_HOLIDAY_CACHE;
  }
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null) return EMPTY_HOLIDAY_CACHE;
    const raw = parsed;
    const years = raw.years;
    if (typeof years !== "object" || years === null) return EMPTY_HOLIDAY_CACHE;
    const kept = {};
    for (const [year, entry] of Object.entries(years)) {
      if (!isYearKey(year) || typeof entry !== "object" || entry === null) continue;
      const value = entry;
      if (!Array.isArray(value.ranges) || typeof value.fetchedAt !== "number") continue;
      kept[year] = { ranges: value.ranges.filter(isRange), fetchedAt: value.fetchedAt };
    }
    const lastAttemptAt = typeof raw.lastAttemptAt === "number" ? raw.lastAttemptAt : null;
    const lastError = typeof raw.lastError === "string" ? raw.lastError : null;
    return { years: kept, lastAttemptAt, lastError };
  } catch {
    return EMPTY_HOLIDAY_CACHE;
  }
}
async function writeHolidayCache(dir, cache) {
  const target = join6(dir, HOLIDAY_CACHE_FILE);
  const tmp = `${target}.${String(process.pid)}.${randomUUID()}.tmp`;
  await mkdir5(dirname3(target), { recursive: true });
  try {
    await writeFile6(tmp, JSON.stringify(cache, null, 2), "utf8");
    await unlink4(target).catch(() => void 0);
    await rename5(tmp, target);
  } catch (error) {
    await unlink4(tmp).catch(() => void 0);
    throw error;
  }
}
function parseHolidayYear(body, year) {
  if (typeof body !== "object" || body === null) return null;
  const raw = body;
  if (raw.year !== void 0 && Number(raw.year) !== Number(year)) return null;
  if (!Array.isArray(raw.days)) return null;
  const indexes = [];
  for (const item of raw.days) {
    if (typeof item !== "object" || item === null) continue;
    const day = item;
    if (day.isOffDay !== true) continue;
    if (typeof day.date !== "string") continue;
    if (day.date.slice(0, 4) !== year) continue;
    const index = dayIndex(day.date);
    if (index !== null) indexes.push(index);
  }
  return mergeIndexes(indexes);
}
function mergeIndexes(indexes) {
  const sorted = [...new Set(indexes)].sort((left, right) => left - right);
  const ranges = [];
  for (const index of sorted) {
    const last = ranges[ranges.length - 1];
    if (last !== void 0 && index - (dayIndex(last.end) ?? index) === 1) last.end = dayKeyOfIndex(index);
    else ranges.push({ start: dayKeyOfIndex(index), end: dayKeyOfIndex(index) });
  }
  return ranges;
}
async function fetchHolidayYear(year) {
  const response = await fetch(`${HOLIDAY_CN_BASE}/${year}.json`, {
    signal: AbortSignal.timeout(HOLIDAY_CN_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`holiday-cn/${year}.json \u7B54 HTTP ${String(response.status)}`);
  const body = await response.json();
  const ranges = parseHolidayYear(body, year);
  if (ranges === null) throw new Error(`holiday-cn/${year}.json \u7684\u5F62\u72B6\u8BFB\u4E0D\u61C2`);
  return ranges;
}
function mergeHolidayCalendars(manual, auto) {
  const merged = { ...auto };
  for (const [year, ranges] of Object.entries(manual)) merged[year] = ranges;
  return merged;
}
function autoOnly(manual, auto) {
  const out = {};
  for (const [year, ranges] of Object.entries(auto)) {
    if (manual[year] === void 0) out[year] = ranges;
  }
  return out;
}
function calendarSignature(calendar) {
  const years = Object.keys(calendar).sort((left, right) => left.localeCompare(right));
  return years.map((year) => `${year}:${calendar[year].map((range) => `${range.start}~${range.end}`).join(",")}`).join(";");
}
function isFresh(entry, nowMs) {
  if (entry === void 0) return false;
  return nowMs - entry.fetchedAt < HOLIDAY_REFRESH_DAYS * 864e5;
}
function autoHolidayState(cache, wantedYears, nowMs) {
  const covered = wantedYears.filter((year) => (cache.years[year]?.ranges.length ?? 0) > 0);
  const uncovered = wantedYears.filter((year) => !covered.includes(year));
  const error = cache.lastError ?? null;
  const lastAttemptAt = cache.lastAttemptAt ?? null;
  if (wantedYears.length === 0) return { state: "ok", covered, uncovered };
  if (covered.length === 0) return { state: "missing", covered, uncovered };
  if (error !== null) return { state: "failed", covered, uncovered };
  const fresh = covered.some((year) => isFresh(cache.years[year], nowMs));
  if (!fresh && lastAttemptAt !== null && nowMs - lastAttemptAt >= HOLIDAY_REFRESH_DAYS * 864e5) {
    return { state: "stale", covered, uncovered };
  }
  return { state: "ok", covered, uncovered };
}

// src/models-dev.ts
var MODELS_DEV_URL = "https://models.dev/api.json";
var MODELS_DEV_TIMEOUT_MS = 15e3;
var FIRST_PARTY_PROVIDERS = /* @__PURE__ */ new Set([
  "openai",
  "anthropic",
  "deepseek",
  "google",
  "xai",
  "alibaba",
  "moonshotai",
  "moonshotai-cn",
  "zai",
  "minimax",
  "minimax-cn",
  "xiaomi",
  "tencent",
  "cohere",
  "mistral",
  "bytedance",
  "baidu"
]);
function normalizeModelId(modelId) {
  const afterSlash = modelId.slice(modelId.lastIndexOf("/") + 1);
  const beforeColon = afterSlash.split(":")[0] ?? "";
  let normalized = beforeColon.trim().replace(/@/g, "-").toLowerCase();
  if (normalized.endsWith("[1m]")) normalized = normalized.slice(0, -"[1m]".length).trim();
  return normalized;
}
function isRate2(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
function coerceCost(raw) {
  if (!isRate2(raw.input) || !isRate2(raw.output)) return null;
  return {
    input: raw.input,
    output: raw.output,
    ...isRate2(raw.cache_read) ? { cacheRead: raw.cache_read } : {},
    ...isRate2(raw.cache_write) ? { cacheWrite: raw.cache_write } : {}
  };
}
function isTextPricingModel(modelId, model) {
  if (typeof model.status === "string" && model.status.toLowerCase() === "deprecated") return false;
  const output = Array.isArray(model.modalities) ? void 0 : model.modalities?.output;
  const out = Array.isArray(output) ? output.filter((m) => typeof m === "string").map((m) => m.toLowerCase()) : void 0;
  if (out !== void 0 && out.length > 0 && (!out.includes("text") || out.some((m) => m !== "text"))) return false;
  const name2 = typeof model.name === "string" ? model.name : "";
  return !/\b(embedding|embed|tts|whisper|realtime|moderation|audio|image|video|transcribe)\b/i.test(`${modelId} ${name2}`);
}
function parseCatalog(value) {
  const catalog = /* @__PURE__ */ new Map();
  if (typeof value !== "object" || value === null || Array.isArray(value)) return catalog;
  const pending = /* @__PURE__ */ new Map();
  for (const [providerId, providerRaw] of Object.entries(value)) {
    if (!FIRST_PARTY_PROVIDERS.has(providerId)) continue;
    if (typeof providerRaw !== "object" || providerRaw === null) continue;
    const models = providerRaw.models;
    if (typeof models !== "object" || models === null || Array.isArray(models)) continue;
    for (const [modelId, modelRaw] of Object.entries(models)) {
      if (typeof modelRaw !== "object" || modelRaw === null) continue;
      const model = modelRaw;
      if (!isTextPricingModel(modelId, model)) continue;
      const cost = coerceCost(model.cost ?? {});
      if (cost === null) continue;
      const key = normalizeModelId(modelId);
      if (key === "") continue;
      const entry = {
        provider: providerId,
        modelId,
        name: typeof model.name === "string" && model.name !== "" ? model.name : modelId,
        cost
      };
      const rates = `${cost.input}/${cost.output}/${cost.cacheRead ?? ""}/${cost.cacheWrite ?? ""}`;
      const previous = pending.get(key);
      if (previous === void 0) pending.set(key, { entry, rates });
      else if (previous.rates !== rates) pending.set(key, { entry: previous.entry, rates: "" });
    }
  }
  for (const [key, { entry, rates }] of pending) {
    if (rates !== "") catalog.set(key, entry);
  }
  return catalog;
}
async function fetchCatalog() {
  const response = await fetch(MODELS_DEV_URL, { signal: AbortSignal.timeout(MODELS_DEV_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`models.dev HTTP ${String(response.status)}`);
  return parseCatalog(await response.json());
}
var LOOKUP_LIMIT = 8;
function searchCatalog(catalog, keyword, limit = LOOKUP_LIMIT) {
  const kw = normalizeModelId(keyword);
  if (kw === "") return [];
  const results = [];
  for (const [key, entry] of catalog) {
    const score = scoreEntry(key, entry, kw);
    if (score > 0) results.push({ entry, key, score });
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}
var TOKEN_SPLIT = /[-_.]/u;
var DIGIT_BOUNDARY = /(?<=[A-Za-z])(?=[0-9])|(?<=[0-9])(?=[A-Za-z])/u;
function splitTokens(s) {
  return s.split(TOKEN_SPLIT).flatMap((t) => t.split(DIGIT_BOUNDARY));
}
function scoreEntry(key, entry, kw) {
  let score = 0;
  if (key === kw) score += 1e3;
  else if (key.startsWith(kw)) score += 700;
  else if (key.includes(kw)) score += 500;
  const keyTokens = splitTokens(key);
  const kwTokens = splitTokens(kw).filter((t) => t.length >= 2);
  if (kwTokens.length >= 2) {
    const matchedTokens = kwTokens.filter((token) => keyTokens.some((t) => t.includes(token))).length;
    if (matchedTokens === kwTokens.length) score += 300 + 100 * matchedTokens;
  }
  if (entry.name.toLowerCase().includes(kw)) score += 200;
  return score;
}

// src/pricing-sync.ts
function billedRouteModels(records) {
  const byRoute = /* @__PURE__ */ new Map();
  for (const record of records) {
    if (record.kind === "failure") continue;
    const route = record.provider ?? "";
    if (route === "" || record.model === "") continue;
    let models = byRoute.get(route);
    if (models === void 0) {
      models = /* @__PURE__ */ new Set();
      byRoute.set(route, models);
    }
    models.add(record.model);
  }
  return byRoute;
}
function round6(value) {
  return Math.round(value * 1e6) / 1e6;
}
function mergeCatalogIntoTable(table, currency, ledger, catalog) {
  const next = { ...table };
  const report = { added: 0, skipped: 0, reasons: {} };
  const skip = (route, model, reason) => {
    report.skipped += 1;
    report.reasons[`${route}/${model}`] = reason;
  };
  for (const [route, models] of ledger) {
    if (currency[route] !== "USD") {
      for (const model of models) skip(route, model, "\u901A\u9053\u4E0D\u662F\u7F8E\u5143\u62A5\u4EF7");
      continue;
    }
    const priced = table[route] ?? {};
    for (const model of models) {
      if (priced[model] !== void 0) {
        continue;
      }
      const entry = catalog.get(normalizeModelId(model));
      if (entry === void 0) {
        skip(route, model, "models.dev \u4E0A\u6CA1\u6709\u91C7\u4FE1\u7684\u6761\u76EE");
        continue;
      }
      next[route] = {
        ...next[route] ?? {},
        [model]: {
          rates: {
            inputPerMillion: round6(entry.cost.input),
            outputPerMillion: round6(entry.cost.output),
            ...entry.cost.cacheRead !== void 0 ? { cacheReadPerMillion: round6(entry.cost.cacheRead) } : {},
            ...entry.cost.cacheWrite !== void 0 ? { cacheWritePerMillion: round6(entry.cost.cacheWrite) } : {}
          }
        }
      };
      report.added += 1;
    }
  }
  return { table: next, report };
}

// src/pricing-sync-state.ts
import { mkdir as mkdir6, readFile as readFile7, rename as rename6, unlink as unlink5, writeFile as writeFile7 } from "node:fs/promises";
import { randomUUID as randomUUID2 } from "node:crypto";
import { dirname as dirname4, join as join7 } from "node:path";
var PRICING_SYNC_STATE_FILE = "models-dev-sync.json";
var EMPTY = {
  lastSyncDay: null,
  lastAttemptAt: null,
  lastError: null,
  nextAttemptAt: null,
  lastAdded: null
};
function isState(value) {
  if (typeof value !== "object" || value === null) return false;
  const raw = value;
  return (raw.lastSyncDay === null || typeof raw.lastSyncDay === "string") && (raw.lastError === null || typeof raw.lastError === "string") && (raw.lastAttemptAt === void 0 || raw.lastAttemptAt === null || typeof raw.lastAttemptAt === "number") && (raw.nextAttemptAt === void 0 || raw.nextAttemptAt === null || typeof raw.nextAttemptAt === "number") && (raw.lastAdded === void 0 || raw.lastAdded === null || typeof raw.lastAdded === "number");
}
var PRICING_SYNC_RETRY_MS = 60 * 60 * 1e3;
function shouldSyncNow(state, nowMs, force) {
  if (force) return true;
  if (state.lastSyncDay !== null && state.lastSyncDay === dayKeyOf(nowMs)) return false;
  return state.nextAttemptAt === null || nowMs >= state.nextAttemptAt;
}
async function readPricingSyncState(dir) {
  let text;
  try {
    text = await readFile7(join7(dir, PRICING_SYNC_STATE_FILE), "utf8");
  } catch {
    return EMPTY;
  }
  try {
    const value = JSON.parse(text);
    if (!isState(value)) return EMPTY;
    return {
      lastSyncDay: value.lastSyncDay,
      lastError: value.lastError,
      lastAttemptAt: value.lastAttemptAt ?? null,
      nextAttemptAt: value.nextAttemptAt ?? null,
      lastAdded: value.lastAdded ?? null
    };
  } catch {
    return EMPTY;
  }
}
async function writeStateFile(dir, state) {
  const target = join7(dir, PRICING_SYNC_STATE_FILE);
  const tmp = `${target}.${String(process.pid)}.${randomUUID2()}.tmp`;
  await mkdir6(dirname4(target), { recursive: true });
  try {
    await writeFile7(tmp, JSON.stringify(state, null, 2), "utf8");
    await unlink5(target).catch(() => void 0);
    await rename6(tmp, target);
  } catch (error) {
    await unlink5(tmp).catch(() => void 0);
    throw error;
  }
}
async function writePricingSyncState(dir, state) {
  await writeStateFile(dir, state);
}

// src/pricing-view.ts
function ledgerUsageOf(records, table, holidays) {
  const byRouteModel = /* @__PURE__ */ new Map();
  const byRoute = /* @__PURE__ */ new Map();
  for (const record of records) {
    if (record.kind === "failure") continue;
    const route = record.provider ?? "";
    if (route === "" || record.model === "") continue;
    let models = byRouteModel.get(route);
    if (models === void 0) {
      models = /* @__PURE__ */ new Map();
      byRouteModel.set(route, models);
    }
    const row = models.get(record.model) ?? { records: 0, firstAt: record.time, unpriced: 0 };
    row.records += 1;
    if (record.time < row.firstAt) row.firstAt = record.time;
    if (rateKeyAt(table, route, record.model, record.time, holidays).unpriced === true) row.unpriced += 1;
    models.set(record.model, row);
    byRoute.set(route, (byRoute.get(route) ?? 0) + 1);
  }
  return { byRouteModel, byRoute };
}
function earliestRecordAt(ledger) {
  let earliest = null;
  for (const models of ledger.byRouteModel.values()) {
    for (const usage of models.values()) {
      if (earliest === null || usage.firstAt < earliest) earliest = usage.firstAt;
    }
  }
  return earliest;
}
function missingCalendarYears(ledger, calendar, now) {
  const earliest = earliestRecordAt(ledger);
  if (earliest === null) return [];
  const taken = new Set(Object.keys(calendar));
  const missing = [];
  for (let year = new Date(earliest).getFullYear(); year <= new Date(now).getFullYear(); year += 1) {
    const key = String(year);
    if (!taken.has(key)) missing.push(key);
  }
  return missing;
}
function slotInput(slot) {
  return {
    days: slot.days,
    start: slot.start,
    end: slot.end,
    inputPerMillion: slot.rates.inputPerMillion,
    outputPerMillion: slot.rates.outputPerMillion,
    ...slot.rates.cacheReadPerMillion !== void 0 ? { cacheReadPerMillion: slot.rates.cacheReadPerMillion } : {},
    ...slot.rates.cacheWritePerMillion !== void 0 ? { cacheWritePerMillion: slot.rates.cacheWritePerMillion } : {}
  };
}
function entryInput(entry) {
  const slots = (entry.slots ?? []).map(slotInput);
  return {
    inputPerMillion: entry.rates.inputPerMillion,
    outputPerMillion: entry.rates.outputPerMillion,
    ...entry.rates.cacheReadPerMillion !== void 0 ? { cacheReadPerMillion: entry.rates.cacheReadPerMillion } : {},
    ...entry.rates.cacheWritePerMillion !== void 0 ? { cacheWritePerMillion: entry.rates.cacheWritePerMillion } : {},
    ...slots.length > 0 ? { slots } : {}
  };
}
async function readPricingView(dir, catalog, ledger, logger = console, holidays, syncView) {
  const [file, syncState] = await Promise.all([readPriceFile(dir, logger), readPricingSyncState(dir)]);
  const routes = /* @__PURE__ */ new Map();
  const ensure = (route, label) => {
    let entry = routes.get(route);
    if (entry === void 0) {
      entry = { label: label !== void 0 && label !== "" ? label : route, models: /* @__PURE__ */ new Map() };
      routes.set(route, entry);
    } else if (label !== void 0 && label !== "" && entry.label === route) {
      entry.label = label;
    }
    return entry.models;
  };
  for (const entry of catalog) {
    const models = ensure(entry.route, entry.label);
    for (const model of entry.models) {
      const name2 = model.name !== void 0 && model.name !== "" && model.name !== model.id ? model.name : void 0;
      const row = models.get(model.id);
      if (row === void 0) {
        models.set(model.id, { configured: true, records: 0, ...name2 !== void 0 ? { name: name2 } : {} });
        continue;
      }
      row.configured = true;
      if (row.name === void 0 && name2 !== void 0) row.name = name2;
    }
  }
  for (const [route, byModel] of ledger.byRouteModel) {
    const models = ensure(route);
    for (const [model, usage] of byModel) {
      const row = models.get(model);
      if (row === void 0) {
        models.set(model, {
          configured: false,
          records: usage.records,
          firstAt: usage.firstAt,
          unpriced: usage.unpriced
        });
        continue;
      }
      row.records = usage.records;
      row.firstAt = usage.firstAt;
      row.unpriced = usage.unpriced;
    }
  }
  for (const [route, byModel] of Object.entries(file.table)) {
    const models = ensure(route);
    for (const model of Object.keys(byModel)) {
      if (!models.has(model)) models.set(model, { configured: false, records: 0 });
    }
  }
  for (const route of [...Object.keys(file.billing), ...Object.keys(file.currency)]) ensure(route);
  const now = Date.now();
  const cards = [];
  for (const [route, entry] of routes) {
    const models = [];
    for (const [model, acc] of entry.models) {
      const price = file.table[route]?.[model];
      models.push({
        model,
        ...acc.name !== void 0 ? { name: acc.name } : {},
        configured: acc.configured,
        records: acc.records,
        ...acc.unpriced !== void 0 ? { unpriced: acc.unpriced } : {},
        ...price !== void 0 ? { price: entryInput(price) } : {}
      });
    }
    models.sort((left, right) => right.records - left.records || Number(right.configured) - Number(left.configured) || left.model.localeCompare(right.model));
    cards.push({
      route,
      label: entry.label,
      billing: billingOf(file.billing, route),
      currency: file.currency[route] ?? "CNY",
      records: ledger.byRoute.get(route) ?? 0,
      models
    });
  }
  cards.sort((left, right) => right.records - left.records || left.route.localeCompare(right.route));
  const calendar = holidays?.calendar ?? file.calendar;
  const autoOnly2 = holidays?.autoOnly ?? [];
  return {
    routes: cards,
    calendar,
    calendarMissing: missingCalendarYears(ledger, calendar, now),
    ...autoOnly2.length > 0 ? { calendarAuto: [...autoOnly2] } : {},
    ...holidays !== void 0 ? { holidaySync: holidays.sync } : {},
    ...file.fx !== void 0 ? { fx: file.fx } : {},
    sync: syncView ?? {
      source: { label: "models.dev", url: MODELS_DEV_URL },
      refreshDays: 1,
      retryMinutes: Math.round(PRICING_SYNC_RETRY_MS / 6e4),
      state: syncState.lastError !== null ? "failed" : syncState.lastAttemptAt === null ? "missing" : "ok",
      gaps: 0,
      lastSuccessDay: syncState.lastSyncDay,
      lastAdded: syncState.lastAdded,
      lastAttemptAt: syncState.lastAttemptAt,
      lastError: syncState.lastError,
      nextAttemptAt: syncState.nextAttemptAt
    },
    dataDir: dir,
    updatedAt: now
  };
}

// src/route-catalog.ts
var DEEPSEEK_ROUTE = "deepseek-official";
var PI_AI_NS = "llm-pi-ai";
var DEEPSEEK_NS = "llm-deepseek";
function asRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
}
function modelEntries(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    const id = typeof entry === "string" ? entry : asRecord(entry)?.id;
    if (typeof id !== "string" || id === "") continue;
    const name2 = typeof entry === "string" ? void 0 : asRecord(entry)?.name;
    out.push({
      id,
      ...typeof name2 === "string" && name2.trim() !== "" && name2.trim() !== id ? { name: name2.trim() } : {}
    });
  }
  return out;
}
function routesFromSettings(settings) {
  if (settings === void 0) return [];
  const entries = [];
  const piAi = asRecord(settings.get(PI_AI_NS));
  const providers = asRecord(piAi?.providers);
  if (providers !== null) {
    for (const [route, profile] of Object.entries(providers)) {
      if (route === "") continue;
      const raw = asRecord(profile);
      const displayName = typeof raw?.displayName === "string" ? raw.displayName.trim() : "";
      entries.push({ route, label: displayName !== "" ? displayName : "", models: modelEntries(raw?.models) });
    }
  }
  const deepseek = asRecord(settings.get(DEEPSEEK_NS));
  if (deepseek !== null) {
    entries.push({ route: DEEPSEEK_ROUTE, label: "", models: modelEntries(deepseek.models) });
  }
  return entries;
}
function routeLabels(settings, llm, logger = console) {
  const labels = {};
  for (const entry of routesFromSettings(settings)) {
    if (entry.label !== "") labels[entry.route] = entry.label;
  }
  if (llm !== void 0) {
    try {
      for (const provider of llm.listProviders()) {
        if (provider.name !== "" && labels[provider.id] === void 0) labels[provider.id] = provider.name;
      }
    } catch (error) {
      logger.warn?.("[tokbook] cannot list provider routes:", error);
    }
  }
  return labels;
}
async function collectRoutes(settings, llm, logger = console) {
  const byRoute = /* @__PURE__ */ new Map();
  const ensure = (route, label) => {
    let entry = byRoute.get(route);
    if (entry === void 0) {
      entry = { label, models: /* @__PURE__ */ new Map() };
      byRoute.set(route, entry);
    } else if (entry.label === "" && label !== "") {
      entry.label = label;
    }
    return entry;
  };
  const add = (models, model) => {
    const seen = models.get(model.id);
    if (seen === void 0) models.set(model.id, model);
    else if (seen.name === void 0 && model.name !== void 0) seen.name = model.name;
  };
  for (const entry of routesFromSettings(settings)) {
    const acc = ensure(entry.route, entry.label);
    for (const model of entry.models) add(acc.models, model);
  }
  let providers = [];
  if (llm !== void 0) {
    try {
      providers = llm.listProviders();
    } catch (error) {
      logger.warn?.("[tokbook] cannot list provider routes:", error);
    }
  }
  for (const provider of providers) {
    const acc = ensure(provider.id, provider.name);
    if (acc.models.size > 0 || llm === void 0) continue;
    try {
      for (const model of await llm.listModels(provider.id)) {
        if (model.id === "") continue;
        add(acc.models, {
          id: model.id,
          ...typeof model.name === "string" && model.name.trim() !== "" && model.name.trim() !== model.id ? { name: model.name.trim() } : {}
        });
      }
    } catch (error) {
      logger.warn?.(`[tokbook] cannot list models of route ${provider.id}:`, error);
    }
  }
  return [...byRoute.entries()].map(([route, acc]) => ({
    route,
    label: acc.label !== "" ? acc.label : route,
    models: [...acc.models.values()]
  }));
}

// src/route-paths.ts
var ROUTE_OVERVIEW = "/tokbook/overview";
var ROUTE_SYNC = "/tokbook/sync";
var ROUTE_RESCAN = "/tokbook/rescan";
var ROUTE_USAGE = "/tokbook/usage";
var ROUTE_QUOTA = "/tokbook/quota";
var ROUTE_PRICING = "/tokbook/pricing";
var ROUTE_PRICING_SYNC = "/tokbook/pricing-sync";
var ROUTE_PRICING_LOOKUP = "/tokbook/pricing-lookup";
var ROUTE_HOLIDAY_SYNC = "/tokbook/holiday-sync";
var ROUTE_SESSION = "/tokbook/session";
var QUERY_SESSION = "session";
var QUERY_RANGE = "range";
var QUERY_PROVIDER = "provider";
var QUERY_REFRESH = "refresh";
var QUERY_FORCE = "force";
var QUERY_MODEL = "model";
var QUERY_YEAR = "year";

// src/routes.ts
function isSameOriginFetch(req) {
  const site = req.headers["sec-fetch-site"];
  if (site === void 0) return true;
  return site === "same-origin" || site === "none";
}
function refuse(res, status, message) {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  res.end(message);
}
function registerTokBookRoutes(webServer, overview, syncState, rescan) {
  if (webServer === void 0) return () => {
  };
  const handleOverview = async (req, res) => {
    if (req.method !== "GET") return refuse(res, 405, "method not allowed");
    if (!isSameOriginFetch(req)) return refuse(res, 403, "forbidden");
    try {
      const snapshot = await overview();
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(JSON.stringify(snapshot));
    } catch (error) {
      res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  };
  const handleSyncState = async (req, res) => {
    if (req.method !== "GET") return refuse(res, 405, "method not allowed");
    if (!isSameOriginFetch(req)) return refuse(res, 403, "forbidden");
    try {
      const state = await syncState();
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(JSON.stringify(state));
    } catch (error) {
      res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  };
  const handleRescan = async (req, res) => {
    if (req.method !== "POST") return refuse(res, 405, "method not allowed");
    if (!isSameOriginFetch(req)) return refuse(res, 403, "forbidden");
    try {
      const view = await rescan();
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(JSON.stringify(view));
    } catch (error) {
      res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  };
  const disposeOverview = webServer.register({
    kind: "exact",
    path: ROUTE_OVERVIEW,
    handler: handleOverview
  });
  const disposeSyncState = webServer.register({
    kind: "exact",
    path: ROUTE_SYNC,
    handler: handleSyncState
  });
  const disposeRescan = webServer.register({
    kind: "exact",
    path: ROUTE_RESCAN,
    handler: handleRescan
  });
  return () => {
    disposeOverview();
    disposeSyncState();
    disposeRescan();
  };
}
function parseProviderRange(req) {
  const raw = new URL(req.url ?? "/", "http://tokbook.local").searchParams.get(QUERY_RANGE);
  if (raw === null) return null;
  return PROVIDER_RANGES.includes(raw) ? raw : null;
}
function registerTokBookUsageRoute(webServer, usageView) {
  if (webServer === void 0) return () => {
  };
  const handleUsage = async (req, res) => {
    if (req.method !== "GET") return refuse(res, 405, "method not allowed");
    if (!isSameOriginFetch(req)) return refuse(res, 403, "forbidden");
    const range = parseProviderRange(req);
    if (range === null) {
      res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({
        error: 'unknown or missing "range"; expected one of ' + PROVIDER_RANGES.join(", ")
      }));
      return;
    }
    try {
      const snapshot = await usageView(range);
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(JSON.stringify(snapshot));
    } catch (error) {
      res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  };
  return webServer.register({
    kind: "exact",
    path: ROUTE_USAGE,
    handler: handleUsage
  });
}
function registerTokBookSessionRoute(webServer, sessionView) {
  if (webServer === void 0) return () => {
  };
  const handleSession = async (req, res) => {
    if (req.method !== "GET") return refuse(res, 405, "method not allowed");
    if (!isSameOriginFetch(req)) return refuse(res, 403, "forbidden");
    const sessionId = new URL(req.url ?? "/", "http://tokbook.local").searchParams.get(QUERY_SESSION);
    if (sessionId === null || sessionId === "") {
      res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: `missing "${QUERY_SESSION}"` }));
      return;
    }
    try {
      const snapshot = await sessionView(sessionId);
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(JSON.stringify(snapshot));
    } catch (error) {
      res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  };
  return webServer.register({
    kind: "exact",
    path: ROUTE_SESSION,
    handler: handleSession
  });
}
function registerTokBookQuotaRoute(webServer, quotaView, quotaCardOf) {
  if (webServer === void 0) return () => {
  };
  const handleQuota = async (req, res) => {
    if (req.method !== "GET") return refuse(res, 405, "method not allowed");
    if (!isSameOriginFetch(req)) return refuse(res, 403, "forbidden");
    try {
      const params = new URL(req.url ?? "/", "http://tokbook.local").searchParams;
      const provider = params.get(QUERY_PROVIDER);
      if (provider !== null && provider !== "") {
        const force = params.get(QUERY_REFRESH) === "1";
        const card = await quotaCardOf(provider, force);
        res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
        res.end(JSON.stringify(card));
        return;
      }
      const snapshot = await quotaView();
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(JSON.stringify(snapshot));
    } catch (error) {
      res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  };
  return webServer.register({
    kind: "exact",
    path: ROUTE_QUOTA,
    handler: handleQuota
  });
}
function registerTokBookPricingSyncRoute(webServer, syncPricing) {
  if (webServer === void 0) return () => {
  };
  const handle = async (req, res) => {
    if (req.method !== "POST") return refuse(res, 405, "method not allowed");
    if (!isSameOriginFetch(req)) return refuse(res, 403, "forbidden");
    const force = new URL(req.url ?? "/", "http://tokbook.local").searchParams.get(QUERY_FORCE) === "1";
    try {
      const result = await syncPricing(force);
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  };
  return webServer.register({
    kind: "exact",
    path: ROUTE_PRICING_SYNC,
    handler: handle
  });
}
function registerTokBookHolidaySyncRoute(webServer, refreshHolidays) {
  if (webServer === void 0) return () => {
  };
  const handle = async (req, res) => {
    if (req.method !== "POST") return refuse(res, 405, "method not allowed");
    if (!isSameOriginFetch(req)) return refuse(res, 403, "forbidden");
    const query = new URL(req.url ?? "/", "http://tokbook.local").searchParams;
    const force = query.get(QUERY_FORCE) === "1";
    const extraYears = query.getAll(QUERY_YEAR).filter((year) => /^\d{4}$/u.test(year));
    try {
      const result = await refreshHolidays({ force, extraYears });
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  };
  return webServer.register({
    kind: "exact",
    path: ROUTE_HOLIDAY_SYNC,
    handler: handle
  });
}
function registerTokBookPricingLookupRoute(webServer, lookup) {
  if (webServer === void 0) return () => {
  };
  const handle = async (req, res) => {
    if (req.method !== "GET") return refuse(res, 405, "method not allowed");
    if (!isSameOriginFetch(req)) return refuse(res, 403, "forbidden");
    const keyword = new URL(req.url ?? "/", "http://tokbook.local").searchParams.get(QUERY_MODEL);
    if (keyword === null || keyword.trim() === "") {
      res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: `missing "${QUERY_MODEL}"` }));
      return;
    }
    try {
      const result = await lookup(keyword);
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  };
  return webServer.register({
    kind: "exact",
    path: ROUTE_PRICING_LOOKUP,
    handler: handle
  });
}
function readJsonBody(req) {
  return new Promise((resolveBody) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    req.on("data", (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > 256 * 1024) {
        settled = true;
        req.resume();
        resolveBody({ ok: false, tooLarge: true });
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (settled) return;
      settled = true;
      if (chunks.length === 0) {
        resolveBody({ ok: false, tooLarge: false });
        return;
      }
      try {
        resolveBody({ ok: true, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) });
      } catch {
        resolveBody({ ok: false, tooLarge: false });
      }
    });
    req.on("error", () => {
      if (settled) return;
      settled = true;
      resolveBody({ ok: false, tooLarge: false });
    });
  });
}
function registerTokBookPricingRoutes(webServer, pricingView, savePricing) {
  if (webServer === void 0) return () => {
  };
  const handle = async (req, res) => {
    if (!isSameOriginFetch(req)) return refuse(res, 403, "forbidden");
    if (req.method === "GET") {
      try {
        const snapshot = await pricingView();
        res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
        res.end(JSON.stringify(snapshot));
      } catch (error) {
        res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
      }
      return;
    }
    if (req.method === "PUT") {
      const read = await readJsonBody(req);
      if (!read.ok && read.tooLarge) {
        res.writeHead(413, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "body \u8D85\u8FC7 256 KiB" }));
        return;
      }
      const body = read.ok ? read.body : null;
      try {
        const result = await savePricing(body);
        if (!result.ok) {
          const verdict2 = { ok: false, error: result.error };
          res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify(verdict2));
          return;
        }
        const verdict = { ok: true };
        res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
        res.end(JSON.stringify(verdict));
      } catch (error) {
        res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
      }
      return;
    }
    return refuse(res, 405, "method not allowed");
  };
  return webServer.register({
    kind: "exact",
    path: ROUTE_PRICING,
    handler: handle
  });
}

// src/session-timing.ts
function countOf(value) {
  return typeof value === "number" && Number.isInteger(value) ? value : void 0;
}
function stepKeyOf(event) {
  const turn = countOf(event.data?.turn);
  const step = countOf(event.data?.step);
  if (turn === void 0 || step === void 0) return void 0;
  return `${String(turn)}:${String(step)}`;
}
function isTokenDelta(chunk) {
  if (typeof chunk !== "object" || chunk === null) return false;
  const value = chunk;
  switch (value.type) {
    case "text-delta":
    case "reasoning-delta":
      return value.text !== "";
    case "tool-call-delta":
      return value.argumentsDelta !== "" || value.name !== void 0;
    default:
      return false;
  }
}
function runFirstToken(run) {
  const time0 = countOf(run.time0);
  if (time0 === void 0) return void 0;
  if (run.type === "tool-call-chunks" && run.name !== void 0) return time0;
  const fragments = run.type === "tool-call-chunks" ? run.args : run.texts;
  const dt = run.dt;
  if (!Array.isArray(fragments) || !Array.isArray(dt)) return void 0;
  let time = time0;
  for (let index = 0; index < fragments.length; index += 1) {
    if (index > 0) {
      const delta = countOf(dt[index - 1]);
      if (delta === void 0) return void 0;
      time += delta;
    }
    if (fragments[index] !== "") return time;
  }
  return void 0;
}
function streamFirstToken(stream) {
  if (!Array.isArray(stream)) return void 0;
  for (const record of stream) {
    if (typeof record !== "object" || record === null) continue;
    const item = record;
    const time = item.type === "chunk" ? isTokenDelta(item.chunk) ? countOf(item.time) : void 0 : runFirstToken(record);
    if (time !== void 0) return time;
  }
  return void 0;
}
function outputTokensOf(usage) {
  if (typeof usage !== "object" || usage === null) return void 0;
  const value = usage.outputTokens;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : void 0;
}
function anchorsOf(event, into) {
  const key = stepKeyOf(event);
  if (key === void 0) return;
  const data = event.data;
  switch (event.type) {
    case "step/start": {
      into.set(key, { start: event.time, spans: [] });
      return;
    }
    case "step/end": {
      const anchors = into.get(key);
      if (anchors !== void 0 && anchors.end === void 0) anchors.end = event.time;
      return;
    }
    case "assistant/attempt": {
      const anchors = into.get(key);
      const first = streamFirstToken(data?.stream);
      if (anchors !== void 0 && anchors.firstToken === void 0 && first !== void 0) anchors.firstToken = first;
      return;
    }
    case "assistant/message": {
      const anchors = into.get(key);
      if (anchors === void 0) return;
      anchors.message = event.time;
      anchors.outputTokens = outputTokensOf(data?.usage);
      if (anchors.firstToken === void 0) anchors.firstToken = streamFirstToken(data?.stream);
      return;
    }
    default:
      return;
  }
}
var EMPTY_TIMING = { steps: /* @__PURE__ */ new Map(), compactions: /* @__PURE__ */ new Map() };
function timingIndexOf(sessionId, events) {
  const anchors = /* @__PURE__ */ new Map();
  const calls = /* @__PURE__ */ new Map();
  const compactions = /* @__PURE__ */ new Map();
  const compStarted = /* @__PURE__ */ new Map();
  for (const event of events) {
    if (event.type === "tool/call" || event.type === "tool/result") {
      const callId = event.type === "tool/call" ? event.data?.callId : event.data?.message?.source.callId;
      if (typeof callId !== "string" || callId === "") continue;
      if (event.type === "tool/call") {
        calls.set(callId, { time: event.time, name: event.data?.name ?? "", key: stepKeyOf(event) });
        continue;
      }
      const call = calls.get(callId);
      if (call === void 0) continue;
      calls.delete(callId);
      const step = call.key === void 0 ? void 0 : anchors.get(call.key);
      if (step !== void 0 && event.time >= call.time) {
        step.spans.push({ start: call.time, end: event.time, name: call.name });
      }
      continue;
    }
    if (event.type === "compaction/start") {
      const id = event.data?.compactionId;
      if (typeof id === "string" && id !== "") compStarted.set(id, event.time);
      continue;
    }
    if (event.type === "compaction/summary") {
      const id = event.data?.compactionId;
      const start = typeof id === "string" ? compStarted.get(id) : void 0;
      if (start === void 0) continue;
      compactions.set(recordFromCompaction(event, sessionId).requestId, Math.max(0, event.time - start));
      continue;
    }
    anchorsOf(event, anchors);
  }
  const steps = /* @__PURE__ */ new Map();
  for (const [key, stepAnchors] of anchors) {
    const timing = finishStep(stepAnchors);
    if (timing !== void 0) steps.set(key, timing);
  }
  return steps.size === 0 && compactions.size === 0 ? EMPTY_TIMING : { steps, compactions };
}
function finishStep(anchors) {
  const { start, end, message, firstToken } = anchors;
  const spans = end === void 0 ? anchors.spans : anchors.spans.filter((span) => span.end <= end);
  const timing = {};
  if (end !== void 0) timing.wallMs = Math.max(0, end - start);
  if (message !== void 0) timing.llmMs = Math.max(0, message - start);
  if (firstToken !== void 0) {
    timing.ttftMs = Math.max(0, firstToken - start);
    if (message !== void 0 && anchors.outputTokens !== void 0) {
      timing.decodeMs = Math.max(0, message - firstToken);
    }
  }
  if (spans.length > 0) {
    let low = spans[0].start;
    let high = spans[0].end;
    let slow = spans[0];
    for (const span of spans) {
      if (span.start < low) low = span.start;
      if (span.end > high) high = span.end;
      if (span.end - span.start > slow.end - slow.start) slow = span;
    }
    timing.toolMs = high - low;
    timing.toolCalls = spans.length;
    timing.slowTool = { name: slow.name, ms: slow.end - slow.start };
  }
  return Object.keys(timing).length === 0 ? void 0 : timing;
}

// src/session-usage.ts
function stepOf(event) {
  return countOf(event.data?.step);
}
function messageIdOf(event) {
  const id = event.data?.message?.id;
  return typeof id === "string" && id !== "" ? id : void 0;
}
function decodeTurnFailure(sessionId, requestId) {
  const prefix = `failure:${sessionId}:turn:`;
  if (!requestId.startsWith(prefix)) return void 0;
  const raw = requestId.slice(prefix.length);
  return /^\d+$/.test(raw) ? Number(raw) : void 0;
}
function turnIndexOf(sessionId, events) {
  const index = /* @__PURE__ */ new Map();
  for (const event of events) {
    if (event.type === "assistant/message") {
      const id = messageIdOf(event);
      const turn = countOf(event.data?.turn);
      if (id === void 0 || turn === void 0) continue;
      const step = stepOf(event);
      index.set(id, step === void 0 ? { turn } : { turn, step });
      continue;
    }
    if (event.type === "llm/retry") {
      const turn = countOf(event.data?.turn);
      if (turn === void 0) continue;
      const step = stepOf(event);
      index.set(recordFromRetry(event, sessionId, "").requestId, step === void 0 ? { turn } : { turn, step });
    }
  }
  return index;
}
function locate(record, index, sessionId) {
  if (record.kind === "failure") {
    const turn = decodeTurnFailure(sessionId, record.requestId);
    if (turn !== void 0) return { turn };
  }
  return index?.get(record.requestId);
}
function totalsOfUsage(usage) {
  return {
    requests: 0,
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    cacheReadTokens: usage?.cacheReadTokens ?? 0,
    cacheWriteTokens: usage?.cacheWriteTokens ?? 0
  };
}
function tokensOf(usage) {
  if (usage === void 0) return 0;
  return usage.inputTokens + usage.outputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0);
}
function priceOfRecord(record, pricing, billing, resolve, unpriced) {
  const prices = priceOfKey(pricing, record.provider, record.model, resolve(record));
  if (prices === null) {
    if (record.model !== "") unpriced.add(`${record.provider ?? ""}|${record.model}`);
    return { bucket: "unpriced", cost: 0 };
  }
  return {
    bucket: billingOf(billing, record.provider) === "subscription" ? "subscription" : "spend",
    cost: costOf(totalsOfUsage(record.usage), prices)
  };
}
function stepRowOf(record, input, unpriced, at, timing, owners) {
  const priced = priceOfRecord(record, input.pricing, input.billing, input.resolve, unpriced);
  const own = timingOfRow(record, at, timing, owners);
  return {
    requestId: record.requestId,
    time: record.time,
    model: record.model,
    provider: record.provider ?? "",
    ...record.kind !== void 0 ? { kind: record.kind } : {},
    ...record.failureCode !== void 0 ? { failureCode: record.failureCode } : {},
    ...record.usage !== void 0 ? { usage: record.usage } : {},
    tokens: tokensOf(record.usage),
    ...at?.step !== void 0 ? { step: at.step } : {},
    ...own !== void 0 ? { timing: own } : {},
    bucket: priced.bucket,
    cost: priced.cost
  };
}
function sortEntries(entries) {
  return [...entries].sort((left, right) => left.record.time - right.record.time || (left.record.requestId < right.record.requestId ? -1 : left.record.requestId > right.record.requestId ? 1 : 0));
}
function groupOf(turn, entries, resolve) {
  const ordered = sortEntries(entries);
  const totals = summarizeRecords(ordered.map((entry) => entry.record), resolve).total;
  let spend = 0;
  let subscriptionValue = 0;
  for (const entry of ordered) {
    if (entry.row.bucket === "spend") spend += entry.row.cost;
    else if (entry.row.bucket === "subscription") subscriptionValue += entry.row.cost;
  }
  return {
    turn,
    totals,
    tokens: totalsTokens(totals),
    spend,
    subscriptionValue,
    rows: ordered.map((entry) => entry.row)
  };
}
var NO_JOIN = { turn: null, timing: null, span: null, labels: /* @__PURE__ */ new Map() };
var joinCache = /* @__PURE__ */ new Map();
var JOIN_CACHE_MAX = 8;
async function revisionOf2(persistence, sessionId) {
  if (typeof persistence.stat !== "function") return null;
  try {
    const snapshot = await persistence.stat(sessionId);
    const revision = snapshot?.revision;
    return typeof revision === "string" && revision !== "" ? revision : null;
  } catch {
    return null;
  }
}
function joinOfEvents(sessionId, events) {
  let first = Number.POSITIVE_INFINITY;
  let last = Number.NEGATIVE_INFINITY;
  const labels = /* @__PURE__ */ new Map();
  for (const event of events) {
    if (Number.isFinite(event.time)) {
      if (event.time < first) first = event.time;
      if (event.time > last) last = event.time;
    }
    if (event.type === "subagent/catalog") {
      const childId = event.data?.childId;
      const label = event.data?.label;
      if (typeof childId === "string" && childId !== "" && typeof label === "string" && label !== "") {
        labels.set(childId, label);
      }
    }
  }
  return {
    turn: turnIndexOf(sessionId, events),
    timing: timingIndexOf(sessionId, events),
    span: Number.isFinite(first) && last >= first ? { first, last } : null,
    labels
  };
}
async function sessionJoin(persistence, sessionId, logger = console) {
  const revision = persistence === void 0 ? null : await revisionOf2(persistence, sessionId);
  const cacheKey = `${sessionId}\0${revision ?? ""}`;
  if (revision !== null) {
    const cached = joinCache.get(cacheKey);
    if (cached !== void 0) {
      joinCache.delete(cacheKey);
      joinCache.set(cacheKey, cached);
      return cached;
    }
  }
  const events = await readSessionJoinEvents(persistence, sessionId, logger);
  if (events === null) return NO_JOIN;
  const join9 = joinOfEvents(sessionId, events);
  if (revision !== null) {
    joinCache.set(cacheKey, join9);
    for (const key of joinCache.keys()) {
      if (joinCache.size <= JOIN_CACHE_MAX) break;
      joinCache.delete(key);
    }
  }
  return join9;
}
async function readSessionJoinEvents(persistence, sessionId, logger = console) {
  if (persistence === void 0) return null;
  try {
    if (typeof persistence.open === "function") {
      const handle = await persistence.open(sessionId, "read");
      try {
        const inherited = handle.inheritedEventCount;
        const cut = typeof inherited === "number" && inherited > 0 ? inherited : 0;
        return (await handle.read(cut)).events;
      } finally {
        await handle.close?.();
      }
    }
    if (typeof persistence.inspect === "function") return (await persistence.inspect(sessionId)).events;
    return null;
  } catch (error) {
    logger.error(`[tokbook] cannot read the session log for the turn join (${sessionId}):`, error);
    return null;
  }
}
function subagentBranches(sessions, rootId) {
  const children = /* @__PURE__ */ new Map();
  for (const snapshot of sessions) {
    const { id, parentSession, origin } = snapshot.header;
    if (origin !== "subagent") continue;
    if (typeof parentSession !== "string" || parentSession === "") continue;
    const siblings = children.get(parentSession);
    if (siblings === void 0) children.set(parentSession, [id]);
    else siblings.push(id);
  }
  const branches = [];
  for (const child of children.get(rootId) ?? []) {
    const tree = [];
    const seen = /* @__PURE__ */ new Set();
    const stack = [child];
    while (stack.length > 0) {
      const id = stack.pop();
      if (seen.has(id)) continue;
      seen.add(id);
      tree.push(id);
      for (const grandchild of children.get(id) ?? []) stack.push(grandchild);
    }
    branches.push({ id: child, tree });
  }
  return branches;
}
function subagentsOf(input, labels) {
  const sessions = input.sessions;
  if (sessions === void 0 || sessions.length === 0) return void 0;
  const branches = subagentBranches(sessions, input.sessionId);
  if (branches.length === 0) return void 0;
  const owner = /* @__PURE__ */ new Map();
  for (const branch of branches) {
    for (const id of branch.tree) owner.set(id, branch.id);
  }
  const recordsByBranch = /* @__PURE__ */ new Map();
  for (const record of input.records) {
    const branchId = owner.get(record.sessionId);
    if (branchId === void 0) continue;
    const list = recordsByBranch.get(branchId);
    if (list === void 0) recordsByBranch.set(branchId, [record]);
    else list.push(record);
  }
  const unpriced = /* @__PURE__ */ new Set();
  const rows = [];
  let totalTokens = 0;
  let spend = 0;
  let subscriptionValue = 0;
  let usageUnknown = 0;
  let failures = 0;
  for (const branch of branches) {
    const records = recordsByBranch.get(branch.id) ?? [];
    const totals = summarizeRecords(records, input.resolve).total;
    let branchSpend = 0;
    let branchSubscription = 0;
    let priced = false;
    for (const record of records) {
      const price = priceOfRecord(record, input.pricing, input.billing, input.resolve, unpriced);
      if (price.bucket === "spend") {
        branchSpend += price.cost;
        priced = true;
      } else if (price.bucket === "subscription") {
        branchSubscription += price.cost;
        priced = true;
      }
    }
    const tokens = totalsTokens(totals);
    const unknown = totals.usageUnknown ?? 0;
    const failed = totals.failures ?? 0;
    rows.push({
      sessionId: branch.id,
      label: labels.get(branch.id) ?? "",
      tokens,
      requests: totals.requests,
      failures: failed,
      usageUnknown: unknown,
      spend: branchSpend,
      subscriptionValue: branchSubscription,
      priced,
      descendants: branch.tree.length - 1
    });
    totalTokens += tokens;
    spend += branchSpend;
    subscriptionValue += branchSubscription;
    usageUnknown += unknown;
    failures += failed;
  }
  rows.sort((left, right) => right.tokens - left.tokens || (left.label !== right.label ? left.label < right.label ? -1 : 1 : left.sessionId < right.sessionId ? -1 : left.sessionId > right.sessionId ? 1 : 0));
  return {
    count: rows.length,
    totalTokens,
    spend,
    subscriptionValue,
    usageUnknown,
    failures,
    unpriced: [...unpriced].sort(),
    rows
  };
}
function buildSessionUsageView(input) {
  const { turn: index, timing, span } = input.join;
  const owners = index === null ? /* @__PURE__ */ new Map() : timingOwners(input.records, index, input.sessionId);
  const all = [];
  const turns = /* @__PURE__ */ new Map();
  const between = [];
  const unattributed = [];
  const unpriced = /* @__PURE__ */ new Set();
  const place = (record, at, bucket) => {
    const entry = { record, row: stepRowOf(record, input, unpriced, at, timing, owners) };
    all.push(entry);
    bucket.push(entry);
  };
  for (const record of input.records) {
    if (record.sessionId !== input.sessionId) continue;
    if (record.kind === "compaction") {
      place(record, void 0, between);
      continue;
    }
    const at = locate(record, index, input.sessionId);
    if (at === void 0) {
      place(record, void 0, unattributed);
      continue;
    }
    let entries = turns.get(at.turn);
    if (entries === void 0) {
      entries = [];
      turns.set(at.turn, entries);
    }
    place(record, at, entries);
  }
  const total = summarizeRecords(all.map((entry) => entry.record), input.resolve).total;
  let firstAt = Number.POSITIVE_INFINITY;
  let lastAt = 0;
  let spend = 0;
  let subscriptionValue = 0;
  for (const entry of all) {
    const time = entry.record.time;
    if (time < firstAt) firstAt = time;
    if (time > lastAt) lastAt = time;
    if (entry.row.bucket === "spend") spend += entry.row.cost;
    else if (entry.row.bucket === "subscription") subscriptionValue += entry.row.cost;
  }
  const groups = [...turns.entries()].sort((left, right) => left[0] - right[0]).map(([turn, entries]) => groupOf(turn, entries, input.resolve));
  const tail = between.length === 0 ? null : groupOf(null, between, input.resolve);
  const subagents = subagentsOf(input, input.join.labels);
  return {
    sessionId: input.sessionId,
    updatedAt: input.updatedAt,
    firstAt: Number.isFinite(firstAt) ? firstAt : 0,
    lastAt,
    total,
    totalTokens: totalsTokens(total),
    spend,
    subscriptionValue,
    unpriced: [...unpriced].sort(),
    turns: groups,
    betweenTurns: tail,
    unattributed: sortEntries(unattributed).map((entry) => entry.row),
    todaySpend: input.todaySpend,
    ...spanOf(span, all.map((entry) => entry.row)),
    ...subagents === void 0 ? {} : { subagents }
  };
}
function timingOwners(records, index, sessionId) {
  const best = /* @__PURE__ */ new Map();
  for (const record of records) {
    if (record.sessionId !== sessionId || record.kind === "compaction") continue;
    const at = locate(record, index, sessionId);
    if (at?.step === void 0) continue;
    const rank = record.usage !== void 0 ? 0 : record.kind === "failure" ? 2 : 1;
    const key = `${String(at.turn)}:${String(at.step)}`;
    const seen = best.get(key);
    if (seen === void 0 || rank < seen.rank || rank === seen.rank && record.time < seen.time) {
      best.set(key, { requestId: record.requestId, rank, time: record.time });
    }
  }
  return new Map([...best].map(([key, value]) => [key, value.requestId]));
}
function timingOfRow(record, at, timing, owners) {
  if (timing === null) return void 0;
  if (record.kind === "compaction") {
    const llmMs = timing.compactions.get(record.requestId);
    return llmMs === void 0 ? void 0 : { llmMs };
  }
  if (at?.step === void 0) return void 0;
  const key = `${String(at.turn)}:${String(at.step)}`;
  if (owners.get(key) !== record.requestId) return void 0;
  return timing.steps.get(key);
}
function spanOf(span, rows) {
  if (span === null) return {};
  const { llmMs, toolMs } = settleTiming(rows);
  const timed = rows.some((row) => row.timing !== void 0);
  const elapsed = span.last >= span.first ? { spanMs: span.last - span.first } : {};
  return timed ? { ...elapsed, workMs: llmMs + toolMs } : elapsed;
}

// src/quota.ts
var OPENCODE_GO_PROVIDER = "opencode-go";
var COMMAND_CODE_PROVIDER = "commandcode";
var BUILTIN_PLAN_TITLES = {
  [OPENCODE_GO_PROVIDER]: "OpenCode Go",
  [COMMAND_CODE_PROVIDER]: "Command Code"
};
var COMMAND_CODE_PLAN_NAMES = {
  "individual-go": "Go",
  "individual-goat": "GOAT",
  "individual-pro": "Pro",
  "individual-pro-v1": "Pro",
  "individual-provider": "Provider",
  "individual-max": "Max",
  "individual-ultra": "Ultra",
  "teams-pro": "Teams Pro"
};
var BUILTIN_KEY_ENV = {
  [OPENCODE_GO_PROVIDER]: "OPENCODE_GO_API_KEY",
  [COMMAND_CODE_PROVIDER]: "COMMANDCODE_API_KEY"
};
var QUOTA_ALERT_PERCENT = 90;
function isQuotaAlert(card) {
  if (card === null || card === void 0 || card.state !== "ok") return false;
  if (card.gate !== void 0 && card.gate !== "subscription") return false;
  return card.windows.some((window) => window.exceeded || window.usagePercent >= QUOTA_ALERT_PERCENT);
}
function isBuiltinQuotaPlan(provider) {
  return provider === OPENCODE_GO_PROVIDER || provider === COMMAND_CODE_PROVIDER;
}
var QUOTA_IN_FORCE_STATUSES = ["active", "trialing"];
function quotaGate(planInfo, now = Date.now()) {
  if (planInfo === void 0) return "balance";
  const status = planInfo.status?.trim().toLowerCase() ?? "";
  if (QUOTA_IN_FORCE_STATUSES.includes(status)) return "subscription";
  const periodEnd = planInfo.periodEnd;
  if (periodEnd !== void 0 && periodEnd !== null && periodEnd > now) return "subscription";
  return "balance";
}
function dayText(epochMs) {
  const date = new Date(epochMs);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${String(date.getFullYear())}-${month}-${day}`;
}
function balanceGateNote(planInfo, now = Date.now()) {
  const periodEnd = planInfo?.periodEnd;
  if (periodEnd !== void 0 && periodEnd !== null && periodEnd > 0 && periodEnd <= now) {
    return `\u8BA2\u9605\u5DF2\u4E8E ${dayText(periodEnd)} \u7ED3\u675F\uFF0C\u73B0\u4EC5\u7531\u4F59\u989D\u51B3\u5B9A\u53EF\u7528\u91CF\u2014\u20145 \u5C0F\u65F6 / \u672C\u5468\u7A97\u53E3\u53EA\u7EA6\u675F\u8BA2\u9605\u5185\u7684\u6708\u5EA6\u989D\u5EA6\uFF0C\u8BE5\u8D26\u6237\u4E0D\u518D\u9002\u7528\u3002`;
  }
  const status = planInfo?.status?.trim();
  if (status !== void 0 && status !== "") {
    return `\u5B98\u65B9\u62A5\u544A\u7684\u8BA2\u9605\u72B6\u6001\u4E3A ${status}\uFF0C\u5F53\u524D\u6CA1\u6709\u751F\u6548\u4E2D\u7684\u6708\u5EA6\u989D\u5EA6\u2014\u2014\u8BE5\u8D26\u6237\u7531\u4F59\u989D\u51B3\u5B9A\u53EF\u7528\u91CF\u3002`;
  }
  return "\u672A\u68C0\u6D4B\u5230\u751F\u6548\u4E2D\u7684\u8BA2\u9605\u2014\u2014\u8BE5\u8D26\u6237\u7531\u4F59\u989D\u51B3\u5B9A\u53EF\u7528\u91CF\uFF085 \u5C0F\u65F6 / \u672C\u5468\u7A97\u53E3\u4EC5\u7EA6\u675F\u8BA2\u9605\u5185\u7684\u6708\u5EA6\u989D\u5EA6\uFF09\u3002";
}
function clampPercent(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}
var RESET_COUNTDOWN_MAX_SEC = 31536e3;
function resetEpoch(value, now = Date.now()) {
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value > 0 && value <= RESET_COUNTDOWN_MAX_SEC && Math.abs(value - now) > 4294967296) {
    return now + value * 1e3;
  }
  return value;
}
function windowFromCreditsBlock(id, label, raw, now) {
  const used = typeof raw?.used === "number" && Number.isFinite(raw.used) ? raw.used : void 0;
  const cap = typeof raw?.cap === "number" && Number.isFinite(raw.cap) ? raw.cap : void 0;
  const resetAt = resetEpoch(raw?.resetAt, now);
  const usagePercent = cap !== void 0 && cap > 0 && used !== void 0 ? Math.min(100, Math.max(0, used / cap * 100)) : clampPercent(raw?.exceeded === true ? 100 : void 0);
  return {
    id,
    label,
    usagePercent,
    exceeded: raw?.exceeded === true || usagePercent >= 100,
    resetAt,
    ...used !== void 0 ? { usedUsd: used } : {},
    ...cap !== void 0 ? { capUsd: cap } : {}
  };
}
function windowFromUsagePercent(id, label, raw, now) {
  const percent = clampPercent(raw?.percent ?? raw?.usagePercent);
  const throttled = typeof raw?.status === "string" && raw.status !== "" && raw.status !== "ok";
  const limited = throttled || raw?.status === "rate-limited";
  return {
    id,
    label,
    usagePercent: limited ? 100 : percent,
    exceeded: limited || percent >= 100,
    resetAt: resetEpoch(raw?.resetsAt ?? raw?.resetInSec, now)
  };
}
function planInfoFromSubscriptions(raw) {
  if (raw === void 0) return void 0;
  const planId = typeof raw.planId === "string" && raw.planId !== "" ? raw.planId : void 0;
  const status = typeof raw.status === "string" && raw.status !== "" ? raw.status : void 0;
  const periodEnd = resetEpoch(raw.currentPeriodEnd);
  if (planId === void 0 && status === void 0 && periodEnd === null) return void 0;
  const info = {};
  if (planId !== void 0) info.planId = planId;
  if (status !== void 0) info.status = status;
  if (periodEnd !== null) info.periodEnd = periodEnd;
  return info;
}
function hasQuotaContent(card) {
  return card.windows.length > 0 || card.planInfo !== void 0 || card.usage !== void 0 || card.credits !== void 0;
}
function unconfiguredCard(provider, hint) {
  return {
    plan: provider,
    title: BUILTIN_PLAN_TITLES[provider] ?? provider,
    state: "unconfigured",
    message: hint ?? "\u672A\u627E\u5230\u8BE5\u8BA2\u9605\u7684 API key\uFF08\u53EF\u914D\u7F6E apiKey / apiKeyEnv\uFF0C\u6216\u5728\u672C\u673A Models \u9875\u586B\u597D\u8BE5\u901A\u9053\u7684 key\uFF09\u3002",
    windows: []
  };
}
function errorCard(provider, reason) {
  return {
    plan: provider,
    title: BUILTIN_PLAN_TITLES[provider] ?? provider,
    state: "error",
    message: reason,
    windows: []
  };
}
function noSubscriptionCard(provider, note, now = Date.now()) {
  return {
    plan: provider,
    title: BUILTIN_PLAN_TITLES[provider] ?? provider,
    state: "ok",
    gate: "none",
    gateNote: note,
    windows: [],
    fetchedAt: now
  };
}

// src/quota-official.ts
var REQUEST_TIMEOUT_MS = 1e4;
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function str(value) {
  return typeof value === "string" ? value : void 0;
}
function num(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
async function resolvePlanApiKey(provider, plan, credentials) {
  const literal = plan?.apiKey;
  if (literal !== void 0 && literal !== "") return literal;
  if (credentials === void 0) return void 0;
  const envName = plan?.apiKeyEnv !== void 0 && plan.apiKeyEnv !== "" ? plan.apiKeyEnv : BUILTIN_KEY_ENV[provider];
  if (envName === void 0) return void 0;
  try {
    const value = await credentials.resolve(envName);
    if (value !== void 0 && value !== "") return value;
  } catch {
  }
  return void 0;
}
var COMMAND_CODE_API_BASE = "https://api.commandcode.ai";
var COMMAND_CODE_CLI_VERSION = "1.47.0";
function ccPath(path, params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== void 0 && value !== "") search.set(key, value);
  }
  const query = search.toString();
  return query === "" ? path : `${path}?${query}`;
}
function rawTimestamp(value) {
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return void 0;
}
async function ccGet(path, key, logger) {
  try {
    const response = await fetch(`${COMMAND_CODE_API_BASE}${path}`, {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${key}`,
        "x-command-code-version": COMMAND_CODE_CLI_VERSION,
        "x-cli-environment": "production"
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
    if (!response.ok) {
      logger?.warn?.(`[tokbook] commandcode ${path}: HTTP ${response.status}`);
      return { __httpStatus: response.status };
    }
    const parsed = await response.json();
    return isRecord2(parsed) ? parsed : { __httpStatus: 0 };
  } catch (error) {
    logger?.warn?.(`[tokbook] commandcode ${path}:`, error);
    return { __httpStatus: 0 };
  }
}
function isAuthFailure(body) {
  if ("__httpStatus" in body) return body.__httpStatus === 401;
  return body.error === "invalid-key" || body.message === "Unauthorized";
}
function commandCodePlanName(planId) {
  const normalized = planId.toLowerCase().replace(/_/g, "-");
  return COMMAND_CODE_PLAN_NAMES[normalized];
}
function attachPlanInfo(card, raw, fallbackPlanId) {
  const planInfo = planInfoFromSubscriptions(raw ?? {}) ?? (fallbackPlanId !== void 0 ? planInfoFromSubscriptions({ planId: fallbackPlanId }) : void 0);
  if (planInfo === void 0) return;
  card.planInfo = planInfo;
  const planId = planInfo.planId;
  const display = planId !== void 0 ? commandCodePlanName(planId) : void 0;
  if (planInfo.name !== void 0 && planInfo.name !== "") card.title = planInfo.name;
  else if (display !== void 0) card.title = display;
}
async function fetchCommandCodeQuota(deps = {}) {
  const key = await resolvePlanApiKey(COMMAND_CODE_PROVIDER, deps.plan, deps.credentials);
  if (key === void 0) return unconfiguredCard(COMMAND_CODE_PROVIDER);
  const logger = deps.logger;
  const whoami = await ccGet("/alpha/whoami", key, logger);
  const whoamiBody = isRecord2(whoami) && !("__httpStatus" in whoami) ? whoami : void 0;
  const orgId = whoamiBody !== void 0 && isRecord2(whoamiBody.org) ? str(whoamiBody.org.id) : void 0;
  const [credits, subscription] = await Promise.all([
    ccGet(ccPath("/alpha/billing/credits", { orgId }), key, logger),
    ccGet(ccPath("/alpha/billing/subscriptions", { orgId }), key, logger)
  ]);
  const subscriptionBody = isRecord2(subscription) && !("__httpStatus" in subscription) ? subscription : void 0;
  const subscriptionNode = subscriptionBody !== void 0 && isRecord2(subscriptionBody.data) ? subscriptionBody.data : subscriptionBody;
  const usage = await ccGet(
    ccPath("/alpha/usage/summary", { orgId, since: rawTimestamp(subscriptionNode?.currentPeriodStart) }),
    key,
    logger
  );
  const bodies = [whoami, usage, credits, subscription];
  if (bodies.every(isAuthFailure)) {
    return errorCard(COMMAND_CODE_PROVIDER, "\u5B98\u65B9\u63A5\u53E3\u62D2\u7EDD\u4E86\u8BE5 key\uFF08401\uFF09\u2014\u2014\u8BF7\u68C0\u67E5 Command Code API key\u3002");
  }
  const card = {
    plan: COMMAND_CODE_PROVIDER,
    title: BUILTIN_PLAN_TITLES[COMMAND_CODE_PROVIDER],
    state: "ok",
    windows: [],
    fetchedAt: Date.now()
  };
  if (isRecord2(whoami) && !("__httpStatus" in whoami)) {
    const user = isRecord2(whoami.user) ? whoami.user : void 0;
    const name2 = str(user?.userName) ?? str(user?.name);
    if (name2 !== void 0 && name2 !== "") card.account = { name: name2 };
  }
  if (isRecord2(usage) && !("__httpStatus" in usage)) {
    const summary = {};
    const completed = num(usage.completedCount);
    const failed = num(usage.failedCount);
    if (completed !== void 0) summary.completed = completed;
    if (failed !== void 0) summary.failed = failed;
    const rate = num(usage.successRate);
    if (rate !== void 0) summary.successRate = rate;
    const cost = num(usage.totalCost);
    if (cost !== void 0) summary.costUsd = cost;
    const tin = num(usage.totalTokensIn);
    const tout = num(usage.totalTokensOut);
    if (tin !== void 0) summary.tokensIn = tin;
    if (tout !== void 0) summary.tokensOut = tout;
    if (Object.keys(summary).length > 0) card.usage = summary;
  }
  let creditsPlanId;
  if (isRecord2(credits) && !("__httpStatus" in credits)) {
    const creditsNode = isRecord2(credits.credits) ? credits.credits : void 0;
    creditsPlanId = creditsNode !== void 0 ? str(creditsNode.planId) : void 0;
    const limits = isRecord2(credits.windowLimits) ? credits.windowLimits : void 0;
    if (creditsNode !== void 0) {
      const pool = {};
      const monthly = num(creditsNode.monthlyCredits);
      const purchased = num(creditsNode.purchasedCredits);
      const free = num(creditsNode.freeCredits);
      if (monthly !== void 0) pool.monthlyUsd = monthly;
      if (purchased !== void 0) pool.purchasedUsd = purchased;
      if (free !== void 0) pool.freeUsd = free;
      if (Object.keys(pool).length > 0) card.credits = pool;
    }
    const fiveHour = isRecord2(limits?.fiveHour) ? limits.fiveHour : void 0;
    const weekly = isRecord2(limits?.weekly) ? limits.weekly : void 0;
    if (fiveHour !== void 0) {
      card.windows.push(windowFromCreditsBlock("fiveHour", "5 \u5C0F\u65F6", fiveHour));
    }
    if (weekly !== void 0) {
      card.windows.push(windowFromCreditsBlock("weekly", "\u672C\u5468", weekly));
    }
  }
  if (subscriptionNode !== void 0) {
    attachPlanInfo(card, subscriptionNode, creditsPlanId);
  } else if (creditsPlanId !== void 0) {
    attachPlanInfo(card, void 0, creditsPlanId);
  }
  if (subscriptionBody !== void 0) {
    card.gate = quotaGate(card.planInfo);
    if (card.gate === "balance") {
      card.gateNote = balanceGateNote(card.planInfo);
      if (card.credits === void 0) {
        card.gate = "none";
        card.gateNote = `${card.gateNote}\uFF08\u672C\u6B21\u672A\u53D6\u5230\u4F59\u989D\uFF0C\u6682\u65E0\u6CD5\u663E\u793A\u53EF\u7528\u91CF\uFF09`;
      }
    }
  }
  if (!hasQuotaContent(card)) {
    return errorCard(COMMAND_CODE_PROVIDER, "\u5B98\u65B9\u63A5\u53E3\u672A\u8FD4\u56DE\u53EF\u7528\u6570\u636E\u3002");
  }
  return card;
}
var OPENCODE_GO_USAGE_URL = "https://opencode.ai/zen/go/v1/usage";
function parseOpenCodeGoUsage(body, now = Date.now()) {
  const usage = isRecord2(body.usage) ? body.usage : body;
  const rolling = isRecord2(usage.rolling) ? usage.rolling : void 0;
  const weekly = isRecord2(usage.weekly) ? usage.weekly : void 0;
  const monthly = isRecord2(usage.monthly) ? usage.monthly : void 0;
  const card = {
    plan: OPENCODE_GO_PROVIDER,
    title: BUILTIN_PLAN_TITLES[OPENCODE_GO_PROVIDER],
    state: "ok",
    gate: "subscription",
    windows: [],
    fetchedAt: Date.now()
  };
  if (rolling !== void 0) card.windows.push(windowFromUsagePercent("rolling5h", "5 \u5C0F\u65F6", rolling, now));
  if (weekly !== void 0) card.windows.push(windowFromUsagePercent("weekly", "\u672C\u5468", weekly, now));
  if (monthly !== void 0) card.windows.push(windowFromUsagePercent("monthly", "\u672C\u6708", monthly, now));
  return card;
}
async function fetchOpenCodeGoQuota(deps = {}) {
  const key = await resolvePlanApiKey(OPENCODE_GO_PROVIDER, deps.plan, deps.credentials);
  if (key === void 0) return unconfiguredCard(OPENCODE_GO_PROVIDER);
  const logger = deps.logger;
  let body;
  try {
    const response = await fetch(OPENCODE_GO_USAGE_URL, {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${key}`,
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
    if (response.status === 401) {
      return errorCard(OPENCODE_GO_PROVIDER, "\u5B98\u65B9\u63A5\u53E3\u62D2\u7EDD\u4E86\u8BE5 key\uFF08401\uFF09\u2014\u2014\u8BF7\u68C0\u67E5 OpenCode Go API key\u3002");
    }
    if (response.status === 403) {
      return noSubscriptionCard(
        OPENCODE_GO_PROVIDER,
        "\u8BE5 key \u6709\u6548\uFF0C\u4F46\u5F53\u524D\u6CA1\u6709\u751F\u6548\u4E2D\u7684 OpenCode Go \u8BA2\u9605\uFF08\u672A\u8BA2\u9605\u6216\u5DF2\u8FC7\u671F\uFF09\u2014\u2014\u8BA2\u9605\u540E\u70B9\u53F3\u4E0A\u89D2\u5237\u65B0\u5373\u53EF\u6062\u590D\u663E\u793A\u3002"
      );
    }
    if (!response.ok) {
      return errorCard(OPENCODE_GO_PROVIDER, `\u5B98\u65B9\u63A5\u53E3\u8FD4\u56DE HTTP ${response.status}\u3002`);
    }
    const parsed = await response.json();
    if (!isRecord2(parsed)) return errorCard(OPENCODE_GO_PROVIDER, "\u5B98\u65B9\u63A5\u53E3\u8FD4\u56DE\u4E86\u65E0\u6CD5\u8BC6\u522B\u7684\u6570\u636E\u3002");
    body = parsed;
  } catch (error) {
    logger?.warn?.("[tokbook] opencode-go usage fetch failed:", error);
    return errorCard(OPENCODE_GO_PROVIDER, "\u65E0\u6CD5\u8FDE\u63A5\u5B98\u65B9\u63A5\u53E3\uFF08\u7F51\u7EDC\u9519\u8BEF\uFF09\u3002");
  }
  const card = parseOpenCodeGoUsage(body);
  if (card.windows.length === 0) {
    return errorCard(OPENCODE_GO_PROVIDER, "\u5B98\u65B9\u63A5\u53E3\u672A\u8FD4\u56DE\u53EF\u7528\u6570\u636E\u3002");
  }
  return card;
}
async function fetchOfficialQuota(provider, deps = {}) {
  if (provider === COMMAND_CODE_PROVIDER) return fetchCommandCodeQuota(deps);
  if (provider === OPENCODE_GO_PROVIDER) return fetchOpenCodeGoQuota(deps);
  return errorCard(provider, "\u8BE5 provider \u6CA1\u6709\u5185\u7F6E\u7684\u5B98\u65B9\u989D\u5EA6\u67E5\u8BE2\u3002");
}

// src/quota-cache.ts
import { mkdir as mkdir7, readFile as readFile8, rename as rename7, unlink as unlink6, writeFile as writeFile8 } from "node:fs/promises";
import { randomUUID as randomUUID3 } from "node:crypto";
import { dirname as dirname5, join as join8 } from "node:path";
function snapshotFileName(provider) {
  return `quota-${provider}.json`;
}
function isSnapshotFile(value) {
  if (typeof value !== "object" || value === null) return false;
  const raw = value;
  if (typeof raw.savedAt !== "number" || !Number.isFinite(raw.savedAt)) return false;
  const card = raw.card;
  if (typeof card !== "object" || card === null) return false;
  return card.state === "ok" && Array.isArray(card.windows);
}
async function readQuotaSnapshot(dir, provider) {
  let text;
  try {
    text = await readFile8(join8(dir, snapshotFileName(provider)), "utf8");
  } catch {
    return null;
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  return isSnapshotFile(value) ? value.card : null;
}
var writeChains = /* @__PURE__ */ new Map();
async function writeQuotaSnapshotFile(dir, provider, card) {
  const target = join8(dir, snapshotFileName(provider));
  const tmp = `${target}.${String(process.pid)}.${randomUUID3()}.tmp`;
  await mkdir7(dirname5(target), { recursive: true });
  try {
    await writeFile8(tmp, JSON.stringify({ savedAt: Date.now(), card }), "utf8");
    await unlink6(target).catch(() => void 0);
    await rename7(tmp, target);
  } catch (error) {
    await unlink6(tmp).catch(() => void 0);
    throw error;
  }
}
function writeQuotaSnapshot(dir, provider, card) {
  const target = join8(dir, snapshotFileName(provider));
  const previous = writeChains.get(target) ?? Promise.resolve();
  const next = previous.then(() => writeQuotaSnapshotFile(dir, provider, card));
  const settled = next.then(() => void 0, () => void 0);
  writeChains.set(target, settled);
  void settled.then(() => {
    if (writeChains.get(target) === settled) writeChains.delete(target);
  });
  return next;
}

// src/index.ts
var BUILTIN_PLAN_KEYS = [OPENCODE_GO_PROVIDER, COMMAND_CODE_PROVIDER];
var QUOTA_TTL_MS = 3e4;
var SYNC_MIN_INTERVAL_MS = 15e3;
var name = "dsh-tokbook";
function resolveLogger(ctx) {
  const maybe = ctx;
  return typeof maybe.logger === "function" ? maybe.logger("tokbook") : console;
}
var TokenUsageBook = class _TokenUsageBook extends Service {
  static inject = [];
  logger;
  dir;
  log;
  recordCompaction;
  hostCtx;
  planConfig;
  quotaCardCache = /* @__PURE__ */ new Map();
  credentials;
  persistence;
  lastSyncAt = 0;
  lastWalkAt = 0;
  walkInFlight = null;
  probeCache = null;
  probeInFlight = null;
  syncStatus = "idle";
  syncError = null;
  syncedBySession = /* @__PURE__ */ new Map();
  syncedOnce = false;
  baselineReady;
  disposed = false;
  pricingSyncInFlight = null;
  catalogCache = null;
  constructor(ctx, config = {}) {
    super(ctx, "tokbook");
    validateConfig(config);
    ctx.effect(() => {
      return () => {
        this.disposed = true;
        return this.log.flush();
      };
    });
    this.logger = resolveLogger(ctx);
    this.recordCompaction = config.recordCompaction !== false;
    this.dir = defaultDataDir(config.path);
    this.log = new UsageLog(this.dir, this.logger);
    this.hostCtx = ctx;
    this.planConfig = coercePlansConfig(config.plans);
    void warnIfForeignOwner(this.dir, this.logger).then((foreign) => {
      if (!foreign) return writeOwnerMarker(this.dir);
    });
    void warmRecordCache(this.dir, this.logger).catch((error) => {
      this.logger.warn?.("[tokbook] cannot warm the ledger record cache (data directory unreadable); reads will load day files on demand:", error);
    });
    this.baselineReady = readSyncProgress(this.dir).then((progress) => {
      if (progress === null) return;
      this.syncedBySession = new Map(Object.entries(progress.sessions));
      this.syncedOnce = true;
      this.logger.info?.(`[tokbook] loaded sync baseline: ${String(this.syncedBySession.size)} sessions (synced ${new Date(progress.syncedAt).toISOString()})`);
    }).catch((error) => {
      this.logger.warn?.("[tokbook] cannot read sync baseline; will re-sync from scratch:", error);
    });
    this.bootHolidays();
    const lastModel = /* @__PURE__ */ new Map();
    const lastProvider = /* @__PURE__ */ new Map();
    const eventStream = ctx;
    eventStream.on("session/event", (session, event) => {
      try {
        const revealedModel = modelOfEvent(event);
        if (revealedModel !== void 0) lastModel.set(session.id, revealedModel);
        const revealedProvider = providerOfEvent(event);
        if (revealedProvider !== void 0) lastProvider.set(session.id, revealedProvider);
        const record = recordOfEvent(event, session.id, lastModel.get(session.id) ?? "", this.recordCompaction);
        if (record === null) return;
        if (record.provider === void 0) {
          const provider = lastProvider.get(session.id);
          if (provider !== void 0) record.provider = provider;
        }
        void this.log.record(record);
      } catch (error) {
        this.logger.error("[tokbook] event fold failed:", error);
      }
    });
    ctx.inject(["sessionPersistence"], (persistenceCtx) => {
      const persistence = persistenceCtx.get("sessionPersistence");
      this.persistence = persistence;
      const failed = /* @__PURE__ */ new Set();
      this.startWalk(async () => {
        try {
          const result = await autoSyncIfNeeded(this.syncDeps(persistence, failed), this.dir);
          if (this.disposed || result === null) return;
          this.logger.info?.(`[tokbook] first-run sync: ${String(result.added)} added, ${String(result.skipped)} skipped, ${String(result.failedSessions)} failed sessions`);
          try {
            this.setBaseline(await listPersistenceSnapshots(persistence, this.logger), failed);
          } catch (error) {
            this.logger.warn?.("[tokbook] cannot record baseline after first-run sync:", error);
          }
          await warmRecordCache(this.dir, this.logger);
        } catch (error) {
          this.logger.error("[tokbook] first-run sync failed:", error);
        }
      });
    });
    ctx.inject(["credentials"], (credentialsCtx) => {
      const service = credentialsCtx.get("credentials");
      if (service === void 0) return;
      this.credentials = {
        resolve: async (ref) => {
          const hit = await service.resolve(ref);
          return hit?.value !== void 0 && hit.value !== "" ? hit.value : void 0;
        }
      };
    });
    ctx.inject(["webServer"], (injectedCtx) => {
      const webServer = injectedCtx.get("webServer");
      injectedCtx.effect(() => registerTokBookRoutes(
        webServer,
        () => this.overview(),
        () => this.syncState(),
        () => this.rescan()
      ));
      injectedCtx.effect(() => registerTokBookUsageRoute(
        webServer,
        (range) => this.usageByRange(range)
      ));
      injectedCtx.effect(() => registerTokBookSessionRoute(
        webServer,
        (sessionId) => this.sessionUsage(sessionId)
      ));
      injectedCtx.effect(() => registerTokBookQuotaRoute(
        webServer,
        () => this.quota(),
        (provider, force) => this.quotaCardOf(provider, force)
      ));
      injectedCtx.effect(() => registerTokBookPricingRoutes(
        webServer,
        () => this.pricingView(),
        (body) => this.savePricing(body)
      ));
      injectedCtx.effect(() => registerTokBookPricingSyncRoute(
        webServer,
        (force) => this.syncPricing(force)
      ));
      injectedCtx.effect(() => registerTokBookPricingLookupRoute(
        webServer,
        (keyword) => this.lookupPricing(keyword)
      ));
      injectedCtx.effect(() => registerTokBookHolidaySyncRoute(
        webServer,
        (options) => this.refreshHolidays(options)
      ));
    });
  }
  async ensureFresh() {
    const persistence = this.persistence;
    if (persistence === void 0) return [];
    await this.baselineReady;
    const snapshots = this.probeSnapshots(persistence);
    if (this.walkInFlight !== null && (await listDayFiles(this.dir)).length === 0) {
      await this.walkInFlight;
    }
    return snapshots;
  }
  probeSnapshots(persistence) {
    const cached = this.probeCache;
    if (cached === null) return this.refreshProbe(persistence);
    if (Date.now() - cached.at >= SYNC_MIN_INTERVAL_MS) {
      void this.refreshProbe(persistence).catch((error) => {
        this.logger.error("[tokbook] background probe refresh failed:", error);
      });
    }
    this.scheduleSync(cached.snapshots, staleSessionIds(this.syncedOnce, this.syncedBySession, cached.snapshots));
    return Promise.resolve(cached.snapshots);
  }
  refreshProbe(persistence) {
    if (this.probeInFlight !== null) return this.probeInFlight;
    const pending = listPersistenceSnapshots(persistence, this.logger).catch((error) => {
      this.logger.error("[tokbook] persistence list probe failed:", error);
      return [];
    }).then((snapshots) => {
      this.probeCache = { at: Date.now(), snapshots };
      this.scheduleSync(snapshots, staleSessionIds(this.syncedOnce, this.syncedBySession, snapshots));
      return snapshots;
    }).finally(() => {
      if (this.probeInFlight === pending) this.probeInFlight = null;
    });
    this.probeInFlight = pending;
    return pending;
  }
  scheduleSync(snapshots, stale) {
    if (stale.length === 0) {
      if (this.walkInFlight === null) this.syncStatus = "done";
      return;
    }
    if (this.walkInFlight !== null) return;
    const neverSynced = stale.some((id) => !this.syncedBySession.has(id));
    if (!neverSynced && Date.now() - this.lastWalkAt < SYNC_MIN_INTERVAL_MS) return;
    this.doSync(snapshots, stale);
  }
  syncDeps(persistence, failed) {
    return {
      persistence,
      log: this.log,
      recordCompaction: this.recordCompaction,
      logger: this.logger,
      onSessionFailure: (id, error) => {
        failed.add(id);
        this.logger.error(`[tokbook] cannot fold session ${id}:`, error);
      }
    };
  }
  startWalk(run) {
    if (this.walkInFlight !== null) return false;
    const tracked = run().finally(() => {
      if (this.walkInFlight === tracked) this.walkInFlight = null;
    });
    this.walkInFlight = tracked;
    return true;
  }
  doSync(snapshots, sessionIds) {
    const persistence = this.persistence;
    if (persistence === void 0) return false;
    const startedAt = Date.now();
    return this.startWalk(async () => {
      this.syncStatus = "running";
      this.syncError = null;
      this.lastWalkAt = startedAt;
      const failed = /* @__PURE__ */ new Set();
      try {
        const result = await syncHistory(
          this.syncDeps(persistence, failed),
          { snapshots, sessionIds }
        );
        this.lastSyncAt = Date.now();
        this.syncStatus = "done";
        this.setBaseline(snapshots, failed);
        this.logger.info?.(`[tokbook] sync: ${String(result.added)} added, ${String(result.skipped)} skipped, ${String(result.failedSessions)} failed sessions (${String(sessionIds.length)} of ${String(snapshots.length)} sessions) in ${String(Date.now() - startedAt)} ms`);
      } catch (error) {
        this.syncStatus = "error";
        this.syncError = error instanceof Error ? error.message : String(error);
        this.logger.error("[tokbook] sync failed:", error);
      }
    });
  }
  setBaseline(snapshots, failed) {
    const baseline = snapshotBaseline(snapshots);
    for (const id of failed) baseline.delete(id);
    this.syncedBySession = baseline;
    this.syncedOnce = true;
    if (this.disposed) return;
    writeSyncProgress(this.dir, {
      syncedAt: Date.now(),
      sessions: Object.fromEntries(baseline)
    }).catch((error) => {
      this.logger.warn?.("[tokbook] cannot persist sync baseline:", error);
    });
  }
  async overview() {
    await this.ensureFresh();
    const { table, billing, revision, resolve } = await this.rateContext();
    const summary = await buildSummary(this.dir, () => /* @__PURE__ */ new Date(), resolve, this.logger, { pricingRevision: revision });
    const costed = attachCosts(summary, table, billing);
    const { pricing: _pricing, rateRows: _rateRows, byHour: _byHour, byModel: _byModel, unpricedModels: _unpricedModels, ...slim } = costed;
    return {
      ...slim,
      totalTokens: totalsTokens(costed.total),
      updatedAt: Date.now(),
      records: costed.total.requests + (costed.total.failures ?? 0),
      lastEventAt: summary.lastEventAt,
      syncStatus: this.syncStatus,
      syncError: this.syncError
    };
  }
  workspaceRefs() {
    const registry = this.workspaceRegistry();
    if (registry === void 0) return null;
    return registry.list().map((workspace) => ({
      id: String(workspace.id),
      title: workspace.title,
      path: workspace.path
    }));
  }
  async usageByRange(range) {
    const snapshots = await this.ensureFresh();
    const { table, billing, resolve } = await this.rateContext();
    const { fromDay, toDay } = rangeDayWindow(range);
    const records = await readRecordsByDayRange(this.dir, fromDay, toDay, this.logger);
    const cwdBySession = /* @__PURE__ */ new Map();
    for (const snap of snapshots) {
      const cwd = snap.header.cwd;
      if (typeof cwd === "string" && cwd !== "") cwdBySession.set(snap.header.id, cwd);
    }
    const aggregate = aggregateWindow(
      records,
      this.workspaceRefs(),
      (id) => cwdBySession.get(id),
      table,
      resolve,
      billing
    );
    const providerLabels = routeLabels(this.settings(), this.llm(), this.logger);
    return {
      range,
      fromDay,
      toDay,
      updatedAt: Date.now(),
      providerLabels,
      totalTokens: aggregate.providers.reduce((sum, card) => sum + card.tokens, 0),
      totalRequests: aggregate.providers.reduce((sum, card) => sum + card.requests, 0),
      totalSpend: aggregate.providers.reduce((sum, card) => sum + card.spend, 0),
      totalSubscriptionValue: aggregate.providers.reduce((sum, card) => sum + card.subscriptionValue, 0),
      byModel: aggregate.byModel,
      byWorkspace: aggregate.byWorkspace,
      providers: aggregate.providers
    };
  }
  async sessionUsage(sessionId) {
    const snapshots = await this.ensureFresh();
    const { table, billing, resolve } = await this.rateContext();
    const records = await readCachedRecords(this.dir, this.logger);
    const join9 = await sessionJoin(this.persistence, sessionId, this.logger);
    const now = Date.now();
    return buildSessionUsageView({
      sessionId,
      records,
      join: join9,
      sessions: snapshots,
      pricing: table,
      billing,
      resolve,
      todaySpend: this.todaySpendOf(records, now, table, billing, resolve),
      updatedAt: now
    });
  }
  todaySpendOf(records, now, table, billing, resolve) {
    const today = dayKeyOf(now);
    const costed = attachCosts(
      { ...summarizeRecords(records.filter((record) => dayKeyOf(record.time) === today), resolve), dataDir: this.dir },
      table,
      billing
    );
    return costed.byDay.find((row) => row.day === today)?.spend ?? 0;
  }
  settings() {
    const forms = this.hostCtx.get("settings");
    if (forms === void 0 || typeof forms.describe !== "function") return void 0;
    try {
      const byNs = new Map(forms.describe().map((row) => [row.ns, row.value]));
      return { get: (ns) => byNs.get(ns) };
    } catch (error) {
      this.logger.warn?.("[tokbook] cannot describe settings namespaces:", error);
      return void 0;
    }
  }
  llm() {
    return this.hostCtx.get("llm");
  }
  workspaceRegistry() {
    return this.hostCtx.get("workspaceRegistry");
  }
  async rateContext() {
    const { table, billing, calendar, revision, currency, fx } = await readPriceFile(this.dir, this.logger);
    const auto = await this.autoCalendar();
    const merged = mergeHolidayCalendars(calendar, auto);
    const holidays = holidaySet(merged);
    return {
      table: cnyTable(table, currency, fx),
      billing,
      calendar: merged,
      revision: `${revision}#${calendarSignature(merged)}`,
      resolve: (record) => rateKeyAt(table, record.provider, record.model, record.time, holidays)
    };
  }
  async manualCalendar() {
    return (await readPriceFile(this.dir, this.logger)).calendar;
  }
  async autoCalendar() {
    const cache = await readHolidayCache(this.dir);
    const calendar = {};
    for (const [year, entry] of Object.entries(cache.years)) {
      if (entry.ranges.length > 0) calendar[year] = entry.ranges;
    }
    return calendar;
  }
  async quota() {
    const providers = BUILTIN_PLAN_KEYS.filter((key) => this.planConfig[key]?.enabled !== false);
    let alert = false;
    for (const key of providers) {
      const cached = this.quotaCardCache.get(key);
      const snapshot = cached?.card.state === "ok" ? cached.card : await readQuotaSnapshot(this.dir, key);
      if (isQuotaAlert(snapshot)) {
        alert = true;
        break;
      }
    }
    return { providers, alert };
  }
  async quotaCardOf(provider, force = false) {
    const now = Date.now();
    const config = this.planConfig[provider];
    const enabled = config === void 0 || config.enabled !== false;
    if (!enabled || !isBuiltinQuotaPlan(provider)) {
      const card2 = errorCard(provider, "\u8BE5 provider \u5DF2\u7981\u7528\u6216\u6CA1\u6709\u5185\u7F6E\u7684\u5B98\u65B9\u989D\u5EA6\u67E5\u8BE2\u3002");
      if (isBuiltinQuotaPlan(provider)) this.quotaCardCache.set(provider, { at: now, card: card2 });
      return card2;
    }
    if (!force) {
      const cached = this.quotaCardCache.get(provider);
      if (cached !== void 0 && now - cached.at < QUOTA_TTL_MS) return cached.card;
      const snapshot = await readQuotaSnapshot(this.dir, provider);
      if (snapshot !== null) {
        this.quotaCardCache.set(provider, { at: now, card: snapshot });
        return snapshot;
      }
    }
    let card;
    try {
      card = await fetchOfficialQuota(provider, {
        plan: config,
        logger: this.logger,
        credentials: this.credentials
      });
    } catch (error) {
      this.logger.error(`[tokbook] official quota fetch for ${provider} threw:`, error);
      card = errorCard(provider, error instanceof Error ? error.message : String(error));
    }
    this.quotaCardCache.set(provider, { at: now, card });
    if (card.state === "ok") {
      void writeQuotaSnapshot(this.dir, provider, card).catch((error) => {
        this.logger.warn?.(`[tokbook] cannot persist quota snapshot for ${provider}:`, error);
      });
    }
    return card;
  }
  syncState() {
    return {
      status: this.syncStatus,
      error: this.syncError,
      lastSyncAt: this.lastSyncAt > 0 ? this.lastSyncAt : null,
      ledger: ledgerGeneration(this.dir)
    };
  }
  async rescan() {
    const persistence = this.persistence;
    const lastSyncAt = this.lastSyncAt > 0 ? this.lastSyncAt : null;
    if (persistence === void 0) return { status: "skipped", lastSyncAt };
    let snapshots;
    try {
      snapshots = await listPersistenceSnapshots(persistence, this.logger);
    } catch (error) {
      this.logger.error("[tokbook] rescan cannot list sessions:", error);
      return { status: "skipped", lastSyncAt };
    }
    const started = this.doSync(snapshots, snapshots.map((snapshot) => snapshot.header.id));
    return { status: started ? "running" : "skipped", lastSyncAt };
  }
  async pricingView() {
    await this.ensureFresh();
    let ledger = { byRouteModel: /* @__PURE__ */ new Map(), byRoute: /* @__PURE__ */ new Map() };
    let holidays;
    try {
      const records = await readCachedRecords(this.dir, this.logger);
      const { table, calendar } = await this.rateContext();
      ledger = ledgerUsageOf(records, table, holidaySet(calendar));
      const manual = await this.manualCalendar();
      const auto = await this.autoCalendar();
      holidays = {
        calendar,
        autoOnly: Object.keys(autoOnly(manual, auto)).sort(),
        sync: await this.holidaySyncView(manual, auto)
      };
    } catch (error) {
      this.logger.warn?.("[tokbook] cannot read ledger usage for pricing view:", error);
    }
    const catalog = await collectRoutes(this.settings(), this.llm(), this.logger);
    return readPricingView(this.dir, catalog, ledger, this.logger, holidays, await this.pricingSyncView());
  }
  async holidaySyncView(manual, auto) {
    const cache = await readHolidayCache(this.dir);
    const now = Date.now();
    const currentYear = new Date(now).getFullYear();
    const earliest = await this.earliestLedgerYear();
    const wanted = [];
    if (earliest !== null) {
      for (let year = earliest; year <= currentYear; year += 1) wanted.push(String(year));
    }
    if (wanted.length === 0) wanted.push(String(currentYear));
    const needed = wanted.filter((year) => manual[year] === void 0);
    const verdict = autoHolidayState(cache, needed, now);
    return {
      source: { label: "holiday-cn", url: HOLIDAY_CN_BASE },
      refreshDays: HOLIDAY_REFRESH_DAYS,
      state: verdict.state,
      covered: verdict.covered,
      uncovered: verdict.uncovered,
      lastAttemptAt: cache.lastAttemptAt ?? null,
      lastError: cache.lastError ?? null
    };
  }
  async savePricing(body) {
    const parsed = parsePriceInput(body);
    if (!parsed.ok) return parsed;
    return this.withPriceFileLock(async () => {
      await writePriceFile(this.dir, parsed.file, this.logger);
      return parsed;
    });
  }
  async syncPricing(force = false) {
    if (this.pricingSyncInFlight !== null) return this.pricingSyncInFlight;
    const started = (async () => {
      const state = await readPricingSyncState(this.dir);
      const now = Date.now();
      if (!shouldSyncNow(state, now, force)) {
        return { added: 0, skipped: 0, syncedAt: now, throttled: true, reasons: {} };
      }
      const today = dayKeyOf(now);
      try {
        const [catalog, records] = await Promise.all([
          fetchCatalog(),
          readCachedRecords(this.dir, this.logger)
        ]);
        const report = await this.withPriceFileLock(async () => {
          const file = await readPriceFile(this.dir, this.logger);
          const { table, report: report2 } = mergeCatalogIntoTable(
            file.table,
            file.currency,
            billedRouteModels(records),
            catalog
          );
          if (report2.added > 0) {
            const next = { ...file, table };
            await writePriceFile(this.dir, next, this.logger);
          }
          return report2;
        });
        await writePricingSyncState(this.dir, {
          lastSyncDay: today,
          lastAdded: report.added,
          lastAttemptAt: now,
          lastError: null,
          nextAttemptAt: null
        });
        return { ...report, syncedAt: Date.now() };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await writePricingSyncState(this.dir, {
          lastSyncDay: state.lastSyncDay,
          lastAdded: state.lastAdded,
          lastAttemptAt: now,
          lastError: message.slice(0, 300),
          nextAttemptAt: now + PRICING_SYNC_RETRY_MS
        }).catch(() => void 0);
        throw error;
      }
    })();
    this.pricingSyncInFlight = started;
    try {
      return await started;
    } finally {
      if (this.pricingSyncInFlight === started) this.pricingSyncInFlight = null;
    }
  }
  async pricingSyncView() {
    const now = Date.now();
    const state = await readPricingSyncState(this.dir);
    let gaps = 0;
    try {
      const [records, file] = await Promise.all([
        readCachedRecords(this.dir, this.logger),
        readPriceFile(this.dir, this.logger)
      ]);
      for (const [route, models] of billedRouteModels(records)) {
        if (file.currency[route] !== "USD") continue;
        const priced = file.table[route] ?? {};
        for (const model of models) if (priced[model] === void 0) gaps += 1;
      }
    } catch (error) {
      this.logger.warn?.("[tokbook] cannot count unpriced USD cells for the pricing sync view:", error);
    }
    const verdict = state.lastError !== null ? "failed" : state.lastAttemptAt === null ? gaps > 0 ? "missing" : "stale" : state.lastSyncDay === dayKeyOf(now) ? "ok" : "stale";
    return {
      source: { label: "models.dev", url: MODELS_DEV_URL },
      refreshDays: 1,
      retryMinutes: Math.round(PRICING_SYNC_RETRY_MS / 6e4),
      state: verdict,
      gaps,
      lastSuccessDay: state.lastSyncDay,
      lastAdded: state.lastAdded,
      lastAttemptAt: state.lastAttemptAt,
      lastError: state.lastError,
      nextAttemptAt: state.nextAttemptAt
    };
  }
  async lookupPricing(keyword) {
    const catalog = await this.loadCatalog();
    return {
      keyword,
      candidates: searchCatalog(catalog, keyword).map((match) => ({
        provider: match.entry.provider,
        modelId: match.entry.modelId,
        name: match.entry.name,
        key: match.key,
        cost: match.entry.cost
      }))
    };
  }
  static CATALOG_TTL_MS = 6 * 60 * 60 * 1e3;
  async refreshHolidays(options = {}) {
    const now = Date.now();
    const currentYear = new Date(now).getFullYear();
    const cache = await readHolidayCache(this.dir);
    const years = /* @__PURE__ */ new Set();
    const earliest = await this.earliestLedgerYear();
    if (earliest !== null) {
      for (let year = earliest; year <= currentYear; year += 1) years.add(String(year));
    }
    years.add(String(currentYear));
    for (const year of options.extraYears ?? []) years.add(year);
    const wanted = [...years].sort((left, right) => left.localeCompare(right));
    const fetched = [];
    const unpublished = [];
    const failed = {};
    let changed = false;
    const next = { years: { ...cache.years } };
    for (const year of wanted) {
      if (options.force !== true && isFresh(cache.years[year], now)) continue;
      try {
        const ranges = await fetchHolidayYear(year);
        fetched.push(year);
        if (ranges.length === 0) {
          unpublished.push(year);
          if (next.years[year] === void 0) next.years[year] = { ranges: [], fetchedAt: now };
          else next.years[year] = { ...next.years[year], fetchedAt: now };
          continue;
        }
        const before = JSON.stringify(next.years[year]?.ranges ?? []);
        next.years[year] = { ranges, fetchedAt: now };
        if (before !== JSON.stringify(ranges)) changed = true;
      } catch (error) {
        failed[year] = error instanceof Error ? error.message : String(error);
      }
    }
    const attempted = fetched.length > 0 || Object.keys(failed).length > 0;
    if (attempted) {
      next.lastAttemptAt = now;
      const firstFailure = Object.values(failed)[0] ?? null;
      next.lastError = firstFailure;
      await writeHolidayCache(this.dir, next).catch((error) => {
        this.logger.warn?.("[tokbook] cannot persist holiday cache:", error);
      });
    }
    return {
      fetched,
      unpublished,
      failed,
      changed,
      refreshedAt: now
    };
  }
  async earliestLedgerYear() {
    try {
      const records = await readCachedRecords(this.dir, this.logger);
      let earliest = null;
      for (const record of records) {
        if (earliest === null || record.time < earliest) earliest = record.time;
      }
      return earliest === null ? null : new Date(earliest).getFullYear();
    } catch {
      return null;
    }
  }
  holidayBootstrapped = false;
  bootHolidays() {
    if (this.holidayBootstrapped) return;
    this.holidayBootstrapped = true;
    void this.refreshHolidays().catch((error) => {
      this.logger.warn?.("[tokbook] holiday-cn refresh failed; keeping whatever is cached:", error);
    });
  }
  async loadCatalog() {
    const now = Date.now();
    const cached = this.catalogCache;
    if (cached !== null && now - cached.at < _TokenUsageBook.CATALOG_TTL_MS) return cached.catalog;
    const catalog = await fetchCatalog();
    this.catalogCache = { catalog, at: now };
    return catalog;
  }
  async withPriceFileLock(work) {
    const previous = this.priceFileChain;
    const next = previous.then(work, work);
    this.priceFileChain = next.then(() => void 0, () => void 0);
    return next;
  }
  priceFileChain = Promise.resolve();
};
var src_default = TokenUsageBook;
export {
  TokenUsageBook,
  src_default as default,
  name
};
