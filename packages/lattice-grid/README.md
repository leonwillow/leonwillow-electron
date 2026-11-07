# Lattice Grid 工作区包

基于本地 Lattice Grid 0.1.0-beta.1 的 React 版本适配，供当前 SPA 和未来 Electron renderer 共用。MIT 来源及许可见 LICENSE、NOTICE.md。

```tsx
import { useState } from "react";
import { DataGrid, type Column } from "@leonwillow-electron/lattice-grid";

type Item = { id: string; name: string; quantity: number };
const columns: Column<Item>[] = [
  { id: "name", field: "name", header: "名称", pinned: true, required: true },
  { id: "quantity", field: "quantity", header: "数量", type: "number", min: 0, integer: true, aggregate: "sum" },
];
const getRowId = (row: Item) => row.id;

export function Inventory() {
  const [rows, setRows] = useState<readonly Item[]>([]);
  return <DataGrid rows={rows} columns={columns} getRowId={getRowId}
    label="库存明细" onRowsChange={setRows} />;
}
```

在当前应用无需单独导入样式：`@leonwillow-electron/ui/globals.css` 已包含网格主题规则和 Tailwind 源码扫描。包通过 `workspace:*` 引用源码，无需单独启动示例服务或生成 dist。

## 边界

- `src/core` 保留泛型数据处理、稳定行 ID、选择、筛选、排序、原子编辑/粘贴、校验、事务、撤销重做和安全 CSV 导出。
- React 视图使用共享 ReUI/Base UI 控件，主题、字号、行高、弹层和滚动由当前 UI 体系管理。
- 业务列定义、货币精度、权限、保存与服务端冲突处理由调用页面负责，包不导入应用路由、Eden、数据库或税务算法。
- 默认中文；提供 `renderCell`、`renderEditor`、`renderToolbar`、`renderEmpty` 扩展，以及 `apiRef` 获取实例。未接管的单元格从 `renderCell` 返回 `undefined`，交给默认显示。
- `toolbarContent?: ReactNode` 用于宿主筛选和业务操作，显示在行数之后、右侧内置工具之前，空间不足时自动换行。原 `renderToolbar(store)` 仍追加在内置工具之后；`toolbar={false}` 会隐藏整条工具栏及两个插槽。
- 列宽 `width/minWidth/maxWidth` 是 CSS 像素，行高和工具控件跟随应用 rem 主题。可指定 `height`，默认使用响应式高度。`fillHeight` 可填满有界纵向 flex 父级的剩余高度，启用后优先于 `height`；工具栏和状态栏保留自身高度，滚动区分配剩余空间。小窗口保留最小可用高度，宿主可通过共享 ScrollArea 容纳溢出。

## 接入约定

使用稳定 `getRowId`，不要用数组序号作为业务 ID。将列定义保持在模块作用域或 useMemo 中。传入不可变 rows；整批修改通过一个 `onRowsChange(rows, transaction)` 回调确认，避免逐格 setState 覆盖同批修改。

行和单元格按真实显示依赖做浅比较，编辑草稿只由当前编辑器订阅。宿主筛选结果应使用 `useMemo`，不依赖组件状态的 `renderCell/renderEditor` 可放在模块作用域；依赖状态时使用完整依赖的 `useCallback`，不要冻结旧闭包。格式化和取值函数应为纯函数；行、列配置或格式化所依赖的外部值变化时提供新的数据/列引用。每个实例只缓存当前数据版本的搜索文本，编辑、撤销重做、外部数据替换、列定义或 locale 改变时失效；首次搜索仍需格式化，后续查询复用已计算文本，匹配规则不变。

远程原子保存可用 `onCommit(transaction, { signal })`：成功后提交本地结果，抛错则保留原值；服务端仍须校验权限、修订号和数据。取消过期操作时尊重 signal。也可让宿主接管 `onRowsChange` 后统一自动保存，增值税页采用此方式。

`readOnly` 禁止修改；删除仅在显式 `allowDelete` 时提供。`state/onStateChange` 支持受控视图；默认不读写 localStorage。`mode="server"` 只处理传入的当前页，宿主根据筛选/排序状态请求数据，摘要和导出不会自动读取未加载页。

启用 `allowDelete` 后，勾选行会在工具栏显示“删除所选行”。点击先提交并校验当前编辑，再确认固定的行 ID；取消不修改，确认走原有原子事务，成功清空勾选，支持撤销/重做。确认期间外部行版本变化则拒绝陈旧目标。宿主必须处理事务前后的行增删（包括撤销恢复），不能仅回写单元格差异；VAT 适配将其合并到完整方案后自动保存。历史只保留在当前网格实例内，刷新或外部替换数据后不承诺恢复。

当宿主根据编辑重新计算只读列时，可设置 `reconcileRows="editable"`：同序行 ID 和可编辑值未发生额外变化时，保留撤销历史；真正的外部修改会清除旧历史并取消正在输入的旧草稿。普通页面保持默认行为即可。`loading`、`error` 或 `readOnly` 激活时会取消尚未完成的编辑。

双击或 Enter/F2 打开编辑时保留当前值，直接键入则替换原文本。Enter/Tab 提交并移动选区，校验失败保留编辑以便修正；Esc/取消放弃本次改动。点击或聚焦外部会立即关闭编辑，有效改动提交，无效改动保留原值并显示错误通知；异步保存结束不会抢回焦点。未改文本时不提交，不增加撤销记录。

列的 `formatEdit(value, row)` 可返回可被 `parse` 接受的编辑文本，例如将未录入金额呈现为 `0.00`；仅打开并离开不会改变原始空值。`align` 统一显示与编辑的文本对齐，`inputMode` 控制输入键盘；两者均不改变底层数据类型。默认编辑器使用 Input/SelectTrigger 的 `cell` 变体，继承单元格字体与留白，焦点边框由整个单元格呈现。

自定义 `renderEditor` 通过 `onValueChange` 同步草稿，以支持离开时保存；`commit`/`cancel` 仍可显式结束编辑。Portal 弹层根节点应标记 `data-lg-edit-scope={editScope}`，避免点击内部选项被认为离开；编辑已结束时不应让弹层恢复到旧触发器的焦点。

只读单元格保留键盘导航、范围选择和复制语义，但点击时不显示选中边框或选中底色。可编辑格悬停使用 I 形文本光标，悬停不显示或移动边框。选中边框挂在实际单元格内部，原生跟随滚动、冻结和尺寸变化，层级与单元格一致。仅点击或键盘切换时使用正文装饰层进行 160ms 匀速过渡；边框与裁剪边界同步移动，目标格部分被固定列遮挡时，动画终帧也与最终选中框一致。结束或开始滚动就移除装饰层，恢复单元格边框，不播放追赶动画。表头、汇总和视口边界正确遮挡，遵守 `prefers-reduced-motion`。不提供拖拽填充，右下角无填充点；拖动只扩展选区，不修改数据。

复制与数字筛选使用列的 `getValue` 返回值，不使用格式化显示字符串；返回值的单位应与输入单位一致。VAT 适配层以元字符串对接网格，内部计算继续使用整数分。只读金额、币种或单位不同的列不要直接混用通用选区求和，可通过 `statusBar={false}` 隐藏。`exportable={false}` 可关闭网格 CSV 导出，交由宿主提供完整业务导出。

窄窗口不足以同时显示冻结列和可滚动区域时，暂时让冻结列随内容滚动；恢复宽度后自动恢复冻结，列配置不会被改写。主题跟随全局共享 UI，不支持单独指定一套网格主题。

列的 `group` 标题默认在横向滚动时停靠于冻结列（或行号列）之后，直到所属分组右边界将文字带走。停靠范围仅限当前分组；列宽、隐藏、冻结和窗口变化会重新采用实际布局，不需要业务页面监听滚动或单独配置。

列标题悬停时显示 ReUI Sortable 手柄，支持鼠标拖动、Space/方向键排序与 Escape 取消。冻结列与普通列分别排序；窄窗临时取消视觉冻结不改变所属区域。`reorderVisibleColumns(ids, pinned)` 接收该区域全部可见列 ID 的新排列，验证失败返回 false，隐藏列及另一组保持不变。`canMoveColumn(id, direction)` 与 `moveColumn(id, direction)` 同样限制组内移动，视图保存继续沿用 `saveView/restoreView`。

密度同时影响分组行、标题行和数据行，三者始终等高：紧凑 1.75rem、标准 2rem、宽松 2.5rem，沿用原分组行高度；筛选输入保留足够高度。标题点击排序保留键盘操作，但不绘制按钮背景；列菜单使用共享 DropdownMenu。

当前保留固定行高和行虚拟化；不承诺可变行高、右冻结、树形透视、公式、XLSX 或所有浏览器/辅助技术认证。这里的列分组是表头展示，不是数据透视分组。

`summary` 默认启用底部汇总行，`summary={false}` 可关闭。汇总始终停靠在网格滚动口底部；空结果或行数不足一屏时，正文补足空白，不把汇总留在页面中间。列的 `aggregate` 计算当前筛选后的全部行，`formatAggregate` 控制展示；`aggregateLabel` 可自定义前缀（例如“期末”），设为空字符串可只显示结果。金额等精确计算由业务自定义聚合函数，余额应按业务时间边界取值，不依赖当前视觉排序。


右键菜单默认提供复制；可选 `onInsertRows({rowId,columnId,row,position,count})` 接管上下插入空行。回调抛错由菜单显示错误通知，失败时批量数量弹窗保留；只读、加载和提交中禁止插入。实际字段、持久化和行 ID 由业务页面负责。支持 Shift+F10/ContextMenu 键打开菜单，输入编辑期间使用原生文本菜单。

`revealCell={{rowId,columnId}}` 使用稳定身份定位一次，等待异步行数据就绪后滚动并选中；需要再次定位时传入新请求对象。它不改变过滤器或排序，宿主可用 `apiRef.current.setState` 清除会隐藏新行的视图条件。

小于等于 200 行时完整渲染；更大列表使用至少一屏的前后缓冲，快速滚动直接更新虚拟窗口。列排序关闭通用纵向自动滚动，鼠标拖动支持横向边缘滚动，落位短暂高亮对应列；冻结组边界及官方拖动/键盘行为保持一致。
