# 登录与注册迁移

原项目只读：`/Users/leonwillow/Downloads/shadcn-nextjs-aidesk-app-template-1.0.0`。

## 来源与目录

这些文件先直接复制原源码，再进行下列适配。没有另外实现一套认证页面。

| 原项目 | 当前项目 | 适配 |
| --- | --- | --- |
| `src/views/login/*`、`src/views/register/*` | `apps/web/src/views/login/*`、`apps/web/src/views/register/*` | 保留视图、React Hook Form、Zod 校验和表单结构；中文化，邮箱字段改账号，移除社交登录 |
| `src/app/(blank)/(auth)/{login,register}/page.tsx` | `apps/web/src/routes/{login,register}.tsx` | TanStack 文件路由仅挂载视图；继续位于工作台布局之外 |
| `src/components/auth/{auth-shell,auth-showcase,auth-header,auth-alt-link,password-field}.tsx` | `apps/web/src/components/auth/` 同名文件 | 保留双栏布局、展示面板、品牌、头像和密码显隐；Next Link 改 TanStack Link，本地资源导入 |
| `src/components/ui/{field,checkbox,separator,card,bg-silk}.tsx` | `packages/ui/src/components/` 同名文件 | 保留 Base UI 组件，调整导入、CSR 和仓库检查所需属性；优化原背景绘制 |
| `src/hooks/use-theme-color.ts`、`src/assets/svg/logo-vector.tsx`、原头像 5/6 | `apps/web/src/hooks/`、`assets/` | 原主题颜色解析、SVG 和本地头像；背景继续读取原 `--primary` |

沿用原表单依赖 `react-hook-form@7.81.0`、`@hookform/resolvers@5.4.0`；Zod 使用工作区已有 catalog。没有引入 Next.js 运行时、SSR、外部字体请求或第三方登录 SDK。

## 有意改变的行为

- 登录和注册都使用 `username`，只要求非空账号，不施加邮箱格式校验。账号去掉首尾空格，密码保持原样。
- 原登录密码至少 6 个字符、注册至少 8 个字符的校验保留；注册保留确认密码和条款确认。
- 控件通过 `size="lg"` 使用共享高度与字体；密码输入框与提交按钮同档，眼睛按钮不溢出输入框。错误说明关联输入并通过 FieldError 宣读。
- 短窗口使用 `min-h-dvh`，表单和错误提示可滚动，避免垂直居中裁切顶部。登录的“记住我”和“忘记密码”保留原并排排列。
- **本次只迁移前端。** 原模板提交后直接跳转 `/inbox` 的演示行为没有迁入。校验通过时提示认证服务尚未接入，不创建会话或账号，不保存密码，不发认证请求。
- 密码找回、隐私政策和服务条款尚未迁移/配置，对应操作给出提示；不放置假链接或虚构政策内容。后续认证仍走 Elysia/Eden，`packages/auth` 保持预留。

## 原背景卡顿与修复

原 `bg-silk.tsx` 是 Canvas 2D，不是 WebGL。每帧按容器尺寸乘 DPR（最高 2）遍历所有像素，执行多次三角函数、创建 ImageData 和写入图像；连续 requestAnimationFrame 与表单争用主线程。CSS 隐藏时还会持续调度空帧。

保留原配色、UV 旋转、正弦扭曲、丝绸图案公式和速度参数，只改变绘制成本与生命周期：

- 绘图最长边限制为 320，Canvas 显示尺寸仍铺满原面板。
- 最多约 30 帧/秒，复用 ImageData；原认证配置噪声为 0 时跳过无效噪声计算。
- 尺寸为 0（原小屏隐藏状态）或页面不可见时停止持续调度；恢复可见/尺寸后继续。
- 用户设置减少动态效果时仅绘制静态帧；卸载时清理帧、ResizeObserver 与事件监听。

本机浏览器对从两份源码提取的实际绘图循环进行对比：同一 600×760 显示尺寸，原 DPR=2 为 1,824,000 像素，迁移版为 252×320、80,640 像素。剔除首次绘制后，原版 4 次采样中位耗时 214.9ms、最大 215.7ms；优化版 19 次采样中位 4.9ms、最大 5.2ms。此数值仅是该设备和条件下的单帧绘图成本，不是整页 INP 或跨设备保证。

## 验证

运行工作区 lint、类型检查、生产构建和 UI 测试。账号校验测试覆盖普通账号、空白账号、密码原样保留、确认密码与条款。

浏览器检查桌面/小屏布局、滚动、四档缩放、主题应用、密码显隐、中文错误、Enter 提交、注册/登录互链与刷新。有效提交停留在表单并给出未接入服务提示；小屏背景 Canvas 为 0×0，持续绘制暂停。
