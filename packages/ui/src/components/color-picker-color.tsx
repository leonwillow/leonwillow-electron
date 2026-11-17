/**
 * @file ReUI 色盘的纯颜色解析、空间转换、通道与无障碍文本。
 * 创建时间：2026-11-17；修改时间：2026-11-17。
 * 版本作用：保留官方颜色算法，拆分便于独立验证透明度与色域往返。
 * 被调用：color-picker.tsx、色盘回归测试；调用：可选浏览器 CSS 解析。
 * 预期结果：合法颜色保留通道及 alpha，无效输入返回 null。
 * 来源：https://reui.io/r/styles/base-mira/color-picker.json（MIT，2026-11-17）。
 */
/** How a value is written: what `onValueChange` emits and what the fields show. */
export type ColorPickerFormat = "hex" | "rgb" | "hsl" | "hsb" | "oklch";

/** Where channels live. HSB is `hsv` here, after the math. */
export type ColorPickerColorSpace = "rgb" | "hsl" | "hsv" | "oklch";

export type ColorPickerChannel =
	| "hue"
	| "saturation"
	| "brightness"
	| "lightness"
	| "chroma"
	| "red"
	| "green"
	| "blue"
	| "alpha";

/**
 * A parsed color. Channels stay in the space they were given or edited in,
 * so the hue of a gray and an OKLCH color outside sRGB survive a round trip.
 * rgb runs 0 to 255; hsl and hsv take hue 0 to 360 and the rest 0 to 100;
 * oklch takes lightness 0 to 100, chroma 0 to 0.4 and hue 0 to 360. Alpha is
 * 0 to 1.
 */
export type ColorPickerColor = {
	space: ColorPickerColorSpace;
	channels: [number, number, number];
	alpha: number;
};

export type ColorPickerLabels = {
	/** Trigger text while there is no value. */
	placeholder: string;
	/** Names the popup and an inline panel. */
	panelLabel: string;
	/** The swatch button in `ColorPickerInput`. */
	openPicker: string;
	/** The saturation and brightness area. */
	area: string;
	hue: string;
	saturation: string;
	brightness: string;
	lightness: string;
	chroma: string;
	red: string;
	green: string;
	blue: string;
	alpha: string;
	hex: string;
	format: string;
	eyeDropper: string;
	copy: string;
	copied: string;
	clear: string;
	swatches: string;
};

export type ColorPickerFunctions = {
	/** Names a color for screen readers, in the area, the sliders and unlabelled swatches. */
	getColorName: (color: ColorPickerColor) => string;
};

export type ColorPickerI18nConfig = {
	labels: ColorPickerLabels;
	functions: ColorPickerFunctions;
};

/** One level deeper than `Partial`, so a single label can be overridden. */
export type ColorPickerI18nOverrides = {
	labels?: Partial<ColorPickerLabels>;
	functions?: Partial<ColorPickerFunctions>;
};

type Triple = [number, number, number];

const SPACE_CHANNELS: Record<
	ColorPickerColorSpace,
	[ColorPickerChannel, ColorPickerChannel, ColorPickerChannel]
> = {
	rgb: ["red", "green", "blue"],
	hsl: ["hue", "saturation", "lightness"],
	hsv: ["hue", "saturation", "brightness"],
	oklch: ["lightness", "chroma", "hue"],
};

export const COLOR_PICKER_FORMATS: ColorPickerFormat[] = [
	"hex",
	"rgb",
	"hsl",
	"hsb",
	"oklch",
];

const FORMAT_LABELS: Record<ColorPickerFormat, string> = {
	hex: "HEX",
	rgb: "RGB",
	hsl: "HSL",
	hsb: "HSB",
	oklch: "OKLCH",
};

/* -------------------------------------------------------------------------- */
/*                                 Color math                                 */
/* -------------------------------------------------------------------------- */

const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));

const wrapHue = (hue: number) => ((hue % 360) + 360) % 360;

/* Trailing zeros dropped, and never "-0". */
const fixed = (value: number, digits: number) =>
	String(Number(value.toFixed(digits)) + 0);

function rgbToHsv([red, green, blue]: Triple, fallbackHue = 0): Triple {
	const r = red / 255;
	const g = green / 255;
	const b = blue / 255;
	const max = Math.max(r, g, b);
	const delta = max - Math.min(r, g, b);
	let hue = fallbackHue;
	if (delta > 1e-9) {
		hue =
			max === r
				? ((g - b) / delta) % 6
				: max === g
					? (b - r) / delta + 2
					: (r - g) / delta + 4;
		hue = wrapHue(hue * 60);
	}
	return [hue, max === 0 ? 0 : (delta / max) * 100, max * 100];
}

function hsvToRgb([hue, saturation, brightness]: Triple): Triple {
	const s = saturation / 100;
	const v = brightness / 100;
	const channel = (n: number) => {
		const k = (n + hue / 60) % 6;
		return (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255;
	};
	return [channel(5), channel(3), channel(1)];
}

/* HSL and HSB share a hue, carried over as is, so a gray keeps it. */
function hsvToHsl([hue, saturation, brightness]: Triple): Triple {
	const s = saturation / 100;
	const v = brightness / 100;
	const l = v * (1 - s / 2);
	const sl = l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l);
	return [hue, sl * 100, l * 100];
}

function hslToHsv([hue, saturation, lightness]: Triple): Triple {
	const s = saturation / 100;
	const l = lightness / 100;
	const v = l + s * Math.min(l, 1 - l);
	return [hue, v === 0 ? 0 : 2 * (1 - l / v) * 100, v * 100];
}

const toLinear = (channel: number) => {
	const c = channel / 255;
	return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const fromLinear = (channel: number) =>
	255 *
	(channel <= 0.0031308
		? 12.92 * channel
		: 1.055 * channel ** (1 / 2.4) - 0.055);

/* OKLab by Björn Ottosson, the matrices CSS Color 4 uses. Linear sRGB in,
   unbounded, so a wide-gamut color converts without clipping. */
function linearToOklab([r, g, b]: Triple): Triple {
	const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
	const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
	const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
	return [
		0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
		1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
		0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
	];
}

/* OKLab, or polar a and b, to OKLCH in the picker's units: L 0 to 100. */
function oklabToOklch([lightness, a, b]: Triple, fallbackHue = 0): Triple {
	const chroma = Math.sqrt(a * a + b * b);
	const hue =
		chroma < 1e-4 ? fallbackHue : wrapHue((Math.atan2(b, a) * 180) / Math.PI);
	return [lightness * 100, chroma, hue];
}

function rgbToOklch(rgb: Triple, fallbackHue = 0): Triple {
	return oklabToOklch(linearToOklab(rgb.map(toLinear) as Triple), fallbackHue);
}

function oklchToLinear([lightness, chroma, hue]: Triple): Triple {
	const angle = (hue * Math.PI) / 180;
	const L = lightness / 100;
	const a = chroma * Math.cos(angle);
	const b = chroma * Math.sin(angle);
	const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
	return [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
	];
}

const inSrgb = (linear: Triple) =>
	linear.every((channel) => channel >= -1e-4 && channel <= 1 + 1e-4);

const clipLinear = (linear: Triple) =>
	linear.map((channel) => clamp(channel, 0, 1)) as Triple;

/* How far a clipped color lands from the OKLCH it stands for, in OKLab. */
function clipError(clipped: Triple, [lightness, chroma, hue]: Triple) {
	const [l, a, b] = linearToOklab(clipped);
	const angle = (hue * Math.PI) / 180;
	return Math.hypot(
		l - lightness / 100,
		a - chroma * Math.cos(angle),
		b - chroma * Math.sin(angle),
	);
}

/* CSS Color 4 gamut mapping: lower chroma at the same lightness and hue
   until clipping the rest moves the color less than a just-noticeable
   difference (0.02 in OKLab), then clip. Pure chroma reduction drifted up to
   27 units in hex from what a browser paints for Tailwind's P3 shades. */
function oklchToRgb([lightness, chroma, hue]: Triple): Triple {
	const encode = (linear: Triple) =>
		linear.map((channel) => fromLinear(channel)) as Triple;
	if (lightness >= 100) return [255, 255, 255];
	if (lightness <= 0) return [0, 0, 0];
	const target: Triple = [lightness, Math.max(0, chroma), hue];
	const origin = oklchToLinear(target);
	if (inSrgb(origin)) return encode(clipLinear(origin));
	let clipped = clipLinear(origin);
	if (clipError(clipped, target) < 0.02) return encode(clipped);
	let low = 0;
	let high = target[1];
	let lowInGamut = true;
	while (high - low > 1e-4) {
		const mid = (low + high) / 2;
		const current: Triple = [lightness, mid, hue];
		const linear = oklchToLinear(current);
		if (lowInGamut && inSrgb(linear)) {
			low = mid;
			continue;
		}
		clipped = clipLinear(linear);
		const error = clipError(clipped, current);
		if (error < 0.02) {
			if (0.02 - error < 1e-4) break;
			lowInGamut = false;
			low = mid;
		} else {
			high = mid;
		}
	}
	return encode(clipped);
}

function toRgb(color: ColorPickerColor): Triple {
	const { space, channels } = color;
	if (space === "rgb") return channels;
	if (space === "hsv") return hsvToRgb(channels);
	if (space === "hsl") return hsvToRgb(hslToHsv(channels));
	return oklchToRgb(channels);
}

/** A color's channels in another space. */
function toSpace(
	color: ColorPickerColor,
	space: ColorPickerColorSpace,
): Triple {
	const { space: from, channels } = color;
	if (from === space) return channels;
	if (from === "hsv" && space === "hsl") return hsvToHsl(channels);
	if (from === "hsl" && space === "hsv") return hslToHsv(channels);
	const rgb = toRgb(color);
	const hue = from === "rgb" ? 0 : channels[from === "oklch" ? 2 : 0];
	if (space === "rgb") return rgb;
	if (space === "hsv") return rgbToHsv(rgb, hue);
	if (space === "hsl") return hsvToHsl(rgbToHsv(rgb, hue));
	return rgbToOklch(rgb, hue);
}

/** Whether a color fits sRGB. OKLCH can reach past it; the picker then maps it into sRGB the way CSS does. */
export function isColorInSrgb(color: ColorPickerColor) {
	return color.space !== "oklch" || inSrgb(oklchToLinear(color.channels));
}

const HEX_PATTERN = /^#?([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/;
/* [\s\S], not ".", so a function pretty-printed over several lines reads. */
const FUNCTION_PATTERN = /^([a-z][a-z\d-]*)\(([\s\S]*)\)$/;
const NUMBER_PATTERN =
	/^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|deg|rad|grad|turn)?$/;

/* The 148 CSS named colors, each name then its hex: about 2.3 KB, checked
   against Chrome, and safe to read on the server unlike a canvas. */
const NAMED_COLORS =
	"alicebluef0f8ff antiquewhitefaebd7 aqua00ffff aquamarine7fffd4 " +
	"azuref0ffff beigef5f5dc bisqueffe4c4 black000000 blanchedalmondffebcd " +
	"blue0000ff blueviolet8a2be2 browna52a2a burlywooddeb887 " +
	"cadetblue5f9ea0 chartreuse7fff00 chocolated2691e coralff7f50 " +
	"cornflowerblue6495ed cornsilkfff8dc crimsondc143c cyan00ffff " +
	"darkblue00008b darkcyan008b8b darkgoldenrodb8860b darkgraya9a9a9 " +
	"darkgreen006400 darkgreya9a9a9 darkkhakibdb76b darkmagenta8b008b " +
	"darkolivegreen556b2f darkorangeff8c00 darkorchid9932cc darkred8b0000 " +
	"darksalmone9967a darkseagreen8fbc8f darkslateblue483d8b " +
	"darkslategray2f4f4f darkslategrey2f4f4f darkturquoise00ced1 " +
	"darkviolet9400d3 deeppinkff1493 deepskyblue00bfff dimgray696969 " +
	"dimgrey696969 dodgerblue1e90ff firebrickb22222 floralwhitefffaf0 " +
	"forestgreen228b22 fuchsiaff00ff gainsborodcdcdc ghostwhitef8f8ff " +
	"goldffd700 goldenroddaa520 gray808080 green008000 greenyellowadff2f " +
	"grey808080 honeydewf0fff0 hotpinkff69b4 indianredcd5c5c indigo4b0082 " +
	"ivoryfffff0 khakif0e68c lavendere6e6fa lavenderblushfff0f5 " +
	"lawngreen7cfc00 lemonchiffonfffacd lightblueadd8e6 lightcoralf08080 " +
	"lightcyane0ffff lightgoldenrodyellowfafad2 lightgrayd3d3d3 " +
	"lightgreen90ee90 lightgreyd3d3d3 lightpinkffb6c1 lightsalmonffa07a " +
	"lightseagreen20b2aa lightskyblue87cefa lightslategray778899 " +
	"lightslategrey778899 lightsteelblueb0c4de lightyellowffffe0 lime00ff00 " +
	"limegreen32cd32 linenfaf0e6 magentaff00ff maroon800000 " +
	"mediumaquamarine66cdaa mediumblue0000cd mediumorchidba55d3 " +
	"mediumpurple9370db mediumseagreen3cb371 mediumslateblue7b68ee " +
	"mediumspringgreen00fa9a mediumturquoise48d1cc mediumvioletredc71585 " +
	"midnightblue191970 mintcreamf5fffa mistyroseffe4e1 moccasinffe4b5 " +
	"navajowhiteffdead navy000080 oldlacefdf5e6 olive808000 olivedrab6b8e23 " +
	"orangeffa500 orangeredff4500 orchidda70d6 palegoldenrodeee8aa " +
	"palegreen98fb98 paleturquoiseafeeee palevioletreddb7093 " +
	"papayawhipffefd5 peachpuffffdab9 perucd853f pinkffc0cb plumdda0dd " +
	"powderblueb0e0e6 purple800080 rebeccapurple663399 redff0000 " +
	"rosybrownbc8f8f royalblue4169e1 saddlebrown8b4513 salmonfa8072 " +
	"sandybrownf4a460 seagreen2e8b57 seashellfff5ee siennaa0522d " +
	"silverc0c0c0 skyblue87ceeb slateblue6a5acd slategray708090 " +
	"slategrey708090 snowfffafa springgreen00ff7f steelblue4682b4 tand2b48c " +
	"teal008080 thistled8bfd8 tomatoff6347 turquoise40e0d0 violetee82ee " +
	"wheatf5deb3 whiteffffff whitesmokef5f5f5 yellowffff00 " +
	"yellowgreen9acd32";

let namedColors: Map<string, string> | null = null;

function namedColor(name: string) {
	namedColors ??= new Map(
		NAMED_COLORS.split(" ").map((entry) => [
			entry.slice(0, -6),
			entry.slice(-6),
		]),
	);
	return namedColors.get(name);
}

/* One CSS number: 100% is worth `percentOf`, computed as value * percentOf
   / 100 so 50% of 255 is exactly 127.5; angles only where allowed. */
function readNumber(
	token: string | undefined,
	percentOf: number,
	angle = false,
) {
	if (token === undefined) return null;
	if (token === "none") return 0;
	const match = NUMBER_PATTERN.exec(token);
	if (!match) return null;
	const value = Number(match[1]);
	if (!Number.isFinite(value)) return null;
	const unit = match[2];
	if (!unit) return value;
	if (unit === "%") return angle ? null : (value * percentOf) / 100;
	if (!angle) return null;
	if (unit === "rad") return (value * 180) / Math.PI;
	if (unit === "grad") return value * 0.9;
	if (unit === "turn") return value * 360;
	return value;
}

type Matrix = [Triple, Triple, Triple];

const multiply = (matrix: Matrix, [x, y, z]: Triple): Triple =>
	matrix.map((row) => row[0] * x + row[1] * y + row[2] * z) as Triple;

const compose = (outer: Matrix, inner: Matrix): Matrix =>
	outer.map((row) =>
		([0, 1, 2] as const).map(
			(column) =>
				row[0] * inner[0][column] +
				row[1] * inner[1][column] +
				row[2] * inner[2][column],
		),
	) as Matrix;

/* CSS Color 4's matrices: XYZ D65 to linear sRGB, each RGB space to XYZ,
   and Bradford from D50, the white of lab(), lch() and ProPhoto. */
const XYZ_TO_SRGB: Matrix = [
	[12831 / 3959, -329 / 214, -1974 / 3959],
	[-851781 / 878810, 1648619 / 878810, 36519 / 878810],
	[705 / 12673, -2585 / 12673, 705 / 667],
];
const D50_TO_D65: Matrix = [
	[0.955473421488075, -0.02309845494876471, 0.06325924320057072],
	[-0.0283697093338637, 1.0099953980813041, 0.021041441191917323],
	[0.012314014864481998, -0.020507649298898964, 1.330365926242124],
];
const D50_TO_SRGB = compose(XYZ_TO_SRGB, D50_TO_D65);

/* sRGB's curve, carried past 0 and 1 by symmetry, as color() allows. */
const decodeSrgb = (value: number) => {
	const size = Math.abs(value);
	return (
		Math.sign(value) *
		(size <= 0.04045 ? size / 12.92 : ((size + 0.055) / 1.055) ** 2.4)
	);
};

const RGB_SPACES: Record<
	string,
	{ decode: (value: number) => number; toSrgb: Matrix | null }
> = {
	srgb: { decode: decodeSrgb, toSrgb: null },
	"srgb-linear": { decode: (value) => value, toSrgb: null },
	"display-p3": {
		decode: decodeSrgb,
		toSrgb: compose(XYZ_TO_SRGB, [
			[0.4865709486482162, 0.26566769316909306, 0.1982172852343625],
			[0.2289745640697488, 0.6917385218365064, 0.079286914093745],
			[0, 0.04511338185890264, 1.043944368900976],
		]),
	},
	"a98-rgb": {
		decode: (value) => Math.sign(value) * Math.abs(value) ** (563 / 256),
		toSrgb: compose(XYZ_TO_SRGB, [
			[573536 / 994567, 263643 / 1420810, 187206 / 994567],
			[591459 / 1989134, 6239551 / 9945670, 374412 / 4972835],
			[53769 / 1989134, 351524 / 4972835, 4929758 / 4972835],
		]),
	},
	"prophoto-rgb": {
		decode: (value) => {
			const size = Math.abs(value);
			return size <= 16 / 512 ? value / 16 : Math.sign(value) * size ** 1.8;
		},
		toSrgb: compose(D50_TO_SRGB, [
			[0.7977666449006423, 0.13518129740053308, 0.0313477341283922],
			[0.2880748288194013, 0.711835234241873, 0.00008993693872564],
			[0, 0, 0.8251046025104602],
		]),
	},
	rec2020: {
		decode: (value) => {
			const size = Math.abs(value);
			return size < 0.018053968510807 * 4.5
				? value / 4.5
				: Math.sign(value) *
						((size + 0.09929682680944) / 1.09929682680944) ** (1 / 0.45);
		},
		toSrgb: compose(XYZ_TO_SRGB, [
			[0.6369580483012914, 0.14461690358620832, 0.1688809751641721],
			[0.2627002120112671, 0.6779980715188708, 0.05930171646986196],
			[0, 0.028072693049087428, 1.060985057710791],
		]),
	},
	xyz: { decode: (value) => value, toSrgb: XYZ_TO_SRGB },
	"xyz-d65": { decode: (value) => value, toSrgb: XYZ_TO_SRGB },
	"xyz-d50": { decode: (value) => value, toSrgb: D50_TO_SRGB },
};

/* CIE Lab, D50 white, to XYZ D50, as CSS Color 4 writes it. */
function labToXyz([lightness, a, b]: Triple): Triple {
	const kappa = 24389 / 27;
	const epsilon = 216 / 24389;
	const fy = (lightness + 16) / 116;
	const fx = a / 500 + fy;
	const fz = fy - b / 200;
	const x = fx ** 3 > epsilon ? fx ** 3 : (116 * fx - 16) / kappa;
	const y = lightness > kappa * epsilon ? fy ** 3 : lightness / kappa;
	const z = fz ** 3 > epsilon ? fz ** 3 : (116 * fz - 16) / kappa;
	return [x * (0.3457 / 0.3585), y, z * ((1 - 0.3457 - 0.3585) / 0.3585)];
}

/* A color that can reach past sRGB is kept as OKLCH, so nothing is clipped
   until a format or a screen needs sRGB. */
const fromLinearSrgb = (linear: Triple): Triple =>
	oklabToOklch(linearToOklab(linear));

const isUnit = (channels: Triple) =>
	channels.every((channel) => channel >= -1e-6 && channel <= 1 + 1e-6);

/* The channels of one function, as a color in the picker's spaces. */
function readChannels(
	name: string,
	parts: string[],
): { space: ColorPickerColorSpace; channels: Triple } | null {
	if (name === "rgb") {
		const rgb = parts.map((part) => readNumber(part, 255));
		if (rgb.some((value) => value === null)) return null;
		return {
			space: "rgb",
			channels: (rgb as number[]).map((value) =>
				clamp(value, 0, 255),
			) as Triple,
		};
	}
	if (name === "hsl" || name === "hsv" || name === "hsb" || name === "hwb") {
		const hue = readNumber(parts[0], 1, true);
		const first = readNumber(parts[1], 100);
		const second = readNumber(parts[2], 100);
		if (hue === null || first === null || second === null) return null;
		const x = clamp(first, 0, 100);
		const y = clamp(second, 0, 100);
		if (name === "hsl") return { space: "hsl", channels: [hue, x, y] };
		if (name !== "hwb") return { space: "hsv", channels: [hue, x, y] };
		/* hwb(): whiteness and blackness are HSB's saturation and brightness
       read from the other end; summing past 100% gives their gray. */
		const total = x + y;
		if (total >= 100) {
			return { space: "hsv", channels: [hue, 0, (x / total) * 100] };
		}
		const brightness = 100 - y;
		return {
			space: "hsv",
			channels: [hue, (1 - x / brightness) * 100, brightness],
		};
	}
	if (name === "oklch" || name === "oklab") {
		const lightness = readNumber(parts[0], 1);
		const second = readNumber(parts[1], 0.4);
		const third =
			name === "oklch"
				? readNumber(parts[2], 1, true)
				: readNumber(parts[2], 0.4);
		if (lightness === null || second === null || third === null) return null;
		const l = clamp(lightness, 0, 1);
		if (name === "oklch") {
			return {
				space: "oklch",
				channels: [l * 100, Math.max(0, second), third],
			};
		}
		return {
			space: "oklch",
			channels: oklabToOklch([l, second, third]),
		};
	}
	if (name === "lab" || name === "lch") {
		const lightness = readNumber(parts[0], 100);
		const second = readNumber(parts[1], name === "lab" ? 125 : 150);
		const third =
			name === "lch"
				? readNumber(parts[2], 1, true)
				: readNumber(parts[2], 125);
		if (lightness === null || second === null || third === null) return null;
		const l = clamp(lightness, 0, 100);
		const angle = (third * Math.PI) / 180;
		const [a, b] =
			name === "lab"
				? [second, third]
				: [
						Math.max(0, second) * Math.cos(angle),
						Math.max(0, second) * Math.sin(angle),
					];
		return {
			space: "oklch",
			channels: fromLinearSrgb(multiply(D50_TO_SRGB, labToXyz([l, a, b]))),
		};
	}
	if (name === "color") {
		const target = RGB_SPACES[parts[0] ?? ""];
		if (!target || parts.length !== 4) return null;
		const values = parts.slice(1).map((part) => readNumber(part, 1));
		if (values.some((value) => value === null)) return null;
		const channels = values as Triple;
		if (parts[0] === "srgb" && isUnit(channels)) {
			return {
				space: "rgb",
				channels: channels.map((value) => clamp(value, 0, 1) * 255) as Triple,
			};
		}
		const linear = channels.map(target.decode) as Triple;
		return {
			space: "oklch",
			channels: fromLinearSrgb(
				target.toSrgb ? multiply(target.toSrgb, linear) : linear,
			),
		};
	}
	return null;
}

/**
 * Reads a CSS color: hex with 3, 4, 6 or 8 digits, `#` optional; the 148
 * named colors and `transparent`; `rgb()`, `hsl()`, `hwb()`, `lab()`,
 * `lch()`, `oklab()`, `oklch()` and `color()` in any of CSS Color 4's RGB
 * and XYZ spaces, plus `hsb()` or `hsv()`; modern or comma syntax, with or
 * without alpha. A color that can fall outside sRGB is kept as OKLCH.
 * Anything else, `var()` and `currentColor` included, is `null`.
 */
export function parseColor(
	input: string | null | undefined,
): ColorPickerColor | null {
	if (typeof input !== "string") return null;
	const text = input.trim().toLowerCase();
	if (!text) return null;
	if (text === "transparent") {
		return { space: "rgb", channels: [0, 0, 0], alpha: 0 };
	}
	const hex = HEX_PATTERN.exec(namedColor(text) ?? text);
	if (hex?.[1]) {
		let digits = hex[1];
		if (digits.length <= 4) {
			digits = [...digits].map((digit) => digit + digit).join("");
		}
		const byte = (index: number) =>
			Number.parseInt(digits.slice(index, index + 2), 16);
		return {
			space: "rgb",
			channels: [byte(0), byte(2), byte(4)],
			alpha: digits.length === 8 ? byte(6) / 255 : 1,
		};
	}
	const call = FUNCTION_PATTERN.exec(text);
	if (!call?.[1] || call[2] === undefined) return null;
	const name = call[1].replace(/a$/, "");
	const [main = "", slash, ...rest] = call[2].split("/");
	if (rest.length > 0) return null;
	const parts = main.split(/[\s,]+/).filter(Boolean);
	/* color() names its space first, and takes alpha only after a slash. */
	const count = name === "color" ? 4 : 3;
	/* Alpha follows a slash, or is the fourth value of the comma syntax. */
	const alphaToken = slash?.trim() ?? (name === "color" ? undefined : parts[3]);
	if (
		parts.length !== count &&
		!(name !== "color" && parts.length === 4 && slash === undefined)
	) {
		return null;
	}
	const alpha = alphaToken === undefined ? 1 : readNumber(alphaToken, 1);
	const read = readChannels(name, parts.slice(0, count));
	if (alpha === null || !read) return null;
	const channels = read.channels;
	if (channels.some((channel) => !Number.isFinite(channel))) return null;
	if (read.space !== "rgb") {
		const hueIndex = read.space === "oklch" ? 2 : 0;
		channels[hueIndex] = wrapHue(channels[hueIndex]);
	}
	return { space: read.space, channels, alpha: clamp(alpha, 0, 1) };
}

const CSS_WIDE = /^(inherit|initial|unset|revert|revert-layer|currentcolor)$/;

/* Whatever else the browser paints (color-mix(), relative colors,
   light-dark(), system colors), resolved by its computed style, which
   serializes as a function parseColor reads. Two parents of different
   colors expose anything that inherits (var() with no value, a CSS-wide
   keyword); a canvas would have read those as black. Only typing reaches
   this, never a render. */
function parseWithBrowser(text: string): ColorPickerColor | null {
	if (
		typeof document === "undefined" ||
		CSS_WIDE.test(text.toLowerCase()) ||
		!CSS.supports?.("color", text)
	) {
		return null;
	}
	const parent = document.createElement("div");
	const probe = document.createElement("div");
	parent.style.display = "none";
	probe.style.color = text;
	parent.append(probe);
	document.body.append(parent);
	parent.style.color = "rgb(1, 2, 3)";
	const first = getComputedStyle(probe).color;
	parent.style.color = "rgb(4, 5, 6)";
	const second = getComputedStyle(probe).color;
	parent.remove();
	return first === second ? parseColor(first) : null;
}

/**
 * Writes a color in a format. HEX gains a fourth byte and the others a
 * `/ alpha` only when the color is translucent; OKLCH keeps channels outside
 * sRGB, every other format maps the color into sRGB the way CSS does.
 */
export function formatColor(
	color: ColorPickerColor,
	format: ColorPickerFormat,
): string {
	const alpha = clamp(color.alpha, 0, 1);
	/* Decided on the rounded alpha, so 0.996 writes no "/ 1" tail. */
	const tail = fixed(alpha, 2) !== "1" ? ` / ${fixed(alpha, 2)}` : "";
	if (format === "hex" || format === "rgb") {
		const rgb = toRgb(color).map((channel) =>
			Math.round(clamp(channel, 0, 255)),
		);
		if (format === "rgb") return `rgb(${rgb.join(" ")}${tail})`;
		const opacity = Math.round(alpha * 255);
		const bytes = opacity < 255 ? [...rgb, opacity] : rgb;
		return `#${bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
	}
	if (format === "oklch") {
		const [l, c, h] = toSpace(color, "oklch");
		/* Fine enough that hex to OKLCH and back is exact: 0 of 140,608 colors
       drift, where 0.1% and 3 decimals moved 29,278 by up to 7. */
		/* Chroma is never below 0, and a hue that rounds to 360 is 0. */
		const hue = fixed(wrapHue(Number(h.toFixed(3))), 3);
		return `oklch(${fixed(l, 2)}% ${fixed(Math.max(0, c), 5)} ${hue}${tail})`;
	}
	const [h, s, third] = toSpace(color, format === "hsl" ? "hsl" : "hsv");
	return `${format}(${fixed(h, 1)} ${fixed(s, 1)}% ${fixed(third, 1)}%${tail})`;
}

/* What CSS paints: OKLCH as itself, so a wide-gamut screen shows it. */
const toCss = (color: ColorPickerColor) =>
	formatColor(color, color.space === "oklch" ? "oklch" : "rgb");

function luminance(rgb: Triple) {
	const [r, g, b] = rgb.map(toLinear) as Triple;
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/* A translucent color composited onto an opaque one. */
function over(top: ColorPickerColor, bottom: Triple): Triple {
	const rgb = toRgb(top);
	return rgb.map(
		(channel, index) =>
			channel * top.alpha + bottom[index as 0 | 1 | 2] * (1 - top.alpha),
	) as Triple;
}

/**
 * The WCAG 2 contrast ratio, 1 to 21. A translucent foreground is laid over
 * the background, and a translucent background over white. `null` when either
 * color does not parse.
 */
export function getContrastRatio(
	foreground: string | ColorPickerColor,
	background: string | ColorPickerColor,
): number | null {
	const front =
		typeof foreground === "string" ? parseColor(foreground) : foreground;
	const back =
		typeof background === "string" ? parseColor(background) : background;
	if (!front || !back) return null;
	const base = over(back, [255, 255, 255]);
	const a = luminance(over(front, base));
	const b = luminance(base);
	return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/* The relative luminance where light and dark text read about equally well.
   It matches the APCA choice on all 110 Tailwind shades from 300 to 700; the
   WCAG 2 ratio flips near 0.18 and puts dark text on blue-500 and red-500. */
const FOREGROUND_SWITCH = 0.36;

/**
 * The text color that reads better on a background: `light` on a dark one,
 * `dark` on a light one. Light text also has to reach 3:1 by WCAG 2, the AA
 * bar for large text and icons, so orange-500 and sky-500 take dark text.
 * A translucent background is laid over white, as in `getContrastRatio`.
 * `null` when the background does not parse.
 */
export function getForegroundColor(
	background: string | ColorPickerColor,
	{
		light = "#ffffff",
		dark = "#0a0a0a",
	}: { light?: string; dark?: string } = {},
): string | null {
	const color =
		typeof background === "string" ? parseColor(background) : background;
	if (!color) return null;
	return luminance(over(color, [255, 255, 255])) < FOREGROUND_SWITCH &&
		(getContrastRatio(light, color) ?? 0) >= 3
		? light
		: dark;
}

/* OKLCH hue boundaries, each the upper end of its name. */
const HUE_NAMES: Array<[number, string]> = [
	[15, "粉色"],
	[45, "红色"],
	[80, "橙色"],
	[120, "黄色"],
	[135, "黄绿色"],
	[165, "绿色"],
	[205, "青色"],
	[250, "天蓝色"],
	[280, "蓝色"],
	[300, "紫罗兰色"],
	[320, "紫色"],
	[345, "洋红色"],
	[360, "粉色"],
];

/** A rough English name: "dark vibrant blue", "浅灰色". Swap it through `i18n.functions`. */
function nameColor(color: ColorPickerColor) {
	const [lightness, chroma, hue] = toSpace(color, "oklch");
	const l = lightness / 100;
	if (chroma < 0.025) {
		if (l < 0.2) return "黑色";
		if (l < 0.45) return "深灰色";
		if (l < 0.75) return "灰色";
		return l < 0.95 ? "浅灰色" : "白色";
	}
	let name = HUE_NAMES.find(([end]) => hue < end)?.[1] ?? "粉色";
	if (l < 0.6 && hue >= 40 && hue < 100) name = "棕色";
	else if (l < 0.6 && hue >= 100 && hue < 135) name = "橄榄色";
	const tone = chroma < 0.07 ? "偏灰" : chroma > 0.2 ? "鲜艳" : "";
	const shade = l < 0.45 ? "深" : l > 0.82 ? "浅" : "";
	return `${shade}${tone}${name}`;
}

export const DEFAULT_COLOR_PICKER_I18N: ColorPickerI18nConfig = {
	labels: {
		placeholder: "选择颜色",
		panelLabel: "选择颜色",
		openPicker: "打开调色盘",
		area: "颜色",
		hue: "色相",
		saturation: "饱和度",
		brightness: "亮度",
		lightness: "明度",
		chroma: "彩度",
		red: "红色",
		green: "绿色",
		blue: "蓝色",
		alpha: "不透明度",
		hex: "HEX 颜色值",
		format: "颜色格式",
		eyeDropper: "从屏幕选取颜色",
		copy: "复制颜色",
		copied: "已复制",
		clear: "清除",
		swatches: "颜色选项",
	},
	functions: { getColorName: nameColor },
};

/** Merges per section, so an override can carry one key without restating the rest. */
export function mergeColorPickerI18n(
	overrides?: ColorPickerI18nOverrides,
): ColorPickerI18nConfig {
	if (!overrides?.labels && !overrides?.functions) {
		return DEFAULT_COLOR_PICKER_I18N;
	}
	return {
		labels: { ...DEFAULT_COLOR_PICKER_I18N.labels, ...overrides.labels },
		functions: {
			...DEFAULT_COLOR_PICKER_I18N.functions,
			...overrides.functions,
		},
	};
}

/* -------------------------------------------------------------------------- */
/*                                  Channels                                  */
/* -------------------------------------------------------------------------- */

const DEFAULT_SPACE: Record<ColorPickerChannel, ColorPickerColorSpace> = {
	hue: "hsv",
	saturation: "hsv",
	brightness: "hsv",
	lightness: "hsl",
	chroma: "oklch",
	red: "rgb",
	green: "rgb",
	blue: "rgb",
	alpha: "rgb",
};

/* A space that has no such channel falls back to the channel's own. */
const resolveSpace = (
	channel: ColorPickerChannel,
	space: ColorPickerColorSpace | undefined,
) =>
	channel !== "alpha" && space && SPACE_CHANNELS[space].includes(channel)
		? space
		: DEFAULT_SPACE[channel];

function channelRange(
	space: ColorPickerColorSpace,
	channel: ColorPickerChannel,
) {
	if (channel === "alpha") return { max: 1, step: 0.01 };
	if (channel === "hue") return { max: 360, step: 1 };
	if (channel === "chroma") return { max: 0.4, step: 0.004 };
	return { max: space === "rgb" ? 255 : 100, step: 1 };
}

function readChannel(
	color: ColorPickerColor,
	space: ColorPickerColorSpace,
	channel: ColorPickerChannel,
) {
	if (channel === "alpha") return color.alpha;
	return toSpace(color, space)[SPACE_CHANNELS[space].indexOf(channel)] ?? 0;
}

function withChannel(
	color: ColorPickerColor,
	space: ColorPickerColorSpace,
	channel: ColorPickerChannel,
	value: number,
): ColorPickerColor {
	if (channel === "alpha") return { ...color, alpha: clamp(value, 0, 1) };
	const channels = [...toSpace(color, space)] as Triple;
	channels[SPACE_CHANNELS[space].indexOf(channel)] = value;
	return { space, channels, alpha: color.alpha };
}

/* Screen reader text for one channel: "210°, blue", "50%", "128". */
function channelValueText(
	color: ColorPickerColor,
	space: ColorPickerColorSpace,
	channel: ColorPickerChannel,
	i18n: ColorPickerI18nConfig,
) {
	const value = readChannel(color, space, channel);
	if (channel === "alpha") return `${Math.round(value * 100)}%`;
	if (channel === "chroma") return fixed(value, 3);
	if (channel === "hue") {
		return `${Math.round(value)}°, ${i18n.functions.getColorName(color)}`;
	}
	return space === "rgb" ? String(Math.round(value)) : `${Math.round(value)}%`;
}

/* The colors a track runs through: the full spectrum for hue, so a gray
   still shows where it would go, and sampled stops elsewhere, since OKLCH
   and HSL lightness do not run straight in sRGB. */
function trackStops(
	color: ColorPickerColor,
	space: ColorPickerColorSpace,
	channel: ColorPickerChannel,
) {
	const opaque = { ...color, alpha: 1 };
	if (channel === "alpha") return ["transparent", toCss(opaque)];
	let base = opaque;
	if (channel === "hue") {
		base =
			space === "oklch"
				? withChannel(
						opaque,
						"oklch",
						"chroma",
						Math.max(readChannel(opaque, "oklch", "chroma"), 0.12),
					)
				: { space: "hsv", channels: [0, 100, 100], alpha: 1 };
	}
	const count =
		channel === "hue" || space === "oklch"
			? 13
			: space === "hsl" && channel === "lightness"
				? 3
				: 2;
	const { max } = channelRange(space, channel);
	const target = channel === "hue" && space !== "oklch" ? "hsv" : space;
	return Array.from({ length: count }, (_, index) =>
		formatColor(
			withChannel(base, target, channel, (max * index) / (count - 1)),
			"rgb",
		),
	);
}

/* The transparency grid behind translucent colors, in theme tokens. */
const CHECKER =
	"repeating-conic-gradient(var(--color-muted) 0 25%, var(--color-background) 0 50%) 50% / 8px 8px";

export {
	CHECKER,
	channelRange,
	channelValueText,
	clamp,
	FORMAT_LABELS,
	fixed,
	parseWithBrowser,
	readChannel,
	resolveSpace,
	SPACE_CHANNELS,
	toCss,
	toRgb,
	toSpace,
	trackStops,
	withChannel,
	wrapHue,
};
