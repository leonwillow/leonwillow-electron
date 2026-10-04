/**
 * @file 认证展示面板使用的装饰品牌图形。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：components/auth/auth-showcase.tsx。
 * 调用：react。
 * 功能：提供完整 SVG 图形及标准属性透传。
 * 预期结果：展示面板可随容器缩放图形。
 */
import type { SVGAttributes } from "react";

const LogoVector = (props: SVGAttributes<SVGElement>) => {
	return (
		<svg
			aria-hidden="true"
			width="1em"
			height="1em"
			viewBox="0 0 306 260"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			{...props}
		>
			<path
				d="M169.304 26.1781L153.493 0L51.9325 172.538L70.785 204.665H102.409L83.556 170.753L169.304 26.1781Z"
				className="fill-primary"
			/>
			<path
				d="M274.89 258.113L305.966 257.918L204.678 85.1993L166.818 84.9715L150.908 111.713L190.344 112.839L274.89 258.113Z"
				className="fill-primary"
			/>
			<path
				d="M15.1445 232.77L0 259.327L203.479 258.218L222.344 226.092L206.413 199.363L185.972 232.388L15.1445 232.77Z"
				className="fill-primary"
			/>
		</svg>
	);
};

export default LogoVector;
