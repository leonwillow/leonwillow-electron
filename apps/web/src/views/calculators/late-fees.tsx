/**
 * @file 计算器首页与滞纳金方案选择。
 * 创建时间：2026-11-05；修改时间：2026-11-05。
 * 版本作用：方案从真实 API 读取，当前选择由路由保存。
 * 被调用：calculators 文件路由；调用：Eden、共享表单控件、LateFeeEditor。
 * 预期结果：独立测算互不覆盖，请求过期不切换错方案；错误通过 Sonner 反馈。
 */
import { getRouteApi } from "@tanstack/react-router";
import { getLateFee } from "@/lib/late-fees";
import LateFeeEditor from "./late-fee-editor";
import ScenarioWorkspace from "./scenario-workspace";

const route = getRouteApi("/_workspace/calculators_/late-fees");
export default function LateFeesView() {
	const { scenarioId } = route.useSearch();
	return (
		<ScenarioWorkspace
			kind="late-fees"
			scenarioId={scenarioId}
			get={getLateFee}
			Editor={LateFeeEditor}
		/>
	);
}
