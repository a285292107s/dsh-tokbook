# dsh-tokbook

> **Doc meta** · role: entry · language: zh-CN · status: current · last-reviewed: 2026-09-23 · supersedes: —

DeepSeek Harness(DSH)的**跨会话 token 用量账本**插件。host 半区把每次通道计费模型调用折成
一行、写入按本地日持久化的 JSONL 账本,再对外提供**带成本**的聚合;browser 半区从**侧边栏
footer 按钮**(`sidebar.footer.action`)弹出**浮窗**(`shell.overlay`),内含五个 tab(按界面
从左到右):**用量总览**(今日 + 词元构成 + 近 14 天趋势)、**订阅额度**(用你的 key 向通道查
账户级官方用量)、**用量明细**(窗口 × 按模型 / 按工作区 / 按通道)、**价格表**(选一个通道 +
模型,编辑它的调价史)、**统计口径**(不估算的口径、漏项与对账)。

两条贯穿全插件的原则:

- **只记真实的计费调用。** `assistant/message` 上报的 `usage`、压缩 summarize 调用、失败尝试。
  通道没上报用量的调用**仍写一行、仍计入次数**,但没有 token 可加——**未知不等于 0**,不估算。
- **金额由你自己写价。** 一份 `pricing.json`(路由 → 精确模型串 → 价段),按每条记录**自己的
  时间戳**取价,金额分「**实际支出**」与「**订阅价值**」两桶。没定价的是**价格未知**(按 ¥0 计,
  但会在界面上列出来);费率为 0 才是免费。

界面词与代码/契约的逐条对应见 [`docs/CONTRACTS.md`](docs/CONTRACTS.md) 的「术语」段。**界面规格的真源是代码**:
token 与「什么时候用哪个」在 `src/client/styles/tokens.ts` 的注释里,各个面长什么样看 `src/client/styles/**`;
静态可判定的那批禁令由 `pnpm selfcheck:ui` 强制,其余要人看。文档树地图见 [`docs/INDEX.md`](docs/INDEX.md)。

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
  price-format.ts     价格表时间轴的纯规则(整点生效 / 每日时段 / 星期几 / 冲突)+ 价文件共享词表(保留键 / 长度上限),与 browser 共用
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
    FooterButton.tsx  sidebar.footer.action 触发器(额度告急时多一个点)
    LedgerOverlay.tsx shell.overlay 浮窗外壳(五 tab + 焦点/快捷键)
    LedgerView.tsx    用量总览 tab
    ProviderPanel.tsx 用量明细 tab 外壳(窗口 + 三种切法)
    Breakdowns.tsx    用量明细的两种行清单:按模型 / 按工作区
    MethodDoc.tsx     统计口径 tab
    pricing/
      axis.ts         调价史轴纯几何:节点落位 / 估宽 / 最小间距(无 React,进 smoke)
      Timeline.tsx    详情面里那条调价史轴(首记 ↔ 今天)
      draft.ts        价格表纯逻辑:草稿↔wire 转换、校验、签名(未保存标记)
      editors.tsx     行原语:四档价输入、价段编辑器、选中模型的详情面
      PricingPanel.tsx 价格表 tab 外壳:通道/模型两个下拉 + 保存状态 + 选中模型的调价史
    quota/
      metrics.ts      订阅额度纯规则:占比/语气/口径/文案(无 React)
      QuotaCard.tsx   订阅额度卡:卡壳 + ok 主体 + 余额/无订阅面板 + gauge/骨架
      QuotaPanel.tsx  订阅额度 tab 外壳:取数 + 刷新策略 + 卡片排序
scripts/
  build-client.mjs         构建 lib/index.js + lib/client.js(懒加载 CJS)
  preview-overlay.ts       浮窗预览台(fixture 数据)与独立查看器(--ledger,读真账本)
  smoke.ts                 聚合 + 计价 + 额度的纯逻辑冒烟测试(一条不变量一个断言)
  selfcheck-rebuild.ts     账本不变量:折叠无损重建 / refile / 跨实例去重 / 价格签名 / 重启基线
  selfcheck-ui.ts          界面禁令静态检查:死类双向 / 色值 / 虚线 / 圆角 / 宿主变量白名单 / 动效·焦点·窄屏分支 / ARIA 引用
```

## 构建

```sh
pnpm install      # 安装 @deepseek-ai/cordis、react、esbuild、typescript
pnpm build        # tsc 产出 lib/types/*.d.ts,再由 esbuild 打包 host + client
pnpm typecheck    # 只查 src/ 的类型(不构建)——`pnpm build` 里已含 `tsc -b`,这是轻量替代
pnpm selfcheck    # 账本不变量:折叠重建 / refile / 跨实例去重 / 价格签名 / 重启基线
pnpm selfcheck:ui # 界面禁令的死类双向 / 硬编码色值 / 虚线 / 圆角 / 宿主变量白名单 / 动效·焦点·窄屏分支 / ARIA 引用
pnpm smoke        # 纯逻辑冒烟(聚合 + 计价 + 额度);加 `--only <节名子串>` 只跑命中的那几节
pnpm test         # smoke(聚合 + 计价 + 额度)+ selfcheck + selfcheck:ui
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
活着时(见 [`docs/HMR.md`](docs/HMR.md)),`pnpm build` 会经 `dsh-hmr` 行热替换 **host** 半区;
browser 刷新页面拾取,链没活着时硬刷新永远是兜底。

## 对着源码检出开发

`pnpm watch` 只产出 `lib/types/*.d.ts`(`tsc --watch`);要 `lib/index.js` / `lib/client.js` 请跑 `pnpm build`。

不启 DSH 也能看账本——**独立查看器**:同一个页面壳与同一份 client bundle,`/tokbook/*` 由真的 host 插件作答,只读本机账本目录。它不提供 `sessionPersistence`,所以只看**已入账的历史**:补录新会话的「重新扫描」在这里回报 skipped。

```sh
pnpm ledger                                                 # 默认账本目录($DSH_HOME/tokbook)
node --experimental-strip-types scripts/preview-overlay.ts --ledger D:/data/tokbook     # 或指定别的目录
```

页面壳自己供一套 DSH 的 `--dsw-alias-*` 色板(按宿主真实取值,浅 / 深两套),浮窗还额外穿一层
**设备皮**(`styles/device.ts` + `tokens.ts` 第八节,只在根元素带 `data-dtpl-device="light|dark"`
时生效)——所以不装宿主也能按真实皮肤看。

不带 `--ledger` 时同一个脚本退化成 **fixture 预览台**,用来看 UI 的各个状态与空态:
`?dark=1` / `?tab=` / `?quota=<模式>` 换皮肤、tab 与额度场景,整台的形状(四路皆空 / 四路皆 500 /
诊断带的两态)由 `TOKBOOK_MODE=empty|err|sync|syncerr` 按进程选;`lib/client.js` 按请求读盘,
所以 `pnpm build` 之后刷新页面即可。

## 它怎么记 token

host 监听持久化 `session/event` 流,把每次通道计费模型调用折成一行 JSONL 写进数据目录(默认
`$DSH_HOME/tokbook/`,可用 `path` 配置)。**事件 → 行的逐条投影在 `src/usage-record.ts`**:

- **用量未知 ≠ 0。** 通道没上报 `usage` 的计费调用(中途取消的请求、没回报用量的 summarize)
  **仍写一行、仍计入请求次数**,但四个 token 桶一个都不加,也不按 0 词元冒充。
- **新鲜度不靠读路径等。** 打开浮窗那次读只做**廉价探测**(列会话 + 比对变更签名);要折叠时才把
  **权威 walk 排到后台**并按 15 s 节流——账本最多晚一个节流窗口,要立刻全量走一遍用**重新扫描**。
  walk 在跑时浮窗靠只读探针 `/tokbook/sync` 把状态追到落定(页脚那句「正在重新扫描…」/「上次重新
  扫描失败:…」),落定后再拉一次概览。

### 一个数据目录,一个写入进程

账本、折叠、解析缓存与 refile 都假设**单个 host 进程**写给定数据目录:启动写 `owner.json` 标记
(pid + 启动时间),**检测到存活的异进程已占用时告警**(陈旧标记静默接管)。第二个 host 请指向
自己的 `path`(见 [配置](#配置));去重与热重载边界见 [`docs/HMR.md`](docs/HMR.md)。

## 成本与价格表

每条记录按**它自己的时间戳**计价,分**两级**:先取该 (通道路由, 精确模型串)「最后一段 `from ≤ 该时刻`」
的价,再在该段内按记录**本地时间**取生效的**峰谷时段**(没被时段覆盖的时间按该段**基准价**)。于是
**一次改价会重算全部历史金额**;一条 (路由, 模型) 没有价段、或记录落在最早一段价**之前** → **价格未知**
(按 ¥0 计)——**每一段价都必须有生效时刻**,没有「兜底价」那种形态。

金额拆成两个桶,浮窗分开显示、绝不混为单一「支出」:**实际支出**(`spend`)= `metered` 路由的
真金白银;**订阅价值**(`subscriptionValue`)= `subscription` 路由按你写的价折算的「省了多少」,
**不是现金**。计费性质是**通道路由**属性(价表 `$billing` 的一条),省略按 `metered`。

价格**全部由你自己写**,只有一份文件 `pricing.json`(默认 `$DSH_HOME/tokbook/`):路由 → 精确模型串 → **价段
数组**(`from` 生效时刻 + 四档 ¥/M 价 + 可选 `slots` 峰谷时段)。字段与校验的真源是 `src/types.ts`
与 `src/pricing.ts` 的 `parsePriceInput`(写入 handler 只做传输);畸形文件只把受影响的 (路由, 模型) 降级为价格未知(¥0)。
旧版文件里「省略 `from`」的兜底段仍读得进来:它在**读**路径上被迁移成真实日期——该模型首记那一刻
(没有记录就用今天),金额因此不变,下一次保存文件就写成新形态;新写入不再接受这种段。

**两种货币只活在读写面上。** 价文件里的数**永远**是人民币/百万词元,第三个保留键 `$fx`
(`{ cnyPerUsd: 7.15 }`)只是价格表这一屏的汇率:切到美元时四档价按它换算着显示,你在美元面敲进去的
数按它换算回人民币落盘。所以 host 的计价路径从不读 `$fx`,切币种不改动也不弄脏任何一行,改汇率只改
换算读数、不动已写的价,其余 tab 的金额一分不变。汇率手填(不联网)、可以不填——没填就没有美元面
(那是「换算不出来」,不是「按 1 算」)。

**价格表 tab** 一屏只面对**一个模型**:先用两个下拉选「通道」与「模型」(选项文字自带「N 次」
「N 个模型未知」「价格未知 / 未保存」这类摘要——「这张表有没有洞」不必点到才看得见)。下面是这个模型的全部价:每张卡是
**一段从某个时刻起生效的价**(`from` 必填、按序号排开),一张卡里四档价紧挨成一簇——**段卡各写各的
四档、互不沿用**,只有卡里的**峰谷时段**才留空沿用(缓存读 / 写没有单独定价时按输入价计,格子里报的
就是那个数)。上面那条**调价史轴**从左端「最早一段价」画到今天,还没价的行走径就是一条暗淡的空轨。
按量 / 订阅的开关在详情头上——它改的是**通道**的计费性质。规则见
[`docs/CONTRACTS.md`](docs/CONTRACTS.md) §2,其余交互(自动保存 / 未保存圆点)见
`src/client/pricing/`——真源是代码。

**汇率换算**也在这条选择带上(选完模型之后那第三行):填「1 美元 = N 元」,详情头上的**货币开关**
(`¥` / `$`)就切四档价的读写单位。美元面下你直接输厂商报的美元价,落盘的是换算后的人民币;每格的
悬停提示附上它换算自的人民币原值,所以「显示的是透镜」这件事随手可核。汇率本身也是价文件内容
(保留键 `$fx`),自动保存、未保存圆点、状态栏与别的字段同一套。

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

### 官方账户用量(订阅额度 tab)

这个 tab **用你的 key 从通道自己的账户 API 拉账户级订阅用量**——所以它反映共享该订阅的*所有*工具 /
设备,本地 token 账本做不到。目前覆盖 Command Code 与 OpenCode Go 两个内置计划。

- **无 key → `unconfigured` 卡;拉取失败 → `error` 卡**,两者都**绝不回退到本地估算**;**browser 从不持有
  key**。逐通道端点与取数策略见 `src/quota-official.ts`、套餐失效判定见 `src/quota.ts`。
- **有 key 但没有生效订阅不是错误**:按 provider 自己报的东西分成 `balance`(只有余额约束用量)与
  `none`(只报窗口百分比,如 OpenCode Go 的 403「有效 key,无 Go 订阅」)两档状态卡;门只从**真的
  答复了**的端点推导,网络故障绝不写成「没订阅」。
- 侧栏按钮上那一点 = **最近一次成功快照**里有窗口接近或超过上限;它由 `GET /tokbook/quota` 的磁盘
  读推出,打开浮窗与后台轮询都**不打** provider API。

## 状态

五个 tab 都已落地(界面规格的真源是 `src/client/`)。剩余缺口:

- 额度计划每个通道路由只收一个 API key(尚无多账户轮换)。
- 云端价格镜像(参考价表 / 厂商分组 / 包装路由别名)已整体移除,后期作为独立任务重做——
  背景见 [`docs/DESIGN.md`](docs/DESIGN.md) 顶部「阅读指南」（第三期）。
