# 排版、控件与缩放规范

维护日期：2026-11-06。以下尺寸约定沿用原迁移实现；持久化由 `stores/theme-store.ts` 负责，DOM 和窗口同步由 `components/layout/theme-effects.tsx` 连接。

原模板迁移时，原 `ThemeCustomizer` 中 Select 用 `h-8`，单选格用 `py-2` 加子文字 `text-sm leading-none` 撑高；它们的字号分别是 `text-xs` 和 `text-sm`。原全局缩放只改 `--text-sm/base/lg` 和 `--spacing`，遗漏小字、其他字号与临时 rem 字号，导致上下控件尺寸变化不一致。

现在保留主题预设、字体和交互逻辑，通过共享基础组件修正尺寸和排版。默认色板在 2026-11-06 对齐 ReUI 当前 Neutral 配置，来源与历史见 [自定义主题迁移](./custom-theme-migration.md)。Dialog 和模态 Sheet 共用 `overlay` 色及 `backdrop-blur-xs`，默认 10% 黑色、4px 模糊，不在业务页单独加深。扩展语义色使用 ReUI 配对令牌：背景/高亮用 `info`、`success`、`warning`，文字与图标用对应 `*-foreground`，ghost 按钮仅悬停时显示背景。

笔录编辑控件和案件菜单继续使用共享语义字号、控件及工作区令牌。A4 文书属于输出介质，纸张、仿宋、行距和页边距集中在 `globals.css` 的 `inquiry-document-*` 规则，以 mm/pt 保持实际打印尺寸；预览默认按实际可视区域双向等比适宽，也可通过右下角工具栏手动缩放；文书比例不随界面缩放改变分页。文书使用白纸黑字，周围编辑器和固定工具栏跟随明暗主题。预览的边距、工具栏圆角和阴影使用共享令牌，图标按钮沿用 `icon-sm`；双向滚动通过共享 ScrollArea，纸张框裁切未缩放的物理尺寸，避免原始 A4 盒子产生伪溢出。来源和输出差异见 [笔录功能](./inquiries-migration.md)。

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

资金分析的视图页签与节点、连线模式使用一致的默认 Tabs 外观。模式单选通过共享 `RadioGroup variant="tabs"` 提供同样的高度、内边距、圆角、文字和选中底色，继续保留 `Label > RadioGroupItem` 结构及单选语义；主题面板原有 `segmented` 外观不受影响。

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

## 主图标栏

`--spacing-workspace-rail: 3rem` 统一主图标栏宽度并随根 rem 缩放；`workspace-icon` 为栏宽的黄金比例（约 61.8%），共享 `icon-workspace` 按钮尺寸与 Logo 的 `rail` 变体保持正方形。`workspace-rail-inset` 将扣除右侧 1px 分隔线后的剩余宽度等分为左右留白；导航组和底部操作组的图标间距、组首及组尾内边距均使用这一份留白，不累加相邻图标的上下间距，也不要求每个图标所在行是正方形。头像填满对应触发区域，其他页面的按钮尺寸和默认 Logo 不变。

主导航、个人设置、管理中心共用 `workspace-nav-item` 状态样式：选中、悬停或展开时使用 `primary/10` 背景和 `primary` 图标色，键盘仍有可见焦点；不再显示选中项左侧竖线。样式只限主图标栏导航，避免影响普通 ghost 按钮及弹层触发器。

## 工作区顶栏

2026-11-06：计算器的可选说明入口继承 WorkspaceTitle 字体与基线，使用右上角的小圆问号提示可悬停；尺寸和焦点样式集中在 `calculator-help-*` 规则。说明通过共享 HoverCard/ScrollArea 展示，内容宽度受可用视口约束，不在正文底部重复占位。

2026-11-05：笔录、增值税/滞纳金计算器、文书取号、资金分析统一使用 `components/layout/workspace-header.tsx` 的 `WorkspaceHeader` / `WorkspaceTitle`。以笔录为准：标题 `text-base` / `font-semibold`、前景语义色，图标 `size-4`、图文间距 `gap-2`，容器共用最小高度、水平留白和纵向 `py-2`。文书不再使用独立的浅色图标和中等字重，资金补用现有 Waypoints 模块图标；业务工具、路径名和路由行为保留。窄窗口允许工具换行，不用固定高度裁切内容。

2026-11-05：增值税与滞纳金计算器的共用 `ScenarioWorkspace` 顶栏采用与笔录相同的 `min-h-workspace-header`、`px-workspace-gutter` 和 `py-2`，不再用四向 `p-workspace-gutter` 撑高顶栏。宽屏底部分隔线与 Logo、固定二级菜单对齐；窄空间保留操作分组换行，避免控件被裁切。

2026-11-04：笔录工具栏与模块标题共用一行，以 `min-h-workspace-header` 保持宽屏顶线对齐，窄空间允许操作分组换行。`CollapsibleSidePanel` 的中部折叠手柄由 `globals.css` 统一设置 rem 尺寸、语义色、方向反馈、焦点环及减少动态效果适配；折叠状态由 Base UI 管理，视图仅提供内容、边侧和展开状态。

2026-11-05：笔录侧面板通过共享 ReUI Resizable 调宽，Base UI Collapsible 保留内容显隐及按钮语义。收起时面板宽度为零，相邻分隔线隐藏；展开由官方 `resize()` 恢复最近展开尺寸。面板不启用自动折叠，拖动和方向键调宽到达最小宽度后停止，只有边缘折叠按钮改变显隐状态。折叠按钮绝对定位，竖条中线位于问答留白 `workspace-gutter` 的一半处，不额外占位。按最新要求删除折叠按钮的悬停预览及所有专用状态、内容副本和样式，悬停仅显示方向反馈。

笔录分栏尺寸统一在 `globals.css` 的 `--inquiry-*` 令牌中维护：基础信息默认 18rem、最小 12rem、最大 45%；文书预览默认 24rem、最小 14rem、最大 55%；问答最小 16rem。默认宽度延续已有页面，约束随 rem 缩放；尺寸计算和鼠标/键盘拖动交由已有 ReUI 实现，页面不另写拖动逻辑。

`globals.css` 中的 `--spacing-workspace-header` 引用 `workspace-rail`（3rem），使顶部 Logo 四向留白一致，同时统一案件菜单顶部和资金页头；三处使用 `h-workspace-header` 与 `shrink-0`，使高度及底部分隔线随根 rem 一起对齐。详情面板页头和账户目录定位继续复用该高度。`packages/ui/src/lib/utils.ts` 已将这些工作区尺寸注册到 `tailwind-merge` 的 spacing 配置，避免共享尺寸类合并时产生歧义。

案件菜单标题与资金模块标题沿用 `text-base` 并垂直居中，菜单顶部操作使用共享按钮 `size="icon"`。资金页头的模块名与案件名以箭头分层，长名截断并保留完整名称提示；窄窗口保留标题与案件路径同行，内部导航整体换行且不压缩，管理页统计仍可换行。实测记录见[资金界面 v7](./funds-ui.md#v7-顶栏对齐验证)。

2026-11-04：资金、文书和笔录在工作台中只挂载一个 `WorkspaceMenu`，共用固定和展开状态，并使用 `workspace-menu`、`workspace-header`、`workspace-gutter` 令牌呈现。标题在左侧占用剩余空间，过长时截断并提供完整文字提示；右侧工具栏不收缩，先显示模块操作，最右侧始终是共享的固定/取消固定按钮，保留中文可访问名称、`aria-pressed` 和 Tooltip。搜索、列表及底部内容按当前模块替换；切换内容不重建外框或固定按钮，固定/取消固定统一生效，刷新后恢复同一份用户偏好。标题/外框/固定入口的后续调整只维护共享组件。

浮动外框与主图标栏、窗口上下边缘均留出 `workspace-gutter`（0.75rem），使用共享 `rounded-xl`、完整边框和 `shadow-xl`，与全高停靠栏区分。浮动宽度仍为 `workspace-menu`，最大宽度扣除可用区域两侧留白。位置和透明悬停通道集中在 `globals.css` 的 `.workspace-menu-floating`；通道仅覆盖左侧间隙，不额外维护展开状态，外框不裁剪 Tooltip。实际停靠时恢复全高、贴边和右分隔线；窄窗沿用浮动外观并保留统一固定偏好。

资金分析分栏外边距统一使用 `--spacing-workspace-gutter: 0.75rem`，并注册到 `tailwind-merge` spacing。案件与资金页头用 `px-workspace-gutter`，案件搜索/列表、账户菜单及图谱正文复用同一令牌；取消资金页头和图谱正文在宽屏单独增加的水平边距。标题对齐各自分栏的搜索框，账户列表到分隔线、分隔线到画布两侧留白相等。分组标题、行内文字和图标仍保留各自层级缩进，不把外边距套用到控件内部。

## 持久化和检查

2026-11-05：计算器菜单复用笔录的共享 Tree、TreeItem、TreeItemLabel，两项为可折叠分组，组内方案为导航叶子，保留 Calculator / CalendarClock 图标。行高、字重、缩进、选中底色和焦点环由共享组件决定；选中只来自当前路由，支持方向键、Enter 和空格。长名继续使用 MenuLabel 渐隐滚动，滚动继续由 ScrollArea 管理。

2026-11-04：笔录目录迁入 ReUI Tree，使用 `control-md`、`text-control` 和语义色。`--spacing-tree-indent: 1.25rem` 统一每级缩进，节点的 `data-level` 和 `--tree-padding` 在共享样式中连接引导线；左侧展开箭头、文件夹/文件图标及同行操作一起随 rem 缩放。业务组件不覆盖控件尺寸或节点字号。

2026-11-05：共享 Tree 的非根层叶子移除空箭头占位，由已有层级缩进承接箭头列，使文件夹/计算器分组与所属条目的图标对齐；根层独立条目仍保留箭头空位，与分组图标对齐。层级引导线、展开箭头、键盘行为和业务图标保持原样。

目录不再以“新建笔录”或“新建方案”作为树叶子。新建入口统一为文件夹或计算器分组行右侧的加号，沿用 icon-xs ghost、贴右排列及仅悬停显示规则；点击加号不触发该行展开/折叠。笔录归档文件夹及归档视图不提供夹内新建。

2026-11-04：共享 Calendar/DatePicker 迁入 shadcn base-mira 官方实现，使用 React DayPicker 和 date-fns，默认中文及年月下拉；日历单元引用 `control-md`，按钮与文字复用共享令牌。ReUI TimePicker 保留官方分列、键盘、清空及范围限制 API，中文标签与24小时格式默认可用；时间列行高和列表留白统一由 `globals.css` 的 `data-slot="time-picker-column"` 规则引用现有控件高度与基础间距。笔录通过 FieldGroup 组织日期和起止时间及姓名/性别同行，不在页面覆盖控件尺寸。

2026-10-07：`--spacing-workspace-menu: 15rem` 统一资金分析的案件菜单与账户菜单默认宽度，已注册到 `tailwind-merge` spacing。两者使用同一 `border-r` 和 `bg-sidebar`，账户菜单直接衔接页头，2026-10-08 将原 `p-3` 留白收敛为 `p-workspace-gutter`，与案件搜索及画布外边距一致；菜单宽度跟随根 rem，窄屏账户目录改为上下排列，不挤压画布。

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

2026-11-05：共享 Sonner 默认启用 `richColors`，调用方按结果选择 `toast.success`、`toast.error`、`toast.warning` 或 `toast.info`，使用原生图标、动画与通知生命周期。错误通知参考 ReUI `@reui/c-alert-8` 的浅色底和边框，通过 `destructive` 映射；成功、警告、信息分别使用 `success`、`warning`、`primary` 语义色，普通通知沿用 `popover`。关闭按钮默认中文可访问名称。笔录表单提交错误使用浮动通知，不在编辑区域增加占位错误条；具体错误由业务请求提供，不把不同类型通知统一为错误 Alert。

共享 Tooltip 默认允许鼠标移入 Popup，保留 Base UI 的悬停路径和 Escape 关闭行为；调用方可以通过 disableHoverablePopup 选择离开触发器即关闭。原生 `title` 说明统一改用 `TooltipText`，复用原文字、表格单元格或链接节点，无额外布局包装。案件菜单使用 `TooltipPortalScope`，移入伸出菜单的气泡仍视为处于菜单内。会自动折叠的工具栏通过 `TooltipOpenScope` 汇总提示打开状态；原生 G6 项的外部锚点额外处理按钮与气泡之间的离开宽限，并在定时关闭前核验真实悬停命中，避免原生 leave 与 Portal enter 事件先后顺序导致误关。

2026-10-08：`TooltipText` 仅在实际文字节点的 `scrollWidth > clientWidth` 时打开完整内容提示，链接内优先测量 `.truncate` 文字，不把图标或留白作为锚点。气泡与文字起点对齐，继续由 Base UI 处理屏幕边缘避让；打开时测量，并仅为当前打开的文字监听尺寸与字体变化，恢复完整显示时关闭提示。复制操作提示及图标说明沿用各自的 Tooltip，不受文字截断规则限制。银行流水的名称与摘要采用自然文字宽度及既有最大宽度，空白不再成为悬停范围。

2026-11-04：全局 Tooltip 处理 Base UI 定位器的 `anchorHidden` 状态。行内按钮被 `display:none` 隐藏、外部 DOM 锚点移除或锚点完全滚出裁剪区域时，定位器立即隐藏气泡并禁用指针命中，退场动画也不得显示在零坐标。若提示仍打开，通过公开 `actionsRef.close()` 通知受控调用方及 `TooltipOpenScope`，避免仅视觉隐藏而留下打开状态。关闭调度延至下一帧并在定位状态变化时取消，避免快速重新打开时使用上一次的隐藏结果。保留原有 Portal 归属、可移入气泡、调用方动作引用及取消关闭语义；不引入业务页面逐个修补或全页常驻观察器。浏览器复核覆盖笔录行内按钮焦点离开、外部锚点移除、滚动裁剪、受控状态与父层汇总归零、普通提示及嵌套 Portal 内帮助链接。

2026-10-07：画布悬停速览继续使用共享 Card、Badge、Button、Popover、Tooltip 和 `CopyText`，从原模板迁移 Base UI `Collapsible` 作为共享折叠基础组件；保留同一个面板及原生展开语义，不另造字号、控件高度或主题色。停靠位置选择复用工具栏网格，速览的布局存储由自身维护；此处属于既有体系的组件扩展，没有新增持久设计令牌。

速览的业务外观集中于 `globals.css`：宽 18rem，画布边距 0.5rem，最大宽高扣除双侧留白；沿用卡片语义色、圆角与共享阴影。标题保持完整，正文允许在 flex 布局中缩小并独立滚动，长名称、账号和多币种内容不得撑开画布。折叠通过网格行在 `1fr` 与 `0fr` 间收缩，过渡遵守 `prefers-reduced-motion`，设置弹窗、Tooltip 与内部键盘焦点可保持临时展开，图标使用中文可访问名称；这些约定仅描述当前画布速览，不推广为所有卡片的尺寸或交互规则。浏览器与数据口径验证见[画布悬停速览](./funds-ui.md#画布悬停速览2026-10-07)。

2026-10-07：节点、逐笔交易与汇总流向详情共用一个非模态 Sheet，保留共享关闭控件；切换对象只替换内部内容，不改变侧栏位置或宽度，也不重播侧栏入场。桌面宽度上限 25rem、窄屏全宽，页头继续使用 `workspace-header`，正文独立滚动。对象相关标记草稿、分页和来源加载随内容切换隔离，避免为保留外框而保留上一对象的数据。

内容切换动效集中在 `globals.css`，160ms 内将透明度从 0.65 恢复至 1；新内容直接替换，不等待旧内容退场或叠放两份数据，`prefers-reduced-motion` 下取消动效。该规则只用于资金详情内容更新，复用现有语义色、排版、控件与 rem 缩放，没有新增持久设计令牌。交互及验证见[节点与连线共享详情面板](./funds-ui.md#节点与连线共享详情面板2026-10-07)。

2026-10-07：`CopyText` 的下划线偏移从 `underline-offset-4` 调整为 `underline-offset-2`，避免截断的等宽卡号将下划线裁在行框外；页头高度、截断和复制行为保持不变，无新增令牌。文档已核对源码；主实现者在浅色 1512 × 828 和深色 390 × 844 窗口验证名称、卡号的 2px 下划线可见及键盘 `focus-visible` 正常，截图为 `apps/web/.impeccable/review/copy-underline-desktop.png`、`copy-underline-mobile.png`。`lint`、`check-types`、`build`、`test:ui`（51 项）和 `git diff --check` 通过。

2026-10-07：画布背景设置复用现有 `ColorSwatch` 及共享表单、Popover 和 Button；预设颜色、CSS 纹理与背景预览集中于 `globals.css` 的画布表面规则。新增变量仅作用于资金画布的背景、墨色与纹理，不修改全局品牌令牌；默认图元按实际背景校正可读性，个人标记保持原样。空结果提示、速览和工具栏使用独立主题底色，避免自定义画布色破坏浮层文字与控件对比。行为与验证见[画布背景设置](./funds-ui.md#画布背景设置2026-10-07)。


2026-11-04：固定二级菜单支持 ReUI 分隔条调整宽度。共享 `--workspace-menu-default-size` 为 15rem，`--spacing-workspace-menu` 引用它供浮窗和其他默认菜单使用；固定菜单的 min/max 分别由 `--workspace-menu-min-size`（12rem）及 `--workspace-menu-max-size`（28rem）定义，正文最小宽度使用 `--workspace-content-min-size`（20rem）。尺寸只在 globals.css 定义，布局读取带单位的值传给 ReUI。用户宽度以 rem 保存，窗口空间不足时由官方约束临时收窄，不覆盖原偏好。

2026-11-05：按界面要求移除二级菜单分隔线上的胶囊标记及 `.workspace-menu-resize-handle` 样式，继续使用 ReUI `ResizableHandle` 的拖拽、键盘和焦点行为。分隔线仅在实际停靠时可用；窄窗继续使用现有浮窗及其边距，不提供拖宽控件。


## 滚动区域与禁用反馈

2026-11-05：从 shadcn base-mira 引入共享 `ScrollArea`，使用 Base UI 的 Viewport、Content、Scrollbar、Thumb 和 Corner。所有新增的可溢出区域必须使用它，外框负责高度约束，`contentClassName` 负责内部布局和留白；虚拟列表的 ref、onScroll 和键盘滚动目标通过 `viewportProps` 绑定实际 Viewport，不能绑定外框。双向滚动条采用语义色，悬停或滚动时可见，滚轮、触控、键盘和拖动逻辑由官方组件处理。

已接入主导航、二级菜单、笔录三栏与窄窗页签内容、常用询问人、文书及人员列表、文书编辑与预览、主题面板、资金详情/筛选/目录/记录列表及共享 Table。长 Dialog、Popover 使用 `scrollable` 和 `scrollContentClassName` 组合相同滚动组件。Word iframe 按实际纸张高度展开，由外部 Scroll Area 滚动，隔离文书样式的方式保留。Select、Command、ReUI TimePicker 保留官方键盘定位与滚动指示逻辑并隐藏系统滚动条；G6 插件拥有的 DOM 工具栏保留原尺寸计算与滚动逻辑，不显示系统滚动条。

共享 Button 的禁用状态保留指针事件以显示 `not-allowed` 光标，不再用 pointer-events:none 跳过按钮；Base UI 仍负责阻止激活。`disabledReason` 提供中文原因 Tooltip，并允许键盘聚焦读取；已带 Tooltip 的图标按钮直接在原气泡中切换原因。禁用按钮的捕获阶段阻止父行导航和表单提交，悬停不呈现可执行状态。删除操作统一显式使用 `destructive` 变体，禁用时保留危险色并降低透明度；不根据中文文案或图标名称推断业务行为。

### 二级菜单名称与轻量操作（2026-11-05）

二级菜单名称统一使用 MenuLabel：实际溢出时以渐变遮罩消失，行悬停或键盘可见焦点时滚动展示全文，鼠标点击留下的焦点不续播，不使用省略号或名称 Tooltip。ResizeObserver 在内容、字体和面板宽度变化时重测；减少动态效果时停止自动动画。目录 ScrollArea 内容显式限制为视口宽度，覆盖底层 fit-content 最小宽度，避免名称撑开目录。

笔录目录行移除删除入口及对应确认弹窗；文件夹仅保留小尺寸 ghost icon 操作。改名使用共享 info（信息蓝）令牌，归档/恢复使用 warning 令牌，默认透明、悬停显示淡色背景。操作区仅在行悬停时占据宽度，按钮始终贴右排列；未悬停时名称使用整行，悬停时缩至按钮左侧并重测滚动距离。浮动菜单使用标准 rounded-xl、border-border、bg-popover 与 shadow-xl，跟随全局主题及圆角，不再直接引用不可用的派生圆角变量。

验证：浏览器检查浅色/深色及大小圆角联动、透明信息/警告色按钮、窄窗口名称溢出遮罩与动画、名称无 Tooltip。未改动现有业务数据。

2026-11-05：共享 Button 的 info、success、warning、destructive 统一为语义色 ghost 外观：默认背景透明，悬停可用按钮时显示同色 10% 背景；禁用状态不显示悬停背景。编辑询问人使用 info，删除入口和删除确认沿用 destructive，深色模式同样不常驻背景色。


2026-11-05：头像上方新增全屏开关，沿用 icon-workspace、ghost、共享 Tooltip 和中文可访问名称。只由用户点击调用浏览器 Fullscreen API，fullscreenchange 同步按钮与 Escape 退出，不保存全屏偏好；受限时通过 Sonner 说明失败。问答移动高亮使用全局 info 令牌和共享 CSS，遵循 prefers-reduced-motion；目录单份笔录操作复用现有 info/warning 的 icon-xs ghost 语义。


2026-11-05：笔录操作按钮统一设置 `disableHoverablePopup`。共享 Tooltip 不再强制覆盖这个官方属性；鼠标离开按钮时即开始关闭，移到气泡上不会续留，避免目录行的按钮已经隐藏而气泡仍悬浮。键盘焦点仍可读取操作说明及禁用原因，Escape 和焦点移出沿用 Base UI。

本次验证：笔录目录“归档 123”提示打开后，指针移入原气泡伸出目录的区域，按钮变为 hidden 且 Tooltip 清空；键盘 Tab 仍能读取操作提示，Escape 和焦点离开后正常关闭。lint、类型检查、构建及 90 项 UI 测试通过。截图：`apps/web/.impeccable/review/inquiry-tooltip-dismiss.png`。

2026-11-05：增值税测算表使用共享 Table/ScrollArea，固定月份列、分组表头与调整区使用语义背景。名称、月份输入、表格和导入预览的布局尺寸集中在 `globals.css` 的 `vat-*` 类；金额输入仍使用共享 Input 尺寸。错误通过 Sonner，计算状态使用可访问说明按钮；年度筛选、36行分页不改变完整合计。

2026-11-05：滞纳金计算器沿用共享 Field、DatePicker、Select、Card 和 Table/ScrollArea。`late-fee-*` 布局类在全局样式定义自适应字段网格、缴款行和汇总区，语义 warning 色表示累计滞纳金。390px 下字段纵向重排，明细表只在自己的 ScrollArea 内横向滚动；错误详情通过 Sonner，删除按钮沿用 destructive ghost。

2026-11-05：计算器目录扩展为分组/方案 Tree，同行操作使用 `icon-xs`，仅 hover 显示，显示时贴右排列。方案顶栏复用 WorkspaceHeader，名称 Input 使用集中在 globals.css 的 calculator-name-field 宽度，不显示额外字段标题；保存状态和操作按剩余空间换行。已归档方案的修改入口通过共享 disabledReason 给出恢复提示。

2026-11-06：计算器与笔录目录的操作图标以笔录为准，统一由 `.menu-row-actions` 设置为共享间距的三倍（默认 0.75rem），保持 `icon-xs` 按钮外框及一份间距。改名、归档/恢复和新建均使用这份规则；移除笔录逐个图标的尺寸覆盖，防止 Tree 的节点图标样式把计算器操作图标放大。

2026-11-05：目录名称未悬停时使用整行可用宽度，只有实际溢出才在行尾渐隐；悬停后为贴右按钮让位，ResizeObserver 重测并保留原有滚动展示。DirectoryItemLabel 为笔录、计算器、文书类型和资金案件提供共享 HoverCard，展示完整名称、所属分类、状态和已有的更新时间/文号前缀，不额外请求正文。卡片锚定完整行并由 Base UI 避让视口，长内容使用 ScrollArea；仅真实悬停150ms后打开，离开100ms后关闭，可移入卡片查看，点击名称关闭且不会因保留焦点重新弹出。

2026-11-05：全局 Select 按 ReUI `@reui/c-select-1` 的 Base UI 示例统一。弹层默认 alignItemWithTrigger=false，触发器使用主题背景、统一默认控件高度与箭头，项目调用方不再分别指定弹层对齐或大尺寸。选项采用 Group 留白并为勾选图标预留位置；长文本换行。Select.List 通过 render 接入共享 ScrollArea 的 Viewport，保留原生选项键盘定位并提供自定义滚动条。日历年月通过 DayPicker 官方 Dropdown 适配同一 Select，保留年份范围、禁用项与本地日期导航。导航菜单、日期网格和多选筛选保留自身语义。

2026-11-05：Lattice Grid 的 `.lg-*` 样式集中在 globals.css，颜色、字号、行高和工具尺寸引用当前语义令牌；独立包源码纳入 Tailwind 扫描和 UI 规范检查。虚拟列表控制器使用 ScrollArea Viewport 实际滚动值，弹层使用共享 Popover/Select，避免另建主题与坐标定位。单元格编辑使用 Input/SelectTrigger 的 `variant="cell"`：字体、对齐和留白继承单元格，不叠加内框或圆角，整格使用 primary 焦点边框和 card 背景。普通表单继续使用默认变体。

2026-11-06：网格分组标题使用 `.lg-group-label` 在所属组内横向停靠；`--lg-group-label-inset` 统一留白，`--lg-group-sticky-left` 由当前实际冻结列宽度提供。组边界离开时文字一起移走；冻结组维持原位置，分组底色、层级、纵向表头停靠及 ScrollArea 保持同一套样式。

网格滚动口 `.lg-scroller` 使用 `overscroll-behavior: none` 禁止边界弹性回弹，防止 macOS 大幅滚动时出现空隙并露出背景焦点框。只调整网格的滚动边界策略，保留原焦点可见样式和 ScrollArea 自定义滚动条。

共享 ScrollArea 的根与 Viewport 各自建立局部堆叠上下文，滚动条位于内容层之上；冻结列、吸顶表头与汇总行不能挡住滚动条。Lattice 外框统一裁剪内部内容到主题圆角，实际最后一行（含行号格）不画底边，当前最后一列的表头、分组、数据及汇总格不画右侧边界，避免与外框重复；中间分隔线保持原样。

2026-11-06：网格只对 `store.isEditable()` 允许编辑的单元格显示选中边框、选中底色和 text 光标。悬停只呈现 I 形文本光标，不显示或移动边框；点击或键盘切换选中格后，`.lg-cell-indicator` 使用 primary 边框。边框由四条固定厚度的边构成，切换目标仅通过 translate/scale 播放 220ms transform 过渡，不动画化 width/height；滚动或尺寸变化立即贴合，减少动态效果时关闭过渡。只读格维持普通外观，源选区包含只读格时隐藏填充柄；填充柄继续使用 crosshair 光标。

2026-11-06：Lattice 分组、表头和数据行按原分组行高度统一：compact/standard/comfortable 分别为 1.75/2/2.5rem，表头和分组令牌引用数据行令牌，缩放及密度切换时保持等高。筛选行至少 2.5rem，兼容默认输入框。标题操作透明、无按钮底色及阴影；拖拽柄固定占位，仅悬停、键盘聚焦或触摸环境可见。表头列设局部层级，冻结列覆盖滚动列的调宽柄；表头拖动使用现有 ReUI Sortable，减少动态效果时覆盖其内联 transition。列菜单使用共享 DropdownMenu 的小宽度、左对齐项目及组间分隔。

2026-11-06：Lattice Grid 的 `fillHeight` 模式由共享 CSS 分配剩余高度，滚动口保留 16rem 最小空间；小窗口由宿主 ScrollArea 承接外层滚动。sheet 使用纵向 flex，正文补足空白，表头和汇总不收缩，空数据和少量数据时汇总同样停靠底部。未启用该模式的网格保留原高度配置。


2026-11-06：共享 ContextMenu 沿用 Base UI 官方 ContextMenu 原语、下拉菜单间距/图标及主题令牌，长菜单用 ScrollArea；同一菜单的 Root 和 Item 从同一原语入口导入。表格日期编辑复用 DatePicker，日历及年月 Select 的 Portal 均保留编辑作用域。列落位提示只动画覆盖层透明度，遵守 reduced-motion；网格键盘焦点提示不放在滚动内容的内侧。
