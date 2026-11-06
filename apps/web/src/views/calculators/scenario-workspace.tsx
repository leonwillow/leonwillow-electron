/**
 * @file 从路由读取单份方案的计算器工作区。
 * 创建时间：2026-11-05；修改时间：2026-11-05。
 * 版本作用：方案管理交给二级目录；编辑器持有顶栏及业务操作，避免重复操作行。
 * 被调用：两种计算器视图；调用：Eden 读取、目录摘要同步、共享标题与编辑器。
 * 预期结果：过期请求不切换错方案，未选择时引导目录，错误通过 Sonner 反馈。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import { type ComponentType, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useCalculatorNavigation } from "@/components/layout/calculator-navigation-provider";
import {
	WorkspaceHeader,
	WorkspaceTitle,
} from "@/components/layout/workspace-header";
import { useWorkspaceNavigation } from "@/components/layout/workspace-navigation-provider";
import {
	type CalculatorKind,
	type CalculatorSummary,
	calculatorDirectory,
} from "@/lib/calculator-directory";
import { calculatorError } from "@/lib/calculators";
export default function ScenarioWorkspace<R extends CalculatorSummary>({
	kind,
	scenarioId,
	get,
	Editor,
}: {
	kind: CalculatorKind;
	scenarioId?: string;
	get: (id: string) => Promise<R>;
	Editor: ComponentType<{ record: R; onSaved: (row: R) => void }>;
}) {
	const { upsert } = useCalculatorNavigation();
	const navigation = useWorkspaceNavigation();
	const config = calculatorDirectory[kind];
	const [record, setRecord] = useState<R | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);
	const [reload, setReload] = useState(0);
	// biome-ignore lint/correctness/useExhaustiveDependencies: reload 是显式重试的请求代际。
	useEffect(() => {
		let live = true;
		setLoading(!!scenarioId);
		setError(false);
		setRecord(null);
		if (scenarioId)
			void get(scenarioId)
				.then((row) => {
					if (live) {
						setRecord(row);
						upsert(kind, row);
					}
				})
				.catch((cause) => {
					if (live) {
						setError(true);
						toast.error("无法读取测算方案", {
							description: calculatorError(cause),
						});
					}
				})
				.finally(() => {
					if (live) setLoading(false);
				});
		return () => {
			live = false;
		};
	}, [get, scenarioId, reload, kind, upsert]);
	const onSaved = useCallback((row: R) => upsert(kind, row), [upsert, kind]);
	return (
		<section
			aria-label={config.title}
			className="flex h-full min-h-0 min-w-0 flex-col"
		>
			{record ? (
				<Editor key={record.id} record={record} onSaved={onSaved} />
			) : (
				<>
					<WorkspaceHeader>
						<WorkspaceTitle icon={config.icon}>{config.title}</WorkspaceTitle>
					</WorkspaceHeader>
					{loading ? (
						<p
							role="status"
							className="p-workspace-gutter text-muted-foreground"
						>
							正在读取方案…
						</p>
					) : (
						<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-workspace-gutter text-center">
							<h2 className="font-semibold text-lg">
								{error ? "暂时无法读取" : "选择或新建一份方案"}
							</h2>
							<p className="text-muted-foreground text-sm">
								{error
									? "请重试加载，已保存数据不会受影响。"
									: "从左侧计算器目录选择方案，或在对应计算器下新建方案。"}
							</p>
							<Button
								variant="outline"
								onClick={() =>
									error
										? setReload((value) => value + 1)
										: navigation.focusPanel("calculators")
								}
							>
								{error ? "重新加载" : "打开计算器目录"}
							</Button>
						</div>
					)}
				</>
			)}
		</section>
	);
}
