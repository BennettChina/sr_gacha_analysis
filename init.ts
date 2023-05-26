import { PluginSetting } from "@modules/plugin";
import { OrderConfig } from "@modules/command";
import { createServer } from "./server";
import { Renderer } from "@modules/renderer";
import { checkDependencies, execHandle } from "#sr_gacha_analysis/util/util";
import { findFreePort } from "@modules/utils";
import { BOT } from "@modules/bot";
import SRGachaAnalysisConfig from "#sr_gacha_analysis/modules/SRGachaAnalysisConfig";

export let renderer: Renderer;
export let gacha_config: SRGachaAnalysisConfig;

const draw_analysis: OrderConfig = {
	type: "order",
	cmdKey: "sr.gacha.analysis",
	desc: [ "星铁抽卡分析", "[抽卡链接]" ],
	headers: [ "星铁抽卡分析" ],
	detail: "目前仅支持使用链接直接分析抽卡数据，可以将链接作为参数直接传入",
	regexps: [ ".*" ],
	ignoreCase: false,
	main: "achieves/analysis"
};

const draw_analysis_history: OrderConfig = {
	type: "order",
	cmdKey: "sr.gacha.analysis.history",
	desc: [ "星铁抽卡历史记录分析", "" ],
	headers: [ "星铁历史记录分析" ],
	regexps: [ "" ],
	detail: "使用历史数据分析",
	main: "achieves/history"
};

const export_gacha_log: OrderConfig = {
	type: "order",
	cmdKey: "sr.gacha.analysis.export_gacha_log",
	desc: [ "导出星铁抽卡记录", "[json|excel|url]" ],
	headers: [ "星铁导出" ],
	regexps: [ "(json|excel|url)" ],
	detail: "导出抽卡记录，目前支持json、excel、url，JSON使用 SRGF 标准。",
	main: "achieves/export"
};

const import_gacha_log: OrderConfig = {
	type: "order",
	cmdKey: "sr.gacha.analysis.import_gacha_log",
	desc: [ "导入星铁抽卡记录", "[json|excel] (文件下载链接)" ],
	headers: [ "星铁导入" ],
	regexps: [ "(json|excel)", "(https?:\\/\\/(?:www\\.)?[-a-zA-Z\\d@:%._+~#=]{1,256}\\.[a-zA-Z\\d()]{1,6}\\b[-a-zA-Z\\d()!@:%_+.~#?&/=]*)?" ],
	detail: "导入抽卡记录，目前支持json、excel。先发送文件，然后回复这个文件消息，在此消息中使用该指令，也可以直接给一个文件的下载链接作为参数。",
	ignoreCase: false,
	main: "achieves/import"
};

const del_gacha_log: OrderConfig = {
	type: "order",
	cmdKey: "sr.gacha.analysis.del_gacha_log",
	desc: [ "清除星铁抽卡记录", "" ],
	headers: [ "清除星铁记录" ],
	regexps: [ "" ],
	detail: "删除上次抽卡统计使用的uid，如果要清除其他账号请重新设置链接或者Cookie再使用一次抽卡统计指令即可切换默认账号。(此举是为了验证你是此uid的拥有者，避免误删他人的数据。)",
	main: "achieves/del"
};

export async function init( { logger, file, renderer: botRender, refresh }: BOT ): Promise<PluginSetting> {
	gacha_config = SRGachaAnalysisConfig.create( file );
	refresh.registerRefreshableFile( SRGachaAnalysisConfig.FILE_NAME, gacha_config );
	
	logger.info( "[星铁抽卡分析] 开始检测插件需要的依赖是否已安装..." );
	const dependencies: string[] = [ "exceljs" ];
	if ( gacha_config.qiniuOss.enable ) {
		dependencies.push( "qiniu" );
	} else if ( gacha_config.qiniuOss.uses3 ) {
		dependencies.push( "@aws-sdk/client-s3" );
	}
	if ( gacha_config.qrcode ) {
		dependencies.push( "qrcode" );
	}
	const need_install_dependencies: string[] = checkDependencies( file, ...dependencies );
	for ( let _dep of need_install_dependencies ) {
		logger.info( `[星铁抽卡分析] 检测到 ${ _dep } 依赖尚未安装，将自动安装该依赖...` )
		const stdout = await execHandle( `npm i ${ _dep }` );
		logger.info( stdout );
	}
	logger.info( "[星铁抽卡分析] 所有插件需要的依赖已安装" );
	
	/* 实例化渲染器 */
	const port: number = await findFreePort( 49029, logger );
	renderer = botRender.register(
		"sr_gacha_analysis", "/views",
		port, "#app"
	);
	createServer( port, logger );
	
	return {
		pluginName: "sr_gacha_analysis",
		cfgList: [ draw_analysis, draw_analysis_history, export_gacha_log, import_gacha_log, del_gacha_log ],
		repo: {
			owner: "BennettChina",
			repoName: "sr_gacha_analysis",
			ref: "master"
		},
		aliases: [ "星铁抽卡分析", "srga" ]
	};
}