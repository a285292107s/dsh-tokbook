# dsh-tokbook

> **Doc meta** · role: entry · language: zh-CN · status: current · last-reviewed: 2026-09-11 · supersedes: —

DeepSeek Harness(DSH)的**跨会话 token 用量账本**插件。host 半区把每次通道计费
模型调用——`assistant/message` 通道的 `usage`(外加压缩 summarize 调用与失败尝试)
——记成一行、写入持久化的按日 JSONL 账本,再对外提供**带成本**的聚合总览。browser
半区通过**侧边栏 footer 按钮**(route A:`sidebar.footer.action`)把它展示出来,按钮弹出
**浮窗**(`shell.overlay`),内含汇总卡(**今日词元** + 较近7天日均涨跌参照 + 今日成本)、
今日词元构成(四桶 + 缓存命中率)、按日 token 趋势图、按模型拆分
(含成本)、**按通道的 tab**(每个通道路由一张卡,卡头用本机配置里的显示名
命名、路由键作次要小字,并标出该通道的计费性质「按量 / 订阅」;内含该路由下各模型的
token/成本,可切换 今日 / 昨天 / 近7天 / 近30天 窗口)、**价格表 tab**(每个路由键一张卡,
四档价 + 生效日期全部由你自己写),以及**订阅额度 tab**
——展示每个已配置订阅的**官方账户用量**(Command Code / OpenCode Go),用你的 key 从
通道自家 API 拉取。

> **术语**:本文档与浮窗界面说的**通道**就是代码与契约里的 provider —— 你从哪接入、按什么
> 方式付费的那条路,route key 即账本里记录的通道标识。做模型、定官方价的那一方叫**模型
> 厂商**,不是通道;同一家公司可以兼任两者,也可以只是通道。
> 界面词与代码/契约的逐条对应(通道用量 / 价段 / 计费性质 / 实际支出 / 订阅价值 /
> 价格未知…)见 [`docs/CONTRACTS.md`](docs/CONTRACTS.md) 的「术语」段。

文档树的地图见 [`docs/INDEX.md`](docs/INDEX.md)(每份文件的 role / status / 何时读);
必须与代码一致的 host 契约在 [`docs/CONTRACTS.md`](docs/CONTRACTS.md),由
`pnpm selfcheck` 强制同步。

设计推理、技术选型与两种侧边栏方案,见 [`docs/DESIGN.md`](docs/DESIGN.md)。数据模型
沿用 [dsh-token-usage](https://github.com/LaoYueHanNi/dsh-token-usage) 参考:逐请求行
而非逐会话聚合,外加本机手写 ¥/M 价格表(路由 → 精确模型串 → 价段 + 生效日期)。

## 布局

```
src/
  index.ts            host: TokenUsageBook 服务(ctx.tokbook)+ 实时 hook
  config.ts           插件配置校验 + plans 覆盖层宽松 coerce
  types.ts            共享领域类型(仅类型)
  ledger.ts           数据目录解析 + owner 标记(单写者守卫)
  usage-record.ts     逐调用记录模型 + 会话事件投影
  usage-log.ts        按日 JSONL 存储(追加/去重/refile;去重状态按数据目录在
                      实例/重启间共享)
  sync.ts             首次启动 + 手动历史回填(幂等)
  sync-state.ts       首次运行标记 + 持久化同步基线
  stats.ts            聚合(totals/byDay/byHour/(provider,model)/recent)+ 折叠 + 缓存
  pricing.ts          唯一价格表(路由 → 模型串 → 价段)+ 计价(priceAt/rateKeyAt)+ costOf
  route-catalog.ts    路由目录:本机设置文档(settings)× 运行时适配器注册表(ctx.llm)
  by-provider.ts      纯通道卡片聚合(通道用量 tab)
  quota.ts            官方额度归一化 + 内置计划身份
  quota-official.ts   key 解析 + 各通道官方用量抓取器
  routes.ts           host 精确 Fetch 路由 /tokbook/overview、/tokbook/rescan、
                      /tokbook/usage?range=…、/tokbook/quota、/tokbook/pricing
  client/
    index.ts          client: apply(ctx),注册两个 slot
    contract.ts       最小 client ctx/slots 类型
    store.ts          按钮 ↔ 浮窗共享视图 store
    format.ts         纯展示 helper(日键、token/金额/时间格式化)
    styles.ts         注入样式表入口(按 surface 拼接 styles/*.ts)
    styles/           CSS 分片:tokens/footer/overlay/ledger/method/provider/quota/pricing/shared
    FooterButton.tsx  sidebar.footer.action 触发器
    QuotaPanel.tsx    订阅额度 tab(官方用量卡)
    LedgerOverlay.tsx shell.overlay 浮窗外壳(五 tab + 焦点/快捷键)
    LedgerView.tsx    用量总览 tab(今日英雄卡 + 构成 + 趋势 + 按模型 + 最近)
    ProviderPanel.tsx 通道用量 tab
    MethodDoc.tsx     统计口径 tab
    pricing/
      draft.ts        价格表纯逻辑:草稿↔wire 转换、校验、签名(未保存标记)
      editors.tsx     行原语:四档价输入、价段编辑器、模型行、路由卡片
      PricingPanel.tsx 价格表 tab 外壳:工具栏 + 路由卡片 + 暂存保存条
scripts/
  build-client.mjs         构建 lib/index.js + lib/client.js(懒加载 CJS)
  smoke.ts                 聚合 + 计价 + 额度的纯逻辑冒烟测试
  selfcheck-baseline.ts    重启/同步进度语义自检
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

client bundle 把 DSH 基线(`react`、`react-dom`、cordis、`dsh-client-store`、
`dsh-client-ui-slots`、`dsh-client-ui-primitives`)保持 external;请保持
`scripts/build-client.mjs` 里的 `BASELINE_EXTERNALS` 与 DSH 的
`packages/client/web/src/platform.ts` 同步。

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

## 它怎么记 token

host 监听持久化 `session/event` 流,把每次通道计费模型调用折叠成一行 JSONL,按
本地日持久化在 `$DSH_HOME/tokbook/` 下(可用 `path` 配置):

- **`assistant/message`** — 一次成功的模型请求,带通道上报的 `usage`
  (`inputTokens` / `outputTokens` / `cacheReadTokens` / `cacheWriteTokens`)。行 id =
  message id(去重键)。
- **`compaction/summary`** — 一次上下文压缩 summarize 调用(自身就是一次计费的模型
  调用),`recordCompaction` 开启时记录。
- **`turn/end`**(reason `error`)与 **`llm/retry`** — 失败尝试,计入 `failures` 维度
  (无 token,所以永远不会虚增 token 总量)。

首次启动时插件回填安装前发生的历史请求(幂等、按行 id 去重);浮窗里的**重新扫描按钮**
可强制一次权威重同步。读路径也会用**廉价的按需探测**自我纠正:每次 overview 读取先问
`sessionPersistence.listSnapshots()` 要逐会话元数据(不透明 `revision` token;相等 =
未变;裸头 `list()` 也可作回退),只有当持久化日志里有账本尚未持有的工作——新/变过的
会话,或从未折叠过的会话——才经 `inspect(id)` 重同步(request-id 去重使其幂等)。

该探测**跨重启增量**:每次成功同步后,逐会话变更 token 会被持久化
(`sync-progress.json`,位于数据目录),所以重启后的进程继承上一次运行的签名,而不是
首次打开时走一遍每个会话日志。只有进程宕机期间日志真的变过(或全新)的会话才会被重新
走读;什么都没变时,首次打开只花一次元数据列出的代价。基线严格在同步后写入,读不到的
会话被排除在外,所以兜底全量走读(基线缺失/撕裂、首次安装)会幂等重跑并重写一份新基线。
因此即使实时 hook 漏了某事件,浮窗也反映真实持久化用量,且没变化时几乎零成本;实时
hook 只是让账本在两次打开之间保持最新的快路径。某一份读不到的会话日志会被跳过并计数,
绝不致命。

浮窗按读者拆分数据状态事实:钉住的窗口 footer 永远显示**新鲜度状态**(重同步状态 ·
最新记录时间),任意滚动位置可见、账本为空时也在;**管道诊断**(记录数、日文件数、数据
目录)放在 统计口径 tab 的 数据文件状态 一节——所以当某个数字是 0 时,原因可见(到底是
否在捕获记录),管道事实不会挤占用量内容的滚动区。

### 一个数据目录,一个写入进程

账本、折叠、解析缓存与 refile 遍历都假设**单个 host 进程**写给定数据目录(风险在于
fold/缓存竞争;JSONL 追加本身去重安全)。启动时插件往目录写 `owner.json` 标记
(pid + 启动时间),**当检测到存活的异进程已占用时告警**——崩溃进程留下的陈旧标记会被
静默接管。第二个 host 请指向自己的 `path`(见 [配置](#配置)),不要共享目录。

`UsageLog` 的进程内去重/追加状态按**数据目录**键控,而不是按插件实例,所以每个共享
*同一份已加载模块拷贝*的实例(依赖 dispose → 自动重载、服务隔离下的第二个实例、或带
排队追加在途的重叠实例)共享同一个去重集与同一条串行追加队列——同一进程内重叠写者
永远不会对同一 request id 双写。

这种共享**不**跨越模块级 HMR 重载(cordis-plugin-hmr 会 re-import 插件入口,新模块
从头建状态表)。跨过那道边界后,去重安全在新实例首次写入前从磁盘上的行重新推导;进程
重启从空开始、做同样的事。确切范围见 [`docs/HMR.md`](docs/HMR.md) §4。

## 成本

每条记录按**它自己的时间戳**与本机那份价格表计价:取价格表里 **该 (通道路由, 精确模型串)**
的最后一段「生效日期 ≤ 该时刻」的价。早于最早一段、或这条 (路由, 模型) 根本没有价段 → **价格
未知**(¥0)。所以一次改价会重算全部历史金额,而账本与聚合都不需要重建。

计费性质是**通道路由**属性(`$billing` 的一条),省略按 `metered`。

金额拆成两个桶,浮窗分开显示、绝不混为单一"支出":

- **实际支出**(`spend`)——`billing: 'metered'` 路由(官方按量/中转/未知串)的真金白银;
- **订阅价值**(`subscriptionValue`)——`billing: 'subscription'` 路由(如 OpenCode Go /
  Command Code 订阅)按你写的价折算的"省了多少",**不是现金**。

价格**全部由你自己写**,只有一份文件 `pricing.json`:路由 → 精确模型串 → **价段数组**。
一个价段就是四档 ¥/M 单价加一个**生效日期**;取价按记录自己的时间戳落在哪一段,所以回填一段
更早的价就会重算那段历史的金额。

```json
{
  "$billing": { "opencode-go": "subscription" },
  "deepseek-official": {
    "deepseek-v4-flash": [
      { "from": "2026-08-01", "inputPerMillion": 1.5, "outputPerMillion": 4.5, "cacheReadPerMillion": 0.15 },
      { "from": "2026-09-01", "inputPerMillion": 2, "outputPerMillion": 6 }
    ]
  }
}
```

- **四档价**:`inputPerMillion` / `outputPerMillion` / `cacheReadPerMillion` /
  `cacheWritePerMillion`(¥/百万词元);缓存两档省略 = 按输入价。
- **生效日期**:`from` 用本地日期 `YYYY-MM-DD`;省略(或空)表示**最早一段**(自始生效)。
  同一条 (路由, 模型) 里**不许有两段同一天生效**——写路径会拒绝。
- **`$billing`** 是唯一的保留键:路由 → `metered`(默认)或 `subscription`,声明这条通道的
  金额算**实际支出**还是**订阅价值**。它是**通道属性**,作用于该路由的全部历史。
- 没有价段的 (路由, 模型) 就是**价格未知**(暂按 ¥0 计,浮窗里会列出来)。

浮窗的**价格表 tab** 因此以本机配置为核心编排:**一条通道路由一张卡片**。

- **卡片从哪来**:卡片的集合是三个来源的并集——① 本机 `~/.dsh/settings.yaml` 里配置的路由
  (`llm-pi-ai.providers` 的每个键,加上直接适配器唯一的 `deepseek-official`),② **正在运行的
  适配器注册表**(所以插件在运行时铸出的路由,如包装路由,也有卡),③ 账本计费过、或价格文件里
  写过的路由(即使配置里已经删掉,它的历史金额仍然看得见、改得动)。卡片头的名字取设置里的
  `displayName`,没有就用适配器给的名字,再没有就显示路由键。
- **卡内模型**:该路由配置的 `models` 列表(profile 没列就回落到适配器自己的目录)**∪** 账本
  真正计费过的模型串——后者带「仅账本」徽章,保证历史金额永远有可定价的入口。
- **一张表,不是一堆表单**:卡里每行一个模型,四档价是**列头对齐的固定列**(等宽数字右对齐),
  价格因此能顺着列往下比。单元格平时就是文本,**点一下(或 Tab 过去)就地变成输入框**;在未定价
  的行上敲下第一个数字,就等于写下它的「最早一段」。
- **「—」= 还没写价**:图例只说一次(暂按 ¥0 计,**不是免费**);未定价的行只带一枚「未定价」
  小芯片,不再逐行重复警告。
- **调价史收在行尾 ▸**:需要多段价、要改生效日期或备注时点开——里面按段列出「生效日期 → 四档价
  → 备注」,当前生效的那段带「当前生效」标记,复制/删除在该段悬停或键盘聚焦时才出现;抽屉抬头
  印完整模型串(行内的长串会截断)。卡片头的 ▾ 收起整张卡,长列表可以折着看。
- **出错指出是哪一格**:数字不合法时那一格变红并带 `aria-invalid`,行下就地给出原因(如
  「输入价「abc」不是有效的非负数字」),工具栏右端的状态只做总述。
- **改完就存,没有保存按钮**:任何改动——四档价、生效日期、加减价段、卡片头的「按量 /
  订阅」开关——停止输入约 0.6 秒后经 `PUT /tokbook/pricing` **整表替换** `pricing.json`。
  工具栏右端只报状态:`保存中…` / `已保存 19:42:07` / `未保存:<原因>`(比如某个必填数字还空着
  ——这时文件保持上一次好的状态,你补完它自动接着存)/ `保存失败:<原因>`(带「重试」)。
  写路径严格校验(非负数字、真实日期、同一天不重复、不许未知字段)。Ctrl/Cmd+S 可立刻冲刷一次
  待写改动(平时不需要按)。改动在切换 tab 或关掉浮窗时**会先落盘**;真没写成的草稿仍会保留到
  下次打开,下一次输入就是重试——没有「放弃改动」这种回退出口,磁盘上的就是全部状态。
- **计费按量还是订阅**:卡片头有一枚「按量 / 订阅」开关,写的就是 `$billing`,同样自动保存。
- **键盘与焦点**:四档单元格就是四个真正的输入框(Tab 依次走过),折叠与开关都是带
  `aria-expanded` / `aria-pressed` 的真按钮;状态文本留在顶部工具栏里,不遮挡任何控件。

保存后下一次读取即重新计价全部历史——不动账本;派生折叠按价格文件的签名失效重建。

默认位置:`$DSH_HOME/tokbook/`。畸形文件只会把受影响的 (路由, 模型) 降级为价格未知(¥0),
不会弄坏页面。**「价格未知」= 不知道价,不是免费**;费率为 0(如免费测试期的接口、免费 deal)
是已知价,照常显示 ¥0。

> 云端价格镜像(以及它带来的参考价表、厂商分组、通道形态、包装路由别名、峰谷/分档计价)已在
> 本次重构中整体移除,后期作为独立任务重做——留档与理由见
> [`docs/DECISIONS.md`](docs/DECISIONS.md) D-011。

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

**订阅额度** tab 展示**账户级订阅用量,用你的 key 从通道自己的账户 API 拉取**——
所以它反映共享该订阅的*所有*工具/设备,本地 token 账本做不到。

- **Command Code** — 查询官方 `cmd` CLI 使用的账户端点(`/alpha/whoami`、
  `/alpha/usage/summary`、`/alpha/billing/credits`、`/alpha/billing/subscriptions`):
  以 USD 计的窗口 `used/cap/exceeded/resetAt`、月度积分池、计划 + 用量汇总。
- **OpenCode Go** — 查询官方用量端点
  (`GET https://opencode.ai/zen/go/v1/usage`):5h/每周/每月窗口,以百分比 + 重置时间
  呈现(该端点不上报美元金额,所以那张卡只显示百分比)。

无 key → 带提示的 `unconfigured` 卡;拉取失败 → 带原因的 `error` 卡;两者都不回退到
本地估算。browser 先拉已启用通道列表(`GET /tokbook/quota`——快,无网络),再独立
经 `GET /tokbook/quota?provider=<key>` 加载每张卡:**某张卡的数据一到就渲染**,慢/失败的
通道不会阻塞其余卡。该 tab 走 **stale-while-revalidate**:host 即时提供该
通道的持久化*最近已知*卡(数据目录里每通道一个 JSON 快照,每次成功拉取后
刷新),只有当那份数据超过新鲜度预算时才从通道 API 刷新——刷新就地更新数字,绝不在
空白骨架后面。内存卡额外缓存 30s,browser 从不持有 key。

## 状态 / WIRE 说明

已在本脚手架实现(见 `docs/DESIGN.md`):

- **逐请求、持久账本**:实时 `session/event` 折叠 → 按日 JSONL,按 request id 去重,带
  首次启动 + 手动历史回填。
- **多维统计**:totals、按日、按小时、按 （通道，模型）、按（日 × 模型 × 通道 × 价段）格;冻结日折叠 + 进程内存解析缓存;近期窗口。
- **成本(单表 + 双桶)**:¥/M 手工价表(`pricing.json`:路由 → 模型串 → 价段),按记录自己的
  时间戳取生效段;金额分 **实际支出**(metered)与 **订阅价值**(subscription,非现金)
  两桶;价格未知的 (路由, 模型) 浮出(标「价格未知」,不是免费)。
- **价格表 tab**:每个**通道路由一张卡**(卡头 = 配置里的显示名 + 路由键 + 「按量 / 订阅」开关
  + 模型数/已定价数/账本次数),卡内每个模型一行:来源徽章(仅账本 / 价格未知 / 未保存)、当前
  生效价(四档 + 「X 起」)、「定价 / 改价」展开它的价段编辑器(生效日期 + 四档价 + 备注,可
  复制一段做调价史)。卡片集合 = 本机设置文档 × 运行时适配器注册表 × 账本 × 价格文件(见
  [`docs/CONTRACTS.md`](docs/CONTRACTS.md))。**改完自动保存**(停止输入约 0.6 秒后整表
  `PUT /tokbook/pricing`),底部只报状态:保存中 / 已保存 / 未保存+原因 / 保存失败+重试;
  切 tab 或关窗前会先把待写改动落盘,Ctrl/Cmd+S 可立刻冲刷。保存后下次读取即重新计价全部历史。
- **Browser 半区**:侧边栏 footer 按钮 + shell overlay 浮窗,内含汇总卡(**今日词元** +
  较近7天日均涨跌参照 + 今日实际支出/订阅价值,零值的桶不占行;元数据行放
  会话/请求/失败/累计词元/累计支出)、
  今日词元构成(四桶 + 缓存命中率;缓存写入不是该账本的维度时不渲染该格)、按日趋势图、
  带金额的按 （通道，模型） 拆分、近期记录,以及
  **按通道的 tab**:每个通道路由一张卡(卡头用配置里的显示名),展示其下各模型的 token/双桶
  金额,可切换 今日 / 昨天 / 近7天 / 近30天(专用精确路由 `GET /tokbook/usage?range=…` 只读
  窗口内的日文件)。
- **订阅额度(quota)tab**:逐计划**官方账户用量**在 host 侧从各通道自家端点拉取
  (`GET /tokbook/quota`)——Command Code 走其 CLI 账户端点(窗口 + 积分 + 计划),OpenCode
  Go 走 `/zen/go/v1/usage`(百分比 + 重置)。无本地估算;无 key → `unconfigured` 提示卡。
  侧边栏按钮上的**告急色点**读同一路由列表载荷里的 `alert`(只看持久化最近已知快照,
  窗口 ≥90% 或已 exceeded;绝不为此打官方 API)。

剩余缺口 / 计划升级:

- 额度计划每个通道路由只收一个 API key(尚无多账户轮换)。
