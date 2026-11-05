/**
 * @file 用于导航与认证标题的小尺寸品牌标志。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-05
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：components/layout/app-logo.tsx。
 * 调用：react。
 * 功能：将 SVG 路径封装为可传入标准 SVG 属性的组件。
 * 预期结果：标志继承调用方颜色和尺寸。
 */
import type { SVGAttributes } from "react";

const Logo = (props: SVGAttributes<SVGElement>) => {
	return (
		<svg
			aria-hidden="true"
			width="512"
			height="512"
			viewBox="0 0 512 512"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			{...props}
		>
			<path
				d="M277.304 141.178L261.493 115L159.933 287.538L178.785 319.665H210.409L191.556 285.753L277.304 141.178Z"
				fill="currentColor"
			/>
			<path
				d="M382.89 373.113L413.966 372.918L312.678 200.199L274.818 199.971L258.908 226.713L298.344 227.839L382.89 373.113Z"
				fill="currentColor"
			/>
			<path
				d="M123.144 347.77L108 374.327L311.479 373.218L330.344 341.092L314.413 314.363L293.972 347.388L123.144 347.77Z"
				fill="currentColor"
			/>
		</svg>
	);
};

export default Logo;
