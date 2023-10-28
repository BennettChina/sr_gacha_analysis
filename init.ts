import { Renderer } from "@/modules/renderer";
import SRGachaAnalysisConfig from "#/sr_gacha_analysis/modules/SRGachaAnalysisConfig";
import { definePlugin } from "@/modules/plugin";
import cfgList from "./commands";
import routers from "./routes";
import { ExportConfig } from "@/modules/config";

export let renderer: Renderer;
export let gacha_config: ExportConfig<SRGachaAnalysisConfig>;

export default definePlugin( {
	name: "星铁抽卡分析",
	cfgList,
	server: {
		routers
	},
	publicDirs: [ "public", "views", "components" ],
	repo: {
		owner: "BennettChina",
		repoName: "sr_gacha_analysis",
		ref: "v3"
	},
	async mounted( params ) {
		gacha_config = params.configRegister( SRGachaAnalysisConfig.FILE_NAME, SRGachaAnalysisConfig.init );
		params.setAlias( gacha_config.aliases );
		gacha_config.on( 'refresh', newCfg => {
			params.setAlias( newCfg.aliases );
		} )
		params.renderRegister( "#app", "views" );
	}
} )