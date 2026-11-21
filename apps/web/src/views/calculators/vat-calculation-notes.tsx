/**
 * @file 增值税标题悬停卡内的计算口径与方案来源。
 * 创建时间：2026-11-06；修改时间：2026-11-21。
 * 版本作用：将原底部说明移入标题提示，保留公式、适用范围和当前方案信息。
 * 被调用：VatEditor 通过 ScenarioHeader 展示；调用：共享金额格式化。
 * 预期结果：说明跟随当前草稿及计算结果更新，不单独请求或保存数据。
 */
import { money } from "@leonwillow-electron/calculators";

export default function VatCalculationNotes({
	opening,
	source,
}: {
	opening: number | null;
	source: string;
}) {
	return (
		<div className="wrap-anywhere flex flex-col gap-3 text-muted-foreground">
			<p>
				可抵扣额 = 进项 + 上期留抵 − 进项转出；应纳 = max(销项 − 可抵扣额,
				0)；期末留抵 = max(可抵扣额 − 销项, 0)。
			</p>
			<p>
				当期可抵扣额大于销项时，应纳税额为
				0，期末留抵不作退税，自动顺延至下一个所属期作为期初留抵继续抵扣，不向前冲抵前期应纳税额。
			</p>
			<p>
				调整后销项 = 原销项 + 调增销项 − 调减销项；调整后进项 = 原进项 +
				调增进项 − 调减进项。四项调整均填写非负金额。
			</p>
			<p>
				首期反推期初留抵 {money(opening)}
				元。所属期未填、断档、历史口径不一致或无效调整会暂停后续计算。
			</p>
			<p>
				适用于一般纳税人普通计税测算；历史已办理的留抵退税如已计入当期进项转出（附表二第22栏转入主表第14栏）则沿用原转出口径，未包含简易计税、减免、加计抵减、出口免抵退、多缴税额抵缴及留抵退税专项追缴等特殊事项。应纳增减不等同实际补缴或退税金额。
			</p>
			<p>
				数据来源：{source || "尚未录入"}
				。原始申报可直接在表格中修正，金额按整数分运算。
			</p>
		</div>
	);
}
