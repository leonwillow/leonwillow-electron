/**
 * @file 带范围约束的滑块输入的基础组件。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：共享 UI 基础层，随工作区维护。
 * 被调用：components/theme-editor/slider-with-input.tsx。
 * 调用：@base-ui/react、ui/lib/utils。
 * 功能：组合底层控件和语义样式，透传对应属性并提供稳定 data-slot。
 * 预期结果：业务调用方负责内容与事件，基础层不依赖应用路由或账号接口。
 */
import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import { cn } from "@leonwillow-electron/ui/lib/utils";

function Slider({
	className,
	defaultValue,
	value,
	min = 0,
	max = 100,
	...props
}: SliderPrimitive.Root.Props) {
	const _values = Array.isArray(value)
		? value
		: Array.isArray(defaultValue)
			? defaultValue
			: [min, max];

	return (
		<SliderPrimitive.Root
			className={cn("data-vertical:h-full data-horizontal:w-full", className)}
			data-slot="slider"
			defaultValue={defaultValue}
			value={value}
			min={min}
			max={max}
			thumbAlignment="edge"
			{...props}
		>
			<SliderPrimitive.Control className="relative flex w-full touch-none select-none items-center data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col data-disabled:opacity-50">
				<SliderPrimitive.Track
					data-slot="slider-track"
					className="relative grow select-none overflow-hidden rounded-md bg-muted data-horizontal:h-1 data-vertical:h-full data-horizontal:w-full data-vertical:w-1"
				>
					<SliderPrimitive.Indicator
						data-slot="slider-range"
						className="select-none bg-primary data-horizontal:h-full data-vertical:w-full"
					/>
				</SliderPrimitive.Track>
				{Array.from({ length: _values.length }, (_, index) => (
					<SliderPrimitive.Thumb
						data-slot="slider-thumb"
						aria-label={props["aria-label"]}
						key={index}
						className="relative block size-3 shrink-0 select-none rounded-md border border-ring bg-background ring-ring/30 transition-[color,box-shadow] after:absolute after:-inset-2 hover:ring-2 focus-visible:outline-hidden focus-visible:ring-2 active:ring-2 disabled:pointer-events-none disabled:opacity-50"
					/>
				))}
			</SliderPrimitive.Control>
		</SliderPrimitive.Root>
	);
}

export { Slider };
