# dsh-tokbook

> **Doc meta** · role: entry · language: zh-CN · status: current · last-reviewed: 2026-11-22 · supersedes: —

> 英文门面见 [`README.md`](README.md);本文件是**维护者的那一份**,多带 `src/` 布局树与开发细节。

DeepSeek Harness(DSH)的**跨会话 token 用量账本**插件。host 半区把每次通道计费模型调用折成
一行、写入按本地日持久化的 JSONL 账本,再对外提供**带成本**的聚合;browser 半区在**侧边栏面板列表**
里放一行入口(`sidebar.panellist`,和「插件」「看板」同一个列表),点开在**主栏**打开账本页(`main`)——
页内三个 tab(按界面上方从左到右):**用量总览**(响应式网格卡片:今日读数 / 近 14 天「词元柱 + 支出线」/
今日词元构成叠 14 天累计 / **用量明细**——窗口 × 按模型 / 按工作区 / 按通道;宽主栏一屏四块,
窄了竖排;金额只在近 30 天及更短的窗口里给;下方一排**订阅额度**卡,用你的 key 向通道查账户级
官方用量)、**价格表**(卡片网格:选择带 / 价格详情 / 节假日年历;选一个通道 + 模型填**当前价**,
峰谷时段、汇率也在这里)、**统计口径**(卡片网格:导言 / 四桶 / 调用判定表 / 差额 / 核对;
不估算的口径、漏项与对账)。
另有一处不在账本页里:插件在**会话头部**的 utilities 槽位放了**词元**与**耗时**两颗按钮,各自点开一个贴着按钮的浮层,
一轮一张卡片:词元浮层用切分圆环报这一轮的四桶构成,耗时浮层用切分圆环报这一轮的用时与相位构成。
见下文「[会话词元浮层](#会话词元浮层)」与「[会话耗时浮层](#会话耗时浮层)」。
> **用量明细不是第四个 tab,订阅额度也不再单列 tab。** 两者都在**用量总览**这一页里:明细是
> `ProviderPanel`(`section[aria-label="用量明细"]`),额度是总览下方那排卡。tab 条上只有三个,
> 三个 tab 的内容都挂在**同一张 12 栏响应式网格**上,各块是独立卡片。tablist 的唯一真源是
> `src/client/TokBookPanel.tsx`。

| 浅色 | 深色 |
| --- | --- |
| ![浅色下的账本页总览](docs/assets/panel-ledger.png) | ![深色下的账本页总览](docs/assets/panel-ledger-dark.png) |

*两张都抓自预览台,所以数字是 fixture 数据,不是真账本。*

两条贯穿全插件的原则:

- **只记真实的计费调用。** 一行来自四类会话事件:`assistant/message`(用它的 `usage`)、
  `compaction/summary`、`llm/retry`(安排一次重试 = 一次失败尝试)、`reason.kind === 'error'`
  的 `turn/end`。通道没上报用量的调用**仍写一行、仍计入次数**,但没有 token 可加——**未知不等于 0**,不估算。
  **已知缺口**:`assistant/attempt`(流结束时没产出可见消息的那次尝试)当前不投影,所以 adapter
  只把 `usage` 放进 attempt 的 stream 上报的那种失败尝试不入账;一次 attempt 既没安排重试、也没以
  error 收尾时一行都不写。补它得按 retry 生命周期配对尝试,是独立任务。
- **金额由你自己写价。** 一份 `pricing.json`(路由 → 精确模型串 → **一份当前价**),金额分
  「**实际支出**」与「**订阅价值**」两桶。价只有一份,所以它衡量的是**最近用掉的 token 值多少钱**
  ——**不是**当时那笔账单,金额因此只在 30 天及更短的窗口里给(「全部账本」只给词元)。
  没定价的是**价格未知**(按 ¥0 计,但会在界面上列出来);费率为 0 才是免费。

界面词与代码/契约的逐条对应见 [`docs/CONTRACTS.md`](docs/CONTRACTS.md) 的「术语」段。**界面规格的真源是代码**:
token 与「什么时候用哪个」见 [`docs/CONTEXT.md`](docs/CONTEXT.md) 的「取值与样式口径」一节,各个面长什么样看 `src/client/styles/**`;
静态可判定的那批禁令由 `pnpm selfcheck:ui` 强制,其余要人看。文档树地图见 [`docs/INDEX.md`](docs/INDEX.md)。

> **术语**:本文档与界面说的**通道**就是代码与契约里的 provider —— 你从哪接入、按什么方式付费的
> 那条路,route key 即账本里记录的通道标识。做模型、定官方价的那一方叫**模型厂商**,不是通道;
> 同一家公司可以兼任两者,也可以只是通道。

数据来源沿用 [dsh-token-usage](https://github.com/LaoYueHanNi/dsh-token-usage) 参考:**逐请求行**而非逐会话
聚合,外加本机手写 ¥/M 价格表,按**当前价**折算金额。

## 安装

需要 DSH(`dsh --version`)与 PATH 上的 **pnpm 11**。

```sh
dsh plugin --profile web add github:a285292107s/dsh-tokbook
```

`web` 只是**你要装进去的那个 profile**:**换成你自己的名字**。该 profile 还不存在时,这条命令会
顺手初始化它。本文其余地方写 `web` 也是同一个意思。

这个包是 **`dsh.bundle` 组合包**:`package.json` 的 `dsh.bundle.patch` 指向包内的
`cordis.patch.yml`,安装成功后 DSH 自动把它选进 profile 的 bundle 列表,由那一层插入 `tokbook` 行
——**不要**再手写 `insert` 挂载行。数据目录默认 `$DSH_HOME/tokbook/`,这个插件**不配置也会开始
记账**;只有要改什么才加 `config:` 块(见[配置](#配置)),覆盖示例见
[`cordis.patch.example.yml`](cordis.patch.example.yml)。

重启 `dsh web` 并刷新浏览器。入口是侧边栏面板列表里的「**词元账本**」行(在「更多」上面一格),
点开在右侧主栏打开账本页;它不是弹窗,切走面板即离开这一页。

仓库里带着构建好的 `lib/`(随 git 发布),所以安装时**不需要 pnpm 跑构建脚本**,也不需要先改 profile
的 `pnpm-workspace.yaml`。改完 `src/` 要 `pnpm build`,再把 `lib/` 一起提交(见「构建」)。

pnpm 还会报一句 peer dependency `@deepseek-ai/cordis` 缺失的警告。**那是预期的、无害的**:
cordis 由 DSH 自己提供,插件解析到的就是同一个实例。

从本地检出安装则用 `dsh plugin --profile web add .`。

**从旧的普通插件装法迁过来**:profile 的 `cordis.patch.yml` 里此前有一条手写的 `insert` 行
(`id: tokbook`)。选中这个 bundle 前先删掉它,否则 profile 里会留下两行同 id 的 `tokbook`。

重载链活着时(见 [`docs/HMR.md`](docs/HMR.md)),`pnpm build` 会经 `dsh-hmr` 行热替换 **host** 半区;
browser 刷新页面拾取,链没活着时硬刷新永远是兜底。

## 它怎么记 token

host 监听持久化 `session/event` 流,把每次通道计费模型调用折成一行 JSONL 写进数据目录(默认
`$DSH_HOME/tokbook/`,可用 `path` 配置)。**事件 → 行的逐条投影在 `src/usage-record.ts`**:

- **用量未知 ≠ 0。** 通道没上报 `usage` 的计费调用(中途取消的请求、没回报用量的 summarize)
  **仍写一行、仍计入请求次数**,但四个 token 桶一个都不加,也不按 0 词元冒充。
- **新鲜度不靠读路径等。** 打开账本页那次读只做**廉价探测**(列会话 + 比对变更签名);要折叠时才把
  **权威 walk 排到后台**并按 15 s 节流——账本最多晚一个节流窗口,要立刻全量走一遍用**重新扫描**。
  读不动的会话(日志损坏等)按**试过的签名**留档、不再每轮重试;要再试就点重新扫描,它会如实报出
  有几个会话读不动。
  walk 在跑时账本页靠只读探针 `/tokbook/sync` 把状态追到落定——页脚那句「正在扫描记录…」/「扫描
  失败:…」和那颗扫描按钮都从同一个 `status` 派生,落定后页脚接着报出这次补了几条记录,再拉一次概览。
- **界面跟着账本走,不靠盲轮询。** `/tokbook/sync` 除了调度器状态,还端出**账本代数**(每落一行 /
  每挪动一行 +1,只读内存)。浏览器侧一个共享探针每 3 s 读它一次;代数变了才让当前那一页重拉自己
  的载荷,所以**会话还在跑时数字自己会动**,而停手时一次载荷请求都不发。探针的周期远小于任何一份
  载荷的成本,页面在后台时整个停。宿主不给这一格(旧 host / HMR 只换了一半)时各页退回原来的
  定时轮询——「读不到变化」不能当成「没有变化」。

### 一个数据目录,一个写入进程

账本、折叠、解析缓存与 refile 都假设**单个 host 进程**写给定数据目录:启动写 `owner.json` 标记
(pid + 启动时间),**检测到存活的异进程已占用时告警**(陈旧标记静默接管)。第二个 host 请指向
自己的 `path`(见 [配置](#配置));去重与热重载边界见 [`docs/HMR.md`](docs/HMR.md)。

## 会话词元浮层

**词元**按钮在 utilities 槽位里排在**耗时**前面。点开是同一套贴按钮浮层:标题行报「共 N 轮」,下面一轮一张卡片、
最新在前。卡片左缘也是一枚满圈切分环,圆心报这一轮的词元合计,环按**未缓存输入 / 缓存读取 / 缓存写入 / 输出**
四桶摊开;右侧读数表给每桶的记号、名字、词元与占比。输出画成实心,其余三桶走明度与纹路(竖线 / 横线 / 斜纹),
所以不用色相也分得开。环不按最重一轮归一——每张都画整圈,跨卡片比总量看圆心,构成看环,精确值看右侧四行。
缓存读取通常占九成以上,环的形状会明显偏向一边;这正是它要回答的「这一轮主要是把上下文读回来,还是新输入 /
新输出」。零桶照常列出(0 与 0%),不藏行。

卡片头下同样报通道 / 模型;步数旁报「N 步用量未知」,失败尝试另报「含 N 次失败」——**未上报用量不等于 0**,
那一轮圆心写「用量未知」,卡片里再说明「这一轮的计费调用都没有上报词元」;部分步骤没上报时,合计只加已上报的那些,
未上报与失败都计入步数、但不贡献词元。
脚注写「只计上报用量的步 · 最新在前 · 不含轮间/轮次未知/子代理」。它和耗时浮层读**同一份会话视图**
(`GET /tokbook/session`),同样只读、打开才拉、跟着账本代数刷新;**不报钱**——金额是账本页的「现价刻度」视角,
放在这里会把「词元是事实、钱是当前价折算」两件事混成一个数。

把账本行归属到轮次同样靠 `sessionPersistence`:它缺席时视图没有轮次,浮层一张卡片都出不来。

## 会话耗时浮层

另一颗**耗时**按钮与词元浮层共用同一套外壳。点开是一个贴着按钮的浮层(浏览器原生 popover,不会被页头裁掉),
标题行报「共 N 轮」,
下面**一轮一张卡片、最新在前**:卡片左缘一枚**满圈的切分圆环**,圆心报这一轮的引擎工作用时,环按
等首 token / 生成 / 工具摊开(拆不开的模型段画成整段),右侧读数表给每段的记号、段名、时长与占比;卡片
头下还报这一轮的通道 / 模型(一轮用过多个模型时只报第一个、在步数旁报数量,完整列表在悬停提示里);有步骤
量不到用时就在步数旁报出,量不到的轮次圆心写「未计时」。环**不按最重一轮归一**——每张都画整圈,形状随时
可读;逐轮比用时看圆心的数字。浮层打开时才拉一次会话视图,之后跟着账本代数刷新;「轮间」与「轮次未知」
不占卡片。

它**对账本与配置完全只读**,也**不需要活的会话**:读的是该会话已落盘的日志的事件时刻。用时量的是
**本机墙钟**,不是计费时长。把账本行归属到轮次与步骤要看宿主的 `sessionPersistence`:它缺席时读到的
视图没有轮次,浮层一张卡片都出不来。

## 成本与价格表

金额按**当前价**折算:**每个 (通道路由, 精确模型串) 只有一份价**(四档基准价 + 可选的**峰谷时段**),
账本里**所有记录**都用它——先取那四档基准价,再按记录**本地时间**取生效的峰谷时段(没被时段覆盖的
时间按基准价)。所以**一次改价会让全部金额一起变**;一条 (路由, 模型) 没有价 → **价格未知**(按 ¥0 计)。

**它是「现价刻度」,不是历史账单。** 拿今天的价去折算一年前的用量,既不是那笔支出、也不是今天的
价值;所以金额只在**近 30 天及更短的窗口**里给,**「全部账本」只给词元**(词元是事实,放多久都成立)。
近 30 天里也可能发生厂商调价,那部分偏差是已知且接受的(维护者本机数据实测约 1–2%)。为什么不做
历史价表,见 [`docs/DESIGN.md`](docs/DESIGN.md) §5 末。

**峰谷时段自带星期集合**(每天 / 周一至周五 / 工作日 / 周末四档)与小时区间。其中「工作日」与
「周一至周五」的差别就落在节假日上,靠保留键 `$calendar` 的**法定节假日年历**(`YYYY` → 放假日闭
区间,按年收录)判定:年历里查不到那一年就是**未知**,「工作日」此时退化成「周一至周五」——
**安全方向**,宁可多按高峰算;调休上班日不用收(周末上不上班都是闲时价),所以这份年历只收放假日。

金额拆成两个桶,账本页分开显示、绝不混为单一「支出」:**实际支出**(`spend`)= `metered` 路由按现价
折算的钱;**订阅价值**(`subscriptionValue`)= `subscription` 路由按你写的价折算的「省了多少」,
**不是现金**。计费性质是**通道路由**属性(价表 `$billing` 的一条),省略按 `metered`。

价格**全部由你自己写**,只有一份文件 `pricing.json`(默认 `$DSH_HOME/tokbook/`):路由 → 精确模型串 →
**一份价**(四档价 + 可选 `slots` 峰谷时段),像一个能手改的 JSON:

```json
{ "deepseek-official": { "deepseek-v4-flash": {
    "inputPerMillion": 1, "outputPerMillion": 4, "cacheReadPerMillion": 0.02,
    "slots": [{ "days": "workdays", "start": 14, "end": 18, "outputPerMillion": 8 }] } } }
```

**四档价用这条通道自己的报价币种记**(第三个保留键 `$currency`,省略 = 人民币/百万词元)——厂商按
美元报价的通道就把美元价原样写进去。字段与校验的真源是 `src/types.ts`
与 `src/pricing.ts` 的 `parsePriceInput`(写入 handler 只做传输);畸形文件只把受影响的 (路由, 模型) 降级为价格未知(¥0)。
**旧版文件里的价段数组仍读得进来**:读路径取生效时刻最晚的那一段(就是今天仍在生效的价),更早的段
按它重算,下一次保存文件就写成上面这个形态;新写入**不再接受**数组或 `from`(报错会直说原因)。

**`$fx` 是唯一的换算率**(手填、不联网):把按美元报价的通道折成人民币——计价真的读它,所以
**改汇率会重算那些通道的金额**;人民币通道一分不动,已写的价也一个数字都不改。没填汇率就
换算不出来:美元通道算不出人民币(读作价格未知,绝不按 1 算),也切不过去(切报价币种的前提是有汇率)。

**价格表 tab** 一屏只面对**一个模型**:先用两个下拉选「通道」与「模型」(选项文字自带「N 次」
「N 个模型未知」「价格未知 / 未保存」这类摘要——「这张表有没有洞」不必点到才看得见)。下面是这个
模型的**那一份价**:四档价紧挨成一簇,行首的表盘画出 24 小时被峰谷时段盖住的区间;峰谷时段留空的档
沿用基准价(缓存读 / 写没有单独定价时按输入价计,格子里报的就是那个数),每个时段可复制 / 删除。
**四档全空 = 这条没有价**(它的记录按 ¥0 计,并列为价格未知);清空四档就是删掉这条价。
这一屏里还有两样**不属于任何一行**的东西:跟着这一屏常驻的**法定节假日年历**(按年收放假日,就是
上面那档「工作日」时段的判据),与**汇率行**(`$fx`,全表唯一的换算率)。按量 / 订阅的开关在详情头上——
它改的是**通道**的计费性质。规则见
[`docs/CONTRACTS.md`](docs/CONTRACTS.md) §2,其余交互(自动保存 / 未保存圆点)见
`src/client/pricing/`——真源是代码。

**报价币种**在详情头上(`¥` / `$`,与按量 / 订阅同排):它决定这条通道的价用哪种货币记,格子
显示什么就存什么——没有「敲美元、落人民币」那一层。切过去会把**已有的**价按汇率换算成另一种货币
(人民币金额不变,这是一次真正的改价、会弄脏那一行);每格的悬停提示里报另一种货币的读数(美元通道
报 `= ¥…` 那个计入金额的数,人民币通道报 `≈ $…` 供你核对)。没有汇率时 `$` 是停用的。

**从 models.dev 补价**(价格表 tab 的两个按钮,挂载时每天自动同步一次):
[models.dev/api.json](https://models.dev/api.json) 是公共的美元目录。

- **「查价」按钮**——把**当前选中的模型名**当关键词,在目录里模糊搜,列出**原厂采信**
  的相关模型与四档美元价,你挑一条就**一键填进这一行**(只在美元报价的通道上;人民币
  通道的按钮是停用的,得先在详情头把报价币种切成美元)。候选池与自动补价共用同一份
  采信目录,所以没有转售价冒充通道成本这回事——挑哪家由你定。关键词可编辑,搜不到
  时换个词(模型串、或只敲厂商名如 `deepseek` / `qwen`)再搜。
- **「从 models.dev 补价」按钮**——自动那条路的手动入口:把**账本里计过费**的 (route, model)
  对着它补进**美元通道**的缺价格子,精确名命中即写,手写的价一格不动,`force` 绕过日节流。

四道门槛与采信边界(转售商不采、分裂价弃采)见 [`docs/CONTRACTS.md`](docs/CONTRACTS.md) §2;
失败不落盘,今天同步过就不再拉。

## 配置

插件配置挂在 profile 那条挂载行的 `config:` 上(patch 文件是**顶层数组**的 loader patch 条目,
不是键值映射):

```yml
# $DSH_HOME/profiles/web/cordis.patch.yml
- insert:
    - id: tokbook
      name: 'dsh-tokbook'
      config:                                # 逐键类型与校验见 src/types.ts(TokBookConfig)
        path: D:/data/tokbook                # 默认: $DSH_HOME/tokbook(或 ~/.dsh/tokbook)
        recordCompaction: true               # 默认 true——把压缩 summarize 调用也记成一行
        plans: { opencode-go: { enabled: false } }   # 按通道路由键控的额度计划:opencode-go / commandcode(见下节)
```

给已挂载的那一行改配置,也可以另写一条按 `id: tokbook` 定位的 patch——它**整体替换**该行的
`config`,不与旧值合并,所以覆盖时要把想留的键写全。

### 官方账户用量(总览里的订阅额度卡)

这些卡 **用你的 key 从通道自己的账户 API 拉账户级订阅用量**——所以它反映共享该订阅的*所有*工具 /
设备,本地 token 账本做不到。目前覆盖 Command Code 与 OpenCode Go 两个内置计划。

- **无 key → `unconfigured` 卡;拉取失败 → `error` 卡**,两者都**绝不回退到本地估算**;**browser 从不持有
  key**。逐通道端点与取数策略见 `src/quota-official.ts`、套餐失效判定见 `src/quota.ts`。
- **有 key 但没有生效订阅不是错误**:按 provider 自己报的东西分成 `balance`(只有余额约束用量)与
  `none`(只报窗口百分比,如 OpenCode Go 的 403「有效 key,无 Go 订阅」)两档状态卡;门只从**真的
  答复了**的端点推导,网络故障绝不写成「没订阅」。
- 侧栏面板行图标上那一点 = **最近一次成功快照**里有窗口接近或超过上限;它由 `GET /tokbook/quota` 推出
  （内存里有 `ok` 卡就用它,否则读磁盘快照）,打开账本页与后台轮询都**不打** provider API。

## 状态

三个 tab 都已落地(界面规格的真源是 `src/client/`)。剩余缺口:

- 额度计划每个通道路由只收一个 API key(尚无多账户轮换)。
- `assistant/attempt`(流结束时没产出可见消息的那次尝试)当前不投影,补它得按 retry 生命周期配对
  尝试,是独立任务。
- 价是「当前价」而非账单,所以金额只覆盖近 30 天(见[它怎么记 token](#它怎么记-token))。
  **不做「价格生效时间轴」**(按段记生效时刻、好让历史金额按当时在用的价重放)是刻意的取舍:
  推理与实测误差见 [`docs/DESIGN.md`](docs/DESIGN.md) §5。
- **没有云端价源**:`pricing.json` 靠自己写(或用「查价」从 models.dev 一条条挑)。路由别名与
  厂商分组都不建模。

## 布局

```
src/
  index.ts            host: TokenUsageBook 服务(ctx.tokbook)+ 实时 hook
  config.ts           插件配置校验 + plans 覆盖层宽松 coerce
  types.ts            共享领域类型 + 纯领域值,host 与 browser 共用
  ledger.ts           数据目录解析 + owner 标记(单写者守卫)
  usage-record.ts     逐调用记录模型 + 会话事件投影
  usage-log.ts        按日 JSONL 存储(追加/去重/refile;去重状态按数据目录共享)
  session-usage.ts    会话视图的 host 侧:把某会话的账本行折成视图,并在请求时 join 会话日志拿轮次/步骤归属与用时(会话头部「词元」/「耗时」浮层读它)
  session-timing.ts   从会话事件量用时(墙钟 / 模型 / 首 token / 生成 / 工具);工具并行调用取并集,量不出来一律缺席而不是 0
  sync.ts             首次启动 + 手动历史回填(幂等)
  sync-state.ts       首次运行标记 + 持久化同步基线
  stats.ts            聚合(totals/byDay/byHour/(provider,model))+ 折叠 + 缓存
  price-format.ts     两半区共享的价文件内核:词表(保留键 / 长度上限)+ 取价规则(日内时段 / 星期集合 / 法定节假日年历)
  pricing.ts          价文件唯一真源(路由 → 模型串 → 当前价 + $billing/$calendar/$currency/$fx)+ 取价(基准价叠时段)+ costOf + 折出人民币计价表(cnyTable)
  pricing-view.ts     价格表 tab 的数据装配(路由目录 ∪ 账本 ∪ 价文件;卡带报价币种,视图带 $fx 与年历)
  models-dev.ts       models.dev 公共目录的拉取 / 归一化 / 采信边界(原厂 slug 清单;分裂价弃采)
  pricing-sync.ts     补价合并(纯函数):美元通道 × 账本用过 × 缺价格子,手写价永远赢
  pricing-sync-state.ts 日节流状态(models-dev-sync.json,不进 pricing.json)
  route-catalog.ts    路由目录:本机设置文档(settings)× 运行时适配器注册表(ctx.llm)
  window-usage.ts     用量明细三种切法(按通道的卡 / 按工作区 / 按模型)的**一趟**聚合
  quota.ts            官方额度归一化 + 内置计划身份
  quota-official.ts   key 解析 + 各通道官方用量抓取器
  quota-cache.ts      额度快照的磁盘缓存(stale-while-revalidate 的持久一侧)
  route-paths.ts      host 与 browser 共用的 HTTP 路径 / query 键词表(两半区唯一的真源)
  routes.ts           host 精确 Fetch 路由(handler / method 的真源)
  client/
    index.ts          client: apply(ctx),注册四个入口(主栏账本页 / 侧栏面板行 / 会话头部「词元」「耗时」按钮)
    contract.ts       最小 client 契约:插件被授予的 ctx/slots 面
    store.ts          面板行图标 ↔ 账本页共享视图 store
    ledger-clock.ts   全插件共享的「账本又落行了」探针(3 s 一次、只读内存),驱动各页跟着会话更新
    format.ts         纯展示 helper(日键、token/金额/时间格式化)
    icons.tsx         内联 SVG 图标(承 currentColor,跟随当前墨色)
    styles.ts         注入样式表入口(按 styles/*.ts 的顺序拼接——级联是契约)
    styles/           CSS 分片,按拼接顺序列出(重排即改级联):
      tokens.ts       全插件唯一的取值登记处(宿主变量 + 兜底 + 自有常量)
      page.ts         账本页外壳(页头 / tab 条 / 滚动主体 / 页脚)与侧栏面板行图标
      grid.ts         响应式网格系统(12 栏 + 卡片基元 + 容器查询断点)
      ledger.ts       用量总览
      method.ts       统计口径
      provider.ts     用量明细
      session.ts      会话头部「词元」「耗时」按钮入口与记号
      overlay.ts      两个会话浮层共用的外壳(原生 popover / 卡片 / 骨架与错误态)
      dial.ts         两个浮层共用的切分环表盘与圆心数字字形
      timing.ts       耗时浮层的相位读数表
      token-overlay.ts 词元浮层的四桶读数表
      quota.ts        订阅额度
      pricing.ts      价格表(选择带 / 四档价 / 峰谷时段 / 年历 / 汇率)
      shared.ts       跨面共用原语(面板材质 / 只读文本 / 选中态 / 窄屏与动效分支)
    TokBookPanelIcon.tsx sidebar.panellist 面板行图标(额度告急时多一个点)
    TokBookPanel.tsx  main 账本页(三 tab + 取数 / 跟账本刷新)
    LedgerView.tsx    用量总览的四块卡片(今日 / 趋势 / 构成 / 空态与骨架)
    ProviderPanel.tsx 用量明细卡外壳(窗口 + 三种切法)
    Breakdowns.tsx    用量明细的两种行清单:按模型 / 按工作区
    MethodDoc.tsx     统计口径 tab
    SessionOverlay.tsx 两个会话浮层共用的壳:取数 / 原生 popover 定位 / 打开才拉 / 卡片头与错误骨架
    SessionTimingEntry.tsx 会话头部的「耗时」按钮:浮层里一轮一张卡片,打开时才拉会话视图
    SessionTokensEntry.tsx 会话头部的「词元」按钮:圆心报词元合计,环按四桶摊开
    dial.tsx          两个浮层共用的切分圆环与圆心数字字形
    session-timing.tsx 耗时浮层的用时语言:切分环 / 相位读数表 / stepSegments / sumSegments
    session-wire.ts   会话视图的 wire → 视图反序列化(readSessionView:缺字段填中性值、坏字段不炸)
    ShareRing.tsx     用量明细一行的占比环(与额度表盘 / 价格表盘同族)
    pricing/
      currency.ts     报价币种纯逻辑:悬停的折算读数 / 切换币种时整条通道的换算(无 React,进 smoke)
      draft.ts        价格表纯逻辑:草稿 ↔ wire body、校验、脏签名(年历 / 汇率 / 报价币种)
      editors.tsx     行原语:四档价输入、峰谷时段编辑器、法定节假日年历编辑器、选中模型的详情面
      PricingPanel.tsx 价格表 tab 外壳:通道/模型两个下拉 + models.dev 补价条 + 年历 + 汇率行 + 自动保存状态
    quota/
      metrics.ts      订阅额度纯规则:占比/语气/口径/文案(无 React)
      QuotaCard.tsx   订阅额度卡:卡壳 + ok 主体 + 余额/无订阅面板 + gauge/骨架
      QuotaSection.tsx 订阅额度区:取数 + 刷新策略 + 卡片排序(嵌在总览下方)
scripts/
  build-client.mjs         构建 lib/index.js + lib/client.js(懒加载 CJS),并校验 bundle 接线契约
  preview-overlay.ts       账本页预览台(fixture 数据)与独立查看器(--ledger,读真账本)
  smoke.ts                 纯逻辑冒烟:投影 / 聚合 / 取价(时段 / 年历 / 币种)/ 草稿与写路径 / 路由·工作区 / 额度(一条不变量一个断言)
  selfcheck-rebuild.ts     账本不变量:折叠无损重建 / refile / 跨实例去重 / 价格签名 / 重启基线 / 派生态自证 / seeded 会话同步
  selfcheck-ui.ts          界面禁令静态检查:死类双向 / 色值 / 虚线 / 圆角 / 宿主变量白名单 / 动效·焦点·窄屏分支 / ARIA 引用

docs/                      文档树(地图:docs/INDEX.md):CONTRACTS 契约 / DESIGN 推理 / HMR / LESSONS / CONTEXT / adr
cordis.patch.yml           bundle 层:选中后由 DSH 插入 tokbook 行(见「安装」)
cordis.patch.example.yml   给那一行改 config 的覆盖示例
lib/                       构建产物(随 git 发布):lib/index.js + lib/client.js + lib/types/**/*.d.ts
```

## 构建

```sh
pnpm install      # 安装 @deepseek-ai/cordis、react、esbuild、typescript
pnpm build        # tsc 产出 lib/types/*.d.ts,再由 esbuild 打包 host + client
pnpm typecheck    # 只查 src/ 的类型(不构建)——`pnpm build` 里已含 `tsc -b`,这是轻量替代
pnpm selfcheck    # 账本不变量:折叠重建 / refile / 跨实例去重 / 价格签名 / 重启基线 / 派生态自证 / seeded 会话同步
pnpm selfcheck:ui # 界面禁令的死类双向 / 硬编码色值 / 虚线 / 圆角 / 宿主变量白名单 / 动效·焦点·窄屏分支 / ARIA 引用
pnpm smoke        # 纯逻辑冒烟(投影 + 聚合 + 取价 + 草稿 + 额度);加 `--only <节名子串>` 只跑命中的那几节
pnpm test         # smoke(投影 + 聚合 + 取价 + 草稿 + 额度)+ selfcheck + selfcheck:ui
```

产物:`lib/index.js`(host)、`lib/client.js`(browser)、`lib/types/**/*.d.ts`(声明);external 清单见 `scripts/build-client.mjs`。
`lib/` 随 git 发布,`prepublishOnly` 在发布 npm 包前再构建一次;从 git 安装不再跑构建脚本,所以改完 `src/` 要 `pnpm build` 并把 `lib/` 一起提交。

## 对着源码检出开发

`pnpm watch` 只产出 `lib/types/*.d.ts`(`tsc --watch`);要 `lib/index.js` / `lib/client.js` 请跑 `pnpm build`。

不启 DSH 也能看账本——**独立查看器**:同一个页面壳与同一份 client bundle,`/tokbook/*` 由真的 host 插件作答,只读本机账本目录。它不提供 `sessionPersistence`,所以只看**已入账的历史**:补录新会话的「重新扫描」在这里回报 skipped。

```sh
pnpm ledger                                                 # 默认账本目录($DSH_HOME/tokbook)
node --experimental-strip-types scripts/preview-overlay.ts --ledger D:/data/tokbook     # 或指定别的目录
```

页面壳自己供一套 DSH 的 `--dsw-alias-*` 色板(按宿主真实取值,浅 / 深两套),账本页铺满整个视口
——所以不装宿主也能按真实皮肤看。

不带 `--ledger` 时同一个脚本退化成 **fixture 预览台**,用来看 UI 的各个状态与空态:
`?dark=1` / `?tab=` / `?quota=<模式>` 换皮肤、tab 与额度场景,`?view=timing` 显形**会话头部**(词元 / 耗时两颗按钮都在)
(模拟会话头部,浮层形状由 `TOKBOOK_SESSION_SCENARIO=rich|one|empty` 按进程选,默认 `rich`);整台的形状
(四路皆空 / 四路皆 500 / 诊断带的两态)由 `TOKBOOK_MODE=empty|err|sync|syncerr` 按进程选;
`lib/client.js` 按请求读盘,所以 `pnpm build` 之后刷新页面即可。

## License

[MIT](LICENSE)
