# dsh-tokbook

> **Doc meta** · role: entry · language: zh-CN · status: current · last-reviewed: 2026-09-17 · supersedes: —

DeepSeek Harness(DSH)的**跨会话 token 用量账本**插件。host 半区把每次通道计费模型调用折成
一行、写入按本地日持久化的 JSONL 账本,再对外提供**带成本**的聚合;browser 半区从**侧边栏
footer 按钮**(`sidebar.footer.action`)弹出**浮窗**(`shell.overlay`),内含五个 tab:
**用量总览**(今日 + 词元构成 + 近 14 天趋势)、**用量明细**(窗口 × 按模型 / 按工作区 /
按通道)、**价格表**、**订阅额度**、**统计口径**。

两条贯穿全插件的原则:

- **只记真实的计费调用。** `assistant/message` 上报的 `usage`、压缩 summarize 调用、失败尝试。
  通道没上报用量的调用**仍写一行、仍计入次数**,但没有 token 可加——**未知不等于 0**,不估算。
- **金额由你自己写价。** 一份 `pricing.json`(路由 → 精确模型串 → 价段),按每条记录**自己的
  时间戳**取价,金额分「**实际支出**」与「**订阅价值**」两桶。没定价的是**价格未知**(按 ¥0 计,
  但会在界面上列出来);费率为 0 才是免费。

界面词与代码/契约的逐条对应见 [`docs/CONTRACTS.md`](docs/CONTRACTS.md) 的「术语」段;改界面长相 / 交互前读
[`docs/UI-SPEC.md`](docs/UI-SPEC.md)(只写**不变量 / 达标线 / 陷阱**三类,一页读完;可判定的那几条是自查表,
没有脚本替你守)。**规格的真源是代码**:token 与「什么时候用哪个」在 `src/client/styles/tokens.ts` 的注释里,
各个面长什么样看 `src/client/styles/**`。为什么这么定见 [`docs/DESIGN.md`](docs/DESIGN.md) §3.1;
文档树地图见 [`docs/INDEX.md`](docs/INDEX.md)。

> **术语**:本文档与界面说的**通道**就是代码与契约里的 provider —— 你从哪接入、按什么方式付费的
> 那条路,route key 即账本里记录的通道标识。做模型、定官方价的那一方叫**模型厂商**,不是通道;
> 同一家公司可以兼任两者,也可以只是通道。

数据来源沿用 [dsh-token-usage](https://github.com/LaoYueHanNi/dsh-token-usage) 参考:**逐请求行**而非逐会话
聚合,外加本机手写 ¥/M 价格表,按**每条记录自己的时间戳**取价。

## 布局

```
src/
  index.ts            host: TokenUsageBook 服务(ctx.tokbook)+ 实时 hook
  config.ts           插件配置校验 + plans 覆盖层宽松 coerce
  types.ts            共享领域类型 + 纯领域值,host 与 browser 共用
  ledger.ts           数据目录解析 + owner 标记(单写者守卫)
  usage-record.ts     逐调用记录模型 + 会话事件投影
  usage-log.ts        按日 JSONL 存储(追加/去重/refile;去重状态按数据目录共享)
  sync.ts             首次启动 + 手动历史回填(幂等)
  sync-state.ts       首次运行标记 + 持久化同步基线
  stats.ts            聚合(totals/byDay/byHour/(provider,model))+ 折叠 + 缓存
  price-format.ts     价格表时间轴的纯规则(整点生效 / 每日时段 / 星期几 / 冲突)+ 价文件共享词表(保留键 / 备注上限),与 browser 共用
  pricing.ts          唯一价格表(路由 → 模型串 → 价段)+ 两级取价(priceAt/slotAt/ratesAt/rateKeyAt)+ costOf
  pricing-view.ts     价格表 tab 的卡片装配(路由目录 ∪ 账本 ∪ 价格文件)
  route-catalog.ts    路由目录:本机设置文档(settings)× 运行时适配器注册表(ctx.llm)
  by-provider.ts      纯通道卡片聚合 + 按模型切法(用量明细 tab:摊平卡的模型行)
  workspaces.ts       纯按工作区聚合(会话 cwd ↔ 工作区注册表的读时连接 + 未归属兜底)
  quota.ts            官方额度归一化 + 内置计划身份
  quota-official.ts   key 解析 + 各通道官方用量抓取器
  quota-cache.ts      额度快照的磁盘缓存(stale-while-revalidate 的持久一侧)
  route-paths.ts      host 与 browser 共用的 HTTP 路径 / query 键词表(两半区唯一的真源)
  routes.ts           host 精确 Fetch 路由(handler / method 的真源)
  client/
    index.ts          client: apply(ctx),注册两个 slot
    contract.ts       最小 client 契约:插件被授予的 ctx/slots 面
    store.ts          按钮 ↔ 浮窗共享视图 store
    format.ts         纯展示 helper(日键、token/金额/时间格式化)
    icons.tsx         内联 SVG 图标(承 currentColor,跟随当前墨色)
    styles.ts         注入样式表入口(按 surface 拼接 styles/*.ts)
    styles/           CSS 分片(拼接顺序以 styles.ts 的 import 为准——级联是契约,不要重排)
    assets.d.ts       hero 插画的模块声明(构建期内联为 data URI)
    assets/           构建期内联的静态资源(hero-yanagi.jpg)
    FooterButton.tsx  sidebar.footer.action 触发器
    LedgerOverlay.tsx shell.overlay 浮窗外壳(五 tab + 焦点/快捷键)
    LedgerView.tsx    用量总览 tab
    ProviderPanel.tsx 用量明细 tab 外壳(窗口 + 三种切法)
    Breakdowns.tsx    用量明细的两种行清单:按模型 / 按工作区
    MethodDoc.tsx     统计口径 tab
    pricing/
      axis.ts         调价史轴纯几何:节点落位 / 估宽 / 最小间距(无 React,进 smoke)
      Timeline.tsx    调价史抽屉里的那条轴
      draft.ts        价格表纯逻辑:草稿↔wire 转换、校验、签名(未保存标记)
      editors.tsx     行原语:四档价输入、价段编辑器、模型行、路由卡片
      PricingPanel.tsx 价格表 tab 外壳:工具栏(搜索 / 筛选 / 保存状态) + 路由卡片
    quota/
      metrics.ts      订阅额度纯规则:占比/语气/口径/文案(无 React)
      QuotaCard.tsx   订阅额度卡:卡壳 + ok 主体 + 余额/无订阅面板 + gauge/骨架
      QuotaPanel.tsx  订阅额度 tab 外壳:取数 + 刷新策略 + 卡片排序
scripts/
  build-client.mjs         构建 lib/index.js + lib/client.js(懒加载 CJS)
  preview-overlay.mjs      浮窗预览台(fixture 数据)与独立查看器(--ledger,读真账本)
  smoke.ts                 聚合 + 计价 + 额度的纯逻辑冒烟测试(一条不变量一个断言)
  selfcheck-rebuild.ts     账本不变量:折叠无损重建 / refile / 跨实例去重 / 价格签名 / 重启基线
```

## 构建

```sh
pnpm install      # 安装 @deepseek-ai/cordis、react、esbuild、typescript
pnpm build        # tsc 产出 lib/types/*.d.ts,再由 esbuild 打包 host + client
pnpm selfcheck    # 账本不变量:折叠重建 / refile / 跨实例去重 / 价格签名 / 重启基线
pnpm test         # smoke(聚合 + 计价 + 额度)+ selfcheck
```

产物:`lib/index.js`(host)、`lib/client.js`(browser)、`lib/types/**/*.d.ts`(声明);external 清单见 `scripts/build-client.mjs`。

## 装进 DSH web profile

```sh
dsh plugin --profile web add .            # 或 git/tarball/路径 说明符
# 然后确认该行已挂载到 $DSH_HOME/profiles/web/cordis.patch.yml
```

```yaml
- insert:                                  # 若包不是以 bundle 安装(普通插件,不是 dsh.bundle 层)
    - id: tokbook
      name: 'dsh-tokbook'
```

(insert 形状见 [`cordis.patch.example.yml`](cordis.patch.example.yml)。)然后 `dsh web` 并刷新浏览器:重载链
活着时(见 [`docs/HMR.md`](docs/HMR.md)),`pnpm build` 会经 `cordis-plugin-hmr` 行热替换 **host** 半区;
browser 刷新页面拾取,链没活着时硬刷新永远是兜底。

## 对着源码检出开发

`pnpm watch` 只产出 `lib/types/*.d.ts`(`tsc --watch`);要 `lib/index.js` / `lib/client.js` 请跑 `pnpm build`。

不启 DSH 也能看账本——**独立查看器**:同一个页面壳与同一份 client bundle,`/tokbook/*` 由真的 host 插件作答,只读本机账本目录:

```sh
pnpm ledger                                                 # 默认账本目录($DSH_HOME/tokbook)
node scripts/preview-overlay.mjs --ledger D:/data/tokbook     # 或指定别的目录
```

不带 `--ledger` 时同一个脚本退化成 **fixture 预览台**,用来看 UI 的各个状态与空态。

## 它怎么记 token

host 监听持久化 `session/event` 流,把每次通道计费模型调用折成一行 JSONL 写进数据目录(默认
`$DSH_HOME/tokbook/`,可用 `path` 配置)。**事件 → 行的逐条投影在 `src/usage-record.ts`**:

- **用量未知 ≠ 0。** 通道没上报 `usage` 的计费调用(中途取消的请求、没回报用量的 summarize)
  **仍写一行、仍计入请求次数**,但四个 token 桶一个都不加,也不按 0 词元冒充。
- **新鲜度不靠读路径等。** 打开浮窗那次读只做**廉价探测**(列会话 + 比对变更签名);要折叠时才把
  **权威 walk 排到后台**并按 15 s 节流——账本最多晚一个节流窗口,要立刻全量走一遍用**重新扫描**。

### 一个数据目录,一个写入进程

账本、折叠、解析缓存与 refile 都假设**单个 host 进程**写给定数据目录:启动写 `owner.json` 标记
(pid + 启动时间),**检测到存活的异进程已占用时告警**(陈旧标记静默接管)。第二个 host 请指向
自己的 `path`(见 [配置](#配置));去重与热重载边界见 [`docs/HMR.md`](docs/HMR.md)。

## 成本与价格表

每条记录按**它自己的时间戳**计价,分**两级**:先取该 (通道路由, 精确模型串)「最后一段 `from ≤ 该时刻`」
的价,再在该段内按记录**本地时间**取生效的**峰谷时段**(没被时段覆盖的时间按该段**全天价**)。于是
**一次改价会重算全部历史金额**;一条 (路由, 模型) 没有价段、或记录落在所有价段之外 → **价格未知**(¥0)
——**托底价**(没有生效时刻的那一段)填上之后,这条模型的全部历史就都有了价。

金额拆成两个桶,浮窗分开显示、绝不混为单一「支出」:**实际支出**(`spend`)= `metered` 路由的
真金白银;**订阅价值**(`subscriptionValue`)= `subscription` 路由按你写的价折算的「省了多少」,
**不是现金**。计费性质是**通道路由**属性(价表 `$billing` 的一条),省略按 `metered`。

价格**全部由你自己写**,只有一份文件 `pricing.json`(默认 `$DSH_HOME/tokbook/`):路由 → 精确模型串 → **价段
数组**(`from` 生效时刻 + 四档 ¥/M 价 + 可选 `slots` 峰谷时段)。字段与校验的真源是 `src/types.ts`
与 `src/pricing.ts` 的 `parsePriceInput`(写入 handler 只做传输);畸形文件只把受影响的 (路由, 模型) 降级为价格未知(¥0)。

**价格表 tab** 里,模型行右侧那四个数字是**只读**的「此刻计费所用的价」(含正在生效的峰谷时段);
点这一行展开:第一张固定是**托底价**(没有生效时间,没被调价史覆盖的时间都按它算),往下的每一段
从某个时刻起生效。规则见 [`docs/CONTRACTS.md`](docs/CONTRACTS.md) §2 与 **D-039**,其余交互
(自动保存 / 搜索 / 徽章语义)见 [`docs/UI-SPEC.md`](docs/UI-SPEC.md) 与 `src/client/pricing/`——真源是代码。

## 配置

```yml
plugins:
  tokbook:                                   # 逐键类型与校验见 src/types.ts(TokBookConfig)
    path: D:/data/tokbook                    # 默认: $DSH_HOME/tokbook(或 ~/.dsh/tokbook)
    recordCompaction: true                   # 默认 true——把压缩 summarize 调用也记成一行
    plans: { opencode-go: { enabled: false } }   # 按通道路由键控的额度计划(见下节)
```

### 官方账户用量(订阅额度 tab)

这个 tab **用你的 key 从通道自己的账户 API 拉账户级订阅用量**——所以它反映共享该订阅的*所有*工具 /
设备,本地 token 账本做不到。目前覆盖 Command Code 与 OpenCode Go 两个内置计划。

- **无 key → `unconfigured` 卡;拉取失败 → `error` 卡**,两者都**绝不回退到本地估算**;**browser 从不持有
  key**。逐通道端点与取数策略见 `src/quota-official.ts`、套餐失效判定见 `src/quota.ts`;界面结构见 [`docs/UI-SPEC.md`](docs/UI-SPEC.md)。

## 状态

五个 tab 都已落地(**界面规格与实测依据**见 DESIGN §3.1 / §4)。剩余缺口:

- 额度计划每个通道路由只收一个 API key(尚无多账户轮换)。
- 云端价格镜像(参考价表 / 厂商分组 / 包装路由别名)已整体移除,后期作为独立任务重做——
  留档与理由见 [`docs/DECISIONS.md`](docs/DECISIONS.md) D-011。
