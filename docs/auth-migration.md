# 登录与注册迁移

维护日期：2026-11-10。

原项目只读：`/Users/leonwillow/Downloads/shadcn-nextjs-aidesk-app-template-1.0.0`。

## 来源与目录

这些文件先直接复制原源码，再进行下列适配。没有另外实现一套认证页面。

| 原项目 | 当前项目 | 适配 |
| --- | --- | --- |
| `src/views/login/*`、`src/views/register/*` | `apps/web/src/views/login/*`、`apps/web/src/views/register/index.tsx` | 登录沿用 React Hook Form 和 Zod；中文化、邮箱改账号。注册页面现为关闭说明，移除自行注册表单 |
| `src/app/(blank)/(auth)/{login,register}/page.tsx` | `apps/web/src/routes/{login,register}.tsx` | TanStack 文件路由仅挂载视图；继续位于工作台布局之外 |
| `src/components/auth/{auth-shell,auth-showcase,auth-header,auth-alt-link,password-field}.tsx` | `apps/web/src/components/auth/` 同名文件 | 保留双栏布局、展示面板、品牌、头像和密码显隐；Next Link 改 TanStack Link，本地资源导入 |
| `src/components/ui/{field,checkbox,separator,card,bg-silk}.tsx` | `packages/ui/src/components/` 同名文件 | 保留 Base UI 组件，调整导入、CSR 和仓库检查所需属性；优化原背景绘制 |
| `src/hooks/use-theme-color.ts`、`src/assets/svg/logo-vector.tsx`、原头像 5/6 | `apps/web/src/hooks/`、`assets/` | 原主题颜色解析、SVG 和本地头像；背景继续读取原 `--primary` |

沿用原表单依赖 `react-hook-form@7.81.0`、`@hookform/resolvers@5.4.0`；Zod 使用工作区已有 catalog。没有引入 Next.js 运行时、SSR、外部字体请求或第三方登录 SDK。

## 有意改变的行为

- 登录使用 `username`，只要求非空账号，不施加邮箱格式校验。账号去掉首尾空格，密码保持原样。
- 当前登录密码至少 5 个字符（兼容已有账号）。公开注册已在应用接口和 Better Auth 配置中关闭；管理员新建账号和重置密码要求 8～128 个字符，新账号限英文字母、数字、点、下划线和短横线。原注册表单及其请求封装已移除。
- 控件通过 `size="lg"` 使用共享高度与字体；密码输入框与提交按钮同档，眼睛按钮不溢出输入框。错误说明关联输入并通过 FieldError 宣读。
- 短窗口使用 `min-h-dvh`，表单和错误提示可滚动，避免垂直居中裁切顶部。登录的“记住我”和“忘记密码”保留原并排排列。
- 通过 Eden 调用 Elysia / Better Auth 的真实接口，登录成功后刷新会话并进入首个获授权功能；失败停留在表单显示中文错误。浏览器不保存密码。后端配置、管理员引导和授权规则见 [后端认证](./auth-backend.md)。
- “忘记密码”提示联系管理员重置。管理员在人员页面完成密码重置，原有登录全部失效。既有找回密码路由仍是未接入出口。

## Electron 登录适配（2026-11-10）

桌面继续加载同一登录表单，仅在 preload 提供连接能力时显示“服务器设置”和当前 API 地址；普通网页不显示这一入口。设置复用共享 Dialog/Field/Input，提供地址、端口、测试连接、恢复默认和保存；失败使用中文 Sonner 提示。测试及取消不修改连接，恢复默认需保存才生效，保存期间与登录提交互斥。

React 只调用 `packages/desktop-bridge` 定义的三个窄接口，不引用 Electron/Node、不保存密码。配置由主进程持久化，保存成功后整页回到登录路由；服务器之间使用独立的持久 Cookie 会话，切回原服务器可恢复其未过期会话。默认地址、部署要求、命令与验收边界见 [Electron 桌面适配](./desktop-migration.md)。

## 原背景卡顿与修复

原 `bg-silk.tsx` 是 Canvas 2D，不是 WebGL。每帧按容器尺寸乘 DPR（最高 2）遍历所有像素，执行多次三角函数、创建 ImageData 和写入图像；连续 requestAnimationFrame 与表单争用主线程。CSS 隐藏时还会持续调度空帧。

保留原配色、UV 旋转、正弦扭曲、丝绸图案公式和速度参数，只改变绘制成本与生命周期：

- 绘图最长边限制为 320，Canvas 显示尺寸仍铺满原面板。
- 最多约 30 帧/秒，复用 ImageData；原认证配置噪声为 0 时跳过无效噪声计算。
- 尺寸为 0（原小屏隐藏状态）或页面不可见时停止持续调度；恢复可见/尺寸后继续。
- 用户设置减少动态效果时仅绘制静态帧；卸载时清理帧、ResizeObserver 与事件监听。

原迁移阶段的本机测量记录（不是本次重新测量）：同一 600×760 显示尺寸，原 DPR=2 为 1,824,000 像素，迁移版为 252×320、80,640 像素。剔除首次绘制后，原版 4 次采样中位耗时 214.9ms、最大 215.7ms；优化版 19 次采样中位 4.9ms、最大 5.2ms。此数值仅是该设备和条件下的单帧绘图成本，不是整页 INP 或跨设备保证。

## 验证

运行工作区 lint、类型检查、生产构建、API 与 UI 测试。账号校验覆盖空白账号、密码原样保留、管理表单和功能授权；数据库用例覆盖公开注册拒绝、Cookie、限流、撤权和管理事务。

浏览器检查桌面/小屏布局、滚动、缩放、主题应用、中文错误与刷新。管理页面验证列表、表单、键盘焦点；隔离数据库中的普通人员登录后只看到获授权入口，直接访问管理员地址被拒绝，无功能授权时显示待授权说明。小屏背景 Canvas 为 0×0，持续绘制暂停。
