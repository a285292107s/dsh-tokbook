# ADR 0002 — 侧栏项目行的用量入口走 DOM 注入，不给 DSH 本体加 slot

> **Doc meta** · role: reason · language: zh-CN · status: draft · last-reviewed: 2026-10-17 · supersedes: —

- **状态**：已接受（2026-09-30），但**尚未实现**——`src/` 里从没有过它的代码（全历史可查），
  当前 client 半区只注册三个 slot、没有任何宿主 DOM 注入。所以本文记的是**打算怎么做**，
  不是现状；读了它别以为界面上已经有那枚图标。
- **决策**：侧栏**项目行**里那枚「看这个项目的用量」图标，由插件 client 半区**往宿主 DOM 里注入**
  （项目行行尾的操作容器里、⋯ 之前），**不给 DSH 本体加 slot**。图标是纯图标（悬停出工具提示），
  点击打开已有的浮窗并落到「用量明细 · 按工作区」；**未归属分组上不出现**这枚入口。
- **随之定下的口径**：筛选**只作用于下方清单**——头部的窗口合计与每一行占比环的分母仍是**整个窗口**，
  没有任何数字跟着筛选变（否则同一个窗口会有两种合计）；从项目行进来时默认窗口是**近 7 天**，
  与用量明细面板自身的默认一致，不引入第二个默认。这两条都只改 client 半区，host 与账本一行都不动。

## 事实（决定这条的原因）

- 宿主（`@deepseek-ai/dsh`，版本见 `dsh --version`——不在本文写死）在侧栏声明了 5 个会话/目录用的
  子槽：`sidebar.workspaces` 底下三个（`session.menu.item` / `session.row.action` / `directoryFlow`），
  另外两个在 `sidebar.session.row.leading` / `sidebar.session.row.hover`，
  **全是会话行或目录选择器用的**。项目行（`ProjectRowItem`）里的 ⋯（重命名/删除）与 ⊕（新会话）是
  硬编码的 `Menu` / `Button`，没有任何 `renderSlot` 调用。
- slot 注册 API 对**未声明**的键直接抛错（`dsh-client-ui-slots` 的 `SlotCore.register` 文档原话：
  「registering into an undeclared slot throws」）。所以「把图标注册进项目行」这条路不存在。
- 项目行在 DOM 里带 `data-row-key="workspace:<workspaceId>"`；未归属分组是 `workspace:`（空 key，
  `buildGroup('' , undefined, …)`）。这个 `workspaceId` 与账本侧 `WorkspaceUsageRow.id`（`src/window-usage.ts`
  的 `byId` 键）**是同一个值**——因此「哪一行 = 哪个项目」不需要新增 host 路由。
- 本插件的其余 UI（footer 按钮、浮窗、会话词元页）全部注册进宿主**已声明**的槽（DESIGN §6.0 路线 A），
  **这枚图标将是唯一的例外**。
- 改 DSH 本体加 slot 的代价：补丁只能落在**全局 npm 安装**的
  `@deepseek-ai/dsh-client-ui-workspace/lib/client.js`（打好的 bundle，不是源码）——`npm i -g` 一升级就没了，
  得在仓库外另养一份重放脚本 + 缺失自检，且上游一改 `ProjectRowItem` 的代码形状，脚本里的锚点就失效。

## 被否决的方案

- **改 DSH 本体，在工作区行声明一个新 slot（如 `sidebar.workspaces.workspace.row.action`）**：位置、悬停
  显隐、主题、无障碍、与 ⋯ 的先后都由宿主保证，插件侧最干净。但为**一枚图标**换来一条跨仓库的长期维护面
  （升级即丢 + 补丁脚本跟着上游代码形状走），且补丁落在两个仓库之外的 `node_modules` 里，任何一次干净重装
  都会静默失效。
- **挂到会话行已有的 `sidebar.workspaces.session.row.action`**：合法、零风险、马上能做，但它回答的是
  「这个**会话**花了多少」，不是「这个**项目**花了多少」——正是这次要的东西。
- **遮蔽整个 `sidebar.workspaces`（single 槽，可被替换）**：等于重写侧栏的会话浏览、搜索、拖拽排序，
  与「加一枚入口」完全不成比例。

## 后果

1. 宿主 DOM 改了（`data-row-key` 前缀、或行尾那个操作容器换了结构）时，这枚图标会**静默消失**，插件其余部分
   不受影响。排查入口就是上面点名的两个 DOM 坐标——这也是这份 ADR 存在的主要理由：代码里只看得见
   「按某个选择器找宿主行」，看不出「为什么这里不走 slot」。
2. 宿主是 React 渲染的，行会整块重建，所以注入的节点必须在每次重渲染后**重新对位**：client 半区需要一条
   幂等、可卸载的观察—对位循环，而不是一次性插入。
3. 图标是**我们自己的 DOM**：尺寸、墨色、悬停显隐、焦点环都得自己跟宿主 token 对齐，**不能**复用宿主的
   CSS module 类名（那些名字是 hash 过的）。
4. 注入节点是宿主容器里的**外来子节点**：宿主重渲染时可能把它的位置挪到 ⋯ 之后。对位循环因此要
   **校正位置**，而不只是「存在就不管」。
5. 升级 DSH 后要重新确认注入点还在；这条确认与 §1 的静默失效是同一件事的两面。
