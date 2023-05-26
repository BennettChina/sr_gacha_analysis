import { Logger } from "log4js";
import express from "express";
import AnalysisRoute from "#sr_gacha_analysis/routes/analysis-route";

export function createServer( port: number, logger: Logger ): void {
	const app = express();
	app.use( express.static( __dirname ) );
	app.use( "/api/analysis", AnalysisRoute );
	
	app.listen( port, () => {
		logger.info( `[星铁抽卡分析]插件的 Express 服务器已启动, 端口为: ${ port }` );
	} );
}