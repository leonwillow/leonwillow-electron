/**
 * @file 当前模式的阴影参数编辑区域。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：components/theme-editor/theme-control-panel.tsx。
 * 调用：ui 基础组件/样式、./slider-with-input、./theme-color-panel。
 * 功能：组合颜色、透明度、模糊、扩散和偏移控件。
 * 预期结果：将各参数变化交回草稿所有者，不持有第二份主题。
 */
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@leonwillow-electron/ui/components/accordion";
import SliderWithInput from "./slider-with-input";
import { ColorSwatch } from "./theme-color-panel";

type ShadowControlProps = {
	shadowColor: string;
	shadowOpacity: number;
	shadowBlur: number;
	shadowSpread: number;
	shadowOffsetX: number;
	shadowOffsetY: number;
	onChange: (key: string, value: string | number) => void;
	onValidityChange: (key: string, valid: boolean) => void;
};

const ShadowControl = (props: ShadowControlProps) => {
	const {
		shadowColor,
		shadowOpacity,
		shadowBlur,
		shadowSpread,
		shadowOffsetX,
		shadowOffsetY,
		onChange,
		onValidityChange,
	} = props;

	return (
		<Accordion defaultValue={["shadow"]}>
			<AccordionItem value="shadow" className="rounded-lg border px-4">
				<AccordionTrigger className="cursor-pointer py-3 font-medium text-base">
					阴影
				</AccordionTrigger>
				<AccordionContent keepMounted className="flex flex-col gap-3 pt-2 pb-4">
					<div className="flex flex-col gap-4">
						<div>
							<ColorSwatch
								value={shadowColor}
								onChange={(color) => onChange("shadow-color", color)}
								label="阴影颜色"
								onValidityChange={(valid) =>
									onValidityChange("shadow-color", valid)
								}
							/>
						</div>

						<div>
							<SliderWithInput
								value={shadowOpacity}
								onChange={(value) => onChange("shadow-opacity", value)}
								min={0}
								max={1}
								step={0.01}
								unit=""
								label="不透明度"
							/>
						</div>

						<div>
							<SliderWithInput
								value={shadowBlur}
								onChange={(value) => onChange("shadow-blur", value)}
								min={0}
								max={50}
								step={0.5}
								unit="px"
								label="模糊半径"
							/>
						</div>

						<div>
							<SliderWithInput
								value={shadowSpread}
								onChange={(value) => onChange("shadow-spread", value)}
								min={-50}
								max={50}
								step={0.5}
								unit="px"
								label="扩散距离"
							/>
						</div>

						<div>
							<SliderWithInput
								value={shadowOffsetX}
								onChange={(value) => onChange("shadow-offset-x", value)}
								min={-50}
								max={50}
								step={0.5}
								unit="px"
								label="水平偏移"
							/>
						</div>

						<div>
							<SliderWithInput
								value={shadowOffsetY}
								onChange={(value) => onChange("shadow-offset-y", value)}
								min={-50}
								max={50}
								step={0.5}
								unit="px"
								label="垂直偏移"
							/>
						</div>
					</div>
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
};

export default ShadowControl;
