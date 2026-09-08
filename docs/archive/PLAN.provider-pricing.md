# 消费端升级计划：dsh-tokbook 接入 (provider, model) 双维定价 + 时间维度 + 双桶统计

> **Doc meta** · role: process · language: zh-CN · status: superseded · last-reviewed: 2026-09-08 · supersedes: —

> ⚠️ **已归档（superseded）**：本计划的各阶段已落地——provider 用量 + 官方额度
> 见 commit `5e2c86f`（2026-09-07），pricing 手工维护 tab 等剩余工作在 2026-09-08
> 的工作区中实现。**不要按本计划实现**；当前接口以 [`../CONTRACTS.md`](../CONTRACTS.md)
> 为准，决策记录见 [`../DECISIONS.md`](../DECISIONS.md) D-003。本文件仅作历史留存。

> 本文件是给「接手的 AI / 工程师」的完整实施计划。目标是让 dsh-tokbook
> 消费端消费 [dsh-model-pricing](https://github.com/a285292107s/dsh-model-pricing)
> 镜像的两层数据（基准价表 + provider 覆盖层），把计价从「单 model 维度」升级为
> **(provider, model) 双维 + 按记录时间戳计价 + 实际支出/订阅价值双桶统计**。

## 1. 背景与目标

### 1.1 为什么需要这次升级

- 账本每行同时记 `provider`（deepseek-official / opencode-go / commandcode / zai /
  staryears / dots-ai …）与 `model`。同一个 model 串（如 `deepseek-v4-flash`）
  可能同时出现在官方 API 通道与订阅通道，**计费性质与价格都不同**；还有带
  provider 前缀的串（`deepseek/deepseek-v4-flash`、`z-ai/glm-5.3-flash`）基准价表
  查不到。
- 厂商会调价（官方基准表带 `timeRules` 历史调价段，如 `deepseek-v4-flash`
  原价→2026-08-16 起峰谷价、`glm-5.3-flash` 限时 5 折），计价必须**按记录自身时间戳**
  解析当时的价，历史重算才对。
- 订阅通道（opencode-go/commandcode）实际不按 token 从你钱包扣钱，其"费用"是
  **订阅价值**（用官方按量价折算"省了多少"），必须与按量通道的**实际支出**分开统计。

### 1.2 需求结论（已与用户确认）

| 通道类型 | billing | 计价取价 | 统计归属 |
|---|---|---|---|
| 官方/直连（deepseek-official、zai） | `metered` | 跟随官方基准价（含调价史） | 实际支出 |
| 订阅（opencode-go、commandcode、modlens-commandcode） | `subscription` | 官方基准价折算价值 | 订阅价值（非现金） |
| 中转站（staryears） | `metered` | 先用官方价占位；**用户填真实价后**改显式 segments | 实际支出 |
| 未知串（dots-ai / dots3-note-prev） | `metered` | 默认 ¥0；**用户填价** | 实际支出 |

时间维度：官方/订阅跟随基准价 `timeRules`（自动得调价史）；中转/未知串用显式
`segments` 时间轴（用户维护自己的调价史）。

## 2. 数据源：dsh-model-pricing 镜像（已完成，只读引用）

- 仓库：https://github.com/a285292107s/dsh-model-pricing（master）
- `model_pricing.json` —— 基准价表（169 模型，结构与现 tokbook 的
  `pricing.ccsa.json` 相同：modelId + input/output/cache* + timeRules +
  contextTiers + dailySlots + aliases + family）。**官方调价史在每模型 `timeRules`**。
- `provider_pricing.json` —— provider 覆盖层。Schema：
  `providers[].provider`（路由键）+ `entries[]`：
  - `model`：账本里**精确串**（可带 provider 前缀）
  - `billing`: `metered` | `subscription`
  - `inheritBase: <modelId>`：跟随基准价该 model 的**完整规则与调价史**
  - 或 `segments[]`：`{ from?, to?, rate: {input/output/cacheRead/cacheWrite}, note? }`
    用户自定价时间轴（to 缺省开放）
  - `placeholder?: true`：中转占位（当前值=官方价，等用户填真实 segments）
  - `note`：人类注释
- raw URL：
  `https://raw.githubusercontent.com/a285292107s/dsh-model-pricing/master/model_pricing.json`
  `https://raw.githubusercontent.com/a285292107s/dsh-model-pricing/master/provider_pricing.json`

## 3. 现状（消费端相关代码，改造前先读这些）

| 位置 | 现状 | 与本次的关系 |
|---|---|---|
| `src/types.ts` | `PricingTable = Record<model, ModelRates>`；`UsageModelRow` 有 provider 字段；`CostedModelRow = UsageModelRow & {cost}`；`UsageRateRow` **无 provider**；`CostedSummary` 只有 `totalCost`（单一） | 类型需要扩展 |
| `src/pricing.ts` | 读取/合并两源（cloud mirror `pricing.ccsa.json` + 手工 `pricing.json`，手工赢）；`resolveRate(rates, timeMs, contextTokens)` 按模型内 timeRules/tiers/slots 解析；`attachCosts` 输入 `PricingTable` | 需加 provider 层读取 + 合并 + 解析入口 |
| `src/stats.ts` | 聚合：`summarizeRecords` 按 `(day, model, rate)` 出 `rateRows`（**无 provider**）；`mergeSummaries` 同；`attachCosts(summary, pricing)` 按 model 查价加成本层；`costRecentEntries(recent, pricing, resolve)` 逐条计价 | 聚合身份与成本都要带 provider |
| `src/index.ts` | `overview()` 读 `readPricingTable` → `buildSummary(dir, now, resolveRate)` → `attachCosts`；`resolveRate(record, pricing)` 只按 `record.model` 查；`usageByRange` 走 `providerCards`；`pricingView/savePricing` 服务价格表 tab | 主接线改造 |
| `src/by-provider.ts` | Provider 用量 tab：按 provider 分组后在组内跑 summarize+attachCosts（组内 model 唯一，所以**组内按 model 计价碰巧正确**） | 改造后应直接消费双维表 |
| `src/routes.ts` | `/tokbook/overview`、`/tokbook/usage?range`、`/tokbook/quota`、`/tokbook/pricing`(GET/PUT 手工价) | wire 类型随 summary 扩展 |
| `src/client/*` | 浮窗（LedgerOverlay）：hero 单一金额；byModel 列表带 provider；Provider tab 卡片；**价格表 tab(PricingPanel)** 目前只编辑手工 model flat 价 | 前端展示双桶 + 新维度 |

**关键架构约束（设计必须遵守）**：
1. `UsageRecord` 已含 `provider?` 与 `model`。计价解析入口已有 record，只是
   **丢弃了 provider**。
2. `rateRows` 以 `(day, model, rate)` 为聚合身份且**无 provider** → 若同一个
   (model, rate) 落在两个 provider 且价格不同，rollup 会错误合并。**聚合身份必须
   加 provider 维度**（rate 行、byModel 行、rollup 格式）。
3. rollup / parse cache / dedupe 假定单一进程写目录；格式变更要配一次版本迁移
   （见 §5.5）。
4. `pricing.json` 手工层是 flat（base only，无规则链）；价格表 tab 的编辑语义
   即 flat 覆盖 → 保留，同时 provider 层的手工覆盖另设文件（见 §5.4）。

## 4. 目标设计

### 4.1 计价解析链（一次调用，双维 + 时间）

新函数（`src/pricing.ts`）：

```
resolvePriced(provider: string|undefined, model: string, timeMs, contextTokens)
  → { prices: ModelPricing; key: RateKey; billing: 'metered'|'subscription'|undefined }
```

解析顺序（第一个命中的赢）：
1. **provider 覆盖层** `providerTable[provider]?.entries[model]`：
   - `inheritBase` → 用基准价表该 modelId 的完整 `ModelRates`（含 timeRules）走
     `resolveRate`（时间/档位/峰谷照常）→ billing 取条目值。
   - `segments` → 按 `timeMs` 找段：`from ≤ t < to`（无 `to` 段开放到 ∞）→ 段 rate
     即价；不在任何段 → 回退到基准价（无规则链）。key 用段索引表达或回退 key。
2. 无 provider 覆盖 → 基准价表 `base[model]`（model 直查，含手工 `pricing.json`
   的 flat 覆盖已并入基准？——注意：手工 flat 覆盖是**模型全局**的，保持 model 层，
   优先级低于 provider 覆盖、高于 cloud base，见 §5.4）。
3. 都没有 → unpriced（cost 0，记入 unpriced 列表）。

> 解析必须以**记录自己的 provider 串**为键：`deepseek/deepseek-v4-flash` 这类
> 前缀串直接在 provider 层条目里精确匹配（镜像已为 commandcode 等填好）。

### 4.2 双桶统计（成本层）

`CostedSummary` / wire 增加两类金额：
- `totalSpend`：只有 `billing === 'metered'` 行的金额合计（= 实际支出）。
- `totalValue`：只有 `billing === 'subscription'` 行的金额合计（= 订阅价值，非现金）。
- 兼容保留 `totalCost`（= spend + value？还是只 metered？）——**设计决定**：为避免
  破坏性理解，新字段用 `spend` / `subscriptionValue` 两个独立量；旧的 `totalCost`
  语义保留为"账本按表计出的总额"以兼容代码，但 UI 不再把它当作"支出"。由实现者
  与 UI 一起定展示口径并在 统计口径 tab 写明。
- 每 model 行（`CostedModelRow` / Provider 卡内 model）同样给两个金额 + `billing`。

### 4.3 聚合身份加 provider

- `UsageRateRow` 增加 `provider` 字段；`rateRowKey`/排序/合并含 provider。
- `UsageModelRow` 已有 provider；`summarizeRecords` 的 model map 键从 model 改为
  `provider|model` 复合键（provider 缺失的行归 `''` → 展示层归"(未知)"）。
- rollup / mergeSummaries 同步。
- `by-provider.ts` 的 `providerCards` 改造后可复用双维 attachCosts（组内天然单
  provider），或直接删除自己 attachCosts、走共享路径，保持一致。

### 4.4 前端（浮窗）

- hero / 模型列表 / Provider 卡片 / 最近记录金额都来自双桶：`spend` 一个值 +
  `订阅价值` 一个值（分开显示，不要相加成单一"支出"）。
- **价格表 tab（PricingPanel）升级**：
  - 增加 provider 维度筛选/分组（左侧可选 provider，或表内每行标 provider）。
  - 每行展示来源语义：`云端(基准)` / `云端+调价史(inheritBase)` /
    `手工flat覆盖` / `provider条目 segments` / `未知串 ¥0`。
  - 编辑能力（新路由/写回）见 §5.4，UI 按第一版能看+能编辑为主。
- **统计口径 tab**：补一段「实际支出 ≠ 订阅价值」的说明 + 价格来源时间维度的说明。

## 5. 分阶段实施（每阶段可独立验收）

### Phase 1 —— 数据接入（host 读取新镜像 + 双维解析）
**改动文件**：`src/pricing.ts`、`src/types.ts`、`src/index.ts`（配置）
1. 新增镜像 provider 文件读取：
   - 启动同步第二个 URL（`provider_pricing.json` → 数据目录
     `provider-pricing.ccsa.json`），复用 `syncCloudPricing` 的原子写/超时/上限
     模式，加新配置 `pricingProviderUrl`（缺省指向上面 raw URL）。
   - 类型 `ProviderPricingTable` / `ProviderPricingEntry`（`inheritBase` |
     `segments` + `billing` + note）。
2. 实现 §4.1 `resolvePriced`（先纯函数、单元可测），并让
   `TokenUsageBook.resolveRate`（index.ts）改走它（provider 从 record 取）。
3. 实现 §4.2 双桶 cost 累加（`attachCosts` 输入带 provider 的 summary + 双维表）。
4. 手工 flat 覆盖语义对齐（模型全局、优先级低于 provider 覆盖、高于 cloud base）。
**验收**：
- `pnpm smoke` 中新增用例：同 model 不同 provider 价格不同；`inheritBase` 跟随
  timeRules；`segments` 按时取段；前缀串命中 provider 条目；subscription 金额进
  value 不进 spend。
- 你的真实账本数据（`~/.dsh/tokbook`）只读验证：查询一个 opencode-go 的
  deepseek-v4-flash 行与 commandcode 的 `deepseek/deepseek-v4-flash` 行，得到不同
  归属。

### Phase 2 —— 聚合与持久化格式（provider 进聚合身份）
**改动文件**：`src/stats.ts`、`src/types.ts`、`rollup` 校验
1. rateRows/byModel/merge 键加 provider（§4.3）。
2. rollup 格式 v2：
   - `rollup.json` 增加格式版本字段（如 `"v": 2` 或 `schemaVersion`）。
   - 读取 v1（无 provider 的 rateRows）→ 视为不兼容，删除 rollup 让其重建
     （幂等；或做一次迁移：旧行 provider=''）。
   - `isRollupFile` 校验同步；selfcheck-rebuild.ts 覆盖"旧格式→重建"。
**验收**：
- 重启后首次 overview 无旧 rollup 崩溃；重建后 rateRows 含 provider。
- `pnpm selfcheck` 全绿（尤其 rollup rebuild 用例）。

### Phase 3 —— API 与前端展示（双桶 + 新维度 UI）
**改动文件**：`src/types.ts`、`src/routes.ts`、`src/index.ts`、`src/by-provider.ts`、
`src/client/LedgerOverlay.tsx`、`QuotaPanel.tsx`、`PricingPanel.tsx`、`styles.ts`
1. overview/usage wire 增加 `spend`/`subscriptionValue`；hero 与各列表分开显示。
2. Provider tab / by-provider 消费双维表（组内金额与总览一致）。
3. 统计口径 tab 文案。
4. 价格表 tab：provider 维度查看 + 来源标记（先可看；编辑能力按 Phase 4）。
**验收**：浮窗可见"实际支出 ¥X · 订阅价值 ¥Y"两行；Provider tab 金额与总览一致；
截图/人工点检 pass。

### Phase 4 —— 价格表编辑（写回 provider 手工覆盖）
1. host：新写回路由保存**provider 手工覆盖**到数据目录 `provider-pricing.json`
   （不同于 cloud 同步文件 `provider-pricing.ccsa.json`；或统一为手工层合并文件，
   与现有 `pricing.json`(model flat) 分开命名，如 `provider.json`）。
2. 手工条目支持：给 (provider, model) 设 segments 价 / 设 inheritBase / 设 ¥0 /
   删除覆盖回云端。
3. PricingPanel 完整编辑交互（provider 分组 + 来源标注 + 新增模型串 + 保存）。
**验收**：手工设一个中转真实价 → 保存 → overview 与 Provider tab 立即按新价重算
历史；删除覆盖回官方价。此阶段可选 UI 快照自检。

## 6. 建议的数据结构（供实现参考）

```ts
// types.ts 增补
export interface ProviderEntry {
  billing?: 'metered' | 'subscription'
  inheritBase?: string                 // 跟随基准价某 modelId（含规则链）
  segments?: Array<{ from?: number; to?: number; rate: ModelPricing; note?: string }>
  placeholder?: boolean
  note?: string
}
export type ProviderPricingTable = Record<string, Record<string, ProviderEntry>>
// 注意两层键：providers[provider][model]

export interface CostedModelRow extends UsageModelRow { cost: number; spend: number; subscriptionValue: number }
export interface CostedSummary extends TokenSummary {
  totalCost: number      // 兼容保留（= spend + subscriptionValue，或由 UI 口径决定）
  spend: number          // 实际支出（metered）
  subscriptionValue: number
  pricing: PricingTable
  providerPricing?: ProviderPricingTable
}
export interface UsageRateRow { day: string; model: string; provider?: string; rate: RateKey; totals: UsageTotals }
```

```ts
// pricing.ts 新签名（供 smoke/selfcheck 直接测）
export function resolvePriced(
  base: PricingTable,
  providers: ProviderPricingTable,
  provider: string | undefined,
  model: string,
  timeMs: number,
  contextTokens: number,
): { prices: ModelPricing; key: RateKey; billing: 'metered' | 'subscription' | undefined; source: string }
```

## 7. 兼容与风险

- **手工 pricing.json**（模型全局 flat 覆盖）语义保留；provider 覆盖优先级高于它。
- 旧 rollup 无 provider → 按 §5 Phase 2 处理（版本字段 + 重建），不要静默
  误合并。
- **数据目录写者唯一**约束不变：新 provider 手工文件也在同一目录、同一进程内写。
- provider 层 cloud 同步失败 → 只降级为"无 provider 覆盖"（沿用 model 价），
  绝不致命；日志 warn。
- `provider-pricing.ccsa.json` 也受 1MB / RMB 校验保护。
- 旧 client bundle 与旧 host 混跑 → wire 增加新字段是**增量**的，旧 client 忽略
  即可；避免重命名旧字段（totalCost 保留）。
- 订阅价值不是现金——**UI 必须写明**，且不能在"支出"标题下展示。

## 8. 验证与交付清单

- `pnpm smoke` / `pnpm selfcheck` 新增用例见各 Phase 验收。
- 真实数据只读验证：`~/.dsh/tokbook` 上打开浮窗核对：deepseek-official 与
  opencode-go 同模型金额归属正确、commandcode 前缀串不再是 ¥0（按官方折算价值）、
  中转占位可编辑、未知串默认 ¥0 可编辑。
- 文档：README「Cost」段 + 统计口径 tab 更新为双桶口径；本计划收尾后归档到
  DESIGN.md。

## 9. 明确非目标（本期不做）

- 不做多账户/额度自动扣减的真实账单核对（订阅真实现金=订阅费本身，不在 token 账本）。
- 不把订阅价值混入"已花费"数字。
- 不做云端 provider 层的社区化维护（镜像仓库已负责；tokbook 只消费）。
