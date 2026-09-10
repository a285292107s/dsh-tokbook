# dsh-tokbook

> **Doc meta** · role: entry · language: zh-CN · status: current · last-reviewed: 2026-09-10 · supersedes: —

DeepSeek Harness(DSH)的**跨会话 token 用量账本**插件。host 半区把每次通道计费
模型调用——`assistant/message` 通道的 `usage`(外加压缩 summarize 调用与失败尝试)
——记成一行、写入持久化的按日 JSONL 账本,再对外提供**带成本**的聚合总览。browser
半区通过**侧边栏 footer 按钮**(route A:`sidebar.footer.action`)把它展示出来,按钮弹出
**浮窗**(`shell.overlay`),内含汇总卡(**今日词元** + 较近7天日均涨跌参照 + 今日成本)、
今日词元构成(四桶 + 缓存命中率)、按日 token 趋势图、按模型拆分
(含成本)、**按通道的 tab**(每个通道路由一张卡,卡头用镜像 feed 的通道标签
命名、路由键作次要小字,并标出该通道的计费性质「按量 / 订阅 / 混合」;内含该路由下各模型的
token/成本,可切换 今日 / 昨天 / 近7天 / 近30天 窗口)、价格表 tab,以及**订阅额度 tab**
——展示每个已配置订阅的**官方账户用量**(Command Code / OpenCode Go),用你的 key 从
通道自家 API 拉取。

> **术语**:本文档与浮窗界面说的**通道**就是代码与契约里的 provider —— 你从哪接入、按什么
> 方式付费的那条路,route key 即账本里记录的通道标识。做模型、定官方价的那一方叫**模型
> 厂商**(云端参考表按它折叠分组),不是通道;同一家公司可以兼任两者,也可以只是通道。
> 界面词与代码/契约的逐条对应(通道用量 / 通道覆盖层 / 实际支出 / 订阅价值 / 跟随官方价 /
> 价格未知…)见 [`docs/CONTRACTS.md`](docs/CONTRACTS.md) 的「术语」段。

文档树的地图见 [`docs/INDEX.md`](docs/INDEX.md)(每份文件的 role / status / 何时读);
必须与代码一致的 host 契约在 [`docs/CONTRACTS.md`](docs/CONTRACTS.md),由
`pnpm selfcheck` 强制同步。

设计推理、技术选型与两种侧边栏方案,见 [`docs/DESIGN.md`](docs/DESIGN.md)。数据模型
沿用 [dsh-token-usage](https://github.com/LaoYueHanNi/dsh-token-usage) 参考:逐请求行
而非逐会话聚合,外加 ¥/M 价格表,带「时间规则 → 上下文档位 → 高峰时段」计价链。

## 布局

```
src/
  index.ts            host: TokenUsageBook 服务(ctx.tokbook)+ 实时 hook
  types.ts            共享领域类型(仅类型)
  ledger.ts           数据目录解析 + owner 标记(单写者守卫)
  usage-record.ts     逐调用记录模型 + 会话事件投影
  usage-log.ts        按日 JSONL 存储(追加/去重/refile;去重状态按数据目录在
                      实例/重启间共享)
  sync.ts             首次启动 + 手动历史回填(幂等)
  sync-state.ts       首次运行标记 + 持久化同步基线
  stats.ts            聚合(totals/byDay/byHour/(provider,model)/recent)+ 折叠 + 缓存
  pricing.ts          双维价格表(基准云镜像+手工;通道覆盖镜像+手工)、resolvePriced 链、costOf
  by-provider.ts      纯通道卡片聚合(通道用量 tab)
  quota.ts            官方额度归一化 + 内置计划身份
  quota-official.ts   key 解析 + 各通道官方用量抓取器
  routes.ts           host 精确 Fetch 路由 /tokbook/overview、/tokbook/rescan、
                      /tokbook/usage?range=…、/tokbook/quota、/tokbook/pricing、
                      /tokbook/provider-pricing
  client/
    index.ts          client: apply(ctx),注册两个 slot
    contract.ts       最小 client ctx/slots 类型
    store.ts          按钮 ↔ 浮窗共享视图 store
    styles.ts         注入样式表(DSH tokens)
    FooterButton.tsx  sidebar.footer.action 触发器
    QuotaPanel.tsx    订阅额度 tab(官方用量卡)
    LedgerOverlay.tsx shell.overlay 浮窗(带成本汇总 + 趋势 + 按模型 + 按通道
                      + 价格 + 额度 tab)
    pricing/
      draft.ts        价格表纯逻辑:草稿↔wire 转换、校验、行模型(一行 =
                      (通道, 模型串))、分组/筛选/参考价行
      editors.tsx     行原语 + 只读时间轴 + 行内编辑器(层级选择 + 高级折叠)
                      + 新增手工价/新增覆盖/同价通道表单
      PricingPanel.tsx 价格表 tab 外壳:工具栏 + 我的价格(按通道分组)+
                      参考价表 + 共享保存条(先覆盖层后模型层的两次 PUT)
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

每条记录按它自己的时间戳与 **（通道，模型） 双维**计价:先看该通道路由在
**通道覆盖层**里有没有这条精确模型串的条目——镜像 `provider-pricing.ccsa.json` + 手编
`provider-pricing.json`(手工赢)。条目两种取价方式:`inheritBase`(跟随基准价表某个 modelId
的整套规则,含调价史)或 `segments`(用户自定的时间轴分段价)。手编层还可用保留键 `$routes`
声明**同价通道**(某条路由跟随另一条的价格,一跳;路由自己的条目仍优先)——别名在读取合并时
就物化进表,所以下面这条链本身只看到 （通道，模型）。没有覆盖条目 → 回落基准价表
该 model 行。再没有 → 价格未知(¥0)。基准价内仍走 **时间规则 → 上下文档位 → 高峰时段**链,
上下文档位大小用请求的 input 侧 token 近似(input + cacheRead + cacheWrite)。

计费性质是**通道**属性:镜像里每个 `providers[]` 组自带 `billing`,下发给组内所有条目
(条目自带 `billing` 时条目赢);手工层仍按条目给 `billing`,省略按 metered。

金额拆成两个桶,浮窗分开显示、绝不混为单一"支出":

- **实际支出**(`spend`)——`billing: 'metered'` 通道(官方按量/中转/未知串)的真金白银;
- **订阅价值**(`subscriptionValue`)——`billing: 'subscription'` 通道(如 OpenCode Go /
  Command Code 订阅)按官方价折算的"省了多少",**不是现金**。

基准价表合并两个来源(启动时同步的云镜像,以及永远整表优先的手编 `pricing.json`):

```json
{ "deepseek-chat": { "inputPerMillion": 2, "outputPerMillion": 8, "cacheReadPerMillion": 0.5 } }
```

通道覆盖层的手编文件是同形的两层 `Record<provider, Record<model, 条目>>`:

```json
{ "opencode-go": { "deepseek-v4-flash": { "billing": "subscription", "inheritBase": "deepseek-v4-flash" } } }
```

浮窗的**价格表 tab** 是**一张表、一条轴**(而不是两个并列视图):每一行就是账本真正计费的
那个东西——一条**通道** + 一个**精确模型串**。这条价写在**哪一层**是**行的属性**,不是你要先
选对的地方。

- **工具栏**:搜索(模型串 / 通道路由键 / 调价与峰谷标签)、**价格未知** 快速筛选(不知价,
  暂按 ¥0 计)、镜像声明的**通道形态** chips(官方通道 / 中转转售 / 订阅套餐 / 包装路由),
  以及最右的 **参考价表 (N)**。
- **我的价格**:按通道路由分组(账本记录数降序 → 形态 → 路由键),组头 = 镜像标签 + 路由键 +
  形态芯片 + 计费芯片(实际支出 / 订阅价值 / 混合 / 价格未知)+「N 个模型 · M 条」。每行给出
  四档**当前生效价**、一枚**来源徽章**(手工价 / 手工覆盖 / 跟随官方价 / 自己填价 / 先按官方价 /
  云端 · 分时 / 云端 / 价格未知)与必要时的一句说明;生效窗口由窗口/峰谷决定时,行里另起一行
  说明(如「当前生效 · 限时5折」)。账本没按它们计费的路由(新增的 key、只写了价的串)收在
  末尾的**未计费**组里,照样可编辑。
- **改这条价**:展开行是它的**只读时间轴**;点「改这条价」就在这一行里编辑,编辑器第一项是
  **这份价写在哪一层**——`全局 · 模型层`(这条模型串的所有通道共用)或`这条通道 · 覆盖层`
  (只改这一条路由)。切到覆盖层会就地建一条手工覆盖;切回模型层则删掉它、价回落到模型层/云端
  (不会偷偷替你新增一条全局价,要新增得点「新增全局手工价」)。**模型层价是全局的**(一条串
  一份),所以被多条通道计费的串只有**一个可编辑入口**——优先给按量(实际支出)通道,其次用量
  最多的那条;其余通道行只读、标「全局价」,动作是「改全局价」跳过去。**包装路由**与**同价
  通道**跟随别的路由,整行只读、动作是「去编辑」。
- **常用在前,深水区收在「高级」**:四档单价与计费方式就地可改;模型层的**调价时段**
  (起/止日期 + 四档价,止日期留空 = 永久)与**峰谷时段**(星期 + 时段 + 四档价,也可挂在某个
  调价时段内)、覆盖层的**多段自定价时间轴**(可多段,每段起止 + 四档价 + 备注)都收在行内的
  「高级」折叠里。新增时段默认按当前价预填,星期有「工作日 / 周末 / 每天」快捷。同一模型的
  调价时段不得重叠(写路径拒绝),文件与展示都按开始时间排序。窄屏下每行堆叠,四档价各自带标签。
- **参考价表**:镜像 feed 的完整字典(~185 行,只读、按 `family` 厂商折叠,模型数降序、
  「未标注厂商」最后,搜索自动展开命中的组),放的是**账本没按它计费**的云端行;点
  「设为手工价」把它复制成本机的一条全局价。被账本用到的云端行留在**我的价格**里带「云端」徽章,
  两边不重复。
- **一次保存写两层**:底部的共享保存条写明范围(如 `保存 · 模型层 2 条 · 覆盖层 1 条`),经
  `PUT /tokbook/provider-pricing` 与 `PUT /tokbook/pricing` **先覆盖层、后模型层**顺序写回
  `provider-pricing.json` / `pricing.json`——中间态永远不会让某条 (通道, 模型) 短暂掉成
  价格未知;哪一步失败就报哪一步,并按**实际写成**的结果刷新。**哪一条没保存是看得见的**:
  价格表 tab 带小圆点,每个有暂存改动的行在行头带「未保存」标签(删除一条已保存的条目则是
  「待删除」),不用展开行就能认出来。Ctrl/Cmd+S 同样是保存。
- **高级**(列表下方的折叠):**新增手工价**(给账本还没计费的串写一条全局价)、**新增覆盖**
  (给镜像里没有的 （通道, 模型） 建覆盖)与**同价通道**——同一个套餐买多份(每把 key 一个路由,
  价格相同)时声明一次:让某条路由跟随另一条,它的价格与计费性质随之生效、行在 UI 里只读并标
  「跟随 X」;该路由自己的条目仍然优先,所以单给某一份套餐调价就是给它写一条精确条目。

保存后下一次读取即重新计价全部历史——不动折叠或账本。
(手工条目**整体替换**该模型的整套规则集:写规则集就带上调价时段与峰谷,写 flat 价就等于
用一条价替换全部;手工层不做上下文档位,云端按上下文分档的模型被手工覆盖后分档不再生效。)

默认位置:`$DSH_HOME/tokbook/`。畸形文件只会把受影响的模型降级为价格未知(¥0),不会弄坏
页面。价格未知的模型会在浮窗里列出,并在价格表里用**价格未知**筛选一键去定价——**「价格
未知」= 不知道价,不是免费**;费率为 0(如免费测试期的接口、免费 deal)是已知价,照常显示 ¥0。

## 配置

```yml
plugins:
  tokbook:
    path: D:/data/tokbook        # 默认: $DSH_HOME/tokbook(或 ~/.dsh/tokbook)
    pricingRegion: overseas      # 默认: domestic(gitee 镜像)
    pricingUrl: https://...      # 可选显式 feed URL;优先于 region
    pricingProviderUrl: https://... # 可选显式通道覆盖层 feed URL(默认 dsh-model-pricing 镜像)
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
- **成本(双维 + 双桶)**:¥/M 基准价表(云镜像 + 手工覆盖)之上叠 **通道覆盖层**
  (镜像 + 手工),按 （通道，模型） + 记录时间戳解析(`inheritBase` 跟随官方整表含调价史 /
  `segments` 用户时间轴);金额分 **实际支出**(metered)与 **订阅价值**(subscription,非现金)
  两桶;价格未知的模型浮出(标「价格未知」,不是免费)。
- **价格表 tab**:一张表、一条轴——每行就是一个 (通道, 精确模型串),这条价写在**哪一层**
  (模型层 `pricing.json` / 通道覆盖层 `provider-pricing.json`)是**行的属性**:行头一枚来源
  徽章 + 行内编辑器第一项就是层级选择(切到覆盖层 = 就地建覆盖,切回模型层 = 删掉它回落到
  模型层/云端)。每行显示当前生效价(`now`,按读取时刻走「时间规则 → 峰谷」链)、必要时说明是
  哪个窗口/峰谷在生效,展开看完整时间轴;模型层的**调价时段**(期限内/永久降价)与**峰谷时段**、
  覆盖层的多段 `segments` 自定价都收在行内「高级」折叠里。列表按通道路由分组(记录数降序 →
  形态 → 路由键),计费芯片标出该组金额是实际支出还是订阅价值,形态 chips 可筛,包装路由与
  同价通道整行只读(沿用它跟随的那条通道,镜像是 `aliasOf`、手工层是 `$routes`,都不复制条目);
  账本没按它们计费的路由收在末尾的**未计费**组。**参考价表**把镜像 feed 的完整字典
  (~185 行、按厂商折叠)挪出主列表,只读浏览、可一键「设为手工价」。保存条**一次写两层**:
  先 `PUT /tokbook/provider-pricing` 再 `PUT /tokbook/pricing`,写明写入范围,失败时报出
  哪一层没写成(`GET /tokbook/pricing` 提供视图);保存后下次读取即重新计价全部历史。
- **Browser 半区**:侧边栏 footer 按钮 + shell overlay 浮窗,内含汇总卡(**今日词元** +
  较近7天日均涨跌参照 + 今日实际支出/订阅价值,零值的桶不占行;元数据行放
  会话/请求/失败/累计词元/累计支出)、
  今日词元构成(四桶 + 缓存命中率;缓存写入不是该账本的维度时不渲染该格)、按日趋势图、
  带金额的按 （通道，模型） 拆分、近期记录,以及
  **按通道的 tab**:每个通道路由一张卡,展示其下各模型的 token/双桶金额,
  可切换 今日 / 昨天 / 近7天 / 近30天(专用精确路由 `GET /tokbook/usage?range=…` 只读
  窗口内的日文件)。
- **订阅额度(quota)tab**:逐计划**官方账户用量**在 host 侧从各通道自家端点拉取
  (`GET /tokbook/quota`)——Command Code 走其 CLI 账户端点(窗口 + 积分 + 计划),OpenCode
  Go 走 `/zen/go/v1/usage`(百分比 + 重置)。无本地估算;无 key → `unconfigured` 提示卡。

剩余缺口 / 计划升级:

- 额度计划每个通道路由只收一个 API key(尚无多账户轮换)。
- 侧边栏触发按钮上的持久「告急」指示(最紧额度窗口前的色点)未接线:它需要事件驱动
  更新,因为额度只在 tab 打开时拉取——窗口关闭时,没有东西把变化推给按钮。
