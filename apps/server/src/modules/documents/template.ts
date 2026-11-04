/**
 * @file DOCX 模板检查、字段发现与原格式填充。
 * 创建时间：2026-10-10；修改时间：2026-10-10。
 * 版本作用：仅支持普通文本占位符，保留 Word 排版并限制 ZIP 与外部内容。
 * 被调用：documents 服务、模板测试；调用：PizZip、Docxtemplater、InspectModule、XML DOM。
 * 功能与预期结果：跨 run 的字段也能识别；无效模板在取号前拒绝，不解释文书中的指令。
 */
import type { DocumentField } from "@leonwillow-electron/db/schema";
import { DOMParser } from "@xmldom/xmldom";
import Docxtemplater from "docxtemplater";
import InspectModule from "docxtemplater/js/inspect-module.js";
import PizZip from "pizzip";
import { AccessError } from "../access/service";

export const systemFields = ["文书号", "年份", "序号", "文书名称"];
const badTemplate = (message: string): never => {
	throw new AccessError(400, "INVALID_TEMPLATE", message);
};
const validKey = /^[\p{L}_][\p{L}\p{N}_]{0,59}$/u;

/** 在解压前读取 ZIP 目录的展开长度；拒绝 ZIP64、分卷和超过 30MB 的内容。 */
function checkArchive(bytes: Uint8Array) {
	if (!bytes.length || bytes.length > 5 * 1024 * 1024)
		badTemplate("请上传不超过 5MB 的 DOCX 模板。");
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	let end = bytes.length - 22;
	while (
		end >= Math.max(0, bytes.length - 65557) &&
		view.getUint32(end, true) !== 0x06054b50
	)
		end--;
	if (end < 0 || view.getUint32(end, true) !== 0x06054b50)
		badTemplate("文件不是有效的 DOCX 压缩包。");
	const count = view.getUint16(end + 10, true);
	if (
		view.getUint16(end + 4, true) ||
		view.getUint16(end + 6, true) ||
		count > 500 ||
		view.getUint16(end + 8, true) !== count
	)
		badTemplate("模板压缩包结构不受支持。");
	let pos = view.getUint32(end + 16, true);
	let total = 0;
	for (let i = 0; i < count; i++) {
		if (pos + 46 > end || view.getUint32(pos, true) !== 0x02014b50)
			badTemplate("模板压缩目录无效。");
		const size = view.getUint32(pos + 24, true);
		total += size;
		if (
			size > 10 * 1024 * 1024 ||
			total > 30 * 1024 * 1024 ||
			view.getUint16(pos + 8, true) & 1
		)
			badTemplate("模板展开内容过大或经过加密。");
		pos +=
			46 +
			view.getUint16(pos + 28, true) +
			view.getUint16(pos + 30, true) +
			view.getUint16(pos + 32, true);
	}
	if (pos !== end) badTemplate("模板目录长度不符合要求。");
}

function parse(bytes: Uint8Array) {
	checkArchive(bytes);
	const zip = new PizZip(bytes);
	if (!zip.file("word/document.xml"))
		badTemplate("请使用 Word DOCX 文书模板。");
	for (const [name, entry] of Object.entries(zip.files)) {
		if (/vbaProject|embeddings\/|activeX\//i.test(name))
			badTemplate("模板不能包含宏或嵌入对象。");
		if (entry.dir || !/\.(xml|rels)$/.test(name)) continue;
		const xml = entry.asText();
		if (/<!DOCTYPE|<!ENTITY/i.test(xml)) badTemplate("模板不能包含外部实体。");
		const document = new DOMParser({
			onError: () => badTemplate("模板 XML 结构无效。"),
		}).parseFromString(xml, "text/xml");
		if (document.getElementsByTagName("w:altChunk").length)
			badTemplate("请先在 Word 中转换嵌入的 HTML 内容。");
		if (
			document.getElementsByTagName("w:fldSimple").length ||
			document.getElementsByTagName("w:instrText").length
		)
			badTemplate("首版模板请使用普通文本占位符，移除自动域后再导入。");
		for (const rel of Array.from(
			document.getElementsByTagName("Relationship"),
		)) {
			if (rel.getAttribute("TargetMode") === "External")
				badTemplate("请移除模板中的外部链接或远程资源后再导入。");
		}
	}
	const inspect = new InspectModule();
	const doc = new Docxtemplater(zip, {
		modules: [inspect],
		paragraphLoop: false,
		linebreaks: true,
		errorLogging: false,
		parser: (tag) => ({
			get: (scope: Record<string, string>) =>
				Object.hasOwn(scope, tag) ? scope[tag] : "",
		}),
	});
	const keys = Object.keys(inspect.getAllTags());
	if (inspect.getAllStructuredTags().some((part) => part.module))
		badTemplate(
			"首版只支持普通文本字段，请移除循环、条件、图片或 XML 占位符。",
		);
	if (!keys.includes("文书号"))
		badTemplate("模板必须包含 {文书号}，其他填写位置使用 {字段名}。");
	if (keys.length > 64 || keys.some((key) => !validKey.test(key)))
		badTemplate(
			"字段仅支持中文、字母、数字和下划线；首版不支持循环、条件和表达式。",
		);
	return { doc, keys };
}

/** 文件名须为 .docx；返回字段定义，坏 ZIP、无文号或不支持的占位符返回 400。 */
export function inspectTemplate(
	bytes: Uint8Array,
	fileName: string,
): DocumentField[] {
	if (!/\.docx$/i.test(fileName)) badTemplate("仅支持 .docx Word 模板。");
	try {
		return parse(bytes)
			.keys.filter((key) => !systemFields.includes(key))
			.map((key) => ({
				key,
				label: key,
				kind: key.endsWith("日期")
					? "date"
					: key.endsWith("时间")
						? "time"
						: key === "涉税事项"
							? "textarea"
							: "text",
				required: true,
				defaultValue: "",
			}));
	} catch (error) {
		if (error instanceof AccessError) throw error;
		return badTemplate(
			"模板无法解析，请检查占位符是否成对，并使用标准 DOCX 文件。",
		);
	}
}

/** 校验字段和值；取号/保存/预览允许留空，正式 Word 校验必填。已填日期、时间和系统字段始终校验。 */
export function validateValues(
	fields: DocumentField[],
	values: Record<string, string>,
	allowIncomplete = false,
) {
	if (
		Object.keys(values).some(
			(key) => !fields.some((field) => field.key === key),
		)
	)
		throw new AccessError(
			400,
			"UNKNOWN_FIELD",
			"填写内容包含模板未定义的字段。",
		);
	const result: Record<string, string> = Object.create(null);
	for (const field of fields) {
		const value = (values[field.key] ?? field.defaultValue).trim();
		if (!allowIncomplete && field.required && !value)
			throw new AccessError(400, "FIELD_REQUIRED", `请填写${field.label}。`);
		if (
			value.length > 4000 ||
			Array.from(value).some(
				(char) =>
					char.charCodeAt(0) < 32 && ![9, 10, 13].includes(char.charCodeAt(0)),
			)
		)
			throw new AccessError(
				400,
				"INVALID_FIELD",
				`${field.label}内容过长或包含无效字符。`,
			);
		if (
			value &&
			field.kind === "date" &&
			(!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
				!Number.isFinite(Date.parse(value)) ||
				new Date(value).toISOString().slice(0, 10) !== value)
		)
			throw new AccessError(
				400,
				"INVALID_DATE",
				`${field.label}不是有效日期。`,
			);
		if (
			value &&
			field.kind === "time" &&
			!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
		)
			throw new AccessError(
				400,
				"INVALID_TIME",
				`${field.label}不是有效时间。`,
			);
		result[field.key] = value;
	}
	return result;
}

export function validateFields(keys: DocumentField[], fields: DocumentField[]) {
	if (
		fields.length !== keys.length ||
		new Set(fields.map((field) => field.key)).size !== keys.length ||
		fields.some(
			(field) =>
				!keys.some((key) => key.key === field.key) || !field.label.trim(),
		)
	)
		throw new AccessError(
			400,
			"INVALID_FIELDS",
			"字段设置必须与模板中的占位符一一对应。",
		);
	validateValues(
		fields.map((field) => ({ ...field, required: false })),
		{},
	);
}

/** 只填充文本和系统号码，输出保留模板排版的 DOCX；失败返回 400，调用方事务回滚。 */
export function renderDocument(
	bytesBase64: string,
	fields: DocumentField[],
	values: Record<string, string>,
	number: string,
	year: number,
	sequence: number | null,
	name: string,
) {
	try {
		const { doc } = parse(Buffer.from(bytesBase64, "base64"));
		const data: Record<string, string> = Object.create(null);
		for (const field of fields) {
			const value = values[field.key] ?? "";
			data[field.key] =
				value && field.kind === "date"
					? value.replace(
							/^(\d+)-(\d+)-(\d+)$/,
							(_, y, m, d) => `${y}年${Number(m)}月${Number(d)}日`,
						)
					: value && field.kind === "time"
						? value.replace(
								/^(\d+):(\d+)$/,
								(_, h, m) => `${Number(h)}时${Number(m)}分`,
							)
						: value;
		}
		Object.assign(data, {
			文书号: number,
			年份: String(year),
			序号: sequence === null ? "待取号" : String(sequence),
			文书名称: name,
		});
		doc.render(data);
		return doc
			.getZip()
			.generate({ type: "uint8array", compression: "DEFLATE" });
	} catch (error) {
		if (error instanceof AccessError) throw error;
		throw new AccessError(
			400,
			"RENDER_FAILED",
			"无法生成文书，请检查模板和填写内容。",
		);
	}
}
