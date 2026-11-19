# 自定义主题迁移

维护日期：2026-11-19。新增主题功能前的检查点为 `0813a43`；当前采用 Zustand 状态与浮动编辑面板。

## 来源

原 AIDesk 模板只有预设选择器，没有任意调色和主题库。因此先保留原 `ThemeCustomizer`，再迁入 [shadcn Studio 官方开源仓库](https://github.com/shadcnstudio/shadcn-studio) 的编辑器部件。源码固定在 `72a20331970218848103184b61e1efa9d0e08dea`，原项目和临时上游 checkout 均不作修改。功能范围对照 [官方 Theme Generator 文档](https://shadcnstudio.com/docs/getting-started/theme-generator)。

官方公开源码与当前官网的 Pro/AI 版本并非同一完整应用。本次使用公开的手动调色、CSS 转换、导入和阴影源码，未复制官网私有功能或引入其 Next.js、cookie、服务器 Provider、AI 服务。

| 来源文件 | 当前文件 | 必要适配 |
| --- | --- | --- |
| Studio `src/components/customizer/ThemeColorPanel.tsx` | `apps/web/src/components/theme-editor/theme-color-panel.tsx` | 保留五组 Accordion、ColorSwatch 和 debounce 输入组合；中文、Base UI 属性、共享 Input/Field、统一尺寸、有效色值校验、原模板危险操作前景色 |
| Studio `ShadowControl.tsx` / `SliderWithInput.tsx` | `apps/web/src/components/theme-editor/` 中对应 kebab-case 文件 | 保留颜色、数字输入和 Slider 组合；Base UI 值类型、中文名称、控件尺寸令牌、范围校验 |
| Studio `CssImportDialog.tsx` | `apps/web/src/components/theme-editor/` 中对应 kebab-case 文件 | 保留 Dialog/输入/导入流程；中文、FieldError、同步解析错误反馈、小窗口滚动 |
| Studio `ThemeControlPanel.tsx` | `theme-control-panel.tsx` | 沿用颜色/字体/其他 Tabs 组合及颜色与阴影部件；用当前项目的状态契约接入预览、保存、修改、另存和删除，字体选择复用原 AIDesk 配置 |
| Studio `utils/color-converter.ts` | `utils/theme/color-converter.ts` | 保留四种输出格式及转换分支；使用同一依赖 chroma-js 的现代 CSS 解析，修正透明度、低饱和 HSL 及 OKLCH 精度问题；同格式保留原值，避免 RGB 中转造成色差 |
| Studio `utils/parse-css-input.ts` | `utils/theme/parse-css-input.ts` | 保留 :root/.dark 提取与阴影解析；变量白名单使用项目配置，遍历适配 Biome |
| Studio `utils/shadows.ts` | `utils/theme/shadows.ts` | 保留单层/双层阴影公式和八档映射；限制最终透明度，避免重复 alpha 分隔符 |
| Studio `utils/theme-style-generator.ts` | `utils/theme/theme-style-generator.ts` | 保留明暗语义色 CSS 输出；补齐危险操作前景、阴影参数和字间距；导出不包含第二套 @theme/spacing/圆角换算体系 |
| AIDesk `src/components/ui/tabs.tsx`、Dialog 基础结构 | `packages/ui/src/components/tabs.tsx`、`floating-dialog.tsx` | 页签沿用原组合；当前编辑器宿主使用可拖动浮动 Dialog |
| AIDesk `ThemeCustomizer` 预设 Select | `theme-preset-select.tsx` | 提取原组合复用；增加“我的主题”分组，保留色点、原基础控件和键盘操作 |
| shadcn CLI 的 Base UI / base-mira Accordion / Slider | `packages/ui/src/components/accordion.tsx` / `slider.tsx` | 原模板未提供这两项，使用官方 registry；修正 monorepo utils alias，Slider 前景使用语义背景，名称传入实际 thumb |

官方源码的完整版权声明和许可证（含附加条款）保留在 [shadcn-studio-LICENSE.md](./third-party/shadcn-studio-LICENSE.md)。

## 行为与边界

- 2026-11-19（内置预设重制与状态语义色联动）：移除原模板中对比度异常或色相突兀的全部旧预设，仅保留系统「默认」并重新设计 14 套明亮、现代、层次分明的工作台内置主题（加上「默认」共 15 项）：**Claude**（暖纸 × 赤陶，重构官方羊皮纸与暖炭黑深色并修复原版危险色/暗色边框异常）、**Vuexy**（经典紫罗兰 × 深靛蓝夜色与标志性四色语义）、**晴空蓝白**（`azure-white`）、**碧海晴天**（`sky-cerulean`）、**极光靛蓝**（`indigo-prism`）、**澄澈青岚**（`aqua-breeze`）、**翡翠青柠**（`mint-spring`）、**银灰极简**（`apple-slate`）、**珊瑚暖阳**（`coral-glow`）、**暖阳蜂蜜**（`honey-amber`）、**绯樱玫瑰**（`rose-petal`）、**曜石流金**（`champagne-noir`）、**深海蔚蓝**（`ocean-deep`）和 **清新森系**（`sage-studio`）。同步在 `STATUS_COLOR_KEYS`（`info`/`info-foreground`、`success`/`success-foreground`、`warning`/`warning-foreground`）扩展可选状态语义色，使各预设在按钮、徽章、表单、侧栏激活态、计算器预警与深浅色卡片上形成整体协调；主题编辑器新增「状态语义」折叠分组并支持 CSS 导出/导入往返，旧自定义主题快照保持完全兼容。同步修正 `ThemePresetSelect` 中「默认」的预览色点使其与共享 `tokens.css` 真实主色一致，并补充所有内置预设的正文/按钮/语义状态微底色对比度及 sRGB 色域回归测试。
- 2026-11-19：菜单外观新增第三项「悬浮时尚」（`Settings.sidebarMode = "floating-pill"`），常用主题面板的菜单外观分段单选扩展为「贴边 / 悬浮 / 悬浮时尚」三列。选择后左侧主图标栏拆为三段独立圆角胶囊（顶部为品牌 Logo 与搜索、中间垂直居中为已授权主导航、底部为管理中心/自定义主题/明暗/全屏/头像系统功能区），主导航无授权入口时隐藏中间胶囊；胶囊边框、背景、前景色与线宽均读取共享语义令牌。沿用 v2 快照保存、刷新恢复与跨窗口同步，重置主题仍恢复默认「贴边」。同日将常用主题面板的「颜色模式」（浅色 / 深色 / 跟随系统）与「重置主题」接入共享 `lib/theme-transition.ts` 的 `runThemeTransition`；实际解析明暗发生变化时播放与侧栏按钮、D 快捷键一致的 500ms 从左向右渐变过渡，解析明暗未变或处于主题编辑器强制预览时直接提交、不播放空过渡。
- 2026-11-17：常用主题面板新增全局“线条粗细”和当前颜色模式的“线条颜色”。粗细提供 0.5/1/1.5/2px，默认 1px；颜色使用下述 ReUI 最近颜色色盘，支持可视化选色和透明度，“跟随主题”清除当前模式覆盖。`Settings.borderWidth`、`borderColorLight`、`borderColorDark` 随 v2 快照即时保存、首屏恢复和跨窗口同步；旧快照、非法线宽及非法颜色各自回退默认。重置主题恢复 1px 并清除两种模式的颜色覆盖。
- 线条偏好与界面缩放一样独立于主题库，切换预设保留；不改写保存的配色及 CSS 导入/导出。`applyTheme` 只设置 `--ui-border-width` 和可选 `--ui-line-color`，原始 `border` / `input` / `sidebar-border` 保留为各自的主题色。全局颜色覆盖优先于预设及编辑预览的普通线条色；恢复“跟随主题”后立即显示原主题配色。SVG 图标、图表、焦点/选中/错误状态及打印线条不受影响。
- 2026-11-10：常用主题面板的颜色模式、圆角、缩放采用分段单选的默认尺寸，与主题预设/字体 Select 共用 `control-md` / `text-control`。新增“菜单外观：贴边 / 悬浮”，使用同样的单选组合与方向键行为；默认贴边；悬浮时主图标栏与右侧工作区分别形成留白外框，固定二级菜单和正文仍为一个整体。`Settings.sidebarMode` 随现有 v2 快照保存、刷新恢复和跨窗口同步；旧快照或无效值回退贴边，重置主题时恢复默认，不修改主题库的配色记录。
- 原主题面板右上角增加“设置”，打开浮动 Dialog。原预设、字体、明暗模式、圆角 Tooltip、四档缩放和重置组合保留。
- 编辑浅色和深色各自的 32 个语义颜色，包括品牌、基础界面、交互、侧栏、图表；色块打开原生调色盘，文本支持 HEX、OKLCH、HSL、RGB 和透明度。
- 字体使用原项目已打包的 18 个选项，圆角沿用原四档；支持字间距、阴影颜色、不透明度、模糊、扩散和水平/垂直偏移。字号和界面缩放仍由原共享 rem 规则管理，不开放覆盖 `--spacing`、`--text-*` 或 `--ui-scale`。
- 草稿实时预览；取消、关闭和 Escape 恢复持久化主题及原颜色模式。“还原编辑”恢复打开时或最近选择的基础主题。
- 编辑时暂停页面的 D 快捷键，通过面板的模式控件预览浅深色，避免快捷键改动草稿背后的持久化偏好。
- 保存同时包含浅深色配色、名称、字体和圆角。选中已有主题可修改/改名，另存为需使用不同名称；删除有确认菜单。主题库最多 100 个有效主题，名称 1～40 字符且有效主题之间不能重名。2026-10-06 起删除写入 `deletedAt`，保留样式和名称但不再显示；刷新、跨窗口同步继续保留删除标记，旧选择回退默认。删除记录不占有效主题数量和名称，存储配额不足时仍保留原偏好并提示失败。
- 保存后可在原预设菜单的“我的主题”中切换。原重置只恢复当前外观，不删除已保存主题。
- CSS 导出支持 OKLCH/HEX/HSL/RGB，包含 :root/.dark 和必要的阴影参数；可在本项目导入。导入按模式合并支持的变量，不执行 CSS，不插入 style 标签，不加载外部资源。字体只有匹配当前配置时才采用，圆角只有匹配原四档时才采用，其他字体/圆角保持当前值。
- 本次只保存于当前浏览器，Web/Electron 使用同一前端代码；尚无云端账户同步或主题 API。不同设备可通过导出/导入转移配色。

## 全局线条色盘（2026-11-17）

按指定的 [ReUI `c-color-picker-9`](https://reui.io/components/color-picker/c-color-picker-9) 迁入最近颜色组合，读取官方 [base-mira 示例 registry](https://reui.io/r/styles/base-mira/c-color-picker-9.json) 和 [Color Picker registry](https://reui.io/r/styles/base-mira/color-picker.json) 的真实源码（MIT）。保留外层色块、HEX 值与下拉触发器，以及弹层里的颜色区域、取色器、色相和格式字段；额外启用官方 `alpha` 能力，显示不透明度滑条，避免原主题半透明线条被转为不透明。

`packages/ui/src/components/color-picker.tsx` 复用当前 Button、InputGroup、DropdownMenu、Popover、Separator 与 Lucide 图标，不覆盖这些基础组件，不增加 Radix 或第三方颜色依赖；registry 的 `cn` 依赖替换为项目已有的 `cn` 工具，因此无须改动 package.json 或 Bun 锁文件。颜色数学从官方单文件拆至 `color-picker-color.tsx`，保留 CSS 色值解析、色域映射、无彩色色相、OKLCH 通道和 alpha。原 registry 为宽松数组索引的 TypeScript 写法，适配当前严格检查时补充缺失通道和正则捕获检查。公共 API 保留 `ColorPicker` 的受控 `value`、`onValueChange`、`onValueCommit`、`alpha`、`format`，以及 Area、Slider、Fields、Swatches 等组合部件。

所有默认可访问名称和颜色描述改为中文，滑轨及色域保留官方方向键、Shift 大步长、Home/End 操作。色块和滑轨属于颜色内容，沿用 `forced-color-adjust: none`，其余控件继续跟随系统与项目语义色。弹层复用共享 ScrollArea，宽高限制在可用视口；不修改全局字号或控件高度。

常用面板外层无需输入色值即可完成选择，内部保留可选的 HEX/RGB/HSL/HSB/OKLCH 字段。无效字段不会提交，失焦时恢复已选颜色。`onValueChange` 继续即时更新当前浅色或深色的线条偏好；`onValueCommit` 才记录最近颜色，每次拖动只记最终选择，按等价 HEX（含 alpha）去重，最多八项，最新在前。历史从空列表开始，不用示例颜色伪装用户记录，通过独立键 `leonwillow:theme-line-recent-colors:v1` 在当前浏览器保存；损坏内容逐项过滤，存储不可用时保留本次打开期间的记录。历史不进入主题库和 CSS 导出。

色盘弹层内提供“默认”选项，色块预览当前主题真实 `--border`（含透明度），当前使用默认色时显示勾选和选中状态。点击后将当前模式的颜色覆盖设为 `null` 并关闭弹层，不把主题默认色保存为用户颜色或加入最近记录；切换主题后仍自动跟随。外部原“跟随主题”按钮同步改名为“默认”，状态提示为“当前使用主题默认色”。仅查看色盘不会改写原始主题色或 alpha。全局线宽、明暗模式独立颜色、重置和原有主题持久化契约不变。新增九项纯逻辑回归覆盖透明度、色域往返、无效颜色、最近颜色去重和损坏存储；颜色控件仍需在浏览器验证拖动、方向键、弹层焦点、窄窗和刷新恢复。

## 状态与目录

`components/theme-editor` 放编辑器视图与局部草稿；`configs/theme-variables.ts` 放可编辑变量；`lib/custom-themes.ts` 管理主题库规则；`utils/theme` 放颜色、阴影和 CSS 算法。默认色板读取同一份共享 CSS。

2026-11-04：默认配色改为 [Shadcn Studio 官方生成器默认配置](https://github.com/shadcnstudio/shadcn-studio/blob/72a20331970218848103184b61e1efa9d0e08dea/src/config/theme.ts) 的 `defaultLightThemeStyles` / `defaultDarkThemeStyles`，采用其 Zinc 中性色、主色/前景配对、侧栏与图表色。来源为明确的默认主题对象，不使用营销站自身的基础 CSS 或其他命名预设。按 [官方主题生成器说明](https://shadcnstudio.com/docs/getting-started/theme-generator) 仅合并共享 `globals.css` 的 `:root` / `.dark` 颜色：浅色主色 `oklch(0.21 0.006 285.885)`，深色主色 `oklch(0.92 0.004 286.32)`。

该次变更保留了项目扩展的成功、警告、在线状态及危险操作前景色；字体、圆角、字号、缩放和布局尺寸不随配色变更。`initialSettings.themePreset` 仍为 `default`；`getPreset` 对它返回空覆盖，首屏与运行时的 `applyTheme` 清除旧颜色后使用共享 CSS，`createThemeDraft` 也读取这一份默认值。已有其他预设及用户保存的自定义色板不改写；当前选择“默认”时开发热更新或刷新即可采用新配色。

2026-11-06：按最新要求，默认配色改为 [ReUI 当前组件预览](https://reui.io/components/dialog) 的 Neutral 色板。核对官网 `style-nova` / `base-color-neutral` 默认配置及其明暗 CSS：浅色主色 `oklch(0.205 0 0)`、深色主色 `oklch(0.922 0 0)`，基础界面、侧栏和图表令牌一并同步；两份 `components.json` 的 `baseColor` 同步为 `neutral`。仅适配颜色，保留现有 Base UI / base-mira 组件结构、尺寸及交互。

成功、信息、警告、反色及其前景色采用 [ReUI Styling](https://reui.io/docs/styling) 的 Emerald、Violet、Yellow、Zinc 组合；危险操作前景采用 Red 800 / 600。共享 CSS 用对应 Tailwind OKLCH 显式值，保证主题编辑与导出能够读取。按钮仍为语义色 ghost，文字和图标使用配对的 foreground，悬停背景使用色彩令牌；通知和警告金额也使用同一组配对令牌。在线状态保留独立业务语义。主题存储格式、白名单和用户已保存色板不变，扩展色由共享 CSS 提供。

本次还移除了 Dialog 的固定 `bg-black/80` 和 Sheet 的 `bg-black/50`。两者统一使用共享 `--overlay: oklch(0 0 0 / 10%)`，支持时启用 `backdrop-blur-xs`（4px），与 ReUI 默认 Nova 示例一致，明暗模式同样处理。非模态浮窗的 `showOverlay={false}` 保持原行为；不重置用户主题选择。

`stores/theme-store.ts` 持有已保存偏好和主题库，临时 preview 不进入持久化快照。`theme-effects.tsx` 连接 DOM、storage、BroadcastChannel 与快捷键。`root-layout.tsx` 在 Outlet 外按需加载编辑器，跨路由保留编辑会话。

快照格式仍为 version 2，旧 lg 到 xl 的迁移、损坏数据回退与主题 ID 校验由同一编解码入口处理。草稿归面板管理，保存通过 Store 提交；存储失败保留草稿。后续可以提取局部编辑会话，但这不属于本次工程修正。

## 验证

2026-11-19（14 套内置预设重制与状态语义色）：`bun run lint`、`bun run check-types`、`bun run test:ui`（新增所有内置预设正文/按钮/四类状态语义色微底色对比度、sRGB 色域及下线旧预设回退测试）与全量 `bun run build` 通过；浏览器在 `/admin/users` 验证 15 项预设清单（`默认` + 14 套新主题），核对 `Claude`、`Vuexy`、`晴空蓝白`、`翡翠青柠`、`珊瑚暖阳` 浅深色变量与按钮/徽章/卡片对比，确认主题编辑器「状态语义」分组展开展示信息/成功/警告六项语义色。

2026-11-19（主题设置明暗过渡）：补充 `apps/web/test/theme-transition.test.ts`（覆盖 `resolveThemeMode`、`runThemeTransition` 同色跳过、中途反向打断及降级回退），`bun run lint`、`bun run check-types`、`bun run test:ui`（122 项）与全量 `bun run build` 通过；浏览器实测主题设置面板内点击及方向键切换「浅色 / 深色 / 跟随系统」时，仅当解析明暗实际改变才触发 `data-theme-transition="sweep"` 并在完成后自动清理，弹层保持打开。

2026-11-19（菜单外观「悬浮时尚」）：`bun run lint`、`bun run check-types`、`bun run test:ui` 与全量 `bun run build` 通过；补充 `theme-settings` 与 `theme-store` 对 `floating-pill` 的 v2 编解码及存储回归。浏览器在 `1280×800` 验证「贴边 / 悬浮 / 悬浮时尚」单行展示，切换后主题弹层保持打开不卸载，三段胶囊（Logo+搜索 / 主导航 / 系统功能区）左右对齐且与右侧正文卡片上下齐平，未固定浮窗与固定二级菜单、命令搜索、深浅色对比、`1024×420` 短窗、`390×844` 窄窗无横向溢出及刷新持久化均正常。

2026-11-17（ReUI 色盘）：浏览器验证可视化拖动即时更新线条，释放后仅新增一条最近颜色；色相/不透明度方向键、最近颜色刷新恢复、浅深色隔离、原深色 10% alpha、跟随主题、Escape 返回触发器和 390×640 深色窄窗通过。UI 测试共 131 项通过，新增颜色解析、透明度、宽色域和最近历史校验。验证后恢复用户原主题偏好和最近颜色记录。

2026-11-17：全局线条设置通过 `bun run lint`、`bun run check-types`、`bun run build` 和 122 项 UI 测试。浏览器确认默认恢复 1px；0.5px、1.5px、2px 与自定义颜色同步作用于表格、侧栏、输入框、分隔条、卡片、弹层和普通通知，输入框底色及选中边框语义保持原样。验证了方向键、无效颜色不提交、透明度、浅深色独立配色、跟随主题、刷新恢复、跨窗口同步和重置。390×640 窄窗及特大缩放下主题面板可滚动，Escape 返回触发按钮；网格选中边框在 0.5px / 2px 下均贴合单元格。验证后恢复原浅色、默认预设、中档缩放及 1px 默认线条设置。

2026-11-06：侧栏明暗按钮及 D 快捷键参考 [Arc ThemeSwitch](https://uiarc.dev/components/theme-switch) 的 `startViewTransition` 回调方式，保留现有 Button、Tooltip 和 Arc SunMoonIcon。官方组件只通知模式变化，页面过渡由调用方负责；项目通过 `lib/theme-transition.ts` 在快照更新回调中同步提交 Zustand 偏好和 next-themes 状态，再用共享 CSS 的透明度掩膜从左向右揭示新主题，时长按最新体验反馈（2026-11-07）设为 500ms，不添加另一套主题颜色或页面副本。快速重复操作会跳过旧过渡并采用最后一次目标模式；系统减少动态效果、后台页面及不支持 View Transition 时直接更新。首屏、系统模式变化及跨窗口同步沿用原有即时应用行为。

2026-11-07：修正“标称 1s 但观感仍很快”的速度曲线与掩膜范围。原 300% 掩膜从 100% 移到 0%，配合快速减速曲线，实际可见的变化只发生在约 40–294ms。现在使用 linear，并把 mask-position 的起止收紧为 82.5% / 17.5%，让渐变边缘恰好从视口左边界进入、在右边界结束，完整可见过程覆盖设定时长；后续按体验反馈将 1s 调为 500ms，保留匀速及修正后的范围。

修正后的 1s 版本浏览器连续采样确认：桌面约 520ms 时渐变位于屏幕中间，990ms 仍在右侧收尾，约 1035ms 已结束；390px 窄窗的反向切换同样在约 514ms 经过中间、1060ms 已结束（含快照开始及采样间隔）。恢复原有深色、大档缩放与窗口尺寸，控制台无错误。lint、check-types、test:ui（8 + 104 项）及 build 通过。

2026-11-06：默认配色及遮罩调整通过 lint、check-types、build 和 100 项 UI 测试。浏览器核验默认浅深色的遮罩均为 10% 黑色、4px 模糊且只有一层；Tab、取消、Escape 及触发器焦点恢复正常。切换 Claude 预设仍使用自己的主色与统一遮罩；390×844、特大缩放下弹窗无横向溢出。恢复原浅色、默认预设、大档缩放后刷新，令牌及偏好正确，控制台无错误。

以下浏览器结果为原迁移阶段记录，后续改动须按当前验证入口重新检查。

执行 `bun run lint`、`bun run check-types`、`bun run build` 和 `bun run test:ui`。UI 测试增加主题命名、保存/覆盖/删除、损坏存储、悬空选择、版本边界、色值/透明度、CSS 合并和阴影导出回归。

浏览器检查编辑入口、调色、浅深色切换、取消和还原、保存后刷新、CSS 错误反馈、字体/阴影预览及键盘操作。四档中原预设/字体控件高度分别约 28.80/30.40/32.00/33.59 px，字号约 10.8/11.4/12/12.6 px；新面板使用同一控件令牌。

跨窗口验证：未保存的草稿不改变另一窗口，保存后颜色、字体、圆角、阴影和字间距同步。390×520 和 320×480 窗口没有页面横向溢出，编辑区域独立滚动，底部操作可见且会换行。删除确认可取消，Escape 关闭编辑器后焦点回到原调色入口；D 快捷键在编辑器外有效，在编辑器内不改变预览模式。
