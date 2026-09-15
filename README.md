# dsh-tokbook

> **Doc meta** · role: entry · language: zh-CN · status: current · last-reviewed: 2026-09-15 · supersedes: —

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

界面词与代码/契约的逐条对应见 [`docs/CONTRACTS.md`](docs/CONTRACTS.md) 的「术语」段;改界面长相/
交互前对照的取值与禁令见 [`docs/UI-SPEC.md`](docs/UI-SPEC.md),每个 tab 的界面规格与量出来的
依据见 [`docs/DESIGN.md`](docs/DESIGN.md)。文档树的地图(每份文件的
role / status / 何时读)见 [`docs/INDEX.md`](docs/INDEX.md);必须与代码一致的 host 契约由
`pnpm selfcheck` 强制同步。

> **术语**:本文档与界面说的**通道**就是代码与契约里的 provider —— 你从哪接入、按什么方式付费的
> 那条路,route key 即账本里记录的通道标识。做模型、定官方价的那一方叫**模型厂商**,不是通道;
> 同一家公司可以兼任两者,也可以只是通道。

数据模型沿用 [dsh-token-usage](https://github.com/LaoYueHanNi/dsh-token-usage) 参考:逐请求行
而非逐会话聚合,外加本机手写 ¥/M 价格表(路由 → 精确模型串 → 价段:生效时刻 + 全天价 + 峰谷时段)。

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
  price-format.ts     价格表时间轴的纯规则(整点生效 / 每日时段 / 星期几 / 冲突),与 browser 共用
  pricing.ts          唯一价格表(路由 → 模型串 → 价段)+ 两级取价(priceAt/slotAt/ratesAt/rateKeyAt)+ costOf
  pricing-view.ts     价格表 tab 的卡片装配(路由目录 ∪ 账本 ∪ 价格文件)
  route-catalog.ts    路由目录:本机设置文档(settings)× 运行时适配器注册表(ctx.llm)
  by-provider.ts      纯通道卡片聚合 + 按模型切法(用量明细 tab:摊平卡的模型行)
  workspaces.ts       纯按工作区聚合(会话 cwd ↔ 工作区注册表的读时连接 + 未归属兜底)
  quota.ts            官方额度归一化 + 内置计划身份
  quota-official.ts   key 解析 + 各通道官方用量抓取器
  routes.ts           host 精确 Fetch 路由(见 CONTRACTS · Host 路由)
  client/
    index.ts          client: apply(ctx),注册两个 slot
    contract.ts       最小 client 契约:插件被授予的 ctx/slots 面
    store.ts          按钮 ↔ 浮窗共享视图 store
    format.ts         纯展示 helper(日键、token/金额/时间格式化)
    styles.ts         注入样式表入口(按 surface 拼接 styles/*.ts)
    styles/           CSS 分片:tokens/footer/overlay/ledger/method/provider/quota/pricing/shared
    FooterButton.tsx  sidebar.footer.action 触发器
    LedgerOverlay.tsx shell.overlay 浮窗外壳(五 tab + 焦点/快捷键)
    LedgerView.tsx    用量总览 tab
    ProviderPanel.tsx 用量明细 tab 外壳(窗口 + 三种切法)
    Breakdowns.tsx    用量明细的两种行清单:按模型 / 按工作区
    MethodDoc.tsx     统计口径 tab
    pricing/
      draft.ts        价格表纯逻辑:草稿↔wire 转换、校验、签名(未保存标记)
      editors.tsx     行原语:四档价输入、价段编辑器、模型行、路由卡片
      PricingPanel.tsx 价格表 tab 外壳:工具栏 + 路由卡片 + 暂存保存条
    quota/
      metrics.ts      订阅额度纯规则:占比/语气/口径/文案(无 React)
      QuotaCard.tsx   订阅额度卡:卡壳 + ok 主体 + 余额/无订阅面板 + gauge/骨架
      QuotaPanel.tsx  订阅额度 tab 外壳:取数 + 刷新策略 + 卡片排序
scripts/
  build-client.mjs         构建 lib/index.js + lib/client.js(懒加载 CJS)
  preview-overlay.mjs      浮窗预览台(fixture 数据)与独立查看器(--ledger,读真账本)
  smoke.ts                 聚合 + 计价 + 额度的纯逻辑冒烟测试
  selfcheck-baseline.ts    重启/同步进度语义自检
  selfcheck-readpath.ts    读路径不被权威同步拖住(不等 walk、节流、冷账本例外)自检
  selfcheck-rebuild.ts     折叠重建 / refile / 跨实例去重自检
  selfcheck-docs.ts        文档自检:CONTRACTS 路由 ↔ 代码、INDEX 链接、Doc meta
```

## 构建

```sh
pnpm install      # 安装 @deepseek-ai/cordis、react、esbuild、typescript
pnpm build        # tsc 产出 lib/types/*.d.ts,再由 esbuild 打包 host + client
pnpm smoke        # 聚合 + 计价 + 额度数学的纯逻辑冒烟测试
pnpm selfcheck    # 重启/基线 + 折叠重建/refile/去重不变量自检(含 docs)
pnpm test         # smoke + selfcheck
```

产物:

- `lib/index.js` — host 半区(node ESM,bare imports 保持 external)
- `lib/client.js` — browser 半区,懒加载 CJS factory:
  `window.__ModuleLoader__.load({ id, factory: (require) => { ... } })`
- `lib/types/**/*.d.ts` — 声明

client bundle 把 DSH 基线模块(`react`、`react-dom`、cordis、`dsh-client-store`、
`dsh-client-ui-slots`、`dsh-client-ui-primitives`)保持 external——清单与「随 DSH 升级同步」
的提醒在 `scripts/build-client.mjs` 的 `BASELINE_EXTERNALS`。

## 装进 DSH web profile

```sh
dsh plugin --profile web add .            # 或 git/tarball/路径 说明符
# 然后确认该行已挂载到 $DSH_HOME/profiles/web/cordis.patch.yml
```

若包不是以 bundle 安装(它是普通插件,不是 `dsh.bundle` 层),给 profile patch 加一行
insert(见 [`cordis.patch.example.yml`](cordis.patch.example.yml)):

```yaml
- insert:
    - id: tokbook
      name: 'dsh-tokbook'
```

然后 `dsh web` 并刷新浏览器。开发重载链活着时(见
[`docs/HMR.md`](docs/HMR.md)),`pnpm build` 会经 profile 里启用的 `cordis-plugin-hmr`
行热替换 **host** 半区(unload → re-import → re-apply)。**browser** 半区刷新页面即可
拾取(挂载的 `client-hmr` 链也可能在约 500ms 内免刷新替换,但那是加分项、不是保证)。
当链在构建期间没活着时,硬刷新(`Cmd/Ctrl+Shift+R`)永远是可靠兜底。

## 对着源码检出开发

```sh
pnpm watch                                # tsc --watch:只产出 lib/types/*.d.ts ——
                                          # 要 lib/index.js / lib/client.js 请跑 pnpm build
dsh web --patch /abs/path/to/tokbook/dev/cordis.yml   # 仅 host 半区
```

> `--patch` overlay 只加载 host 半区(模块解析够不到包级 client 声明);要跑 browser
> 半区,请按上文装进 profile。

不启 DSH 也能看这份账本——**独立查看器**:同一个页面壳与同一份 client bundle,但
`/tokbook/*` 由**真的 host 插件**作答(`lib/index.js` 挂在本进程的 cordis 根 context 上,
配一个 `webServer` shim),直接读本机账本目录:

```sh
pnpm ledger                                                # 默认账本目录($DSH_HOME/tokbook)
node scripts/preview-overlay.mjs --ledger D:/data/tokbook    # 或指定别的目录
```

脚本叫 `ledger` 而不是 `view`:`pnpm view` 是 pnpm 自己的内建命令(=`info`),会被它截走。

它**只读**:不接 `sessionPersistence`,所以只看已入账的历史——「重新扫描」回报 skipped,
不摄取新会话。DSH 的 settings / llm / credentials 缝缺席时按缺省降级(通道路由显示路由键、
订阅额度显示「未配置 API key」)。不带 `--ledger` 时,同一个脚本仍是 fixture 预览台,
用来看 UI 的各个状态与空态。

## 它怎么记 token

host 监听持久化 `session/event` 流,把每次通道计费模型调用折成一行 JSONL,按本地日持久化在
`$DSH_HOME/tokbook/` 下(可用 `path` 配置;逐事件的确切投影见 CONTRACTS · 消费的会话事件):

- **`assistant/message`** — 一次成功的模型请求,带通道上报的 `usage`(输入 / 输出 / 缓存读 /
  缓存写四桶)。行 id = message id,即去重键。
- **`compaction/summary`** — 一次上下文压缩 summarize 调用(自身就是一次计费的模型调用),
  `recordCompaction` 开启时记录。
- **`turn/end`**(reason `error`)与 **`llm/retry`** — 失败尝试,计入 `failures` 维度。
- **用量未知** — 通道没上报 `usage` 的计费调用(中途取消的请求、没回报用量的 summarize)仍记
  一行、仍计入请求次数,但没有 token 可加:概览的**今日异常行**报出今天的次数(界面词是
  「N 次调用没上报用量」),金额同样按 ¥0 计并由注记说明——**不按 0 词元冒充**。

首次启动时插件回填安装前发生的历史请求(幂等、按行 id 去重);浮窗里的**重新扫描按钮**可强制
一次权威重同步。新鲜度**不靠读路径等**:打开浮窗那一次读只做一次**廉价探测**(列出会话 +
比对逐会话变更签名,签名跨重启持久化在 `sync-progress.json`),确实有工作要折叠时把**权威 walk
排到后台**、并按 15 s 节流。实时 hook 已把当前会话的行记进账本,而 walk 会把该会话的**整份日志**
重读重折叠(实测单份会话日志可达 8.6 MB 压缩 / 数万事件)——把读路径挂在它上面就是「打开用量明细 /
价格表要加载半天」的成因(账本本身的读只要十几到几十毫秒)。代价明说:账本可能比持久化日志晚至多
一个节流窗口;需要立刻走一遍全部会话时用**重新扫描**。

浮窗按读者拆分数据状态事实:钉住的窗口 footer 永远显示**新鲜度**(**最新记录时刻**),
只有**正在重新扫描 / 上次扫描失败**时才多一句;**管道诊断**(记录数、日文件数、数据目录)在
统计口径 tab 里,所以某个数字是 0 时原因可见。口径细节见 DESIGN §4。

### 一个数据目录,一个写入进程

账本、折叠、解析缓存与 refile 遍历都假设**单个 host 进程**写给定数据目录。启动时插件往目录写
`owner.json` 标记(pid + 启动时间),**当检测到存活的异进程已占用时告警**——崩溃进程留下的陈旧
标记会被静默接管。第二个 host 请指向自己的 `path`(见 [配置](#配置)),不要共享目录。
进程内去重与跨模块重载的边界见 CONTRACTS · 数据目录与 [`docs/HMR.md`](docs/HMR.md) §4。

## 成本与价格表

每条记录按**它自己的时间戳**计价,分**两级**:先取价格表里该 (通道路由, 精确模型串) 的
「最后一段 `from ≤ 该时刻`」的价,再在该段内按记录**本地时间**取生效的**峰谷时段**;没被任何
时段覆盖的时间按该段的**全天价**算。早于最早一段、或这条 (路由, 模型) 根本没有价段 →
**价格未知**(¥0)。所以**一次改价会重算全部历史金额**,而账本与聚合都不需要重建。

金额拆成两个桶,浮窗分开显示、绝不混为单一「支出」:**实际支出**(`spend`)= `metered` 路由的
真金白银;**订阅价值**(`subscriptionValue`)= `subscription` 路由按你写的价折算的「省了多少」,
**不是现金**。计费性质是**通道路由**属性(`$billing` 的一条),省略按 `metered`。

价格**全部由你自己写**,只有一份文件 `pricing.json`:路由 → 精确模型串 → **价段数组**:

```json
{
  "$billing": { "opencode-go": "subscription" },
  "deepseek-official": {
    "deepseek-v4-flash": [
      { "from": "2026-08-01", "inputPerMillion": 1.5, "outputPerMillion": 4.5, "cacheReadPerMillion": 0.05 },
      {
        "from": "2026-09-10T12:00",
        "inputPerMillion": 1, "outputPerMillion": 4, "cacheReadPerMillion": 0.02,
        "note": "V4.1 Flash 上线；工作日高峰翻倍",
        "slots": [
          { "days": "weekdays", "start": 9, "end": 12, "inputPerMillion": 2, "outputPerMillion": 8, "cacheReadPerMillion": 0.04 },
          { "days": "weekdays", "start": 14, "end": 18, "inputPerMillion": 2, "outputPerMillion": 8, "cacheReadPerMillion": 0.04 }
        ]
      }
    ]
  }
}
```

写这个文件时要知道的几件事(字段级规则与校验见 CONTRACTS · Host 路由的
`PUT /tokbook/pricing` 一段):

- **四档价**:`inputPerMillion` / `outputPerMillion` / `cacheReadPerMillion` /
  `cacheWritePerMillion`(¥/百万词元);缓存两档省略 = 按输入价。
- **生效时刻** `from`:本地日期 `YYYY-MM-DD`(当天 0 点)或**整点** `YYYY-MM-DDTHH:00`;
  省略(或空)= **最早一段**(自始生效,界面上写「无起点」)。分钟不是这条时间轴的单位。
- **峰谷时段** `slots`:每项 = `days`(`daily` / `weekdays` / `weekends`,省略 = `daily`)+
  `start` / `end`(整点,**左闭右开**,`24` = 当天结束)+ 它要覆盖的档位价(任意子集,至少写
  一档;**没写的档位沿用该段全天价**)。**不要求铺满 24 小时**——没被覆盖的时间就是全天价,
  所以普通调价只写全天价,峰谷只加高峰那几行。

浮窗的**价格表 tab** 以本机配置为核心编排:**一条通道路由一张卡片**(卡片集合 = 路由目录
〔本机设置里的路由 ∪ 运行中的适配器注册表〕∪ 账本 ∪ 价格文件),卡内每个模型一行,四档价是
列头对齐的固定列。行内这四格永远是**该段的全天价**(标着 `00:00–24:00`),峰谷的分档价在行尾 ▸
的**调价史**抽屉里——同一张表不该在不同钟点显示不同数字;抽屉顶上还有这条模型的**价段时间轴**。
需要多段价、要改生效时间或备注时点开它。

几个界面约定:

- **点一下就编辑**:单元格平时是文本,点一下(或 Tab 过去)就地变成输入框;宽度不够时身份以
  省略号收尾,行内徽章(仅账本 / 价格未知 / 峰谷 N 段 / 未生效 / 未保存)一律不截断。
- **每行的身份只显示一个**:有**显示名**就印它,没有(仅账本行、只写在价格文件里的串)就印
  **精确模型串**——精确串仍是账本的计费键,所以它没有消失:悬停身份可看全文,四档价单元格的
  读屏名也用它。
- **改完就存,没有保存按钮**:任何改动停止输入约 0.6 秒后整表替换 `pricing.json`;工具栏右端只
  报状态(`保存中…` / `已保存 <时刻>` / `未保存:<原因>` / `保存失败:<原因>`)。切 tab 或关掉
  浮窗时**会先落盘**;没填完的新价段是**草稿**(不参与校验、保存时丢掉),只有填了一半才就地报错。
  Ctrl/Cmd+S 可立刻冲刷一次待写改动(平时不需要按)。
- **搜索**同时匹配模型名称、精确模型串、通道路由键与通道名称。
- **「—」= 还没写价**(暂按 ¥0 计,**不是免费**);没写价的行带一枚「价格未知」芯片,与概览、
  契约同一个词。费率为 0(如免费测试期的接口)是已知价,照常显示 ¥0。

卡片头另有一枚**「按量 / 订阅」**开关,写的就是 `$billing`,同样自动保存。

默认位置 `$DSH_HOME/tokbook/`;畸形文件只会把受影响的 (路由, 模型) 降级为价格未知(¥0),不会
弄坏页面。

## 配置

```yml
plugins:
  tokbook:
    path: D:/data/tokbook        # 默认: $DSH_HOME/tokbook(或 ~/.dsh/tokbook)
    recordCompaction: true       # 默认: true——记录压缩调用
    # 按通道路由键控的额度计划。opencode-go 与 commandcode 内置:该 tab 抓取每个
    # 订阅的官方账户用量(绝非本地估算——订阅 key 跨工具共享)。
    # 计划默认被尝试,除非 enabled:false。API key 从 DSH 凭据服务按通道的引用名
    # 解析(OPENCODE_GO_API_KEY / COMMANDCODE_API_KEY——与通道的 Models/settings
    # 页面存 key 时写的引用一致),或从下面的显式字面量解析。找不到 key → "unconfigured" 卡。
    plans:
      opencode-go:
        # apiKey: user_...               # 字面 key(优先;可选)
        enabled: false                   # 关闭这个内置计划
      commandcode:
        # apiKeyEnv: COMMANDCODE_API_KEY # 凭据引用(通道默认)
        # enabled: false                  # 关闭这个内置计划
```

### 官方账户用量(订阅额度 tab)

这个 tab 展示**账户级订阅用量,用你的 key 从通道自己的账户 API 拉取**——所以它反映共享该订阅
的*所有*工具/设备,本地 token 账本做不到。目前覆盖两个内置计划:**Command Code**(以 USD 计的
窗口 `used/cap/exceeded/resetAt` + 月度积分池 + 计划)与 **OpenCode Go**(5h / 每周 / 每月窗口,
以百分比 + 重置时间呈现——该端点不报美元金额,也不报套餐身份,所以失效与否看 HTTP 语义)。

- **无 key → 带提示的 `unconfigured` 卡;拉取失败 → 带原因的 `error` 卡**;两者都不回退到本地
  估算。
- **套餐失效时卡片换主体**:账户没有生效中的订阅时,卡片隐藏窗口行、不画表盘,改为以**余额**
  领读并列出三个来源(月额度 / 已购 / 赠送);这类卡**不再自动刷新**(值不随分钟变化),但手动
  刷新与「打开 tab 即按新鲜度强刷一次」照旧。**失效的卡沉到最后**,让 tab 先展示还能花的套餐。
- 某张卡的数据一到就渲染,慢 / 失败的通道不会阻塞其余卡;browser 从不持有 key。逐通道端点、
  门的判定与取数策略见 CONTRACTS · Host 路由;界面结构见 DESIGN §4。
- 侧边栏按钮上的**告急色点**读同一个路由列表载荷里的 `alert`:只看持久化最近已知快照(任一
  受订阅窗口约束的 `ok` 卡 `usagePercent ≥ 90` 或已 `exceeded`),**绝不为此打官方 API**——它
  说的是「上次看时已经紧了」,不是实时配额。

## 状态

五个 tab 都已落地(**界面规格与实测依据**见 DESIGN §3.1 / §4)。剩余缺口:

- 额度计划每个通道路由只收一个 API key(尚无多账户轮换)。
- 云端价格镜像(参考价表 / 厂商分组 / 包装路由别名)已整体移除,后期作为独立任务重做——
  留档与理由见 [`docs/DECISIONS.md`](docs/DECISIONS.md) D-011。
