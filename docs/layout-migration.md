# 布局与框架适配

维护日期：2026-10-13。原项目只读：`/Users/leonwillow/Downloads/shadcn-nextjs-aidesk-app-template-1.0.0`。

| 来源 | 当前实现 | 必要适配 |
| --- | --- | --- |
| 原 `src/app/layout.tsx` 与 dashboard layout | `main.tsx`、`routes/__root.tsx`、`components/layout/root-layout.tsx`、`workspace-layout.tsx` | HTML 与 CSR 入口分离；Next 路由改 TanStack；不迁入 SSR/RSC |
| 原 `src/components/layout` | `apps/web/src/components/layout` | 保留图标栏和菜单组合，中文、可访问名称、真实路由及认证数据 |
| 原 `src/components/ui`、`src/lib/utils.ts` | `packages/ui/src/components`、`lib/utils.ts` | Base UI / base-mira 结构与交互，工作区导入和共享尺寸适配 |
| 原 globals.css、主题配置、字体目录 | 共享 globals.css、Web configs 与 fonts.css | 语义令牌、本地 Fontsource latin 字体；Geist Pixel 字体及许可证保留 |
| 原 settings context 和 cookie 持久化 | `stores/theme-store.ts`、`theme-effects.tsx`、`lib/theme-settings.ts` | Zustand、localStorage、跨窗口同步；首屏仍通过 theme-script 初始化 |
| 原导航和搜索数据 | `assets/data` | 中文化与 TanStack 路由类型约束 |

根路由挂载主题和提示宿主；工作台 `beforeLoad` 查询 `/api/access` 的真实会话与授权，未登录跳转登录页，无权访问进入权限说明页，服务故障呈现可重试错误视图。登录和注册关闭说明位于工作台外。侧栏、搜索、个人菜单与直接导航共用 `packages/access` 的规则，根地址进入首个获授权功能；未分配功能时提供联系管理员和刷新权限入口。回到窗口或页面恢复可见时重新校验。

侧栏齿轮对管理员和普通人员统一进入 `/settings/profile`，个人菜单只保留个人资料与退出操作。管理员使用独立的“管理中心”盾牌菜单进入“人员与权限”（`/admin/users`）；菜单沿用原 `AuthLinksMenu` 的 DropdownMenu / Tooltip 组合，入口集中在 `adminNav`，普通人员不渲染该菜单。搜索分别归类“个人设置”和“管理中心”，继续按共享权限规则过滤。原在线消息设置快捷图标撤下，既有地址仍可通过搜索访问；原认证页面快捷菜单已移除。

人员视图位于 `views/admin/users`，沿用原 `src/views/settings/teammates` 的页头、表格、表单弹窗结构；原 `src/components/ui/table.tsx`、`badge.tsx` 迁入共享 UI，替换导入并使用语义字号。原演示数据和团队 Store 没有迁入，改用 Eden 的真实人员、授权与操作记录；弹窗按打开状态重新挂载，不持久化凭据。旧 `/settings/teammates` 仅在管理员校验后跳转到新地址，普通人员直接访问新旧地址均被拒绝。个人设置仍为现有预留页面，未在本次导航调整中实现资料编辑。

既有其他业务页继续保留空内容，本次只连接权限入口，不生成业务数据。知识库子页迁入内容时须给父路由增加 Outlet。人员列表在小窗口局部横向滚动，弹窗在短窗口纵向滚动，键盘可抵达操作按钮；Escape 关闭后焦点返回触发位置。

Web 默认资源 base 为 `/`。子路径构建使用 Vite `--base=/desk/`，Router 从 `import.meta.env.BASE_URL` 读取同一个前缀，托管端按该前缀配置 SPA fallback。不能把 JS/CSS 请求重写成 HTML。构建与验证示例见 [工程验证](./engineering-verification.md)。

未来使用 `file:` 的 renderer 仍选择 hash history；需要单独按本地资源方式构建和验证 Cookie、Origin、CORS、协议及 Electron 安全边界。当前不把这一分支当作桌面兼容性证明。

`next-themes` 继续用于客户端明暗模式和系统主题监听；没有 Next.js 运行时。布局复用已有 DOM/控件结构；尺寸和缩放改共享令牌，不借统一样式重写交互。认证来源见 [认证迁移](./auth-migration.md)，主题实现见 [自定义主题](./custom-theme-migration.md)。

资金分析的二级案件栏复用原 `KnowledgeBaseSidebar` 的标题、列表、共享按钮和边框结构，增加悬停/焦点展开与固定按钮。固定偏好现已归工作台单个二级菜单框所有（见下方统一菜单说明），按用户 ID 保存；48rem 以下使用浮层，选案或关闭后让出正文。主侧栏仍只有一个资金分析入口，案件管理下拉框已移除。

2026-10-08：主图标栏改用共享 `workspace-rail` 宽度（3rem，原 4rem），Logo、主导航和底部按钮的方形区域统一为栏宽的黄金比例（约 61.8%）。两侧等宽留白扣除分隔线后计算，组内图标间距与组首、组尾留白均复用同一值，不把每个图标所在行设为正方形。Logo 四向留白保持一致，工作区顶栏同步共用 3rem 高度，分隔线仍对齐。主导航、个人设置和管理中心统一使用 `workspace-nav-item`，选中、悬停和展开均使用 `primary/10` 背景及 `primary` 图标色；导航范围内覆盖 ghost 按钮的展开灰底，解决资金菜单展开后选中色与收件箱不一致。保留 `aria-current`、`aria-expanded`、Tooltip、键盘焦点与菜单交互，移除主导航和设置的伪元素竖线及管理中心的竖线 span。共享 Button 增加 `icon-workspace` 尺寸变体，其他尺寸及通用行为保持不变。

选中样式验证：资金分析（菜单展开）、收件箱、个人设置与管理中心的选中背景/前景计算值一致，伪元素竖线和管理中心标记均已移除；深色模式保持语义颜色，导航与键盘焦点可用。

比例与间距验证：中档栏宽约 45.6px、方形图标区域约 28.18px，左右及导航组顶部留白、相邻图标间距均约 8.20px；特大档分别约 50.4px、31.15px、9.13px，比例保持 61.8%。三处工作区顶栏分隔线一致，详情面板姓名和卡号无垂直溢出。390px 窄窗口无横向溢出，Tab 焦点可见；验证后恢复原窗口、中档缩放及浅色。Lint、类型检查、65 项 UI 测试与生产构建通过，构建保留既有 G6 大分包提醒。

2026-10-08：资金分析沿用原 Inbox 的 `min-h-0` 弹性内容区与内部滚动方式，从工作台可视高度逐层约束页面、账户目录、页签及结果区；图形自适应剩余高度，流水表独立滚动且表头、分页常驻。资金案件管理及其他模块不改变滚动方式。

2026-10-11：文书工作区改为类型列表 + 类型内文书表格。侧栏在 `components/layout/document-type-sidebar.tsx`，沿用资金案件栏的 `workspace-menu`、`workspace-header` 和留白令牌，窄窗使用共享 Sheet；表格采用原 contacts/table 的工具栏、内部滚动和分页结构。文书新增与编辑复用原 contact-dialog 的共享 Dialog 组合，在弹窗中完成，原表格和筛选保留；左侧简要表单及可折叠补充字段，右侧自动 Word 预览，窄窗上下排列。模板管理通过管理员入口进入。类型选择由路由 `typeId` 保留，业务状态按类型隔离；具体规则与验证见 [文书取号](./document-numbering.md)。

2026-10-13：文书类型栏改为与案件一致的悬停浮层，移至工作台布局按授权挂载。将案件原有悬停、180ms 关闭宽限、键盘和固定偏好逻辑提取至 `use-workspace-menu.ts`，两个模块直接复用，原案件偏好键及拖动保护保留。文书菜单默认浮动；固定后只在文书区宽窗口让出正文空间，窄窗仍浮动，替代此前单独的 Sheet。主图标关联菜单的 `aria-controls` / `aria-expanded`，键盘右方向键进入搜索框，Escape 返回图标；管理员模板入口通过文书路由的 `view=templates` 参数衔接。

2026-10-13：按 Codex 导航的保持逻辑调整悬停范围。已展开的案件或文书菜单在主导航图标间空白处继续保持，空白本身不打开菜单；离开主导航及弹出菜单后才延迟收起。移到另一个主图标时关闭原浮层并按该图标切换，避免两个浮层叠加；点击空白也不关闭。固定和键盘行为沿用共享逻辑。

2026-11-04：新增笔录主图标及案件文件夹二级栏，复用 `use-workspace-menu`，主图标协调三个业务菜单的浮层切换；固定偏好按用户独立存储，窄窗保持浮层。案件内列表和笔录编辑放在 `views/inquiries`，使用当前 React/Base UI 和 Eden，功能来源为只读 haoji 项目。编辑器宽窗三栏、窄窗页签切换，路由保留案件与笔录 ID；实现和验证见 [笔录功能](./inquiries-migration.md)。

2026-11-04：资金案件、文书类型和笔录案件共享工作台中的一个二级菜单框。`WorkspaceNavigationProvider` 唯一创建固定开关、展开状态、当前内容、面板引用和关闭计时器；`WorkspaceSecondaryMenu` 唯一挂载 `WorkspaceMenu`，切换模块仅更新标题、工具栏和正文，外框及最右侧固定按钮保持同一个节点。主图标的 `aria-controls` 全部指向 `workspace-menu`，只有当前显示内容对应的图标为展开。悬停、键盘、拖动保护仍由同一控制器处理。

固定/取消固定对整个框生效，资金 → 文书 → 笔录切换时保持相同状态；窄窗使用可关闭浮层，固定偏好仍保留。无二级内容的页面不显示空框，返回有二级内容的模块后继续使用统一偏好。文书目录、笔录资源及各模块搜索/归档/编辑草稿仍按业务管理，业务菜单 Hook 持续挂载，弹窗在框外，不随菜单关闭或内容切换丢失。

统一偏好键为 `workspace-menu:v1:<userId>`。首次升级时，任一旧菜单固定则沿用固定；写入成功后清理该用户原来的 `funds-case-menu`、`document-type-menu`、`inquiry-case-menu` 三个键。新键（包括取消固定）始终优先，不再读取各模块各自的固定状态；存储不可用时本次操作仍有效。其他窗口只同步这一份偏好。

统一状态验证：Lint、类型检查、UI 测试及生产构建通过；新增 6 项回归测试覆盖跨模块固定/取消、临时关闭、偏好合并、用户隔离、损坏及写入失败。浏览器实测资金 → 文书 → 笔录时始终只有一个框，外框、顶栏和固定按钮的节点保持一致，固定时正文左边界不变；在笔录取消固定后，文书和资金都变为浮动，刷新恢复同一状态。ArrowRight/ Escape、浮层关闭后业务弹窗保留以及 390px 窄窗关闭但保留固定偏好均正常；返回桌面并刷新继续固定，浏览器无警告或错误。

2026-11-04：共享二级菜单在浮动时与主图标栏、窗口上下边缘留出 0.75rem，增加完整边框、圆角和阴影，呈现独立窗口。停靠时继续使用全高贴边布局，三个模块仍共用同一外框及固定偏好。左侧视觉间隙通过外框伪元素形成透明悬停通道，鼠标慢速移入或暂留间隙不会触发延迟关闭；正文继续独立滚动，Tooltip 可越过边框显示。窄窗最大宽度扣除双侧留白，间距随共享 rem 缩放。

浮窗验证：中档的左/上/下间距均约 11.4px，特大档约 12.6px；320px 窄窗触发最大宽度限制后，左右仍各留约 12.6px，320px 与 390px 窗口均无横向溢出。浏览器确认间隙命中共享外框，经过间隙进入菜单保持展开、移出自动关闭；固定后边距和圆角归零、只保留右分隔线。跨模块固定/取消、刷新恢复、ArrowRight 进入搜索与 Escape 返回图标正常，明暗主题外观已核对，验证后恢复原窗口和中档缩放。Lint、类型检查、74 项 UI 测试、生产构建与差异检查通过，浏览器无警告或错误；构建保留既有大分包提醒。截图：`apps/web/.impeccable/review/workspace-menu-floating.jpg`。

2026-11-04：二级菜单固定后，主图标的悬停与普通焦点只呈现图标反馈，不替换已显示的菜单内容；点击或 Enter 激活导航后才切换。共享 reducer 区分 `preview` 与显式 `show`/`route`，固定偏好在窄窗下也遵守这一规则；取消固定后恢复悬停预览。右方向键及 Tab 仍能进入当前固定菜单的搜索框，其他图标先通过 Enter 激活。文书页头移除独立的侧栏开关图标，继续通过主导航访问类型菜单；空状态的“打开文书类型列表”保留。


2026-11-04：固定二级菜单与正文接入 ReUI `@reui/c-resizable-5`。`WorkspacePanels` 组合官方 `ResizablePanelGroup`、`ResizablePanel` 和 `ResizableHandle`，使用原版胶囊手柄的悬停、按下尺寸与 300ms 缓动；未自行实现拖拽、命中范围或键盘算法。共享组件通过 shadcn CLI 读取官方 registry，依赖为 `react-resizable-panels` 4.18.0；仅适配共享 cn、类型导出和仓库注释。

两个 Panel 保持挂载。停靠时菜单填满左 Panel，分隔条取代原右边框；浮动或进入无菜单模块时，左 Panel 的最小/最大宽度归零、分隔条隐藏并禁用，菜单使用原浮窗定位，正文占满余下空间。左 Panel 内层允许溢出，浮窗仍相对整个 Group 定位，不受零宽占位裁剪。固定状态切换和视口断点变化不重建右侧编辑器。

宽度由同一个工作台 Provider 持有，按用户保存到 `workspace-menu-width:v1:<userId>`，与固定开关键分离。以 rem 保存，三个模块共用；只在 ReUI `onLayoutChanged` 确认用户拖动/键盘操作结束后写入。回调使用官方提交的布局比例换算宽度，避免键盘回调先于 DOM 更新时保存旧尺寸。窗口缩窄、取消固定和程序性布局恢复不写入偏好；恢复大窗口时重新应用原宽度。存储不可用时本次调整仍有效，其他窗口通过 storage 事件同步。

分栏验证：Lint、类型检查、88 项 UI 测试、生产构建和差异检查通过，构建仍有既有大分包提醒。浏览器确认鼠标拖动、方向键及 Home/End 调整、刷新恢复、资金/文书/笔录共用宽度与跨窗口同步正常；固定切换保留编辑器展开状态。800px 窗口暂时约束菜单宽度，390px 窗口恢复浮层并隐藏分隔条，均无横向溢出，回到大窗口恢复原宽度；明暗主题及小档/特大档 rem 缩放已核对。截图：`apps/web/.impeccable/review/workspace-menu-resizable.png`。
