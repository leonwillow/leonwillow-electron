# 排版、控件与缩放规范

维护日期：2026-10-04。以下尺寸约定沿用原迁移实现；持久化由 `stores/theme-store.ts` 负责，DOM 和窗口同步由 `components/layout/theme-effects.tsx` 连接。

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

## 持久化和检查

序列化对象增加 `version: 2`，业务 Settings 类型保持原字段。启动、storage 事件和 BroadcastChannel 共用编解码；旧版 `lg` 解码为 `xl`，保留其他有效偏好；新版本 `lg` 可正常保存、刷新及跨窗口同步，不会重复迁移。

`bun run lint` 用 TypeScript AST 检查临时字号、内联字号/行高及页面对 Button/Input/SelectTrigger/RadioGroup 高度和字号的覆盖，并检查 CSS 排版声明是否集中在共享样式中。检查不能代替视觉验证：新布局仍需实际对比不同档位、窗口尺寸和字体。

共享 `cn` 沿用原 clsx + tailwind-merge；新增字号和控件间距令牌必须注册到它的主题配置，避免字号被误认为颜色、或两个高度类同时保留。

`bun run test:ui` 覆盖规则拒绝/允许的代码、实际按钮颜色与控件尺寸合并、旧设置迁移、四档编解码和损坏数据回退。浏览器验证五行控件在每档高度/字号完全一致，并检查其余文字、键盘、刷新、小窗口以及主题切换。

依据 [Tailwind 字号令牌](https://tailwindcss.com/docs/font-size)、[主题变量](https://tailwindcss.com/docs/theme) 和 [Base UI Radio Group](https://base-ui.com/react/components/radio-group) 的公开接口实施。
