# 排版、控件与缩放规范

维护日期：2026-10-07。以下尺寸约定沿用原迁移实现；持久化由 `stores/theme-store.ts` 负责，DOM 和窗口同步由 `components/layout/theme-effects.tsx` 连接。

原模板迁移时，原 `ThemeCustomizer` 中 Select 用 `h-8`，单选格用 `py-2` 加子文字 `text-sm leading-none` 撑高；它们的字号分别是 `text-xs` 和 `text-sm`。原全局缩放只改 `--text-sm/base/lg` 和 `--spacing`，遗漏小字、其他字号与临时 rem 字号，导致上下控件尺寸变化不一致。

现在保留原主题预设、字体、语义色和交互逻辑，通过共享基础组件修正尺寸和排版。

## 四档缩放

| 档位 | 存储值 | 原模板基础尺寸的比例 |
| --- | --- | --- |
| 小 | `sm` | 90% |
| 中 | `md` | 95% |
| 大 | `lg` | 100% |
| 特大 | `xl` | 105% |

原大档的间距比例约 104.89%，归并到特大的 105%；原中档 100% 下调为 95%，两者之间的大档为 100%。字体取消原来不一致的单独倍率，所有层级统一随根 rem 变化。根字号采用百分比计算，保留浏览器默认字体偏好；浏览器缩放与界面缩放仍各自工作，不使用 CSS zoom 或 transform。

`globals.css` 是缩放、字号和控件高度的唯一维护位置。间距、图标、圆角以及所有标准文字尺寸都使用 rem，所以 Select、Tooltip、命令面板和个人菜单的小字也会变化。主题预设不覆盖间距、字号或用户圆角。

## 控件和文字

| 用途 | 令牌 | 原基础尺寸 |
| --- | --- | --- |
| 最小按钮 | `control-xs` | 1.25rem |
| 小控件 | `control-sm` | 1.5rem |
| 默认单行控件 | `control-md` | 1.75rem |
| 大单行控件 | `control-lg` | 2rem |
| 控件文字 | `text-control` | 引用 `text-xs`，行高 1.5 |
| 辅助小字 / 快捷键 | `text-caption` | 0.625rem |

主题面板的五个控件统一使用 `size="lg"`，高度 2rem、文字 `text-control`、正常字重。分段单选保留原 `ThemeCustomizer` 的 `Label > RadioGroupItem` 结构，圆角选项保留 Tooltip 渲染 Label 的组合。Label 仍负责原有边框、选中背景和首尾圆角；`RadioGroup variant="segmented"` 仅集中管理行高、字号、图标和焦点。移除 Label 的纵向 padding 及子文字的独立字号，让它在统一行高内居中，而不改变组件结构。

此前为统一尺寸而把分段外观移到 Radio 本身，是一次不必要的结构改动，现已撤回。Base UI 的隐藏输入框在原组合中位于 Label 内，不影响 Label 的首尾圆角判断；不再用另一套选择器补偿改动造成的问题。样式规范化应先适配原有组合，不替换已有可用实现。

标题、说明和字段标签保留不同层级；不同层级可以字号不同，但都必须跟随全局缩放。删除原全局样式中通过 `.h-7` / `.h-8` 选择器覆盖按钮 padding 的规则，按钮尺寸归基础组件管理。原零散的 `text-[0.625rem]` 已统一为 `text-caption`。

例如：

```tsx
<SelectTrigger size="lg" className="w-full" />
<RadioGroup variant="segmented" size="lg" aria-label="界面缩放">
  <Label htmlFor="scale-md">
    <RadioGroupItem id="scale-md" value="md" className="sr-only absolute inset-0" aria-label="中" />
    <p>中</p>
  </Label>
</RadioGroup>
```

## 工作区顶栏

`globals.css` 中的 `--spacing-workspace-header: 3.5rem` 统一主图标栏顶部、案件菜单顶部和资金页头；三处使用 `h-workspace-header` 与 `shrink-0`，使高度及底部分隔线随根 rem 一起对齐。`packages/ui/src/lib/utils.ts` 已将 `workspace-header` 注册到 `tailwind-merge` 的 spacing 配置，避免共享高度与其他尺寸类合并时产生歧义。

案件菜单标题与资金模块标题沿用 `text-base` 并垂直居中，菜单顶部操作使用共享按钮 `size="icon"`。资金页头的模块名与案件名以箭头分层，长名截断并保留完整名称提示；窄窗口标题区改为两行但不增加顶栏高度。内部导航保持单行且不压缩，管理页统计仍可换行。此约定只统一当前三处工作区顶栏，不要求其他页面重写组件结构；实测记录见[资金界面 v7](./funds-ui.md#v7-顶栏对齐验证)。

## 持久化和检查

2026-10-07：`--spacing-workspace-menu: 15rem` 统一资金分析的案件菜单与账户菜单默认宽度，已注册到 `tailwind-merge` spacing。两者使用同一 `border-r` 和 `bg-sidebar`，账户菜单直接衔接页头，内部 `p-3` 与案件搜索留白一致；菜单宽度跟随根 rem，窄屏账户目录改为上下排列，不挤压画布。

序列化对象增加 `version: 2`，业务 Settings 类型保持原字段。启动、storage 事件和 BroadcastChannel 共用编解码；旧版 `lg` 解码为 `xl`，保留其他有效偏好；新版本 `lg` 可正常保存、刷新及跨窗口同步，不会重复迁移。

`bun run lint` 用 TypeScript AST 检查临时字号、内联字号/行高及页面对 Button/Input/SelectTrigger/RadioGroup 高度和字号的覆盖，并检查 CSS 排版声明是否集中在共享样式中。检查不能代替视觉验证：新布局仍需实际对比不同档位、窗口尺寸和字体。

共享 `cn` 沿用原 clsx + tailwind-merge；新增字号和控件间距令牌必须注册到它的主题配置，避免字号被误认为颜色、或两个高度类同时保留。

`bun run test:ui` 覆盖规则拒绝/允许的代码、实际按钮颜色与控件尺寸合并、旧设置迁移、四档编解码和损坏数据回退。浏览器验证五行控件在每档高度/字号完全一致，并检查其余文字、键盘、刷新、小窗口以及主题切换。

依据 [Tailwind 字号令牌](https://tailwindcss.com/docs/font-size)、[主题变量](https://tailwindcss.com/docs/theme) 和 [Base UI Radio Group](https://base-ui.com/react/components/radio-group) 的公开接口实施。

2026-10-06：共享样式新增 `success`、`warning` 明暗语义色；Button 对应变体用于置顶/恢复和归档图标。页面不硬编码绿、黄色值，图标提供共享 Tooltip。案件行使用 `:hover` / `:focus-visible` 区分鼠标悬停与键盘操作，普通点击焦点不令操作常显。

2026-10-06：Badge 新增 `success`、`warning` 变体，使用同名语义色的浅背景和前景，用于资料覆盖与待补状态；原有变体保持不变。共享 HoverCard 适配 shadcn base-mira/已安装 Base UI PreviewCard，复用浮层排版与主题，限制可用宽高；延迟、定位与内容由调用方指定。

2026-10-06：G6 内置 Toolbar 通过 `.g6-toolbar.funds-graph-toolbar` 在共享样式中适配语义颜色、圆角、阴影与 `control-md` / `text-control` 令牌，保留插件定位和原生工具项。扩展分析操作继续使用共享 Button、Tooltip 和 Popover；窄画布内允许换行，避免横向溢出。插件运行时插入未分层样式，适配也置于层外并使用限定选择器，防止加载顺序覆盖主题。

G6 的原生项通过共享 Tooltip 的 `anchor` 接口复用提示外观，不保留浏览器 `title`。`.funds-graph-zoom` 输入框继承工具栏文字与 `control-md` 高度，焦点/错误/禁用采用共享语义色；四组工具使用同一 `.funds-graph-toolbar-separator`，全部尺寸随 rem 缩放。

2026-10-07：HoverCard 透传泛型 payload 与 Base UI handle，支持多个触发器复用一个浮层。可选 `showArrow` 使用原生 Arrow 定位与 popover/foreground 语义色；使用箭头的业务将可滚动内容放在内部，保持 Popup 的溢出可见，避免裁剪指向标记。

2026-10-07：G6 工具栏停靠与折叠继续使用同一语义色、尺寸和阴影；停靠规则由业务控制器写入数据属性，布局与动画样式集中于 `globals.css`。竖排时分组分隔线转为横线，横排窄画布按组换行。折叠入口与展开末端复用同一个控件 DOM，仅折叠或过渡中保持纯图标、透明悬停背景且无 Tooltip；完整展开恢复共享 `ghost` Button 的悬停反馈及 Tooltip。图标随展开、临时展开和折叠动作变化，各状态保留中文可访问名称与焦点环；外框宽高、控件位置及内容显隐分阶段过渡，支持中途反向和减少动态效果偏好。设置沿用共享 Popover、RadioGroup、FieldSet 与 Button，工具栏原生项和扩展按钮继续使用同一 Tooltip，通过 `TooltipOpenScope` 在折叠动画期间暂停提示。

2026-10-07：`CopyText` 为文字复制入口，继承所在标题或正文的字号、颜色和行高，不套用操作按钮的固定高度；复用 Tooltip、语义焦点样式及现有 Sonner 通知。可用 `truncate` 限定显示宽度，提示和复制始终保留完整值。Clipboard API 成功后才通知成功，失败不得误报；不引入另一套通知宿主。

复制成功启用 Sonner 的 `richColors`，其成功前景、浅背景与边框由共享通知组件映射到 `success` 和 `popover` 语义色，明暗主题一致。HoverCard 内的 Tooltip 使用 `TooltipPortalScope`，Portal 挂在 Popup 内、正文滚动层外；提示及箭头属于父卡片的 DOM 范围，鼠标移入提示不会触发父卡片离开，且仍能超出正文区域显示。普通页面 Tooltip 沿用默认 Portal。

全局 Tooltip 允许鼠标移入 Popup，保留 Base UI 的悬停路径和 Escape 关闭行为。原生 `title` 说明统一改用 `TooltipText`，复用原文字、表格单元格或链接节点，无额外布局包装。案件菜单使用 `TooltipPortalScope`，移入伸出菜单的气泡仍视为处于菜单内。会自动折叠的工具栏通过 `TooltipOpenScope` 汇总提示打开状态；原生 G6 项的外部锚点额外处理按钮与气泡之间的离开宽限，并在定时关闭前核验真实悬停命中，避免原生 leave 与 Portal enter 事件先后顺序导致误关。

2026-10-07：画布悬停速览继续使用共享 Card、Badge、Button、Popover、Tooltip 和 `CopyText`，从原模板迁移 Base UI `Collapsible` 作为共享折叠基础组件；保留同一个面板及原生展开语义，不另造字号、控件高度或主题色。停靠位置选择复用工具栏网格，速览的布局存储由自身维护；此处属于既有体系的组件扩展，没有新增持久设计令牌。

速览的业务外观集中于 `globals.css`：宽 18rem，画布边距 0.5rem，最大宽高扣除双侧留白；沿用卡片语义色、圆角与共享阴影。标题保持完整，正文允许在 flex 布局中缩小并独立滚动，长名称、账号和多币种内容不得撑开画布。折叠通过网格行在 `1fr` 与 `0fr` 间收缩，过渡遵守 `prefers-reduced-motion`，设置弹窗、Tooltip 与内部键盘焦点可保持临时展开，图标使用中文可访问名称；这些约定仅描述当前画布速览，不推广为所有卡片的尺寸或交互规则。浏览器与数据口径验证见[画布悬停速览](./funds-ui.md#画布悬停速览2026-10-07)。

2026-10-07：节点、逐笔交易与汇总流向详情共用一个非模态 Sheet，保留共享关闭控件；切换对象只替换内部内容，不改变侧栏位置或宽度，也不重播侧栏入场。桌面宽度上限 25rem、窄屏全宽，页头继续使用 `workspace-header`，正文独立滚动。对象相关标记草稿、分页和来源加载随内容切换隔离，避免为保留外框而保留上一对象的数据。

内容切换动效集中在 `globals.css`，160ms 内将透明度从 0.65 恢复至 1；新内容直接替换，不等待旧内容退场或叠放两份数据，`prefers-reduced-motion` 下取消动效。该规则只用于资金详情内容更新，复用现有语义色、排版、控件与 rem 缩放，没有新增持久设计令牌。交互及验证见[节点与连线共享详情面板](./funds-ui.md#节点与连线共享详情面板2026-10-07)。

2026-10-07：`CopyText` 的下划线偏移从 `underline-offset-4` 调整为 `underline-offset-2`，避免截断的等宽卡号将下划线裁在行框外；页头高度、截断和复制行为保持不变，无新增令牌。文档已核对源码；主实现者在浅色 1512 × 828 和深色 390 × 844 窗口验证名称、卡号的 2px 下划线可见及键盘 `focus-visible` 正常，截图为 `apps/web/.impeccable/review/copy-underline-desktop.png`、`copy-underline-mobile.png`。`lint`、`check-types`、`build`、`test:ui`（51 项）和 `git diff --check` 通过。

2026-10-07：画布背景设置复用现有 `ColorSwatch` 及共享表单、Popover 和 Button；预设颜色、CSS 纹理与背景预览集中于 `globals.css` 的画布表面规则。新增变量仅作用于资金画布的背景、墨色与纹理，不修改全局品牌令牌；默认图元按实际背景校正可读性，个人标记保持原样。空结果提示、速览和工具栏使用独立主题底色，避免自定义画布色破坏浮层文字与控件对比。行为与验证见[画布背景设置](./funds-ui.md#画布背景设置2026-10-07)。
