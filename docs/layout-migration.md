# 布局与框架适配

维护日期：2026-10-08。原项目只读：`/Users/leonwillow/Downloads/shadcn-nextjs-aidesk-app-template-1.0.0`。

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

资金分析的二级案件栏复用原 `KnowledgeBaseSidebar` 的标题、列表、共享按钮和边框结构，增加悬停/焦点展开与固定按钮。固定只在资金模块内生效，偏好按用户 ID 保存；48rem 以下使用浮层，选案或关闭后让出正文。主侧栏仍只有一个资金分析入口，案件管理下拉框已移除。

2026-10-08：主图标栏改用共享 `workspace-rail` 宽度（3rem，原 4rem），Logo、主导航和底部按钮的方形区域统一为栏宽的黄金比例（约 61.8%）。两侧等宽留白扣除分隔线后计算，组内图标间距与组首、组尾留白均复用同一值，不把每个图标所在行设为正方形。Logo 四向留白保持一致，工作区顶栏同步共用 3rem 高度，分隔线仍对齐。主导航、个人设置和管理中心统一使用 `workspace-nav-item`，选中、悬停和展开均使用 `primary/10` 背景及 `primary` 图标色；导航范围内覆盖 ghost 按钮的展开灰底，解决资金菜单展开后选中色与收件箱不一致。保留 `aria-current`、`aria-expanded`、Tooltip、键盘焦点与菜单交互，移除主导航和设置的伪元素竖线及管理中心的竖线 span。共享 Button 增加 `icon-workspace` 尺寸变体，其他尺寸及通用行为保持不变。

选中样式验证：资金分析（菜单展开）、收件箱、个人设置与管理中心的选中背景/前景计算值一致，伪元素竖线和管理中心标记均已移除；深色模式保持语义颜色，导航与键盘焦点可用。

比例与间距验证：中档栏宽约 45.6px、方形图标区域约 28.18px，左右及导航组顶部留白、相邻图标间距均约 8.20px；特大档分别约 50.4px、31.15px、9.13px，比例保持 61.8%。三处工作区顶栏分隔线一致，详情面板姓名和卡号无垂直溢出。390px 窄窗口无横向溢出，Tab 焦点可见；验证后恢复原窗口、中档缩放及浅色。Lint、类型检查、65 项 UI 测试与生产构建通过，构建保留既有 G6 大分包提醒。

2026-10-08：资金分析沿用原 Inbox 的 `min-h-0` 弹性内容区与内部滚动方式，从工作台可视高度逐层约束页面、账户目录、页签及结果区；图形自适应剩余高度，流水表独立滚动且表头、分页常驻。资金案件管理及其他模块不改变滚动方式。
