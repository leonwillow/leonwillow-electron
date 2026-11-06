# 当前工作区适配说明

本包 `@leonwillow-electron/lattice-grid` 于 2026-11-05 从用户提供的 Lattice Grid 0.1.0-beta.1 本地源码适配，保留其 MIT 许可证及下方上游声明。

- 复用纯 TypeScript 数据内核和交互控制器；未包含原 Vue 适配器、演示页面、示例 CSV、DOM 工厂或原 CSS。
- React 视图改用当前工作区的共享 UI / Base UI 组件、ScrollArea 和语义主题令牌。
- 运行时依赖由当前工作区管理：React、React DOM、共享 UI、Lucide React、Sonner；未嵌入这些依赖源码。
- `Column.width` / `minWidth` / `maxWidth` 继续使用 CSS 像素；行高、表头、汇总行与行号栏由共享 rem 令牌换算。
- `reconcileRows: "editable"` 是本次新增的可选受控数据契约：仅保留与已接受编辑相同的行标识和可编辑值的历史，允许父页面刷新只读派生值。

以下为源项目的原始声明，描述源项目的包与示例；其中提及的 Vue 包、演示文件和依赖报告未随本包迁入。

---

# Source and dependency notice

Lattice Grid's new TypeScript engine, framework adapters, DOM rendering vocabulary, CSS and SVG control icons were authored for this project. The visual reference was the UIArc Renewals demonstration and the user's screenshot. This is an independent component project and is not affiliated with UIArc.

No UIArc JavaScript, extracted stylesheet, downloaded font, brand asset, or original demo implementation is included in the npm packages. This new project intentionally does not import the previous `renewals-grid` demo. No claim is made that inspecting and reimplementing a visual design grants rights in another party's trademarks or source assets.

The new workspace's example CSV is generated deterministically by `scripts/synthetic-data.mjs`. The user-supplied CSV remains only in the earlier local replication demo, outside this component project. npm packages exclude all example data. The generated data is fictional and does not represent customer records.

Runtime dependencies:

- `@lattice-grid/core`: no third-party runtime dependencies.
- `@lattice-grid/react`: local core package and consumer-supplied React (MIT).
- `@lattice-grid/vue`: local core package and consumer-supplied Vue (MIT).

React and Vue are external peer dependencies; their source is not embedded in the library bundles. Their installed license files are listed in `docs/dependency-licenses.json`. Development tools are excluded from distributed npm archives. The example production bundle includes the framework runtimes; use the license report and preserve their license notices if redistributing that bundle.
