# dsh-tokbook

> **Doc meta** · role: entry · language: zh-CN · status: current · last-reviewed: 2026-09-13 · supersedes: —

DeepSeek Harness(DSH)的**跨会话 token 用量账本**插件。host 半区把每次通道计费
模型调用——`assistant/message` 通道的 `usage`(外加压缩 summarize 调用与失败尝试)
——记成一行、写入持久化的按日 JSONL 账本,再对外提供**带成本**的聚合总览。browser
半区通过**侧边栏 footer 按钮**(route A:`sidebar.footer.action`)把它展示出来,按钮弹出
**浮窗**(`shell.overlay`),内含汇总卡(**今日词元** + 较近7天日均涨跌参照 + 今日成本)、
今日词元构成(四桶 + 缓存命中率)、按日 token 趋势图、**按模型 / 按工作区两个子 tab**
(同一个累计账本的两种切法,点击切换:按模型 = 词元 + 费用 + 占比条;按工作区 = 每个工作区
一行累计词元 + 请求数 + 金额,最近有操作的在前面,没有工作区目录的用量收在一行「未归属」)、
**按通道的 tab**(每个通道路由一张卡,卡头用本机配置里的显示名
命名、路由键作次要小字,并标出该通道的计费性质「按量 / 订阅」;内含该路由下各模型的
token/成本,可切换 今日 / 昨天 / 近7天 / 近30天 窗口)、**价格表 tab**(每个路由键一张卡,
生效时间 + 四档全天价 + 峰谷时段全部由你自己写),以及**订阅额度 tab**
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
而非逐会话聚合,外加本机手写 ¥/M 价格表(路由 → 精确模型串 → 价段:生效时刻 + 全天价 + 峰谷时段)。

## 布局

```
src/
  index.ts            host: TokenUsageBook 服务(ctx.tokbook)+ 实时 hook
  config.ts           插件配置校验 + plans 覆盖层宽松 coerce
  types.ts            共享领域类型 + 纯领域值(UNPRICED_KEY / PROVIDER_RANGES /
                      totalsTokens),host 与 browser 共用
  ledger.ts           数据目录解析 + owner 标记(单写者守卫)
  usage-record.ts     逐调用记录模型 + 会话事件投影
  usage-log.ts        按日 JSONL 存储(追加/去重/refile;去重状态按数据目录在
                      实例/重启间共享)
  sync.ts             首次启动 + 手动历史回填(幂等)
  sync-state.ts       首次运行标记 + 持久化同步基线
  stats.ts            聚合(totals/byDay/byHour/(provider,model))+ 折叠 + 缓存
  price-format.ts     价格表时间轴的纯规则(整点生效 / 每日时段 / 星期几 / 冲突),
                      host 与 browser 共用,保证「草稿能存 = 写入能收」
  pricing.ts          唯一价格表(路由 → 模型串 → 价段:生效时刻 + 全天价 + 峰谷时段)
                      + 两级取价(priceAt/slotAt/ratesAt/rateKeyAt)+ costOf
  pricing-view.ts     价格表 tab 的卡片装配(路由目录 ∪ 账本 ∪ 价格文件)
  route-catalog.ts    路由目录:本机设置文档(settings)× 运行时适配器注册表(ctx.llm)
  by-provider.ts      纯通道卡片聚合(通道用量 tab)
  workspaces.ts       纯按工作区累计聚合(用量总览「按工作区」;会话 cwd ↔ 工作区注册表
                      的读时连接 + 未归属兜底)
  quota.ts            官方额度归一化 + 内置计划身份
  quota-official.ts   key 解析 + 各通道官方用量抓取器
  routes.ts           host 精确 Fetch 路由 /tokbook/overview、/tokbook/rescan、
                      /tokbook/usage?range=…、/tokbook/quota、/tokbook/pricing
  client/
    index.ts          client: apply(ctx),注册两个 slot
    contract.ts       最小 client 契约:ctx/slots 面 + 跨 surface 视图契约(PricingFocus)
    store.ts          按钮 ↔ 浮窗共享视图 store
    format.ts         纯展示 helper(日键、token/金额/时间格式化)
    styles.ts         注入样式表入口(按 surface 拼接 styles/*.ts)
    styles/           CSS 分片:tokens/footer/overlay/ledger/method/provider/quota/pricing/shared
    FooterButton.tsx  sidebar.footer.action 触发器
    LedgerOverlay.tsx shell.overlay 浮窗外壳(五 tab + 焦点/快捷键)
    LedgerView.tsx    用量总览 tab(今日英雄卡 + 构成 + 趋势)
    Breakdowns.tsx     用量总览的两个子 tab:按模型 / 按工作区(点击切换)
    ProviderPanel.tsx 通道用量 tab
    MethodDoc.tsx     统计口径 tab
    pricing/
      draft.ts        价格表纯逻辑:草稿↔wire 转换、校验、签名(未保存标记)
      editors.tsx     行原语:四档价输入、价段编辑器(生效时间/全天价/峰谷时段)、模型行、路由卡片
      PricingPanel.tsx 价格表 tab 外壳:工具栏 + 路由卡片 + 暂存保存条
    quota/
      metrics.ts      订阅额度纯规则:占比/语气/口径/文案(无 React)
      QuotaCard.tsx   订阅额度卡:卡壳 + ok 主体 + 余额/无订阅面板 + gauge/骨架
      QuotaPanel.tsx  订阅额度 tab 外壳:取数 + 刷新策略 + 卡片排序
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
- **用量未知** — 通道没上报 `usage` 的计费调用(中途取消的请求、或没回报用量的 summarize)
  仍记一行、仍计入请求次数,但没有 token 可加。它们在概览与通道卡上以「用量未知 N」标出
  ——**不按 0 词元冒充**:不知道 ≠ 零消耗,与「价格未知」同一条原则;金额同样按 ¥0 计,
  概览的注记会说明这一点。口径见 [`docs/CONTRACTS.md`](docs/CONTRACTS.md)。

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

每条记录按**它自己的时间戳**与本机那份价格表计价,分**两级**:先取价格表里 **该 (通道路由,
精确模型串)** 的最后一段「生效时刻 ≤ 该时刻」的价;再在该段内按记录**本地时间**取生效的
**峰谷时段**(星期几 + 几点到几点)。没有被任何时段覆盖的时间,按该段的**全天价**算。早于最早
一段、或这条 (路由, 模型) 根本没有价段 → **价格未知**(¥0)。所以一次改价会重算全部历史金额,
而账本与聚合都不需要重建。

计费性质是**通道路由**属性(`$billing` 的一条),省略按 `metered`。

金额拆成两个桶,浮窗分开显示、绝不混为单一"支出":

- **实际支出**(`spend`)——`billing: 'metered'` 路由(官方按量/中转/未知串)的真金白银;
- **订阅价值**(`subscriptionValue`)——`billing: 'subscription'` 路由(如 OpenCode Go /
  Command Code 订阅)按你写的价折算的"省了多少",**不是现金**。

价格**全部由你自己写**,只有一份文件 `pricing.json`:路由 → 精确模型串 → **价段数组**。
一个价段 = **生效时刻**(`YYYY-MM-DD`,或精确到小时的 `YYYY-MM-DDTHH:00`;省略 = 最早一段)
+ **四档全天价** + 可选的**峰谷时段**(峰谷价)。取价按记录自己的时间戳落在哪一段、哪一时段,
所以回填一段更早的价、或给某段加一个高峰时段,都会重算那段历史的金额。

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

- **四档价**:`inputPerMillion` / `outputPerMillion` / `cacheReadPerMillion` /
  `cacheWritePerMillion`(¥/百万词元);缓存两档省略 = 按输入价。
- **生效时刻**:`from` 用本地日期 `YYYY-MM-DD`(当天 0 点)或**整点** `YYYY-MM-DDTHH:00`;
  省略(或空)表示**最早一段**(自始生效)。同一条 (路由, 模型) 里**不许有两段同一时刻生效**
  ——写路径会拒绝。分钟不是这条时间轴的单位。
- **峰谷时段**:`slots` 里每项是 `days`(`daily` / `weekdays` / `weekends`,省略 =
  `daily`)+ `start` / `end`(整点,**左闭右开**,`0 ≤ start < end ≤ 24`,`24` = 当天结束)
  + 它**要覆盖的档位价**(任意子集,至少要写一档;**没写的档位沿用该段全天价**)。
  **同一段内两个时段不许在任何时刻同时生效**(区间相交
  且 `days` 有交集才算冲突,所以「工作日 9–12」与「周末 9–18」可以并存)。**不要求铺满 24 小时**
  ——没被时段覆盖的时间就是全天价,所以普通调价只写全天价,峰谷只加高峰那几行。
- **`$billing`** 是唯一的保留键:路由 → `metered`(默认)或 `subscription`,声明这条通道的
  金额算**实际支出**还是**订阅价值**。它是**通道属性**,作用于该路由的全部历史。
- 没有价段的 (路由, 模型) 就是**价格未知**(暂按 ¥0 计,浮窗里会列出来);某条历史记录的
  费率身份(生效时刻 / 时段)被改掉或删掉后,那些记录也回到**价格未知**并同样列出来——绝不
  悄悄按邻近时段的价格算。

浮窗的**价格表 tab** 因此以本机配置为核心编排:**一条通道路由一张卡片**。

- **卡片从哪来**:卡片的集合是三个来源的并集——① 本机 `~/.dsh/settings.yaml` 里配置的路由
  (`llm-pi-ai.providers` 的每个键,加上直接适配器唯一的 `deepseek-official`),② **正在运行的
  适配器注册表**(所以插件在运行时铸出的路由,如包装路由,也有卡),③ 账本计费过、或价格文件里
  写过的路由(即使配置里已经删掉,它的历史金额仍然看得见、改得动)。卡片头的名字取设置里的
  `displayName`,没有就用适配器给的名字,再没有就显示路由键。
- **卡内模型**:该路由配置的 `models` 列表(profile 没列就回落到适配器自己的目录)**∪** 账本
  真正计费过的模型串——后者带「仅账本」徽章,保证历史金额永远有可定价的入口。
- **每行的身份只显示一个**:有**显示名**(settings 里 `models[].name`,其次适配器给的名字)就显示
  它,没有名字(仅账本行、只写在价格文件里的串)就显示**精确模型串**——同一件事不写两遍。精确串
  仍是账本的计费键,所以它没有消失:悬停身份可看全文(`title` 里名字与串都在),四档价单元格的
  读屏名也用它。宽度不够时身份**以省略号收尾**,行内徽章(仅账本 / 价格未知 / 峰谷 N 段 / 未生效 /
  未保存)一律不截断。
- **一张表,不是一堆表单**:卡里每行一个模型,四档价是**列头对齐的固定列**(等宽数字右对齐),
  价格因此能顺着列往下比。单元格平时就是文本,**点一下(或 Tab 过去)就地变成输入框**;在未定价
  的行上敲下第一个数字,就等于写下这条模型的第一段价——它的生效时间按下面那条规则自己落位。行内
  这四格永远是**该段的全天价**(界面上
  标着 `00:00–24:00`),峰谷的分档价在抽屉里——同一张表不该在不同钟点显示不同数字。行内四格
  改的就是**正在生效那一段**,所以改它等于重算用这段价计费的历史;这条规矩在工具栏下的图例里
  说一次(全局只说一次,不逐行重复)。
- **宽度给会变的列,不是给标签**:费率列按"一个 ¥/M 单价最宽能有多宽"定尺寸——实测 12px 等宽
  数字下 `0.02`/`13.5` 是 22px、`0.0028` 是 35px、八位数的 `0.003625`(DeepSeek 自己的历史
  缓存命中价)是 47.9px,加左右各 7px 内边距需要 62px,所以**一格的宽度下限是 64px**;再窄就会
  把第八位数字悄悄裁掉。省下来的宽度全给**模型身份列**——那里装着长度不可预测的名字或模型串。
  所以身份能完整显示,不会为了四个短数字把它截成 `deepseek-v4-f…`。
  这一格宽度是**全 tab 统一的一条度量**:表格与调价史里"输入一个价"的方框一样大(实测两处都是
  64px),列头标签的右端与它下方数字的右端**精确对齐**(共享同一个内边距变量)。
  调价史里的四列会**铺满**可用宽度(它是一个表单,不是数据列),但每个输入框仍钉在 64px——
  这样不会出现"156px 的槽里放 22px 的数字"。
- **身份两行**:第一行是**身份**(显示名;没有名字时就是精确模型串)加状态徽章(仅账本 /
  价格未知 / 峰谷 N 段 / 未生效 / 未保存),第二行只放这段价的来龙去脉(账本次数、备注)。挤不下时**先省略第二行尾部的说明**,身份与徽章都保住。
- **搜索**:同时匹配模型名称、精确模型串、通道路由键与通道名称——按名字找和按串找都能命中。
- **「—」= 还没写价**:图例只说一次(暂按 ¥0 计,**不是免费**);没写价的行带一枚「价格未知」
  小芯片(与概览、契约同一个词),峰谷时段与「未生效」带自己的芯片。
- **关键状态不会跑到看不见的地方**:「价格未知 / 峰谷 N 段 / 未生效 / 未保存」都挂在模型串
  那一行的**徽章位**(不截断),会被压缩截断的副信息行只放账本次数与备注。
- **调价史收在行尾 ▸**:需要多段价、要改生效时间或备注时点开——每段是**一段价**:先填**生效
  时间**(日期 + 整点),再填**全天价**的四档价,需要峰谷时在下面 **＋ 加峰谷时段** 加「星期几
  + 几点到几点 + 要覆盖的档位价」的行(默认 09:00–12:00;普通调价不需要加,那一格就是 0–24 点)。
  峰谷时段**留空的档位沿用全天价**,而且空格子里直接显示会沿用的那个数字——不是看不见的继承,
  也不是一个「—」反过来表示"跟随"。时段的两个整点下拉**任何时刻都保持合法**(改动一端时另一端
  自动跟随),「复制」会把它按原时长挪到旁边而不是原地叠一个冲突。
  里面还按段列出「生效时间 → 全天价 → 峰谷时段 → 备注」,当前生效的那段带「当前生效」标记,
  复制/删除在该段悬停或键盘聚焦时才出现;峰谷时段可以整条删掉(那段覆盖的时间回到全天价)。
  卡片头的 ▾ 收起整张卡,长列表可以折着看。
- **价段的生效时间不会空着**:账本已经计过费的模型,它的价段若没写生效时间,价格表就按**这条
  模型在账本里的第一条记录(首记)所在的整点**填上——那段价管的正是这条历史,而「自始生效」在
  账本里没有比首记更早的时刻可管;填上它不改变任何一笔账的金额(段序没变,首记之前也没有账),
  只是把「从什么时候起」从一句状态变成日期。填出来的值就是文件里的 `from`,随下一次保存落盘,
  所以界面、时间轴与 `pricing.json` 说的是同一件事。**没有账可锚**的行(配置里新加、还没调用过
  的模型)仍然是**无起点**;另一段价已经起在首记之前或同刻时也保持无起点——段序就是每笔账取哪段
  价,锚定不许把它挤到那段价之后。
- **抽屉顶上是这条模型的价段时间轴,两端分别是「首记」与「今天」**:左端固定是**这条模型在账本
  里的第一条记录**(首记),按价格表自己的精度取**整点**——那也正是"没写生效时间的价段"被锚的
  地方,所以同一个事实在这张图上只有一个时刻,而不是差几十分钟的两个左端;右端固定是**今天**。
  轴只画这条历史里**真正发生过的调价**:

  - 一次调价 = **一个节点**:轨道(3px 的加粗线)上一颗点,日期写在点的**正下方**,按日期在
    「首记 → 今天」里的**比例**落位;两端的 `首记 <整点>` 与「今天」则贴在轴的**上方**——它们命名的
    是区间的两端,不是某一颗点。相邻节点保**最小间距**(每个日期按 9px 等宽字体估宽,再加 6px 空隙):
    靠得比它更近就向后摊开,比例因此**局部失真**(轴读的是调价的先后,不是距离),但**两端永远不动、
    轴也不横向滚动**——真挤不下时压缩的是间距而不是日期(实测八个节点仍排得下,再多才开始挤压)。
    轨道宽度是量出来的(`ResizeObserver`),因为"最小间距"是 px,不是百分比;
  - **当前生效的那颗点是强调色、且略大**:状态文字不在轴上重复,它已经在行内四档价、行尾徽章与
    下方价段列表里写着;
  - **区间之外的时间点不画**:生效时间早于首记的边界(那一刻它已经在生效,但那次"变化"不属于这段
    历史)、今天之后才生效的段、以及写了自始生效的**无起点**段,都只在下方价段列表里出现;
  - **区间里一次调价都没有就不画轴**:一条只有两端的空轨道说不了行内四档价与下方列表没说过的事,
    所以账本没记过(没有首记)的行、以及调价全在区间外的行都不画;
  - 轴上的点可点,点了落到**那一段价的编辑器**——生效时间输入框就在那里,给它填上日期,轴上的节点
    随之出现或移动。
- **没填完的那一块是草稿,不是错误**:新加的价段 / 峰谷时段在写入前是空的——它不参与校验、不算
  「未保存」、保存时被丢掉,所以你点「＋」永远不会把整表搞成报错态;只有**填了一半**(缺输入价或
  输出价、小时不合法)才会就地报错。
- **出错指出是哪一格**:数字不合法时那一格变红并带 `aria-invalid`,行下就地给出原因(如
  「输入价「abc」不是有效的非负数字」,峰谷时段会指明是第几个、哪一段小时);工具栏右端的状态
  只做总述。
- **改完就存,没有保存按钮**:任何改动——四档价、生效时间、时段与日期、加减价段/时段、卡片头的
  「按量 / 订阅」开关——停止输入约 0.6 秒后经 `PUT /tokbook/pricing` **整表替换** `pricing.json`。
  工具栏右端只报状态:`保存中…` / `已保存 19:42:07` / `未保存:<原因>`(比如某个必填数字还空着
  ——这时文件保持上一次好的状态,你补完它自动接着存)/ `保存失败:<原因>`(带「重试」)。
  写路径严格校验(非负数字、真实日期与整点、同一时刻两段拒绝、时段不许重叠、时段至少要写一档价、
  不许未知字段)。
  Ctrl/Cmd+S 可立刻冲刷一次
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
  `/alpha/usage/summary?since=<当期开始>`、`/alpha/billing/credits`、
  `/alpha/billing/subscriptions`):以 USD 计的窗口 `used/cap/exceeded/resetAt`、月度积分池、
  计划 + 用量汇总。
- **OpenCode Go** — 查询官方用量端点
  (`GET https://opencode.ai/zen/go/v1/usage`):5h/每周/每月窗口,以百分比 + 重置时间
  呈现(该端点不上报美元金额,所以那张卡只显示百分比)。该端点也不报套餐身份,所以失效与否
  看 HTTP 语义:**401 = key 无效**(`error` 卡),**403 = key 有效但没有 Go 订阅**(Zen 与 Go
  共用 workspace key)→ 一张「无生效订阅」的状态卡。

**套餐失效时卡片换主体**(见 D-014):5 小时/每周窗口只约束订阅内含的月度额度,所以当账户
没有生效中的订阅时(套餐结束,或本来就是按量付费账户),卡片**隐藏窗口行、不画表盘**,改为
以**余额**领读并列出三个来源(月额度 / 已购 / 赠送)——已购与赠送额度滚存、永不过期,失效后
它们才是还能不能继续用的答案。Go 的用量端点连余额也不报,所以那边退一步**只出状态、不出
数字**。判定按各通道的权威信号(Command Code 按官方口径:`active`/`trialing` 之外一律看
`periodEnd`,因为取消后仍可用到当期结束;Go 按 403/401 语义),不硬编码状态词。这类卡也
**不再自动刷新**(值不随分钟变化),但手动刷新与「打开 tab 即按新鲜度强刷一次」照旧,续费
会在下一次打开时被接住。

**失效的卡排到最后**:卡片按 host 给的顺序展示,一旦某张卡确认没有生效中的订阅
(`gate` 非 `subscription`)就沉到其余卡片之后,让 tab 先展示还能花的套餐。这是**稳定分区**
而非排序——组内顺序不变,所以除「下沉」本身之外不会有任何重排;还没拿到结果的卡(仍在加载、
或上次拉取失败)按在期处理,与它渲染时的读法一致。

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
- **多维统计**:totals、按日、按小时、按 （通道，模型）、按（日 × 模型 × 通道 × 费率身份）格;冻结日折叠 + 进程内存解析缓存;近期窗口。
- **成本(单表 + 双桶)**:¥/M 手工价表(`pricing.json`:路由 → 模型串 → 价段),按记录自己的
  时间戳两级取价(生效时刻 → 该时刻的峰谷时段);金额分 **实际支出**(metered)与
  **订阅价值**(subscription,非现金)两桶;价格未知的 (路由, 模型) 浮出(标「价格未知」,
  不是免费),历史费率身份被改掉/删掉的模型同样浮出而不是静默按邻近价计。
- **价格表 tab**:每个**通道路由一张卡**(卡头 = 配置里的显示名 + 路由键 + 「按量 / 订阅」开关
  + 模型数/已定价数/账本次数),卡内每个模型一行:来源徽章(仅账本 / 价格未知 / 未保存)、当前
  生效价(该段的全天价四档)、「定价 / 改价」展开它的价段编辑器(生效时间 + 全天价 + 峰谷时段
  + 备注,可复制一段做调价史、复制一个时段做峰谷)。卡片集合 = 本机设置文档 × 运行时适配器
  注册表 × 账本 × 价格文件(见
  [`docs/CONTRACTS.md`](docs/CONTRACTS.md))。**改完自动保存**(停止输入约 0.6 秒后整表
  `PUT /tokbook/pricing`),底部只报状态:保存中 / 已保存 / 未保存+原因 / 保存失败+重试;
  切 tab 或关窗前会先把待写改动落盘,Ctrl/Cmd+S 可立刻冲刷。保存后下次读取即重新计价全部历史。
- **Browser 半区**:侧边栏 footer 按钮 + shell overlay 浮窗,内含汇总卡(**今日词元** +
  较近7天日均涨跌参照 + 今日实际支出/订阅价值,零值的桶不占行;元数据行放
  会话/请求/失败/用量未知(有则显示)/累计词元/累计支出)、
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
