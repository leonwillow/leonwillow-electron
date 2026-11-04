# 自定义主题迁移

维护日期：2026-10-04。新增主题功能前的检查点为 `0813a43`；当前采用 Zustand 状态与浮动编辑面板。

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

- 原主题面板右上角增加“设置”，打开浮动 Dialog。原预设、字体、明暗模式、圆角 Tooltip、四档缩放和重置组合保留。
- 编辑浅色和深色各自的 32 个语义颜色，包括品牌、基础界面、交互、侧栏、图表；色块打开原生调色盘，文本支持 HEX、OKLCH、HSL、RGB 和透明度。
- 字体使用原项目已打包的 18 个选项，圆角沿用原四档；支持字间距、阴影颜色、不透明度、模糊、扩散和水平/垂直偏移。字号和界面缩放仍由原共享 rem 规则管理，不开放覆盖 `--spacing`、`--text-*` 或 `--ui-scale`。
- 草稿实时预览；取消、关闭和 Escape 恢复持久化主题及原颜色模式。“还原编辑”恢复打开时或最近选择的基础主题。
- 编辑时暂停页面的 D 快捷键，通过面板的模式控件预览浅深色，避免快捷键改动草稿背后的持久化偏好。
- 保存同时包含浅深色配色、名称、字体和圆角。选中已有主题可修改/改名，另存为需使用不同名称；删除有确认菜单。主题库最多 100 个有效主题，名称 1～40 字符且有效主题之间不能重名。2026-10-06 起删除写入 `deletedAt`，保留样式和名称但不再显示；刷新、跨窗口同步继续保留删除标记，旧选择回退默认。删除记录不占有效主题数量和名称，存储配额不足时仍保留原偏好并提示失败。
- 保存后可在原预设菜单的“我的主题”中切换。原重置只恢复当前外观，不删除已保存主题。
- CSS 导出支持 OKLCH/HEX/HSL/RGB，包含 :root/.dark 和必要的阴影参数；可在本项目导入。导入按模式合并支持的变量，不执行 CSS，不插入 style 标签，不加载外部资源。字体只有匹配当前配置时才采用，圆角只有匹配原四档时才采用，其他字体/圆角保持当前值。
- 本次只保存于当前浏览器，Web/Electron 使用同一前端代码；尚无云端账户同步或主题 API。不同设备可通过导出/导入转移配色。

## 状态与目录

`components/theme-editor` 放编辑器视图与局部草稿；`configs/theme-variables.ts` 放可编辑变量；`lib/custom-themes.ts` 管理主题库规则；`utils/theme` 放颜色、阴影和 CSS 算法。默认色板读取同一份共享 CSS。

2026-11-04：默认配色改为 [Shadcn Studio 官方生成器默认配置](https://github.com/shadcnstudio/shadcn-studio/blob/72a20331970218848103184b61e1efa9d0e08dea/src/config/theme.ts) 的 `defaultLightThemeStyles` / `defaultDarkThemeStyles`，采用其 Zinc 中性色、主色/前景配对、侧栏与图表色。来源为明确的默认主题对象，不使用营销站自身的基础 CSS 或其他命名预设。按 [官方主题生成器说明](https://shadcnstudio.com/docs/getting-started/theme-generator) 仅合并共享 `globals.css` 的 `:root` / `.dark` 颜色：浅色主色 `oklch(0.21 0.006 285.885)`，深色主色 `oklch(0.92 0.004 286.32)`。

项目扩展的成功、警告、在线状态及危险操作前景色继续保留；字体、圆角、字号、缩放和布局尺寸不随配色变更。`initialSettings.themePreset` 仍为 `default`；`getPreset` 对它返回空覆盖，首屏与运行时的 `applyTheme` 清除旧颜色后使用共享 CSS，`createThemeDraft` 也读取这一份默认值。已有其他预设及用户保存的自定义色板不改写；当前选择“默认”时开发热更新或刷新即可采用新配色。

`stores/theme-store.ts` 持有已保存偏好和主题库，临时 preview 不进入持久化快照。`theme-effects.tsx` 连接 DOM、storage、BroadcastChannel 与快捷键。`root-layout.tsx` 在 Outlet 外按需加载编辑器，跨路由保留编辑会话。

快照格式仍为 version 2，旧 lg 到 xl 的迁移、损坏数据回退与主题 ID 校验由同一编解码入口处理。草稿归面板管理，保存通过 Store 提交；存储失败保留草稿。后续可以提取局部编辑会话，但这不属于本次工程修正。

## 验证

以下浏览器结果为原迁移阶段记录，后续改动须按当前验证入口重新检查。

执行 `bun run lint`、`bun run check-types`、`bun run build` 和 `bun run test:ui`。UI 测试增加主题命名、保存/覆盖/删除、损坏存储、悬空选择、版本边界、色值/透明度、CSS 合并和阴影导出回归。

浏览器检查编辑入口、调色、浅深色切换、取消和还原、保存后刷新、CSS 错误反馈、字体/阴影预览及键盘操作。四档中原预设/字体控件高度分别约 28.80/30.40/32.00/33.59 px，字号约 10.8/11.4/12/12.6 px；新面板使用同一控件令牌。

跨窗口验证：未保存的草稿不改变另一窗口，保存后颜色、字体、圆角、阴影和字间距同步。390×520 和 320×480 窗口没有页面横向溢出，编辑区域独立滚动，底部操作可见且会换行。删除确认可取消，Escape 关闭编辑器后焦点回到原调色入口；D 快捷键在编辑器外有效，在编辑器内不改变预览模式。
