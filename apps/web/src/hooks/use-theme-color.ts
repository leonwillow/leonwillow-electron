"use client";

// React Imports
import { useEffect, useState } from "react";

/**
 * Resolve a CSS custom property (e.g. `--primary`, authored in oklch) to a
 * concrete `#rrggbb` hex. Needed by canvas/WebGL surfaces like `<Silk>` that
 * can't consume Tailwind classes or oklch.
 *
 * Returns `fallback` until resolved and re-resolves when the theme changes —
 * both the light/dark `class` toggle and the Theme Customizer's inline `style`
 * preset colors, which are both applied on `<html>`.
 */
export function useThemeColorHex(cssVar: string, fallback: string): string {
	const [hex, setHex] = useState(fallback);

	useEffect(() => {
		const resolve = () => {
			const raw = getComputedStyle(document.documentElement)
				.getPropertyValue(cssVar)
				.trim();

			if (!raw) return;

			// Paint onto a 1×1 canvas and read the pixel back — resolves any browser-parseable
			// color (oklch, out-of-gamut) to RGB. Reading `fillStyle` back is fragile: its
			// serialization isn't always a `#hex`.
			const canvas = document.createElement("canvas");

			canvas.width = 1;
			canvas.height = 1;

			const ctx = canvas.getContext("2d", { willReadFrequently: true });

			if (!ctx) return;

			ctx.fillStyle = "#000";
			ctx.fillStyle = raw; // if the browser can't parse it, fillStyle stays '#000'
			ctx.fillRect(0, 0, 1, 1);

			const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;

			// a === 0 → nothing drawn; pure black → treat as a parse failure (a theme color is
			// never pure black) and keep the previous value rather than flashing to black.
			if (a === 0 || (r === 0 && g === 0 && b === 0)) return;

			const toHex = (n: number) => n.toString(16).padStart(2, "0");

			setHex(`#${toHex(r)}${toHex(g)}${toHex(b)}`);
		};

		resolve();

		const observer = new MutationObserver(resolve);

		// `class` → light/dark toggle; `style` → Theme Customizer preset colors set inline on <html>
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class", "style"],
		});

		return () => observer.disconnect();
	}, [cssVar]);

	return hex;
}
