/**
 * @file 计算器目录的模块定义与统一元数据类型。
 * 创建时间：2026-11-05；修改时间：2026-11-05。
 * 版本作用：目录只读取摘要，编辑页按路由读取完整业务数据。
 * 被调用：计算器导航、菜单和编辑器；调用：两种 Eden 客户端与 Lucide。
 * 预期结果：目录行为一致，业务算法及数据保持隔离。
 */
import { CalculatorIcon, CalendarClockIcon } from "lucide-react";
import {
	createScenario,
	listScenarios,
	type ScenarioSummary,
	updateScenario,
} from "./calculators";
import { createLateFee, listLateFees, updateLateFee } from "./late-fees";
export type CalculatorKind = "vat" | "late-fees";
export type CalculatorSummary = ScenarioSummary;
export const calculatorKinds = ["vat", "late-fees"] as const;
export const calculatorDirectory = {
	vat: {
		title: "增值税计算器",
		to: "/calculators",
		icon: CalculatorIcon,
		list: listScenarios,
		create: createScenario,
		update: updateScenario,
	},
	"late-fees": {
		title: "滞纳金计算器",
		to: "/calculators/late-fees",
		icon: CalendarClockIcon,
		list: listLateFees,
		create: createLateFee,
		update: updateLateFee,
	},
} as const;
